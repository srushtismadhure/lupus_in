import { Outlet } from "react-router-dom";
import { MobilePortalNavigation } from "./MobilePortalNavigation";
import { PortalHeader } from "./PortalHeader";
import { PortalSidebar } from "./PortalSidebar";
import { SessionTimeoutDialog } from "./SessionTimeoutDialog";

export function PortalLayout() {
  return (
    <div className="portal-root min-h-screen bg-[#F6F9FC] text-[#1F2430]">
      <a href="#portal-main-content" className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-lg bg-white px-4 py-3 font-semibold text-[#2B123E] shadow-lg outline-none focus:translate-y-0 focus:ring-[3px] focus:ring-[#4F97C8]">Skip to main content</a>
      <PortalSidebar />
      <div className="min-h-screen lg:pl-64">
        <PortalHeader />
        <main id="portal-main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-24 outline-none sm:px-6 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <MobilePortalNavigation />
      <SessionTimeoutDialog />
    </div>
  );
}

