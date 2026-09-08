import { sendEmail, type EmailErrorCode } from "@workspace/sendgrid";
import { roleLabel } from "./phoenix-roles";

type InviteBrand = {
  logoUrl: string;
  primaryColor: string;
  inkColor: string;
  paperColor: string;
};

type InviteEmailOptions = {
  to: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
  workspaceName: string;
  inviterName: string;
  brand: InviteBrand;
  siteUrl: string;
};

export type DeliveryFailure =
  /** No SENDGRID_API_KEY in the environment. */
  | "email_not_configured"
  /** SendGrid will not send as our From address yet — authenticate the domain. */
  | "sender_not_authenticated"
  /** SendGrid answered, and said no. */
  | "provider_rejected"
  /** We could not reach SendGrid at all. */
  | "provider_unavailable";

export type EmailDelivery = { status: "sent" } | { status: "failed"; reason: DeliveryFailure };

/** Collapses the provider's error vocabulary into the four cases the UI acts on. */
const deliveryFailure = (error: EmailErrorCode): DeliveryFailure => {
  if (error === "not_configured") return "email_not_configured";
  if (error === "sender_not_authenticated") return "sender_not_authenticated";
  if (error === "timeout" || error === "network") return "provider_unavailable";
  return "provider_rejected";
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const absoluteUrl = (value: string, siteUrl: string) => {
  try {
    return new URL(value, siteUrl).toString();
  } catch {
    return siteUrl;
  }
};


export function adminInvitationEmail(options: InviteEmailOptions) {
  const { brand, expiresAt, inviterName, inviteUrl, role, siteUrl, workspaceName } = options;
  const safeWorkspace = escapeHtml(workspaceName);
  const safeRole = escapeHtml(roleLabel(role));
  const expiry = escapeHtml(
    expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
  );
  const logoUrl = escapeHtml(absoluteUrl(brand.logoUrl, siteUrl));
  const safeInviteUrl = escapeHtml(inviteUrl);

  return {
    subject: `You're invited to ${workspaceName} as ${roleLabel(role)}`,
    html: `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#e9e5db;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9e5db;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${escapeHtml(brand.paperColor)};border-radius:12px;overflow:hidden;">
<tr><td align="center" style="padding:28px 40px;border-bottom:1px solid #EDE7DA;">
  <a href="${escapeHtml(siteUrl)}"><img src="${logoUrl}" alt="${safeWorkspace}" height="52" style="height:52px;width:auto;border:0;"></a>
</td></tr>
<tr><td style="padding:36px 40px;font-family:Arial,Helvetica,sans-serif;">
  <h2 style="margin:0;font-size:24px;font-weight:800;color:${escapeHtml(brand.inkColor)};">Join ${safeWorkspace}</h2>
  <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#3A4A5E;">${escapeHtml(inviterName)} invited you to the workspace with the <strong>${safeRole}</strong> role.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>
    <td style="background:#ffffff;border:1px solid #EDE7DA;border-radius:10px;padding:18px 22px;">
      <div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8A94A2;">Assigned role</div>
      <div style="margin-top:5px;font-size:16px;font-weight:800;color:${escapeHtml(brand.inkColor)};">${safeRole}</div>
    </td>
  </tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:26px;">
    <a href="${safeInviteUrl}" style="display:inline-block;background:${escapeHtml(brand.primaryColor)};color:#ffffff;border-radius:6px;padding:15px 30px;font-size:14px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;text-decoration:none;">Accept invitation</a>
  </td></tr></table>
  <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#8A94A2;">Already have an account with this address? Sign in when you follow the link and ${safeWorkspace} is added to it — the workspaces you already use are untouched.</p>
  <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8A94A2;text-align:center;">This invitation expires on ${expiry}. If the button does not work, copy this link:<br><a href="${safeInviteUrl}" style="color:${escapeHtml(brand.primaryColor)};word-break:break-all;">${safeInviteUrl}</a></p>
</td></tr>
<tr><td align="center" style="background:${escapeHtml(brand.inkColor)};padding:20px 40px;">
  <span style="font-family:Arial,Helvetica,sans-serif;color:#9FAEC2;font-size:12px;line-height:1.6;">${safeWorkspace} · Workspace invitation</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`,
    // Plain-text alternative. Not decoration: a multipart message renders in
    // text-only clients and reads as less spam-like to filters than HTML alone.
    text: [
      `Join ${workspaceName}`,
      "",
      `${inviterName} invited you to the ${workspaceName} workspace with the ${roleLabel(role)} role.`,
      "",
      "Accept the invitation:",
      inviteUrl,
      "",
      `Already have an account with this address? Sign in when you follow the link and ${workspaceName} is added to it — the workspaces you already use are untouched.`,
      "",
      `This invitation expires on ${expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}.`,
    ].join("\n"),
  };
}

export async function sendAdminInvitationEmail(options: InviteEmailOptions): Promise<EmailDelivery> {
  const message = adminInvitationEmail(options);
  // Invitations come from `noreply`: they are the machine talking, and replies are
  // steered to support by the sender registry rather than dropped on the floor.
  const sent = await sendEmail({
    to: options.to,
    from: "noreply",
    subject: message.subject,
    html: message.html,
    text: message.text,
    categories: ["admin-invitation"],
  });
  return sent.ok ? { status: "sent" } : { status: "failed", reason: deliveryFailure(sent.error) };
}

type DeliveryTestOptions = {
  to: string;
  senderKey: string;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  workspaceName: string;
  siteUrl: string;
};

/**
 * The message behind Admin → Integrations → "Send test". Deliberately plain: it
 * exists to prove a From address is authenticated and reaches an inbox, so the
 * useful content is which sender it came from and where a reply would land.
 */
export function deliveryTestEmail(options: DeliveryTestOptions) {
  const { replyTo, senderEmail, senderKey, senderName, siteUrl, workspaceName } = options;
  const rows: [string, string][] = [
    ["Sender", senderKey],
    ["From", `${senderName} <${senderEmail}>`],
    ["Replies go to", replyTo],
  ];
  return {
    subject: `${workspaceName} email delivery test (${senderKey})`,
    html: `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#e9e5db;font-family:Arial,Helvetica,sans-serif;color:#0F2233;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
<tr><td>
  <h2 style="margin:0;font-size:20px;font-weight:800;">Email delivery is working</h2>
  <p style="margin:12px 0 0;font-size:15px;line-height:1.7;color:#3A4A5E;">If you are reading this, ${escapeHtml(workspaceName)} can send mail through SendGrid as the sender below.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid #EDE7DA;border-radius:10px;">
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:12px 18px;border-bottom:1px solid #F3EFE6;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8A94A2;">${escapeHtml(label)}</td><td style="padding:12px 18px;border-bottom:1px solid #F3EFE6;font-size:14px;color:#0F2233;">${escapeHtml(value)}</td></tr>`,
      )
      .join("")}
  </table>
  <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#8A94A2;">Sent from <a href="${escapeHtml(siteUrl)}" style="color:#8A94A2;">${escapeHtml(siteUrl)}</a>. Nobody was emailed but you.</p>
</td></tr>
</table>
</body>
</html>`,
    text: [
      "Email delivery is working.",
      "",
      `${workspaceName} can send mail through SendGrid as the sender below.`,
      "",
      ...rows.map(([label, value]) => `${label}: ${value}`),
      "",
      `Sent from ${siteUrl}. Nobody was emailed but you.`,
    ].join("\n"),
  };
}
