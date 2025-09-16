import { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { Header, Footer } from './components/organisms';
import { Toaster } from './components/ui/toaster';
import { TooltipProvider } from './components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Index from './pages/Index';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';
import './App.css';

const queryClient = new QueryClient();

function App() {
  console.log('[App] component init');
  useEffect(() => {
    console.log('[App] mounted');
    return () => console.log('[App] unmounted');
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Router>
            <div className='min-h-screen flex flex-col bg-background text-foreground'>
              <Header />
              <main className='flex-1'>
                <Routes>
                  <Route path='/' element={<Index />} />
                  <Route path='/blog' element={<Blog />} />
                  <Route path='/blog/:year/:slug' element={<BlogPost />} />
                  <Route path='/post/:year/:slug' element={<BlogPost />} />
                  <Route path='/about' element={<About />} />
                  <Route path='/contact' element={<Contact />} />
                  <Route path='*' element={<NotFound />} />
                </Routes>
              </main>
              <Footer />
              <Toaster />
            </div>
          </Router>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
