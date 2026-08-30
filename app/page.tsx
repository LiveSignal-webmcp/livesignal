"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DISHES,
  EVIDENCE,
  SOURCES,
  videoUrl,
  type Source,
} from "./research-data";

type TranscriptSegment = {
  id: string;
  text: string;
  seconds: number;
  durationSeconds: number;
  timestamp: string;
};

type ResearchSource = Source & {
  url: string;
  transcriptCount: number;
};

type EvidenceItem = TranscriptSegment & {
  sourceId: string;
  note?: string;
  confidence?: number;
};

type ResearchBrief = {
  mustCover: string;
  constraints: string;
  outputFormat: string;
};

type ReportSection = {
  id: string;
  heading: string;
  body: string;
  evidenceIds: string[];
};

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

const EMPTY_BRIEF: ResearchBrief = {
  mustCover: "",
  constraints: "",
  outputFormat: "Concise, evidence-backed report",
};

const EXAMPLE_BRIEF: ResearchBrief = {
  mustCover: "Essential dishes in Shanghai, Chengdu, and Xi’an",
  constraints: "Prioritise spicy noodles and street food. Avoid shellfish.",
  outputFormat: "A practical 5-minute field guide",
};

const TOOL_COUNT = 16;

function timestampUrl(source: ResearchSource, seconds = 0) {
  const base = source.url || videoUrl(source);
  if (!seconds) return base;
  try {
    const url = new URL(base);
    url.searchParams.set("t", `${Math.floor(seconds)}s`);
    return url.toString();
  } catch {
    return `${base}${base.includes("?") ? "&" : "?"}t=${Math.floor(seconds)}s`;
  }
}

function exampleWorkspace() {
  const sources: ResearchSource[] = SOURCES.map((source) => ({
    ...source,
    url: videoUrl(source),
    transcriptCount: EVIDENCE.filter(
      (evidence) => evidence.sourceId === source.id,
    ).length,
  }));
  const evidence: EvidenceItem[] = EVIDENCE.map((item) => ({
    id: item.id,
    sourceId: item.sourceId,
    text: item.quote,
    note: item.note,
    seconds: item.seconds,
    durationSeconds: 0,
    timestamp: item.time,
    confidence: item.confidence,
  }));
  const sections: ReportSection[] = DISHES.map((dish) => ({
    id: dish.id,
    heading: `${dish.name} · ${dish.city}`,
    body: `${dish.description} ${dish.warning}`,
    evidenceIds: dish.evidenceIds,
  }));
  return { sources, evidence, sections };
}

export default function Home() {
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState(EMPTY_BRIEF);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [focusEvidenceId, setFocusEvidenceId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [reportTitle, setReportTitle] = useState("Untitled research report");
  const [reportOverview, setReportOverview] = useState("");
  const [reportSections, setReportSections] = useState<ReportSection[]>([]);
  const [activity, setActivity] = useState("Workspace ready for a new topic");
  const [published, setPublished] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ingestStatus, setIngestStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [ingestError, setIngestError] = useState("");
  const [mcp, setMcp] = useState<
    "checking" | "registered" | "unavailable" | "error"
  >("checking");
  const registered = useRef(false);

  const focusEvidence = useMemo(
    () => evidence.find((item) => item.id === focusEvidenceId) ?? evidence[0],
    [evidence, focusEvidenceId],
  );
  const visibleEvidence = useMemo(() => {
    const term = evidenceQuery.trim().toLowerCase();
    return (
      term
        ? evidence.filter((item) => item.text.toLowerCase().includes(term))
        : evidence
    ).slice(0, 18);
  }, [evidence, evidenceQuery]);

  const live = useRef({
    goal,
    brief,
    sources,
    evidence,
    pinnedIds,
    reportTitle,
    reportOverview,
    reportSections,
    published,
  });

  useEffect(() => {
    live.current = {
      goal,
      brief,
      sources,
      evidence,
      pinnedIds,
      reportTitle,
      reportOverview,
      reportSections,
      published,
    };
  }, [
    goal,
    brief,
    sources,
    evidence,
    pinnedIds,
    reportTitle,
    reportOverview,
    reportSections,
    published,
  ]);

  function startResearch(nextGoal = goal) {
    const cleanGoal = nextGoal.trim();
    if (!cleanGoal) return;
    setGoal(cleanGoal);
    setSearchQuery(cleanGoal);
    setBrief(EMPTY_BRIEF);
    setSources([]);
    setEvidence([]);
    setPinnedIds([]);
    setFocusEvidenceId("");
    setReportTitle("Untitled research report");
    setReportOverview("");
    setReportSections([]);
    setPublished(false);
    setIngestError("");
    setActivity(`New research started · ${cleanGoal}`);
    window.location.hash = "brief";
  }

  function loadExample() {
    const example = exampleWorkspace();
    setGoal(
      "Build a must-try food guide for my China trip from trusted YouTube videos",
    );
    setSearchQuery("Chinese street food Shanghai Chengdu Xi’an");
    setBrief(EXAMPLE_BRIEF);
    setSources(example.sources);
    setEvidence(example.evidence);
    setPinnedIds(["ev-liangpi", "ev-dandan"]);
    setFocusEvidenceId("ev-dandan");
    setReportTitle("My must-try food guide to China");
    setReportOverview(
      "A source-backed shortlist for a traveller who loves spicy noodles and everyday street food.",
    );
    setReportSections(example.sections);
    setPublished(false);
    setIngestError("");
    setActivity("China food example loaded · replace it with any topic");
    window.location.hash = "brief";
  }

  function openYouTubeSearch(query = searchQuery || goal) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return { ok: false, error: "A search query is required." };
    setSearchQuery(cleanQuery);
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    setActivity(`YouTube search opened · ${cleanQuery}`);
    window.open(url, "_blank", "noopener,noreferrer");
    return { ok: true, query: cleanQuery, url };
  }

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
      const message = result.error ?? "The video could not be imported.";
      setIngestStatus("error");
      setIngestError(message);
      throw new Error(message);
    }
    const segments = (result.transcript.segments as TranscriptSegment[]).map(
      (segment) => ({ ...segment, sourceId: String(result.source.id) }),
    );
    const source: ResearchSource = {
      id: String(result.source.id),
      videoId: String(result.source.videoId),
      url: String(result.source.url),
      title: String(result.source.title),
      creator: String(result.source.creator),
      city: "YouTube",
      duration: result.transcript.available ? "CAPTIONS" : "METADATA",
      relevance: result.transcript.available
        ? "Timestamped public captions imported"
        : "Open with the browser adapter to collect evidence",
      transcriptCount: segments.length,
    };
    setSources((current) => [
      ...current.filter((item) => item.id !== source.id),
      source,
    ]);
    setEvidence((current) => [
      ...current.filter((item) => item.sourceId !== source.id),
      ...segments,
    ]);
    if (segments[0]) setFocusEvidenceId(segments[0].id);
    setEvidenceQuery("");
    setIngestStatus(result.transcript.available ? "ready" : "error");
    setIngestError(
      result.transcript.available
        ? ""
        : String(result.fallback ?? result.warning ?? "Captions unavailable."),
    );
    setActivity(
      result.transcript.available
        ? `Imported ${segments.length} timestamped caption segments`
        : "Video found · browser evidence needed for captions",
    );
    window.location.hash = "sources";
    return result;
  }

  async function importBrowserEvidence() {
    setIngestStatus("loading");
    setIngestError("");
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
    let videoId = `browser-${Date.now()}`;
    try {
      videoId = new URL(url).searchParams.get("v") ?? videoId;
    } catch {
      // Non-YouTube adapters can still provide evidence.
    }
    const segments = (
      (snapshot.recentTranscript as
        Array<Record<string, unknown>> | undefined) ?? []
    )
      .map((segment, index): EvidenceItem => ({
        id: String(segment.id ?? `${videoId}-${index}`),
        sourceId: videoId,
        text: String(segment.text ?? ""),
        seconds: Number(segment.seconds ?? 0),
        durationSeconds: Number(segment.durationSeconds ?? 0),
        timestamp: String(segment.timestamp ?? "0:00"),
      }))
      .filter((segment) => segment.text);
    const source: ResearchSource = {
      id: videoId,
      videoId,
      url,
      title: String(state?.title ?? "Browser evidence"),
      creator: "LiveSignal browser adapter",
      city: "Browser",
      duration: "EVIDENCE",
      relevance: "Native captions or realtime STT from the active tab",
      transcriptCount: segments.length,
    };
    setSources((current) => [
      ...current.filter((item) => item.id !== source.id),
      source,
    ]);
    setEvidence((current) => [
      ...current.filter((item) => item.sourceId !== source.id),
      ...segments,
    ]);
    if (segments[0]) setFocusEvidenceId(segments[0].id);
    setIngestStatus("ready");
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

  function pinEvidence(id: string) {
    setPinnedIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
    setFocusEvidenceId(id);
    setActivity("Evidence selection updated");
  }

  function addReportSection(section?: Partial<ReportSection>) {
    const next: ReportSection = {
      id: section?.id ?? crypto.randomUUID(),
      heading: section?.heading ?? "New finding",
      body: section?.body ?? "Write the finding, then attach source evidence.",
      evidenceIds: section?.evidenceIds ?? [],
    };
    setReportSections((current) => [...current, next]);
    setPublished(false);
    setActivity("Report section added");
    return next;
  }

  function updateReportSection(id: string, patch: Partial<ReportSection>) {
    setReportSections((current) =>
      current.map((section) =>
        section.id === id ? { ...section, ...patch, id } : section,
      ),
    );
    setPublished(false);
  }

  function moveReportSection(id: string, direction: -1 | 1) {
    setReportSections((current) => {
      const next = [...current];
      const from = next.findIndex((section) => section.id === id);
      const to = Math.max(0, Math.min(next.length - 1, from + direction));
      if (from < 0 || from === to) return current;
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
    setPublished(false);
    setActivity("Editorial order updated");
  }

  useEffect(() => {
    const page = document as ModelDocument;
    if (!page.modelContext) {
      window.setTimeout(() => setMcp("unavailable"), 0);
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
      "Returns the current visible research brief, sources, timestamped evidence, editable report, and publication status.",
      () => live.current,
    );
    tool(
      "set_research_goal",
      "Starts a clean video-research workspace for any topic. This visibly clears the previous project.",
      (input) => {
        const nextGoal = String(input.goal ?? "").trim();
        if (!nextGoal) return { ok: false, error: "A goal is required." };
        startResearch(nextGoal);
        return { ok: true, goal: nextGoal };
      },
      {
        type: "object",
        properties: { goal: { type: "string" } },
        required: ["goal"],
      },
    );
    tool(
      "update_research_brief",
      "Updates the visible must-cover points, constraints, and desired output format before or during research.",
      (input) => {
        const next = {
          mustCover: String(input.mustCover ?? live.current.brief.mustCover),
          constraints: String(
            input.constraints ?? live.current.brief.constraints,
          ),
          outputFormat: String(
            input.outputFormat ?? live.current.brief.outputFormat,
          ),
        };
        setBrief(next);
        setActivity("Agent updated the research brief");
        return { ok: true, brief: next };
      },
      {
        type: "object",
        properties: {
          mustCover: { type: "string" },
          constraints: { type: "string" },
          outputFormat: { type: "string" },
        },
      },
    );
    tool(
      "open_youtube_search",
      "Opens YouTube search for any topic so the agent and human can choose real candidate videos together.",
      (input) => openYouTubeSearch(String(input.query ?? "")),
      {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    );
    tool(
      "ingest_youtube_video",
      "Imports a public YouTube video's metadata and timestamped captions into the visible workspace.",
      async (input) => ingestYouTube(String(input.url ?? "")),
      {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"],
      },
    );
    tool(
      "import_browser_evidence",
      "Imports the latest caption or realtime-STT evidence collected by the user-authorized LiveSignal browser extension.",
      async () => importBrowserEvidence(),
    );
    tool(
      "search_video_evidence",
      "Searches all imported timestamped evidence for a topic, claim, name, or phrase.",
      (input) => {
        const query = String(input.query ?? "").trim();
        const matches = live.current.evidence
          .filter((item) =>
            item.text.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 50);
        setEvidenceQuery(query);
        setActivity(`Agent found ${matches.length} evidence matches`);
        return { query, matches };
      },
      {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    );
    tool(
      "pin_evidence",
      "Pins or unpins a timestamped source moment for the shared report.",
      (input) => {
        const id = String(input.evidenceId ?? "");
        const item = live.current.evidence.find((entry) => entry.id === id);
        if (!item) return { ok: false, error: "Evidence not found." };
        pinEvidence(id);
        return { ok: true, evidence: item };
      },
      {
        type: "object",
        properties: { evidenceId: { type: "string" } },
        required: ["evidenceId"],
      },
    );
    tool(
      "add_report_section",
      "Adds an editable, evidence-backed section to the visible report.",
      (input) => ({
        ok: true,
        section: addReportSection({
          heading: String(input.heading ?? "New finding"),
          body: String(input.body ?? ""),
          evidenceIds: Array.isArray(input.evidenceIds)
            ? input.evidenceIds.map(String)
            : [],
        }),
      }),
      {
        type: "object",
        properties: {
          heading: { type: "string" },
          body: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["heading", "body"],
      },
    );
    tool(
      "update_report_section",
      "Revises one visible report section while keeping its timestamp citations explicit.",
      (input) => {
        const id = String(input.sectionId ?? "");
        updateReportSection(id, {
          heading:
            input.heading === undefined ? undefined : String(input.heading),
          body: input.body === undefined ? undefined : String(input.body),
          evidenceIds: Array.isArray(input.evidenceIds)
            ? input.evidenceIds.map(String)
            : undefined,
        });
        setActivity("Agent revised a report section");
        return { ok: true, sectionId: id };
      },
      {
        type: "object",
        properties: {
          sectionId: { type: "string" },
          heading: { type: "string" },
          body: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["sectionId"],
      },
    );
    tool(
      "remove_report_section",
      "Removes a report section at the user's editorial direction.",
      (input) => {
        const id = String(input.sectionId ?? "");
        setReportSections((current) =>
          current.filter((section) => section.id !== id),
        );
        setPublished(false);
        setActivity("Report section removed");
        return { ok: true, removed: id };
      },
      {
        type: "object",
        properties: { sectionId: { type: "string" } },
        required: ["sectionId"],
      },
    );
    tool(
      "reorder_report_sections",
      "Moves a report section up or down in the human-controlled editorial order.",
      (input) => {
        moveReportSection(
          String(input.sectionId ?? ""),
          String(input.direction) === "down" ? 1 : -1,
        );
        return { ok: true };
      },
      {
        type: "object",
        properties: {
          sectionId: { type: "string" },
          direction: { type: "string", enum: ["up", "down"] },
        },
        required: ["sectionId", "direction"],
      },
    );
    tool(
      "write_report",
      "Writes a complete editable report from researched evidence. Each section may cite evidence IDs.",
      (input) => {
        const nextTitle = String(input.title ?? "Untitled research report");
        const nextOverview = String(input.overview ?? "");
        const nextSections = Array.isArray(input.sections)
          ? (input.sections as Array<Record<string, unknown>>).map(
              (section, index): ReportSection => ({
                id: String(section.id ?? `section-${Date.now()}-${index}`),
                heading: String(section.heading ?? `Finding ${index + 1}`),
                body: String(section.body ?? ""),
                evidenceIds: Array.isArray(section.evidenceIds)
                  ? section.evidenceIds.map(String)
                  : [],
              }),
            )
          : live.current.reportSections;
        setReportTitle(nextTitle);
        setReportOverview(nextOverview);
        setReportSections(nextSections);
        setPublished(false);
        setActivity("Agent drafted the editable report");
        window.location.hash = "report";
        return {
          ok: true,
          title: nextTitle,
          sectionCount: nextSections.length,
        };
      },
      {
        type: "object",
        properties: {
          title: { type: "string" },
          overview: { type: "string" },
          sections: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                heading: { type: "string" },
                body: { type: "string" },
                evidenceIds: { type: "array", items: { type: "string" } },
              },
              required: ["heading", "body"],
            },
          },
        },
        required: ["title", "overview", "sections"],
      },
    );
    tool(
      "revise_report",
      "Applies a requested revision to the report using replacement title, overview, or sections while preserving citations supplied by the agent.",
      (input) => {
        if (input.title !== undefined) setReportTitle(String(input.title));
        if (input.overview !== undefined)
          setReportOverview(String(input.overview));
        if (Array.isArray(input.sections)) {
          const next = (input.sections as Array<Record<string, unknown>>).map(
            (section, index): ReportSection => ({
              id: String(section.id ?? `revision-${Date.now()}-${index}`),
              heading: String(section.heading ?? `Finding ${index + 1}`),
              body: String(section.body ?? ""),
              evidenceIds: Array.isArray(section.evidenceIds)
                ? section.evidenceIds.map(String)
                : [],
            }),
          );
          setReportSections(next);
        }
        setPublished(false);
        setActivity(
          `Agent revision applied · ${String(input.instruction ?? "report improved")}`,
        );
        window.location.hash = "report";
        return { ok: true, instruction: input.instruction };
      },
      {
        type: "object",
        properties: {
          instruction: { type: "string" },
          title: { type: "string" },
          overview: { type: "string" },
          sections: { type: "array", items: { type: "object" } },
        },
        required: ["instruction"],
      },
    );
    tool(
      "open_video_timestamp",
      "Opens the exact source video moment for cited evidence.",
      (input) => {
        const item = live.current.evidence.find(
          (entry) => entry.id === String(input.evidenceId ?? ""),
        );
        const source = live.current.sources.find(
          (entry) => entry.id === item?.sourceId,
        );
        if (!item || !source) return { ok: false };
        const url = timestampUrl(source, item.seconds);
        setFocusEvidenceId(item.id);
        window.open(url, "_blank", "noopener,noreferrer");
        return { ok: true, url, timestamp: item.timestamp };
      },
      {
        type: "object",
        properties: { evidenceId: { type: "string" } },
        required: ["evidenceId"],
      },
    );
    tool(
      "publish_report",
      "Marks the human-reviewed report as published after its evidence and wording are approved.",
      () => {
        setPublished(true);
        setActivity("Report published · human approved");
        window.location.hash = "report";
        return {
          ok: true,
          title: live.current.reportTitle,
          sectionCount: live.current.reportSections.length,
        };
      },
    );
    Promise.all(jobs)
      .then(() => setMcp("registered"))
      .catch(() => setMcp("error"));
    // Tool handlers use the live ref so calls always read current visible state.
    // Registration must run once: rerunning would duplicate the page's tools.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <nav className="topbar">
        <Brand />
        <div className="nav-links">
          <a href="#brief">Brief</a>
          <a href="#sources">Sources</a>
          <a href="#report">Report</a>
          <a href="/livesignal-extension-v0.5.0.zip" download>
            Extension
          </a>
        </div>
        <div className={`mcp-status ${mcp}`}>
          <i />
          {mcp === "registered"
            ? `${TOOL_COUNT} WebMCP tools ready`
            : mcp === "unavailable"
              ? "Open in WebMCP browser"
              : mcp === "error"
                ? "WebMCP unavailable"
                : "Checking WebMCP"}
        </div>
      </nav>

      <header className="project-hero" id="top">
        <div className="hero-kicker">
          UNIVERSAL VIDEO RESEARCH / PERSON + AGENT
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
              <b>{TOOL_COUNT}</b>
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
            onKeyDown={(event) => {
              if (event.key === "Enter") startResearch();
            }}
            placeholder="e.g. Compare practical home solar advice from installers"
            aria-label="Universal YouTube research goal"
          />
          <button
            type="button"
            disabled={!goal.trim()}
            onClick={() => startResearch()}
          >
            Start new research →
          </button>
        </div>
        <div className="try-example-row">
          <span>Want to see a finished workflow first?</span>
          <button type="button" onClick={loadExample}>
            Load China food example
          </button>
        </div>
      </header>

      <section className="workspace-shell">
        <div className="workspace-head">
          <div>
            <span className="section-no">
              {goal ? "ACTIVE RESEARCH WORKSPACE" : "CLEAN-SLATE WORKSPACE"}
            </span>
            <h2>{goal || "Start with any question—not a preloaded demo"}</h2>
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
            <h3>Define what a useful answer must do.</h3>
            <label className="brief-field">
              <span>Must cover</span>
              <textarea
                value={brief.mustCover}
                onChange={(event) =>
                  setBrief((current) => ({
                    ...current,
                    mustCover: event.target.value,
                  }))
                }
                placeholder="Questions, comparisons, people, places, or claims"
              />
            </label>
            <label className="brief-field">
              <span>Constraints</span>
              <textarea
                value={brief.constraints}
                onChange={(event) =>
                  setBrief((current) => ({
                    ...current,
                    constraints: event.target.value,
                  }))
                }
                placeholder="Exclude, prioritise, recency, budget, point of view…"
              />
            </label>
            <label className="brief-field">
              <span>Output</span>
              <input
                value={brief.outputFormat}
                onChange={(event) =>
                  setBrief((current) => ({
                    ...current,
                    outputFormat: event.target.value,
                  }))
                }
              />
            </label>
            <div className="brief-prompt">
              <span>TRY IT WITH YOUR AGENT</span>
              <p>
                “Research this topic across YouTube. Find relevant videos,
                verify the strongest claims, and draft a cited report here.”
              </p>
              <button type="button" onClick={loadExample}>
                Or load the example
              </button>
            </div>
          </aside>

          <section className="source-panel" id="sources">
            <PanelLabel
              number="02"
              title="Source & evidence desk"
              sub="Agent research, human judgment"
            />
            <label className="source-search">
              <span>⌕</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search YouTube for candidate videos"
                aria-label="Video research query"
              />
              <button type="button" onClick={() => openYouTubeSearch()}>
                Find videos ↗
              </button>
            </label>
            <div className="youtube-import">
              <div>
                <b>Import a real YouTube video</b>
                <span>Public metadata + timestamped captions</span>
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
                {ingestError} The browser adapter can collect native captions or
                realtime speech when server captions are blocked.
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

            <p className="coverage-note">
              <b>
                {sources.length} real source{sources.length === 1 ? "" : "s"}
              </b>
              {" · "}
              {evidence.length} timestamped evidence segment
              {evidence.length === 1 ? "" : "s"}
            </p>

            {sources.length === 0 ? (
              <div className="empty-state source-empty">
                <span>NO SOURCES YET</span>
                <h3>Give the agent a topic, not a canned dataset.</h3>
                <p>
                  Ask the agent to find videos, paste any YouTube URL, or import
                  evidence captured by the extension. Every source added here is
                  visible and inspectable.
                </p>
              </div>
            ) : (
              <div className="source-list">
                {sources.map((source) => (
                  <article className="video-source included" key={source.id}>
                    <a
                      className="video-thumb"
                      href={source.url}
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
                      <span>{source.city} · SOURCE</span>
                      <h4>{source.title}</h4>
                      <p>
                        {source.creator} · {source.relevance}
                      </p>
                      <small>{source.transcriptCount} timed segments</small>
                    </div>
                    <button
                      className="include-button"
                      type="button"
                      aria-label={`Remove ${source.title}`}
                      onClick={() => {
                        setSources((current) =>
                          current.filter((item) => item.id !== source.id),
                        );
                        setEvidence((current) =>
                          current.filter((item) => item.sourceId !== source.id),
                        );
                        setActivity("Source removed by human");
                      }}
                    >
                      ×
                    </button>
                  </article>
                ))}
              </div>
            )}

            {evidence.length > 0 && (
              <div className="transcript-engine">
                <div>
                  <span>EVIDENCE INDEX · {evidence.length} SEGMENTS</span>
                  <input
                    value={evidenceQuery}
                    onChange={(event) => setEvidenceQuery(event.target.value)}
                    placeholder="Search evidence"
                    aria-label="Search imported captions"
                  />
                </div>
                <div>
                  {visibleEvidence.map((item) => (
                    <button
                      type="button"
                      className={focusEvidence?.id === item.id ? "active" : ""}
                      key={item.id}
                      onClick={() => setFocusEvidenceId(item.id)}
                    >
                      <b>{item.timestamp}</b>
                      <span>{item.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {focusEvidence && (
              <div className="evidence-focus">
                <div className="evidence-head">
                  <span>EVIDENCE IN FOCUS</span>
                  <button
                    className={
                      pinnedIds.includes(focusEvidence.id) ? "pinned" : ""
                    }
                    type="button"
                    onClick={() => pinEvidence(focusEvidence.id)}
                  >
                    {pinnedIds.includes(focusEvidence.id)
                      ? "★ Pinned"
                      : "☆ Pin"}
                  </button>
                </div>
                <blockquote>“{focusEvidence.text}”</blockquote>
                {focusEvidence.note && <p>{focusEvidence.note}</p>}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const source = sources.find(
                        (item) => item.id === focusEvidence.sourceId,
                      );
                      if (source)
                        window.open(
                          timestampUrl(source, focusEvidence.seconds),
                          "_blank",
                          "noopener,noreferrer",
                        );
                    }}
                  >
                    <b>{focusEvidence.timestamp}</b> Open source moment ↗
                  </button>
                  <span>
                    {focusEvidence.confidence
                      ? `${focusEvidence.confidence}% fixture confidence`
                      : "Direct transcript evidence"}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="guide-panel" id="report">
          <div className="guide-toolbar">
            <PanelLabel
              number="03"
              title="Editable report"
              sub="Created together"
              light
            />
            <div className="guide-actions">
              <button type="button" onClick={() => addReportSection()}>
                + Add section
              </button>
              <button
                className={published ? "published" : "publish"}
                type="button"
                disabled={reportSections.length === 0}
                onClick={() => {
                  setPublished(true);
                  setActivity("Report published · human approved");
                }}
              >
                {published ? "✓ Published" : "Publish report"}
              </button>
            </div>
          </div>

          <div className="guide-title-row">
            <div>
              <p>VIDEO RESEARCH REPORT · HUMAN EDITABLE</p>
              <input
                value={reportTitle}
                onChange={(event) => {
                  setReportTitle(event.target.value);
                  setPublished(false);
                }}
                aria-label="Report title"
              />
            </div>
            <span>
              {String(reportSections.length).padStart(2, "0")}
              <small>report sections</small>
            </span>
          </div>
          <textarea
            className="editor-note"
            value={reportOverview}
            onChange={(event) => {
              setReportOverview(event.target.value);
              setPublished(false);
            }}
            placeholder="The agent’s overview appears here. Edit it directly, then ask the agent to revise again."
            aria-label="Report overview"
          />

          {reportSections.length === 0 ? (
            <div className="empty-state report-empty">
              <span>YOUR REPORT STARTS HERE</span>
              <h3>No answer is prewritten.</h3>
              <p>
                Once evidence is collected, ask the agent to draft a report. It
                will create editable sections with timestamp citations on this
                same page.
              </p>
              <button type="button" onClick={() => addReportSection()}>
                Add a section manually
              </button>
            </div>
          ) : (
            <div className="report-section-list">
              {reportSections.map((section, index) => {
                const citations = section.evidenceIds
                  .map((id) => evidence.find((item) => item.id === id))
                  .filter(Boolean) as EvidenceItem[];
                return (
                  <article className="report-card" key={section.id}>
                    <div className="dish-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="report-copy">
                      <input
                        value={section.heading}
                        aria-label={`Section ${index + 1} heading`}
                        onChange={(event) =>
                          updateReportSection(section.id, {
                            heading: event.target.value,
                          })
                        }
                      />
                      <textarea
                        value={section.body}
                        aria-label={`Section ${index + 1} body`}
                        onChange={(event) =>
                          updateReportSection(section.id, {
                            body: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="report-citations">
                      <span>SOURCE PROOF · {citations.length}</span>
                      {citations.length ? (
                        citations.map((item) => {
                          const source = sources.find(
                            (entry) => entry.id === item.sourceId,
                          );
                          return (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => {
                                setFocusEvidenceId(item.id);
                                if (source)
                                  window.open(
                                    timestampUrl(source, item.seconds),
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                              }}
                            >
                              <b>{item.timestamp}</b>
                              <span>
                                {source?.creator ?? "Source"}
                                <small>“{item.text}”</small>
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <p>No citations attached yet.</p>
                      )}
                    </div>
                    <div className="dish-controls">
                      <button
                        type="button"
                        onClick={() => moveReportSection(section.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveReportSection(section.id, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setReportSections((current) =>
                            current.filter((item) => item.id !== section.id),
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="guide-foot">
            <p>
              <span>Evidence policy</span>
              Claims should point back to an inspectable source moment. Human
              edits and agent revisions share the same visible document.
            </p>
            <div>
              <b>{pinnedIds.length}</b> pinned moments <b>{sources.length}</b>{" "}
              sources
            </div>
          </div>
        </section>
      </section>

      <section className="challenge-proof">
        <p className="section-no">WHY WEBMCP</p>
        <h2>The page stays in the conversation.</h2>
        <div>
          <p>
            <b>Human direction</b>
            <span>
              You define the question, inspect sources, edit the report, and
              approve what gets published.
            </span>
          </p>
          <p>
            <b>Agent scale</b>
            <span>
              The agent finds videos and structures hours of footage through
              semantic page tools.
            </span>
          </p>
          <p>
            <b>Shared creation</b>
            <span>
              Both work on one visible artifact—not an isolated chat answer or a
              hidden automation.
            </span>
          </p>
        </div>
      </section>
      <footer>
        <Brand />
        <p>Hours of video → one report you can trust and shape.</p>
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
