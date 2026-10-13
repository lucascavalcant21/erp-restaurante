"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  BookOpen,
  Search,
  Plus,
  UtensilsCrossed,
  Sparkles,
  Edit3,
  ExternalLink,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import {
  fetchMarmitas,
  salvarMarmita,,
  resolverUnidade,
} from "../../../lib/marmitaria/marmitaria-service";

export default function MarmitariaCardapioPage() {
  const router = useRouter();
  const { unidadeAtiva, unidades } = useERP();

  const [loading, setLoading] = useState(true);
  const [marmitas, setMarmitas] = useState([]);
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("todas");

  const carregar = async () => {
    setLoading(true);
    try {
      const uId = resolverUnidade(unidadeAtiva, unidades);
      const res = await fetchMarmitas(uId);
      setMarmitas(res.data || []);
    } catch (e) {
      console.error("Erro ao carregar cardápio:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva, unidades]);

  const categorias = useMemo(() => {
    const setCats = new Set(["todas"]);
    marmitas.forEach((m) => {
      if (m.categoria) setCats.add(m.categoria);
    });
    return Array.from(setCats);
  }, [marmitas]);

  const marmitasFiltradas = useMemo(() => {
    return marmitas.filter((m) => {
      const matchBusca =
        !busca ||
        m.nome_receita?.toLowerCase().includes(busca.toLowerCase()) ||
        m.descricao_comercial?.toLowerCase().includes(busca.toLowerCase());
      const matchCat = categoriaAtiva === "todas" || m.categoria === categoriaAtiva;
      return matchBusca && matchCat;
    });
  }, [marmitas, busca, categoriaAtiva]);

  return (
    <div className="space-y-6">
      {/* Topo do Cardápio */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-hf-surface p-6 rounded-3xl border border-hf-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 mb-1">
            <BookOpen size={14} /> Cardápio Digital & Vendas
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Cardápio Comercial de Marmitas
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            Marmitas ativas para comercialização no iFood, Cardápio Digital WhatsApp e balcão.
          </p>
        </div>

        <Link
          href="/dashboard/marmitaria/fichas?nova=1"
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
        >
          <Plus size={16} /> Cadastrar Nova Marmita
        </Link>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-hf-surface p-3 rounded-2xl border border-hf-border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar no cardápio..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaAtiva(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                categoriaAtiva === cat
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
              }`}
            >
              {cat === "todas" ? "Todas as Categorias" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Marmitas do Cardápio */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 font-bold">
          Carregando cardápio de marmitas...
        </div>
      ) : marmitasFiltradas.length === 0 ? (
        <div className="bg-hf-surface p-12 text-center rounded-3xl border border-hf-border">
          <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-800">Cardápio sem itens no filtro</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Cadastre fichas técnicas na área de engenharia para disponibilizá-las no cardápio de vendas.
          </p>
          <Link
            href="/dashboard/marmitaria/fichas?nova=1"
            className="mt-4 inline-flex items-center gap-2 bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl"
          >
            <Plus size={16} /> Cadastrar Ficha
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {marmitasFiltradas.map((marmita) => {
            const precoBalcao = Number(marmita.preco_venda) || 25.0;
            const precoIfood = Math.round(precoBalcao * 1.18);
            const custoTecnico = Number(marmita.custo_total) || 8.5;

            return (
              <div
                key={marmita.id}
                className="bg-hf-surface rounded-3xl border border-hf-border hover:border-emerald-500/40 p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 font-black uppercase text-[11px] border border-emerald-100">
                      Tam. {marmita.tamanho || "M"} ({marmita.peso_final_g || 550}g)
                    </span>
                    <span className="text-slate-400 font-bold">
                      {marmita.categoria || "Tradicionais"}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-900 mt-2 leading-tight">
                    {marmita.nome_receita}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-3 mt-1">
                    {marmita.descricao_comercial || "Acompanha arroz solto, feijão especial da casa, guarnição e proteína suculenta."}
                  </p>
                </div>

                {/* Preços por Canal de Venda */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Balcão / WhatsApp:</span>
                    <strong className="text-slate-900 font-bold">{fmtBRL(precoBalcao)}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">iFood Delivery:</span>
                    <strong className="text-emerald-700 font-bold">{fmtBRL(precoIfood)}</strong>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px] text-slate-500">
                    <span>Custo Técnico: {fmtBRL(custoTecnico)}</span>
                    <span className="text-emerald-600 font-bold">
                      Margem {fmtBRL(precoBalcao - custoTecnico)}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <Link
                    href={`/dashboard/marmitaria/precificacao?marmita=${marmita.id}`}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl text-center"
                  >
                    Ajustar Preços
                  </Link>
                  <Link
                    href={`/dashboard/marmitaria/fichas`}
                    className="flex-1 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl text-center border border-emerald-200"
                  >
                    Ver Ficha
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
