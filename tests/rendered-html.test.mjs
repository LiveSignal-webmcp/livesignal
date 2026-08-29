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

test("server-renders the collaborative China food research workspace", async () => {
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
  assert.match(html, /universal engine in one concrete project/i);
  assert.match(html, /Import any public YouTube video/);
  assert.match(html, /Import latest browser evidence/);
  assert.match(html, /Research brief/);
  assert.match(html, /Source desk/);
  assert.match(html, /Editable guide/);
  assert.match(html, /Dan dan noodles/);
  assert.match(html, /Relevant sources, not “all of YouTube”/);
  assert.match(html, /The page stays in the conversation/);
  assert.doesNotMatch(
    html,
    /Your site is taking shape|Building your site|codex-preview/i,
  );
});
