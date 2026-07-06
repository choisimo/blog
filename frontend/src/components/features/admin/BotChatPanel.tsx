import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/ui/use-toast";
import { runBlogAgent, type AgentEditorAction } from "@/services/session/agent";

interface BotChatPanelProps {
    title: string;
    slug: string;
    year: string;
    category: string;
    tags: string;
    coverImage: string;
    content: string;
    setTitle: (title: string) => void;
    setSlug: (slug: string) => void;
    setContent: (content: string) => void;
    setTags: (tags: string) => void;
    setCategory: (category: string) => void;
    setCoverImage: (url: string) => void;
    onInsertMarkdown: (markdown: string) => void;
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

const BOT_ACTION_SLUG_UNSAFE_PATTERN = /[\u0000-\u001F\u007F/\\]+/g;

function normalizeBotActionSlug(value: unknown): string | null {
    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    try {
        const decoded = decodeURIComponent(trimmed);
        const normalized = decoded
            .replace(BOT_ACTION_SLUG_UNSAFE_PATTERN, " ")
            .toLowerCase()
            .replace(/[^0-9a-z\uac00-\ud7a3]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
        return normalized || null;
    } catch {
        return null;
    }
}

export default function BotChatPanel({
    title,
    slug,
    year,
    category,
    tags,
    coverImage,
    content,
    setTitle,
    setSlug,
    setContent,
    setTags,
    setCategory,
    setCoverImage,
    onInsertMarkdown,
}: BotChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "안녕하세요. 현재 글 상태를 읽고 초안, 메타데이터, 커버/본문 이미지 생성을 도울 수 있습니다." },
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId] = useState(() => {
        const id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        return `new-post-${id}`.slice(0, 128);
    });
    const { toast } = useToast();

    const buildAgentMessage = (userMessage: string) => {
        const state = {
            title,
            slug,
            year,
            category,
            tags: tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            coverImage: coverImage || null,
            contentLength: content.length,
            contentExcerpt: content.slice(0, 7000),
        };

        return [
            "현재 작성 중인 게시글 상태(JSON):",
            JSON.stringify(state, null, 2),
            "",
            "사용자 요청:",
            userMessage,
            "",
            "에디터에 직접 반영할 변경이 있으면 post_actions JSON block을 함께 반환하세요. 이미지가 필요하면 image_generation tool을 사용하고, year와 slug가 없으면 먼저 필요한 값을 요청하세요.",
        ].join("\n");
    };

    const applyActions = (actions: AgentEditorAction[] | undefined) => {
        if (!actions?.length) return 0;

        let applied = 0;
        for (const action of actions) {
            switch (action.type) {
                case "set_title": {
                    const value = action.value || action.title;
                    if (value) {
                        setTitle(value);
                        applied += 1;
                    }
                    break;
                }
                case "set_slug": {
                    const value = normalizeBotActionSlug(action.value || action.slug);
                    if (value) {
                        setSlug(value);
                        applied += 1;
                    }
                    break;
                }
                case "set_category": {
                    const value = action.value || action.category;
                    if (value) {
                        setCategory(value);
                        applied += 1;
                    }
                    break;
                }
                case "set_tags": {
                    const value = action.value || action.tags;
                    if (Array.isArray(value)) {
                        setTags(value.join(", "));
                        applied += 1;
                    } else if (value) {
                        setTags(value);
                        applied += 1;
                    }
                    break;
                }
                case "set_cover_image": {
                    const value = action.url || action.value;
                    if (value) {
                        setCoverImage(value);
                        applied += 1;
                    }
                    break;
                }
                case "insert_markdown": {
                    const value = action.markdown || action.content || action.text;
                    if (value) {
                        onInsertMarkdown(value);
                        applied += 1;
                    }
                    break;
                }
                case "replace_content": {
                    const value = action.content || action.markdown;
                    if (value) {
                        setContent(value);
                        applied += 1;
                    }
                    break;
                }
                case "append_content": {
                    const value = action.markdown || action.content || action.text;
                    if (value) {
                        onInsertMarkdown(value);
                        applied += 1;
                    }
                    break;
                }
                default:
                    break;
            }
        }

        return applied;
    };

    const handleSend = async () => {
        if (isTyping) return;
        if (!input.trim()) return;

        const userMessage = input.trim();
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setInput("");
        setIsTyping(true);

        try {
            const result = await runBlogAgent(
                {
                    message: buildAgentMessage(userMessage),
                    sessionId,
                    maxIterations: 6,
                    temperature: 0.4,
                },
            );
            const applied = applyActions(result.actions);
            const toolSuffix =
                result.toolsUsed.length > 0 ? `\n\n사용 도구: ${result.toolsUsed.join(", ")}` : "";
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `${result.response || "처리되었습니다."}${toolSuffix}`,
                },
            ]);
            if (applied > 0) {
                toast({ title: "AI 변경 적용", description: `${applied}개 작업을 에디터에 반영했습니다.` });
            }
        } catch (error) {
            const description = error instanceof Error && error.message ? error.message : "AI 요청 실패";
            setMessages((prev) => [...prev, { role: "assistant", content: `요청 처리에 실패했습니다: ${description}` }]);
            toast({ title: "오류", description, variant: "destructive" });
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <Card className="h-full flex flex-col border-0 rounded-none bg-muted/20">
            <CardHeader className="py-4 border-b bg-background/50">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    AI Assistant
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                    <div className="space-y-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                                    }`}
                            >
                                <div
                                    className={`whitespace-pre-wrap px-3 py-2 rounded-lg text-sm ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted border text-foreground"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex bg-muted border text-foreground mr-auto items-start px-3 py-2 rounded-lg text-sm w-fit gap-1">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>

            <CardFooter className="p-3 border-t bg-background/50">
                <div className="flex w-full items-center gap-2">
                    <Input
                        placeholder="AI에게 무엇이든 요청하세요..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void handleSend();
                            }
                        }}
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={isTyping || !input.trim()}
                        aria-label="Send assistant message"
                        title="Send assistant message"
                    >
                        <Send className="w-4 h-4" aria-hidden="true" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
