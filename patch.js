const fs = require('fs');
const file = 'workers/seo-gateway/src/index.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');",
  `if (path.startsWith('/assets/') || path.includes('/images/')) {
    newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    newHeaders.set('Cache-Control', 'public, no-cache, must-revalidate');
  }`
);

fs.writeFileSync(file, code);
