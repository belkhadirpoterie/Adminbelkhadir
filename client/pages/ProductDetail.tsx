import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2, Palette, Pencil, Plus, Shapes, Trash2, X } from "lucide-react";
import type { Product, ProductPattern, ProductVariant } from "@shared/api";
import { adminApi } from "@/lib/admin-api";

const money = (value?: number | null) => typeof value === "number" ? `${value.toFixed(2).replace(".", ",")} €` : "Prix non renseigné";
const inputClass = "h-11 w-full rounded-xl border border-[#d8e1d8] bg-[#fdfdfb] px-3 text-sm text-[#29493b] outline-none focus:border-[#4a8a63] focus:ring-4 focus:ring-[#e1eee2]";
type VariantDraft = { size_label: string; dimensions: string; price: string };

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [panel, setPanel] = useState<"info" | "colors" | "patterns" | "variants" | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [colorDraft, setColorDraft] = useState<string[]>([]);
  const [newColor, setNewColor] = useState("");
  const [patternDraft, setPatternDraft] = useState<string[]>([]);
  const [variantDraft, setVariantDraft] = useState<VariantDraft[]>([]);

  useEffect(() => {
    if (!id) return;
    adminApi.product(id).then(setProduct).catch((value) => setError(value instanceof Error ? value.message : "Produit introuvable")).finally(() => setLoading(false));
  }, [id]);

  const images = useMemo(() => product ? (product.images?.map((image) => image.image_url).filter(Boolean) ?? []).concat(product.image_url && !(product.images?.some((image) => image.image_url === product.image_url)) ? [product.image_url] : []) : [], [product]);
  const colors = product?.colors ?? [];
  const patternCatalog = product?.pattern_catalog ?? [];

  const save = async (payload: Parameters<typeof adminApi.updateProduct>[1], success: string) => {
    if (!product) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const updated = await adminApi.updateProduct(product.id, payload);
      setProduct((current) => current ? { ...current, ...updated } : current);
      setMessage((updated as Product & { pendingSync?: boolean }).pendingSync ? "Modification enregistrée hors connexion. Synchronisation en attente du retour réseau." : success);
      setPanel(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const openColors = () => {
    setColorDraft([...colors]);
    setNewColor("");
    setPanel("colors");
  };

  const addColor = () => {
    const value = newColor.trim();
    if (!value || colorDraft.some((color) => color.toLowerCase() === value.toLowerCase())) return;
    setColorDraft((current) => [...current, value]);
    setNewColor("");
  };

  const openPatterns = () => {
    setPatternDraft((product?.patterns ?? []).map((pattern) => String(pattern.id)));
    setPanel("patterns");
  };

  const openVariants = () => {
    setVariantDraft((product?.variants ?? []).map((variant) => ({
      size_label: variant.size_label ?? variant.size ?? "",
      dimensions: variant.dimensions ?? "",
      price: String(variant.price ?? 0),
    })));
    setPanel("variants");
  };

  const addVariant = () => setVariantDraft((current) => [...current, { size_label: "", dimensions: "", price: "0" }]);
  const updateVariant = (index: number, key: keyof VariantDraft, value: string) => setVariantDraft((current) => current.map((variant, itemIndex) => itemIndex === index ? { ...variant, [key]: value } : variant));
  const removeVariant = (index: number) => setVariantDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));

  const remove = async () => {
    if (!product || !window.confirm("Supprimer définitivement ce produit et ses relations ?")) return;
    setSaving(true);
    try {
      await adminApi.deleteProduct(product.id);
      navigate("/produits", { replace: true });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Suppression impossible");
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-24 text-[#6e8b78]"><Loader2 className="animate-spin" /></div>;
  if (!product) return <div className="space-y-4"><Link to="/produits" className="inline-flex items-center gap-2 text-sm font-bold text-[#3f7652]"><ArrowLeft size={16} /> Retour au catalogue</Link><div className="rounded-2xl border border-[#edcfc4] bg-[#fff5f1] px-5 py-4 text-sm text-[#a64f3b]">{error || "Produit introuvable"}</div></div>;

  return <div className="space-y-7">
    <Link to="/produits" className="inline-flex items-center gap-2 text-sm font-bold text-[#3f7652] hover:text-[#16543e]"><ArrowLeft size={16} /> Retour au catalogue</Link>
    {message && <div className="flex items-center gap-2 rounded-xl border border-[#cfe2d0] bg-[#edf7ee] px-4 py-3 text-sm text-[#3d7650]"><Check size={16} />{message}</div>}
    {error && <div className="rounded-xl border border-[#edcfc4] bg-[#fff5f1] px-4 py-3 text-sm text-[#a64f3b]">{error}</div>}
    <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
      <section>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#eaf0e9]">
          {images.length ? <img src={images[activeImage] ?? images[0]} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-[#789384]">Aucune image galerie</div>}
          {images.length > 1 && <><button type="button" onClick={() => setActiveImage((current) => (current - 1 + images.length) % images.length)} className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#fbfcf9]/90 text-[#365347]" aria-label="Image précédente"><ChevronLeft size={20} /></button><button type="button" onClick={() => setActiveImage((current) => (current + 1) % images.length)} className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-[#fbfcf9]/90 text-[#365347]" aria-label="Image suivante"><ChevronRight size={20} /></button></>}
        </div>
        {images.length > 1 && <div className="mt-3 grid grid-cols-5 gap-3">{images.map((image, index) => <button type="button" key={image + index} onClick={() => setActiveImage(index)} className={`aspect-square overflow-hidden rounded-xl border-2 ${activeImage === index ? "border-[#16543e]" : "border-transparent"}`} aria-label={`Afficher l'image ${index + 1}`}><img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-cover" /></button>)}</div>}
      </section>
      <section className="flex flex-col rounded-3xl border border-[#dfe6dd] bg-[#fbfcf9] p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a17745]">Fiche produit</p><h1 className="mt-3 font-serif text-4xl leading-tight text-[#18352b]">{product.name}</h1><p className="mt-4 text-2xl font-semibold text-[#a17745]">{money(product.price ?? product.base_price)}</p><p className="mt-6 whitespace-pre-line text-sm leading-7 text-[#687b70]">{product.description || "Aucune description renseignée."}</p>
        <div className="mt-8 grid gap-4 border-t border-[#e7ece5] pt-6 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#91a098]">Couleurs</p><p className="mt-2 text-sm font-semibold text-[#365347]">{colors.length ? colors.join(", ") : "Non renseignées"}</p></div><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#91a098]">Variantes</p><p className="mt-2 text-sm font-semibold text-[#365347]">{product.variants?.length || 0} variante(s)</p></div></div>
        <div className="mt-auto grid gap-2 pt-8 sm:grid-cols-2"><button type="button" onClick={openColors} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cdddcf] px-3 py-3 text-xs font-bold text-[#3f7652] hover:bg-[#eef6ef]"><Palette size={15} /> Modifier couleurs disponibles</button><button type="button" onClick={openPatterns} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cdddcf] px-3 py-3 text-xs font-bold text-[#3f7652] hover:bg-[#eef6ef]"><Shapes size={15} /> Modifier motifs disponibles</button><button type="button" onClick={() => setPanel("info")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cdddcf] px-3 py-3 text-xs font-bold text-[#3f7652] hover:bg-[#eef6ef]"><Pencil size={15} /> Modifier informations</button><button type="button" onClick={openVariants} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cdddcf] px-3 py-3 text-xs font-bold text-[#3f7652] hover:bg-[#eef6ef]"><Plus size={15} /> Modifier tailles et variantes</button><button type="button" onClick={remove} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#edcfc4] px-3 py-3 text-xs font-bold text-[#a64f3b] hover:bg-[#fff5f1] sm:col-span-2"><Trash2 size={15} /> Supprimer produit</button></div>
      </section>
    </div>
    <section className="rounded-2xl border border-[#dfe6dd] bg-[#fbfcf9] p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#a17745]">Variantes disponibles</p><p className="mt-1 text-sm text-[#7f9086]">Gérez les tailles, dimensions et prix proposés pour cette pièce.</p></div><button type="button" onClick={openVariants} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#16543e] px-3 py-2 text-xs font-bold text-white hover:bg-[#0f4532]"><Plus size={15} /> Ajouter</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{product.variants?.length ? product.variants.map((variant) => <div key={String(variant.id)} className="rounded-xl border border-[#e5ebe4] bg-[#fdfdfb] p-4"><p className="text-sm font-bold text-[#365347]">{variant.size_label || variant.size || "Taille non renseignée"}</p><p className="mt-1 text-xs text-[#7f9086]">{variant.dimensions || "Dimensions non renseignées"}</p><p className="mt-3 text-sm font-bold text-[#a17745]">{money(variant.price)}</p></div>) : <p className="text-sm text-[#91a098]">Aucune variante enregistrée.</p>}</div></section>
    <section className="rounded-2xl border border-[#dfe6dd] bg-[#fbfcf9] p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#a17745]">Motifs disponibles</p><p className="mt-1 text-sm text-[#7f9086]">Les motifs cochés sont proposés pour ce produit.</p></div><button type="button" onClick={openPatterns} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#16543e] px-3 py-2 text-xs font-bold text-white hover:bg-[#0f4532]"><Shapes size={15} /> Modifier</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{product.patterns?.length ? product.patterns.map((pattern) => <div key={pattern.id} className="overflow-hidden rounded-xl border border-[#e5ebe4] bg-[#fdfdfb]"><div className="aspect-square bg-[#edf2ec]">{pattern.thumbnail_url && <img src={pattern.thumbnail_url} alt={pattern.name} className="h-full w-full object-cover" />}</div><div className="p-3"><p className="text-sm font-bold text-[#365347]">{pattern.name}</p><p className="mt-1 text-xs text-[#8b9a90]">{pattern.primary_color || "Couleur non renseignée"}</p></div></div>) : <p className="text-sm text-[#91a098]">Aucun motif disponible pour ce produit.</p>}</div></section>
    {panel && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#18352b]/35 p-0 sm:items-center sm:p-6"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[#fbfcf9] p-6 shadow-2xl sm:rounded-3xl md:p-8"><div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-[#a17745]">Édition produit</p><h2 className="mt-1 font-serif text-2xl text-[#18352b]">{panel === "info" ? "Informations" : panel === "colors" ? "Couleurs disponibles" : panel === "patterns" ? "Motifs disponibles" : "Tailles et variantes"}</h2></div><button type="button" onClick={() => setPanel(null)} className="rounded-xl p-2 text-[#8b9a90] hover:bg-[#eef3ed]" aria-label="Fermer"><X size={20} /></button></div>
      {panel === "colors" && <div className="space-y-5"><div className="flex gap-2"><input className={inputClass} value={newColor} onChange={(event) => setNewColor(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addColor(); } }} placeholder="Ex. Bleu cobalt" /><button type="button" onClick={addColor} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#16543e] px-4 text-sm font-bold text-white hover:bg-[#0f4532]"><Plus size={16} /> Ajouter</button></div><div className="flex flex-wrap gap-2">{colorDraft.length ? colorDraft.map((color) => <span key={color} className="inline-flex items-center gap-2 rounded-full bg-[#e5f0e7] px-3 py-2 text-sm font-semibold text-[#3f7652]">{color}<button type="button" onClick={() => setColorDraft((current) => current.filter((item) => item !== color))} className="rounded-full p-0.5 hover:bg-[#cfe2d0]" aria-label={`Retirer la couleur ${color}`}><X size={14} /></button></span>) : <p className="text-sm text-[#91a098]">Aucune couleur sélectionnée.</p>}</div><button type="button" disabled={saving} onClick={() => save({ colors: colorDraft }, "Couleurs disponibles mises à jour.")} className="w-full rounded-xl bg-[#16543e] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f4532] disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer les couleurs"}</button></div>}
      {panel === "patterns" && <div className="space-y-5">{patternCatalog.length ? <div className="grid gap-3 sm:grid-cols-2">{patternCatalog.map((pattern: ProductPattern) => { const patternId = String(pattern.id); return <label key={patternId} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e1e9e0] bg-[#fdfdfb] p-3 has-[:checked]:border-[#7da687] has-[:checked]:bg-[#eef6ef]"><input type="checkbox" checked={patternDraft.includes(patternId)} onChange={(event) => setPatternDraft((current) => event.target.checked ? [...current, patternId] : current.filter((item) => item !== patternId))} className="h-4 w-4 accent-[#16543e]" /><span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#edf2ec]">{pattern.thumbnail_url && <img src={pattern.thumbnail_url} alt="" className="h-full w-full object-cover" />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold text-[#365347]">{pattern.name}</span><span className="mt-1 block text-xs text-[#8b9a90]">{pattern.primary_color || "Motif du catalogue"}</span></span></label>; })}</div> : <p className="rounded-xl border border-dashed border-[#d9e2d9] p-5 text-sm text-[#91a098]">Aucun motif n’est encore enregistré dans le catalogue.</p>}<button type="button" disabled={saving} onClick={() => save({ patterns: patternDraft }, "Motifs disponibles mis à jour.")} className="w-full rounded-xl bg-[#16543e] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f4532] disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer les motifs"}</button></div>}
      {panel === "variants" && <div className="space-y-4">{variantDraft.map((variant, index) => <div key={index} className="rounded-xl border border-[#e1e9e0] bg-[#fdfdfb] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-bold text-[#365347]">Variante {index + 1}</p><button type="button" onClick={() => removeVariant(index)} className="rounded-lg p-2 text-[#a64f3b] hover:bg-[#fff5f1]" aria-label={`Supprimer la variante ${index + 1}`}><Trash2 size={16} /></button></div><div className="grid gap-3 sm:grid-cols-3"><input className={inputClass} value={variant.size_label} onChange={(event) => updateVariant(index, "size_label", event.target.value)} placeholder="Taille / format" /><input className={inputClass} value={variant.dimensions} onChange={(event) => updateVariant(index, "dimensions", event.target.value)} placeholder="Dimensions" /><input className={inputClass} type="number" min="0" step="0.01" value={variant.price} onChange={(event) => updateVariant(index, "price", event.target.value)} placeholder="Prix" /></div></div>)}<button type="button" onClick={addVariant} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#9fbea5] px-4 py-3 text-sm font-bold text-[#3f7652] hover:bg-[#eef6ef]"><Plus size={16} /> Ajouter une variante</button><button type="button" disabled={saving} onClick={() => save({ variants: variantDraft.filter((variant) => variant.size_label.trim()).map((variant) => ({ size_label: variant.size_label.trim(), dimensions: variant.dimensions.trim(), price: Number(variant.price) || 0 })) }, "Tailles et variantes mises à jour.")} className="w-full rounded-xl bg-[#16543e] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f4532] disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer les variantes"}</button></div>}
      {panel === "info" && <div className="space-y-4"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#718279]">Nom</span><input className={inputClass} value={product.name} onChange={(event) => setProduct({ ...product, name: event.target.value })} /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#718279]">Description</span><textarea className={`${inputClass} h-28 py-3`} value={product.description ?? ""} onChange={(event) => setProduct({ ...product, description: event.target.value })} /></label><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#718279]">Prix de base (€)</span><input type="number" min="0" step="0.01" className={inputClass} value={product.base_price ?? product.price ?? 0} onChange={(event) => setProduct({ ...product, base_price: Number(event.target.value) })} /></label><button type="button" disabled={saving} onClick={() => save({ name: product.name, description: product.description ?? "", base_price: Number(product.base_price ?? product.price ?? 0) }, "Informations produit mises à jour.")} className="w-full rounded-xl bg-[#16543e] px-4 py-3 text-sm font-bold text-white hover:bg-[#0f4532] disabled:opacity-60">{saving ? "Enregistrement…" : "Enregistrer les informations"}</button></div>}
    </div></div>}
  </div>;
}
