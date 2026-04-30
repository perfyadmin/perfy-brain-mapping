import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { API_BASE_URL } from "./api";

export interface Company {
  id: string;
  name: string;
  code: string;
  industry: string;
  location: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "student" | "employee" | "admin";
  companyCode?: string;
  companyName?: string;
  phone?: string;
  department?: string;
  school?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  getCompanies: () => Company[];
  addCompany: (company: Omit<Company, "id">) => void;
  deleteCompany: (id: string) => void;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: "student" | "employee";
  phone?: string;
  companyCode?: string;
  department?: string;
  school?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("mm_user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const getCompanies = (): Company[] => {
    return JSON.parse(localStorage.getItem("mm_companies") || "[]");
  };

  const addCompany = (company: Omit<Company, "id">) => {
    const companies = getCompanies();
    companies.push({ ...company, id: crypto.randomUUID() });
    localStorage.setItem("mm_companies", JSON.stringify(companies));
  };

  const deleteCompany = (id: string) => {
    const companies = getCompanies().filter(c => c.id !== id);
    localStorage.setItem("mm_companies", JSON.stringify(companies));
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    if (email === "admin@admin.com") {
      const admin: User = { id: "admin", name: "Admin", email, role: "admin" };
      setUser(admin);
      localStorage.setItem("mm_user", JSON.stringify(admin));
      return true;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      setUser(data.user);
      localStorage.setItem("mm_user", JSON.stringify(data.user));
      localStorage.setItem("mm_token", data.token);
      return true;
    } catch (err) {
      console.error("Login failed:", err);
      return false;
    }
  };

  const register = async (data: RegisterData): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) return false;

      const responseData = await res.json();
      setUser(responseData.user);
      localStorage.setItem("mm_user", JSON.stringify(responseData.user));
      localStorage.setItem("mm_token", responseData.token);
      return true;
    } catch (err) {
      console.error("Registration failed:", err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("mm_user");
    localStorage.removeItem("mm_token");
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, getCompanies, addCompany, deleteCompany }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
