/**
 * @typedef {Object} SessionTokenRecord
 * @property {string} id
 * @property {string} sessionToken
 * @property {string|null|undefined} expiresAt
 * @property {boolean} isActive
 */

/**
 * Runtime contract check for SessionTokenStore port.
 * @param {unknown} port
 */
export function assertSessionTokenStorePort(port) {
  if (!port || typeof port !== "object") {
    throw new Error("SessionTokenStore port must be an object");
  }

  const required = [
    "isAvailable",
    "findActiveByToken",
    "touchActivity",
    "deactivateById",
  ];

  for (const method of required) {
    if (typeof port[method] !== "function") {
      throw new Error(`SessionTokenStore port missing method: ${method}`);
    }
  }
}
