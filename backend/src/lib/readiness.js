const readinessState = {
  degradedReasons: new Set(),
};

export function markReadinessDegraded(reason) {
  if (typeof reason === "string" && reason) {
    readinessState.degradedReasons.add(reason);
  }
}

export function resetReadinessState() {
  readinessState.degradedReasons.clear();
}

export function getReadinessSnapshot() {
  const reasons = Array.from(readinessState.degradedReasons);
  return {
    degraded: reasons.length > 0,
    reasons,
  };
}

export function buildHealthPayload(extra = {}) {
  const snapshot = getReadinessSnapshot();
  return {
    ok: true,
    status: snapshot.degraded ? "degraded" : "ok",
    degraded: snapshot.degraded,
    degradedReasons: snapshot.reasons,
    ...extra,
  };
}

export function buildReadinessResponse(extra = {}) {
  const snapshot = getReadinessSnapshot();
  return {
    statusCode: snapshot.degraded ? 503 : 200,
    body: {
      ok: !snapshot.degraded,
      status: snapshot.degraded ? "degraded" : "ready",
      degraded: snapshot.degraded,
      degradedReasons: snapshot.reasons,
      ...extra,
    },
  };
}
