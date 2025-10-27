import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Mail, MessageSquare, Send } from 'lucide-react';
import { site } from '@/config/site';

const Contact = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send the form data to your backend
    toast({
      title: 'Message sent!',
      description: "Thank you for your message. I'll get back to you soon.",
    });
    setFormData({ name: '', email: '', subject: '', message: '' });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className='container mx-auto px-4 py-12 max-w-4xl'>
      <div className='space-y-8'>
        <div className='text-center space-y-4'>
          <h1 className='text-4xl font-bold tracking-tight'>Get in Touch</h1>
          <p className='text-xl text-muted-foreground'>
            Have a question or want to work together? I'd love to hear from you.
          </p>
        </div>

        <div className='grid gap-8 md:grid-cols-3'>
          <Card className='md:col-span-2'>
            <CardHeader>
              <CardTitle>Send me a message</CardTitle>
              <CardDescription>
                Fill out the form below and I'll get back to you as soon as
                possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className='space-y-6'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <div className='space-y-2'>
                    <Label htmlFor='name'>Name</Label>
                    <Input
                      id='name'
                      name='name'
                      placeholder='Your name'
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className='space-y-2'>
                    <Label htmlFor='email'>Email</Label>
                    <Input
                      id='email'
                      name='email'
                      type='email'
                      placeholder='your@email.com'
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='subject'>Subject</Label>
                  <Input
                    id='subject'
                    name='subject'
                    placeholder="What's this about?"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='message'>Message</Label>
                  <Textarea
                    id='message'
                    name='message'
                    placeholder='Your message...'
                    rows={6}
                    value={formData.message}
                    onChange={handleChange}
                    required
                  />
                </div>
                <Button type='submit' className='w-full sm:w-auto'>
                  <Send className='mr-2 h-4 w-4' />
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className='space-y-4'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Mail className='h-5 w-5' />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={`mailto:${site.email}`}
                  className='text-sm text-muted-foreground hover:text-primary'
                >
                  {site.email}
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <MessageSquare className='h-5 w-5' />
                  Social
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-2'>
                <a
                  href={site.social.github}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block text-sm text-muted-foreground hover:text-primary'
                >
                  GitHub: @choisimo
                </a>
                <a
                  href={site.social.twitter}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block text-sm text-muted-foreground hover:text-primary'
                >
                  Twitter: @nodove
                </a>
                <a
                  href={site.social.linkedin}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='block text-sm text-muted-foreground hover:text-primary'
                >
                  LinkedIn: nodove
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
