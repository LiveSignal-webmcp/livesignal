(() => {
  if (window.__liveSignalAdapterInstalled) return;
  window.__liveSignalAdapterInstalled = true;

  const getVideo = () => document.querySelector("video");
  const getState = () => {
    const video = getVideo();
    return {
      platform: location.hostname.includes("youtube") ? "YouTube" : "Twitch",
      title: document.title.replace(/\s+-\s+(YouTube|Twitch)$/, ""),
      url: location.href,
      playable: Boolean(video),
      seekable: Boolean(video?.seekable?.length),
      currentTime: video ? Math.round(video.currentTime * 10) / 10 : null,
      duration: video && Number.isFinite(video.duration) ? Math.round(video.duration * 10) / 10 : null,
      paused: video?.paused ?? null
    };
  };

  const publish = () => window.postMessage({ source: "livesignal", type: "state", payload: getState() }, location.origin);
  const seek = (seconds) => {
    const video = getVideo();
    if (!video) return { ok: false, error: "No HTML video element is available on this page." };
    if (!video.seekable?.length) return { ok: false, error: "This live stream does not expose a seekable DVR window." };
    const range = video.seekable;
    const target = Math.max(range.start(0), Math.min(Number(seconds), range.end(range.length - 1)));
    video.currentTime = target;
    publish();
    return { ok: true, timestamp: target };
  };

  const context = document.modelContext;
  if (!context) {
    publish();
    return;
  }

  const register = (tool) => context.registerTool(tool).catch(() => undefined);
  register({
    name: "get_current_stream_state",
    description: "Returns normalized player state for the active supported livestream page.",
    execute: () => getState()
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
  publish();
})();
