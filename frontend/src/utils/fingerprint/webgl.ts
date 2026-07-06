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

interface WebGLContextLike {
    VENDOR: number;
    RENDERER: number;
    MAX_TEXTURE_SIZE: number;
    MAX_VIEWPORT_DIMS: number;
    SHADING_LANGUAGE_VERSION: number;
    VERTEX_SHADER: number;
    FRAGMENT_SHADER: number;
    HIGH_FLOAT: number;
    getExtension(name: string): unknown;
    getParameter(parameter: number): unknown;
    getSupportedExtensions(): unknown;
    getShaderPrecisionFormat(shaderType: number, precisionType: number): unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function toStringParam(value: unknown, fallback = ""): string {
    if (typeof value === "string") return value;
    if (isFiniteNumber(value) || typeof value === "boolean") {
        return String(value);
    }
    return fallback;
}

function toNumberParam(value: unknown): number {
    return isFiniteNumber(value) ? value : 0;
}

function toStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string").sort();
}

function toNumberList(value: unknown, fallback: number[]): number[] {
    if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return fallback;
    const values = Array.from(value).map((item) => toNumberParam(item));
    return values.length > 0 ? values : fallback;
}

function isWebGLContextLike(value: unknown): value is WebGLContextLike {
    if (!isRecord(value)) return false;

    return (
        typeof value.getExtension === "function" &&
        typeof value.getParameter === "function" &&
        typeof value.getSupportedExtensions === "function" &&
        typeof value.getShaderPrecisionFormat === "function" &&
        isFiniteNumber(value.VENDOR) &&
        isFiniteNumber(value.RENDERER) &&
        isFiniteNumber(value.MAX_TEXTURE_SIZE) &&
        isFiniteNumber(value.MAX_VIEWPORT_DIMS) &&
        isFiniteNumber(value.SHADING_LANGUAGE_VERSION) &&
        isFiniteNumber(value.VERTEX_SHADER) &&
        isFiniteNumber(value.FRAGMENT_SHADER) &&
        isFiniteNumber(value.HIGH_FLOAT)
    );
}

function debugParameter(debugExt: unknown, key: string): number | null {
    if (!isRecord(debugExt)) return null;
    const value = debugExt[key];
    return isFiniteNumber(value) ? value : null;
}

function formatShaderPrecision(value: unknown): string {
    if (!isRecord(value)) return "n/a";

    const rangeMin = value.rangeMin;
    const rangeMax = value.rangeMax;
    const precision = value.precision;
    if (
        !isFiniteNumber(rangeMin) ||
        !isFiniteNumber(rangeMax) ||
        !isFiniteNumber(precision)
    ) {
        return "n/a";
    }

    return `${rangeMin},${rangeMax},${precision}`;
}

function collectWebGLInfo(): WebGLInfo | null {
    try {
        if (typeof document === "undefined") return null;

        const canvas = document.createElement("canvas");
        const gl =
            canvas.getContext("webgl") ||
            canvas.getContext("experimental-webgl");

        if (!isWebGLContextLike(gl)) return null;

        let vendor = "";
        let renderer = "";

        const debugExt = gl.getExtension("WEBGL_debug_renderer_info");
        const debugVendor = debugParameter(debugExt, "UNMASKED_VENDOR_WEBGL");
        const debugRenderer = debugParameter(debugExt, "UNMASKED_RENDERER_WEBGL");
        if (debugVendor !== null) {
            vendor = toStringParam(gl.getParameter(debugVendor));
        }
        if (debugRenderer !== null) {
            renderer = toStringParam(gl.getParameter(debugRenderer));
        }

        // Fallback to generic info if debug extension is blocked
        if (!vendor) vendor = toStringParam(gl.getParameter(gl.VENDOR), "unknown");
        if (!renderer) {
            renderer = toStringParam(gl.getParameter(gl.RENDERER), "unknown");
        }

        const extensions = toStringList(gl.getSupportedExtensions());
        const maxTextureSize = toNumberParam(gl.getParameter(gl.MAX_TEXTURE_SIZE));
        const maxViewportDims = toNumberList(
            gl.getParameter(gl.MAX_VIEWPORT_DIMS),
            [0, 0],
        );
        const shadingLanguageVersion = toStringParam(
            gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        );

        // Shader precision
        const getPrec = (
            shaderType: number,
            precType: number,
        ): string => {
            try {
                return formatShaderPrecision(
                    gl.getShaderPrecisionFormat(shaderType, precType),
                );
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
