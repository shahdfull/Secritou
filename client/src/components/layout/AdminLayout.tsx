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

const menuItems = [
  {
    title: "Dashboard",
    url: "/app",
    icon: Home,
  },
  {
    title: "Leads",
    url: "/app/leads",
    icon: UserPlus,
  },
  {
    title: "Clients",
    url: "/app/clients",
    icon: Users,
  },
  {
    title: "Applications",
    url: "/app/applications",
    icon: UserCheck,
  },
  {
    title: "Onboarding",
    url: "/app/client-onboardings",
    icon: Rocket,
  },
  {
    title: "Freelancers",
    url: "/app/freelancers",
    icon: Briefcase,
  },
  {
    title: "Missions",
    url: "/app/missions",
    icon: ClipboardList,
  },
  {
    title: "Projects",
    url: "/app/projects",
    icon: FolderOpen,
  },
  {
    title: "Tasks",
    url: "/app/tasks",
    icon: CheckSquare,
  },
  {
    title: "AI Assistant",
    url: "/app/ai",
    icon: Bot,
  },
  {
    title: "Analytics",
    url: "/app/analytics",
    icon: BarChart3,
  },
  {
    title: "Rapports",
    url: "/app/reports",
    icon: FileText,
  },
  {
    title: "Settings",
    url: "/app/settings",
    icon: Settings,
  },
];

export const AdminLayout = memo(function AdminLayout() {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending } = useLogout();
  const navigate = useNavigate();

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
              <div className="h-8 w-8 rounded-full bg-primary"></div>
              Secritou
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
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
                          <span>{item.title}</span>
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
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    disabled={isPending}
                    className="text-red-600"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {isPending ? "Logging out..." : "Logout"}
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
