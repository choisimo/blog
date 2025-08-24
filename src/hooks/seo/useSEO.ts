import { useEffect } from 'react';
import { SEOData } from '@/utils/seo/seo';

export const useSEO = (seoData: SEOData) => {
  useEffect(() => {
    // Update document title
    document.title = seoData.title;

    // Helper function to update or create meta tags
    const updateMetaTag = (
      name: string,
      content: string,
      property?: boolean
    ) => {
      const attribute = property ? 'property' : 'name';
      let element = document.querySelector(
        `meta[${attribute}="${name}"]`
      ) as HTMLMetaElement;

      if (element) {
        element.content = content;
      } else {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        element.content = content;
        document.head.appendChild(element);
      }
    };

    // Update meta description
    updateMetaTag('description', seoData.description);

    // Update keywords
    if (seoData.keywords.length > 0) {
      updateMetaTag('keywords', seoData.keywords.join(', '));
    }

    // Update canonical URL
    if (seoData.canonicalUrl) {
      let canonical = document.querySelector(
        'link[rel="canonical"]'
      ) as HTMLLinkElement;
      if (canonical) {
        canonical.href = seoData.canonicalUrl;
      } else {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        canonical.href = seoData.canonicalUrl;
        document.head.appendChild(canonical);
      }
    }

    // Update Open Graph tags
    updateMetaTag('og:title', seoData.title, true);
    updateMetaTag('og:description', seoData.description, true);

    if (seoData.ogImage) {
      updateMetaTag('og:image', seoData.ogImage, true);
    }

    if (seoData.ogType) {
      updateMetaTag('og:type', seoData.ogType, true);
    }

    if (seoData.canonicalUrl) {
      updateMetaTag('og:url', seoData.canonicalUrl, true);
    }

    // Update Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', seoData.title);
    updateMetaTag('twitter:description', seoData.description);

    if (seoData.ogImage) {
      updateMetaTag('twitter:image', seoData.ogImage);
    }

    // Update article-specific tags
    if (seoData.publishedTime) {
      updateMetaTag('article:published_time', seoData.publishedTime, true);
    }

    if (seoData.modifiedTime) {
      updateMetaTag('article:modified_time', seoData.modifiedTime, true);
    }

    if (seoData.author) {
      updateMetaTag('article:author', seoData.author, true);
    }

    if (seoData.section) {
      updateMetaTag('article:section', seoData.section, true);
    }

    if (seoData.tags) {
      seoData.tags.forEach(tag => {
        const tagElement = document.createElement('meta');
        tagElement.setAttribute('property', 'article:tag');
        tagElement.content = tag;
        document.head.appendChild(tagElement);
      });
    }
  }, [seoData]);
};
