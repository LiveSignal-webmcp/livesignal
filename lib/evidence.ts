export type EvidenceTiming = {
  timestamp: string;
  seconds: number;
};

export type TranscriptMatchRow = {
  text: string;
  seconds: number;
};

export type SavedRevision = {
  id: string;
  acknowledged: boolean;
  sentAt?: string;
};

const TIMESTAMP_PATTERN = /^\d+:\d{2}(:\d{2})?$/;

export function formatTimestamp(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function parseTimestampToSeconds(value: string) {
  const parts = value.split(":").map(Number);
  if (
    !parts.length ||
    parts.some((part) => !Number.isFinite(part) || part < 0) ||
    parts.slice(1).some((part) => part > 59)
  )
    return Number.NaN;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

// A supplied timestamp is canonical. Otherwise a positive seconds value is
// converted into both fields. Missing timing stays explicitly untimed.
export function normalizeEvidenceTiming(
  item: Record<string, unknown>,
): EvidenceTiming {
  const rawTimestamp = String(item.timestamp ?? "").trim();
  if (TIMESTAMP_PATTERN.test(rawTimestamp)) {
    const parsed = parseTimestampToSeconds(rawTimestamp);
    if (Number.isFinite(parsed))
      return { timestamp: rawTimestamp, seconds: parsed };
  }

  const rawSeconds = Number(item.seconds);
  const seconds =
    Number.isFinite(rawSeconds) && rawSeconds > 0
      ? Math.floor(rawSeconds)
      : 0;
  return {
    timestamp: seconds > 0 ? formatTimestamp(seconds) : "",
    seconds,
  };
}

export function reserveUniqueEvidenceId(
  preferredId: unknown,
  fallbackId: string,
  sourceId: string,
  reservedIds: Set<string>,
) {
  const preferred = String(preferredId ?? "").trim();
  const base = preferred || fallbackId;
  let candidate = base;
  if (reservedIds.has(candidate)) candidate = `${sourceId}-${base}`;
  let suffix = 2;
  while (reservedIds.has(candidate)) {
    candidate = `${sourceId}-${base}-${suffix}`;
    suffix += 1;
  }
  reservedIds.add(candidate);
  return candidate;
}

function normalizedWords(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

export function claimMatchesTranscript(
  claim: string,
  row: string,
  exactPhraseOnly = false,
) {
  const claimWords = [...new Set(normalizedWords(claim))];
  const rowWords = [...new Set(normalizedWords(row))];
  if (!claimWords.length || !rowWords.length) return false;

  const claimPhrase = claimWords.join(" ");
  const rowPhrase = rowWords.join(" ");
  if (
    claimPhrase.length >= 8 &&
    (rowPhrase.includes(claimPhrase) || claimPhrase.includes(rowPhrase))
  )
    return true;
  if (exactPhraseOnly) return false;

  const rowSet = new Set(rowWords);
  const shared = claimWords.filter((word) => rowSet.has(word)).length;
  if (claimWords.length <= 3)
    return claimWords.length >= 2 && shared === claimWords.length;
  return shared >= 3 && shared / claimWords.length >= 0.65;
}

export function findTranscriptMatch<T extends TranscriptMatchRow>(
  claim: string,
  timing: EvidenceTiming,
  transcript: T[],
) {
  if (timing.timestamp) {
    return transcript.find(
      (row) =>
        Math.abs(row.seconds - timing.seconds) <= 90 &&
        claimMatchesTranscript(claim, row.text),
    );
  }

  // Untimed claims may search the complete transcript, but require an exact
  // normalized phrase rather than permissive word overlap.
  return transcript.find((row) =>
    claimMatchesTranscript(claim, row.text, true),
  );
}

export function acknowledgeSavedRevisions<T extends SavedRevision>(
  revisions: T[],
  requestedIds: string[],
  acknowledgeAll: boolean,
) {
  const sentPendingIds = new Set(
    revisions
      .filter((revision) => !revision.acknowledged && revision.sentAt)
      .map((revision) => revision.id),
  );
  const acknowledgedIds = acknowledgeAll
    ? [...sentPendingIds]
    : requestedIds.filter((id) => sentPendingIds.has(id));
  const acknowledgedSet = new Set(acknowledgedIds);
  const next = revisions.map((revision) =>
    acknowledgedSet.has(revision.id)
      ? { ...revision, acknowledged: true }
      : revision,
  ) as T[];

  return {
    revisions: next,
    acknowledgedIds,
    remainingUnacknowledged: next.filter(
      (revision) => !revision.acknowledged && revision.sentAt,
    ).length,
    unsavedCount: next.filter(
      (revision) => !revision.acknowledged && !revision.sentAt,
    ).length,
  };
}
