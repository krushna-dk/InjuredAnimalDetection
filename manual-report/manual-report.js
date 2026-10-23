// =====================================================
// MANUAL REPORT JAVASCRIPT
// Injured Animal Detection Platform
// =====================================================

// Resolve API base URL dynamically (works on localhost, Render, and file preview)
const API_BASE_URL = window.location.protocol.startsWith("http")
    ? window.location.origin
    : "http://localhost:5000";

// Form and Controls
const form = document.getElementById("animalReportForm");
const submitReportBtn = document.getElementById("submitReportBtn");
const resetFormBtn = document.getElementById("resetFormBtn");
const btnSubmitAnother = document.getElementById("btnSubmitAnother");
const successMessage = document.getElementById("successMessage");
const generatedReportId = document.getElementById("generatedReportId");
const reportSummaryDetails = document.getElementById("reportSummaryDetails");
const formErrorMessage = document.getElementById("formErrorMessage");
const formErrorTitle = document.getElementById("formErrorTitle");
const formErrorText = document.getElementById("formErrorText");

function showFormError(title, msg) {
    if (formErrorMessage) {
        if (formErrorTitle) formErrorTitle.textContent = title;
        if (formErrorText) formErrorText.textContent = msg;
        formErrorMessage.classList.remove("d-none");
        formErrorMessage.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
        alert(`${title}: ${msg}`);
    }
}

function hideFormError() {
    if (formErrorMessage) {
        formErrorMessage.classList.add("d-none");
    }
}

// Image Upload & Camera Viewfinder Elements
const tabUploadMode = document.getElementById("tabUploadMode");
const tabCameraMode = document.getElementById("tabCameraMode");
const uploadArea = document.getElementById("uploadArea");
const uploadContent = document.getElementById("uploadContent");
const photoInput = document.getElementById("animalPhoto");
const cameraViewfinder = document.getElementById("cameraViewfinder");
const manualCameraVideo = document.getElementById("manualCameraVideo");
const manualCameraCanvas = document.getElementById("manualCameraCanvas");
const snapPhotoBtn = document.getElementById("snapPhotoBtn");
const switchCameraBtn = document.getElementById("switchCameraBtn");
const closeCameraBtn = document.getElementById("closeCameraBtn");
const imagePreview = document.getElementById("imagePreview");
const photoError = document.getElementById("photoError");

// Animal Details
const animalType = document.getElementById("animalType");
const breed = document.getElementById("breed");
const injuryType = document.getElementById("injuryType");
const severityError = document.getElementById("severityError");
const description = document.getElementById("description");
const descriptionCount = document.getElementById("descriptionCount");

// Location and Time
const detectLocation = document.getElementById("detectLocation");
const locationMessage = document.getElementById("locationMessage");
const address = document.getElementById("address");
const latitude = document.getElementById("latitude");
const longitude = document.getElementById("longitude");
const reportDate = document.getElementById("reportDate");
const reportTime = document.getElementById("reportTime");

// Reporter Details
const reporterName = document.getElementById("reporterName");
const reporterEmail = document.getElementById("reporterEmail");
const reporterEmailError = document.getElementById("reporterEmailError");
const phone = document.getElementById("phone");
const phoneError = document.getElementById("phoneError");
const additionalNote = document.getElementById("additionalNote");
const noteCount = document.getElementById("noteCount");

// State
let selectedImageFile = null; // File or Blob
let cameraStream = null;
let currentFacingMode = "environment"; // default to rear camera on mobile

// =====================================================
// 1. DATE & TIME AUTO-POPULATION
// =====================================================
function setCurrentDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    reportDate.value = `${year}-${month}-${day}`;

    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    reportTime.value = `${hours}:${minutes}`;
}
setCurrentDateTime();

// =====================================================
// 2. CHARACTER COUNTERS
// =====================================================
description.addEventListener("input", () => {
    descriptionCount.textContent = description.value.length;
});
if (additionalNote && noteCount) {
    additionalNote.addEventListener("input", () => {
        noteCount.textContent = additionalNote.value.length;
    });
}

// =====================================================
// 3. IMAGE SELECTION & CAMERA MODES
// =====================================================

// Switch to Upload Mode
tabUploadMode.addEventListener("click", () => {
    tabUploadMode.classList.add("active");
    tabCameraMode.classList.remove("active");
    stopCameraStream();
    cameraViewfinder.style.display = "none";
    uploadArea.style.display = "flex";
});

// Switch to Camera Mode
tabCameraMode.addEventListener("click", () => {
    tabCameraMode.classList.add("active");
    tabUploadMode.classList.remove("active");
    uploadArea.style.display = "none";
    startCameraStream();
});

// Start device camera
async function startCameraStream() {
    cameraViewfinder.style.display = "block";
    try {
        if (cameraStream) {
            cameraStream.getTracks().forEach(t => t.stop());
        }
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        manualCameraVideo.srcObject = cameraStream;
    } catch (err) {
        console.warn("[ManualCamera] Camera access error:", err);
        alert("Camera permission denied or camera not found. Please upload an image file instead.");
        tabUploadMode.click();
    }
}

// Stop device camera
function stopCameraStream() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    manualCameraVideo.srcObject = null;
}

// Snap Photo from Video Stream
snapPhotoBtn.addEventListener("click", () => {
    if (!manualCameraVideo.videoWidth || manualCameraVideo.videoWidth === 0) {
        alert("Camera preview is loading. Please wait a moment and try again.");
        return;
    }

    manualCameraCanvas.width = manualCameraVideo.videoWidth;
    manualCameraCanvas.height = manualCameraVideo.videoHeight;
    const ctx = manualCameraCanvas.getContext("2d");
    ctx.drawImage(manualCameraVideo, 0, 0, manualCameraCanvas.width, manualCameraCanvas.height);

    manualCameraCanvas.toBlob(blob => {
        if (blob) {
            selectedImageFile = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: "image/jpeg" });
            renderImagePreview(selectedImageFile);
            photoError.style.display = "none";
            stopCameraStream();
            cameraViewfinder.style.display = "none";
            uploadArea.style.display = "flex";
            tabUploadMode.click();
        }
    }, "image/jpeg", 0.90);
});

// Flip Camera (front/back)
switchCameraBtn.addEventListener("click", () => {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    startCameraStream();
});

// Close Camera
closeCameraBtn.addEventListener("click", () => {
    stopCameraStream();
    cameraViewfinder.style.display = "none";
    uploadArea.style.display = "flex";
    tabUploadMode.click();
});

// Click on file upload area triggers hidden file input
uploadArea.addEventListener("click", () => {
    photoInput.click();
});

// File input change
photoInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
        selectedImageFile = e.target.files[0];
        renderImagePreview(selectedImageFile);
        photoError.style.display = "none";
    }
});

// Drag and drop support
uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
});
uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
});
uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        selectedImageFile = e.dataTransfer.files[0];
        renderImagePreview(selectedImageFile);
        photoError.style.display = "none";
    }
});

// Render Image Thumbnail Preview
function renderImagePreview(file) {
    imagePreview.innerHTML = "";
    if (!file) return;

    const wrapper = document.createElement("div");
    wrapper.className = "preview-image-wrapper";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = "Incident preview";

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-image";
    removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    removeBtn.title = "Remove photo";
    removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        selectedImageFile = null;
        photoInput.value = "";
        imagePreview.innerHTML = "";
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    imagePreview.appendChild(wrapper);
}

// =====================================================
// 4. BROWSER GEOLOCATION WITH REVERSE GEOCODING
// =====================================================
detectLocation.addEventListener("click", () => {
    if (!navigator.geolocation) {
        showLocationMsg("Geolocation is not supported by your browser.", "error");
        return;
    }

    showLocationMsg("Detecting location via GPS...", "normal");
    detectLocation.disabled = true;

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude.toFixed(5);
            const lng = position.coords.longitude.toFixed(5);
            latitude.value = lat;
            longitude.value = lng;

            showLocationMsg("Location coordinates detected. Fetching area address...", "normal");

            // Reverse geocode via OpenStreetMap Nominatim
            try {
                const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
                const response = await fetch(geoUrl, {
                    headers: { "Accept-Language": "en" }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.display_name) {
                        address.value = data.display_name;
                        showLocationMsg("Location & address detected successfully.", "success");
                        detectLocation.disabled = false;
                        return;
                    }
                }
            } catch (err) {
                console.warn("[Geolocation] Reverse geocoding notice:", err);
            }

            // Fallback address format
            if (!address.value.trim()) {
                address.value = `Latitude: ${lat}, Longitude: ${lng} (Area)`;
            }
            showLocationMsg("Coordinates detected. Please confirm or refine the address.", "success");
            detectLocation.disabled = false;
        },
        (error) => {
            detectLocation.disabled = false;
            let msg = "Could not detect location.";
            if (error.code === 1) msg = "Location access was denied. Please enter address manually.";
            else if (error.code === 2) msg = "Location unavailable. Please enter address manually.";
            else if (error.code === 3) msg = "Location request timed out. Please enter address manually.";
            showLocationMsg(msg, "error");
        },
        { timeout: 12000, enableHighAccuracy: true }
    );
});

function showLocationMsg(text, type) {
    locationMessage.textContent = text;
    locationMessage.className = "location-message";
    if (type === "success") locationMessage.classList.add("location-success");
    else if (type === "error") locationMessage.classList.add("location-error");
}

// =====================================================
// 5. FORM SUBMISSION
// =====================================================
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    let isValid = true;

    // Photo check
    if (!selectedImageFile) {
        photoError.style.display = "block";
        isValid = false;
    } else {
        photoError.style.display = "none";
    }

    // Bootstrap validation check
    if (!form.checkValidity()) {
        form.classList.add("was-validated");
        isValid = false;
    }

    // Severity check
    const selectedSeverity = document.querySelector('input[name="severity"]:checked');
    if (!selectedSeverity) {
        severityError.classList.add("show");
        isValid = false;
    } else {
        severityError.classList.remove("show");
    }

    // Reporter Email validation (Required so rescue team can follow up)
    const emailVal = reporterEmail ? reporterEmail.value.trim() : "";
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal || !emailPattern.test(emailVal)) {
        if (reporterEmail) reporterEmail.classList.add("is-invalid");
        isValid = false;
    } else {
        if (reporterEmail) reporterEmail.classList.remove("is-invalid");
    }

    // Phone validation (if provided)
    if (phone.value.trim() !== "") {
        const phonePattern = /^[6-9][0-9]{9}$/;
        if (!phonePattern.test(phone.value.trim())) {
            phone.classList.add("is-invalid");
            isValid = false;
        } else {
            phone.classList.remove("is-invalid");
        }
    }

    if (!isValid) {
        return;
    }

    // Prepare multipart form data
    const originalBtnHtml = submitReportBtn.innerHTML;
    submitReportBtn.disabled = true;
    submitReportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting & Forwarding…';

    const formData = new FormData();
    if (selectedImageFile) {
        formData.append("image", selectedImageFile);
    }
    formData.append("animal_type", animalType.value);
    formData.append("breed", breed.value.trim() || "Unknown");
    formData.append("injured", "true");
    formData.append("injury_type", injuryType.value);
    formData.append("severity", selectedSeverity.value);
    formData.append("description", description.value.trim());
    formData.append("location", address.value.trim());
    if (latitude.value) formData.append("latitude", latitude.value);
    if (longitude.value) formData.append("longitude", longitude.value);
    formData.append("report_date", reportDate.value);
    formData.append("report_time", reportTime.value);
    if (reporterName.value.trim()) formData.append("reporter_name", reporterName.value.trim());
    if (emailVal) formData.append("reporter_email", emailVal);
    if (phone.value.trim()) formData.append("reporter_contact", phone.value.trim());
    if (additionalNote.value.trim()) formData.append("recommended_action", additionalNote.value.trim());
    formData.append("report_source", "MANUAL");

    hideFormError();

    let reportCode = null;
    let serverReport = null;
    let deliveryStatus = "Your report has been forwarded to the rescue team.";

    try {
        const response = await fetch(`${API_BASE_URL}/api/reports`, {
            method: "POST",
            body: formData
        });

        const data = await response.json().catch(() => null);

        if (response.ok && data && data.success) {
            serverReport = data.report;
            reportCode = data.report_code || (data.report && data.report.report_code);
            if (data.delivery_status) {
                deliveryStatus = data.delivery_status;
            }
        } else {
            const errorMsg = (data && data.message)
                ? data.message
                : `Server error (Status ${response.status}: ${response.statusText || 'Unable to process report'}).`;
            showFormError("Submission Failed", errorMsg);
            submitReportBtn.disabled = false;
            submitReportBtn.innerHTML = originalBtnHtml;
            return;
        }
    } catch (apiErr) {
        console.error("[ManualReport] API submit network failure:", apiErr);
        showFormError(
            "Backend Server Offline",
            `Could not connect to API server at ${API_BASE_URL}. Please start the server using start_server.bat in the project directory, then try submitting again.`
        );
        submitReportBtn.disabled = false;
        submitReportBtn.innerHTML = originalBtnHtml;
        return;
    }

    if (!reportCode) {
        showFormError("Invalid Server Response", "Server did not return a valid Report ID. Please verify database connection.");
        submitReportBtn.disabled = false;
        submitReportBtn.innerHTML = originalBtnHtml;
        return;
    }

    // Populate Success Card with Real Data
    generatedReportId.textContent = reportCode;
    const animal = animalType.value;
    const sev = selectedSeverity.value;
    const loc = address.value.trim();
    const dateStr = reportDate.value;
    const timeStr = reportTime.value;

    reportSummaryDetails.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <strong>🐾 Incident Summary</strong>
            <span class="source-badge manual">Manual Citizen Report</span>
        </div>
        <div><strong>Animal:</strong> ${animal} · <strong>Breed:</strong> ${breed.value.trim() || 'Unknown'}</div>
        <div><strong>Observed Injury:</strong> ${injuryType.value} (<em>${sev} Severity</em>)</div>
        <div><strong>Incident Location:</strong> ${loc}</div>
        <div><strong>Timestamp:</strong> ${dateStr} at ${timeStr}</div>
        <div><strong>Reporter Email:</strong> ${emailVal} ${reporterName.value.trim() ? `(${reporterName.value.trim()})` : ''}</div>
        <div class="mt-2 text-muted" style="font-size:12px;">
            <i class="fa-solid fa-bell"></i> ${deliveryStatus}
        </div>
    `;

    // Display confirmation
    form.style.display = "none";
    successMessage.classList.add("show");
    window.scrollTo({ top: 0, behavior: "smooth" });

    submitReportBtn.disabled = false;
    submitReportBtn.innerHTML = originalBtnHtml;
});

// =====================================================
// 6. RESET FORM BUTTON
// =====================================================
resetFormBtn.addEventListener("click", () => {
    form.reset();
    form.classList.remove("was-validated");
    hideFormError();
    selectedImageFile = null;
    photoInput.value = "";
    imagePreview.innerHTML = "";
    photoError.style.display = "none";
    severityError.classList.remove("show");
    phone.classList.remove("is-invalid");
    if (reporterEmail) {
        reporterEmail.classList.remove("is-invalid");
        reporterEmail.value = "";
    }
    stopCameraStream();
    cameraViewfinder.style.display = "none";
    uploadArea.style.display = "flex";
    tabUploadMode.classList.add("active");
    tabCameraMode.classList.remove("active");
    locationMessage.textContent = "";
    setCurrentDateTime();
});

// Submit Another Report
btnSubmitAnother.addEventListener("click", () => {
    successMessage.classList.remove("show");
    form.style.display = "block";
    resetFormBtn.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
});