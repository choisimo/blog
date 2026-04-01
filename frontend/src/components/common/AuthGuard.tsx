import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { Loader2 } from 'lucide-react';
import { getMe } from '@/services/session/auth';

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
        // If not authorized, redirect to login or home. 
        // Here we redirect to /admin/config which acts as the 'login' page currently.
        // However, if they are already trying to access an admin page, we should send them to
        // a dedicated login page, but since AdminConfig has the login forms, we can redirect there
        // OR create a dedicated AdminLogin page.
        // For now, let's redirect to `/admin/config` if they aren't there already.
        if (location.pathname !== '/admin/config') {
            return <Navigate to="/admin/config" replace state={{ from: location }} />;
        }
        // If they ARE on /admin/config, let it render so they see the login form.
    }

    return <>{children}</>;
}
