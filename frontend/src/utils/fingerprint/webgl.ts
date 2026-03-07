/**
 * WebGL Fingerprint Extractor
 *
 * Collects WebGL renderer info (VENDOR, RENDERER), supported extensions,
 * shader precision, and max texture size, then hashes the combined string.
 *
 * GPU hardware differences make this highly unique across devices.
 */

import { sha256 } from "./hash";

interface WebGLInfo {
    vendor: string;
    renderer: string;
    extensions: string[];
    maxTextureSize: number;
    maxViewportDims: number[];
    shadingLanguageVersion: string;
    vertexShaderPrecision: string;
    fragmentShaderPrecision: string;
}

function collectWebGLInfo(): WebGLInfo | null {
    try {
        const canvas = document.createElement("canvas");
        const gl =
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl");

        if (!gl || !(gl instanceof WebGLRenderingContext)) return null;

        let vendor = "";
        let renderer = "";

        const debugExt = gl.getExtension("WEBGL_debug_renderer_info");
        if (debugExt) {
            vendor = gl.getParameter(debugExt.UNMASKED_VENDOR_WEBGL) || "";
            renderer = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || "";
        }

        // Fallback to generic info if debug extension is blocked
        if (!vendor) vendor = gl.getParameter(gl.VENDOR) || "unknown";
        if (!renderer) renderer = gl.getParameter(gl.RENDERER) || "unknown";

        const extensions = (gl.getSupportedExtensions() || []).sort();
        const maxTextureSize: number = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
        const maxViewportDims: number[] = Array.from(
            gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [0, 0],
        );
        const shadingLanguageVersion: string =
            gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || "";

        // Shader precision
        const getPrec = (
            shaderType: number,
            precType: number,
        ): string => {
            try {
                const p = gl.getShaderPrecisionFormat(shaderType, precType);
                return p
                    ? `${p.rangeMin},${p.rangeMax},${p.precision}`
                    : "n/a";
            } catch {
                return "n/a";
            }
        };

        const vertexShaderPrecision = getPrec(
            gl.VERTEX_SHADER,
            gl.HIGH_FLOAT,
        );
        const fragmentShaderPrecision = getPrec(
            gl.FRAGMENT_SHADER,
            gl.HIGH_FLOAT,
        );

        return {
            vendor,
            renderer,
            extensions,
            maxTextureSize,
            maxViewportDims,
            shadingLanguageVersion,
            vertexShaderPrecision,
            fragmentShaderPrecision,
        };
    } catch {
        return null;
    }
}

export async function getWebGLFingerprint(): Promise<string> {
    try {
        const info = collectWebGLInfo();
        if (!info) return "";

        const components = [
            `v:${info.vendor}`,
            `r:${info.renderer}`,
            `ext:${info.extensions.join(",")}`,
            `mts:${info.maxTextureSize}`,
            `mvd:${info.maxViewportDims.join("x")}`,
            `slv:${info.shadingLanguageVersion}`,
            `vsp:${info.vertexShaderPrecision}`,
            `fsp:${info.fragmentShaderPrecision}`,
        ].join("|");

        return sha256(components);
    } catch {
        return "";
    }
}
