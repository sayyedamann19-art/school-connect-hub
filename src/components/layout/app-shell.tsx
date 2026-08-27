import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { appIcon as AppIcon, appName, navByRole, roleLabel } from "@/components/layout/nav-config";
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
import { cn } from "@/lib/utils";

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <AppIcon className="size-5" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-foreground">{appName}</span>
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
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
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
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "Account";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 px-2">
          <Avatar className="size-8 border border-border">
            <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
            {name}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs font-normal text-muted-foreground">
            {primaryRole ? roleLabel[primaryRole] : "No role assigned"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut className="mr-2 size-4" />
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-md items-stretch">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { session } = useAuth();
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
        <p className="text-xs text-muted-foreground">Student data is private to linked accounts.</p>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="size-5" />
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
            <div className="lg:hidden">
              <BrandMark />
            </div>
          </div>
          <AccountMenu />
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNavBar />
    </div>
  );
}
