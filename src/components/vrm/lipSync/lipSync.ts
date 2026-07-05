import {
  ADAPTATION_RATE,
  HISTORY_WINDOW_SIZE,
  NOISE_FLOOR,
  RMS_WINDOW_SIZE,
} from '@/lib/audioConstants';

import { LipSyncAnalyzeResult, Viseme } from './lipSyncAnalyzeResult';

const TIME_DOMAIN_DATA_LENGTH = 2048;

// Configuration constants for adaptive sensitivity
const MIN_MOUTH_OPEN = 0.0; // Minimum mouth opening
const MAX_MOUTH_OPEN = 2.5; // Maximum mouth opening
const SMOOTHING_FACTOR = 0.15; // Increased for more responsive movement

export class LipSync {
  public readonly audio: AudioContext;
  public readonly analyser: AnalyserNode;
  public readonly timeDomainData: Float32Array;
  private audioContext: AudioContext;
  private source?: AudioBufferSourceNode;
  private dataArray: Uint8Array;
  private volume: number = 0;
  private lastVolume: number = 0;
  private smoothingFactor: number = SMOOTHING_FACTOR;
  private gainNode: GainNode;

  // Adaptive sensitivity properties
  private rmsHistory: number[] = [];
  private minRMS: number = 1.0;
  private maxRMS: number = 0.0;
  private adaptiveMin: number = 1.0;
  private adaptiveMax: number = 0.0;

  // Frequency analysis for better phoneme detection
  private frequencyData: Uint8Array;
  private lastViseme: Viseme = 'aa';
  private lastVisemeScore: number = 0;
  private lastVisemeChangeMs: number = 0;
  private visemeHysteresis: number = 0.08; // require margin to switch
  // Randomized hold time range in seconds; a new random is sampled on each switch
  private _visemeSwitchMinMaxSec: [number, number] = [0.25, 0.6];
  private _nextVisemeHoldMs: number = 250; // initialized in constructor

  public constructor(audio: AudioContext, gainNode: GainNode) {
    this.audio = audio;
    this.audioContext = audio;
    this.gainNode = gainNode;
    this.analyser = audio.createAnalyser();
    this.analyser.fftSize = 64; // Increased for better frequency resolution
    this.analyser.smoothingTimeConstant = 0.5; // More smoothing to reduce flicker
    this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    // Initialize randomized hold based on range
    this._nextVisemeHoldMs = this.randomHoldMs();
  }

  public update(): LipSyncAnalyzeResult {
    this.analyser.getFloatTimeDomainData(
      this.timeDomainData as unknown as Float32Array<ArrayBuffer>
    );
    this.analyser.getByteFrequencyData(
      this.frequencyData as unknown as Uint8Array<ArrayBuffer>
    );

    // Calculate RMS (Root Mean Square) for more stable volume measurement
    let sumSquares = 0.0;
    const sampleCount = Math.min(RMS_WINDOW_SIZE, this.timeDomainData.length);

    for (let i = 0; i < sampleCount; i++) {
      const sample = this.timeDomainData[i];
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / sampleCount);

    // Update RMS history for adaptive sensitivity
    this.rmsHistory.push(rms);
    if (this.rmsHistory.length > HISTORY_WINDOW_SIZE) {
      this.rmsHistory.shift();
    }

    // Update adaptive min/max with smoothing
    if (this.rmsHistory.length > 10) {
      const sortedHistory = [...this.rmsHistory].sort((a, b) => a - b);
      const percentile10 =
        sortedHistory[Math.floor(sortedHistory.length * 0.1)];
      const percentile90 =
        sortedHistory[Math.floor(sortedHistory.length * 0.9)];

      // Smoothly adapt to new ranges
      this.adaptiveMin =
        this.adaptiveMin + (percentile10 - this.adaptiveMin) * ADAPTATION_RATE;
      this.adaptiveMax =
        this.adaptiveMax + (percentile90 - this.adaptiveMax) * ADAPTATION_RATE;

      // Ensure we have a reasonable range
      if (this.adaptiveMax - this.adaptiveMin < 0.01) {
        this.adaptiveMax = this.adaptiveMin + 0.01;
      }
    } else {
      // Initial values
      if (rms < this.minRMS) this.minRMS = rms;
      if (rms > this.maxRMS) this.maxRMS = rms;
      this.adaptiveMin = this.minRMS;
      this.adaptiveMax = this.maxRMS;
    }

    // Normalize RMS to 0-1 range using adaptive min/max
    let normalizedRMS = 0.0;
    if (rms > NOISE_FLOOR) {
      normalizedRMS =
        (rms - this.adaptiveMin) / (this.adaptiveMax - this.adaptiveMin);
      normalizedRMS = Math.max(0, Math.min(1, normalizedRMS));
    }

    // Apply frequency-based enhancement for vowel sounds
    // Low-mid frequencies (100-1000 Hz) are important for vowel sounds
    let frequencyBoost = 0.0;
    if (this.frequencyData.length > 8) {
      // Focus on bins 2-8 which roughly correspond to vowel formants
      for (let i = 2; i < Math.min(8, this.frequencyData.length); i++) {
        frequencyBoost += this.frequencyData[i] / 255.0;
      }
      frequencyBoost /= 6; // Average
    }

    // Combine RMS and frequency analysis
    let targetVolume = normalizedRMS * 0.7 + frequencyBoost * 0.3;

    // Apply non-linear scaling for more expressive movement
    // This creates more distinction between quiet and loud sounds
    targetVolume = Math.pow(targetVolume, 0.7); // Slightly compress dynamic range

    // Scale to desired mouth opening range
    targetVolume =
      targetVolume * (MAX_MOUTH_OPEN - MIN_MOUTH_OPEN) + MIN_MOUTH_OPEN;

    // Apply smoothing for natural movement
    this.volume =
      this.lastVolume + (targetVolume - this.lastVolume) * this.smoothingFactor;
    this.lastVolume = this.volume;

    // Additional processing to ensure good visual results
    let finalVolume = this.volume;

    // Add subtle random variation for more natural movement
    if (finalVolume > 0.1) {
      finalVolume += (Math.random() - 0.5) * 0.02;
    }

    // Ensure we stay within bounds
    finalVolume = Math.max(0, Math.min(MAX_MOUTH_OPEN, finalVolume));

    // Viseme estimation with hysteresis and min-hold
    const low = this.avgRange(1, 3);
    const mid = this.avgRange(4, 8);
    const high = this.avgRange(9, 15);
    const ratioLM = low / (mid + 1e-6);
    const ratioMH = mid / (high + 1e-6);

    // Compute simple scores 0..1 for each viseme
    const scores: Record<Viseme, number> = {
      aa: low,
      ee: mid,
      ih: high,
      oh: Math.min(1, Math.max(0, (ratioLM - 0.8) / 1.2)),
      ou: Math.min(1, Math.max(0, (ratioMH - 0.8) / 1.2)),
    };

    // Quiet gate: keep current viseme when very quiet
    const nowMs = performance.now();
    let nextViseme: Viseme = this.lastViseme;
    let nextScore = scores[nextViseme];

    // Choose best candidate
    let bestViseme: Viseme = this.lastViseme;
    let bestScore = this.lastVisemeScore;
    for (const key of Object.keys(scores) as Viseme[]) {
      if (scores[key] > bestScore) {
        bestScore = scores[key];
        bestViseme = key;
      }
    }

    // Apply min hold and hysteresis before switching
    const heldLongEnough =
      nowMs - this.lastVisemeChangeMs >= this._nextVisemeHoldMs;
    const marginToSwitch =
      bestScore >= this.lastVisemeScore + this.visemeHysteresis;
    const notTooQuiet = finalVolume >= 0.05;

    if (heldLongEnough && marginToSwitch && notTooQuiet) {
      nextViseme = bestViseme;
      nextScore = bestScore;
      this.lastVisemeChangeMs = nowMs;
      // Sample a new random hold duration for the next switch
      this._nextVisemeHoldMs = this.randomHoldMs();
    }

    this.lastViseme = nextViseme;
    this.lastVisemeScore = nextScore;

    return {
      volume: finalVolume,
      viseme: this.lastViseme,
    };
  }

  private avgRange(start: number, end: number): number {
    let sum = 0;
    let count = 0;
    const max = Math.min(this.frequencyData.length - 1, end);
    for (let i = start; i <= max; i++) {
      sum += this.frequencyData[i];
      count++;
    }
    return count > 0 ? sum / (count * 255) : 0;
  }

  // Random hold time in ms based on configured range
  private randomHoldMs(): number {
    const [minSec, maxSec] = this._visemeSwitchMinMaxSec;
    const min = Math.max(0, minSec);
    const max = Math.max(min, maxSec);
    const sec = min + Math.random() * (max - min);
    return sec * 1000;
  }

  // Runtime configuration for viseme hold randomness
  public setVisemeHoldRange(minSec: number, maxSec: number): void {
    this._visemeSwitchMinMaxSec = [minSec, maxSec];
    this._nextVisemeHoldMs = this.randomHoldMs();
  }

  public async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    const audioBuffer = await this.audio.decodeAudioData(buffer);

    this.source = this.audio.createBufferSource();
    this.source.buffer = audioBuffer;

    // Connect source -> gain -> analyser -> destination
    this.source.connect(this.gainNode);
    this.source.connect(this.analyser);
    this.gainNode.connect(this.audio.destination);

    // Reset adaptive parameters for new audio
    this.rmsHistory = [];
    this.adaptiveMin = 1.0;
    this.adaptiveMax = 0.0;
    this.lastVolume = 0;

    this.source.start();
    if (onEnded) {
      this.source.addEventListener('ended', onEnded);
    }
  }

  public async playFromURL(url: string, onEnded?: () => void) {
    try {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      await this.playFromArrayBuffer(buffer, onEnded);
    } catch (error) {
      console.error('Error playing audio from URL:', error);
      if (onEnded) onEnded();
    }
  }

  public stop() {
    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect(this.gainNode);
        this.source.disconnect(this.analyser);
      } catch (e) {
        console.warn('Error stopping audio source:', e);
      }
      this.source = undefined;
    }

    // Reset all parameters
    this.lastVolume = 0;
    this.volume = 0;
    this.rmsHistory = [];
    this.adaptiveMin = 1.0;
    this.adaptiveMax = 0.0;

    this.timeDomainData.fill(0);
    this.analyser.getFloatTimeDomainData(
      this.timeDomainData as unknown as Float32Array<ArrayBuffer>
    );
  }

  // Public method to adjust sensitivity if needed
  public setSmoothingFactor(factor: number) {
    this.smoothingFactor = Math.max(0.01, Math.min(1.0, factor));
  }

  // Get current adaptive range for debugging
  public getAdaptiveRange(): { min: number; max: number; current: number } {
    return {
      min: this.adaptiveMin,
      max: this.adaptiveMax,
      current: this.volume,
    };
  }
}
