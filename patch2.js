const fs = require('fs');
const file = 'workers/seo-gateway/src/index.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace fetchFromRawGitHub call to include search params
code = code.replace(
  "return fetchFromRawGitHub(requestPath);",
  "return fetchFromRawGitHub(requestPath + url.search);"
);

// We already patched fetchFromRawGitHub to use better cache-control headers earlier

fs.writeFileSync(file, code);
