import React from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import "../styles/LoginForm.css";

const LoginPage = () => {
    return (
        <main className="login-page">
            <LoginForm />
        </main>
    );
};

export default LoginPage;