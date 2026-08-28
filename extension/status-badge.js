(() => {
  if (document.getElementById("livesignal-status-badge")) return;
  const badge = document.createElement("button");
  badge.id = "livesignal-status-badge";
  badge.type = "button";
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
    badge.textContent = "● LiveSignal active";
    badge.title = "LiveSignal can share player state and visible YouTube transcript evidence with WebMCP agents on this page.";
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
    badge.textContent = "● Stream state shared";
    window.setTimeout(renderStatus, 1800);
  });
  window.addEventListener("message", (event) => {
    if (event.source === window && event.data?.source === "livesignal" && event.data?.type === "adapter-status") renderStatus();
  });
  document.documentElement.append(badge);
})();
