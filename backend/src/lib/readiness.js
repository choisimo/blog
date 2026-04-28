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

function normalizeDependencyCheck(check) {
  const name = String(check?.name || "unknown").trim() || "unknown";
  const ok = check?.ok === true;
  const required = check?.required !== false;
  return {
    name,
    ok,
    required,
    status: check?.status || (ok ? "ok" : "failed"),
    detail: check?.detail || null,
    checkedAt: check?.checkedAt || new Date().toISOString(),
  };
}

export async function runReadinessChecks(checks = []) {
  return Promise.all(
    checks.map(async (check) => {
      const name = String(check?.name || "unknown").trim() || "unknown";
      const required = check?.required !== false;
      try {
        const result = await check.check();
        return normalizeDependencyCheck({
          name,
          required,
          ...(result && typeof result === "object" ? result : { ok: result === true }),
        });
      } catch (error) {
        return normalizeDependencyCheck({
          name,
          required,
          ok: false,
          status: "failed",
          detail: error?.message || "readiness check failed",
        });
      }
    }),
  );
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

export function buildReadinessResponse(extra = {}, dependencyChecks = []) {
  const snapshot = getReadinessSnapshot();
  const dependencies = dependencyChecks.map(normalizeDependencyCheck);
  const failedRequiredDependencies = dependencies.filter(
    (dependency) => dependency.required && !dependency.ok,
  );
  const dependencyReasons = failedRequiredDependencies.map(
    (dependency) => `dependency_${dependency.name}_unavailable`,
  );
  const degraded = snapshot.degraded || failedRequiredDependencies.length > 0;

  return {
    statusCode: degraded ? 503 : 200,
    body: {
      ok: !degraded,
      status: degraded ? "degraded" : "ready",
      degraded,
      degradedReasons: [...snapshot.reasons, ...dependencyReasons],
      dependencies,
      ...extra,
    },
  };
}
