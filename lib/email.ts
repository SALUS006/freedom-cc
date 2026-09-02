import "server-only";
import { query } from "./db";

export type EmailStatus = "sent" | "logged" | "failed";

interface Mail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Sends an email via SMTP when SMTP_URL is configured (e.g. a SendGrid / Mailgun
 * / Postmark add-on: `smtp://user:pass@host:587`). With no SMTP configured the
 * message is logged to the server console so local development still works.
 * Every attempt is recorded in email_outbox.
 */
export async function sendEmail(mail: Mail): Promise<EmailStatus> {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.MAIL_FROM || "Freedom CC <no-reply@freedom-cc.app>";
  let status: EmailStatus = "logged";
  let error: string | null = null;

  if (smtpUrl) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transport = nodemailer.createTransport(smtpUrl);
      await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.body });
      status = "sent";
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
      console.error("email send failed:", error);
    }
  } else {
    console.log(
      `\n──────── EMAIL (no SMTP configured) ────────\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.body}\n───────────────────────────────────────────\n`
    );
  }

  try {
    await query(
      `insert into email_outbox (to_email, subject, body, status, error, sent_at)
       values ($1,$2,$3,$4,$5, case when $4 = 'sent' then now() else null end)`,
      [mail.to, mail.subject, mail.body, status, error]
    );
  } catch {
    /* outbox is best-effort */
  }

  return status;
}
