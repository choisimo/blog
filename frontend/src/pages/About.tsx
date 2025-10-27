import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Github, Linkedin, Mail, Globe } from 'lucide-react';

const About = () => {
  const skills = [
    'React',
    'TypeScript',
    'Node.js',
    'Python',
    'Docker',
    'Kubernetes',
    'AWS',
    'Machine Learning',
    'DevOps',
    'Spring Boot',
  ];

  return (
    <div className='container mx-auto px-4 py-12 max-w-4xl'>
      <div className='space-y-8'>
        <div className='text-center space-y-4'>
          <h1 className='text-4xl font-bold tracking-tight'>About Me</h1>
          <p className='text-xl text-muted-foreground'>
            Software Developer | Tech Enthusiast | Problem Solver
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Hi, I'm Nodove 👋</CardTitle>
            <CardDescription>
              Passionate about building innovative solutions
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='prose prose-neutral dark:prose-invert max-w-none'>
              <p>
                I'm a software developer with a passion for creating efficient,
                scalable, and user-friendly applications. With expertise in both
                frontend and backend technologies, I enjoy tackling complex
                problems and turning ideas into reality.
              </p>
              <p>
                Through this blog, I share my experiences, insights, and
                learnings from various projects and technologies. Whether it's
                about the latest AI models, web development frameworks, or
                DevOps practices, I aim to provide valuable content that helps
                fellow developers in their journey.
              </p>
            </div>

            <div>
              <h3 className='text-lg font-semibold mb-3'>
                Skills & Technologies
              </h3>
              <div className='flex flex-wrap gap-2'>
                {skills.map(skill => (
                  <Badge key={skill} variant='secondary'>
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className='text-lg font-semibold mb-3'>Connect with me</h3>
              <div className='flex flex-wrap gap-3'>
                <Button variant='outline' size='sm' asChild>
                  <a
                    href='https://github.com'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Github className='mr-2 h-4 w-4' />
                    GitHub
                  </a>
                </Button>
                <Button variant='outline' size='sm' asChild>
                  <a
                    href='https://linkedin.com'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Linkedin className='mr-2 h-4 w-4' />
                    LinkedIn
                  </a>
                </Button>
                <Button variant='outline' size='sm' asChild>
                  <a href='mailto:contact@nodove.com'>
                    <Mail className='mr-2 h-4 w-4' />
                    Email
                  </a>
                </Button>
                <Button variant='outline' size='sm' asChild>
                  <a
                    href='https://nodove.com'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Globe className='mr-2 h-4 w-4' />
                    Website
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My Mission</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground'>
              To contribute to the tech community by sharing knowledge, creating
              useful tools, and helping others grow in their software
              development journey. I believe in continuous learning and the
              power of collaboration to drive innovation forward.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default About;
