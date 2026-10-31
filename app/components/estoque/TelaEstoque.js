"use client";
// ESTOQUE EM UMA TELA (pedidos do dono, 27/10/2026: "ver todos os produtos,
// lançar e retirar com um toque, mínimo e máximo pelo ritmo" e "deixe uma
// coisa só, no estoque está cheio de páginas"). Todos os produtos de todos os
// locais; tocar no produto abre a movimentação (MovimentarEstoque fixo) por
// cima, sem sair da tela. Ritmo = REAL; sugestão = ESTIMATIVA; sem histórico
// suficiente = DADOS INSUFICIENTES. Regras em estoque-ritmo.mjs.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Loader2, Plus, Search, Settings2, Sparkles, X } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { unidadeValida } from "../../lib/contas-pagar.mjs";
import MovimentarEstoque from "./MovimentarEstoque";
import { hasPermission } from "../../lib/permissions-catalog.mjs";
import { carregarVisaoEstoque, salvarMinMax } from "../../lib/estoque-visao";
import { ESTADOS, locaisDeEstadoQueFaltam, destinoDoEstado, GRUPOS_ESTOQUE, grupoDoEstoque, rotuloDoGrupo } from "../../lib/estoque-areas.mjs";
import { salvarEstoque } from "../../lib/estoques-multiplos";
import { PADRAO_RITMO } from "../../lib/estoque-ritmo.mjs";
import { casaBusca } from "../../lib/busca.mjs";

const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
// ml e g grandes ficam ilegíveis (7.304 ml): mostra também em L/kg.
const MAIOR = { ml: "L", g: "kg" };
const emMaior = (n, un) => { const u = MAIOR[String(un || "").toLowerCase()]; return u && Math.abs(n) >= 1000 ? ` (${fmt(n / 1000)} ${u})` : ""; };
const AREAS = [["todas", "Todas"], ["cozinha", "Cozinha"], ["bar", "Bar"], ["salao", "Salão"], ["limpeza", "Limpeza"], ["embalagens", "Embalagens"], ["marmitaria", "Marmitaria"], ["outros", "Outros"]];
// Bar em garrafas/latas (pedido do dono, 28/10/2026): a linha traz `contagem`
// { nome, fator }; o banco segue em ml/L e aqui só se divide para mostrar.
const pluralEmb = (nome, n) => (Math.abs(n) === 1 ? nome : `${nome}s`);
const qtd = (l, n) => (l.contagem ? fmt(n / l.contagem.fator) : fmt(n));
const un = (l, n) => (l.contagem ? pluralEmb(l.contagem.nome, n / l.contagem.fator) : l.unidade);
// "24 latas de 350 ml" (pedido do dono, 28/10/2026): o conteúdo de cada embalagem, não o total em ml.
const extra = (l, n) => (l.contagem ? ` de ${fmt(l.contagem.fator)} ${l.unidade}` : emMaior(n, l.unidade));
const qtdNum = (l, n) => (l.contagem ? Math.round((Number(n) / l.contagem.fator) * 100) / 100 : n);
const paraBanco = (l, v) => (l.contagem && v !== "" && v != null ? Math.round(Number(v) * l.contagem.fator * 1000) / 1000 : v);
const COR = { zerado: "#B42318", baixo: "#B45309", acima: "#1D4ED8", ok: "#047857", parado: "#6B7280" };
const ROTULO = { zerado: "Acabou", baixo: "Abaixo do mínimo", acima: "Acima do máximo", ok: "Em dia", parado: "Sem uso" };
const ORDEM = { zerado: 0, baixo: 1, acima: 2, ok: 3, parado: 4 };
const CHAVE_REGRAS = "hefisto:estoque:regras-minmax";

function lerRegras(u) {
  try { const r = JSON.parse(localStorage.getItem(`${CHAVE_REGRAS}:${u}`) || "null"); return r && typeof r === "object" ? r : {}; } catch { return {}; }
}

export default function TelaEstoque({ inicial = {} }) {
  const { unidadeAtiva, sessao } = useERP();
  // Mínimo e máximo: quem só lança (cozinha) vê, mas não muda.
  const podeVerCusto = !sessao?.gerenciado || hasPermission(sessao, "estoque.overview.view_costs") || hasPermission(sessao, "estoque.overview.view_values");
  const podeMinMax = !sessao?.gerenciado || hasPermission(sessao, "estoque.all_products.edit") || hasPermission(sessao, "estoque.overview.edit");
  // Movimentação aberta por cima: { estoque, insumo, tipo } (produto) ou { livre: true } (outro produto/local).
  const [mov, setMov] = useState(inicial.estoque && inicial.insumo ? { estoque: inicial.estoque, insumo: inicial.insumo, tipo: inicial.tipo || "" } : null);
  const [linhas, setLinhas] = useState([]);
  const [estoques, setEstoques] = useState([]);
  const [estado, setEstado] = useState("todos");
  const [criandoLocais, setCriandoLocais] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [area, setArea] = useState(AREAS.some(([id]) => id === inicial.area) ? inicial.area : "todas");
  // Grupos (Hortifrúti, Carne vermelha, Suína… / Cervejas, Destilados…), pedido do dono, 30/10/2026.
  const [grupo, setGrupo] = useState("todos");
  useEffect(() => { setGrupo("todos"); }, [area]);
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
    setLinhas(r.linhas); setEstoques(r.estoques || []); setErro(r.erro || ""); setCarregando(false);
  }, [unidadeAtiva, regras]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (!mov) return;
    const esc = (e) => { if (e.key === "Escape") setMov(null); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [mov]);

  const mudarRegra = (k, v) => {
    const n = Math.max(0, Math.min(90, Math.round(Number(v) || 0)));
    const novo = { ...regras, [k]: n };
    setRegras(novo);
    try { localStorage.setItem(`${CHAVE_REGRAS}:${unidadeAtiva}`, JSON.stringify(novo)); } catch { /* segue */ }
  };
  // Cria os locais de abertos e do expositor (o dono toca; grava com a sessão dele).
  const faltam = useMemo(() => locaisDeEstadoQueFaltam(estoques), [estoques]);
  async function criarLocaisDeEstado() {
    setCriandoLocais(true);
    const erros = [];
    for (const d of faltam) {
      const r = await salvarEstoque({ unidade_id: unidadeAtiva, nome: d.nome, slug: d.slug, tipo: d.tipo, status: "ativo" });
      if (r.error) erros.push(`${d.nome}: ${r.error}`);
    }
    setCriandoLocais(false);
    avisar(erros.length ? `Não deu para criar: ${erros.join("; ")}` : "Locais criados: agora dá para abrir e gelar os produtos.");
    carregar();
  }
  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(""), 3500); };

  const comGrupo = useMemo(() => linhas.map((l) => (["cozinha", "bar"].includes(l.area) ? { ...l, grupo: grupoDoEstoque(l) } : l)), [linhas]);
  const temGrupos = area === "cozinha" || area === "bar";
  const contagemGrupos = useMemo(() => {
    const c = {};
    for (const l of comGrupo) if (l.area === area && (estado === "todos" || l.estado === estado)) c[l.grupo] = (c[l.grupo] || 0) + 1;
    return c;
  }, [comGrupo, area, estado]);
  const ordemGrupo = (l) => (temGrupos ? GRUPOS_ESTOQUE[area].findIndex((g) => g.id === l.grupo) : 0);
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return comGrupo.filter((l) => {
      if (area !== "todas" && l.area !== area) return false;
      if (estado !== "todos" && l.estado !== estado) return false;
      if (temGrupos && grupo !== "todos" && l.grupo !== grupo) return false;
      if (situacao === "sem_min" && l.minimo > 0) return false;
      if (situacao === "sugestao" && !(l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo))) return false;
      if (["zerado", "baixo", "acima", "parado"].includes(situacao) && l.situacao !== situacao) return false;
      return !q || casaBusca(`${l.nome} ${l.categoria} ${l.local}`, q);
    }).sort((a, b) => ordemGrupo(a) - ordemGrupo(b) || ORDEM[a.situacao] - ORDEM[b.situacao] || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [comGrupo, busca, area, situacao, estado, grupo, temGrupos]); // eslint-disable-line react-hooks/exhaustive-deps

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
    return <p className="p-8 text-center font-bold text-hf-text-2">Selecione uma unidade para ver o estoque.</p>;
  }
  const r = { ...PADRAO_RITMO, ...regras };
  const campoRegra = (k, rotulo) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-hf-text-2">
      {rotulo}
      <input type="number" min={0} max={90} value={r[k]} onChange={(e) => mudarRegra(k, e.target.value)} className="h-10 w-24 rounded-xl border border-hf-border bg-hf-surface px-3 text-base font-black text-hf-text" />
    </label>
  );

  return (
    <>
      <div className="mx-auto max-w-[1500px] space-y-4 px-3 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-hf-text-2">Toque no produto para retirar ou adicionar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
          <button onClick={() => setMov({ livre: true })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-hf-accent px-3 text-sm font-black text-white">
            <Plus size={16} /> Lançar outro produto
          </button>
          {podeMinMax && <button onClick={() => setVerRegras((v) => !v)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text">
            <Settings2 size={16} /> Mínimo e máximo
          </button>}
          </div>
        </div>

        {verRegras ? (
          <div className="rounded-2xl border border-hf-border bg-hf-surface p-4">
            {/* Texto simples (pedido do dono, 28/10/2026: "isso não entendi nada"). */}
            <p className="text-base font-black text-hf-text">Como o sistema sugere o mínimo e o máximo</p>
            <p className="mt-1 text-sm font-semibold text-hf-text-2">Responda 3 perguntas. O sistema olha quanto você retira de cada produto e calcula sozinho.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {campoRegra("prazoReposicaoDias", "Quantos dias o fornecedor leva para entregar?")}
              {campoRegra("segurancaDias", "Quantos dias a mais, por segurança?")}
              {campoRegra("intervaloCompraDias", "De quantos em quantos dias você compra?")}
            </div>
            <div className="mt-3 rounded-xl bg-hf-elevated p-3 text-sm font-semibold text-hf-text">
              <p><b>Exemplo:</b> sai 1 garrafa por dia.</p>
              <p className="mt-1">• <b>Mínimo: {r.prazoReposicaoDias + r.segurancaDias} garrafas</b> — o suficiente para esperar a entrega ({r.prazoReposicaoDias} dias) e mais {r.segurancaDias} de segurança. Chegou no mínimo, é hora de comprar.</p>
              <p className="mt-1">• <b>Máximo: {r.prazoReposicaoDias + r.segurancaDias + r.intervaloCompraDias} garrafas</b> — o mínimo mais o que sai até a próxima compra ({r.intervaloCompraDias} dias). Compre até chegar nele.</p>
            </div>
            <p className="mt-2 text-xs font-semibold text-hf-text-2">A conta usa as retiradas dos últimos {r.janelaDias} dias. Produto novo ou quase sem uso fica sem sugestão até ter histórico.</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Produtos nos locais", resumo.total, "text-hf-text", "todas"], ["Acabou", resumo.zerado, resumo.zerado ? "text-[#B42318]" : "text-[#047857]", "zerado"], ["Abaixo do mínimo", resumo.baixo, resumo.baixo ? "text-[#B45309]" : "text-[#047857]", "baixo"], ["Com sugestão nova", resumo.comSugestao, "text-hf-text", "sugestao"]].map(([rot, v, cor, s]) => (
            <button key={rot} onClick={() => setSituacao(situacao === s ? "todas" : s)} className={`rounded-2xl border bg-hf-surface px-3 py-2.5 text-left ${situacao === s ? "border-hf-accent" : "border-hf-border"}`}>
              <p className={`text-2xl font-black leading-none ${cor}`}>{v}</p>
              <p className="mt-1 text-xs font-bold text-hf-text-2">{rot}</p>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-text-2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto, categoria ou local…" className="h-12 w-full rounded-2xl border border-zinc-300 bg-zinc-100 pl-10 pr-10 font-semibold text-hf-text placeholder:text-zinc-500 focus:bg-hf-surface" />
            {busca ? <button onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2"><X size={18} /></button> : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {AREAS.map(([id, rot]) => <button key={id} onClick={() => setArea(id)} aria-pressed={area === id} className={`h-9 shrink-0 rounded-full border px-3 text-sm font-bold ${area === id ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text"}`}>{rot}</button>)}
          </div>
          {["todas", "cozinha", "bar"].includes(area) && (
            <div className="flex flex-wrap items-center gap-2">
              {[["todos", "Fechados e abertos"], ...ESTADOS.filter((e) => area !== "cozinha" || e.id !== "gelada").map((e) => [e.id, e.rotulo])].map(([id, rot]) => (
                <button key={id} onClick={() => setEstado(id)} aria-pressed={estado === id} className={`h-9 shrink-0 rounded-full border px-3 text-sm font-bold ${estado === id ? "border-hf-text bg-hf-elevated text-hf-text" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{rot}</button>
              ))}
              {podeMinMax && faltam.length > 0 && (
                <button onClick={criarLocaisDeEstado} disabled={criandoLocais} className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-hf-accent px-3 text-sm font-bold text-hf-accent disabled:opacity-60">
                  {criandoLocais ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar locais: {faltam.map((d) => d.nome).join(", ")}
                </button>
              )}
            </div>
          )}
          {temGrupos && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {[["todos", "Todas as categorias", Object.values(contagemGrupos).reduce((a, b) => a + b, 0)], ...GRUPOS_ESTOQUE[area].filter((g) => contagemGrupos[g.id]).map((g) => [g.id, g.rotulo, contagemGrupos[g.id]])].map(([id, rot, n]) => (
                <button key={id} onClick={() => setGrupo(id)} aria-pressed={grupo === id} className={`h-9 shrink-0 rounded-xl border px-3 text-sm font-bold ${grupo === id ? "border-hf-accent bg-hf-accent/10 text-hf-accent" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>
                  {rot} <span className="ml-0.5 text-xs opacity-70">{n}</span>
                </button>
              ))}
            </div>
          )}
          {/* Sem a fileira de situações (pedido do dono, 28/10/2026: "tira isso"); os quadros de cima filtram. */}
        </div>

        {aviso ? <p role="status" className="rounded-xl bg-hf-elevated px-3 py-2 text-sm font-bold text-hf-text">{aviso}</p> : null}

        {filtradas.some((l) => l.sugestao.ok && (l.sugestao.minimo !== l.minimo || l.sugestao.maximo !== l.maximo)) ? (
          podeMinMax && <button onClick={aplicarTodas} disabled={!!salvando} className="inline-flex h-11 items-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-black text-white disabled:opacity-60">
            {salvando === "todas" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Usar a sugestão em todos da lista
          </button>
        ) : null}

        {erro ? <p className="rounded-xl bg-red-50 p-4 font-bold text-red-800">{erro}</p> : carregando ? (
          <p className="p-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Calculando o ritmo do estoque…</p>
        ) : !filtradas.length ? (
          <p className="p-8 text-center font-bold text-hf-text-2">Nenhum produto nesta seleção.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtradas.map((l, i) => {
              const titulo = temGrupos && grupo === "todos" && (i === 0 || filtradas[i - 1].grupo !== l.grupo)
                ? <li key={`g-${l.grupo}`} className="col-span-full pt-2 text-sm font-black uppercase tracking-wide text-hf-text-2">{rotuloDoGrupo(area, l.grupo)}</li> : null;
              const ed = edicao[l.id];
              const s = l.sugestao;
              const temNova = s.ok && (s.minimo !== l.minimo || s.maximo !== l.maximo);
              return (
                <Fragment key={l.id}>{titulo}
                <li className="rounded-2xl border border-hf-border bg-hf-surface p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <button type="button" onClick={() => setMov({ estoque: l.estoque_id, insumo: l.insumo_id, tipo: "" })} className="min-w-0 text-left">
                      <p className="text-xs font-bold uppercase tracking-wide text-hf-text-2">{l.local}{l.grupo ? ` · ${rotuloDoGrupo(l.area, l.grupo)}` : l.categoria ? ` · ${l.categoria}` : ""}{l.estado ? <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-black ${l.estado === "gelada" ? "bg-sky-100 text-sky-800" : l.estado === "aberto" ? "bg-amber-100 text-amber-800" : "bg-hf-elevated text-hf-text-2"}`}>{l.estado === "gelada" ? "Gelada" : l.estado === "aberto" ? "Aberto" : "Fechado"}</span> : null}</p>
                      <p className="font-black leading-tight text-hf-text underline-offset-2 hover:underline">{l.nome}</p>
                    </button>
                    <span className="shrink-0 rounded-lg bg-hf-elevated px-2 py-1 text-[11px] font-black uppercase" style={{ color: COR[l.situacao] }}>{ROTULO[l.situacao]}</span>
                  </div>

                  <div className="mt-3 flex items-end justify-between gap-3">
                    <p className="text-3xl font-black leading-none" style={{ color: COR[l.situacao] }}>{qtd(l, l.saldo)} <span className="text-sm font-bold text-hf-text-2">{un(l, l.saldo)}{extra(l, l.saldo)}</span></p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setMov({ estoque: l.estoque_id, insumo: l.insumo_id, tipo: "saida" })} aria-label={`Retirar ${l.nome}`} className="inline-flex h-11 items-center gap-1 rounded-xl border-2 border-[#B45309] bg-[#FFF4E5] px-3 text-sm font-black text-[#8A3A06] shadow-sm"><ArrowUpFromLine size={16} /> Retirar</button>
                      <button type="button" onClick={() => setMov({ estoque: l.estoque_id, insumo: l.insumo_id, tipo: "entrada" })} aria-label={`Adicionar ${l.nome}`} className="inline-flex h-11 items-center gap-1 rounded-xl bg-hf-accent px-3 text-sm font-black text-white"><ArrowDownToLine size={16} /> Adicionar</button>
                    </div>
                  </div>
                  {l.estado === "fechado" && l.saldo > 0 && (() => {
                    const origem = estoques.find((e) => e.id === l.estoque_id);
                    const ab = destinoDoEstado(estoques, origem, "aberto");
                    const gel = l.area === "bar" ? destinoDoEstado(estoques, origem, "gelada") : null;
                    if (!ab && !gel) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ab && <button type="button" onClick={() => setMov({ estoque: l.estoque_id, insumo: l.insumo_id, tipo: "transferencia", destino: ab.id })} className="h-9 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-bold text-amber-900">Abrir → {ab.nome}</button>}
                        {gel && <button type="button" onClick={() => setMov({ estoque: l.estoque_id, insumo: l.insumo_id, tipo: "transferencia", destino: gel.id })} className="h-9 rounded-xl border border-sky-300 bg-sky-50 px-3 text-sm font-bold text-sky-900">Gelar → Expositor</button>}
                      </div>
                    );
                  })()}

                  {/* Valor de 1 produto e do saldo (pedido do dono, 28/10/2026), no lugar do
                      ritmo por dia. Custo do cadastro: ESTIMATIVA. */}
                  {/* Card mais limpo (pedido do dono, 28/10/2026: "melhore essas telas"):
                      valor numa linha; mínimo/máximo em texto com "Editar". */}
                  {podeVerCusto ? (
                    <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-xl bg-hf-elevated px-3 py-2 text-sm font-semibold text-hf-text-2">
                      {l.valor ? <>
                        <span><b className="text-base font-black text-hf-text">{brl(l.valor.unitario)}</b> {l.valor.unidade === "garrafa" || l.valor.unidade === "lata" || l.contagem ? `a ${l.valor.unidade}` : `o ${l.valor.unidade}`}</span>
                        <span><b className="text-base font-black text-hf-text">{brl(l.valor.total)}</b> no estoque</span>
                      </> : <span>Sem preço no cadastro</span>}
                    </p>
                  ) : null}
                  {l.cobertura != null ? <p className="mt-2 text-sm font-bold text-hf-text-2">Dá para <span className="text-hf-text">{l.cobertura} dia(s)</span> no ritmo atual.</p> : null}

                  <div className="mt-3 border-t border-hf-border pt-3">
                    {podeMinMax && ed ? (
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-hf-text-2">Mínimo
                          <input type="number" min={0} step="any" autoFocus value={ed.minimo ?? ""} onChange={(e) => setEdicao((x) => ({ ...x, [l.id]: { ...x[l.id], minimo: e.target.value } }))} className="h-10 w-24 rounded-xl border border-hf-border bg-hf-surface px-2 text-base font-black text-hf-text" placeholder="0" />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] font-black uppercase text-hf-text-2">Máximo
                          <input type="number" min={0} step="any" value={ed.maximo ?? ""} onChange={(e) => setEdicao((x) => ({ ...x, [l.id]: { ...x[l.id], maximo: e.target.value } }))} className="h-10 w-24 rounded-xl border border-hf-border bg-hf-surface px-2 text-base font-black text-hf-text" placeholder="0" />
                        </label>
                        <span className="pb-2.5 text-sm font-bold text-hf-text-2">{un(l, 2 * (l.contagem?.fator || 1))}</span>
                        <button onClick={() => salvar([{ id: l.id, minimo: paraBanco(l, ed.minimo), maximo: paraBanco(l, ed.maximo) }], l.id)} disabled={salvando === l.id} className="inline-flex h-10 items-center gap-1 rounded-xl bg-hf-accent px-3 text-sm font-black text-white"><Check size={16} /> Salvar</button>
                        <button onClick={() => setEdicao((x) => { const n = { ...x }; delete n[l.id]; return n; })} className="h-10 rounded-xl px-2 text-sm font-bold text-hf-text-2">Cancelar</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-hf-text-2">Mínimo <b className="text-hf-text">{l.minimo ? qtd(l, l.minimo) : "—"}</b> · Máximo <b className="text-hf-text">{l.maximo ? qtd(l, l.maximo) : "—"}</b> {(l.minimo || l.maximo) ? un(l, 2 * (l.contagem?.fator || 1)) : ""}</p>
                        {podeMinMax ? <button onClick={() => setEdicao((x) => ({ ...x, [l.id]: { minimo: l.minimo ? qtdNum(l, l.minimo) : "", maximo: l.maximo ? qtdNum(l, l.maximo) : "" } }))} className="h-9 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-bold text-hf-text">Editar</button> : null}
                      </div>
                    )}
                    {s.ok ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-hf-text-2"><span className="font-black text-hf-text">Sugestão:</span> mínimo {qtd(l, s.minimo)}, máximo {qtd(l, s.maximo)} {un(l, s.maximo)} <span className="text-xs">(sai {qtd(l, l.ritmo.saida.dia)} por dia)</span></p>
                        {temNova && podeMinMax ? <button onClick={() => salvar([{ id: l.id, minimo: s.minimo, maximo: s.maximo }], l.id)} disabled={salvando === l.id} className="inline-flex h-9 items-center gap-1 rounded-xl border border-hf-accent px-3 text-sm font-black text-hf-text"><Sparkles size={14} /> Usar</button> : <span className="text-xs font-black text-[#047857]">Já usa a sugestão</span>}
                      </div>
                    ) : <p className="mt-1.5 text-xs font-semibold text-hf-muted" title={s.motivo}>Dados insuficientes para sugerir: {String(s.motivo || "").replace(/ neste local\.?$/, "").toLowerCase()}.</p>}
                  </div>
                </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </div>

      {mov ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) setMov(null); }}>
          <div role="dialog" aria-modal="true" aria-label="Movimentar produto" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-hf-bg pt-3 shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between px-4 pb-1">
              <p className="text-sm font-black text-hf-text">{mov.livre ? "Lançar outro produto" : "Retirar ou adicionar"}</p>
              <button type="button" onClick={() => setMov(null)} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-full text-hf-text-2 hover:bg-hf-elevated"><X size={20} /></button>
            </div>
            <MovimentarEstoque key={JSON.stringify(mov)} unidade={unidadeAtiva} sessao={sessao} fixo={!mov.livre}
              inicial={mov.livre ? { area: area === "todas" ? "" : area } : { estoque: mov.estoque, insumo: mov.insumo, tipo: mov.tipo, destino: mov.destino }}
              onFeito={() => carregar()} />
          </div>
        </div>
      ) : null}
    </>
  );
}
