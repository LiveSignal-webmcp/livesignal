---
name: livesignal
description: Research any topic across YouTube with timestamped evidence, then co-create and export a shareable visual canvas with optional AI-generated illustrations in LiveSignal through WebMCP. Use for video discovery, transcript research, cited summaries, editable reports, human-agent canvas workflows, card illustration requests, livestream evidence, visual artifact export, or source-moment navigation.
---

# LiveSignal

Use LiveSignal as a shared video research and creation desk operated primarily through its WebMCP site tools. The human gives one plain-language goal either in ChatGPT or on LiveSignal's entry screen, then arranges, rewrites, and styles the visible artifact; the agent infers the brief, discovers YouTube sources, records timed evidence, drafts the report, and helps shape the canvas in the open LiveSignal page.

## Universal research workflow

1. On opening or reconnecting to LiveSignal, call `identify_agent` with `client: "ChatGPT"`, an optional client-local `agentId`, and the capabilities you can perform. This is an optional presence handshake that lets the human see which agent is working; it does not create a persistent connection. Then accept one goal; do not require the human to complete a research form. If the human wants to type on the blank LiveSignal page, call `wait_for_research_request` (up to 30 seconds) and use the returned request. Otherwise use their ChatGPT message directly. Then call `begin_research` with the request and an inferred brief. This clears any prior example or report.
2. Discover relevant YouTube videos with browser search. Prefer a small, diverse, credible source set rather than claiming to analyze all of YouTube.
3. Call `ingest_youtube_video` for each selected URL. When server captions are available, use `search_video_evidence` immediately.
4. If ChatGPT reads captions or source moments in another browser tab, call `record_video_evidence` on LiveSignal with the source metadata and timestamped excerpts. This is the primary cross-tab path in ChatGPT's built-in browser.
5. The optional Chrome extension is a fallback for native-caption capture or one-time user-approved realtime STT. Import its latest snapshot from the page's manual fallback control when needed.
6. Search the imported evidence, keep timestamped excerpts, and use `write_report` to create the evidence draft. Then call `create_canvas` once to turn it into a shareable visual artifact. Keep researched claims connected to evidence IDs; personal notes may remain uncited only when clearly presented as personal content.
7. After creating the canvas, call `start_canvas_collaboration`. Keep its session ID and last sequence, then call `wait_for_collaboration_event` for up to 30 seconds. Re-call it after every event or idle timeout while the returned session remains active. Stop only when it returns `finished`, the page closes, a new project starts, or the agent runtime ends the turn.
8. For a `canvas_change`, treat the human's saved order, block sizes, theme, and wording as intentional. Read the supplied revision batch and current canvas. React only when useful: accept ordinary layout changes silently, protect citation meaning, or flag a source problem. Use the smallest scoped tool instead of recreating the canvas, call `acknowledge_human_revisions` with the batch revision IDs, update `afterSequence`, then wait again.
9. For a `comment`, call `claim_agent_comment` before acting so the human sees that work has started. Research additional YouTube sources when asked to verify, find more, or add another perspective. For `create-visual`, derive art direction from the human's wording, selected card, and canvas mood; call `generate_canvas_image` only for that card, then call `answer_agent_comment` with the updated block ID. When the comment has `visualPlacement: "background"`, pass `placement: "background"` so the artwork becomes the full-card backdrop and preserve clear contrast for the human's text. Otherwise use the default inline placement. Never present generated artwork as source evidence. For other comment kinds, record new timestamped excerpts when needed and make only the requested canvas change. Then wait again. Use `wait_for_agent_comment` only as a one-comment fallback outside a live collaboration session.
10. The human explicitly saves ordinary canvas edits before they enter the agent queue. If the agent disconnects, call `start_canvas_collaboration` again, then use `get_human_revisions` and the latest sequence to catch up. Never claim the page can wake an agent after its runtime turn has ended; queued saved changes remain available on reconnect.
11. Call `set_canvas_theme` only for a human-requested or clearly relevant visual direction. Never replace the complete canvas after the human has edited it unless they explicitly ask to start over.
12. Revise only as requested, preserve citations and caveats, and call `publish_report` only after the human approves the result.
13. When the human asks for the shareable result, call `download_canvas_png`. Use `download_report` for the underlying Markdown research; it must retain clickable YouTube timestamp citations.

## Canvas collaboration contract

- Use `get_canvas_state` to inspect the same visible composition the human sees.
- Preserve human-authored notes and distinguish them from evidence-backed claims.
- Keep layout edits local. A request to shorten one card does not authorize rewriting other cards.
- If moving or rewriting a claim would change its meaning, preserve its evidence IDs and verify the supporting excerpt first.
- Treat pending human revisions as collaboration events, not instructions to regenerate from scratch.
- Keep one renewable `wait_for_collaboration_event` loop active during co-editing. A timeout means renew the wait, not that the session is finished.
- A card move normally requires acknowledgment, not unsolicited rewriting. Respond visibly only when the change creates a citation, readability, or factual problem.
- Treat canvas comments as actionable research tickets. Claim one, investigate it, update its scoped card or the whole canvas as requested, then answer it visibly. Never mark a comment answered before the research and canvas edits are complete.
- Treat `create-visual` as human art direction, not a research claim. Generate one image for the selected card, use concise accessible alt text, avoid asking for words inside the image, and leave citations attached to the written claim rather than the illustration. Use a full-card background only when the human explicitly asks for it or the comment requests `visualPlacement: "background"`. A backdrop is an additive visual layer: never rewrite or remove the card title, body, citations, source thumbnails, layout, or an existing inline illustration while creating it.
- Prefer a small number of visually distinct blocks with concise copy over placing the full transcript or report on the canvas.

## Livestream adapter workflow

1. For a stream the user has not selected, use `search_livestreams` when the Companion exposes it. On visible YouTube results, call `rank_livestream_results`. Prefer `topicMatch: "exact_title"` plus `likelyFormat: "spoken_commentary_likely"`; treat automated chart/signals feeds as a fallback unless the user requested one.
2. Open the best candidate in the same paired tab and call `get_current_stream_state`. If native evidence is unavailable and `liveTranscription.status` is `idle`, explain that Chrome requires one explicit approval in the LiveSignal popup for this tab. Do not request another click once the status is `connecting` or `listening`; keep navigating in that tab.
3. Wait for committed evidence, then call `get_transcript`. Verify the spoken subject rather than trusting the title. If the requested topic is absent and the speakers are clearly discussing something else, try the next ranked candidate, up to three candidates, before reporting that no relevant spoken stream was found.
4. Use `search_stream` for a phrase, topic, person, or announcement. Give the user the matching quote and timestamp, not only a summary.
5. Use `jump_to_event` or `jump_to_timestamp` only when the user asks to see, play, or open the source moment. Report if the player has no seekable window.
6. Use `create_watch_rule` for an explicit topic-monitoring request. Use `get_recent_events` to report matches.

## Paired browser mode

Prefer registered WebMCP tools. On the LiveSignal workspace, browser-control agents that cannot directly surface `document.modelContext` may invoke the identical registered handlers through the ordinary DOM. The request control and response output are accessibility-visible even though they are visually off-screen. Confirm `document.documentElement.dataset.livesignalPageAgent === "ready"`, fill the textarea labelled `LiveSignal page agent request` with JSON containing a unique `requestId`, tool `name`, and `input`, then poll the output labelled `LiveSignal page agent response` until its JSON text contains the matching response. Treat `{ok:false}` as a tool error. The response element's `data-tools` attribute contains the complete tool-name catalog. A main-world integration may instead set the bridge's `data-request` and dispatch `livesignal:page-tool-call`. This is the Codex/browser-control compatibility transport backed by the same handlers; it does not replace WebMCP registration.

On a YouTube or Twitch source page, use the evidence snapshot as the compatibility path. Confirm `document.documentElement.dataset.livesignalAgent === "ready"`, then read and parse the ordinary DOM output `#livesignal-agent-state`. It contains current state, committed transcript segments, recent events, and watch rules. Poll it while listening; use normal browser controls for discovery, navigation, and seeking.

Do not rely on `window.LiveSignalAgent` from an isolated browser-automation world. The global API remains available to same-world integrations, while the DOM output is the interoperable Codex browser-control path.

The Companion page bridge requires only `document.documentElement.dataset.livesignalPageAgent === "ready"`; it does not require the optional livestream extension. Use the source-page evidence snapshot only when `document.documentElement.dataset.livesignalAgent === "ready"`. Do not imitate results when the corresponding bridge is absent.

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
- “I kept your new layout, shortened the preparation card to fit, and preserved its two source moments. The canvas is ready for your review or PNG export.”
- “I picked up your note on the temperature card, checked two more brewing videos, and added the dark-roast exception with both new timestamps.”
- “I used your hand-drawn editorial direction for the selected card and added one clearly labelled AI illustration. The source citations remain attached to the written advice.”
