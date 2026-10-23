"use strict";

/**
 * NotificationService
 * -------------------
 * Orchestrates Email notifications for both AUTOMATIC and MANUAL reports.
 * Called after a report is successfully saved to MySQL.
 *
 * Design rules:
 *  - Notifications are FIRE-AND-FORGET: failures never throw, never block.
 *  - Results are logged to console and to report_delivery_logs (via emailService).
 */

const { sendReportEmail } = require("./emailService");

/**
 * dispatch(report)
 * Sends complete email notification with attached image for a newly saved report.
 * Always resolves — never throws.
 *
 * @param {object} report - The full report object from DB
 * @returns {Promise<{email: Array}>}
 */
async function dispatch(report) {
  if (!report) return { email: [] };

  const reportCode = report.report_code || "IA-UNKNOWN";

  try {
    const emailResults = await sendReportEmail(report);
    console.log(`[NotificationService] Email dispatch complete for ${reportCode}`);
    console.log(`  Email results: ${JSON.stringify(emailResults)}`);
    return { email: emailResults };
  } catch (err) {
    console.error(`[NotificationService] Email dispatch failed for ${reportCode}:`, err.message);
    return { email: [{ status: "ERROR", error: err.message }] };
  }
}

module.exports = { dispatch };
