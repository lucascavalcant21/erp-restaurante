"use client";

// Comandas do garçom: escolhe a mesa, lança por pessoa, envia à cozinha e ao bar
// e pede a conta. Quem recebe é o caixa, em /dashboard/salao/mesas.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Minus, Plus, Receipt, Search, Send, X } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchColaboradores } from "../../lib/rh";
import { equipeParaEtiquetar } from "../../lib/equipe-area.mjs";
import { abrirComandaDaMesa, enviarParaProducao, fetchCardapioDoSalao, fetchSalao, marcarItemServido, pedirConta } from "../../lib/comandas";
import { prontosDaComanda, prontosNovos, relogio, situacaoDoItem } from "../../lib/preparo-itens.mjs";
import { useTempoReal } from "../../lib/realtime";
import { alternarObservacao, mesclarObservacoes, observacoesDoProduto, temObservacao } from "../../lib/observacoes-prontas.mjs";
import { fetchObservacoesProntas } from "../../lib/parametros";
import { MESA_TODA, STATUS_DO_ITEM, definirObservacao, estadoDaMesa, limparNome, mudarQuantidade, numeroDaMesa, ordenarMesas, pessoasDaComanda, resumoPorPessoa, somarAoRascunho, tempoDaMesa, totalDaComanda } from "../../lib/comandas.mjs";
import CabecalhoTela from "../../components/ui/CabecalhoTela";

const CHAVE_GARCOM = "hefisto_comandas_garcom";
const ATUALIZAR_MS = 10000;
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const semAcento = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const COR = {
  livre: "border-hf-border bg-hf-surface",
  ocupada: "border-hf-accent bg-hf-accent/15",
  conta: "border-hf-warning bg-hf-warning/15",
};
const chip = (ativo) => `min-h-[44px] shrink-0 rounded-xl px-3 text-sm font-bold ${ativo ? "bg-hf-accent text-hf-accent-fg" : "border border-hf-border bg-hf-surface text-hf-text-2"}`;

function EscolherGarcom({ equipe, onEscolher }) {
  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-xl font-black text-hf-text">Identificação do garçom</h1>
      <p className="text-sm text-hf-text-2">Seu nome fica registrado nas mesas que você abrir.</p>
      <ul className="mt-3 space-y-2">
        {equipe.map((c) => <li key={c.id}><button type="button" onClick={() => onEscolher(c.nome)} className="min-h-[52px] w-full rounded-xl border border-hf-border bg-hf-surface px-4 text-left font-bold text-hf-text">{c.nome}</button></li>)}
      </ul>
      {!equipe.length && <p className="mt-3 text-sm text-hf-text-2">Nenhum funcionário ativo no Restaurante.</p>}
    </div>
  );
}

function Mapa({ mesas, pedidos, garcom, onTrocarGarcom, onAbrir, ocupado }) {
  const [busca, setBusca] = useState("");
  const porMesa = useMemo(() => new Map(pedidos.map((p) => [p.mesa_id, p]).reverse()), [pedidos]);
  const lista = ordenarMesas(mesas).filter((m) => numeroDaMesa(m).includes(busca.trim()));
  return (
    <>
      <CabecalhoTela embutido titulo="Comandas" subtitulo="Lançar pedidos e pedir a conta">
        <button type="button" onClick={onTrocarGarcom} className="inline-flex min-h-[44px] max-w-full items-center truncate rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold text-hf-text-2 shadow-none">{garcom}</button>
      </CabecalhoTela>
      <label className="relative mt-2 block">
        <span className="sr-only">Buscar mesa</span>
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" aria-hidden="true" />
        <input inputMode="numeric" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Número da mesa" className="h-12 w-full rounded-xl border border-hf-border bg-hf-surface pl-10 pr-3 text-base text-hf-text outline-none focus:border-hf-accent" />
      </label>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {lista.map((m) => {
          const p = porMesa.get(m.id);
          const e = estadoDaMesa(m, p);
          return (
            <li key={m.id}>
              <button type="button" disabled={ocupado} onClick={() => onAbrir(m)} className={`flex min-h-[112px] w-full flex-col rounded-2xl border-2 p-3 text-left disabled:opacity-60 ${COR[e.id]}`}>
                <span className="flex items-start justify-between gap-1">
                  <span className="text-3xl font-black leading-none text-hf-text">{numeroDaMesa(m)}</span>
                  {prontosDaComanda(p) > 0 && <span className="animate-pulse rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-black text-white">{prontosDaComanda(p)} pronto{prontosDaComanda(p) > 1 ? "s" : ""}</span>}
                </span>
                <span className="mt-auto text-sm font-bold text-hf-text">{e.rotulo}</span>
                {p && <span className="text-xs text-hf-text-2">{tempoDaMesa(p.created_at)} · {brl(totalDaComanda(p.pedidos_itens))}</span>}
                {p?.garcom_nome && <span className="truncate text-xs text-hf-text-2">{p.garcom_nome}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {!mesas.length && <p className="mt-3 text-sm text-hf-text-2">Nenhuma mesa cadastrada. O caixa cria as mesas na tela Caixa e mesas.</p>}
    </>
  );
}

// Item já enviado: situação, contagem regressiva até ficar pronto e "Servido".
function ItemEnviado({ item: i, agora, servir, ocupado }) {
  const s = situacaoDoItem(i, agora);
  const riscado = s.estado === "cancelado";
  return (
    <li className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${s.estado === "pronto" ? "border-emerald-500 bg-emerald-50" : "border-hf-border bg-hf-surface"} ${riscado ? "text-hf-muted line-through" : "text-hf-text"}`}>
      <span className="font-bold tabular-nums">{i.quantidade}×</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{i.produtos?.nome_produto || "Item"}</span>
        {(i.pessoa || i.observacao) && <span className="block truncate text-xs text-hf-text-2">{[i.pessoa, i.observacao].filter(Boolean).join(" · ")}</span>}
      </span>
      {(s.estado === "fila" || s.estado === "preparando") && (
        <span className={`shrink-0 rounded-lg px-2 py-1 text-right ${s.atrasado ? "bg-red-100 text-red-800" : "bg-hf-elevated text-hf-text"}`} aria-label={s.atrasado ? `Atrasado ${relogio(s.restanteSeg)}` : `Pronto em ${relogio(s.restanteSeg)}`}>
          <span className="block text-[10px] font-bold uppercase leading-tight">{s.atrasado ? "Atrasado" : s.estado === "preparando" ? "Preparando" : "Na fila"}</span>
          <span className="block font-black tabular-nums leading-tight">{s.atrasado ? "+" : ""}{relogio(s.restanteSeg)}</span>
        </span>
      )}
      {s.estado === "pronto" && (
        <button type="button" disabled={ocupado} onClick={servir} className="min-h-[44px] shrink-0 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-60">
          Pronto{s.prontoHaMin ? ` há ${s.prontoHaMin} min` : ""} · Servido
        </button>
      )}
      {s.estado === "servido" && <span className="shrink-0 text-xs font-semibold text-hf-text-2">Servido</span>}
      {riscado && <span className="shrink-0 text-xs font-semibold">{STATUS_DO_ITEM.cancelado || "Cancelado"}</span>}
    </li>
  );
}

// Som curto de aviso (sem arquivo: o navegador gera o tom).
function tocarAviso() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
    setTimeout(() => ctx.close(), 800);
  } catch { /* sem som */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* sem vibração */ }
}

function Comanda({ mesa, pedido, produtos, obsProntas, onVoltar, aoMudar }) {
  const [rascunho, setRascunho] = useState([]);
  const [extras, setExtras] = useState([]);
  const [pessoa, setPessoa] = useState("");
  const [novaPessoa, setNovaPessoa] = useState("");
  const [categoria, setCategoria] = useState("");
  const [busca, setBusca] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  const itens = useMemo(() => pedido?.pedidos_itens || [], [pedido]);
  const pessoas = pessoasDaComanda(itens, extras);
  const categorias = useMemo(() => [...new Set(produtos.map((p) => p.categoria || "Outros"))], [produtos]);
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return produtos.filter((p) => (termo ? semAcento(p.nome_produto).includes(termo) : !categoria || (p.categoria || "Outros") === categoria)).slice(0, 60);
  }, [produtos, busca, categoria]);
  const resumo = resumoPorPessoa(itens);
  const totalRascunho = rascunho.reduce((t, l) => t + l.valor_unitario * l.quantidade, 0);
  const pediuConta = mesa.status === "fechando";
  // Relógio da contagem regressiva: anda de segundo em segundo enquanto há item em preparo.
  const [agora, setAgora] = useState(() => Date.now());
  const emPreparo = itens.some((i) => ["pendente", "preparando", "em_preparo"].includes(i.status_kds || "pendente"));
  useEffect(() => {
    if (!emPreparo) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [emPreparo]);

  function incluirPessoa(e) {
    e.preventDefault();
    const nome = limparNome(novaPessoa);
    if (!nome) return;
    setExtras((l) => [...l, nome]); setPessoa(nome); setNovaPessoa("");
  }

  async function agir(acao) {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const r = await acao();
      if (r?.error) { setErro(r.error.includes("sem preço") ? r.error : "Não consegui salvar. Tente de novo."); return; }
      await aoMudar();
    } finally { setOcupado(false); }
  }
  const enviar = () => agir(async () => { const r = await enviarParaProducao(pedido.id, mesa.id, rascunho); if (!r.error) setRascunho([]); return r; });

  return (
    <div className="pb-24">
      <button type="button" onClick={onVoltar} className="flex min-h-[44px] items-center gap-2 text-sm font-bold text-hf-text-2"><ArrowLeft size={18} aria-hidden="true" />Mesas</button>
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-black text-hf-text">Mesa {numeroDaMesa(mesa)}</h1>
        <p className="text-sm font-bold tabular-nums text-hf-text">{brl(totalDaComanda(itens))}</p>
      </div>
      {pediuConta && <p className="mt-1 rounded-xl bg-hf-warning/15 px-3 py-2 text-sm font-bold text-hf-text">Conta pedida. O caixa já pode receber.</p>}
      {erro && <p role="alert" className="mt-2 text-sm font-bold text-hf-danger">{erro}</p>}

      <section aria-label="De quem é o pedido" className="mt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-hf-muted">Para quem</p>
        <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
          <button type="button" aria-pressed={!pessoa} className={chip(!pessoa)} onClick={() => setPessoa("")}>{MESA_TODA}</button>
          {pessoas.map((n) => <button key={n} type="button" aria-pressed={pessoa === n} className={chip(pessoa === n)} onClick={() => setPessoa(n)}>{n}</button>)}
        </div>
        <form onSubmit={incluirPessoa} className="mt-1 flex gap-2">
          <input value={novaPessoa} maxLength={40} onChange={(e) => setNovaPessoa(e.target.value)} placeholder="Nome de quem pediu" aria-label="Nome de quem pediu" className="h-11 min-w-0 flex-1 rounded-xl border border-hf-border bg-hf-surface px-3 text-base text-hf-text outline-none focus:border-hf-accent" />
          <button type="submit" aria-label="Incluir pessoa" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border bg-hf-surface text-hf-text"><Plus size={18} aria-hidden="true" /></button>
        </form>
      </section>

      <section aria-label="Cardápio" className="mt-4">
        <label className="relative block">
          <span className="sr-only">Buscar no cardápio</span>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" aria-hidden="true" />
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato ou bebida" className="h-12 w-full rounded-xl border border-hf-border bg-hf-surface pl-10 pr-3 text-base text-hf-text outline-none focus:border-hf-accent" />
        </label>
        {!busca.trim() && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            <button type="button" aria-pressed={!categoria} className={chip(!categoria)} onClick={() => setCategoria("")}>Tudo</button>
            {categorias.map((c) => <button key={c} type="button" aria-pressed={categoria === c} className={chip(categoria === c)} onClick={() => setCategoria(c)}>{c}</button>)}
          </div>
        )}
        <ul className="mt-2 divide-y divide-hf-border rounded-2xl border border-hf-border bg-hf-surface">
          {visiveis.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setRascunho((r) => somarAoRascunho(r, p, pessoa))} className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left">
                <span className="min-w-0 flex-1 break-words text-[15px] font-semibold text-hf-text">{p.nome_produto}</span>
                <span className="shrink-0 text-sm tabular-nums text-hf-text-2">{Number(p.preco_venda) > 0 ? brl(p.preco_venda) : "Sem preço"}</span>
                <Plus size={18} className="shrink-0 text-hf-text-2" aria-hidden="true" />
              </button>
            </li>
          ))}
          {!visiveis.length && <li className="p-3 text-sm text-hf-text-2">Nada encontrado no cardápio.</li>}
        </ul>
      </section>

      {itens.length > 0 && (
        <section aria-label="Já enviado" className="mt-4">
          <h2 className="text-sm font-black text-hf-text">Já enviado</h2>
          <ul className="mt-2 space-y-1.5">
            {itens.map((i) => <ItemEnviado key={i.id} item={i} agora={agora} servir={() => agir(() => marcarItemServido(i.id))} ocupado={ocupado} />)}
          </ul>
          {resumo.length > 1 && (
            <ul className="mt-3 rounded-xl border border-hf-border p-3 text-sm">
              {resumo.map((g) => <li key={g.pessoa} className="flex justify-between gap-3"><span className="truncate font-semibold text-hf-text">{g.pessoa}</span><span className="tabular-nums text-hf-text">{brl(g.total)}</span></li>)}
            </ul>
          )}
          <p className="mt-2 text-xs text-hf-text-2">Para cancelar item enviado, fale com o caixa.</p>
          <button type="button" disabled={ocupado} onClick={() => agir(() => pedirConta(mesa.id, !pediuConta))} className={`mt-3 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 font-bold disabled:opacity-60 ${pediuConta ? "border-hf-border text-hf-text-2" : "border-hf-warning text-hf-text"}`}>
            {pediuConta ? <><X size={18} aria-hidden="true" />Desfazer pedido de conta</> : <><Receipt size={18} aria-hidden="true" />Pedir a conta</>}
          </button>
        </section>
      )}

      {rascunho.length > 0 && (
        <section aria-label="Novo pedido" className="fixed inset-x-0 bottom-0 z-40 border-t border-hf-border bg-hf-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_20px_rgba(0,0,0,0.12)]">
          <div className="mx-auto max-w-3xl">
            <ul className="max-h-[32vh] space-y-1 overflow-y-auto">
              {rascunho.map((l) => (
                <li key={l.chave} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 gap-y-1 border-b border-hf-border pb-2 last:border-0">
                  <span className="min-w-0 text-sm font-semibold text-hf-text">{l.nome}{l.pessoa ? ` · ${l.pessoa}` : ""}</span>
                  <button type="button" aria-label={`Tirar um: ${l.nome}`} onClick={() => setRascunho((r) => mudarQuantidade(r, l.chave, -1))} className="grid h-11 w-11 place-items-center rounded-lg border border-hf-border text-hf-text"><Minus size={16} aria-hidden="true" /></button>
                  <span className="w-6 text-center font-black tabular-nums text-hf-text">{l.quantidade}</span>
                  <button type="button" aria-label={`Mais um: ${l.nome}`} onClick={() => setRascunho((r) => mudarQuantidade(r, l.chave, 1))} className="grid h-11 w-11 place-items-center rounded-lg border border-hf-border text-hf-text"><Plus size={16} aria-hidden="true" /></button>
                  {/* Observações prontas: um toque põe, outro toque tira. O texto digitado continua. */}
                  {observacoesDoProduto(obsProntas, l).length > 0 && (
                    <div className="col-span-4 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label={`Observações prontas: ${l.nome}`}>
                      {observacoesDoProduto(obsProntas, l).map((o) => {
                        const ativa = temObservacao(l.observacao, o);
                        return (
                          <button key={o} type="button" aria-pressed={ativa} onClick={() => setRascunho((r) => definirObservacao(r, l.chave, alternarObservacao(l.observacao, o)))}
                            className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-bold ${ativa ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-bg text-hf-text"}`}>{o}</button>
                        );
                      })}
                    </div>
                  )}
                  <input value={l.observacao} maxLength={120} aria-label={`Observação: ${l.nome}`} placeholder="Ou escreva a observação" onChange={(e) => setRascunho((r) => definirObservacao(r, l.chave, e.target.value))} className="col-span-4 h-10 w-full rounded-lg border border-hf-border bg-hf-bg px-3 text-base text-hf-text outline-none focus:border-hf-accent" />
                </li>
              ))}
            </ul>
            <button type="button" disabled={ocupado} onClick={enviar} className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-hf-accent font-bold text-hf-accent-fg disabled:opacity-60">
              <Send size={18} aria-hidden="true" />{ocupado ? "Enviando…" : `Enviar · ${brl(totalRascunho)}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function ComandasPage() {
  const { unidadeAtiva } = useERP();
  const [dados, setDados] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [obsProntas, setObsProntas] = useState(() => mesclarObservacoes(null));
  const [equipe, setEquipe] = useState([]);
  const [garcom, setGarcom] = useState("");
  const [mesaId, setMesaId] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  // Avisos de "pedido pronto" (07/11/2026): ficam na tela até o garçom ver.
  const [avisos, setAvisos] = useState([]);
  const vistos = useRef(null);
  const garcomRef = useRef("");
  garcomRef.current = garcom;

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    const r = await fetchSalao(unidadeAtiva);
    setErro(r.error ? "Não consegui atualizar as mesas." : null);
    if (r.error) return;
    setDados(r);
    const p = prontosNovos({ vistos: vistos.current || new Set(), pedidos: r.pedidos, mesas: r.mesas, garcom: garcomRef.current, primeiraLeitura: vistos.current === null });
    vistos.current = p.vistos;
    if (p.alertas.length) {
      setAvisos((a) => [...p.alertas, ...a].slice(0, 6));
      tocarAviso();
    }
  }, [unidadeAtiva]);
  useTempoReal(["pedidos_itens", "pedidos"], carregar); // pronto na cozinha aparece na hora

  useEffect(() => {
    if (!unidadeAtiva) return undefined;
    carregar();
    fetchCardapioDoSalao(unidadeAtiva).then((r) => setProdutos(r.data));
    fetchObservacoesProntas(unidadeAtiva).then((r) => setObsProntas(mesclarObservacoes(r?.data))).catch(() => {});
    fetchColaboradores(unidadeAtiva).then((r) => setEquipe(equipeParaEtiquetar(r.data)));
    try { setGarcom(localStorage.getItem(CHAVE_GARCOM) || ""); } catch { /* escolhe de novo */ }
    const t = setInterval(carregar, ATUALIZAR_MS);
    return () => clearInterval(t);
  }, [unidadeAtiva, carregar]);

  function escolherGarcom(nome) {
    setGarcom(nome);
    try { if (nome) localStorage.setItem(CHAVE_GARCOM, nome); else localStorage.removeItem(CHAVE_GARCOM); } catch { /* vale só nesta tela */ }
  }

  async function abrirMesa(mesa) {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const r = await abrirComandaDaMesa(unidadeAtiva, mesa, garcom);
      if (r.error) { setErro("Não consegui abrir a mesa. Tente de novo."); return; }
      await carregar();
      setMesaId(mesa.id);
    } finally { setOcupado(false); }
  }

  const mesa = dados?.mesas.find((m) => m.id === mesaId);
  const pedido = dados?.pedidos.find((p) => p.mesa_id === mesaId);

  return (
    <div className="min-h-full bg-hf-bg">
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 pt-4">
        {erro && <p role="alert" className="mb-2 text-sm font-bold text-hf-danger">{erro}</p>}
        {avisos.length > 0 && (
          <div role="alert" className="sticky top-2 z-30 mb-3 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-black text-emerald-900">Pedido pronto</p>
              <button type="button" onClick={() => setAvisos([])} aria-label="Fechar avisos" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-emerald-900 hover:bg-emerald-100">×</button>
            </div>
            <ul className="mt-1 space-y-1">
              {avisos.map((a) => (
                <li key={a.itemId}>
                  <button type="button" onClick={() => { setMesaId(a.mesaId); setAvisos((l) => l.filter((x) => x.mesaId !== a.mesaId)); }}
                    className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl bg-white px-3 text-left text-sm font-bold text-emerald-900">
                    <span className="truncate">{a.mesa}: {a.quantidade}× {a.nome}</span><span className="shrink-0 text-xs underline">Abrir mesa</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!garcom ? <EscolherGarcom equipe={equipe} onEscolher={escolherGarcom} />
          : !dados ? <p className="text-sm text-hf-muted">Carregando mesas…</p>
            : mesa && pedido ? <Comanda key={mesa.id} mesa={mesa} pedido={pedido} produtos={produtos} obsProntas={obsProntas} onVoltar={() => setMesaId(null)} aoMudar={carregar} />
              : <Mapa mesas={dados.mesas} pedidos={dados.pedidos} garcom={garcom} ocupado={ocupado} onTrocarGarcom={() => escolherGarcom("")} onAbrir={abrirMesa} />}
      </div>
    </div>
  );
}
