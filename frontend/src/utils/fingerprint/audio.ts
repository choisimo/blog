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

export async function getAudioFingerprint(): Promise<string> {
    try {
        const OfflineCtx =
            window.OfflineAudioContext ||
            (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
                .webkitOfflineAudioContext;

        if (!OfflineCtx) return "";

        const sampleRate = 44100;
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
        const channelData = buffer.getChannelData(0);

        // Use first 4500 samples — more than enough for uniqueness
        const sampleCount = Math.min(4500, channelData.length);
        const parts: string[] = [];
        for (let i = 0; i < sampleCount; i++) {
            parts.push(channelData[i].toFixed(6));
        }

        return sha256(parts.join(","));
    } catch {
        return "";
    }
}
