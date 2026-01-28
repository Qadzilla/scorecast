import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string) {
  console.log(`[Email] Sending to: ${to}, subject: ${subject}`);
  try {
    const result = await resend.emails.send({
      from: "onboarding@resend.dev",
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
