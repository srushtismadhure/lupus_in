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
import "./index.css";
import { MADISON_GRACE_PATIENT_ID } from "@/lib/madison-class-iv-data";

/** Sends an authenticated user to the dashboard for their demo role. Unauthenticated users fall through to /login via ProtectedRoute. */
function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "nurse" ? "/nurse" : `/patients/${MADISON_GRACE_PATIENT_ID}`} replace />;
}

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
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nurse"
          element={
            <ProtectedRoute>
              <NurseDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients"
          element={
            <ProtectedRoute>
              <PatientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/overview"
          element={
            <ProtectedRoute>
              <Navigate to={`/patients/${MADISON_GRACE_PATIENT_ID}`} replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medications"
          element={
            <ProtectedRoute>
              <MedicationsOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/kidney-services"
          element={
            <ProtectedRoute>
              <KidneyServicesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId"
          element={
            <ProtectedRoute>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/medications"
          element={
            <ProtectedRoute>
              <MedicationManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/notes-coding"
          element={
            <ProtectedRoute>
              <NotesCodingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/renal-timeline"
          element={
            <ProtectedRoute>
              <RenalTrendsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/referrals"
          element={
            <ProtectedRoute>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/tasks"
          element={
            <ProtectedRoute>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:patientId/fhir-evidence"
          element={
            <ProtectedRoute>
              <PatientDashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
