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
import { NotificationBell } from "@/components/NotificationBell";
import { GlobalSearch } from "@/components/common/GlobalSearch";
import { routePrefetch } from "@/routes/routePrefetch";
import { useTranslation } from "react-i18next";

const menuItems = [
  {
    key: "dashboard",
    url: "/app",
    icon: Home,
  },
  {
    key: "leads",
    url: "/app/leads",
    icon: UserPlus,
  },
  {
    key: "clients",
    url: "/app/clients",
    icon: Users,
  },
  {
    key: "applications",
    url: "/app/applications",
    icon: UserCheck,
  },
  {
    key: "onboarding",
    url: "/app/client-onboardings",
    icon: Rocket,
  },
  {
    key: "serviceRequests",
    url: "/app/service-requests",
    icon: Inbox,
  },
  {
    key: "proposals",
    url: "/app/proposals",
    icon: File,
  },
  {
    key: "approvals",
    url: "/app/approvals",
    icon: Check,
  },
  {
    key: "invoices",
    url: "/app/invoices",
    icon: Receipt,
  },
  {
    key: "documents",
    url: "/app/documents",
    icon: FileText,
  },
  {
    key: "freelancers",
    url: "/app/freelancers",
    icon: Briefcase,
  },
  {
    key: "missions",
    url: "/app/missions",
    icon: ClipboardList,
  },
  {
    key: "projects",
    url: "/app/projects",
    icon: FolderOpen,
  },
  {
    key: "tasks",
    url: "/app/tasks",
    icon: CheckSquare,
  },
  {
    key: "aiAssistant",
    url: "/app/ai",
    icon: Bot,
  },
  {
    key: "analytics",
    url: "/app/analytics",
    icon: BarChart3,
  },
  {
    key: "reports",
    url: "/app/reports",
    icon: File,
  },
  {
    key: "settings",
    url: "/app/settings",
    icon: Settings,
  },
];

export const AdminLayout = memo(function AdminLayout() {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending } = useLogout();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
      case "/app/leads":
        routePrefetch.leads();
        break;
      case "/app/clients":
        routePrefetch.clients();
        break;
      case "/app/applications":
        routePrefetch.applications?.();
        break;
      case "/app/service-requests":
        routePrefetch.serviceRequests?.();
        break;
      case "/app/proposals":
        routePrefetch.proposals?.();
        break;
      case "/app/approvals":
        routePrefetch.approvals?.();
        break;
      case "/app/invoices":
        routePrefetch.invoices?.();
        break;
      case "/app/documents":
        routePrefetch.enhancedDocuments?.();
        break;
      case "/app/freelancers":
        routePrefetch.freelancers();
        break;
      case "/app/missions":
        routePrefetch.missions();
        break;
      case "/app/projects":
        routePrefetch.projects();
        break;
      case "/app/tasks":
        routePrefetch.tasks();
        break;
      case "/app/ai":
        routePrefetch.ai();
        break;
      case "/app/analytics":
        routePrefetch.analytics();
        break;
      case "/app/reports":
        routePrefetch.reports();
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
                  {menuItems.map((item) => (
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
                  <DropdownMenuItem>{t("userMenu.profile")}</DropdownMenuItem>
                  <DropdownMenuItem>{t("userMenu.settings")}</DropdownMenuItem>
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
    </SidebarProvider>
  );
});
