import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Search, X } from 'lucide-react';
import { ProjectCard, ProjectCardSkeleton, ProjectModal, TagFilter } from '@/components/features/projects';
import { getProjects, getProjectTags, type ProjectItem } from '@/data/content/projects';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import { useSEO } from '@/hooks/seo/useSEO';
import { generateSEOData, generateStructuredData } from '@/utils/seo/seo';

type ViewMode = 'card' | 'list';

export function normalizeProjectsPageUrl(
  value?: string | null
): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

const Projects = () => {
  useSEO(
    generateSEOData(undefined, 'projects'),
    generateStructuredData(undefined, 'projects')
  );

  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedTag, setSelectedTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'source' | 'title'>('source');
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const loadedProjects = await getProjects();
      setProjects(loadedProjects);
    } catch (loadError) {
      setProjects([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load projects manifest.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const projectTags = useMemo(() => getProjectTags(projects), [projects]);

  const filteredProjects = useMemo(() => {
    const term = searchQuery.trim().toLocaleLowerCase();
    const matches = projects.filter(project => (selectedTag === 'All' || project.tags.includes(selectedTag))
      && (!term || [project.title, project.description, project.category, ...project.tags].some(value => String(value ?? '').toLocaleLowerCase().includes(term))));
    return sortMode === 'title' ? [...matches].sort((a, b) => a.title.localeCompare(b.title, 'ko')) : matches;
  }, [projects, selectedTag, searchQuery, sortMode]);

  useEffect(() => {
    if (selectedTag === 'All') return;
    if (!projectTags.includes(selectedTag)) {
      setSelectedTag('All');
    }
  }, [projectTags, selectedTag]);

  const openProjectInNewTab = (project: ProjectItem) => {
    if (typeof window === 'undefined') return;
    const projectUrl = normalizeProjectsPageUrl(project.url);
    if (!projectUrl) return;
    window.open(projectUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePreview = (project: ProjectItem) => {
    if (project.type === 'link') {
      openProjectInNewTab(project);
      return;
    }

    // Embedded previews are often too heavy on mobile.
    if (isMobile && project.type === 'embed') {
      openProjectInNewTab(project);
      return;
    }

    setActiveProject(project);
    setModalOpen(true);
  };


  const resetFilters = () => { setSearchQuery(''); setSelectedTag('All'); };
  return <div className="ui-page ui-projects-page ui-page-container" data-ui-page="projects">
    <header className="ui-projects-heading"><div><p className="ui-eyebrow">PROJECTS</p><h1>프로젝트</h1>
      <p>GitHub choisimo의 공개 저장소를 2026년 9월 8일 기준으로 정리했습니다. 원본·포크·빈 저장소를 구분하며, 소개와 주요 언어는 공개 자료에서 확인한 내용입니다.</p></div>
      {!loading && !error && <div className="ui-projects-total"><strong>{projects.length}</strong><span>공개 저장소</span></div>}
    </header>
    {error ? <div className="ui-inline-error" role="alert"><h2>프로젝트를 불러오지 못했습니다</h2><p>{error}</p>
      <button type="button" className="ui-control" data-ui-variant="outline" onClick={() => void loadProjects()}>다시 불러오기</button></div>
    : <>
      <section className="ui-projects-catalog" aria-labelledby="project-catalog-title" aria-busy={loading}>
        <div className="ui-projects-catalog-header"><h2 id="project-catalog-title">프로젝트 둘러보기</h2>
          <div className="ui-projects-view-switch" role="group" aria-label="프로젝트 표시 방식">
            <button type="button" aria-pressed={viewMode === 'card'} onClick={() => setViewMode('card')}><LayoutGrid size={16} aria-hidden="true" />갤러리</button>
            <button type="button" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')}><List size={16} aria-hidden="true" />목록</button>
          </div>
        </div>
        <div className="ui-projects-discovery"><div className="ui-projects-search"><Search size={18} aria-hidden="true" />
          <label htmlFor="project-search" className="sr-only">프로젝트 검색</label><input id="project-search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} maxLength={200} placeholder="이름, 설명, 기술로 검색" />
          {searchQuery && <button type="button" onClick={() => setSearchQuery('')} aria-label="검색어 지우기"><X size={16} aria-hidden="true" /></button>}
        </div><label className="ui-projects-sort">정렬<select value={sortMode} onChange={event => setSortMode(event.target.value === 'title' ? 'title' : 'source')}><option value="source">최근 푸시 날짜순</option><option value="title">이름순</option></select></label></div>
        <TagFilter tags={projectTags} selectedTag={selectedTag} onSelect={setSelectedTag} allLabel="전체" label="프로젝트 주제 필터" />
        <div className="ui-projects-results-summary"><p role="status" aria-live="polite">{loading ? '프로젝트를 불러오는 중입니다.' : `${filteredProjects.length}개 저장소${selectedTag !== 'All' ? ` · ${selectedTag}` : ''}`}</p>
          {(searchQuery || selectedTag !== 'All') && <button type="button" onClick={resetFilters}>검색·필터 초기화</button>}</div>
        {loading ? <div className="ui-project-gallery" aria-label="프로젝트 로딩">{Array.from({ length: 4 }, (_, index) => <ProjectCardSkeleton key={index} />)}</div>
        : !filteredProjects.length ? <div className="ui-projects-empty"><h3>{projects.length ? '조건에 맞는 프로젝트가 없습니다' : '공개된 프로젝트가 없습니다'}</h3><p>{projects.length ? '검색어를 바꾸거나 주제 필터를 해제해 주세요.' : '새 프로젝트가 공개되면 이곳에서 확인할 수 있습니다.'}</p>
          {!!projects.length && <button type="button" onClick={resetFilters} className="ui-control" data-ui-variant="outline">전체 프로젝트 보기</button>}</div>
        : <div className={viewMode === 'card' ? 'ui-project-gallery' : 'ui-project-directory'}>{filteredProjects.map(project => <ProjectCard key={project.id} project={project} title={`최근 푸시: ${project.date}`} onPreview={handlePreview} presentation={viewMode} emphasized={project.featured === true} visitLabel="저장소 열기" codeLabel="확인한 소스" />)}</div>}
      </section>
    </>}
    <ProjectModal open={modalOpen} project={activeProject} onOpenChange={setModalOpen} openLabel="새 탭에서 열기" fullscreenLabel="전체 화면" closeLabel="미리보기 닫기" />
  </div>;
};
export default Projects;
