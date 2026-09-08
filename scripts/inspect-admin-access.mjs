const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) throw new Error('Cloudflare deployment credentials are missing');
async function inspect(path) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.json();
  if (!response.ok || !body.success) {
    console.log(JSON.stringify({ path, status: response.status, errors: body.errors }));
    return null;
  }
  return body.result;
}
const organization = await inspect('access/organizations');
if (organization) console.log(JSON.stringify({ teamDomain: organization.auth_domain }));
const apps = await inspect('access/apps?per_page=100');
if (apps) console.log(JSON.stringify({ applications: apps.filter(app => /nodove\.com/.test(app.domain || '')).map(({id,name,domain,aud,type}) => ({id,name,domain,aud,type})) }));
const settings = await inspect('workers/scripts/blog-api-gateway/settings');
if (settings) console.log(JSON.stringify({ authBindings: settings.bindings.filter(binding => /^(ADMIN_|CF_|OAUTH_REDIRECT)/.test(binding.name)).map(({name,type,text}) => ({name,type,...(type === 'plain_text' ? {text} : {})})) }));
