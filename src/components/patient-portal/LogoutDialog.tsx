import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function LogoutDialog({ open, onOpenChange, onConfirm, mode = "logout", busy = false }: { open: boolean; onOpenChange: (open: boolean) => void; onConfirm: () => void; mode?: "logout" | "exit"; busy?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><LogOut className="size-5 text-[color:var(--primary)]" aria-hidden="true" />{mode === "exit" ? "Exit patient portal?" : "Log out?"}</DialogTitle><DialogDescription>{mode === "exit" ? "Your patient session will end and you will return to the demo role selector." : "Your patient session will end. Protected pages will require a new sign-in."}</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Stay in portal</Button><Button onClick={onConfirm} disabled={busy}>{busy ? "Ending session..." : mode === "exit" ? "Exit portal" : "Log out"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

