import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { Loader2 } from 'lucide-react';
import { getMe } from '@/services/session/auth';
import { DEFAULT_ADMIN_PATH } from '@/services/session/adminReturnTo';

interface AuthGuardProps {
    children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
    const { isAuthenticated, getValidAccessToken, logout } = useAuthStore();
    const [isVerifying, setIsVerifying] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const location = useLocation();

    useEffect(() => {
        let isMounted = true;

        async function verifyAuth() {
            if (!isAuthenticated()) {
                if (isMounted) {
                    setIsAuthorized(false);
                    setIsVerifying(false);
                }
                return;
            }

            const token = await getValidAccessToken();
            if (!token) {
                if (isMounted) {
                    setIsAuthorized(false);
                    setIsVerifying(false);
                }
                return;
            }

            try {
                // Option 1: Just verify token is valid by calling getMe
                // To be safer, we could also check if user.role === 'ADMIN' if that's returned.
                await getMe(token);
                if (isMounted) {
                    setIsAuthorized(true);
                }
            } catch (err) {
                console.error('AuthGuard verification failed:', err);
                await logout();
                if (isMounted) {
                    setIsAuthorized(false);
                }
            } finally {
                if (isMounted) {
                    setIsVerifying(false);
                }
            }
        }

        verifyAuth();

        return () => {
            isMounted = false;
        };
    }, [isAuthenticated, getValidAccessToken, logout]);

    if (isVerifying) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthorized) {
        const from =
          `${location.pathname}${location.search}${location.hash}` ||
          DEFAULT_ADMIN_PATH;
        return <Navigate to="/admin/login" replace state={{ from }} />;
    }

    return <>{children}</>;
}
