import nodemailer from "nodemailer";

const port = process.env.EMAL_PORT ? parseInt(process.env.EMAL_PORT) : 465;
const secure = port === 465; 

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: port,
  secure: secure,
  pool: true,
  maxConnections: parseInt(process.env.EMAIL_CONCURRENCY || "5"),
  maxMessages: 100, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === "production"
  }
});

export async function verifyConnection() {
  try {
    await transporter.verify();
    return true;
  } catch (error: any) {
    return false;
  }
}

export async function sendStudentWelcomeEmail(params: {
  email: string;
  name: string;
  uniqueId: string;
  plainPassword: string;
}) {
  const { email, name, uniqueId, plainPassword } = params;

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

      <h3 style="margin-top:20px; margin-bottom:12px;">Download the Yoco Stays App</h3>

      <div style="margin-bottom:16px;">
        <a href="https://play.google.com/store/apps/details?id=com.colladome.yoco" target="_blank" style="display:inline-block;">
          <img 
            src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
            alt="Download on Google Play"
            style="height:50px;">
        </a>
      </div>

      <p style="margin:8px 0;">Or use the direct link:</p>

      <p style="margin:4px 0;">
        <a href="https://play.google.com/store/apps/details?id=com.colladome.yoco" target="_blank">
          Android App (Google Play Store)
        </a>
      </p>

      <p style="margin-top:20px; margin-bottom:4px;">After installing the app:</p>

      <ul style="padding-left:20px; margin:8px 0;">
        <li>Open the Yoco Stays app</li>
        <li>Log in using your Student ID and Temporary Password</li>
        <li>Complete your profile</li>
        <li>Change your password immediately</li>
      </ul>

      <p style="margin-top:16px;">Regards,<br/>Yoco Stays Team</p>
    </div>
  `;

  const textContent = `
Welcome to Yoco Stays

Dear ${name},

Your student account has been created successfully.

Student ID: ${uniqueId}
Temporary Password: ${plainPassword}

For security, please log in and change this password immediately after your first login.

Download the Yoco Stays App: https://play.google.com/store/apps/details?id=com.colladome.yoco

Regards,
Yoco Stays Team
  `;

  return await transporter.sendMail({
    from: `"Yoco Stays" <${process.env.EMAIL_FROM}>`, 
    to: email,
    subject: "Your Yoco Stays account credentials",
    html: htmlContent,
    text: textContent,
  });

}