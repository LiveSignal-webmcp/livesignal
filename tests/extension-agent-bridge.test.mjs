import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadAdapter() {
  const registrations = new Map();
  const elements = new Map();
  const listeners = new Map();
  const location = {
    href: "https://www.youtube.com/watch?v=stream-one",
    hostname: "www.youtube.com",
    origin: "https://www.youtube.com",
  };
  const video = {
    currentTime: 12,
    duration: Infinity,
    paused: false,
    seekable: { length: 1, start: () => 0, end: () => 1800 },
  };

  const documentElement = {
    dataset: {},
    append(element) {
      if (element.id) elements.set(element.id, element);
    },
  };
  const document = {
    title: "Test Live - YouTube",
    documentElement,
    modelContext: {
      registerTool(tool) {
        registrations.set(tool.name, tool);
        return Promise.resolve();
      },
    },
    querySelector(selector) {
      return selector === "video" ? video : null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tagName) {
      return {
        tagName: tagName.toUpperCase(),
        id: "",
        type: "",
        textContent: "",
        style: {},
        remove() {},
      };
    },
  };
  const window = {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    postMessage(data) {
      for (const listener of listeners.get("message") || []) {
        listener({ source: window, data });
      }
    },
    setInterval() {
      return 1;
    },
    clearInterval() {},
    setTimeout() {
      return 1;
    },
  };

  const source = await readFile(new URL("../extension/main-world.js", import.meta.url), "utf8");
  vm.runInNewContext(source, { document, location, URL, window, console });
  await new Promise((resolve) => setImmediate(resolve));
  return { document, location, registrations, window };
}

test("paired browser bridge exposes the same eight handlers as WebMCP", async () => {
  const { document, registrations, window } = await loadAdapter();
  const webmcpTools = [...registrations.keys()].sort();
  const browserBridgeTools = Array.from(window.LiveSignalAgent.listTools()).sort();

  assert.equal(document.documentElement.dataset.livesignalAgent, "ready");
  assert.equal(document.documentElement.dataset.livesignalWebmcp, "registered");
  assert.equal(webmcpTools.length, 8);
  assert.deepEqual(browserBridgeTools, webmcpTools);

  const state = await window.LiveSignalAgent.call("get_current_stream_state");
  assert.equal(state.agentBridge.status, "ready");
  assert.equal(state.agentBridge.transport, "webmcp+page_bridge");
  assert.equal(state.url, "https://www.youtube.com/watch?v=stream-one");

  const snapshot = window.LiveSignalAgent.getSnapshot();
  assert.equal(snapshot.version, "1.0");
  assert.equal(snapshot.state.platform, "YouTube");
});

test("realtime evidence is discarded when the paired tab switches streams", async () => {
  const { location, window } = await loadAdapter();

  window.postMessage({
    source: "livesignal",
    type: "live-transcription-state",
    payload: {
      status: "listening",
      provider: "ElevenLabs Scribe v2 Realtime",
      streamUrl: location.href,
      segments: [{ id: "segment-1", text: "Evidence from the first stream", streamUrl: location.href }],
    },
  }, location.origin);

  const firstTranscript = await window.LiveSignalAgent.call("get_transcript", { limit: 20 });
  assert.equal(firstTranscript.segmentCount, 1);

  location.href = "https://www.youtube.com/watch?v=stream-two";
  const secondTranscript = await window.LiveSignalAgent.call("get_transcript", { limit: 20 });
  assert.equal(secondTranscript.segmentCount, 0);
  assert.equal(secondTranscript.available, false);
});
