---
name: livesignal
description: Research any topic across YouTube with timestamped evidence, then co-create and export a shareable visual canvas in LiveSignal through WebMCP. Use for video discovery, transcript research, cited summaries, editable reports, human-agent canvas workflows, livestream evidence, visual artifact export, or source-moment navigation.
---

# LiveSignal

Use LiveSignal as a shared video research and creation desk operated primarily through its WebMCP site tools. The human gives one plain-language goal either in ChatGPT or on LiveSignal's entry screen, then arranges, rewrites, and styles the visible artifact; the agent infers the brief, discovers YouTube sources, records timed evidence, drafts the report, and helps shape the canvas in the open LiveSignal page.

## Universal research workflow

1. Accept one goal; do not require the human to complete a research form. If the human wants to type on the blank LiveSignal page, call `wait_for_research_request` (up to 30 seconds) and use the returned request. Otherwise use their ChatGPT message directly. Then call `begin_research` with the request and an inferred brief. This clears any prior example or report.
2. Discover relevant YouTube videos with browser search. Prefer a small, diverse, credible source set rather than claiming to analyze all of YouTube.
3. Call `ingest_youtube_video` for each selected URL. When server captions are available, use `search_video_evidence` immediately.
4. If ChatGPT reads captions or source moments in another browser tab, call `record_video_evidence` on LiveSignal with the source metadata and timestamped excerpts. This is the primary cross-tab path in ChatGPT's built-in browser.
5. The optional Chrome extension is a fallback for native-caption capture or one-time user-approved realtime STT. Import its latest snapshot from the page's manual fallback control when needed.
6. Search the imported evidence, keep timestamped excerpts, and use `write_report` to create the evidence draft. Then call `create_canvas` once to turn it into a shareable visual artifact. Keep researched claims connected to evidence IDs; personal notes may remain uncited only when clearly presented as personal content.
7. Treat the human's canvas order, block sizes, theme, and wording as intentional. During active collaboration, call `get_canvas_state`, `get_human_revisions`, and `get_agent_comments` before making a canvas change. Use the smallest scoped tool—normally `update_canvas_block`, `add_canvas_block`, or `reorder_canvas_blocks`—instead of recreating the whole canvas.
8. For each open canvas comment, call `claim_agent_comment` before researching so the human sees that work has started. The comment contains its canvas scope, a frozen copy of the selected block, and its evidence IDs. Use those details as context; do not ask the human to repeat the request in chat.
9. Research the comment with additional YouTube sources when it asks to verify, find more, or add another perspective. Record new timestamped excerpts with `record_video_evidence`, then make only the requested canvas change. Call `answer_agent_comment` with a concise result, all added evidence IDs, and all updated block IDs so the answer is inspectable in the shared thread.
   - When the human is actively composing and asks you to stay with the canvas, call `wait_for_agent_comment` with a wait of up to 30 seconds. Claim and handle a returned comment immediately. If it returns `idle`, call it again only while the live collaboration session remains active; do not imply that you can keep listening after the agent turn ends.
10. React to ordinary human revisions in context: explain what changed, protect citation meaning, shorten copy to fit when requested, or flag a missing source. Then call `acknowledge_human_revisions`. Do not claim an idle agent will wake itself; comments are exposed immediately to an active WebMCP agent and remain queued on the page otherwise.
11. Call `set_canvas_theme` only for a human-requested or clearly relevant visual direction. Never replace the complete canvas after the human has edited it unless they explicitly ask to start over.
12. Revise only as requested, preserve citations and caveats, and call `publish_report` only after the human approves the result.
13. When the human asks for the shareable result, call `download_canvas_png`. Use `download_report` for the underlying Markdown research; it must retain clickable YouTube timestamp citations.

## Canvas collaboration contract

- Use `get_canvas_state` to inspect the same visible composition the human sees.
- Preserve human-authored notes and distinguish them from evidence-backed claims.
- Keep layout edits local. A request to shorten one card does not authorize rewriting other cards.
- If moving or rewriting a claim would change its meaning, preserve its evidence IDs and verify the supporting excerpt first.
- Treat pending human revisions as collaboration events, not instructions to regenerate from scratch.
- Treat canvas comments as actionable research tickets. Claim one, investigate it, update its scoped card or the whole canvas as requested, then answer it visibly. Never mark a comment answered before the research and canvas edits are complete.
- Prefer a small number of visually distinct blocks with concise copy over placing the full transcript or report on the canvas.

## Livestream adapter workflow

1. For a stream the user has not selected, use `search_livestreams` when the Companion exposes it. On visible YouTube results, call `rank_livestream_results`. Prefer `topicMatch: "exact_title"` plus `likelyFormat: "spoken_commentary_likely"`; treat automated chart/signals feeds as a fallback unless the user requested one.
2. Open the best candidate in the same paired tab and call `get_current_stream_state`. If native evidence is unavailable and `liveTranscription.status` is `idle`, explain that Chrome requires one explicit approval in the LiveSignal popup for this tab. Do not request another click once the status is `connecting` or `listening`; keep navigating in that tab.
3. Wait for committed evidence, then call `get_transcript`. Verify the spoken subject rather than trusting the title. If the requested topic is absent and the speakers are clearly discussing something else, try the next ranked candidate, up to three candidates, before reporting that no relevant spoken stream was found.
4. Use `search_stream` for a phrase, topic, person, or announcement. Give the user the matching quote and timestamp, not only a summary.
5. Use `jump_to_event` or `jump_to_timestamp` only when the user asks to see, play, or open the source moment. Report if the player has no seekable window.
6. Use `create_watch_rule` for an explicit topic-monitoring request. Use `get_recent_events` to report matches.

## Paired browser mode

Prefer registered WebMCP tools. On the LiveSignal workspace, browser-control agents that cannot directly surface `document.modelContext` may invoke the identical registered handlers through `#livesignal-page-agent-bridge`. Confirm `document.documentElement.dataset.livesignalPageAgent === "ready"`, set the element's `data-request` to JSON containing a unique `requestId`, tool `name`, and `input`, dispatch the ordinary `livesignal:page-tool-call` window event, then poll the element's JSON text until the matching response arrives. Treat `{ok:false}` as a tool error. This bridge is the Codex/browser-control compatibility transport; it does not replace WebMCP registration.

On a YouTube or Twitch source page, use the evidence snapshot as the compatibility path. Confirm `document.documentElement.dataset.livesignalAgent === "ready"`, then read and parse the ordinary DOM output `#livesignal-agent-state`. It contains current state, committed transcript segments, recent events, and watch rules. Poll it while listening; use normal browser controls for discovery, navigation, and seeking.

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
- “I kept your new layout, shortened the preparation card to fit, and preserved its two source moments. The canvas is ready for your review or PNG export.”
- “I picked up your note on the temperature card, checked two more brewing videos, and added the dark-roast exception with both new timestamps.”
