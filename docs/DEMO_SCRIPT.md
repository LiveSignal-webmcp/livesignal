# LiveSignal demo script (2 minutes 30 seconds)

## Setup before recording

- Use the universal LiveSignal workspace with WebMCP available in the browser agent.
- Pick a visually appealing topic with fragmented advice across YouTube, such as regional food, balcony gardening, or a travel itinerary.
- Pre-check three public videos with useful caption evidence; do not pre-seed the workspace.
- Keep the final canvas empty at the start so the agent creation is visible.

## Script

### 0:00–0:18 — the problem

“The best practical knowledge is often scattered across long videos. A chat summary saves time, but it still leaves the human with a generic wall of text and no good way to shape the result.”

Show the empty workspace and empty creation canvas.

### 0:18–0:58 — agent research

Ask ChatGPT: “Research the best beginner advice for [topic] across three YouTube videos. Build a cited visual guide in LiveSignal.”

Show the agent using the page tools to create the brief, add sources, record timestamped evidence, write the evidence draft, and create the canvas. Open one citation moment to prove the content came from the selected video.

### 0:58–1:28 — human composition

Drag the most useful card to the top, make it wide, switch the canvas mood, edit one title, and add a personal note. Explain that every action creates a structured revision event in the same page—order, copy, size, and theme—not an opaque DOM mutation.

### 1:28–1:53 — agent reaction

Click “Save & send to agent.” Do not send another ChatGPT message. The waiting agent receives the semantic change batch, understands that the card is now more prominent, shortens only that card, and preserves its evidence.

Show `wait_for_collaboration_event` return the saved layout change, followed by a scoped `update_canvas_block` call. The human's order and other cards remain unchanged. The evidence markers stay attached. Show the revision state return to caught up and the agent resume listening.

### 1:53–2:18 — art-direct together

Select one card, choose “Create visual,” and comment: “Make this a warm hand-drawn editorial illustration.” The listening agent claims the comment and calls `generate_canvas_image` for that card. Show the image appear with the “AI-generated illustration” label while the written evidence markers remain separate. This is the collaboration: research judgment, human art direction, and agent creation alternate on one visible artifact.

### 2:18–2:30 — share

Download the canvas as a PNG. Close with: “LiveSignal turns fragmented video knowledge into something people can verify, shape together with an agent, and actually want to share.”

## Judge test

Invite the judge to choose any topic. The normal flow must begin with `begin_research`; the China food example is optional and never required for the engine to work.

## Honest boundaries

- The agent reacts while it is active in the browser session; an idle model is not silently awakened by a canvas edit.
- Keep researched claims linked to timestamp evidence. Label personal notes as personal rather than inventing a citation.
- If a video has no accessible captions, report that limitation or use the explicitly approved realtime transcription path.
