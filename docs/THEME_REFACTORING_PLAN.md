# 테마별(다크/라이트/터미널) 디자인 개선 - 서비스 단위 리팩토링 계획서

## 현재 코드 구조 분석 요약

### 1. 테마 시스템 (현재 상태: 양호)

| 파일 | 역할 | 상태 |
|------|------|------|
| `frontend/src/index.css` | CSS 변수 토큰 정의 (Light/Dark/Terminal) | **2000+ lines**, 3 테마 완비 |
| `frontend/config/tailwind.config.ts` | Tailwind 확장 색상/폰트 | 기본적, 확장 여지 |
| `frontend/src/contexts/ThemeContext.tsx` | 테마 상태 관리 (`light|dark|system|terminal`) | **완성도 높음** |

**핵심 발견:**
- `:root`(Light), `.dark`, `.terminal` CSS 변수가 이미 잘 정의됨
- Terminal 테마는 CRT/scanline/glow 효과가 이미 구현됨
- `isTerminal` 플래그로 컴포넌트별 분기 가능

### 2. Navigation 서비스 (현재 상태: 부분 구현)

| 파일 | 역할 | 문제점 |
|------|------|--------|
| `Header.tsx` | 상단 내비게이션 | 검색바 없음, Terminal path만 표시 |
| `SearchBar.tsx` | Fuse.js 기반 검색 | posts 주입형, Header 통합 불가 |
| `Breadcrumb.tsx` | 경로 표시 | **존재하지만 미사용** |
| `ReadingProgress.tsx` | 읽기 진행률 | BlogPost에만 사용, Header와 z-index 충돌 소지 |

### 3. 콘텐츠 레이아웃 (현재 상태: 개선 필요)

| 파일 | 역할 | 문제점 |
|------|------|--------|
| `Index.tsx` | 홈페이지 | 60/40 레이아웃 아님, 테마별 variant 없음 |
| `BlogPost.tsx` | 포스트 상세 | TOC 컴포넌트 존재하지만 **연결 안됨** |
| `Blog.tsx` | 포스트 목록 | 사이드바 없음, 단일 컬럼 |
| `TableOfContents.tsx` | 목차 | **구현 완료, 미사용** |

### 4. 카드 시스템 (현재 상태: 중복/분산)

| 파일 | 역할 | 문제점 |
|------|------|--------|
| `BlogCard.tsx` | 기본 카드 | hover shadow만, tilt/glow 없음 |
| `Index.tsx` 내 카드들 | 히어로/에디터픽/최근본 | 각각 다른 스타일, 중복 코드 |

---

## 서비스 단위 리팩토링 계획

### Phase 1: Design System 서비스 (토큰/패턴/타이포)

**목표:**
- Dark: "Deep Focus" - 정보 밀도↓, 계층↑, 배경 패턴으로 몰입감↑
- Light: "Clean Intelligence" - #fafafa 기반, Deep Blue + Emerald
- Terminal: "Retro Future" - CRT 상시 적용 + 인터랙션 강화

**수정 파일:**

#### 1.1 `frontend/src/index.css`

```css
/* Light 테마 조정 */
:root {
  --background: 220 14% 97%;          /* #fafafa 계열로 변경 */
  --primary: 221 83% 53%;             /* #1a56db - Deep Blue */
  --accent-emerald: 160 84% 39%;      /* #10b981 - Emerald (신규) */
}

/* 배경 패턴 유틸리티 (Dark 전용) */
.bg-tech-grid::before {
  content: "";
  position: absolute;
  inset: 0;
  background: 
    linear-gradient(rgba(91, 127, 232, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91, 127, 232, 0.02) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
}

/* 테마별 행간 분기 */
.dark .prose { line-height: 1.7; }
.light .prose { line-height: 1.7; }
.terminal .prose { line-height: 1.85; }

/* 키워드 하이라이트 */
.terminal mark,
.dark mark {
  background: hsl(var(--terminal-cyan) / 0.2);
  color: hsl(var(--terminal-cyan));
  padding: 0.1em 0.3em;
  border-radius: 2px;
}
```

#### 1.2 `frontend/config/tailwind.config.ts`

```typescript
extend: {
  fontFamily: {
    sans: ['Inter', 'Pretendard Variable', 'Pretendard', ...fontFamily.sans],
    mono: ['JetBrains Mono', 'IBM Plex Mono', ...fontFamily.mono],
  },
  colors: {
    // 신규 Emerald accent
    emerald: {
      DEFAULT: 'hsl(var(--accent-emerald))',
      foreground: 'hsl(var(--accent-emerald-foreground))',
    },
  },
}
```

**예상 작업량:** 2-3시간

---

### Phase 2: Navigation 서비스 (Header 통합)

**목표:**
- Header에 검색바 상시 노출
- ReadingProgress 통합 (z-index 정리)
- Breadcrumb 활성화

**수정 파일:**

#### 2.1 `frontend/src/hooks/usePostsIndex.ts` (신규)

```typescript
// 전역 포스트 인덱스 (메타데이터만)
export function usePostsIndex() {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  
  useEffect(() => {
    // 앱 시작 시 1회 로드, 캐시
    loadPostsMeta().then(setPosts);
  }, []);
  
  return posts;
}
```

#### 2.2 `Header.tsx` 수정

```tsx
// Before: 검색바 없음
// After:
<header className="...">
  <nav className="...">
    {/* Logo + Nav */}
    
    {/* 검색바 (md 이상) */}
    <div className="hidden md:block flex-1 max-w-md mx-8">
      <HeaderSearchBar posts={postsIndex} />
    </div>
    
    {/* Theme/Mobile toggles */}
  </nav>
  
  {/* ReadingProgress - 조건부 (BlogPost 페이지에서만) */}
  {showProgress && <ReadingProgress />}
</header>
```

#### 2.3 `HeaderSearchBar.tsx` (신규)

```tsx
// SearchBar 확장 - 드롭다운 결과 미리보기
export function HeaderSearchBar({ posts }: Props) {
  const [results, setResults] = useState<BlogPost[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // / 키로 포커스, Esc로 닫기
  useHotkey('/', () => inputRef.current?.focus());
  
  return (
    <div className="relative">
      <SearchInput ... />
      {showDropdown && results.length > 0 && (
        <SearchDropdown results={results.slice(0, 5)} />
      )}
    </div>
  );
}
```

#### 2.4 `BlogPost.tsx` - Breadcrumb 적용

```tsx
// 이미 존재하는 Breadcrumb 컴포넌트 연결
<Breadcrumb items={[
  { label: 'Blog', href: '/blog' },
  { label: post.category, href: `/blog?category=${post.category}` },
  { label: post.title },
]} />
```

**예상 작업량:** 4-5시간

---

### Phase 3: Home 히어로 + BlogPost TOC

**목표:**
- 다크 테마: 60% 이미지 / 40% 카드 레이아웃
- BlogPost에 TOC 연결

**수정 파일:**

#### 3.1 `Index.tsx` - 테마별 히어로 variant

```tsx
// 현재: 단일 레이아웃
// 변경: HomeHero 컴포넌트로 분리 + variant

function HomeHero() {
  const { theme, isTerminal } = useTheme();
  
  if (isTerminal) return <HomeHeroTerminal />;
  if (theme === 'dark') return <HomeHeroDarkDeepFocus />;
  return <HomeHeroLightClean />;
}

// Dark: Deep Focus
function HomeHeroDarkDeepFocus() {
  return (
    <section className="relative bg-tech-grid">
      <div className="grid lg:grid-cols-5 gap-8">
        {/* 좌측 60%: 대형 이미지 */}
        <div className="lg:col-span-3">
          <FeaturedHeroImage />
        </div>
        
        {/* 우측 40%: 최신 3개 카드 */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {latestPosts.slice(0, 3).map(post => (
            <CompactPostCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

#### 3.2 `BlogPost.tsx` - TOC 연결

```tsx
// 현재 코드에서 TableOfContents가 import만 되어 있고 사용 안됨
// 수정:

<div className="flex gap-8">
  {/* 메인 콘텐츠 */}
  <article className="flex-1 max-w-3xl">
    <MarkdownRenderer content={post.content} />
  </article>
  
  {/* TOC 사이드바 (xl 이상) */}
  <aside className="hidden xl:block w-64 shrink-0">
    <TableOfContents content={post.content} />
  </aside>
</div>
```

**예상 작업량:** 4-5시간

---

### Phase 4: PostCard 시스템화

**목표:**
- 3D 틸트 + 글로우 효과
- 카테고리 색상 코딩
- 북마크 기능

**신규/수정 파일:**

#### 4.1 `frontend/src/hooks/useTilt.ts` (신규)

```typescript
export function useTilt(options = { max: 10, scale: 1.02 }) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    // prefers-reduced-motion 존중
    if (prefersReducedMotion()) return;
    
    const handleMove = (e: MouseEvent) => {
      const rect = ref.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / rect.width;
      const y = (e.clientY - rect.top - rect.height / 2) / rect.height;
      
      ref.current!.style.transform = `
        perspective(1000px)
        rotateX(${-y * options.max}deg)
        rotateY(${x * options.max}deg)
        scale(${options.scale})
      `;
    };
    
    // ... cleanup
  }, []);
  
  return ref;
}
```

#### 4.2 `PostCard.tsx` (BlogCard 대체 또는 확장)

```tsx
interface PostCardProps {
  post: BlogPost;
  variant?: 'featured' | 'grid' | 'list' | 'mini';
  showTilt?: boolean;
  showBookmark?: boolean;
}

export function PostCard({ post, variant = 'grid', showTilt = true }: Props) {
  const tiltRef = useTilt({ max: 8 });
  const { isTerminal } = useTheme();
  
  return (
    <article
      ref={showTilt ? tiltRef : undefined}
      className={cn(
        'group relative rounded-xl overflow-hidden transition-all',
        // 테마별 glow
        isTerminal && 'hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]',
        !isTerminal && 'hover:shadow-xl',
        // variant 스타일
        variants[variant],
      )}
    >
      {/* 카테고리 배지 (색상 코딩) */}
      <CategoryBadge category={post.category} />
      
      {/* 북마크 버튼 */}
      {showBookmark && <BookmarkButton postId={post.slug} />}
      
      {/* ... 나머지 카드 콘텐츠 */}
    </article>
  );
}
```

#### 4.3 `frontend/src/services/bookmarks.ts` (신규)

```typescript
const STORAGE_KEY = 'blog.bookmarks';

export function getBookmarks(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function toggleBookmark(postId: string): boolean {
  const current = getBookmarks();
  const exists = current.includes(postId);
  
  const next = exists 
    ? current.filter(id => id !== postId)
    : [...current, postId];
    
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('bookmarks:update'));
  
  return !exists;
}
```

**예상 작업량:** 5-6시간

---

### Phase 5: Light 전용 Blog 레이아웃

**목표:**
- 좌측 사이드바 (카테고리/태그/최근 글)
- 메인 최대 820px
- 우측 TOC

**수정 파일:**

#### 5.1 `Blog.tsx` - 3열 레이아웃 (Light 테마)

```tsx
function Blog() {
  const { theme, isTerminal } = useTheme();
  
  // Terminal/Dark는 기존 단일 컬럼 유지
  if (isTerminal || theme === 'dark') {
    return <BlogSingleColumn />;
  }
  
  // Light: 3열 레이아웃
  return (
    <div className="container flex gap-8">
      {/* 좌측 사이드바 */}
      <aside className="hidden lg:block w-64 shrink-0">
        <BlogSidebar 
          categories={categories}
          tags={popularTags}
          recentPosts={recentPosts}
        />
      </aside>
      
      {/* 메인 콘텐츠 */}
      <main className="flex-1 max-w-[820px]">
        <PostList posts={posts} />
        <Pagination ... />
      </main>
      
      {/* 우측 여백 (대칭용) */}
      <div className="hidden xl:block w-64 shrink-0" />
    </div>
  );
}
```

#### 5.2 `BlogSidebar.tsx` (신규)

```tsx
export function BlogSidebar({ categories, tags, recentPosts }: Props) {
  return (
    <div className="sticky top-24 space-y-6">
      {/* 카테고리 */}
      <section>
        <h3 className="font-semibold mb-3">Categories</h3>
        <ul className="space-y-2">
          {categories.map(cat => (
            <li key={cat.name}>
              <Link to={`/blog?category=${cat.name}`}>
                {cat.name} ({cat.count})
              </Link>
            </li>
          ))}
        </ul>
      </section>
      
      {/* 태그 클라우드 */}
      <section>
        <h3 className="font-semibold mb-3">Popular Tags</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <Badge key={tag} variant="outline" asChild>
              <Link to={`/blog?tag=${tag}`}>#{tag}</Link>
            </Badge>
          ))}
        </div>
      </section>
      
      {/* 최근 글 */}
      <section>
        <h3 className="font-semibold mb-3">Recent Posts</h3>
        <ul className="space-y-3">
          {recentPosts.map(post => (
            <li key={post.slug}>
              <Link to={`/blog/${post.year}/${post.slug}`}>
                <span className="line-clamp-2 text-sm">{post.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

**예상 작업량:** 4-5시간

---

### Phase 6: Terminal Mini Terminal

**목표:**
- Header에 MiniTerminal (terminal 테마만)
- 명령어: `search`, `cat`, `ls -tags`, `help`
- TAB 자동완성

**신규 파일:**

#### 6.1 `frontend/src/components/features/terminal/MiniTerminal.tsx` (신규)

```tsx
const COMMANDS = {
  search: (args: string[], posts: PostMeta[]) => {
    const query = args.join(' ');
    const results = fuzzySearch(posts, query);
    return results.map(p => `  ${p.title}`).join('\n') || 'No results found.';
  },
  
  cat: (args: string[], posts: PostMeta[]) => {
    const slug = args[0];
    const post = posts.find(p => p.slug === slug || p.title.includes(slug));
    if (post) {
      navigate(`/blog/${post.year}/${post.slug}`);
      return `Opening: ${post.title}`;
    }
    return `Post not found: ${slug}`;
  },
  
  'ls': (args: string[], posts: PostMeta[]) => {
    if (args.includes('-tags')) {
      return getAllTags().map(t => `  #${t}`).join('\n');
    }
    return posts.slice(0, 10).map(p => `  ${p.slug}`).join('\n');
  },
  
  help: () => `Available commands:
  search <query>  - Search posts
  cat <slug>      - Open post
  ls [-tags]      - List posts or tags
  help            - Show this help`,
};

export function MiniTerminal() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const handleCommand = (cmd: string) => {
    const [command, ...args] = cmd.split(' ');
    const handler = COMMANDS[command as keyof typeof COMMANDS];
    
    if (handler) {
      const result = handler(args, posts);
      setOutput(prev => [...prev, `$ ${cmd}`, result]);
    } else {
      setOutput(prev => [...prev, `$ ${cmd}`, `Command not found: ${command}`]);
    }
    
    setHistory(prev => [...prev, cmd]);
    setInput('');
  };
  
  // TAB 자동완성
  const handleTab = () => {
    const matches = Object.keys(COMMANDS).filter(c => c.startsWith(input));
    if (matches.length === 1) {
      setInput(matches[0] + ' ');
    }
  };
  
  return (
    <div className="font-mono text-xs bg-[hsl(var(--terminal-code-bg))] border border-border p-2 max-h-48 overflow-y-auto">
      {/* 출력 히스토리 */}
      {output.map((line, i) => (
        <div key={i} className={cn(
          line.startsWith('$') ? 'text-primary' : 'text-muted-foreground'
        )}>
          {line}
        </div>
      ))}
      
      {/* 입력 프롬프트 */}
      <div className="flex items-center gap-2">
        <span className="text-primary">$</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCommand(input);
            if (e.key === 'Tab') { e.preventDefault(); handleTab(); }
          }}
          className="flex-1 bg-transparent outline-none"
          placeholder="Type 'help' for commands..."
        />
        <span className="terminal-cursor" />
      </div>
    </div>
  );
}
```

#### 6.2 `Header.tsx` - Terminal 모드에서 MiniTerminal 토글

```tsx
{isTerminal && (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="text-primary">
        <Terminal className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-96 p-0">
      <MiniTerminal />
    </PopoverContent>
  </Popover>
)}
```

**예상 작업량:** 6-8시간

---

## Phase 7: 성능/접근성/반응형 최종 검토

**체크리스트:**

### 성능
- [ ] 3D tilt: `prefers-reduced-motion` 존중
- [ ] 모바일에서 tilt 비활성화
- [ ] CRT scanline: 토글 가능하게
- [ ] Lighthouse 성능 점수 90+ 유지

### 접근성
- [ ] `/` 키 검색 포커스
- [ ] 검색 드롭다운 ARIA (`aria-activedescendant`)
- [ ] 색상 대비 WCAG 4.5:1+
- [ ] 스크린리더 테스트

### 반응형
- [ ] Header 검색바 모바일에서 아이콘으로 축소
- [ ] TOC 모바일에서 드로어로 변경
- [ ] Blog 사이드바 lg 미만에서 숨김

---

## 단계별 적용 로드맵 (권장 순서)

| Phase | 소요 시간 | 의존성 | 우선순위 |
|-------|-----------|--------|----------|
| 1. Design System | 2-3h | 없음 | **High** |
| 2. Navigation | 4-5h | Phase 1 | **High** |
| 3. Home Hero + TOC | 4-5h | Phase 1, 2 | **High** |
| 4. PostCard 시스템 | 5-6h | Phase 1 | Medium |
| 5. Light Blog 레이아웃 | 4-5h | Phase 1 | Medium |
| 6. Terminal MiniTerminal | 6-8h | Phase 1, 2 | Medium |
| 7. 최종 검토 | 2-3h | All | **High** |

**총 예상 시간:** 27-35시간

---

## 질문/결정 필요 사항

1. **1순위 화면 선택:**
   - [ ] Home(Index) - 히어로 60/40
   - [ ] Blog 목록 - 사이드바/필터
   - [ ] Blog 상세 - TOC/Progress/Breadcrumb

2. **Terminal MiniTerminal 범위:**
   - [ ] MVP (명령 3-4개만)
   - [ ] 풀 기능 (자동완성/히스토리/출력 UI)

3. **카드 시스템 통합 범위:**
   - [ ] BlogCard만 교체
   - [ ] Index 내 모든 카드 통합
   - [ ] Related posts도 포함

---

## 파일 변경 요약

### 신규 파일
- `frontend/src/hooks/usePostsIndex.ts`
- `frontend/src/hooks/useTilt.ts`
- `frontend/src/hooks/useBookmarks.ts`
- `frontend/src/services/bookmarks.ts`
- `frontend/src/components/features/search/HeaderSearchBar.tsx`
- `frontend/src/components/features/blog/BlogSidebar.tsx`
- `frontend/src/components/features/blog/PostCard.tsx`
- `frontend/src/components/features/terminal/MiniTerminal.tsx`
- `frontend/src/pages/Index/HomeHeroDark.tsx`
- `frontend/src/pages/Index/HomeHeroLight.tsx`
- `frontend/src/pages/Index/HomeHeroTerminal.tsx`

### 수정 파일
- `frontend/src/index.css` - 토큰 조정/패턴 유틸 추가
- `frontend/config/tailwind.config.ts` - 폰트/색상 확장
- `frontend/src/components/organisms/Header.tsx` - 검색바/Progress 통합
- `frontend/src/pages/Index.tsx` - HomeHero 분리
- `frontend/src/pages/BlogPost.tsx` - TOC/Breadcrumb 연결
- `frontend/src/pages/Blog.tsx` - 3열 레이아웃 (Light)
- `frontend/src/components/features/blog/BlogCard.tsx` - PostCard로 대체 또는 확장
