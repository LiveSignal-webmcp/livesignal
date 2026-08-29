/* global chrome */

const OFFSCREEN_DOCUMENT = "offscreen.html";
const TOKEN_ENDPOINT = "https://livesignal-chi.vercel.app/api/elevenlabs-token";
const MAX_SEGMENTS = 300;

const tabStates = new Map();
let latestEvidenceSnapshot = null;

const initialState = () => ({
  status: "idle",
  provider: "ElevenLabs Scribe v2 Realtime",
  streamUrl: null,
  adShowing: false,
  adGraceUntil: 0,
  discardedAdSegments: 0,
  partial: "",
  segments: [],
  error: null,
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
      payload: state,
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
    justification:
      "Capture user-approved tab audio for realtime livestream transcription.",
  });
};

const stopTranscription = async (tabId) => {
  await chrome.runtime.sendMessage({
    target: "offscreen",
    type: "STOP_TRANSCRIPTION",
    tabId,
  });
  const state = stateFor(tabId);
  state.status = "idle";
  state.partial = "";
  state.error = null;
  await sendState(tabId);
};

const startTranscription = async (tab) => {
  if (!tab.id) return;

  const state = stateFor(tab.id);
  state.status = "connecting";
  state.streamUrl = tab.url || state.streamUrl;
  state.adShowing = false;
  state.adGraceUntil = 0;
  state.discardedAdSegments = 0;
  state.segments = [];
  state.partial = "";
  state.error = null;
  await sendState(tab.id);

  try {
    await ensureOffscreenDocument();
    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id,
    });
    await chrome.runtime.sendMessage({
      target: "offscreen",
      type: "START_TRANSCRIPTION",
      tabId: tab.id,
      streamId,
      tokenEndpoint: TOKEN_ENDPOINT,
    });
  } catch (error) {
    state.status = "error";
    state.error = String(error?.message || error);
    await sendState(tab.id);
  }
};

const toggleTranscription = async (tab) => {
  if (!tab?.id) return initialState();
  const state = stateFor(tab.id);
  if (["connecting", "listening"].includes(state.status)) {
    await stopTranscription(tab.id);
  } else {
    await startTranscription(tab);
  }
  return stateFor(tab.id);
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target === "offscreen") return false;

  if (message?.type === "GET_TRANSCRIPTION_STATE") {
    const tabId = message.tabId || sender.tab?.id;
    sendResponse(tabId ? stateFor(tabId) : initialState());
    return false;
  }

  if (message?.type === "LIVESIGNAL_EVIDENCE_SNAPSHOT" && message.snapshot) {
    latestEvidenceSnapshot = {
      ...message.snapshot,
      sourceTabId: sender.tab?.id ?? null,
      capturedAt: new Date().toISOString(),
    };
    void chrome.storage.local.set({ latestEvidenceSnapshot });
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "GET_LATEST_EVIDENCE_SNAPSHOT") {
    if (latestEvidenceSnapshot) {
      sendResponse(latestEvidenceSnapshot);
      return false;
    }
    chrome.storage.local
      .get("latestEvidenceSnapshot")
      .then((stored) => sendResponse(stored.latestEvidenceSnapshot || null))
      .catch(() => sendResponse(null));
    return true;
  }

  if (message?.type === "TOGGLE_TRANSCRIPTION" && message.tabId) {
    chrome.tabs
      .get(message.tabId)
      .then((tab) => toggleTranscription(tab))
      .then(sendResponse)
      .catch((error) =>
        sendResponse({
          ...initialState(),
          status: "error",
          error: String(error?.message || error),
        }),
      );
    return true;
  }

  if (message?.type === "LIVESIGNAL_PLAYBACK_CONTEXT") {
    const tabId = sender.tab?.id;
    if (!tabId) return false;
    const state = stateFor(tabId);
    const nextAdShowing = Boolean(message.adShowing);
    if (state.adShowing && !nextAdShowing)
      state.adGraceUntil = Date.now() + 2000;
    state.adShowing = nextAdShowing;
    if (message.streamUrl) state.streamUrl = message.streamUrl;
    if (state.adShowing) state.partial = "";
    return false;
  }

  if (message?.source !== "livesignal-offscreen" || !message.tabId)
    return false;

  const state = stateFor(message.tabId);
  if (message.type === "TRANSCRIPTION_STATUS") {
    state.status = message.status;
    state.error = message.error || null;
  }
  if (message.type === "TRANSCRIPT_PARTIAL") {
    state.status = "listening";
    state.partial =
      state.adShowing || Date.now() < state.adGraceUntil
        ? ""
        : message.text || "";
  }
  if (message.type === "TRANSCRIPT_COMMITTED" && message.segment?.text) {
    state.status = "listening";
    state.partial = "";
    if (state.adShowing || Date.now() < state.adGraceUntil) {
      state.discardedAdSegments += 1;
    } else {
      state.segments.push({ ...message.segment, streamUrl: state.streamUrl });
    }
    state.segments = state.segments.slice(-MAX_SEGMENTS);
  }
  void sendState(message.tabId);
  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url || !tabStates.has(tabId)) return;
  const state = stateFor(tabId);
  if (state.streamUrl === changeInfo.url) return;
  state.streamUrl = changeInfo.url || tab.url || null;
  state.adShowing = false;
  state.adGraceUntil = 0;
  state.discardedAdSegments = 0;
  state.partial = "";
  state.segments = [];
  void sendState(tabId);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (["connecting", "listening"].includes(stateFor(tabId).status)) {
    void chrome.runtime.sendMessage({
      target: "offscreen",
      type: "STOP_TRANSCRIPTION",
      tabId,
    });
  }
  tabStates.delete(tabId);
});
