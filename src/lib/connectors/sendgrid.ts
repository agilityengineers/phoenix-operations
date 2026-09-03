import { getStore } from "../store";
import type { Contact } from "../types";
import { intakeConfirmationEmail, newLeadNotificationEmail } from "../emails/templates";
import type { Connector, OutboundEvent } from "./types";

// SendGrid transactional email via the v3 Mail Send API.
// Templates live in src/lib/emails/templates.ts (per Email Templates.dc.html)
// and render with workspace branding, so white-label workspaces send their own look.

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!key || !from) return false;
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from, name: "Phoenix Operations" },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    return res.status < 300;
  } catch {
    return false;
  }
}

export const sendgridConnector: Connector = {
  name: "sendgrid",

  configured() {
    return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
  },

  async onEvent(event: OutboundEvent, contact: Contact) {
    if (!this.configured()) return;
    const store = getStore();
    const workspace = await store.getWorkspace();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const brand = workspace.brand;

    try {
      // 1 · Intake confirmation → prospect, once the slot is booked
      //     (sequence: "Confirmation (immediate)" on intake.completed + slot booked).
      if (event === "intake.completed" && contact.bookedSlot) {
        const first = (contact.name || "there").split(" ")[0];
        const confirmation = intakeConfirmationEmail({
          firstName: first,
          slot: contact.bookedSlot,
          brand,
          siteUrl,
        });
        const sent = await sendMail(contact.email, confirmation.subject, confirmation.html);
        await store.addActivity({
          workspaceId: contact.workspaceId,
          contactId: contact.id,
          type: "email",
          title: sent ? "Confirmation email sent" : "Confirmation email queued (SendGrid unavailable)",
          body: "SendGrid · intake-confirmation template" + (sent ? " · delivered" : ""),
        });
      }

      // 2 · New-lead notification → owner, when the lead lands
      if (event === "lead.created") {
        const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
        if (ownerEmail) {
          const notification = newLeadNotificationEmail({
            contact,
            quote: contact.answers?.bounceback,
            brand,
            siteUrl,
          });
          await sendMail(ownerEmail, notification.subject, notification.html);
        }
      }
    } catch {
      // Email failures never break the intake flow.
    }
  },
};
