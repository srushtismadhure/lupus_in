import { Link } from "react-router-dom";
import { CircleHelp, House } from "lucide-react";
import { PortalPageHeader } from "@/components/patient-portal/PortalPageHeader";
import { Button } from "@/components/ui/button";

export function PortalNotFoundPage() { return <div><PortalPageHeader title="Page not found" subtitle="This patient portal page is not available." icon={CircleHelp} /><Button asChild className="min-h-11"><Link to="/portal"><House aria-hidden="true" />Return home</Link></Button></div>; }

