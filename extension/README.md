# LiveSignal browser adapter (prototype)

This Manifest V3 extension makes supported livestream pages useful to WebMCP-enabled agents without requiring Twitch or YouTube to change their websites.

## What works today

- **YouTube**: player state, visible transcript evidence, realtime tab-audio transcription, transcript search, timestamp seek, and in-tab transcript watch rules.
- **Twitch**: normalized player state, realtime tab-audio transcription, and timestamp seek when the player exposes a seekable playback window.

LiveSignal prefers transcript text that YouTube makes visible in its own transcript panel. When a true livestream does not expose one, click the LiveSignal toolbar icon once to start ElevenLabs Scribe v2 Realtime transcription of that tab's audio. Click it again to stop. Watch rules are local to the current tab and disappear when the tab is refreshed; this prototype does not claim visual scene understanding.

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
3. Open a YouTube or Twitch livestream. If YouTube has no transcript panel, click the LiveSignal toolbar icon once and wait for the badge to say **LiveSignal listening**.
4. Ask an agent: “What are they discussing right now? Use the recent transcript as evidence.”
5. Ask: “Search this stream for Ethereum and show me the evidence.”
6. Ask: “Monitor this transcript for a release date.” Then use `get_recent_events` to see any matching timestamped signal.

Realtime transcription requires the deployed LiveSignal Companion to have an `ELEVENLABS_API_KEY` server environment variable. The key is never bundled with the extension: the Companion mints a single-use Scribe token for each listening session.

The in-page badge reads **LiveSignal active** only after every tool has registered. It reports a specific unavailable or registration-failed state instead of implying that a bridge is usable when it is not.

This is a hackathon prototype, not an official YouTube or Twitch integration.
