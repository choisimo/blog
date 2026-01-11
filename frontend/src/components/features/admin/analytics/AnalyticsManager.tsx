/**
 * Analytics Manager
 * 
 * 에디터 픽 관리, 트렌딩 포스트, 조회수 통계
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  TrendingUp,
  Star,
  Eye,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { getApiBaseUrl } from '@/utils/apiBase';
import { useAuthStore } from '@/stores/useAuthStore';

// ============================================================================
// Types
// ============================================================================

interface EditorPick {
  post_slug: string;
  year: string;
  title: string;
  cover_image: string | null;
  category: string | null;
  rank: number;
  score: number;
  reason: string | null;
  is_active: number;
  expires_at: string | null;
}

interface TrendingPost {
  post_slug: string;
  year: string;
  recent_views: number;
  total_views: number;
}



// ============================================================================
// API Functions
// ============================================================================

async function getEditorPicks(): Promise<EditorPick[]> {
  const base = getApiBaseUrl();
  
  try {
    const res = await fetch(`${base}/api/v1/analytics/editor-picks?limit=10`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.picks ?? [];
  } catch {
    return [];
  }
}

async function getTrendingPosts(days: number = 7, limit: number = 10): Promise<TrendingPost[]> {
  const base = getApiBaseUrl();
  
  try {
    const res = await fetch(`${base}/api/v1/analytics/trending?days=${days}&limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.trending ?? [];
  } catch {
    return [];
  }
}

async function refreshStats(token: string): Promise<boolean> {
  const base = getApiBaseUrl();
  
  try {
    const res = await fetch(`${base}/api/v1/analytics/refresh-stats`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// Editor Picks Card
// ============================================================================

function EditorPicksCard() {
  const [picks, setPicks] = useState<EditorPick[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPicks = useCallback(async () => {
    setLoading(true);
    const result = await getEditorPicks();
    setPicks(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              에디터 픽
            </CardTitle>
            <CardDescription>
              관리자가 선정한 추천 글 목록
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchPicks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            로딩 중...
          </div>
        ) : picks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            등록된 에디터 픽이 없습니다.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead className="w-24">카테고리</TableHead>
                  <TableHead className="w-16">점수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {picks.map((pick) => (
                  <TableRow key={`${pick.year}/${pick.post_slug}`}>
                    <TableCell>
                      <Badge variant="outline">{pick.rank}</Badge>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`/#/blog/${pick.year}/${pick.post_slug}`}
                        className="text-sm font-medium hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {pick.title || pick.post_slug}
                      </a>
                      {pick.reason && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {pick.reason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {pick.category || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">{pick.score}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Trending Posts Card
// ============================================================================

function TrendingPostsCard() {
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    const result = await getTrendingPosts(days);
    setTrending(result);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              트렌딩 포스트
            </CardTitle>
            <CardDescription>
              최근 {days}일간 조회수 기준
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-2 py-1 text-xs ${
                    days === d
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted'
                  }`}
                >
                  {d}일
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={fetchTrending} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            로딩 중...
          </div>
        ) : trending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            트렌딩 데이터가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {trending.map((post, idx) => (
              <div
                key={`${post.year}/${post.post_slug}`}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-muted-foreground w-6">
                    {idx + 1}
                  </span>
                  <div>
                    <a
                      href={`/#/blog/${post.year}/${post.post_slug}`}
                      className="text-sm font-medium hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {post.post_slug}
                    </a>
                    <p className="text-xs text-muted-foreground">{post.year}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm font-medium">
                    <Eye className="h-3 w-3" />
                    {post.recent_views.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    전체: {post.total_views.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Stats Refresh Card
// ============================================================================

function StatsRefreshCard() {
  const { getValidAccessToken } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setResult(null);
    
    const token = await getValidAccessToken();
    if (token) {
      const success = await refreshStats(token);
      setResult({
        success,
        message: success ? '통계가 갱신되었습니다.' : '갱신에 실패했습니다.',
      });
      if (success) {
        setLastRefresh(new Date());
      }
    } else {
      setResult({
        success: false,
        message: '인증이 필요합니다.',
      });
    }
    
    setRefreshing(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-500" />
          통계 갱신
        </CardTitle>
        <CardDescription>
          7일/30일 조회수 집계를 수동으로 갱신합니다
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full"
        >
          {refreshing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              갱신 중...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              통계 갱신 실행
            </>
          )}
        </Button>
        
        {result && (
          <p className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.message}
          </p>
        )}
        
        {lastRefresh && (
          <p className="text-xs text-muted-foreground">
            마지막 갱신: {lastRefresh.toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AnalyticsManager() {
  return (
    <div className="space-y-6">
      {/* Two column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        <TrendingPostsCard />
        <div className="space-y-6">
          <StatsRefreshCard />
          <EditorPicksCard />
        </div>
      </div>
    </div>
  );
}
