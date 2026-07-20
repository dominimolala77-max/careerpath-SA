import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Let's build your profile.");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="min-h-screen bg-brand-50 text-brand-900 flex flex-col">
      <header className="px-6 py-4">
        <Link to="/" className="flex items-center gap-2 w-fit">
          <div className="size-8 bg-brand-600 rounded-lg grid place-items-center text-white font-bold">C</div>
          <span className="font-display text-lg">
            CareerPath <span className="text-brand-600">SA</span>
          </span>
        </Link>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-6 pt-6 pb-16">
        <h1 className="font-display text-3xl mb-1">{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className="text-brand-900/60 text-sm mb-6">
          {mode === "signup"
            ? "Free, forever. No credit card required."
            : "Sign in to continue your applications."}
        </p>

        <button
          onClick={google}
          disabled={busy}
          className="w-full bg-white border border-brand-900/10 text-brand-900 font-semibold py-3.5 rounded-xl mb-4 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-4 text-xs text-brand-900/40 font-semibold uppercase tracking-widest">
          <div className="flex-1 h-px bg-brand-900/10" />
          or email
          <div className="flex-1 h-px bg-brand-900/10" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full bg-white border border-brand-900/10 rounded-xl px-4 py-3.5 outline-none focus:border-brand-600"
            />
          )}
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full bg-white border border-brand-900/10 rounded-xl px-4 py-3.5 outline-none focus:border-brand-600"
          />
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            className="w-full bg-white border border-brand-900/10 rounded-xl px-4 py-3.5 outline-none focus:border-brand-600"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-brand-600 text-white font-semibold py-4 rounded-xl active:scale-[0.98] transition-transform disabled:opacity-50 shadow-lg shadow-brand-600/20"
          >
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-brand-900/60 mt-6">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="text-brand-600 font-semibold"
          >
            {mode === "signup" ? "Sign in" : "Create account"}
          </button>
        </p>
      </main>
    </div>
  );
}
