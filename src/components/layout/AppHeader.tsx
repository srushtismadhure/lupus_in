import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/AuthProvider";

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="flex items-center justify-between border-b border-[#DCE6F0] bg-white/95 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-lg font-semibold text-[#1F2430]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-[#4F5E70]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {user && <span className="hidden text-sm font-medium text-[#4F5E70] lg:inline">{user.displayName}</span>}
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </header>
  );
}
