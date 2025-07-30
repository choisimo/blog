import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { posts } from '@/data/posts';
import { formatDate } from '@/utils/blog';
import { ArrowRight, BookOpen, Search, Tag } from 'lucide-react';

const Index = () => {
  const latestPosts = posts.slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-b from-primary/10 to-background py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            nodove blog
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            개발 경험, 학습 내용, 그리고 기술적 인사이트를 공유하는 공간입니다.
            React, TypeScript, 그리고 최신 웹 기술에 대한 이야기를 나눕니다.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/blog">
              <Button size="lg" className="group">
                <BookOpen className="w-5 h-5 mr-2" />
                블로그 둘러보기
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 최신 포스트 섹션 */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">최신 포스트</h2>
            <p className="text-muted-foreground">
              최근에 작성된 글들을 확인해보세요
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {latestPosts.map((post) => (
              <Card key={post.id} className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>{formatDate(post.date)}</span>
                    <Badge variant="secondary">{post.category}</Badge>
                  </div>
                  <h3 className="text-xl font-semibold group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-muted-foreground line-clamp-3">
                    {post.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {post.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Link to={`/post/${post.slug}`}>
                      <Button variant="ghost" size="sm" className="group/btn">
                        읽기
                        <ArrowRight className="w-3 h-3 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center">
            <Link to="/blog">
              <Button variant="outline" size="lg">
                모든 포스트 보기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 기능 소개 섹션 */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">블로그 기능</h2>
            <p className="text-muted-foreground">
              다양한 기능으로 원하는 콘텐츠를 쉽게 찾아보세요
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">실시간 검색</h3>
              <p className="text-muted-foreground">
                제목, 내용, 태그에서 원하는 키워드를 빠르게 검색할 수 있습니다.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">카테고리 & 태그</h3>
              <p className="text-muted-foreground">
                카테고리와 태그로 관심 있는 주제의 글들을 모아서 볼 수 있습니다.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">읽기 편한 디자인</h3>
              <p className="text-muted-foreground">
                마크다운 형식으로 작성된 글을 깔끔하고 읽기 쉽게 표시합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            © 2024 nodove blog. React + TypeScript + GitHub Pages로 제작되었습니다.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
