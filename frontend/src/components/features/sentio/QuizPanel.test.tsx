import "@testing-library/jest-dom/vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuizPanel, normalizeQuizPanelText } from "./QuizPanel";
import type { QuizResult } from "@/services/discovery/ai";

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock("@/components/features/sentio/CodeIDE", () => ({
  default: () => <div data-testid="code-ide" />,
}));

vi.mock("@/components/features/sentio/QuizRichContent", () => ({
  default: ({ content }: { content: string }) => <>{content}</>,
}));

vi.mock("@/services/discovery/ai", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/discovery/ai")
  >("@/services/discovery/ai");
  return {
    ...actual,
    quiz: vi.fn(),
  };
});

import { quiz } from "@/services/discovery/ai";

const codeBlock = "```ts\nconst answer = 42;\n```";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("QuizPanel", () => {
  beforeEach(() => {
    vi.mocked(quiz).mockReset();
  });

  it("accepts letter-based multiple choice answers as correct", async () => {
    vi.mocked(quiz).mockResolvedValue({
      quiz: [
        {
          type: "multiple_choice",
          question: "정답은 무엇인가요?",
          answer: "B",
          options: ["Alpha", "Beta", "Gamma", "Delta"],
          explanation: "정답 라벨이 문자로 와도 인덱스로 비교해야 합니다.",
        },
      ],
    });

    render(<QuizPanel content={codeBlock} postTitle="Old Post" />);

    fireEvent.click(screen.getByTestId("quiz-start"));

    expect(await screen.findByText("정답은 무엇인가요?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /beta/i }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText("정답입니다!")).toBeInTheDocument();
  });

  it("normalizes prompt metadata before requesting quiz generation", async () => {
    vi.mocked(quiz).mockResolvedValue({
      quiz: [
        {
          type: "multiple_choice",
          question: "Sanitized metadata question",
          answer: "A",
          options: ["Clean answer", "Other", "Else", "More"],
        },
      ],
    });

    render(
      <QuizPanel
        content={codeBlock}
        postTitle={"Old\u0000 Post\r\nInjected\u007F"}
        postTags={[" Study\u0000 Mode ", "bad\r\ntag\u007F", ""]}
      />,
    );

    fireEvent.click(screen.getByTestId("quiz-start"));

    expect(await screen.findByText("Sanitized metadata question")).toBeInTheDocument();
    expect(quiz).toHaveBeenCalledWith(
      expect.objectContaining({
        postTitle: "Old Post Injected",
        postTags: ["study mode", "bad tag"],
      }),
    );
  });

  it("strips OSC and CSI ANSI escape sequences from quiz metadata text", () => {
    expect(
      normalizeQuizPanelText(
        "\u001b]0;Hidden title\u0007Visible \u001b[31mquiz\u001b[0m\u0000",
      ),
    ).toBe("Visible quiz");
  });

  it("accepts ANSI-wrapped letter answers as correct", async () => {
    vi.mocked(quiz).mockResolvedValue({
      quiz: [
        {
          type: "multiple_choice",
          question: "정답 라벨은?",
          answer: "\u001b[31mB\u001b[0m",
          options: ["Alpha", "Beta", "Gamma", "Delta"],
        },
      ],
    });

    render(<QuizPanel content={codeBlock} postTitle="Old Post" />);

    fireEvent.click(screen.getByTestId("quiz-start"));

    expect(await screen.findByText("정답 라벨은?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /beta/i }));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    expect(await screen.findByText("정답입니다!")).toBeInTheDocument();
  });

  it("resets quiz state when the post identity changes and ignores stale batch results", async () => {
    const staleBatch = deferred<QuizResult>();

    vi.mocked(quiz)
      .mockResolvedValueOnce({
        quiz: [
          {
            type: "multiple_choice",
            question: "Old question",
            answer: "A",
            options: ["Old answer", "Other", "Else", "More"],
          },
        ],
      })
      .mockImplementationOnce(() => staleBatch.promise)
      .mockResolvedValue({
        quiz: [
          {
            type: "multiple_choice",
            question: "New question",
            answer: "B",
            options: ["Wrong", "Fresh answer", "Else", "More"],
          },
        ],
      });

    const { rerender } = render(
      <QuizPanel content={codeBlock} postTitle="Old Post" />,
    );

    fireEvent.click(screen.getByTestId("quiz-start"));
    expect(await screen.findByText("Old question")).toBeInTheDocument();

    rerender(
      <QuizPanel
        content={"```ts\nconst refreshed = true;\n```"}
        postTitle="New Post"
      />,
    );

    expect(await screen.findByTestId("quiz-start")).toBeInTheDocument();
    expect(screen.queryByText("Old question")).not.toBeInTheDocument();

    await act(async () => {
      staleBatch.resolve({
        quiz: [
          {
            type: "multiple_choice",
            question: "Stale follow-up",
            answer: "A",
            options: ["Stale", "Other", "Else", "More"],
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.queryByText("Stale follow-up")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("quiz-start"));
    expect(await screen.findByText("New question")).toBeInTheDocument();
  });
});
