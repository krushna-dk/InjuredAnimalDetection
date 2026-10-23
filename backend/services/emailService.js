"use strict";

/**
 * emailService.js — HTTPS-First Email Delivery
 * =============================================
 * Priority order (all over HTTPS port 443 — never blocked by Render):
 *   1. Resend API  (set RESEND_API_KEY in Render env vars)
 *   2. Brevo API   (set BREVO_API_KEY in Render env vars)
 *   3. SMTP Nodemailer fallback (for local dev only — blocked on Render)
 *
 * On Render Free tier, SMTP ports 25/465/587 are blocked by firewall.
 * Resend and Brevo communicate purely over HTTPS (port 443) — always works.
 */

const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { pool, getIsDbConnected } = require("../config/db");

const dns = require("dns");
try { dns.setDefaultResultOrder("ipv4first"); } catch (_) {}

let _transporter = null;

// ---------------------------------------------------------------------------
// Resolve image to base64 string (needed for Resend/Brevo inline attachment)
// ---------------------------------------------------------------------------
function resolveImageBase64(imagePath) {
  if (!imagePath) return null;

  // Already a data URI — extract base64
  if (imagePath.startsWith("data:")) {
    const matches = imagePath.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      return { mimeType: matches[1], base64: matches[2] };
    }
    return null;
  }

  // File path — read and convert
  const clean = imagePath.replace(/^[/\\]+/, "");
  const candidates = [
    path.isAbsolute(imagePath) ? imagePath : null,
    path.join(__dirname, "..", clean),
    path.join(__dirname, "..", "..", clean)
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        const buf = fs.readFileSync(p);
        const ext = path.extname(p).toLowerCase().replace(".", "") || "jpeg";
        const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
        return { mimeType: mimeMap[ext] || "image/jpeg", base64: buf.toString("base64") };
      } catch (_) {}
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fetch rescue contact emails from MySQL rescue_contacts table
// ---------------------------------------------------------------------------
async function fetchRecipientEmails() {
  const fallbackEmail = process.env.SMTP_USER || "dahiphalekrishna244@gmail.com";
  try {
    const [rows] = await pool.query(
      "SELECT email FROM rescue_contacts WHERE active = 1 AND email IS NOT NULL AND email != '' ORDER BY id ASC;"
    );
    const emails = rows.map(r => r.email).filter(Boolean);
    if (emails.length > 0) {
      return Array.from(new Set([...emails, fallbackEmail]));
    }
  } catch (err) {
    console.error("[EmailService] Failed to query rescue_contacts:", err.message);
  }
  return [fallbackEmail];
}

// ---------------------------------------------------------------------------
// Helper: Camera display label
// ---------------------------------------------------------------------------
function getCameraLabel(cameraId) {
  if (!cameraId) return "Camera 1";
  const numMatch = String(cameraId).match(/\d+/);
  if (numMatch) return `Camera ${parseInt(numMatch[0], 10)}`;
  return String(cameraId);
}

// ---------------------------------------------------------------------------
// Build HTML email body
// ---------------------------------------------------------------------------
function buildHtmlBody(report) {
  const reportCode = report.report_code || "IA-UNKNOWN";
  const severityColor =
    report.severity === "Severe"   ? "#c62828" :
    report.severity === "Moderate" ? "#e65100" : "#2e7d32";

  const isAutomatic = (report.report_source || "").toUpperCase() === "AUTOMATIC" || Boolean(report.camera_id);
  const cameraLabel = getCameraLabel(report.camera_id);

  if (isAutomatic) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Automatic Detection Alert - ${reportCode}</title>
  <style>
    body{margin:0;padding:20px;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
    .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #d0e4d4}
    .hdr{background:#b71c1c;color:#fff;padding:28px 24px;text-align:center}
    .hdr h1{margin:0 0 8px;font-size:22px;letter-spacing:.4px}
    .badge{display:inline-block;padding:5px 16px;border-radius:20px;background:rgba(255,255,255,.15);font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,.3)}
    .body{padding:28px 24px;color:#1e2a1e;font-size:14px;line-height:1.65}
    .alert{background:#ffebee;border-left:4px solid #d32f2f;padding:12px 16px;border-radius:4px;margin-bottom:22px;font-weight:500;color:#b71c1c}
    table.info{width:100%;border-collapse:collapse;margin-bottom:22px}
    table.info td{padding:9px 12px;border-bottom:1px solid #edf5ef;font-size:14px}
    table.info td.lbl{font-weight:600;color:#3d5a42;width:38%}
    table.info td.val{color:#1e2a1e}
    .stitle{font-size:13px;font-weight:700;color:#b71c1c;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px}
    .tbox{background:#fdf2f2;border:1px solid #f5c6cb;border-radius:6px;padding:12px;margin-bottom:18px;font-size:14px}
    .photo-wrap{text-align:center;margin:20px 0}
    .photo-wrap img{max-width:100%;border-radius:8px;border:2px solid #f5c6cb}
    .ftr{background:#f6faf7;padding:16px 24px;text-align:center;font-size:12px;color:#6c757d;border-top:1px solid #e4ede6}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>URGENT: Injured Animal Detected by AI Camera</h1>
      <span class="badge">Report ID: ${reportCode} &bull; ${cameraLabel}</span>
    </div>
    <div class="body">
      <div class="alert">
        ⚠️ An injured animal was automatically detected by AI surveillance on <strong>${cameraLabel} (${report.camera_id || "CAM-001"})</strong>. Immediate rescue response requested.
      </div>
      <table class="info">
        <tr><td class="lbl">Report ID</td>      <td class="val"><strong>${reportCode}</strong></td></tr>
        <tr><td class="lbl">Detection Source</td><td class="val"><strong style="color:#b71c1c">Automatic AI Camera</strong></td></tr>
        <tr><td class="lbl">Camera</td>          <td class="val"><strong>${cameraLabel}</strong> (${report.camera_id || "CAM-001"})</td></tr>
        <tr><td class="lbl">Animal Type</td>    <td class="val">${report.animal_type || "Unknown"}</td></tr>
        <tr><td class="lbl">Breed</td>          <td class="val">${report.breed || "Unknown"}</td></tr>
        <tr><td class="lbl">Injury Type</td>    <td class="val"><strong>${report.injury_type || "Visible injury"}</strong></td></tr>
        <tr><td class="lbl">Severity</td>       <td class="val"><span style="color:${severityColor};font-weight:700">${report.severity || "Moderate"}</span></td></tr>
        <tr><td class="lbl">AI Confidence</td>  <td class="val"><strong>${Math.round((report.confidence || 1) * 100)}%</strong></td></tr>
        <tr><td class="lbl">Location</td>       <td class="val">${report.location_name || report.location || "Live Camera Feed"}</td></tr>
        <tr><td class="lbl">Date</td>           <td class="val">${report.report_date || "Not specified"}</td></tr>
        <tr><td class="lbl">Time</td>           <td class="val">${report.report_time || "Not specified"}</td></tr>
        <tr><td class="lbl">Status</td>         <td class="val"><span style="color:#e65100;font-weight:600">${report.report_status || "Pending Rescue"}</span></td></tr>
      </table>
      <p class="stitle">AI Detection Description</p>
      <div class="tbox">${report.description || "Injured animal detected via automatic camera stream."}</div>
      <p class="stitle">Recommended Rescue Action</p>
      <div class="tbox">${report.recommended_action || "Dispatch rescue volunteer."}</div>
      ${report.image_path ? '<div class="photo-wrap"><p class="stitle">Captured Camera Snapshot</p><img src="cid:animal_photo" alt="Captured Camera Snapshot"></div>' : "<p><em>No image attached</em></p>"}
    </div>
    <div class="ftr">
      Injured Animal Detection Platform - Automatic AI Surveillance Alert<br>
      <em>Dispatched automatically from ${cameraLabel} live camera feed.</em>
    </div>
  </div>
</body>
</html>`;
  }

  // Manual citizen report template
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Injured Animal Report - ${reportCode}</title>
  <style>
    body{margin:0;padding:20px;background:#f0f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
    .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #d0e4d4}
    .hdr{background:#145a2c;color:#fff;padding:28px 24px;text-align:center}
    .hdr h1{margin:0 0 8px;font-size:22px;letter-spacing:.4px}
    .badge{display:inline-block;padding:5px 16px;border-radius:20px;background:rgba(255,255,255,.15);font-size:13px;font-weight:600;border:1px solid rgba(255,255,255,.3)}
    .body{padding:28px 24px;color:#1e2a1e;font-size:14px;line-height:1.65}
    .alert{background:#fff8e1;border-left:4px solid #ffa000;padding:12px 16px;border-radius:4px;margin-bottom:22px;font-weight:500;color:#5d4037}
    table.info{width:100%;border-collapse:collapse;margin-bottom:22px}
    table.info td{padding:9px 12px;border-bottom:1px solid #edf5ef;font-size:14px}
    table.info td.lbl{font-weight:600;color:#3d5a42;width:38%}
    table.info td.val{color:#1e2a1e}
    .stitle{font-size:13px;font-weight:700;color:#145a2c;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px}
    .tbox{background:#f6faf7;border:1px solid #ddeee0;border-radius:6px;padding:12px;margin-bottom:18px;font-size:14px}
    .photo-wrap{text-align:center;margin:20px 0}
    .photo-wrap img{max-width:100%;border-radius:8px;border:2px solid #d0e4d4}
    .ftr{background:#f6faf7;padding:16px 24px;text-align:center;font-size:12px;color:#6c757d;border-top:1px solid #e4ede6}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>URGENT: Injured Animal Report</h1>
      <span class="badge">Report ID: ${reportCode}</span>
    </div>
    <div class="body">
      <div class="alert">
        An injured animal manual report has been submitted. Immediate rescue response requested.
      </div>
      <table class="info">
        <tr><td class="lbl">Report ID</td>      <td class="val"><strong>${reportCode}</strong></td></tr>
        <tr><td class="lbl">Animal Type</td>    <td class="val">${report.animal_type || "Unknown"}</td></tr>
        <tr><td class="lbl">Breed</td>          <td class="val">${report.breed || "Unknown"}</td></tr>
        <tr><td class="lbl">Injury Type</td>    <td class="val"><strong>${report.injury_type || "Visible injury"}</strong></td></tr>
        <tr><td class="lbl">Severity</td>       <td class="val"><span style="color:${severityColor};font-weight:700">${report.severity || "Moderate"}</span></td></tr>
        <tr><td class="lbl">Location</td>       <td class="val">${report.location_name || report.location || "Not specified"}</td></tr>
        <tr><td class="lbl">Date</td>           <td class="val">${report.report_date || "Not specified"}</td></tr>
        <tr><td class="lbl">Time</td>           <td class="val">${report.report_time || "Not specified"}</td></tr>
        <tr><td class="lbl">Reporter Name</td>  <td class="val">${report.reporter_name || "Citizen Reporter"}</td></tr>
        <tr><td class="lbl">Reporter Email</td> <td class="val"><strong style="color:#145a2c">${report.reporter_email || "Not provided"}</strong></td></tr>
        <tr><td class="lbl">Reporter Phone</td> <td class="val">${report.reporter_contact || "Not provided"}</td></tr>
      </table>
      <p class="stitle">Description</p>
      <div class="tbox">${report.description || "No description provided."}</div>
      <p class="stitle">Recommended Action</p>
      <div class="tbox">${report.recommended_action || "Dispatch rescue volunteer."}</div>
      ${report.image_path ? '<div class="photo-wrap"><p class="stitle">Animal Image</p><img src="cid:animal_photo" alt="Animal Image"></div>' : "<p><em>No image attached</em></p>"}
    </div>
    <div class="ftr">
      Injured Animal Detection Platform - Rescue Notification<br>
      <em>Dispatched automatically from manual report submission.</em>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Log delivery attempt to MySQL report_delivery_logs table
// ---------------------------------------------------------------------------
async function logDelivery(reportCode, type, recipient, status, errorMsg) {
  const validStatus = ["SUCCESS", "FAILED", "PENDING"].includes(status) ? status : "FAILED";
  try {
    await pool.query(
      `INSERT INTO report_delivery_logs (report_id, delivery_type, recipient, status, error_message, sent_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [reportCode, type, recipient, validStatus, errorMsg || null]
    );
  } catch (err) {
    console.warn(`[EmailService] Failed to log delivery:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// METHOD 1: Resend API (HTTPS port 443 — works on Render Free tier)
// Sign up free at https://resend.com | 3000 free emails/month
// Add RESEND_API_KEY to Render Dashboard > Environment
// ---------------------------------------------------------------------------
async function sendViaResend(recipients, subject, htmlBody, report) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const fromDomain = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const senderName = "Injured Animal Alert";
  const from = `${senderName} <${fromDomain}>`;

  // Build attachments for Resend (base64-encoded)
  const attachments = [];
  if (report.image_path) {
    const imgData = resolveImageBase64(report.image_path);
    if (imgData) {
      attachments.push({
        filename: "animal_evidence.jpg",
        content: imgData.base64
      });
      console.log(`[EmailService/Resend] Attached animal image (${Math.round(imgData.base64.length * 0.75 / 1024)}KB)`);
    }
  }

  const results = [];
  for (const recipient of recipients) {
    try {
      const payload = {
        from,
        to: [recipient],
        subject,
        html: htmlBody,
        attachments: attachments.length > 0 ? attachments : undefined
      };

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });

      const data = await response.json();

      if (response.ok && data.id) {
        console.log(`[EmailService/Resend] SUCCESS: Sent to ${recipient} (ID: ${data.id})`);
        await logDelivery(report.report_code, "EMAIL_RESEND", recipient, "SUCCESS", null);
        results.push({ recipient, status: "SUCCESS", provider: "resend", messageId: data.id });
      } else {
        const errMsg = data.message || data.error || `HTTP ${response.status}`;
        console.error(`[EmailService/Resend] FAILED for ${recipient}: ${errMsg}`);
        await logDelivery(report.report_code, "EMAIL_RESEND", recipient, "FAILED", errMsg);
        results.push({ recipient, status: "FAILED", provider: "resend", error: errMsg });
      }
    } catch (err) {
      console.error(`[EmailService/Resend] ERROR for ${recipient}:`, err.message);
      await logDelivery(report.report_code, "EMAIL_RESEND", recipient, "FAILED", err.message);
      results.push({ recipient, status: "FAILED", provider: "resend", error: err.message });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// METHOD 2: Brevo (formerly Sendinblue) API (HTTPS port 443 — works on Render)
// Sign up free at https://brevo.com | 300 free emails/day
// Add BREVO_API_KEY to Render Dashboard > Environment
// ---------------------------------------------------------------------------
async function sendViaBrevo(recipients, subject, htmlBody, report) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY not set");

  const senderEmail = process.env.SMTP_USER || "dahiphalekrishna244@gmail.com";
  const senderName = "Injured Animal Alert";

  // Build attachments for Brevo
  const attachment = [];
  if (report.image_path) {
    const imgData = resolveImageBase64(report.image_path);
    if (imgData) {
      attachment.push({
        name: "animal_evidence.jpg",
        content: imgData.base64
      });
      console.log(`[EmailService/Brevo] Attached animal image (${Math.round(imgData.base64.length * 0.75 / 1024)}KB)`);
    }
  }

  const to = recipients.map(email => ({ email }));

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to,
    subject,
    htmlContent: htmlBody,
    attachment: attachment.length > 0 ? attachment : undefined
  };

  const results = [];
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    const data = await response.json();

    if (response.ok && data.messageId) {
      console.log(`[EmailService/Brevo] SUCCESS: Sent to ${recipients.join(", ")} (ID: ${data.messageId})`);
      for (const recipient of recipients) {
        await logDelivery(report.report_code, "EMAIL_BREVO", recipient, "SUCCESS", null);
        results.push({ recipient, status: "SUCCESS", provider: "brevo", messageId: data.messageId });
      }
    } else {
      const errMsg = data.message || `HTTP ${response.status}`;
      console.error(`[EmailService/Brevo] FAILED: ${errMsg}`);
      for (const recipient of recipients) {
        await logDelivery(report.report_code, "EMAIL_BREVO", recipient, "FAILED", errMsg);
        results.push({ recipient, status: "FAILED", provider: "brevo", error: errMsg });
      }
    }
  } catch (err) {
    console.error(`[EmailService/Brevo] ERROR:`, err.message);
    for (const recipient of recipients) {
      await logDelivery(report.report_code, "EMAIL_BREVO", recipient, "FAILED", err.message);
      results.push({ recipient, status: "FAILED", provider: "brevo", error: err.message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// METHOD 3: SMTP Nodemailer (local dev only — blocked on Render Free tier!)
// ---------------------------------------------------------------------------
function getTransporter() {
  const user = process.env.SMTP_USER || "dahiphalekrishna244@gmail.com";
  const pass = process.env.SMTP_PASS || "gshfsquyiecrwkuv";

  if (!user || !pass) {
    console.warn("[EmailService/SMTP] Credentials missing.");
    return null;
  }

  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      family: 4,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { family: 4 }, (err, address, family) => {
          callback(err, address, family);
        });
      },
      auth: { user, pass },
      tls: { rejectUnauthorized: false }
    });
    console.log(`[EmailService/SMTP] Transporter initialized -> smtp.gmail.com:587`);
  }

  return _transporter;
}

async function sendViaSmtp(recipients, subject, htmlBody, report) {
  const transporter = getTransporter();
  if (!transporter) {
    return recipients.map(r => ({ recipient: r, status: "FAILED", error: "SMTP credentials missing" }));
  }

  const senderEmail = process.env.SMTP_USER || "dahiphalekrishna244@gmail.com";
  const isAutomatic = (report.report_source || "").toUpperCase() === "AUTOMATIC" || Boolean(report.camera_id);
  const cameraLabel = getCameraLabel(report.camera_id);
  const fromAddress = isAutomatic
    ? `"Report from ${cameraLabel}" <${senderEmail}>`
    : `"${report.reporter_name || "Citizen Reporter"} (via Animal Rescue Alert)" <${senderEmail}>`;

  const attachments = [];
  if (report.image_path) {
    const imgData = resolveImageBase64(report.image_path);
    if (imgData) {
      attachments.push({
        filename: "animal_evidence.jpg",
        content: Buffer.from(imgData.base64, "base64"),
        cid: "animal_photo"
      });
    }
  }

  const results = [];
  for (const recipient of recipients) {
    try {
      const info = await transporter.sendMail({
        from: fromAddress,
        to: recipient,
        subject,
        html: htmlBody,
        attachments,
        replyTo: report.reporter_email || undefined
      });
      console.log(`[EmailService/SMTP] SUCCESS: to ${recipient} (ID: ${info.messageId})`);
      await logDelivery(report.report_code, "EMAIL_SMTP", recipient, "SUCCESS", null);
      results.push({ recipient, status: "SUCCESS", provider: "smtp", messageId: info.messageId });
    } catch (err) {
      console.error(`[EmailService/SMTP] FAILED for ${recipient}:`, err.message);
      await logDelivery(report.report_code, "EMAIL_SMTP", recipient, "FAILED", err.message);
      results.push({ recipient, status: "FAILED", provider: "smtp", error: err.message });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// sendReportEmail(report) — Main entry point
// Tries Resend → Brevo → SMTP (in order of preference)
// ---------------------------------------------------------------------------
async function sendReportEmail(report) {
  const reportCode = report.report_code || "IA-UNKNOWN";

  // Build recipient list
  let recipients = await fetchRecipientEmails();
  if (report.reporter_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(report.reporter_email)) {
    recipients = Array.from(new Set([...recipients, report.reporter_email.trim()]));
  }
  if (!recipients || recipients.length === 0) {
    recipients = ["dahiphalekrishna244@gmail.com"];
  }

  // Build subject
  const isAutomatic = (report.report_source || "").toUpperCase() === "AUTOMATIC" || Boolean(report.camera_id);
  const cameraLabel = getCameraLabel(report.camera_id);
  const subject = isAutomatic
    ? `URGENT: Injured Animal Detected by ${cameraLabel} - ${reportCode} (${report.animal_type || "Animal"} - ${report.severity || "Moderate"})`
    : `URGENT: Injured Animal Report ${reportCode} - ${report.animal_type || "Animal"} (${report.severity || "Moderate"})`;

  const htmlBody = buildHtmlBody(report);

  console.log(`[EmailService] Dispatching email for ${reportCode} to: ${recipients.join(", ")}`);
  console.log(`[EmailService] Available providers: Resend=${Boolean(process.env.RESEND_API_KEY)}, Brevo=${Boolean(process.env.BREVO_API_KEY)}, SMTP=fallback`);

  // --- Try Resend first (best for Render) ---
  if (process.env.RESEND_API_KEY) {
    try {
      console.log(`[EmailService] Attempting Resend HTTPS API...`);
      const results = await sendViaResend(recipients, subject, htmlBody, report);
      const allSuccess = results.every(r => r.status === "SUCCESS");
      if (allSuccess) return results;
      console.warn(`[EmailService] Resend had failures, trying Brevo...`);
    } catch (err) {
      console.warn(`[EmailService] Resend failed: ${err.message}. Trying Brevo...`);
    }
  }

  // --- Try Brevo second ---
  if (process.env.BREVO_API_KEY) {
    try {
      console.log(`[EmailService] Attempting Brevo HTTPS API...`);
      const results = await sendViaBrevo(recipients, subject, htmlBody, report);
      const allSuccess = results.every(r => r.status === "SUCCESS");
      if (allSuccess) return results;
      console.warn(`[EmailService] Brevo had failures, trying SMTP fallback...`);
    } catch (err) {
      console.warn(`[EmailService] Brevo failed: ${err.message}. Trying SMTP fallback...`);
    }
  }

  // --- SMTP fallback (works locally, blocked on Render) ---
  console.log(`[EmailService] Attempting SMTP (NOTE: this is blocked on Render Free tier!)...`);
  return await sendViaSmtp(recipients, subject, htmlBody, report);
}

module.exports = {
  sendReportEmail,
  fetchRecipientEmails,
  buildHtmlBody,
  getCameraLabel
};
