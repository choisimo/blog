import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/ui/use-toast";

interface BotChatPanelProps {
    title: string;
    content: string;
    setTitle: (title: string) => void;
    setContent: (content: string) => void;
    setTags: (tags: string) => void;
    setCategory: (category: string) => void;
}

interface Message {
    role: "user" | "assistant";
    content: string;
}

export default function BotChatPanel({
    title,
    content,
    setTitle,
    setContent,
    setTags,
    setCategory,
}: BotChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: "assistant", content: "안녕하세요! 블로그 작성을 돕는 AI입니다. 초안 작성, 교정, 또는 Frontmatter(제목, 태그 등) 생성을 요청해보세요!" },
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const { toast } = useToast();

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = input.trim();
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setInput("");
        setIsTyping(true);

        try {
            // Mock API latency
            await new Promise((resolve) => setTimeout(resolve, 1500));

            let botResponse = "처리되었습니다.";

            // Mock actions based on simple keyword matching for demonstration
            if (userMessage.includes("초안") || userMessage.includes("작성해줘")) {
                const draft = `# ${userMessage.replace("초안 작성해줘", "").trim() || "새 포스트"}\n\n도입부...\n\n본문 내용...\n\n결론...`;
                setContent(draft);
                botResponse = "요청하신 주제로 초안을 작성하여 에디터에 적용했습니다.";
            } else if (userMessage.includes("구조") || userMessage.includes("제목") || userMessage.includes("태그")) {
                setTitle(`AI 추천 제목: ${title || "새로운 블로그 글"}`);
                setTags("AI추천, 기술블로그, 리뷰");
                setCategory("Tech");
                botResponse = "에디터에 제목, 태그, 카테고리를 추천값으로 자동 설정했습니다!";
            } else if (userMessage.includes("교정") || userMessage.includes("다듬어줘")) {
                setContent(content.replace(/존나/g, "매우").replace(/걍/g, "그냥"));
                botResponse = "작성하신 본문의 문맥을 매끄럽게 교정했습니다.";
            } else {
                botResponse = "이해했습니다! 현재는 모의(Mock) 응답이므로, 실제 백엔드 LLM 연동 후 작동하게 됩니다.";
            }

            setMessages((prev) => [...prev, { role: "assistant", content: botResponse }]);
        } catch (e: any) {
            toast({ title: "오류", description: "AI 요청 실패", variant: "destructive" });
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
                                    className={`px-3 py-2 rounded-lg text-sm ${msg.role === "user"
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
                                handleSend();
                            }
                        }}
                    />
                    <Button size="icon" onClick={handleSend} disabled={isTyping || !input.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
}
