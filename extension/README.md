# LiveSignal browser adapter (prototype)

This Manifest V3 extension makes supported livestream pages useful to WebMCP-enabled agents without requiring Twitch or YouTube to change their websites.

## What works today

- **YouTube**: player state, visible transcript evidence, transcript search, timestamp seek, and in-tab transcript watch rules.
- **Twitch**: normalized player state and timestamp seek when the player exposes a seekable playback window.

The YouTube proof path intentionally uses only transcript text that YouTube makes visible in its own transcript panel. Open that panel before asking the agent to search or monitor it. Watch rules are local to the current tab and disappear when the tab is refreshed; this prototype does not claim background monitoring, audio transcription, or visual scene understanding.

## WebMCP tools

- `get_current_stream_state`
- `get_transcript`
- `search_stream`
- `get_recent_events`
- `create_watch_rule`
- `get_active_watch_rules`
- `jump_to_timestamp`
- `jump_to_event`

## Try it

1. Enable WebMCP in a compatible Chrome build.
2. Go to `chrome://extensions`, enable Developer mode, and load this `extension/` directory unpacked.
3. Open a YouTube video or live replay with a transcript. Open YouTube's transcript panel.
4. Ask an agent: “Search this stream for Ethereum and show me the evidence.”
5. Ask: “Monitor this transcript for a release date.” Then use `get_recent_events` to see any matching timestamped signal.

The in-page badge reads **LiveSignal active** only after every tool has registered. It reports a specific unavailable or registration-failed state instead of implying that a bridge is usable when it is not.

This is a hackathon prototype, not an official YouTube or Twitch integration.
