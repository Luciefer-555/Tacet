// Provider-agnostic email sending. For now, logs to console.
// Swap the internals of sendEmail() to use Resend/SendGrid/etc. later —
// nothing else in the app needs to change.

interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail({ to, subject, body }: SendEmailParams): Promise<void> {
  // STUB: replace this with a real provider call (e.g. Resend) when ready.
  console.log('\n========== EMAIL (STUB — NOT ACTUALLY SENT) ==========');
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  console.log('========================================================\n');
}

export async function sendVerificationEmail(email: string, verificationLink: string, role?: string): Promise<void> {
  const roleLabel = role === 'mentor' ? 'mentor account' : 'hiring manager account';
  await sendEmail({
    to: email,
    subject: `Verify your Tacet ${roleLabel}`,
    body: `Click this link to verify your account and start posting problems:\n\n${verificationLink}\n\nThis link expires in 24 hours.`,
  });
}
