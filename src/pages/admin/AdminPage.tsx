import React, { useState } from "react";
import Header from "../../components/Header";
import CreateOks from "../../components/admin/CreateOks";
import RoleManagement from "../../components/admin/RoleManagement";
import "../../styles/AdminPage.css";

const AdminPage: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOksCreated = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="admin-page">
      <Header />
      <main className="admin-content">
        <CreateOks onSuccess={handleOksCreated} />
        <RoleManagement refreshTrigger={refreshKey} />
      </main>
    </div>
  );
};

export default AdminPage;
