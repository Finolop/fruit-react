import React from "react";

import Header from "../../components/auth/Header";
import CreateOks from "../../components/admin/CreateOks";
import RoleManagement from "../../components/admin/RoleManagement";

import "../../styles/AdminPage.css";

const AdminPage = () => {
    return (
        <div className="admin-page">
            <Header />

            <main className="admin-content">
                <CreateOks />
                <RoleManagement />
        
            </main>
        </div>
    );
};

export default AdminPage;
