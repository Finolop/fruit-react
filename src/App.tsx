import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";

import AdminPage from "./pages/admin/AdminPage";
import RegistryPage from "./pages/admin/RegistryPage";

import ForemanPage from "./pages/foreman/ForemanPage";
import EngineerPage from "./pages/engineer/EngineerPage";

import ProtectedRoute from "./components/auth/ProtectedRoute";

const RootRedirect = () => {
  const role = localStorage.getItem("userRole");
  const normalizedRole = role ? role.toUpperCase() : null;

  switch (normalizedRole) {
    case "FOREMAN":
      return <Navigate to="/foreman" replace />;
    case "ADMIN":
      return <Navigate to="/admin/registry" replace />;
    case "ENGINEER":
      return <Navigate to="/engineer" replace />;
    default:
      console.log("Роль не совпала, показываю HomePage");
      return <HomePage />;
  }
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Публичные маршруты */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Защищенные маршруты: доступ только при наличии токена */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RootRedirect />} />

          {/* Маршруты прораба */}
          <Route path="/foreman" element={<ForemanPage />} />
          <Route path="/foreman/:projectId" element={<ForemanPage />} />

          {/* Маршруты инженера */}
          <Route path="/engineer" element={<EngineerPage />} />
          <Route path="/engineer/:projectId" element={<EngineerPage />} />

          {/* Реестр строек */}
          <Route path="/admin/registry" element={<RegistryPage />} />

          {/* Управление ОКС */}
          <Route path="/admin/oks" element={<AdminPage />} />

          <Route
            path="/admin"
            element={<Navigate to="/admin/registry" replace />}
          />
        </Route>

        {/* Несуществующий URL */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;