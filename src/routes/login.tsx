import { createFileRoute, Link, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { loginWithPassword } from "@/auth/auth.functions.server";
import type { CurrentUser } from "@/auth/types";
import { MemberLayout } from "@/components/gofofa/MemberLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FileRouteTypes } from "@/routeTree.gen";

const loginSearchSchema = z.object({
  redirect: z.string().optional(),
});

type AppPath = FileRouteTypes["to"];

function postLoginPath(redirect: string | undefined, user: CurrentUser): AppPath {
  if (redirect?.startsWith("/") && !redirect.startsWith("//")) {
    return redirect as AppPath;
  }
  return user.role === "admin" ? "/admin" : "/account";
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
    const signedInDestination = postLoginPath(redirectTo, user);
    const signedInLabel = user.role === "admin" ? "Go to admin" : "Go to my account";

    return (
      <MemberLayout showBack backTo={signedInDestination} backLabel="Back" wordmarkTo={null}>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              You are already signed in as {user.name ?? user.email}.
            </p>
            <Button
              type="button"
              className="mt-4 min-h-11 w-full"
              onClick={() => navigate({ to: signedInDestination })}
            >
              {signedInLabel}
            </Button>
          </CardContent>
        </Card>
      </MemberLayout>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user: loggedInUser } = await loginFn({ data: { email, password } });
      await router.invalidate();
      await navigate({ to: postLoginPath(redirectTo, loggedInUser), replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MemberLayout showBack backTo="/" backLabel="Home" wordmarkTo={null}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-2 text-muted-foreground">Manage your weekly meal plan and orders.</p>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Welcome back</CardTitle>
          <CardDescription>Sign in with your GOFOFA account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 text-base"
              />
            </div>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </MemberLayout>
  );
}
