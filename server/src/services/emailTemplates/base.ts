/** Wraps any HTML content in a consistent branded shell. */
export function baseTemplate(
  title: string,
  body: string,
  ctaHref?: string,
  ctaLabel?: string
): string {
  const cta =
    ctaHref && ctaLabel
      ? `<tr><td style="padding:24px 0 0;text-align:center;">
           <a href="${ctaHref}"
              style="display:inline-block;padding:12px 28px;background:#1a1a2e;color:#fff;
                     text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
             ${ctaLabel}
           </a>
         </td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;overflow:hidden;
                      box-shadow:0 2px 8px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:28px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:22px;font-weight:700;
                           letter-spacing:.05em;">SECRITOU</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 16px;">
              ${body}
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${cta}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:32px 40px;text-align:center;border-top:1px solid #e5e7eb;
                       color:#9ca3af;font-size:12px;line-height:1.6;">
              © ${new Date().getFullYear()} Secritou. Tous droits réservés.<br/>
              Vous recevez cet email car vous avez un compte sur la plateforme Secritou.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Reusable heading */
export function h1(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:24px;font-weight:700;color:#111827;">${text}</h1>`;
}

/** Reusable paragraph */
export function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">${text}</p>`;
}

/** Highlighted info box */
export function infoBox(rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#6b7280;
                     width:40%;vertical-align:top;">${label}</td>
          <td style="padding:8px 12px;font-size:14px;color:#111827;">${value}</td>
        </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                 style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;
                        margin:16px 0;">
            <tbody>${cells}</tbody>
          </table>`;
}
