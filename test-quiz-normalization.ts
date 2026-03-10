import fs from 'fs';

// minimal mock of what is in ai.ts
function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object';
}

function toNormalizedText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

const QUIZ_TYPES = ['fill_blank', 'multiple_choice', 'transform', 'explain'];
function normalizeQuizType(value: unknown): string {
  if (typeof value !== 'string') return 'explain';
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'fillblank') return 'fill_blank';
  if (normalized === 'multiplechoice') return 'multiple_choice';
  if (normalized === 'code_transform') return 'transform';
  if (QUIZ_TYPES.includes(normalized)) {
    return normalized;
  }
  return 'explain';
}

function tryParseJson<T = unknown>(text: string): T | null { return null; }

function extractQuizItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const parsed = tryParseJson(raw);
    return parsed ? extractQuizItems(parsed) : [];
  }
  if (!isRecord(raw)) return [];
  if (Array.isArray(raw.quiz)) return raw.quiz;
  if (Array.isArray(raw.questions)) return raw.questions;
  if (Array.isArray(raw.items)) return raw.items;
  if ('data' in raw) return extractQuizItems(raw.data);
  if ('result' in raw) return extractQuizItems(raw.result);
  if ('_raw' in raw) {
    const rawData = raw._raw;
    if (typeof rawData === 'string') return extractQuizItems(rawData);
    if (isRecord(rawData) && typeof rawData.text === 'string') {
      return extractQuizItems(rawData.text);
    }
  }
  if (Array.isArray(raw.problems)) {
    return (raw.problems as unknown[]).map(p => {
      if (!isRecord(p)) return p;
      return {
        type: 'explain',
        question: p.description ?? p.title ?? p.problem ?? `문제 ${p.number ?? ''}`.trim(),
        answer: p.python_function ?? p.java_method ?? p.solution ?? p.answer ?? '위 내용을 참고하세요.',
        explanation: p.example_input != null
          ? `예시 입력: ${p.example_input} → 출력: ${p.example_output ?? '?'}`
          : undefined,
      };
    });
  }
  return [];
}

function normalizeQuizQuestion(raw: unknown): any | null {
  if (!isRecord(raw)) return null;

  const question = toNormalizedText(raw.question ?? raw.q ?? raw.prompt ?? raw.title);
  const answer = toNormalizedText(raw.answer ?? raw.correctAnswer ?? raw.correct ?? raw.solution ?? raw.a);

  if (!question || !answer) return null;

  const optionsSource =
    (Array.isArray(raw.options) ? raw.options : undefined) ??
    (Array.isArray(raw.choices) ? raw.choices : undefined) ??
    (Array.isArray(raw.candidates) ? raw.candidates : undefined);

  const options = Array.isArray(optionsSource)
    ? optionsSource.map(toNormalizedText).filter(Boolean).slice(0, 6)
    : [];

  const explanation = toNormalizedText(raw.explanation ?? raw.reason ?? raw.why ?? raw.hint);
  const type = normalizeQuizType(raw.type ?? (options.length > 0 ? 'multiple_choice' : 'explain'));

  const normalized: any = {
    type,
    question,
    answer,
  };

  if (options.length > 0) normalized.options = options;
  if (explanation) normalized.explanation = explanation;

  return normalized;
}

function normalizeQuizResult(raw: unknown): any | null {
  const items = extractQuizItems(raw);
  if (items.length === 0) return null;

  const quiz = items
    .map(normalizeQuizQuestion)
    .filter((item) => item !== null)
    .slice(0, 2);

  if (quiz.length === 0) return null;

  return { quiz };
}

const payload = {"title":"비트 조작 (Bit Manipulation) 문제와 구현","part":"Advanced Topics","algorithms":["XOR","AND","OR"],"architect_view":"공간 효율적 상태 표현","summary":"비트 연산을 활용한 네 가지 문제(배열에서 하나만 존재하는 수 찾기, 2의 거듭제곱 판별, 비트 뒤집기, 해밍 거리 계산)에 대해 Python과 Java로 구현 방법을 소개합니다. XOR, AND 연산의 원리와 실무 적용 예시(해시, 암호화, 플래그, 네트워크 마스킹)도 설명합니다.","time_complexity":"O(n) / O(1)","space_complexity":"O(1)","problems":[{"number":1,"description":"배열에서 하나만 존재하는 수 찾기 (XOR)","python_function":"def single_number(nums: List[int]) -> int\n    \"\"\"XOR: 하나만 존재하는 수\"\"\"\n    result = 0\n    for n in nums:\n        result ^= n\n    return result","java_method":"public static int singleNumber(int[] nums)","example_input":"[2,2,1]","example_output":"1"}],"python_code":"...","java_code":"...","practical_applications":["해시 함수","암호화","플래그 관리","네트워크 서브넷 마스킹"],"note":"이 포스트는 알고리즘 학습을 위해 작성된 문서입니다."};
console.log(JSON.stringify(normalizeQuizResult(payload), null, 2));

const responseWithData = { ok: true, data: { data: payload, mode: 'custom', source: 'backend' } };
console.log(JSON.stringify(normalizeQuizResult(responseWithData), null, 2));

