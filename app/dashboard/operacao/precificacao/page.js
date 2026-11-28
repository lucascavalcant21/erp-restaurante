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
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
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
      <div className="flex flex-wrap gap-2">
        {[["todos", "Todos"], ["sem_preco", "Sem preço"], ["cmv_alto", "CMV acima da meta"]].map(([id, rot]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id}
            className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ${filtro === id ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2"}`}>
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
            <LinhaPreco key={f.id} ficha={f} r={r} podeEditar={podeEditar} unidadeId={unidadeAtiva}
              onSalvo={(preco, produtoId) => setProdutos((lista) => produtosComPrecoSalvo(lista, { produtoId, fichaId: f.id, nome: f.nome_receita, preco }))} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LinhaPreco({ ficha, r, podeEditar, unidadeId, onSalvo }) {
  const [valor, setValor] = useState(r.preco > 0 ? String(r.preco.toFixed(2)).replace(".", ",") : "");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");
  const mudou = num(valor) !== null && Math.abs((num(valor) || 0) - (r.preco || 0)) > 0.004;
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
  return (
    <li className="rounded-2xl border border-hf-border bg-hf-surface p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black leading-snug text-hf-text">{ficha.nome_receita}</p>
          <p className="mt-0.5 text-xs font-semibold text-hf-text-2">
            Custo {r.cmvValor > 0 ? fmtReais(r.cmvValor) : "—"}
            {" · "}<span className={cmvAlto ? "text-hf-danger" : ""}>CMV {pct(r.cmvPct)}</span>
            {margem ? ` · Sobra ${fmtReais(margem.valor)}` : ""}
          </p>
        </div>
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
      {(r.precoSugerido > 0 || msg) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {r.precoSugerido > 0 && (
            <button type="button" disabled={!podeEditar} onClick={() => setValor(String(r.precoSugerido.toFixed(2)).replace(".", ","))}
              className="rounded-full bg-hf-elevated px-3 py-1.5 font-bold text-hf-text-2">
              Sugerido {fmtReais(r.precoSugerido)}{r.metaLucro ? ` (lucro ${r.metaLucro}%)` : ""} · usar
            </button>
          )}
          {msg && <span className={`font-bold ${msg === "Salvo" ? "text-hf-success" : "text-hf-danger"}`}>{msg}</span>}
        </div>
      )}
    </li>
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
