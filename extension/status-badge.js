/* global chrome */

(() => {
  if (document.getElementById("livesignal-status-badge")) return;
  const badge = document.createElement("button");
  badge.id = "livesignal-status-badge";
  badge.type = "button";
  let transcriptionState = { status: "idle", segments: [], partial: "", error: null };
  const renderStatus = () => {
    const webmcp = document.documentElement.dataset.livesignalWebmcp;
    const adapter = document.documentElement.dataset.livesignalAdapter;
    if (adapter !== "active") {
      badge.textContent = "● LiveSignal bridge unavailable";
      badge.title = "The LiveSignal browser badge loaded, but its page adapter did not. Reload the extension and this page.";
      return;
    }
    if (webmcp === "registering") {
      badge.textContent = "● LiveSignal · registering tools";
      badge.title = "The LiveSignal adapter found WebMCP and is registering its semantic livestream tools.";
      return;
    }
    if (webmcp === "error") {
      badge.textContent = "● LiveSignal · tool registration failed";
      badge.title = "The page exposes WebMCP, but one or more LiveSignal tools could not register. Reload this page and inspect the extension source for details.";
      return;
    }
    if (webmcp !== "registered") {
      badge.textContent = "● LiveSignal · WebMCP unavailable";
      badge.title = "The page adapter is active, but this Chrome session does not expose document.modelContext. Enable WebMCP, then reload this page.";
      return;
    }
    if (transcriptionState.status === "connecting") {
      badge.textContent = "● LiveSignal · connecting audio";
      badge.title = "LiveSignal is connecting this tab to ElevenLabs Scribe realtime transcription.";
      return;
    }
    if (transcriptionState.status === "listening") {
      badge.textContent = transcriptionState.partial
        ? `● Listening · ${transcriptionState.partial.slice(0, 42)}`
        : `● LiveSignal listening · ${transcriptionState.segments.length} segments`;
      badge.title = "Realtime transcript evidence is being captured. Click the LiveSignal toolbar icon to stop.";
      return;
    }
    if (transcriptionState.status === "error") {
      badge.textContent = "● LiveSignal · listening error";
      badge.title = transcriptionState.error || "Realtime transcription failed. Click the LiveSignal toolbar icon to retry.";
      return;
    }
    badge.textContent = "● LiveSignal active";
    badge.title = "LiveSignal can share stream evidence with WebMCP. Approve listening once for this tab, then agents can use it autonomously.";
  };
  renderStatus();
  Object.assign(badge.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
    border: "1px solid #101010", borderRadius: "999px", padding: "9px 12px",
    background: "#d8ff45", color: "#101010", font: "700 12px Arial, sans-serif", cursor: "pointer",
    boxShadow: "3px 3px 0 #101010"
  });
  badge.addEventListener("click", () => {
    window.postMessage({ source: "livesignal", type: "request-state" }, location.origin);
    badge.textContent = transcriptionState.status === "listening"
      ? "● Realtime evidence shared"
      : "● Click toolbar icon to listen";
    window.setTimeout(renderStatus, 1800);
  });
  window.addEventListener("message", (event) => {
    if (event.source === window && event.data?.source === "livesignal" && event.data?.type === "adapter-status") renderStatus();
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "LIVESIGNAL_TRANSCRIPTION_STATE") return;
    transcriptionState = message.payload || transcriptionState;
    window.postMessage({
      source: "livesignal",
      type: "live-transcription-state",
      payload: transcriptionState
    }, location.origin);
    renderStatus();
  });
  chrome.runtime.sendMessage({ type: "GET_TRANSCRIPTION_STATE" }).then((state) => {
    if (!state) return;
    transcriptionState = state;
    window.postMessage({ source: "livesignal", type: "live-transcription-state", payload: state }, location.origin);
    renderStatus();
  }).catch(() => {});
  document.documentElement.append(badge);
})();
