import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { signupWithPassword } from "@/auth/auth.functions.server";
import { MemberLayout } from "@/components/gofofa/MemberLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [{ title: "Sign Up — GOFOFA" }],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const signupFn = useServerFn(signupWithPassword);
  const { user } = Route.useRouteContext();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return (
      <MemberLayout showBack backTo="/account" backLabel="Account" wordmarkTo={null}>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              You are already signed in as {user.name ?? user.email}.
            </p>
            <Button
              type="button"
              className="mt-4 min-h-11 w-full"
              onClick={() => navigate({ to: "/account" })}
            >
              Go to my account
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
      await signupFn({
        data: {
          email,
          password,
          name: name.trim() || undefined,
        },
      });
      await router.invalidate();
      await navigate({ to: "/account", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <MemberLayout showBack backTo="/" backLabel="Home" wordmarkTo={null}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
        <p className="mt-2 text-muted-foreground">Set up your GOFOFA weekly meal membership.</p>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Join GOFOFA</CardTitle>
          <CardDescription>Weekly meals from Table and Grace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-h-11 text-base"
              />
            </div>

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
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 text-base"
              />
              <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            </div>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
              {submitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </MemberLayout>
  );
}
