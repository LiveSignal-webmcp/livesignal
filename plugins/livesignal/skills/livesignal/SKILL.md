---
name: livesignal
description: Gather reliable information from livestreams with LiveSignal WebMCP tools. Use when a user asks to find a relevant livestream, search a supported stream's transcript, monitor a topic in the open stream, summarize what was said, or navigate to timestamped evidence.
---

# LiveSignal

Use LiveSignal to turn a supported stream into evidence an agent can search and show. Prefer the tools currently exposed by the active page; their availability differs between the Companion page and a browser tab running the LiveSignal extension.

## Workflow

1. For a stream the user has not selected, use `search_livestreams` with the user's topic. Use `open_livestream_search` only when the user wants results opened.
2. On a selected stream, call `get_current_stream_state`. If native evidence is unavailable and `liveTranscription.status` is `idle`, explain that Chrome requires one explicit approval in the LiveSignal popup for this tab. Do not request another click once the status is `listening`; the authorization persists across stream navigation in that tab. Then call `get_transcript` before claiming that evidence is available.
3. Use `search_stream` for a phrase, topic, person, or announcement. Give the user the matching quote and timestamp, not only a summary.
4. Use `jump_to_event` or `jump_to_timestamp` only when the user asks to see, play, or open the source moment. Report if the player has no seekable window.
5. Use `create_watch_rule` for an explicit topic-monitoring request. Use `get_recent_events` to report matches.

## Evidence standard

- Treat a transcript match as evidence only when the tool returns the source text and timestamp.
- State when transcript evidence is unavailable. Prefer YouTube's native transcript when present; otherwise use LiveSignal realtime transcription after the tab's one-time approval. Do not fabricate an answer from the title or chat.
- Quote only the short relevant excerpt and include its timestamp.
- Distinguish a transcript mention from a speaker endorsement or a confirmed announcement.

## Scope and limits

- The adapter can read YouTube-rendered transcripts or consume ElevenLabs Scribe realtime evidence from approved tab audio. It does not perform visual scene analysis.
- Chrome requires one user gesture before tab audio capture. An agent cannot bypass that boundary. After approval, continue autonomously without asking again while the same tab remains enabled.
- Watch rules are local to the current tab and end when it refreshes or closes. Do not promise unattended alerts or persistent monitoring.
- Twitch supports player state, realtime transcription after tab approval, and timestamp navigation when available.
- The LiveSignal Companion demonstrates interaction with seeded timeline data. Do not present its demo events as extracted from a real stream.

## Good responses

- “The stream mentions the release date at 12:43: ‘…’. Want me to open that moment?”
- “This stream has no native transcript. Approve LiveSignal once for this tab; after that I can listen and search streams here without another click.”
- “I created a tab-local watch rule for ‘Ethereum’. I’ll report matching transcript evidence while this page stays open.”
