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

test("exposes renewable WebMCP collaboration and browser-agent tools", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /"wait_for_research_request"/);
  assert.match(page, /"wait_for_agent_comment"/);
  assert.match(page, /"start_canvas_collaboration"/);
  assert.match(page, /"wait_for_collaboration_event"/);
  assert.match(page, /"finish_canvas_collaboration"/);
  assert.match(page, /"generate_canvas_image"/);
  assert.match(page, /Create visual/);
  assert.match(page, /AI-GENERATED ILLUSTRATION/);
  assert.match(page, /Ask agent to create/);
  assert.match(page, /Save &amp; send to agent|Save & send to agent/);
  assert.match(page, /Save for agent/);
  assert.match(page, /Move earlier/);
  assert.match(page, /Move later/);
  assert.match(page, /livesignal-page-agent-bridge/);
  assert.match(page, /livesignal:page-tool-call/);
  assert.match(page, /canvasState\.canvasBlocks\.length/);
  const toolNames = [
    ...page.matchAll(/\btool\(\s*\n?\s*"([^"]+)"/g),
  ].map((match) => match[1]);
  assert.equal(new Set(toolNames).size, 36);
});

test("keeps generated image bytes server-side and labels them as illustration", async () => {
  const route = await readFile(
    new URL("../app/api/images/generate/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /VERCEL_OIDC_TOKEN/);
  assert.match(route, /x-vercel-oidc-token/);
  assert.match(route, /AI_GATEWAY_API_KEY/);
  assert.match(route, /prodia\/flux-fast-schnell/);
  assert.match(route, /feature:canvas-illustration/);
  assert.match(route, /gpt-image-1-mini/);
  assert.match(route, /output_format:\s*"webp"/);
  assert.match(route, /This is an AI-generated illustration, not documentary evidence/);
  assert.match(route, /X-LiveSignal-Image-Model/);
  assert.doesNotMatch(route, /apiKey[^\n]*return/i);
});
