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

### 1:28–1:58 — agent reaction

Ask ChatGPT: “I moved the practical constraint to the top. Shorten it so it fits and make sure the claim is still supported.”

Show the agent reading `get_canvas_state` and `get_human_revisions`, then using a scoped `update_canvas_block` call. The human's order and other cards remain unchanged. The evidence markers stay attached. Show the revision state return to caught up.

### 1:58–2:18 — co-create one more idea

Ask: “Add one missing tip from the sources as a small note.” Show the agent add a single cited block. Then manually tweak its title. This is the collaboration: research judgment and layout judgment alternate on one visible artifact.

### 2:18–2:30 — share

Download the canvas as a PNG. Close with: “LiveSignal turns fragmented video knowledge into something people can verify, shape together with an agent, and actually want to share.”

## Judge test

Invite the judge to choose any topic. The normal flow must begin with `begin_research`; the China food example is optional and never required for the engine to work.

## Honest boundaries

- The agent reacts while it is active in the browser session; an idle model is not silently awakened by a canvas edit.
- Keep researched claims linked to timestamp evidence. Label personal notes as personal rather than inventing a citation.
- If a video has no accessible captions, report that limitation or use the explicitly approved realtime transcription path.
