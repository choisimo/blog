import { useState } from 'react';
import { BookOpen, Box, Cpu, Github, Layers, Linkedin, Mail, Send, Server, Terminal } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { site } from '@/config/site';
import { sendContactMessage } from '@/services/contact';
import { cn } from '@/lib/utils';

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
    description: '생산성 도구와 AI 서비스 아키텍처를 결합하는 개발을 진행 중입니다.',
  },
] as const;

const stackItems = [
  { name: 'Python', icon: CodeGlyph('Py'), accent: 'text-amber-600 dark:text-amber-300' },
  { name: 'Go', icon: CodeGlyph('Go'), accent: 'text-cyan-600 dark:text-cyan-300' },
  { name: 'Docker', icon: Box, accent: 'text-sky-600 dark:text-sky-300' },
  { name: 'Kubernetes', icon: Layers, accent: 'text-indigo-600 dark:text-indigo-300' },
  { name: 'Arch Linux', icon: Terminal, accent: 'text-blue-600 dark:text-blue-300' },
  { name: 'System Design', icon: Server, accent: 'text-emerald-600 dark:text-emerald-300' },
  { name: 'AI/LLM', icon: Cpu, accent: 'text-violet-600 dark:text-violet-300' },
  { name: 'CS Fundamentals', icon: BookOpen, accent: 'text-rose-600 dark:text-rose-300' },
] as const;

function CodeGlyph(label: string) {
  return function Glyph({ className }: { className?: string }) {
    return (
      <span
        className={cn(
          'inline-flex h-5 min-w-5 items-center justify-center rounded border border-current/30 px-1 text-[10px] font-semibold leading-none',
          className
        )}
      >
        {label}
      </span>
    );
  };
}

const About = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ContactFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const result = await sendContactMessage(formData);
      toast({
        title: 'Message sent',
        description:
          result.provider === 'emailjs'
            ? 'EmailJS를 통해 메시지를 전송했습니다.'
            : '문의가 정상적으로 접수되었습니다.',
      });
      setFormData(initialFormState);
    } catch (error) {
      toast({
        title: 'Failed to send',
        description:
          error instanceof Error
            ? error.message
            : '메시지를 전송하지 못했습니다. 잠시 후 다시 시도해주세요.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='container mx-auto max-w-6xl px-4 py-10'>
      <div className='mb-8 space-y-2'>
        <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>About</h1>
        <p className='max-w-3xl text-muted-foreground'>
          개발자로서의 정체성과 연락 창구를 한 페이지로 통합했습니다.
          CS 전공 기반 위에서 AI와 시스템 아키텍처를 중심으로 실전형 프로젝트를 만들고 있습니다.
        </p>
      </div>

      <div className='grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
        <Card className='border-border/60'>
          <CardHeader className='space-y-4'>
            <div className='flex items-center gap-4'>
              <Avatar className='h-20 w-20 border border-border/60'>
                <AvatarFallback className='text-lg font-semibold'>ND</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className='text-2xl'>Nodove</CardTitle>
                <CardDescription className='mt-1 text-sm'>
                  CS 전공, AI &amp; System Architecture에 관심 있는 개발자
                </CardDescription>
              </div>
            </div>
            <p className='text-sm leading-relaxed text-muted-foreground'>
              2026년 졸업 예정이며, 백엔드/인프라/AI 경계를 넘나드는 제품 지향 개발을 선호합니다.
              문제를 구조화하고, 자동화 가능한 시스템으로 바꾸는 과정을 즐깁니다.
            </p>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                History
              </h3>
              <ol className='space-y-4'>
                {historyTimeline.map(item => (
                  <li key={item.period} className='relative pl-5'>
                    <span className='absolute left-0 top-2 h-2 w-2 rounded-full bg-primary' />
                    <div className='text-xs font-medium text-primary'>{item.period}</div>
                    <div className='text-sm font-semibold'>{item.title}</div>
                    <p className='text-sm text-muted-foreground'>{item.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>

        <div className='space-y-6'>
          <Card className='border-border/60'>
            <CardHeader>
              <CardTitle>Contact &amp; Skill</CardTitle>
              <CardDescription>
                기술 스택과 소셜 링크, 그리고 페이지 이탈 없는 문의 폼을 함께 제공합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div>
                <h3 className='mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                  Tech Stack
                </h3>
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                  {stackItems.map(({ name, icon: Icon, accent }) => (
                    <Badge
                      key={name}
                      variant='secondary'
                      className='flex h-10 items-center justify-start gap-2 rounded-lg border border-border/70 bg-card/80 px-2'
                    >
                      <Icon className='h-4 w-4 text-muted-foreground' />
                      <span className={accent}>{name}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <h3 className='mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
                  Social Links
                </h3>
                <div className='flex flex-wrap gap-2'>
                  <Button variant='outline' size='sm' asChild>
                    <a href={site.social.github} target='_blank' rel='noopener noreferrer'>
                      <Github className='h-4 w-4' />
                      GitHub
                    </a>
                  </Button>
                  <Button variant='outline' size='sm' asChild>
                    <a href={site.social.linkedin} target='_blank' rel='noopener noreferrer'>
                      <Linkedin className='h-4 w-4' />
                      LinkedIn
                    </a>
                  </Button>
                  <Button variant='outline' size='sm' asChild>
                    <a href={`mailto:${site.email}`}>
                      <Mail className='h-4 w-4' />
                      Email
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className='border-border/60'>
            <CardHeader>
              <CardTitle>Send a Message</CardTitle>
              <CardDescription>
                EmailJS 또는 API(SendGrid 백엔드)로 연결되는 폼입니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className='space-y-4' onSubmit={handleSubmit}>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='name'>Name</Label>
                    <Input
                      id='name'
                      name='name'
                      value={formData.name}
                      onChange={handleChange}
                      placeholder='Your name'
                      required
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='email'>Email</Label>
                    <Input
                      id='email'
                      name='email'
                      type='email'
                      value={formData.email}
                      onChange={handleChange}
                      placeholder='you@domain.com'
                      required
                    />
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='subject'>Subject</Label>
                  <Input
                    id='subject'
                    name='subject'
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder='What would you like to discuss?'
                    required
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='message'>Message</Label>
                  <Textarea
                    id='message'
                    name='message'
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder='Write your message here...'
                    required
                  />
                </div>

                <Button type='submit' disabled={isSubmitting} className='w-full sm:w-auto'>
                  <Send className='h-4 w-4' />
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default About;
