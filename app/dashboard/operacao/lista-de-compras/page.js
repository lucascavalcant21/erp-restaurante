"use client";

// LISTA DE COMPRAS COM PESQUISA DE PREÇO (pedido do dono, 28/11/2026).
//
// Cozinha e bar, cada um com a sua lista, montada dos ingredientes cadastrados.
// O dono escolhe onde está ("Mercado X"), digita o preço que viu, faz o mesmo
// no Y e no Z, e a tela compara: mais barato, mais perto do cadastro, subiu ou
// desceu desde a última vez naquele lugar. Ao escolher onde comprar, se o
// preço for outro, o ingrediente atualiza (com histórico) e as fichas e a
// precificação passam a usar o preço novo.
//
// Regras em cotacoes.mjs (testadas); banco em cotacoes-dados.js.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Loader2, Plus, Search, ShoppingCart, Store, X } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import CampoDecimal from "../../../components/CampoDecimal";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos } from "../../../lib/operacao";
import { fetchFornecedores } from "../../../lib/fornecedores";
import { fetchListaCompras, salvarListaCompras } from "../../../lib/parametros";
import { fetchCotacoes, registrarCotacao, escolherCotacao, criarLocal } from "../../../lib/cotacoes-dados";
import { compararLocais, ingredientesDaLista, montarCotacao, seriesPorLocal, unidadesDaPesquisa, unidadeDoCadastro } from "../../../lib/cotacoes.mjs";
import { casaBusca } from "../../../lib/busca.mjs";

const brl = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const pct = (v) => `${v > 0 ? "+" : ""}${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const quando = (iso) => {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
};
const ROTULO_UN = { kg: "kg", g: "g", l: "L", ml: "ml", un: "un", garrafa: "garrafa", lata: "lata", pct: "pct", caixa: "caixa", maco: "maço", pacote: "pacote", barril: "barril", fardo: "fardo" };
const emb = (i) => `${Number(i?.tamanho_embalagem || 1).toLocaleString("pt-BR")} ${ROTULO_UN[unidadeDoCadastro(i?.unidade_medida)] || i?.unidade_medida || ""}`;

// Cores das linhas do gráfico (tokens hf-*).
const CORES = ["stroke-hf-menu", "stroke-hf-accent", "stroke-hf-success", "stroke-hf-warning", "stroke-hf-danger", "stroke-hf-muted"];
const PONTOS = ["fill-hf-menu", "fill-hf-accent", "fill-hf-success", "fill-hf-warning", "fill-hf-danger", "fill-hf-muted"];

function Grafico({ series }) {
  const todos = series.flatMap((s) => s.pontos);
  if (todos.length < 2) return <p className="text-xs text-hf-muted">O gráfico aparece a partir da segunda pesquisa deste ingrediente.</p>;
  const ts = todos.map((p) => new Date(p.data).getTime());
  const vs = todos.map((p) => p.valor);
  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
  const [v0, v1] = [Math.min(...vs), Math.max(...vs)];
  const W = 320, H = 120, M = 8;
  const x = (t) => M + (t1 > t0 ? ((t - t0) / (t1 - t0)) * (W - 2 * M) : (W - 2 * M) / 2);
  const y = (v) => H - M - (v1 > v0 ? ((v - v0) / (v1 - v0)) * (H - 2 * M) : (H - 2 * M) / 2);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label="Variação do preço por lugar">
        {series.map((s, i) => (
          <g key={s.fornecedorId}>
            <polyline fill="none" strokeWidth="2" className={CORES[i % CORES.length]}
              points={s.pontos.map((p) => `${x(new Date(p.data).getTime())},${y(p.valor)}`).join(" ")} />
            {s.pontos.map((p, k) => (
              <circle key={k} cx={x(new Date(p.data).getTime())} cy={y(p.valor)} r={p.escolhida ? 4.5 : 2.5} className={PONTOS[i % PONTOS.length]} />
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-hf-muted">
        {series.map((s, i) => <span key={s.fornecedorId} className="flex items-center gap-1"><svg width="10" height="10"><circle cx="5" cy="5" r="4" className={PONTOS[i % PONTOS.length]} /></svg>{s.local}</span>)}
        <span>· ponto grande = escolhido · {brl(v0)} a {brl(v1)}</span>
      </div>
    </div>
  );
}

function Detalhe({ insumo, cotacoes, local, semTabela, podeEditar, aoRegistrar, aoEscolher }) {
  const unidades = unidadesDaPesquisa(insumo.unidade_medida);
  const [preco, setPreco] = useState("");
  const [tamanho, setTamanho] = useState(String(insumo.tamanho_embalagem || 1));
  const [unidade, setUnidade] = useState(unidadeDoCadastro(insumo.unidade_medida));
  const [marca, setMarca] = useState(insumo.marca || "");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const comp = useMemo(() => compararLocais(insumo, cotacoes), [insumo, cotacoes]);
  const series = useMemo(() => seriesPorLocal(insumo, cotacoes), [insumo, cotacoes]);
  const historico = useMemo(() => cotacoes.filter((c) => c.insumo_id === insumo.id).slice().reverse().slice(0, 12), [cotacoes, insumo.id]);

  const registrar = async () => {
    setMsg("");
    const m = montarCotacao({ insumo, preco, tamanho, unidade, marca, fornecedorId: local?.id, localNome: local?.nome });
    if (m.erro) return setMsg(m.erro);
    setOcupado(true);
    const r = await aoRegistrar(m.linha);
    setOcupado(false);
    if (r?.error) return setMsg(r.error);
    setPreco("");
    setMsg(`Preço do ${local.nome} guardado.`);
  };
  const escolher = async (l) => {
    setOcupado(true); setMsg("");
    const r = await aoEscolher(insumo, l.cotacao);
    setOcupado(false);
    setMsg(r?.error ? r.error : r?.atualizouCadastro ? `Escolhido ${l.local}. Cadastro atualizado (${pct(r.variacaoPct || 0)}); fichas e precificação já usam o preço novo.` : `Escolhido ${l.local}. O preço é o mesmo do cadastro.`);
  };

  return (
    <div className="space-y-3 border-t border-hf-border p-3">
      {podeEditar && !semTabela ? (
        local ? (
          <div className="space-y-2 rounded-xl bg-hf-elevated p-3">
            <p className="text-xs font-medium text-hf-muted">Preço visto no <span className="font-semibold text-hf-text">{local.nome}</span></p>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <CampoDecimal value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="R$ 0,00" aria-label="Preço"
                className="min-h-[48px] w-full rounded-xl border border-hf-border bg-hf-bg px-3 text-base tabular-nums text-hf-text" />
              <CampoDecimal value={tamanho} casas={3} onChange={(e) => setTamanho(e.target.value)} aria-label="Tamanho da embalagem"
                className="min-h-[48px] w-full rounded-xl border border-hf-border bg-hf-bg px-3 text-base tabular-nums text-hf-text" />
              <select value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade" disabled={unidades.length < 2}
                className="min-h-[48px] rounded-xl border border-hf-border bg-hf-bg px-2 text-base text-hf-text">
                {unidades.map((u) => <option key={u} value={u}>{ROTULO_UN[u] || u}</option>)}
              </select>
            </div>
            <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca (opcional)" maxLength={120}
              className="min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-bg px-3 text-sm text-hf-text" />
            <button type="button" onClick={registrar} disabled={ocupado}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-hf-menu text-sm font-semibold text-white disabled:opacity-60">
              {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar preço
            </button>
          </div>
        ) : <p className="rounded-xl bg-hf-elevated p-3 text-xs text-hf-muted">Escolha no topo em que lugar você está para digitar o preço.</p>
      ) : null}
      {msg ? <p className="text-xs font-medium text-hf-text">{msg}</p> : null}

      <div>
        <p className="mb-1 text-[13px] font-medium text-hf-muted">Comparação {comp.cadastro ? `· cadastro ${brl(comp.cadastro.precoEquivalente)} por ${emb(insumo)}` : "· sem preço no cadastro"}</p>
        {comp.locais.length ? (
          <ul className="divide-y divide-hf-border rounded-xl border border-hf-border">
            {comp.locais.map((l) => (
              <li key={l.fornecedorId} className="flex items-center justify-between gap-2 p-2.5">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-hf-text">
                    <span className="truncate">{l.local}</span>
                    {l.melhor ? <span className="rounded-full bg-hf-success/15 px-2 py-0.5 text-[11px] font-semibold text-hf-success">Mais barato</span> : null}
                    {l.maisPerto ? <span className="rounded-full bg-hf-elevated px-2 py-0.5 text-[11px] font-semibold text-hf-text">Mais perto do cadastro</span> : null}
                    {l.escolhida ? <span className="rounded-full bg-hf-menu px-2 py-0.5 text-[11px] font-semibold text-white">Escolhido</span> : null}
                  </p>
                  <p className="text-xs text-hf-muted">
                    {brl(l.cotacao.preco)} por {Number(l.cotacao.tamanho_embalagem).toLocaleString("pt-BR")} {ROTULO_UN[l.cotacao.unidade_embalagem] || l.cotacao.unidade_embalagem}{l.marca ? ` · ${l.marca}` : ""} · {quando(l.cotacao.registrada_em)}
                  </p>
                  <p className="text-xs text-hf-muted">
                    {l.vsCadastroPct != null ? (Math.abs(l.vsCadastroPct) < 0.05 ? "igual ao cadastro" : `${pct(l.vsCadastroPct)} vs cadastro`) : ""}
                    {l.vsAnteriorPct != null ? ` · ${Math.abs(l.vsAnteriorPct) < 0.05 ? "mesmo preço" : `${l.vsAnteriorPct > 0 ? "subiu" : "desceu"} ${pct(Math.abs(l.vsAnteriorPct)).replace("+", "")}`} desde ${quando(l.anterior.registradaEm)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-sm font-bold tabular-nums text-hf-text">{brl(l.precoEquivalente)}</p>
                  {podeEditar && !semTabela && !l.escolhida ? (
                    <button type="button" onClick={() => escolher(l)} disabled={ocupado}
                      className="min-h-[36px] rounded-full border border-hf-border px-3 text-xs font-semibold text-hf-text disabled:opacity-60">Comprar aqui</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-hf-muted">Nenhuma pesquisa ainda para este ingrediente.</p>}
        {comp.economiaPct ? <p className="mt-1 text-xs text-hf-muted">Do mais caro para o mais barato: {pct(comp.economiaPct)}. Valores na embalagem do cadastro ({emb(insumo)}).</p> : null}
      </div>

      {series.length ? <Grafico series={series} /> : null}

      {historico.length ? (
        <details className="rounded-xl border border-hf-border">
          <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-sm font-medium text-hf-text">Histórico de pesquisas ({cotacoes.filter((c) => c.insumo_id === insumo.id).length})</summary>
          <ul className="divide-y divide-hf-border px-3">
            {historico.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 py-2 text-xs">
                <span className="min-w-0 truncate text-hf-text">{quando(c.registrada_em)} · {c.local_nome}{c.escolhida ? " · escolhido" : ""}</span>
                <span className="shrink-0 tabular-nums text-hf-muted">{brl(c.preco)} / {Number(c.tamanho_embalagem).toLocaleString("pt-BR")} {ROTULO_UN[c.unidade_embalagem] || c.unidade_embalagem}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ListaDeCompras() {
  const sp = useSearchParams();
  const setor = sp.get("dept") === "bar" ? "bar" : "cozinha";
  const { unidadeAtiva } = useERP();
  const [insumos, setInsumos] = useState([]);
  const [locais, setLocais] = useState([]);
  const [cotacoes, setCotacoes] = useState([]);
  const [lista, setLista] = useState([]);
  const [semTabela, setSemTabela] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState("lista");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const [localId, setLocalId] = useState("");
  const [novoLocal, setNovoLocal] = useState(null);

  useEffect(() => {
    try { const s = localStorage.getItem(`hf_compras_local_${unidadeAtiva}`); if (s) setLocalId(s); } catch { /* sem armazenamento */ }
  }, [unidadeAtiva]);
  const mudarLocal = (id) => {
    setLocalId(id);
    try { localStorage.setItem(`hf_compras_local_${unidadeAtiva}`, id); } catch { /* sem armazenamento */ }
  };

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    let vivo = true;
    setCarregando(true);
    Promise.all([fetchInsumos(unidadeAtiva, setor), fetchFornecedores(unidadeAtiva), fetchCotacoes(unidadeAtiva), fetchListaCompras(unidadeAtiva)])
      .then(([rI, rF, rC, rL]) => {
        if (!vivo) return;
        setInsumos(ingredientesDaLista(rI.data || [], setor).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")));
        setLocais((rF.data || []).filter((f) => f.ativo !== false));
        setCotacoes(rC.data || []);
        setSemTabela(!!rC.semTabela);
        setLista(Array.isArray(rL.data?.[setor]) ? rL.data[setor] : []);
        setErro(rI.error && rI.error !== "Offline" ? rI.error : rC.error || "");
      })
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [unidadeAtiva, setor]);

  const local = locais.find((l) => l.id === localId) || null;
  const naLista = useMemo(() => new Set(lista), [lista]);
  const mostrados = useMemo(() => {
    const base = aba === "lista" ? insumos.filter((i) => naLista.has(String(i.id))) : insumos;
    const q = busca.trim();
    return q ? base.filter((i) => casaBusca(`${i.nome} ${i.marca || ""} ${i.categoria || ""}`, q)) : base;
  }, [insumos, naLista, aba, busca]);

  const alternarNaLista = async (id) => {
    const nova = naLista.has(String(id)) ? lista.filter((x) => x !== String(id)) : [...lista, String(id)];
    setLista(nova);
    const r = await salvarListaCompras(unidadeAtiva, setor, nova);
    if (r?.error) setErro(`A lista não foi salva: ${r.error}`);
  };
  const aoRegistrar = async (linha) => {
    const r = await registrarCotacao(unidadeAtiva, linha);
    if (!r.error && r.data) setCotacoes((c) => [...c, r.data]);
    return r;
  };
  const aoEscolher = async (insumo, cotacao) => {
    const r = await escolherCotacao({ insumo, cotacao, todas: cotacoes });
    if (r.error && !/marcada/.test(r.error)) return r;
    const [rC, rI] = await Promise.all([fetchCotacoes(unidadeAtiva), fetchInsumos(unidadeAtiva, setor)]);
    setCotacoes(rC.data || []);
    setInsumos(ingredientesDaLista(rI.data || [], setor).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")));
    return r;
  };
  const salvarNovoLocal = async () => {
    const r = await criarLocal(unidadeAtiva, novoLocal);
    if (r.error) return setErro(r.error);
    setLocais((l) => [...l, r.data].sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")));
    mudarLocal(r.data.id);
    setNovoLocal(null);
  };

  const titulo = setor === "bar" ? "Lista de compras do bar" : "Lista de compras da cozinha";
  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="mx-auto max-w-3xl px-4 py-6"><CabecalhoTela titulo={titulo} subtitulo="Escolha uma unidade no topo." /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 pb-28 pt-4 sm:px-6">
      <CabecalhoTela titulo={titulo} subtitulo="Pesquise o preço em cada lugar e escolha onde comprar." />

      {semTabela ? (
        <p className="rounded-xl border border-hf-warning/40 bg-hf-warning/10 p-3 text-sm text-hf-text">
          A pesquisa de preço precisa de uma tabela nova no banco, que aguarda a sua autorização. Por enquanto dá para montar a lista e ver os preços do cadastro.
        </p>
      ) : null}
      {erro ? <p className="rounded-xl border border-hf-danger/40 bg-hf-danger/10 p-3 text-sm text-hf-text">{erro}</p> : null}

      {/* Onde estou comprando agora. */}
      <div className="rounded-2xl border border-hf-border bg-hf-surface p-3">
        <label className="flex items-center gap-2 text-xs font-medium text-hf-muted"><Store size={14} /> Onde você está</label>
        {novoLocal === null ? (
          <div className="mt-1 flex gap-2">
            <select value={localId} onChange={(e) => mudarLocal(e.target.value)}
              className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-hf-border bg-hf-bg px-3 text-base text-hf-text">
              <option value="">Escolha o lugar…</option>
              {locais.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
            <button type="button" onClick={() => setNovoLocal("")} className="flex min-h-[48px] shrink-0 items-center gap-1 rounded-xl border border-hf-border px-3 text-sm font-semibold text-hf-text">
              <Plus size={16} /> Novo
            </button>
          </div>
        ) : (
          <div className="mt-1 flex gap-2">
            <input autoFocus value={novoLocal} onChange={(e) => setNovoLocal(e.target.value)} placeholder="Ex.: Atacadão, Mercado do Zé" maxLength={120}
              className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-hf-border bg-hf-bg px-3 text-base text-hf-text" />
            <button type="button" onClick={salvarNovoLocal} className="min-h-[48px] shrink-0 rounded-xl bg-hf-menu px-4 text-sm font-semibold text-white">Salvar</button>
            <button type="button" onClick={() => setNovoLocal(null)} aria-label="Cancelar" className="min-h-[48px] shrink-0 rounded-xl border border-hf-border px-3 text-hf-muted"><X size={16} /></button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {[["lista", `Minha lista (${insumos.filter((i) => naLista.has(String(i.id))).length})`], ["todos", "Todos os ingredientes"]].map(([id, rot]) => (
          <button key={id} type="button" onClick={() => setAba(id)}
            className={`min-h-[40px] flex-1 rounded-full px-3 text-sm font-semibold ${aba === id ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2"}`}>{rot}</button>
        ))}
      </div>
      <label className="flex min-h-[48px] items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-3">
        <Search size={16} className="text-hf-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ingrediente" className="min-w-0 flex-1 bg-transparent text-base text-hf-text outline-none" />
      </label>

      {carregando ? (
        <div className="grid place-items-center py-16 text-hf-muted"><Loader2 className="animate-spin" size={24} /></div>
      ) : mostrados.length ? (
        <ul className="space-y-2">
          {mostrados.map((i) => {
            const comp = compararLocais(i, cotacoes);
            const estaNaLista = naLista.has(String(i.id));
            const abre = aberto === i.id;
            return (
              <li key={i.id} className="overflow-hidden rounded-xl border border-hf-border bg-hf-surface">
                <div className="flex items-center gap-2 p-2.5">
                  <button type="button" onClick={() => alternarNaLista(i.id)} aria-label={estaNaLista ? "Tirar da lista" : "Pôr na lista"}
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${estaNaLista ? "bg-hf-menu text-white" : "border border-hf-border text-hf-muted"}`}>
                    {estaNaLista ? <ShoppingCart size={18} /> : <Plus size={18} />}
                  </button>
                  <button type="button" onClick={() => setAberto(abre ? null : i.id)} aria-expanded={abre} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-hf-text">{i.nome}</p>
                      <p className="truncate text-xs text-hf-muted">{i.marca ? `${i.marca} · ` : ""}{Number(i.custo_compra) > 0 ? `${brl(i.custo_compra)} por ${emb(i)}` : "sem preço no cadastro"}</p>
                      {comp.melhor ? <p className="truncate text-xs text-hf-success">Melhor: {comp.melhor.local} · {brl(comp.melhor.precoEquivalente)}</p> : null}
                    </div>
                    <ChevronDown size={18} className={`shrink-0 text-hf-muted transition ${abre ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {abre ? <Detalhe insumo={i} cotacoes={cotacoes} local={local} semTabela={semTabela} podeEditar aoRegistrar={aoRegistrar} aoEscolher={aoEscolher} /> : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-hf-border bg-hf-surface p-4 text-sm text-hf-muted">
          {aba === "lista" ? "A lista está vazia. Vá em Todos os ingredientes e toque no + para pôr na lista." : "Nenhum ingrediente encontrado."}
        </p>
      )}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><ListaDeCompras /></Suspense>;
}
