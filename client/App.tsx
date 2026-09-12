import "./global.css";

import { createRoot, type Root } from "react-dom/client";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdminLayout from "@/components/AdminLayout";
import { adminApi } from "@/lib/admin-api";
import AddProduct from "@/pages/AddProduct";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import ProductDetail from "@/pages/ProductDetail";
import NotFound from "@/pages/NotFound";
import Orders from "@/pages/Orders";
import Products from "@/pages/Products";
import Reviews from "@/pages/Reviews";

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function ProtectedRoutes() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => { adminApi.session().then((session) => { setAuthenticated(session.authenticated); if (!session.authenticated) navigate("/login", { replace: true }); }).catch(() => navigate("/login", { replace: true })).finally(() => setChecked(true)); }, [navigate]);
  if (!checked) return <div className="flex min-h-screen items-center justify-center bg-[#f5f2eb] text-sm text-[#6f8176]">Vérification de la session…</div>;
  return authenticated ? <AdminLayout /> : null;
}

function AppRoutes() {
  return <><ScrollToTop /><Routes><Route path="/login" element={<Login />} /><Route element={<ProtectedRoutes />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/produits" element={<Products />} /><Route path="/produits/nouveau" element={<AddProduct />} /><Route path="/produits/:id" element={<ProductDetail />} /><Route path="/commandes" element={<Orders />} /><Route path="/avis" element={<Reviews />} /></Route><Route path="/" element={<Navigate to="/dashboard" replace />} /><Route path="*" element={<NotFound />} /></Routes></>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner /><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AppRoutes /></BrowserRouter></TooltipProvider></QueryClientProvider>;
}

const container = document.getElementById("root") as HTMLElement & { __atelierRoot?: Root };
const root = container.__atelierRoot ?? createRoot(container);
container.__atelierRoot = root;
root.render(<App />);
