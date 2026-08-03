import { createFileRoute } from "@tanstack/react-router";

import { AdminPlaceholder } from "@/components/admin/AdminPlaceholder";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [{ title: "Customers — GOFOFA Ops" }],
  }),
  component: AdminCustomersPage,
});

function AdminCustomersPage() {
  return (
    <AdminPlaceholder
      title="Customers"
      description="Membership status, contact info, and order history."
    />
  );
}
