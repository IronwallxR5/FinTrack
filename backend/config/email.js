/**
 * Email sender — uses SendGrid (@sendgrid/mail).
 *
 * Required environment variables:
 *   SENDGRID_API_KEY  — your SendGrid API key (starts with SG.)
 *   EMAIL_FROM        — verified sender address, e.g. notifications@yourapp.com
 *
 * If SENDGRID_API_KEY is absent the function logs to the console instead of
 * sending, so the app works in local dev without a live API key.
 */

let sgMail;
try {
  sgMail = require("@sendgrid/mail");
  if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  } else {
    sgMail = null;
  }
} catch {
  sgMail = null;
}

/**
 * Send an email.
 * @param {{ to: string, subject: string, text: string, html: string }} opts
 */
async function sendEmail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || "notifications@fintrack.app";

  if (!sgMail) {
    console.log(
      `[Email – no SendGrid key] To: ${to} | Subject: ${subject}\n${text}`
    );
    return;
  }

  try {
    await sgMail.send({ to, from, subject, text, html });
  } catch (err) {
    console.error("[Email send error]", err?.response?.body || err.message);
  }
}

module.exports = { sendEmail };
