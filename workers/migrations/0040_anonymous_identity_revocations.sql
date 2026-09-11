-- R07-1: retain only a namespaced SHA-256 subject digest and revocation time.
-- Revocation stops new authorization for ALL tokens of the same anonymous subject.
-- Never delete tombstones as a routine TTL cleanup: doing so could revive a token.
-- No memo, chat, image, preference or quota data is deleted or reassigned here.
CREATE TABLE IF NOT EXISTS anonymous_identity_revocations (
  subject_hash TEXT PRIMARY KEY NOT NULL CHECK(length(subject_hash) = 64),
  revoked_at TEXT NOT NULL
);
