import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth.store";
import { useLogout } from "@/hooks/useAuth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, Briefcase, MessageSquare, User } from "lucide-react";
import logoAsset from "@/assets/secritou-logo.png";
import { Link } from "react-router-dom";

export function ClientLayout() {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending } = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout(undefined, {
      onSuccess: () => {
        navigate("/");
      },
    });
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const navItems = [
    {
      title: "Mes projets",
      to: "/client/projects",
      icon: Briefcase,
    },
    {
      title: "Mes demandes",
      to: "/client/requests",
      icon: MessageSquare,
    },
    {
      title: "Mon profil",
      to: "/client/profile",
      icon: User,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
        <Link to="/client" className="flex items-center gap-2 shrink-0">
          <img src={logoAsset} alt="" className="h-10 w-10 object-contain" loading="lazy" />
          <span className="font-display text-lg font-bold tracking-tight text-ink">Secritou</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/client"}
              className={({ isActive }) =>
                isActive
                  ? "px-4 py-2 text-sm font-semibold text-ink rounded-full bg-primary/10"
                  : "px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-ink rounded-full hover:bg-primary/5"
              }
            >
              {item.title}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="p-2">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} disabled={isPending} className="text-red-600">
                <LogOut className="h-4 w-4 mr-2" />
                {isPending ? "Déconnexion en cours..." : "Se déconnecter"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
