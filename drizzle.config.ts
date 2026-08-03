import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // drizzle-kit generate reads schema only; migrate requires DATABASE_URL at runtime.
    url: process.env.DATABASE_URL ?? "mysql://127.0.0.1:3306/gofofa",
  },
});
