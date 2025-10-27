import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  adminLogin,
  createPostPR,
  type CreatePostPayload,
  uploadPostImages,
} from '@/services/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import MarkdownRenderer from '@/components/features/blog/MarkdownRenderer';

export default function NewPost() {
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(true);
  const [coverImage, setCoverImage] = useState('');
  const [content, setContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<
    Array<{ url: string; variantWebp?: { url: string } | null }>
  >([]);

  // Restore token from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin.token');
      if (saved) setToken(saved);
    } catch {}
  }, []);

  const doLogin = useMutation({
    mutationFn: async () => {
      const t = await adminLogin(username, password);
      setToken(t);
      try {
        localStorage.setItem('admin.token', t);
        window.dispatchEvent(new Event('admin-auth-changed'));
      } catch {}
      return t;
    },
    onSuccess: () =>
      toast({ title: '로그인 성공', description: '관리자 인증 완료' }),
    onError: (e: any) =>
      toast({
        title: '로그인 실패',
        description: e?.message || '인증 실패',
        variant: 'destructive',
      }),
  });

  const logout = () => {
    setToken(null);
    try {
      localStorage.removeItem('admin.token');
      window.dispatchEvent(new Event('admin-auth-changed'));
    } catch {}
  };

  const createPr = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('먼저 로그인하세요');
      const payload: CreatePostPayload = {
        title: title.trim() || slug.trim() || 'New Post',
        slug: slug.trim() || undefined,
        year,
        content,
        frontmatter: {
          category: category || 'General',
          tags: tags
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          coverImage: coverImage || undefined,
          published,
        },
      };
      return await createPostPR(payload, token);
    },
    onSuccess: data => {
      toast({ title: 'PR 생성됨', description: data.prUrl });
      try {
        window.open(data.prUrl, '_blank');
      } catch {}
    },
    onError: (e: any) =>
      toast({
        title: 'PR 생성 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      }),
  });

  const doUpload = async () => {
    try {
      if (!token) throw new Error('먼저 로그인하세요');
      if (!year || !/^[0-9]{4}$/.test(year))
        throw new Error('연도(YYYY)를 입력하세요');
      if (!slug.trim()) throw new Error('슬러그를 입력하세요');
      const input = fileInputRef.current;
      if (!input || !input.files || input.files.length === 0)
        throw new Error('업로드할 파일을 선택하세요');
      setUploading(true);
      const files = Array.from(input.files);
      const res = await uploadPostImages(
        { year, slug: slug.trim() },
        files,
        token
      );
      setUploaded(prev => [...res.items, ...prev]);
      toast({
        title: '업로드 완료',
        description: `${res.items.length}개 업로드됨`,
      });
      // Clear selection
      input.value = '';
    } catch (e: any) {
      toast({
        title: '업로드 실패',
        description: e?.message || '오류',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const insertAtCursor = (text: string) => {
    setContent(prev =>
      prev
        ? prev + (prev.endsWith('\n') ? '' : '\n') + text + '\n'
        : text + '\n'
    );
  };

  const previewContent = useMemo(() => {
    const lines: string[] = [];
    if (title.trim()) lines.push(`# ${title.trim()}`);
    if (coverImage.trim()) lines.push(`![cover](${coverImage.trim()})`);
    if (tags.trim()) lines.push(`\n> 태그: ${tags}`);
    if (category.trim()) lines.push(`> 카테고리: ${category}`);
    if (!published) lines.push('> 상태: Draft');
    if (lines.length) lines.push('');
    return [lines.join('\n'), content].filter(Boolean).join('\n');
  }, [title, coverImage, tags, category, published, content]);

  return (
    <div className='container mx-auto px-4 py-8 max-w-5xl'>
      <Card>
        <CardHeader>
          <CardTitle>게시글 작성 (PR 생성)</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='username'>관리자 아이디</Label>
              <Input
                id='username'
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder='admin'
              />
            </div>
            <div>
              <Label htmlFor='password'>관리자 비밀번호</Label>
              <Input
                id='password'
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder='••••••'
              />
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <Button
              onClick={() => doLogin.mutate()}
              disabled={doLogin.isPending}
            >
              {doLogin.isPending
                ? '로그인 중…'
                : token
                  ? '다시 로그인'
                  : '로그인'}
            </Button>
            {token && (
              <>
                <span className='text-sm text-green-600'>로그인됨</span>
                <Button variant='secondary' onClick={logout}>
                  로그아웃
                </Button>
              </>
            )}
          </div>

          <hr className='my-4' />

          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='title'>제목</Label>
              <Input
                id='title'
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder='글 제목'
              />
            </div>
            <div>
              <Label htmlFor='slug'>슬러그</Label>
              <Input
                id='slug'
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder='my-new-post'
              />
            </div>
            <div>
              <Label htmlFor='year'>연도</Label>
              <Input
                id='year'
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder='2025'
              />
            </div>
            <div>
              <Label htmlFor='category'>카테고리</Label>
              <Input
                id='category'
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder='General'
              />
            </div>
            <div className='md:col-span-2'>
              <Label htmlFor='tags'>태그 (쉼표로 구분)</Label>
              <Input
                id='tags'
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder='react, typescript'
              />
            </div>
            <div className='md:col-span-2'>
              <Label htmlFor='coverImage'>커버 이미지 URL (선택)</Label>
              <Input
                id='coverImage'
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                placeholder='/images/cover.jpg'
              />
            </div>
            <div>
              <label className='inline-flex items-center space-x-2'>
                <input
                  type='checkbox'
                  checked={published}
                  onChange={e => setPublished(e.target.checked)}
                />
                <span>공개</span>
              </label>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            <div>
              <Label htmlFor='content'>내용 (Markdown)</Label>
              <Textarea
                id='content'
                value={content}
                onChange={e => setContent(e.target.value)}
                className='min-h-[360px]'
                placeholder='# 새 글 시작...'
              />
            </div>
            <div>
              <Label>미리보기</Label>
              <div className='border rounded-md p-4 min-h-[360px] bg-background'>
                <MarkdownRenderer content={previewContent} />
              </div>
            </div>
          </div>

          <div className='space-y-3'>
            <div className='flex flex-col md:flex-row gap-3 md:items-end'>
              <div className='flex-1'>
                <Label>이미지 업로드</Label>
                <Input
                  ref={fileInputRef}
                  type='file'
                  accept='image/*'
                  multiple
                />
              </div>
              <Button onClick={doUpload} disabled={uploading || !token}>
                {uploading ? '업로드 중…' : '이미지 업로드'}
              </Button>
            </div>
            {uploaded.length > 0 && (
              <div className='border rounded-md p-3 space-y-2'>
                <div className='text-sm text-muted-foreground'>
                  업로드된 파일 (클릭하면 마크다운 삽입)
                </div>
                <ul className='space-y-1 text-sm'>
                  {uploaded.map((u, idx) => (
                    <li key={idx} className='flex items-center gap-2'>
                      <button
                        className='text-primary hover:underline'
                        onClick={() =>
                          insertAtCursor(
                            `![image](${u.variantWebp?.url || u.url})`
                          )
                        }
                        title='마크다운 삽입'
                      >
                        {u.variantWebp?.url || u.url}
                      </button>
                      <Button
                        size='sm'
                        variant='secondary'
                        onClick={() =>
                          navigator.clipboard.writeText(
                            u.variantWebp?.url || u.url
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

          <div className='flex gap-3'>
            <Button
              onClick={() => createPr.mutate()}
              disabled={createPr.isPending || !token}
            >
              {createPr.isPending ? 'PR 생성 중…' : 'PR 생성하기'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
