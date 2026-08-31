import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, LogOut, Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { SchoolLogo } from "@/components/brand/school-logo";
import { appName, navByRole, roleLabel } from "@/components/layout/nav-config";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, useSignOut } from "@/hooks/use-auth";
import { usePushPermission } from "@/hooks/use-push-permission";
import { initials } from "@/components/common/student-card";
import { schoolMotto } from "@/lib/brand";
import { cn } from "@/lib/utils";

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <SchoolLogo className={compact ? "size-9" : "size-10"} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold leading-tight tracking-tight text-foreground">
          {appName}
        </p>
        {!compact ? (
          <p className="truncate text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {schoolMotto}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { primaryRole } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = primaryRole ? navByRole[primaryRole] : [];

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-[1.125rem]" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountMenu() {
  const { user, primaryRole } = useAuth();
  const signOut = useSignOut();
  const name =
    (user?.user_metadata?.["full_name"] as string | undefined) ?? user?.email ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-10 rounded-full">
          <Avatar className="size-9 border border-border">
            <AvatarFallback className="bg-primary-soft text-xs font-bold text-primary">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-xs font-normal text-muted-foreground">
            {primaryRole ? roleLabel[primaryRole] : "No role assigned"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">
            <Bell className="mr-2 size-4" strokeWidth={1.75} />
            My account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 size-4" strokeWidth={1.75} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileNavBar() {
  const { primaryRole } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = primaryRole ? navByRole[primaryRole] : [];

  if (items.length === 0) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch px-2 py-1.5">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[0.6875rem] font-semibold"
            >
              <span
                className={cn(
                  "flex h-8 w-12 items-center justify-center rounded-full transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-[1.125rem]" strokeWidth={active ? 2 : 1.75} />
              </span>
              <span className={active ? "text-foreground" : "text-muted-foreground"}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { session, primaryRole } = useAuth();
  const { requestOnFirstOpen } = usePushPermission();

  useEffect(() => {
    if (!session) return;
    void requestOnFirstOpen();
  }, [session, requestOnFirstOpen]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 lg:flex">
        <BrandMark />
        <div className="mt-8 flex-1">
          <NavLinks />
        </div>
        <p className="meta-text">Student records are private to linked accounts.</p>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" strokeWidth={1.75} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-5">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <BrandMark />
                <div className="mt-8">
                  <NavLinks onNavigate={() => setMobileNavOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <div className="min-w-0 lg:hidden">
              <BrandMark compact />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {primaryRole === "parent" ? (
              <Button variant="ghost" size="icon" className="relative size-10 rounded-full" asChild>
                <Link to="/parent/notifications" aria-label="Notifications">
                  <Bell className="size-5" strokeWidth={1.75} />
                  <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
                </Link>
              </Button>
            ) : null}
            <AccountMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12">{children}</main>
      </div>

      <MobileNavBar />
    </div>
  );
}
