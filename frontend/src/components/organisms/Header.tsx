import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageToggle, ThemeToggle } from "@/components/common";
import {
  Menu,
  Settings,
  Globe,
  Moon,
  Sun,
  Monitor,
  Terminal,
  Bell,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { HeaderSearchBar } from "@/components/features/search/HeaderSearchBar";
import { useNotificationStore } from "@/stores/realtime/useNotificationStore";
import { NotificationPanel } from "@/components/features/notifications/NotificationPanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { useAuthStore } from "@/stores/session/useAuthStore";
import { isTokenExpired } from "@/services/session/auth";
import { isHeaderSearchShortcut } from "./headerSearchShortcut";

const baseNavigation = [
  { name: "Home", href: "/" },
  { name: "Blog", href: "/blog" },
  { name: "Projects", href: "/projects" },
  { name: "About", href: "/about" },
  { name: "Debate", href: "/debate" },
  { name: "Insight", href: "/insight" },
];
const exploreNavigation = [
  { name: "Docs", href: "https://docs.nodove.com/" },
];

const HEADER_LINK_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const ENCODED_HEADER_LINK_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

export function normalizeHeaderExploreHref(value: unknown): {
  href: string;
  external: boolean;
} | null {
  if (typeof value !== "string") return null;
  const href = value.trim();
  if (
    !href ||
    HEADER_LINK_CONTROL_PATTERN.test(href) ||
    /\s/.test(href) ||
    ENCODED_HEADER_LINK_CONTROL_PATTERN.test(href)
  ) {
    return null;
  }

  if (href.startsWith("/")) {
    return href.startsWith("//") ? null : { href, external: false };
  }

  try {
    const parsed = new URL(href);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password
    ) {
      return null;
    }
    return { href: parsed.toString(), external: true };
  } catch {
    return null;
  }
}

// Terminal window buttons component
function TerminalWindowButtons() {
  return (
    <div className="flex items-center gap-1.5 mr-4">
      <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
      <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
      <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
    </div>
  );
}

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
  { value: "terminal", label: "Terminal", icon: Terminal },
] as const;

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchPanel = useRef<HTMLDivElement>(null);
  const menuOpenedAtPath = useRef("");
  const location = useLocation();
  const { theme, setTheme, isTerminal } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { unreadCount } = useNotificationStore();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const hasAdmin = useMemo(() => {
    if (accessToken && !isTokenExpired(accessToken, 0)) return true;
    if (refreshToken && !isTokenExpired(refreshToken, 0)) return true;
    return false;
  }, [accessToken, refreshToken]);
  const isHome = location.pathname === "/";
  const navigation = hasAdmin
    ? [...baseNavigation, { name: "Admin", href: "/admin/config" }]
    : baseNavigation;

  // A route change must not leave a hidden modal holding focus or body scroll.
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchSheetOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileMenuOpen(false);
    };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    // Once open, the real search component owns its input and shortcuts.
    if (isHome || searchSheetOpen || mobileMenuOpen) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = Boolean(target?.isContentEditable ||
        (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)));
      if (!isHeaderSearchShortcut(event, isEditable)) return;
      event.preventDefault();
      setSearchSheetOpen(true);
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [isHome, searchSheetOpen, mobileMenuOpen]);

  const isCurrent = (href: string) =>
    location.pathname === href ||
    (href !== "/" && location.pathname.startsWith(`${href}/`));

  const renderNavigation = (mobile = false) => (
    <>
      {navigation.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          aria-current={isCurrent(item.href) ? "page" : undefined}
          className={cn("ui-nav-link no-terminal-style", isTerminal && "font-mono")}
          onClick={mobile ? () => setMobileMenuOpen(false) : undefined}
        >
          {item.name}
        </Link>
      ))}
      {exploreNavigation.map((item) => {
        const target = normalizeHeaderExploreHref(item.href);
        if (!target) return null;
        return target.external ? (
          <a key={item.name} className="ui-nav-link no-terminal-style" href={target.href}
            target="_blank" rel="noopener noreferrer" onClick={mobile ? () => setMobileMenuOpen(false) : undefined}>
            {item.name}<span className="sr-only"> (새 창)</span>
          </a>
        ) : (
          <Link key={item.name} className="ui-nav-link no-terminal-style" to={target.href}
            onClick={mobile ? () => setMobileMenuOpen(false) : undefined}>{item.name}</Link>
        );
      })}
    </>
  );

  return (
    <>
      <header className={cn("ui-header", isTerminal && "ui-header--terminal")}>
        <div className="ui-header__inner">
          <div className="ui-header__identity">
            {isTerminal && <span className="ui-terminal-buttons"><TerminalWindowButtons /></span>}
            <Link to="/" className="ui-wordmark no-terminal-style">{isTerminal ? ">_Nodove" : "Nodove"}</Link>
          </div>
          <nav className="ui-header__navigation" aria-label="Global">{renderNavigation()}</nav>
          <div className="ui-header__actions">
            {!isHome && (
              <Button ref={searchTrigger} type="button" variant="ghost" size="icon"
                onClick={() => setSearchSheetOpen(true)} className="ui-icon-button" aria-label="검색"
                aria-haspopup="dialog" aria-expanded={searchSheetOpen}>
                <Search className="h-5 w-5" aria-hidden="true" />
              </Button>
            )}
            <div className="ui-desktop-preferences"><LanguageToggle /><ThemeToggle /></div>
            <div className="ui-mobile-preferences">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="ui-icon-button" aria-label="설정">
                    <Settings className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="ui-preferences-menu">
                  <DropdownMenuLabel>언어 설정</DropdownMenuLabel>
                  <DropdownMenuItem role="menuitemradio" aria-checked={language === "ko"} onClick={() => setLanguage("ko")}>
                    <Globe className="mr-2 h-4 w-4" aria-hidden="true" />한국어{language === "ko" && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem role="menuitemradio" aria-checked={language === "en"} onClick={() => setLanguage("en")}>
                    <Globe className="mr-2 h-4 w-4" aria-hidden="true" />English{language === "en" && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>테마 설정</DropdownMenuLabel>
                  {themeOptions.map(({ value, label, icon: Icon }) => (
                    <DropdownMenuItem key={value} role="menuitemradio" aria-checked={theme === value} onClick={() => setTheme(value)}>
                      <Icon className="mr-2 h-4 w-4" aria-hidden="true" />{label}{theme === value && <span className="ml-auto">✓</span>}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {hasAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" className="ui-icon-button ui-notification-trigger" aria-label="알림">
                    <Bell className="h-5 w-5" aria-hidden="true" />
                    {unreadCount > 0 && <span className="ui-notification-count">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="ui-notification-panel p-0"><NotificationPanel /></DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button ref={menuTrigger} type="button" variant="ghost" size="icon" className="ui-icon-button ui-menu-trigger"
              aria-label="Toggle main menu" aria-haspopup="dialog" aria-expanded={mobileMenuOpen}
              onClick={() => { menuOpenedAtPath.current = location.pathname; setMobileMenuOpen(true); }}>
              <Menu className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="right" className="ui-drawer" aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (menuOpenedAtPath.current !== location.pathname || window.matchMedia("(min-width: 1024px)").matches) {
              document.getElementById("main-content")?.focus();
            } else {
              menuTrigger.current?.focus();
            }
          }}>
          <SheetTitle>메뉴</SheetTitle>
          <nav aria-label="Mobile navigation" className="ui-drawer__navigation">{renderNavigation(true)}</nav>
        </SheetContent>
      </Sheet>
      <Sheet open={searchSheetOpen} onOpenChange={setSearchSheetOpen}>
        <SheetContent ref={searchPanel} side="top" className="ui-search-sheet" aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            const input = searchPanel.current?.querySelector<HTMLInputElement>('input');
            if (input) {
              event.preventDefault();
              input.focus({ preventScroll: true });
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = searchTrigger.current;
            if (target?.isConnected) target.focus();
            else document.getElementById("main-content")?.focus();
          }}>
          <SheetTitle>Search</SheetTitle>
          <div className="mt-4"><HeaderSearchBar className="w-full" presentation="inline" /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}
