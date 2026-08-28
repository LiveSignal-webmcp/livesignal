# LiveSignal demo script (2 minutes 30 seconds)

## Setup before recording

- Use a public YouTube live replay that has a transcript and a seekable playback window.
- Open YouTube's transcript panel before the recording starts.
- Load the LiveSignal extension and use a WebMCP-enabled browser with an agent available.
- Keep the Companion page open in a separate tab only for the product overview; use the YouTube page for the real proof.

## Script

### 0:00–0:18 — the problem

"The information I need is buried in livestreams, but I do not have time to watch them. An agent can click a player, but it cannot give me evidence for what happened."

Show the LiveSignal Companion and its three actions: discover, search, and show the source.

### 0:18–0:38 — discovery

Prompt the Companion: "Find a livestream about [chosen topic] on YouTube."

Show the current YouTube search link opening. Say: "LiveSignal does not rebuild YouTube. It adapts the selected page."

### 0:38–1:15 — real evidence

On the prepared YouTube page, ask: "What does this stream say about [a phrase known to occur]? Give me the evidence."

Show `search_stream` returning transcript matches with timestamps. Then ask: "Show me the strongest match." Show `jump_to_event` moving the real player to that point and the matching transcript line in YouTube.

### 1:15–1:45 — focused monitoring

Ask: "Monitor this transcript for [a phrase that appears later]."

Show `create_watch_rule`, then `get_recent_events`. The returned event includes the topic, timestamp, and the exact transcript evidence. Explain: "For the prototype, rules deliberately last only in this tab. We are not pretending it sends unattended notifications."

### 1:45–2:12 — WebMCP connection

Show the extension's visible status badge and explain: "The adapter registers semantic tools—transcript search, events, and time navigation—rather than asking an agent to scrape pixels or guess how to operate the player."

### 2:12–2:30 — close

"LiveSignal turns a long stream into a queryable event feed. Agents can find what matters and show why, so people get the signal without the watch time."

## Avoid in the recording

- Do not claim that LiveSignal performs audio transcription, visual analysis, or background alerts.
- Do not use the seeded Companion timeline as proof of live stream extraction; label it as the interaction demo.
- Do not rely on a video without an accessible YouTube transcript.
