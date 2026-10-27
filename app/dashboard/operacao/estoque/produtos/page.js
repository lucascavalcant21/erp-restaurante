"use client";
// TODOS OS PRODUTOS DO ESTOQUE (pedido do dono, 27/10/2026): ver tudo numa
// tela, lançar e retirar com um toque e ter mínimo e máximo pelo ritmo real
// de saída e entrada (dia, semana, mês). Ritmo = REAL; sugestão = ESTIMATIVA;
// sem histórico suficiente = DADOS INSUFICIENTES. Regras em estoque-ritmo.mjs.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Check, Loader2, Search, Settings2, Sparkles, X } from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { unidadeValida } from "../../../../lib/contas-pagar.mjs";
import EstoqueAbas from "../../../../components/navigation/EstoqueAbas";
import { carregarVisaoEstoque, salvarMinMax } from "../../../../lib/estoque-visao";
import { PADRAO_RITMO } from "../../../../lib/estoque-ritmo.mjs";

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
// ml e g grandes ficam ilegíveis (7.304 ml): mostra também em L/kg.
const MAIOR = { ml: "L", g: "kg" };
const emMaior = (n, un) => { const u = MAIOR[String(un || "").toLowerCase()]; return u && Math.abs(n) >= 1000 ? ` (${fmt(n / 1000)} ${u})` : ""; };
const AREAS = [["todas", "Todas"], ["cozinha", "Cozinha"], ["bar", "Bar"], ["salao", "Salão"], ["limpeza", "Limpeza"], ["outros", "Outros"]];
const SITUACOES = [["todas", "Tudo"], ["zerado", "Acabou"], ["baixo", "Abaixo do mínimo"], ["acima", "Acima do máximo"], ["parado", "Sem uso"], ["sem_min", "Sem mínimo"], ["sugestao", "Com sugestão"]];
const COR = { zerado: "#B42318", baixo: "#B45309", acima: "#1D4ED8", ok: "#047857", parado: "#6B7280" };
const ROTULO = { zerado: "Acabou", baixo: "Abaixo do mínimo", acima: "Acima do máximo", ok: "Em dia", parado: "Sem uso" };
const ORDEM = { zerado: 0, baixo: 1, acima: 2, ok: 3, parado: 4 };
const CHAVE_REGRAS = "hefisto:estoque:regras-minmax";

function lerRegras(u) {
  try { const r = JSON.parse(localStorage.getItem(`${CHAVE_REGRAS}:${u}`) || "null"); return r && typeof r === "object" ? r : {}; } catch { return {}; }
}

export default function TodosOsProdutos() {
  const { unidadeAtiva } = useERP();
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState("todas");
  const [situacao, setSituacao] = useState("todas");
  const [regras, setRegras] = useState({});
  const [verRegras, setVerRegras] = useState(false);
  const [edicao, setEdicao] = useState({}); // id → { minimo, maximo }
  const [salvando, setSalvando] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => { if (unidadeValida(unidadeAtiva)) setRegras(lerRegras(unidadeAtiva)); }, [unidadeAtiva]);

  const carregar = useCallback(async () => {
    if (!unidadeValida(unidadeAtiva)) { setCarregando(false); return; }
    setCarregando(true);
    const r = await carregarVisaoEstoque(unidadeAtiva, { regras });
    setLinhas(r.linhas); setErro(r.erro || ""); setCarregando(false);
  }, [unidadeAtiva, regras]);
  useEffect(() => { carregar(); }, [carregar]);

  const mudarRegra = (k, v) => {
    const n = Math.max(0, Math.min(90, Math.round(Number(v) || 0)));
    const novo = { ...regras, [k]: n };
    setRegras(novo);
    try { localStorage.setItem(`${CHAVE_REGRAS}:${unidadeAtiva}`, JSON.stringify(novo)); } catch { /* segue */ }
  };
  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3500); };

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (area !== "todas" && l.area !== area) return false;
      if (situacao === "sem_min" && l.minimo > 0) return false;
      if (situacao === "sugestao" && !(l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo))) return false;
      if (["zerado", "baixo", "acima", "parado"].includes(situacao) && l.situacao !== situacao) return false;
      return !q || `${l.nome} ${l.categoria} ${l.local}`.toLowerCase().includes(q);
    }).sort((a, b) => ORDEM[a.situacao] - ORDEM[b.situacao] || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [linhas, busca, area, situacao]);

  const resumo = useMemo(() => ({
    total: linhas.length,
    zerado: linhas.filter((l) => l.situacao === "zerado").length,
    baixo: linhas.filter((l) => l.situacao === "baixo").length,
    comSugestao: linhas.filter((l) => l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo)).length,
  }), [linhas]);

  async function salvar(lista, rotulo) {
    setSalvando(rotulo);
    const { falhas } = await salvarMinMax(lista);
    setSalvando("");
    if (falhas.length) avisar(`${lista.length - falhas.length} salvo(s); ${falhas.length} com erro: ${falhas[0].erro}`);
    else avisar(lista.length > 1 ? `Mínimo e máximo salvos em ${lista.length} produtos.` : "Mínimo e máximo salvos.");
    setEdicao((e) => { const n = { ...e }; for (const a of lista) delete n[a.id]; return n; });
    carregar();
  }
  const aplicarTodas = () => {
    const lista = filtradas.filter((l) => l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo)).map((l) => ({ id: l.id, minimo: l.sugestao.minimo, maximo: l.sugestao.maximo }));
    if (!lista.length) return;
    if (!confirm(`Usar o mínimo e o máximo sugeridos em ${lista.length} produto(s) da lista? Dá para mudar depois.`)) return;
    salvar(lista, "todas");
  };

  if (!unidadeValida(unidadeAtiva)) {
    return <div className="min-h-screen bg-hf-bg"><EstoqueAbas /><p className="p-8 text-center font-bold text-hf-text-2">Selecione uma unidade para ver o estoque.</p></div>;
  }
  const r = { ...PADRAO_RITMO, ...regras };
  const campoRegra = (k, rotulo) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-hf-text-2">
      {rotulo}
      <input type="number" min={0} max={90} value={r[k]} onChange={(e) => mudarRegra(k, e.target.value)} className="h-10 w-24 rounded-xl border border-hf-border bg-hf-surface px-3 text-base font-black text-hf-text" />
    </label>
  );

  return (
    <div className="min-h-screen bg-hf-bg">
      <EstoqueAbas />
      <div className="mx-auto max-w-[1500px] space-y-4 px-3 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-black text-hf-text sm:text-2xl">Todos os produtos</h1>
            <p className="text-sm font-semibold text-hf-text-2">Saldo em cada local, quanto sai e entra por dia, semana e mês, e o mínimo e o máximo pelo seu uso real.</p>
          </div>
          <button onClick={() => setVerRegras((v) => !v)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text">
            <Settings2 size={16} /> Como calcular o mínimo e o máximo
          </button>
        </div>

        {verRegras ? (
          <div className="rounded-2xl border border-hf-border bg-hf-surface p-4">
            <div className="flex flex-wrap gap-4">
              {campoRegra("prazoReposicaoDias", "Dias até a compra chegar")}
              {campoRegra("segurancaDias", "Dias de folga")}
              {campoRegra("intervaloCompraDias", "Compra a cada (dias)")}
            </div>
            <p className="mt-3 text-sm font-semibold text-hf-text-2">
              Mínimo = o que sai em {r.prazoReposicaoDias + r.segurancaDias} dias. Máximo = mínimo + o que sai em {r.intervaloCompraDias} dias.
              Olha os últimos {r.janelaDias} dias; produto com menos de {r.minimoDiasHistorico} dias de histórico ou menos de {r.minimoSaidas} retiradas fica sem sugestão (dados insuficientes).
              Estorno e ajuste de contagem não contam como uso.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Produtos nos locais", resumo.total, "text-hf-text", "todas"], ["Acabou", resumo.zerado, resumo.zerado ? "text-[#B42318]" : "text-[#047857]", "zerado"], ["Abaixo do mínimo", resumo.baixo, resumo.baixo ? "text-[#B45309]" : "text-[#047857]", "baixo"], ["Com sugestão nova", resumo.comSugestao, "text-hf-text", "sugestao"]].map(([rot, v, cor, s]) => (
            <button key={rot} onClick={() => setSituacao(s)} className={`rounded-2xl border bg-hf-surface px-3 py-2.5 text-left ${situacao === s ? "border-hf-accent" : "border-hf-border"}`}>
              <p className={`text-2xl font-black leading-none ${cor}`}>{v}</p>
              <p className="mt-1 text-xs font-bold text-hf-text-2">{rot}</p>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-text-2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto, categoria ou local…" className="h-12 w-full rounded-2xl border border-hf-border bg-hf-surface pl-10 pr-10 font-semibold text-hf-text" />
            {busca ? <button onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2"><X size={18} /></button> : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {AREAS.map(([id, rot]) => <button key={id} onClick={() => setArea(id)} aria-pressed={area === id} className={`h-9 shrink-0 rounded-full border px-3 text-sm font-bold ${area === id ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text"}`}>{rot}</button>)}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {SITUACOES.map(([id, rot]) => <button key={id} onClick={() => setSituacao(id)} aria-pressed={situacao === id} className={`h-9 shrink-0 rounded-full border px-3 text-sm font-bold ${situacao === id ? "border-hf-text bg-hf-text text-hf-surface" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{rot}</button>)}
          </div>
        </div>

        {aviso ? <p role="status" className="rounded-xl bg-hf-elevated px-3 py-2 text-sm font-bold text-hf-text">{aviso}</p> : null}

        {filtradas.some((l) => l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo)) ? (
          <button onClick={aplicarTodas} disabled={!!salvando} className="inline-flex h-11 items-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-black text-white disabled:opacity-60">
            {salvando === "todas" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Usar a sugestão em todos da lista
          </button>
        ) : null}

        {erro ? <p className="rounded-xl bg-red-50 p-4 font-bold text-red-800">{erro}</p> : carregando ? (
          <p className="p-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Calculando o ritmo do estoque…</p>
        ) : !filtradas.length ? (
          <p className="p-8 text-center font-bold text-hf-text-2">Nenhum produto nesta seleção.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtradas.map((l) => {
              const ed = edicao[l.id];
              const s = l.sugestao;
              const temNova = s.ok && (s.minimo !== l.minimo || s.maximo !== l.maximo);
              return (
                <li key={l.id} className="rounded-2xl border border-hf-border bg-hf-surface p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-hf-text-2">{l.local}{l.categoria ? ` · ${l.categoria}` : ""}</p>
                      <p className="font-black leading-tight text-hf-text">{l.nome}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-hf-elevated px-2 py-1 text-[11px] font-black uppercase" style={{ color: COR[l.situacao] }}>{ROTULO[l.situacao]}</span>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-3xl font-black leading-none" style={{ color: COR[l.situacao] }}>{fmt(l.saldo)} <span className="text-sm font-bold text-hf-text-2">{l.unidade}{emMaior(l.saldo, l.unidade)}</span></p>
                    <div className="flex gap-2">
                      <Link href={`/dashboard/operacao/estoque?estoque=${l.estoque_id}&tipo=saida&insumo=${l.insumo_id}`} aria-label={`Retirar ${l.nome}`} className="inline-flex h-11 items-center gap-1 rounded-xl border border-hf-border px-3 text-sm font-bold text-hf-text"><ArrowUpFromLine size={16} /> Retirar</Link>
                      <Link href={`/dashboard/operacao/estoque?estoque=${l.estoque_id}&tipo=entrada&insumo=${l.insumo_id}`} aria-label={`Lançar entrada de ${l.nome}`} className="inline-flex h-11 items-center gap-1 rounded-xl bg-hf-accent px-3 text-sm font-black text-white"><ArrowDownToLine size={16} /> Entrada</Link>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-hf-elevated p-2.5">
                      <p className="text-[11px] font-black uppercase text-hf-text-2">Sai</p>
                      {l.ritmo.saida.vezes ? <p className="font-bold text-hf-text">{fmt(l.ritmo.saida.dia)}{emMaior(l.ritmo.saida.dia, l.unidade)}/dia · {fmt(l.ritmo.saida.semana)}/sem · {fmt(l.ritmo.saida.mes)}/mês</p> : <p className="font-semibold text-hf-text-2">Sem retiradas</p>}
                    </div>
                    <div className="rounded-xl bg-hf-elevated p-2.5">
                      <p className="text-[11px] font-black uppercase text-hf-text-2">Entra</p>
                      {l.ritmo.entrada.vezes ? <p className="font-bold text-hf-text">{fmt(l.ritmo.entrada.dia)}/dia · {fmt(l.ritmo.entrada.semana)}/sem · {fmt(l.ritmo.entrada.mes)}/mês</p> : <p className="font-semibold text-hf-text-2">Sem entradas</p>}
                    </div>
                  </div>
                  {l.cobertura != null ? <p className="mt-2 text-sm font-bold text-hf-text-2">O saldo dá para <span className="text-hf-text">{l.cobertura} dia(s)</span> no ritmo atual.</p> : null}

                  <div className="mt-3 rounded-xl border border-dashed border-hf-border p-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-hf-text-2">Mínimo
                        <input type="number" min={0} step="any" value={ed?.minimo ?? (l.minimo || "")} onChange={(e) => setEdicao((x) => ({ ...x, [l.id]: { minimo: e.target.value, maximo: x[l.id]?.maximo ?? l.maximo } }))} className="h-10 w-24 rounded-xl border border-hf-border bg-hf-surface px-2 text-base font-black text-hf-text" placeholder="0" />
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-hf-text-2">Máximo
                        <input type="number" min={0} step="any" value={ed?.maximo ?? (l.maximo || "")} onChange={(e) => setEdicao((x) => ({ ...x, [l.id]: { minimo: x[l.id]?.minimo ?? l.minimo, maximo: e.target.value } }))} className="h-10 w-24 rounded-xl border border-hf-border bg-hf-surface px-2 text-base font-black text-hf-text" placeholder="0" />
                      </label>
                      {ed ? <button onClick={() => salvar([{ id: l.id, minimo: ed.minimo, maximo: ed.maximo }], l.id)} disabled={salvando === l.id} className="inline-flex h-10 items-center gap-1 rounded-xl bg-hf-text px-3 text-sm font-black text-hf-surface"><Check size={16} /> Salvar</button> : null}
                    </div>
                    {s.ok ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-hf-text-2"><span className="font-black text-hf-text">Sugestão (estimativa):</span> mínimo {fmt(s.minimo)}{emMaior(s.minimo, l.unidade)}, máximo {fmt(s.maximo)} {l.unidade}{emMaior(s.maximo, l.unidade)}. <span className="block text-xs">{s.explicacao}</span></p>
                        {temNova ? <button onClick={() => salvar([{ id: l.id, minimo: s.minimo, maximo: s.maximo }], l.id)} disabled={salvando === l.id} className="inline-flex h-9 items-center gap-1 rounded-xl border border-hf-accent px-3 text-sm font-black text-hf-text"><Sparkles size={14} /> Usar sugestão</button> : <span className="text-xs font-black text-[#047857]">Já usa a sugestão</span>}
                      </div>
                    ) : <p className="mt-2 text-xs font-bold text-hf-text-2">DADOS INSUFICIENTES para sugerir: {s.motivo}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
