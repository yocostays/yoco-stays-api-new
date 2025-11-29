import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "sandeep.nandanwar@raisoni.net",
    pass: "hkop aywb mcra ergi", 
  },
});

export async function sendStudentWelcomeEmail(params: {
  email: string;
  name: string;
  uniqueId: string;
  plainPassword: string;
}) {
  const { email, name, uniqueId, plainPassword } = params;

  await transporter.verify();

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background:#f9fafb; padding:20px; border-radius:10px; color:#111;">
      <h2 style="margin-bottom:8px;">Welcome to Yoco Stays</h2>

      <p style="margin:8px 0;">Dear ${name},</p>

      <p style="margin:8px 0;">
        Your student account has been created successfully.
      </p>

      <div style="margin:16px 0; padding:12px 16px; background:#ffffff; border-radius:8px; border:1px solid #e5e7eb;">
        <p style="margin:4px 0;"><strong>Student ID:</strong> ${uniqueId}</p>
        <p style="margin:4px 0;"><strong>Temporary Password:</strong> ${plainPassword}</p>
      </div>

      <p style="margin:8px 0;">
        For security, please log in and change this password immediately after your first login.
      </p>

      <p style="margin-top:16px;">Regards,<br/>Yoco Stays Team</p>
    </div>
  `;

  await transporter.sendMail({
    from: '"Yoco Stays" <mayur.tekale@raisoni.net>',
    to: email,
    subject: "Your Yoco Stays account credentials",
    html: htmlContent,
  });
}
