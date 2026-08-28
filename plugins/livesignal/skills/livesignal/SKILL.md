---
name: livesignal
description: Gather reliable information from livestreams with LiveSignal WebMCP tools. Use when a user asks to find a relevant livestream, search a supported stream's transcript, monitor a topic in the open stream, summarize what was said, or navigate to timestamped evidence.
---

# LiveSignal

Use LiveSignal to turn a supported stream into evidence an agent can search and show. Prefer the tools currently exposed by the active page; their availability differs between the Companion page and a browser tab running the LiveSignal extension.

## Workflow

1. For a stream the user has not selected, use `search_livestreams` with the user's topic. Use `open_livestream_search` only when the user wants results opened.
2. On a selected YouTube stream, call `get_current_stream_state`. Then call `get_transcript` before claiming that transcript evidence is available.
3. Use `search_stream` for a phrase, topic, person, or announcement. Give the user the matching quote and timestamp, not only a summary.
4. Use `jump_to_event` or `jump_to_timestamp` only when the user asks to see, play, or open the source moment. Report if the player has no seekable window.
5. Use `create_watch_rule` for an explicit topic-monitoring request. Use `get_recent_events` to report matches.

## Evidence standard

- Treat a transcript match as evidence only when the tool returns the source text and timestamp.
- State when the transcript is unavailable. On YouTube, tell the user to open the platform's transcript panel; do not fabricate an answer from the title or chat.
- Quote only the short relevant excerpt and include its timestamp.
- Distinguish a transcript mention from a speaker endorsement or a confirmed announcement.

## Scope and limits

- The YouTube adapter reads transcript text rendered by YouTube; it does not perform audio transcription or visual scene analysis.
- Watch rules are local to the current tab and end when it refreshes or closes. Do not promise unattended alerts or persistent monitoring.
- Twitch support is limited to player state and timestamp navigation when available.
- The LiveSignal Companion demonstrates interaction with seeded timeline data. Do not present its demo events as extracted from a real stream.

## Good responses

- “The stream mentions the release date at 12:43: ‘…’. Want me to open that moment?”
- “I can search this stream once the YouTube transcript panel is open.”
- “I created a tab-local watch rule for ‘Ethereum’. I’ll report matching transcript evidence while this page stays open.”
