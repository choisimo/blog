export const site = {
  author: 'Nodove',
  email: 'nodove@nodove.com',
  social: {
    github: 'https://github.com/choisimo',
    twitter: 'https://twitter.com',
    linkedin: 'https://linkedin.com',
  },
  // Optional: editor's picks list (year/slug)
  featured: [] as Array<{ year: string; slug: string }>,
};

export type SiteConfig = typeof site;
