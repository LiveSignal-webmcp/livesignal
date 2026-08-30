import assert from "node:assert/strict";
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

test("server-renders a clean universal video research workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>LiveSignal — research anything across YouTube<\/title>/i,
  );
  assert.match(html, /Ask widely/);
  assert.match(html, /Watch selectively/);
  assert.match(html, /Start with any question—not a preloaded demo/i);
  assert.match(html, /Load China food example/);
  assert.match(html, /Import a real YouTube video/);
  assert.match(html, /Import latest browser evidence/);
  assert.match(html, /Research brief/);
  assert.match(html, /Source &amp; evidence desk/);
  assert.match(html, /Editable report/);
  assert.match(html, /No sources yet/i);
  assert.match(html, /Your report starts here/i);
  assert.doesNotMatch(html, /Dan dan noodles/);
  assert.match(html, /The page stays in the conversation/);
  assert.doesNotMatch(
    html,
    /Your site is taking shape|Building your site|codex-preview/i,
  );
});
