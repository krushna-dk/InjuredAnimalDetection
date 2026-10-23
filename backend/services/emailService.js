"use strict";

const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { pool, getIsDbConnected } = require("../config/db");

let _transporter = null;

// ---------------------------------------------------------------------------
// SMTP Transporter
// ---------------------------------------------------------------------------
function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn("[EmailService] SMTP credentials missing in backend/.env (SMTP_USER or SMTP_PASS not set).");
    return null;
  }

  if (!_transporter) {
    const isGmail = host.includes("gmail");
    const transportOptions = isGmail
      ? { service: "gmail", auth: { user, pass } }
      : { host, port, secure: port === 465, auth: { user, pass } };

    _transporter = nodemailer.createTransport(transportOptions);
    console.log(`[EmailService] SMTP transporter initialized -> ${isGmail ? "Gmail Service" : `${host}:${port}`} (${user})`);
  }

  return _transporter;
}

// ---------------------------------------------------------------------------
// Fetch rescue contact emails dynamically from MySQL rescue_contacts table
// (NO HARDCODED CONTACTS)
// ---------------------------------------------------------------------------
async function fetchRecipientEmails() {
  try {
    const [rows] = await pool.query(
      "SELECT email FROM rescue_contacts WHERE active = 1 AND email IS NOT NULL AND email != '' ORDER BY id ASC;"
    );
    const emails = rows.map(r => r.email).filter(Boolean);
    if (emails.length > 0) return emails;
  } catch (err) {
    console.error("[EmailService] Failed to query rescue_contacts table for emails:", err.message);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Helper: Format camera display label (e.g. CAM-001 -> Camera 1, CAM-002 -> Camera 2)
// ---------------------------------------------------------------------------
function getCameraLabel(cameraId) {
  if (!cameraId) return "Camera 1";
  const numMatch = String(cameraId).match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    return `Camera ${num}`;
  }
  return String(cameraId);
}

// ---------------------------------------------------------------------------
// Build HTML Email Body containing all required fields:
// Report ID, Animal type, Breed, Injury type, Severity, Description, Location, Date, Time, Animal image
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
    console.warn(`[EmailService] Failed to log delivery into report_delivery_logs:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Resolve animal image absolute path on disk
// ---------------------------------------------------------------------------
function resolveImagePath(imagePath) {
  if (!imagePath) return null;
  if (path.isAbsolute(imagePath) && fs.existsSync(imagePath)) {
    return imagePath;
  }
  const clean = imagePath.replace(/^[/\\]+/, "");
  // Try backend root
  const p1 = path.join(__dirname, "..", clean);
  if (fs.existsSync(p1)) return p1;
  // Try project root
  const p2 = path.join(__dirname, "..", "..", clean);
  if (fs.existsSync(p2)) return p2;
  return null;
}

// ---------------------------------------------------------------------------
// sendReportEmail(report)
// Sends email notification with attached image for both AUTOMATIC and MANUAL reports.
// ---------------------------------------------------------------------------
async function sendReportEmail(report) {
  const reportCode = report.report_code || "IA-UNKNOWN";
  const recipients = await fetchRecipientEmails();

  if (!recipients || recipients.length === 0) {
    console.warn(`[EmailService] No rescue contact email found in rescue_contacts table for ${reportCode}.`);
    await logDelivery(reportCode, "EMAIL", "NONE", "FAILED", "No email in rescue_contacts table");
    return [{ status: "SKIPPED", reason: "No rescue email found in rescue_contacts" }];
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[EmailService] SMTP credentials missing, skipping email delivery for ${reportCode}.`);
    for (const recipient of recipients) {
      await logDelivery(reportCode, "EMAIL", recipient, "FAILED", "SMTP credentials missing in .env");
    }
    return recipients.map(recipient => ({ recipient, status: "FAILED", error: "SMTP credentials missing in .env" }));
  }

  const attachments = [];
  const resolvedPath = resolveImagePath(report.image_path);
  if (resolvedPath) {
    attachments.push({
      filename: path.basename(resolvedPath),
      path: resolvedPath,
      cid: "animal_photo"
    });
    console.log(`[EmailService] Attached animal image: ${resolvedPath}`);
  } else if (report.image_path) {
    console.warn(`[EmailService] Animal image file not found on disk: ${report.image_path}`);
  }

  const htmlBody = buildHtmlBody(report);

  const isAutomatic = (report.report_source || "").toUpperCase() === "AUTOMATIC" || Boolean(report.camera_id);
  const cameraLabel = getCameraLabel(report.camera_id);

  const subject = isAutomatic
    ? `URGENT: Injured Animal Detected by ${cameraLabel} - ${reportCode} (${report.animal_type || "Animal"} - ${report.severity || "Moderate"})`
    : `URGENT: Injured Animal Report ${reportCode} - ${report.animal_type || "Animal"} (${report.severity || "Moderate"})`;

  const senderEmail = process.env.SMTP_USER;
  // - For AUTOMATIC module: sender uses system email with display name "Report from xyz camera" (e.g. "Report from Camera 1")
  // - For MANUAL reports: sender uses the citizen reporter's name and email (with fallback to system email if not provided)
  let fromAddress;
  if (isAutomatic) {
    fromAddress = `"Report from ${cameraLabel}" <${senderEmail}>`;
  } else {
    const reporterName = report.reporter_name || "Citizen Reporter";
    const reporterEmail = report.reporter_email || senderEmail;
    fromAddress = `"${reporterName}" <${reporterEmail}>`;
  }

  const results = [];

  for (const recipient of recipients) {
    try {
      const mailOptions = {
        from: fromAddress,
        to: recipient,
        subject,
        html: htmlBody,
        attachments
      };
      if (report.reporter_email) {
        mailOptions.replyTo = report.reporter_email;
      }
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailService] SUCCESS: Email delivered to ${recipient} (Message ID: ${info.messageId}) from "${fromAddress}"`);
      await logDelivery(reportCode, "EMAIL", recipient, "SUCCESS", null);
      results.push({ recipient, status: "SUCCESS", messageId: info.messageId });
    } catch (err) {
      console.error(`[EmailService] FAILED: Email to ${recipient} failed:`, err.message);
      await logDelivery(reportCode, "EMAIL", recipient, "FAILED", err.message);
      results.push({ recipient, status: "FAILED", error: err.message });
    }
  }

  return results;
}

module.exports = {
  sendReportEmail,
  fetchRecipientEmails,
  buildHtmlBody,
  getCameraLabel
};
