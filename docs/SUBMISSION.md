# LiveSignal — submission notes

## Elevator pitch (under 200 characters)

LiveSignal turns fragmented YouTube knowledge into a cited visual canvas that people and agents research, arrange, refine, and share together.

## Inspiration

Useful knowledge is scattered across hours of video. An agent can summarize it, but a finished chat answer still leaves the person outside the creative process. We wanted the agent to do the watching and evidence work while the human brings taste, priorities, and personal context to a shared artifact.

## What it does

LiveSignal is a WebMCP-powered research and creation desk. An agent can create a brief, select YouTube sources, record timestamped evidence, and draft a visual guide. The human can then move, resize, rewrite, restyle, or add blocks on the same canvas. Those edits become structured revision events the active agent can inspect and react to without replacing the human's composition. A human can also art-direct an illustration from any selected card through the same comment loop; the generated artwork is visibly labelled and kept separate from evidence. The result exports as a shareable PNG, while the underlying evidence report remains downloadable as Markdown.

## How we built it

The web app registers 36 semantic WebMCP tools for the entire workflow: research setup, source and evidence ingestion, report writing, canvas creation, renewable collaboration waits, scoped block updates, human comments, card illustration, ordering, theme changes, revision acknowledgement, source navigation, and export. The React canvas stores source IDs and evidence IDs with each research block. AI-generated image bytes are returned through a same-origin server route and kept out of WebMCP payloads. A Manifest V3 adapter supplies a compatibility path for evidence gathered on existing YouTube and Twitch pages, including optional user-approved realtime transcription.

## Challenges we ran into

The first version stopped when the report was generated. That was useful automation, but weak collaboration. The harder design problem was giving human layout actions semantic meaning the agent could understand while protecting authorship: moving one card must not authorize regenerating the whole canvas. We also had to keep sourced claims, personal notes, and unsupported statements visibly distinct.

## Accomplishments that we're proud of

- One visible artifact shared by a human and an agent instead of a hidden agent workflow.
- Structured canvas tools for scoped edits, reordering, themes, and export.
- A revision stream that lets an active agent respond to human changes without wiping them out.
- Human-directed card illustrations created inside the same live collaboration thread, without confusing artwork with source proof.
- Timestamp evidence that remains attached as content moves through the layout.
- A universal blank-state flow that judges can test with a topic of their choice.

## What we learned

Human-agent collaboration needs alternating turns with persistent state, not a generation step followed by manual cleanup. WebMCP is most valuable when it exposes the person's creative decisions—order, emphasis, wording, and visual mood—as semantic context the agent can respect. We also learned that a shareable final form gives the research a reason to be edited rather than merely consumed.

## What's next for LiveSignal

Add richer freeform canvas geometry, presence and change previews, reusable artifact templates for guides and comparisons, durable projects, and source-aware image selection. Longer term, LiveSignal can become a universal layer for turning video knowledge into trusted visual explainers, itineraries, learning boards, and buying guides.
