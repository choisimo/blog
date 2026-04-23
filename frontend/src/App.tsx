import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { Header, Footer } from "./components/organisms";
import { ErrorBoundary, AuthGuard } from "./components/common";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const Index = lazy(() => import("./pages/public/Index"));
const Blog = lazy(() => import("./pages/public/Blog"));
const BlogPost = lazy(() => import("./pages/public/BlogPost"));
const About = lazy(() => import("./pages/public/About"));
const BadRequest = lazy(() => import("./pages/public/BadRequest"));
const Debate = lazy(() => import("./pages/public/Debate"));
const Forbidden = lazy(() => import("./pages/public/Forbidden"));
const Projects = lazy(() => import("./pages/public/Projects"));
const NewPost = lazy(() => import("./pages/admin/NewPost"));
const NotFound = lazy(() => import("./pages/public/NotFound"));
const Insight = lazy(() => import("./pages/public/Insight"));
const ServerError = lazy(() => import("./pages/public/ServerError"));
const ServiceUnavailable = lazy(
  () => import("./pages/public/ServiceUnavailable"),
);
const TooManyRequests = lazy(() => import("./pages/public/TooManyRequests"));
const Unauthorized = lazy(() => import("./pages/public/Unauthorized"));
const AdminConfig = lazy(() => import("./pages/admin/AdminConfig"));
const AdminAuthCallback = lazy(() => import("./pages/admin/AdminAuthCallback"));
import "./App.css";
const VisitedPostsMinimap = lazy(() =>
  import("@/components/features/navigation/VisitedPostsMinimap").then((m) => ({
    default: m.VisitedPostsMinimap,
  })),
);
const FloatingActionBar = lazy(
  () => import("@/components/features/memo/FloatingActionBar"),
);
import {
  initFeatureFlags,
  disposeFeatureFlags,
} from "@/stores/runtime/useFeatureFlagsStore";
import {
  initNotificationSSE,
  disposeNotificationSSE,
} from "@/services/realtime/notificationSSE";
import { adminAccessTokenProvider } from "@/services/core/admin-access-token.provider";
import {
  startHeartbeat,
  stopHeartbeat,
} from "@/services/content/analytics";
import { PageTransitionFallback } from "@/components/atoms";
import { useAuthStore } from "@/stores/session/useAuthStore";
import { isTokenExpired } from "@/services/session/auth";
import { useNotificationStore } from "@/stores/realtime/useNotificationStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [fabOn, setFabOn] = useState(true);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const hasAdminSession = useMemo(() => {
    if (accessToken && !isTokenExpired(accessToken, 0)) return true;
    if (refreshToken && !isTokenExpired(refreshToken, 0)) return true;
    return false;
  }, [accessToken, refreshToken]);

  useEffect(() => {
    initFeatureFlags();
    return () => {
      disposeFeatureFlags();
    };
  }, []);

  useEffect(() => {
    const syncHeartbeat = () => {
      if (document.hidden) {
        stopHeartbeat();
        return;
      }

      startHeartbeat();
    };

    syncHeartbeat();
    document.addEventListener("visibilitychange", syncHeartbeat);

    return () => {
      document.removeEventListener("visibilitychange", syncHeartbeat);
      stopHeartbeat();
    };
  }, []);

  useEffect(() => {
    if (!hasAdminSession) {
      disposeNotificationSSE();
      useNotificationStore.getState().clearAll();
      return;
    }

    initNotificationSSE({ tokenProvider: adminAccessTokenProvider });
    return () => {
      disposeNotificationSSE();
    };
  }, [hasAdminSession]);

  useEffect(() => {
    const getFabEnabled = () => {
      try {
        const ls = localStorage.getItem("aiMemo.fab.enabled");
        if (ls != null) return !!JSON.parse(ls);
      } catch {
        void 0;
      }

      const envFlag = import.meta.env.VITE_FEATURE_FAB;
      if (envFlag != null) {
        return envFlag === "true" || envFlag === "1";
      }

      return true;
    };
    setFabOn(getFabEnabled());

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "aiMemo.fab.enabled") setFabOn(getFabEnabled());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <Router>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LanguageProvider>
            <ThemeProvider>
              <TooltipProvider>
                <div className="min-h-screen flex flex-col bg-background text-foreground">
                  <Header />
                  <main className="flex-1 pb-[calc(110px+env(safe-area-inset-bottom,0px))] md:pb-[calc(84px+env(safe-area-inset-bottom,0px))] lg:pb-[calc(96px+env(safe-area-inset-bottom,0px))]">
                    <Suspense fallback={<PageTransitionFallback />}>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route
                          path="/blog/:year/:slug"
                          element={<BlogPost />}
                        />
                        <Route
                          path="/post/:year/:slug"
                          element={<BlogPost />}
                        />
                        <Route path="/projects" element={<Projects />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/debate" element={<Debate />} />
                        <Route
                          path="/contact"
                          element={<Navigate to="/about" replace />}
                        />
                        <Route path="/insight" element={<Insight />} />
                        <Route path="/400" element={<BadRequest />} />
                        <Route path="/401" element={<Unauthorized />} />
                        <Route path="/403" element={<Forbidden />} />
                        <Route path="/404" element={<NotFound />} />
                        <Route path="/429" element={<TooManyRequests />} />
                        <Route path="/500" element={<ServerError />} />
                        <Route path="/503" element={<ServiceUnavailable />} />
                        <Route
                          path="/bad-request"
                          element={<Navigate to="/400" replace />}
                        />
                        <Route
                          path="/unauthorized"
                          element={<Navigate to="/401" replace />}
                        />
                        <Route
                          path="/forbidden"
                          element={<Navigate to="/403" replace />}
                        />
                        <Route
                          path="/too-many-requests"
                          element={<Navigate to="/429" replace />}
                        />
                        <Route
                          path="/error"
                          element={<Navigate to="/500" replace />}
                        />
                        <Route
                          path="/server-error"
                          element={<Navigate to="/500" replace />}
                        />
                        <Route
                          path="/maintenance"
                          element={<Navigate to="/503" replace />}
                        />
                        <Route
                          path="/admin/login"
                          element={<AdminConfig />}
                        />
                        <Route
                          path="/admin/new-post"
                          element={
                            <AuthGuard>
                              <NewPost />
                            </AuthGuard>
                          }
                        />
                        <Route
                          path="/admin/config"
                          element={
                            <AuthGuard>
                              <AdminConfig />
                            </AuthGuard>
                          }
                        />
                        <Route
                          path="/admin/config/:section"
                          element={
                            <AuthGuard>
                              <AdminConfig />
                            </AuthGuard>
                          }
                        />
                        <Route
                          path="/admin/config/:section/:subtab"
                          element={
                            <AuthGuard>
                              <AdminConfig />
                            </AuthGuard>
                          }
                        />
                        <Route
                          path="/admin/auth/callback"
                          element={<AdminAuthCallback />}
                        />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </main>
                  <Footer />
                  <Suspense fallback={null}>
                    {!fabOn && <VisitedPostsMinimap />}
                  </Suspense>
                  <Suspense fallback={null}>
                    <FloatingActionBar />
                  </Suspense>
                  <Toaster />
                </div>
              </TooltipProvider>
            </ThemeProvider>
          </LanguageProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
