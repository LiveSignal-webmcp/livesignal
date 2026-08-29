# LiveSignal

**Turn livestream watch time into searchable evidence.**

LiveSignal is a WebMCP prototype for agents that need to gather information from livestreams when a person does not have time to watch. It helps an agent find streams on existing platforms, search evidence inside a supported stream, create focused watch rules, and jump to the exact moment that supports an answer.

It is deliberately an adapter, not a streaming platform. The Companion web app demonstrates the interaction design; the browser extension exposes semantic tools on YouTube and Twitch pages; the Codex plugin teaches an agent how to combine stream discovery, browser navigation, and evidence retrieval.

## The problem

Important information lands in long livestreams: product announcements, a creator's opinion, a game update, a release date. Existing agents can navigate a player, but that does not make the stream queryable or provide evidence for an answer.

## What is implemented

### Companion web app

- WebMCP tools for stream discovery, event search, timestamp navigation, and in-page watch rules.
- A visual timeline that demonstrates an evidence-backed agent workflow.
- Search links for current YouTube Live and Twitch results.

The Companion timeline is explicitly seeded demo data. It is used to make the product interaction legible during the demo; it is not represented as live stream analysis.

### Browser adapter

- **YouTube:** normalized player state, native transcript retrieval, realtime tab-audio transcription, transcript search, watch rules, and timestamp navigation.
- **Twitch:** normalized player state, realtime tab-audio transcription, transcript search, and timestamp navigation where the player provides a playback window.
- One explicit tab-audio approval, followed by autonomous agent navigation in the same tab.
- A paired Codex browser-control bridge using the same handlers as WebMCP.
- Stream-scoped evidence isolation so transcript lines do not leak across navigation.

LiveSignal prefers native YouTube transcript text. When none is available, it uses ElevenLabs Scribe v2 Realtime after the user approves tab audio once. It does not claim visual scene understanding or persistent background monitoring after capture ends.

The latest unpacked demo bundle is available from the hosted site as `livesignal-extension-v0.4.0.zip`.

## WebMCP tool surface

### Companion page

- `get_stream_info`
- `get_recent_events`
- `search_stream`
- `jump_to_event`

## Agent skill/plugin

`plugins/livesignal/` contains an installable Codex plugin with the LiveSignal skill. It pairs browser control with the extension: the browser agent discovers and navigates streams; LiveSignal supplies transcript evidence, search, events, and player actions. WebMCP remains the native path, with `window.LiveSignalAgent` as a compatibility bridge for browser runtimes that cannot surface page-registered tools yet.

Install the public plugin marketplace and plugin:

```bash
codex plugin marketplace add LiveSignal-webmcp/livesignal --ref main
codex plugin add livesignal@livesignal-webmcp
```

Start a new Codex task after installation so the LiveSignal skill is loaded.
- `create_watch_rule`
- `search_livestreams`
- `open_livestream_search`

### Browser adapter

- `get_current_stream_state`
- `get_transcript`
- `search_stream`
- `get_recent_events`
- `create_watch_rule`
- `get_active_watch_rules`
- `jump_to_timestamp`
- `jump_to_event`

## Try the real YouTube path

1. Start the web app with `npm run dev`.
2. In a compatible Chrome build, enable WebMCP.
3. Open `chrome://extensions`, enable Developer mode, then load `extension/` as an unpacked extension.
4. Open a YouTube or Twitch livestream. Open the LiveSignal popup and choose **Enable for this tab** once when native evidence is unavailable.
5. Ask your agent: “Find a current livestream about Ethereum and tell me what it is discussing, with evidence.”
6. Ask: “Monitor this stream for a release date.” Then use `get_recent_events` and `jump_to_event` when a matching line appears.

## Local development

```bash
npm install
npm run dev
```

Validate the production build with:

```bash
npm run build
```

## Design choices and limits

- **One consent boundary:** Chrome requires a user gesture for tab audio capture; after that, the paired agent controls search and navigation in the approved tab.
- **One evidence contract:** WebMCP and the browser-control bridge call the same eight handlers.
- **No invented data:** a missing transcript is reported as missing, with guidance to open YouTube's transcript panel.
- **No false background-monitoring claim:** watch rules are intentionally in-page and scoped to the current browser tab.
- **Platform compatibility:** the extension is a prototype and is not affiliated with YouTube or Twitch. Platform DOM changes may require adapter updates.

## License

[MIT](LICENSE)
