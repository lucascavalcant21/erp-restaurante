"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChefHat, GlassWater, Armchair, Lock, ClipboardList, FlaskConical, PackageSearch,
  ShoppingCart, FileText, CalendarClock, Tag, Sparkles, BookOpen, LayoutList,
  Wine, GraduationCap, MessageSquare, PartyPopper, Droplets
} from "lucide-react";
import { useERP } from "../../context/ERPContext";

// Senha de saída de CADA área (troque aqui)
export const SENHAS_AREA = { cozinha: "1111", bar: "2222", salao: "3333" };

// Submódulos de cada área, organizados em colunas (kanban)
const AREAS = {
  cozinha: {
    nome: "Cozinha", Icon: ChefHat, cor: "#F59E0B",
    colunas: [
      {
        titulo: "Rotina do Dia",
        itens: [
          { label: "Checklist", href: "/dashboard/operacao/rotina?dept=cozinha", Icon: ClipboardList },
          { label: "Produção Diária", href: "/dashboard/operacao/producao?dept=cozinha", Icon: Sparkles },
          { label: "Validade e Etiquetas", href: "/dashboard/operacao/etiquetas?dept=cozinha", Icon: Tag },
          { label: "Limpeza, Gás e Óleo", href: "/dashboard/operacao/controles", Icon: Droplets },
        ],
      },
      {
        titulo: "Insumos e Estoque",
        itens: [
          { label: "Ingredientes", href: "/dashboard/operacao/ingredientes?dept=cozinha", Icon: FlaskConical },
          { label: "Estoque", href: "/dashboard/operacao/estoque?dept=cozinha", Icon: PackageSearch },
          { label: "Lista de Compras", href: "/dashboard/operacao/compras?dept=cozinha", Icon: ShoppingCart },
          { label: "Notas de Entrada", href: "/dashboard/operacao/notas?dept=cozinha", Icon: FileText },
        ],
      },
      {
        titulo: "Receitas e Cardápio",
        itens: [
          { label: "Fichas Técnicas", href: "/dashboard/operacao/fichas?dept=cozinha", Icon: BookOpen },
          { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=cozinha", Icon: LayoutList },
          { label: "Catálogo e Preços", href: "/dashboard/operacao/produtos", Icon: Tag },
          { label: "Orçamento de Eventos", href: "/dashboard/operacao/orcamento?dept=cozinha", Icon: PartyPopper },
        ],
      },
    ],
  },
  bar: {
    nome: "Bar", Icon: GlassWater, cor: "#8B5CF6",
    colunas: [
      {
        titulo: "Rotina do Dia",
        itens: [
          { label: "Checklist", href: "/dashboard/operacao/rotina?dept=bar", Icon: ClipboardList },
          { label: "Produção do Bar", href: "/dashboard/operacao/producao?dept=bar", Icon: Sparkles },
          { label: "Etiquetas do Bar", href: "/dashboard/operacao/etiquetas?dept=bar", Icon: Tag },
        ],
      },
      {
        titulo: "Insumos e Estoque",
        itens: [
          { label: "Ingredientes Bar", href: "/dashboard/operacao/ingredientes?dept=bar", Icon: FlaskConical },
          { label: "Estoque do Bar", href: "/dashboard/operacao/estoque?dept=bar", Icon: PackageSearch },
          { label: "Lista de Compras", href: "/dashboard/operacao/compras?dept=bar", Icon: ShoppingCart },
          { label: "Notas de Entrada", href: "/dashboard/operacao/notas?dept=bar", Icon: FileText },
        ],
      },
      {
        titulo: "Drinks e Receitas",
        itens: [
          { label: "Drinks e Coquetéis", href: "/dashboard/operacao/drinks", Icon: Wine },
          { label: "Fichas de Drinks", href: "/dashboard/operacao/fichas?dept=bar", Icon: BookOpen },
          { label: "Guia de Montagem", href: "/dashboard/operacao/montagem?dept=bar", Icon: LayoutList },
        ],
      },
    ],
  },
  salao: {
    nome: "Salão", Icon: Armchair, cor: "#0EA5E9",
    colunas: [
      {
        titulo: "Rotina do Dia",
        itens: [
          { label: "Checklist", href: "/dashboard/operacao/rotina?dept=salao", Icon: ClipboardList },
        ],
      },
      {
        titulo: "Equipe",
        itens: [
          { label: "Treinamentos", href: "/dashboard/salao/treinamento", Icon: GraduationCap },
          { label: "Observações Padrão", href: "/dashboard/operacao/observacoes", Icon: MessageSquare },
        ],
      },
    ],
  },
};

// Rotas permitidas enquanto a área está travada (usadas também no layout)
export function rotasDaArea(dept) {
  const a = AREAS[dept];
  if (!a) return [];
  const rotas = ["/dashboard/area"];
  a.colunas.forEach(c => c.itens.forEach(i => rotas.push(i.href.split("?")[0])));
  return rotas;
}

function TecladoSenha({ cor, onSuccess, onClose, senha }) {
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState("");
  const digito = (d) => {
    if (pin.length >= 4) return;
    const novo = pin + d;
    setPin(novo);
    if (novo.length === 4) {
      setTimeout(() => {
        if (novo === senha) onSuccess();
        else { setErro("Senha incorreta"); setPin(""); }
      }, 150);
    }
  };
  return (
    <div className="fixed inset-0 z-[10001] bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-5">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-xs text-center">
        <p className="text-lg font-black text-white">Sair da área</p>
        <p className="text-slate-400 font-medium text-xs mb-5">Digite a senha desta área para destravar</p>
        <div className="flex gap-3 justify-center mb-5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-4 h-4 rounded-full transition-colors" style={{ background: i < pin.length ? cor : "#334155" }} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((d, i) => (
            <button key={i} disabled={d === ""}
              onClick={() => d === "⌫" ? setPin(p => p.slice(0, -1)) : d !== "" && digito(String(d))}
              className={`h-14 rounded-xl text-xl font-black transition-colors ${d === "" ? "invisible" : d === "⌫" ? "bg-slate-700 text-slate-300 hover:bg-slate-600" : "bg-slate-800 text-white hover:bg-slate-700"}`}>
              {d}
            </button>
          ))}
        </div>
        {erro && <p className="text-red-400 text-xs font-bold mb-2">{erro}</p>}
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs font-bold">Cancelar</button>
      </div>
    </div>
  );
}

function AreaRunner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { unidadeInfo } = useERP();
  const dept = AREAS[searchParams.get("dept")] ? searchParams.get("dept") : "cozinha";
  const area = AREAS[dept];
  const [pedindoSenha, setPedindoSenha] = useState(false);

  // Entrar aqui TRAVA o aparelho nesta área (persiste; só sai com a senha).
  // Se já existe OUTRA área travada, não deixa trocar sem a senha: volta pra ela.
  useEffect(() => {
    try {
      const atual = localStorage.getItem("hefisto_modo_area");
      if (atual && AREAS[atual] && atual !== dept) {
        router.replace(`/dashboard/area?dept=${atual}`);
        return;
      }
      localStorage.setItem("hefisto_modo_area", dept);
    } catch {}
  }, [dept]);

  const destravar = () => {
    try { localStorage.removeItem("hefisto_modo_area"); } catch {}
    setPedindoSenha(false);
    router.push("/dashboard");
  };

  const AIcon = area.Icon;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto font-sans" style={{ background: "#0b1220" }}>
      {pedindoSenha && (
        <TecladoSenha cor={area.cor} senha={SENHAS_AREA[dept]} onSuccess={destravar} onClose={() => setPedindoSenha(false)} />
      )}

      <div className="max-w-6xl mx-auto p-6 md:p-10">
        {/* Cabeçalho da área */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${area.cor}20`, border: `2px solid ${area.cor}55` }}>
              <AIcon size={28} style={{ color: area.cor }} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">{area.nome}</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">{unidadeInfo?.nome || ""} · estação de trabalho</p>
            </div>
          </div>
          <button onClick={() => setPedindoSenha(true)} title="Sair da área (senha)"
            className="flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-xs text-slate-500 hover:text-slate-300 bg-slate-900 border border-slate-800 transition-colors">
            <Lock size={14} /> Travado
          </button>
        </div>

        {/* Kanban de submódulos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {area.colunas.map(col => (
            <div key={col.titulo} className="rounded-3xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-2 h-2 rounded-full" style={{ background: area.cor }} />
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{col.titulo}</p>
              </div>
              <div className="space-y-2.5">
                {col.itens.map(item => (
                  <button key={item.label} onClick={() => router.push(item.href)}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] hover:-translate-y-0.5"
                    style={{ background: "#111a2e", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${area.cor}18` }}>
                      <item.Icon size={20} style={{ color: area.cor }} />
                    </div>
                    <span className="font-bold text-slate-100 text-[15px]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] font-medium text-slate-600 mt-8 text-center">
          Esta estação está travada na área {area.nome}. Os módulos abertos daqui voltam para cá; sair exige a senha da área.
        </p>
      </div>
    </div>
  );
}

export default function AreaPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando área...</div>}>
      <AreaRunner />
    </Suspense>
  );
}
