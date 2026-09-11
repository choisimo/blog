import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseStructuredResponse as parse,
  isStructuredResponseText as detect,
  hasStructuredResponseText as contains,
} from '@blog/shared/runtime/structured-response';

test('strict JSON, primitive JSON, passthrough, and envelope preservation', () => {
  const value = { data: { items: [{ title: 'Hello' }] } };
  assert.deepEqual(parse(JSON.stringify(value)), value);
  assert.equal(parse(value), value);
  const array = [value];
  assert.equal(parse(array), array);
  assert.deepEqual(parse('[0,1]'), [0, 1]);
  assert.equal(parse('true'), true);
  assert.equal(parse('42'), 42);
  assert.equal(parse('"  hello  "'), '  hello  ');
  for (const input of [undefined, null, false, 42, '', 'ordinary prose']) {
    assert.equal(parse(input), null);
  }
});

test('fences, prose, and string-aware balanced containers', () => {
  const value = { items: [{ title: 'a } bracket [ and "quote" \\', text: '{x}' }] };
  const json = JSON.stringify(value);
  for (const input of [json, `\`\`\`json\n${json}\n\`\`\``,
    `\`\`\`\n${json}\n\`\`\``, `Here is the response:\n${json}\nDone.`,
    `Within [0,1], here is the response: ${json}`]) {
    assert.deepEqual(parse(input), value, input);
  }
  assert.deepEqual(parse('Response: [{"title":"ok"}] Thanks.'), [{ title: 'ok' }]);
  assert.equal(parse('The interval is [0,1].'), null);
  assert.equal(parse('```js\nconst x = {"items": []};\n```'), null);
});

test('double encoded responses and bounded decoding', () => {
  const value = { items: ['one'] };
  let encoded = JSON.stringify(value);
  for (let count = 1; count <= 4; count += 1) {
    assert.deepEqual(parse(encoded), value);
    encoded = JSON.stringify(encoded);
  }
  assert.equal(parse(encoded), null);
  assert.equal(parse(JSON.stringify('{"items":[{"title":"ok"}')), null);
});

test('same-line JSON fences parse and detect without accepting other code languages', () => {
  for (const input of ['```json {"items":[]}```', '```JSON\t{"items":[]}```',
    '``` {"items":[]} ```', '```json{"items":[]}```']) {
    assert.deepEqual(parse(input), { items: [] }, input);
    assert.equal(detect(input), true, input);
    assert.equal(contains({ body: input }), true, input);
  }
  assert.deepEqual(parse('```json [{"title":"complete"}]```'), [{ title: 'complete' }]);
  for (const input of ['```json {"items":[{"title":"complete"}```',
    '```json {"items":']) {
    assert.equal(parse(input), null, input);
    assert.equal(detect(input), true, input);
  }
  assert.deepEqual(parse('```json {"name":"Alice"}```'), { name: 'Alice' });
  assert.equal(detect('```json {"name":"Alice"}```'), false);
  for (const input of ['```javascript {"items":[]}```', '```json5 {"items":[]}```']) {
    assert.equal(parse(input), null, input);
    assert.equal(detect(input), false, input);
  }
});

test('detects split thought-card punctuation titles without rejecting ordinary commas', () => {
  const card = { title: '{', body: '"items": [ {"title":"captured"}' };
  assert.equal(detect(card.title), true);
  assert.equal(detect(card.body), true);
  assert.equal(contains(card), true);
  assert.equal(contains({ title: card.title, body: 'ordinary body' }), true);
  for (const input of ['{', '}', '[', ']', ' \n{ [ , ] }\t', ', } ,']) {
    assert.equal(detect(input), true, input);
  }
  for (const input of ['', ' \n\t', ',', ' , , ', '[0,1]', '{name}',
    'Use { and } here.', 'Hello, world', '{"name":"Alice"}']) {
    assert.equal(detect(input), false, input);
  }
});

test('repairs control characters and trailing commas without changing string contents', () => {
  const controls = Array.from({ length: 32 }, (_, index) => String.fromCharCode(index)).join('');
  assert.deepEqual(parse(`{"text":"${controls}","items":[1,2,],}`), {
    text: controls, items: [1, 2],
  });
  const text = 'literal ,} and ,] and \\n and "quote" and \\\\';
  const valid = JSON.stringify({ text });
  assert.deepEqual(parse(valid), { text });
  assert.deepEqual(parse(`${valid.slice(0, -1)},}`), { text });
  assert.deepEqual(parse('{"text":"line one\nline two\tend",}'), { text: 'line one\nline two\tend' });
});

test('never salvages nested items from truncated or invalid outer JSON', () => {
  for (const input of ['{"items":[{"title":"complete"}',
    '{"items":[{"title":"complete"}],"text":"cut',
    '[{"title":"complete"}', 'Response: {"items":[{"title":"complete"}',
    '```json\n{"items":[{"title":"complete"}\n```']) {
    assert.equal(parse(input), null, input);
  }
  for (const input of ['{"items":[}', '{items: []}', '{"items":undefined}',
    '{"items":[1,,]}', '{"items": /* comment */ []}', '{"items":NaN}']) {
    assert.equal(parse(input), null, input);
  }
});

test('explanatory prefixes expose malformed wire text without salvaging children', () => {
  for (const body of ['{"items":', '{"items":[{"title":"complete"}',
    '{"cards":[{"text":"raw\nnewline"}', '[{"questions":']) {
    for (const prefix of ['Here is the JSON:\n', 'Response: ', 'Here is your response\n',
      'Here is the response ', 'Here is the JSON ']) {
      const text = prefix + body;
      assert.equal(detect(text), true, text);
      assert.equal(contains({ tasks: [{ answer: text }] }), true, text);
      assert.equal(parse(text), null, text);
    }
  }
  assert.equal(detect('Here is the JSON:\n{"name":"Alice"}'), false);
  assert.equal(detect('const response =\n{"items": []}'), false);
  assert.equal(detect('Example:\n```js\nconst x = {"items": []};\n```'), false);
  const captured = 'Here is the response {"items":[{"title":"cut';
  assert.equal(detect(captured), true);
  assert.equal(contains({ title: 'Cached card', body: captured }), true);
  assert.equal(parse(captured), null);
});

test('detects known schema prefixes including malformed newlines and truncation', () => {
  for (const key of ['items', 'cards', 'facets', 'questions', 'quiz', 'mood', 'bullets',
    'summary', 'keyPoints', 'title', 'personaId', 'angleKey', 'trackKey', 'data',
    'result', 'output', 'payload', '_raw', 'text']) {
    for (const text of [`{"${key}":`, `{\n"${key}":"broken\ntext`,
      `{"${key}"`, `"${key}": []`, `[{"${key}":`]) {
      assert.equal(detect(text), true, text);
    }
  }
  for (const text of ['```json\n{"items":', '```\n{"cards": []}\n```',
    '["first", "second"', JSON.stringify('{"items":[]}'),
    '{"unknown":0,"items":[]}']) assert.equal(detect(text), true, text);
});

test('complete empty containers and string arrays remain valid quiz literals', () => {
  for (const literal of ['[]', '{}', '[ ]', '{\n}', '["a"]', '["first", "second"]',
    '["items", "title", "{", "]"]']) {
    for (const input of [literal, `\`\`\`json ${literal}\`\`\``, JSON.stringify(literal)]) {
      assert.equal(detect(input), false, input);
      assert.equal(contains({ answer: input }), false, input);
      assert.deepEqual(parse(input), JSON.parse(literal), input);
    }
  }
  for (const input of ['{', '[', '["a"', '["a",]', '[{"items":[]}]',
    '[{"data":{"facets":[]}}]', 'Here is the response {"items":[{"title":"cut']) {
    assert.equal(detect(input), true, input);
  }
});

test('preserves legitimate quiz answers, prose, intervals, and unrelated code', () => {
  for (const value of [null, undefined, {}, [], 1, 'true', '42', 'null',
    '[0,1]', 'The probability lies in [0,1].', 'items: a list of things',
    '{"name":"Alice"}', '[{"name":"Alice"}]', '{"value":"items"}',
    '{"name":"\\"title\\": sample"}', '{"name":"Alice","example":"title"}',
    'Use {"name":"Alice"} as the example.', 'const x = {"items": []};',
    '```javascript\nconst x = {"items": []};\n```', '```json\n{"name":"Alice"}\n```',
    'function items() { return []; }', 'array["title"]', 'Summary: ordinary prose']) {
    assert.equal(detect(value), false, String(value));
  }
});

test('generic keys in valid JSON examples do not classify as response schemas', () => {
  for (const key of ['title', 'data', 'text', 'result', 'output', 'payload', '_raw']) {
    const json = JSON.stringify({ [key]: 'Book' });
    for (const input of [json, `[${json}]`, `\`\`\`json ${json}\`\`\``,
      JSON.stringify(json), `Use this API: ${json}`, `Here is the JSON:\n${json}`]) {
      assert.equal(detect(input), false, input);
      assert.equal(contains({ answer: input }), false, input);
    }
    for (const input of [`{"${key}":`, `{"${key}":"broken\ntext"}`,
      `{"${key}":"Book",}`, `Here is the JSON:\n{"${key}":`]) {
      assert.equal(detect(input), true, input);
    }
  }
  assert.equal(detect('{"title":"Book"}'), false);
  assert.equal(detect('Use this API: {"data": "ok"}'), false);
  assert.equal(detect('Use this API: {"items": []}'), false);
  assert.equal(detect('Example:\n{"facets": []}'), false);
  assert.equal(detect('{"data":{"facets":[]}}'), true);
  assert.equal(detect('{"data":{"facets":'), true);
  assert.equal(detect('Here is the JSON:\n{"data":{"facets":[]}}'), true);
  assert.equal(detect('Response: {"items":[]}'), true);
  assert.equal(detect('{"data":"facets"}'), false);
  assert.equal(detect('{"name":"facets"'), false);
});

test('recursively inspects leaves, handles cycles, and skips getters', () => {
  const safe = { items: [{ title: 'Ordinary title', answer: '{"name":"Alice"}' }] };
  safe.self = safe;
  assert.equal(contains(safe), false);
  safe.items.push({ nested: [{ answer: '```json\n{"cards":' }] });
  assert.equal(contains(safe), true);
  assert.equal(contains('{"items":'), true);
  const accessor = Object.defineProperty({}, 'text', {
    enumerable: true, get() { throw new Error('Getter must not execute'); },
  });
  assert.equal(contains(accessor), false);
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  assert.equal(contains(proxy), false);
});

test('input, depth, and traversal budgets are bounded', () => {
  assert.equal(parse(`{"text":"${'x'.repeat(1_048_576)}"}`), null);
  assert.deepEqual(parse('['.repeat(64) + '0' + ']'.repeat(64)),
    JSON.parse('['.repeat(64) + '0' + ']'.repeat(64)));
  assert.equal(parse('['.repeat(65) + '0' + ']'.repeat(65)), null);
  let nested = '{"items":';
  for (let depth = 0; depth < 65; depth += 1) nested = { nested };
  assert.equal(contains(nested), false);
  assert.equal(contains(Array(5000).fill('ordinary prose')), false);
  assert.equal(contains(['x'.repeat(1_048_576)]), false);
});
