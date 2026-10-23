// ==========================================
// CONFIGURATION
// ==========================================
const API_BASE_URL = window.location.protocol.startsWith("http")
  ? window.location.origin
  : "http://localhost:5000";

// ==========================================
// NAVBAR ACTIVE LINK ON SCROLL (Throttled for 60fps Smooth Scroll)
// ==========================================
const navLinks = document.querySelectorAll(".nav-link");
const sections = document.querySelectorAll("section");

let scrollTick = false;
function updateActiveNavLink() {
    let currentSection = "";
    const scrollPos = window.scrollY + 140;

    sections.forEach(function (section) {
        if (section.offsetTop <= scrollPos) {
            currentSection = section.getAttribute("id");
        }
    });

    if (currentSection) {
        navLinks.forEach(function (link) {
            const isMatch = link.getAttribute("href") === "#" + currentSection;
            link.classList.toggle("active", isMatch);
        });
    }
}

window.addEventListener("scroll", function () {
    if (!scrollTick) {
        requestAnimationFrame(() => {
            updateActiveNavLink();
            scrollTick = false;
        });
        scrollTick = true;
    }
}, { passive: true });

// ==========================================
// FALLBACK SEED DATA (For Offline/Initial Test)
// ==========================================
const fallbackReports = [
    {
        id: 1,
        report_code: "IA-2026-00001",
        report_source: "AUTOMATIC",
        camera_id: "CAM-001",
        animal_type: "Dog",
        breed: "Indian Pariah (Indie)",
        injured: true,
        injury_type: "Front leg limp / visible abrasion",
        severity: "Moderate",
        confidence: 0.92,
        description: "AI detected possible injury: indie dog showing visible limping on right forelimb near roadside junction.",
        recommended_action: "Dispatch rescue van for wound dressing and limb stabilization.",
        image_path: "assets/hero-dog.jpg",
        location_name: "Sangamner Main Road Junction",
        report_date: new Date().toISOString().split("T")[0],
        report_time: "10:15",
        report_status: "Forwarded to Rescue Team",
        reporter_name: "AI Live Camera",
        created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString()
    },
    {
        id: 2,
        report_code: "IA-2026-00002",
        report_source: "MANUAL",
        camera_id: null,
        animal_type: "Cat",
        breed: "Domestic Short Hair",
        injured: true,
        injury_type: "Ear laceration & superficial cuts",
        severity: "Minor",
        confidence: 1.0,
        description: "Found resting near community garden boundary, alert and mobile but bleeding from left ear tip.",
        recommended_action: "Local volunteer dispatched with antiseptic spray and gauze.",
        image_path: null,
        location_name: "Shivaji Nagar Community Park",
        report_date: new Date().toISOString().split("T")[0],
        report_time: "11:30",
        report_status: "Forwarded to Rescue Team",
        reporter_name: "Citizen Reporter",
        created_at: new Date(Date.now() - 75 * 60 * 1000).toISOString()
    }
];

const fallbackContacts = [
    { id: 1, organization_name: "Animal Protection Force & Rescue", contact_person: "Dr. Ramesh Sharma", phone: "+91 9876543210", emergency_helpline: "1962", location: "Central Zone" },
    { id: 2, organization_name: "City Veterinary Emergency Services", contact_person: "Dr. Priya Patil", phone: "+91 9822334455", emergency_helpline: "+91 9822334456", location: "East Zone" },
    { id: 3, organization_name: "Paws & Claws Animal Welfare Society", contact_person: "Anand Kulkarni", phone: "+91 9911223344", emergency_helpline: "1800-200-PAWS", location: "West Zone" }
];

let allLoadedReports = [];
let currentFilter = "ALL";
const REPORTS_PER_PAGE = 15;
let visibleReportsLimit = REPORTS_PER_PAGE;
let totalBackendReports = 0;

// Time ago helper
function formatTimeAgo(dateStr) {
    if (!dateStr) return "recently";
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

// ==========================================
// LOAD STATISTICS
// ==========================================
async function loadStatistics() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/reports/statistics`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
                const s = json.data;
                document.getElementById("statTotalReports").textContent = s.total_reports || 0;
                document.getElementById("statManualReports").textContent = s.manual_reports || 0;
                document.getElementById("statAutomaticReports").textContent = s.automatic_reports || 0;
                document.getElementById("statReportsForwarded").textContent = s.reports_forwarded || 0;
                return;
            }
        }
    } catch (e) {
        // Fallback calculation from loaded reports
    }

    // Compute from loaded reports
    const total = allLoadedReports.length;
    const manual = allLoadedReports.filter(r => (r.report_source || "MANUAL").toUpperCase() === "MANUAL").length;
    const auto = allLoadedReports.filter(r => (r.report_source || "").toUpperCase() === "AUTOMATIC").length;
    const fwd = allLoadedReports.filter(r => (r.report_status || "").includes("Forwarded")).length;

    document.getElementById("statTotalReports").textContent = total;
    document.getElementById("statManualReports").textContent = manual;
    document.getElementById("statAutomaticReports").textContent = auto;
    document.getElementById("statReportsForwarded").textContent = fwd;
}

// ==========================================
// LOAD PAST REPORTS
// ==========================================
async function loadPastReports() {
    const loadingEl = document.getElementById("pastReportsLoading");

    try {
        const res = await fetch(`${API_BASE_URL}/api/reports?limit=100`);
        if (res.ok) {
            const json = await res.json();
            if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                allLoadedReports = json.data;
                totalBackendReports = json.pagination?.total || json.data.length;
            } else {
                allLoadedReports = fallbackReports;
                totalBackendReports = fallbackReports.length;
            }
        } else {
            allLoadedReports = fallbackReports;
            totalBackendReports = fallbackReports.length;
        }
    } catch (err) {
        console.warn("[PastReports] Backend not reached, using fallback demonstration data:", err.message);
        allLoadedReports = fallbackReports;
        totalBackendReports = fallbackReports.length;
    }

    if (loadingEl) loadingEl.style.display = "none";
    visibleReportsLimit = REPORTS_PER_PAGE;
    updateFilterCounts();
    renderReports();
    loadStatistics();
}

function updateFilterCounts() {
    const countAll = document.getElementById("countAll");
    const countManual = document.getElementById("countManual");
    const countAutomatic = document.getElementById("countAutomatic");
    const countForwarded = document.getElementById("countForwarded");

    if (countAll) countAll.textContent = allLoadedReports.length;
    if (countManual) {
        countManual.textContent = allLoadedReports.filter(r => (r.report_source || "MANUAL").toUpperCase() === "MANUAL").length;
    }
    if (countAutomatic) {
        countAutomatic.textContent = allLoadedReports.filter(r => (r.report_source || "").toUpperCase() === "AUTOMATIC").length;
    }
    if (countForwarded) {
        countForwarded.textContent = allLoadedReports.filter(r => (r.report_status || "").includes("Forwarded")).length;
    }
}

function getFilteredReports() {
    if (currentFilter === "MANUAL") {
        return allLoadedReports.filter(r => (r.report_source || "MANUAL").toUpperCase() === "MANUAL");
    } else if (currentFilter === "AUTOMATIC") {
        return allLoadedReports.filter(r => (r.report_source || "").toUpperCase() === "AUTOMATIC");
    } else if (currentFilter === "forwarded") {
        return allLoadedReports.filter(r => (r.report_status || "").includes("Forwarded"));
    }
    return allLoadedReports;
}

function renderReports() {
    const gridEl = document.getElementById("pastReportsGrid");
    const emptyEl = document.getElementById("pastReportsEmpty");
    const showMoreContainer = document.getElementById("pastReportsShowMoreContainer");
    const showMoreCountEl = document.getElementById("showMoreRemainingCount");
    if (!gridEl) return;

    const filtered = getFilteredReports();

    if (filtered.length === 0) {
        gridEl.style.display = "none";
        if (emptyEl) emptyEl.style.display = "block";
        if (showMoreContainer) showMoreContainer.style.display = "none";
        return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    gridEl.style.display = "flex";

    // Display only the latest reports up to visibleReportsLimit (default 15)
    const visibleReports = filtered.slice(0, visibleReportsLimit);

    gridEl.innerHTML = visibleReports.map(report => {
        const isManual = (report.report_source || "MANUAL").toUpperCase() === "MANUAL";
        const sourceLabel = isManual ? "Manual Report" : "Automatic Camera";
        const sourceBadgeClass = isManual ? "manual" : "automatic";
        const sourceIcon = isManual ? "fa-user" : "fa-video";

        let severityBadgeClass = "bg-warning text-dark";
        if (report.severity === "Severe") severityBadgeClass = "bg-danger text-white";
        else if (report.severity === "Minor") severityBadgeClass = "bg-success text-white";

        const animalIcon = report.animal_type?.toLowerCase() === "cat" ? "🐈" :
            (report.animal_type?.toLowerCase() === "cow" ? "🐄" :
            (report.animal_type?.toLowerCase() === "bird" ? "🕊️" : "🐕"));

        let imgHtml = "";
        if (report.image_path) {
            const imgSrc = report.image_path.startsWith("http") ? report.image_path :
                           (report.image_path.startsWith("/") ? `${API_BASE_URL}${report.image_path}` : `${report.image_path}`);
            imgHtml = `<img src="${imgSrc}" alt="${report.animal_type}" loading="lazy" decoding="async" style="width:100%;height:160px;object-fit:cover;border-radius:12px;margin-bottom:14px;background:#101815;">`;
        }

        const dateStr = report.report_date || (report.created_at ? new Date(report.created_at).toLocaleDateString() : "Today");
        const timeStr = report.report_time || (report.created_at ? new Date(report.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

        return `
            <div class="col-lg-4 col-md-6 col-12">
                <div class="past-report-card">
                    <div>
                        ${imgHtml}
                        <div class="past-report-header">
                            <span class="past-report-id">${report.report_code || report.report_id}</span>
                            <span class="source-badge ${sourceBadgeClass}">
                                <i class="fa-solid ${sourceIcon}"></i> ${sourceLabel}
                            </span>
                        </div>

                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h4 class="past-report-title mb-0">${animalIcon} ${report.animal_type}</h4>
                            <span class="badge ${severityBadgeClass}" style="font-size:11px;">${report.severity}</span>
                        </div>

                        <div class="past-report-meta text-muted mb-2" style="font-size:12px;">
                            <i class="fa-solid fa-location-dot me-1 text-success"></i> ${report.location_name || report.location || "Reported Locality"}
                            <br>
                            <i class="fa-regular fa-clock me-1 text-success"></i> ${dateStr} ${timeStr ? `at ${timeStr}` : ""}
                        </div>

                        <p class="past-report-desc">
                            <strong>Injury:</strong> ${report.injury_type || "Visible injury"}<br>
                            ${report.description ? report.description.substring(0, 110) + (report.description.length > 110 ? "…" : "") : "Report forwarded to nearby rescue team."}
                        </p>
                    </div>

                    <div class="past-report-footer">
                        <span class="badge bg-light text-success border border-success" style="font-size:11px;font-weight:600;">
                            <i class="fa-solid fa-paper-plane me-1"></i> Forwarded to Rescue Team
                        </span>
                        <button class="btn-view-detail" onclick="openReportDetail('${report.report_code || report.report_id}')">
                            Details <i class="fa-solid fa-arrow-right ms-1"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    // Show More and Show Less buttons handling
    const showMoreBtn = document.getElementById("btnShowMoreReports");
    const showLessBtn = document.getElementById("btnShowLessReports");

    if (showMoreContainer) {
        const remaining = filtered.length - visibleReports.length;
        const hasMore = remaining > 0;
        const hasExpanded = visibleReportsLimit > REPORTS_PER_PAGE;

        if (showMoreBtn) {
            if (hasMore) {
                showMoreBtn.style.display = "inline-flex";
                if (showMoreCountEl) {
                    showMoreCountEl.textContent = remaining;
                }
            } else {
                showMoreBtn.style.display = "none";
            }
        }

        if (showLessBtn) {
            showLessBtn.style.display = hasExpanded ? "inline-flex" : "none";
        }

        showMoreContainer.style.display = (hasMore || hasExpanded) ? "flex" : "none";
    }
}

// Wire filter buttons
document.querySelectorAll(".report-filter-btn").forEach(btn => {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".report-filter-btn").forEach(b => b.classList.remove("active"));
        this.classList.add("active");
        currentFilter = this.getAttribute("data-filter");
        visibleReportsLimit = REPORTS_PER_PAGE; // Reset to 15 latest on tab change
        renderReports();
    });
});

// Wire Show More button
const showMoreBtn = document.getElementById("btnShowMoreReports");
if (showMoreBtn) {
    showMoreBtn.addEventListener("click", async function () {
        const filtered = getFilteredReports();
        // If we reached the end of loaded reports and backend has more total reports
        if (visibleReportsLimit >= filtered.length && totalBackendReports > allLoadedReports.length) {
            try {
                showMoreBtn.disabled = true;
                const originalHtml = showMoreBtn.innerHTML;
                showMoreBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status"></span> Loading...`;
                const res = await fetch(`${API_BASE_URL}/api/reports?limit=50&offset=${allLoadedReports.length}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                        allLoadedReports = allLoadedReports.concat(json.data);
                        updateFilterCounts();
                    }
                }
                showMoreBtn.innerHTML = originalHtml;
            } catch (e) {
                console.warn("[PastReports] Could not load more from server:", e);
            } finally {
                showMoreBtn.disabled = false;
            }
        }
        visibleReportsLimit += REPORTS_PER_PAGE;
        renderReports();
    });
}

// Wire Show Less button
const showLessBtn = document.getElementById("btnShowLessReports");
if (showLessBtn) {
    showLessBtn.addEventListener("click", function () {
        visibleReportsLimit = REPORTS_PER_PAGE;
        renderReports();
        const pastReportsSection = document.getElementById("past-reports");
        if (pastReportsSection) {
            pastReportsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    });
}

// Open report detail modal
window.openReportDetail = async function (reportCode) {
    let report = allLoadedReports.find(r => (r.report_code === reportCode || r.report_id === reportCode));
    let contacts = fallbackContacts;

    try {
        const res = await fetch(`${API_BASE_URL}/api/reports/${reportCode}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.report) {
                report = data.report;
                if (Array.isArray(data.report.rescue_contacts) && data.report.rescue_contacts.length > 0) {
                    contacts = data.report.rescue_contacts;
                }
            }
        }
    } catch (err) {
        console.warn("[ReportDetail] Could not fetch single report from API:", err.message);
    }

    if (!report) return;

    // Populate modal elements
    document.getElementById("modalReportId").textContent = report.report_code || report.report_id;
    document.getElementById("modalAnimalTitle").textContent = `${report.animal_type} (${report.breed || 'Unknown Breed'})`;
    document.getElementById("modalLocation").querySelector("span").textContent = report.location_name || report.location || "Reported Locality";
    document.getElementById("modalInjury").textContent = `${report.injury_type || 'Visible Injury'} (${report.severity} Severity)`;
    document.getElementById("modalDescription").textContent = report.description || "No additional description provided.";
    document.getElementById("modalAction").textContent = report.recommended_action || "Forwarded to rescue organization for immediate dispatch.";

    const modalSource = document.getElementById("modalSource");
    const isManual = (report.report_source || "MANUAL").toUpperCase() === "MANUAL";
    modalSource.textContent = isManual ? "Manual Citizen Report" : "Automatic Camera Detection";
    modalSource.className = `source-badge ${isManual ? "manual" : "automatic"}`;

    const modalSeverity = document.getElementById("modalSeverity");
    modalSeverity.textContent = `${report.severity} Severity`;
    modalSeverity.className = `badge ${report.severity === 'Severe' ? 'bg-danger' : (report.severity === 'Minor' ? 'bg-success' : 'bg-warning text-dark')}`;

    const dateStr = report.report_date || (report.created_at ? new Date(report.created_at).toLocaleDateString() : "Today");
    const timeStr = report.report_time || (report.created_at ? new Date(report.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
    document.getElementById("modalDate").textContent = `${dateStr} at ${timeStr}`;

    // Modal Image
    const modalImage = document.getElementById("modalImage");
    const modalPlaceholder = document.getElementById("modalImagePlaceholder");
    if (report.image_path) {
        const imgSrc = report.image_path.startsWith("http") ? report.image_path :
                       (report.image_path.startsWith("/") ? `${API_BASE_URL}${report.image_path}` : `${report.image_path}`);
        modalImage.src = imgSrc;
        modalImage.style.display = "block";
        modalPlaceholder.style.display = "none";
    } else {
        modalImage.style.display = "none";
        modalPlaceholder.style.display = "block";
    }

    // Rescue contacts list
    const contactsContainer = document.getElementById("modalRescueContacts");
    contactsContainer.innerHTML = contacts.map(c => `
        <div class="p-2 rounded bg-light border d-flex justify-content-between align-items-center">
            <div>
                <strong>${c.organization_name}</strong>
                <div class="text-muted" style="font-size:11px;">${c.location || 'Pune / Regional'} · Contact: ${c.contact_person || 'Coordinator'}</div>
            </div>
            <a href="tel:${c.phone}" class="btn btn-sm btn-outline-success">
                <i class="fa-solid fa-phone"></i> ${c.phone}
            </a>
        </div>
    `).join("");

    // Show modal using Bootstrap API
    const modalElement = document.getElementById("reportDetailModal");
    const bsModal = new bootstrap.Modal(modalElement);
    bsModal.show();
};

// ==========================================
// INITIALIZE ON DOM READY
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    loadPastReports();
});