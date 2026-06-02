# Config and Secret Key Change Policy

This repository uses `shared/src/contracts/config-registry.js` as the source of truth for environment variables, runtime config keys, deployment-only values, and secrets.

## Required For Every New Key

- Add a registry entry before adding a new `process.env.*`, `import.meta.env.*`, Worker `env.*`, k3s env key, wrangler secret, or GitHub Actions secret reference.
- Include generated artifact updates from `npm run config:generate`.
- Classify the key as `public-config`, `private-config`, `runtime-mutable-config`, `secret`, `deployment-only`, or `infra-only`.
- Set owner, scopes, required services, delivery paths, public exposure, runtime mutability, rotation policy, and deprecated aliases.
- Keep secret values out of source control, generated docs, logs, frontend bundles, D1 `config_variables.value`, and KV dynamic config.

## Secret Handling Rules

- Secret values must only be delivered through k3s Secret, GitHub Secrets, wrangler secret, local untracked `.env`, or the Worker encrypted D1 secret vault.
- D1/KV dynamic config is for non-secret runtime config only.
- Secret-like names such as `*KEY`, `*SECRET`, `*TOKEN`, `*PASSWORD`, and `*_CREDENTIAL*` are denied from public runtime config unless explicitly recorded as a public token in the registry.
- Production and staging must fail readiness or boot checks when required secrets are missing or known placeholders are used.

## Generated Files

Run these before review when registry metadata changes:

```bash
npm run config:inventory:write
npm run config:generate
npm run config:generate:check
```

Generated docs may list key names and metadata. They must not include live values, masked live prefixes/suffixes, or example secrets.
