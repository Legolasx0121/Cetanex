export type WavRecorder = {
  stop: () => Promise<Blob>;
};

function mergeAudioChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce(
    (total, chunk) => total + chunk.length,
    0,
  );

  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function downsampleAudio(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number,
) {
  if (inputSampleRate === outputSampleRate) {
    return input;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const inputStart = Math.floor(outputIndex * ratio);
    const inputEnd = Math.min(
      Math.floor((outputIndex + 1) * ratio),
      input.length,
    );

    let sum = 0;
    let samples = 0;

    for (
      let inputIndex = inputStart;
      inputIndex < inputEnd;
      inputIndex += 1
    ) {
      sum += input[inputIndex];
      samples += 1;
    }

    output[outputIndex] = samples > 0 ? sum / samples : 0;
  }

  return output;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;

  for (const sample of samples) {
    const normalized = Math.max(-1, Math.min(1, sample));
    const integer =
      normalized < 0
        ? normalized * 0x8000
        : normalized * 0x7fff;

    view.setInt16(offset, integer, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], {
    type: "audio/wav",
  });
}

export async function startWavRecording(): Promise<WavRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioContext = new AudioContext();
  await audioContext.resume();

  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentOutput = audioContext.createGain();

  silentOutput.gain.value = 0;

  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(silentOutput);
  silentOutput.connect(audioContext.destination);

  return {
    stop: async () => {
      processor.onaudioprocess = null;
      processor.disconnect();
      source.disconnect();
      silentOutput.disconnect();

      for (const track of stream.getTracks()) {
        track.stop();
      }

      const originalSampleRate = audioContext.sampleRate;
      await audioContext.close();

      const mergedAudio = mergeAudioChunks(chunks);

      if (mergedAudio.length === 0) {
        throw new Error("No se capturó audio.");
      }

      const targetSampleRate = 16000;
      const downsampledAudio = downsampleAudio(
        mergedAudio,
        originalSampleRate,
        targetSampleRate,
      );

      return encodeWav(downsampledAudio, targetSampleRate);
    },
  };
}