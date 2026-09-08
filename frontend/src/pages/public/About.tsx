import { useState } from 'react';
import {
  BrainCircuit,
  Cloud,
  Code2,
  Github,
  Linkedin,
  Mail,
  Send,
  Shield,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { site } from '@/config/site';
import { sendContactMessage } from '@/services/engagement/contact';
import { useSEO } from '@/hooks/seo/useSEO';
import { generateSEOData, generateStructuredData } from '@/utils/seo/seo';
import {
  normalizeAboutEmailHref,
  normalizeAboutSocialHref,
} from '@/utils/aboutLinks';

interface ContactFormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const initialFormState: ContactFormState = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

const historyTimeline = [
  {
    period: '2024',
    title: 'CS 전공 심화',
    description: '알고리즘, 운영체제, 네트워크 중심으로 기반을 강화했습니다.',
  },
  {
    period: '2025',
    title: 'AI + 시스템 아키텍처 프로젝트',
    description: 'RAG 기반 도구와 홈랩 인프라 자동화 프로젝트를 병행했습니다.',
  },
  {
    period: '2026 (예정)',
    title: '졸업 및 엔지니어링 확장',
    description:
      '생산성 도구와 AI 서비스 아키텍처를 결합하는 개발을 진행 중입니다.',
  },
] as const;

const stackSections = [
  {
    title: 'AI & LLM Engineering',
    icon: BrainCircuit,
    badges: ['LangChain', 'LangGraph', 'LiteLLM', 'RAG', 'n8n'],
    details: [
      'LLM Orchestration: LangChain/LangGraph 기반 Multi-Agent 및 Stateful Workflow 설계',
      'Model Serving: LiteLLM 기반 모델 추상화 + Custom OpenAI-compatible Server 구축',
      'RAG: 벡터 데이터베이스 연동 및 문서 기반 질의응답 시스템 구현',
      'Automation: n8n 기반 AI 워크플로우 자동화 및 데이터 파이프라인 구성',
    ],
  },
  {
    title: 'DevOps & Infrastructure',
    icon: Cloud,
    badges: ['Proxmox', 'Docker', 'Docker Compose', 'Kubernetes', 'Ansible', 'Arch Linux'],
    details: [
      'Proxmox VE: LXC/VM 클러스터 운영, 자원 최적화 및 홈랩 인프라 관리',
      'Container: Docker/Compose 기반 복잡한 스택 구성 및 ComposeAI 프로젝트 개발',
      'Kubernetes: 기초 운영 및 배포 워크플로우 실습',
      'IaC/Config: Ansible 기반 서버 프로비저닝 및 설정 자동화',
      'OS: Arch Linux 메인 사용, 커널/시스템 레벨 트러블슈팅 경험',
    ],
  },
  {
    title: 'Network & Security',
    icon: Shield,
    badges: ['OPNsense', 'VLAN', 'Tailscale', 'WireGuard', 'Consul', 'Nginx'],
    details: [
      'Network Security: OPNsense 방화벽 정책 관리 및 VLAN 구성',
      'VPN & Mesh: Tailscale/WireGuard 기반 사설망 원격 접속 및 Site-to-Site 구성',
      'Service Discovery: Consul KV Store 활용 및 서비스 헬스 체크',
      'Traffic Management: Nginx Reverse Proxy 및 SSL/TLS Termination',
    ],
  },
  {
    title: 'Languages & Backend',
    icon: Code2,
    badges: ['Java', 'Spring Boot', 'Python', 'Go', 'Dart', 'Flutter'],
    details: [
      'Java (Spring Boot): 핵심 메인 서비스 개발에 사용',
      'Python: 보조 언어로 Asyncio/AI-ML 라이브러리 활용',
      'Go: 고성능 툴링 및 네트워크 프록시 컨트롤 중심으로 학습/적용',
      'Dart & Flutter: 크로스 플랫폼 모바일 UI/UX 구현 학습 중',
    ],
  },
] as const;

const About = () => {
  useSEO(
    generateSEOData(undefined, 'about'),
    generateStructuredData(undefined, 'about')
  );

  const [formData, setFormData] = useState<ContactFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<'success' | 'error' | null>(
    null
  );
  const githubHref = normalizeAboutSocialHref(site.social.github);
  const linkedinUrl = normalizeAboutSocialHref(site.social.linkedin);
  const linkedinHref =
    linkedinUrl && new URL(linkedinUrl).pathname !== '/' ? linkedinUrl : null;
  const emailHref = normalizeAboutEmailHref(site.email);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setSubmitResult(null);
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      await sendContactMessage(formData);
      setSubmitResult('success');
      setFormData(initialFormState);
    } catch {
      setSubmitResult('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className='ui-page ui-about-page ui-page-container fn-about fn-shell fn-page-space'
      data-ui-page='about'
    >
      <header className='ui-page-heading'>
        <p className='fn-eyebrow'>ABOUT / THINKING IN PUBLIC</p>
        <h1>
          질문하고, 연결하고,
          <br />
          기록합니다.
        </h1>
        <p>
          CS 전공 기반 위에서 AI와 시스템 아키텍처를 중심으로 프로젝트를 만들고
          있습니다.
        </p>
        <nav className='ui-actions mt-5' aria-label='소개 페이지 바로가기'>
          <a href='#contact' className='ui-control' data-ui-variant='default'>
            <Mail className='h-4 w-4' aria-hidden='true' />
            연락하기
          </a>
          <a href='#skills' className='ui-control' data-ui-variant='outline'>
            기술과 작업 분야
          </a>
        </nav>
      </header>

      <div className='ui-about-layout fn-about-layout'>
        <Card
          className='ui-panel ui-about-profile'
          role='region'
          aria-labelledby='about-profile-title'
        >
          <CardHeader className='ui-panel-header space-y-4'>
            <div className='flex items-center gap-4'>
              <Avatar
                className='h-12 w-12 shrink-0 border border-border/60'
                aria-hidden='true'
              >
                <AvatarFallback className='text-lg font-semibold'>
                  ND
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0'>
                <h2
                  id='about-profile-title'
                  className='ui-panel-title text-2xl'
                >
                  Nodove
                </h2>
                <CardDescription className='ui-description mt-1'>
                  CS 전공 · AI와 시스템 아키텍처에 관심 있는 개발자
                </CardDescription>
              </div>
            </div>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              2026년 졸업 예정이며, 백엔드/인프라/AI 경계를 넘나드는 제품 지향
              개발을 선호합니다. 문제를 구조화하고, 자동화 가능한 시스템으로
              바꾸는 과정을 즐깁니다.
            </p>
          </CardHeader>
          <CardContent className='ui-panel-body space-y-6'>
            <section aria-labelledby='about-history-title'>
              <h3
                id='about-history-title'
                className='mb-4 text-sm font-semibold text-muted-foreground'
              >
                지금까지의 과정
              </h3>
              <ol className='space-y-4'>
                {historyTimeline.map(item => (
                  <li key={item.period} className='relative pl-5'>
                    <span
                      className='absolute left-0 top-2 h-2 w-2 rounded-full bg-primary'
                      aria-hidden='true'
                    />
                    <p className='text-xs font-medium text-primary'>
                      {item.period}
                    </p>
                    <h4 className='text-sm font-semibold'>{item.title}</h4>
                    <p className='text-sm leading-relaxed text-muted-foreground'>
                      {item.description}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
            {(githubHref || linkedinHref || emailHref) && (
              <section aria-labelledby='about-links-title'>
                <h3
                  id='about-links-title'
                  className='mb-3 text-sm font-semibold text-muted-foreground'
                >
                  다른 곳에서 만나기
                </h3>
                <div className='ui-actions'>
                  {githubHref && (
                    <Button
                      className='ui-control'
                      data-ui-variant='outline'
                      variant='outline'
                      size='sm'
                      asChild
                    >
                      <a
                        href={githubHref}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        <Github className='h-4 w-4' aria-hidden='true' />
                        GitHub<span className='sr-only'> · 새 탭</span>
                      </a>
                    </Button>
                  )}
                  {linkedinHref && (
                    <Button
                      className='ui-control'
                      data-ui-variant='outline'
                      variant='outline'
                      size='sm'
                      asChild
                    >
                      <a
                        href={linkedinHref}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        <Linkedin className='h-4 w-4' aria-hidden='true' />
                        LinkedIn<span className='sr-only'> · 새 탭</span>
                      </a>
                    </Button>
                  )}
                  {emailHref && (
                    <Button
                      className='ui-control'
                      data-ui-variant='outline'
                      variant='outline'
                      size='sm'
                      asChild
                    >
                      <a href={emailHref}>
                        <Mail className='h-4 w-4' aria-hidden='true' />
                        이메일
                      </a>
                    </Button>
                  )}
                </div>
              </section>
            )}
          </CardContent>
        </Card>

        <Card
          className='ui-panel ui-about-contact scroll-mt-24'
          id='contact'
          role='region'
          aria-labelledby='about-contact-title'
        >
          <CardHeader className='ui-panel-header'>
            <p className='fn-eyebrow'>CONTACT / START A CONVERSATION</p>
            <h2 id='about-contact-title' className='ui-panel-title'>
              메시지 보내기
            </h2>
            <CardDescription className='ui-description'>
              프로젝트 제안, 기술 이야기, 블로그에 대한 의견을 남겨 주세요.
            </CardDescription>
          </CardHeader>
          <CardContent className='ui-panel-body'>
            <form
              className='space-y-4'
              onSubmit={handleSubmit}
              aria-labelledby='about-contact-title'
              aria-describedby='contact-form-help'
            >
              <p
                id='contact-form-help'
                className='text-sm leading-relaxed text-muted-foreground'
              >
                모든 항목을 입력해 주세요. 답변을 받을 이메일 주소를 확인해
                주세요.
              </p>
              <fieldset disabled={isSubmitting} className='min-w-0 space-y-4'>
                <legend className='sr-only'>문의 내용</legend>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='min-w-0 space-y-2'>
                    <Label className='ui-label' htmlFor='name'>
                      이름
                    </Label>
                    <Input
                      className='ui-input'
                      id='name'
                      name='name'
                      autoComplete='name'
                      maxLength={120}
                      value={formData.name}
                      onChange={handleChange}
                      placeholder='어떻게 불러드릴까요?'
                      required
                    />
                  </div>
                  <div className='min-w-0 space-y-2'>
                    <Label className='ui-label' htmlFor='email'>
                      이메일
                    </Label>
                    <Input
                      className='ui-input'
                      id='email'
                      name='email'
                      type='email'
                      autoComplete='email'
                      maxLength={254}
                      value={formData.email}
                      onChange={handleChange}
                      placeholder='you@example.com'
                      required
                    />
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label className='ui-label' htmlFor='subject'>
                    제목
                  </Label>
                  <Input
                    className='ui-input'
                    id='subject'
                    name='subject'
                    maxLength={200}
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder='어떤 이야기를 나누고 싶으신가요?'
                    required
                  />
                </div>
                <div className='space-y-2'>
                  <Label className='ui-label' htmlFor='message'>
                    메시지
                  </Label>
                  <Textarea
                    className='ui-textarea'
                    id='message'
                    name='message'
                    rows={6}
                    maxLength={5000}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder='내용을 자유롭게 적어 주세요.'
                    aria-describedby='contact-message-limit'
                    required
                  />
                  <p
                    id='contact-message-limit'
                    className='text-right text-xs tabular-nums text-muted-foreground'
                  >
                    {formData.message.length.toLocaleString('ko-KR')} / 5,000자
                  </p>
                </div>
                <Button
                  data-ui-variant='default'
                  type='submit'
                  disabled={isSubmitting}
                  className='ui-control w-full sm:w-auto'
                >
                  <Send className='h-4 w-4' aria-hidden='true' />
                  {isSubmitting ? '보내는 중…' : '메시지 보내기'}
                </Button>
              </fieldset>
              <div role='status' aria-live='polite' aria-atomic='true'>
                {isSubmitting && (
                  <p className='ui-inline-status'>
                    메시지를 보내고 있습니다. 잠시만 기다려 주세요.
                  </p>
                )}
                {submitResult === 'success' && (
                  <p className='ui-inline-status'>
                    메시지가 접수되었습니다. 작성해 주셔서 감사합니다.
                  </p>
                )}
              </div>
              {submitResult === 'error' && (
                <div className='ui-inline-error' role='alert'>
                  <p>
                    메시지를 보내지 못했습니다. 입력한 내용은 유지됩니다. 잠시
                    후 다시 시도해 주세요.
                  </p>
                  {emailHref && (
                    <a href={emailHref} className='ui-text-action'>
                      이메일로 직접 보내기
                    </a>
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
      <Card
        className='ui-panel ui-about-skills scroll-mt-24'
        id='skills'
        role='region'
        aria-labelledby='about-skills-title'
      >
        <CardHeader className='ui-panel-header'>
          <h2 id='about-skills-title' className='ui-panel-title'>
            기술과 작업 분야
          </h2>
          <CardDescription className='ui-description'>
            프로젝트에서 사용한 도구와 경험을 분야별로 정리했습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className='ui-panel-body space-y-4'>
          {stackSections.map(({ title, icon: Icon, badges, details }) => (
            <section
              key={title}
              className='ui-about-skill rounded-lg border border-border bg-card p-4'
            >
              <div className='flex items-start gap-3'>
                <Icon
                  className='mt-0.5 h-5 w-5 shrink-0 text-primary'
                  aria-hidden='true'
                />
                <h3 className='min-w-0 text-base font-semibold'>{title}</h3>
              </div>
              <div
                className='mt-3 flex flex-wrap gap-2'
                aria-label={`${title} 사용 기술`}
              >
                {badges.map(badge => (
                  <Badge
                    key={badge}
                    variant='secondary'
                    className='max-w-full whitespace-normal break-words text-xs'
                  >
                    {badge}
                  </Badge>
                ))}
              </div>
              <ul className='mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground'>
                {details.map(detail => (
                  <li key={detail} className='flex items-start gap-2'>
                    <span className='text-primary' aria-hidden='true'>
                      •
                    </span>
                    <span className='min-w-0'>{detail}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default About;
