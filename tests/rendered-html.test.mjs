import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the LiveSignal companion with accurate product framing", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>LiveSignal — livestream intelligence for agents<\/title>/i);
  assert.match(html, /Live video, <em>without<\/em>/);
  assert.match(html, /STREAM DISCOVERY/);
  assert.match(html, /COMPANION DEMO/);
  assert.match(html, /Browser adapter prototype/);
  assert.match(html, /The extension uses real, visible YouTube transcript evidence/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});
