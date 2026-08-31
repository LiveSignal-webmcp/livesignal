# LiveSignal

**Research anything across YouTube with timestamped evidence.**

LiveSignal is a universal WebMCP video-research workspace. A person gives ChatGPT one request; the agent creates the brief, researches relevant YouTube videos across browser tabs, records timed evidence, and drafts a report back into the same visible page. The person reviews and edits the result. The China food guide is an optional example project, not the product boundary.

It is deliberately an adapter, not a streaming platform. The LiveSignal web app is the primary WebMCP surface; its tools let ChatGPT operate the research workspace directly. The browser extension adds optional native-caption and realtime-STT evidence on YouTube and Twitch, while the bundled skill documents the end-to-end workflow.

## The problem

Useful information is scattered across long YouTube videos. Existing agents can navigate a player, but that does not automatically create a searchable, cited research artifact a person can inspect and edit.

## What is implemented

### Companion web app

- An agent-operated workspace with no required setup form.
- Real YouTube metadata ingestion and server-caption ingestion where YouTube permits it.
- A `record_video_evidence` cross-tab tool so ChatGPT can write sources and timestamped moments researched in other tabs back into LiveSignal.
- Optional browser-extension evidence import when serverless caption access is unavailable.
- Searchable timed evidence plus a directly editable, publishable report.
- 37 semantic WebMCP tools operating on the same visible state as the human UI.
- An optional agent-identity handshake so the workspace can show the connected client (for example, ChatGPT or Claude Code) without assuming every WebMCP host exposes its name.
- A renewable collaboration session where saved human layout changes and comments reach the active agent without repeating the context in chat.
- Human-directed AI illustrations for selected cards, visibly labelled and kept separate from source evidence.

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

The universal surface includes `identify_agent`, `begin_research`, `open_youtube_search`, `ingest_youtube_video`, `record_video_evidence`, `search_video_evidence`, `write_report`, renewable collaboration waits, scoped comment handling, `generate_canvas_image`, evidence pinning, report revision, timestamp navigation, and publication tools. The first tool call marks an anonymous WebMCP client as seen. Clients should also call `identify_agent` on opening or reconnecting with a display name and optional capabilities; browser WebMCP alone does not expose a client name or durable connection state.

## Agent skill/plugin

`plugins/livesignal/` contains an installable skill that describes the LiveSignal workflow. WebMCP site tools are the native path: ChatGPT operates the open workspace, researches across tabs, and records evidence back into the page. The extension's `#livesignal-agent-state` remains a compatibility path for Chrome-based livestream research.

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
2. Open LiveSignal in ChatGPT's built-in browser and give ChatGPT one video-research request.
3. ChatGPT calls `begin_research`, finds candidate videos across tabs, and imports public captions with `ingest_youtube_video`.
4. When ChatGPT reads evidence directly in another tab, it calls `record_video_evidence` to write the source moments back into LiveSignal.
5. ChatGPT searches the evidence and writes an editable report with citations into the page.
6. Optional: load `extension/` in Chrome for native-caption or realtime-STT capture on videos without accessible transcripts.

## Local development

```bash
npm install
npm run dev
```

Human-directed canvas illustration uses Vercel AI Gateway with deployment OIDC by default, so the hosted app needs no manually copied provider key. For local or non-Vercel hosting, set `AI_GATEWAY_API_KEY`; the optional `AI_GATEWAY_IMAGE_MODEL` defaults to `prodia/flux-fast-schnell`. `OPENAI_API_KEY` and `OPENAI_IMAGE_MODEL` remain a direct-provider fallback. Image bytes stay in the current browser project and generated artwork is never treated as research evidence.

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
