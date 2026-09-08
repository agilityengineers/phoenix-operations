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

export type EmailDelivery =
  | { status: "sent" }
  | { status: "failed"; reason: "email_not_configured" | "provider_rejected" | "provider_unavailable" };

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

const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

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
  };
}

export async function sendAdminInvitationEmail(options: InviteEmailOptions): Promise<EmailDelivery> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim();
  const fromEmail = process.env.SENDGRID_FROM_EMAIL?.trim();
  if (!apiKey || !fromEmail) return { status: "failed", reason: "email_not_configured" };

  const message = adminInvitationEmail(options);
  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: fromEmail, name: options.workspaceName },
        subject: message.subject,
        content: [{ type: "text/html", value: message.html }],
      }),
    });
    return response.ok ? { status: "sent" } : { status: "failed", reason: "provider_rejected" };
  } catch {
    return { status: "failed", reason: "provider_unavailable" };
  }
}