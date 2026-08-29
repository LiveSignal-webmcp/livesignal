/* global chrome */
(() => {
  window.addEventListener("message", (event) => {
    if (
      event.source !== window ||
      event.data?.source !== "livesignal-companion" ||
      event.data?.type !== "REQUEST_EXTENSION_EVIDENCE"
    )
      return;
    const requestId = event.data.requestId;
    chrome.runtime
      .sendMessage({ type: "GET_LATEST_EVIDENCE_SNAPSHOT" })
      .then((snapshot) =>
        window.postMessage(
          {
            source: "livesignal-extension",
            type: "EXTENSION_EVIDENCE_RESPONSE",
            requestId,
            snapshot,
          },
          location.origin,
        ),
      )
      .catch((error) =>
        window.postMessage(
          {
            source: "livesignal-extension",
            type: "EXTENSION_EVIDENCE_RESPONSE",
            requestId,
            error: String(error?.message || error),
          },
          location.origin,
        ),
      );
  });
  document.documentElement.dataset.livesignalCompanionBridge = "ready";
})();
