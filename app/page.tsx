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

type AgentProjectPayload = {
  request?: unknown;
  brief?: Record<string, unknown>;
  sources?: Array<Record<string, unknown>>;
  report?: Record<string, unknown>;
};

type RunPhase =
  | "ready"
  | "discovering"
  | "extracting"
  | "synthesizing"
  | "review"
  | "published";

type AgentEvent = {
  id: string;
  label: string;
  detail: string;
};

type HumanRevision = {
  id: string;
  field: string;
  detail: string;
  createdAt: string;
  acknowledged: boolean;
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

const TOOL_COUNT = 19;
const PHASES: Array<{ id: RunPhase; label: string }> = [
  { id: "discovering", label: "Discover" },
  { id: "extracting", label: "Extract" },
  { id: "synthesizing", label: "Synthesize" },
  { id: "review", label: "Review" },
];

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
  const [runPhase, setRunPhase] = useState<RunPhase>("ready");
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [humanRevisions, setHumanRevisions] = useState<HumanRevision[]>([]);
  const [published, setPublished] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ingestStatus, setIngestStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [ingestError, setIngestError] = useState("");
  const [agentResultJson, setAgentResultJson] = useState("");
  const [agentResultError, setAgentResultError] = useState("");
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
  const pendingHumanRevisions = useMemo(
    () => humanRevisions.filter((revision) => !revision.acknowledged),
    [humanRevisions],
  );

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
    runPhase,
    agentEvents,
    humanRevisions,
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
      runPhase,
      agentEvents,
      humanRevisions,
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
    runPhase,
    agentEvents,
    humanRevisions,
  ]);

  function addAgentEvent(label: string, detail: string) {
    setAgentEvents((current) => [
      ...current.slice(-5),
      { id: crypto.randomUUID(), label, detail },
    ]);
  }

  function recordHumanRevision(field: string, detail: string) {
    const now = new Date().toISOString();
    const revisionId = crypto.randomUUID();
    setHumanRevisions((current) => {
      const pending = current.find(
        (revision) => revision.field === field && !revision.acknowledged,
      );
      if (pending) {
        return current.map((revision) =>
          revision.id === pending.id
            ? { ...revision, detail, createdAt: now }
            : revision,
        );
      }
      return [
        ...current.slice(-11),
        {
          id: revisionId,
          field,
          detail,
          createdAt: now,
          acknowledged: false,
        },
      ];
    });
    setPublished(false);
    setActivity(`Human changed ${field} · ready for agent`);
    window.dispatchEvent(
      new CustomEvent("livesignal:human-revision", {
        detail: { field, value: detail, createdAt: now },
      }),
    );
  }

  function reportMarkdown() {
    const state = live.current;
    const lines = [
      `# ${state.reportTitle}`,
      "",
      state.reportOverview,
      "",
      "## Research brief",
      "",
      `**Request:** ${state.goal}`,
      "",
      `**Must cover:** ${state.brief.mustCover || "Not specified"}`,
      "",
      `**Constraints:** ${state.brief.constraints || "None"}`,
      "",
      `**Deliverable:** ${state.brief.outputFormat}`,
      "",
    ];
    state.reportSections.forEach((section) => {
      lines.push(`## ${section.heading}`, "", section.body, "");
      const citations = section.evidenceIds
        .map((id) => state.evidence.find((item) => item.id === id))
        .filter(Boolean) as EvidenceItem[];
      if (citations.length) {
        lines.push("### Source evidence", "");
        citations.forEach((item) => {
          const source = state.sources.find(
            (entry) => entry.id === item.sourceId,
          );
          if (!source) return;
          lines.push(
            `- [${item.timestamp} · ${source.creator} — ${source.title}](${timestampUrl(source, item.seconds)})`,
            `  > ${item.text}`,
          );
        });
        lines.push("");
      }
    });
    lines.push(
      "---",
      "",
      `Created with LiveSignal from ${state.sources.length} video sources and ${state.evidence.length} timestamped evidence moments.`,
    );
    return lines.join("\n");
  }

  function downloadReport() {
    const markdown = reportMarkdown();
    const slug =
      live.current.reportTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "livesignal-report";
    const filename = `${slug}.md`;
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setActivity("Citation-preserving report downloaded");
    return { ok: true, filename, markdown };
  }

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
    setHumanRevisions([]);
    setPublished(false);
    setIngestError("");
    setRunPhase("discovering");
    setAgentEvents([
      {
        id: crypto.randomUUID(),
        label: "Request accepted",
        detail: cleanGoal,
      },
    ]);
    setActivity("ChatGPT is discovering relevant videos");
    window.location.hash = "workspace";
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
    setHumanRevisions([]);
    setPublished(false);
    setIngestError("");
    setRunPhase("review");
    setAgentEvents([
      {
        id: crypto.randomUUID(),
        label: "Example completed",
        detail: "5 sources · 6 cited report sections",
      },
    ]);
    setActivity("China food example loaded · replace it with any topic");
    window.location.hash = "workspace";
  }

  function openYouTubeSearch(query = searchQuery || goal) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return { ok: false, error: "A search query is required." };
    setSearchQuery(cleanQuery);
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
    setRunPhase("discovering");
    addAgentEvent("Searching YouTube", cleanQuery);
    setActivity(`YouTube search opened · ${cleanQuery}`);
    window.open(url, "_blank", "noopener,noreferrer");
    return { ok: true, query: cleanQuery, url };
  }

  async function ingestYouTube(url: string) {
    const normalized = url.trim();
    if (!normalized) throw new Error("Paste a public YouTube URL first.");
    setIngestStatus("loading");
    setIngestError("");
    setRunPhase("extracting");
    addAgentEvent("Opening source", normalized);
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
    addAgentEvent(
      result.transcript.available ? "Evidence extracted" : "Source connected",
      result.transcript.available
        ? `${segments.length} timestamped caption segments`
        : "Waiting for browser-caption evidence",
    );
    window.location.hash = "sources";
    return result;
  }

  async function importBrowserEvidence() {
    setIngestStatus("loading");
    setIngestError("");
    setRunPhase("extracting");
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
    addAgentEvent(
      "Browser evidence imported",
      `${segments.length} timestamped segments`,
    );
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

  function recordAgentEvidence(input: Record<string, unknown>) {
    const sourceInput = (input.source ?? {}) as Record<string, unknown>;
    const url = String(sourceInput.url ?? "").trim();
    const title = String(sourceInput.title ?? "Researched video").trim();
    if (!url) return { ok: false, error: "A source URL is required." };
    let videoId = String(sourceInput.videoId ?? "").trim();
    if (!videoId) {
      try {
        const parsed = new URL(url);
        videoId =
          parsed.searchParams.get("v") ??
          parsed.pathname.split("/").filter(Boolean).at(-1) ??
          `agent-${Date.now()}`;
      } catch {
        videoId = `agent-${Date.now()}`;
      }
    }
    const sourceId = String(sourceInput.id ?? videoId);
    const segments = (
      Array.isArray(input.evidence)
        ? (input.evidence as Array<Record<string, unknown>>)
        : []
    )
      .map((item, index): EvidenceItem => ({
        id: String(item.id ?? `${sourceId}-agent-${index}`),
        sourceId,
        text: String(item.text ?? "").trim(),
        seconds: Number(item.seconds ?? 0),
        durationSeconds: Number(item.durationSeconds ?? 0),
        timestamp: String(item.timestamp ?? "0:00"),
        note: item.note === undefined ? undefined : String(item.note),
      }))
      .filter((item) => item.text);
    const source: ResearchSource = {
      id: sourceId,
      videoId,
      url,
      title,
      creator: String(sourceInput.creator ?? "YouTube creator"),
      city: "Agent research",
      duration: "BROWSER",
      relevance: String(
        sourceInput.relevance ??
          "Selected and verified by ChatGPT in the browser",
      ),
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
    setRunPhase("extracting");
    addAgentEvent(
      "Agent evidence recorded",
      `${title} · ${segments.length} timestamped moments`,
    );
    setActivity(`ChatGPT added ${segments.length} evidence moments`);
    return { ok: true, source, evidence: segments };
  }

  function applyAgentProject() {
    try {
      const payload = JSON.parse(agentResultJson) as AgentProjectPayload;
      const request = String(payload.request ?? "").trim();
      if (!request) throw new Error("The agent result needs a research request.");

      const nextSources: ResearchSource[] = [];
      const nextEvidence: EvidenceItem[] = [];
      for (const [sourceIndex, sourceInput] of (
        Array.isArray(payload.sources) ? payload.sources : []
      ).entries()) {
        const url = String(sourceInput.url ?? "").trim();
        if (!url) throw new Error(`Source ${sourceIndex + 1} needs a URL.`);
        let videoId = String(sourceInput.videoId ?? "").trim();
        if (!videoId) {
          try {
            const parsed = new URL(url);
            videoId =
              parsed.searchParams.get("v") ??
              parsed.pathname.split("/").filter(Boolean).at(-1) ??
              `agent-${sourceIndex + 1}`;
          } catch {
            videoId = `agent-${sourceIndex + 1}`;
          }
        }
        const sourceId = String(sourceInput.id ?? videoId);
        const sourceEvidence = (
          Array.isArray(sourceInput.evidence)
            ? (sourceInput.evidence as Array<Record<string, unknown>>)
            : []
        )
          .map((item, evidenceIndex): EvidenceItem => ({
            id: String(item.id ?? `${sourceId}-evidence-${evidenceIndex + 1}`),
            sourceId,
            text: String(item.text ?? "").trim(),
            seconds: Number(item.seconds ?? 0),
            durationSeconds: Number(item.durationSeconds ?? 0),
            timestamp: String(item.timestamp ?? "0:00"),
            note: item.note === undefined ? undefined : String(item.note),
            confidence:
              item.confidence === undefined
                ? undefined
                : Number(item.confidence),
          }))
          .filter((item) => item.text);
        nextSources.push({
          id: sourceId,
          videoId,
          url,
          title: String(sourceInput.title ?? "Agent-researched video"),
          creator: String(sourceInput.creator ?? "YouTube creator"),
          city: "Agent research",
          duration: "BROWSER",
          relevance: String(
            sourceInput.relevance ??
              "Selected and verified by ChatGPT in the browser",
          ),
          transcriptCount: sourceEvidence.length,
        });
        nextEvidence.push(...sourceEvidence);
      }
      if (nextSources.length === 0)
        throw new Error("The agent result needs at least one source.");
      if (nextEvidence.length === 0)
        throw new Error("The agent result needs timestamped evidence.");

      const briefInput = payload.brief ?? {};
      const reportInput = payload.report ?? {};
      const sections = (
        Array.isArray(reportInput.sections)
          ? (reportInput.sections as Array<Record<string, unknown>>)
          : []
      ).map((section, index): ReportSection => ({
        id: String(section.id ?? `agent-section-${index + 1}`),
        heading: String(section.heading ?? `Finding ${index + 1}`),
        body: String(section.body ?? ""),
        evidenceIds: Array.isArray(section.evidenceIds)
          ? section.evidenceIds.map(String)
          : [],
      }));
      if (sections.length === 0)
        throw new Error("The agent result needs at least one report section.");

      const evidenceIds = new Set(nextEvidence.map((item) => item.id));
      const unknownCitation = sections
        .flatMap((section) => section.evidenceIds)
        .find((id) => !evidenceIds.has(id));
      if (unknownCitation)
        throw new Error(`Unknown evidence citation: ${unknownCitation}`);

      setGoal(request);
      setSearchQuery(request);
      setBrief({
        mustCover: String(briefInput.mustCover ?? ""),
        constraints: String(briefInput.constraints ?? ""),
        outputFormat: String(
          briefInput.outputFormat ?? "Concise, evidence-backed report",
        ),
      });
      setSources(nextSources);
      setEvidence(nextEvidence);
      setPinnedIds(nextEvidence.map((item) => item.id));
      setFocusEvidenceId(nextEvidence[0].id);
      setEvidenceQuery("");
      setReportTitle(String(reportInput.title ?? "Agent research report"));
      setReportOverview(String(reportInput.overview ?? ""));
      setReportSections(sections);
      setHumanRevisions([]);
      setPublished(false);
      setRunPhase("review");
      setAgentResultError("");
      setAgentEvents([
        {
          id: crypto.randomUUID(),
          label: "Agent run imported",
          detail: `${nextSources.length} sources · ${nextEvidence.length} evidence moments · ${sections.length} report sections`,
        },
      ]);
      setActivity("Agent research imported · ready for human review");
      window.location.hash = "report";
    } catch (error) {
      setAgentResultError(
        error instanceof Error ? error.message : "Invalid agent result JSON.",
      );
    }
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
      "get_human_revisions",
      "Returns human edits made to the live brief or report that the agent has not yet acknowledged. Use while collaborating before revising the report.",
      () => ({
        revisions: live.current.humanRevisions.filter(
          (revision) => !revision.acknowledged,
        ),
        currentBrief: live.current.brief,
        currentReport: {
          title: live.current.reportTitle,
          overview: live.current.reportOverview,
          sections: live.current.reportSections,
        },
      }),
    );
    tool(
      "acknowledge_human_revisions",
      "Marks human edits as seen after the agent has incorporated or responded to them.",
      (input) => {
        const requestedIds = Array.isArray(input.revisionIds)
          ? input.revisionIds.map(String)
          : [];
        const acknowledgeAll = Boolean(input.all) || requestedIds.length === 0;
        setHumanRevisions((current) =>
          current.map((revision) =>
            acknowledgeAll || requestedIds.includes(revision.id)
              ? { ...revision, acknowledged: true }
              : revision,
          ),
        );
        addAgentEvent(
          "Human edits acknowledged",
          acknowledgeAll
            ? "Agent read the latest shared draft"
            : `${requestedIds.length} revisions read`,
        );
        setActivity("Agent caught up with human edits");
        return { ok: true, acknowledged: acknowledgeAll ? "all" : requestedIds };
      },
      {
        type: "object",
        properties: {
          all: { type: "boolean" },
          revisionIds: { type: "array", items: { type: "string" } },
        },
      },
    );
    tool(
      "begin_research",
      "Start here for a new user request. Creates a clean LiveSignal project, records the agent-prepared brief, and returns the autonomous video-research workflow.",
      (input) => {
        const nextGoal = String(input.request ?? "").trim();
        if (!nextGoal)
          return { ok: false, error: "A research request is required." };
        startResearch(nextGoal);
        const nextBrief = {
          mustCover: String(input.mustCover ?? ""),
          constraints: String(input.constraints ?? ""),
          outputFormat: String(
            input.outputFormat ?? "Concise, evidence-backed report",
          ),
        };
        setBrief(nextBrief);
        return {
          ok: true,
          request: nextGoal,
          brief: nextBrief,
          next: [
            "Use open_youtube_search to discover credible candidate videos.",
            "Use ingest_youtube_video on the strongest sources.",
            "Search and pin timestamped evidence, then call write_report.",
          ],
        };
      },
      {
        type: "object",
        properties: {
          request: { type: "string" },
          mustCover: { type: "string" },
          constraints: { type: "string" },
          outputFormat: { type: "string" },
        },
        required: ["request"],
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
      "record_video_evidence",
      "Writes a video and timestamped evidence researched in another browser tab back into LiveSignal. Use this when ChatGPT reads captions or source moments directly, especially when server transcript import is unavailable.",
      (input) => recordAgentEvidence(input),
      {
        type: "object",
        properties: {
          source: {
            type: "object",
            properties: {
              id: { type: "string" },
              videoId: { type: "string" },
              url: { type: "string" },
              title: { type: "string" },
              creator: { type: "string" },
              relevance: { type: "string" },
            },
            required: ["url", "title"],
          },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                text: { type: "string" },
                timestamp: { type: "string" },
                seconds: { type: "number" },
                durationSeconds: { type: "number" },
                note: { type: "string" },
              },
              required: ["text", "timestamp", "seconds"],
            },
          },
        },
        required: ["source", "evidence"],
      },
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
        setRunPhase("synthesizing");
        setEvidenceQuery(query);
        addAgentEvent(
          "Evidence searched",
          `${matches.length} matches for “${query}”`,
        );
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
        setRunPhase("review");
        addAgentEvent(
          "Report delivered",
          `${nextSections.length} editable sections with source proof`,
        );
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
        setRunPhase("review");
        addAgentEvent(
          "Revision applied",
          String(input.instruction ?? "Report improved"),
        );
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
        setRunPhase("published");
        addAgentEvent("Human approved", "Report marked as published");
        setActivity("Report published · human approved");
        window.location.hash = "report";
        return {
          ok: true,
          title: live.current.reportTitle,
          sectionCount: live.current.reportSections.length,
        };
      },
    );
    tool(
      "download_report",
      "Downloads the current human-reviewed report as Markdown with clickable timestamp citations.",
      () => downloadReport(),
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
        <div className="agent-entry">
          <div className="agent-entry-mark">CHATGPT</div>
          <div>
            <span>ONE REQUEST. THE AGENT OPERATES THIS PAGE.</span>
            <p>
              “Research the best beginner advice for growing tomatoes on a
              balcony. Compare three YouTube sources and build a cited report in
              LiveSignal.”
            </p>
          </div>
          <ol>
            <li>Open this page in ChatGPT’s browser</li>
            <li>Ask once in the conversation</li>
            <li>Watch this workspace fill itself</li>
          </ol>
          <button type="button" onClick={loadExample}>
            Preview China food run →
          </button>
        </div>
      </header>

      <section className="workspace-shell" id="workspace">
        <div className="workspace-head">
          <div>
            <span className="section-no">
              {goal
                ? "AGENT RESEARCH IN PROGRESS"
                : "CHATGPT-CONTROLLED WORKSPACE"}
            </span>
            <h2>{goal || "Ask ChatGPT to research anything across video"}</h2>
          </div>
          <div className="activity">
            <span className="agent-pulse" />
            <p>
              <b>LiveSignal agent</b>
              {activity}
            </p>
          </div>
        </div>

        <section className={`agent-console phase-${runPhase}`}>
          <div className="agent-console-status">
            <span className="agent-orbit">AI</span>
            <div>
              <small>CHATGPT → LIVESIGNAL</small>
              <h3>
                {runPhase === "ready"
                  ? "Waiting for your request in ChatGPT"
                  : runPhase === "published"
                    ? "Research approved and published"
                    : activity}
              </h3>
            </div>
          </div>
          <div className="agent-progress" aria-label="Agent research progress">
            {PHASES.map((phase, index) => {
              const currentIndex = PHASES.findIndex(
                (item) => item.id === runPhase,
              );
              const active =
                runPhase === "published" ||
                (currentIndex >= 0 && index <= currentIndex);
              return (
                <div className={active ? "active" : ""} key={phase.id}>
                  <i>{active ? "✓" : index + 1}</i>
                  <span>{phase.label}</span>
                </div>
              );
            })}
          </div>
          <div className="agent-ledger">
            <div
              className={`collaboration-status ${
                pendingHumanRevisions.length ? "pending" : "caught-up"
              }`}
            >
              <b>HUMAN → AGENT</b>
              <span>
                {pendingHumanRevisions.length
                  ? `${pendingHumanRevisions.length} live change${pendingHumanRevisions.length === 1 ? "" : "s"} waiting for ChatGPT`
                  : "Shared draft caught up"}
              </span>
            </div>
            {agentEvents.length ? (
              agentEvents.slice(-3).map((event) => (
                <p key={event.id}>
                  <b>{event.label}</b>
                  <span>{event.detail}</span>
                </p>
              ))
            ) : (
              <p>
                <b>No setup form required</b>
                <span>
                  ChatGPT will create the brief, add sources, extract evidence,
                  and deliver the report through this page’s WebMCP tools.
                </span>
              </p>
            )}
          </div>
        </section>

        <div className="research-grid">
          <aside className="brief-panel" id="brief">
            <PanelLabel
              number="01"
              title="Research brief"
              sub="Human direction"
            />
            <h3>
              {goal
                ? "Shape the brief with the agent."
                : "One prompt becomes the brief."}
            </h3>
            <div className="brief-collaboration-note">
              <span>LIVE SHARED BRIEF</span>
              <p>
                Edit any field. The current value and its revision become
                available to the active agent immediately.
              </p>
            </div>
            <div className="brief-live-editor">
              <label className="brief-field research-request-field">
                <span>Research request</span>
                <textarea
                  value={goal}
                  onChange={(event) => {
                    setGoal(event.target.value);
                    setSearchQuery(event.target.value);
                    recordHumanRevision("research request", event.target.value);
                  }}
                  placeholder="Waiting for ChatGPT to begin a project…"
                  aria-label="Research request"
                />
              </label>
              <label className="brief-field">
                <span>Must cover</span>
                <textarea
                  value={brief.mustCover}
                  onChange={(event) => {
                    setBrief((current) => ({
                      ...current,
                      mustCover: event.target.value,
                    }));
                    recordHumanRevision("must cover", event.target.value);
                  }}
                  placeholder="Questions, comparisons, people, places, or claims"
                  aria-label="Must cover"
                />
              </label>
              <label className="brief-field">
                <span>Constraints</span>
                <textarea
                  value={brief.constraints}
                  onChange={(event) => {
                    setBrief((current) => ({
                      ...current,
                      constraints: event.target.value,
                    }));
                    recordHumanRevision("constraints", event.target.value);
                  }}
                  placeholder="Exclude, prioritise, recency, budget, point of view…"
                  aria-label="Research constraints"
                />
              </label>
              <label className="brief-field">
                <span>Deliverable</span>
                <input
                  value={brief.outputFormat}
                  onChange={(event) => {
                    setBrief((current) => ({
                      ...current,
                      outputFormat: event.target.value,
                    }));
                    recordHumanRevision("deliverable", event.target.value);
                  }}
                  aria-label="Research deliverable"
                />
              </label>
            </div>
            <div className="brief-prompt">
              <span>HUMAN ROLE</span>
              <p>
                Review the agent’s choices, inspect source moments, and edit the
                finished report. Research setup is optional.
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
            <div className="agent-source-note">
              <span>AGENT-OPERATED</span>
              <p>
                ChatGPT searches across tabs and records chosen videos and
                timestamped proof here through WebMCP.
              </p>
            </div>
            <details className="manual-controls">
              <summary>Manual fallback controls</summary>
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
                  onClick={() =>
                    ingestYouTube(youtubeUrl).catch(() => undefined)
                  }
                >
                  {ingestStatus === "loading" ? "Importing…" : "Import video"}
                </button>
              </div>
              {ingestError && (
                <p className="ingest-error">
                  {ingestError} The optional extension can collect native
                  captions or realtime speech when server captions are blocked.
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
                Import latest extension evidence
              </button>
              <div className="agent-result-import">
                <div>
                  <span>AGENT RETURN CHANNEL</span>
                  <b>Import a complete browser-agent run</b>
                  <p>
                    Fallback for agent browsers without native WebMCP tool
                    exposure. Sources, evidence, and citations remain editable.
                  </p>
                </div>
                <textarea
                  value={agentResultJson}
                  onChange={(event) => setAgentResultJson(event.target.value)}
                  aria-label="Agent result JSON"
                  placeholder='{"request":"…","sources":[…],"report":{"sections":[…]}}'
                  spellCheck={false}
                />
                <button type="button" onClick={applyAgentProject}>
                  Apply agent result
                </button>
              </div>
              {agentResultError && (
                <p className="agent-result-error">{agentResultError}</p>
              )}
            </details>

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
                <span>WAITING FOR CHATGPT</span>
                <h3>Sources will arrive here automatically.</h3>
                <p>
                  Ask once in the ChatGPT conversation. The agent will discover
                  videos, verify source moments, and use LiveSignal’s page tools
                  to build this evidence desk.
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
              <button
                className="download"
                type="button"
                disabled={reportSections.length === 0}
                onClick={downloadReport}
              >
                Download .md ↓
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
                  recordHumanRevision("report title", event.target.value);
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
              recordHumanRevision("report overview", event.target.value);
            }}
            placeholder="The agent’s overview appears here. Edit it directly, then ask the agent to revise again."
            aria-label="Report overview"
          />

          {reportSections.length === 0 ? (
            <div className="empty-state report-empty">
              <span>YOUR REPORT STARTS HERE</span>
              <h3>ChatGPT will write into this page.</h3>
              <p>
                The agent will create editable sections with timestamp citations
                after it verifies the selected videos. You only need to review
                and refine the result.
              </p>
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
                        onChange={(event) => {
                          updateReportSection(section.id, {
                            heading: event.target.value,
                          });
                          recordHumanRevision(
                            `section ${index + 1} heading`,
                            event.target.value,
                          );
                        }}
                      />
                      <textarea
                        value={section.body}
                        aria-label={`Section ${index + 1} body`}
                        onChange={(event) => {
                          updateReportSection(section.id, {
                            body: event.target.value,
                          });
                          recordHumanRevision(
                            `section ${index + 1} body`,
                            event.target.value,
                          );
                        }}
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
                        onClick={() => {
                          moveReportSection(section.id, -1);
                          recordHumanRevision(
                            "report order",
                            `Moved ${section.heading} up`,
                          );
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          moveReportSection(section.id, 1);
                          recordHumanRevision(
                            "report order",
                            `Moved ${section.heading} down`,
                          );
                        }}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReportSections((current) =>
                            current.filter((item) => item.id !== section.id),
                          );
                          recordHumanRevision(
                            "report sections",
                            `Removed ${section.heading}`,
                          );
                        }}
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
