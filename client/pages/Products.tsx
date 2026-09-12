import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2, Package, Plus, Search } from "lucide-react";
import type { Product } from "@shared/api";
import { adminApi } from "@/lib/admin-api";

const money = (value?: number | null) => typeof value === "number" ? `${value.toFixed(2).replace(".", ",")} €` : "Prix non renseigné";
const productImage = (product: Product) => product.images?.[0]?.image_url || product.image_url || "";

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    adminApi.products().then(setProducts).catch((value) => setError(value instanceof Error ? value.message : "Impossible de charger les produits")).finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((product) => String(product.name ?? "").toLowerCase().includes(query.toLowerCase()));

  return <div className="space-y-7">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm text-[#7d8d83]">Catalogue atelier</p><h2 className="mt-1 font-serif text-3xl text-[#18352b]">Vos produits</h2><p className="mt-2 text-sm text-[#7b8a81]">Une vue marketplace de vos pièces disponibles.</p></div><Link to="/produits/nouveau" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#16543e] px-4 py-3 text-sm font-bold text-white shadow-[0_8px_20px_rgba(22,84,62,0.12)] hover:bg-[#0f4532]"><Plus size={17} /> Ajouter un produit</Link></div>
    {error && <div className="rounded-xl border border-[#edcfc4] bg-[#fff5f1] px-4 py-3 text-sm text-[#a64f3b]">{error}</div>}
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#a17745]">Catalogue</p><h3 className="mt-1 font-serif text-2xl text-[#18352b]">Pièces existantes <span className="font-sans text-base text-[#9ba89f]">({products.length})</span></h3></div><label className="relative block sm:w-64"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa89e]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher une pièce" className="h-10 w-full rounded-xl border border-[#d8e1d8] bg-[#fbfcf9] pl-9 pr-3 text-sm outline-none focus:border-[#4a8a63]" /></label></div>
    {loading ? <div className="flex justify-center py-20 text-[#6e8b78]"><Loader2 className="animate-spin" /></div> : filtered.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((product) => <Link key={String(product.id)} to={`/produits/${product.id}`} className="group overflow-hidden rounded-2xl border border-[#dfe6dd] bg-[#fbfcf9] shadow-[0_8px_24px_rgba(42,67,52,0.03)] transition hover:-translate-y-1 hover:border-[#b8d0bb] hover:shadow-[0_14px_30px_rgba(42,67,52,0.08)]"><div className="relative aspect-[4/3] overflow-hidden bg-[#eaf0e9]">{productImage(product) ? <img src={productImage(product)} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-[#789384]"><Package size={34} strokeWidth={1.4} /></div>}<span className="absolute right-3 top-3 rounded-full bg-[#fbfcf9]/90 px-2.5 py-1 text-[11px] font-bold text-[#3f7652]">Voir la pièce</span></div><div className="flex items-start justify-between gap-4 p-5"><div className="min-w-0"><p className="truncate text-base font-bold text-[#365347]">{product.name || "Produit sans nom"}</p><p className="mt-2 text-sm text-[#a17745]">{money(product.price ?? product.base_price)}</p></div><ArrowUpRight size={18} className="mt-1 shrink-0 text-[#8ba091] transition group-hover:text-[#16543e]" /></div></Link>)}</div> : <div className="rounded-2xl border border-dashed border-[#d9e2d9] bg-[#fbfcf9] py-20 text-center text-sm text-[#91a098]">Aucun produit dans la base de données.</div>}
  </div>;
}
