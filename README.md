# LiveSignal

**Turn livestream watch time into searchable evidence.**

LiveSignal is a WebMCP prototype for agents that need to gather information from livestreams when a person does not have time to watch. It helps an agent find streams on existing platforms, search evidence inside a supported stream, create focused watch rules, and jump to the exact moment that supports an answer.

It is deliberately an adapter, not a streaming platform. The Companion web app demonstrates the interaction design; the browser extension exposes semantic tools on YouTube and Twitch pages.

## The problem

Important information lands in long livestreams: product announcements, a creator's opinion, a game update, a release date. Existing agents can navigate a player, but that does not make the stream queryable or provide evidence for an answer.

## What is implemented

### Companion web app

- WebMCP tools for stream discovery, event search, timestamp navigation, and in-page watch rules.
- A visual timeline that demonstrates an evidence-backed agent workflow.
- Search links for current YouTube Live and Twitch results.

The Companion timeline is explicitly seeded demo data. It is used to make the product interaction legible during the demo; it is not represented as live stream analysis.

### Browser adapter

- **YouTube:** normalized player state, visible transcript retrieval, transcript search, event generation from transcript watch rules, and timestamp navigation.
- **Twitch:** normalized player state and timestamp navigation where the player provides a playback window.
- A small in-page status badge so a person can see when LiveSignal is active.

On YouTube, LiveSignal only indexes timestamped transcript text that the platform renders in its own transcript panel. It does not claim to transcribe audio, understand visual scenes, or continue monitoring after the tab is refreshed or closed.

## WebMCP tool surface

### Companion page

- `get_stream_info`
- `get_recent_events`
- `search_stream`
- `jump_to_event`

## Agent skill/plugin

`plugins/livesignal/` contains an installable Codex plugin with the LiveSignal skill. It guides an agent through discovery, transcript evidence, timestamp navigation, and tab-local watch rules without making unsupported background-monitoring claims. The plugin complements the browser extension; it does not replace it.
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
4. Open a YouTube video or live replay with a transcript, then open YouTube's transcript panel.
5. Ask your agent: “Search this stream for Ethereum and show me the evidence.”
6. Ask: “Monitor this transcript for a release date.” Then use `get_recent_events` and `jump_to_event` when a matching line appears.

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

- **One reliable proof path first:** transcript-backed YouTube search and seeks are more demonstrable than claiming universal multimodal livestream understanding.
- **No invented data:** a missing transcript is reported as missing, with guidance to open YouTube's transcript panel.
- **No false background-monitoring claim:** watch rules are intentionally in-page and scoped to the current browser tab.
- **Platform compatibility:** the extension is a prototype and is not affiliated with YouTube or Twitch. Platform DOM changes may require adapter updates.

## License

[MIT](LICENSE)
