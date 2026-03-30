import type { ComponentType } from "react";
import {
  GraduationCap,
  Swords,
  Compass,
  BarChart3,
  Sparkles,
} from "lucide-react";

export type DebateEntryMode = "default" | "prism" | "chain";

export type DebateEntryTopic = {
  title: string;
  facets?: Array<{
    title: string;
    points: string[];
  }>;
  entryMode?: DebateEntryMode;
};

export type DebateIntentOption = {
  id: string;
  label: string;
  sublabel: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  personaId: string;
  stance: "agree" | "disagree" | "neutral";
  starterText: string;
};

export const DEFAULT_INTENT_OPTIONS: DebateIntentOption[] = [
  {
    id: "understand",
    label: "더 잘 이해하고 싶어요",
    sublabel: "핵심을 쉽게 풀어줘요",
    icon: GraduationCap,
    color: "from-amber-500 to-orange-500",
    personaId: "mentor",
    stance: "neutral",
    starterText:
      "이 내용을 더 쉽게 이해하고 싶어요. 핵심을 정리해주실 수 있나요?",
  },
  {
    id: "explore",
    label: "다른 관점을 알고 싶어요",
    sublabel: "새로운 시각으로 살펴봐요",
    icon: Compass,
    color: "from-blue-500 to-cyan-500",
    personaId: "explorer",
    stance: "neutral",
    starterText: "이 주제를 다양한 관점에서 바라보면 어떨까요?",
  },
  {
    id: "challenge",
    label: "비판적으로 살펴볼게요",
    sublabel: "논리의 허점을 찾아봐요",
    icon: Swords,
    color: "from-red-500 to-pink-500",
    personaId: "debater",
    stance: "disagree",
    starterText:
      "이 내용에 대해 비판적으로 생각해보고 싶어요. 반박 논리를 알려주실 수 있나요?",
  },
  {
    id: "analyze",
    label: "체계적으로 분석해볼게요",
    sublabel: "데이터와 논리로 파헤쳐요",
    icon: BarChart3,
    color: "from-emerald-500 to-teal-500",
    personaId: "analyst",
    stance: "agree",
    starterText:
      "이 주제를 체계적으로 분석해볼게요. 구조화된 관점을 알려주세요.",
  },
];

export function getDebateEntryMode(topic: DebateEntryTopic): DebateEntryMode {
  if (topic.entryMode === "prism" || topic.entryMode === "chain") {
    return topic.entryMode;
  }
  return "default";
}

export function getModeIntentOptions(
  topic: DebateEntryTopic,
): DebateIntentOption[] {
  const entryMode = getDebateEntryMode(topic);

  if (entryMode === "prism") {
    return [
      {
        id: "prism-compare",
        label: "관점을 비교해볼래요",
        sublabel: "어떤 시각이 더 설득력 있는지 정리",
        icon: Compass,
        color: "from-blue-500 to-cyan-500",
        personaId: "explorer",
        stance: "neutral",
        starterText:
          "방금 나온 여러 관점을 비교하면서 차이와 연결점을 같이 정리해줘.",
      },
      {
        id: "prism-challenge",
        label: "가장 약한 전제를 짚어주세요",
        sublabel: "반론 포인트와 허점을 먼저 확인",
        icon: Swords,
        color: "from-red-500 to-pink-500",
        personaId: "debater",
        stance: "disagree",
        starterText:
          "이 관점들 중에서 가장 취약한 전제와 반론 포인트를 먼저 짚어줘.",
      },
      {
        id: "prism-apply",
        label: "내 상황에 맞게 좁혀볼래요",
        sublabel: "관점을 선택으로 바꾸기",
        icon: GraduationCap,
        color: "from-amber-500 to-orange-500",
        personaId: "mentor",
        stance: "agree",
        starterText:
          "이 관점들을 내 상황에 적용하면 어떤 선택지로 이어질지 같이 정리해줘.",
      },
      {
        id: "prism-analyze",
        label: "구조적으로 정리해줘요",
        sublabel: "장단점과 판단 기준을 분해",
        icon: BarChart3,
        color: "from-emerald-500 to-teal-500",
        personaId: "analyst",
        stance: "neutral",
        starterText: "관점별 장단점과 판단 기준을 구조적으로 정리해줘.",
      },
    ];
  }

  if (entryMode === "chain") {
    return [
      {
        id: "chain-follow",
        label: "이 질문부터 이어갈래요",
        sublabel: "지금 걸린 지점에서 바로 시작",
        icon: Sparkles,
        color: "from-emerald-500 to-lime-500",
        personaId: "mentor",
        stance: "neutral",
        starterText: `이 질문을 출발점으로 한 단계씩 생각을 이어가고 싶어요: ${topic.title}`,
      },
      {
        id: "chain-assumption",
        label: "전제부터 확인해줘요",
        sublabel: "숨은 가정과 놓친 조건 찾기",
        icon: Swords,
        color: "from-red-500 to-rose-500",
        personaId: "debater",
        stance: "disagree",
        starterText:
          "이 질문 뒤에 숨어 있는 전제나 놓친 조건이 있다면 먼저 짚어줘.",
      },
      {
        id: "chain-next",
        label: "다음 질문을 열어볼래요",
        sublabel: "여기서 어디까지 더 파고들지 설계",
        icon: Compass,
        color: "from-blue-500 to-cyan-500",
        personaId: "explorer",
        stance: "neutral",
        starterText:
          "이 질문 다음에 이어서 던지면 좋은 질문 흐름을 같이 만들어줘.",
      },
      {
        id: "chain-decision",
        label: "실제 선택지로 바꿔줘요",
        sublabel: "생각을 행동 단위로 압축",
        icon: BarChart3,
        color: "from-emerald-500 to-teal-500",
        personaId: "analyst",
        stance: "agree",
        starterText: "이 고민을 실제 선택지와 판단 기준으로 바꿔서 정리해줘.",
      },
    ];
  }

  return DEFAULT_INTENT_OPTIONS;
}

export function getModeIntro(topic: DebateEntryTopic) {
  const entryMode = getDebateEntryMode(topic);

  if (entryMode === "prism") {
    return {
      stepLabel: "관점",
      eyebrow: "다각도 분석에서 이어집니다",
      title: "어떤 방향으로 관점을 더 밀어볼까요?",
      description:
        topic.facets && topic.facets.length > 0
          ? `${topic.facets.length}개의 관점을 바탕으로 비교, 반론, 적용 중 한 방향을 고를 수 있어요.`
          : "방금 펼친 관점들을 비교하거나 반박하거나 내 상황에 맞게 좁혀볼 수 있어요.",
    };
  }

  if (entryMode === "chain") {
    return {
      stepLabel: "질문",
      eyebrow: "더 생각해보기에서 이어집니다",
      title: "이 질문을 어떤 흐름으로 이어갈까요?",
      description:
        "지금 질문을 출발점으로 전제 확인, 다음 질문 설계, 실제 선택지 정리 중 하나로 바로 들어갈 수 있어요.",
    };
  }

  return {
    stepLabel: "의도",
    eyebrow: "상담 방향을 고릅니다",
    title: "무엇이 궁금하신가요?",
    description: "원하는 대화 방향을 골라주세요.",
  };
}
