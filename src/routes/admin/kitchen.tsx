import { createFileRoute } from "@tanstack/react-router";

import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/admin/kitchen")({
  head: () => ({
    meta: [{ title: "Kitchen — GOFOFA Ops" }],
  }),
  component: AdminKitchenPage,
});

function AdminKitchenPage() {
  return (
    <AdminPlaceholder
      title="Kitchen"
      description="Pick lists, labels, and prep quantities for the current batch."
    />
  );
}
