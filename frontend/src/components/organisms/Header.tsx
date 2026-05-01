import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageToggle, ThemeToggle } from "@/components/common";
import {
  Menu,
  X,
  Home,
  FolderKanban,
  BookOpen,
  User,
  Shield,
  Settings,
  Globe,
  Moon,
  Sun,
  Monitor,
  Terminal,
  Library,
  Bell,
  Search,
  ChevronDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NavigationItem } from "@/components/molecules";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/ui/use-mobile";
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

const baseNavigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Blog", href: "/blog", icon: BookOpen },
  { name: "About", href: "/about", icon: User },
];

const exploreNavigation = [
  { name: "Projects ✨", href: "/projects", icon: FolderKanban },
  { name: "Docs", href: "https://docs.nodove.com/", icon: Library },
];

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

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  const location = useLocation();
  const { theme, setTheme, isTerminal } = useTheme();
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();
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
    ? [
        ...baseNavigation,
        { name: "Admin", href: "/admin/config", icon: Shield },
      ]
    : baseNavigation;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-[var(--z-fab-bar)] w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          isTerminal && "bg-[hsl(var(--terminal-titlebar))] border-border",
        )}
      >
        <nav
          className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8"
          aria-label="Global"
        >
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-x-12">
              {/* Terminal window buttons - only show in terminal mode */}
              {isTerminal && <TerminalWindowButtons />}

              <Link
                to="/"
                className={cn(
                  "flex items-center space-x-2 no-terminal-style",
                  isTerminal && "no-underline",
                )}
              >
                <span
                  className={cn(
                    "text-2xl font-bold",
                    isTerminal
                      ? "font-mono text-primary terminal-glow"
                      : "bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent",
                  )}
                >
                  {isTerminal ? ">_Nodove" : "Nodove"}
                </span>
              </Link>

              <div className="hidden md:flex md:gap-x-8">
                {navigation.map((item) => (
                  <NavigationItem
                    key={item.name}
                    name={item.name}
                    href={item.href}
                    icon={item.icon}
                    className={cn(
                      isTerminal && "font-mono text-sm no-terminal-style",
                    )}
                  />
                ))}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary",
                        isTerminal && "font-mono text-sm no-terminal-style",
                      )}
                    >
                      <FolderKanban className="h-4 w-4" />
                      <span>Explore</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className={cn(
                      "w-56",
                      isTerminal &&
                        "border-primary/40 bg-background/95 backdrop-blur",
                    )}
                  >
                    <DropdownMenuLabel
                      className={cn(
                        "text-xs text-muted-foreground",
                        isTerminal && "font-mono text-primary/70",
                      )}
                    >
                      {isTerminal ? "$ explore" : "Projects & Docs"}
                    </DropdownMenuLabel>
                    {exploreNavigation.map((item) => {
                      const Icon = item.icon;
                      const external = item.href.startsWith("http");
                      return (
                        <DropdownMenuItem key={item.name} asChild>
                          {external ? (
                            <a
                              href={item.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2",
                                isTerminal &&
                                  "font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              <span>{item.name}</span>
                            </a>
                          ) : (
                            <Link
                              to={item.href}
                              className={cn(
                                "flex items-center gap-2",
                                isTerminal &&
                                  "font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                              )}
                            >
                              <Icon className="h-4 w-4" />
                              <span>{item.name}</span>
                            </Link>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {!isMobile && !isHome && (
              <div className="hidden md:flex flex-1 justify-center mx-4">
                <HeaderSearchBar />
              </div>
            )}

            <div className="flex items-center gap-x-2 sm:gap-x-4">
              {!isMobile && (
                <>
                  <LanguageToggle />
                  <ThemeToggle />
                </>
              )}

              {/* 모바일: 검색 버튼 */}
              {isMobile && !isHome && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchSheetOpen(true)}
                  className={cn(
                    "h-11 w-11 md:hidden",
                    isTerminal &&
                      "text-primary hover:text-primary hover:bg-primary/10",
                  )}
                  aria-label="검색"
                >
                  <Search className="h-5 w-5" />
                </Button>
              )}

              {/* 모바일: 통합 설정 드롭다운 */}
              {isMobile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-11 w-11",
                        isTerminal &&
                          "text-primary hover:text-primary hover:bg-primary/10",
                      )}
                      aria-label="설정"
                    >
                      <Settings className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className={cn(
                      "w-48",
                      isTerminal &&
                        "border-primary/40 bg-background/95 backdrop-blur",
                    )}
                  >
                    <DropdownMenuLabel
                      className={cn(
                        "text-xs text-muted-foreground",
                        isTerminal && "font-mono text-primary/70",
                      )}
                    >
                      {isTerminal ? "$ language" : "언어 설정"}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setLanguage("ko")}
                      className={cn(
                        "flex items-center justify-between",
                        isTerminal &&
                          "font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                        isTerminal &&
                          language === "ko" &&
                          "bg-primary/15 text-primary",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        한국어
                      </span>
                      {language === "ko" && (
                        <span className="text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLanguage("en")}
                      className={cn(
                        "flex items-center justify-between",
                        isTerminal &&
                          "font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                        isTerminal &&
                          language === "en" &&
                          "bg-primary/15 text-primary",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        English
                      </span>
                      {language === "en" && (
                        <span className="text-primary">✓</span>
                      )}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator
                      className={cn(isTerminal && "bg-primary/30")}
                    />

                    <DropdownMenuLabel
                      className={cn(
                        "text-xs text-muted-foreground",
                        isTerminal && "font-mono text-primary/70",
                      )}
                    >
                      {isTerminal ? "$ theme" : "테마 설정"}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setTheme("light")}
                      className={cn(
                        "flex items-center justify-between",
                        theme === "light" && "bg-accent",
                        isTerminal &&
                          "font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </span>
                      {theme === "light" && (
                        <span className="text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("dark")}
                      className={cn(
                        "flex items-center justify-between",
                        theme === "dark" && "bg-accent",
                        isTerminal &&
                          "font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </span>
                      {theme === "dark" && (
                        <span className="text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("system")}
                      className={cn(
                        "flex items-center justify-between",
                        theme === "system" && "bg-accent",
                        isTerminal &&
                          "font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        System
                      </span>
                      {theme === "system" && (
                        <span className="text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("terminal")}
                      className={cn(
                        "flex items-center justify-between font-mono",
                        theme === "terminal" && "bg-primary/15",
                        isTerminal &&
                          "hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Terminal
                          className={cn(
                            "h-4 w-4",
                            theme === "terminal" && "text-primary",
                          )}
                        />
                        <span
                          className={cn(theme === "terminal" && "text-primary")}
                        >
                          Terminal
                        </span>
                      </span>
                      {theme === "terminal" && (
                        <span className="text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {hasAdmin && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "relative h-11 w-11",
                        isTerminal &&
                          "text-primary hover:text-primary hover:bg-primary/10",
                      )}
                      aria-label="알림"
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span
                          className={cn(
                            "absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold",
                            isTerminal
                              ? "bg-primary/80 text-background border border-background"
                              : "bg-destructive text-destructive-foreground",
                          )}
                        >
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className={cn(
                      "w-80 p-0",
                      isTerminal &&
                        "border-primary/40 bg-background/95 backdrop-blur",
                    )}
                  >
                    <NotificationPanel />
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div className="flex md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  aria-label="Toggle main menu"
                  className={cn(
                    "h-11 w-11",
                    isTerminal && "text-primary hover:text-primary",
                  )}
                >
                  <span className="sr-only">Open main menu</span>
                  {mobileMenuOpen ? (
                    <X className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Menu className="h-6 w-6" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden animate-in slide-in-from-top-2 fade-in duration-200 ease-out">
            <div
              className={cn(
                "space-y-1 px-4 pb-3 pt-2 border-t",
                isTerminal &&
                  "bg-[hsl(var(--terminal-code-bg))] border-primary/20",
                !isTerminal &&
                  "border-border/50 bg-background/95 backdrop-blur",
              )}
            >
              {navigation.map((item) => (
                <NavigationItem
                  key={item.name}
                  name={item.name}
                  href={item.href}
                  icon={item.icon}
                  isMobile
                  onClick={closeMobileMenu}
                  className={cn(isTerminal && "font-mono no-terminal-style")}
                />
              ))}
              <div className="pt-2">
                <div
                  className={cn(
                    "px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground",
                    isTerminal && "font-mono text-primary/60",
                  )}
                >
                  Explore
                </div>
                {exploreNavigation.map((item) => (
                  <NavigationItem
                    key={item.name}
                    name={item.name}
                    href={item.href}
                    icon={item.icon}
                    isMobile
                    onClick={closeMobileMenu}
                    className={cn(isTerminal && "font-mono no-terminal-style")}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </header>
      {/* Mobile Search Sheet */}
      <Sheet open={searchSheetOpen} onOpenChange={setSearchSheetOpen}>
        <SheetContent
          side="top"
          className={cn(
            "p-4",
            isTerminal && "bg-[hsl(var(--terminal-code-bg))] border-primary/20",
          )}
        >
          <SheetTitle className="sr-only">Search</SheetTitle>
          <div className="mt-2">
            <HeaderSearchBar className="w-full" presentation="inline" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
