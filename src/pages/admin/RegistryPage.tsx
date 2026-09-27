import React from "react";

import Header from "../../components/Header";
import RegistryList from "../../components/admin/RegistryList";

import "../../styles/RegistryPage.css";

const RegistryPage = () => {
    return (
        <div className="registry-page">
            <Header />

            <main className="registry-content">
                <RegistryList />
            </main>
        </div>
    );
};

export default RegistryPage