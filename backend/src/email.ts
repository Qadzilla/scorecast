import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendEmail(to: string, subject: string, html: string) {
  console.log(`[Email] Sending to: ${to}, subject: ${subject}`);
  
  if (!resend) {
    console.warn(`[Email] RESEND_API_KEY not configured. Email not sent.`);
    return { id: "skipped", message: "Email skipped - no API key configured" };
  }
  
  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "ScoreCast <noreply@scorecast.club>",
      to,
      subject,
      html,
    });
    console.log(`[Email] Result:`, JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error(`[Email] Error:`, error);
    throw error;
  }
}
