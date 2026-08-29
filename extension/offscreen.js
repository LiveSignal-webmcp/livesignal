/* global chrome */

let activeSession = null;

const report = (tabId, type, payload = {}) => chrome.runtime.sendMessage({
  source: "livesignal-offscreen",
  tabId,
  type,
  ...payload
});

const bytesToBase64 = (bytes) => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const closeSession = async () => {
  const session = activeSession;
  activeSession = null;
  if (!session) return;
  try {
    if (session.socket?.readyState === WebSocket.OPEN) {
      session.socket.send(JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: "",
        commit: true
      }));
      session.socket.close(1000, "LiveSignal stopped");
    }
  } catch {
    // Connection teardown is best effort.
  }
  session.processor?.port?.close();
  session.processor?.disconnect();
  session.silentGain?.disconnect();
  session.source?.disconnect();
  session.stream?.getTracks().forEach((track) => track.stop());
  if (session.audioContext?.state !== "closed") await session.audioContext?.close();
};

const startSession = async ({ tabId, streamId, tokenEndpoint }) => {
  await closeSession();
  await report(tabId, "TRANSCRIPTION_STATUS", { status: "connecting" });

  try {
    const [tokenResponse, stream] = await Promise.all([
      fetch(tokenEndpoint, { method: "POST", cache: "no-store" }),
      navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "tab",
            chromeMediaSourceId: streamId
          }
        },
        video: false
      })
    ]);

    if (!tokenResponse.ok) {
      const detail = await tokenResponse.text();
      throw new Error(`Token request failed (${tokenResponse.status}): ${detail.slice(0, 160)}`);
    }
    const { token } = await tokenResponse.json();
    if (!token) throw new Error("ElevenLabs did not return a single-use token.");

    const socketUrl = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
    socketUrl.searchParams.set("model_id", "scribe_v2_realtime");
    socketUrl.searchParams.set("token", token);
    socketUrl.searchParams.set("audio_format", "pcm_16000");
    socketUrl.searchParams.set("include_timestamps", "true");
    socketUrl.searchParams.set("commit_strategy", "vad");

    const socket = new WebSocket(socketUrl);
    const audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule(chrome.runtime.getURL("audio-processor.js"));
    const source = audioContext.createMediaStreamSource(stream);
    const processor = new AudioWorkletNode(audioContext, "livesignal-pcm-processor");
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    // Capturing a tab otherwise silences it. Route the source back to the user.
    source.connect(audioContext.destination);
    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioContext.destination);

    activeSession = { tabId, socket, stream, audioContext, source, processor, silentGain };

    processor.port.onmessage = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const pcm = new Uint8Array(event.data);
      if (!pcm.length) return;
      socket.send(JSON.stringify({
        message_type: "input_audio_chunk",
        audio_base_64: bytesToBase64(pcm)
      }));
    };

    socket.addEventListener("open", () => {
      void report(tabId, "TRANSCRIPTION_STATUS", { status: "listening" });
    });
    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.message_type === "partial_transcript") {
        void report(tabId, "TRANSCRIPT_PARTIAL", { text: message.text || "" });
      }
      if (["committed_transcript", "committed_transcript_with_timestamps"].includes(message.message_type) && message.text?.trim()) {
        void report(tabId, "TRANSCRIPT_COMMITTED", {
          segment: {
            id: message.id || `scribe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            text: message.text.trim(),
            words: message.words || [],
            capturedAt: new Date().toISOString(),
            provider: "ElevenLabs Scribe v2 Realtime"
          }
        });
      }
    });
    socket.addEventListener("error", () => {
      void report(tabId, "TRANSCRIPTION_STATUS", { status: "error", error: "ElevenLabs realtime connection failed." });
    });
    socket.addEventListener("close", (event) => {
      if (activeSession?.tabId !== tabId) return;
      const normal = event.code === 1000;
      void report(tabId, "TRANSCRIPTION_STATUS", {
        status: normal ? "idle" : "error",
        error: normal ? null : `ElevenLabs connection closed (${event.code}).`
      });
    });
  } catch (error) {
    await closeSession();
    await report(tabId, "TRANSCRIPTION_STATUS", {
      status: "error",
      error: String(error?.message || error)
    });
  }
};

chrome.runtime.onMessage.addListener((message) => {
  if (message?.target !== "offscreen") return false;
  if (message.type === "START_TRANSCRIPTION") void startSession(message);
  if (message.type === "STOP_TRANSCRIPTION" && activeSession?.tabId === message.tabId) {
    void closeSession();
  }
  return false;
});
