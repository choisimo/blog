/**
 * Quiz Service — quiz generation, normalization, task prompt building, and fallback logic.
 *
 * Extracted from routes/chat.js to keep route handlers thin.
 */

import { tryParseJson } from "../lib/ai-service.js";
import {
  AI_TEMPERATURES,
  TEXT_LIMITS,
  VALID_TASK_MODES,
  FALLBACK_DATA,
} from "../config/constants.js";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function extractMeaningfulLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "---")
    .filter((line) => !/^```/.test(line));
}

export function sentencePoints(text, max = 4) {
  const candidates = String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);

  if (candidates.length > 0) return candidates;

  return extractMeaningfulLines(text)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

export function toText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}

// ---------------------------------------------------------------------------
// Quiz normalizers
// ---------------------------------------------------------------------------

export function clampQuizCount(value, fallback = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(6, Math.floor(value)));
}

export function normalizeQuizTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
    .filter(Boolean)
    .slice(0, 24);
}

export function hasStudyTagTrigger(tags) {
  const triggers = [
    "study",
    "학습",
    "algorithm",
    "알고리즘",
    "problem-solving",
    "problem_solving",
    "coding-test",
    "코딩테스트",
    "data-structure",
    "자료구조",
  ];
  return tags.some((tag) => triggers.some((trigger) => tag.includes(trigger)));
}

export function normalizeQuizType(value) {
  if (typeof value !== "string") return "explain";
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (normalized === "fillblank") return "fill_blank";
  if (normalized === "multiplechoice") return "multiple_choice";
  if (normalized === "code_transform") return "transform";
  if (normalized === "systemmodeling") return "system_modeling";
  if (normalized === "tradeoffanalysis") return "tradeoff_analysis";
  if (normalized === "refactoringproblem") return "refactoring_problem";
  if (normalized === "conceptconnection") return "concept_connection";
  if (
    [
      "fill_blank",
      "multiple_choice",
      "transform",
      "explain",
      "system_modeling",
      "tradeoff_analysis",
      "refactoring_problem",
      "concept_connection",
    ].includes(normalized)
  ) {
    return normalized;
  }
  return "explain";
}

function parseExplicitCorrectOptionIndex(value, optionCount) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const candidate = Math.floor(value);
  if (candidate >= 0 && candidate < optionCount) return candidate;
  if (candidate >= 1 && candidate <= optionCount) return candidate - 1;
  return null;
}

function inferCorrectOptionIndex(answer, options) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const normalizedAnswer = String(answer || "")
    .trim()
    .toLowerCase();
  if (!normalizedAnswer) return null;

  const exactIndex = options.findIndex(
    (option) => String(option).trim().toLowerCase() === normalizedAnswer,
  );
  if (exactIndex >= 0) return exactIndex;

  const letterMatch = normalizedAnswer.match(/^([a-z])(?:[\).:\-\s]|$)/i);
  if (letterMatch) {
    const index = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
    return index >= 0 && index < options.length ? index : null;
  }

  const numberMatch = normalizedAnswer.match(/^(\d+)(?:[\).:\-\s]|$)/);
  if (numberMatch) {
    const index = Number.parseInt(numberMatch[1], 10) - 1;
    return index >= 0 && index < options.length ? index : null;
  }

  return null;
}

export function normalizeQuizQuestion(value) {
  if (!value || typeof value !== "object") return null;

  const question = toText(
    value.question ?? value.q ?? value.prompt ?? value.title,
  );
  const answer = toText(
    value.answer ??
      value.correctAnswer ??
      value.correct ??
      value.solution ??
      value.a,
  );
  if (!question || !answer) return null;

  const optionsSource =
    (Array.isArray(value.options) ? value.options : null) ||
    (Array.isArray(value.choices) ? value.choices : null) ||
    (Array.isArray(value.candidates) ? value.candidates : null);

  const options = Array.isArray(optionsSource)
    ? optionsSource.map(toText).filter(Boolean).slice(0, 6)
    : [];

  const explanation = toText(
    value.explanation ?? value.reason ?? value.why ?? value.hint,
  );
  const type = normalizeQuizType(
    value.type ?? (options.length > 0 ? "multiple_choice" : "explain"),
  );
  const correctOptionIndex =
    parseExplicitCorrectOptionIndex(
      value.correctOptionIndex ??
        value.correctIndex ??
        value.answerIndex ??
        value.correct_option_index,
      options.length,
    ) ?? inferCorrectOptionIndex(answer, options);

  const result = {
    type,
    question,
    answer,
  };

  if (options.length > 0) result.options = options;
  if (correctOptionIndex !== null)
    result.correctOptionIndex = correctOptionIndex;
  if (explanation) result.explanation = explanation;

  return result;
}

export function extractQuizItems(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    return parsed ? extractQuizItems(parsed) : [];
  }
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value.quiz)) return value.quiz;
  if (Array.isArray(value.questions)) return value.questions;
  if (Array.isArray(value.items)) return value.items;

  if ("data" in value) return extractQuizItems(value.data);
  if ("result" in value) return extractQuizItems(value.result);
  if ("_raw" in value) {
    const rawData = value._raw;
    if (typeof rawData === "string") return extractQuizItems(rawData);
    if (
      rawData &&
      typeof rawData === "object" &&
      typeof rawData.text === "string"
    ) {
      return extractQuizItems(rawData.text);
    }
  }

  return [];
}

export function normalizeQuizData(value, maxQuestions = 2) {
  const quiz = extractQuizItems(value)
    .map(normalizeQuizQuestion)
    .filter(Boolean)
    .slice(0, Math.max(1, maxQuestions));

  if (!quiz.length) return null;
  return { quiz };
}

export function normalizeTaskData(mode, value, payload = {}) {
  if (mode !== "quiz") return value;
  return normalizeQuizData(value, clampQuizCount(payload.quizCount, 2));
}

// ---------------------------------------------------------------------------
// Project task data from raw text when JSON parse fails
// ---------------------------------------------------------------------------

export function projectTaskDataFromText(mode, text, payload) {
  const rawText = String(text || "").trim();
  if (!rawText) {
    return getFallbackData(mode, payload);
  }

  const lines = extractMeaningfulLines(rawText);
  const cleanedLines = lines
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

  switch (mode) {
    case "sketch": {
      const moodMatch = rawText.match(/(?:mood|톤|감정)\s*[:：]\s*([^\n]+)/i);
      const mood = moodMatch?.[1]?.trim() || FALLBACK_DATA.MOOD || "insightful";
      const bullets = cleanedLines.slice(0, 6);
      return {
        mood,
        bullets: bullets.length > 0 ? bullets : sentencePoints(rawText, 4),
      };
    }

    case "prism": {
      const points = sentencePoints(rawText, 4);
      return {
        facets: [
          {
            title: "AI 분석",
            points:
              points.length > 0 ? points : ["핵심 내용을 추출하지 못했습니다."],
          },
        ],
      };
    }

    case "chain": {
      const questionLines = cleanedLines
        .filter((line) => /\?$|？$/.test(line))
        .slice(0, 6);
      const baseQuestions =
        questionLines.length > 0 ? questionLines : sentencePoints(rawText, 4);

      return {
        questions: baseQuestions.map((q) => ({
          q: q.endsWith("?") || q.endsWith("？") ? q : `${q}?`,
          why: "핵심 논점을 더 깊게 이해하기 위해",
        })),
      };
    }

    case "quiz": {
      const quizCount = clampQuizCount(payload.quizCount, 2);
      const templates = [
        {
          type: "multiple_choice",
          question:
            "이 내용의 핵심 코드 흐름에서 가장 중요한 분기 조건은 무엇인가요?",
          answer: "분기 처리",
          options: ["입력 검증", "분기 처리", "반복 종료", "예외 처리"],
          correctOptionIndex: 1,
          explanation: "AI가 서술형으로 응답해 퀴즈 형식으로 변환했습니다.",
        },
        {
          type: "fill_blank",
          question: "본문 코드의 핵심 로직을 한 줄로 요약하면 ___ 입니다.",
          answer: "입력 처리 후 핵심 연산을 수행하는 흐름",
          explanation:
            "코드의 입력-처리-출력 흐름을 따라가며 빈칸을 채워보세요.",
        },
        {
          type: "explain",
          question: "핵심 함수의 실행 순서를 단계별로 설명해보세요.",
          answer:
            rawText.slice(0, 800) || "입력 정규화 → 핵심 연산 → 결과 반환",
          explanation: "정답 문구보다 단계별 흐름을 설명하는 것이 중요합니다.",
        },
      ];

      const quiz = Array.from({ length: quizCount }, (_, idx) => {
        const base = templates[idx % templates.length];
        if (idx < templates.length) return base;
        return {
          ...base,
          question: `${base.question} (심화 ${idx + 1})`,
        };
      });

      return {
        quiz,
      };
    }

    case "summary":
      return { summary: rawText };

    case "catalyst": {
      const ideas = sentencePoints(rawText, 3);
      return {
        suggestions:
          ideas.length > 0
            ? ideas.map((idea) => ({
                idea,
                reason: "AI 응답에서 추출한 제안입니다.",
              }))
            : [
                {
                  idea: "핵심 쟁점을 다시 정리해보세요.",
                  reason: "논점을 구조화하면 다음 선택이 쉬워집니다.",
                },
              ],
      };
    }

    case "custom":
    default:
      return { text: rawText };
  }
}

// ---------------------------------------------------------------------------
// Task mode validation
// ---------------------------------------------------------------------------

export function isValidTaskMode(mode) {
  return VALID_TASK_MODES.includes(mode);
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildTaskPrompt(mode, payload) {
  const {
    paragraph,
    content,
    postTitle,
    persona,
    prompt,
    batchIndex,
    previousQuestions,
    quizCount,
    studyMode,
    postTags,
  } = payload;
  const text = paragraph || content || prompt || "";
  const title = postTitle || "";
  const quizBatchIndex = Number.isFinite(Number(batchIndex))
    ? Math.max(0, Number(batchIndex))
    : 0;
  const requestedQuizCount = clampQuizCount(quizCount, 2);
  const normalizedPostTags = normalizeQuizTags(postTags);
  const effectiveStudyMode =
    studyMode === true || hasStudyTagTrigger(normalizedPostTags);
  const askedQuestions = Array.isArray(previousQuestions)
    ? previousQuestions
        .filter((q) => typeof q === "string" && q.trim())
        .slice(0, 12)
    : [];

  switch (mode) {
    case "sketch":
      return {
        prompt: [
          "You are a helpful writing companion. Return STRICT JSON only matching the schema.",
          '{"mood":"string","bullets":["string", "string", "..."]}',
          "",
          `Persona: ${persona || FALLBACK_DATA.PERSONA}`,
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          "Paragraph:",
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          "",
          "Task: Capture the emotional sketch. Select a concise mood (e.g., curious, excited, skeptical) and 3-6 short bullets in the original language of the text.",
        ].join("\n"),
        temperature: AI_TEMPERATURES.SKETCH,
      };

    case "prism":
      return {
        prompt: [
          "Return STRICT JSON only for idea facets.",
          '{"facets":[{"title":"string","points":["string","string"]}]}',
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          "Paragraph:",
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          "",
          "Task: Provide 2-3 facets (titles) with 2-4 concise points each, in the original language.",
        ].join("\n"),
        temperature: AI_TEMPERATURES.PRISM,
      };

    case "chain":
      return {
        prompt: [
          "Return STRICT JSON only for tail questions.",
          '{"questions":[{"q":"string","why":"string"}]}',
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          "Paragraph:",
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          "",
          "Task: Generate 3-5 short follow-up questions and a brief why for each, in the original language.",
        ].join("\n"),
        temperature: AI_TEMPERATURES.CHAIN,
      };

    case "summary":
      return {
        prompt: `Summarize the following content in Korean, concise but faithful to key points.\n\n${text}`,
        temperature: AI_TEMPERATURES.SUMMARY,
      };

    case "quiz": {
      const batchStart = quizBatchIndex * requestedQuizCount + 1;
      const batchEnd = batchStart + requestedQuizCount - 1;
      const duplicateGuard = askedQuestions.length
        ? [
            "Do NOT repeat already asked questions:",
            ...askedQuestions.map((q, i) => `${i + 1}. ${q}`),
            "",
          ]
        : [];

      return {
        prompt: [
          "Return STRICT JSON only for technical learning quiz questions.",
          '{"quiz":[{"type":"fill_blank|multiple_choice|transform|explain|system_modeling|tradeoff_analysis|refactoring_problem|concept_connection","question":"string","answer":"string","options":["string"],"correctOptionIndex":0,"explanation":"string"}]}',
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          `Batch: ${quizBatchIndex + 1} (generate questions ${batchStart}-${batchEnd})`,
          normalizedPostTags.length > 0
            ? `Post Tags: ${normalizedPostTags.join(", ")}`
            : "Post Tags: (none)",
          effectiveStudyMode
            ? "Study Mode: ON (increase difficulty diversity and conceptual coverage while staying grounded in code)."
            : "Study Mode: OFF",
          "Paragraph:",
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          "",
          ...duplicateGuard,
          `Task: Generate EXACTLY ${requestedQuizCount} concise quiz questions in the original language.`,
          "Each question must be grounded in concrete code details from the paragraph.",
          "",
          "Question type instructions:",
          "- fill_blank: Replace a key token in a code line with ___ and ask the learner to fill it in.",
          "- multiple_choice: Provide exactly 4 options with exactly one correct answer, set correctOptionIndex as a zero-based index, and make answer exactly match the correct option text.",
          "- transform: Give a code snippet and ask the learner to rewrite or transform it.",
          "- explain: Ask the learner to explain what a code snippet does step-by-step.",
          "- system_modeling: Describe a real-world system design problem. Ask the learner to identify and model the key components, data flow, and interactions. Focus on architectural thinking.",
          "- tradeoff_analysis: Present two different technical approaches to the same problem. Ask the learner to analyze the tradeoffs between them (performance, complexity, maintainability, scalability, etc.).",
          "- refactoring_problem: Show a code snippet with structural issues (not syntax errors). Ask the learner to identify what should be refactored and explain the better approach.",
          "- concept_connection: Give two related technical concepts (wrapped in backticks). Ask the learner to explain how they relate, interact, or differ from each other.",
        ].join("\n"),
        temperature: effectiveStudyMode
          ? Math.min(AI_TEMPERATURES.QUIZ + 0.1, 0.8)
          : AI_TEMPERATURES.QUIZ,
      };
    }

    case "catalyst":
      return {
        prompt: [
          "Return STRICT JSON for catalyst suggestions.",
          '{"suggestions":[{"idea":"string","reason":"string"}]}',
          `Post: ${title.slice(0, TEXT_LIMITS.TASK_TITLE)}`,
          "Content:",
          text.slice(0, TEXT_LIMITS.TASK_PARAGRAPH),
          "",
          "Task: Provide 2-4 creative suggestions or alternative perspectives, in the original language.",
        ].join("\n"),
        temperature: AI_TEMPERATURES.CATALYST,
      };

    case "custom":
    default:
      return {
        prompt: text,
        temperature: AI_TEMPERATURES.CUSTOM,
      };
  }
}

// ---------------------------------------------------------------------------
// Fallback data when AI fails
// ---------------------------------------------------------------------------

export function getFallbackData(mode, payload) {
  const text = payload.paragraph || payload.content || payload.prompt || "";
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  switch (mode) {
    case "sketch":
      return {
        mood: FALLBACK_DATA.MOOD,
        bullets: sentences
          .slice(0, 4)
          .map((s) =>
            s.length > TEXT_LIMITS.BULLET_TEXT
              ? `${s.slice(0, TEXT_LIMITS.BULLET_TEXT - 2)}...`
              : s,
          ),
      };
    case "prism":
      return {
        facets: FALLBACK_DATA.FACETS,
      };
    case "chain":
      return {
        questions: FALLBACK_DATA.QUESTIONS,
      };
    case "summary":
      return {
        summary:
          text.slice(0, FALLBACK_DATA.SUMMARY_LENGTH) +
          (text.length > FALLBACK_DATA.SUMMARY_LENGTH ? "..." : ""),
      };
    case "catalyst":
      return {
        suggestions: [
          { idea: "다른 관점에서 접근", reason: "새로운 시각 제공" },
        ],
      };
    case "quiz": {
      const quizCount = clampQuizCount(payload.quizCount, 2);
      const templates = [
        {
          type: "multiple_choice",
          question:
            "이 내용의 핵심 코드 흐름에서 가장 중요한 분기 조건은 무엇인가요?",
          answer: "분기 처리",
          options: ["입력 검증", "분기 처리", "반복 종료", "예외 처리"],
          correctOptionIndex: 1,
          explanation: "AI 응답이 일시적으로 지연되어 기본 퀴즈가 표시됩니다.",
        },
        {
          type: "fill_blank",
          question: "본문 코드의 핵심 로직을 한 줄로 요약하면 ___ 입니다.",
          answer: "입력 처리 후 핵심 연산을 수행하는 흐름",
          explanation: "코드의 입력-처리-출력 흐름을 다시 정리해보세요.",
        },
        {
          type: "explain",
          question: "핵심 함수의 실행 순서를 단계별로 설명해보세요.",
          answer: "입력 정규화 → 핵심 연산 → 결과 반환",
          explanation:
            "핵심 로직을 단계별로 요약하는 것이 학습에 도움이 됩니다.",
        },
      ];

      const quiz = Array.from({ length: quizCount }, (_, idx) => {
        const base = templates[idx % templates.length];
        if (idx < templates.length) return base;
        return {
          ...base,
          question: `${base.question} (심화 ${idx + 1})`,
        };
      });

      return {
        quiz,
      };
    }
    default:
      return { text: "Unable to process request" };
  }
}
