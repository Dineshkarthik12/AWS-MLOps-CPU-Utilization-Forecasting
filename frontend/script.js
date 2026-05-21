/* ═══════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════ */
// When served behind Nginx reverse proxy (recommended for deployment):
const API_BASE_UPLOAD   = "/api/upload";
const API_BASE_FORECAST = "/api/forecast";

// Direct URLs (for local testing without Nginx):
// const API_BASE_UPLOAD   = "http://13.200.172.98:8000";
// const API_BASE_FORECAST = "http://13.200.172.98:9000";

/* ═══════════════════════════════════════════
   DOM REFS
   ═══════════════════════════════════════════ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Steps
const stepItems      = $$(".step-item");
const stepConnectors = $$(".step-connector");

// Panels
const panelUpload   = $("#panel-upload");
const panelJobid    = $("#panel-jobid");
const panelForecast = $("#panel-forecast");
const panels        = [panelUpload, panelJobid, panelForecast];

// Upload
const uploadZone      = $("#upload-zone");
const fileInput       = $("#file-input");
const fileInfo        = $("#file-info");
const fileName        = $("#file-name");
const fileSize        = $("#file-size");
const btnRemove       = $("#btn-remove");
const btnUpload       = $("#btn-upload");
const uploadLoader    = $("#upload-loader");
const uploadResponse  = $("#upload-response");
const uploadStatusBadge = $("#upload-status-badge");
const uploadResponseBody = $("#upload-response-body");

// Job ID
const jobIdValue     = $("#job-id-value");
const btnCopy        = $("#btn-copy");
const copyText       = $("#copy-text");
const s3PathValue    = $("#s3-path-value");
const timestampValue = $("#timestamp-value");
const btnGoForecast  = $("#btn-go-forecast");

// Forecast
const forecastJobId      = $("#forecast-job-id");
const forecastData       = $("#forecast-data");
const valueCount         = $("#value-count");
const btnForecast        = $("#btn-forecast");
const forecastLoader     = $("#forecast-loader");
const forecastResponse   = $("#forecast-response");
const forecastStatusBadge = $("#forecast-status-badge");
const forecastSummary    = $("#forecast-summary");
const totalConsumption   = $("#total-consumption");
const forecastChartCont  = $("#forecast-chart-container");
const forecastResponseBody = $("#forecast-response-body");

// Header
const apiStatus = $("#api-status");

/* ═══════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════ */
let selectedFile = null;
let currentStep  = 1;
let generatedJobId = null;
let forecastChart  = null;

/* ═══════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════ */

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
}

function formatTimestamp() {
    return new Date().toISOString().replace("T", " ").split(".")[0] + " UTC";
}

/* ═══════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════ */
function goToStep(step) {
    currentStep = step;

    // Update step indicators
    stepItems.forEach((item, i) => {
        const s = i + 1;
        item.classList.remove("active", "completed");
        if (s === step) item.classList.add("active");
        else if (s < step) item.classList.add("completed");
    });

    // Update connectors
    stepConnectors.forEach((conn, i) => {
        conn.classList.toggle("active", i + 1 < step);
    });

    // Show the right panel
    panels.forEach((p, i) => {
        p.classList.toggle("active", i + 1 === step);
    });

    // Scroll to top of panel smoothly
    window.scrollTo({ top: $("#steps-section").offsetTop - 80, behavior: "smooth" });
}

// Allow free navigation between steps
stepItems.forEach((item) => {
    item.addEventListener("click", () => {
        const target = parseInt(item.dataset.step);
        goToStep(target);
    });
});

/* ═══════════════════════════════════════════
   UPLOAD — FILE SELECTION
   ═══════════════════════════════════════════ */
uploadZone.addEventListener("click", () => fileInput.click());

uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
        handleFileSelect(fileInput.files[0]);
    }
});

function handleFileSelect(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.classList.remove("hidden");
    uploadZone.classList.add("hidden");
    btnUpload.disabled = false;
}

btnRemove.addEventListener("click", () => {
    selectedFile = null;
    fileInput.value = "";
    fileInfo.classList.add("hidden");
    uploadZone.classList.remove("hidden");
    btnUpload.disabled = true;
    uploadResponse.classList.add("hidden");
});

/* ═══════════════════════════════════════════
   UPLOAD — API CALL
   ═══════════════════════════════════════════ */
btnUpload.addEventListener("click", async () => {
    if (!selectedFile) return;

    // Show loader
    btnUpload.querySelector(".btn-label").classList.add("hidden");
    uploadLoader.classList.remove("hidden");
    btnUpload.disabled = true;
    uploadResponse.classList.add("hidden");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
        const res = await fetch(`${API_BASE_UPLOAD}/upload-data`, {
            method: "POST",
            body: formData,
        });

        const data = await res.json();

        // Use job ID from API response
        generatedJobId = data.job_id;

        // Build combined response for display
        const combined = {
            ...data,
            timestamp: formatTimestamp(),
        };

        // Show response
        uploadStatusBadge.textContent = res.ok ? "Success" : "Error";
        uploadStatusBadge.className = "response-status " + (res.ok ? "success" : "error");
        uploadResponseBody.textContent = JSON.stringify(combined, null, 2);
        uploadResponse.classList.remove("hidden");

        if (res.ok) {
            // Populate Job ID panel
            jobIdValue.textContent = generatedJobId;
            s3PathValue.textContent = data.s3_path || "—";
            timestampValue.textContent = formatTimestamp();
            forecastJobId.value = generatedJobId;

            // Auto-advance after a short delay
            setTimeout(() => goToStep(2), 1200);
        }
    } catch (err) {
        uploadStatusBadge.textContent = "Error";
        uploadStatusBadge.className = "response-status error";
        uploadResponseBody.textContent = JSON.stringify({
            error: "Failed to connect to Upload API",
            detail: err.message,
            hint: "Ensure the API server is running at " + API_BASE_UPLOAD,
        }, null, 2);
        uploadResponse.classList.remove("hidden");
    } finally {
        btnUpload.querySelector(".btn-label").classList.remove("hidden");
        uploadLoader.classList.add("hidden");
        btnUpload.disabled = false;
    }
});

/* ═══════════════════════════════════════════
   JOB ID — COPY & NAVIGATE
   ═══════════════════════════════════════════ */
btnCopy.addEventListener("click", () => {
    const id = jobIdValue.textContent;
    if (!id || id === "—") return;

    navigator.clipboard.writeText(id).then(() => {
        copyText.textContent = "Copied!";
        btnCopy.classList.add("copied");
        setTimeout(() => {
            copyText.textContent = "Copy";
            btnCopy.classList.remove("copied");
        }, 2000);
    });
});

btnGoForecast.addEventListener("click", () => goToStep(3));

/* ═══════════════════════════════════════════
   FORECAST — INPUT VALIDATION
   ═══════════════════════════════════════════ */
forecastData.addEventListener("input", validateForecastInputs);
forecastJobId.addEventListener("input", validateForecastInputs);

function parseValues() {
    const raw = forecastData.value.trim();
    if (!raw) return [];
    return raw
        .split(/[\s,]+/)
        .map((v) => parseFloat(v.trim()))
        .filter((v) => !isNaN(v));
}

function validateForecastInputs() {
    const values = parseValues();
    const count = values.length;
    const jobOk = forecastJobId.value.trim().length > 0;

    valueCount.textContent = `${count} / 24 values`;
    valueCount.className = "";
    if (count === 24) valueCount.classList.add("valid");
    else if (count > 0) valueCount.classList.add("invalid");

    btnForecast.disabled = !(count === 24 && jobOk);
}

/* ═══════════════════════════════════════════
   FORECAST — API CALL
   ═══════════════════════════════════════════ */
btnForecast.addEventListener("click", async () => {
    const values = parseValues();
    if (values.length !== 24) return;

    // Show loader
    btnForecast.querySelector(".btn-label").classList.add("hidden");
    forecastLoader.classList.remove("hidden");
    btnForecast.disabled = true;
    forecastResponse.classList.add("hidden");
    forecastSummary.classList.add("hidden");
    forecastChartCont.classList.add("hidden");

    try {
        const jobId = forecastJobId.value.trim();
        const res = await fetch(`${API_BASE_FORECAST}/forecast`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                job_id: jobId,
                last_24_hours: values 
            }),
        });

        const data = await res.json();

        forecastStatusBadge.textContent = res.ok ? "Success" : "Error";
        forecastStatusBadge.className = "response-status " + (res.ok ? "success" : "error");
        forecastResponseBody.textContent = JSON.stringify(data, null, 2);
        forecastResponse.classList.remove("hidden");

        if (res.ok && data.predicted_next_24_hours) {
            // Show summary
            const total = data.total_next_day_consumption;
            totalConsumption.textContent = total.toFixed(2);
            forecastSummary.classList.remove("hidden");

            // Render chart
            renderForecastChart(data.predicted_next_24_hours);
            forecastChartCont.classList.remove("hidden");
        }
    } catch (err) {
        forecastStatusBadge.textContent = "Error";
        forecastStatusBadge.className = "response-status error";
        forecastResponseBody.textContent = JSON.stringify({
            error: "Failed to connect to Forecast API",
            detail: err.message,
            hint: "Ensure the API server is running at " + API_BASE_FORECAST,
        }, null, 2);
        forecastResponse.classList.remove("hidden");
    } finally {
        btnForecast.querySelector(".btn-label").classList.remove("hidden");
        forecastLoader.classList.add("hidden");
        btnForecast.disabled = false;
    }
});

/* ═══════════════════════════════════════════
   CHART
   ═══════════════════════════════════════════ */
function renderForecastChart(predictions) {
    const canvas = $("#forecast-chart");
    if (forecastChart) forecastChart.destroy();

    const labels = Array.from({ length: 24 }, (_, i) => {
        const h = i.toString().padStart(2, "0");
        return `${h}:00`;
    });

    forecastChart = new Chart(canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Predicted CPU Utilization (%)",
                data: predictions,
                borderColor: "#ffffff",
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 2,
                pointRadius: 3,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#ffffff",
                pointHoverRadius: 5,
                fill: true,
                tension: 0.35,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "#1a1a1a",
                    titleColor: "#f0f0f0",
                    bodyColor: "#cccccc",
                    borderColor: "#333",
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    titleFont: { family: "'Inter', sans-serif", size: 12 },
                    bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
                    callbacks: {
                        label: (ctx) => `  ${ctx.parsed.y.toFixed(2)} %`,
                    },
                },
            },
            scales: {
                x: {
                    grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
                    ticks: {
                        color: "#555",
                        font: { family: "'JetBrains Mono', monospace", size: 10 },
                        maxRotation: 45,
                    },
                },
                y: {
                    grid: { color: "rgba(255,255,255,0.04)", drawBorder: false },
                    ticks: {
                        color: "#555",
                        font: { family: "'JetBrains Mono', monospace", size: 10 },
                    },
                },
            },
        },
    });
}

/* ═══════════════════════════════════════════
   API HEALTH CHECK
   ═══════════════════════════════════════════ */
async function checkApiHealth() {
    try {
        const res = await fetch(`${API_BASE_UPLOAD}/`, { method: "GET" });
        if (res.ok) {
            apiStatus.classList.add("online");
            apiStatus.classList.remove("offline");
            apiStatus.querySelector("span:last-child").textContent = "API Online";
        } else {
            throw new Error();
        }
    } catch {
        apiStatus.classList.add("offline");
        apiStatus.classList.remove("online");
        apiStatus.querySelector("span:last-child").textContent = "API Offline";
    }
}

// Run health check on load
checkApiHealth();
// Re-check every 30 seconds
setInterval(checkApiHealth, 30000);
