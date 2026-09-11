# SEO gateway origin redirect outage — 2026-09-11

The public site returned HTTP 502 with `X-SEO-Error: PAGE_ORIGIN_UNAVAILABLE` after the SEO gateway release in PR #182. The API health endpoint remained healthy. GitHub Pages returned `301 Location: http://noblog.nodove.com/index.html` for the configured repository origin, while a direct Pages request with the custom Host returned the built HTML successfully.

The new origin helper used `redirect: manual` and treated every non-200 shell response as an origin failure. Asset responses also exposed the CNAME redirect instead of proxying bytes. Previous code followed redirects. Unit/runtime tests covered upstream errors but lacked the production CNAME redirect topology.

The fix follows at most three redirects within a shared ten-second timeout. Destinations are restricted to the configured initial origin and, for built Pages content, the configured public site hostname and port. GitHub's HTTP CNAME alias is supported. Credentials in redirect URLs, foreign hosts/ports, and redirect loops are rejected. User cookies and bearer headers remain excluded from all upstream requests; resource query strings, methods and validators remain intact.

Cloudflare route subrequests reach the backing origin rather than invoking the route again: [Routes documentation](https://developers.cloudflare.com/workers/configuration/routing/routes/). A redirect hop limit still protects against origin-side loops.

Validation: `npm --prefix workers/seo-gateway run verify` passes type-checking, 119 unit tests and 11 real HTMLRewriter runtime tests. New regression coverage checks HTTP/HTTPS CNAME redirects, asset bytes and conditional headers, credential isolation, unapproved targets and redirect loops. Deployment and actual public HTML/assets must be verified separately; a passing build alone does not establish availability.
