import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createPostPR,
  type CreatePostPayload,
  uploadPostImages,
} from "@/services/session/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/ui/use-toast";
import MarkdownRenderer from "@/components/features/blog/MarkdownRenderer";
import { useAuthStore } from "@/stores/session/useAuthStore";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import BotChatPanel from "@/components/features/admin/BotChatPanel";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function NewPost() {
  const { toast } = useToast();

  const { logout: storeLogout, getValidAccessToken } = useAuthStore();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [category, setCategory] = useState("General");
  const [tags, setTags] = useState("");
  const [published, setPublished] = useState(true);
  const [coverImage, setCoverImage] = useState("");
  const [content, setContent] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<
    Array<{ url: string; variantWebp?: { url: string } | null }>
  >([]);
  const [failedUploadAttempt, setFailedUploadAttempt] = useState<{
    files: File[];
    message: string;
  } | null>(null);

  const logout = async () => {
    await storeLogout();
    window.dispatchEvent(new Event("admin-auth-changed"));
  };

  const createPr = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token) throw new Error("먼저 로그인하세요");
      const payload: CreatePostPayload = {
        title: title.trim() || slug.trim() || "New Post",
        slug: slug.trim() || undefined,
        year,
        content,
        frontmatter: {
          category: category || "General",
          tags: tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          coverImage: coverImage || undefined,
          published,
        },
      };
      return await createPostPR(payload, token);
    },
    onSuccess: (data) => {
      if (data.prUrl) {
        toast({ title: "PR 생성됨", description: data.prUrl });
        try {
          window.open(data.prUrl, "_blank");
        } catch {
          void 0;
        }
        return;
      }
      toast({
        title: "PR 생성 대기열 등록됨",
        description: data.outboxId ? `Outbox: ${data.outboxId}` : data.path,
      });
    },
    onError: (e) =>
      toast({
        title: "PR 생성 실패",
        description: getErrorMessage(e, "오류"),
        variant: "destructive",
      }),
  });

  const handleImageUploads = async (files: File[]) => {
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error("먼저 로그인하세요");
      if (!year || !/^[0-9]{4}$/.test(year))
        throw new Error("연도(YYYY)를 입력하세요");
      if (!slug.trim()) throw new Error("슬러그(slug)를 먼저 입력하세요 (이미지 경로 생성에 필요)");

      setUploading(true);
      setFailedUploadAttempt(null);
      const res = await uploadPostImages(
        { year, slug: slug.trim() },
        files,
        token,
      );
      setUploaded((prev) => [...res.items, ...prev]);

      // Auto-insert images into the editor
      res.items.forEach((u) => {
        insertAtCursor(`![image](${u.variantWebp?.url || u.url})`);
      });

      toast({
        title: "업로드 완료",
        description: `${res.items.length}개 업로드됨`,
      });
    } catch (e) {
      setFailedUploadAttempt({
        files,
        message: getErrorMessage(e, "오류"),
      });
      toast({
        title: "업로드 실패",
        description: getErrorMessage(e, "오류"),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const doUpload = async () => {
    const input = fileInputRef.current;
    if (!input || !input.files || input.files.length === 0) {
      toast({ title: "오류", description: "업로드할 파일을 선택하세요", variant: "destructive" });
      return;
    }
    const files = Array.from(input.files);
    await handleImageUploads(files);
    input.value = "";
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) imageFiles.push(blob);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      await handleImageUploads(imageFiles);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    const imageFiles: File[] = [];
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.match('^image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
    }
    if (imageFiles.length > 0) {
      await handleImageUploads(imageFiles);
    }
  };

  const insertAtCursor = (text: string) => {
    setContent((prev) =>
      prev ? `${prev}${prev.endsWith("\n") ? "" : "\n"}${text}\n` : `${text}\n`,
    );
  };

  const previewContent = useMemo(() => {
    const lines: string[] = [];
    if (title.trim()) lines.push(`# ${title.trim()}`);
    if (coverImage.trim()) lines.push(`![cover](${coverImage.trim()})`);
    if (tags.trim()) lines.push(`\n> 태그: ${tags}`);
    if (category.trim()) lines.push(`> 카테고리: ${category}`);
    if (!published) lines.push("> 상태: Draft");
    if (lines.length) lines.push("");
    return [lines.join("\n"), content].filter(Boolean).join("\n");
  }, [title, coverImage, tags, category, published, content]);

  return (
    <div className="container mx-auto px-0 md:px-4 py-4 md:py-8 h-[calc(100vh-80px)] max-w-[1400px]">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full rounded-lg border bg-background shadow-sm overflow-hidden md:flex">

        <ResizablePanel defaultSize={70} minSize={40}>
          <ScrollArea className="h-full w-full">
            <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-0 pt-0">
                  <CardTitle>게시글 작성 (PR 생성)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 px-0 pb-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-green-600">로그인됨</span>
                    <Button variant="secondary" onClick={logout}>
                      로그아웃
                    </Button>
                  </div>

                  <hr className="my-4" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="title">제목</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="글 제목"
                      />
                    </div>
                    <div>
                      <Label htmlFor="slug">슬러그</Label>
                      <Input
                        id="slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="my-new-post"
                      />
                    </div>
                    <div>
                      <Label htmlFor="year">연도</Label>
                      <Input
                        id="year"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="2025"
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">카테고리</Label>
                      <Input
                        id="category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="General"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="tags">태그 (쉼표로 구분)</Label>
                      <Input
                        id="tags"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="react, typescript"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="coverImage">커버 이미지 URL (선택)</Label>
                      <Input
                        id="coverImage"
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        placeholder="/images/cover.jpg"
                      />
                    </div>
                    <div>
                      <label className="inline-flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={published}
                          onChange={(e) => setPublished(e.target.checked)}
                        />
                        <span>공개</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="content">내용 (Markdown) - 이미지 복사/붙여넣기 지원</Label>
                      <Textarea
                        id="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        onPaste={handlePaste}
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="min-h-[460px] font-mono"
                        placeholder="# 새 글 시작...&#10;클립보드 이미지를 여기에 바로 붙여넣거나(Drag & Drop) 드래그하세요."
                      />
                    </div>
                    <div>
                      <Label>미리보기</Label>
                      <div className="border rounded-md p-4 min-h-[460px] bg-background">
                        <MarkdownRenderer content={previewContent} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-col md:flex-row gap-3 md:items-end">
                      <div className="flex-1">
                        <Label>이미지 수동 업로드</Label>
                        <Input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                        />
                      </div>
                      <Button onClick={doUpload} disabled={uploading} variant="secondary">
                        {uploading ? "업로드 중…" : "수동 이미지 업로드"}
                      </Button>
                    </div>
                    {failedUploadAttempt && (
                      <div className="border border-destructive/20 bg-destructive/5 rounded-md p-3 text-sm">
                        <div className="font-medium text-destructive">업로드가 중단되었습니다</div>
                        <div className="text-muted-foreground mt-1">
                          {failedUploadAttempt.message}
                        </div>
                        <Button
                          className="mt-3"
                          size="sm"
                          variant="outline"
                          disabled={uploading}
                          onClick={() => {
                            void handleImageUploads(failedUploadAttempt.files);
                          }}
                        >
                          실패한 업로드 다시 시도
                        </Button>
                      </div>
                    )}
                    {uploaded.length > 0 && (
                      <div className="border rounded-md p-3 space-y-2">
                        <div className="text-sm text-muted-foreground">
                          업로드된 파일 (클릭하면 마크다운 삽입)
                        </div>
                        <ul className="space-y-1 text-sm">
                          {uploaded.map((u) => (
                            <li key={u.variantWebp?.url || u.url} className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-primary hover:underline max-w-[250px] truncate block text-left"
                                onClick={() =>
                                  insertAtCursor(
                                    `![image](${u.variantWebp?.url || u.url})`,
                                  )
                                }
                                title="마크다운 삽입"
                              >
                                {u.variantWebp?.url || u.url}
                              </button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs px-2 py-0 ml-auto flex-shrink-0"
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    u.variantWebp?.url || u.url,
                                  )
                                }
                              >
                                복사
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto"
                      onClick={() => createPr.mutate()}
                      disabled={createPr.isPending}
                    >
                      {createPr.isPending ? "PR 생성 중…" : "PR 생성 및 배포하기"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle className="hidden md:flex" />

        <ResizablePanel defaultSize={30} minSize={25} className="hidden md:block">
          <BotChatPanel
            title={title}
            content={content}
            setTitle={setTitle}
            setContent={setContent}
            setTags={setTags}
            setCategory={setCategory}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
