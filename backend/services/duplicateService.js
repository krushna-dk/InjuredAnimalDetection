const { pool } = require("../config/db");

// Fast in-memory cache to catch rapid bursts across concurrent frame processing
const memoryCache = new Map();

/**
 * Check whether an injured animal detection is a duplicate of a recently logged report.
 * 
 * Criteria:
 * 1. Time Cooldown: A report was generated from the same camera/location within DUPLICATE_COOLDOWN_SECONDS (default: 60s).
 * 2. Animal Similarity: The detected animal_type matches the recent report.
 * 3. Status Check: The recent report is currently in 'Pending Rescue' or 'Assigned'.
 */
async function checkIsDuplicate({
  cameraId = "cam-01",
  animalType = "Unknown",
  injuryType = "Unknown",
  location = null
}) {
  const cooldownSeconds = parseInt(process.env.DUPLICATE_COOLDOWN_SECONDS, 10) || 60;
  const now = Date.now();

  // 1. Fast in-memory check
  const cacheKey = `${cameraId}:${animalType.toLowerCase()}`;
  const cached = memoryCache.get(cacheKey);

  if (cached && (now - cached.timestamp) < (cooldownSeconds * 1000)) {
    const remaining = Math.ceil(((cooldownSeconds * 1000) - (now - cached.timestamp)) / 1000);
    return {
      isDuplicate: true,
      reason: `Duplicate detected in memory cache for ${animalType} on ${cameraId}. Active cooldown remaining: ${remaining}s.`,
      existingReportId: cached.reportId,
      cooldownRemainingSeconds: remaining
    };
  }

  // 2. Database check against reports table
  try {
    const query = `
      SELECT report_code, report_code AS report_id, animal_type, injury_type, created_at, report_status,
             TIMESTAMPDIFF(SECOND, created_at, NOW()) AS seconds_ago
      FROM reports
      WHERE camera_id = ?
        AND LOWER(animal_type) = LOWER(?)
        AND report_status IN ('Pending Rescue', 'Assigned', 'Forwarded to Rescue Team')
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)
      ORDER BY created_at DESC
      LIMIT 1;
    `;

    const [rows] = await pool.query(query, [cameraId, animalType, cooldownSeconds]);

    if (rows && rows.length > 0) {
      const match = rows[0];
      const matchReportCode = match.report_code || match.report_id;
      const remaining = Math.max(1, cooldownSeconds - (match.seconds_ago || 0));

      // Refresh memory cache
      memoryCache.set(cacheKey, {
        reportId: matchReportCode,
        timestamp: now
      });

      return {
        isDuplicate: true,
        reason: `Recent report (${matchReportCode}) already created for ${animalType} (${match.injury_type || "injury"}) ${match.seconds_ago || 0}s ago.`,
        existingReportId: matchReportCode,
        cooldownRemainingSeconds: remaining
      };
    }
  } catch (dbError) {
    console.warn("[DuplicateService Warning] DB lookup failed, falling back to memory check:", dbError.message);
  }

  // Not a duplicate
  return {
    isDuplicate: false,
    reason: "New incident verified. No recent duplicate report in cooldown window.",
    existingReportId: null,
    cooldownRemainingSeconds: 0
  };
}

/**
 * Register a newly created report in the in-memory cache to prevent race conditions
 */
function registerReportInMemory(cameraId, animalType, reportId) {
  const cacheKey = `${cameraId}:${animalType.toLowerCase()}`;
  memoryCache.set(cacheKey, {
    reportId,
    timestamp: Date.now()
  });
}

module.exports = {
  checkIsDuplicate,
  registerReportInMemory
};
