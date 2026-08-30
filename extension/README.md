# LiveSignal browser adapter (prototype)

This Manifest V3 extension makes supported YouTube videos and livestreams useful to agents without requiring the platforms to change their websites. It can now transfer the latest native-caption or realtime-STT evidence into the LiveSignal Companion, where a human and agent create an editable report together.

## What works today

- **YouTube**: player state, visible transcript evidence, realtime tab-audio transcription, transcript search, timestamp seek, and in-tab transcript watch rules.
- **Twitch**: normalized player state, realtime tab-audio transcription, and timestamp seek when the player exposes a seekable playback window.

LiveSignal prefers transcript text that YouTube makes visible in its own transcript panel. When a true livestream does not expose one, approve the tab once in the LiveSignal popup to start ElevenLabs Scribe v2 Realtime transcription. Chrome requires that initial user gesture for tab audio. After it, the agent can use LiveSignal autonomously across streams opened in the same tab until listening is stopped or the tab closes. Watch rules are page-local; this prototype does not claim visual scene understanding.

Evidence is reset whenever the approved tab switches streams. Transcript lines from one source are never reused for the next source.

YouTube preroll and midroll speech is discarded in the background before it can become stream evidence. A short grace period also drops an ad's trailing VAD commit.

## WebMCP tools

- `rank_livestream_results`
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
5. Ask: “Search this video for manufacturing cost and show me the evidence.”
6. Ask: “Monitor this transcript for a release date.” Then use `get_recent_events` to see any matching timestamped signal.

## Paired Codex browser mode

The extension publishes a same-world API through `window.LiveSignalAgent.call(name, input)` and a read-only JSON `<output>` at `#livesignal-agent-state`. Codex browser control should read the DOM output because browser automation can run in an isolated JavaScript world. This is a compatibility layer, not a separate backend or evidence source.

On `livesignal-chi.vercel.app`, `companion-bridge.js` imports the latest saved evidence snapshot from the page's optional manual fallback control. ChatGPT's built-in browser instead uses the Companion's `record_video_evidence` WebMCP tool directly.

The intended flow is:

1. A person chooses **Enable for this tab** once.
2. A browser agent searches and navigates in that same tab.
3. The agent prefers WebMCP tools. If its browser runtime cannot discover them, it reads the committed evidence snapshot and uses browser control for navigation.
4. LiveSignal returns transcript evidence and timestamps; the agent verifies the spoken topic before answering.

Realtime transcription requires the deployed LiveSignal Companion to have an `ELEVENLABS_API_KEY` server environment variable. The key is never bundled with the extension: the Companion mints a single-use Scribe token for each listening session.

The in-page badge distinguishes WebMCP registration, paired-agent readiness, realtime listening, and errors.

## ChatGPT browser-extension mode

The production Companion at `https://livesignal-chi.vercel.app` is included in the extension's host permissions and receives `companion-bridge.js` automatically. A ChatGPT extension agent can therefore open the normal site, discover its accessible research and canvas controls, and operate the complete visible workflow. When Chrome exposes WebMCP, the page registers its structured tools directly; the visible UI remains the compatibility path for browser-control agents.

On the Companion page, verify that the header reports the WebMCP tool count and that `document.documentElement.dataset.livesignalCompanionBridge` is `ready`. The extension agent can load or import a research project, select canvas cards, edit fields, submit block-scoped comments, and download the finished artifact through ordinary labelled controls.

This is a hackathon prototype, not an official YouTube or Twitch integration.
