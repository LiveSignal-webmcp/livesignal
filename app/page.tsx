"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import "./adapter.css";

type StreamEvent = {
  id: string;
  time: string;
  seconds: number;
  type: "Topic" | "Milestone" | "Alert";
  title: string;
  detail: string;
  quote: string;
};

const events: StreamEvent[] = [
  { id: "launch", time: "00:02:10", seconds: 130, type: "Milestone", title: "The run begins", detail: "The creator starts a new challenge run.", quote: "We are going for a clean run today." },
  { id: "ethereum", time: "00:05:15", seconds: 315, type: "Topic", title: "Ethereum discussion", detail: "A brief discussion about fees and user experience.", quote: "Ethereum fees are getting easier to reason about." },
  { id: "announcement", time: "00:07:30", seconds: 450, type: "Alert", title: "Major announcement", detail: "The creator reveals the next community event.", quote: "Next Thursday, we are opening the community test." },
  { id: "boss", time: "00:09:10", seconds: 550, type: "Milestone", title: "Boss defeated", detail: "The team completes the encounter on its first attempt.", quote: "That is the cleanest finish we have had all week." },
];

type ModelContextDocument = Document & {
  modelContext?: {
    registerTool: (tool: { name: string; description: string; inputSchema?: object; execute: (input: Record<string, unknown>) => unknown }) => Promise<void>;
  };
};

export default function Home() {
  const [selectedId, setSelectedId] = useState("ethereum");
  const [isPlaying, setIsPlaying] = useState(false);
  const [query, setQuery] = useState("");
  const [watchTopic, setWatchTopic] = useState("Ethereum");
  const [watchRules, setWatchRules] = useState<string[]>(["Release date"]);
  const [detectedEvent, setDetectedEvent] = useState<StreamEvent | null>(null);
  const registered = useRef(false);
  const streamEvents = useMemo(() => detectedEvent ? [...events, detectedEvent] : events, [detectedEvent]);
  const selected = streamEvents.find((event) => event.id === selectedId) ?? events[0];
  const liveState = useRef({ events: streamEvents, selected });
  liveState.current = { events: streamEvents, selected };
  const matchingEvents = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? streamEvents.filter((event) => `${event.title} ${event.detail} ${event.quote}`.toLowerCase().includes(term)) : streamEvents;
  }, [query, streamEvents]);

  function selectEvent(event: StreamEvent) { setSelectedId(event.id); setIsPlaying(false); }
  function addWatchRule(topic = watchTopic) {
    const normalized = topic.trim();
    if (!normalized) return;
    setWatchRules((rules) => rules.some((rule) => rule.toLowerCase() === normalized.toLowerCase()) ? rules : [...rules, normalized]);
  }
  function triggerWatchEvent(topic = watchTopic) {
    const normalized = topic.trim() || "Your topic";
    const event = { id: `signal-${normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, time: "00:10:04", seconds: 604, type: "Alert" as const, title: `${normalized} mentioned`, detail: "LiveSignal matched an active watch rule in the stream.", quote: `A new reference to ${normalized} was detected in the live feed.` };
    setDetectedEvent(event);
    setSelectedId(event.id);
    setIsPlaying(false);
  }

  useEffect(() => {
    const page = document as ModelContextDocument;
    if (!page.modelContext || registered.current) return;
    registered.current = true;
    const tool = (name: string, description: string, execute: (input: Record<string, unknown>) => unknown, inputSchema?: object) =>
      page.modelContext?.registerTool({ name, description, inputSchema, execute }).catch(() => undefined);
    tool("get_stream_info", "Returns the current stream title, creator, status, and available source evidence.", () => ({ title: "The Level Up Live Show", creator: "Maya Chen", status: "live replay", currentEvent: liveState.current.selected.title, adapter: "LiveSignal browser adapter" }));
    tool("get_recent_events", "Returns the latest timestamped livestream events with evidence.", () => liveState.current.events);
    tool("search_stream", "Searches event titles, summaries, and transcript evidence for a topic or phrase.", (input) => {
      const search = String(input.query ?? "").toLowerCase();
      return liveState.current.events.filter((event) => `${event.title} ${event.detail} ${event.quote}`.toLowerCase().includes(search));
    }, { type: "object", properties: { query: { type: "string", description: "Topic, person, or phrase to find in the stream." } }, required: ["query"] });
    tool("jump_to_event", "Seeks the visible player, highlights the event, and reveals transcript evidence.", (input) => {
      const event = liveState.current.events.find((item) => item.id === input.eventId);
      if (!event) return { ok: false, error: "Unknown event id" };
      selectEvent(event);
      return { ok: true, timestamp: event.time, title: event.title };
    }, { type: "object", properties: { eventId: { type: "string", description: "The id of the event to show in the player." } }, required: ["eventId"] });
    tool("create_watch_rule", "Creates a visible topic-monitoring rule for this stream.", (input) => {
      const topic = String(input.topic ?? "").trim();
      addWatchRule(topic);
      window.setTimeout(() => triggerWatchEvent(topic), 2400);
      return { ok: Boolean(topic), topic, status: "active" };
    }, { type: "object", properties: { topic: { type: "string", description: "Topic or phrase to monitor in this stream." } }, required: ["topic"] });
  // WebMCP tools deliberately register once for the active stream page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <main>
    <nav className="topbar" aria-label="Primary navigation">
      <a className="brand" href="#top" aria-label="LiveSignal home"><span className="brand-mark" />LiveSignal</a>
      <div className="nav-links"><a href="#watch">Watch</a><a href="#events">Events</a><a href="#how-it-works">How it works</a></div>
      <button className="outline-button" type="button">Open extension</button>
    </nav>

    <section className="hero" id="top">
      <div className="eyebrow"><span className="live-dot" /> LIVE INTELLIGENCE</div>
      <h1>Live video, <em>without</em><br />the watch time.</h1>
      <p>LiveSignal turns streams into evidence-backed events. Ask an agent what happened, what matters, and where to find it.</p>
      <div className="hero-actions"><a className="primary-button" href="#watch">Explore the live demo <span>→</span></a><a className="text-button" href="#how-it-works">See how it works</a></div>
      <div className="signal-line" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
    </section>

    <section className="workspace" id="watch" aria-label="Live stream monitoring demo">
      <div className="stream-header"><div><p className="overline">WATCHING NOW</p><h2>The Level Up Live Show</h2><p className="muted">Maya Chen · Gameplay, product news &amp; community</p></div><div className="stream-status"><span className="live-dot" /> LIVE REPLAY <b>●</b> 1.8K watching</div></div>
      <div className="adapter-bar"><span className="adapter-icon">↗</span><span><b>Browser adapter ready</b> · Player state and semantic events are available to your agent.</span><button type="button" onClick={() => triggerWatchEvent()}>Simulate a signal</button></div>
      {detectedEvent && <button className="signal-notice" type="button" onClick={() => selectEvent(detectedEvent)}><span className="live-dot" /><span><b>New signal: {detectedEvent.title}</b><small>{detectedEvent.time} · View matching evidence</small></span><strong>Show →</strong></button>}
      <div className="monitor-grid">
        <div className="player-panel" aria-label="Stream player">
          <div className="video-stage"><div className="video-grid" /><div className="video-title"><span>LIVE</span> Session 04 / Level Up</div><div className="avatar"><span>MC</span></div><div className="video-copy"><p>CREATOR FEED</p><strong>Building in public,<br />one level at a time.</strong></div><button className="play-button" type="button" aria-label={isPlaying ? "Pause stream" : "Play stream"} onClick={() => setIsPlaying((playing) => !playing)}>{isPlaying ? "Ⅱ" : "▶"}</button><div className="player-controls"><span>{selected.time}</span><div className="track"><i style={{ width: `${Math.min(100, (selected.seconds / 600) * 100)}%` }} /></div><span>10:00</span><span className="volume">◖</span></div></div>
          <div className="evidence-card"><span className={`event-pill ${selected.type.toLowerCase()}`}>{selected.type}</span><div><p>Selected evidence · {selected.time}</p><strong>{selected.title}</strong><span className="quote">“{selected.quote}”</span></div><button type="button" onClick={() => selectEvent(selected)}>Show moment →</button></div>
        </div>
        <aside className="events-panel" id="events"><div className="panel-heading"><div><p className="overline">LIVE TIMELINE</p><h3>Events that matter</h3></div><span>{streamEvents.length} found</span></div><label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this stream" aria-label="Search this stream" /></label><div className="event-list">{matchingEvents.map((event) => <button type="button" className={`event-row ${event.id === selectedId ? "selected" : ""}`} onClick={() => selectEvent(event)} key={event.id}><time>{event.time}</time><span className={`event-dot ${event.type.toLowerCase()}`} /><span><b>{event.title}</b><small>{event.detail}</small></span></button>)}{!matchingEvents.length && <p className="empty-state">No matching events yet.</p>}</div></aside>
      </div>
      <div className="bottom-grid">
        <section className="transcript"><div className="panel-heading"><div><p className="overline">SOURCE EVIDENCE</p><h3>Timestamped transcript</h3></div><button type="button">View all</button></div><p><time>00:05:11</time><span>So the part people keep missing is that the experience has to feel simple.</span></p><p className="active-line"><time>00:05:15</time><span>Ethereum fees are getting easier to reason about, but there is more work to do.</span></p><p><time>00:05:22</time><span>That is why we are testing the new flow with the community next week.</span></p></section>
        <section className="watch-rules"><div className="panel-heading"><div><p className="overline">MONITOR</p><h3>Watch rules</h3></div><span className="rules-count">{watchRules.length} active</span></div><div className="rule-chips">{watchRules.map((rule) => <span key={rule}>{rule}<button type="button" onClick={() => setWatchRules((rules) => rules.filter((item) => item !== rule))} aria-label={`Remove ${rule}`}>×</button></span>)}</div><div className="add-rule"><input value={watchTopic} onChange={(event) => setWatchTopic(event.target.value)} aria-label="Topic to monitor" placeholder="Topic to monitor" /><button type="button" onClick={() => addWatchRule()}>Add</button></div></section>
      </div>
    </section>

    <section className="how" id="how-it-works"><div><p className="eyebrow">BUILT FOR AGENTS, PROVEN FOR HUMANS</p><h2>From a long stream<br />to a clear answer.</h2></div><div className="steps"><p><b>01</b><span>LiveSignal reads stream state, captions, and signals.</span></p><p><b>02</b><span>It creates a compact timeline of evidence-backed events.</span></p><p><b>03</b><span>WebMCP lets an agent search, explain, and show the source.</span></p></div></section>
    <footer><a className="brand" href="#top"><span className="brand-mark" />LiveSignal</a><p>Turn watch time into useful signal.</p><span>WebMCP experiment · 2026</span></footer>
  </main>;
}
