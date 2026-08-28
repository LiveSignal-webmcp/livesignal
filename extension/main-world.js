(() => {
  if (window.__liveSignalAdapterInstalled) return;
  window.__liveSignalAdapterInstalled = true;
  document.documentElement.dataset.livesignalAdapter = "active";

  const MAX_TRANSCRIPT_SEGMENTS = 300;
  const watchRules = new Set();
  const events = [];
  const seenMatches = new Set();

  const getVideo = () => document.querySelector("video");
  const isYouTube = () => location.hostname.includes("youtube.com");
  const round = (value) => Math.round(value * 10) / 10;
  const parseTimestamp = (value) => {
    const parts = String(value || "").trim().split(":").map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const transcriptSegments = () => {
    if (!isYouTube()) return [];
    return Array.from(document.querySelectorAll("ytd-transcript-segment-renderer, transcript-segment-view-model"))
      .map((node, index) => {
        const timestamp = node.querySelector("#timestamp, .segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp")?.textContent?.trim() || "";
        const text = node.querySelector(".segment-text, yt-formatted-string.segment-text, [role='text'], .ytAttributedStringHost")?.textContent?.trim() || "";
        const seconds = parseTimestamp(timestamp);
        if (!text || seconds === null) return null;
        return { id: `transcript-${index}-${seconds}`, timestamp, seconds, text };
      })
      .filter(Boolean)
      .slice(-MAX_TRANSCRIPT_SEGMENTS);
  };

  const transcriptAvailability = () => {
    const segments = transcriptSegments();
    return {
      available: segments.length > 0,
      segmentCount: segments.length,
      guidance: segments.length
        ? "Transcript evidence is available from the YouTube transcript panel."
        : "Open YouTube's transcript panel for this video or replay, then try again. LiveSignal only indexes transcript text that YouTube makes visible on the page."
    };
  };

  const getState = () => {
    const video = getVideo();
    return {
      platform: isYouTube() ? "YouTube" : "Twitch",
      title: document.title.replace(/\s+-\s+(YouTube|Twitch)$/, ""),
      url: location.href,
      playable: Boolean(video),
      seekable: Boolean(video?.seekable?.length),
      currentTime: video ? round(video.currentTime) : null,
      duration: video && Number.isFinite(video.duration) ? round(video.duration) : null,
      paused: video?.paused ?? null,
      transcript: transcriptAvailability()
    };
  };

  const publish = () => window.postMessage({ source: "livesignal", type: "state", payload: getState() }, location.origin);
  const seek = (seconds) => {
    const video = getVideo();
    if (!video) return { ok: false, error: "No HTML video element is available on this page." };
    const requested = Number(seconds);
    if (!Number.isFinite(requested)) return { ok: false, error: "The requested timestamp must be a number." };
    const range = video.seekable;
    const target = range?.length
      ? Math.max(range.start(0), Math.min(requested, range.end(range.length - 1)))
      : Math.max(0, Math.min(requested, Number.isFinite(video.duration) ? video.duration : requested));
    video.currentTime = target;
    publish();
    return { ok: true, timestamp: target };
  };

  const createEventsFromTranscript = () => {
    if (!watchRules.size) return;
    transcriptSegments().forEach((segment) => {
      const haystack = segment.text.toLowerCase();
      watchRules.forEach((topic) => {
        if (!haystack.includes(topic.toLowerCase())) return;
        const key = `${segment.id}:${topic.toLowerCase()}`;
        if (seenMatches.has(key)) return;
        seenMatches.add(key);
        events.unshift({
          id: `event-${key}`,
          type: "topic_mention",
          topic,
          timestamp: segment.timestamp,
          seconds: segment.seconds,
          title: `${topic} mentioned`,
          evidence: segment.text,
          transcriptSegmentId: segment.id,
          detectedAt: new Date().toISOString()
        });
        showToast(`${topic} mentioned at ${segment.timestamp}`);
      });
    });
  };

  const showToast = (message) => {
    const existing = document.getElementById("livesignal-signal-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "livesignal-signal-toast";
    toast.textContent = `LiveSignal: ${message}`;
    Object.assign(toast.style, {
      position: "fixed", right: "16px", bottom: "62px", zIndex: "2147483647",
      maxWidth: "300px", padding: "10px 12px", border: "1px solid #101010", borderRadius: "6px",
      background: "#f0edff", color: "#101010", font: "700 12px Arial, sans-serif", boxShadow: "3px 3px 0 #101010"
    });
    document.documentElement.append(toast);
    window.setTimeout(() => toast.remove(), 6000);
  };

  const searchTranscript = (query) => {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) return { query: "", matches: [], ...transcriptAvailability() };
    const matches = transcriptSegments()
      .filter((segment) => segment.text.toLowerCase().includes(normalized))
      .map((segment) => ({ ...segment, eventId: `transcript-event-${segment.id}`, type: "transcript_match" }));
    return { query: String(query), matches, ...transcriptAvailability() };
  };

  const jumpToEvent = (eventId) => {
    const event = events.find((item) => item.id === eventId);
    if (event) return { ...seek(event.seconds), event };
    const segment = transcriptSegments().find((item) => `transcript-event-${item.id}` === eventId || item.id === eventId);
    if (!segment) return { ok: false, error: "Unknown event id. Ask search_stream or get_recent_events for available ids." };
    return { ...seek(segment.seconds), event: { id: `transcript-event-${segment.id}`, timestamp: segment.timestamp, evidence: segment.text } };
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "livesignal" || event.data?.type !== "request-state") return;
    publish();
  });

  const scanTimer = window.setInterval(() => {
    createEventsFromTranscript();
    publish();
  }, 2500);
  window.addEventListener("pagehide", () => window.clearInterval(scanTimer), { once: true });

  const context = document.modelContext;
  document.documentElement.dataset.livesignalWebmcp = context ? "available" : "unavailable";
  window.postMessage({ source: "livesignal", type: "adapter-status", payload: { adapter: "active", webmcp: Boolean(context) } }, location.origin);
  if (!context) {
    publish();
    return;
  }

  const register = (tool) => context.registerTool(tool).catch(() => undefined);
  register({
    name: "get_current_stream_state",
    description: "Returns normalized player state for the active YouTube or Twitch page, including whether transcript evidence is currently available.",
    execute: () => getState()
  });
  register({
    name: "get_transcript",
    description: "Returns visible timestamped transcript evidence from a YouTube video or live replay. If it is unavailable, explains how to enable the transcript panel.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "Maximum number of most recent transcript segments to return (default 80, maximum 300)." } }
    },
    execute: ({ limit = 80 } = {}) => {
      const safeLimit = Math.max(1, Math.min(Number(limit) || 80, MAX_TRANSCRIPT_SEGMENTS));
      const segments = transcriptSegments();
      return { ...transcriptAvailability(), segments: segments.slice(-safeLimit) };
    }
  });
  register({
    name: "search_stream",
    description: "Searches visible YouTube transcript evidence for a topic or phrase and returns timestamped matches that can be opened in the player.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Topic, person, or phrase to find in the active stream transcript." } },
      required: ["query"]
    },
    execute: ({ query }) => searchTranscript(query)
  });
  register({
    name: "get_recent_events",
    description: "Returns timestamped LiveSignal events created when active watch rules match transcript evidence.",
    execute: () => {
      createEventsFromTranscript();
      return { events, activeWatchRules: Array.from(watchRules), ...transcriptAvailability() };
    }
  });
  register({
    name: "create_watch_rule",
    description: "Creates an in-page rule that monitors visible and newly rendered YouTube transcript evidence for a topic. The rule lasts until this tab is refreshed or closed.",
    inputSchema: {
      type: "object",
      properties: { topic: { type: "string", description: "Case-insensitive word or phrase to monitor in transcript evidence." } },
      required: ["topic"]
    },
    execute: ({ topic }) => {
      const normalized = String(topic || "").trim();
      if (!normalized) return { ok: false, error: "A topic is required." };
      watchRules.add(normalized);
      createEventsFromTranscript();
      return { ok: true, topic: normalized, status: "active", scope: "this browser tab until refresh" };
    }
  });
  register({
    name: "get_active_watch_rules",
    description: "Returns active LiveSignal transcript watch rules for this browser tab.",
    execute: () => ({ rules: Array.from(watchRules), scope: "this browser tab until refresh" })
  });
  register({
    name: "jump_to_timestamp",
    description: "Seeks the visible player to a timestamp when the stream exposes a DVR or VOD window.",
    inputSchema: {
      type: "object",
      properties: { seconds: { type: "number", description: "Target position in seconds from the start of the available playback window." } },
      required: ["seconds"]
    },
    execute: ({ seconds }) => seek(seconds)
  });
  register({
    name: "jump_to_event",
    description: "Seeks the visible player to a timestamped transcript match or LiveSignal event returned by search_stream or get_recent_events.",
    inputSchema: {
      type: "object",
      properties: { eventId: { type: "string", description: "Event or transcript-match id returned by LiveSignal." } },
      required: ["eventId"]
    },
    execute: ({ eventId }) => jumpToEvent(String(eventId || ""))
  });
  publish();
})();
