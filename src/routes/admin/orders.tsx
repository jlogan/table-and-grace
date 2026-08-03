import { createFileRoute } from "@tanstack/react-router";

import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [{ title: "Orders — GOFOFA Ops" }],
  }),
  component: AdminOrdersPage,
});

function AdminOrdersPage() {
  return (
    <AdminPlaceholder
      title="Orders"
      description="Per-batch order list, review workflow, and customer notes."
    />
  );
}
