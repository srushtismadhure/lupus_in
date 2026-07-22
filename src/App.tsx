import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { NurseDashboardPage } from "@/pages/NurseDashboardPage";
import { PatientsPage } from "@/pages/PatientsPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { PatientDashboardPage } from "@/pages/PatientDashboardPage";
import "./index.css";

/** Sends an authenticated user to the dashboard for their demo role. Unauthenticated users fall through to /login via ProtectedRoute. */
function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "nurse" ? "/nurse" : "/clinician"} replace />;
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
              <OverviewPage />
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
      </Routes>
    </AuthProvider>
  );
}

export default App;
