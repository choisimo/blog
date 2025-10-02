# Security Policy

## 🔐 Sensitive Information

This repository follows strict security practices:

### ✅ Safe to Commit
- `wrangler.toml` - Contains only resource IDs (D1, KV, R2)
- `.dev.vars.example` - Template files with placeholder values
- Source code with environment variable references

### ❌ NEVER Commit
- `.env` - Environment variables
- `.dev.vars` - Actual development secrets
- `wrangler-account.json` - Cloudflare account information
- Service account JSON files
- API keys, tokens, passwords
- Private keys or certificates

### 🛡️ Secret Management

**Development Secrets** (Local):
- Store in `.dev.vars` (gitignored)
- Never commit actual values

**Production Secrets** (Cloudflare):
- Set via `wrangler secret put` CLI
- Or use GitHub Actions secrets for CI/CD

**GitHub Actions Secrets**:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `VITE_API_BASE_URL`

### 🚨 If Secrets Are Exposed

1. **Immediately rotate all exposed credentials**
   ```bash
   # Rotate Cloudflare API token
   wrangler secret put JWT_SECRET --env production
   wrangler secret put ADMIN_PASSWORD --env production
   ```

2. **Remove from Git history**
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch PATH_TO_FILE" \
     --prune-empty --tag-name-filter cat -- --all
   ```

3. **Force push (⚠️ destructive)**
   ```bash
   git push origin --force --all
   ```

4. **Notify team and audit access logs**

## 📋 Security Checklist

Before every commit:
- [ ] No `.env` or `.dev.vars` files
- [ ] No API keys or passwords in code
- [ ] All secrets use environment variables
- [ ] `.gitignore` properly configured
- [ ] Run `git diff --cached` to review changes

## 🔍 Automated Checks

Pre-commit hook checks for:
- Common secret patterns
- Environment files
- Service account files

## 📞 Reporting Security Issues

If you discover a security vulnerability:
1. **DO NOT** open a public issue
2. Email: [security contact]
3. Include detailed description and steps to reproduce

## 🔄 Regular Security Maintenance

- [ ] Rotate secrets every 90 days
- [ ] Review access logs monthly
- [ ] Update dependencies regularly
- [ ] Audit `.gitignore` quarterly
