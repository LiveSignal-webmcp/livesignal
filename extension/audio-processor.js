class LiveSignalPcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.outputRate = 16000;
    this.phase = 0;
    this.sum = 0;
    this.sampleCount = 0;
    this.output = [];
    this.flushSize = 1600;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input?.length) return true;

    for (const value of input) {
      this.sum += value;
      this.sampleCount += 1;
      this.phase += this.outputRate;

      if (this.phase < sampleRate) continue;
      this.phase -= sampleRate;
      const sample = Math.max(-1, Math.min(1, this.sum / this.sampleCount));
      this.output.push(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
      this.sum = 0;
      this.sampleCount = 0;

      if (this.output.length < this.flushSize) continue;
      const pcm = Int16Array.from(this.output);
      this.output.length = 0;
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}

registerProcessor("livesignal-pcm-processor", LiveSignalPcmProcessor);
