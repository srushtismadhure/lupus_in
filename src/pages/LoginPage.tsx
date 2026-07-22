import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import logo from "@/assets/images/logo.png";

export function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center gap-6 bg-[#2D123F] px-10 py-16 text-white md:px-16">
        <div className="flex items-center gap-3">
          <img src={logo} alt="LuppedIn" className="size-10" />
          <span className="text-lg font-semibold tracking-tight">LuppedIn</span>
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
            <CardTitle className="text-xl">Explore the LuppedIn Demo</CardTitle>
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
