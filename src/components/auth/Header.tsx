import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";

import { AppDispatch, RootState } from "../../store";
import { logoutThunk } from "../../features/auth/authSlice";

import "../../styles/Header.css";
import logo from "../../assets/images/logo.svg";
import logo_sec from "../../assets/images/logo_sec.png";
import arrow_down from "../../assets/images/arrow_down.svg";

const Header = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const user = useSelector((state: RootState) => state.auth.user);

  const isDepartment = user?.roles.includes("department");
  const isEngineer = user?.roles.includes("engineer");
  const isForeman = user?.roles.includes("foreman");

  const handleLogout = async () => {
    const result = await dispatch(logoutThunk());

    if (logoutThunk.fulfilled.match(result)) {
      navigate("/login");
    }
  };

  return (
    <header className="header">
      <div className="header-container header-logo">
        <div className="logo_main">
          <img className="logo_main-img" src={logo} alt="logo" />
        </div>

        <img className="logo_sec-img" src={logo_sec} alt="lct_logo" />
      </div>
      <nav className="header-container header-navigation">
        {isDepartment && (
          <>
            <Link to="/admin">Админка</Link>
            <Link to="/oks">ОКС</Link>
          </>
        )}

        {isEngineer && <Link to="/engineer">Мои объекты</Link>}

        {isForeman && <Link to="/foreman">Мои объекты</Link>}
      </nav>

      <div className="header-container header-profile">
        <button
          type="button"
          className="header-profile-button"
          onClick={() => setIsProfileOpen((prev) => !prev)}
        >
          <div className="header-user">
            <span className="header-user-name">
              {user?.first_name} {user?.last_name}
            </span>

            <span className="header-user-email">{user?.email}</span>
          </div>

          <img
            className={`profile-arrow ${
              isProfileOpen ? "profile-arrow-open" : ""
            }`}
            src={arrow_down}
            alt=""
          />
        </button>

        {isProfileOpen && (
          <div className="profile-menu">
            <button
              type="button"
              className="profile-menu-item"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
