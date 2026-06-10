"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ShieldCheck, AlertTriangle, Package } from "lucide-react";
import { buscarPorCodigo } from "../../lib/etiquetas";

function fmtDataHora(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}h${p(d.getMinutes())}`;
}

export default function RastreioPage() {
  const { codigo } = useParams();
  const [et, setEt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { buscarPorCodigo(codigo).then((d) => { setEt(d); setLoading(false); }); }, [codigo]);

  const vencido = et && et.validade_em && new Date(et.validade_em) < new Date();
  const dias = et && et.validade_em ? Math.floor((new Date(et.validade_em).getTime() - Date.now()) / 86400000) : null;
  const textoDias = dias === null ? "" : dias < 0 ? `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) !== 1 ? "s" : ""}` : dias === 0 ? "Vence hoje" : `Faltam ${dias} dia${dias !== 1 ? "s" : ""}`;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-5">
          <Package size={20} style={{ color: "var(--accent-fg)" }} />
          <span className="text-sm font-bold tracking-wide" style={{ color: "var(--fg)" }}>RASTREIO · Cerebro ERP</span>
        </div>

        {loading ? (
          <div className="erp-card p-8 text-center text-sm" style={{ color: "var(--subtle)" }}>Buscando etiqueta...</div>
        ) : !et ? (
          <div className="erp-card p-8 text-center">
            <AlertTriangle size={36} style={{ color: "#FCA5A5", margin: "0 auto 8px" }} />
            <p className="text-base font-bold" style={{ color: "var(--fg)" }}>Etiqueta não encontrada</p>
            <p className="text-sm mt-1" style={{ color: "var(--dim)" }}>Código <b>{codigo}</b> não existe ou foi removido.</p>
          </div>
        ) : (
          <div className="erp-card overflow-hidden">
            {/* Status */}
            <div className="p-5 text-center" style={{ background: vencido ? "rgba(239,68,68,0.15)" : "var(--accent-soft)" }}>
              {vencido ? <AlertTriangle size={40} style={{ color: "#FCA5A5", margin: "0 auto 6px" }} /> : <ShieldCheck size={40} style={{ color: "var(--accent-fg)", margin: "0 auto 6px" }} />}
              <p className="text-xl font-bold" style={{ color: vencido ? "#FCA5A5" : "var(--accent-fg)" }}>{vencido ? "VENCIDO" : "DENTRO DA VALIDADE"}</p>
              <p className="text-[13px] font-bold mt-1" style={{ color: vencido ? "#FCA5A5" : "var(--accent-fg)" }}>{textoDias}</p>
              <p className="text-2xl font-bold mt-2" style={{ color: "var(--fg)" }}>{et.produto}</p>
              {et.status === "baixa" && <p className="text-[11px] mt-1" style={{ color: "var(--dim)" }}>✔ Baixa registrada (consumido)</p>}
              {et.status === "perda" && <p className="text-[11px] mt-1" style={{ color: "#FCA5A5" }}>⚠ Registrado como PERDA</p>}
            </div>
            {/* Detalhes */}
            <div className="p-4 space-y-0">
              <Linha k="Conservação" v={et.conservacao} />
              <Linha k="Quantidade" v={`${et.quantidade} ${et.unidade || ""}`} />
              <Linha k="Manipulação" v={fmtDataHora(et.manipulacao_em)} />
              <Linha k="Validade" v={fmtDataHora(et.validade_em)} forte cor={vencido ? "#FCA5A5" : "var(--accent-fg)"} />
              {et.lote && <Linha k="Lote / SIF" v={et.lote} />}
              <Linha k="Responsável" v={et.responsavel} />
              <Linha k="Código" v={et.codigo} />
            </div>
          </div>
        )}
        <p className="text-[11px] text-center mt-4" style={{ color: "var(--elevated)" }}>Rastreabilidade de alimentos · Cerebro ERP</p>
      </div>
    </div>
  );
}

function Linha({ k, v, forte, cor }) {
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--line)" }}>
      <span className="text-[12px] font-medium" style={{ color: "var(--dim)" }}>{k}</span>
      <span className="text-sm" style={{ color: cor || "var(--fg)", fontWeight: forte ? 700 : 500 }}>{v}</span>
    </div>
  );
}
