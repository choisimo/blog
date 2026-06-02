-- Guard dynamic config against plain secret storage.
--
-- Existing secret-like rows are intentionally left in place for an operational
-- repair/move into the encrypted secrets vault. New writes to config_variables
-- must be non-secret runtime config only.

CREATE VIEW IF NOT EXISTS config_variables_secret_repair_required AS
SELECT id, key, is_secret, updated_at
FROM config_variables
WHERE is_secret = 1
   OR upper(key) LIKE '%SECRET%'
   OR upper(key) LIKE '%TOKEN%'
   OR upper(key) LIKE '%PASSWORD%'
   OR upper(key) LIKE '%CREDENTIAL%'
   OR upper(key) LIKE '%API_KEY%'
   OR upper(key) GLOB '*_KEY';

CREATE TRIGGER IF NOT EXISTS trg_config_variables_secret_guard_insert
BEFORE INSERT ON config_variables
WHEN NEW.is_secret = 1
  OR upper(NEW.key) LIKE '%SECRET%'
  OR upper(NEW.key) LIKE '%TOKEN%'
  OR upper(NEW.key) LIKE '%PASSWORD%'
  OR upper(NEW.key) LIKE '%CREDENTIAL%'
  OR upper(NEW.key) LIKE '%API_KEY%'
  OR upper(NEW.key) GLOB '*_KEY'
BEGIN
  SELECT RAISE(ABORT, 'config_variables is non-secret only; use encrypted secrets vault');
END;

CREATE TRIGGER IF NOT EXISTS trg_config_variables_secret_guard_update
BEFORE UPDATE ON config_variables
WHEN NEW.is_secret = 1
  OR upper(NEW.key) LIKE '%SECRET%'
  OR upper(NEW.key) LIKE '%TOKEN%'
  OR upper(NEW.key) LIKE '%PASSWORD%'
  OR upper(NEW.key) LIKE '%CREDENTIAL%'
  OR upper(NEW.key) LIKE '%API_KEY%'
  OR upper(NEW.key) GLOB '*_KEY'
BEGIN
  SELECT RAISE(ABORT, 'config_variables is non-secret only; use encrypted secrets vault');
END;
