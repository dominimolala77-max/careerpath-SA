import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateAPS, SA_PROVINCES, STUDY_FIELDS, type Subject } from "@/lib/aps";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Upload, ChevronRight, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const STEPS = ["Location", "Personal", "Documents", "Marks", "Interests", "Field"] as const;

const DEFAULT_SUBJECTS = ["English", "Mathematics", "Life Orientation", ""];

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [busy, setBusy] = useState(false);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>(
    DEFAULT_SUBJECTS.map((n) => ({ name: n, percentage: 60 })),
  );
  const [personality, setPersonality] = useState("");
  const [sparetime, setSparetime] = useState("");
  const [field, setField] = useState("");
  const [docsUploaded, setDocsUploaded] = useState<Record<string, boolean>>({});

  const aps = calculateAPS(subjects);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      if (p) {
        setFullName(p.full_name ?? "");
        setIdNumber(p.id_number ?? "");
        setPhone(p.phone ?? "");
        setProvince(p.province ?? "");
        if (p.latitude && p.longitude) setLocation({ lat: p.latitude, lng: p.longitude });
        const quiz = (p.quiz_answers ?? {}) as { personality?: string; sparetime?: string };
        setPersonality(quiz.personality ?? "");
        setSparetime(quiz.sparetime ?? "");
        setField(p.preferred_field ?? "");
      }
      const { data: subs } = await supabase.from("subjects").select("*").eq("user_id", data.user.id);
      if (subs && subs.length) setSubjects(subs.map((s) => ({ name: s.name, percentage: s.percentage })));
    })();
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location detected");
      },
      () => toast.error("Please allow location access to continue"),
    );
  };

  const uploadDoc = async (kind: string, file: File) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const path = `${u.user.id}/${kind}-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) return toast.error(error.message);
    await supabase.from("documents").insert({ user_id: u.user.id, kind, file_path: path });
    setDocsUploaded((prev) => ({ ...prev, [kind]: true }));
    toast.success(`${kind} uploaded`);
  };

  const saveAndNext = async () => {
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");

      const patch: Record<string, unknown> = {};
      if (step === 0 && location) {
        patch.latitude = location.lat;
        patch.longitude = location.lng;
      }
      if (step === 1) {
        patch.full_name = fullName;
        patch.id_number = idNumber;
        patch.phone = phone;
        patch.province = province;
      }
      if (step === 3) {
        patch.aps_score = aps;
        // replace subjects
        await supabase.from("subjects").delete().eq("user_id", u.user.id);
        const rows = subjects
          .filter((s) => s.name.trim())
          .map((s) => ({ user_id: u.user.id, name: s.name.trim(), percentage: s.percentage }));
        if (rows.length) await supabase.from("subjects").insert(rows);
      }
      if (step === 4) {
        patch.quiz_answers = { personality, sparetime };
      }
      if (step === 5) {
        patch.preferred_field = field;
      }

      if (Object.keys(patch).length) {
        const { error } = await supabase.from("profiles").update(patch as never).eq("id", u.user.id);
        if (error) throw error;
      }

      if (step === 5) {
        toast.success("Profile saved");
        navigate({ to: "/recommendations" });
      } else {
        setStep((step + 1) as Step);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return !!location;
    if (step === 1) return fullName.length > 1 && idNumber.length >= 6 && phone && province;
    if (step === 2) return true; // Documents optional but recommended
    if (step === 3) return subjects.filter((s) => s.name.trim()).length >= 6;
    if (step === 4) return personality && sparetime;
    if (step === 5) return !!field;
    return false;
  };

  return (
    <div className="px-6 pt-6 pb-32">
      {/* progress */}
      <div className="flex items-center gap-1.5 mb-6">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand-600" : "bg-brand-900/10"}`}
          />
        ))}
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-1">
        Step {step + 1} of {STEPS.length}
      </p>
      <h1 className="font-display text-3xl mb-6">{STEPS[step]}</h1>

      {step === 0 && (
        <div className="space-y-5">
          <div className="bg-brand-600 text-white rounded-3xl p-6">
            <MapPin className="size-8 mb-3" />
            <h2 className="font-display text-2xl mb-2">Enable Location</h2>
            <p className="text-white/80 text-sm mb-5">
              We use your GPS to recommend universities and TVET colleges near you.
            </p>
            <button
              onClick={requestLocation}
              className="w-full bg-white text-brand-600 font-bold py-3.5 rounded-xl active:scale-[0.98] transition-transform"
            >
              {location ? "Location detected ✓" : "Share location access"}
            </button>
          </div>
          {location && (
            <p className="text-xs text-brand-900/60 text-center">
              {location.lat.toFixed(3)}, {location.lng.toFixed(3)}
            </p>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Thabo Mokoena" />
          <Field
            label="SA ID number"
            value={idNumber}
            onChange={setIdNumber}
            placeholder="13-digit ID"
            inputMode="numeric"
          />
          <Field label="Phone" value={phone} onChange={setPhone} placeholder="+27 82 123 4567" inputMode="tel" />
          <div>
            <label className="text-xs font-semibold text-brand-900/60 mb-1.5 block uppercase tracking-wider">
              Province
            </label>
            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="w-full bg-white border border-brand-900/10 rounded-xl px-4 py-3.5 outline-none focus:border-brand-600"
            >
              <option value="">Select…</option>
              {SA_PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-brand-900/60 mb-2">
            Upload photos or scans. You can also come back later.
          </p>
          {[
            { kind: "id_front", label: "ID document (front)" },
            { kind: "id_back", label: "ID document (back)" },
            { kind: "matric", label: "Matric certificate / latest report" },
          ].map(({ kind, label }) => (
            <DocUploader
              key={kind}
              label={label}
              done={docsUploaded[kind]}
              onFile={(f) => uploadDoc(kind, f)}
            />
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-brand-900/5 p-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-semibold text-brand-900/50 tracking-widest">Your APS</p>
              <p className="font-display text-4xl">{aps}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-brand-900/50">Top 6 subjects</p>
              <p className="text-xs text-brand-900/50">(Life Orientation excluded)</p>
            </div>
          </div>
          <div className="space-y-2">
            {subjects.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-brand-900/5 p-3 flex items-center gap-2">
                <input
                  placeholder="Subject"
                  value={s.name}
                  onChange={(e) => {
                    const copy = [...subjects];
                    copy[i] = { ...copy[i], name: e.target.value };
                    setSubjects(copy);
                  }}
                  className="flex-1 bg-transparent outline-none py-1"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={s.percentage}
                  onChange={(e) => {
                    const copy = [...subjects];
                    copy[i] = { ...copy[i], percentage: Math.max(0, Math.min(100, Number(e.target.value) || 0)) };
                    setSubjects(copy);
                  }}
                  className="w-16 bg-brand-50 rounded-lg px-2 py-1 text-right outline-none"
                />
                <span className="text-sm text-brand-900/40">%</span>
                <button
                  onClick={() => setSubjects(subjects.filter((_, j) => j !== i))}
                  className="text-brand-900/30 p-1"
                  aria-label="Remove"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setSubjects([...subjects, { name: "", percentage: 60 }])}
              className="w-full py-3 border-2 border-dashed border-brand-900/10 rounded-xl text-brand-900/50 font-medium text-sm hover:border-brand-600 hover:text-brand-600 flex items-center justify-center gap-2"
            >
              <Plus className="size-4" /> Add subject
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <QuizGroup
            title="Which best describes you?"
            value={personality}
            onChange={setPersonality}
            options={[
              "I love solving problems",
              "I enjoy creating things",
              "I like helping people",
              "I prefer working with my hands",
              "I love working with numbers & data",
            ]}
          />
          <QuizGroup
            title="How do you spend your spare time?"
            value={sparetime}
            onChange={setSparetime}
            options={[
              "Coding or tinkering with tech",
              "Sports & the outdoors",
              "Reading & writing",
              "Art, music or design",
              "Community / volunteer work",
            ]}
          />
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2">
          <p className="text-sm text-brand-900/60 mb-4">
            Pick your preferred field. We'll match universities and TVET programmes.
          </p>
          {STUDY_FIELDS.map((f) => (
            <button
              key={f}
              onClick={() => setField(f)}
              className={`w-full text-left px-4 py-4 rounded-xl border transition-colors ${
                field === f
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white border-brand-900/10 text-brand-900"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 px-6 max-w-md mx-auto">
        <button
          onClick={saveAndNext}
          disabled={!canProceed() || busy}
          className="w-full bg-brand-900 text-white font-bold py-4 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-30 flex items-center justify-center gap-2 shadow-xl shadow-brand-900/20"
        >
          {step === 5 ? "See recommendations" : "Continue"} <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "tel";
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-brand-900/60 mb-1.5 block uppercase tracking-wider">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full bg-white border border-brand-900/10 rounded-xl px-4 py-3.5 outline-none focus:border-brand-600"
      />
    </div>
  );
}

function DocUploader({ label, done, onFile }: { label: string; done?: boolean; onFile: (f: File) => void }) {
  return (
    <label className="bg-white rounded-xl border border-brand-900/5 p-4 flex items-center gap-3 cursor-pointer active:bg-brand-50">
      <div
        className={`size-10 rounded-xl grid place-items-center ${
          done ? "bg-success/10 text-success" : "bg-brand-600/10 text-brand-600"
        }`}
      >
        {done ? <Check className="size-5" /> : <Upload className="size-5" />}
      </div>
      <div className="flex-1">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-brand-900/50">{done ? "Uploaded" : "Tap to upload"}</p>
      </div>
      <input
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function QuizGroup({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-colors text-sm ${
              value === o
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white border-brand-900/10 text-brand-900"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
