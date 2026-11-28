"use client";

// PRECIFICAÇÃO do restaurante e do bar, separada da ficha técnica, como no
// Delivery (pedido do dono, 27/11/2026: "separe a ficha técnica do
// restaurante da precificação como no delivery").
//
// A ficha guarda receita e custo. Aqui ficam o preço de venda, as taxas da
// casa (maquininha, imposto) e a meta de lucro (decisão DP-FIN-1). As contas
// NÃO são novas: vêm de resumoFinanceiroDaFicha (ficha-financeiro.mjs), as
// mesmas da lista de fichas e da Pizza do Lucro.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BarChart3, Check, ChevronDown, Loader2, PieChart, Search } from "lucide-react";
import ComposicaoDoPreco from "../../../components/precificacao/ComposicaoDoPreco";
import CustoNoTempo from "../../../components/precificacao/CustoNoTempo";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { pesosDaEquipeNoMes } from "../../../lib/custo-do-dia.mjs";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchParams, salvarParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { resumoFinanceiroDaFicha, produtosComPrecoSalvo } from "../../../lib/ficha-financeiro.mjs";
import { podeEditarFicha, podeVerCustosFicha } from "../../../lib/ficha-modelo.mjs";
import { fmtReais } from "../../../lib/valor-percentual.mjs";
import { salvarPrecoDaFicha } from "../../../lib/preco-da-ficha";
import { casaBusca } from "../../../lib/busca.mjs";
import { supabase, isSupabaseReady } from "../../../lib/supabase";
import { centavos, compararCanais, regrasDoCanalDelivery, regrasDoSalao, textoReais } from "../../../lib/financeiro/motor/index.mjs";

const pct = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? "—" : `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`);
const num = (t) => { const n = Number(String(t ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };

function Precificacao() {
  const sp = useSearchParams();
  const dept = sp.get("dept") === "bar" ? "bar" : "cozinha";
  const { unidadeAtiva, sessao } = useERP();
  const podeVer = podeVerCustosFicha(sessao, dept);
  const podeEditar = podeEditarFicha(sessao, dept);
  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [params, setParams] = useState(PARAMS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [taxasAbertas, setTaxasAbertas] = useState(false);
  // Equipe para abrir o CMO pessoa por pessoa na composição (dono, 28/11/2026).
  const [equipe, setEquipe] = useState({ colaboradores: [], recibos: [] });
  useEffect(() => {
    if (!podeVer || !unidadeAtiva || unidadeAtiva === "todas") return;
    let vivo = true;
    Promise.all([fetchColaboradores(unidadeAtiva), fetchRecibosPrestacaoUnidade(unidadeAtiva)])
      .then(([c, r]) => { if (vivo) setEquipe({ colaboradores: c.data || [], recibos: r.data || [] }); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [podeVer, unidadeAtiva]);
  const pesosEquipe = useMemo(() => pesosDaEquipeNoMes({ ...equipe, encargosPct: params.encargos_folha_pct }), [equipe, params.encargos_folha_pct]);
  // Apps configurados no Delivery (comparação de canais, fase 4 da expansão):
  // a config desta unidade, ou a de outra unidade da empresa, rotulada.
  const [apps, setApps] = useState({ canais: [], tributosPct: 0, origem: null });
  useEffect(() => {
    if (!isSupabaseReady() || !unidadeAtiva) return;
    supabase.from("marmitaria_configuracoes").select("unidade_id, canais, tributos_pct").then(({ data }) => {
      const linhas = (data || []).filter((l) => Array.isArray(l.canais) && l.canais.length);
      const escolhida = linhas.find((l) => l.unidade_id === unidadeAtiva) || linhas[0];
      if (!escolhida) return;
      // Todos os apps com taxa preenchida, ligados ou não no Delivery (dono,
      // 28/11/2026: "por iFood e Keeta"); os desligados vêm marcados.
      setApps({ canais: escolhida.canais.filter((c) => c.ativo !== false || c.comissao_pct !== null && c.comissao_pct !== undefined && c.comissao_pct !== ""), tributosPct: Number(escolhida.tributos_pct) || 0, origem: escolhida.unidade_id === unidadeAtiva ? null : escolhida.unidade_id });
    });
  }, [unidadeAtiva]);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let vivo = true;
    setCarregando(true);
    Promise.all([fetchFichas(unidadeAtiva, dept), fetchProdutos(unidadeAtiva, dept), fetchParams(unidadeAtiva)]).then(([f, p, pr]) => {
      if (!vivo) return;
      setErro(f.error && f.error !== "Offline" ? `Não consegui carregar as fichas: ${f.error}` : "");
      setFichas(f.data || []);
      setProdutos(p.data || []);
      setParams({ ...PARAMS_PADRAO, ...(pr.data || {}) });
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [unidadeAtiva, dept]);

  const linhas = useMemo(() => fichas
    .filter((f) => !f.eh_base && f.ativo !== false && f.status !== "arquivada")
    .map((f) => ({ f, r: resumoFinanceiroDaFicha(f, { fichas, produtos, params }) }))
    .sort((a, b) => String(a.f.nome_receita).localeCompare(String(b.f.nome_receita), "pt-BR")), [fichas, produtos, params]);

  const contagem = {
    todos: linhas.length,
    sem_preco: linhas.filter((l) => !(l.r.preco > 0)).length,
    cmv_alto: linhas.filter((l) => l.r.cmvPct !== null && l.r.cmvPct > (l.r.meta || 30)).length,
  };
  const visiveis = linhas.filter((l) => (!busca || casaBusca(l.f.nome_receita, busca))
    && (filtro === "todos" || (filtro === "sem_preco" ? !(l.r.preco > 0) : l.r.cmvPct !== null && l.r.cmvPct > (l.r.meta || 30))));

  if (!podeVer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <CabecalhoTela titulo="Precificação" />
        <p className="mt-4 rounded-2xl bg-hf-elevated px-4 py-3 text-sm text-hf-text-2">Seu acesso não mostra custos e preços. Fale com a gerência.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4 sm:px-6">
      <CabecalhoTela titulo="Precificação" subtitulo={dept === "bar" ? "Preço, CMV e lucro de cada drink" : "Preço, CMV e lucro de cada prato"} />
      <p className="text-[13px] text-hf-text-2">
        A receita e o custo ficam na <Link href={`/dashboard/operacao/fichas?dept=${dept}`} className="font-bold text-hf-text underline">ficha técnica</Link>. Aqui você define o preço de venda.
      </p>

      <TaxasDaCasa params={params} aberto={taxasAbertas} setAberto={setTaxasAbertas} podeEditar={podeEditar} unidadeId={unidadeAtiva}
        onSalvo={(novo) => setParams((p) => ({ ...p, ...novo }))} />

      <div className="flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4">
          <Search size={16} className="shrink-0 text-hf-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={dept === "bar" ? "Procurar drink" : "Procurar prato"} aria-label="Procurar" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["todos", "Todos"], ["sem_preco", "Sem preço"], ["cmv_alto", "CMV alto"]].map(([id, rot]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id}
            className={`min-h-[40px] rounded-full px-2 text-sm font-semibold ${filtro === id ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2"}`}>
            {rot} <span className="opacity-60">({contagem[id]})</span>
          </button>
        ))}
      </div>

      {erro && <p role="alert" className="rounded-2xl bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-danger">{erro}</p>}
      {carregando ? (
        <p className="py-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando…</p>
      ) : !visiveis.length ? (
        <p className="rounded-2xl border border-dashed border-hf-border px-4 py-8 text-center text-sm text-hf-text-2">Nada para mostrar aqui.</p>
      ) : (
        <ul className="space-y-2">
          {visiveis.map(({ f, r }) => (
            <LinhaPreco key={f.id} ficha={f} r={r} podeEditar={podeEditar} unidadeId={unidadeAtiva} params={params} apps={apps} fichas={fichas} produtos={produtos} pesosEquipe={pesosEquipe}
              onSalvo={(preco, produtoId) => setProdutos((lista) => produtosComPrecoSalvo(lista, { produtoId, fichaId: f.id, nome: f.nome_receita, preco }))} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaPreco({ ficha, r: rSalvo, podeEditar, unidadeId, onSalvo, params, apps, fichas, produtos, pesosEquipe }) {
  const [comparar, setComparar] = useState(false);
  const [composicao, setComposicao] = useState(false);
  const [valor, setValor] = useState(rSalvo.preco > 0 ? String(rSalvo.preco.toFixed(2)).replace(".", ",") : "");
  // Enquanto digita, CMV, sobra e comparação já mostram o preço novo (dono,
  // 28/11/2026: "quando digito o preço não muda automaticamente"). Só grava
  // ao tocar no ✓. Mesma conta (resumoFinanceiroDaFicha) com o preço digitado.
  const digitado = num(valor);
  const r = useMemo(() => (digitado > 0 && Math.abs(digitado - (rSalvo.preco || 0)) > 0.004
    ? resumoFinanceiroDaFicha(ficha, { fichas, params, produtos: produtosComPrecoSalvo(produtos, { fichaId: ficha.id, nome: ficha.nome_receita, preco: digitado }) })
    : rSalvo), [digitado, rSalvo, ficha, fichas, produtos, params]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const mudou = num(valor) !== null && Math.abs((num(valor) || 0) - (rSalvo.preco || 0)) > 0.004;
  const cmvAlto = r.cmvPct !== null && r.cmvPct > (r.meta || 30);
  const margem = r.composicao?.temPreco ? r.composicao.margemContribuicao : null;
  const salvar = async (preco = valor) => {
    setSalvando(true); setMsg("");
    const res = await salvarPrecoDaFicha({ ficha, preco, unidadeId });
    setSalvando(false);
    if (res.error) { setMsg(res.error); return; }
    setValor(String(res.preco.toFixed(2)).replace(".", ","));
    onSalvo(res.preco, res.produtoId);
    setMsg("Salvo");
    window.setTimeout(() => setMsg(""), 2000);
  };
  const aba = composicao ? "dinheiro" : comparar ? "canais" : null;
  const abrir = (id) => { setComposicao(id === "dinheiro" && aba !== "dinheiro"); setComparar(id === "canais" && aba !== "canais"); };
  const meta = r.meta || 30;
  const sugeridoDifere = r.precoSugerido > 0 && Math.abs(r.precoSugerido - (num(valor) || 0)) / r.precoSugerido > 0.01;
  return (
    <li className="rounded-2xl border border-hf-border bg-hf-surface p-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => abrir("dinheiro")} aria-expanded={composicao}
          className="min-w-0 flex-1 text-left text-[15px] font-black leading-snug text-hf-text">{ficha.nome_receita}</button>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-sm font-bold text-hf-muted">R$</span>
          <input value={valor} disabled={!podeEditar || salvando} inputMode="decimal" aria-label={`Preço de ${ficha.nome_receita}`}
            onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter" && mudou) salvar(); }}
            placeholder="0,00" className="h-11 w-24 rounded-xl border border-hf-border bg-hf-bg px-2 text-right text-[16px] font-black tabular-nums text-hf-text outline-none focus:border-hf-accent" />
          {mudou && podeEditar && (
            <button type="button" onClick={() => salvar()} disabled={salvando} aria-label="Salvar preço"
              className="grid h-11 w-11 place-items-center rounded-xl bg-hf-menu text-white">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={18} />}</button>
          )}
        </div>
      </div>

      {/* Os três números que importam, lado a lado. */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-hf-elevated px-2 py-1.5">
          <p className="text-[11px] font-semibold text-hf-muted">Custo</p>
          <p className="text-sm font-black tabular-nums text-hf-text">{r.cmvValor > 0 ? fmtReais(r.cmvValor) : "—"}</p>
        </div>
        <div className={`rounded-xl px-2 py-1.5 ${cmvAlto ? "bg-hf-danger/10" : "bg-hf-elevated"}`}>
          <p className="text-[11px] font-semibold text-hf-muted">CMV</p>
          <p className={`text-sm font-black tabular-nums ${cmvAlto ? "text-hf-danger" : "text-hf-text"}`}>{pct(r.cmvPct)} <span className="text-[10px] font-semibold text-hf-muted">meta {meta}%</span></p>
        </div>
        <div className="rounded-xl bg-hf-elevated px-2 py-1.5">
          <p className="text-[11px] font-semibold text-hf-muted">Sobra</p>
          <p className={`text-sm font-black tabular-nums ${margem && margem.valor < 0 ? "text-hf-danger" : "text-hf-text"}`}>{margem ? fmtReais(margem.valor) : "—"}</p>
        </div>
      </div>

      {(sugeridoDifere || msg) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {sugeridoDifere && (
            <button type="button" disabled={!podeEditar} onClick={() => setValor(String(r.precoSugerido.toFixed(2)).replace(".", ","))}
              className="rounded-full bg-hf-elevated px-3 py-1.5 text-left font-semibold text-hf-text-2">
              Preço para lucro de {r.metaLucro || 0}%: <b className="text-hf-text">{fmtReais(r.precoSugerido)}</b>
              {(num(valor) || 0) > r.precoSugerido ? " (o seu dá mais)" : ""} · <span className="underline">usar</span>
            </button>
          )}
          {msg && <span className={`font-bold ${msg === "Salvo" ? "text-hf-success" : "text-hf-danger"}`}>{msg}</span>}
        </div>
      )}

      {/* Abas: uma aberta por vez. */}
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-hf-elevated p-1">
        {[["dinheiro", PieChart, "Para onde vai"], ["canais", BarChart3, "Canais"]].map(([id, Ic, rot]) => (
          <button key={id} type="button" onClick={() => abrir(id)} aria-pressed={aba === id}
            className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full text-xs font-bold ${aba === id ? "bg-hf-menu text-white" : "text-hf-text-2"}`}>
            <Ic size={14} /> {rot}
          </button>
        ))}
      </div>
      {composicao && <ComposicaoDoPreco c={r.composicao} pesosEquipe={pesosEquipe} />}
      {composicao && (
        <div className="mt-2 rounded-xl border border-hf-border bg-hf-bg p-3">
          <p className="mb-1 text-sm font-bold text-hf-text">Custo do prato no tempo</p>
          <CustoNoTempo ficha={ficha} fichas={fichas} produtos={produtos} params={params} unidadeId={unidadeId} precoVenda={r.preco} metaCmv={r.meta || 30} />
        </div>
      )}
      {comparar && <ComparacaoCanais r={r} params={params} apps={apps} precoAtual={num(valor) || r.preco} />}
    </li>
  );
}

// Quanto sobra e qual o preço mínimo em cada canal ao mesmo tempo (item 10 do
// documento da expansão). Contas do motor central (lib/financeiro/motor).
function ComparacaoCanais({ r, params, apps, precoAtual }) {
  const [margem, setMargem] = useState("");
  const custoC = r.cmvValor > 0 ? centavos(r.cmvValor) : null;
  const canais = [
    { ...regrasDoSalao({ taxaCartaoPct: params.taxa_cartao_pct, impostoPct: params.imposto_pct }), precoAtualC: centavos(precoAtual) },
    ...apps.canais.map((c) => { const rc = regrasDoCanalDelivery(c, apps.tributosPct); return { ...rc, nome: c.ativo === false ? `${rc.nome} (desligado no Delivery)` : rc.nome, precoAtualC: centavos(precoAtual) }; }),
  ];
  const m = num(margem);
  const lista = compararCanais({ custoC, canais, margemPct: m });
  if (!custoC) return <p className="mt-2 rounded-xl bg-hf-elevated px-3 py-2 text-xs font-semibold text-hf-text-2">DADOS INSUFICIENTES: a ficha ainda não tem custo.</p>;
  const melhor = lista.filter((c) => c.margemAtualC !== null).sort((x, y) => y.margemAtualC - x.margemAtualC)[0];
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-hf-elevated p-3">
      <p className="text-xs text-hf-text-2">Vendendo a <b className="text-hf-text">{textoReais(centavos(precoAtual))}</b>, quanto sobra em cada canal depois do custo e das taxas.</p>
      <ul className="space-y-2">
        {lista.map((c) => {
          const desligado = /\(desligado no Delivery\)/.test(c.nome);
          const nome = c.nome.replace(" (desligado no Delivery)", "");
          const negativo = c.margemAtualC !== null && c.margemAtualC < 0;
          return (
            <li key={c.id} className={`rounded-xl border bg-hf-surface p-2.5 ${melhor && c.id === melhor.id ? "border-hf-success" : "border-hf-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-black text-hf-text">
                    {nome}
                    {melhor && c.id === melhor.id ? <span className="rounded-full bg-hf-success/15 px-2 py-0.5 text-[10px] font-bold text-hf-success">Sobra mais</span> : null}
                    {desligado ? <span className="rounded-full bg-hf-elevated px-2 py-0.5 text-[10px] font-bold text-hf-muted">desligado</span> : null}
                  </p>
                  <p className="text-[11px] text-hf-muted">Taxas {c.taxasAtuaisC !== null ? textoReais(c.taxasAtuaisC) : "—"}{c.natureza === "HIPÓTESE" ? " (pela fatura)" : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-base font-black tabular-nums ${negativo ? "text-hf-danger" : "text-hf-text"}`}>{c.margemAtualC !== null ? textoReais(c.margemAtualC) : "sem preço"}</p>
                  <p className="text-[11px] tabular-nums text-hf-muted">{c.margemAtualC !== null ? `sobra ${pct(c.margemAtualPct)}` : ""}</p>
                </div>
              </div>
              <p className="mt-1 border-t border-hf-border pt-1 text-[11px] text-hf-text-2">
                {c.preco.status === "OK"
                  ? <>{m ? `Para sobrar ${pct(m)}` : "Sem prejuízo"} a partir de <b>{textoReais(c.preco.minimoC)}</b> · preço redondo <b>{textoReais(c.preco.comercialC)}</b></>
                  : c.preco.status === "INVIAVEL" ? "Com essa sobra não existe preço possível neste canal." : "Falta dado para o preço mínimo."}
                {c.abaixoDoMinimo ? <span className="font-bold text-hf-danger"> · seu preço está abaixo</span> : null}
              </p>
            </li>
          );
        })}
      </ul>
      <label className="flex items-center justify-between gap-2 text-xs font-semibold text-hf-text-2">
        Quero que sobre (% da venda)
        <input value={margem} onChange={(e) => setMargem(e.target.value.replace(/[^0-9.,]/g, ""))} inputMode="decimal" placeholder="ex.: 30"
          className="h-10 w-20 rounded-lg border border-hf-border bg-hf-surface px-2 text-right text-[16px] font-bold text-hf-text outline-none" />
      </label>
      <p className="text-[11px] text-hf-muted">
        ESTIMATIVA: sobra = preço − custo − taxas, antes de equipe, aluguel e lucro.{apps.canais.length ? ` Taxas dos apps: as configuradas no Delivery${apps.origem ? ` (unidade ${apps.origem})` : ""}.` : " Nenhum app configurado no Delivery."}
      </p>
    </div>
  );
}

// Taxas da casa: valem para todos os pratos (DP-FIN-1: as taxas saem da ficha).
function TaxasDaCasa({ params, aberto, setAberto, podeEditar, unidadeId, onSalvo }) {
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setForm({
      taxa_cartao_pct: String(params.taxa_cartao_pct ?? "").replace(".", ","),
      imposto_pct: String(params.imposto_pct ?? "").replace(".", ","),
      margem_alvo_pct: String(params.margem_alvo_pct ?? "").replace(".", ","),
    });
  }, [params.taxa_cartao_pct, params.imposto_pct, params.margem_alvo_pct]);
  const campos = [["taxa_cartao_pct", "Maquininha (%)"], ["imposto_pct", "Imposto (%)"], ["margem_alvo_pct", "Meta de lucro (%)"]];
  const salvar = async () => {
    const novo = Object.fromEntries(campos.map(([k]) => [k, num(form[k]) ?? 0]));
    setSalvando(true); setMsg("");
    const r = await salvarParams(unidadeId, novo);
    setSalvando(false);
    if (r?.error) { setMsg(`Não salvou: ${r.error}`); return; }
    onSalvo(novo); setMsg("Salvo");
  };
  return (
    <section className="rounded-2xl border border-hf-border bg-hf-surface">
      <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="flex min-h-[48px] w-full items-center justify-between gap-2 px-4 text-left">
        <span className="text-sm font-black text-hf-text">Taxas da casa</span>
        <span className="flex items-center gap-2 text-xs font-semibold text-hf-text-2">
          Maquininha {pct(params.taxa_cartao_pct)} · Imposto {pct(params.imposto_pct)} · Lucro {pct(params.margem_alvo_pct)}
          <ChevronDown size={16} className={aberto ? "rotate-180" : ""} />
        </span>
      </button>
      {aberto && (
        <div className="border-t border-hf-border p-4">
          <div className="grid grid-cols-3 gap-2">
            {campos.map(([k, rot]) => (
              <label key={k} className="block">
                <span className="text-xs font-semibold text-hf-text-2">{rot}</span>
                <input value={form[k] ?? ""} disabled={!podeEditar} inputMode="decimal" onChange={(e) => setForm({ ...form, [k]: e.target.value.replace(/[^0-9.,]/g, "") })}
                  className="mt-1 h-11 w-full rounded-xl border border-hf-border bg-hf-bg px-2 text-[16px] font-bold text-hf-text outline-none focus:border-hf-accent" />
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-hf-muted">Valem para todos os pratos. Custos do mês (aluguel, folha…) ficam em Financeiro → Pizza do lucro.</p>
          {podeEditar && (
            <button type="button" onClick={salvar} disabled={salvando} className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-hf-menu font-bold text-white">
              {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Salvar taxas
            </button>
          )}
          {msg && <p className={`mt-2 text-sm font-bold ${msg === "Salvo" ? "text-hf-success" : "text-hf-danger"}`}>{msg}</p>}
        </div>
      )}
    </section>
  );
}

export default function PaginaPrecificacao() {
  return <Suspense fallback={null}><Precificacao /></Suspense>;
}
