import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, MapPin } from "lucide-react";

type Institution = {
  id: string;
  name: string;
  type: "university" | "tvet" | "nsfas";
  province: string | null;
  min_aps: number | null;
  application_fee_cents: number;
  is_free: boolean;
  closing_date: string | null;
  description: string | null;
};

export const Route = createFileRoute("/_authenticated/recommendations")({
  component: RecommendationsPage,
});

function RecommendationsPage() {
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aps, setAps] = useState(0);
  const [province, setProvince] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "qualifies" | "province">("qualifies");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const [{ data: profile }, { data: inst }, { data: apps }] = await Promise.all([
        supabase.from("profiles").select("aps_score, province").eq("id", u.user.id).maybeSingle(),
        supabase.from("institutions").select("*").order("type").order("name"),
        supabase.from("applications").select("institution_id").eq("user_id", u.user.id),
      ]);
      setAps(profile?.aps_score ?? 0);
      setProvince(profile?.province ?? null);
      setInstitutions((inst ?? []) as Institution[]);
      setSelected(new Set((apps ?? []).map((a) => a.institution_id)));
    })();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      // delete removed
      const { data: existing } = await supabase
        .from("applications")
        .select("id, institution_id, payment_status")
        .eq("user_id", u.user.id);
      const existingMap = new Map((existing ?? []).map((a) => [a.institution_id, a]));
      const toDelete = (existing ?? []).filter((a) => !selected.has(a.institution_id));
      if (toDelete.length) {
        await supabase.from("applications").delete().in("id", toDelete.map((a) => a.id));
      }
      const toInsert = Array.from(selected)
        .filter((id) => !existingMap.has(id))
        .map((institution_id) => {
          const inst = institutions.find((i) => i.id === institution_id)!;
          return {
            user_id: u.user!.id,
            institution_id,
            amount_cents: inst.application_fee_cents,
            payment_status: (inst.is_free ? "free" : "unpaid") as "free" | "unpaid",
          };
        });
      if (toInsert.length) {
        const { error } = await supabase.from("applications").insert(toInsert);
        if (error) throw error;
      }
      toast.success("Applications saved");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const filtered = institutions.filter((i) => {
    if (i.type === "nsfas") return true;
    if (filter === "qualifies") return i.min_aps == null || aps >= i.min_aps;
    if (filter === "province") return !province || i.province === province;
    return true;
  });

  return (
    <div className="px-6 pt-6 pb-40">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-600">AI Matched</p>
        <h1 className="font-display text-3xl mt-1">Recommended for you</h1>
        <p className="text-sm text-brand-900/60 mt-1">
          Based on your APS of <b>{aps}</b>
          {province ? ` and ${province} location` : ""}.
        </p>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto -mx-6 px-6 pb-2">
        {[
          { k: "qualifies", label: "You qualify" },
          { k: "province", label: "Near you" },
          { k: "all", label: "All" },
        ].map(({ k, label }) => (
          <button
            key={k}
            onClick={() => setFilter(k as typeof filter)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap uppercase tracking-wide ${
              filter === k ? "bg-brand-900 text-white" : "bg-white border border-brand-900/10 text-brand-900/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((inst) => {
          const isSelected = selected.has(inst.id);
          const qualifies = inst.min_aps == null || aps >= inst.min_aps;
          return (
            <button
              key={inst.id}
              onClick={() => toggle(inst.id)}
              className={`w-full text-left bg-white rounded-2xl border p-5 transition-all ${
                isSelected ? "border-brand-600 shadow-lg shadow-brand-600/10" : "border-brand-900/5"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="pr-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-600">
                    {inst.type === "nsfas" ? "Funding" : inst.type === "tvet" ? "TVET College" : "University"}
                  </p>
                  <h3 className="font-semibold text-base leading-tight mt-1">{inst.name}</h3>
                  {inst.province && (
                    <p className="text-xs text-brand-900/50 mt-1 flex items-center gap-1">
                      <MapPin className="size-3" /> {inst.province}
                    </p>
                  )}
                </div>
                <div
                  className={`size-7 rounded-full grid place-items-center shrink-0 border-2 ${
                    isSelected ? "bg-brand-600 border-brand-600 text-white" : "border-brand-900/15"
                  }`}
                >
                  {isSelected && <Check className="size-4" />}
                </div>
              </div>
              <p className="text-sm text-brand-900/60 mt-2">{inst.description}</p>
              <div className="flex flex-wrap gap-3 mt-3 text-xs">
                {inst.min_aps != null && (
                  <Tag positive={qualifies}>Min APS {inst.min_aps}</Tag>
                )}
                <Tag>
                  {inst.is_free
                    ? "Free application"
                    : `Fee R${(inst.application_fee_cents / 100).toFixed(2)}`}
                </Tag>
                {inst.closing_date && (
                  <Tag>Closes {new Date(inst.closing_date).toLocaleDateString("en-ZA", { month: "short", day: "numeric" })}</Tag>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="fixed bottom-20 left-0 right-0 px-6 max-w-md mx-auto">
        <button
          onClick={save}
          disabled={busy || selected.size === 0}
          className="w-full bg-brand-900 text-white font-bold py-4 rounded-2xl active:scale-[0.98] shadow-xl shadow-brand-900/20 disabled:opacity-30"
        >
          {busy ? "Saving…" : `Save ${selected.size} selected → Dashboard`}
        </button>
      </div>

      <div className="mt-8 text-center">
        <Link to="/dashboard" className="text-sm text-brand-900/50 underline">
          Skip for now
        </Link>
      </div>
    </div>
  );
}

function Tag({ children, positive }: { children: React.ReactNode; positive?: boolean }) {
  return (
    <span
      className={`px-2 py-1 rounded-md font-semibold ${
        positive === true
          ? "bg-success/10 text-success"
          : positive === false
            ? "bg-warning/10 text-warning"
            : "bg-brand-900/5 text-brand-900/60"
      }`}
    >
      {children}
    </span>
  );
}
