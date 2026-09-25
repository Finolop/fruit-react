import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";

import AdminPage from "./pages/admin/AdminPage";
import RegistryPage from "./pages/admin/RegistryPage";

import ForemanPage from "./pages/foreman/ForemanPage";

import ProtectedRoute from "./components/auth/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<HomePage />} />

          {/* {ОКС прораб} */}
          <Route path="/foreman" element={<ForemanPage />} />

          {/* Реестр строек */}
          <Route path="/admin/registry" element={<RegistryPage />} />

          {/* Управление ОКС */}
          <Route path="/admin/oks" element={<AdminPage />} />

          {/* Старый путь */}
          <Route
            path="/admin"
            element={<Navigate to="/admin/registry" replace />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
