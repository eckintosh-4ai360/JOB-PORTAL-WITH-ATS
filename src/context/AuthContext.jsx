import React, { createContext, useContext, useState, useEffect } from "react";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPath";


const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");

      if (token && userStr) {
        const userData = JSON.parse(userStr);
        setUser(userData);
        setIsAuthenticated(true);

        // Refresh the cached role from the server. This is important when an
        // existing user is promoted to admin after their last login.
        try {
          const response = await axiosInstance.get(API_PATHS.AUTH.GET_PROFILE);
          const freshUser = response.data.user;
          localStorage.setItem("user", JSON.stringify(freshUser));
          setUser(freshUser);
        } catch (error) {
          // Keep the cached session if the API is temporarily unavailable.
          // The axios interceptor still clears invalid/expired sessions.
          if (error.response?.status !== 401) {
            console.warn("Could not refresh the authenticated user:", error.message);
          }
        }
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));

    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");

    setUser(null);
    setIsAuthenticated(false);
    window.location.href = "/";
  };

  const updateUser = (updatedUserData) => {
    const newUserData = { ...user, ...updatedUserData };
    localStorage.setItem("user", JSON.stringify(newUserData));
    setUser(newUserData);
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
