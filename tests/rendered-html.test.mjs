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

test("server-renders the verified LiveSignal adapter proof with accurate framing", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>LiveSignal — livestream intelligence for agents<\/title>/i);
  assert.match(html, /Live video, <em>without<\/em>/);
  assert.match(html, /VERIFIED REAL-STREAM TEST/);
  assert.match(html, /393<\/strong>transcript segments/);
  assert.match(html, /8<\/strong>tools registered/);
  assert.match(html, /youtube\.com\/watch\?v=BREmL2qYfYM/);
  assert.match(html, /STREAM DISCOVERY/);
  assert.match(html, /PAIRED AGENT MODE/);
  assert.match(html, /Approve once/);
  assert.match(html, /ILLUSTRATIVE WORKFLOW/);
  assert.match(html, /sample interface data, not stream extraction/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|codex-preview/i);
});
