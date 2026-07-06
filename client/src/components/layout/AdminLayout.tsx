import React, { memo, useCallback, useMemo, useState } from "react";
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
import logoAsset from "@/assets/secritou-logo.png";
import {
  Home,
  Users,
  FolderOpen,
  BarChart3,
  FileText,
  Files,
  Settings,
  LogOut,
  Briefcase,
  HelpCircle,
  MessageSquare,
  Receipt,
  CheckSquare,
} from "lucide-react";
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
import type { Module } from "@/types/permissions";
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { routePrefetch } from "@/routes/routePrefetch";
import { useTranslation } from "react-i18next";
import { AIAssistantFloat } from "./AIAssistantFloat";
import { type ChatMessage } from "@/api/ai.api";

type MenuItem = { key: string; url: string; icon: React.ElementType; permModule?: Module; group: "manage" | "analytics" | "other" };

const menuItems: MenuItem[] = [
  { key: "dashboard",              url: "/app",                          icon: Home,          group: "manage" },
  { key: "freelancerDashboard",    url: "/app/freelancer-dashboard",     icon: Home,          group: "manage" },
  { key: "crm",              url: "/app/crm",                icon: Users,         group: "manage", permModule: "clients" },
  { key: "commercial",       url: "/app/commercial",         icon: FileText,      group: "manage", permModule: "leads" },
  { key: "service-requests", url: "/app/service-requests",  icon: MessageSquare, group: "manage", permModule: "service-requests" },
  { key: "invoices",         url: "/app/invoices",           icon: Receipt,       group: "manage", permModule: "invoices" },
  { key: "talent",           url: "/app/talent",             icon: Briefcase,     group: "manage", permModule: "freelancers" },
  { key: "projects",         url: "/app/projects",           icon: FolderOpen,    group: "manage", permModule: "projects" },
  { key: "tasks",            url: "/app/tasks",              icon: CheckSquare,   group: "manage", permModule: "tasks" },
  { key: "documents",        url: "/app/documents",          icon: Files,         group: "manage", permModule: "documents" },
  { key: "reports",          url: "/app/reports",            icon: BarChart3,     group: "analytics" },
  { key: "questions",        url: "/app/questions",          icon: HelpCircle,    group: "analytics" },
  { key: "settings",         url: "/app/settings",           icon: Settings,      group: "other" },
];

export const AdminLayout = memo(function AdminLayout() {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending } = useLogout();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);

  const handleAiMessagesChange = useCallback((next: ChatMessage[]) => {
    setAiMessages(next);
  }, []);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const can = useAuthStore((state) => state.can);

  const filteredMenuItems = useMemo(() => {
    const role = user?.role ?? "ADMIN";

    if (role === "ADMIN") return menuItems;

    if (role === "MANAGER") {
      return menuItems.filter((item) => {
        if (item.key === "commercial") {
          return can("leads", "read") || can("proposals", "read");
        }
        if (!item.permModule) return true;
        return can(item.permModule, "read");
      });
    }

    if (role === "FREELANCER") {
      return menuItems.filter((item) => ["freelancerDashboard", "projects", "tasks", "documents", "settings"].includes(item.key));
    }

    return menuItems;
  }, [user?.role, can]);

  const handleLogout = useCallback(() => {
    logout(undefined, {
      onSuccess: () => {
        navigate("/login");
      },
    });
  }, [logout, navigate]);

  const initials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [user?.name]);

  const handlePrefetch = useCallback((url: string) => {
    switch (url) {
      case "/app":
        routePrefetch.dashboard();
        break;
      case "/app/crm":
        routePrefetch.crm?.();
        break;
      case "/app/service-requests":
        routePrefetch.serviceRequests();
        break;
      case "/app/invoices":
        routePrefetch.invoices();
        break;
      case "/app/talent":
        routePrefetch.talent?.();
        break;
      case "/app/projects":
        routePrefetch.projects();
        break;
      case "/app/ai":
        routePrefetch.ai();
        break;
      case "/app/settings":
        routePrefetch.settings();
        break;
      default:
        break;
    }
  }, []);

  const manageItems   = filteredMenuItems.filter((i) => i.group === "manage");
  const analyticsItems = filteredMenuItems.filter((i) => i.group === "analytics");
  const otherItems    = filteredMenuItems.filter((i) => i.group === "other");

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-ink",
    ].join(" ");

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
            {/* MANAGE group */}
            {manageItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70">
                  {t("sidebar.groupManage", "Manage")}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {manageItems.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild isActive={false} className="p-0 h-auto hover:bg-transparent">
                          <NavLink
                            to={item.url}
                            end={item.url === "/app"}
                            onMouseEnter={() => handlePrefetch(item.url)}
                            onFocus={() => handlePrefetch(item.url)}
                            className={navLinkClass}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{t(`sidebar.${item.key}`)}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* ANALYTICS group */}
            {analyticsItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70">
                  {t("sidebar.groupAnalytics", "Analytics")}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {analyticsItems.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild isActive={false} className="p-0 h-auto hover:bg-transparent">
                          <NavLink
                            to={item.url}
                            end={false}
                            onMouseEnter={() => handlePrefetch(item.url)}
                            onFocus={() => handlePrefetch(item.url)}
                            className={navLinkClass}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{t(`sidebar.${item.key}`)}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Settings (bottom of content) */}
            {otherItems.length > 0 && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {otherItems.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild isActive={false} className="p-0 h-auto hover:bg-transparent">
                          <NavLink
                            to={item.url}
                            end={false}
                            className={navLinkClass}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span>{t(`sidebar.${item.key}`)}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
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
                <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  {t("userMenu.settings")}
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
            <div className="flex-1 max-w-sm">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell />
              <Avatar className="h-8 w-8 cursor-pointer" onClick={() => navigate("/app/settings")}>
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

      <AIAssistantFloat
        open={aiOpen}
        onOpenChange={setAiOpen}
        messages={aiMessages}
        onMessagesChange={handleAiMessagesChange}
      />
    </SidebarProvider>
  );
});