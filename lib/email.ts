import "server-only";
import { query } from "./db";

export type EmailStatus = "sent" | "logged" | "failed";

interface Mail {
  to: string;
  subject: string;
  body: string;
}

/**
 * Where to send: either discrete SMTP_HOST/PORT/USER/PASS (recommended — no URL
 * escaping to get wrong) or a single SMTP_URL connection string. Most free
 * providers (Brevo, Mailjet, Gmail) give you a host/port/login/key, which maps
 * straight onto the discrete vars.
 */
function transportConfig(): string | Record<string, unknown> | null {
  if (process.env.SMTP_HOST) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true", // true only for port 465
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    };
  }
  if (process.env.SMTP_URL) return process.env.SMTP_URL;
  return null;
}

/**
 * Sends an email via SMTP when configured (see transportConfig). With no SMTP
 * configured the message is logged to the server console so local development
 * still works. Every attempt is recorded in email_outbox regardless.
 */
export async function sendEmail(mail: Mail): Promise<EmailStatus> {
  const config = transportConfig();
  const from = process.env.MAIL_FROM || "Freedom CC <no-reply@freedom-cc.app>";
  let status: EmailStatus = "logged";
  let error: string | null = null;

  if (config) {
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transport = nodemailer.createTransport(config as never);
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
