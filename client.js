import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { firebaseConfig, FIRESTORE_COLLECTION, FIRESTORE_METADATA_DOC } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const lookupForm = document.getElementById("clientLookupForm");
const lookupMessage = document.getElementById("lookupMessage");
const emptyState = document.getElementById("emptyState");
const resultCard = document.getElementById("resultCard");
const resultTitle = document.getElementById("resultTitle");
const resultBadge = document.getElementById("resultBadge");
const resultSummary = document.getElementById("resultSummary");
const factName = document.getElementById("factName");
const factPan = document.getElementById("factPan");
const factCode = document.getElementById("factCode");
const factRefund = document.getElementById("factRefund");
const timeline = document.getElementById("timeline");
const dataSourceChip = document.getElementById("dataSourceChip");
const datasetMetaText = document.getElementById("datasetMetaText");

const statusConfig = {
  "successfully e-verified": {
    label: "Successfully e-verified",
    badgeClass: "completed",
    summary: (name, ay, amount) =>
      `${name}'s return for AY ${ay} is marked as successfully e-verified. This means the verification step has been completed and the return is in or ready for further processing. The refund amount currently reflected in the office record is ${amount}.`,
    timeline: [
      "The return has crossed the verification milestone successfully.",
      "Processing normally continues after the verification stage.",
      "You can keep monitoring future movement in the official portal or office updates."
    ]
  },
  "processed with refund due": {
    label: "Processed with refund due",
    badgeClass: "completed",
    summary: (name, ay, amount) =>
      `${name}'s return for AY ${ay} is recorded as processed with refund due. The department has likely completed the core processing stage and the refund outcome is reflected in the office record. The refund amount shown is ${amount}.`,
    timeline: [
      "The return has moved beyond review and reflects a refund outcome.",
      "The next visible movement is generally release or credit-related processing.",
      "Bank-account-linked final settlement timing can still vary."
    ]
  },
  "refund kept on hold": {
    label: "Refund kept on hold",
    badgeClass: "hold",
    summary: (name, ay, amount) =>
      `${name}'s return for AY ${ay} shows that the refund is currently kept on hold. This usually means the refund release is paused pending a verification, response, or internal adjustment step. The office record currently shows a refund amount of ${amount}.`,
    timeline: [
      "A hold is reflected against the refund outcome for this assessment year.",
      "This can happen because of review, demand adjustment, or pending clarification.",
      "The status may change after the relevant requirement is resolved."
    ]
  },
  "": {
    label: "Status pending update",
    badgeClass: "unknown",
    summary: (name, ay, amount) =>
      `${name}'s record for AY ${ay} is available, but the refund status has not yet been filled in the uploaded office sheet. The office record currently reflects a refund amount of ${amount}.`,
    timeline: [
      "The row exists in the office dataset for this client and assessment year.",
      "The refund amount is present, but the refund-status field is blank.",
      "Please wait for the office to publish the next workbook update."
    ]
  }
};

function formatCurrency(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return "Not available";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(amount));
}

function panLooksValid(value) {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
}

function buildTimeline(items) {
  timeline.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "timeline-row";

    const dot = document.createElement("div");
    dot.className = "timeline-dot";

    const copy = document.createElement("div");
    copy.className = "timeline-copy";
    copy.innerHTML = `<strong>Portal insight</strong>${item}`;

    row.appendChild(dot);
    row.appendChild(copy);
    timeline.appendChild(row);
  });
}

function getStatusView(statusValue) {
  const normalized = (statusValue || "").trim().toLowerCase();
  return statusConfig[normalized] || {
    label: statusValue || "Status pending update",
    badgeClass: "unknown",
    summary: (name, ay, amount) =>
      `${name}'s return for AY ${ay} is currently shown as "${statusValue}". The uploaded office record reflects a refund amount of ${amount}.`,
    timeline: [
      "The status is being shown exactly as it appears in the uploaded office workbook.",
      "If needed, the office can publish a more specific workbook update later.",
      "Use the official portal for the most authoritative live tax-portal status."
    ]
  };
}

function renderRecord(record) {
  const amount = formatCurrency(record.refundAmount);
  const view = getStatusView(record.refundStatus);

  resultTitle.textContent = `AY ${record.assessmentYear}`;
  resultBadge.textContent = view.label;
  resultBadge.className = `badge ${view.badgeClass}`;
  resultSummary.textContent = view.summary(record.name, record.assessmentYear, amount);
  factName.textContent = record.name || "-";
  factPan.textContent = record.pan || "-";
  factCode.textContent = record.codeNo || "-";
  factRefund.textContent = amount;

  buildTimeline(view.timeline);
  emptyState.style.display = "none";
  resultCard.classList.add("active");
}

async function loadDatasetMeta() {
  try {
    const snap = await getDoc(doc(db, FIRESTORE_METADATA_DOC));
    if (!snap.exists()) {
      datasetMetaText.textContent = "No office-upload metadata has been published yet.";
      dataSourceChip.textContent = "No dataset yet";
      return;
    }

    const data = snap.data();
    const uploadedAt = data.uploadedAt?.toDate ? data.uploadedAt.toDate() : null;
    const uploadedLabel = uploadedAt ? uploadedAt.toLocaleString("en-IN") : "unknown time";
    datasetMetaText.textContent = `Latest upload: ${uploadedLabel}. Uploaded by ${data.uploadedBy || "office staff"}. Records published: ${data.recordCount || 0}.`;
    dataSourceChip.textContent = `Latest upload: ${data.assessmentYear || "mixed AY"}`;
  } catch (error) {
    datasetMetaText.textContent = `Could not read dataset metadata: ${error.message}`;
    dataSourceChip.textContent = "Metadata unavailable";
  }
}

async function lookupRecord(pan, assessmentYear) {
  const recordsRef = collection(db, FIRESTORE_COLLECTION);
  const q = query(
    recordsRef,
    where("pan", "==", pan),
    where("assessmentYear", "==", assessmentYear),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) {
    return null;
  }
  return snap.docs[0].data();
}

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pan = document.getElementById("pan").value.trim().toUpperCase();
  const assessmentYear = document.getElementById("assessmentYear").value;

  lookupMessage.className = "status-message error";
  resultCard.classList.remove("active");
  emptyState.style.display = "block";

  if (!panLooksValid(pan)) {
    lookupMessage.textContent = "Enter a valid PAN in the format ABCDE1234F.";
    return;
  }

  if (!assessmentYear) {
    lookupMessage.textContent = "Select an assessment year.";
    return;
  }

  lookupMessage.className = "status-message warning";
  lookupMessage.textContent = "Checking the latest office-published record...";

  try {
    const record = await lookupRecord(pan, assessmentYear);
    if (!record) {
      lookupMessage.className = "status-message error";
      lookupMessage.textContent = "No record was found for that PAN and assessment year.";
      return;
    }

    renderRecord(record);
    lookupMessage.className = "status-message success";
    lookupMessage.textContent = "Latest record fetched successfully.";
  } catch (error) {
    lookupMessage.className = "status-message error";
    lookupMessage.textContent = `Lookup failed: ${error.message}`;
  }
});

document.getElementById("sampleFillBtn").addEventListener("click", () => {
  document.getElementById("pan").value = "AFYPB8217M";
  document.getElementById("assessmentYear").value = "2025-26";
});

loadDatasetMeta();
