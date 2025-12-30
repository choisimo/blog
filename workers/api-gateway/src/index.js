/**
 * Blog API Gateway Worker
 * 
 * Architecture: Frontend -> Workers -> Backend
 * 
 * Routes requests to backend server via Cloudflare Workers with
 * secure authentication using X-Backend-Key header.
 * 
 * Environment Variables (set via wrangler secret or dashboard):
 *   - BACKEND_ORIGIN: Backend server origin (e.g., http://YOUR_IP:8080)
 *   - BACKEND_SECRET_KEY: Shared secret for backend authentication
 *   - ALLOWED_ORIGINS: Comma-separated list of allowed CORS origins
 * 
 * Security Flow:
 *   1. Frontend makes request to Workers (api.nodove.com)
 *   2. Workers validates origin and adds X-Backend-Key header
 *   3. Backend nginx validates X-Backend-Key
 *   4. Request forwarded to internal services
 */

// Default allowed origins for CORS
const DEFAULT_ALLOWED_ORIGINS = [
  'https://noblog.nodove.com',
  'https://nodove.com',
  'http://localhost:5173',
  'http://localhost:3000',
];

/**
 * Build CORS headers based on request origin
 */
function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS 
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : DEFAULT_ALLOWED_ORIGINS;
  
  // Check if origin is allowed
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-API-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight requests
 */
function handleOptions(request, env) {
  const corsHeaders = getCorsHeaders(request, env);
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * Forward request to backend with security headers
 */
async function forwardRequest(request, env, ctx) {
  const backendOrigin = env.BACKEND_ORIGIN;
  const backendSecretKey = env.BACKEND_SECRET_KEY;
  
  if (!backendOrigin) {
    return new Response(
      JSON.stringify({ 
        error: 'Configuration error', 
        message: 'BACKEND_ORIGIN not configured' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const url = new URL(request.url);
  const backendUrl = new URL(url.pathname + url.search, backendOrigin);

  // Prepare headers for backend
  const headers = new Headers(request.headers);
  headers.delete('Host');
  
  // Security: Add backend authentication key
  if (backendSecretKey) {
    headers.set('X-Backend-Key', backendSecretKey);
  }
  
  // Forwarding headers
  headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Real-IP', request.headers.get('CF-Connecting-IP') || '');
  headers.set('X-Request-ID', crypto.randomUUID());
  
  // Pass through Cloudflare metadata
  headers.set('CF-Ray', request.headers.get('CF-Ray') || '');
  headers.set('CF-IPCountry', request.headers.get('CF-IPCountry') || '');

  try {
    const response = await fetch(backendUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      duplex: request.method !== 'GET' && request.method !== 'HEAD' ? 'half' : undefined,
    });

    // Clone response and add CORS headers
    const corsHeaders = getCorsHeaders(request, env);
    const responseHeaders = new Headers(response.headers);
    
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });

    // Handle streaming responses (SSE)
    if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Backend request failed:', error);
    
    const corsHeaders = getCorsHeaders(request, env);
    return new Response(
      JSON.stringify({ 
        error: 'Backend unavailable',
        message: 'Could not connect to backend server',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    // Health check endpoint (for Cloudflare)
    const url = new URL(request.url);
    if (url.pathname === '/_health') {
      return new Response(JSON.stringify({ 
        ok: true, 
        worker: 'api-gateway',
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Forward all other requests to backend
    return forwardRequest(request, env, ctx);
  },
};
