import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { adminApi } from "@/lib/admin-api";

const logoUrl = "https://cdn.builder.io/api/v1/image/assets%2F259ab2667a974c67a650391d391d4bc2%2Fea5ba6ab6ee24b74ab64bbbf48c835d5?format=webp&width=800&height=1200";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.session().then((session) => {
      if (session.authenticated) navigate("/dashboard", { replace: true });
    }).catch(() => undefined);
  }, [navigate]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminApi.login({ username, password });
      const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(destination, { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Identifiants invalides");
    } finally {
      setLoading(false);
    }
  };

  return <main className="flex min-h-screen bg-[#f5f2eb]">
    <section className="relative hidden w-[47%] overflow-hidden bg-[#16543e] px-14 py-12 text-[#f4e9d3] lg:flex lg:flex-col lg:justify-between">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-[#6b9975]/30" /><div className="absolute -bottom-48 -left-28 h-[500px] w-[500px] rounded-full border border-[#6b9975]/20" />
      <div className="relative"><div className="flex items-center gap-3"><img src={logoUrl} alt="Atelier Belkhadir Poterie" className="h-11 w-11 rounded-xl object-cover" /><span className="font-serif text-xl">Atelier Belkhadir</span></div></div>
      <div className="relative max-w-xl"><p className="mb-6 text-xs font-bold uppercase tracking-[0.28em] text-[#c9dcb6]">L’espace de gestion de votre atelier</p><h1 className="font-serif text-6xl leading-[1.05] tracking-[-0.03em]">Façonner<br /><em className="text-[#d8b57f]">l’essentiel.</em></h1><p className="mt-8 max-w-md text-base leading-7 text-[#c6d7c2]">Retrouvez vos pièces, vos commandes et vos clients dans un espace pensé pour le quotidien de l’atelier.</p></div>
      <div className="relative flex items-center gap-3 text-xs text-[#b6cfb6]"><ShieldCheck size={17} /><span>Accès privé · Données protégées</span></div>
    </section>
    <section className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10"><div className="w-full max-w-[420px]">
      <div className="mb-9 lg:hidden"><div className="flex items-center gap-3"><img src={logoUrl} alt="Atelier Belkhadir Poterie" className="h-11 w-11 rounded-xl object-cover" /><span className="font-serif text-xl text-[#18352b]">Atelier Belkhadir</span></div></div>
      <div className="mb-7"><p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#a17745]">Bienvenue dans votre atelier</p><h2 className="font-serif text-4xl text-[#18352b]">Bon retour.</h2><p className="mt-3 text-sm leading-6 text-[#728278]">Connectez-vous pour accéder à votre espace d’administration.</p></div>
      <form onSubmit={submit} className="space-y-5">
        <label className="block"><span className="mb-2 block text-sm font-semibold text-[#365347]">Nom d’utilisateur</span><input required value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="h-[52px] w-full rounded-xl border border-[#d5ded5] bg-[#fbfcf9] px-4 text-sm text-[#18352b] outline-none transition focus:border-[#4a8a63] focus:ring-4 focus:ring-[#dcebdc]" placeholder="Votre nom d’utilisateur" /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-[#365347]">PIN d’accès</span><input required type="password" inputMode="numeric" pattern="[0-9]*" maxLength={12} value={password} onChange={(event) => { setError(""); setPassword(event.target.value.replace(/\D/g, "")); }} autoComplete="current-password" className="h-[52px] w-full rounded-xl border border-[#d5ded5] bg-[#fbfcf9] px-4 text-center text-lg tracking-[0.45em] text-[#18352b] outline-none transition focus:border-[#4a8a63] focus:ring-4 focus:ring-[#dcebdc]" placeholder="••••••" aria-label="PIN d’accès" /></label>
        {error && <div className="flex items-center gap-2 rounded-xl border border-[#edcfc4] bg-[#fff5f1] px-4 py-3 text-sm text-[#a64f3b]"><LockKeyhole size={16} />{error}</div>}
        <button type="submit" disabled={loading} className="flex h-[52px] w-full items-center justify-center gap-3 rounded-xl bg-[#16543e] text-sm font-bold text-white shadow-[0_8px_20px_rgba(22,84,62,0.16)] transition hover:bg-[#0f4532] disabled:cursor-wait disabled:opacity-70">{loading ? "Connexion…" : "Accéder à l’administration"}{!loading && <ArrowRight size={17} />}</button>
      </form>
      <p className="mt-7 text-center text-xs leading-5 text-[#9aa79e]">Cet espace est réservé à l’équipe de l’Atelier Belkhadir.<br />Les accès sont strictement personnels.</p>
    </div></section>
  </main>;
}
