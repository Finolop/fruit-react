import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./store";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";

import AdminPage from "./pages/admin/AdminPage";
import RegistryPage from "./pages/admin/RegistryPage";

import ForemanPage from "./pages/foreman/ForemanPage";
import EngineerPage from "./pages/engineer/EngineerPage";

import ProtectedRoute from "./components/auth/ProtectedRoute";

// Автоматический редирект в домашний раздел пользователя по его роли
const RootRedirect = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const roles = (user?.roles || []).map((r) => r.toUpperCase());

  if (roles.includes("ADMIN")) {
    return <Navigate to="/admin/registry" replace />;
  }
  if (roles.includes("ENGINEER")) {
    return <Navigate to="/engineer" replace />;
  }
  if (roles.includes("FOREMAN")) {
    return <Navigate to="/foreman" replace />;
  }

  return <HomePage />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичные маршруты */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Защищенные маршруты с контролем ролей */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RootRedirect />} />

          {/* 1. Разделы прораба (доступны только прорабу и админу для контроля) */}
          <Route
            element={<ProtectedRoute allowedRoles={["foreman", "admin"]} />}
          >
            <Route path="/foreman" element={<ForemanPage />} />
            <Route path="/foreman/:projectId" element={<ForemanPage />} />
          </Route>

          {/* 2. Разделы инженера (доступны только инженеру и админу для контроля) */}
          <Route
            element={<ProtectedRoute allowedRoles={["engineer", "admin"]} />}
          >
            <Route path="/engineer" element={<EngineerPage />} />
            <Route path="/engineer/:projectId" element={<EngineerPage />} />
          </Route>

          {/* 3. Разделы Департамента (строго только для admin) */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin/registry" element={<RegistryPage />} />
            <Route path="/admin/oks" element={<AdminPage />} />
            <Route
              path="/admin"
              element={<Navigate to="/admin/registry" replace />}
            />
          </Route>
        </Route>

        {/* Любой несуществующий URL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
