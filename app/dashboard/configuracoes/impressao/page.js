"use client";

// Configurações → Impressão (pedido do dono, 07/11/2026):
//   Modelos       – via da cozinha, do bar, conferência de conta e recibo (da unidade, no banco)
//   Impressoras   – impressora de cada setor neste aparelho (no navegador)
//   Observações   – observações prontas do garçom por setor e categoria (da unidade, no banco)

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { hasPermission } from "../../../lib/permissions-catalog.mjs";
import { fetchModelosImpressao, fetchObservacoesProntas, salvarModelosImpressao, salvarObservacoesProntas } from "../../../lib/parametros";
import { fetchProdutos } from "../../../lib/vendas";
import { mesclarModelos } from "../../../lib/impressao-modelos.mjs";
import { mesclarObservacoes } from "../../../lib/observacoes-prontas.mjs";
import EditorDeModelos from "../../../components/impressao/EditorDeModelos";
import ImpressorasDoAparelho from "../../../components/impressao/ImpressorasDoAparelho";
import EditorDeObservacoes from "../../../components/impressao/EditorDeObservacoes";

const ABAS = [
  { id: "modelos", rotulo: "Modelos das vias" },
  { id: "impressoras", rotulo: "Impressoras deste aparelho" },
  { id: "observacoes", rotulo: "Observações prontas" },
];

export default function ImpressaoPage() {
  const { unidadeAtiva, sessao } = useERP();
  const [aba, setAba] = useState("modelos");
  const [modelos, setModelos] = useState(() => mesclarModelos(null));
  const [obs, setObs] = useState(() => mesclarObservacoes(null));
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [mudou, setMudou] = useState(false);
  const podeEditar = !sessao?.gerenciado || hasPermission(sessao, "configuracoes.printing.edit");

  useEffect(() => {
    try { const a = new URLSearchParams(window.location.search).get("aba"); if (ABAS.some((x) => x.id === a)) setAba(a); } catch { /* segue */ }
  }, []);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let vivo = true;
    setCarregando(true);
    Promise.all([fetchModelosImpressao(unidadeAtiva), fetchObservacoesProntas(unidadeAtiva), fetchProdutos(unidadeAtiva)]).then(([m, o, p]) => {
      if (!vivo) return;
      setModelos(mesclarModelos(m.data));
      setObs(mesclarObservacoes(o.data));
      setCategorias([...new Set((p.data || []).map((x) => String(x.categoria || "").trim()).filter(Boolean))]);
      setErro(m.error || o.error ? "Não foi possível ler as configurações salvas. Mostrando o padrão." : "");
      setMudou(false);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const precisaSalvar = aba !== "impressoras" && mudou;
  const salvar = async () => {
    if (salvando) return;
    setSalvando(true); setAviso("");
    const [a, b] = await Promise.all([salvarModelosImpressao(unidadeAtiva, mesclarModelos(modelos)), salvarObservacoesProntas(unidadeAtiva, mesclarObservacoes(obs))]);
    const e = a?.error || b?.error;
    setAviso(e ? `Não salvou: ${e}` : "Salvo. Vale para todos os aparelhos desta unidade.");
    if (!e) setMudou(false);
    setSalvando(false);
  };

  const titulo = useMemo(() => ABAS.find((x) => x.id === aba)?.rotulo, [aba]);
  if (!unidadeAtiva || unidadeAtiva === "todas") return <p className="p-6 text-sm text-hf-text-2">Escolha uma unidade para configurar a impressão.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 pb-28 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/dashboard/configuracoes" aria-label="Voltar para Configurações" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border text-hf-text hover:bg-hf-elevated"><ArrowLeft size={18} /></Link>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-hf-text">Impressão</h1>
            <p className="text-sm text-hf-text-2">{titulo}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl border border-hf-border bg-hf-surface p-1" role="tablist" aria-label="Seções da impressão">
        {ABAS.map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={`min-h-[44px] rounded-xl px-2 text-xs font-bold leading-tight sm:text-sm ${aba === a.id ? "bg-hf-accent text-hf-accent-fg" : "text-hf-text-2 hover:bg-hf-elevated"}`}>{a.rotulo}</button>
        ))}
      </div>

      {erro && <p className="rounded-xl border border-hf-warning/40 bg-hf-warning/10 p-3 text-sm font-semibold text-hf-text">{erro}</p>}
      {!podeEditar && aba !== "impressoras" && <p className="rounded-xl bg-hf-elevated p-3 text-sm text-hf-text-2">Você pode ver, mas não alterar. Peça ao gerente a permissão "Impressão e observações prontas".</p>}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando…</p>
      ) : aba === "modelos" ? (
        <EditorDeModelos modelos={modelos} podeEditar={podeEditar} onChange={(m) => { setModelos(m); setMudou(true); setAviso(""); }} />
      ) : aba === "impressoras" ? (
        <ImpressorasDoAparelho modelos={modelos} />
      ) : (
        <EditorDeObservacoes obs={obs} categorias={categorias} podeEditar={podeEditar} onChange={(o) => { setObs(o); setMudou(true); setAviso(""); }} />
      )}

      {podeEditar && aba !== "impressoras" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hf-border bg-hf-surface/95 p-3 backdrop-blur" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
            {aviso && <span className="min-w-0 text-sm font-semibold text-hf-text-2" role="status">{aviso}</span>}
            <button type="button" onClick={salvar} disabled={salvando || !precisaSalvar}
              className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-xl bg-hf-accent px-6 text-sm font-black text-hf-accent-fg disabled:opacity-50">
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
