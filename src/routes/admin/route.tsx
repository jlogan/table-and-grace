import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AdminLayout } from "@/components/admin/AdminLayout";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.pathname },
      });
    }
    if (context.user.role !== "admin") {
      throw redirect({ to: "/account" });
    }
  },
  component: AdminRouteLayout,
});

function AdminRouteLayout() {
  const { user } = Route.useRouteContext();

  if (!user) {
    return null;
  }

  return (
    <AdminLayout user={user}>
      <Outlet />
    </AdminLayout>
  );
}
