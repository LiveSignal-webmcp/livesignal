# LiveSignal — submission notes

## Elevator pitch (under 200 characters)

LiveSignal turns livestreams into searchable, evidence-backed events so agents can find what matters and show the exact moment—without making people watch for hours.

## Inspiration

The useful information in a livestream is often one sentence in a two-hour feed: a release date, a product change, a creator's opinion, or an answer to a question. People miss it because they cannot watch everything. Agents should be able to gather that information, but generic browser control does not make a stream queryable or provide evidence for an answer.

## What it does

LiveSignal helps an agent discover streams on existing platforms, inspect a supported stream's state, search timestamped transcript evidence, make focused in-tab watch rules, and jump the player to the supporting moment. The web Companion demonstrates the experience; the browser adapter makes the real YouTube transcript path available through WebMCP.

## How we built it

The Companion page registers semantic WebMCP tools for discovery, stream search, event retrieval, timestamp navigation, and watch rules. The Manifest V3 browser adapter runs on YouTube and Twitch pages. On YouTube, it reads only transcript segments that YouTube renders in its own transcript panel, normalizes them into timestamped records, searches them, creates deduplicated topic-match events, and seeks the existing video element to supporting evidence.

## Challenges we ran into

WebMCP tools are registered by pages, but the product value is on third-party livestream sites. We treated the extension as the compatibility layer and kept the Companion page as the reliable on-site demo. A second constraint was avoiding overclaiming: not all streams have transcripts, live player DVR windows differ, and a tab-local prototype cannot honestly promise persistent background monitoring.

## Accomplishments that we're proud of

- A real evidence loop: agent query → transcript result → actual player seek.
- Semantic tools instead of fragile click or pixel automation.
- An adapter approach that adds value to existing platforms instead of rebuilding them.
- Explicit product boundaries: the demo timeline is labeled seeded data, and the real adapter reports missing transcript evidence instead of fabricating it.

## What we learned

For agents, a timestamp alone is not enough. The useful primitive is a timestamp paired with source evidence and a reliable action to open it. We also learned that a small, dependable integration on one platform is much more persuasive than a broad claim across every livestream service.

## What's next for LiveSignal

Add durable user-approved watch rules, transcript ingestion that works when a platform exposes captions but not a transcript drawer, server-side event history, and additional platform adapters. We would also add clear confidence and source labels for richer audio and visual event extraction before expanding the product promise.
