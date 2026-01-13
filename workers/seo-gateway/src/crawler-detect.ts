const CRAWLER_PATTERNS = [
  'facebookexternalhit',
  'facebot',
  'twitterbot',
  'linkedinbot',
  'kakaotalk-scrap',
  'kakaotalk',
  'slackbot',
  'discordbot',
  'telegrambot',
  'whatsapp',
  'line/',
  'googlebot',
  'bingbot',
  'baiduspider',
  'yandexbot',
  'duckduckbot',
  'naverbot',
  'embedly',
  'quora link preview',
  'slack-imgproxy',
  'vkshare',
  'w3c_validator',
  'iframely',
  'outbrain',
  'pinterest',
  'redditbot',
  'rogerbot',
  'showyoubot',
  'tumblr',
];

export function isCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some(pattern => ua.includes(pattern));
}
