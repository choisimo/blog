## Config / Secret Checklist

- [ ] No new config, env, or secret keys were added.
- [ ] New keys, if any, have entries in `shared/src/contracts/config-registry.js`.
- [ ] `publicExposure` is correct for every changed key.
- [ ] No secret values were added to source, generated docs, logs, frontend runtime config, or public bundles.
- [ ] Generated artifacts were refreshed with `npm run config:generate`.

## Verification

- [ ] `npm run config:generate:check`
- [ ] Relevant service tests passed.
