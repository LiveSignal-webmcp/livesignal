/* global chrome */

const statusElement = document.getElementById("status");
const toggleButton = document.getElementById("toggle");
let activeTabId = null;
let pollTimer = null;

const describe = (state) => {
  if (state.status === "connecting") return "Connecting tab audio to ElevenLabs Scribe…";
  if (state.status === "listening") {
    const count = state.segments?.length || 0;
    return state.partial ? `Hearing: ${state.partial}` : `Listening · ${count} committed segment${count === 1 ? "" : "s"}`;
  }
  if (state.status === "error") return state.error || "Realtime transcription failed.";
  return "Ready for one-time audio approval on this tab.";
};

const render = (state) => {
  statusElement.dataset.state = state.status || "idle";
  statusElement.textContent = describe(state);
  toggleButton.textContent = ["connecting", "listening"].includes(state.status)
    ? "Stop listening"
    : state.status === "error" ? "Retry listening" : "Enable for this tab";
  toggleButton.disabled = !activeTabId;
};

const readState = async () => {
  if (!activeTabId) return;
  const state = await chrome.runtime.sendMessage({ type: "GET_TRANSCRIPTION_STATE", tabId: activeTabId });
  render(state || { status: "idle", segments: [] });
};

const initialize = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id || null;
  if (!activeTabId || !/^https:\/\/(www\.)?(youtube\.com|twitch\.tv)\//.test(tab.url || "")) {
    render({ status: "error", error: "Open a YouTube or Twitch stream first.", segments: [] });
    toggleButton.disabled = true;
    return;
  }
  await readState();
  pollTimer = window.setInterval(() => void readState(), 500);
};

toggleButton.addEventListener("click", async () => {
  if (!activeTabId) return;
  toggleButton.disabled = true;
  statusElement.dataset.state = "connecting";
  statusElement.textContent = "Requesting tab audio…";
  const state = await chrome.runtime.sendMessage({ type: "TOGGLE_TRANSCRIPTION", tabId: activeTabId });
  render(state || { status: "error", error: "The extension worker did not respond.", segments: [] });
});

window.addEventListener("unload", () => window.clearInterval(pollTimer));
void initialize();
