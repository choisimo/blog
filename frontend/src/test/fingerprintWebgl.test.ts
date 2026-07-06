import { afterEach, describe, expect, it, vi } from "vitest";

import { sha256 } from "../utils/fingerprint/hash";
import { getWebGLFingerprint } from "../utils/fingerprint/webgl";

const GL_CONSTANTS = {
    VENDOR: 1,
    RENDERER: 2,
    MAX_TEXTURE_SIZE: 3,
    MAX_VIEWPORT_DIMS: 4,
    SHADING_LANGUAGE_VERSION: 5,
    VERTEX_SHADER: 6,
    FRAGMENT_SHADER: 7,
    HIGH_FLOAT: 8,
    UNMASKED_VENDOR_WEBGL: 9,
    UNMASKED_RENDERER_WEBGL: 10,
} as const;

function stubDocumentWithContext(context: unknown): void {
    vi.stubGlobal("document", {
        createElement: vi.fn(() => ({
            getContext: vi.fn((type: string) =>
                type === "webgl" || type === "experimental-webgl"
                    ? context
                    : null,
            ),
        })),
    });
}

describe("getWebGLFingerprint", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("hashes normalized values from a structural WebGL context", async () => {
        const gl = {
            ...GL_CONSTANTS,
            getExtension: vi.fn(() => ({
                UNMASKED_VENDOR_WEBGL: GL_CONSTANTS.UNMASKED_VENDOR_WEBGL,
                UNMASKED_RENDERER_WEBGL: GL_CONSTANTS.UNMASKED_RENDERER_WEBGL,
            })),
            getParameter: vi.fn((parameter: number) => {
                switch (parameter) {
                    case GL_CONSTANTS.UNMASKED_VENDOR_WEBGL:
                        return "Acme Vendor";
                    case GL_CONSTANTS.UNMASKED_RENDERER_WEBGL:
                        return "Acme Renderer";
                    case GL_CONSTANTS.MAX_TEXTURE_SIZE:
                        return 4096;
                    case GL_CONSTANTS.MAX_VIEWPORT_DIMS:
                        return new Int32Array([4096, 2048]);
                    case GL_CONSTANTS.SHADING_LANGUAGE_VERSION:
                        return "WebGL GLSL ES 1.0";
                    default:
                        return "";
                }
            }),
            getSupportedExtensions: vi.fn(() => [
                "OES_texture_float",
                "ANGLE_instanced_arrays",
            ]),
            getShaderPrecisionFormat: vi.fn(() => ({
                rangeMin: 127,
                rangeMax: 127,
                precision: 23,
            })),
        };

        stubDocumentWithContext(gl);

        const components = [
            "v:Acme Vendor",
            "r:Acme Renderer",
            "ext:ANGLE_instanced_arrays,OES_texture_float",
            "mts:4096",
            "mvd:4096x2048",
            "slv:WebGL GLSL ES 1.0",
            "vsp:127,127,23",
            "fsp:127,127,23",
        ].join("|");

        await expect(getWebGLFingerprint()).resolves.toBe(
            await sha256(components),
        );
    });

    it("returns an empty fingerprint outside browser contexts", async () => {
        vi.stubGlobal("document", undefined);

        await expect(getWebGLFingerprint()).resolves.toBe("");
    });

    it("rejects malformed WebGL contexts", async () => {
        stubDocumentWithContext({
            ...GL_CONSTANTS,
            getParameter: "not-a-function",
        });

        await expect(getWebGLFingerprint()).resolves.toBe("");
    });

    it("normalizes malformed WebGL parameter values before hashing", async () => {
        const gl = {
            ...GL_CONSTANTS,
            getExtension: vi.fn(() => null),
            getParameter: vi.fn((parameter: number) => {
                switch (parameter) {
                    case GL_CONSTANTS.VENDOR:
                        return { vendor: "ignored" };
                    case GL_CONSTANTS.RENDERER:
                        return "Fallback Renderer";
                    case GL_CONSTANTS.MAX_TEXTURE_SIZE:
                        return Number.POSITIVE_INFINITY;
                    case GL_CONSTANTS.MAX_VIEWPORT_DIMS:
                        return new Int32Array([8192, 4096]);
                    case GL_CONSTANTS.SHADING_LANGUAGE_VERSION:
                        return false;
                    default:
                        return null;
                }
            }),
            getSupportedExtensions: vi.fn(() => [
                "Z_extension",
                12,
                "A_extension",
            ]),
            getShaderPrecisionFormat: vi.fn(() => ({
                rangeMin: 1,
                rangeMax: "bad",
                precision: 2,
            })),
        };

        stubDocumentWithContext(gl);

        const components = [
            "v:unknown",
            "r:Fallback Renderer",
            "ext:A_extension,Z_extension",
            "mts:0",
            "mvd:8192x4096",
            "slv:false",
            "vsp:n/a",
            "fsp:n/a",
        ].join("|");

        await expect(getWebGLFingerprint()).resolves.toBe(
            await sha256(components),
        );
    });
});
