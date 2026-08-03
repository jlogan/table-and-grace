import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { loginWithPassword } from "@/auth/auth.functions.server";
import { BigButton } from "@/components/brand/BigButton";
import { PageLayout } from "@/components/brand/PageLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FileRouteTypes } from "@/routeTree.gen";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

type AppPath = FileRouteTypes["to"];

function safeRedirectPath(redirect: string | undefined): AppPath {
  if (!redirect) return "/account";
  if (redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect as AppPath;
  }
  return "/account";
}

export const Route = createFileRoute("/login")({
  validateSearch: loginSearchSchema,
  head: () => ({
    meta: [{ title: "Log In — GOFOFA" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const loginFn = useServerFn(loginWithPassword);
  const { user } = Route.useRouteContext();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return (
      <PageLayout showBack backTo="/account" backLabel="Account">
        <div className="rounded-3xl bg-card border-2 border-cream-deep p-5 text-center">
          <p className="text-navy/80">You are already signed in as {user.name ?? user.email}.</p>
          <div className="mt-4">
            <BigButton type="button" onClick={() => navigate({ to: "/account" })}>
              Go to my account
            </BigButton>
          </div>
        </div>
      </PageLayout>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginFn({ data: { email, password } });
      await router.invalidate();
      await navigate({ to: safeRedirectPath(redirectTo), replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout showBack backTo="/" backLabel="Home">
      <header className="text-center mb-6">
        <p className="inline-block rounded-full bg-gold-soft px-4 py-1 text-sm font-semibold text-navy">
          Welcome back
        </p>
        <h1 className="mt-3 text-4xl font-display font-semibold text-navy">Log in</h1>
        <p className="mt-3 text-lg text-navy/85">Sign in to manage your meal plan and orders.</p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl bg-card border-2 border-cream-deep p-5 space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email" className="text-navy font-semibold">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 rounded-xl border-2 border-cream-deep text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-navy font-semibold">
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-xl border-2 border-cream-deep text-base"
          />
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <BigButton type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </BigButton>
      </form>

      <p className="mt-6 text-center text-sm text-navy/80">
        New here?{" "}
        <Link to="/signup" className="font-semibold text-navy underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </PageLayout>
  );
}
