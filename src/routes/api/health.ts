import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

import { getDb } from "@/db/index.server";
import { hasCoreServerEnv } from "@/env.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        if (!hasCoreServerEnv()) {
          return Response.json(
            { ok: false, db: "unconfigured", message: "Core env vars missing" },
            { status: 503 },
          );
        }

        try {
          const db = getDb();
          await db.execute(sql`SELECT 1`);
          return Response.json({ ok: true, db: "up" });
        } catch (error) {
          console.error("Health check DB error:", error);
          return Response.json({ ok: false, db: "down" }, { status: 503 });
        }
      },
    },
  },
});
