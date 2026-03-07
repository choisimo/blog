import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ShellCommand, ShellLog, BlogPost } from "../types";

type UseShellCommanderOptions = {
  vfs: {
    displayPath: string;
    currentPath: string;
    years: string[];
    ls: (path?: string) => string;
    cd: (path: string) => string;
    pwd: () => string;
    cat: (filename: string) => string;
    find: (keyword: string) => string;
    tree: () => string;
    navigate: (path: string) => void;
  };
  posts: BlogPost[];
  onChatOpen: () => void;
  onChatOpenWithMessage: (message: string) => void;
  onMemoToggle: () => void;
  onStackClick: () => void;
  onShellClose: () => void;
  send: (type: string, detail?: Record<string, any>) => void;
};

export function useShellCommander({
  vfs,
  posts,
  onChatOpen,
  onChatOpenWithMessage,
  onMemoToggle,
  onStackClick,
  onShellClose,
  send,
}: UseShellCommanderOptions) {
  const [shellInput, setShellInput] = useState("");
  const [shellOutput, setShellOutput] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [shellLogs, setShellLogs] = useState<ShellLog[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const shellInputRef = useRef<HTMLInputElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Shell Commands
  const shellCommands: ShellCommand[] = useMemo(
    () => [
      // Feature commands
      {
        name: "chat",
        aliases: ["c", "ai"],
        description: "AI 채팅 열기",
        action: () => {
          onChatOpen();
          send("fab_ai_chat_open");
          onShellClose();
          setShellOutput(null);
        },
      },
      {
        name: "memo",
        aliases: ["m", "note"],
        description: "메모장 열기/닫기",
        action: () => {
          send("fab_memo_toggle");
          onMemoToggle();
          onShellClose();
          setShellOutput(null);
        },
      },
      {
        name: "stack",
        aliases: ["s", "history"],
        description: "방문 기록 스택 보기",
        action: () => {
          onStackClick();
          onShellClose();
          setShellOutput(null);
        },
      },
      {
        name: "insight",
        aliases: ["i", "map", "graph"],
        description: "인사이트 그래프 페이지 열기",
        action: () => {
          vfs.navigate("/insight");
          onShellClose();
          setShellOutput(null);
        },
      },
      // Linux-like filesystem commands
      {
        name: "ls",
        aliases: ["dir", "ll"],
        description: "현재 디렉토리 목록",
        action: (args?: string) => {
          const result = vfs.ls(args);
          setShellOutput(result);
        },
      },
      {
        name: "cd",
        aliases: [],
        description: "디렉토리 이동 (예: cd /blog/2025)",
        action: (args?: string) => {
          const result = vfs.cd(args || "/");
          if (result) {
            setShellOutput(result);
          } else {
            onShellClose();
            setShellOutput(null);
          }
        },
      },
      {
        name: "pwd",
        aliases: [],
        description: "현재 경로 표시",
        action: () => {
          setShellOutput(vfs.pwd());
        },
      },
      {
        name: "cat",
        aliases: ["open", "view"],
        description: "게시글 열기 (예: cat post-slug.md)",
        action: (args?: string) => {
          if (!args) {
            setShellOutput("cat: missing file operand");
            return;
          }
          const result = vfs.cat(args);
          if (result.startsWith("Opening:")) {
            onShellClose();
            setShellOutput(null);
          } else {
            setShellOutput(result);
          }
        },
      },
      {
        name: "find",
        aliases: ["search", "grep"],
        description: "게시글 검색 (예: find kafka)",
        action: (args?: string) => {
          if (!args) {
            setShellOutput("find: missing search term");
            return;
          }
          setShellOutput(vfs.find(args));
        },
      },
      {
        name: "tree",
        aliases: [],
        description: "블로그 디렉토리 구조 표시",
        action: () => {
          setShellOutput(vfs.tree());
        },
      },
      {
        name: "home",
        aliases: ["~"],
        description: "홈으로 이동",
        action: () => {
          vfs.navigate("/");
          onShellClose();
          setShellOutput(null);
        },
      },
      {
        name: "clear",
        aliases: ["cls"],
        description: "출력 지우기",
        action: () => {
          setShellOutput(null);
          setShellInput("");
        },
      },
    ],
    [send, onMemoToggle, onStackClick, vfs, onChatOpen, onShellClose],
  );

  const executeShellCommand = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      // Add to command history
      setCommandHistory((prev) => [...prev.slice(-20), trimmed]);
      setHistoryIndex(-1);

      // Parse command and arguments
      const parts = trimmed.split(/\s+/);
      const cmdName = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");

      if (cmdName === "help" || cmdName === "?") {
        const featureCmds = shellCommands.filter((c) =>
          ["chat", "memo", "stack", "insight", "clear"].includes(c.name),
        );
        const fsCmds = shellCommands.filter((c) =>
          ["ls", "cd", "pwd", "cat", "find", "tree", "home"].includes(c.name),
        );

        let helpText = "=== Feature Commands ===\n";
        helpText += featureCmds
          .map((cmd) => `  ${cmd.name.padEnd(8)} ${cmd.description}`)
          .join("\n");
        helpText += "\n\n=== Filesystem Commands ===\n";
        helpText += fsCmds
          .map((cmd) => `  ${cmd.name.padEnd(8)} ${cmd.description}`)
          .join("\n");
        helpText +=
          "\n\n예시:\n  ls              현재 위치 파일 목록\n  cd /blog/2025   2025년 글로 이동\n  find kafka      'kafka' 포함 글 검색\n  cat post.md     게시글 열기";

        setShellOutput(helpText);
        setShellInput("");
        return;
      }

      const cmd = shellCommands.find(
        (c) => c.name === cmdName || c.aliases.includes(cmdName),
      );

      if (cmd) {
        cmd.action(args || undefined);
        setShellInput("");
      } else {
        // Fallback to AI chat for unrecognized commands
        onChatOpenWithMessage(trimmed);
        send("fab_shell_ai_fallback", { input: trimmed });
        onShellClose();
        setShellOutput(null);
        setShellInput("");
      }
    },
    [shellCommands, onChatOpenWithMessage, send, onShellClose],
  );

  // Extended execute with logging
  const executeShellCommandWithLog = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      if (!trimmed) return;

      // Clear suggestions when executing
      setSuggestions([]);
      setSelectedSuggestionIndex(-1);

      // clear command also clears logs
      if (trimmed.toLowerCase() === "clear" || trimmed.toLowerCase() === "cls") {
        setShellLogs([]);
        setShellOutput(null);
        setShellInput("");
        return;
      }

      // Add input log
      const inputLog = `${vfs.displayPath} $ ${trimmed}`;
      setShellLogs((prev) => [
        ...prev.slice(-50),
        { type: "input", text: inputLog },
      ]);

      // Execute command
      executeShellCommand(trimmed);
    },
    [executeShellCommand, vfs.displayPath],
  );

  // Generate dynamic suggestions based on input
  const generateSuggestions = useCallback(
    (input: string): string[] => {
      const trimmed = input.trim().toLowerCase();
      if (!trimmed) return [];

      const parts = trimmed.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1).join(" ");

      // Command completion (no args yet)
      if (parts.length === 1) {
        const cmdMatches = shellCommands
          .filter(
            (c) =>
              c.name.startsWith(cmd) ||
              c.aliases.some((a) => a.startsWith(cmd)),
          )
          .map((c) => c.name);
        return cmdMatches.slice(0, 6);
      }

      // ls command - show directory contents
      if (cmd === "ls" || cmd === "dir" || cmd === "ll") {
        const lsOutput = vfs.ls(args || undefined);
        if (!lsOutput.startsWith("ls:")) {
          const items = lsOutput.split("\n").filter(Boolean).slice(0, 8);
          return items.map(
            (item) =>
              `ls ${args ? `${args}/` : ""}${item.replace("/", "")}`,
          );
        }
      }

      // cd command - path autocomplete
      if (cmd === "cd") {
        const cdSuggestions: string[] = [];

        // Always suggest going back
        cdSuggestions.push("cd ..");
        cdSuggestions.push("cd ~");

        // Suggest available years
        if (!args || args === "/blog" || args.startsWith("/blog/")) {
          vfs.years.forEach((year) => {
            cdSuggestions.push(`cd /blog/${year}`);
          });
        }

        // If currently in blog directory, suggest year directories
        if (vfs.currentPath === "/" || vfs.currentPath === "/blog") {
          vfs.years.forEach((year) => {
            if (!args || year.includes(args)) {
              cdSuggestions.push(`cd ${year}`);
            }
          });
        }

        return cdSuggestions
          .filter((s) => s.toLowerCase().includes(args))
          .slice(0, 6);
      }

      // cat/open command - file autocomplete
      if (cmd === "cat" || cmd === "open" || cmd === "view") {
        const currentPosts = vfs.currentPath.startsWith("/blog/")
          ? posts.filter((p) =>
              p.url.includes(vfs.currentPath.split("/")[2]),
            )
          : posts;

        const matches = currentPosts
          .filter((p) => {
            const slug = p.url.split("/").pop() || "";
            return (
              !args ||
              slug.toLowerCase().includes(args.toLowerCase()) ||
              p.title.toLowerCase().includes(args.toLowerCase())
            );
          })
          .slice(0, 6);

        return matches.map((p) => {
          const slug = p.url.split("/").pop();
          return `cat ${slug}.md`;
        });
      }

      // find/search command - keyword suggestions from post titles and tags
      if (cmd === "find" || cmd === "search" || cmd === "grep") {
        if (!args) {
          // Suggest popular keywords from post titles
          const keywords = new Set<string>();
          posts.forEach((p) => {
            // Extract words from title
            p.title.split(/\s+/).forEach((word) => {
              if (word.length > 2) keywords.add(word.toLowerCase());
            });
            // Add tags
            p.tags?.forEach((tag) => keywords.add(tag.toLowerCase()));
            // Add category
            if (p.category) keywords.add(p.category.toLowerCase());
          });
          return Array.from(keywords)
            .slice(0, 8)
            .map((k) => `find ${k}`);
        } else {
          // Filter keywords based on input
          const allKeywords: string[] = [];
          posts.forEach((p) => {
            p.title.split(/\s+/).forEach((word) => {
              if (word.length > 2 && word.toLowerCase().includes(args)) {
                allKeywords.push(word.toLowerCase());
              }
            });
            p.tags?.forEach((tag) => {
              if (tag.toLowerCase().includes(args))
                allKeywords.push(tag.toLowerCase());
            });
          });
          const unique = [...new Set(allKeywords)];
          return unique.slice(0, 6).map((k) => `find ${k}`);
        }
      }

      return [];
    },
    [shellCommands, vfs, posts],
  );

  // Handle key down with history navigation
  const handleShellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeShellCommand(shellInput);
      } else if (e.key === "Escape") {
        onShellClose();
        setShellOutput(null);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex =
            historyIndex < commandHistory.length - 1
              ? historyIndex + 1
              : historyIndex;
          setHistoryIndex(newIndex);
          setShellInput(
            commandHistory[commandHistory.length - 1 - newIndex] || "",
          );
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setShellInput(
            commandHistory[commandHistory.length - 1 - newIndex] || "",
          );
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setShellInput("");
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Simple tab completion for commands
        const trimmed = shellInput.trim().toLowerCase();
        if (trimmed) {
          const matches = shellCommands.filter(
            (c) =>
              c.name.startsWith(trimmed) ||
              c.aliases.some((a) => a.startsWith(trimmed)),
          );
          if (matches.length === 1) {
            setShellInput(`${matches[0].name} `);
          } else if (matches.length > 1) {
            setShellOutput(matches.map((m) => m.name).join("  "));
          }
        }
      }
    },
    [
      shellInput,
      executeShellCommand,
      commandHistory,
      historyIndex,
      shellCommands,
      onShellClose,
    ],
  );

  // Handle suggestion selection
  const selectSuggestion = useCallback((suggestion: string) => {
    setShellInput(suggestion);
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    shellInputRef.current?.focus();
  }, []);

  // Enhanced key handler with suggestion navigation
  const handleShellKeyDownWithSuggestions = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedSuggestionIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          return;
        }
        if (
          e.key === "Tab" ||
          (e.key === "Enter" && selectedSuggestionIndex >= 0)
        ) {
          e.preventDefault();
          const selected =
            selectedSuggestionIndex >= 0
              ? suggestions[selectedSuggestionIndex]
              : suggestions[0];
          if (selected) {
            selectSuggestion(selected);
          }
          return;
        }
        if (e.key === "Escape") {
          setSuggestions([]);
          setSelectedSuggestionIndex(-1);
          return;
        }
      }

      // Fall through to original handler
      if (e.key === "Enter") {
        e.preventDefault();
        executeShellCommandWithLog(shellInput);
        setSuggestions([]);
      } else {
        handleShellKeyDown(e);
      }
    },
    [
      suggestions,
      selectedSuggestionIndex,
      selectSuggestion,
      executeShellCommandWithLog,
      shellInput,
      handleShellKeyDown,
    ],
  );

  // Update suggestions when input changes
  useEffect(() => {
    const newSuggestions = generateSuggestions(shellInput);
    setSuggestions((prev) => {
      if (
        prev.length === newSuggestions.length &&
        prev.every((value, index) => value === newSuggestions[index])
      ) {
        return prev;
      }
      return newSuggestions;
    });
    setSelectedSuggestionIndex((prev) => (prev === -1 ? prev : -1));
  }, [shellInput, generateSuggestions]);

  // Add output to logs when shellOutput changes
  useEffect(() => {
    if (shellOutput) {
      setShellLogs((prev) => [
        ...prev.slice(-50),
        { type: "output", text: shellOutput },
      ]);
    }
  }, [shellOutput]);

  // Scroll to bottom when logs update
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [shellLogs]);

  return {
    shellInput,
    setShellInput,
    shellOutput,
    setShellOutput,
    commandHistory,
    shellLogs,
    setShellLogs,
    suggestions,
    selectedSuggestionIndex,
    shellInputRef,
    consoleEndRef,
    executeShellCommandWithLog,
    handleShellKeyDownWithSuggestions,
    selectSuggestion,
  };
}
