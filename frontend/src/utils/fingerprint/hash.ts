/**
 * SHA-256 hashing utility using Web Crypto API.
 * Falls back to a simple DJB2-based hash for environments without SubtleCrypto.
 */

const MAX_HASH_INPUT_CHARS = 200_000;

function normalizeHashInput(input: unknown): string {
    if (typeof input !== "string") return "";
    return input.slice(0, MAX_HASH_INPUT_CHARS);
}

export async function sha256(input: string): Promise<string> {
    const normalizedInput = normalizeHashInput(input);

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(normalizedInput);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
        // Fallback: simple DJB2 hash (non-cryptographic, but deterministic)
        let hash = 5381;
        for (let i = 0; i < normalizedInput.length; i++) {
            hash = ((hash << 5) + hash + normalizedInput.charCodeAt(i)) & 0xffffffff;
        }
        return Math.abs(hash).toString(16).padStart(8, "0");
    }
}
