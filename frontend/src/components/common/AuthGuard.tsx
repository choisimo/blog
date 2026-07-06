import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { Loader2 } from 'lucide-react';
import { getMe } from '@/services/session/auth';
import { DEFAULT_ADMIN_PATH } from '@/services/session/adminReturnTo';

interface AuthGuardProps {
    children: ReactNode;
    loadingLabel?: string;
}

const DEFAULT_AUTH_GUARD_LOADING_LABEL = '인증 확인 중';
const ANSI_ESCAPE_PATTERN =
    /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeAuthGuardLabel = (value: string): string =>
    value.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

function normalizeGuardToken(token: string | null): string | null {
    if (typeof token !== 'string') return null;
    const value = token.trim();
    if (!value || /[\u0000-\u001F\u007F]/.test(value)) return null;
    return value;
}

function normalizeGuardReturnPath(pathname: string, search: string): string {
    const path = `${pathname}${search}`.trim();
    if (
        !path ||
        !path.startsWith('/admin') ||
        path.startsWith('//') ||
        /[\u0000-\u001F\u007F\\]/.test(path) ||
        /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i.test(path)
    ) {
        return DEFAULT_ADMIN_PATH;
    }

    try {
        decodeURI(path);
    } catch {
        return DEFAULT_ADMIN_PATH;
    }

    return path;
}

function isAdminRole(role: string): boolean {
    return role.trim().toLowerCase() === 'admin';
}

export function AuthGuard({
    children,
    loadingLabel = DEFAULT_AUTH_GUARD_LOADING_LABEL,
}: AuthGuardProps) {
    const { isAuthenticated, getValidAccessToken, logout } = useAuthStore();
    const [isVerifying, setIsVerifying] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const location = useLocation();
    const sanitizedLoadingLabel =
        sanitizeAuthGuardLabel(loadingLabel) || DEFAULT_AUTH_GUARD_LOADING_LABEL;

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

            const token = normalizeGuardToken(await getValidAccessToken());
            if (!token) {
                await logout();
                if (isMounted) {
                    setIsAuthorized(false);
                    setIsVerifying(false);
                }
                return;
            }

            try {
                const user = await getMe(token);
                if (!isAdminRole(user.role)) {
                    await logout();
                    if (isMounted) {
                        setIsAuthorized(false);
                    }
                    return;
                }
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
            <div
                className="flex h-screen w-full items-center justify-center"
                role="status"
                aria-live="polite"
                aria-label={sanitizedLoadingLabel}
            >
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            </div>
        );
    }

    if (!isAuthorized) {
        const from = normalizeGuardReturnPath(location.pathname, location.search);
        return <Navigate to="/admin/login" replace state={{ from }} />;
    }

    return <>{children}</>;
}
