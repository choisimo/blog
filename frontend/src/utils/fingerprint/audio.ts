/**
 * AudioContext Fingerprint Extractor
 *
 * Uses OfflineAudioContext with a triangle-wave oscillator to produce a
 * platform-dependent audio waveform, then hashes the first 4500 samples.
 *
 * Audio processing pipelines (resampling, dithering, mixing) differ across
 * OS / browser / hardware combinations, producing unique fingerprints.
 */

import { sha256 } from "./hash";

const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_SAMPLE_COUNT = 4500;

export async function getAudioFingerprint(): Promise<string> {
    if (typeof window === "undefined") {
        return "";
    }

    try {
        const OfflineCtx =
            window.OfflineAudioContext ||
            (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
                .webkitOfflineAudioContext;

        if (!OfflineCtx) return "";

        const sampleRate = AUDIO_SAMPLE_RATE;
        const length = sampleRate * 0.13; // ~130ms of audio
        const context = new OfflineCtx(1, length, sampleRate);

        // Triangle wave oscillator
        const oscillator = context.createOscillator();
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(10000, context.currentTime);

        // Compressor to amplify platform-specific processing differences
        const compressor = context.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-50, context.currentTime);
        compressor.knee.setValueAtTime(40, context.currentTime);
        compressor.ratio.setValueAtTime(12, context.currentTime);
        compressor.attack.setValueAtTime(0, context.currentTime);
        compressor.release.setValueAtTime(0.25, context.currentTime);

        oscillator.connect(compressor);
        compressor.connect(context.destination);

        oscillator.start(0);

        const buffer = await context.startRendering();
        if (!buffer || typeof buffer.getChannelData !== "function") {
            return "";
        }

        const channelData = buffer.getChannelData(0);
        if (!channelData || typeof channelData.length !== "number") {
            return "";
        }

        // Use first 4500 samples — more than enough for uniqueness
        const sampleCount = Math.min(AUDIO_SAMPLE_COUNT, channelData.length);
        if (sampleCount <= 0) {
            return "";
        }

        const parts: string[] = [];
        for (let i = 0; i < sampleCount; i++) {
            const sample = channelData[i];
            if (typeof sample !== "number" || !Number.isFinite(sample)) {
                return "";
            }
            parts.push(sample.toFixed(6));
        }

        return sha256(parts.join(","));
    } catch {
        return "";
    }
}
