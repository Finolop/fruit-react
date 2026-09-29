import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../store";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isLoading } = useSelector((state: RootState) => state.auth);

  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  // 1. Если не авторизован — отправляем на логин
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Если для маршрута заданы роли — проверяем наличие нужной роли
  if (allowedRoles && allowedRoles.length > 0) {
    const userRoles = (user.roles || []).map((r) => r.toLowerCase());
    const hasPermission = allowedRoles.some((role) =>
      userRoles.includes(role.toLowerCase()),
    );

    // Если роли нет — перенаправляем на корень "/", где RootRedirect отправит в свой раздел
    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
