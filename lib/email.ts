import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  if (!resend || !to) return;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM ?? 'Blackmoor <dm@kevintraywick.com>',
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error('sendEmail failed:', err);
  }
}
