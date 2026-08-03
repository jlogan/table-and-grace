import { createFileRoute } from "@tanstack/react-router";

import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/admin/batches")({
  head: () => ({
    meta: [{ title: "Batches — GOFOFA Ops" }],
  }),
  component: AdminBatchesPage,
});

function AdminBatchesPage() {
  return (
    <AdminPlaceholder
      title="Weekly batches"
      description="Open and close order windows, set delivery and pickup dates."
    />
  );
}
