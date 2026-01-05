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
import { useUIStrings } from '@/utils/i18n/uiStrings';

const About = () => {
  const str = useUIStrings();

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
          <h1 className='text-4xl font-bold tracking-tight'>{str.about.title}</h1>
          <p className='text-xl text-muted-foreground'>{str.about.subtitle}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{str.about.greeting}</CardTitle>
            <CardDescription>{str.about.greetingSubtitle}</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='prose prose-neutral dark:prose-invert max-w-none'>
              <p>{str.about.bio1}</p>
              <p>{str.about.bio2}</p>
            </div>

            <div>
              <h3 className='text-lg font-semibold mb-3'>{str.about.skills}</h3>
              <div className='flex flex-wrap gap-2'>
                {skills.map(skill => (
                  <Badge key={skill} variant='secondary'>
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className='text-lg font-semibold mb-3'>{str.about.connect}</h3>
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
            <CardTitle>{str.about.mission}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground'>{str.about.missionText}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default About;
