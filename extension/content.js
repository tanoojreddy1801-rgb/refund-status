const STATUS_PATTERNS = [
  { key: "refund-hold", label: "Refund kept on hold", pattern: /refund\s+is\s+kept\s+on\s+hold/i },
  { key: "processed-refund", label: "Processed with refund due", pattern: /processed\s+with\s+refund\s+due/i },
  { key: "verified", label: "Successfully e-verified", pattern: /successfully\s+e-verified/i },
  { key: "processing", label: "Under processing", pattern: /under\s+processing/i }
];

function normalizeSpaces(value) {
  return value.replace(/\s+/g, " ").trim();
}

function findPan() {
  const bodyText = normalizeSpaces(document.body.innerText || "");
  const match = bodyText.match(/\b[A-Z]{5}[0-9]{4}[A-Z]\b/);
  return match ? match[0] : "";
}

function parseStatusKey(text) {
  const normalized = normalizeSpaces(text);
  const match = STATUS_PATTERNS.find((item) => item.pattern.test(normalized));
  return match || null;
}

function toIsoDate(text) {
  const cleaned = normalizeSpaces(text).replace(/,/g, "");
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function extractLatestDateFromText(text) {
  const dateRegex = /\b\d{1,2}\s+[A-Za-z]{3,9}\s*,?\s+\d{4}\b/g;
  const matches = text.match(dateRegex) || [];
  if (!matches.length) {
    return { display: "", iso: "" };
  }

  const last = matches[0];
  return {
    display: last,
    iso: toIsoDate(last)
  };
}

function cardMatchesAssessmentYear(cardText, assessmentYear) {
  return normalizeSpaces(cardText).includes(`A.Y. ${assessmentYear}`) ||
    normalizeSpaces(cardText).includes(`AY ${assessmentYear}`);
}

function extractFromCards(assessmentYear) {
  const allCandidates = Array.from(document.querySelectorAll("div, section, article, mat-card, li"));
  const matchingCard = allCandidates.find((element) => {
    const text = normalizeSpaces(element.innerText || "");
    return text && cardMatchesAssessmentYear(text, assessmentYear);
  });

  if (!matchingCard) {
    return null;
  }

  const text = normalizeSpaces(matchingCard.innerText || "");
  const matchedStatus = parseStatusKey(text);
  const dateInfo = extractLatestDateFromText(text);

  if (!matchedStatus || !dateInfo.iso) {
    return null;
  }

  return {
    statusKey: matchedStatus.key,
    statusLabel: matchedStatus.label,
    lastUpdatedDisplay: dateInfo.display,
    lastUpdatedIso: dateInfo.iso
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "EXTRACT_REFUND_STATUS") {
    return;
  }

  const currentUrl = window.location.href;
  if (!currentUrl.includes("eportal.incometax.gov.in")) {
    sendResponse({
      ok: false,
      error: "Open the official Income Tax portal before running extraction."
    });
    return;
  }

  const pan = findPan();
  const extracted = extractFromCards(message.assessmentYear);

  if (!pan) {
    sendResponse({
      ok: false,
      error: "PAN could not be found on the current page."
    });
    return;
  }

  if (!extracted) {
    sendResponse({
      ok: false,
      error: "Could not find the selected assessment year card or extract a status/date from it."
    });
    return;
  }

  sendResponse({
    ok: true,
    data: {
      pan,
      assessmentYear: message.assessmentYear,
      statusKey: extracted.statusKey,
      statusLabel: extracted.statusLabel,
      lastUpdatedDisplay: extracted.lastUpdatedDisplay,
      lastUpdatedIso: extracted.lastUpdatedIso
    }
  });
});
