import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadAdapter({ searchCards = [] } = {}) {
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
    querySelectorAll(selector) {
      if (selector === "ytd-video-renderer") return searchCards;
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
        attributes: {},
        setAttribute(name, value) {
          this.attributes[name] = String(value);
        },
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

function searchCard({ title, url, channel, live = true, metadata = [] }) {
  const titleNode = { textContent: title, href: url };
  const channelNode = { textContent: channel };
  return {
    querySelector(selector) {
      if (selector === "#video-title") return titleNode;
      if (selector === "#channel-name") return channelNode;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes("badge")) return live ? [{ textContent: "LIVE" }] : [];
      if (selector === "#metadata-line span") return metadata.map((textContent) => ({ textContent }));
      return [];
    },
  };
}

test("paired browser bridge exposes the same nine handlers as WebMCP", async () => {
  const { document, registrations, window } = await loadAdapter();
  const webmcpTools = [...registrations.keys()].sort();
  const browserBridgeTools = Array.from(window.LiveSignalAgent.listTools()).sort();

  assert.equal(document.documentElement.dataset.livesignalAgent, "ready");
  assert.equal(document.documentElement.dataset.livesignalWebmcp, "registered");
  assert.equal(webmcpTools.length, 9);
  assert.deepEqual(browserBridgeTools, webmcpTools);

  const state = await window.LiveSignalAgent.call("get_current_stream_state");
  assert.equal(state.agentBridge.status, "ready");
  assert.equal(state.agentBridge.transport, "webmcp+page_bridge");
  assert.equal(state.url, "https://www.youtube.com/watch?v=stream-one");

  const snapshot = window.LiveSignalAgent.getSnapshot();
  assert.equal(snapshot.version, "1.0");
  assert.equal(snapshot.state.platform, "YouTube");
  assert.equal(document.getElementById("livesignal-agent-state").tagName, "OUTPUT");
});

test("live discovery prefers exact-topic commentary over generic or automated feeds", async () => {
  const cards = [
    searchCard({ title: "Ethereum 24/7 Signals and Heatmap", url: "https://youtube.test/automated", channel: "Signals" }),
    searchCard({ title: "Ethereum Weekend Market Analysis", url: "https://youtube.test/commentary", channel: "Analyst" }),
    searchCard({ title: "Where Is Crypto Heading?", url: "https://youtube.test/generic", channel: "General Crypto" }),
  ];
  const { window } = await loadAdapter({ searchCards: cards });
  const ranked = await window.LiveSignalAgent.call("rank_livestream_results", { query: "Ethereum" });
  const results = JSON.parse(JSON.stringify(ranked.results));

  assert.equal(results[0].url, "https://youtube.test/commentary");
  assert.equal(results[0].topicMatch, "exact_title");
  assert.equal(results[0].likelyFormat, "spoken_commentary_likely");
  assert.equal(results.at(-1).topicMatch, "none");
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

test("advertisement segments never enter the agent evidence snapshot", async () => {
  const { location, window } = await loadAdapter();
  const adSegment = { id: "ad-1", text: "Buy this product now", streamUrl: location.href };

  window.postMessage({ source: "livesignal", type: "live-transcription-state", payload: { status: "listening", adShowing: true, segments: [adSegment] } }, location.origin);
  window.postMessage({ source: "livesignal", type: "live-transcription-state", payload: { status: "listening", adShowing: false, segments: [adSegment] } }, location.origin);
  let transcript = await window.LiveSignalAgent.call("get_transcript", { limit: 20 });
  assert.equal(transcript.segmentCount, 0);

  window.postMessage({ source: "livesignal", type: "live-transcription-state", payload: { status: "listening", adShowing: false, segments: [{ id: "stream-1", text: "Ethereum support is holding", streamUrl: location.href }] } }, location.origin);
  transcript = await window.LiveSignalAgent.call("get_transcript", { limit: 20 });
  assert.equal(transcript.segmentCount, 1);
  assert.equal(transcript.segments[0].text, "Ethereum support is holding");
});
