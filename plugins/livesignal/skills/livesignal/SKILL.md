---
name: livesignal
description: Find livestreams and gather reliable, timestamped information from them with LiveSignal, WebMCP, and a paired browser agent. Use when a user asks to discover a relevant live stream, research what is being discussed, search a stream transcript, monitor a topic, summarize evidence, or navigate to a source moment.
---

# LiveSignal

Use LiveSignal to turn supported streams into evidence an agent can search and show. Pair the LiveSignal extension with browser control: browser control discovers and navigates streams; LiveSignal handles audio, transcripts, evidence, and player actions.

## Workflow

1. For a stream the user has not selected, use `search_livestreams` when the Companion exposes it. Otherwise use browser control to search current YouTube Live or Twitch results, compare visible titles and descriptions, and open the best candidate in the same paired tab.
2. On a selected stream, call `get_current_stream_state`. If native evidence is unavailable and `liveTranscription.status` is `idle`, explain that Chrome requires one explicit approval in the LiveSignal popup for this tab. Do not request another click once the status is `connecting` or `listening`; keep navigating in that same tab. Then call `get_transcript` before claiming that evidence is available.
3. Use `search_stream` for a phrase, topic, person, or announcement. Give the user the matching quote and timestamp, not only a summary.
4. Use `jump_to_event` or `jump_to_timestamp` only when the user asks to see, play, or open the source moment. Report if the player has no seekable window.
5. Use `create_watch_rule` for an explicit topic-monitoring request. Use `get_recent_events` to report matches.

## Paired browser mode

Prefer registered WebMCP tools. If the browser runtime can navigate the page but does not surface `document.modelContext` tools, use the extension's page bridge as the compatibility path. Confirm `document.documentElement.dataset.livesignalAgent === "ready"`, then invoke the same tool contract with `window.LiveSignalAgent.call(toolName, input)`. Read-only state is also serialized in `#livesignal-agent-state` as JSON.

Use this fallback only on a page where the LiveSignal extension is active. Do not imitate results when neither WebMCP nor the page bridge is present.

## Evidence standard

- Treat a transcript match as evidence only when the tool returns the source text and timestamp.
- State when transcript evidence is unavailable. Prefer YouTube's native transcript when present; otherwise use LiveSignal realtime transcription after the tab's one-time approval. Do not fabricate an answer from the title or chat.
- Quote only the short relevant excerpt and include its timestamp.
- Distinguish a transcript mention from a speaker endorsement or a confirmed announcement.

## Scope and limits

- The adapter can read YouTube-rendered transcripts or consume ElevenLabs Scribe realtime evidence from approved tab audio. It does not perform visual scene analysis.
- Chrome requires one user gesture before tab audio capture. An agent cannot bypass that boundary. After approval, continue autonomously without asking again while the same tab remains enabled.
- Realtime capture is scoped to the approved tab and continues while that capture remains active. Evidence resets when the agent switches streams so transcript lines cannot leak across sources. Watch rules are page-local and end when the page refreshes or closes.
- Twitch supports player state, realtime transcription after tab approval, and timestamp navigation when available.
- The LiveSignal Companion demonstrates interaction with seeded timeline data. Do not present its demo events as extracted from a real stream.

## Good responses

- “The stream mentions the release date at 12:43: ‘…’. Want me to open that moment?”
- “This stream has no native transcript. Approve LiveSignal once for this tab; after that I can listen and search streams here without another click.”
- “I created a tab-local watch rule for ‘Ethereum’. I’ll report matching transcript evidence while this page stays open.”
