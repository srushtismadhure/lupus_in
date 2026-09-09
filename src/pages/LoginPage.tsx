import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import logo from "@/assets/images/logo.png";
import { useEffect } from "react";

export function LoginPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Waypoint | COPD Care Transitions";
    return () => { document.title = previousTitle; };
  }, []);
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="flex items-center justify-center bg-[var(--brand-navy)] px-6 py-8 text-white sm:px-8 sm:py-10 lg:px-10 lg:py-12 xl:px-16">
        <div className="w-full max-w-md space-y-4 lg:space-y-5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Waypoint" className="size-[38px] shrink-0 lg:size-12" />
          <span className="text-[21px] font-semibold">Waypoint</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold leading-tight text-[color:var(--card)] lg:text-4xl">COPD Care Transitions</h1>
          <p className="max-w-sm text-sm leading-6 text-[color:var(--sky-blue)]">
            Connecting home-health findings with ambulatory care and pulmonary rehabilitation.
          </p>
        </div>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-center bg-background px-4 py-6 sm:px-8 sm:py-8 lg:py-12">
        <Card className="w-full max-w-md gap-5 rounded-lg p-5 shadow-sm sm:p-6">
          <CardHeader className="gap-2 p-0">
            <CardTitle className="text-xl text-[color:var(--foreground)]">Choose your workspace</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
