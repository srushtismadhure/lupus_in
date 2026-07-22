import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function KidneyLineIcon() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="size-10 text-[#78B7E3]" aria-hidden="true">
      <path
        d="M18 6C10 6 6 14 6 22c0 10 6 20 14 20 4 0 5-3 5-7 0-3-2-4-2-7 0-3 2-4 5-4 6 0 8-6 8-11 0-8-6-14-13-14-2 0-3 1-5 1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M20 16c3 2 3 6 0 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center gap-6 bg-[#2D123F] px-10 py-16 text-white md:px-16">
        <div className="flex items-center gap-3">
          <KidneyLineIcon />
          <span className="text-lg font-semibold tracking-tight">NEPHRA</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight">Lupus Nephritis Control Center</h1>
          <p className="max-w-sm text-sm text-[#B9DCF4]">
            FHIR-connected renal monitoring and clinical decision support.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-[#F3F9FD] px-6 py-16">
        <Card className="w-full max-w-sm border-[#D2E9F7] p-8">
          <CardHeader className="p-0">
            <CardTitle className="text-xl">Explore the NEPHRA Demo</CardTitle>
            <CardDescription>
              Review synthetic lupus nephritis records, longitudinal kidney metrics and FHIR-connected clinical
              workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
