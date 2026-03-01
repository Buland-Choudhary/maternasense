import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "../components/layout/AppShell";
import SingleCheck from "../pages/SingleCheck";
import TrendMonitor from "../pages/TrendMonitor";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/single" replace />} />
        <Route path="/single" element={<SingleCheck />} />
        <Route path="/trend" element={<TrendMonitor />} />
      </Route>

      <Route path="*" element={<Navigate to="/single" replace />} />
    </Routes>
  );
}