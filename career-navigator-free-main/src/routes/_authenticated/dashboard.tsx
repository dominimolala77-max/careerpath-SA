import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Clock, ExternalLink } from "lucide-react";

type AppRow = {
  id: string;
  payment_status: "paid" | "unpaid" | "free" | "pending";
  amount_cents: number;
  paid_at: string | null;
  institution: {
    id: string;
    name: string;
    type: "university" | "tvet" | "nsfas";
    is_free: boolean;
    closing_date: string | null;
  } | null;
};

type Profile = {
  full_name: string | null;
  aps_score: number | null;
  status: "draft" | "submitted" | "processing" | "completed";
  preferred_field: string | null;
};

type Update = { id: string; title: string; body: string | null; created_at: string };

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<AppRow[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [p, a, up] = await Promise.all([
      supabase.from("profiles").select("full_name, aps_score, status, preferred_field").eq("id", u.user.id).maybeSingle(),
      supabase
        .from("applications")
        .select("id, payment_status, amount_cents, paid_at, institution:institutions(id, name, type, is_free, closing_date)")
        .eq("user_id", u.user.id)
        .order("created_at"),
      supabase.from("updates").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    setProfile(p.data as Profile | null);
    setApps((a.data ?? []) as unknown as AppRow[]);
    setUpdates((up.data ?? []) as Update[]);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      await supabase.from("profiles").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("id", u.user.id);
      await supabase.from("updates").insert({
        user_id: u.user.id,
        title: "Profile submitted",
        body: "Our team will review your profile and applications and get back to you.",
      });
      toast.success("Profile submitted for processing");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const nsfas = apps.find((a) => a.institution?.type === "nsfas");
  const unis = apps.filter((a) => a.institution?.type !== "nsfas");
  const paidCount = unis.filter((a) => a.payment_status === "paid" || a.payment_status === "free").length;

  if (!profile) {
    return (
      <div className="px-6 pt-10 text-center text-brand-900/50 text-sm">Loading dashboard…</div>
    );
  }

  const needsOnboarding = !profile.aps_score || !profile.full_name;

  return (
    <div className="px-6 pt-6 pb-32 space-y-6">
      <div>
        <p className="text-xs uppercase font-bold tracking-widest text-brand-600">
          Hi {profile.full_name?.split(" ")[0] ?? "there"}
        </p>
        <h1 className="font-display text-3xl mt-1">Your dashboard</h1>
      </div>

      {needsOnboarding && (
        <Link
          to="/onboarding"
          className="block bg-brand-600 text-white rounded-2xl p-5 active:scale-[0.99]"
        >
          <p className="font-semibold">Finish setting up your profile</p>
          <p className="text-sm text-white/80 mt-1">Enter your marks, upload documents, and pick your field.</p>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Your APS"
          value={profile.aps_score ?? "—"}
          hint={profile.preferred_field ?? "Complete profile"}
        />
        <Stat
          label="NSFAS"
          value={nsfas ? "Applying" : "Not added"}
          hint={nsfas ? "Fee: R0" : "Add on Apply"}
          tone={nsfas ? "success" : "muted"}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Applications" value={unis.length} hint={`${paidCount} paid`} />
        <Stat
          label="Status"
          value={
            profile.status === "draft" ? "Draft" : profile.status === "submitted" ? "Submitted" : profile.status === "processing" ? "Processing" : "Complete"
          }
          tone={profile.status === "draft" ? "muted" : "success"}
        />
      </div>

      <section>
        <div className="flex justify-between items-end mb-3">
          <h2 className="font-display text-xl">Your applications</h2>
          <Link to="/recommendations" className="text-brand-600 text-xs font-bold uppercase tracking-wide">
            Manage
          </Link>
        </div>

        {apps.length === 0 && (
          <div className="bg-white rounded-2xl border border-brand-900/5 p-6 text-center">
            <p className="text-sm text-brand-900/60 mb-3">No applications yet.</p>
            <Link
              to="/recommendations"
              className="inline-block bg-brand-600 text-white font-semibold px-5 py-2.5 rounded-xl"
            >
              Browse institutions
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {apps.map((a) => {
            if (!a.institution) return null;
            const paid = a.payment_status === "paid";
            const free = a.payment_status === "free" || a.institution.is_free;
            return (
              <div key={a.id} className="bg-white rounded-2xl border border-brand-900/5 overflow-hidden">
                <div className="p-5">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-900/40">
                        {a.institution.type === "nsfas" ? "Funding" : a.institution.type === "tvet" ? "TVET" : "University"}
                      </p>
                      <h3 className="font-semibold text-base leading-tight mt-1">{a.institution.name}</h3>
                    </div>
                    <StatusPill status={a.payment_status} free={free} />
                  </div>
                </div>
                {a.institution.type !== "nsfas" && (
                  <div className="px-5 py-3 bg-brand-50 flex items-center justify-between border-t border-brand-900/5">
                    <span className="text-sm font-semibold">
                      {free ? "Free" : `R${(a.amount_cents / 100).toFixed(2)}`}
                    </span>
                    {paid || free ? (
                      <span className="text-xs text-brand-900/40 font-semibold uppercase tracking-wide">
                        {paid ? "Paid" : "No fee"}
                      </span>
                    ) : (
                      <button
                        onClick={() => navigate({ to: "/payment/$id", params: { id: a.id } })}
                        className="bg-brand-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide active:scale-95"
                      >
                        Pay R{(a.amount_cents / 100).toFixed(0)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {updates.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-3">Recent updates</h2>
          <div className="space-y-2">
            {updates.map((u) => (
              <div key={u.id} className="bg-white border border-brand-900/5 rounded-xl p-4">
                <p className="font-semibold text-sm">{u.title}</p>
                {u.body && <p className="text-sm text-brand-900/60 mt-1">{u.body}</p>}
                <p className="text-[10px] uppercase font-bold text-brand-900/40 mt-2 tracking-widest">
                  {new Date(u.created_at).toLocaleString("en-ZA")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {apps.length > 0 && profile.status === "draft" && (
        <div className="bg-brand-900 rounded-3xl p-7 text-center text-white">
          <h3 className="font-display text-2xl mb-2">Ready to submit?</h3>
          <p className="text-white/70 text-sm mb-5">
            You can submit now even if some fees are unpaid — pay them later from your dashboard.
          </p>
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full bg-white text-brand-900 font-bold py-4 rounded-2xl active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit profile for processing"}
          </button>
          <p className="text-[10px] uppercase tracking-widest text-white/40 mt-4 font-bold">
            Completely free processing
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "success" | "muted";
}) {
  const valueColor =
    tone === "success" ? "text-success" : tone === "muted" ? "text-brand-900/50" : "text-brand-900";
  return (
    <div className="bg-white rounded-2xl border border-brand-900/5 p-4">
      <p className="text-[10px] uppercase font-bold tracking-widest text-brand-900/40">{label}</p>
      <p className={`font-display text-2xl mt-1 ${valueColor}`}>{value}</p>
      {hint && <p className="text-[10px] text-brand-900/40 font-semibold mt-1.5 uppercase tracking-wide">{hint}</p>}
    </div>
  );
}

function StatusPill({ status, free }: { status: string; free: boolean }) {
  if (free)
    return (
      <span className="px-2 py-1 bg-success/10 text-success text-[10px] font-bold rounded uppercase tracking-wide flex items-center gap-1">
        <CheckCircle2 className="size-3" /> Free
      </span>
    );
  if (status === "paid")
    return (
      <span className="px-2 py-1 bg-success/10 text-success text-[10px] font-bold rounded uppercase tracking-wide flex items-center gap-1">
        <CheckCircle2 className="size-3" /> Paid
      </span>
    );
  if (status === "pending")
    return (
      <span className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-bold rounded uppercase tracking-wide flex items-center gap-1">
        <Clock className="size-3" /> Pending
      </span>
    );
  return (
    <span className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-bold rounded uppercase tracking-wide">
      Fee due
    </span>
  );
}
