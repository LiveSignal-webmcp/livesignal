"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  acknowledgeSavedRevisions,
  findTranscriptMatch,
  normalizeEvidenceTiming,
  reserveUniqueEvidenceId,
} from "@/lib/evidence";
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

type EvidenceOrigin = "transcript" | "agent" | "extension";

type EvidenceItem = TranscriptSegment & {
  sourceId: string;
  note?: string;
  confidence?: number;
  origin: EvidenceOrigin;
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

type CanvasBlockKind = "feature" | "steps" | "note" | "quote";
type CanvasBlockSpan = "half" | "wide";
type CanvasTheme = "notebook" | "editorial" | "field-notes";

type CanvasImage = {
  id: string;
  url: string;
  alt: string;
  prompt: string;
  model: string;
  generatedAt: string;
  placement: "inline" | "background";
};

type CanvasBlock = {
  id: string;
  kind: CanvasBlockKind;
  title: string;
  body: string;
  evidenceIds: string[];
  span: CanvasBlockSpan;
  accent: "coral" | "sage" | "gold" | "ink";
  image?: CanvasImage;
  backgroundImage?: CanvasImage;
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
  sentAt?: string;
  sequence?: number;
};

type CollaborationPresence =
  | "inactive"
  | "listening"
  | "responding"
  | "paused"
  | "finished";

type CollaborationSession = {
  id: string;
  status: "active" | "finished";
  startedAt: string;
  finishedAt?: string;
  finishReason?: string;
};

type ConnectedAgent = {
  client: string;
  agentId?: string;
  capabilities: string[];
  identified: boolean;
  connectedAt: string;
  lastSeenAt: string;
};

type CanvasChangeBatch = {
  id: string;
  sessionId: string;
  sequence: number;
  createdAt: string;
  revisions: HumanRevision[];
  canvas: {
    title: string;
    overview: string;
    theme: CanvasTheme;
    blocks: CanvasBlock[];
  };
};

type AgentCommentKind =
  | "research-more"
  | "verify"
  | "counterpoint"
  | "improve"
  | "create-visual";
type AgentCommentStatus = "pending" | "researching" | "answered";

type AgentComment = {
  id: string;
  kind: AgentCommentKind;
  query: string;
  blockId?: string;
  blockTitle?: string;
  blockBody?: string;
  visualPlacement?: CanvasImage["placement"];
  evidenceIds: string[];
  status: AgentCommentStatus;
  createdAt: string;
  claimedAt?: string;
  answeredAt?: string;
  plan?: string;
  response?: string;
  addedEvidenceIds: string[];
  updatedBlockIds: string[];
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
  outputFormat: "A concise, shareable visual guide",
};

const EXAMPLE_BRIEF: ResearchBrief = {
  mustCover: "Essential dishes in Shanghai, Chengdu, and Xi’an",
  constraints: "Prioritise spicy noodles and street food. Avoid shellfish.",
  outputFormat: "A practical 5-minute field guide",
};

const TOOL_COUNT = 37;
const ENTRY_SUGGESTIONS = [
  {
    label: "Plan a food trip",
    prompt:
      "Build a must-try food plan for my first trip to China. I love spicy noodles, avoid shellfish, and want advice from several YouTube creators.",
  },
  {
    label: "Learn a skill",
    prompt:
      "Build a practical beginner plan for learning street photography from trusted YouTube creators, with exercises I can follow this week.",
  },
  {
    label: "Cook something",
    prompt:
      "Find the best YouTube advice for making restaurant-quality ramen at home and turn it into a clear recipe card for a first-time cook.",
  },
  {
    label: "Compare options",
    prompt:
      "Compare the best compact cameras for travel using recent YouTube reviews and build a source-backed decision guide.",
  },
];
const AGENT_COMMENT_KINDS: Array<{
  id: AgentCommentKind;
  label: string;
  prompt: string;
}> = [
  {
    id: "research-more",
    label: "Find more",
    prompt: "What is missing, unclear, or worth researching further?",
  },
  {
    id: "verify",
    label: "Verify",
    prompt: "Which claim should the agent verify against more video sources?",
  },
  {
    id: "counterpoint",
    label: "Other view",
    prompt: "What alternative perspective should the agent look for?",
  },
  {
    id: "improve",
    label: "Improve",
    prompt: "How should the agent strengthen this part of the canvas?",
  },
  {
    id: "create-visual",
    label: "Create visual",
    prompt: "Describe the illustration you want the agent to create for this card.",
  },
];
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

function evidencePresentation(item: EvidenceItem) {
  if (item.origin === "transcript" && item.timestamp) {
    return {
      className: "",
      label: "",
      title: "Timestamped transcript moment from the source video.",
      verified: true,
    };
  }
  if (item.origin === "extension") {
    return {
      className: "captured",
      label: "BROWSER CAPTURE",
      title: item.timestamp
        ? "Timestamped evidence captured from the active video page by the browser extension."
        : "Browser-captured evidence without a timestamp.",
      verified: false,
    };
  }
  return {
    className: "unverified",
    label:
      item.origin === "transcript" ? "TRANSCRIPT · NO TIMESTAMP" : "AGENT CLAIM",
    title: item.timestamp
      ? "Agent-claimed moment, not matched to an imported transcript."
      : "Agent claim with no timestamp supplied.",
    verified: false,
  };
}

function timedEvidenceCount(items: EvidenceItem[]) {
  return items.filter((item) => Boolean(item.timestamp)).length;
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
    origin: "transcript",
  }));
  const sections: ReportSection[] = DISHES.map((dish) => ({
    id: dish.id,
    heading: `${dish.name} · ${dish.city}`,
    body: `${dish.description} ${dish.warning}`,
    evidenceIds: dish.evidenceIds,
  }));
  return { sources, evidence, sections };
}

function canvasFromReport(sections: ReportSection[]): CanvasBlock[] {
  const accents: CanvasBlock["accent"][] = ["coral", "sage", "gold", "ink"];
  return sections.map((section, index) => ({
    id: `canvas-${section.id}`,
    kind: index === 0 ? "feature" : index === sections.length - 1 ? "note" : "steps",
    title: section.heading.replace(/^\d+\.\s*/, ""),
    body: section.body,
    evidenceIds: section.evidenceIds,
    span: index === 0 || (sections.length > 3 && index === sections.length - 1) ? "wide" : "half",
    accent: accents[index % accents.length],
  }));
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
  const [agentComments, setAgentComments] = useState<AgentComment[]>([]);
  const [agentCommentKind, setAgentCommentKind] =
    useState<AgentCommentKind>("research-more");
  const [agentCommentQuery, setAgentCommentQuery] = useState("");
  const [agentCommentScope, setAgentCommentScope] =
    useState<"block" | "canvas">("block");
  const [agentListening, setAgentListening] = useState(false);
  const [collaborationPresence, setCollaborationPresence] =
    useState<CollaborationPresence>("inactive");
  const [collaborationSession, setCollaborationSession] =
    useState<CollaborationSession | null>(null);
  const [connectedAgent, setConnectedAgent] =
    useState<ConnectedAgent | null>(null);
  const [canvasChangeBatches, setCanvasChangeBatches] = useState<
    CanvasChangeBatch[]
  >([]);
  const [agentListeningForRequest, setAgentListeningForRequest] =
    useState(false);
  const [entryPrompt, setEntryPrompt] = useState("");
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>([]);
  const [canvasTheme, setCanvasTheme] = useState<CanvasTheme>("notebook");
  const [selectedCanvasId, setSelectedCanvasId] = useState("");
  const [draggedCanvasId, setDraggedCanvasId] = useState("");
  const [canvasView, setCanvasView] = useState<"canvas" | "draft">("canvas");
  const [canvasExporting, setCanvasExporting] = useState(false);
  const [imageGeneratingBlockId, setImageGeneratingBlockId] = useState("");
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
  const collaborationSequence = useRef(0);
  const agentCommentInputRef = useRef<HTMLTextAreaElement>(null);

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
  const unsentHumanRevisions = useMemo(
    () =>
      humanRevisions.filter(
        (revision) => !revision.acknowledged && !revision.sentAt,
      ),
    [humanRevisions],
  );
  const sentHumanRevisions = useMemo(
    () =>
      humanRevisions.filter(
        (revision) => !revision.acknowledged && revision.sentAt,
      ),
    [humanRevisions],
  );
  const collaborationActive = collaborationSession?.status === "active";
  const agentActivelyListening =
    agentListening || collaborationPresence === "listening";
  const connectedAgentLabel = connectedAgent?.client ?? "";
  const openAgentComments = useMemo(
    () => agentComments.filter((comment) => comment.status !== "answered"),
    [agentComments],
  );
  const selectedCanvasBlock = useMemo(
    () =>
      canvasBlocks.find((block) => block.id === selectedCanvasId) ??
      canvasBlocks[0],
    [canvasBlocks, selectedCanvasId],
  );
  const selectedCanvasIndex = selectedCanvasBlock
    ? canvasBlocks.findIndex((block) => block.id === selectedCanvasBlock.id)
    : -1;
  const visibleAgentComments = useMemo(
    () =>
      agentComments.filter(
        (comment) =>
          !comment.blockId || comment.blockId === selectedCanvasBlock?.id,
      ).slice(-4).reverse(),
    [agentComments, selectedCanvasBlock?.id],
  );
  const workspaceActive =
    Boolean(goal) ||
    sources.length > 0 ||
    reportSections.length > 0 ||
    canvasBlocks.length > 0 ||
    runPhase !== "ready";
  const canvasRef = useRef<HTMLDivElement>(null);

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
    agentComments,
    canvasBlocks,
    canvasTheme,
    collaborationSession,
    collaborationPresence,
    canvasChangeBatches,
    connectedAgent,
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
      agentComments,
      canvasBlocks,
      canvasTheme,
      collaborationSession,
      collaborationPresence,
      canvasChangeBatches,
      connectedAgent,
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
    agentComments,
    canvasBlocks,
    canvasTheme,
    collaborationSession,
    collaborationPresence,
    canvasChangeBatches,
    connectedAgent,
  ]);

  function replaceSourceEvidence(
    source: ResearchSource,
    segments: EvidenceItem[],
  ) {
    const nextSources = [
      ...live.current.sources.filter((item) => item.id !== source.id),
      source,
    ];
    const nextEvidence = [
      ...live.current.evidence.filter((item) => item.sourceId !== source.id),
      ...segments,
    ];
    // WebMCP clients may call the next tool before React commits a render.
    // Keep the semantic tool snapshot synchronous with the tool result.
    live.current = {
      ...live.current,
      sources: nextSources,
      evidence: nextEvidence,
    };
    setSources(nextSources);
    setEvidence(nextEvidence);
  }

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
        (revision) =>
          revision.field === field &&
          !revision.acknowledged &&
          !revision.sentAt,
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
    setActivity(`Human changed ${field} · save when ready`);
  }

  function identifyAgent(input: Record<string, unknown>) {
    const suppliedClient = String(input.client ?? input.name ?? "").trim();
    const client = suppliedClient.slice(0, 80) || "Unknown WebMCP client";
    const suppliedAgentId = String(input.agentId ?? "").trim();
    const agentId = suppliedAgentId.slice(0, 120) || undefined;
    const capabilities = Array.isArray(input.capabilities)
      ? [...new Set(input.capabilities.map(String).map((item) => item.trim()).filter(Boolean))]
          .slice(0, 16)
          .map((item) => item.slice(0, 60))
      : [];
    const now = new Date().toISOString();
    const previous = live.current.connectedAgent;
    const sameAgent = Boolean(
      previous &&
        previous.client === client &&
        previous.agentId === agentId,
    );
    const agent: ConnectedAgent = {
      client,
      ...(agentId ? { agentId } : {}),
      capabilities,
      identified: true,
      connectedAt: sameAgent && previous ? previous.connectedAt : now,
      lastSeenAt: now,
    };
    setConnectedAgent(agent);
    addAgentEvent(
      sameAgent ? "Agent presence refreshed" : "Agent identified",
      client,
    );
    setActivity(`Agent identified · ${client}`);
    return {
      ok: true,
      agent,
      note: "Client identity is supplied by the agent and is visible only in this page session.",
    };
  }

  function noteAgentActivity() {
    const now = new Date().toISOString();
    const current = live.current.connectedAgent;
    if (!current) {
      const anonymousAgent: ConnectedAgent = {
        client: "WebMCP client",
        capabilities: [],
        identified: false,
        connectedAt: now,
        lastSeenAt: now,
      };
      setConnectedAgent(anonymousAgent);
      addAgentEvent("WebMCP agent detected", "A client invoked a page tool");
      setActivity("WebMCP agent detected · identify to show its name");
      return;
    }
    setConnectedAgent({ ...current, lastSeenAt: now });
  }

  function startCanvasCollaboration() {
    const current = live.current.collaborationSession;
    if (current?.status === "active") {
      return {
        ok: true,
        session: current,
        lastSequence: collaborationSequence.current,
        nextSequence: collaborationSequence.current + 1,
      };
    }
    const session: CollaborationSession = {
      id: `collab-${crypto.randomUUID()}`,
      status: "active",
      startedAt: new Date().toISOString(),
    };
    setCollaborationSession(session);
    setCollaborationPresence("paused");
    addAgentEvent("Agent joined the canvas", "Live collaboration started");
    setActivity("Agent joined · ready to listen for saved changes");
    window.location.hash = "canvas";
    return {
      ok: true,
      session,
      lastSequence: collaborationSequence.current,
      nextSequence: collaborationSequence.current + 1,
    };
  }

  function sendCanvasChanges() {
    const revisions = live.current.humanRevisions.filter(
      (revision) => !revision.acknowledged && !revision.sentAt,
    );
    if (!revisions.length)
      return { ok: false, error: "There are no unsaved canvas changes." };

    const existingSession = live.current.collaborationSession;
    const session: CollaborationSession =
      existingSession?.status === "active"
        ? existingSession
        : {
            id: `collab-${crypto.randomUUID()}`,
            status: "active",
            startedAt: new Date().toISOString(),
          };
    if (session !== existingSession) {
      setCollaborationSession(session);
      setCollaborationPresence("paused");
    }

    const sentAt = new Date().toISOString();
    const sequence = ++collaborationSequence.current;
    const sentRevisions = revisions.map((revision) => ({
      ...revision,
      sentAt,
      sequence,
    }));
    const sentIds = new Set(sentRevisions.map((revision) => revision.id));
    setHumanRevisions((current) =>
      current.map((revision) =>
        sentIds.has(revision.id)
          ? { ...revision, sentAt, sequence }
          : revision,
      ),
    );

    const batch: CanvasChangeBatch = {
      id: `change-${crypto.randomUUID()}`,
      sessionId: session.id,
      sequence,
      createdAt: sentAt,
      revisions: sentRevisions,
      canvas: {
        title: live.current.reportTitle,
        overview: live.current.reportOverview,
        theme: live.current.canvasTheme,
        blocks: live.current.canvasBlocks,
      },
    };
    setCanvasChangeBatches((current) => [...current.slice(-19), batch]);
    window.dispatchEvent(
      new CustomEvent("livesignal:collaboration-event", {
        detail: { type: "canvas_change", batch },
      }),
    );
    addAgentEvent(
      "Human saved canvas changes",
      `${sentRevisions.length} change${sentRevisions.length === 1 ? "" : "s"} · batch ${sequence}`,
    );
    setActivity(
      live.current.collaborationPresence === "listening"
        ? "Saved changes sent to the active agent"
        : "Changes saved for the agent",
    );
    return { ok: true, session, batch };
  }

  function finishCanvasCollaboration(reason = "human-finished") {
    const current = live.current.collaborationSession;
    if (!current || current.status !== "active")
      return { ok: true, status: "finished" };
    const finished: CollaborationSession = {
      ...current,
      status: "finished",
      finishedAt: new Date().toISOString(),
      finishReason: reason,
    };
    setCollaborationSession(finished);
    setCollaborationPresence("finished");
    setAgentListening(false);
    window.dispatchEvent(
      new CustomEvent("livesignal:collaboration-event", {
        detail: { type: "session_finished", session: finished },
      }),
    );
    addAgentEvent("Collaboration finished", reason.replaceAll("-", " "));
    setActivity("Collaboration finished · canvas remains saved");
    return { ok: true, status: "finished", session: finished };
  }

  function createAgentComment(
    query: string,
    kind: AgentCommentKind,
    blockId?: string,
    visualPlacement?: CanvasImage["placement"],
  ) {
    const cleanQuery = query.trim();
    if (!cleanQuery) return null;
    const block = live.current.canvasBlocks.find((item) => item.id === blockId);
    const comment: AgentComment = {
      id: `comment-${crypto.randomUUID()}`,
      kind,
      query: cleanQuery,
      blockId: block?.id,
      blockTitle: block?.title,
      blockBody: block?.body,
      ...(visualPlacement ? { visualPlacement } : {}),
      evidenceIds: block?.evidenceIds ?? [],
      status: "pending",
      createdAt: new Date().toISOString(),
      addedEvidenceIds: [],
      updatedBlockIds: [],
    };
    setAgentComments((current) => [...current.slice(-11), comment]);
    setPublished(false);
    addAgentEvent(
      "Human asked the agent",
      block ? `${block.title} · ${cleanQuery}` : `Whole canvas · ${cleanQuery}`,
    );
    setActivity("Comment sent · ready for agent research");
    window.dispatchEvent(
      new CustomEvent("livesignal:agent-comment", { detail: comment }),
    );
    return comment;
  }

  function submitAgentComment() {
    const blockId =
      agentCommentScope === "block" ? selectedCanvasBlock?.id : undefined;
    const comment = createAgentComment(
      agentCommentQuery,
      agentCommentKind,
      blockId,
    );
    if (!comment) return;
    setAgentCommentQuery("");
  }

  function requestCanvasVisual(
    block: CanvasBlock,
    placement: CanvasImage["placement"] = "inline",
    regenerate = false,
    sendImmediately = false,
  ) {
    setSelectedCanvasId(block.id);
    setAgentCommentScope("block");
    setAgentCommentKind("create-visual");
    const direction =
      placement === "background"
        ? `Create a full-card background for this card. Keep the ${canvasTheme.replace("-", " ")} mood, leave clear contrast for the card's text, and do not include words or source claims in the artwork.`
        : regenerate
          ? `Create a new visual direction for this card. Keep the ${canvasTheme.replace("-", " ")} mood, but make the composition more distinctive and shareable.`
          : `Create an editorial illustration for this card that matches the ${canvasTheme.replace("-", " ")} canvas mood.`;
    if (sendImmediately) {
      createAgentComment(direction, "create-visual", block.id, placement);
      return;
    }
    setAgentCommentQuery(direction);
    window.requestAnimationFrame(() =>
      agentCommentInputRef.current?.focus(),
    );
  }

  function claimAgentComment(id: string, plan?: string) {
    const existing = live.current.agentComments.find((item) => item.id === id);
    if (!existing)
      return { ok: false, error: "Agent comment not found." };
    const claimedAt = new Date().toISOString();
    setAgentComments((current) =>
      current.map((comment) =>
        comment.id === id
          ? {
              ...comment,
              status: "researching",
              claimedAt,
              plan: plan?.trim() || "Reviewing the request and source evidence",
            }
          : comment,
      ),
    );
    if (live.current.collaborationSession?.status === "active")
      setCollaborationPresence("responding");
    addAgentEvent("Agent picked up a comment", existing.query);
    setActivity("Agent is researching your canvas comment");
    return { ok: true, commentId: id, status: "researching" };
  }

  function answerAgentComment(
    id: string,
    response: string,
    addedEvidenceIds: string[],
    updatedBlockIds: string[],
  ) {
    const existing = live.current.agentComments.find((item) => item.id === id);
    if (!existing)
      return { ok: false, error: "Agent comment not found." };
    const cleanResponse = response.trim();
    if (!cleanResponse)
      return { ok: false, error: "A concise answer is required." };
    const answeredAt = new Date().toISOString();
    setAgentComments((current) =>
      current.map((comment) =>
        comment.id === id
          ? {
              ...comment,
              status: "answered",
              answeredAt,
              response: cleanResponse,
              addedEvidenceIds,
              updatedBlockIds,
            }
          : comment,
      ),
    );
    if (live.current.collaborationSession?.status === "active")
      setCollaborationPresence("paused");
    addAgentEvent("Agent answered a canvas comment", cleanResponse);
    setActivity("New research returned to the canvas");
    window.location.hash = "canvas";
    return { ok: true, commentId: id, status: "answered" };
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
          const presentation = evidencePresentation(item);
          const label = item.timestamp
            ? `${item.timestamp} · ${source.creator} — ${source.title}${
                presentation.label
                  ? ` (${presentation.label.toLowerCase()})`
                  : ""
              }`
            : `${presentation.label.toLowerCase()} without timestamp · ${source.creator} — ${source.title}`;
          lines.push(
            `- [${label}](${timestampUrl(source, item.seconds)})`,
            `  > ${item.text}`,
          );
        });
        lines.push("");
      }
    });
    lines.push(
      "---",
      "",
      `Created with LiveSignal from ${state.sources.length} video sources and ${timedEvidenceCount(state.evidence)} timestamped evidence moments.`,
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

  function revokeCanvasImages(blocks = live.current.canvasBlocks) {
    blocks.forEach((block) => {
      if (block.image?.url.startsWith("blob:"))
        URL.revokeObjectURL(block.image.url);
      if (block.backgroundImage?.url.startsWith("blob:"))
        URL.revokeObjectURL(block.backgroundImage.url);
    });
  }

  function seedCanvas(sections: ReportSection[]) {
    const blocks = canvasFromReport(sections);
    live.current = { ...live.current, canvasBlocks: blocks };
    setCanvasBlocks(blocks);
    setSelectedCanvasId(blocks[0]?.id ?? "");
    setCanvasView("canvas");
    return blocks;
  }

  function updateCanvasBlock(id: string, patch: Partial<CanvasBlock>) {
    setCanvasBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, ...patch, id } : block,
      ),
    );
    setPublished(false);
  }

  async function generateCanvasImage(
    blockId: string,
    prompt: string,
    alt?: string,
    placement: CanvasImage["placement"] = "inline",
  ) {
    const block = live.current.canvasBlocks.find((item) => item.id === blockId);
    const cleanPrompt = prompt.trim();
    if (!block) return { ok: false, error: "Canvas block not found." };
    if (!cleanPrompt)
      return { ok: false, error: "Describe the illustration to generate." };

    setImageGeneratingBlockId(blockId);
    setActivity(`Agent is illustrating “${block.title}”`);
    addAgentEvent("Image generation started", block.title);
    try {
      const response = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanPrompt,
          title: block.title,
          body: block.body,
          theme: live.current.canvasTheme,
          placement,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          String(errorBody.error ?? "The illustration could not be generated."),
        );
      }

      const imageBlob = await response.blob();
      const image: CanvasImage = {
        id: `image-${crypto.randomUUID()}`,
        url: URL.createObjectURL(imageBlob),
        alt: alt?.trim() || `AI-generated illustration for ${block.title}`,
        prompt: cleanPrompt,
        model: response.headers.get("X-LiveSignal-Image-Model") ?? "OpenAI image model",
        generatedAt: new Date().toISOString(),
        placement,
      };
      const previousUrl =
        placement === "background"
          ? block.backgroundImage?.url
          : block.image?.url;
      updateCanvasBlock(
        blockId,
        placement === "background" ? { backgroundImage: image } : { image },
      );
      if (previousUrl?.startsWith("blob:")) URL.revokeObjectURL(previousUrl);
      addAgentEvent("Illustration added", `${block.title} · AI-generated`);
      setActivity("Agent added an AI-generated illustration");
      return {
        ok: true,
        blockId,
        image: {
          id: image.id,
          alt: image.alt,
          prompt: image.prompt,
          model: image.model,
          generatedAt: image.generatedAt,
          placement: image.placement,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addAgentEvent("Image generation stopped", message);
      setActivity(`Image generation unavailable · ${message}`);
      return { ok: false, error: message };
    } finally {
      setImageGeneratingBlockId("");
    }
  }

  function removeCanvasImage(
    blockId: string,
    humanInitiated = false,
    placement: CanvasImage["placement"] = "inline",
  ) {
    const block = live.current.canvasBlocks.find((item) => item.id === blockId);
    const image =
      placement === "background" ? block?.backgroundImage : block?.image;
    if (!block || !image)
      return { ok: false, error: `This card has no ${placement} image.` };
    if (image.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
    updateCanvasBlock(
      blockId,
      placement === "background"
        ? { backgroundImage: undefined }
        : { image: undefined },
    );
    const imageLabel = placement === "background" ? "backdrop" : "illustration";
    if (humanInitiated) {
      recordHumanRevision(
        "canvas image",
        `Removed AI-generated ${imageLabel} from ${block.title}`,
      );
    }
    addAgentEvent(`${imageLabel === "backdrop" ? "Backdrop" : "Illustration"} removed`, block.title);
    setActivity(`AI-generated ${imageLabel} removed`);
    return { ok: true, blockId, placement };
  }

  function addCanvasBlock(input?: Partial<CanvasBlock>) {
    const block: CanvasBlock = {
      id: input?.id ?? `canvas-note-${crypto.randomUUID()}`,
      kind: input?.kind ?? "note",
      title: input?.title ?? "My note",
      body:
        input?.body ??
        "Add a personal observation, substitution, reminder, or finishing touch.",
      evidenceIds: input?.evidenceIds ?? [],
      span: input?.span ?? "half",
      accent: input?.accent ?? "coral",
    };
    setCanvasBlocks((current) => [...current, block]);
    setSelectedCanvasId(block.id);
    setPublished(false);
    return block;
  }

  function removeCanvasBlock(id: string) {
    const block = live.current.canvasBlocks.find((item) => item.id === id);
    if (block?.image?.url.startsWith("blob:"))
      URL.revokeObjectURL(block.image.url);
    if (block?.backgroundImage?.url.startsWith("blob:"))
      URL.revokeObjectURL(block.backgroundImage.url);
    setCanvasBlocks((current) => current.filter((block) => block.id !== id));
    setSelectedCanvasId((current) => (current === id ? "" : current));
    setPublished(false);
  }

  function reorderCanvasBlock(id: string, targetIndex: number) {
    setCanvasBlocks((current) => {
      const from = current.findIndex((block) => block.id === id);
      if (from < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      const to = Math.max(0, Math.min(next.length, targetIndex));
      next.splice(to, 0, moved);
      return next;
    });
    setPublished(false);
  }

  function dropCanvasBlock(targetId: string) {
    if (!draggedCanvasId || draggedCanvasId === targetId) return;
    const targetIndex = canvasBlocks.findIndex((block) => block.id === targetId);
    const moved = canvasBlocks.find((block) => block.id === draggedCanvasId);
    reorderCanvasBlock(draggedCanvasId, targetIndex);
    recordHumanRevision(
      "canvas layout",
      `Moved ${moved?.title ?? "a block"} to position ${targetIndex + 1}`,
    );
    setDraggedCanvasId("");
  }

  async function downloadCanvas() {
    const canvasState = live.current;
    if (!canvasRef.current || canvasState.canvasBlocks.length === 0)
      return { ok: false, error: "Create the canvas first." };
    setCanvasExporting(true);
    try {
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor:
          canvasState.canvasTheme === "field-notes" ? "#1f2821" : "#f3ead8",
      });
      const slug =
        canvasState.reportTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "livesignal-canvas";
      const filename = `${slug}.png`;
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = filename;
      anchor.click();
      setActivity("Shareable canvas downloaded");
      return { ok: true, filename };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Canvas export failed.";
      setActivity("Canvas export needs another try");
      return { ok: false, error: message };
    } finally {
      setCanvasExporting(false);
    }
  }

  function startResearch(nextGoal = goal) {
    const cleanGoal = nextGoal.trim();
    if (!cleanGoal) return;
    if (live.current.collaborationSession?.status === "active")
      finishCanvasCollaboration("new-project");
    setCollaborationSession(null);
    setCollaborationPresence("inactive");
    setCanvasChangeBatches([]);
    collaborationSequence.current = 0;
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
    revokeCanvasImages();
    setCanvasBlocks([]);
    setSelectedCanvasId("");
    setCanvasTheme("notebook");
    setCanvasView("canvas");
    setHumanRevisions([]);
    setAgentComments([]);
    setPublished(false);
    setIngestError("");
    setRunPhase("discovering");
    const nextAgentEvents = [
      {
        id: crypto.randomUUID(),
        label: "Request accepted",
        detail: cleanGoal,
      },
    ];
    live.current = {
      ...live.current,
      goal: cleanGoal,
      brief: EMPTY_BRIEF,
      sources: [],
      evidence: [],
      pinnedIds: [],
      reportTitle: "Untitled research report",
      reportOverview: "",
      reportSections: [],
      published: false,
      runPhase: "discovering",
      agentEvents: nextAgentEvents,
      humanRevisions: [],
      agentComments: [],
      canvasBlocks: [],
      canvasTheme: "notebook",
      collaborationSession: null,
      collaborationPresence: "inactive",
      canvasChangeBatches: [],
    };
    setAgentEvents(nextAgentEvents);
    setActivity("ChatGPT is discovering relevant videos");
    window.location.hash = "workspace";
  }

  function submitEntryRequest() {
    const cleanRequest = entryPrompt.trim();
    if (!cleanRequest) return;
    const request = {
      request: cleanRequest,
      createdAt: new Date().toISOString(),
      outputFormat: EMPTY_BRIEF.outputFormat,
    };
    startResearch(cleanRequest);
    setEntryPrompt("");
    setActivity(
      agentListeningForRequest
        ? "Your agent received the request"
        : "Request ready · your active agent can begin",
    );
    window.dispatchEvent(
      new CustomEvent("livesignal:research-request", { detail: request }),
    );
  }

  function loadExample() {
    if (live.current.collaborationSession?.status === "active")
      finishCanvasCollaboration("opened-example");
    setCollaborationSession(null);
    setCollaborationPresence("inactive");
    setCanvasChangeBatches([]);
    collaborationSequence.current = 0;
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
    revokeCanvasImages();
    seedCanvas(example.sections);
    setCanvasTheme("notebook");
    setHumanRevisions([]);
    setAgentComments([]);
    setPublished(false);
    setIngestError("");
    setRunPhase("review");
    setAgentEvents([
      {
        id: crypto.randomUUID(),
        label: "Example completed",
        detail: "5 sources · 6 cited canvas sections",
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
    const segments = (
      result.transcript.segments as TranscriptSegment[]
    ).map((segment) => ({
      ...segment,
      sourceId: String(result.source.id),
      origin: "transcript" as const,
    }));
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
    replaceSourceEvidence(source, segments);
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
      .map((segment, index): EvidenceItem => {
        const timing = normalizeEvidenceTiming(segment);
        return {
          id: String(segment.id ?? `${videoId}-${index}`),
          sourceId: videoId,
          text: String(segment.text ?? ""),
          seconds: timing.seconds,
          durationSeconds: Number(segment.durationSeconds ?? 0),
          timestamp: timing.timestamp,
          origin: "extension",
        };
      })
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
    replaceSourceEvidence(source, segments);
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
    const transcriptPool = live.current.evidence.filter(
      (entry) => entry.sourceId === sourceId && entry.origin === "transcript",
    );
    const reservedEvidenceIds = new Set(
      live.current.evidence
        .filter((entry) => entry.sourceId !== sourceId)
        .map((entry) => entry.id),
    );
    const segments = (
      Array.isArray(input.evidence)
        ? (input.evidence as Array<Record<string, unknown>>)
        : []
    )
      .map((item, index): EvidenceItem => {
        const timing = normalizeEvidenceTiming(item);
        const text = String(item.text ?? "");
        const match = findTranscriptMatch(text, timing, transcriptPool);
        return {
          id: reserveUniqueEvidenceId(
            item.id,
            `${sourceId}-agent-${index}`,
            sourceId,
            reservedEvidenceIds,
          ),
          sourceId,
          text: text.trim(),
          seconds: match ? match.seconds : timing.seconds,
          durationSeconds: Number(item.durationSeconds ?? 0),
          timestamp: match ? match.timestamp : timing.timestamp,
          note: item.note === undefined ? undefined : String(item.note),
          origin: match ? "transcript" : "agent",
        };
      })
      .filter((item) => item.text);
    const verifiedCount = segments.filter(
      (item) => item.origin === "transcript",
    ).length;
    const claimCount = segments.length - verifiedCount;
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
          "Selected by the agent in the browser",
      ),
      transcriptCount: segments.length,
    };
    replaceSourceEvidence(source, segments);
    if (segments[0]) setFocusEvidenceId(segments[0].id);
    setRunPhase("extracting");
    addAgentEvent(
      "Agent evidence recorded",
      `${title} · ${segments.length} moments · ${verifiedCount} verified, ${claimCount} agent claims`,
    );
    setActivity(
      `ChatGPT added ${segments.length} moments · ${verifiedCount} transcript-verified`,
    );
    return {
      ok: true,
      source,
      evidence: segments,
      verifiedAgainstTranscript: verifiedCount,
      agentClaims: claimCount,
      note: claimCount
        ? "Unverified claims are stored as agent claims, not transcript moments. Ingest the video first or cite exact transcript wording to verify them."
        : "All recorded moments matched the imported transcript.",
    };
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
          .map((item, evidenceIndex): EvidenceItem => {
            const timing = normalizeEvidenceTiming(item);
            return {
              id: String(
                item.id ?? `${sourceId}-evidence-${evidenceIndex + 1}`,
              ),
              sourceId,
              text: String(item.text ?? "").trim(),
              seconds: timing.seconds,
              durationSeconds: Number(item.durationSeconds ?? 0),
              timestamp: timing.timestamp,
              note: item.note === undefined ? undefined : String(item.note),
              confidence:
                item.confidence === undefined
                  ? undefined
                  : Number(item.confidence),
              origin: "agent",
            };
          })
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
              "Selected by the agent in the browser",
          ),
          transcriptCount: sourceEvidence.length,
        });
        nextEvidence.push(...sourceEvidence);
      }
      if (nextSources.length === 0)
        throw new Error("The agent result needs at least one source.");
      if (nextEvidence.length === 0)
        throw new Error("The agent result needs at least one evidence item.");

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

      if (live.current.collaborationSession?.status === "active")
        finishCanvasCollaboration("new-agent-project");
      setCollaborationSession(null);
      setCollaborationPresence("inactive");
      setCanvasChangeBatches([]);
      collaborationSequence.current = 0;

      setGoal(request);
      setSearchQuery(request);
      setBrief({
        mustCover: String(briefInput.mustCover ?? ""),
        constraints: String(briefInput.constraints ?? ""),
        outputFormat: String(
          briefInput.outputFormat ?? "A concise, shareable visual guide",
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
      revokeCanvasImages();
      seedCanvas(sections);
      setCanvasTheme("notebook");
      setHumanRevisions([]);
      setAgentComments([]);
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
      window.location.hash = "canvas";
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
    const shouldRegisterWebMcp = Boolean(
      page.modelContext && !registered.current,
    );
    if (shouldRegisterWebMcp) registered.current = true;
    const jobs: Promise<void>[] = [];
    const toolHandlers = new Map<
      string,
      (input: Record<string, unknown>) => unknown
    >();
    const tool = (
      name: string,
      description: string,
      execute: (input: Record<string, unknown>) => unknown,
      inputSchema?: object,
    ) => {
      const executeWithPresence = (input: Record<string, unknown>) => {
        if (name !== "identify_agent") noteAgentActivity();
        return execute(input);
      };
      toolHandlers.set(name, executeWithPresence);
      if (!shouldRegisterWebMcp) return;
      jobs.push(
        page.modelContext!.registerTool({
          name,
          description,
          execute: executeWithPresence,
          inputSchema,
        }),
      );
    };

    tool(
      "identify_agent",
      "Optional connection handshake. Identify the client and its capabilities so the shared workspace can show which agent is present. Call once when opening LiveSignal and again when reconnecting.",
      (input) => identifyAgent(input),
      {
        type: "object",
        properties: {
          client: {
            type: "string",
            description: "Human-readable client name, for example ChatGPT or Claude Code.",
          },
          agentId: {
            type: "string",
            description: "Optional client-local agent or session identifier.",
          },
          capabilities: {
            type: "array",
            items: { type: "string" },
            description: "Optional capabilities this agent can perform in this workspace.",
          },
        },
      },
    );
    tool(
      "get_workspace_state",
      "Returns the current visible research brief, sources, timestamped evidence, evidence draft, visual canvas, and publication status.",
      () => live.current,
    );
    tool(
      "start_canvas_collaboration",
      "Starts or resumes a live human-agent canvas session. Call once after creating the canvas, then repeatedly call wait_for_collaboration_event until the human finishes the session.",
      () => startCanvasCollaboration(),
    );
    tool(
      "wait_for_collaboration_event",
      "Waits for the next saved canvas-change batch, actionable human comment, or session-finished signal. Re-call after handling each event or timeout while the session remains active.",
      async (input) => {
        const session = live.current.collaborationSession;
        if (!session || session.status !== "active") {
          return {
            status: "not_started",
            next: "Call start_canvas_collaboration first.",
          };
        }
        const requestedSessionId = String(input.sessionId ?? session.id);
        if (requestedSessionId !== session.id) {
          return {
            status: "session_mismatch",
            activeSessionId: session.id,
          };
        }
        const afterSequence = Math.max(0, Number(input.afterSequence ?? 0));
        const existingComment = live.current.agentComments.find(
          (comment) => comment.status === "pending",
        );
        if (existingComment) {
          setCollaborationPresence("responding");
          return {
            status: "comment",
            sessionId: session.id,
            comment: existingComment,
          };
        }
        const existingBatch = live.current.canvasChangeBatches.find(
          (batch) =>
            batch.sessionId === session.id && batch.sequence > afterSequence,
        );
        if (existingBatch) {
          setCollaborationPresence("responding");
          return {
            status: "canvas_change",
            sessionId: session.id,
            sequence: existingBatch.sequence,
            batch: existingBatch,
          };
        }

        const requestedMs = Number(input.timeoutMs ?? 30000);
        const timeoutMs = Math.max(1000, Math.min(requestedMs, 45000));
        setAgentListening(true);
        setCollaborationPresence("listening");
        setActivity("Agent is listening for saved canvas changes");
        return await new Promise((resolve) => {
          let settled = false;
          const finish = (result: Record<string, unknown>) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            window.removeEventListener(
              "livesignal:collaboration-event",
              onCollaborationEvent as EventListener,
            );
            window.removeEventListener(
              "livesignal:agent-comment",
              onComment as EventListener,
            );
            setAgentListening(false);
            if (result.status === "idle") setCollaborationPresence("paused");
            resolve(result);
          };
          const onCollaborationEvent = (event: Event) => {
            const detail = (
              event as CustomEvent<{
                type: "canvas_change" | "session_finished";
                batch?: CanvasChangeBatch;
                session?: CollaborationSession;
              }>
            ).detail;
            if (detail.type === "session_finished") {
              setCollaborationPresence("finished");
              finish({
                status: "finished",
                session: detail.session,
              });
              return;
            }
            if (
              detail.batch?.sessionId === session.id &&
              detail.batch.sequence > afterSequence
            ) {
              setCollaborationPresence("responding");
              finish({
                status: "canvas_change",
                sessionId: session.id,
                sequence: detail.batch.sequence,
                batch: detail.batch,
              });
            }
          };
          const onComment = (event: Event) => {
            setCollaborationPresence("responding");
            finish({
              status: "comment",
              sessionId: session.id,
              comment: (event as CustomEvent<AgentComment>).detail,
            });
          };
          const timeoutId = window.setTimeout(
            () =>
              finish({
                status: "idle",
                sessionId: session.id,
                afterSequence,
                waitedMs: timeoutMs,
              }),
            timeoutMs,
          );
          window.addEventListener(
            "livesignal:collaboration-event",
            onCollaborationEvent as EventListener,
          );
          window.addEventListener(
            "livesignal:agent-comment",
            onComment as EventListener,
          );
        });
      },
      {
        type: "object",
        properties: {
          sessionId: { type: "string" },
          afterSequence: {
            type: "number",
            description:
              "Last handled canvas-change sequence. Use 0 for a new session.",
          },
          timeoutMs: {
            type: "number",
            description: "Renewable wait duration, capped at 45000 ms.",
          },
        },
      },
    );
    tool(
      "finish_canvas_collaboration",
      "Finishes the active canvas collaboration session when the human asks to close the case. Saved work remains on the page.",
      (input) =>
        finishCanvasCollaboration(
          String(input.reason ?? "agent-confirmed-finish"),
        ),
      {
        type: "object",
        properties: { reason: { type: "string" } },
      },
    );
    tool(
      "get_human_revisions",
      "Returns saved human edits that the agent has not yet acknowledged, plus unsaved-change count and the current shared artifact.",
      () => ({
        revisions: live.current.humanRevisions.filter(
          (revision) => !revision.acknowledged && revision.sentAt,
        ),
        unsavedCount: live.current.humanRevisions.filter(
          (revision) => !revision.acknowledged && !revision.sentAt,
        ).length,
        latestSequence:
          live.current.canvasChangeBatches.at(-1)?.sequence ?? 0,
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
        const acknowledgement = acknowledgeSavedRevisions(
          live.current.humanRevisions,
          requestedIds,
          acknowledgeAll,
        );
        setHumanRevisions(acknowledgement.revisions);
        addAgentEvent(
          "Human edits acknowledged",
          acknowledgeAll
            ? "Agent read the latest shared draft"
            : `${requestedIds.length} revisions read`,
        );
        if (live.current.collaborationSession?.status === "active")
          setCollaborationPresence("paused");
        setActivity("Agent caught up with human edits");
        return {
          ok: true,
          acknowledged: acknowledgeAll
            ? "all"
            : acknowledgement.acknowledgedIds,
          acknowledgedIds: acknowledgement.acknowledgedIds,
          remainingUnacknowledged:
            acknowledgement.remainingUnacknowledged,
          unsavedCount: acknowledgement.unsavedCount,
        };
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
      "wait_for_research_request",
      "Waits for the human to submit a new one-line goal from LiveSignal's consumer entry screen. Use after opening a blank LiveSignal page and telling the human you are ready for their request.",
      async (input) => {
        if (
          live.current.goal &&
          live.current.runPhase === "discovering" &&
          live.current.sources.length === 0
        ) {
          return {
            status: "request",
            request: live.current.goal,
            outputFormat: live.current.brief.outputFormat,
          };
        }
        const requestedMs = Number(input.timeoutMs ?? 30000);
        const timeoutMs = Math.max(1000, Math.min(requestedMs, 45000));
        setAgentListeningForRequest(true);
        setActivity("Your agent is ready for one request");
        return await new Promise((resolve) => {
          let settled = false;
          const finish = (result: Record<string, unknown>) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            window.removeEventListener(
              "livesignal:research-request",
              onRequest as EventListener,
            );
            setAgentListeningForRequest(false);
            resolve(result);
          };
          const onRequest = (event: Event) => {
            const detail = (
              event as CustomEvent<{
                request: string;
                createdAt: string;
                outputFormat: string;
              }>
            ).detail;
            finish({ status: "request", ...detail });
          };
          const timeoutId = window.setTimeout(
            () => finish({ status: "idle", waitedMs: timeoutMs }),
            timeoutMs,
          );
          window.addEventListener(
            "livesignal:research-request",
            onRequest as EventListener,
          );
        });
      },
      {
        type: "object",
        properties: {
          timeoutMs: {
            type: "number",
            description: "Wait duration in milliseconds, capped at 45000.",
          },
        },
      },
    );
    tool(
      "get_agent_comments",
      "Returns actionable comments the human attached to a canvas block or the whole artifact. Check for pending comments during active collaboration, then research and answer them with evidence-backed canvas updates.",
      (input) => {
        const requestedStatus = String(input.status ?? "open");
        const comments = live.current.agentComments.filter((comment) =>
          requestedStatus === "all"
            ? true
            : requestedStatus === "open"
              ? comment.status !== "answered"
              : comment.status === requestedStatus,
        );
        return {
          comments,
          canvas: {
            title: live.current.reportTitle,
            overview: live.current.reportOverview,
            theme: live.current.canvasTheme,
            blocks: live.current.canvasBlocks,
          },
          evidence: live.current.evidence,
          sources: live.current.sources,
        };
      },
      {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["open", "pending", "researching", "answered", "all"],
          },
        },
      },
    );
    tool(
      "wait_for_agent_comment",
      "Waits briefly for the human's next canvas comment and returns it with block and evidence context as soon as it is sent. Use during an active co-creation session after telling the human you are listening.",
      async (input) => {
        const existing = live.current.agentComments.find(
          (comment) => comment.status === "pending",
        );
        if (existing) return { status: "comment", comment: existing };
        const requestedMs = Number(input.timeoutMs ?? 30000);
        const timeoutMs = Math.max(1000, Math.min(requestedMs, 45000));
        setAgentListening(true);
        setActivity("Agent is listening for your next canvas comment");
        return await new Promise((resolve) => {
          let settled = false;
          const finish = (result: Record<string, unknown>) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timeoutId);
            window.removeEventListener(
              "livesignal:agent-comment",
              onComment as EventListener,
            );
            setAgentListening(false);
            resolve(result);
          };
          const onComment = (event: Event) => {
            const detail = (event as CustomEvent<AgentComment>).detail;
            finish({ status: "comment", comment: detail });
          };
          const timeoutId = window.setTimeout(
            () => finish({ status: "idle", waitedMs: timeoutMs }),
            timeoutMs,
          );
          window.addEventListener(
            "livesignal:agent-comment",
            onComment as EventListener,
          );
        });
      },
      {
        type: "object",
        properties: {
          timeoutMs: {
            type: "number",
            description: "Wait duration in milliseconds, capped at 45000.",
          },
        },
      },
    );
    tool(
      "claim_agent_comment",
      "Marks one human canvas comment as actively being researched and shows the agent's plan in the shared interface. Call before opening more videos or changing the canvas.",
      (input) =>
        claimAgentComment(
          String(input.commentId ?? ""),
          input.plan === undefined ? undefined : String(input.plan),
        ),
      {
        type: "object",
        properties: {
          commentId: { type: "string" },
          plan: { type: "string" },
        },
        required: ["commentId"],
      },
    );
    tool(
      "answer_agent_comment",
      "Closes one human canvas comment after the agent has researched it and made any scoped canvas change. Summarize what was learned and identify new evidence or updated blocks so the human can inspect the result.",
      (input) =>
        answerAgentComment(
          String(input.commentId ?? ""),
          String(input.response ?? ""),
          Array.isArray(input.addedEvidenceIds)
            ? input.addedEvidenceIds.map(String)
            : [],
          Array.isArray(input.updatedBlockIds)
            ? input.updatedBlockIds.map(String)
            : [],
        ),
      {
        type: "object",
        properties: {
          commentId: { type: "string" },
          response: { type: "string" },
          addedEvidenceIds: { type: "array", items: { type: "string" } },
          updatedBlockIds: { type: "array", items: { type: "string" } },
        },
        required: ["commentId", "response"],
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
            input.outputFormat ?? "A concise, shareable visual guide",
          ),
        };
        live.current = { ...live.current, brief: nextBrief };
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
        live.current = { ...live.current, brief: next };
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
      "Writes a video and evidence researched in another browser tab back into LiveSignal. Use this when ChatGPT reads captions or source moments directly, especially when server transcript import is unavailable. Supply a timestamp or seconds whenever possible. Text is matched against imported transcript rows near that time; unmatched or untimed entries remain visibly labelled agent claims.",
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
      "Writes a complete editable report from researched evidence. Each section may cite evidence IDs recorded earlier in this workspace.",
      (input) => {
        const nextTitle = String(input.title ?? "Untitled research report");
        const nextOverview = String(input.overview ?? "");
        const requestedSections = Array.isArray(input.sections)
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
        const knownEvidence = new Set(
          live.current.evidence.map((item) => item.id),
        );
        const droppedCitations: string[] = [];
        const nextSections = requestedSections.map((section) => ({
          ...section,
          evidenceIds: section.evidenceIds.filter((id) => {
            if (knownEvidence.has(id)) return true;
            droppedCitations.push(id);
            return false;
          }),
        }));
        live.current = {
          ...live.current,
          reportTitle: nextTitle,
          reportOverview: nextOverview,
          reportSections: nextSections,
          published: false,
          runPhase: "review",
        };
        setReportTitle(nextTitle);
        setReportOverview(nextOverview);
        setReportSections(nextSections);
        if (live.current.canvasBlocks.length === 0) seedCanvas(nextSections);
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
          droppedCitations,
          ...(droppedCitations.length
            ? {
                warning:
                  "Some cited evidence IDs do not exist in this workspace and were removed. Record the evidence first, then cite the returned IDs.",
              }
            : {}),
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
        let droppedCitations: string[] = [];
        if (Array.isArray(input.sections)) {
          const knownEvidence = new Set(
            live.current.evidence.map((item) => item.id),
          );
          droppedCitations = [];
          const next = (input.sections as Array<Record<string, unknown>>).map(
            (section, index): ReportSection => ({
              id: String(section.id ?? `revision-${Date.now()}-${index}`),
              heading: String(section.heading ?? `Finding ${index + 1}`),
              body: String(section.body ?? ""),
              evidenceIds: (Array.isArray(section.evidenceIds)
                ? section.evidenceIds.map(String)
                : []
              ).filter((id) => {
                if (knownEvidence.has(id)) return true;
                droppedCitations.push(id);
                return false;
              }),
            }),
          );
          setReportSections(next);
          if (droppedCitations.length)
            addAgentEvent(
              "Unknown citations dropped",
              `${droppedCitations.length} cited IDs are not in this workspace`,
            );
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
        return { ok: true, instruction: input.instruction, droppedCitations };
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
      "get_canvas_state",
      "Returns the current human-composed visual canvas, block order, theme, citations, and pending human revisions. Read this before reacting to a layout or copy change.",
      () => ({
        title: live.current.reportTitle,
        overview: live.current.reportOverview,
        theme: live.current.canvasTheme,
        blocks: live.current.canvasBlocks,
        pendingHumanRevisions: live.current.humanRevisions.filter(
          (revision) => !revision.acknowledged,
        ),
      }),
    );
    tool(
      "create_canvas",
      "Creates or replaces the shareable visual canvas from evidence-backed blocks. Use once after research; do not overwrite later human composition unless explicitly asked.",
      (input) => {
        const nextBlocks = (
          Array.isArray(input.blocks)
            ? (input.blocks as Array<Record<string, unknown>>)
            : []
        ).map((block, index): CanvasBlock => ({
          id: String(block.id ?? `agent-canvas-${index + 1}`),
          kind: ["feature", "steps", "note", "quote"].includes(
            String(block.kind),
          )
            ? (String(block.kind) as CanvasBlockKind)
            : "note",
          title: String(block.title ?? `Block ${index + 1}`),
          body: String(block.body ?? ""),
          evidenceIds: Array.isArray(block.evidenceIds)
            ? block.evidenceIds.map(String)
            : [],
          span: String(block.span) === "wide" ? "wide" : "half",
          accent: ["coral", "sage", "gold", "ink"].includes(
            String(block.accent),
          )
            ? (String(block.accent) as CanvasBlock["accent"])
            : "sage",
        }));
        if (!nextBlocks.length)
          return { ok: false, error: "At least one canvas block is required." };
        setCanvasBlocks(nextBlocks);
        setSelectedCanvasId(nextBlocks[0].id);
        if (["notebook", "editorial", "field-notes"].includes(String(input.theme)))
          setCanvasTheme(String(input.theme) as CanvasTheme);
        setCanvasView("canvas");
        setActivity("Agent composed the visual canvas");
        window.location.hash = "canvas";
        return { ok: true, blockCount: nextBlocks.length };
      },
      {
        type: "object",
        properties: {
          theme: {
            type: "string",
            enum: ["notebook", "editorial", "field-notes"],
          },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                kind: {
                  type: "string",
                  enum: ["feature", "steps", "note", "quote"],
                },
                title: { type: "string" },
                body: { type: "string" },
                evidenceIds: { type: "array", items: { type: "string" } },
                span: { type: "string", enum: ["half", "wide"] },
                accent: {
                  type: "string",
                  enum: ["coral", "sage", "gold", "ink"],
                },
              },
              required: ["title", "body"],
            },
          },
        },
        required: ["blocks"],
      },
    );
    tool(
      "add_canvas_block",
      "Adds a new visual block without disturbing the human's existing canvas order.",
      (input) => ({
        ok: true,
        block: addCanvasBlock({
          kind: ["feature", "steps", "note", "quote"].includes(
            String(input.kind),
          )
            ? (String(input.kind) as CanvasBlockKind)
            : "note",
          title: String(input.title ?? "New block"),
          body: String(input.body ?? ""),
          evidenceIds: Array.isArray(input.evidenceIds)
            ? input.evidenceIds.map(String)
            : [],
          span: String(input.span) === "wide" ? "wide" : "half",
          accent: ["coral", "sage", "gold", "ink"].includes(
            String(input.accent),
          )
            ? (String(input.accent) as CanvasBlock["accent"])
            : "coral",
        }),
      }),
      {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["feature", "steps", "note", "quote"] },
          title: { type: "string" },
          body: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
          span: { type: "string", enum: ["half", "wide"] },
          accent: { type: "string", enum: ["coral", "sage", "gold", "ink"] },
        },
        required: ["title", "body"],
      },
    );
    tool(
      "update_canvas_block",
      "Reacts to human composition by rewriting, restyling, resizing, or re-citing one canvas block while preserving every other block.",
      (input) => {
        const id = String(input.blockId ?? "");
        const patch: Partial<CanvasBlock> = {};
        if (input.title !== undefined) patch.title = String(input.title);
        if (input.body !== undefined) patch.body = String(input.body);
        if (Array.isArray(input.evidenceIds))
          patch.evidenceIds = input.evidenceIds.map(String);
        if (["feature", "steps", "note", "quote"].includes(String(input.kind)))
          patch.kind = String(input.kind) as CanvasBlockKind;
        if (["half", "wide"].includes(String(input.span)))
          patch.span = String(input.span) as CanvasBlockSpan;
        if (["coral", "sage", "gold", "ink"].includes(String(input.accent)))
          patch.accent = String(input.accent) as CanvasBlock["accent"];
        updateCanvasBlock(id, patch);
        addAgentEvent("Canvas block revised", String(input.reason ?? id));
        setActivity("Agent reacted to the human canvas edit");
        return { ok: true, blockId: id };
      },
      {
        type: "object",
        properties: {
          blockId: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          kind: { type: "string", enum: ["feature", "steps", "note", "quote"] },
          span: { type: "string", enum: ["half", "wide"] },
          accent: { type: "string", enum: ["coral", "sage", "gold", "ink"] },
          evidenceIds: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
        },
        required: ["blockId"],
      },
    );
    tool(
      "generate_canvas_image",
      "Generates or replaces one AI visual layer for a selected canvas card after the human asks. Inline illustrations and full-card backdrops are stored independently; generating either must preserve the card text, citations, source thumbnails, layout, and the other visual layer. Generated artwork is visibly labeled and never treated as source evidence.",
      async (input) =>
        generateCanvasImage(
          String(input.blockId ?? ""),
          String(input.prompt ?? ""),
          input.alt === undefined ? undefined : String(input.alt),
          input.placement === "background" ? "background" : "inline",
        ),
      {
        type: "object",
        properties: {
          blockId: { type: "string" },
          prompt: {
            type: "string",
            description:
              "Art direction based on the human's comment, card meaning, and canvas mood. Do not ask for text inside the image.",
          },
          alt: {
            type: "string",
            description: "Concise accessible description of the intended image.",
          },
          placement: {
            type: "string",
            enum: ["inline", "background"],
            description:
              "Use background only when the human explicitly requests a full-card backdrop; otherwise use inline.",
          },
        },
        required: ["blockId", "prompt"],
      },
    );
    tool(
      "remove_canvas_block",
      "Removes one canvas block when the human asks for a simpler composition.",
      (input) => {
        const id = String(input.blockId ?? "");
        removeCanvasBlock(id);
        setActivity("Agent simplified the canvas");
        return { ok: true, removed: id };
      },
      {
        type: "object",
        properties: { blockId: { type: "string" } },
        required: ["blockId"],
      },
    );
    tool(
      "reorder_canvas_blocks",
      "Reorders one canvas block in response to human editorial direction without rewriting its content.",
      (input) => {
        reorderCanvasBlock(
          String(input.blockId ?? ""),
          Number(input.targetIndex ?? 0),
        );
        setActivity("Agent adjusted the canvas composition");
        return { ok: true };
      },
      {
        type: "object",
        properties: {
          blockId: { type: "string" },
          targetIndex: { type: "number" },
        },
        required: ["blockId", "targetIndex"],
      },
    );
    tool(
      "set_canvas_theme",
      "Changes the visual canvas theme while preserving human block order, copy, and citations.",
      (input) => {
        const theme = String(input.theme ?? "notebook") as CanvasTheme;
        if (!["notebook", "editorial", "field-notes"].includes(theme))
          return { ok: false, error: "Unknown canvas theme." };
        setCanvasTheme(theme);
        setActivity("Agent restyled the canvas");
        return { ok: true, theme };
      },
      {
        type: "object",
        properties: {
          theme: {
            type: "string",
            enum: ["notebook", "editorial", "field-notes"],
          },
        },
        required: ["theme"],
      },
    );
    tool(
      "download_canvas_png",
      "Downloads the current human-and-agent visual canvas as a shareable high-resolution PNG.",
      () => downloadCanvas(),
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
    const bridgeId = "livesignal-page-agent-bridge";
    const existingBridge = document.getElementById(bridgeId);
    const bridge = existingBridge ?? document.createElement("output");
    const toolNames = [...toolHandlers.keys()].sort();
    bridge.id = bridgeId;
    bridge.hidden = false;
    bridge.removeAttribute("aria-hidden");
    bridge.className = "agent-bridge-control";
    bridge.setAttribute("aria-label", "LiveSignal page agent response");
    bridge.dataset.status = "ready";
    bridge.dataset.toolCount = String(toolHandlers.size);
    bridge.dataset.tools = JSON.stringify(toolNames);
    bridge.textContent = JSON.stringify({
      status: "ready",
      transport: "webmcp-page-bridge",
      toolCount: toolHandlers.size,
      example: {
        requestId: "unique-request-id",
        name: "get_workspace_state",
        input: {},
      },
    });
    if (!existingBridge) document.body.appendChild(bridge);

    const instructionsId = "livesignal-page-agent-instructions";
    const existingInstructions = document.getElementById(instructionsId);
    const instructions = existingInstructions ?? document.createElement("span");
    instructions.id = instructionsId;
    instructions.className = "agent-bridge-control";
    instructions.textContent =
      "Browser agent fallback for LiveSignal WebMCP: fill the request control with JSON containing requestId, name, and input, then read the matching JSON response. Common tools include get_workspace_state, begin_research, write_report, create_canvas, add_canvas_block, and generate_canvas_image. The complete tool list is on the response element's data-tools attribute.";
    if (!existingInstructions) document.body.appendChild(instructions);

    const requestControlId = "livesignal-page-agent-request";
    const existingRequestControl = document.getElementById(
      requestControlId,
    ) as HTMLTextAreaElement | null;
    const requestControl =
      existingRequestControl ?? document.createElement("textarea");
    requestControl.id = requestControlId;
    requestControl.setAttribute("aria-label", "LiveSignal page agent request");
    requestControl.setAttribute("aria-describedby", instructionsId);
    requestControl.removeAttribute("aria-hidden");
    requestControl.tabIndex = -1;
    requestControl.className = "agent-bridge-control";
    requestControl.placeholder =
      '{"requestId":"unique-id","name":"get_workspace_state","input":{}}';
    if (!existingRequestControl) document.body.appendChild(requestControl);

    const onBridgeCall = async (rawRequest?: string) => {
      let request: Record<string, unknown> = {};
      try {
        request = JSON.parse(rawRequest ?? bridge.dataset.request ?? "{}");
        const requestId = String(request.requestId ?? "");
        const name = String(request.name ?? "");
        const execute = toolHandlers.get(name);
        if (!requestId || !execute)
          throw new Error(`Unknown LiveSignal page tool: ${name || "missing"}`);
        const input =
          request.input && typeof request.input === "object"
            ? (request.input as Record<string, unknown>)
            : {};
        const result = await execute(input);
        bridge.textContent = JSON.stringify({ requestId, ok: true, result });
      } catch (error) {
        bridge.textContent = JSON.stringify({
          requestId: String(request.requestId ?? ""),
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      window.dispatchEvent(new Event("livesignal:page-tool-result"));
    };
    const onBridgeEvent = () => void onBridgeCall();
    const onRequestInput = () => void onBridgeCall(requestControl.value);
    window.addEventListener("livesignal:page-tool-call", onBridgeEvent);
    requestControl.addEventListener("input", onRequestInput);
    document.documentElement.dataset.livesignalPageAgent = "ready";

    if (shouldRegisterWebMcp) {
      Promise.all(jobs)
        .then(() => setMcp("registered"))
        .catch(() => setMcp("error"));
    } else if (!page.modelContext) {
      window.setTimeout(() => setMcp("unavailable"), 0);
    }

    return () => {
      window.removeEventListener("livesignal:page-tool-call", onBridgeEvent);
      requestControl.removeEventListener("input", onRequestInput);
      if (!existingBridge) bridge.remove();
      if (!existingInstructions) instructions.remove();
      if (!existingRequestControl) requestControl.remove();
      delete document.documentElement.dataset.livesignalPageAgent;
    };
    // Tool handlers use the live ref so calls always read current visible state.
    // Registration must run once: rerunning would duplicate the page's tools.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <nav className="topbar">
        <Brand />
        {workspaceActive ? (
          <div className="nav-links">
            <a href="#brief">Direction</a>
            <a href="#sources">Research</a>
            <a href="#report">Canvas</a>
          </div>
        ) : (
          <span className="consumer-nav-line">VIDEO KNOWLEDGE, MADE USEFUL</span>
        )}
        <div
          className={`mcp-status ${mcp}`}
          title={
            connectedAgent
              ? connectedAgent.identified
                ? `${connectedAgent.client} identified itself through the LiveSignal WebMCP handshake.`
                : "A WebMCP client invoked a page tool, but the browser did not provide its identity or a durable connection state."
              : "WebMCP tools are available, but no agent has identified itself."
          }
        >
          <i />
          {mcp === "registered"
            ? connectedAgent
              ? agentActivelyListening
                ? `${connectedAgentLabel} listening`
                : connectedAgent.identified
                  ? `Agent · ${connectedAgentLabel}`
                  : "Agent seen · WebMCP client"
              : workspaceActive
                ? `${TOOL_COUNT} WebMCP tools ready`
                : "WebMCP ready"
            : mcp === "unavailable"
              ? "Open with ChatGPT"
              : mcp === "error"
                ? "WebMCP unavailable"
                : "Connecting agent"}
        </div>
      </nav>

      {!workspaceActive && (
        <header className="consumer-hero" id="top">
          <div className="consumer-hero-copy">
            <span className="consumer-eyebrow">LIVE SIGNAL · HUMAN + AGENT</span>
            <h1>
              What do you
              <br />
              want to <em>do?</em>
            </h1>
            <p>
              Tell LiveSignal your goal. Your agent researches the relevant
              video internet and builds a beautiful plan you can edit and share.
            </p>
          </div>

          <div className="consumer-entry-card">
            <div className="consumer-entry-topline">
              <span>ONE REQUEST</span>
              <i className={agentListeningForRequest ? "listening" : ""}>
                {agentListeningForRequest
                  ? "● YOUR AGENT IS LISTENING"
                  : "NO SETUP FORM"}
              </i>
            </div>
            <label>
              <span>What are you trying to accomplish?</span>
              <textarea
                value={entryPrompt}
                onChange={(event) => setEntryPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    submitEntryRequest();
                  }
                }}
                placeholder="Plan my first food trip to China. I love spicy noodles and avoid shellfish…"
                aria-label="What do you want to do?"
              />
            </label>
            <div className="consumer-entry-action">
              <p>
                Your agent will find useful videos, keep timestamped proof, and
                return with an editable visual plan.
              </p>
              <button
                type="button"
                disabled={!entryPrompt.trim()}
                onClick={submitEntryRequest}
              >
                <span>Build my plan</span>
                <b>→</b>
              </button>
            </div>
            <div className="consumer-suggestions" aria-label="Example goals">
              <span>TRY AN IDEA</span>
              {ENTRY_SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion.label}
                  onClick={() => setEntryPrompt(suggestion.prompt)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          </div>

          <div className="consumer-route">
            <div>
              <b>01</b>
              <span>Say what you want</span>
            </div>
            <i />
            <div>
              <b>02</b>
              <span>Agent researches video</span>
            </div>
            <i />
            <div>
              <b>03</b>
              <span>You shape the result</span>
            </div>
            <i />
            <div>
              <b>04</b>
              <span>Share something useful</span>
            </div>
          </div>

          <button className="consumer-example" type="button" onClick={loadExample}>
            <span>NOT READY TO START?</span>
            See a finished food-planning example <b>↗</b>
          </button>
        </header>
      )}

      {workspaceActive && (
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
                pendingHumanRevisions.length || collaborationActive
                  ? "pending"
                  : "caught-up"
              }`}
            >
              <b>HUMAN → AGENT</b>
              <span>
                {unsentHumanRevisions.length
                  ? `${unsentHumanRevisions.length} unsaved change${unsentHumanRevisions.length === 1 ? "" : "s"}`
                  : sentHumanRevisions.length
                    ? `${sentHumanRevisions.length} saved change${sentHumanRevisions.length === 1 ? "" : "s"} waiting for agent`
                    : collaborationPresence === "listening"
                      ? "Agent listening for your next save"
                      : collaborationPresence === "responding"
                        ? "Agent responding to the canvas"
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
                  and compose the visual guide through this page’s WebMCP tools.
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
            <h3>Your goal is enough.</h3>
            <div className="brief-goal-card">
              <span>YOUR REQUEST</span>
              <p>{goal}</p>
            </div>
            <details className="brief-refine">
              <summary>
                <span>Refine the request</span>
                <small>Optional</small>
              </summary>
              <div className="brief-collaboration-note">
                <span>LIVE SHARED BRIEF</span>
                <p>
                  Add detail only when it matters. Save your edits when you are
                  ready for the active agent to react.
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
            </details>
            <div className="brief-prompt">
              <span>YOUR ROLE</span>
              <p>
                Let the agent do the watching. You inspect, shape, and approve
                what becomes part of the final plan.
              </p>
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
              {timedEvidenceCount(evidence)} timestamped evidence segment
              {timedEvidenceCount(evidence) === 1 ? "" : "s"}
              {evidence.some((item) => item.origin === "agent") && (
                <>
                  {" · "}
                  {evidence.filter((item) => item.origin === "agent").length}{" "}
                  agent claim
                  {evidence.filter((item) => item.origin === "agent").length ===
                  1
                    ? ""
                    : "s"}
                </>
              )}
            </p>

            {sources.length === 0 ? (
              <div className="empty-state source-empty">
                <span>AGENT RESEARCHING</span>
                <h3>Your request is already in motion.</h3>
                <p>
                  Your active agent can now discover useful videos, verify exact
                  moments, and return its evidence directly to this shared desk.
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
                      <small>{source.transcriptCount} captured segments</small>
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
                  {visibleEvidence.map((item) => {
                    const presentation = evidencePresentation(item);
                    return (
                      <button
                        type="button"
                        className={`${
                          focusEvidence?.id === item.id ? "active" : ""
                        } ${presentation.className}`.trim()}
                        title={presentation.title}
                        key={item.id}
                        onClick={() => setFocusEvidenceId(item.id)}
                      >
                        <b>{item.timestamp || "NO TIME"}</b>
                        <span>
                          {item.text}
                          <small>
                            {presentation.label || "VERIFIED TRANSCRIPT"}
                          </small>
                        </span>
                      </button>
                    );
                  })}
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
                    <b>{focusEvidence.timestamp || "SOURCE"}</b>{" "}
                    {focusEvidence.timestamp
                      ? "Open source moment ↗"
                      : "Open source video ↗"}
                  </button>
                  <span>
                    {evidencePresentation(focusEvidence).label ||
                      "VERIFIED TRANSCRIPT"}
                    {focusEvidence.confidence
                      ? ` · ${focusEvidence.confidence}% fixture confidence`
                      : ""}
                  </span>
                </div>
              </div>
            )}
          </section>
        </div>

        {(reportSections.length > 0 || canvasBlocks.length > 0) && (
        <section className="guide-panel" id="report">
          <div className="guide-toolbar">
            <PanelLabel
              number="03"
              title="Creation canvas"
              sub="Human composes · agent reacts"
              light
            />
            <div className="guide-actions">
              <button
                className="download canvas-download"
                type="button"
                disabled={canvasBlocks.length === 0 || canvasExporting}
                onClick={() => downloadCanvas()}
              >
                {canvasExporting ? "Rendering…" : "Download PNG ↓"}
              </button>
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
                  setActivity("Canvas published · human approved");
                }}
              >
                {published ? "✓ Published" : "Publish canvas"}
              </button>
            </div>
          </div>

          <div className="studio-mode-switch" aria-label="Creation studio view">
            <button
              type="button"
              className={canvasView === "canvas" ? "active" : ""}
              onClick={() => setCanvasView("canvas")}
            >
              Visual canvas
            </button>
            <button
              type="button"
              className={canvasView === "draft" ? "active" : ""}
              onClick={() => setCanvasView("draft")}
            >
              Evidence draft
            </button>
            <span>
              {canvasBlocks.length} movable block
              {canvasBlocks.length === 1 ? "" : "s"}
            </span>
          </div>

          {canvasView === "canvas" ? (
            <section className="canvas-workbench" id="canvas">
              <div className="canvas-stage">
                {canvasBlocks.length === 0 ? (
                  <div className="empty-state canvas-empty">
                    <span>THE SHARED ARTIFACT STARTS HERE</span>
                    <h3>Turn the research into something worth sharing.</h3>
                    <p>
                      The agent creates evidence-backed blocks. You arrange,
                      rewrite, resize, and personalize them while ChatGPT reacts
                      through the page’s canvas tools.
                    </p>
                    <button
                      type="button"
                      disabled={reportSections.length === 0}
                      onClick={() => seedCanvas(reportSections)}
                    >
                      Compose from research
                    </button>
                  </div>
                ) : (
                  <div
                    className={`share-canvas theme-${canvasTheme}`}
                    ref={canvasRef}
                  >
                    <div className="canvas-holes" aria-hidden="true">
                      {Array.from({ length: 12 }).map((_, index) => (
                        <i key={index} />
                      ))}
                    </div>
                    <header className="canvas-cover">
                      <div className="canvas-cover-copy">
                        <span>LIVE SIGNAL · FIELD GUIDE</span>
                        <h2>{reportTitle}</h2>
                        <p>{reportOverview}</p>
                        <div>
                          <b>{sources.length}</b> VIDEO SOURCES
                          <b>{timedEvidenceCount(evidence)}</b> TIMED MOMENTS
                        </div>
                      </div>
                      {sources[0] && (
                        <div
                          className="canvas-hero-image"
                          style={{
                            backgroundImage: `url(https://i.ytimg.com/vi/${sources[0].videoId}/hqdefault.jpg)`,
                          }}
                        >
                          <span>FROM THE SOURCE DESK</span>
                          <b>{sources[0].creator}</b>
                        </div>
                      )}
                    </header>
                    <div className="canvas-block-grid">
                      {canvasBlocks.map((block, index) => {
                        const blockEvidence = block.evidenceIds
                          .map((id) => evidence.find((item) => item.id === id))
                          .filter(Boolean) as EvidenceItem[];
                        return (
                          <article
                            className={`canvas-block kind-${block.kind} span-${block.span} accent-${block.accent} ${
                              selectedCanvasBlock?.id === block.id
                                ? "selected"
                                : ""
                            } ${block.backgroundImage ? "has-background" : ""}`}
                            style={
                              block.backgroundImage
                                ? {
                                    backgroundImage: `linear-gradient(135deg, rgba(255, 252, 244, 0.9), rgba(255, 252, 244, 0.78)), url("${block.backgroundImage.url}")`,
                                  }
                                : undefined
                            }
                            draggable
                            key={block.id}
                            onDragStart={() => setDraggedCanvasId(block.id)}
                            onDragEnd={() => setDraggedCanvasId("")}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => dropCanvasBlock(block.id)}
                          >
                            <div className="canvas-block-topline">
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <b>{block.kind}</b>
                              <div className="canvas-block-actions">
                                {agentComments.some(
                                  (comment) =>
                                    comment.blockId === block.id &&
                                    comment.status !== "answered",
                                ) && <i>● OPEN</i>}
                                <button
                                  type="button"
                                  aria-label={`Ask agent about ${block.title}`}
                                  onClick={() => {
                                    setSelectedCanvasId(block.id);
                                    setAgentCommentScope("block");
                                    window.requestAnimationFrame(() =>
                                      agentCommentInputRef.current?.focus(),
                                    );
                                  }}
                                >
                                  Ask agent
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Generate a background for ${block.title}`}
                                  disabled={imageGeneratingBlockId === block.id}
                                  onClick={() =>
                                    requestCanvasVisual(
                                      block,
                                      "background",
                                      Boolean(block.backgroundImage),
                                      true,
                                    )
                                  }
                                >
                                  Generate backdrop
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Edit ${block.title}`}
                                  onClick={() => setSelectedCanvasId(block.id)}
                                >
                                  Edit · ⋮⋮
                                </button>
                              </div>
                            </div>
                            {imageGeneratingBlockId === block.id && (
                              <div className="canvas-card-image generating" aria-live="polite">
                                <i />
                                <span>Agent is making the illustration</span>
                              </div>
                            )}
                            {block.backgroundImage &&
                              imageGeneratingBlockId !== block.id && (
                                <span className="canvas-card-background-label">
                                  AI-GENERATED BACKDROP
                                </span>
                              )}
                            {block.image &&
                              imageGeneratingBlockId !== block.id && (
                              <figure className="canvas-card-image">
                                {/* Blob URLs are generated in-session and cannot use Next image optimization. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={block.image.url} alt={block.image.alt} />
                                <figcaption>
                                  <span>AI-GENERATED ILLUSTRATION</span>
                                  <i aria-hidden="true">✦</i>
                                </figcaption>
                              </figure>
                            )}
                            <h3>{block.title}</h3>
                            <p>{block.body}</p>
                            <div className="canvas-block-proof">
                              {blockEvidence.slice(0, 3).map((item) => {
                                const source = sources.find(
                                  (entry) => entry.id === item.sourceId,
                                );
                                const presentation = evidencePresentation(item);
                                return (
                                  <span
                                    key={item.id}
                                    className={presentation.className}
                                    title={presentation.title}
                                  >
                                    {item.timestamp || "NO TIMESTAMP"} ·{" "}
                                    {source?.creator ?? "Source"}
                                    {presentation.label
                                      ? ` · ${presentation.label}`
                                      : ""}
                                  </span>
                                );
                              })}
                              {blockEvidence.length === 0 && (
                                <span className="personal-note">
                                  HUMAN NOTE · NO SOURCE CLAIM
                                </span>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    <footer className="canvas-signoff">
                      <span>MADE TOGETHER WITH LIVESIGNAL</span>
                      <b>Research you can see, shape, and share.</b>
                      <i>✦</i>
                    </footer>
                  </div>
                )}
              </div>

              <aside className="canvas-inspector">
                <div
                  className={`canvas-collab-card ${
                    pendingHumanRevisions.length || openAgentComments.length
                      ? "pending"
                      : agentActivelyListening
                        ? "listening"
                        : ""
                  }`}
                >
                  <div className="collab-session-line">
                    <span>
                      HUMAN ↔ {connectedAgentLabel || "AGENT"} LOOP
                    </span>
                    <i className={`collab-presence ${collaborationPresence}`}>
                      {collaborationPresence === "listening"
                        ? "● AGENT LISTENING"
                        : collaborationPresence === "responding"
                          ? "● AGENT RESPONDING"
                          : collaborationPresence === "finished"
                            ? "SESSION FINISHED"
                            : collaborationActive
                              ? "SESSION ACTIVE"
                              : "SAVED WORKSPACE"}
                    </i>
                  </div>
                  <b>
                    {openAgentComments.length
                      ? `${openAgentComments.length} comment${openAgentComments.length === 1 ? "" : "s"} in the agent loop`
                      : unsentHumanRevisions.length
                        ? `${unsentHumanRevisions.length} unsaved change${unsentHumanRevisions.length === 1 ? "" : "s"}`
                        : sentHumanRevisions.length
                          ? `${sentHumanRevisions.length} change${sentHumanRevisions.length === 1 ? "" : "s"} sent to the agent`
                          : collaborationPresence === "listening"
                            ? "Your agent is here"
                            : collaborationPresence === "responding"
                              ? "Your agent is working"
                              : collaborationPresence === "finished"
                                ? "This collaboration is finished"
                                : "Canvas and agent are caught up"}
                  </b>
                  <p>
                    Move, rewrite, or restyle the artifact freely. Save once
                    when the composition is ready; an active agent receives the
                    complete change batch through WebMCP.
                  </p>
                  <div className="collab-save-actions">
                    <button
                      type="button"
                      className="save-canvas-changes"
                      disabled={unsentHumanRevisions.length === 0}
                      onClick={sendCanvasChanges}
                    >
                      <span>
                        {agentActivelyListening
                          ? "Save & send to agent"
                          : "Save for agent"}
                      </span>
                      <b>{unsentHumanRevisions.length || "✓"}</b>
                    </button>
                    {collaborationActive && (
                      <button
                        type="button"
                        className="finish-collaboration"
                        onClick={() =>
                          finishCanvasCollaboration("human-finished")
                        }
                      >
                        Finish
                      </button>
                    )}
                  </div>
                  <small className="collab-delivery-note">
                    {unsentHumanRevisions.length
                      ? "Changes remain local until you save."
                      : sentHumanRevisions.length
                        ? agentActivelyListening
                          ? "Delivered to the active agent."
                          : "Queued safely until the agent reconnects."
                        : collaborationPresence === "finished"
                          ? "Start another project whenever you are ready."
                          : "Nothing new to send."}
                  </small>
                </div>

                <div className="agent-comment-desk">
                  <div className="agent-comment-heading">
                    <div>
                      <span>COMMENT FOR AGENT</span>
                      <b>
                        {agentCommentScope === "block" && selectedCanvasBlock
                          ? selectedCanvasBlock.title
                          : "Whole canvas"}
                      </b>
                    </div>
                    <i className={`agent-presence ${mcp} ${agentActivelyListening ? "listening" : ""}`}>
                      {agentActivelyListening
                        ? `● ${connectedAgentLabel || "AGENT"} LISTENING`
                        : collaborationPresence === "responding"
                          ? `● ${connectedAgentLabel || "AGENT"} RESPONDING`
                          : connectedAgent
                            ? connectedAgent.identified
                              ? `AGENT · ${connectedAgentLabel}`
                              : "AGENT SEEN · WEBMCP CLIENT"
                            : mcp === "registered"
                              ? "WEBMCP READY"
                              : "AGENT INBOX"}
                    </i>
                  </div>
                  <div className="agent-comment-scope" aria-label="Comment scope">
                    <button
                      type="button"
                      className={agentCommentScope === "block" ? "active" : ""}
                      disabled={!selectedCanvasBlock}
                      onClick={() => setAgentCommentScope("block")}
                    >
                      This card
                    </button>
                    <button
                      type="button"
                      className={agentCommentScope === "canvas" ? "active" : ""}
                      onClick={() => setAgentCommentScope("canvas")}
                    >
                      Whole canvas
                    </button>
                  </div>
                  <div className="agent-comment-kinds">
                    {AGENT_COMMENT_KINDS.map((kind) => (
                      <button
                        type="button"
                        className={agentCommentKind === kind.id ? "active" : ""}
                        key={kind.id}
                        onClick={() => setAgentCommentKind(kind.id)}
                      >
                        {kind.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    ref={agentCommentInputRef}
                    value={agentCommentQuery}
                    aria-label="Comment for agent"
                    placeholder={
                      AGENT_COMMENT_KINDS.find(
                        (kind) => kind.id === agentCommentKind,
                      )?.prompt
                    }
                    onChange={(event) => setAgentCommentQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                        event.preventDefault();
                        submitAgentComment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="send-agent-comment"
                    disabled={!agentCommentQuery.trim()}
                    onClick={submitAgentComment}
                  >
                    <span>Send to agent</span>
                    <small>⌘↵</small>
                  </button>
                  <p className="agent-comment-boundary">
                    The active WebMCP agent can pick this up without you
                    repeating context in chat.
                  </p>

                  {visibleAgentComments.length > 0 && (
                    <div className="agent-comment-thread" aria-live="polite">
                      {visibleAgentComments.map((comment) => (
                        <article className={`agent-comment ${comment.status}`} key={comment.id}>
                          <div>
                            <span>
                              {comment.blockTitle ?? "Whole canvas"} · {comment.kind.replace("-", " ")}
                            </span>
                            <i>{comment.status}</i>
                          </div>
                          <p>{comment.query}</p>
                          {comment.status === "researching" && (
                            <small>
                              <b>Agent is researching</b>
                              {comment.plan ? ` · ${comment.plan}` : ""}
                            </small>
                          )}
                          {comment.status === "answered" && comment.response && (
                            <small>
                              <b>Agent answer</b> · {comment.response}
                              {(comment.addedEvidenceIds.length > 0 ||
                                comment.updatedBlockIds.length > 0) && (
                                <em>
                                  +{comment.addedEvidenceIds.length} evidence · {comment.updatedBlockIds.length} card update{comment.updatedBlockIds.length === 1 ? "" : "s"}
                                </em>
                              )}
                            </small>
                          )}
                          {comment.status === "pending" && (
                            <small><b>Queued for the active agent</b></small>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="canvas-control-group theme-picker">
                  <span>CANVAS MOOD</span>
                  <div>
                    {(["notebook", "editorial", "field-notes"] as CanvasTheme[]).map(
                      (theme) => (
                        <button
                          className={canvasTheme === theme ? "active" : ""}
                          type="button"
                          key={theme}
                          onClick={() => {
                            setCanvasTheme(theme);
                            recordHumanRevision(
                              "canvas theme",
                              `Changed visual mood to ${theme}`,
                            );
                          }}
                        >
                          {theme.replace("-", " ")}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {selectedCanvasBlock ? (
                  <div className="canvas-block-editor">
                    <span>SELECTED BLOCK</span>
                    <label>
                      <small>Title</small>
                      <input
                        value={selectedCanvasBlock.title}
                        aria-label="Canvas block title"
                        onChange={(event) => {
                          updateCanvasBlock(selectedCanvasBlock.id, {
                            title: event.target.value,
                          });
                          recordHumanRevision(
                            "canvas block title",
                            `${selectedCanvasBlock.id}: ${event.target.value}`,
                          );
                        }}
                      />
                    </label>
                    <label>
                      <small>Copy</small>
                      <textarea
                        value={selectedCanvasBlock.body}
                        aria-label="Canvas block copy"
                        onChange={(event) => {
                          updateCanvasBlock(selectedCanvasBlock.id, {
                            body: event.target.value,
                          });
                          recordHumanRevision(
                            "canvas block copy",
                            `${selectedCanvasBlock.id}: ${event.target.value}`,
                          );
                        }}
                      />
                    </label>
                    <div
                      className={`canvas-visual-control ${
                        selectedCanvasBlock.image ||
                        selectedCanvasBlock.backgroundImage
                          ? "has-image"
                          : ""
                      }`}
                    >
                      <div>
                        <span>CARD VISUAL</span>
                        <b>
                          {imageGeneratingBlockId === selectedCanvasBlock.id
                            ? "Agent is illustrating…"
                            : selectedCanvasBlock.image &&
                                selectedCanvasBlock.backgroundImage
                              ? "Illustration and backdrop preserved"
                              : selectedCanvasBlock.backgroundImage
                                ? "AI backdrop applied to the full card"
                                : selectedCanvasBlock.image
                                  ? "AI illustration attached"
                              : "Turn this idea into an image"}
                        </b>
                      </div>
                      {selectedCanvasBlock.image ||
                      selectedCanvasBlock.backgroundImage ? (
                        <>
                          {selectedCanvasBlock.image && (
                            <p>
                              Illustration · {selectedCanvasBlock.image.prompt}
                            </p>
                          )}
                          {selectedCanvasBlock.backgroundImage && (
                            <p>
                              Backdrop · {selectedCanvasBlock.backgroundImage.prompt}
                            </p>
                          )}
                          <div className="canvas-visual-actions">
                            {selectedCanvasBlock.image ? (
                              <button
                                type="button"
                                disabled={
                                  imageGeneratingBlockId ===
                                  selectedCanvasBlock.id
                                }
                                onClick={() =>
                                  removeCanvasImage(
                                    selectedCanvasBlock.id,
                                    true,
                                    "inline",
                                  )
                                }
                              >
                                Remove illustration
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  imageGeneratingBlockId ===
                                  selectedCanvasBlock.id
                                }
                                onClick={() =>
                                  requestCanvasVisual(selectedCanvasBlock)
                                }
                              >
                                Ask for illustration
                              </button>
                            )}
                            {selectedCanvasBlock.backgroundImage ? (
                              <button
                                type="button"
                                disabled={
                                  imageGeneratingBlockId ===
                                  selectedCanvasBlock.id
                                }
                                onClick={() =>
                                  removeCanvasImage(
                                    selectedCanvasBlock.id,
                                    true,
                                    "background",
                                  )
                                }
                              >
                                Remove backdrop
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  imageGeneratingBlockId ===
                                  selectedCanvasBlock.id
                                }
                                onClick={() =>
                                  requestCanvasVisual(
                                    selectedCanvasBlock,
                                    "background",
                                    false,
                                    true,
                                  )
                                }
                              >
                                Generate backdrop
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="request-card-visual"
                          disabled={
                            imageGeneratingBlockId === selectedCanvasBlock.id
                          }
                          onClick={() => requestCanvasVisual(selectedCanvasBlock)}
                        >
                          <span>Ask agent to create</span>
                          <i aria-hidden="true">✦</i>
                        </button>
                      )}
                      <small>
                        Generated artwork is labeled and never used as source proof.
                      </small>
                    </div>
                    <div className="canvas-inline-controls">
                      <span>SIZE</span>
                      {(["half", "wide"] as CanvasBlockSpan[]).map((span) => (
                        <button
                          type="button"
                          className={selectedCanvasBlock.span === span ? "active" : ""}
                          key={span}
                          onClick={() => {
                            updateCanvasBlock(selectedCanvasBlock.id, { span });
                            recordHumanRevision(
                              "canvas block size",
                              `${selectedCanvasBlock.title}: ${span}`,
                            );
                          }}
                        >
                          {span}
                        </button>
                      ))}
                    </div>
                    <div className="canvas-inline-controls canvas-order-controls">
                      <span>ORDER</span>
                      <button
                        type="button"
                        disabled={selectedCanvasIndex <= 0}
                        onClick={() => {
                          const targetIndex = selectedCanvasIndex - 1;
                          reorderCanvasBlock(selectedCanvasBlock.id, targetIndex);
                          recordHumanRevision(
                            "canvas layout",
                            `Moved ${selectedCanvasBlock.title} to position ${targetIndex + 1}`,
                          );
                        }}
                      >
                        Move earlier
                      </button>
                      <button
                        type="button"
                        disabled={
                          selectedCanvasIndex < 0 ||
                          selectedCanvasIndex >= canvasBlocks.length - 1
                        }
                        onClick={() => {
                          const targetIndex = selectedCanvasIndex + 1;
                          reorderCanvasBlock(selectedCanvasBlock.id, targetIndex);
                          recordHumanRevision(
                            "canvas layout",
                            `Moved ${selectedCanvasBlock.title} to position ${targetIndex + 1}`,
                          );
                        }}
                      >
                        Move later
                      </button>
                    </div>
                    <div className="canvas-inline-controls accent-picker">
                      <span>INK</span>
                      {(["coral", "sage", "gold", "ink"] as CanvasBlock["accent"][]).map(
                        (accent) => (
                          <button
                            type="button"
                            aria-label={`${accent} accent`}
                            className={`${accent} ${
                              selectedCanvasBlock.accent === accent ? "active" : ""
                            }`}
                            key={accent}
                            onClick={() => {
                              updateCanvasBlock(selectedCanvasBlock.id, {
                                accent,
                              });
                              recordHumanRevision(
                                "canvas block accent",
                                `${selectedCanvasBlock.title}: ${accent}`,
                              );
                            }}
                          />
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      className="remove-canvas-block"
                      onClick={() => {
                        const title = selectedCanvasBlock.title;
                        removeCanvasBlock(selectedCanvasBlock.id);
                        recordHumanRevision(
                          "canvas blocks",
                          `Removed ${title}`,
                        );
                      }}
                    >
                      Remove block
                    </button>
                  </div>
                ) : (
                  <p className="canvas-no-selection">
                    Select a block on the canvas to edit it.
                  </p>
                )}

                <button
                  type="button"
                  className="add-personal-note"
                  onClick={() => {
                    const block = addCanvasBlock();
                    recordHumanRevision(
                      "canvas blocks",
                      `Added personal note ${block.id}`,
                    );
                  }}
                >
                  + Add my own note
                </button>
              </aside>
            </section>
          ) : (
            <>

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
                          const presentation = evidencePresentation(item);
                          return (
                            <button
                              type="button"
                              key={item.id}
                              className={presentation.className}
                              title={presentation.title}
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
                              <b>{item.timestamp || "NO TIME"}</b>
                              <span>
                                {source?.creator ?? "Source"}
                                {presentation.label
                                  ? ` · ${presentation.label}`
                                  : ""}
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
            </>
          )}
          <div className="guide-foot">
            <p>
              <span>Evidence policy</span>
              Canvas claims remain connected to inspectable source moments.
              Personal notes stay visibly distinct from researched evidence.
            </p>
            <div>
              <b>{pinnedIds.length}</b> pinned moments <b>{sources.length}</b>{" "}
              sources
            </div>
          </div>
        </section>
        )}
        </section>
      )}

      <section className="challenge-proof">
        <p className="section-no">WHY WEBMCP</p>
        <h2>The page stays in the conversation.</h2>
        <div>
          <p>
            <b>Human direction</b>
            <span>
              You define the question, inspect sources, compose the canvas, and
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
        <p>Hours of video → one visual guide you can trust and shape.</p>
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
