import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Mail, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { site } from '@/config/site';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { PageContainer } from '@/components/organisms/layout';
import { getApiBaseUrl } from '@/utils/network/apiBase';

type SubscribeStatus = 'idle' | 'loading' | 'success' | 'error';

const FOOTER_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const FOOTER_EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function normalizeFooterExternalHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const candidate = value.trim();
  if (!candidate || FOOTER_CONTROL_PATTERN.test(candidate) || /[\s\\]/.test(candidate)) {
    return null;
  }

  try {
    const url = new URL(candidate);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function buildFooterMailtoHref(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const email = value.trim();
  if (!email || FOOTER_CONTROL_PATTERN.test(email) || !FOOTER_EMAIL_PATTERN.test(email)) {
    return null;
  }

  return `mailto:${email}`;
}

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { isTerminal } = useTheme();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<SubscribeStatus>('idle');
  const [message, setMessage] = useState('');
  const githubHref = normalizeFooterExternalHref(site.social.github);
  const twitterHref = normalizeFooterExternalHref(site.social.twitter);
  const linkedinHref = normalizeFooterExternalHref(site.social.linkedin);
  const emailHref = buildFooterMailtoHref(site.email);

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    
    const normalizedEmail = email.trim();
    if (!FOOTER_EMAIL_PATTERN.test(normalizedEmail)) {
      setStatus('error');
      setMessage('유효한 이메일 주소를 입력해주세요.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/v1/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error('구독을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }

      setStatus('success');
      if (data.data?.alreadySubscribed) {
        setMessage('이미 구독 중입니다.');
      } else {
        setMessage('확인 이메일을 발송했습니다. 메일함을 확인해주세요!');
        setEmail('');
      }
    } catch {
      setStatus('error');
      setMessage('구독을 완료하지 못했습니다. 연결을 확인하고 다시 시도해 주세요.');
    }
  };

  return (
    <footer className={cn('ui-footer', isTerminal && 'font-mono')}>
      <PageContainer>
        <div className="ui-footer__top">
          <div className="ui-footer__identity">
            <h2 className="ui-footer__title">{isTerminal ? '>_ Nodove Blog' : 'Nodove Blog'}</h2>
            <p className="ui-footer__description">AI, 시스템 설계, 그리고 코드에 관한 기록.</p>
            <nav className="ui-footer__links" aria-label="Footer navigation">
              <Link to="/">Home</Link><Link to="/blog">Blog</Link><Link to="/projects">Projects</Link><Link to="/about">About</Link>
            </nav>
            <nav className="ui-footer__links ui-footer__categories" aria-label="Categories">
              <Link to="/blog?category=ai">AI &amp; Machine Learning</Link>
              <Link to="/blog?category=web">Web Development</Link>
              <Link to="/blog?category=devops">DevOps</Link>
              <Link to="/blog?category=algorithms">Algorithms</Link>
            </nav>
            <div className="ui-footer__social">
              {githubHref && <a href={githubHref} target="_blank" rel="noopener noreferrer"><Github aria-hidden="true" className="h-4 w-4" />GitHub<span className="sr-only"> (새 창)</span></a>}
              {twitterHref && <a href={twitterHref} target="_blank" rel="noopener noreferrer"><Twitter aria-hidden="true" className="h-4 w-4" />Twitter<span className="sr-only"> (새 창)</span></a>}
              {linkedinHref && <a href={linkedinHref} target="_blank" rel="noopener noreferrer"><Linkedin aria-hidden="true" className="h-4 w-4" />LinkedIn<span className="sr-only"> (새 창)</span></a>}
              {emailHref && <a href={emailHref}><Mail aria-hidden="true" className="h-4 w-4" />Email</a>}
            </div>
          </div>
          <section className="ui-footer__subscribe" aria-labelledby="footer-subscribe-title">
            <h2 id="footer-subscribe-title" className="ui-footer__title">Subscribe</h2>
            <p id="footer-subscribe-help" className="ui-footer__description">최신 글을 메일로 받아보세요.</p>
            <form onSubmit={handleSubscribe} aria-busy={status === 'loading'}>
              <label htmlFor="footer-subscribe-email" className="ui-footer__label">이메일 주소</label>
              <div className="ui-footer__form-row">
                <input id="footer-subscribe-email" type="email" autoComplete="email" value={email}
                  onChange={(e) => { setEmail(e.target.value); setStatus('idle'); setMessage(''); }} placeholder="email@example.com" disabled={status === 'loading'}
                  required maxLength={254} aria-invalid={status === 'error' && !FOOTER_EMAIL_PATTERN.test(email.trim())} aria-describedby="footer-subscribe-help footer-subscribe-status"
                  className="ui-footer__input" />
                <Button type="submit" disabled={status === 'loading'} variant="outline" className="ui-footer__submit">
                  {status === 'loading' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />신청 중…</>
                    : status === 'success' ? <><CheckCircle className="mr-2 h-4 w-4" aria-hidden="true" />신청 완료</>
                      : '구독하기'}
                </Button>
              </div>
              <p id="footer-subscribe-status" role={status === 'error' ? 'alert' : 'status'} aria-live={status === 'error' ? 'assertive' : 'polite'}
                className={cn('ui-footer__feedback', status === 'error' && 'ui-footer__feedback--error')}>{message}</p>
            </form>
          </section>
        </div>
        <p className="ui-footer__copyright">© {currentYear} Nodove Blog. All rights reserved.</p>
      </PageContainer>
    </footer>
  );
}
