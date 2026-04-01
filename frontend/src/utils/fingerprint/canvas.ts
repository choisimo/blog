/**
 * Canvas Fingerprint Extractor
 *
 * Renders text and shapes to an offscreen <canvas>, then hashes the resulting
 * pixel data.  Different GPU drivers / font rasterisers produce subtly
 * different output, which makes the hash unique per device.
 *
 * Completely self-contained — no third-party dependencies.
 */

import { sha256 } from "./hash";

export async function getCanvasFingerprint(): Promise<string> {
    try {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (!ctx) return "";

        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 256, 128);
        gradient.addColorStop(0, "#ff6633");
        gradient.addColorStop(0.5, "#2266ff");
        gradient.addColorStop(1, "#33cc88");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 128);

        // Text with specific font stack — font rendering is highly device-specific
        ctx.fillStyle = "#113355";
        ctx.font = "18px 'Arial', 'Liberation Sans', sans-serif";
        ctx.textBaseline = "alphabetic";
        ctx.fillText("🖥️ BrowserFingerprint 2026!", 4, 30);

        ctx.fillStyle = "rgba(102, 204, 170, 0.7)";
        ctx.font = "bold 14px 'Georgia', 'Times New Roman', serif";
        ctx.fillText("nodove.com – canvas probe", 8, 62);

        // Geometric shapes — anti-aliasing differs per GPU
        ctx.strokeStyle = "#dd4488";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(200, 90, 30, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(30, 100, 200, 0.5)";
        ctx.beginPath();
        ctx.moveTo(10, 100);
        ctx.lineTo(50, 70);
        ctx.lineTo(90, 110);
        ctx.closePath();
        ctx.fill();

        // Blend mode — compositing algorithms differ across implementations
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "rgba(255, 200, 0, 0.6)";
        ctx.fillRect(100, 60, 80, 50);
        ctx.globalCompositeOperation = "source-over";

        const dataUrl = canvas.toDataURL("image/png");
        return sha256(dataUrl);
    } catch {
        return "";
    }
}
