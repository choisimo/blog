import assert from 'node:assert/strict';
import test from 'node:test';

import { isCrawler } from '../src/crawler-detect';

test('isCrawler detects common crawler user agents', () => {
  assert.equal(
    isCrawler(
      'Mozilla/5.0 (compatible; Slackbot-LinkExpanding 1.0; +https://api.slack.com/robots)'
    ),
    true
  );
});

test('isCrawler ignores normal browser traffic', () => {
  assert.equal(
    isCrawler(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36'
    ),
    false
  );
});
