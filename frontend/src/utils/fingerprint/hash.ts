/**
 * SHA-256 hashing utility using Web Crypto API.
 * Falls back to a simple DJB2-based hash for environments without SubtleCrypto.
 */

export async function sha256(input: string): Promise<string> {
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(input);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
        // Fallback: simple DJB2 hash (non-cryptographic, but deterministic)
        let hash = 5381;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
        }
        return Math.abs(hash).toString(16).padStart(8, "0");
    }
}
