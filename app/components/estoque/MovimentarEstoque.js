"use client";

// TELA ÚNICA DO ESTOQUE (HDEV-EST-001): é o que abre em Operacional → Estoque.
// Ordem: 1. Área (e local) · 2. Busca · 3. toca no produto e escolhe Retirar
// ou Adicionar (pedido do dono, 27/10/2026: a escolha saiu do topo e foi para
// o produto) · 4. Quantidade + motivo + confirmar. Local e unidade vêm preenchidos; o resto
// (validade, observação, quem lançou) fica em "Mais opções".
//
// Unidade: o produto é contado como na prateleira (garrafa, pacote) e a tela
// converte para a unidade do saldo com o fator à mostra (estoque-unidades.mjs).
// "24" com "garrafa" = 24 garrafas = 7.920 ml; nunca 24 ml.
//
// Toda escrita vai pelo banco: estoque_movimentar (entrada/retirada, sem
// duplicar pela chave) e estoque_transferir (sai da origem e entra no destino
// numa operação só). Compra entra pelo módulo Compras: aqui não há "Compra".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchBaseMovimento, fetchUltimosMovimentos, lancarMovimento, transferirLancamento, lerSeguranca, MSG_BANCO_DESATUALIZADO,
} from "../../lib/estoque-movimento-dados";
import { MOTIVOS, rotuloMotivo, unidadesDaFracao, produtosParaLancar, saldoDepois, podeEstornar, novaChave, unidadeDoSaldo } from "../../lib/estoque-movimento.mjs";
import { quantidadeDoMovimento, unidadeOperacional, unidadeDeCompra, saldoOperacional, perfilUnidades } from "../../lib/estoque-unidades.mjs";
import { areasComLocais, areaDoLocal, subareaDoLocal, categoriaNaArea } from "../../lib/estoque-areas.mjs";
import { tiposCompativeis } from "../../lib/estoques-multiplos-utils.mjs";
import { useContextoInteligencia } from "../intelligence/useContextoInteligencia";
import ModalEstorno, { fmtHora } from "./ModalEstorno";
import { AlertTriangle, ArrowLeftRight, Check, ChevronDown, Loader2, Lock, Minus, Plus, RotateCcw, Search, X } from "lucide-react";

const fmtQ = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const CHAVE_LOCAL = "hefisto:estoque:local";
const FORM_VAZIO = { qtd: "", unidade: "", motivo: "", destino: "", validade: "", observacao: "", responsavel: "", justificativa: "", pin: "" };
const SUB = { principal: "Principal", preparo: "Pré-preparos", embalagens: "Embalagens" };

function lerLocal(unidade) { try { return localStorage.getItem(`${CHAVE_LOCAL}:${unidade}`) || ""; } catch { return ""; } }
function gravarLocal(unidade, id) { try { localStorage.setItem(`${CHAVE_LOCAL}:${unidade}`, id); } catch { /* sem armazenamento */ } }

/** Lançamento a partir do que foi digitado na unidade escolhida. */
function montarLancamento(produto, qtd, unidade) {
  if (!produto || String(qtd).trim() === "") return null;
  const compra = unidadeDeCompra(produto);
  const op = unidadeOperacional(produto);
  if (compra && unidade === compra.nome) return quantidadeDoMovimento({ insumo: produto, compras: qtd });
  if (op.embalagem && unidade === op.nome) return quantidadeDoMovimento({ insumo: produto, embalagens: qtd });
  return quantidadeDoMovimento({ insumo: produto, fracao: qtd, unidadeFracao: unidade });
}

/** Unidades oferecidas: caixa (se o cadastro tiver), a embalagem e as da fração (kg/g, L/ml). */
function unidadesDoProduto(produto) {
  if (!produto) return [];
  const compra = unidadeDeCompra(produto);
  const op = unidadeOperacional(produto);
  const lista = [];
  if (compra) lista.push(compra.nome);
  if (op.embalagem) lista.push(op.nome);
  for (const u of unidadesDaFracao(produto)) if (!lista.includes(u)) lista.push(u);
  return lista;
}

export default function MovimentarEstoque({ unidade, sessao, inicial = {} }) {
  const [base, setBase] = useState(null);
  const [seg, setSeg] = useState(null);
  const [segErro, setSegErro] = useState("");
  const [erro, setErro] = useState("");
  // "" = produto escolhido, mas ainda sem dizer se retira ou adiciona.
  const [tipo, setTipo] = useState(inicial.tipo === "saida" || inicial.tipo === "transferencia" ? "saida" : inicial.tipo === "entrada" ? "entrada" : "");
  const [area, setArea] = useState("");
  const [estoqueId, setEstoqueId] = useState("");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [produto, setProduto] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [maisOpcoes, setMaisOpcoes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [ultimos, setUltimos] = useState({ data: [], estornados: new Set() });
  const [estorno, setEstorno] = useState(null);
  const chave = useRef(novaChave());
  const buscaRef = useRef(null);
  useContextoInteligencia(produto ? { modulo: "estoque", tipo: "produto", id: produto.id, nome: produto.nome } : null);

  const carregarBase = useCallback(async () => {
    const b = await fetchBaseMovimento(unidade);
    setBase(b.data); setErro(b.error || "");
    const estoques = b.data?.estoques || [];
    if (!estoques.length) return;
    setEstoqueId((atual) => {
      if (atual && estoques.some((e) => e.id === atual)) return atual;
      const daArea = inicial.area && !inicial.estoque ? areasComLocais(estoques).find((g) => g.id === inicial.area)?.locais?.[0] : null;
      const salvo = inicial.estoque || daArea?.id || lerLocal(unidade);
      const escolhido = estoques.find((e) => e.id === salvo) || estoques[0];
      setArea(areaDoLocal(escolhido));
      return escolhido.id;
    });
  }, [unidade]); // eslint-disable-line react-hooks/exhaustive-deps
  const carregarUltimos = useCallback(async () => {
    if (!estoqueId) return;
    const r = await fetchUltimosMovimentos(unidade, estoqueId, 5);
    setUltimos({ data: r.data, estornados: r.estornados, desatualizado: r.desatualizado, error: r.error });
  }, [unidade, estoqueId]);

  useEffect(() => { carregarBase(); }, [carregarBase]);
  useEffect(() => { carregarUltimos(); }, [carregarUltimos]);
  useEffect(() => { lerSeguranca(unidade).then((r) => { setSeg(r.data); setSegErro(r.error || ""); }); }, [unidade]);
  useEffect(() => { if (estoqueId) gravarLocal(unidade, estoqueId); }, [unidade, estoqueId]);

  // ?insumo=<id> abre direto no produto; ?tipo=transferencia já escolhe o motivo
  const inicialAplicado = useRef(false);
  useEffect(() => {
    if (inicialAplicado.current || !base?.insumos) return;
    inicialAplicado.current = true;
    const ins = inicial.insumo && base.insumos.find((i) => i.id === inicial.insumo);
    if (ins) escolher(ins, inicial.tipo === "transferencia" ? "transferencia_enviada" : "", tipo);
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  const areas = useMemo(() => areasComLocais(base?.estoques), [base]);
  const areaAtual = areas.find((a) => a.id === area);
  const estoque = base?.estoques?.find((e) => e.id === estoqueId);
  const itemAtual = produto ? base?.itens?.find((i) => i.estoque_id === estoqueId && i.insumo_id === produto.id) : null;
  const saldoAtual = Number(itemAtual?.quantidade_atual) || 0;

  const resultados = useMemo(() => {
    if (!base || !estoqueId || produto) return [];
    // Lista de entrada: o que está no local e, buscando, o cadastro todo (o tipo vem depois).
    const lista = produtosParaLancar({ insumos: base.insumos, itens: base.itens, estoqueId, tipo: "entrada", termo: busca, limite: 80 });
    return categoria ? lista.filter((p) => categoriaNaArea(p.insumo, area) === categoria) : lista;
  }, [base, estoqueId, busca, produto, categoria, area]);
  const categoriasPresentes = useMemo(() => {
    if (!base || !estoqueId || !areaAtual) return [];
    const doLocal = produtosParaLancar({ insumos: base.insumos, itens: base.itens, estoqueId, tipo: "saida", termo: "", limite: 2000 });
    const tem = new Set(doLocal.map((p) => categoriaNaArea(p.insumo, area)).filter(Boolean));
    return areaAtual.categorias.filter((c) => tem.has(c));
  }, [base, estoqueId, area, areaAtual]);

  const unidades = unidadesDoProduto(produto);
  const unidadeSel = form.unidade || unidades[0] || "";
  const lanc = montarLancamento(produto, form.qtd, unidadeSel);
  const depois = lanc && !lanc.erro ? saldoDepois(saldoAtual, tipo, lanc.quantidadeSaldo) : null;
  const motivoSel = tipo ? MOTIVOS[tipo].find((m) => m.codigo === form.motivo) : null;
  const ehTransferencia = tipo === "saida" && form.motivo === "transferencia_enviada";
  const destinos = (base?.estoques || []).filter((e) => e.id !== estoqueId && tiposCompativeis(estoque?.tipo, e.tipo));
  const semPermissao = seg && tipo && (tipo === "entrada" ? !seg.pode_entrada : !seg.pode_retirada) && !motivoSel?.admin;
  const bancoAntigo = /EST-MOV/.test(segErro);
  const pronto = produto && lanc && !lanc.erro && motivoSel && !(depois < 0)
    && (!ehTransferencia || form.destino)
    && (!motivoSel.admin || (form.justificativa.trim().length >= 3 && /^\d{4,8}$/.test(form.pin)));

  function escolher(ins, motivo = "", tipoInicial = "") {
    setProduto(ins);
    setTipo(tipoInicial);
    setForm({ ...FORM_VAZIO, motivo, unidade: unidadesDoProduto(ins)[unidadeDeCompra(ins) ? 1 : 0] || "" });
    if (motivo === "transferencia_enviada") setTipo("saida");
    setMaisOpcoes(false);
    chave.current = novaChave();
    setAviso(null);
  }
  const limpar = () => { setProduto(null); setTipo(""); setForm(FORM_VAZIO); setBusca(""); chave.current = novaChave(); setTimeout(() => buscaRef.current?.focus(), 50); };
  const trocarTipo = (t) => { setTipo(t); setForm((f) => ({ ...f, motivo: "", destino: "" })); setAviso(null); };
  const trocarLocal = (id) => { setEstoqueId(id); setProduto(null); setCategoria(""); setAviso(null); };
  const trocarArea = (a) => {
    setArea(a); setCategoria(""); setProduto(null); setAviso(null);
    const g = areas.find((x) => x.id === a);
    if (g?.locais?.length) setEstoqueId(g.locais[0].id);
  };

  const confirmar = async () => {
    if (!pronto || enviando) return;
    setEnviando(true); setAviso(null);
    const r = ehTransferencia
      ? await transferirLancamento({ unidade_id: unidade, origem_id: estoqueId, destino_id: form.destino, insumo_id: produto.id,
          quantidade: lanc.quantidadeSaldo, observacao: form.observacao || lanc.texto, responsavel_nome: form.responsavel, chave: chave.current })
      : await lancarMovimento({ unidade_id: unidade, estoque_id: estoqueId, insumo_id: produto.id, tipo, motivo: form.motivo, lancamento: lanc,
          validade: form.validade || null, observacao: form.observacao, responsavel_nome: form.responsavel,
          chave: chave.current, pin: form.pin, justificativa: form.justificativa });
    setEnviando(false);
    if (r.error) {
      setAviso({ tipo: "erro", texto: r.error });
      if (r.pin) setForm((f) => ({ ...f, pin: "" }));
      return;
    }
    const saldoNovo = ehTransferencia ? r.data?.saldo_origem : r.data?.saldo_posterior;
    const destinoNome = ehTransferencia ? base.estoques.find((e) => e.id === form.destino)?.nome : "";
    setAviso({ tipo: "ok", texto: ehTransferencia
      ? `Transferência de ${lanc.texto} de ${produto.nome}: ${estoque?.nome} → ${destinoNome}. Saldo em ${estoque?.nome}: ${saldoOperacional(produto, saldoNovo)}.`
      : `${tipo === "entrada" ? "Entrada" : "Retirada"} de ${lanc.texto} de ${produto.nome} registrada. Saldo em ${estoque?.nome}: ${saldoOperacional(produto, saldoNovo)}.` });
    limpar();
    await Promise.all([carregarBase(), carregarUltimos()]);
  };

  if (!base && !erro) {
    return (
      <div className="mx-auto max-w-xl space-y-4 px-3 pb-28 pt-4 sm:px-4">
        <div className="h-14 animate-pulse rounded-2xl bg-zinc-200/60" />
        <div className="h-10 animate-pulse rounded-xl bg-zinc-200/50" />
        <div className="h-48 animate-pulse rounded-2xl bg-zinc-200/40" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4 px-3 pb-28 pt-4 text-hf-text sm:px-4">
      {erro && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs sm:text-sm font-bold text-rose-800 shadow-xs">
          Não foi possível sincronizar: {erro}
        </div>
      )}
      {bancoAntigo && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs sm:text-sm font-bold text-amber-800 shadow-xs">
          {MSG_BANCO_DESATUALIZADO}
        </div>
      )}

      {/* 2. Área e local */}
      <div className="space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {areas.map((a) => (
            <button key={a.id} onClick={() => trocarArea(a.id)} aria-pressed={area === a.id}
              className={`h-10 shrink-0 rounded-xl border px-3.5 text-sm font-bold ${area === a.id ? "border-hf-text bg-hf-text text-hf-surface" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>
              {a.rotulo}
            </button>
          ))}
        </div>
        {areaAtual && areaAtual.locais.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {areaAtual.locais.map((l) => (
              <button key={l.id} onClick={() => trocarLocal(l.id)} aria-pressed={estoqueId === l.id}
                className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-bold ${estoqueId === l.id ? "border-hf-accent bg-hf-accent/10 text-hf-accent" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>
                {area === "outros" ? l.nome : SUB[subareaDoLocal(l)]}
              </button>
            ))}
          </div>
        )}
        {areaAtual && !areaAtual.locais.length && (
          <p className="rounded-xl border border-hf-border bg-hf-surface p-3 text-sm text-hf-text-2">
            {areaAtual.rotulo} ainda não tem local de estoque. Crie em <Link href="/dashboard/operacao/estoque/painel/produtos" className="font-bold text-hf-accent underline">Produtos e locais</Link>.
          </p>
        )}
      </div>

      {aviso && (
        <div role="status" className={`flex gap-2 rounded-2xl border p-3 text-sm font-bold ${aviso.tipo === "ok" ? "border-hf-success/30 bg-hf-success/10 text-hf-success" : "border-hf-danger/30 bg-hf-danger/10 text-hf-danger"}`}>
          {aviso.tipo === "ok" ? <Check size={18} className="shrink-0" /> : <AlertTriangle size={18} className="shrink-0" />}
          <span>{aviso.texto}</span>
        </div>
      )}

      {/* 3. Busca */}
      {!produto && estoque && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-hf-surface shadow-card">
          <div className="flex items-center gap-2 border-b border-zinc-200/80 px-3.5">
            <Search size={18} className="shrink-0 text-zinc-400" />
            <input ref={buscaRef} value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
              placeholder="Buscar produto (nome, código, marca)"
              aria-label="Buscar produto" className="h-12 min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:font-medium placeholder:text-zinc-400 text-hf-text" />
            {busca && <button onClick={() => setBusca("")} aria-label="Limpar busca" className="grid h-10 w-10 place-items-center text-zinc-400 hover:text-zinc-600"><X size={18} /></button>}
          </div>
          {categoriasPresentes.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-200/80 px-3 py-2 [scrollbar-width:none]">
              {["", ...categoriasPresentes].map((c) => (
                <button key={c || "todas"} onClick={() => setCategoria(c)} aria-pressed={categoria === c}
                  className={`h-8 shrink-0 rounded-full px-3 text-xs font-bold transition-all ${categoria === c ? "bg-hf-text text-hf-surface shadow-xs" : "bg-zinc-100 text-hf-text-2 hover:bg-zinc-200/70"}`}>
                  {c || "Todas"}
                </button>
              ))}
            </div>
          )}
          <ul className="max-h-[60vh] divide-y divide-zinc-100 overflow-y-auto">
            {!resultados.length && (
              <li className="p-5 text-center text-xs sm:text-sm font-medium text-hf-text-2">
                {busca ? "Nenhum produto no cadastro com esse nome." : "Nenhum produto neste local ainda. Busque no cadastro."}
              </li>
            )}
            {resultados.map((p) => {
              return (
                <li key={p.insumo.id}>
                  <button onClick={() => escolher(p.insumo)} className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-emerald-50/40">
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-hf-text leading-tight">{p.insumo.nome}</span>
                      <span className="block truncate text-xs text-hf-text-2 mt-0.5">
                        {[p.insumo.marca, !p.vinculado && "novo neste local"].filter(Boolean).join(" · ") || " "}
                      </span>
                    </span>
                    <span className={`shrink-0 text-right text-sm font-black ${p.saldo > 0 ? "text-hf-text" : "text-zinc-400"}`}>{saldoOperacional(p.insumo, p.saldo)}</span>
                  </button>
                </li>);
            })}
          </ul>
        </div>
      )}

      {/* 4. Saldo + 5. registro */}
      {produto && (
        <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-hf-surface p-4 sm:p-5 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wide text-hf-text-2">{estoque?.nome}</span>
              <p className="mt-1.5 text-lg font-black leading-tight">{produto.nome}</p>
              <p className="mt-1 text-sm">Saldo aqui: <b>{saldoOperacional(produto, saldoAtual)}</b>
                {unidadeOperacional(produto).embalagem && <span className="text-hf-muted"> ({fmtQ(saldoAtual)} {unidadeDoSaldo(produto)})</span>}
              </p>
              {perfilUnidades(produto).fatores.length > 0 && <p className="text-xs text-hf-muted">{perfilUnidades(produto).fatores.join(" · ")}</p>}
            </div>
            <button onClick={limpar} className="h-9 shrink-0 rounded-lg bg-hf-elevated px-3 text-xs font-bold text-hf-text-2">Trocar</button>
          </div>

          {/* Retirar ou adicionar: escolhido no produto */}
          <div role="radiogroup" aria-label="Retirar ou adicionar" className="grid grid-cols-2 gap-2">
            {[["saida", ehTransferencia ? "Transferir" : "Retirar", ehTransferencia ? ArrowLeftRight : Minus], ["entrada", "Adicionar", Plus]].map(([t, rot, Icone]) => (
              <button key={t} role="radio" aria-checked={tipo === t} onClick={() => trocarTipo(t)}
                className={`flex h-14 items-center justify-center gap-2 rounded-2xl border text-base font-black transition-all active:scale-[0.98] ${tipo === t ? (t === "entrada" ? "border-hf-accent bg-hf-accent text-hf-accent-fg shadow-sm" : "border-hf-text bg-hf-text text-hf-surface shadow-sm") : "border-hf-border bg-hf-surface text-hf-text hover:bg-hf-elevated"}`}>
                <Icone size={20} /> {rot}
              </button>
            ))}
          </div>
          {!tipo && <p className="text-center text-sm font-bold text-hf-text-2">Vai retirar ou adicionar?</p>}

          {tipo && <>
          <div>
            <label htmlFor="qtd-estoque" className="text-xs font-bold text-hf-text-2">Quantidade</label>
            <div className="mt-1 flex gap-2">
              <input id="qtd-estoque" inputMode="decimal" autoFocus value={form.qtd} onChange={(e) => setForm({ ...form, qtd: e.target.value })} placeholder="0"
                className="h-14 w-32 min-w-0 rounded-2xl border border-zinc-200/80 bg-hf-surface px-3 text-2xl font-black outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/30 shadow-xs" />
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" role="radiogroup" aria-label="Unidade">
                {unidades.map((u) => (
                  <button key={u} type="button" role="radio" aria-checked={unidadeSel === u} onClick={() => setForm({ ...form, unidade: u })}
                    className={`h-14 min-w-[3.5rem] flex-1 rounded-2xl border px-2 text-sm font-black transition-all active:scale-[0.98] ${unidadeSel === u ? "border-hf-text bg-hf-text text-hf-surface shadow-xs" : "border-zinc-200/80 bg-zinc-50/70 text-hf-text-2 hover:bg-zinc-100"}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {lanc && (lanc.erro
            ? <p className="text-sm font-bold text-hf-danger">{lanc.erro}</p>
            : <p className="rounded-xl bg-hf-elevated p-2.5 text-sm">
                <b>{lanc.texto}</b><br />
                <span className="text-hf-text-2">Saldo depois: <span className={depois < 0 ? "font-bold text-hf-danger" : "font-bold text-hf-text"}>{depois < 0 ? `${fmtQ(depois)} ${unidadeDoSaldo(produto)}` : saldoOperacional(produto, depois)}</span></span>
              </p>)}
          {depois < 0 && <p className="text-sm font-bold text-hf-danger">Retirada maior que o saldo deste local.</p>}

          <div>
            <p className="text-xs font-bold text-hf-text-2">Motivo</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {MOTIVOS[tipo].filter((m) => !m.pelaCompra && (!m.admin || seg?.pode_autorizar) && (m.codigo !== "transferencia_enviada" || destinos.length)).map((m) => (
                <button key={m.codigo} onClick={() => setForm({ ...form, motivo: m.codigo, destino: "" })} aria-pressed={form.motivo === m.codigo}
                  className={`h-10 rounded-xl border px-3 text-xs sm:text-sm font-bold transition-all active:scale-[0.98] ${form.motivo === m.codigo ? "border-hf-text bg-hf-text text-hf-surface shadow-xs" : "border-zinc-200/80 bg-zinc-50/70 text-hf-text-2 hover:bg-zinc-100"}`}>
                  {m.admin && <Lock size={12} className="mr-1 inline" />}{m.rotulo}
                </button>
              ))}
            </div>
          </div>

          {ehTransferencia && (
            <div>
              <p className="text-xs font-bold text-hf-text-2">Para onde?</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {destinos.map((d) => (
                  <button key={d.id} onClick={() => setForm({ ...form, destino: d.id })} aria-pressed={form.destino === d.id}
                    className={`h-10 rounded-xl border px-3 text-sm font-bold transition-all active:scale-[0.98] ${form.destino === d.id ? "border-hf-accent bg-hf-accent/10 text-hf-accent shadow-xs" : "border-zinc-200/80 bg-zinc-50/70 text-hf-text-2 hover:bg-zinc-100"}`}>{d.nome}</button>
                ))}
              </div>
              <p className="mt-1 text-xs text-hf-muted">Sai de {estoque?.nome} e entra no destino numa operação só.</p>
            </div>
          )}

          {tipo === "entrada" && (
            <p className="text-xs text-hf-text-2">Mercadoria comprada entra por <Link href="/dashboard/operacao/estoque/compras?aba=nova" className="font-bold text-hf-accent underline">Compras</Link> (estoque, custo médio e conta a pagar juntos, sem entrar duas vezes).</p>
          )}

          {motivoSel?.admin && (
            <div className="space-y-2 rounded-xl border border-hf-warning/30 bg-hf-warning/10 p-3">
              <p className="flex items-center gap-1 text-xs font-black text-hf-warning"><Lock size={14} /> Ajuste autorizado: motivo e PIN do administrador</p>
              <input value={form.justificativa} onChange={(e) => setForm({ ...form, justificativa: e.target.value })} placeholder="Por que este ajuste?" className="h-12 w-full rounded-xl border border-hf-border bg-hf-surface px-3 font-bold" />
              <input type="password" inputMode="numeric" autoComplete="off" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder="PIN" className="h-12 w-full rounded-xl border border-hf-border bg-hf-surface px-3 font-black tracking-widest" />
            </div>
          )}

          <button type="button" onClick={() => setMaisOpcoes((v) => !v)} aria-expanded={maisOpcoes} className="flex items-center gap-1 text-sm font-bold text-hf-text-2">
            <ChevronDown size={16} className={maisOpcoes ? "rotate-180" : ""} /> Mais opções
          </button>
          {maisOpcoes && (
            <div className="space-y-2">
              {tipo === "entrada" && (
                <label className="block text-xs font-bold text-hf-text-2">Validade
                  <input type="date" value={form.validade} onChange={(e) => setForm({ ...form, validade: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-hf-border bg-hf-surface px-3 font-bold text-hf-text" />
                </label>
              )}
              <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Observação" aria-label="Observação" className="h-11 w-full rounded-xl border border-hf-border bg-hf-surface px-3 font-bold" />
              <input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} placeholder="Quem está lançando (aparelho compartilhado)" aria-label="Responsável" className="h-11 w-full rounded-xl border border-hf-border bg-hf-surface px-3 font-bold" />
            </div>
          )}

          {semPermissao && <p className="text-sm font-bold text-hf-danger">Seu perfil não pode lançar {tipo === "entrada" ? "entrada" : "retirada"} neste estoque. Peça ao administrador.</p>}
          <button onClick={confirmar} disabled={!pronto || enviando || semPermissao || bancoAntigo}
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black transition-all active:scale-[0.98] shadow-card disabled:opacity-40 ${tipo === "entrada" ? "bg-hf-accent text-hf-accent-fg" : "bg-hf-text text-hf-surface"}`}>
            {enviando ? <><Loader2 size={18} className="animate-spin" /> Gravando...</>
              : <><Check size={20} /> Confirmar {ehTransferencia ? "transferência" : tipo === "entrada" ? "entrada" : "retirada"}{lanc && !lanc.erro ? ` · ${saldoOperacional(produto, lanc.quantidadeSaldo)}` : ""}</>}
          </button>
          {!motivoSel && lanc && !lanc.erro && <p className="text-center text-xs text-hf-text-2">Escolha o motivo para confirmar.</p>}
          </>}
        </div>
      )}

      {/* últimos deste local */}
      {estoque && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-hf-surface shadow-card">
          <div className="flex items-center justify-between px-3 pt-3">
            <p className="text-sm font-black">Últimos em {estoque.nome}</p>
            <Link href={`/dashboard/operacao/estoque/historico?estoque=${estoqueId}`} className="text-xs font-bold text-hf-accent">Histórico completo</Link>
          </div>
          {ultimos.error && <p className="p-3 text-sm text-hf-danger">{ultimos.error}</p>}
          <ul className="mt-1 divide-y divide-hf-border">
            {!ultimos.data.length && <li className="p-3 text-sm text-hf-text-2">Nenhum lançamento neste local ainda.</li>}
            {ultimos.data.map((m) => {
              const entra = m.tipo === "entrada" || m.tipo === "transferencia_entrada" || (m.tipo === "contagem" && Number(m.quantidade) >= 0);
              const estornado = ultimos.estornados.has(m.id);
              return (
                <li key={m.id} className={`flex justify-between gap-2 px-3 py-2.5 ${estornado ? "opacity-60" : ""}`}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold"><span className={entra ? "text-hf-success" : "text-hf-text"}>{entra ? "+" : "−"}{saldoOperacional(m.insumo, Math.abs(Number(m.quantidade)))}</span> {m.insumo?.nome || "—"}</p>
                    <p className="truncate text-xs text-hf-text-2">{[rotuloMotivo(m.motivo), m.usuario_nome, fmtHora(m.created_at), estornado && "estornado"].filter(Boolean).join(" · ")}</p>
                  </div>
                  {seg?.pode_autorizar && !ultimos.desatualizado && podeEstornar(m, ultimos.estornados) && (
                    <button onClick={() => setEstorno({ mov: m, justificativa: "", pin: "", chave: novaChave(), erro: "" })}
                      className="flex h-9 shrink-0 items-center gap-1 self-center rounded-lg bg-hf-elevated px-2 text-xs font-bold text-hf-text-2"><RotateCcw size={13} /> Estornar</button>
                  )}
                </li>);
            })}
          </ul>
        </section>
      )}

      {estorno && <ModalEstorno estorno={estorno} setEstorno={setEstorno} onFeito={async (texto) => { setEstorno(null); setAviso({ tipo: "ok", texto }); await Promise.all([carregarBase(), carregarUltimos()]); }} />}
    </div>
  );
}
