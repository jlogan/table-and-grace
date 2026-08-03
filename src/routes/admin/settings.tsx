import { createFileRoute } from "@tanstack/react-router";

import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "Settings — GOFOFA Ops" }],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <AdminPlaceholder
      title="Settings"
      description="Notifications, exports, and operational preferences."
    />
  );
}
