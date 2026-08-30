---
name: livesignal
description: Research any topic across YouTube with timestamped evidence, then create, collaboratively revise, and download a shared report in LiveSignal through WebMCP. Use for video discovery, transcript research, cited summaries, editable reports, human-agent revision workflows, livestream evidence, report export, or source-moment navigation.
---

# LiveSignal

Use LiveSignal as a shared video research desk operated primarily through its WebMCP site tools. The human gives one request in ChatGPT, then reviews and edits the visible artifact; the agent creates the brief, discovers YouTube sources, records timed evidence, and drafts the report back into the open LiveSignal page.

## Universal research workflow

1. Start every new project by calling `begin_research` with the user's request and an inferred brief. This clears any prior example or report.
2. Discover relevant YouTube videos with browser search. Prefer a small, diverse, credible source set rather than claiming to analyze all of YouTube.
3. Call `ingest_youtube_video` for each selected URL. When server captions are available, use `search_video_evidence` immediately.
4. If ChatGPT reads captions or source moments in another browser tab, call `record_video_evidence` on LiveSignal with the source metadata and timestamped excerpts. This is the primary cross-tab path in ChatGPT's built-in browser.
5. The optional Chrome extension is a fallback for native-caption capture or one-time user-approved realtime STT. Import its latest snapshot from the page's manual fallback control when needed.
6. Search the imported evidence, keep timestamped excerpts, and use `write_report` to draft the visible artifact. The human can edit the same report directly.
7. During an active collaboration, call `get_human_revisions` before a major research step and before presenting the report as final. Incorporate relevant edits with the brief or report tools, then call `acknowledge_human_revisions`. Do not claim an idle agent will wake itself; the revision stream is available in the active browser session.
8. Revise only as requested, preserve citations and caveats, and call `publish_report` only after the human approves the result.
9. When the human asks to save or export the result, call `download_report`. The Markdown download must retain clickable YouTube timestamp citations.

## Livestream adapter workflow

1. For a stream the user has not selected, use `search_livestreams` when the Companion exposes it. On visible YouTube results, call `rank_livestream_results`. Prefer `topicMatch: "exact_title"` plus `likelyFormat: "spoken_commentary_likely"`; treat automated chart/signals feeds as a fallback unless the user requested one.
2. Open the best candidate in the same paired tab and call `get_current_stream_state`. If native evidence is unavailable and `liveTranscription.status` is `idle`, explain that Chrome requires one explicit approval in the LiveSignal popup for this tab. Do not request another click once the status is `connecting` or `listening`; keep navigating in that tab.
3. Wait for committed evidence, then call `get_transcript`. Verify the spoken subject rather than trusting the title. If the requested topic is absent and the speakers are clearly discussing something else, try the next ranked candidate, up to three candidates, before reporting that no relevant spoken stream was found.
4. Use `search_stream` for a phrase, topic, person, or announcement. Give the user the matching quote and timestamp, not only a summary.
5. Use `jump_to_event` or `jump_to_timestamp` only when the user asks to see, play, or open the source moment. Report if the player has no seekable window.
6. Use `create_watch_rule` for an explicit topic-monitoring request. Use `get_recent_events` to report matches.

## Paired browser mode

Prefer registered WebMCP tools. If browser control can navigate the page but does not surface `document.modelContext` tools, use the evidence snapshot as the compatibility path. Confirm `document.documentElement.dataset.livesignalAgent === "ready"`, then read and parse the ordinary DOM output `#livesignal-agent-state`. It contains current state, committed transcript segments, recent events, and watch rules. Poll it while listening; use normal browser controls for discovery, navigation, and seeking.

Do not rely on `window.LiveSignalAgent` from an isolated browser-automation world. The global API remains available to same-world integrations, while the DOM output is the interoperable Codex browser-control path.

Use this fallback only on a page where the LiveSignal extension is active. Do not imitate results when neither WebMCP nor the page bridge is present.

## Evidence standard

- Treat a transcript match as evidence only when the tool returns the source text and timestamp.
- Confirm `liveTranscription.adShowing` is false. LiveSignal discards preroll and midroll speech and reports the count in `discardedAdSegments`.
- State when transcript evidence is unavailable. Prefer YouTube's native transcript when present; otherwise use LiveSignal realtime transcription after the tab's one-time approval. Do not fabricate an answer from the title or chat.
- Quote only the short relevant excerpt and include its timestamp.
- Distinguish a transcript mention from a speaker endorsement or a confirmed announcement.

## Scope and limits

- The adapter can read YouTube-rendered transcripts or consume ElevenLabs Scribe realtime evidence from approved tab audio. It does not perform visual scene analysis.
- Chrome requires one user gesture before tab audio capture. An agent cannot bypass that boundary. After approval, continue autonomously without asking again while the same tab remains enabled.
- Realtime capture is scoped to the approved tab and continues while that capture remains active. Evidence resets when the agent switches streams so transcript lines cannot leak across sources. Watch rules are page-local and end when the page refreshes or closes.
- Twitch supports player state, realtime transcription after tab approval, and timestamp navigation when available.
- The China food workspace is an optional example, never the initial state. Treat its labelled prototype excerpts as demo data until verified; imported caption and agent-recorded evidence is the real engine path.

## Good responses

- “The stream mentions the release date at 12:43: ‘…’. Want me to open that moment?”
- “This stream has no native transcript. Approve LiveSignal once for this tab; after that I can listen and search streams here without another click.”
- “I imported three videos about solid-state batteries, found five timestamped passages about manufacturing cost, and drafted the editable comparison in LiveSignal.”
