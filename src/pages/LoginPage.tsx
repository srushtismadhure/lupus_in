import { LoginForm } from "@/components/auth/LoginForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import logo from "@/assets/images/logo.png";
import { useSearchParams } from "react-router-dom";

export function LoginPage() {
  const [searchParams] = useSearchParams();
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="flex flex-col justify-center gap-6 bg-[#2B123E] px-10 py-16 text-white md:px-16">
        <div className="flex items-center gap-3">
          <img src={logo} alt="LoopedIn" className="size-10" />
          <span className="text-lg font-semibold">LoopedIn</span>
        </div>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight text-[#F7FBFF]">Lupus Nephritis Control Center</h1>
          <p className="max-w-sm text-sm text-[#B9DCF4]">
            FHIR-connected renal monitoring and clinical decision support.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-[#F6F8FB] px-6 py-16">
        <Card className="w-full max-w-sm p-8">
          <CardHeader className="p-0">
            <CardTitle className="text-xl text-[#1F2430]">Explore the LoopedIn Demo</CardTitle>
            <CardDescription className="text-[#4F5E70]">
              Review synthetic lupus nephritis records, longitudinal kidney metrics and FHIR-connected clinical
              workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {searchParams.get("loggedOut") === "1" && <p role="status" className="mb-4 rounded-lg border border-[#BFDCC9] bg-[#EAF5EE] px-3 py-2 text-sm font-semibold text-[#2F6F47]">You have been logged out.</p>}
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
