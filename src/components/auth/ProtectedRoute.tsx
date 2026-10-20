import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../../store";

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isLoading } = useSelector((state: RootState) => state.auth);

  // Показываем прелоадер только при начальной загрузке без пользователя,
  // чтобы фоновые обновления токена не размонтировали страницу
  if (isLoading && !user) {
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

    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;