import React, { memo, useCallback, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth.store";
import { useLogout } from "@/hooks/useAuth";
import {
  LogOut,
  Briefcase,
  MessageSquare,
  User,
  FileText,
  ClipboardCheck,
  Receipt,
  HelpCircle,
  FolderOpen,
  Rocket,
  Settings,
} from "lucide-react";
import logoAsset from "@/assets/secritou-logo.png";
import { NotificationBell } from "@/components/NotificationBell";
import { routePrefetch } from "@/routes/routePrefetch";
import { useTranslation } from "react-i18next";

type NavItem = { key: string; to: string; icon: React.ElementType; group: "main" | "account" };

const NAV_ITEMS: NavItem[] = [
  { key: "projects",   to: "/client/projects",  icon: Briefcase,     group: "main" },
  { key: "requests",   to: "/client/requests",  icon: MessageSquare, group: "main" },
  { key: "proposals",  to: "/client/proposals", icon: FileText,      group: "main" },
  { key: "approvals",  to: "/client/approvals", icon: ClipboardCheck,group: "main" },
  { key: "invoices",   to: "/client/invoices",  icon: Receipt,       group: "main" },
  { key: "documents",  to: "/client/documents", icon: FolderOpen,    group: "main" },
  { key: "onboarding", to: "/client/onboarding",icon: Rocket,        group: "main" },
  { key: "questions",  to: "/client/questions", icon: HelpCircle,    group: "account" },
  { key: "profile",    to: "/client/profile",   icon: User,          group: "account" },
];

export const ClientLayout = memo(function ClientLayout() {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending } = useLogout();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogout = useCallback(() => {
    logout(undefined, {
      onSuccess: () => navigate("/"),
    });
  }, [logout, navigate]);

  const handlePrefetch = useCallback((to: string) => {
    switch (to) {
      case "/client/projects":  routePrefetch.clientProjects(); break;
      case "/client/requests":  routePrefetch.clientRequests(); break;
      case "/client/profile":   routePrefetch.clientProfile();  break;
    }
  }, []);

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  }, [user?.name]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-ink",
    ].join(" ");

  const mainItems    = NAV_ITEMS.filter((i) => i.group === "main");
  const accountItems = NAV_ITEMS.filter((i) => i.group === "account");

  return (
    <SidebarProvider defaultOpen={true}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        {t("a11y.skipToContent")}
      </a>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <Sidebar className="border-r border-border bg-surface-warm w-56 shrink-0">
          {/* Logo */}
          <SidebarHeader className="px-5 py-4 border-b border-border bg-surface-warm">
            <div className="flex items-center gap-2.5 font-display text-lg font-bold text-ink">
              <img src={logoAsset} alt="Secritou" className="h-7 w-7 object-contain" loading="lazy" />
              Secritou
            </div>
          </SidebarHeader>

          <SidebarContent className="flex-1 px-3 py-4 space-y-5 bg-surface-warm">
            {/* Main nav */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70">
                {t("sidebar.groupManage", "Espace client")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {mainItems.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={false} className="p-0 h-auto hover:bg-transparent">
                        <NavLink
                          to={item.to}
                          onMouseEnter={() => handlePrefetch(item.to)}
                          onFocus={() => handlePrefetch(item.to)}
                          className={navLinkClass}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{t(`clientNav.${item.key}`)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Account group */}
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70">
                {t("sidebar.groupOther", "Compte")}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {accountItems.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={false} className="p-0 h-auto hover:bg-transparent">
                        <NavLink
                          to={item.to}
                          onMouseEnter={() => handlePrefetch(item.to)}
                          onFocus={() => handlePrefetch(item.to)}
                          className={navLinkClass}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{t(`clientNav.${item.key}`)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Footer — user info + dropdown */}
          <SidebarFooter className="border-t border-border px-3 py-3 bg-surface-warm">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full rounded-lg px-2 py-2 hover:bg-muted transition-colors text-left">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate leading-tight">{user?.name}</p>
                    <p className="text-xs text-muted-foreground truncate leading-tight">{user?.email}</p>
                  </div>
                  <svg className="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="5" r="1" fill="currentColor" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                    <circle cx="12" cy="19" r="1" fill="currentColor" />
                  </svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-52 mb-1">
                <DropdownMenuLabel>{t("userMenu.myAccount")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/client/profile")}>
                  <User className="h-4 w-4 mr-2" />
                  {t("clientNav.profile")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={isPending} className="text-red-600">
                  <LogOut className="h-4 w-4 mr-2" />
                  {isPending ? t("userMenu.loggingOut") : t("userMenu.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col flex-1 min-w-0">
          {/* Topbar */}
          <header className="safe-top sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-5 gap-4">
            <SidebarTrigger className="md:hidden shrink-0" />
            <div className="flex-1" />
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <Avatar className="h-8 w-8 cursor-pointer" onClick={() => navigate("/client/profile")}>
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          {/* Page content */}
          <main id="main" className="flex-1 overflow-auto p-6 bg-surface-warm/10">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
});
