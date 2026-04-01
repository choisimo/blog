import {
  ArrowLeft,
  Clock3,
  FileSearch,
  LockKeyhole,
  ServerCrash,
  ShieldAlert,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import { Home, Mail, RefreshCw, Search } from "lucide-react";
import { site } from "@/config/site";
import type { ErrorStatusPageProps } from "./ErrorStatusPage";

type ErrorPagePreset = Omit<ErrorStatusPageProps, "actions" | "footer">;

export const badRequestPage: ErrorPagePreset = {
  statusCode: 400,
  label: "Bad Request",
  title: "요청 형식이 올바르지 않습니다",
  description:
    "필수 값이 빠졌거나 잘못된 주소로 접근했습니다. 새로고침 후 다시 시도하거나 정상 경로로 이동해 주세요.",
  hints: [
    "주소를 직접 입력했다면 오타가 없는지 확인하세요.",
    "폼 제출 직후라면 입력값이 누락되지 않았는지 다시 확인하세요.",
    "반복되면 동일한 작업 흐름을 정리해 전달해 주세요.",
  ],
  icon: TriangleAlert,
  tone: "amber",
};

export const unauthorizedPage: ErrorPagePreset = {
  statusCode: 401,
  label: "Unauthorized",
  title: "인증이 필요합니다",
  description:
    "로그인이 만료되었거나 아직 인증되지 않은 상태입니다. 접근 권한이 필요한 페이지일 수 있습니다.",
  hints: [
    "관리자 기능이라면 인증 흐름을 다시 시작해 주세요.",
    "브라우저 세션이 만료되었을 수 있으니 새로고침 후 재시도하세요.",
    "반복되면 현재 접근 경로와 시점을 함께 공유해 주세요.",
  ],
  icon: LockKeyhole,
  tone: "sky",
};

export const forbiddenPage: ErrorPagePreset = {
  statusCode: 403,
  label: "Forbidden",
  title: "이 페이지에 접근할 수 없습니다",
  description:
    "현재 계정이나 요청 컨텍스트로는 이 리소스를 열 수 없습니다. 권한 범위를 벗어난 요청입니다.",
  hints: [
    "권한이 필요한 내부 페이지일 수 있습니다.",
    "직접 입력한 링크라면 공개 페이지인지 다시 확인하세요.",
    "필요한 접근 권한이 있다면 관리자에게 확인을 요청하세요.",
  ],
  icon: ShieldAlert,
  tone: "violet",
};

export const notFoundPage: ErrorPagePreset = {
  statusCode: 404,
  label: "Not Found",
  title: "페이지를 찾을 수 없습니다",
  description:
    "요청한 주소가 존재하지 않거나, 페이지가 이동되었거나, 더 이상 제공되지 않는 경로입니다.",
  hints: [
    "주소의 연도나 슬러그를 다시 확인해 주세요.",
    "예전 링크를 열었다면 새 경로로 이동되었을 수 있습니다.",
    "블로그 목록에서 다시 탐색하면 더 빠르게 찾을 수 있습니다.",
  ],
  icon: FileSearch,
  tone: "rose",
};

export const tooManyRequestsPage: ErrorPagePreset = {
  statusCode: 429,
  label: "Too Many Requests",
  title: "요청이 너무 빠르게 반복되고 있습니다",
  description:
    "잠시 동안 요청이 제한되었습니다. 잠깐 기다린 뒤 다시 시도하면 대부분 정상적으로 복구됩니다.",
  hints: [
    "짧은 시간에 여러 번 새로고침했다면 잠시 대기해 주세요.",
    "자동화 도구나 반복 요청이 있다면 간격을 늘려 주세요.",
    "제한이 길게 지속되면 네트워크 환경이나 프록시 설정을 점검하세요.",
  ],
  icon: Clock3,
  tone: "emerald",
};

export const serverErrorPage: ErrorPagePreset = {
  statusCode: 500,
  label: "Server Error",
  title: "서버 처리 중 오류가 발생했습니다",
  description:
    "요청은 정상적으로 도착했지만 처리 과정에서 예기치 못한 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  hints: [
    "일시적인 오류일 수 있으니 새로고침 후 다시 시도하세요.",
    "특정 글이나 기능에서만 반복되면 해당 경로를 함께 전달해 주세요.",
    "동일 문제가 계속되면 접속 시각과 동작 순서를 남겨 주세요.",
  ],
  icon: ServerCrash,
  tone: "amber",
};

export const serviceUnavailablePage: ErrorPagePreset = {
  statusCode: 503,
  label: "Service Unavailable",
  title: "서비스가 잠시 불안정합니다",
  description:
    "현재 백엔드 또는 연결된 서비스가 일시적으로 응답하지 못하고 있습니다. 잠시 후 다시 시도해 주세요.",
  hints: [
    "배포 직후이거나 점검 중이면 잠시 후 정상화될 수 있습니다.",
    "새로고침보다 몇 분 뒤 재접속이 더 효과적일 수 있습니다.",
    "장시간 지속되면 운영 상태를 확인해야 합니다.",
  ],
  icon: WifiOff,
  tone: "slate",
};

export const defaultActions = {
  home: {
    label: "홈으로",
    to: "/",
    icon: Home,
  },
  blog: {
    label: "블로그 보기",
    to: "/blog",
    icon: Search,
    variant: "outline" as const,
  },
  retry: {
    label: "새로고침",
    onClick: () => window.location.reload(),
    icon: RefreshCw,
  },
  contact: {
    label: "문의하기",
    href: `mailto:${site.email}`,
    icon: Mail,
    variant: "outline" as const,
  },
  back: {
    label: "이전 페이지",
    onClick: () => window.history.back(),
    icon: ArrowLeft,
    variant: "outline" as const,
  },
};
