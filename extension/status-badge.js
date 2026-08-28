(() => {
  if (document.getElementById("livesignal-status-badge")) return;
  const badge = document.createElement("button");
  badge.id = "livesignal-status-badge";
  badge.type = "button";
  badge.textContent = "● LiveSignal active";
  badge.title = "LiveSignal can share player state with WebMCP agents on this page.";
  Object.assign(badge.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
    border: "1px solid #101010", borderRadius: "999px", padding: "9px 12px",
    background: "#d8ff45", color: "#101010", font: "700 12px Arial, sans-serif", cursor: "pointer",
    boxShadow: "3px 3px 0 #101010"
  });
  badge.addEventListener("click", () => {
    window.postMessage({ source: "livesignal", type: "request-state" }, location.origin);
    badge.textContent = "● Player state shared";
    window.setTimeout(() => { badge.textContent = "● LiveSignal active"; }, 1800);
  });
  document.documentElement.append(badge);
})();
