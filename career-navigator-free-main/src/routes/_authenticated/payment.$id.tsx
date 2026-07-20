import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreditCard, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";

type App = {
  id: string;
  amount_cents: number;
  payment_status: string;
  institution: { name: string; type: string } | null;
};

export const Route = createFileRoute("/_authenticated/payment/$id")({
  component: PaymentPage,
});

function PaymentPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState<App | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, amount_cents, payment_status, institution:institutions(name, type)")
        .eq("id", id)
        .maybeSingle();
      setApp(data as unknown as App | null);
    })();
  }, [id]);

  const pay = async () => {
    setBusy(true);
    try {
      // Yoco integration: in production this opens the Yoco Popup checkout using
      // your Yoco public test key. For now we simulate a successful test payment
      // and mark the application as paid via the Data API (RLS enforces ownership).
      await new Promise((r) => setTimeout(r, 1200));
      const chargeId = `test_${Date.now()}`;
      const { error } = await supabase
        .from("applications")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          yoco_charge_id: chargeId,
        })
        .eq("id", id);
      if (error) throw error;
      const { data: u } = await supabase.auth.getUser();
      if (u.user && app?.institution) {
        await supabase.from("updates").insert({
          user_id: u.user.id,
          title: `Payment received: ${app.institution.name}`,
          body: `Charge ${chargeId}. Your application fee is paid.`,
        });
      }
      setDone(true);
      toast.success("Payment successful");
      setTimeout(() => navigate({ to: "/dashboard" }), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  if (!app) {
    return <div className="px-6 pt-10 text-center text-brand-900/50 text-sm">Loading payment…</div>;
  }

  const amount = (app.amount_cents / 100).toFixed(2);

  return (
    <div className="px-6 pt-4 pb-32">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-brand-900/60 mb-6">
        <ArrowLeft className="size-4" /> Back
      </Link>

      <p className="text-xs font-bold uppercase tracking-widest text-brand-600">Application fee</p>
      <h1 className="font-display text-3xl mt-1 mb-6">{app.institution?.name}</h1>

      <div className="bg-white border border-brand-900/5 rounded-2xl p-6 mb-4">
        <div className="flex items-baseline justify-between">
          <span className="text-brand-900/60">Amount due</span>
          <span className="font-display text-4xl">R{amount}</span>
        </div>
        <div className="mt-4 pt-4 border-t border-brand-900/5 text-sm text-brand-900/60 space-y-1">
          <div className="flex justify-between">
            <span>Reference</span>
            <span className="font-mono text-xs">{app.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span>Processed by</span>
            <span>Yoco</span>
          </div>
        </div>
      </div>

      {done ? (
        <div className="bg-success/10 text-success rounded-2xl p-6 text-center">
          <CheckCircle2 className="size-12 mx-auto mb-2" />
          <p className="font-bold">Payment successful</p>
          <p className="text-sm mt-1 text-success/80">Redirecting to your dashboard…</p>
        </div>
      ) : (
        <>
          <button
            onClick={pay}
            disabled={busy}
            className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl active:scale-[0.98] shadow-lg shadow-brand-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CreditCard className="size-5" />
            {busy ? "Processing…" : `Pay R${amount} with Yoco`}
          </button>
          <p className="text-xs text-brand-900/40 text-center mt-4 flex items-center justify-center gap-1">
            <Lock className="size-3" /> Secure test payment · you will not be charged
          </p>
          <p className="text-[11px] text-brand-900/40 text-center mt-2 px-4">
            Yoco live checkout will activate once your Yoco test keys are added.
          </p>
        </>
      )}
    </div>
  );
}
