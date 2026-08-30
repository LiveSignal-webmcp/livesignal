/* global chrome */

(() => {
  if (document.getElementById("livesignal-status-badge")) return;
  const badge = document.createElement("button");
  badge.id = "livesignal-status-badge";
  badge.type = "button";
  let transcriptionState = {
    status: "idle",
    segments: [],
    partial: "",
    error: null,
  };
  let lastAdShowing = null;
  let lastEvidenceSignature = "";
  const renderStatus = () => {
    const webmcp = document.documentElement.dataset.livesignalWebmcp;
    const adapter = document.documentElement.dataset.livesignalAdapter;
    if (adapter !== "active") {
      badge.textContent = "● LiveSignal bridge unavailable";
      badge.title =
        "The LiveSignal browser badge loaded, but its page adapter did not. Reload the extension and this page.";
      return;
    }
    if (transcriptionState.status === "connecting") {
      badge.textContent = "● LiveSignal · connecting audio";
      badge.title =
        "LiveSignal is connecting this tab to ElevenLabs Scribe realtime transcription.";
      return;
    }
    if (transcriptionState.status === "listening") {
      badge.textContent = transcriptionState.partial
        ? `● Listening · ${transcriptionState.partial.slice(0, 42)}`
        : `● LiveSignal listening · ${transcriptionState.segments.length} segments`;
      badge.title =
        "Realtime evidence is available to WebMCP and the Codex browser-control bridge.";
      return;
    }
    if (transcriptionState.status === "error") {
      badge.textContent = "● LiveSignal · listening error";
      badge.title =
        transcriptionState.error ||
        "Realtime transcription failed. Click the LiveSignal toolbar icon to retry.";
      return;
    }
    if (webmcp === "registering") {
      badge.textContent = "● LiveSignal · registering tools";
      badge.title =
        "The LiveSignal adapter found WebMCP and is registering its semantic livestream tools.";
      return;
    }
    if (webmcp === "error") {
      badge.textContent = "● LiveSignal · browser bridge ready";
      badge.title =
        "The browser-agent bridge is ready, but one or more WebMCP tools could not register.";
      return;
    }
    if (webmcp !== "registered") {
      badge.textContent = "● LiveSignal · agent bridge ready";
      badge.title =
        "A browser agent can use LiveSignal now. Enable WebMCP for native semantic tool discovery.";
      return;
    }
    badge.textContent = "● LiveSignal active";
    badge.title =
      "LiveSignal can share stream evidence with WebMCP. Approve listening once for this tab, then agents can use it autonomously.";
  };
  renderStatus();
  Object.assign(badge.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    border: "1px solid #101010",
    borderRadius: "999px",
    padding: "9px 12px",
    background: "#d8ff45",
    color: "#101010",
    font: "700 12px Arial, sans-serif",
    cursor: "pointer",
    boxShadow: "3px 3px 0 #101010",
  });
  badge.addEventListener("click", () => {
    window.postMessage(
      { source: "livesignal", type: "request-state" },
      location.origin,
    );
    badge.textContent =
      transcriptionState.status === "listening"
        ? "● Realtime evidence shared"
        : "● Click toolbar icon to listen";
    window.setTimeout(renderStatus, 1800);
  });
  window.addEventListener("message", (event) => {
    if (
      event.source === window &&
      event.data?.source === "livesignal" &&
      event.data?.type === "adapter-status"
    )
      renderStatus();
  });
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "LIVESIGNAL_TRANSCRIPTION_STATE") return;
    transcriptionState = message.payload || transcriptionState;
    window.postMessage(
      {
        source: "livesignal",
        type: "live-transcription-state",
        payload: transcriptionState,
      },
      location.origin,
    );
    renderStatus();
  });
  chrome.runtime
    .sendMessage({ type: "GET_TRANSCRIPTION_STATE" })
    .then((state) => {
      if (!state) return;
      transcriptionState = state;
      window.postMessage(
        {
          source: "livesignal",
          type: "live-transcription-state",
          payload: state,
        },
        location.origin,
      );
      renderStatus();
    })
    .catch(() => {});
  const reportPlaybackContext = () => {
    const adShowing = Boolean(document.querySelector(".ad-showing"));
    if (adShowing === lastAdShowing) return;
    lastAdShowing = adShowing;
    void chrome.runtime.sendMessage({
      type: "LIVESIGNAL_PLAYBACK_CONTEXT",
      adShowing,
      streamUrl: location.href,
    });
  };
  reportPlaybackContext();
  const playbackTimer = window.setInterval(reportPlaybackContext, 500);
  const evidenceTimer = window.setInterval(() => {
    const output = document.getElementById("livesignal-agent-state");
    if (!output?.textContent) return;
    try {
      const snapshot = JSON.parse(output.textContent);
      const signature = `${snapshot.state?.url || ""}:${snapshot.recentTranscript?.length || 0}:${snapshot.recentTranscript?.at?.(-1)?.id || ""}`;
      if (signature === lastEvidenceSignature) return;
      lastEvidenceSignature = signature;
      void chrome.runtime.sendMessage({
        type: "LIVESIGNAL_EVIDENCE_SNAPSHOT",
        snapshot,
      });
    } catch {
      // The page snapshot may be between updates.
    }
  }, 1600);
  window.addEventListener(
    "pagehide",
    () => {
      window.clearInterval(playbackTimer);
      window.clearInterval(evidenceTimer);
    },
    { once: true },
  );
  document.documentElement.append(badge);
})();
