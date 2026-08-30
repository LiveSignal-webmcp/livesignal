import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders a focused one-request consumer entry", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>LiveSignal — research anything across YouTube<\/title>/i,
  );
  assert.match(html, /What do you want to/);
  assert.match(html, /Tell LiveSignal your goal/i);
  assert.match(html, /What are you trying to accomplish/i);
  assert.match(html, /Build my plan/i);
  assert.match(html, /Plan a food trip/);
  assert.match(html, /Learn a skill/);
  assert.match(html, /Cook something/);
  assert.match(html, /Compare options/);
  assert.match(html, /Say what you want/);
  assert.match(html, /Agent researches video/);
  assert.match(html, /You shape the result/);
  assert.match(html, /Share something useful/);
  assert.match(html, /See a finished food-planning example/i);
  assert.match(html, /Connecting agent/i);
  assert.doesNotMatch(html, /Manual fallback controls/);
  assert.doesNotMatch(html, /Must cover/);
  assert.doesNotMatch(html, /Comment for agent/);
  assert.doesNotMatch(html, /Download PNG/i);
  assert.doesNotMatch(html, /Dan dan noodles/);
  assert.doesNotMatch(
    html,
    /Your site is taking shape|Building your site|codex-preview/i,
  );
});

test("exposes the page-to-agent request and canvas comment wait tools", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /"wait_for_research_request"/);
  assert.match(page, /"wait_for_agent_comment"/);
  assert.match(page, /livesignal-page-agent-bridge/);
  assert.match(page, /livesignal:page-tool-call/);
  assert.match(page, /canvasState\.canvasBlocks\.length/);
});
