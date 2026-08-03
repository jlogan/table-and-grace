import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarRange,
  ChefHat,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import type { CurrentUser } from "@/auth/types";
import { cn } from "@/lib/utils";

const adminNavItems: Array<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/batches", label: "Batches", icon: CalendarRange },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/kitchen", label: "Kitchen", icon: ChefHat },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

interface AdminLayoutProps {
  children: ReactNode;
  user: CurrentUser;
  title?: string;
  description?: string;
}

export function AdminLayout({ children, user, title, description }: AdminLayoutProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <SidebarProvider defaultOpen className="admin-app min-h-dvh">
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
          <div className="flex flex-col gap-0.5 px-1 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              GOFOFA Ops
            </span>
            <span className="text-xs text-muted-foreground">Table and Grace</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map(({ to, label, icon: Icon, exact }) => {
                  const isActive = exact ? pathname === to : pathname.startsWith(to);
                  return (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={label}>
                        <Link to={to}>
                          <Icon />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Member account">
                <Link to="/account">
                  <Package />
                  <span>My account</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="min-w-0 flex-1">
            {title ? (
              <>
                <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
                {description ? (
                  <p className="truncate text-xs text-muted-foreground">{description}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">Batch week · placeholder</p>
            )}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="max-w-[12rem] truncate text-sm text-muted-foreground">
              {user.name ?? user.email}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link to="/">Storefront</Link>
            </Button>
          </div>
        </header>

        <div className={cn("flex flex-1 flex-col gap-6 p-4 md:p-6")}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
