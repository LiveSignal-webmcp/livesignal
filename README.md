# LiveSignal

**Research anything across YouTube with timestamped evidence.**

LiveSignal is a universal WebMCP video-research workspace. A person defines the goal and edits the result; their agent imports relevant YouTube videos, searches timed captions, pins evidence, and drafts a report in the same visible page. The China food guide is the included example project, not the product boundary.

It is deliberately an adapter, not a streaming platform. The Companion web app demonstrates the interaction design; the browser extension exposes semantic tools on YouTube and Twitch pages; the Codex plugin teaches an agent how to combine stream discovery, browser navigation, and evidence retrieval.

## The problem

Useful information is scattered across long YouTube videos. Existing agents can navigate a player, but that does not automatically create a searchable, cited research artifact a person can inspect and edit.

## What is implemented

### Companion web app

- A universal research-goal composer and YouTube URL importer.
- Real YouTube metadata ingestion and server-caption ingestion where YouTube permits it.
- Browser-extension evidence import when serverless caption access is unavailable.
- Searchable timed evidence plus a directly editable, publishable report.
- 18 semantic WebMCP tools operating on the same visible state as the human UI.

### Browser adapter

- **YouTube:** normalized player state, native transcript retrieval, realtime tab-audio transcription, transcript search, watch rules, and timestamp navigation.
- **Twitch:** normalized player state, realtime tab-audio transcription, transcript search, and timestamp navigation where the player provides a playback window.
- One explicit tab-audio approval, followed by autonomous agent navigation in the same tab.
- A paired Codex browser-control evidence snapshot backed by the same transcript state as WebMCP.
- Stream-scoped evidence isolation so transcript lines do not leak across navigation.
- YouTube ad filtering so preroll and midroll speech never becomes stream evidence.

LiveSignal prefers native YouTube transcript text. When none is available, it uses ElevenLabs Scribe v2 Realtime after the user approves tab audio once. It does not claim visual scene understanding or persistent background monitoring after capture ends.

The latest unpacked demo bundle is available from the hosted site as `livesignal-extension-v0.5.0.zip`.

## WebMCP tool surface

### Companion page

The universal surface includes `set_research_goal`, `ingest_youtube_video`, `import_browser_evidence`, `search_video_evidence`, `write_report`, evidence pinning, source management, report revision, timestamp navigation, and publication tools.

## Agent skill/plugin

`plugins/livesignal/` contains an installable Codex plugin with the LiveSignal skill. It pairs browser control with the extension: the browser agent discovers and navigates streams; LiveSignal supplies ranked discovery signals, transcript evidence, search, events, and player actions. WebMCP remains the native path, with `#livesignal-agent-state` as the browser-control evidence path when page-registered tools are not surfaced.

Install the public plugin marketplace and plugin:

```bash
codex plugin marketplace add LiveSignal-webmcp/livesignal --ref main
codex plugin add livesignal@livesignal-webmcp
```

Start a new Codex task after installation so the LiveSignal skill is loaded.

### Browser adapter

- `get_current_stream_state`
- `rank_livestream_results`
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
4. Open the Companion and set any research goal.
5. Import public YouTube URLs. If server captions are unavailable, open the source with the extension, expose its transcript or enable listening once, then choose **Import latest browser evidence** in the Companion.
6. Ask the agent to search the timed evidence and write an editable report with source moments.

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
- **One evidence state:** WebMCP and the browser-control snapshot read the same committed transcript store.
- **No invented data:** a missing transcript is reported as missing, with guidance to open YouTube's transcript panel.
- **No false background-monitoring claim:** watch rules are intentionally in-page and scoped to the current browser tab.
- **Platform compatibility:** the extension is a prototype and is not affiliated with YouTube or Twitch. Platform DOM changes may require adapter updates.

## License

[MIT](LICENSE)
