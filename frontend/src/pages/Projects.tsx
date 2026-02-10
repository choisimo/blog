import { useCallback, useEffect, useMemo, useState } from 'react';
import { Code2, Eye, ExternalLink, LayoutGrid, List } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProjectCard, ProjectModal, TagFilter } from '@/components/features/projects';
import { getProjects, getProjectTags, type ProjectItem } from '@/data/projects';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

type ViewMode = 'card' | 'list';

function getStatusClassName(status: ProjectItem['status']): string {
  const normalized = status.toLowerCase();
  if (normalized === 'live') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  }
  if (normalized === 'archive') {
    return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
  }
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
}

const Projects = () => {
  const isMobile = useIsMobile();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [selectedTag, setSelectedTag] = useState('All');
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

  const featuredProject = useMemo(
    () => projects.find(project => project.featured) ?? projects[0] ?? null,
    [projects]
  );

  const projectTags = useMemo(() => getProjectTags(projects), [projects]);

  const filteredProjects = useMemo(() => {
    if (selectedTag === 'All') return projects;
    return projects.filter(project => project.tags.includes(selectedTag));
  }, [projects, selectedTag]);

  useEffect(() => {
    if (selectedTag === 'All') return;
    if (!projectTags.includes(selectedTag)) {
      setSelectedTag('All');
    }
  }, [projectTags, selectedTag]);

  const openProjectInNewTab = (project: ProjectItem) => {
    if (typeof window === 'undefined') return;
    window.open(project.url, '_blank', 'noopener,noreferrer');
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

  return (
    <div className='container mx-auto max-w-7xl px-4 py-10'>
      <section className='space-y-4'>
        <Badge variant='outline' className='inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs'>
          ✨ New
          <span>Project Hub</span>
        </Badge>
        <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>Projects</h1>
        <p className='max-w-3xl text-base text-muted-foreground md:text-lg'>
          markdown 파일 기반 manifest에서 프로젝트를 동적으로 로드합니다.
          가능한 서비스는 페이지 내 Preview로 즉시 체험할 수 있습니다.
        </p>
      </section>

      {loading && (
        <section className='mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className='h-[320px] animate-pulse border-border/60 bg-card/60' />
          ))}
        </section>
      )}

      {!loading && error && (
        <section className='mt-8'>
          <Card className='border-destructive/40'>
            <CardHeader>
              <CardTitle>Failed to load projects</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => void loadProjects()}>Retry</Button>
            </CardContent>
          </Card>
        </section>
      )}

      {!loading && !error && projects.length === 0 && (
        <section className='mt-8'>
          <Card>
            <CardHeader>
              <CardTitle>No projects found</CardTitle>
              <CardDescription>
                <code>public/project-data/*.md</code> 파일과{' '}
                <code>projects-manifest.json</code> 생성 상태를 확인해주세요.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>
      )}

      {!loading && !error && projects.length > 0 && featuredProject && (
        <>
          <section className='mt-8'>
            <Card className='overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card'>
              <CardHeader className='pb-3'>
                <Badge variant='secondary' className='w-fit text-xs'>
                  Featured Project
                </Badge>
                <CardTitle className='text-2xl'>{featuredProject.title}</CardTitle>
                <CardDescription className='max-w-3xl text-sm md:text-base'>
                  {featuredProject.description}
                </CardDescription>
              </CardHeader>
              <CardContent className='flex flex-wrap gap-2 pb-6'>
                <Button onClick={() => openProjectInNewTab(featuredProject)}>
                  <ExternalLink className='h-4 w-4' />
                  Visit
                </Button>
                <Button variant='outline' onClick={() => handlePreview(featuredProject)}>
                  <Eye className='h-4 w-4' />
                  Preview
                </Button>
                {featuredProject.codeUrl && (
                  <Button variant='ghost' asChild>
                    <a href={featuredProject.codeUrl} target='_blank' rel='noopener noreferrer'>
                      <Code2 className='h-4 w-4' />
                      Code
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          </section>

          <section className='mt-10 space-y-5'>
            <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
              <TagFilter tags={projectTags} selectedTag={selectedTag} onSelect={setSelectedTag} />
              <div className='inline-flex rounded-xl border border-border/70 bg-card p-1'>
                <Button
                  type='button'
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size='sm'
                  className='rounded-lg'
                  onClick={() => setViewMode('card')}
                >
                  <LayoutGrid className='h-4 w-4' />
                  Card
                </Button>
                <Button
                  type='button'
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size='sm'
                  className='rounded-lg'
                  onClick={() => setViewMode('list')}
                >
                  <List className='h-4 w-4' />
                  List
                </Button>
              </div>
            </div>

            {viewMode === 'card' ? (
              <div className='grid gap-5 md:grid-cols-2 xl:grid-cols-3'>
                {filteredProjects.map(project => (
                  <ProjectCard key={project.id} project={project} onPreview={handlePreview} />
                ))}
              </div>
            ) : (
              <Card className='overflow-hidden border-border/60'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Stack</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className='text-right'>Links</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map(project => (
                      <TableRow key={project.id}>
                        <TableCell className='whitespace-nowrap text-xs text-muted-foreground'>
                          {project.date}
                        </TableCell>
                        <TableCell>
                          <Badge variant='secondary'>{project.category}</Badge>
                        </TableCell>
                        <TableCell className='font-medium'>{project.title}</TableCell>
                        <TableCell className='text-xs text-muted-foreground'>
                          {project.stack.length ? project.stack.join(' / ') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant='outline'
                            className={cn('border', getStatusClassName(project.status))}
                          >
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='inline-flex items-center gap-2'>
                            <Button variant='ghost' size='sm' asChild>
                              <a href={project.url} target='_blank' rel='noopener noreferrer'>
                                <ExternalLink className='h-4 w-4' />
                                Visit
                              </a>
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => handlePreview(project)}
                            >
                              <Eye className='h-4 w-4' />
                              Preview
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </section>

          <section className='mt-10 grid gap-4 md:grid-cols-2'>
            <Card className='border-border/60'>
              <CardHeader>
                <CardTitle className='text-base'>Type A: Iframe Embed</CardTitle>
                <CardDescription>
                  홈랩/내부 서비스처럼 보안 헤더를 제어 가능한 프로젝트는 LightBox Modal에서 iframe으로 미리보기를 제공합니다.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className='border-border/60'>
              <CardHeader>
                <CardTitle className='text-base'>Type B: Direct Link</CardTitle>
                <CardDescription>
                  외부 서비스 또는 보안 정책상 frame-ancestors 제한이 있는 프로젝트는 새 탭에서 열리도록 처리합니다.
                </CardDescription>
              </CardHeader>
            </Card>
          </section>
        </>
      )}

      <ProjectModal
        open={modalOpen}
        project={activeProject}
        onOpenChange={next => {
          setModalOpen(next);
          if (!next) setActiveProject(null);
        }}
      />
    </div>
  );
};

export default Projects;
