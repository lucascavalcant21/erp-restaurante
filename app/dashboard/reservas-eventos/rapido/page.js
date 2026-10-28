"use client";

// ORÇAMENTO RÁPIDO POR PESSOA (pedido do dono, 27/10/2026): todas as fichas da
// cozinha e do bar numa lista só, um toque para pôr no cardápio e o preço por
// pessoa na hora. As contas são as do orçamento do evento
// (evento-orcamento.mjs); o custo vem da ficha técnica. "Criar evento" grava o
// orçamento no evento e abre a tela completa para os detalhes.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Wine, Search, X, Plus, Minus, Check, Loader2, Users, Sparkles, AlertTriangle } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { supabase } from "../../../lib/supabase";
import { fetchFichas } from "../../../lib/operacao";
import { fetchParamsDaCasa, PARAMS_PADRAO } from "../../../lib/parametros";
import { catalogoDeFichas, filtrarCatalogo, orcamentoDoRapido } from "../../../lib/evento-rapido.mjs";
import { resumoDoOrcamento, camposDoEventoParaGravar, mensagemErroEvento } from "../../../lib/evento-orcamento.mjs";
import { fmtReais } from "../../../lib/valor-percentual.mjs";

const fmtQ = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const PASSO = { cozinha: 0.25, bar: 1 };

function Contador({ valor, onChange, passo = 1, min = 0, rotulo }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={rotulo}>
      <button type="button" onClick={() => onChange(Math.max(min, Math.round((valor - passo) * 100) / 100))} aria-label={`Menos ${rotulo}`}
        className="grid h-9 w-9 place-items-center rounded-xl border border-hf-border bg-hf-surface text-hf-text"><Minus size={16} /></button>
      <span className="min-w-[3rem] text-center text-base font-black tabular-nums text-hf-text">{fmtQ(valor)}</span>
      <button type="button" onClick={() => onChange(Math.round((valor + passo) * 100) / 100)} aria-label={`Mais ${rotulo}`}
        className="grid h-9 w-9 place-items-center rounded-xl border border-hf-border bg-hf-surface text-hf-text"><Plus size={16} /></button>
    </div>
  );
}

export default function OrcamentoRapido() {
  const router = useRouter();
  const { unidadeAtiva, sessao } = useERP();
  const [fichas, setFichas] = useState([]);
  const [params, setParams] = useState(PARAMS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [setor, setSetor] = useState("cozinha");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [convidados, setConvidados] = useState(50);
  const [criancas, setCriancas] = useState(0);
  const [itens, setItens] = useState([]); // [{ ficha_id, nome, setor, por_pessoa, custoPorcao }]
  const [equipe, setEquipe] = useState("");
  const [extras, setExtras] = useState("");
  const [meta, setMeta] = useState("");
  const [preco, setPreco] = useState("");
  const [cliente, setCliente] = useState({ cliente_nome: "", cliente_telefone: "", data_evento: "" });
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (!unidadeAtiva) return;
    let ativo = true;
    (async () => {
      setCarregando(true);
      const [rF, rP] = await Promise.all([fetchFichas(unidadeAtiva), fetchParamsDaCasa(unidadeAtiva)]);
      if (!ativo) return;
      setFichas(rF.data || []);
      const p = { ...PARAMS_PADRAO, ...(rP.data || {}) };
      setParams(p);
      setMeta((m) => (m === "" ? String(Number(p.margem_alvo_pct) || 0) : m));
      setErro(rF.error && rF.error !== "Offline" ? "Não foi possível ler as fichas técnicas agora." : "");
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  const catalogo = useMemo(() => catalogoDeFichas(fichas), [fichas]);
  const grupos = useMemo(() => filtrarCatalogo(catalogo[setor], { busca, categoria }), [catalogo, setor, busca, categoria]);
  const categorias = catalogo[setor].map((g) => g.categoria);
  const escolhidos = useMemo(() => new Map(itens.map((i) => [i.ficha_id, i])), [itens]);

  const orc = useMemo(() => orcamentoDoRapido({
    convidados, criancas, itens, equipe, extras, meta_lucro_pct: meta, preco_por_pessoa: preco, cliente,
  }, params), [convidados, criancas, itens, equipe, extras, meta, preco, cliente, params]);
  const r = useMemo(() => resumoDoOrcamento(orc, fichas), [orc, fichas]);

  const alternar = (it) => setItens((lista) => (lista.some((x) => x.ficha_id === it.id)
    ? lista.filter((x) => x.ficha_id !== it.id)
    : [...lista, { ficha_id: it.id, nome: it.nome, setor: it.setor, por_pessoa: 1, custoPorcao: it.custoPorcao }]));
  const porPessoa = (id, v) => setItens((lista) => lista.map((x) => (x.ficha_id === id ? { ...x, por_pessoa: v } : x)));
  const trocarSetor = (s) => { setSetor(s); setCategoria(""); };

  async function criarEvento() {
    if (criando || !itens.length || !(convidados > 0)) return;
    setCriando(true); setErro("");
    const campos = camposDoEventoParaGravar(orc, r, {});
    const { data, error } = await supabase.from("eventos")
      .insert([{ ...campos, unidade_id: unidadeAtiva, funil_status: "MONTANDO PROPOSTA", responsavel_id: sessao?.id || null }])
      .select("id").single();
    setCriando(false);
    if (error) { setErro(`Não foi possível criar o evento: ${mensagemErroEvento(error.message)}`); return; }
    router.push(`/dashboard/reservas-eventos/eventos/${data.id}`);
  }

  const precoNum = Number(String(preco).replace(",", ".")) || 0;
  const sugerido = r.precoSugeridoRedondo;
  const custoPP = convidados > 0 ? r.custoOperacaoPorPessoa : null;

  return (
    <div className="grid gap-4 pb-28 lg:grid-cols-[minmax(0,1fr)_400px] lg:pb-8">
      {/* Esquerda: pessoas e catálogo */}
      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
          <h2 className="flex items-center gap-2 text-base font-black text-hf-text"><Users size={18} className="text-hf-accent" /> Quantas pessoas?</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {[-10, -1].map((d) => <button key={d} type="button" onClick={() => setConvidados((c) => Math.max(0, c + d))} className="h-12 min-w-12 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-black text-hf-text">{d}</button>)}
            <input inputMode="numeric" aria-label="Convidados" value={convidados} onChange={(e) => setConvidados(Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, "")) || 0)))}
              className="h-12 w-24 rounded-xl border border-hf-border bg-hf-surface text-center text-2xl font-black text-hf-text" />
            {[1, 10].map((d) => <button key={d} type="button" onClick={() => setConvidados((c) => c + d)} className="h-12 min-w-12 rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-black text-hf-text">+{d}</button>)}
            <label className="ml-auto flex items-center gap-2 text-sm font-bold text-hf-text-2">Crianças
              <input inputMode="numeric" aria-label="Crianças" value={criancas} onChange={(e) => setCriancas(Math.max(0, Math.round(Number(e.target.value.replace(/\D/g, "")) || 0)))}
                className="h-10 w-16 rounded-xl border border-hf-border bg-hf-surface text-center text-base font-black text-hf-text" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-black text-hf-text">Cardápio: toque para incluir</h2>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-hf-elevated p-1" role="tablist" aria-label="Setor">
              {[["cozinha", "Cozinha", ChefHat], ["bar", "Bar", Wine]].map(([id, rot, Icone]) => (
                <button key={id} role="tab" aria-selected={setor === id} onClick={() => trocarSetor(id)}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-black ${setor === id ? "bg-hf-surface text-hf-text shadow-sm" : "text-hf-text-2"}`}>
                  <Icone size={16} /> {rot} <span className="text-xs font-bold text-hf-text-2">{catalogo[id].reduce((t, g) => t + g.itens.length, 0)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="relative mt-3">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-text-2" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${setor === "bar" ? "drink" : "prato"} ou insumo (ex.: ${setor === "bar" ? "cachaça" : "camarão"})…`}
              className="h-11 w-full rounded-xl border border-hf-border bg-hf-surface pl-10 pr-10 font-semibold text-hf-text" />
            {busca ? <button onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-3 top-1/2 -translate-y-1/2 text-hf-text-2"><X size={18} /></button> : null}
          </div>
          {categorias.length > 1 && (
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {["", ...categorias].map((c) => (
                <button key={c || "todas"} onClick={() => setCategoria(c)} aria-pressed={categoria === c}
                  className={`h-8 shrink-0 rounded-full border px-3 text-xs font-bold ${categoria === c ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{c || "Todas"}</button>
              ))}
            </div>
          )}

          {carregando ? <p className="p-6 text-center text-sm font-bold text-hf-text-2"><Loader2 size={16} className="mr-2 inline animate-spin" />Carregando fichas…</p>
            : !grupos.length ? <p className="p-6 text-center text-sm font-bold text-hf-text-2">{catalogo.total ? "Nada com esse nome." : "Nenhuma ficha técnica cadastrada ainda."}</p>
            : (
              <div className="mt-2 space-y-3">
                {grupos.map((g) => (
                  <div key={g.categoria}>
                    <p className="px-1 pb-1 text-[11px] font-black uppercase tracking-wide text-hf-text-2">{g.categoria}</p>
                    <ul className="divide-y divide-hf-border overflow-hidden rounded-xl border border-hf-border">
                      {g.itens.map((it) => {
                        const sel = escolhidos.get(it.id);
                        return (
                          <li key={it.id} className={sel ? "bg-hf-accent/5" : ""}>
                            <div className="flex items-center gap-2 px-3 py-2">
                              <button type="button" onClick={() => alternar(it)} aria-pressed={!!sel} aria-label={`${sel ? "Tirar" : "Incluir"} ${it.nome}`}
                                className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left">
                                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${sel ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border-strong text-transparent"}`}><Check size={16} /></span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-bold text-hf-text">{it.nome}</span>
                                  {it.peloInsumo ? <span className="block truncate text-[11px] font-semibold text-hf-accent">leva {it.peloInsumo}</span> : null}
                                  <span className={`block text-xs ${it.custoPorcao ? "text-hf-text-2" : "font-bold text-hf-warning"}`}>
                                    {it.custoPorcao ? `custo ${fmtReais(it.custoPorcao)} a porção` : "ficha sem custo: DADOS INSUFICIENTES"}
                                  </span>
                                </span>
                              </button>
                              {sel ? <Contador rotulo={`porções por pessoa de ${it.nome}`} valor={sel.por_pessoa} passo={PASSO[it.setor]} onChange={(v) => porPessoa(it.id, v)} /> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          <p className="mt-3 text-xs text-hf-text-2">O número ao lado do item é quanto <b>cada pessoa</b> consome (porções; no bar, doses ou unidades). No buffet, meia porção = 0,5.</p>
        </section>
      </div>

      {/* Direita: preço por pessoa */}
      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section id="preco" className="rounded-2xl border border-hf-border bg-hf-surface p-4">
          <h2 className="text-base font-black text-hf-text">Preço por pessoa</h2>
          <p className="text-xs text-hf-text-2">{itens.length} item(ns) · {convidados} pessoa(s){criancas ? `, ${criancas} criança(s)` : ""}</p>

          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2"><dt className="text-hf-text-2">Cardápio por pessoa (custo)</dt><dd className="font-black text-hf-text">{fmtReais(r.cmvPorPessoa)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-hf-text-2">Custo total por pessoa (com equipe e extras)</dt><dd className="font-black text-hf-text">{custoPP != null ? fmtReais(custoPP) : "—"}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-hf-text-2">Preço mínimo (lucro zero)</dt><dd className="font-bold text-hf-text">{r.precoMinimoPorPessoa ? fmtReais(r.precoMinimoPorPessoa) : "—"}</dd></div>
          </dl>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-bold text-hf-text-2">Equipe (R$ total)
              <input inputMode="decimal" value={equipe} onChange={(e) => setEquipe(e.target.value)} placeholder="0" className="h-10 rounded-xl border border-hf-border bg-hf-surface px-3 text-base font-black text-hf-text" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-hf-text-2">Extras (R$ total)
              <input inputMode="decimal" value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="aluguel, decoração…" className="h-10 rounded-xl border border-hf-border bg-hf-surface px-3 text-base font-black text-hf-text" />
            </label>
            <label className="col-span-2 flex items-center justify-between gap-2 text-xs font-bold text-hf-text-2">Lucro que você quer (%)
              <input inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} className="h-10 w-20 rounded-xl border border-hf-border bg-hf-surface px-3 text-right text-base font-black text-hf-text" />
            </label>
          </div>

          <div className="mt-3 rounded-xl bg-hf-elevated p-3">
            {sugerido ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-hf-text-2">Sugerido para {fmtQ(Number(meta) || 0)}% de lucro <span className="block text-2xl font-black text-hf-text">{fmtReais(sugerido)}</span></p>
                <button type="button" onClick={() => setPreco(String(sugerido))} className="inline-flex h-10 items-center gap-1 rounded-xl bg-hf-accent px-3 text-sm font-black text-white"><Sparkles size={15} /> Usar</button>
              </div>
            ) : <p className="text-sm font-bold text-hf-text-2">{itens.length ? "DADOS INSUFICIENTES: sem custo para calcular o preço (pessoas, ficha com custo ou taxas)." : "Escolha os itens do cardápio."}</p>}
            <label className="mt-3 flex items-center justify-between gap-2 text-sm font-black text-hf-text">Cobrar por pessoa (R$)
              <input inputMode="decimal" aria-label="Preço por pessoa" value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" className="h-11 w-28 rounded-xl border border-hf-border bg-hf-surface px-3 text-right text-lg font-black text-hf-text" />
            </label>
            {precoNum > 0 && (
              <p className={`mt-2 text-sm font-bold ${r.prejuizo ? "text-hf-danger" : "text-hf-success"}`}>
                Total {fmtReais(r.receita)} · lucro {fmtReais(r.lucro)}{r.lucroPct != null ? ` (${fmtQ(r.lucroPct)}%)` : ""}{r.prejuizo ? ": prejuízo" : ""}
              </p>
            )}
          </div>
          {r.semCusto.length > 0 && (
            <p className="mt-2 flex gap-1.5 text-xs font-bold text-hf-warning"><AlertTriangle size={14} className="mt-0.5 shrink-0" />Sem custo na ficha (fora da conta): {r.semCusto.join(", ")}.</p>
          )}
          <p className="mt-2 text-[11px] text-hf-text-2">Custo REAL da ficha técnica; preço sugerido é ESTIMATIVA com imposto {fmtQ(orc.financeiro.imposto_pct)}% e maquininha {fmtQ(orc.financeiro.maquininha_pct)}% dos parâmetros.</p>
        </section>

        <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
          <h2 className="text-base font-black text-hf-text">Cliente (opcional)</h2>
          <div className="mt-2 grid gap-2">
            <input value={cliente.cliente_nome} onChange={(e) => setCliente({ ...cliente, cliente_nome: e.target.value })} placeholder="Nome do cliente" aria-label="Nome do cliente" className="h-10 rounded-xl border border-hf-border bg-hf-surface px-3 font-semibold text-hf-text" />
            <div className="grid grid-cols-2 gap-2">
              <input value={cliente.cliente_telefone} onChange={(e) => setCliente({ ...cliente, cliente_telefone: e.target.value })} placeholder="Telefone" aria-label="Telefone" inputMode="tel" className="h-10 min-w-0 rounded-xl border border-hf-border bg-hf-surface px-3 font-semibold text-hf-text" />
              <input type="date" value={cliente.data_evento} onChange={(e) => setCliente({ ...cliente, data_evento: e.target.value })} aria-label="Data do evento" className="h-10 min-w-0 rounded-xl border border-hf-border bg-hf-surface px-3 font-semibold text-hf-text" />
            </div>
          </div>
          {erro && <p className="mt-2 text-sm font-bold text-hf-danger">{erro}</p>}
          <button type="button" onClick={criarEvento} disabled={criando || !itens.length || !(convidados > 0)}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-hf-accent text-base font-black text-white disabled:opacity-50">
            {criando ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Criar evento com este orçamento
          </button>
          <p className="mt-2 text-center text-xs text-hf-text-2">Abre o evento no funil (Montando proposta) para detalhar equipe, extras e enviar ao cliente.</p>
        </section>
      </aside>

      {/* Celular: preço sempre à vista */}
      <a href="#preco" className="fixed bottom-3 left-3 right-16 z-30 flex items-center justify-between gap-2 rounded-2xl bg-hf-text px-3 py-2.5 text-hf-surface shadow-xl lg:hidden">
        <span className="min-w-0 leading-tight">
          <span className="block text-[11px] font-bold opacity-80">{itens.length} item(ns) · custo/pessoa</span>
          <span className="block whitespace-nowrap text-sm font-black">{custoPP != null ? fmtReais(custoPP) : "—"}</span>
        </span>
        <span className="min-w-0 text-right leading-tight">
          <span className="block text-[11px] font-bold opacity-80">{precoNum > 0 ? "cobrar/pessoa" : "sugerido/pessoa"}</span>
          <span className="block whitespace-nowrap text-sm font-black">{precoNum > 0 ? fmtReais(precoNum) : sugerido ? fmtReais(sugerido) : "—"}</span>
        </span>
      </a>
    </div>
  );
}
