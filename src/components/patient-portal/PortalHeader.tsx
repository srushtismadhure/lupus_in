import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftFromLine, CircleHelp, LogOut, MessageCircle, Settings2, UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogoutDialog } from "./LogoutDialog";

export function PortalHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dialogMode, setDialogMode] = useState<"logout" | "exit" | null>(null);
  const [busy, setBusy] = useState(false);

  async function endSession() {
    setBusy(true);
    await logout();
    window.location.replace(dialogMode === "logout" ? "/login?loggedOut=1" : "/login");
  }

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-[#DCE6F0] bg-white/95 px-4 py-3 backdrop-blur sm:px-6" aria-label="Patient portal header">
      <div className="min-w-0 lg:hidden"><p className="truncate font-semibold text-[#2B123E]">LoopedIn</p><p className="text-xs text-[#526172]">Patient portal</p></div>
      <div className="hidden min-w-0 lg:block"><p className="text-sm font-semibold text-[#1F2430]">Your health record</p><p className="text-xs text-[#526172]">Private patient view</p></div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" className="min-h-11 min-w-11 px-3"><a href="/portal/messages"><MessageCircle aria-hidden="true" /><span className="hidden sm:inline">Messages</span><span className="sr-only sm:hidden">Messages</span></a></Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" className="min-h-11"><UserRound aria-hidden="true" /><span className="hidden max-w-[180px] truncate sm:inline">{user?.displayName ?? "My account"}</span><span className="sm:hidden">Account</span></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel><span className="block font-semibold">{user?.displayName}</span><span className="block text-xs font-normal text-[#697586]">Patient portal session</span></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/portal/profile")} className="min-h-11"><UserRound aria-hidden="true" />My profile</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/portal/profile#accessibility")} className="min-h-11"><Settings2 aria-hidden="true" />Accessibility settings</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/portal/help")} className="min-h-11"><CircleHelp aria-hidden="true" />Help</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setDialogMode("exit")} className="min-h-11"><ArrowLeftFromLine aria-hidden="true" />Exit portal</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setDialogMode("logout")} variant="destructive" className="min-h-11"><LogOut aria-hidden="true" />Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <LogoutDialog open={dialogMode !== null} onOpenChange={open => { if (!open) setDialogMode(null); }} onConfirm={endSession} mode={dialogMode ?? "logout"} busy={busy} />
    </header>
  );
}
