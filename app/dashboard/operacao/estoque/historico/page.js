"use client";

// HISTÓRICO DO ESTOQUE (HDEV-EST-001): tudo que mudou saldo, o mais novo
// primeiro. Só leitura: correção é estorno (administrador + PIN), e o
// lançamento original continua aqui.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useERP } from "../../../../context/ERPContext";
import { unidadeValida } from "../../../../lib/contas-pagar.mjs";
import { fetchBaseMovimento, fetchHistorico, lerSeguranca } from "../../../../lib/estoque-movimento-dados";
import { rotuloMotivo, podeEstornar, novaChave, ehEntradaDeCompra } from "../../../../lib/estoque-movimento.mjs";
import { saldoOperacional } from "../../../../lib/estoque-unidades.mjs";
import EstoqueAbas from "../../../../components/navigation/EstoqueAbas";
import ModalEstorno, { fmtHora } from "../../../../components/estoque/ModalEstorno";
import { RotateCcw, Search, X } from "lucide-react";

const FILTROS = [["todos", "Tudo"], ["entrada", "Entradas"], ["saida", "Retiradas"], ["transferencia", "Transferências"], ["estorno", "Estornos"]];
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function HistoricoPage() {
  return <Suspense fallback={<p className="p-8 text-center font-bold text-hf-text-2">Carregando...</p>}><Historico /></Suspense>;
}

function Historico() {
  const { unidadeAtiva } = useERP();
  const params = useSearchParams();
  const [locais, setLocais] = useState([]);
  const [estoqueId, setEstoqueId] = useState(params.get("estoque") || "");
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [r, setR] = useState({ data: [], estornados: new Set(), carregando: true });
  const [seg, setSeg] = useState(null);
  const [estorno, setEstorno] = useState(null);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    if (!unidadeValida(unidadeAtiva)) return;
    setR((x) => ({ ...x, carregando: true }));
    const h = await fetchHistorico(unidadeAtiva, { estoqueId: estoqueId || null, limite: 300 });
    setR({ ...h, carregando: false });
  }, [unidadeAtiva, estoqueId]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (!unidadeValida(unidadeAtiva)) return;
    fetchBaseMovimento(unidadeAtiva).then((b) => setLocais(b.data?.estoques || []));
    lerSeguranca(unidadeAtiva).then((s) => setSeg(s.data));
  }, [unidadeAtiva]);

  const lista = useMemo(() => (r.data || []).filter((m) => {
    if (filtro === "entrada" && m.tipo !== "entrada") return false;
    if (filtro === "saida" && m.tipo !== "saida") return false;
    if (filtro === "transferencia" && !String(m.tipo).startsWith("transferencia")) return false;
    if (filtro === "estorno" && m.motivo !== "estorno" && !r.estornados.has(m.id)) return false;
    return !busca || normal(m.insumo?.nome).includes(normal(busca));
  }), [r, filtro, busca]);

  if (!unidadeValida(unidadeAtiva)) return <p className="p-8 text-center font-bold text-hf-text-2">Selecione uma unidade.</p>;

  return (
    <div className="min-h-screen bg-hf-bg text-hf-text">
      <EstoqueAbas />
      <div className="mx-auto max-w-3xl space-y-3 px-3 pb-24 pt-3 sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={estoqueId} onChange={(e) => setEstoqueId(e.target.value)} aria-label="Local"
            className="h-11 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold">
            <option value="">Todos os locais</option>
            {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-3">
            <Search size={16} className="text-hf-muted" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Produto" aria-label="Buscar produto" className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none" />
            {busca && <button onClick={() => setBusca("")} aria-label="Limpar"><X size={16} /></button>}
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {FILTROS.map(([id, rot]) => (
            <button key={id} onClick={() => setFiltro(id)} aria-pressed={filtro === id}
              className={`h-9 shrink-0 rounded-full px-3 text-xs font-bold ${filtro === id ? "bg-hf-text text-hf-surface" : "bg-hf-surface text-hf-text-2 border border-hf-border"}`}>{rot}</button>
          ))}
        </div>
        {aviso && <p role="status" className="rounded-xl border border-hf-success/30 bg-hf-success/10 p-3 text-sm font-bold text-hf-success">{aviso}</p>}
        {r.error && <p className="text-sm font-bold text-hf-danger">{r.error}</p>}
        <ul className="divide-y divide-hf-border overflow-hidden rounded-2xl border border-hf-border bg-hf-surface">
          {r.carregando && <li className="p-4 text-sm text-hf-text-2">Carregando...</li>}
          {!r.carregando && !lista.length && <li className="p-4 text-sm text-hf-text-2">Nada encontrado.</li>}
          {lista.map((m) => {
            const entra = m.tipo === "entrada" || m.tipo === "transferencia_entrada" || (m.tipo === "contagem" && Number(m.quantidade) >= 0);
            const estornado = r.estornados.has(m.id);
            return (
              <li key={m.id} className={`flex justify-between gap-2 px-3 py-2.5 ${estornado ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <p className="text-sm font-bold"><span className={entra ? "text-hf-success" : ""}>{entra ? "+" : "−"}{saldoOperacional(m.insumo, Math.abs(Number(m.quantidade)))}</span> {m.insumo?.nome || "—"}</p>
                  <p className="text-xs text-hf-text-2">
                    {[!estoqueId && m.estoque?.nome, rotuloMotivo(m.motivo) || (String(m.tipo).startsWith("transferencia") ? "Transferência" : m.tipo === "contagem" ? "Contagem" : null),
                      m.usuario_nome, m.responsavel_nome && `por ${m.responsavel_nome}`, fmtHora(m.created_at)].filter(Boolean).join(" · ")}
                  </p>
                  {(m.motivo === "estorno" || m.motivo === "ajuste_autorizado") && <p className="text-xs text-hf-muted">Autorizado por {m.autorizado_por_nome}: {m.justificativa}</p>}
                  {ehEntradaDeCompra(m) && !estornado && <p className="text-xs text-hf-muted">Entrada de compra: para desfazer, cancele a compra em Compras.</p>}
                  {estornado && <p className="text-xs font-bold text-hf-danger">Estornado</p>}
                </div>
                {seg?.pode_autorizar && podeEstornar(m, r.estornados) && (
                  <button onClick={() => setEstorno({ mov: m, justificativa: "", pin: "", chave: novaChave(), erro: "" })}
                    className="flex h-9 shrink-0 items-center gap-1 self-center rounded-lg bg-hf-elevated px-2 text-xs font-bold text-hf-text-2"><RotateCcw size={13} /> Estornar</button>
                )}
              </li>);
          })}
        </ul>
      </div>
      {estorno && <ModalEstorno estorno={estorno} setEstorno={setEstorno} onFeito={async (texto) => { setEstorno(null); setAviso(texto); await carregar(); }} />}
    </div>
  );
}
