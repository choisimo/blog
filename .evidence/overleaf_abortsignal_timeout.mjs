const REQUEST_TIMEOUT_MS = 30 * 1000
...
async function getProjectLastUpdatedAt(projectId) {
  const body = await fetchJson(
    `${BASE_URL}/project/${projectId}/last_updated_at`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
  )
  return body.lastUpdatedAt != null ? new Date(body.lastUpdatedAt) : null
}
