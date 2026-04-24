const COMPANION_URL = "https://tanoojreddy1801-rgb.github.io/refund-status/";

const extractButton = document.getElementById("extractBtn");
const assessmentYearSelect = document.getElementById("assessmentYear");
const resultBox = document.getElementById("result");

function updateResult(message, isError = false) {
  resultBox.textContent = message;
  resultBox.className = isError ? "result error" : "result";
}

function buildCompanionUrl(payload) {
  const url = new URL(COMPANION_URL);
  url.searchParams.set("pan", payload.pan);
  url.searchParams.set("ay", payload.assessmentYear);
  url.searchParams.set("status", payload.statusKey);
  url.searchParams.set("date", payload.lastUpdatedIso);
  return url.toString();
}

extractButton.addEventListener("click", async () => {
  const assessmentYear = assessmentYearSelect.value;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    updateResult("No active tab found.", true);
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_REFUND_STATUS",
      assessmentYear
    });

    if (!response || !response.ok) {
      updateResult(response?.error || "Could not extract status from this page.", true);
      return;
    }

    const url = buildCompanionUrl(response.data);
    updateResult(
      `PAN: ${response.data.pan}
AY: ${response.data.assessmentYear}
Status: ${response.data.statusLabel}
Updated: ${response.data.lastUpdatedDisplay}

Opening companion webpage...`
    );

    await chrome.tabs.create({ url });
  } catch (error) {
    updateResult(`Extraction failed: ${error.message}`, true);
  }
});
