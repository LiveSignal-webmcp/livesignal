/* global chrome */

const OFFSCREEN_DOCUMENT = "offscreen.html";
const TOKEN_ENDPOINT = "https://livesignal-chi.vercel.app/api/elevenlabs-token";
const MAX_SEGMENTS = 300;

const tabStates = new Map();

const initialState = () => ({
  status: "idle",
  provider: "ElevenLabs Scribe v2 Realtime",
  partial: "",
  segments: [],
  error: null
});

const stateFor = (tabId) => {
  if (!tabStates.has(tabId)) tabStates.set(tabId, initialState());
  return tabStates.get(tabId);
};

const sendState = async (tabId) => {
  const state = stateFor(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "LIVESIGNAL_TRANSCRIPTION_STATE",
      payload: state
    });
  } catch {
    // The supported page may still be loading its content script.
  }
};

const ensureOffscreenDocument = async () => {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT,
    reasons: ["USER_MEDIA"],
    justification: "Capture user-approved tab audio for realtime livestream transcription."
  });
};

const stopTranscription = async (tabId) => {
  await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "STOP_TRANSCRIPTION",
    tabId
  });
  const state = stateFor(tabId);
  state.status = "idle";
  state.partial = "";
  state.error = null;
  await sendState(tabId);
};

const startTranscription = async (tab) => {
  if (!tab.id || !/^https:\/\/(www\.)?(youtube\.com|twitch\.tv)\//.test(tab.url || "")) {
    return;
  }

  const state = stateFor(tab.id);
  state.status = "connecting";
  state.error = null;
  await sendState(tab.id);

  try {
    await ensureOffscreenDocument();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "START_TRANSCRIPTION",
      tabId: tab.id,
      streamId,
      tokenEndpoint: TOKEN_ENDPOINT
    });
  } catch (error) {
    state.status = "error";
    state.error = String(error?.message || error);
    await sendState(tab.id);
  }
};

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const state = stateFor(tab.id);
  if (["connecting", "listening"].includes(state.status)) {
    await stopTranscription(tab.id);
  } else {
    await startTranscription(tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target === "offscreen") return false;

  if (message?.type === "GET_TRANSCRIPTION_STATE") {
    const tabId = sender.tab?.id;
    sendResponse(tabId ? stateFor(tabId) : initialState());
    return false;
  }

  if (message?.source !== "livesignal-offscreen" || !message.tabId) return false;

  const state = stateFor(message.tabId);
  if (message.type === "TRANSCRIPTION_STATUS") {
    state.status = message.status;
    state.error = message.error || null;
  }
  if (message.type === "TRANSCRIPT_PARTIAL") {
    state.partial = message.text || "";
  }
  if (message.type === "TRANSCRIPT_COMMITTED" && message.segment?.text) {
    state.partial = "";
    state.segments.push(message.segment);
    state.segments = state.segments.slice(-MAX_SEGMENTS);
  }
  void sendState(message.tabId);
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (["connecting", "listening"].includes(stateFor(tabId).status)) {
    void chrome.runtime.sendMessage({ target: "offscreen", type: "STOP_TRANSCRIPTION", tabId });
  }
  tabStates.delete(tabId);
});
