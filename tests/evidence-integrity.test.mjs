import assert from "node:assert/strict";
import test from "node:test";

import {
  acknowledgeSavedRevisions,
  findTranscriptMatch,
  normalizeEvidenceTiming,
  reserveUniqueEvidenceId,
} from "../lib/evidence.ts";

test("normalizes evidence timing without fabricating or contradicting moments", () => {
  assert.deepEqual(normalizeEvidenceTiming({ seconds: 72 }), {
    timestamp: "1:12",
    seconds: 72,
  });
  assert.deepEqual(normalizeEvidenceTiming({}), {
    timestamp: "",
    seconds: 0,
  });
  assert.deepEqual(
    normalizeEvidenceTiming({ timestamp: "5:00", seconds: 12 }),
    { timestamp: "5:00", seconds: 300 },
  );
  assert.deepEqual(normalizeEvidenceTiming({ timestamp: "0:00" }), {
    timestamp: "0:00",
    seconds: 0,
  });
  assert.deepEqual(normalizeEvidenceTiming({ timestamp: "1:99" }), {
    timestamp: "",
    seconds: 0,
  });
});

test("timed claims only verify against nearby transcript rows", () => {
  const transcript = [
    { id: "near", seconds: 70, text: "Chop the onions into small pieces." },
    { id: "far", seconds: 500, text: "Stir the miso into the warm broth." },
  ];

  assert.equal(
    findTranscriptMatch(
      "Chop the onions into small pieces",
      { timestamp: "1:12", seconds: 72 },
      transcript,
    )?.id,
    "near",
  );
  assert.equal(
    findTranscriptMatch(
      "Stir the miso into the warm broth",
      { timestamp: "1:12", seconds: 72 },
      transcript,
    ),
    undefined,
  );
});

test("untimed claims require an exact normalized transcript phrase", () => {
  const transcript = [
    {
      id: "exact",
      seconds: 500,
      text: "Stir the miso into the warm broth before serving.",
    },
  ];

  assert.equal(
    findTranscriptMatch(
      "Stir the miso into the warm broth",
      { timestamp: "", seconds: 0 },
      transcript,
    )?.id,
    "exact",
  );
  assert.equal(
    findTranscriptMatch(
      "Warm broth needs careful stirring",
      { timestamp: "", seconds: 0 },
      transcript,
    ),
    undefined,
  );
});

test("acknowledgement never consumes unsaved human revisions", () => {
  const revisions = [
    { id: "unsaved", acknowledged: false },
    {
      id: "saved-one",
      acknowledged: false,
      sentAt: "2026-08-31T12:00:00.000Z",
    },
    {
      id: "saved-two",
      acknowledged: false,
      sentAt: "2026-08-31T12:00:01.000Z",
    },
  ];

  const result = acknowledgeSavedRevisions(revisions, [], true);
  assert.deepEqual(result.acknowledgedIds, ["saved-one", "saved-two"]);
  assert.equal(result.unsavedCount, 1);
  assert.equal(result.remainingUnacknowledged, 0);
  assert.equal(
    result.revisions.find((revision) => revision.id === "unsaved")
      ?.acknowledged,
    false,
  );
});

test("agent evidence IDs stay globally unique across video sources", () => {
  const reserved = new Set(["moment", "video-two-moment"]);
  assert.equal(
    reserveUniqueEvidenceId("moment", "fallback", "video-two", reserved),
    "video-two-moment-2",
  );
  assert.equal(
    reserveUniqueEvidenceId("moment", "fallback", "video-three", reserved),
    "video-three-moment",
  );
  assert.equal(reserved.size, 4);
});
