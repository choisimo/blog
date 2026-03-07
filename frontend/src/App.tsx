import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Header, Footer } from './components/organisms';
import { ErrorBoundary, AuthGuard } from './components/common';
import { Toaster } from './components/ui/toaster';
import { TooltipProvider } from './components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/public/Index';
import Blog from './pages/public/Blog';
import BlogPost from './pages/public/BlogPost';
import About from './pages/public/About';
import Projects from './pages/public/Projects';
import NewPost from './pages/admin/NewPost';
import NotFound from './pages/public/NotFound';
import Insight from './pages/public/Insight';
import AdminConfig from './pages/admin/AdminConfig';
import AdminAuthCallback from './pages/admin/AdminAuthCallback';
import './App.css';
import { VisitedPostsMinimap } from '@/components/features/navigation/VisitedPostsMinimap';
import FloatingActionBar from '@/components/features/memo/FloatingActionBar';
import { initFeatureFlags, disposeFeatureFlags } from '@/stores/runtime/useFeatureFlagsStore';
import { initNotificationSSE, disposeNotificationSSE } from '@/services/realtime/notificationSSE';

const queryClient = new QueryClient();

function App() {
  const [fabOn, setFabOn] = useState(true);

  useEffect(() => {
    initFeatureFlags();
    return () => {
      disposeFeatureFlags();
    };
  }, []);

  useEffect(() => {
    initNotificationSSE();
    return () => {
      disposeNotificationSSE();
    };
  }, []);

  useEffect(() => {
    const getFabEnabled = () => {
      try {
        const ls = localStorage.getItem('aiMemo.fab.enabled');
        if (ls != null) return !!JSON.parse(ls);
      } catch {
        void 0;
      }

      const envFlag = import.meta.env.VITE_FEATURE_FAB;
      if (envFlag != null) {
        return envFlag === 'true' || envFlag === '1';
      }

      return true;
    };
    setFabOn(getFabEnabled());

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'aiMemo.fab.enabled') setFabOn(getFabEnabled());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Router>
                <div className='min-h-screen flex flex-col bg-background text-foreground'>
                  <Header />
                  <main className='flex-1 pb-[110px] md:pb-[84px] lg:pb-[96px]'>
                    <Routes>
                      <Route path='/' element={<Index />} />
                      <Route path='/blog' element={<Blog />} />
                      <Route path='/blog/:year/:slug' element={<BlogPost />} />
                      <Route path='/post/:year/:slug' element={<BlogPost />} />
                      <Route path='/projects' element={<Projects />} />
                      <Route path='/about' element={<About />} />
                      <Route path='/contact' element={<Navigate to='/about' replace />} />
                      <Route path='/insight' element={<Insight />} />
                      <Route path='/admin/new-post' element={
                        <AuthGuard>
                          <NewPost />
                        </AuthGuard>
                      } />
                      <Route path='/admin/config' element={<AdminConfig />} />
                      <Route path='/admin/auth/callback' element={<AdminAuthCallback />} />
                      <Route path='*' element={<NotFound />} />
                    </Routes>
                  </main>
                  <Footer />
                  {!fabOn && <VisitedPostsMinimap />}
                  <FloatingActionBar />
                  <Toaster />
                </div>
              </Router>
            </TooltipProvider>
          </ThemeProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
