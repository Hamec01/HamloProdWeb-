type AudioAnalysisResult = {
  bpm: number | null;
  durationSeconds: number;
  formattedDuration: string;
};

function formatDuration(totalSeconds: number) {
  const roundedSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(roundedSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (roundedSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function normalizeBpm(rawBpm: number) {
  let bpm = rawBpm;

  while (bpm < 70) {
    bpm *= 2;
  }

  while (bpm > 170) {
    bpm /= 2;
  }

  return Math.round(bpm);
}

function estimateBpm(audioBuffer: AudioBuffer) {
  const windowSize = 1024;
  const { sampleRate, length, numberOfChannels } = audioBuffer;
  const channelData = Array.from({ length: numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  const energyWindows: number[] = [];

  for (let start = 0; start < length; start += windowSize) {
    const end = Math.min(start + windowSize, length);
    let energy = 0;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      let mixedSample = 0;

      for (let channelIndex = 0; channelIndex < numberOfChannels; channelIndex += 1) {
        mixedSample += channelData[channelIndex][sampleIndex] ?? 0;
      }

      mixedSample /= numberOfChannels;
      energy += mixedSample * mixedSample;
    }

    energyWindows.push(Math.sqrt(energy / Math.max(end - start, 1)));
  }

  if (energyWindows.length < 8) {
    return null;
  }

  const prefixSums = new Array(energyWindows.length + 1).fill(0);
  for (let index = 0; index < energyWindows.length; index += 1) {
    prefixSums[index + 1] = prefixSums[index] + energyWindows[index];
  }

  const peakTimes: number[] = [];
  const neighborhood = 24;

  for (let index = 1; index < energyWindows.length - 1; index += 1) {
    const rangeStart = Math.max(0, index - neighborhood);
    const rangeEnd = Math.min(energyWindows.length - 1, index + neighborhood);
    const windowCount = rangeEnd - rangeStart + 1;
    const localAverage = (prefixSums[rangeEnd + 1] - prefixSums[rangeStart]) / windowCount;
    const currentEnergy = energyWindows[index];

    if (
      currentEnergy > localAverage * 1.35 &&
      currentEnergy > energyWindows[index - 1] &&
      currentEnergy >= energyWindows[index + 1]
    ) {
      peakTimes.push((index * windowSize) / sampleRate);
    }
  }

  if (peakTimes.length < 2) {
    return null;
  }

  const bpmVotes = new Map<number, number>();

  for (let index = 0; index < peakTimes.length; index += 1) {
    for (let offset = 1; offset <= 10 && index + offset < peakTimes.length; offset += 1) {
      const interval = peakTimes[index + offset] - peakTimes[index];

      if (interval <= 0.25 || interval >= 2) {
        continue;
      }

      const normalizedBpm = normalizeBpm(60 / interval);
      bpmVotes.set(normalizedBpm, (bpmVotes.get(normalizedBpm) ?? 0) + (11 - offset));
    }
  }

  let detectedBpm: number | null = null;
  let topVote = 0;

  for (const [candidateBpm, votes] of bpmVotes.entries()) {
    if (votes > topVote) {
      topVote = votes;
      detectedBpm = candidateBpm;
    }
  }

  return detectedBpm;
}

export async function analyzeAudioFile(file: File): Promise<AudioAnalysisResult> {
  const audioContextConstructor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!audioContextConstructor) {
    throw new Error("Audio analysis is not supported in this browser.");
  }

  const audioContext = new audioContextConstructor();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const durationSeconds = audioBuffer.duration;

    return {
      bpm: estimateBpm(audioBuffer),
      durationSeconds,
      formattedDuration: formatDuration(durationSeconds),
    };
  } finally {
    await audioContext.close();
  }
}