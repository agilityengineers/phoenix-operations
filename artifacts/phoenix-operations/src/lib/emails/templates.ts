import type { Brand, Contact, GuideProfile } from "../types";

// Transactional email HTML per Email Templates.dc.html — 600px, table-safe,
// Arial fallbacks. Brand assets + guide identity render per workspace
// (white-label): logo URL and colors arrive as variables.

type EmailBrand = Pick<Brand, "logoUrl" | "primaryColor" | "inkColor" | "paperColor">;

const F = "font-family: Arial, Helvetica, sans-serif;";

function shell(brand: EmailBrand, siteUrl: string, headerHtml: string, bodyHtml: string, footerHtml: string) {
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#e9e5db;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9e5db;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:${brand.paperColor};border-radius:12px;overflow:hidden;">
${headerHtml}
${bodyHtml}
${footerHtml}
</table>
</td></tr>
</table>
</body>
</html>`;
}

function logoHeader(brand: EmailBrand, siteUrl: string) {
  return `<tr><td align="center" style="padding:28px 40px;border-bottom:1px solid #EDE7DA;">
  <a href="${siteUrl}"><img src="${absolute(brand.logoUrl, siteUrl)}" alt="Phoenix Operations" height="52" style="height:52px;width:auto;border:0;"></a>
</td></tr>`;
}

function absolute(url: string, siteUrl: string) {
  return url.startsWith("http") ? url : `${siteUrl}${url}`;
}

const inkFooter = (brand: EmailBrand, siteUrl: string, line: string) => `<tr><td align="center" style="background:${brand.inkColor};padding:20px 40px;">
  <span style="${F}color:#9FAEC2;font-size:12px;line-height:1.6;">${line}<br>
  <a href="${siteUrl}/legal/privacy" style="color:#7E8DA1;text-decoration:none;">Privacy</a> · <a href="#" style="color:#7E8DA1;text-decoration:none;">Unsubscribe</a></span>
</td></tr>`;

// ── 1 · Intake confirmation → prospect ─────────────────────────────────────
export function intakeConfirmationEmail(opts: {
  firstName: string;
  slot?: string;
  brand: EmailBrand;
  siteUrl: string;
}) {
  const { firstName, slot, brand, siteUrl } = opts;
  const slotBlock = slot
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>
        <td style="background:#ffffff;border:1px solid #EDE7DA;border-radius:10px;padding:22px 26px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td width="46" style="background:#FBEFE4;border-radius:10px;text-align:center;font-size:20px;line-height:46px;">📅</td>
            <td style="padding-left:18px;">
              <div style="${F}font-size:16px;font-weight:800;color:${brand.inkColor};">${slot}</div>
              <div style="${F}font-size:13px;color:#6A7686;margin-top:3px;">15 minutes · video link included in the calendar invite</div>
            </td>
          </tr></table>
        </td></tr></table>`
    : "";
  const body = `<tr><td style="padding:36px 40px;">
    <h2 style="margin:0;${F}font-size:24px;font-weight:800;color:${brand.inkColor};">You're ${slot ? "booked" : "all set"}, ${firstName}.</h2>
    <p style="margin:14px 0 0;${F}font-size:15px;line-height:1.7;color:#3A4A5E;">Thanks for sharing what's going on in your business. ${slot ? "Your 15-minute conversation is confirmed:" : "Pick a time for your 15-minute conversation whenever you're ready."}</p>
    ${slotBlock}
    <p style="margin:20px 0 0;${F}font-size:15px;line-height:1.7;color:#3A4A5E;"><strong>Nothing to prepare.</strong> Come ready to talk about the issue creating the most frustration right now. This is a conversation, not a sales pitch — if we can help, great. If we can't, we'll tell you.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:24px;">
      <a href="${siteUrl}" style="${F}display:inline-block;background:${brand.primaryColor};color:#ffffff;border-radius:6px;padding:15px 30px;font-size:14px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;">Add to calendar</a>
    </td></tr></table>
    <p style="margin:22px 0 0;${F}font-size:13px;color:#8A94A2;text-align:center;">Need to reschedule? <a href="${siteUrl}/f/lack-of-control" style="color:${brand.primaryColor};font-weight:700;text-decoration:none;">Pick a new time</a></p>
  </td></tr>`;
  return {
    subject: slot ? `You're booked, ${firstName} — ${slot}` : `Thanks, ${firstName} — pick a time when you're ready`,
    html: shell(
      opts.brand,
      siteUrl,
      logoHeader(brand, siteUrl),
      body,
      inkFooter(brand, siteUrl, "Phoenix Operations · You received this because you scheduled a conversation at phoenix-operations.com")
    ),
  };
}

// ── 2 · New-lead notification → owner ──────────────────────────────────────
export function newLeadNotificationEmail(opts: {
  contact: Contact;
  quote?: string;
  brand: EmailBrand;
  siteUrl: string;
}) {
  const { contact, quote, brand, siteUrl } = opts;
  const rows: Array<[string, string]> = [
    ["Email", contact.email],
    ["Phone", contact.phone ?? "—"],
    ["Role", contact.role],
    ["Industry", contact.answers?.industry ?? "—"],
    ["Revenue", contact.answers?.revenue ?? "—"],
    ["Team", contact.answers?.employees ?? "—"],
    ["Urgency", contact.answers?.urgency ?? "—"],
    [
      "Coachability",
      contact.answers?.coachAdmit && contact.answers?.coachOpen
        ? `${contact.answers.coachAdmit}/5 and ${contact.answers.coachOpen}/5`
        : "—",
    ],
    ["Booked", contact.bookedSlot ?? "Not yet booked"],
  ];
  const header = `<tr><td style="background:${brand.inkColor};padding:22px 40px;">
    <table role="presentation" width="100%"><tr>
      <td style="${F}color:#ffffff;font-size:15px;font-weight:800;">🔥 New ${contact.score >= 70 ? "qualified " : ""}lead</td>
      <td align="right"><span style="${F}background:${contact.score >= 70 ? "#E8F3EA" : "#F6E8E6"};color:${contact.score >= 70 ? "#2E7D43" : "#B04A3A"};font-size:13px;font-weight:800;border-radius:20px;padding:6px 14px;">Score ${contact.score}</span></td>
    </tr></table>
  </td></tr>`;
  const rowsHtml = rows
    .map(
      ([k, v]) => `<tr>
      <td width="150" style="${F}color:#8A94A2;font-weight:600;font-size:13px;padding:7px 0;">${k}</td>
      <td style="${F}font-weight:600;font-size:13px;padding:7px 0;color:${brand.inkColor};">${escapeHtml(v)}</td></tr>`
    )
    .join("");
  const quoteBlock = quote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>
      <td style="background:#FBF4E9;border:1px solid #EDDCC0;border-radius:10px;padding:16px 20px;">
        <div style="${F}font-size:12px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#B5541C;">In their words</div>
        <p style="margin:8px 0 0;${F}font-size:14px;line-height:1.6;font-style:italic;color:#3A4A5E;">"${escapeHtml(quote)}"</p>
      </td></tr></table>`
    : "";
  const source = [
    contact.funnel + " funnel",
    contact.utm?.utm_source ? `${contact.utm.utm_source} / ${contact.utm.utm_medium ?? "direct"}` : contact.source,
    contact.utm?.utm_campaign,
  ]
    .filter(Boolean)
    .join(" · ");
  const body = `<tr><td style="padding:32px 40px;">
    <h2 style="margin:0;${F}font-size:22px;font-weight:800;color:${brand.inkColor};">${escapeHtml(contact.name)} — ${escapeHtml(contact.company)}</h2>
    <p style="margin:6px 0 0;${F}font-size:13px;color:#8A94A2;">${escapeHtml(source)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>
      <td style="background:#ffffff;border:1px solid #EDE7DA;border-radius:10px;padding:20px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      </td></tr></table>
    ${quoteBlock}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:22px;">
      <a href="${siteUrl}/admin/contacts/${contact.id}" style="${F}display:inline-block;background:${brand.primaryColor};color:#ffffff;border-radius:6px;padding:13px 24px;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;">Open in CRM</a>
      &nbsp;&nbsp;<a href="${siteUrl}/admin/contacts" style="${F}display:inline-block;border:2px solid ${brand.inkColor};color:${brand.inkColor};border-radius:6px;padding:11px 24px;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;">View pipeline</a>
    </td></tr></table>
  </td></tr>`;
  const footer = `<tr><td align="center" style="border-top:1px solid #EDE7DA;padding:16px 40px;">
    <span style="${F}color:#8A94A2;font-size:12px;">Internal notification · Phoenix Operations CRM · manage notification rules in Settings</span>
  </td></tr>`;
  return {
    subject: `🔥 New lead: ${contact.name} (${contact.company}) — score ${contact.score}`,
    html: shell(brand, siteUrl, header, body, footer),
  };
}

// ── 3 · Call reminder → prospect (24h before) ──────────────────────────────
export function callReminderEmail(opts: {
  slot: string;
  brand: EmailBrand;
  siteUrl: string;
  guide: Pick<GuideProfile, "name">;
}) {
  const { slot, brand, siteUrl } = opts;
  const body = `<tr><td style="padding:32px 40px;" align="center">
    <h2 style="margin:0;${F}font-size:22px;font-weight:800;color:${brand.inkColor};">Tomorrow: your 15-minute conversation</h2>
    <p style="margin:12px 0 0;${F}font-size:15px;color:#3A4A5E;">${escapeHtml(slot)}</p>
    <p style="margin:16px auto 0;max-width:420px;${F}font-size:14px;line-height:1.7;color:#6A7686;">One useful thing to think about beforehand: of everything happening in the business right now, what's the one thing you'd fix first if you could?</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
      <td><a href="#" style="${F}display:inline-block;background:${brand.primaryColor};color:#ffffff;border-radius:6px;padding:13px 24px;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;">Join the call</a></td>
      <td style="padding-left:12px;"><a href="${siteUrl}/f/lack-of-control" style="${F}display:inline-block;border:2px solid #E0DACB;color:#6A7686;border-radius:6px;padding:11px 24px;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-decoration:none;">Reschedule</a></td>
    </tr></table>
  </td></tr>`;
  return {
    subject: `Tomorrow: your 15-minute conversation — ${slot}`,
    html: shell(brand, siteUrl, logoHeader(brand, siteUrl), body, inkFooter(brand, siteUrl, "Phoenix Operations")),
  };
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
