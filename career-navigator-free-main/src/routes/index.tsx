import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, MapPin, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-brand-50 text-brand-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-brand-900/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="size-8 bg-brand-600 rounded-lg grid place-items-center text-white font-bold">C</div>
          <span className="font-display text-xl tracking-tight">
            CareerPath <span className="text-brand-600">SA</span>
          </span>
        </div>
        <Link to="/auth" className="text-sm font-semibold text-brand-600">
          Sign in
        </Link>
      </header>

      <main className="max-w-md mx-auto px-6 pt-10 pb-24 space-y-10">
        <section className="space-y-5">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-600 bg-brand-600/10 px-3 py-1 rounded-full">
            <Sparkles className="size-3.5" /> 100% free · non-profit
          </span>
          <h1 className="font-display text-4xl leading-[1.05] text-balance">
            Your bridge to university, TVET & NSFAS.
          </h1>
          <p className="text-brand-900/70 leading-relaxed">
            One profile. Every South African institution. We calculate your APS, recommend where to apply, and help you
            pay application fees securely — all in one place.
          </p>
          <Link
            to="/auth"
            className="block text-center bg-brand-900 text-white font-semibold py-4 rounded-2xl active:scale-95 transition-transform shadow-lg shadow-brand-900/10"
          >
            Start your free application
          </Link>
          <p className="text-xs text-brand-900/50 text-center">
            No hidden fees. Only the university application fee (paid securely to the university) is charged.
          </p>
        </section>

        <section className="grid gap-3">
          {[
            {
              icon: MapPin,
              title: "Find institutions near you",
              body: "We use your location to surface universities and TVET colleges in your province.",
            },
            {
              icon: GraduationCap,
              title: "AI matched to your APS",
              body: "Enter your matric marks — we calculate your APS and match qualifying institutions.",
            },
            {
              icon: ShieldCheck,
              title: "One-tap NSFAS",
              body: "Track your NSFAS funding status right alongside your applications.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-white rounded-2xl border border-brand-900/5 p-5 flex gap-4">
              <div className="size-10 rounded-xl bg-brand-600/10 grid place-items-center text-brand-600 shrink-0">
                <Icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{title}</h3>
                <p className="text-sm text-brand-900/60 mt-1">{body}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="bg-brand-900 text-white rounded-3xl p-8 text-center">
          <h2 className="font-display text-2xl mb-2">Built for matriculants.</h2>
          <p className="text-white/70 text-sm mb-6">
            A non-profit initiative helping South African learners take the next step.
          </p>
          <Link
            to="/auth"
            className="block bg-white text-brand-900 font-bold py-4 rounded-2xl active:scale-95 transition-transform"
          >
            Create free account
          </Link>
        </section>
      </main>
    </div>
  );
}
