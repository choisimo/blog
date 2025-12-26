import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { Header, Footer } from './components/organisms';
import { Toaster } from './components/ui/toaster';
import { TooltipProvider } from './components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import About from './pages/About';
import Contact from './pages/Contact';
import NewPost from './pages/NewPost';
import NotFound from './pages/NotFound';
import Insight from './pages/Insight';
import AdminConfig from './pages/AdminConfig';
import './App.css';
import { VisitedPostsMinimap } from '@/components/features/navigation/VisitedPostsMinimap';
import FloatingActionBar from '@/components/features/memo/FloatingActionBar';

const queryClient = new QueryClient();

function App() {
  console.log('[App] component init');
  const [fabOn, setFabOn] = useState(false);
  useEffect(() => {
    console.log('[App] mounted');
    const getFabEnabled = () => {
      const envFlag = (import.meta as any).env?.VITE_FEATURE_FAB;
      const envOn = envFlag === true || envFlag === 'true' || envFlag === '1';
      try {
        const ls = localStorage.getItem('aiMemo.fab.enabled');
        if (ls != null) return !!JSON.parse(ls);
      } catch {}
      return !!envOn;
    };
    setFabOn(getFabEnabled());

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'aiMemo.fab.enabled') setFabOn(getFabEnabled());
    };
    window.addEventListener('storage', onStorage);
    return () => console.log('[App] unmounted');
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Router>
              <div className='min-h-screen flex flex-col bg-background text-foreground'>
                <Header />
                <main className='flex-1 pb-[110px] lg:pb-[60px]'>
                  <Routes>
                    <Route path='/' element={<Index />} />
                    <Route path='/blog' element={<Blog />} />
                    <Route path='/blog/:year/:slug' element={<BlogPost />} />
                    <Route path='/post/:year/:slug' element={<BlogPost />} />
                    <Route path='/about' element={<About />} />
                    <Route path='/contact' element={<Contact />} />
                    <Route path='/insight' element={<Insight />} />
                    <Route path='/admin/new-post' element={<NewPost />} />
                    <Route path='/admin/config' element={<AdminConfig />} />
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
  );
}

export default App;
