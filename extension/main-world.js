(() => {
  if (window.__liveSignalAdapterInstalled) return;
  window.__liveSignalAdapterInstalled = true;
  document.documentElement.dataset.livesignalAdapter = "active";

  const MAX_TRANSCRIPT_SEGMENTS = 300;
  const watchRules = new Set();
  const events = [];
  const seenMatches = new Set();
  const liveSegmentMap = new Map();
  const ignoredLiveSegmentIds = new Set();
  let activeStreamKey = null;
  let liveTranscription = {
    status: "idle",
    provider: "ElevenLabs Scribe v2 Realtime",
    partial: "",
    adShowing: false,
    discardedAdSegments: 0,
    error: null
  };

  const getVideo = () => document.querySelector("video");
  const isYouTube = () => location.hostname.includes("youtube.com");
  const streamKeyFor = (urlValue = location.href) => {
    try {
      const url = new URL(urlValue, location.href);
      if (url.hostname.includes("youtube.com")) {
        return `youtube:${url.searchParams.get("v") || url.pathname}`;
      }
      return `twitch:${url.pathname.split("/").filter(Boolean).slice(0, 2).join("/")}`;
    } catch {
      return String(urlValue);
    }
  };
  activeStreamKey = streamKeyFor();
  const round = (value) => Math.round(value * 10) / 10;
  const formatTimestamp = (totalSeconds) => {
    const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  };
  const parseTimestamp = (value) => {
    const parts = String(value || "").trim().split(":").map(Number);
    if (!parts.length || parts.some((part) => !Number.isFinite(part))) return null;
    return parts.reduce((total, part) => total * 60 + part, 0);
  };

  const nativeTranscriptSegments = () => {
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

  const transcriptSegments = () => [
    ...nativeTranscriptSegments(),
    ...Array.from(liveSegmentMap.values())
  ]
    .sort((a, b) => (a.seconds ?? 0) - (b.seconds ?? 0))
    .slice(-MAX_TRANSCRIPT_SEGMENTS);

  const transcriptAvailability = () => {
    const segments = transcriptSegments();
    const nativeCount = nativeTranscriptSegments().length;
    const liveCount = liveSegmentMap.size;
    return {
      available: segments.length > 0,
      segmentCount: segments.length,
      nativeSegmentCount: nativeCount,
      liveSegmentCount: liveCount,
      source: liveCount ? "realtime_stt" : nativeCount ? "youtube_transcript" : "none",
      guidance: segments.length
        ? liveCount
          ? "Realtime transcript evidence is available from ElevenLabs Scribe."
          : "Transcript evidence is available from the YouTube transcript panel."
        : liveTranscription.status === "listening"
          ? "LiveSignal is listening; wait for the first committed speech segment."
          : "Open YouTube's transcript panel, or approve LiveSignal listening once for this tab. After approval, realtime evidence remains available across stream navigation in this tab."
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
      agentBridge: {
        status: "ready",
        version: "1.0",
        transport: document.modelContext ? "webmcp+page_bridge" : "page_bridge"
      },
      liveTranscription: {
        status: liveTranscription.status,
        provider: liveTranscription.provider,
        partial: liveTranscription.partial,
        adShowing: liveTranscription.adShowing,
        discardedAdSegments: liveTranscription.discardedAdSegments,
        segmentCount: liveSegmentMap.size,
        error: liveTranscription.error
      },
      transcript: transcriptAvailability()
    };
  };

  const resetEvidenceForNavigation = () => {
    const nextStreamKey = streamKeyFor();
    if (nextStreamKey === activeStreamKey) return false;
    activeStreamKey = nextStreamKey;
    liveSegmentMap.clear();
    ignoredLiveSegmentIds.clear();
    events.splice(0, events.length);
    seenMatches.clear();
    return true;
  };

  const updateAgentSnapshot = (state) => {
    let snapshot = document.getElementById("livesignal-agent-state");
    if (!snapshot) {
      snapshot = document.createElement("output");
      snapshot.id = "livesignal-agent-state";
      snapshot.setAttribute("aria-label", "LiveSignal agent evidence");
      Object.assign(snapshot.style, {
        position: "fixed",
        left: "-10000px",
        top: "0",
        width: "1px",
        height: "1px",
        overflow: "hidden",
        whiteSpace: "pre-wrap"
      });
      document.documentElement.append(snapshot);
    }
    snapshot.textContent = JSON.stringify({
      version: "1.0",
      state,
      recentTranscript: transcriptSegments().slice(-80),
      events: events.slice(0, 80),
      activeWatchRules: Array.from(watchRules)
    });
    document.documentElement.dataset.livesignalAgent = "ready";
    document.documentElement.dataset.livesignalSegmentCount = String(state.transcript.segmentCount);
    document.documentElement.dataset.livesignalStreamKey = activeStreamKey;
  };

  const publish = () => {
    resetEvidenceForNavigation();
    const state = getState();
    updateAgentSnapshot(state);
    window.postMessage({ source: "livesignal", type: "state", payload: state }, location.origin);
  };
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

  const rankLivestreamResults = ({ query = "", limit = 10 } = {}) => {
    const pageQuery = new URL(location.href).searchParams.get("search_query") || "";
    const requestedQuery = String(query || pageQuery).replace(/\blive\b/gi, " ").trim();
    const topicTokens = requestedQuery.toLowerCase().split(/\s+/).filter((token) => token.length > 2);
    const cards = Array.from(document.querySelectorAll("ytd-video-renderer"));
    const results = cards.map((card) => {
      const titleNode = card.querySelector("#video-title");
      const title = titleNode?.textContent?.trim() || "";
      const url = titleNode?.href || "";
      const channel = card.querySelector("#channel-name")?.textContent?.trim().replace(/\s+/g, " ") || "";
      const badges = Array.from(card.querySelectorAll("ytd-badge-supported-renderer, .badge-shape-wiz__text"))
        .map((node) => node.textContent?.trim()).filter(Boolean);
      const metadata = Array.from(card.querySelectorAll("#metadata-line span"))
        .map((node) => node.textContent?.trim()).filter(Boolean);
      const normalizedTitle = title.toLowerCase();
      const matchedTokens = topicTokens.filter((token) => normalizedTitle.includes(token));
      const isLive = badges.some((badge) => badge.toUpperCase().includes("LIVE"));
      const automatedSignals = /24\/7|signal|scalping|heatmap|order book|\bm1\b|\bm5\b|monitor|no delay/i.test(title);
      const commentarySignals = /analysis|news|update|discussion|market heading|live trading|breakout|prediction/i.test(title);
      const exactTopicMatch = Boolean(requestedQuery) && normalizedTitle.includes(requestedQuery.toLowerCase());
      const topicCoverage = topicTokens.length ? matchedTokens.length / topicTokens.length : 0;
      const score = (isLive ? 4 : 0) + (exactTopicMatch ? 5 : topicCoverage * 4) + (commentarySignals ? 2 : 0) - (automatedSignals ? 3 : 0);
      return {
        title,
        url,
        channel,
        badges,
        metadata,
        isLive,
        topicMatch: exactTopicMatch ? "exact_title" : topicCoverage ? "partial_title" : "none",
        likelyFormat: automatedSignals ? "automated_chart_or_signals" : commentarySignals ? "spoken_commentary_likely" : "unknown",
        score: round(score)
      };
    })
      .filter((result) => result.title && result.url && result.isLive)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, Math.min(Number(limit) || 10, 25)));
    return {
      query: requestedQuery,
      pageUrl: location.href,
      results,
      guidance: "Open a high-topic-match result, then verify the actual spoken topic with get_transcript before answering. Titles and format labels are discovery signals, not transcript evidence."
    };
  };

  const getTranscript = ({ limit = 80 } = {}) => {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 80, MAX_TRANSCRIPT_SEGMENTS));
    const segments = transcriptSegments();
    return { ...transcriptAvailability(), segments: segments.slice(-safeLimit) };
  };

  const getRecentEvents = () => {
    createEventsFromTranscript();
    return { events, activeWatchRules: Array.from(watchRules), ...transcriptAvailability() };
  };

  const createWatchRule = ({ topic } = {}) => {
    const normalized = String(topic || "").trim();
    if (!normalized) return { ok: false, error: "A topic is required." };
    watchRules.add(normalized);
    createEventsFromTranscript();
    publish();
    return { ok: true, topic: normalized, status: "active", scope: "this browser page" };
  };

  const toolDefinitions = [
    {
      name: "rank_livestream_results",
      description: "Ranks visible YouTube Live search results by topic match and likely spoken commentary. Use the ranking only for discovery, then verify the selected stream with transcript evidence.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Topic the user wants a livestream about." },
          limit: { type: "number", description: "Maximum ranked live results to return (default 10, maximum 25)." }
        }
      },
      execute: rankLivestreamResults
    },
    {
      name: "get_current_stream_state",
      description: "Returns normalized player state for the active YouTube or Twitch page, including native transcript and realtime listening status.",
      execute: () => getState()
    },
    {
      name: "get_transcript",
      description: "Returns timestamped transcript evidence from a visible YouTube transcript or LiveSignal's realtime ElevenLabs transcription. If neither is available, explains how to enable listening.",
      inputSchema: {
        type: "object",
        properties: { limit: { type: "number", description: "Maximum number of most recent transcript segments to return (default 80, maximum 300)." } }
      },
      execute: getTranscript
    },
    {
      name: "search_stream",
      description: "Searches native or realtime livestream transcript evidence for a topic or phrase and returns timestamped matches that can be opened in the player.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Topic, person, or phrase to find in the active stream transcript." } },
        required: ["query"]
      },
      execute: ({ query } = {}) => searchTranscript(query)
    },
    {
      name: "get_recent_events",
      description: "Returns timestamped LiveSignal events created when active watch rules match transcript evidence.",
      execute: getRecentEvents
    },
    {
      name: "create_watch_rule",
      description: "Creates an in-page rule that monitors native and realtime transcript evidence for a topic. The rule lasts until this page is refreshed or closed.",
      inputSchema: {
        type: "object",
        properties: { topic: { type: "string", description: "Case-insensitive word or phrase to monitor in transcript evidence." } },
        required: ["topic"]
      },
      execute: createWatchRule
    },
    {
      name: "get_active_watch_rules",
      description: "Returns active LiveSignal transcript watch rules for this browser page.",
      execute: () => ({ rules: Array.from(watchRules), scope: "this browser page" })
    },
    {
      name: "jump_to_timestamp",
      description: "Seeks the visible player to a timestamp when the stream exposes a DVR or VOD window.",
      inputSchema: {
        type: "object",
        properties: { seconds: { type: "number", description: "Target position in seconds from the start of the available playback window." } },
        required: ["seconds"]
      },
      execute: ({ seconds } = {}) => seek(seconds)
    },
    {
      name: "jump_to_event",
      description: "Seeks the visible player to a timestamped transcript match or LiveSignal event returned by search_stream or get_recent_events.",
      inputSchema: {
        type: "object",
        properties: { eventId: { type: "string", description: "Event or transcript-match id returned by LiveSignal." } },
        required: ["eventId"]
      },
      execute: ({ eventId } = {}) => jumpToEvent(String(eventId || ""))
    }
  ];

  const toolHandlers = new Map(toolDefinitions.map((tool) => [tool.name, tool.execute]));
  const callAgentTool = async (name, input = {}) => {
    resetEvidenceForNavigation();
    const handler = toolHandlers.get(String(name || ""));
    if (!handler) {
      return { ok: false, error: `Unknown LiveSignal tool: ${String(name || "")}`, availableTools: Array.from(toolHandlers.keys()) };
    }
    return handler(input || {});
  };

  Object.defineProperty(window, "LiveSignalAgent", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      version: "1.0",
      listTools: () => Array.from(toolHandlers.keys()),
      getSnapshot: () => JSON.parse(document.getElementById("livesignal-agent-state")?.textContent || "{}"),
      call: callAgentTool
    })
  });
  document.documentElement.dataset.livesignalAgent = "ready";

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "livesignal") return;
    if (event.data?.type === "request-state") {
      publish();
      return;
    }
    if (event.data?.type !== "live-transcription-state") return;

    const payload = event.data.payload || {};
    resetEvidenceForNavigation();
    liveTranscription = {
      status: payload.status || "idle",
      provider: payload.provider || "ElevenLabs Scribe v2 Realtime",
      partial: payload.partial || "",
      adShowing: Boolean(payload.adShowing),
      discardedAdSegments: Number(payload.discardedAdSegments) || 0,
      error: payload.error || null
    };
    document.documentElement.dataset.livesignalTranscription = liveTranscription.status;

    (payload.segments || []).forEach((segment) => {
      if (!segment?.id || !segment.text) return;
      if (liveTranscription.adShowing) {
        ignoredLiveSegmentIds.add(segment.id);
        return;
      }
      if (ignoredLiveSegmentIds.has(segment.id)) return;
      if (segment.streamUrl && streamKeyFor(segment.streamUrl) !== activeStreamKey) return;
      if (liveSegmentMap.has(segment.id)) return;
      const video = getVideo();
      const seconds = video && Number.isFinite(video.currentTime) ? round(video.currentTime) : null;
      liveSegmentMap.set(segment.id, {
        ...segment,
        id: `live-${segment.id}`,
        timestamp: seconds === null ? "live" : formatTimestamp(seconds),
        seconds,
        source: "realtime_stt"
      });
    });
    while (liveSegmentMap.size > MAX_TRANSCRIPT_SEGMENTS) {
      liveSegmentMap.delete(liveSegmentMap.keys().next().value);
    }
    createEventsFromTranscript();
    publish();
  });

  const scanTimer = window.setInterval(() => {
    resetEvidenceForNavigation();
    createEventsFromTranscript();
    publish();
  }, 2500);
  window.addEventListener("pagehide", () => window.clearInterval(scanTimer), { once: true });

  const context = document.modelContext;
  document.documentElement.dataset.livesignalWebmcp = context ? "registering" : "unavailable";
  window.postMessage({ source: "livesignal", type: "adapter-status", payload: { adapter: "active", webmcp: Boolean(context) } }, location.origin);
  if (!context) {
    publish();
    return;
  }

  const registrations = [];
  const register = (tool) => {
    const registration = context.registerTool(tool)
      .then(() => ({ name: tool.name, ok: true }))
      .catch((error) => ({ name: tool.name, ok: false, error: String(error?.message || error) }));
    registrations.push(registration);
  };
  toolDefinitions.forEach(register);
  Promise.all(registrations).then((results) => {
    const failed = results.filter((result) => !result.ok);
    document.documentElement.dataset.livesignalWebmcp = failed.length ? "error" : "registered";
    document.documentElement.dataset.livesignalTools = results.filter((result) => result.ok).map((result) => result.name).join(",");
    if (failed.length) {
      document.documentElement.dataset.livesignalWebmcpErrors = failed.map((result) => result.name).join(",");
    }
    window.postMessage({
      source: "livesignal",
      type: "adapter-status",
      payload: { adapter: "active", webmcp: !failed.length, registeredTools: results.filter((result) => result.ok).map((result) => result.name), failedTools: failed.map((result) => result.name) }
    }, location.origin);
    publish();
  });
})();
