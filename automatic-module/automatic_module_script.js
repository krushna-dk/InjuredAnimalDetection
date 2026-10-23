/**
 * ==========================================================
 * Automatic Detection Module — Frontend Controller (Phase 1)
 * Project: Injured Animal Detection and Rehabilitation Using AI
 * ==========================================================
 *
 * Flow:
 * LIVE CAMERA → AUTOMATIC FRAME CAPTURE (5s) → AI ANALYSIS →
 * ANIMAL + INJURY DETECTION → SNAPSHOT DISPLAY → AUTOMATIC REPORT POPUP
 * → 20-SECOND POST-REPORT COOLDOWN (Camera stays ON) → RESUME
 */

"use strict";

// ============================================================
// CONFIGURATION
// ============================================================
const API_BASE_URL = window.location.protocol.startsWith("http")
  ? window.location.origin
  : "http://localhost:5000";

const CAMERA_ID = "CAM-001";
const CAPTURE_INTERVAL_MS = 5000;    // 5-second scan cycle for fast animal detection
const MIN_API_GAP_MS    = 12000;    // Minimum 12s between AI calls (keeps requests under 5 RPM free tier)
const POST_DETECT_GAP_MS = 10000;   // 10s rest after any detection result, then resume scanning
const COOLDOWN_DURATION_S = 20;      // 20-second post-report cooldown
// NOTE: No frontend timeout — fetch waits as long as backend needs. Backend always responds.

// ============================================================
// DOM ELEMENTS
// ============================================================
const cameraVideo = document.getElementById("cameraVideo");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const cameraDeviceSelect = document.getElementById("cameraDeviceSelect");

const cameraBadge = document.getElementById("cameraBadge");
const cameraNameDisplay = document.getElementById("cameraNameDisplay");
const cameraResolution = document.getElementById("cameraResolution");
const liveIndicator = document.getElementById("liveIndicator");
const headerDot = document.getElementById("headerDot");
const systemTitle = document.getElementById("systemTitle");
const systemSubtitle = document.getElementById("systemSubtitle");
const cameraScanHud = document.getElementById("cameraScanHud");
const hudStatusLabel = document.getElementById("hudStatusLabel");

// Real-Time Status Panel (Section 16)
const statusCameraText = document.getElementById("statusCameraText");
const statusAiText = document.getElementById("statusAiText");
const statusCurrentProcessText = document.getElementById("statusCurrentProcessText");
const statusLastDetectionText = document.getElementById("statusLastDetectionText");
const statusLastReportText = document.getElementById("statusLastReportText");

// Process Status Alert
const processStatusBar = document.getElementById("processStatusBar");
const processStatusText = document.getElementById("processStatusText");
const processStatusDot = document.getElementById("processStatusDot");
const processSpinner = document.getElementById("processSpinner");
const cooldownCountdownBadge = document.getElementById("cooldownCountdownBadge");
const cooldownSeconds = document.getElementById("cooldownSeconds");

// Captured Snapshot Card (Section 11)
const capturedSnapshotCard = document.getElementById("capturedSnapshotCard");
const snapshotImg = document.getElementById("snapshotImg");
const snapSeverityBadge = document.getElementById("snapSeverityBadge");
const snapAnimalType = document.getElementById("snapAnimalType");
const snapBreed = document.getElementById("snapBreed");
const snapInjury = document.getElementById("snapInjury");
const snapSeverity = document.getElementById("snapSeverity");
const snapConfidence = document.getElementById("snapConfidence");

// AI Result Inspection Panel
const aiResultCard = document.getElementById("aiResultCard");
const aiAnimalType = document.getElementById("aiAnimalType");
const aiBreed = document.getElementById("aiBreed");
const aiInjured = document.getElementById("aiInjured");
const aiInjuryType = document.getElementById("aiInjuryType");
const aiSeverity = document.getElementById("aiSeverity");
const aiConfidence = document.getElementById("aiConfidence");
const aiConfidenceBar = document.getElementById("aiConfidenceBar");
const aiDescription = document.getElementById("aiDescription");
const aiAction = document.getElementById("aiAction");

// Summary Metrics
const metricAnimals = document.getElementById("metricAnimals");
const metricInjured = document.getElementById("metricInjured");
const metricReports = document.getElementById("metricReports");

// Recent Reports Container
const reportsContainer = document.getElementById("reportsContainer");
const reportCountBadge = document.getElementById("reportCountBadge");

// Hidden Canvas & Toast Area
const captureCanvas = document.getElementById("captureCanvas");
const toastArea = document.getElementById("toastArea");

// Modal Elements (Section 13)
const automaticReportModalEl = document.getElementById("automaticReportModal");
const modalSnapshotImg = document.getElementById("modalSnapshotImg");
const modalReportCode = document.getElementById("modalReportCode");
const modalSeverityBadge = document.getElementById("modalSeverityBadge");
const modalAnimalType = document.getElementById("modalAnimalType");
const modalBreed = document.getElementById("modalBreed");
const modalInjuryType = document.getElementById("modalInjuryType");
const modalSeverity = document.getElementById("modalSeverity");
const modalConfidence = document.getElementById("modalConfidence");
const modalLocation = document.getElementById("modalLocation");
const modalDate = document.getElementById("modalDate");
const modalTime = document.getElementById("modalTime");
const modalDescription = document.getElementById("modalDescription");

let bsReportModal = null;
if (automaticReportModalEl && typeof bootstrap !== "undefined") {
  bsReportModal = new bootstrap.Modal(automaticReportModalEl);
}

// ============================================================
// APPLICATION STATE
// ============================================================
let cameraStream = null;
let isAnalyzing = false;
let cooldownActive = false;
let cooldownRemaining = 0;
let cooldownIntervalId = null;
let captureTimeoutId = null;
let lastApiCallTime = 0;            // Timestamp of last completed/attempted AI call

let sessionCounters = {
  animals: 0,
  injured: 0,
  reports: 0
};

// ============================================================
// HELPERS
// ============================================================
function updateText(el, val) {
  if (el) el.textContent = val;
}

function showToast(message, type = "info") {
  if (!toastArea) return;
  const bgMap = {
    success: "#198754",
    danger: "#dc3545",
    warning: "#e65100",
    info: "#0d6efd"
  };
  const bg = bgMap[type] || bgMap.info;
  const toast = document.createElement("div");
  toast.className = "camera-note mt-2";
  toast.style.cssText = `background:${bg}15;color:${bg};border-left:4px solid ${bg};font-size:13px;font-weight:500;`;
  toast.textContent = message;
  toastArea.prepend(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 6000);
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return "recently";
  const timestamp = new Date(dateStr).getTime();
  if (isNaN(timestamp)) return "recently";
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ============================================================
// STATUS CONTROLLERS (Sections 3, 5, 16)
// ============================================================
function setProcessStatus(statusText, type = "info") {
  updateText(processStatusText, statusText);
  updateText(statusCurrentProcessText, statusText);
  if (hudStatusLabel) {
    hudStatusLabel.textContent = statusText;
  }

  if (!processStatusDot || !processSpinner) return;

  const colorMap = {
    idle: "#6c757d",
    capturing: "#0d6efd",
    analyzing: "#ff9800",
    healthy: "#198754",
    injured: "#dc3545",
    cooldown: "#ffb300",
    error: "#dc3545"
  };

  processStatusDot.style.background = colorMap[type] || colorMap.idle;
  processSpinner.style.display = (type === "capturing" || type === "analyzing") ? "inline-block" : "none";
}

function setCameraStatus(isOnline, cameraName = "Camera", width = 0, height = 0) {
  if (isOnline) {
    updateText(cameraBadge, "CAMERA: ONLINE");
    if (cameraBadge) cameraBadge.style.background = "#198754";
    updateText(systemTitle, "CAMERA: ONLINE");
    if (statusCameraText) {
      statusCameraText.innerHTML = '<span class="badge bg-success">ONLINE</span>';
    }

    updateText(cameraNameDisplay, cameraName);
    updateText(cameraResolution, `${width} × ${height}`);

    if (liveIndicator) liveIndicator.style.display = "inline-flex";
    if (cameraScanHud) cameraScanHud.style.display = "block";
    if (videoPlaceholder) videoPlaceholder.style.display = "none";

    if (startCameraBtn) startCameraBtn.disabled = true;
    if (stopCameraBtn) stopCameraBtn.disabled = false;
    if (cameraDeviceSelect) cameraDeviceSelect.disabled = true;
  } else {
    updateText(cameraBadge, "CAMERA: OFFLINE");
    if (cameraBadge) cameraBadge.style.background = "#6c757d";
    updateText(systemTitle, "CAMERA: OFFLINE");
    if (statusCameraText) {
      statusCameraText.innerHTML = '<span class="badge bg-secondary">OFFLINE</span>';
    }

    updateText(cameraNameDisplay, "No camera selected");
    updateText(cameraResolution, "0 × 0");

    if (liveIndicator) liveIndicator.style.display = "none";
    if (cameraScanHud) cameraScanHud.style.display = "none";
    if (videoPlaceholder) videoPlaceholder.style.display = "block";

    if (startCameraBtn) startCameraBtn.disabled = false;
    if (stopCameraBtn) stopCameraBtn.disabled = true;
    if (cameraDeviceSelect) cameraDeviceSelect.disabled = false;

    setAiStatus("STOPPED");
    setProcessStatus("WAITING FOR CAMERA", "idle");
  }
}

function setAiStatus(status) {
  if (status === "RUNNING") {
    updateText(systemSubtitle, "AI DETECTION: RUNNING");
    if (statusAiText) {
      statusAiText.innerHTML = '<span class="badge bg-success">RUNNING</span>';
    }
    if (headerDot) headerDot.style.background = "#198754";
  } else if (status === "COOLDOWN") {
    updateText(systemSubtitle, `AI DETECTION: COOLDOWN (${cooldownRemaining}s)`);
    if (statusAiText) {
      statusAiText.innerHTML = `<span class="badge bg-warning text-dark">COOLDOWN (${cooldownRemaining}s)</span>`;
    }
    if (headerDot) headerDot.style.background = "#ffb300";
  } else {
    updateText(systemSubtitle, "AI DETECTION: STOPPED");
    if (statusAiText) {
      statusAiText.innerHTML = '<span class="badge bg-secondary">STOPPED</span>';
    }
    if (headerDot) headerDot.style.background = "#6c757d";
  }
}

// ============================================================
// CAMERA DEVICE ENUMERATION (Section 2)
// ============================================================
async function populateCameraDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === "videoinput");

    if (cameraDeviceSelect && videoInputs.length > 0) {
      cameraDeviceSelect.innerHTML = "";
      videoInputs.forEach((device, idx) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent = device.label || `Camera ${idx + 1} (${device.deviceId.slice(0, 6)}…)`;
        cameraDeviceSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.warn("[CameraDevice] Could not enumerate devices:", err.message);
  }
}

// ============================================================
// START & STOP CAMERA (Sections 1, 2, 3)
// ============================================================
async function startCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast("Camera access is not supported by this browser.", "danger");
      return;
    }

    if (startCameraBtn) startCameraBtn.disabled = true;
    setProcessStatus("REQUESTING CAMERA ACCESS...", "capturing");

    // Camera constraints: use specific device if selected
    const selectedDeviceId = cameraDeviceSelect?.value || null;
    const constraints = {
      video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      audio: false
    };

    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraVideo.srcObject = cameraStream;
    cameraVideo.style.display = "block";

    cameraVideo.onloadedmetadata = async function () {
      try {
        await cameraVideo.play();
      } catch (playErr) {
        console.warn("[Camera] Play warning:", playErr);
      }

      const track = cameraStream ? cameraStream.getVideoTracks()[0] : null;
      const settings = track ? track.getSettings() : {};
      const width = cameraVideo.videoWidth || settings.width || 640;
      const height = cameraVideo.videoHeight || settings.height || 480;
      const label = (track && track.label) ? track.label : "Live Camera Feed";

      setCameraStatus(true, label, width, height);
      setAiStatus("RUNNING");
      showToast("Camera online. Automatic AI detection started.", "success");

      // Repopulate device names now that permission is granted
      populateCameraDevices();

      // Notify backend session
      fetch(`${API_BASE_URL}/api/detection/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera_id: CAMERA_ID })
      }).catch((e) => console.warn("[Detection] Start notify notice:", e.message));

      // START AUTOMATIC FRAME CAPTURE (Section 4)
      scheduleNextCapture(2500);
    };

    // Handle unexpected camera disconnection
    const videoTrack = cameraStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener("ended", () => {
        showToast("Camera disconnected unexpectedly.", "danger");
        stopCamera();
      });
    }
  } catch (error) {
    console.error("[Camera Start Error]:", error);
    setCameraStatus(false);

    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      showToast("Camera permission denied. Please allow access in browser settings.", "danger");
    } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      showToast("No camera device found. Please connect your webcam or DroidCam.", "danger");
    } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      showToast("Camera is currently in use by another application.", "warning");
    } else {
      showToast("Unable to start selected camera: " + error.message, "danger");
    }
  }
}

function stopCamera() {
  // Clear any scheduled frame capture
  if (captureTimeoutId) {
    clearTimeout(captureTimeoutId);
    captureTimeoutId = null;
  }

  // Clear cooldown timer
  if (cooldownIntervalId) {
    clearInterval(cooldownIntervalId);
    cooldownIntervalId = null;
  }
  cooldownActive = false;
  if (cooldownCountdownBadge) cooldownCountdownBadge.style.display = "none";

  // Abort any pending AI request
  isAnalyzing = false;
  lastApiCallTime = 0;

  // Stop all media tracks
  if (cameraStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }

  if (cameraVideo) {
    cameraVideo.srcObject = null;
    cameraVideo.style.display = "none";
  }

  // Reset UI status
  setCameraStatus(false);
  setAiStatus("STOPPED");
  setProcessStatus("CAMERA STOPPED", "idle");

  // Notify backend
  fetch(`${API_BASE_URL}/api/detection/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ camera_id: CAMERA_ID })
  }).catch((e) => console.warn("[Detection] Stop notify notice:", e.message));

  showToast("Camera stopped.", "info");
}

// ============================================================
// AUTOMATIC FRAME CAPTURE & AI ANALYSIS (Sections 4, 5, 10, 11)
// ============================================================
function scheduleNextCapture(delayMs = CAPTURE_INTERVAL_MS) {
  if (captureTimeoutId) {
    clearTimeout(captureTimeoutId);
  }
  if (!cameraStream || cooldownActive) return;

  captureTimeoutId = setTimeout(() => {
    captureAndAnalyze();
  }, delayMs);
}

async function captureAndAnalyze() {
  // Guard conditions (Section 5)
  if (!cameraStream) return;
  if (cooldownActive) return;
  if (isAnalyzing) {
    // Previous call still in flight — retry quickly after 2s
    scheduleNextCapture(2000);
    return;
  }

  // --- Rate limiter: enforce minimum gap between AI API calls ---
  // Free tier allows 5 RPM. We enforce MIN_API_GAP_MS (12s) so max ~5 calls/min.
  const msSinceLastCall = Date.now() - lastApiCallTime;
  if (lastApiCallTime > 0 && msSinceLastCall < MIN_API_GAP_MS) {
    const waitMs = MIN_API_GAP_MS - msSinceLastCall;
    setProcessStatus(`READY — SCANNING IN ${Math.ceil(waitMs / 1000)}s...`, "idle");
    scheduleNextCapture(waitMs);
    return;
  }

  isAnalyzing = true;
  lastApiCallTime = Date.now();
  setProcessStatus("CAPTURING FRAME...", "capturing");

  let snapshotDataUrl = null;

  try {
    // 1. Draw frame to hidden canvas
    const width = cameraVideo.videoWidth || 640;
    const height = cameraVideo.videoHeight || 480;
    captureCanvas.width = width;
    captureCanvas.height = height;

    const ctx = captureCanvas.getContext("2d");
    ctx.drawImage(cameraVideo, 0, 0, width, height);

    // Save EXACT frame as data URL for frontend snapshot display
    snapshotDataUrl = captureCanvas.toDataURL("image/jpeg", 0.85);

    // Convert to Blob for backend transmission (0.7 quality = smaller = faster upload)
    const blob = await new Promise((resolve) => {
      captureCanvas.toBlob(resolve, "image/jpeg", 0.7);
    });

    if (!blob) {
      throw new Error("Could not extract frame blob from canvas");
    }

    setProcessStatus("ANALYZING WITH AI...", "analyzing");

    // 2. Prepare FormData
    const formData = new FormData();
    formData.append("image", blob, `auto-frame-${Date.now()}.jpg`);
    formData.append("camera_id", CAMERA_ID);
    formData.append("location", "Live Camera Feed");
    formData.append("timestamp", new Date().toISOString());

    // 3. Post to backend — NO timeout, fetch waits as long as needed.
    //    The backend always responds (either with a result or a busy:true signal).
    const response = await fetch(`${API_BASE_URL}/api/detection/analyze`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Server error ${response.status}`);
    }

    const result = await response.json();

    // If backend signals it is temporarily busy, silently retry in 5s
    if (result.busy) {
      console.log("[Detection] AI busy — auto-retrying in 5s.");
      setProcessStatus("AI BUSY — AUTO-RETRYING IN 5s...", "analyzing");
      if (cameraStream && !cooldownActive) scheduleNextCapture(5000);
      return;
    }

    handleDetectionResult(result, snapshotDataUrl);
  } catch (error) {
    // Only real errors reach here (server down, network loss, etc.)
    console.warn("[Detection] Network issue, retrying in 5s:", error.message);
    setProcessStatus("RECONNECTING — RETRYING IN 5s...", "error");
    if (cameraStream && !cooldownActive) scheduleNextCapture(5000);
  } finally {
    isAnalyzing = false;
  }
}

// ============================================================
// RESULT HANDLER & DECISION LOGIC (Sections 7, 8, 10, 11, 12, 13)
// ============================================================
function handleDetectionResult(result, snapshotDataUrl) {
  if (!result || !result.analysis) {
    setProcessStatus("AI ERROR: INVALID RESPONSE", "error");
    if (cameraStream && !cooldownActive) scheduleNextCapture(CAPTURE_INTERVAL_MS);
    return;
  }

  const analysis = result.analysis;
  const animalDetected = Boolean(analysis.animalDetected !== undefined ? analysis.animalDetected : analysis.animal_detected);
  const injured = Boolean(analysis.injured);
  const animalType = analysis.animalType || analysis.animal_type || "Unknown";
  const breed = analysis.breed || "Unknown";
  const injuryType = analysis.injuryType || analysis.injury_type || "None";
  const severity = analysis.severity || "None";
  const confidencePercent = Math.round((analysis.confidence || 0) * 100);
  const description = analysis.description || "—";
  const recommendedAction = analysis.recommendedAction || analysis.recommended_action || "—";

  // Update AI Result Panel
  if (aiResultCard) aiResultCard.style.display = "block";
  updateText(aiAnimalType, animalDetected ? animalType : "No animal");
  updateText(aiBreed, animalDetected ? breed : "—");
  updateText(aiInjured, injured ? "⚠️ Yes" : (animalDetected ? "✅ No" : "—"));
  updateText(aiInjuryType, injuryType);
  updateText(aiSeverity, severity);
  updateText(aiConfidence, `${confidencePercent}%`);

  if (aiConfidenceBar) {
    aiConfidenceBar.style.width = `${confidencePercent}%`;
    aiConfidenceBar.className = `progress-bar ${injured ? (severity === "Severe" ? "bg-danger" : "bg-warning") : "bg-success"}`;
  }

  if (aiDescription) {
    aiDescription.textContent = description;
    aiDescription.style.background = injured ? "#fce4ec" : "#edf7f0";
    aiDescription.style.color = injured ? "#b71c1c" : "#42634e";
  }

  if (aiAction) {
    aiAction.textContent = `Action: ${recommendedAction}`;
  }

  // Update Real-Time Status Panel
  updateText(
    statusLastDetectionText,
    animalDetected ? `${animalType} (${injured ? "⚠️ Injured" : "Healthy"})` : "No Animal Detected"
  );

  // DECISION BRANCHES (Section 10):
  // Case A: No animal detected — wait POST_DETECT_GAP then scan again
  if (!animalDetected) {
    setProcessStatus("NO ANIMAL DETECTED — SCANNING AGAIN SHORTLY", "idle");
    if (cameraStream && !cooldownActive) scheduleNextCapture(POST_DETECT_GAP_MS);
    return;
  }

  // Case B: Animal detected, but NOT injured — 10s gap then rescan
  if (animalDetected && !injured) {
    sessionCounters.animals++;
    updateText(metricAnimals, sessionCounters.animals);
    setProcessStatus(`ANIMAL DETECTED: ${animalType} (Healthy) — RESCANNING IN 10s`, "healthy");
    if (cameraStream && !cooldownActive) scheduleNextCapture(POST_DETECT_GAP_MS);
    return;
  }

  // Case C: Animal detected AND INJURED (Section 10, 11, 12, 13)
  sessionCounters.animals++;
  sessionCounters.injured++;
  updateText(metricAnimals, sessionCounters.animals);
  updateText(metricInjured, sessionCounters.injured);

  setProcessStatus(`INJURY DETECTED: ${animalType} (${severity})`, "injured");

  // Keep and display the exact captured snapshot (Section 11)
  const reportCode = (result.report && (result.report.report_code || result.report.report_id)) || `IA-${new Date().getFullYear()}-AUTO`;
  updateText(statusLastReportText, reportCode);

  displayCapturedSnapshot({
    snapshotDataUrl,
    animalType,
    breed,
    injuryType,
    severity,
    confidencePercent
  });

  // Display Automatic Report Popup Modal (Section 13)
  showReportPopupModal({
    snapshotDataUrl,
    reportCode,
    animalType,
    breed,
    injuryType,
    severity,
    confidencePercent,
    location: "Live Camera Feed",
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    description
  });

  if (result.report_created) {
    sessionCounters.reports++;
    updateText(metricReports, sessionCounters.reports);
  }

  // Refresh recent reports feed
  fetchAndDisplayReports();

  // START MANDATORY 20-SECOND POST-REPORT COOLDOWN (Sections 14, 15)
  start20SecondCooldown();
}

// ============================================================
// DISPLAY CAPTURED SNAPSHOT (Section 11)
// ============================================================
function displayCapturedSnapshot({ snapshotDataUrl, animalType, breed, injuryType, severity, confidencePercent }) {
  if (!capturedSnapshotCard) return;

  capturedSnapshotCard.style.display = "block";
  if (snapshotImg && snapshotDataUrl) {
    snapshotImg.src = snapshotDataUrl;
  }

  updateText(snapAnimalType, animalType);
  updateText(snapBreed, breed);
  updateText(snapInjury, injuryType);
  updateText(snapSeverity, severity);
  updateText(snapConfidence, `${confidencePercent}%`);

  if (snapSeverityBadge) {
    snapSeverityBadge.textContent = severity;
    snapSeverityBadge.className = `badge ${severity === "Severe" ? "bg-danger" : (severity === "Minor" ? "bg-warning text-dark" : "bg-warning text-dark")}`;
  }
}

// ============================================================
// REPORT POPUP MODAL (Section 13)
// ============================================================
function showReportPopupModal(data) {
  if (modalSnapshotImg && data.snapshotDataUrl) {
    modalSnapshotImg.src = data.snapshotDataUrl;
  }
  updateText(modalReportCode, data.reportCode);
  updateText(modalAnimalType, data.animalType);
  updateText(modalBreed, data.breed);
  updateText(modalInjuryType, data.injuryType);
  updateText(modalSeverity, data.severity);
  updateText(modalConfidence, `${data.confidencePercent}%`);
  updateText(modalLocation, data.location);
  updateText(modalDate, data.date);
  updateText(modalTime, data.time);
  updateText(modalDescription, data.description);

  if (modalSeverityBadge) {
    modalSeverityBadge.textContent = data.severity;
    modalSeverityBadge.className = `badge ${data.severity === "Severe" ? "bg-danger" : "bg-warning text-dark"} px-3 py-2`;
  }

  if (bsReportModal) {
    bsReportModal.show();
  } else if (automaticReportModalEl && typeof bootstrap !== "undefined") {
    bsReportModal = new bootstrap.Modal(automaticReportModalEl);
    bsReportModal.show();
  }
}

// ============================================================
// 20-SECOND POST-REPORT COOLDOWN (Sections 14, 15)
// ============================================================
function start20SecondCooldown() {
  cooldownActive = true;
  cooldownRemaining = COOLDOWN_DURATION_S;

  // Clear any existing frame timers
  if (captureTimeoutId) {
    clearTimeout(captureTimeoutId);
    captureTimeoutId = null;
  }
  if (cooldownIntervalId) {
    clearInterval(cooldownIntervalId);
  }

  // Camera stays ON (live video continues streaming!)
  if (cooldownCountdownBadge) {
    cooldownCountdownBadge.style.display = "inline-flex";
    updateText(cooldownSeconds, cooldownRemaining);
  }

  setAiStatus("COOLDOWN");
  setProcessStatus(`POST-REPORT COOLDOWN (${cooldownRemaining}s)`, "cooldown");

  cooldownIntervalId = setInterval(() => {
    cooldownRemaining--;

    if (cooldownRemaining > 0) {
      updateText(cooldownSeconds, cooldownRemaining);
      setAiStatus("COOLDOWN");
      setProcessStatus(`POST-REPORT COOLDOWN (${cooldownRemaining}s)`, "cooldown");
    } else {
      // Cooldown finished: resume automatic frame capture!
      clearInterval(cooldownIntervalId);
      cooldownIntervalId = null;
      cooldownActive = false;

      if (cooldownCountdownBadge) {
        cooldownCountdownBadge.style.display = "none";
      }

      if (cameraStream) {
        setAiStatus("RUNNING");
        setProcessStatus("AI MONITORING RESUMED", "capturing");
        showToast("20-second cooldown ended. Resuming automatic AI frame capture.", "info");
        // Resume next capture immediately
        scheduleNextCapture(1000);
      }
    }
  }, 1000);
}

// ============================================================
// REPORTS FEED
// ============================================================
async function fetchAndDisplayReports() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/reports?limit=5`);
    if (!response.ok) return;

    const data = await response.json();
    if (!data.success || !data.data || data.data.length === 0) {
      if (reportsContainer) {
        reportsContainer.innerHTML = `
          <div class="text-center py-4" style="color:#7c8a81;font-size:13px;">
            <p>No reports recorded yet. Start camera to monitor.</p>
          </div>
        `;
      }
      updateText(reportCountBadge, "0 reports");
      return;
    }

    const totalCount = (data.pagination && data.pagination.total !== undefined)
      ? data.pagination.total
      : (data.data ? data.data.length : 0);
    updateText(reportCountBadge, `${totalCount} reports`);

    if (reportsContainer) {
      reportsContainer.innerHTML = data.data
        .map((report) => {
          const statusBgMap = {
            "Pending Rescue": "background:#fce4ec;color:#c62828;",
            "Forwarded to Rescue Team": "background:#e8f5ec;color:#198754;",
            Assigned: "background:#fff3e0;color:#e65100;",
            Rescued: "background:#e8f5ec;color:#198754;",
            Closed: "background:#e3e8ec;color:#546e7a;"
          };
          const statusStyle = statusBgMap[report.report_status] || "background:#e8f5ec;color:#198754;";
          const repCode = report.report_code || report.report_id || "IA-REPORT";
          const repTime = report.created_at || report.report_date || report.detected_at;

          return `
            <div class="recent-report">
              <div class="recent-report-header">
                <div class="recent-report-title">
                  ${repCode}
                </div>
                <span class="report-status" style="${statusStyle}">
                  ${report.report_status || "Recorded"}
                </span>
              </div>
              <small>
                🐾 ${report.animal_type || "Animal"} (${report.severity || "Moderate"}) · 🕒 ${formatTimeAgo(repTime)}
              </small>
              <p class="report-description mt-2">
                ${report.description || "Report recorded in platform database."}
              </p>
            </div>
          `;
        })
        .join("");
    }
  } catch (err) {
    console.warn("[Reports] Fetch error:", err.message);
  }
}

// ============================================================
// EVENT LISTENERS (Section 1)
// ============================================================
if (startCameraBtn) {
  startCameraBtn.addEventListener("click", startCamera);
}

if (stopCameraBtn) {
  stopCameraBtn.addEventListener("click", stopCamera);
}

// Universal Mobile Navbar Toggle
function setupMobileNavbar() {
  const toggler = document.querySelector(".navbar-toggler");
  const navCollapse = document.querySelector(".navbar-collapse");
  if (!toggler || !navCollapse) return;

  toggler.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = navCollapse.classList.contains("show");
    if (isOpen) {
      navCollapse.classList.remove("show");
      toggler.setAttribute("aria-expanded", "false");
    } else {
      navCollapse.classList.add("show");
      toggler.setAttribute("aria-expanded", "true");
    }
  });

  document.querySelectorAll(".navbar-nav .nav-link, .navbar-collapse .report-btn").forEach(item => {
    item.addEventListener("click", () => {
      navCollapse.classList.remove("show");
      toggler.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", function (e) {
    if (!navCollapse.contains(e.target) && !toggler.contains(e.target) && navCollapse.classList.contains("show")) {
      navCollapse.classList.remove("show");
      toggler.setAttribute("aria-expanded", "false");
    }
  });
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  setupMobileNavbar();
  setCameraStatus(false);
  populateCameraDevices();
  fetchAndDisplayReports();
});
