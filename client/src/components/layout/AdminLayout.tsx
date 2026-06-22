import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
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
  UserPlus,
  FolderOpen,
  CheckSquare,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Briefcase,
  ClipboardList,
  Bot,
  UserCheck,
  Rocket,
  File,
  Check,
  Receipt,
  Star,
  Inbox,
  HelpCircle,
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

// Keys that map to a permission module (undefined = always visible for MANAGER)
type MenuItem = { key: string; url: string; icon: React.ElementType; permModule?: Module };

const menuItems: MenuItem[] = [
  { key: "dashboard",  url: "/app",          icon: Home },
  { key: "crm",        url: "/app/crm",       icon: Users,       permModule: "clients" },
  { key: "commercial", url: "/app/commercial", icon: FileText,   permModule: "leads"   },
  { key: "talent",     url: "/app/talent",    icon: Briefcase,   permModule: "freelancers" },
  { key: "projects",   url: "/app/projects",  icon: FolderOpen,  permModule: "projects" },
  { key: "questions",  url: "/app/questions", icon: HelpCircle },
  { key: "settings",   url: "/app/settings",  icon: Settings },
];

export const AdminLayout = memo(function AdminLayout() {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending } = useLogout();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("ai_chat_history");
      return saved ? (JSON.parse(saved) as ChatMessage[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("ai_chat_history", JSON.stringify(aiMessages.slice(-50)));
  }, [aiMessages]);

  const handleAiMessagesChange = useCallback((next: ChatMessage[]) => {
    if (next.length === 0) localStorage.removeItem("ai_chat_history");
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
        // Items without a permModule are always visible (dashboard, questions, settings)
        if (!item.permModule) return true;
        return can(item.permModule, "read");
      });
    }

    if (role === "FREELANCER") {
      return menuItems.filter((item) => ["dashboard", "talent", "settings"].includes(item.key));
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
        routePrefetch.serviceRequests?.();
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

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full bg-background">
        <Sidebar className="border-r">
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center gap-2 font-display text-xl font-bold text-ink">
              <img src={logoAsset} alt="Secritou" className="h-8 w-8 object-contain" loading="lazy" />
              Secritou
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>{t("sidebar.title")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredMenuItems.map((item) => (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton asChild isActive={false}>
                        <NavLink
                          to={item.url}
                          end={item.url === "/app"}
                          onMouseEnter={() => handlePrefetch(item.url)}
                          onFocus={() => handlePrefetch(item.url)}
                          className={({ isActive }) =>
                            isActive ? "data-[active=true]" : ""
                          }
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{t(`sidebar.${item.key}`)}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="border-t p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{user?.name}</span>
                <span className="text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex items-center gap-4 flex-1">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t("userMenu.myAccount")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/settings")}>{t("userMenu.settings")}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    disabled={isPending}
                    className="text-red-600"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {isPending ? t("userMenu.loggingOut") : t("userMenu.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto p-6">
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
