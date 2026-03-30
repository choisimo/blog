import { fileURLToPath } from "node:url";

process.env.AI_DEFAULT_MODEL ??= "gpt-4.1";
process.env.SQLITE_PATH ??= fileURLToPath(
  new URL("../.data/blog.db", import.meta.url),
);
process.env.SQLITE_MIGRATIONS_DIR ??= fileURLToPath(
  new URL("../workers/migrations", import.meta.url),
);

const {
  findMemoryEmbeddingConsistencyGaps,
  getDomainOutboxSummary,
  listStuckDomainOutboxEvents,
} = await import("../backend/src/repositories/domain-outbox.repository.js");

const summary = await getDomainOutboxSummary();
const stuck = await listStuckDomainOutboxEvents({
  limit: 20,
  olderThanMinutes: 15,
});
const gaps = await findMemoryEmbeddingConsistencyGaps(20);

console.log("Memory Embedding Outbox Summary");
console.log(JSON.stringify(summary, null, 2));

console.log("\nStuck Or Dead-Letter Events");
console.log(JSON.stringify(stuck, null, 2));

console.log("\nConsistency Gaps");
console.log(JSON.stringify(gaps, null, 2));

if (summary.deadLetter > 0 || stuck.length > 0 || gaps.length > 0) {
  process.exitCode = 1;
}
