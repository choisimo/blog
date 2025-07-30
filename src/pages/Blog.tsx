import { useState, useMemo } from 'react';
import { BlogCard } from '@/components/BlogCard';
import { SearchBar } from '@/components/SearchBar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { posts, getAllCategories, getAllTags } from '@/data/posts';
import { BlogPost } from '@/types/blog';
import { Filter, Tag, Folder } from 'lucide-react';

const Blog = () => {
  const [searchResults, setSearchResults] = useState<BlogPost[]>(posts);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const categories = getAllCategories();
  const tags = getAllTags();

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

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="bg-card border-b">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-4">개발 블로그</h1>
            <p className="text-muted-foreground text-lg">
              개발 경험과 학습 내용을 공유하는 공간입니다
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 사이드바 */}
          <aside className="lg:w-64 space-y-6">
            {/* 검색 */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4" />
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
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">활성 필터</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs h-6"
                    >
                      모두 지우기
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCategory && (
                      <Badge variant="default" className="text-xs">
                        <Folder className="w-3 h-3 mr-1" />
                        {selectedCategory}
                      </Badge>
                    )}
                    {selectedTag && (
                      <Badge variant="default" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {selectedTag}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* 카테고리 */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Folder className="w-4 h-4" />
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
                      className="w-full justify-start text-sm"
                    >
                      {category}
                      <span className="ml-auto text-xs opacity-60">
                        {posts.filter(p => p.category === category).length}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* 태그 */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  태그
                </h4>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTag === tag ? "default" : "outline"}
                      className="cursor-pointer text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setSelectedTag(
                        selectedTag === tag ? '' : tag
                      )}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="flex-1">
            {/* 결과 정보 */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-2">
                블로그 포스트
                {hasActiveFilters && " (필터링됨)"}
              </h2>
              <p className="text-muted-foreground">
                총 {filteredPosts.length}개의 포스트
              </p>
            </div>

            {/* 포스트 목록 */}
            {filteredPosts.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredPosts.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg mb-4">
                  검색 결과가 없습니다
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={clearFilters}>
                    필터 초기화
                  </Button>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Blog;