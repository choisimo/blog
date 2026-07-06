import { BlogPost } from "@/types/blog";
import { getApiBaseUrl } from "@/utils/network/apiBase";

export interface SEOData {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

export type SEOPageType =
  | "home"
  | "blog"
  | "post"
  | "projects"
  | "about"
  | "contact";

export interface GenerateSEOOptions {
  category?: string | null;
  ogImageOverride?: string;
}

export type SEOResolvedPost = Pick<
  BlogPost,
  "year" | "slug" | "date" | "author" | "category" | "tags"
> & {
  title: string;
  description: string;
};

const SITE_BASE_URL_FALLBACK = "https://noblog.nodove.com";
const SEO_URL_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const SEO_PATH_SEGMENT_UNSAFE_PATTERN = /[\u0000-\u001F\u007F/\\]/;

function normalizeSiteBaseUrl(value: unknown): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || SEO_URL_CONTROL_PATTERN.test(candidate)) {
    return SITE_BASE_URL_FALLBACK;
  }

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return SITE_BASE_URL_FALLBACK;
    }
    return url.href.replace(/\/$/, "");
  } catch {
    return SITE_BASE_URL_FALLBACK;
  }
}

function normalizeSeoPathSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || SEO_PATH_SEGMENT_UNSAFE_PATTERN.test(trimmed)) return null;

  try {
    const decoded = decodeURIComponent(trimmed);
    if (!decoded || SEO_PATH_SEGMENT_UNSAFE_PATTERN.test(decoded)) return null;
    return encodeURIComponent(decoded);
  } catch {
    return null;
  }
}

function buildPostCanonicalUrl(baseUrl: string, post: SEOResolvedPost): string {
  const year = normalizeSeoPathSegment(post.year);
  const slug = normalizeSeoPathSegment(post.slug);
  return year && slug ? `${baseUrl}/blog/${year}/${slug}` : `${baseUrl}/blog`;
}

const slugifyCategory = (value: string): string =>
  value
    .trim()
    .replace(/[&/]+/g, " and ")
    .toLowerCase()
    .replace(/[^0-9a-z\uac00-\ud7a3]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeCategory = (category?: string | null): string | undefined => {
  if (!category) return undefined;
  const trimmed = category.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") return undefined;
  return trimmed;
};

const buildCategoryImagePath = (
  basePath: string,
  category?: string,
): string => {
  if (!category) return `${basePath}/default/seo.png`;
  const slug = slugifyCategory(category);
  return slug ? `${basePath}/${slug}/seo.png` : `${basePath}/default/seo.png`;
};

function getOptionalApiBaseUrl(): string | null {
  try {
    return getApiBaseUrl().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export const generateSEOData = (
  post?: SEOResolvedPost,
  pageType: SEOPageType = "home",
  options: GenerateSEOOptions = {},
): SEOData => {
  const baseUrl = normalizeSiteBaseUrl(import.meta.env.VITE_SITE_BASE_URL);
  const siteName = import.meta.env.VITE_SITE_NAME || "nodove-blog";
  const seoImageBase = `${baseUrl}/images/seo`;
  const defaultOgImage = `${seoImageBase}/default/seo.png`;
  const category = normalizeCategory(options.category);
  const categoryOgImage = options.ogImageOverride
    ? options.ogImageOverride
    : category
      ? buildCategoryImagePath(seoImageBase, category)
      : defaultOgImage;

  switch (pageType) {
    case "post": {
      if (!post) throw new Error("Post data required for post page");
      const apiBase = getOptionalApiBaseUrl();
      return {
        title: `${post.title} | ${siteName}`,
        description: post.description,
        keywords: [...post.tags, post.category],
        canonicalUrl: buildPostCanonicalUrl(baseUrl, post),
        ogImage: apiBase
          ? `${apiBase}/api/v1/og?title=${encodeURIComponent(post.title)}`
          : defaultOgImage,
        ogType: "article",
        publishedTime: post.date,
        modifiedTime: post.date,
        author: post.author,
        section: post.category,
        tags: post.tags,
      };
    }

    case "blog":
      return {
        title: `${category ? `${category} Posts` : "Blog"} | ${siteName}`,
        description: category
          ? `Latest blog posts and curated resources about ${category}.`
          : "Latest blog posts about technology, programming, and web development",
        keywords: [
          "blog",
          "technology",
          "programming",
          "web development",
          ...(category ? [category] : []),
        ],
        canonicalUrl: category
          ? `${baseUrl}/blog?category=${encodeURIComponent(category)}`
          : `${baseUrl}/blog`,
        ogImage: categoryOgImage,
        ogType: "website",
      };

    case "about":
      return {
        title: `About | ${siteName}`,
        description:
          "Developer identity, tech stack, and integrated contact form",
        keywords: ["about", "developer", "contact", "tech stack"],
        canonicalUrl: `${baseUrl}/about`,
        ogImage: categoryOgImage,
        ogType: "website",
      };

    case "projects":
      return {
        title: `Projects | ${siteName}`,
        description:
          "Project hub with featured AI console, previews, and source links",
        keywords: ["projects", "ai", "infra", "web", "portfolio"],
        canonicalUrl: `${baseUrl}/projects`,
        ogImage: categoryOgImage,
        ogType: "website",
      };

    case "contact":
      return {
        title: `Contact | ${siteName}`,
        description: "Get in touch with the blog author",
        keywords: ["contact", "email", "reach out"],
        canonicalUrl: `${baseUrl}/contact`,
        ogImage: categoryOgImage,
        ogType: "website",
      };

    default:
      return {
        title: siteName,
        description:
          "A blog about technology, programming, and web development",
        keywords: [
          "blog",
          "technology",
          "programming",
          "web development",
          "tutorials",
        ],
        canonicalUrl: baseUrl,
        ogImage: categoryOgImage,
        ogType: "website",
      };
  }
};

export const generateStructuredData = (
  post?: SEOResolvedPost,
  pageType: string = "home",
) => {
  const baseUrl = normalizeSiteBaseUrl(import.meta.env.VITE_SITE_BASE_URL);
  const siteName = import.meta.env.VITE_SITE_NAME || "nodove-blog";
  const authorName = import.meta.env.VITE_AUTHOR_NAME || "nodove";
  const defaultOgImage = `${baseUrl}/images/seo/default/seo.png`;

  if (pageType === "post" && post) {
    const apiBase = getOptionalApiBaseUrl();
    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      image: apiBase
        ? `${apiBase}/api/v1/og?title=${encodeURIComponent(post.title)}`
        : defaultOgImage,
      author: {
        "@type": "Person",
        name: authorName,
      },
      publisher: {
        "@type": "Organization",
        name: siteName,
        logo: {
          "@type": "ImageObject",
          url: `${baseUrl}/nodove.ico`,
        },
      },
      datePublished: post.date,
      dateModified: post.date,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": buildPostCanonicalUrl(baseUrl, post),
      },
      keywords: post.tags.join(", "),
      articleSection: post.category,
    };
  }

  if (pageType === "blog") {
    return {
      "@context": "https://schema.org",
      "@type": "Blog",
      name: `${siteName} Blog`,
      description: "A blog about technology, programming, and web development",
      url: `${baseUrl}/blog`,
      author: {
        "@type": "Person",
        name: authorName,
      },
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    description: "A blog about technology, programming, and web development",
    url: baseUrl,
    author: {
      "@type": "Person",
      name: authorName,
    },
  };
};
