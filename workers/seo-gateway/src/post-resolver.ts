import type { Env, PostMeta, Manifest, ManifestItem } from './types';

let manifestCache: { data: Manifest; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

async function fetchManifest(env: Env): Promise<Manifest | null> {
  const now = Date.now();
  if (manifestCache && (now - manifestCache.timestamp) < CACHE_TTL) {
    return manifestCache.data;
  }

  try {
    const manifestUrl = `${env.GITHUB_PAGES_ORIGIN}/posts-manifest.json`;
    const response = await fetch(manifestUrl, {
      headers: { 'User-Agent': 'SEO-Gateway/1.0' },
    });

    if (!response.ok) return null;

    const data = await response.json() as Manifest;
    manifestCache = { data, timestamp: now };
    return data;
  } catch {
    return null;
  }
}

function findPostInManifest(manifest: Manifest, year: string, slug: string): ManifestItem | null {
  if (!manifest.items) return null;
  return manifest.items.find(
    item => item.year === year && item.slug === slug && item.published !== false
  ) || null;
}

function buildOgImageUrl(env: Env, title: string, subtitle?: string): string {
  const params = new URLSearchParams({ title, format: 'png' });
  if (subtitle) params.set('subtitle', subtitle);
  return `${env.API_BASE_URL}/api/v1/og?${params.toString()}`;
}

export async function resolvePostMeta(url: URL, env: Env): Promise<PostMeta> {
  const pathname = url.pathname;

  const blogPostMatch = pathname.match(/^\/blog\/(\d{4})\/([^/]+)\/?$/);
  if (blogPostMatch) {
    const [, year, slug] = blogPostMatch;
    const manifest = await fetchManifest(env);

    if (manifest) {
      const post = findPostInManifest(manifest, year, slug);
      if (post) {
        const ogImage = post.coverImage
          ? (post.coverImage.startsWith('http')
              ? post.coverImage
              : `${env.SITE_BASE_URL}${post.coverImage.startsWith('/') ? '' : '/'}${post.coverImage}`)
          : buildOgImageUrl(env, post.title, post.category);

        return {
          title: `${post.title} | ${env.SITE_NAME}`,
          description: post.description || post.snippet || '',
          ogImage,
          url: `${env.SITE_BASE_URL}/blog/${year}/${slug}`,
          type: 'article',
          publishedTime: post.date,
          author: post.author,
          category: post.category,
          tags: post.tags,
        };
      }
    }

    const formattedSlug = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    return {
      title: `${formattedSlug} | ${env.SITE_NAME}`,
      description: '',
      ogImage: buildOgImageUrl(env, formattedSlug),
      url: `${env.SITE_BASE_URL}/blog/${year}/${slug}`,
      type: 'article',
    };
  }

  if (pathname === '/blog' || pathname === '/blog/') {
    return {
      title: `Blog | ${env.SITE_NAME}`,
      description: '기술, 개발, 생각에 대한 글들',
      ogImage: buildOgImageUrl(env, 'Blog', env.SITE_NAME),
      url: `${env.SITE_BASE_URL}/blog`,
      type: 'website',
    };
  }

  if (pathname === '/about' || pathname === '/about/') {
    return {
      title: `About | ${env.SITE_NAME}`,
      description: 'Nodove 소개',
      ogImage: buildOgImageUrl(env, 'About', env.SITE_NAME),
      url: `${env.SITE_BASE_URL}/about`,
      type: 'website',
    };
  }

  if (pathname === '/stack' || pathname === '/stack/') {
    return {
      title: `Tech Stack | ${env.SITE_NAME}`,
      description: '사용하는 기술 스택',
      ogImage: buildOgImageUrl(env, 'Tech Stack', env.SITE_NAME),
      url: `${env.SITE_BASE_URL}/stack`,
      type: 'website',
    };
  }

  return {
    title: env.SITE_NAME,
    description: 'Tech & Programming Blog',
    ogImage: buildOgImageUrl(env, env.SITE_NAME, 'Tech & Programming'),
    url: env.SITE_BASE_URL,
    type: 'website',
  };
}
