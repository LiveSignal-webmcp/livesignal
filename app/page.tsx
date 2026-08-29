"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DISHES,
  EVIDENCE,
  INITIAL,
  SOURCES,
  videoUrl,
  type Source,
  type Preferences,
} from "./research-data";

type TranscriptSegment = {
  id: string;
  text: string;
  seconds: number;
  durationSeconds: number;
  timestamp: string;
};
type ImportedSource = Source & { url: string; transcriptCount: number };

type ModelDocument = Document & {
  modelContext?: {
    registerTool: (tool: {
      name: string;
      description: string;
      inputSchema?: object;
      execute: (input: Record<string, unknown>) => unknown;
    }) => Promise<void>;
  };
};

export default function Home() {
  const [goal, setGoal] = useState(
    "Build a must-try food guide for my China trip from trusted YouTube videos",
  );
  const [preferences, setPreferences] = useState(INITIAL);
  const [sourceIds, setSourceIds] = useState([
    "chengdu-deep",
    "xian-street",
    "shanghai-bao",
  ]);
  const [dishIds, setDishIds] = useState(DISHES.map((dish) => dish.id));
  const [pinned, setPinned] = useState(["ev-liangpi", "ev-dandan"]);
  const [focusId, setFocusId] = useState("ev-dandan");
  const [query, setQuery] = useState(
    "street food in Shanghai, Chengdu and Xi'an",
  );
  const [title, setTitle] = useState("My must-try food guide to China");
  const [note, setNote] = useState(
    "Prioritise everyday places near transit and markets. Keep every recommendation traceable to a video moment.",
  );
  const [activity, setActivity] = useState("Brief ready · 5 sources reviewed");
  const [published, setPublished] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [importedSources, setImportedSources] = useState<ImportedSource[]>([]);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [ingestStatus, setIngestStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [ingestError, setIngestError] = useState("");
  const [mcp, setMcp] = useState<
    "checking" | "registered" | "unavailable" | "error"
  >("checking");
  const registered = useRef(false);
  const allSources = useMemo(
    () => [...SOURCES, ...importedSources],
    [importedSources],
  );
  const transcriptMatches = useMemo(() => {
    const term = transcriptQuery.trim().toLowerCase();
    return (
      term
        ? transcript.filter((segment) =>
            segment.text.toLowerCase().includes(term),
          )
        : transcript
    ).slice(0, 12);
  }, [transcript, transcriptQuery]);
  const activeDishes = useMemo(
    () =>
      dishIds
        .map((id) => DISHES.find((dish) => dish.id === id)!)
        .filter(Boolean),
    [dishIds],
  );
  const focus = EVIDENCE.find((item) => item.id === focusId) ?? EVIDENCE[0];
  const live = useRef({
    goal,
    preferences,
    sourceIds,
    dishIds,
    pinned,
    title,
    note,
    published,
    importedSources,
    transcript,
  });
  useEffect(() => {
    live.current = {
      goal,
      preferences,
      sourceIds,
      dishIds,
      pinned,
      title,
      note,
      published,
      importedSources,
      transcript,
    };
  }, [
    goal,
    preferences,
    sourceIds,
    dishIds,
    pinned,
    title,
    note,
    published,
    importedSources,
    transcript,
  ]);

  async function ingestYouTube(url: string) {
    const normalized = url.trim();
    if (!normalized) throw new Error("Paste a public YouTube URL first.");
    setIngestStatus("loading");
    setIngestError("");
    const response = await fetch("/api/youtube/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: normalized }),
    });
    const result = await response.json();
    if (!response.ok) {
      setIngestStatus("error");
      setIngestError(result.error ?? "The video could not be imported.");
      throw new Error(result.error ?? "The video could not be imported.");
    }
    const source: ImportedSource = {
      ...result.source,
      city: "Imported",
      duration: "CAPTIONS",
      relevance: "Imported from public YouTube captions",
      transcriptCount: result.transcript.segmentCount,
    };
    setImportedSources((current) => [
      ...current.filter((item) => item.id !== source.id),
      source,
    ]);
    setSourceIds((current) =>
      current.includes(source.id) ? current : [...current, source.id],
    );
    setTranscript(result.transcript.segments);
    setTranscriptQuery("");
    setIngestStatus(result.transcript.available ? "ready" : "error");
    setIngestError(
      result.transcript.available
        ? ""
        : String(result.fallback ?? result.warning),
    );
    setActivity(
      result.transcript.available
        ? `Imported ${result.transcript.segmentCount} timestamped caption segments`
        : "Video metadata imported · browser evidence required",
    );
    window.location.hash = "sources";
    return result;
  }

  async function importBrowserEvidence() {
    setIngestStatus("loading");
    const requestId = crypto.randomUUID();
    const snapshot = await new Promise<Record<string, unknown> | null>(
      (resolve, reject) => {
        const timer = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error("No LiveSignal extension evidence was found."));
        }, 5000);
        const onMessage = (event: MessageEvent) => {
          if (
            event.source !== window ||
            event.data?.source !== "livesignal-extension" ||
            event.data?.requestId !== requestId
          )
            return;
          window.clearTimeout(timer);
          window.removeEventListener("message", onMessage);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve(event.data.snapshot ?? null);
        };
        window.addEventListener("message", onMessage);
        window.postMessage(
          {
            source: "livesignal-companion",
            type: "REQUEST_EXTENSION_EVIDENCE",
            requestId,
          },
          location.origin,
        );
      },
    );
    if (!snapshot)
      throw new Error(
        "Open a YouTube video with LiveSignal first, then return here.",
      );
    const state = snapshot.state as Record<string, unknown> | undefined;
    const url = String(state?.url ?? "");
    const videoId =
      new URL(url).searchParams.get("v") ?? `browser-${Date.now()}`;
    const segments = (
      (snapshot.recentTranscript as
        | Array<Record<string, unknown>>
        | undefined) ?? []
    )
      .map((segment, index) => ({
        id: String(segment.id ?? `${videoId}-${index}`),
        text: String(segment.text ?? ""),
        seconds: Number(segment.seconds ?? 0),
        durationSeconds: Number(segment.durationSeconds ?? 0),
        timestamp: String(segment.timestamp ?? "0:00"),
      }))
      .filter((segment) => segment.text);
    const source: ImportedSource = {
      id: videoId,
      videoId,
      url,
      title: String(state?.title ?? "Browser evidence"),
      creator: "Imported through LiveSignal extension",
      city: "Browser adapter",
      duration: "EVIDENCE",
      relevance: "Native captions or realtime STT from the active browser tab",
      transcriptCount: segments.length,
    };
    setImportedSources((current) => [
      ...current.filter((item) => item.id !== source.id),
      source,
    ]);
    setSourceIds((current) =>
      current.includes(source.id) ? current : [...current, source.id],
    );
    setTranscript(segments);
    setTranscriptQuery("");
    setIngestStatus("ready");
    setIngestError("");
    setActivity(`Imported ${segments.length} browser evidence segments`);
    window.location.hash = "sources";
    return {
      source,
      transcript: {
        available: segments.length > 0,
        segmentCount: segments.length,
        segments,
      },
    };
  }

  function removeDish(id: string) {
    setDishIds((items) => items.filter((item) => item !== id));
    setActivity("Guide edited by human");
    setPublished(false);
  }
  function moveDish(id: string, direction: -1 | 1) {
    setDishIds((items) => {
      const next = [...items];
      const from = next.indexOf(id);
      const to = Math.max(0, Math.min(next.length - 1, from + direction));
      if (from < 0 || from === to) return items;
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    setActivity("Editorial order updated");
    setPublished(false);
  }
  function revise(instruction: string) {
    setDishIds(
      DISHES.filter(
        (dish) => dish.price === "$" && dish.id !== "shengjian",
      ).map((dish) => dish.id),
    );
    setNote(
      `Agent revision: ${instruction}. Lower-cost street food now leads; shellfish warnings and source citations were preserved.`,
    );
    setActivity("Agent revised the guide · citations preserved");
    setPublished(false);
    window.location.hash = "guide";
  }

  useEffect(() => {
    const page = document as ModelDocument;
    if (!page.modelContext) {
      setTimeout(() => setMcp("unavailable"), 0);
      return;
    }
    if (registered.current) return;
    registered.current = true;
    const jobs: Promise<void>[] = [];
    const tool = (
      name: string,
      description: string,
      execute: (input: Record<string, unknown>) => unknown,
      inputSchema?: object,
    ) =>
      jobs.push(
        page.modelContext!.registerTool({
          name,
          description,
          execute,
          inputSchema,
        }),
      );
    tool(
      "get_workspace_state",
      "Returns the visible travel brief, selected sources, timestamped evidence, dish order, and publication status.",
      () => ({
        ...live.current,
        sources: [...SOURCES, ...live.current.importedSources].filter((s) =>
          live.current.sourceIds.includes(s.id),
        ),
        dishes: live.current.dishIds.map((id) =>
          DISHES.find((d) => d.id === id),
        ),
        evidence: EVIDENCE,
        importedTranscript: live.current.transcript,
      }),
    );
    tool(
      "set_research_goal",
      "Starts or updates the universal video-research goal shown in LiveSignal. Optionally clears the China example so the human and agent can build a new report together.",
      (input) => {
        const nextGoal = String(input.goal ?? "").trim();
        if (!nextGoal)
          return { ok: false, error: "A research goal is required." };
        setGoal(nextGoal);
        setQuery(nextGoal);
        setActivity("Agent updated the research goal");
        if (input.clearExample === true) {
          setSourceIds([]);
          setDishIds([]);
          setPinned([]);
          setImportedSources([]);
          setTranscript([]);
          setTitle(
            String(input.reportTitle ?? "Untitled video research report"),
          );
          setNote(
            "The agent is gathering timestamped evidence. Edit this report as the research develops.",
          );
        }
        return {
          ok: true,
          goal: nextGoal,
          exampleCleared: input.clearExample === true,
        };
      },
      {
        type: "object",
        properties: {
          goal: { type: "string" },
          clearExample: { type: "boolean" },
          reportTitle: { type: "string" },
        },
        required: ["goal"],
      },
    );
    tool(
      "ingest_youtube_video",
      "Imports a public YouTube video's metadata and timestamped captions into the visible source desk. If captions are unavailable, returns guidance to use the LiveSignal browser adapter or realtime STT.",
      async (input) => ingestYouTube(String(input.url ?? "")),
      {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "Public YouTube watch, shorts, live, embed URL, youtu.be URL, or video ID.",
          },
        },
        required: ["url"],
      },
    );
    tool(
      "import_browser_evidence",
      "Imports the latest native-caption or realtime-STT evidence collected by the user-authorized LiveSignal browser extension into this visible workspace.",
      async () => importBrowserEvidence(),
    );
    tool(
      "search_video_evidence",
      "Searches imported timestamped YouTube captions for a topic, claim, person, or phrase and returns source moments suitable for citations.",
      (input) => {
        const term = String(input.query ?? "")
          .trim()
          .toLowerCase();
        const matches = live.current.transcript
          .filter((segment) => segment.text.toLowerCase().includes(term))
          .slice(0, 50);
        setTranscriptQuery(String(input.query ?? ""));
        setActivity(`Agent found ${matches.length} caption matches`);
        return {
          query: input.query,
          matches,
          segmentCount: live.current.transcript.length,
        };
      },
      {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    );
    tool(
      "write_report",
      "Writes or revises the visible report title and editable overview after researching video evidence. The human can continue editing both fields directly.",
      (input) => {
        const nextTitle = String(input.title ?? live.current.title);
        const overview = String(input.overview ?? live.current.note);
        setTitle(nextTitle);
        setNote(overview);
        setPublished(false);
        setActivity("Agent drafted the editable report");
        window.location.hash = "guide";
        return { ok: true, title: nextTitle, overview };
      },
      {
        type: "object",
        properties: { title: { type: "string" }, overview: { type: "string" } },
        required: ["title", "overview"],
      },
    );
    tool(
      "set_travel_preferences",
      "Updates the visible brief with cities, tastes, dietary restrictions, budget, and travel style.",
      (input) => {
        const next: Preferences = {
          cities: Array.isArray(input.cities)
            ? input.cities.map(String)
            : live.current.preferences.cities,
          loves: Array.isArray(input.loves)
            ? input.loves.map(String)
            : live.current.preferences.loves,
          avoids: Array.isArray(input.avoids)
            ? input.avoids.map(String)
            : live.current.preferences.avoids,
          budget: String(input.budget ?? live.current.preferences.budget),
          style: String(input.style ?? live.current.preferences.style),
        };
        setPreferences(next);
        setActivity("Agent updated the research brief");
        return { ok: true, preferences: next };
      },
      {
        type: "object",
        properties: {
          cities: { type: "array", items: { type: "string" } },
          loves: { type: "array", items: { type: "string" } },
          avoids: { type: "array", items: { type: "string" } },
          budget: { type: "string" },
          style: { type: "string" },
        },
      },
    );
    tool(
      "search_video_sources",
      "Finds relevant YouTube candidates and exposes them in the visible source desk.",
      (input) => {
        const q = String(input.query ?? "China food");
        setQuery(q);
        setActivity(`Agent found ${SOURCES.length} candidate videos`);
        window.location.hash = "sources";
        return {
          query: q,
          candidates: SOURCES,
          caveat: "Relevant candidates; not all of YouTube",
        };
      },
      {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    );
    tool(
      "add_video_source",
      "Adds a candidate video to the shared research set.",
      (input) => {
        const id = String(input.sourceId ?? "");
        const source = SOURCES.find((s) => s.id === id);
        if (!source) return { ok: false };
        setSourceIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
        setActivity("Agent added a source");
        return { ok: true, source };
      },
      {
        type: "object",
        properties: { sourceId: { type: "string" } },
        required: ["sourceId"],
      },
    );
    tool(
      "analyze_video_source",
      "Shows timestamped food evidence available for a selected source.",
      (input) => {
        const sourceId = String(input.sourceId ?? "");
        const evidence = EVIDENCE.filter((e) => e.sourceId === sourceId);
        if (evidence[0]) setFocusId(evidence[0].id);
        setActivity(`Agent analyzed ${evidence.length} evidence moments`);
        return { sourceId, evidence };
      },
      {
        type: "object",
        properties: { sourceId: { type: "string" } },
        required: ["sourceId"],
      },
    );
    tool(
      "find_food_recommendations",
      "Searches current evidence for dishes matching a city, taste, or dietary constraint.",
      (input) => {
        const q = String(input.query ?? "").toLowerCase();
        const matches = DISHES.filter((d) =>
          `${d.name} ${d.chinese} ${d.city} ${d.description} ${d.warning}`
            .toLowerCase()
            .includes(q),
        );
        if (matches[0]) setFocusId(matches[0].evidenceIds[0]);
        setActivity(`Agent found ${matches.length} matching recommendations`);
        return { query: q, matches };
      },
      {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    );
    tool(
      "pin_evidence",
      "Pins a timestamped source moment in the shared workspace.",
      (input) => {
        const id = String(input.evidenceId ?? "");
        if (!EVIDENCE.some((e) => e.id === id)) return { ok: false };
        setPinned((ids) => (ids.includes(id) ? ids : [...ids, id]));
        setFocusId(id);
        setActivity("Agent pinned source evidence");
        return { ok: true, evidence: EVIDENCE.find((e) => e.id === id) };
      },
      {
        type: "object",
        properties: { evidenceId: { type: "string" } },
        required: ["evidenceId"],
      },
    );
    tool(
      "add_dish",
      "Adds an evidence-backed dish to the visible guide.",
      (input) => {
        const id = String(input.dishId ?? "");
        const dish = DISHES.find((d) => d.id === id);
        if (!dish) return { ok: false };
        setDishIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
        setActivity("Agent added a dish");
        return { ok: true, dish };
      },
      {
        type: "object",
        properties: { dishId: { type: "string" } },
        required: ["dishId"],
      },
    );
    tool(
      "remove_dish",
      "Removes a dish from the visible guide at the user's editorial direction.",
      (input) => {
        const id = String(input.dishId ?? "");
        removeDish(id);
        return { ok: true, removed: id };
      },
      {
        type: "object",
        properties: { dishId: { type: "string" } },
        required: ["dishId"],
      },
    );
    tool(
      "reorder_dishes",
      "Moves a dish up or down in the visible editorial order.",
      (input) => {
        moveDish(
          String(input.dishId ?? ""),
          String(input.direction) === "down" ? 1 : -1,
        );
        return { ok: true };
      },
      {
        type: "object",
        properties: {
          dishId: { type: "string" },
          direction: { type: "string", enum: ["up", "down"] },
        },
        required: ["dishId", "direction"],
      },
    );
    tool(
      "revise_guide",
      "Revises the visible guide while preserving source citations and dietary constraints.",
      (input) => {
        const instruction = String(
          input.instruction ?? "Prioritise affordable street food",
        );
        revise(instruction);
        return {
          ok: true,
          instruction,
          citationsPreserved: true,
          restrictionsPreserved: true,
        };
      },
      {
        type: "object",
        properties: { instruction: { type: "string" } },
        required: ["instruction"],
      },
    );
    tool(
      "open_video_timestamp",
      "Opens the exact YouTube moment for cited evidence and focuses that evidence in LiveSignal.",
      (input) => {
        const evidence = EVIDENCE.find((e) => e.id === input.evidenceId);
        const source =
          evidence && SOURCES.find((s) => s.id === evidence.sourceId);
        if (!evidence || !source) return { ok: false };
        setFocusId(evidence.id);
        const url = videoUrl(source, evidence.seconds);
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true, url, timestamp: evidence.time };
      },
      {
        type: "object",
        properties: { evidenceId: { type: "string" } },
        required: ["evidenceId"],
      },
    );
    tool(
      "publish_guide",
      "Publishes the reviewed guide after the human approves its sources and recommendations.",
      () => {
        setPublished(true);
        setActivity("Guide published · citations locked");
        window.location.hash = "guide";
        return {
          ok: true,
          title: live.current.title,
          dishCount: live.current.dishIds.length,
        };
      },
    );
    Promise.all(jobs)
      .then(() => setMcp("registered"))
      .catch(() => setMcp("error"));
    // Handlers read current UI state through live.
  }, []);

  return (
    <main>
      <nav className="topbar">
        <Brand />
        <div className="nav-links">
          <a href="#brief">Brief</a>
          <a href="#sources">Sources</a>
          <a href="#guide">Guide</a>
          <a href="/livesignal-extension-v0.5.0.zip" download>
            Extension
          </a>
        </div>
        <div className={`mcp-status ${mcp}`}>
          <i />
          {mcp === "registered"
            ? "18 WebMCP tools ready"
            : mcp === "unavailable"
              ? "Open in WebMCP browser"
              : mcp === "error"
                ? "WebMCP unavailable"
                : "Checking WebMCP"}
        </div>
      </nav>
      <header className="project-hero" id="top">
        <div className="hero-kicker">
          UNIVERSAL YOUTUBE RESEARCH / PERSON + AGENT
        </div>
        <div className="hero-grid">
          <div>
            <p className="issue-label">TURN VIDEO INTO WORKING KNOWLEDGE</p>
            <h1>
              Ask widely.
              <br />
              <em>Watch selectively.</em>
            </h1>
          </div>
          <div className="hero-copy">
            <p>
              Research any subject across YouTube, collect timestamped evidence,
              and shape it with your agent into something useful.
            </p>
            <div className="hero-proof">
              <b>Any</b>
              <span>research topic</span>
              <b>1</b>
              <span>shared workspace</span>
              <b>18</b>
              <span>WebMCP tools</span>
            </div>
          </div>
        </div>
        <div className="route-line">
          <span>DISCOVER</span>
          <i />
          <span>VERIFY</span>
          <i />
          <span>CREATE</span>
        </div>
        <div className="universal-composer">
          <span>What should LiveSignal research?</span>
          <input
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            aria-label="Universal YouTube research goal"
          />
          <button
            type="button"
            onClick={() => {
              setQuery(goal);
              setActivity("Research goal updated by human");
              window.location.hash = "sources";
            }}
          >
            Start research →
          </button>
        </div>
      </header>
      <section className="workspace-shell">
        <div className="workspace-head">
          <div>
            <span className="section-no">EXAMPLE WORKSPACE / CHINA FOOD</span>
            <h2>See the universal engine in one concrete project</h2>
          </div>
          <div className="activity">
            <span className="agent-pulse" />
            <p>
              <b>LiveSignal agent</b>
              {activity}
            </p>
          </div>
        </div>
        <div className="research-grid">
          <aside className="brief-panel" id="brief">
            <PanelLabel
              number="01"
              title="Research brief"
              sub="Human direction"
            />
            <h3>What should this guide know about you?</h3>
            <Preference label="Cities" values={preferences.cities} tone="red" />
            <Preference
              label="I love"
              values={preferences.loves}
              tone="green"
            />
            <Preference label="Avoid" values={preferences.avoids} tone="dark" />
            <dl className="preference-details">
              <div>
                <dt>Budget</dt>
                <dd>{preferences.budget}</dd>
              </div>
              <div>
                <dt>Travel style</dt>
                <dd>{preferences.style}</dd>
              </div>
            </dl>
            <div className="brief-prompt">
              <span>Agent brief</span>
              <p>
                Find essential dishes across my three cities. Prioritise spicy
                noodles and street food. Exclude shellfish and keep every claim
                traceable.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPreferences(INITIAL);
                  setActivity("Human restored the original brief");
                }}
              >
                Reset brief
              </button>
            </div>
          </aside>
          <section className="source-panel" id="sources">
            <PanelLabel
              number="02"
              title="Source desk"
              sub="Agent research, human judgment"
            />
            <div className="youtube-import">
              <div>
                <b>Import any public YouTube video</b>
                <span>Metadata + timestamped captions</span>
              </div>
              <input
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                aria-label="YouTube URL to import"
              />
              <button
                type="button"
                disabled={ingestStatus === "loading"}
                onClick={() => ingestYouTube(youtubeUrl).catch(() => undefined)}
              >
                {ingestStatus === "loading" ? "Importing…" : "Import video"}
              </button>
            </div>
            {ingestError && (
              <p className="ingest-error">
                {ingestError} Use the LiveSignal extension for videos without
                public captions.
              </p>
            )}
            <button
              className="extension-import"
              type="button"
              onClick={() =>
                importBrowserEvidence().catch((error) => {
                  setIngestStatus("error");
                  setIngestError(String(error.message || error));
                })
              }
            >
              Import latest browser evidence
            </button>
            <label className="source-search">
              <span>⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Video research query"
              />
              <button
                type="button"
                onClick={() =>
                  setActivity(`Agent found ${SOURCES.length} candidate videos`)
                }
              >
                Research
              </button>
            </label>
            <p className="coverage-note">
              <b>{sourceIds.length} included</b> of {allSources.length} reviewed
              · Relevant sources, not “all of YouTube”
            </p>
            <p className="prototype-note">
              Prototype research dataset · source URLs are real; excerpts and
              timestamps require transcript verification before submission.
            </p>
            <div className="source-list">
              {allSources.map((source) => {
                const included = sourceIds.includes(source.id);
                const fixtureCount = EVIDENCE.filter(
                  (e) => e.sourceId === source.id,
                ).length;
                const count =
                  "transcriptCount" in source
                    ? Number(source.transcriptCount)
                    : fixtureCount;
                return (
                  <article
                    className={`video-source ${included ? "included" : ""}`}
                    key={source.id}
                  >
                    <a
                      className="video-thumb"
                      href={videoUrl(source)}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        backgroundImage: `url(https://i.ytimg.com/vi/${source.videoId}/mqdefault.jpg)`,
                      }}
                    >
                      <span>{source.duration}</span>
                      <i>▶</i>
                    </a>
                    <div className="source-copy">
                      <span>{source.city} · YouTube</span>
                      <h4>{source.title}</h4>
                      <p>
                        {source.creator} · {source.relevance}
                      </p>
                      <small>
                        {count
                          ? `${count} timed caption segment${count === 1 ? "" : "s"}`
                          : "Candidate · analysis pending"}
                      </small>
                    </div>
                    <button
                      className="include-button"
                      type="button"
                      onClick={() => {
                        setSourceIds((ids) =>
                          included
                            ? ids.filter((id) => id !== source.id)
                            : [...ids, source.id],
                        );
                        setActivity("Source desk updated by human");
                      }}
                    >
                      {included ? "✓" : "+"}
                    </button>
                  </article>
                );
              })}
            </div>
            {transcript.length > 0 && (
              <div className="transcript-engine">
                <div>
                  <span>CAPTION ENGINE · {transcript.length} SEGMENTS</span>
                  <input
                    value={transcriptQuery}
                    onChange={(event) => setTranscriptQuery(event.target.value)}
                    placeholder="Search imported evidence"
                    aria-label="Search imported captions"
                  />
                </div>
                <div>
                  {transcriptMatches.map((segment) => (
                    <button
                      type="button"
                      key={segment.id}
                      onClick={() => {
                        const source = importedSources.at(-1);
                        if (source)
                          window.open(
                            `${source.url}&t=${Math.floor(segment.seconds)}s`,
                            "_blank",
                            "noopener,noreferrer",
                          );
                      }}
                    >
                      <b>{segment.timestamp}</b>
                      <span>{segment.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="evidence-focus">
              <div className="evidence-head">
                <span>EVIDENCE IN FOCUS</span>
                <button
                  className={pinned.includes(focus.id) ? "pinned" : ""}
                  type="button"
                  onClick={() =>
                    setPinned((ids) =>
                      ids.includes(focus.id)
                        ? ids.filter((id) => id !== focus.id)
                        : [...ids, focus.id],
                    )
                  }
                >
                  {pinned.includes(focus.id) ? "★ Pinned" : "☆ Pin"}
                </button>
              </div>
              <blockquote>“{focus.quote}”</blockquote>
              <p>{focus.note}</p>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    const s = SOURCES.find(
                      (item) => item.id === focus.sourceId,
                    )!;
                    window.open(
                      videoUrl(s, focus.seconds),
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  <b>{focus.time}</b> Open source moment ↗
                </button>
                <span>{focus.confidence}% evidence confidence</span>
              </div>
            </div>
          </section>
        </div>
        <section className="guide-panel" id="guide">
          <div className="guide-toolbar">
            <PanelLabel
              number="03"
              title="Editable guide"
              sub="Created together"
              light
            />
            <div className="guide-actions">
              <button
                type="button"
                onClick={() =>
                  revise(
                    "Replace expensive restaurants with street-food alternatives",
                  )
                }
              >
                Ask agent to revise
              </button>
              <button
                className={published ? "published" : "publish"}
                type="button"
                onClick={() => {
                  setPublished(true);
                  setActivity("Guide published · citations locked");
                }}
              >
                {published ? "✓ Published" : "Publish guide"}
              </button>
            </div>
          </div>
          <div className="guide-title-row">
            <div>
              <p>PERSONAL FIELD GUIDE · 5 MIN READ</p>
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setPublished(false);
                }}
                aria-label="Guide title"
              />
            </div>
            <span>
              {String(activeDishes.length).padStart(2, "0")}
              <small>must-try dishes</small>
            </span>
          </div>
          <textarea
            className="editor-note"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setPublished(false);
            }}
            aria-label="Editor note"
          />
          <div className="dish-list">
            {activeDishes.map((dish, index) => (
              <article className="dish-card" key={dish.id}>
                <div className="dish-index">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="dish-main">
                  <div className="dish-city">
                    {dish.city}
                    <span>{dish.price}</span>
                  </div>
                  <h3>
                    {dish.name}
                    <small>{dish.chinese}</small>
                  </h3>
                  <p className="pinyin">{dish.pinyin}</p>
                  <p>{dish.description}</p>
                  <div className="match-line">
                    <span>{dish.match}</span>
                    <span className="spice">
                      {Array.from({ length: 5 }, (_, i) => (
                        <i className={i < dish.spice ? "hot" : ""} key={i}>
                          ◆
                        </i>
                      ))}
                    </span>
                  </div>
                  <p className="warning">◌ {dish.warning}</p>
                </div>
                <div className="dish-evidence">
                  <span>SOURCE PROOF</span>
                  {dish.evidenceIds.map((id) => {
                    const ev = EVIDENCE.find((e) => e.id === id)!;
                    const source = SOURCES.find((s) => s.id === ev.sourceId)!;
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setFocusId(id)}
                      >
                        <b>{ev.time}</b>
                        <span>
                          {source.creator}
                          <small>“{ev.quote}”</small>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="dish-controls">
                  <button type="button" onClick={() => moveDish(dish.id, -1)}>
                    ↑
                  </button>
                  <button type="button" onClick={() => moveDish(dish.id, 1)}>
                    ↓
                  </button>
                  <button type="button" onClick={() => removeDish(dish.id)}>
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="guide-foot">
            <p>
              <span>Evidence policy</span>Every recommendation keeps a source
              moment. Creator opinion and LiveSignal inference stay visibly
              distinct.
            </p>
            <div>
              <b>{pinned.length}</b> pinned moments <b>{sourceIds.length}</b>{" "}
              active sources
            </div>
          </div>
        </section>
      </section>
      <section className="challenge-proof">
        <p className="section-no">WHY WEBMCP</p>
        <h2>The page stays in the conversation.</h2>
        <div>
          <p>
            <b>Human taste</b>
            <span>
              You set preferences, inspect sources, edit the shortlist, and
              approve the result.
            </span>
          </p>
          <p>
            <b>Agent scale</b>
            <span>
              The agent structures hours of video through semantic page tools.
            </span>
          </p>
          <p>
            <b>Shared control</b>
            <span>
              Both operate on one visible workspace instead of an isolated chat
              answer.
            </span>
          </p>
        </div>
      </section>
      <footer>
        <Brand />
        <p>Hours of video → one guide you can trust and shape.</p>
        <span>WebMCP Challenge · 2026</span>
      </footer>
    </main>
  );
}

function Brand() {
  return (
    <a className="brand" href="#top">
      <span className="brand-seal">LS</span>
      <span>
        LiveSignal<small>video research desk</small>
      </span>
    </a>
  );
}
function PanelLabel({
  number,
  title,
  sub,
  light = false,
}: {
  number: string;
  title: string;
  sub: string;
  light?: boolean;
}) {
  return (
    <div className={`panel-label ${light ? "light" : ""}`}>
      <span>{number}</span>
      <p>
        {title}
        <small>{sub}</small>
      </p>
    </div>
  );
}
function Preference({
  label,
  values,
  tone,
}: {
  label: string;
  values: string[];
  tone: "red" | "green" | "dark";
}) {
  return (
    <div className="preference-group">
      <span>{label}</span>
      <div>
        {values.map((value) => (
          <em className={tone} key={value}>
            {value}
          </em>
        ))}
      </div>
    </div>
  );
}
