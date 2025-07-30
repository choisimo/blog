import { useState, useMemo, useEffect } from 'react';
import { BlogCard } from '@/components/BlogCard';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getPosts } from '@/data/posts';
import { BlogPost } from '@/types/blog';
import { Filter, Tag, Folder } from 'lucide-react';

const Blog = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchResults, setSearchResults] = useState<BlogPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        const allPosts = await getPosts();
        setPosts(allPosts);
        setSearchResults(allPosts);
        
        // Extract categories and tags
        const uniqueCategories = Array.from(new Set(allPosts.map(post => post.category)));
        const uniqueTags = Array.from(new Set(allPosts.flatMap(post => post.tags)));
        
        setCategories(uniqueCategories);
        setTags(uniqueTags);
      } catch (error) {
        console.error('Failed to load posts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  const filteredPosts = useMemo(() => {
    let filtered = searchResults;

    if (selectedCategory) {
      filtered = filtered.filter(post => post.category === selectedCategory);
    }

    if (selectedTag) {
      filtered = filtered.filter(post => 
        post.tags.some(tag => tag === selectedTag)
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [searchResults, selectedCategory, selectedTag]);

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedTag('');
  };

  const hasActiveFilters = selectedCategory || selectedTag;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground text-lg">블로그 포스트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-b border-primary/20">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent" />
        
        <div className="container mx-auto px-4 py-16 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              새로운 포스트가 정기적으로 업데이트됩니다
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-transparent leading-tight">
              개발 블로그
            </h1>
            
            <p className="text-muted-foreground text-xl leading-relaxed mb-8">
              알고리즘부터 시스템 설계까지, 개발 여정의 모든 순간을 기록하고 공유합니다.
              <br className="hidden sm:block" />
              함께 성장하는 개발자 커뮤니티를 만들어가요.
            </p>
            
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>{posts.length}개의 포스트</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-accent"></div>
                <span>{categories.length}개의 카테고리</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-secondary"></div>
                <span>{tags.length}개의 태그</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-6 text-background" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25" fill="currentColor"></path>
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5" fill="currentColor"></path>
            <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" fill="currentColor"></path>
          </svg>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 사이드바 */}
          <aside className="lg:w-72 space-y-6">
            {/* 검색 */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Filter className="w-4 h-4 text-primary" />
                </div>
                검색 & 필터
              </h3>
              <SearchBar 
                posts={posts} 
                onSearchResults={setSearchResults}
              />
            </div>

            {/* 필터 토글 (모바일) */}
            <div className="lg:hidden">
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="w-full"
              >
                <Filter className="w-4 h-4 mr-2" />
                필터 {showFilters ? '숨기기' : '보기'}
              </Button>
            </div>

            {/* 필터 섹션 */}
            <div className={`space-y-6 ${showFilters || 'lg:block hidden'}`}>
              {/* 활성 필터 */}
              {hasActiveFilters && (
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      활성 필터
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs h-7 px-3 hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      모두 지우기
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCategory && (
                      <Badge variant="default" className="text-xs font-medium bg-primary/20 text-primary border border-primary/30">
                        <Folder className="w-3 h-3 mr-1" />
                        {selectedCategory}
                      </Badge>
                    )}
                    {selectedTag && (
                      <Badge variant="default" className="text-xs font-medium bg-accent/20 text-accent-foreground border border-accent/30">
                        <Tag className="w-3 h-3 mr-1" />
                        {selectedTag}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* 카테고리 */}
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Folder className="w-4 h-4 text-accent" />
                  </div>
                  카테고리
                </h4>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={selectedCategory === category ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setSelectedCategory(
                        selectedCategory === category ? '' : category
                      )}
                      className={`w-full justify-start text-sm font-medium transition-all duration-200 ${
                        selectedCategory === category 
                          ? 'bg-primary text-primary-foreground shadow-sm' 
                          : 'hover:bg-primary/10 hover:text-primary'
                      }`}
                    >
                      {category}
                      <span className={`ml-auto text-xs px-2 py-1 rounded-full ${
                        selectedCategory === category 
                          ? 'bg-primary-foreground/20 text-primary-foreground' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {posts.filter(p => p.category === category).length}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 태그 */}
              <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                <h4 className="font-bold mb-4 flex items-center gap-2 text-lg">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <Tag className="w-4 h-4 text-secondary-foreground" />
                  </div>
                  태그
                </h4>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTag === tag ? "default" : "outline"}
                      className={`cursor-pointer text-xs font-medium transition-all duration-200 ${
                        selectedTag === tag
                          ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                          : 'hover:bg-accent/10 hover:text-accent hover:border-accent/50'
                      }`}
                      onClick={() => setSelectedTag(
                        selectedTag === tag ? '' : tag
                      )}
                    >
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="flex-1">
            {/* 결과 정보 */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-3xl font-bold mb-2 flex items-center gap-3">
                    <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      블로그 포스트
                    </span>
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="text-sm font-medium">
                        필터링됨
                      </Badge>
                    )}
                  </h2>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      총 {filteredPosts.length}개의 포스트
                    </span>
                    {hasActiveFilters && (
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                        {posts.length - filteredPosts.length}개 필터됨
                      </span>
                    )}
                  </div>
                </div>
                
                {hasActiveFilters && (
                  <Button 
                    variant="outline" 
                    onClick={clearFilters}
                    className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
                  >
                    모든 필터 지우기
                  </Button>
                )}
              </div>
            </div>

            {/* 포스트 목록 */}
            {filteredPosts.length > 0 ? (
              <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
                {filteredPosts.map((post, index) => (
                  <div 
                    key={post.id} 
                    className="animate-in fade-in-0 slide-in-from-bottom-4"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <BlogCard post={post} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
                    <Filter className="w-12 h-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">검색 결과가 없습니다</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    다른 검색어를 사용하거나 필터를 조정해 보세요.
                  </p>
                  {hasActiveFilters && (
                    <Button 
                      variant="default" 
                      onClick={clearFilters}
                      className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                    >
                      모든 필터 초기화
                    </Button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Blog;