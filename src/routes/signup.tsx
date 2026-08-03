import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { signupWithPassword } from "@/auth/auth.functions.server";
import { BigButton } from "@/components/brand/BigButton";
import { PageLayout } from "@/components/brand/PageLayout";
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
    <PageLayout showBack backTo="/" backLabel="Home">
      <header className="text-center mb-6">
        <p className="inline-block rounded-full bg-gold-soft px-4 py-1 text-sm font-semibold text-navy">
          Join GOFOFA
        </p>
        <h1 className="mt-3 text-4xl font-display font-semibold text-navy">Create account</h1>
        <p className="mt-3 text-lg text-navy/85">
          Set up your account for weekly meal prep ordering.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-3xl bg-card border-2 border-cream-deep p-5 space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="name" className="text-navy font-semibold">
            Name <span className="font-normal text-navy/60">(optional)</span>
          </Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-12 rounded-xl border-2 border-cream-deep text-base"
          />
        </div>

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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 rounded-xl border-2 border-cream-deep text-base"
          />
          <p className="text-xs text-navy/60">At least 8 characters.</p>
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <BigButton type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </BigButton>
      </form>

      <p className="mt-6 text-center text-sm text-navy/80">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-navy underline underline-offset-4">
          Log in
        </Link>
      </p>
    </PageLayout>
  );
}
