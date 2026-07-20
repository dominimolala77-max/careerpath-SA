import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Home, LayoutDashboard, User, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  };
  return (
    <div className="min-h-screen bg-brand-50 text-brand-900 pb-24">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-brand-900/5 px-6 py-3.5 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="size-8 bg-brand-600 rounded-lg grid place-items-center text-white font-bold">C</div>
          <span className="font-display text-lg">
            CareerPath <span className="text-brand-600">SA</span>
          </span>
        </Link>
        <button onClick={signOut} className="text-brand-900/50 p-2 -mr-2" aria-label="Sign out">
          <LogOut className="size-5" />
        </button>
      </header>
      <main className="max-w-md mx-auto">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-brand-900/5 px-6 py-3 grid grid-cols-3 gap-2 max-w-md mx-auto">
        <NavItem to="/dashboard" icon={<LayoutDashboard className="size-5" />} label="Dashboard" />
        <NavItem to="/recommendations" icon={<Home className="size-5" />} label="Apply" />
        <NavItem to="/onboarding" icon={<User className="size-5" />} label="Profile" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "text-brand-600" }}
      inactiveProps={{ className: "text-brand-900/40" }}
      className="flex flex-col items-center gap-1 py-1"
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
    </Link>
  );
}
