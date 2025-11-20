# r2-gateway Worker

R2 access-control gateway to reduce R2 reads by fronting with Cloudflare cache and enforcing request policies.

## Setup

1) Edit `wrangler.toml`:
- Set `bucket_name` in `r2_buckets` to your actual R2 bucket
- Choose a routing method: `routes` or custom domain

2) Deploy

```
npm i
npm run deploy
```

## Access control

Default policy allows requests only with `Referer` starting `https://mydomain.com/`. Adjust logic in `src/index.ts` as needed.
