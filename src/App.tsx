import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NurseDashboardPage } from "@/pages/NurseDashboardPage";
import { PatientsPage } from "@/pages/PatientsPage";
import { PatientDashboardPage } from "@/pages/PatientDashboardPage";
import { MedicationManagementPage } from "@/pages/MedicationManagementPage";
import { MedicationsOverviewPage } from "@/pages/MedicationsOverviewPage";
import { KidneyServicesPage } from "@/pages/KidneyServicesPage";
import { NotesCodingPage } from "@/pages/NotesCodingPage";
import { RenalTrendsPage } from "@/pages/RenalTrendsPage";
import { CareCoordinationPage } from "@/pages/CareCoordinationPage";
import { SleSystemsReviewPage } from "@/pages/SleSystemsReviewPage";
import { PortalLayout } from "@/components/patient-portal/PortalLayout";
import { PortalHomePage } from "@/pages/patient-portal/PortalHomePage";
import { PortalLupusPage } from "@/pages/patient-portal/PortalLupusPage";
import { PortalLabsPage } from "@/pages/patient-portal/PortalLabsPage";
import { PortalLabDetailPage } from "@/pages/patient-portal/PortalLabDetailPage";
import { PortalNutritionPage } from "@/pages/patient-portal/PortalNutritionPage";
import { PortalCarePlanPage } from "@/pages/patient-portal/PortalCarePlanPage";
import { PortalAppointmentsPage } from "@/pages/patient-portal/PortalAppointmentsPage";
import { PortalMedicationsPage } from "@/pages/patient-portal/PortalMedicationsPage";
import { PortalMessagesPage } from "@/pages/patient-portal/PortalMessagesPage";
import { PortalCareTeamPage } from "@/pages/patient-portal/PortalCareTeamPage";
import { PortalDocumentsPage } from "@/pages/patient-portal/PortalDocumentsPage";
import { PortalProfilePage } from "@/pages/patient-portal/PortalProfilePage";
import { PortalHelpPage } from "@/pages/patient-portal/PortalHelpPage";
import { PortalNotFoundPage } from "@/pages/patient-portal/PortalNotFoundPage";
import "./index.css";
import { MADISON_GRACE_PATIENT_ID } from "@/lib/madison-class-iv-data";

/** Sends an authenticated user to the dashboard for their demo role. Unauthenticated users fall through to /login via ProtectedRoute. */
function RoleHome() {
  const { user } = useAuth();
  const destination = user?.role === "patient" ? "/portal" : user?.role === "nurse" ? "/nurse" : `/patients/${MADISON_GRACE_PATIENT_ID}`;
  return <Navigate to={destination} replace />;
}

const STAFF_ROLES = ["nurse", "clinician"] as const;

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <RoleHome />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<Navigate to="/clinician" replace />} />
        <Route
          path="/clinician"
          element={
            <ProtectedRoute allowedRoles={["clinician"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nurse"
          element={
            <ProtectedRoute allowedRoles={["nurse"]}>
              <NurseDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/portal"
          element={
            <ProtectedRoute allowedRoles={["patient"]}>
              <PortalLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<PortalHomePage />} />
          <Route path="lupus" element={<PortalLupusPage />} />
          <Route path="labs" element={<PortalLabsPage />} />
          <Route path="labs/:resultId" element={<PortalLabDetailPage />} />
          <Route path="nutrition" element={<PortalNutritionPage />} />
          <Route path="care-plan" element={<PortalCarePlanPage />} />
          <Route path="appointments" element={<PortalAppointmentsPage />} />
          <Route path="medications" element={<PortalMedicationsPage />} />
          <Route path="messages" element={<PortalMessagesPage />} />
          <Route path="care-team" element={<PortalCareTeamPage />} />
          <Route path="documents" element={<PortalDocumentsPage />} />
          <Route path="profile" element={<PortalProfilePage />} />
          <Route path="help" element={<PortalHelpPage />} />
          <Route path="*" element={<PortalNotFoundPage />} />
        </Route>
        <Route
          path="/patients"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <PatientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sle-systems-review"
          element={
            <ProtectedRoute allowedRoles={["clinician"]}>
              <SleSystemsReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/overview"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <Navigate to={`/patients/${MADISON_GRACE_PATIENT_ID}`} replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medications"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <MedicationsOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kidney-services"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <KidneyServicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/medications"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <MedicationManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/notes-coding"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <NotesCodingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/renal-timeline"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <RenalTrendsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/care-coordination"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <CareCoordinationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/referrals"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/tasks"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/fhir-evidence"
          element={
            <ProtectedRoute allowedRoles={[...STAFF_ROLES]}>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
