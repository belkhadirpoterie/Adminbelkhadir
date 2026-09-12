import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronRight, LayoutDashboard, LogOut, Menu, Package, PanelLeftClose, PanelLeftOpen, Star, ShoppingBag, X } from "lucide-react";
import { adminApi } from "@/lib/admin-api";

const navigation = [
  { label: "Vue d’ensemble", to: "/dashboard", icon: LayoutDashboard },
  { label: "Produits", to: "/produits", icon: Package },
  { label: "Commandes", to: "/commandes", icon: ShoppingBag },
  { label: "Avis clients", to: "/avis", icon: Star },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const current = navigation.find((item) => location.pathname.startsWith(item.to)) ?? navigation[0];

  const logout = async () => {
    await adminApi.logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f5f2eb] text-[#18352b]">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-[#d8e0d7] bg-[#fdfcf9] transition-transform duration-200 lg:translate-x-0 ${collapsed ? "lg:w-[88px]" : ""} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[92px] items-center justify-between px-6">
          <Link to="/dashboard" className={`flex items-center gap-3 ${collapsed ? "lg:mx-auto" : ""}`} onClick={() => setMobileOpen(false)}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#16543e] text-sm font-bold tracking-[0.2em] text-[#f4e9d3]">AB</span>
            <span className={`${collapsed ? "lg:hidden" : ""}`}>
              <span className="block font-serif text-lg leading-none text-[#18352b]">Atelier Belkhadir</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a17745]">Poterie · Administration</span>
            </span>
          </Link>
          <button className="rounded-lg p-2 text-[#789087] hover:bg-[#eef2ec] lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu"><X size={20} /></button>
        </div>
        <div className="mx-5 h-px bg-[#e4e9e2]" />
        <nav className="flex-1 space-y-1 px-3 py-7">
          <p className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a4aca5] ${collapsed ? "lg:hidden" : ""}`}>Espace atelier</p>
          {navigation.map(({ label, to, icon: Icon }) => (
            <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${isActive ? "bg-[#e5f0e7] text-[#16543e]" : "text-[#6d7e75] hover:bg-[#f2f5f0] hover:text-[#18352b]"}`}>
              <Icon size={19} strokeWidth={1.8} />
              <span className={`${collapsed ? "lg:hidden" : ""}`}>{label}</span>
              <ChevronRight size={15} className={`ml-auto opacity-0 transition-opacity group-[.active]:opacity-100 ${collapsed ? "lg:hidden" : ""}`} />
            </NavLink>
          ))}
        </nav>
        <div className={`border-t border-[#e4e9e2] p-4 ${collapsed ? "lg:p-3" : ""}`}>
          <div className={`mb-3 flex items-center gap-3 rounded-xl bg-[#f6f3eb] p-3 ${collapsed ? "lg:justify-center lg:bg-transparent lg:p-0" : ""}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dceadf] text-xs font-bold text-[#16543e]">AB</span>
            <div className={`${collapsed ? "lg:hidden" : ""}`}><p className="text-sm font-bold">Administrateur</p><p className="text-xs text-[#8b9990]">Session active</p></div>
          </div>
          <button onClick={logout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#78877e] hover:bg-[#f9ebe5] hover:text-[#a64f3b] ${collapsed ? "lg:justify-center" : ""}`}><LogOut size={17} /><span className={`${collapsed ? "lg:hidden" : ""}`}>Se déconnecter</span></button>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-[#18352b]/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />}
      <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[88px]" : "lg:pl-[272px]"}`}>
        <header className="sticky top-0 z-20 flex h-[92px] items-center justify-between border-b border-[#e2e6df] bg-[#f5f2eb]/95 px-5 backdrop-blur md:px-10">
          <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#527064] hover:bg-[#e4ebe4] lg:hidden" aria-label="Ouvrir le menu"><Menu size={22} /></button><button onClick={() => setCollapsed(!collapsed)} className="hidden rounded-lg p-2 text-[#7f9287] hover:bg-[#e4ebe4] lg:block" aria-label="Réduire la barre latérale">{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a17745]">Atelier Belkhadir</p><h1 className="font-serif text-2xl text-[#18352b] md:text-[28px]">{current.label}</h1></div></div>
          <div className="flex items-center gap-3"><button className="relative rounded-xl border border-[#dce4dc] bg-[#fafbf8] p-2.5 text-[#557267] hover:border-[#aac8b0]" aria-label="Notifications"><Bell size={19} strokeWidth={1.8} /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#c48752]" /></button><div className="hidden h-8 w-px bg-[#dce3db] sm:block" /><div className="hidden text-right sm:block"><p className="text-sm font-semibold text-[#365347]">Bonjour, Adnane</p><p className="text-xs text-[#8a9990]">Gérant de l’atelier</p></div><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#16543e] text-xs font-bold text-[#f4e9d3] sm:hidden">AB</span></div>
        </header>
        <main className="mx-auto max-w-[1500px] px-5 py-7 md:px-10 md:py-10"><Outlet /></main>
      </div>
    </div>
  );
}
