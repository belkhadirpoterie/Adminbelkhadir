import { Link } from "react-router-dom";

export default function NotFound() {
  return <main className="flex min-h-screen items-center justify-center bg-[#f5f2eb] px-6 text-center"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#a17745]">Atelier Belkhadir</p><h1 className="mt-4 font-serif text-6xl text-[#18352b]">404</h1><p className="mt-3 text-sm text-[#718279]">Cette page n’existe pas dans l’espace d’administration.</p><Link to="/dashboard" className="mt-7 inline-flex rounded-xl bg-[#16543e] px-5 py-3 text-sm font-bold text-white">Retour au tableau de bord</Link></div></main>;
}
