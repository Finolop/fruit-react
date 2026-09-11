import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';

import { RootState } from '../../store';

const ProtectedRoute = () => {
    const user = useSelector(
        (state: RootState) => state.auth.user
    );

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;