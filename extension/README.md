# LiveSignal browser adapter (prototype)

This Manifest V3 extension makes supported livestream pages useful to agents without requiring Twitch or YouTube to change their websites. WebMCP is the primary interface; a page bridge lets a paired Codex browser agent use the identical tool contract when its browser runtime does not expose page-registered WebMCP tools yet.

## What works today

- **YouTube**: player state, visible transcript evidence, realtime tab-audio transcription, transcript search, timestamp seek, and in-tab transcript watch rules.
- **Twitch**: normalized player state, realtime tab-audio transcription, and timestamp seek when the player exposes a seekable playback window.

LiveSignal prefers transcript text that YouTube makes visible in its own transcript panel. When a true livestream does not expose one, approve the tab once in the LiveSignal popup to start ElevenLabs Scribe v2 Realtime transcription. Chrome requires that initial user gesture for tab audio. After it, the agent can use LiveSignal autonomously across streams opened in the same tab until listening is stopped or the tab closes. Watch rules are page-local; this prototype does not claim visual scene understanding.

Evidence is reset whenever the approved tab switches streams. Transcript lines from one source are never reused for the next source.

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
3. Open a YouTube or Twitch livestream. If YouTube has no transcript panel, open the LiveSignal popup and choose **Enable for this tab** once. Wait for the badge to say **LiveSignal listening**.
4. Ask an agent: “What are they discussing right now? Use the recent transcript as evidence.”
5. Ask: “Search this stream for Ethereum and show me the evidence.”
6. Ask: “Monitor this transcript for a release date.” Then use `get_recent_events` to see any matching timestamped signal.

## Paired Codex browser mode

The extension publishes the same eight handlers through `window.LiveSignalAgent.call(name, input)` and a read-only JSON snapshot at `#livesignal-agent-state`. This is a compatibility layer for browser-control runtimes; it is not a separate backend or evidence source.

The intended flow is:

1. A person chooses **Enable for this tab** once.
2. Codex searches and navigates in that same tab.
3. Codex prefers WebMCP tools. If its browser runtime cannot discover them, it calls the matching page-bridge handler.
4. LiveSignal returns transcript evidence and timestamps; Codex answers from that evidence.

Realtime transcription requires the deployed LiveSignal Companion to have an `ELEVENLABS_API_KEY` server environment variable. The key is never bundled with the extension: the Companion mints a single-use Scribe token for each listening session.

The in-page badge distinguishes WebMCP registration, paired-agent readiness, realtime listening, and errors.

This is a hackathon prototype, not an official YouTube or Twitch integration.
