import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WARNING_MS = 5 * 60 * 1000;

export function SessionTimeoutDialog() {
  const { expiresAt, extendSession, logout } = useAuth();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    let active = true;
    const tick = async () => {
      if (!active) return;
      const next = expiresAt - Date.now();
      setRemaining(next);
      if (next <= 0) {
        active = false;
        await logout();
        window.location.replace("/login?loggedOut=1");
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 1000);
    return () => { active = false; window.clearInterval(interval); };
  }, [expiresAt, logout]);

  if (remaining === null || remaining > WARNING_MS || remaining <= 0) return null;
  const minutes = Math.max(1, Math.ceil(remaining / 60_000));
  async function extend() {
    setExtending(true);
    const ok = await extendSession();
    setExtending(false);
    if (!ok) window.location.replace("/login");
  }
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent showCloseButton={false} role="alertdialog" aria-describedby="session-timeout-description">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock3 className="size-5 text-[#9A6418]" aria-hidden="true" />Your session will end soon</DialogTitle><DialogDescription id="session-timeout-description">For your privacy, you will be logged out in about {minutes} minute{minutes === 1 ? "" : "s"}. Finish or save any open form before the session ends.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={async () => { await logout(); window.location.replace("/login?loggedOut=1"); }}>Log out now</Button><Button onClick={extend} disabled={extending}>{extending ? "Extending..." : "Keep me signed in"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

