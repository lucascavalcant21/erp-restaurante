"use client";

// Card da lista de Fichas Técnicas: compacto quando fechado, análise
// financeira completa quando aberto — sem modal e sem sair da página.
//
// Nenhuma conta mora aqui: tudo vem pronto em `resumo`, montado por
// resumoFinanceiroDaFicha (app/lib/ficha-financeiro.mjs). O card só desenha.

import { useEffect, useState } from "react";
import { ChevronDown, UtensilsCrossed } from "lucide-react";
import { fmtBRL } from "../../../../components/ui";
import { fmtReais, fmtPct, fmtPP, fmtValorPct, NATUREZA } from "../../../../lib/valor-percentual.mjs";

// 0,2 kg → "200 g"; 1,5 kg → "1,5 kg"; 0,1 L → "100 ml".
function fmtQtd(q, unidade) {
  const u = String(unidade || "").toLowerCase();
  const n = Number(q) || 0;
  const num = (x, c = 3) => x.toLocaleString("pt-BR", { maximumFractionDigits: c });
  if (u === "kg" && n > 0 && n < 1) return `${num(n * 1000, 1)} g`;
  if (u === "l" && n > 0 && n < 1) return `${num(n * 1000, 1)} ml`;
  return `${num(n)} ${u === "l" ? "L" : u}`;
}

// Elementos que têm ação própria: clicar neles nunca abre/fecha o card.
const CONTROLES = "button, a, input, label, select, textarea, [data-controle]";

const COR_STATUS = {
  cmv_alto: "text-red-600",
  rascunho: "text-amber-600",
  inativa: "text-slate-500",
  ativa: "text-emerald-700",
};

function Metrica({ rotulo, children, className = "" }) {
  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <span className="mb-0.5 text-3xs font-bold uppercase tracking-wider text-subtle">{rotulo}</span>
      {children}
    </div>
  );
}

export default function CardFicha({
  ficha, resumo, rendimentoTexto, podeVerCustos, selecionada, onSelecionar,
  aberto, onAlternar, acoes, imagemSrc, arrastando = false, onDragOver, onDrop,
}) {
  // O detalhe só é montado na primeira abertura e fica montado depois, para
  // a animação de fechar ter conteúdo para recolher.
  const [montado, setMontado] = useState(aberto);
  useEffect(() => { if (aberto) setMontado(true); }, [aberto]);

  const clicar = (e) => {
    if (e.target.closest(CONTROLES)) return;
    // Quem está selecionando um número para copiar não quer o card fechando.
    if (typeof window !== "undefined" && String(window.getSelection?.() || "").length > 0) return;
    onAlternar();
  };

  const ehPreparo = resumo.tipo === "preparo";
  const cmvAlto = resumo.status.id === "cmv_alto";
  const statusTexto = (
    <span className={`text-xs font-bold ${COR_STATUS[resumo.status.id] || "text-fg"}`}>
      {podeVerCustos || resumo.status.id !== "cmv_alto" ? resumo.status.rotulo : "Ativa"}
    </span>
  );
  const chevron = (
    <button type="button" onClick={onAlternar} aria-expanded={aberto}
      aria-label={aberto ? `Recolher ${ficha.nome_receita}` : `Ver números de ${ficha.nome_receita}`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-subtle hover:bg-white hover:text-fg">
      <ChevronDown size={18} className={`transition-transform duration-300 ${aberto ? "rotate-180" : ""}`} />
    </button>
  );

  return (
    <div
      onClick={clicar}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`erp-fichas-card relative cursor-pointer rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md ${arrastando ? "opacity-50" : ""} ${selecionada ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-line"}`}
    >
      <div className="flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center lg:gap-4">
        {/* Identificação */}
        <div className="flex min-w-0 items-center gap-3 lg:w-[30%] lg:shrink-0">
          <label data-controle className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded border border-line bg-transparent">
            <input type="checkbox" checked={selecionada} onChange={onSelecionar} className="h-4 w-4 cursor-pointer rounded accent-emerald-600"
              aria-label={`Selecionar ${ficha.nome_receita}`} />
          </label>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white sm:h-14 sm:w-14">
            {imagemSrc ? <img src={imagemSrc} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed size={20} className="text-slate-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <span className={`rounded-lg px-2 py-0.5 text-3xs font-black uppercase tracking-wider ${ficha.eh_base ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                {ficha.eh_base ? "Preparo" : "Prato"}
              </span>
              <span className="truncate text-3xs font-bold uppercase tracking-wider text-fg-soft">{ficha.categoria || "Sem categoria"}</span>
            </div>
            <h3 className="truncate text-base font-black text-fg" title={ficha.nome_receita}>{ficha.nome_receita}</h3>
          </div>
          <div className="lg:hidden">{chevron}</div>
        </div>

        {/* Números do card fechado. No celular: venda, custo e CMV primeiro. */}
        <div className="grid flex-1 grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-5">
          <Metrica rotulo="Rendimento" className="order-4 hidden sm:order-1 sm:flex">
            <span className="truncate text-sm font-black text-fg">{rendimentoTexto}</span>
          </Metrica>
          {podeVerCustos ? (
            <>
              <Metrica rotulo={ehPreparo ? `Custo/${String(ficha.rendimento_unidade || "un").toLowerCase()}` : "Custo/porção"} className="order-2">
                <span className="truncate text-sm font-black text-fg tabular-nums">{fmtBRL(ehPreparo ? resumo.custoPorcaoReceita : resumo.cmvValor)}</span>
              </Metrica>
              <Metrica rotulo="CMV" className="order-3">
                <span className={`text-sm font-black tabular-nums ${ehPreparo ? "text-subtle" : cmvAlto ? "text-red-600" : "text-fg"}`}>
                  {ehPreparo ? "—" : fmtPct(resumo.cmvPct)}
                </span>
              </Metrica>
              <Metrica rotulo={resumo.preco > 0 || ehPreparo ? "Venda" : "Sugerido"} className="order-1 sm:order-4">
                <span className={`truncate text-sm font-black tabular-nums ${resumo.preco > 0 ? "text-emerald-700" : "text-subtle"}`}>
                  {ehPreparo ? "—" : resumo.preco > 0 ? fmtBRL(resumo.preco) : resumo.precoSugerido ? fmtBRL(resumo.precoSugerido) : "—"}
                </span>
              </Metrica>
            </>
          ) : (
            <Metrica rotulo="Composição" className="order-2">
              <span className="truncate text-sm font-black text-fg">{(ficha.fichas_ingredientes || []).length} itens</span>
            </Metrica>
          )}
          <Metrica rotulo="Status" className="order-5 hidden sm:flex">{statusTexto}</Metrica>
        </div>

        {/* Ações: Editar e menu têm comportamento próprio (não abrem o card). */}
        <div data-controle className="relative flex shrink-0 items-center justify-end gap-1.5">
          {/* No celular o status divide a linha com os botões: card mais baixo. */}
          <span className="mr-auto sm:hidden">{statusTexto}</span>
          {acoes}
          <div className="hidden lg:block">{chevron}</div>
        </div>
      </div>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          {montado && (
            <div className="cursor-auto border-t border-line px-3 pb-4 pt-4 sm:px-4" onClick={e => e.stopPropagation()}>
              <DetalheFinanceiro ficha={ficha} resumo={resumo} rendimentoTexto={rendimentoTexto} podeVerCustos={podeVerCustos} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card aberto ────────────────────────────────────────────────────────────
// Todo valor sai como "R$ X · Y%" do preço de venda (valor-percentual.mjs), e
// cada grupo diz a natureza do número: ficha técnica, configurado, rateado ou
// estimado. Rateio nunca aparece como custo direto do prato.

function Titulo({ children }) {
  return <h4 className="mb-2 text-3xs font-black uppercase tracking-[0.14em] text-subtle">{children}</h4>;
}

function Natureza({ id }) {
  const n = NATUREZA[id];
  if (!n) return null;
  return (
    <span title={n.ajuda} className="ml-1.5 inline-block rounded border border-line px-1 align-middle text-3xs font-bold uppercase tracking-wide text-subtle">
      {n.rotulo}
    </span>
  );
}

// Uma linha "rótulo ............ R$ 7,83 · 12,63%". No celular, se o rótulo
// não couber ao lado, o valor desce inteiro para a linha de baixo — o número
// nunca é partido.
function Linha({ rotulo, valor, natureza = null, nota = null, destaque = false, tom = "", subtotal = false }) {
  return (
    <div className={`py-1.5 ${subtotal ? "border-y border-line bg-surface px-2" : "border-b border-line-soft last:border-b-0"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className={`min-w-0 text-xs text-fg-soft ${subtotal ? "font-black" : "font-semibold"}`}>{rotulo}<Natureza id={natureza} /></span>
        <span className={`ml-auto whitespace-nowrap text-right tabular-nums ${destaque || subtotal ? "text-sm font-black" : "text-xs font-bold"} ${tom || "text-fg"}`}>{valor}</span>
      </div>
      {/* A nota fica embaixo, na largura toda: ao lado do rótulo ela empurrava
          o valor para a linha de baixo. */}
      {nota ? <p className="mt-0.5 text-3xs font-medium leading-snug text-subtle">{nota}</p> : null}
    </div>
  );
}

function DetalheFinanceiro({ ficha, resumo, rendimentoTexto, podeVerCustos }) {
  if (!podeVerCustos) return <ComposicaoCusto resumo={resumo} comCusto={false} />;
  const ehPreparo = resumo.tipo === "preparo";
  const preco = resumo.preco;
  const unRend = String(ficha.rendimento_unidade || "un").toLowerCase();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0 space-y-5">
        <section>
          <Titulo>Resumo da ficha</Titulo>
          <Linha rotulo="Rendimento total" valor={rendimentoTexto} />
          {ehPreparo ? (
            <>
              <Linha rotulo="Custo total do lote" valor={fmtReais(resumo.custoReceita)} natureza="calculado" />
              <Linha rotulo={`Custo por ${unRend}`} valor={fmtReais(resumo.custoPorcaoReceita)} destaque natureza="calculado"
                nota="É este valor que entra nos pratos que usam este pré-preparo." />
            </>
          ) : (
            <>
              <Linha rotulo="Porções" valor={resumo.porcoesDefinidas ? resumo.porcoes.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "1"}
                nota={resumo.porcoesDefinidas ? null : "A ficha do prato é uma porção: o prato montado."} />
              <Linha rotulo="Custo total da ficha" valor={fmtValorPct(resumo.custoReceita, preco)} natureza="calculado" />
              {resumo.embalagemPorcao > 0 && <Linha rotulo="Embalagem por porção" valor={fmtValorPct(resumo.embalagemPorcao, preco)} />}
              <Linha rotulo="CMV por porção" valor={fmtValorPct(resumo.cmvValor, preco)} destaque natureza="calculado"
                tom={resumo.status.id === "cmv_alto" ? "text-red-600" : ""} nota={`Meta de CMV da ficha: ${fmtPct(resumo.meta)}`} />
              <Linha rotulo="Preço de venda" valor={preco > 0 ? `${fmtReais(preco)} · 100,00%` : "Sem preço"} destaque tom="text-emerald-700" />
              <Linha rotulo={`Preço sugerido (meta de lucro ${resumo.metaLucro ? fmtPct(resumo.metaLucro) : "—"})`} destaque
                valor={resumo.precoSugerido ? fmtReais(resumo.precoSugerido) : "—"}
                nota={resumo.precoSugerido
                  ? (resumo.composicao?.rateio?.ok
                      ? "Preço em que o resultado bate a meta, pagando CMV, despesas variáveis, CMO, despesas operacionais e pró-labore."
                      : "Sem rateio configurado: cobre CMV e despesas variáveis, mas ainda não CMO, despesas e pró-labore.")
                  : "Com essas despesas variáveis e essa meta não existe preço que feche a conta."} />
              <Linha rotulo={`Preço pela meta de CMV (${fmtPct(resumo.meta)})`} valor={resumo.precoPelaMetaCmv ? fmtReais(resumo.precoPelaMetaCmv) : "—"} />
            </>
          )}
        </section>

        {!ehPreparo && <ComposicaoPreco c={resumo.composicao} />}
      </div>

      <ComposicaoCusto resumo={resumo} comCusto />
    </div>
  );
}

const SEGMENTOS = [
  { id: "cmv", rotulo: "CMV", cor: "bg-slate-800" },
  { id: "variaveis", rotulo: "Desp. variáveis", cor: "bg-slate-600" },
  { id: "cmo", rotulo: "CMO", cor: "bg-slate-500" },
  { id: "operacionais", rotulo: "Desp. operacionais", cor: "bg-slate-400" },
  { id: "proLabore", rotulo: "Pró-labore", cor: "bg-slate-300" },
  { id: "resultado", rotulo: "Resultado", cor: "bg-emerald-500" },
];
const corDe = (id) => SEGMENTOS.find((s) => s.id === id)?.cor || "bg-slate-200";

// Grupo da composição: a linha do total e, ao tocar, as partes — cada uma
// também em R$ e % do preço de venda.
function Grupo({ g, aberto, onAlternar }) {
  const temPartes = (g.partes || []).length > 0;
  return (
    <div className="border-b border-line-soft last:border-b-0">
      <button type="button" onClick={temPartes ? onAlternar : undefined} aria-expanded={temPartes ? aberto : undefined}
        className={`flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-left ${temPartes ? "" : "cursor-default"}`}>
        <span className="flex min-w-0 items-baseline text-xs font-bold text-fg-soft">
          <span className={`mr-1.5 inline-block h-2 w-2 shrink-0 rounded-sm ${corDe(g.id)}`} />
          {g.rotulo}<Natureza id={g.natureza} />
          {temPartes && <ChevronDown size={12} className={`ml-1 shrink-0 self-center text-subtle transition-transform ${aberto ? "rotate-180" : ""}`} />}
        </span>
        <span className="ml-auto whitespace-nowrap text-right text-xs font-black tabular-nums text-fg">
          {g.motivo && g.valor === 0 ? "—" : `${fmtReais(g.valor)} · ${fmtPct(g.pct)}`}
        </span>
      </button>
      {g.motivo && g.valor === 0 && <p className="pb-1.5 pl-3.5 text-3xs font-semibold leading-snug text-subtle">{g.motivo}</p>}
      {aberto && temPartes && (
        <ul className="mb-1.5 ml-[3px] space-y-0.5 border-l border-line pl-3">
          {g.partes.map((p, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-3 text-2xs">
              <span className="min-w-0 font-medium text-fg-soft">
                {p.rotulo}
                {p.taxaPct ? <span className="text-subtle"> ({fmtPct(p.taxaPct)} da venda)</span> : null}
                {p.valorMes ? <span className="text-subtle"> · {fmtReais(p.valorMes)}/mês</span> : null}
              </span>
              <span className="ml-auto whitespace-nowrap font-bold tabular-nums text-fg">{fmtReais(p.valor)} · {fmtPct(p.pct)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ComposicaoPreco({ c }) {
  const [abertos, setAbertos] = useState(() => new Set());
  if (!c?.temPreco) {
    return (
      <section>
        <Titulo>Composição do preço de venda</Titulo>
        <p className="rounded-xl border border-line px-3 py-3 text-xs font-semibold text-fg-soft">Sem preço de venda no Cardápio: não há o que dividir.</p>
      </section>
    );
  }
  const alternar = (id) => setAbertos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const grupo = (g) => <Grupo key={g.id} g={g} aberto={abertos.has(g.id)} onAlternar={() => alternar(g.id)} />;
  const r = c.resultado;
  return (
    <section>
      <Titulo>Composição do preço · {fmtReais(c.preco)}</Titulo>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img"
        aria-label={SEGMENTOS.map((s) => `${s.rotulo} ${fmtPct((s.id === "resultado" ? r : c[s.id])?.pct)}`).join(", ")}>
        {c.barra.map((s) => <div key={s.id} className={`${corDe(s.id)} h-full`} style={{ width: `${s.largura}%` }} />)}
      </div>

      <div className="mt-2">
        {grupo(c.cmv)}
        {grupo(c.variaveis)}
        <Linha rotulo="Margem de contribuição" subtotal valor={`${fmtReais(c.margemContribuicao.valor)} · ${fmtPct(c.margemContribuicao.pct)}`}
          nota="Preço − CMV − despesas variáveis. Não é lucro: ainda paga CMO, despesas e pró-labore." />
        {grupo(c.cmo)}
        {grupo(c.operacionais)}
        {grupo(c.proLabore)}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t-2 border-line pt-2">
          <span className="flex min-w-0 items-baseline text-xs font-black uppercase tracking-wide text-fg">
            <span className={`mr-1.5 inline-block h-2 w-2 shrink-0 rounded-sm ${corDe("resultado")}`} />
            {r.rotulo}<Natureza id={r.natureza} />
          </span>
          <span className={`ml-auto whitespace-nowrap text-right text-sm font-black tabular-nums ${r.prejuizo ? "text-red-600" : "text-emerald-700"}`}>
            {fmtReais(r.valor)} · {fmtPct(r.pct)}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
          <span className="min-w-0 text-xs font-semibold text-fg-soft">Meta de lucro<Natureza id="configurado" /></span>
          <span className="ml-auto whitespace-nowrap text-right text-xs font-bold tabular-nums text-fg">
            {c.meta.pct === null ? "Não configurada" : (
              <>
                {fmtPct(c.meta.pct)}
                <span className={c.meta.diferencaPP >= 0 ? "text-emerald-700" : "text-red-600"}> · {fmtPP(c.meta.diferencaPP)}</span>
              </>
            )}
          </span>
        </div>
      </div>

      <p className="mt-2 text-2xs font-medium leading-snug text-subtle">
        {r.prejuizo ? `Prejuízo de ${fmtReais(-r.valor)} por unidade vendida. ` : ""}
        {c.rateio.ok ? `CMO, despesas operacionais e pró-labore entram por rateio ${c.rateio.descricao} — estimativa, não custo direto deste prato.` : c.rateio.motivo}
      </p>
    </section>
  );
}

function ComposicaoCusto({ resumo, comCusto }) {
  const linhas = resumo.linhas;
  const preco = resumo.preco;
  return (
    <section className="min-w-0">
      <Titulo>Composição do custo da ficha</Titulo>
      {linhas.length === 0 ? (
        <p className="rounded-xl border border-line px-3 py-3 text-xs font-semibold text-fg-soft">Ficha sem ingredientes.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[minmax(0,1fr)_80px_92px_118px] gap-2 bg-surface px-3 py-2 text-3xs font-bold uppercase tracking-wider text-subtle sm:grid">
            <span>Ingrediente</span><span className="text-right">Quantidade</span>
            {comCusto ? <><span className="text-right">Custo unit.</span><span className="text-right">Na ficha · % venda</span></> : <><span /><span /></>}
          </div>
          <ul className="divide-y divide-[color:var(--line-soft)]">
            {linhas.map((l, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_80px_92px_118px] sm:items-baseline">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-fg">
                    {l.nome}
                    {l.tipo === "preparo" && <span className="ml-1.5 rounded border border-amber-300 px-1 text-3xs font-bold uppercase text-amber-700">preparo</span>}
                  </p>
                  {comCusto && l.perdaPct > 0 && (
                    <p className="text-3xs font-medium text-subtle">
                      Perda {fmtPct(l.perdaPct, 1)} · compra {fmtReais(l.custoCompra)}/{l.unidadeBase} → efetivo {fmtReais(l.custoUnitario)}/{l.unidadeBase} · bruto {fmtQtd(l.quantidadeBruta, l.unidade)}
                    </p>
                  )}
                  {comCusto && l.fatorFicha > 0 && (
                    <p className="text-3xs font-medium text-subtle">Fator de correção da ficha +{fmtPct(l.fatorFicha, 1)} · bruto {fmtQtd(l.quantidadeBruta, l.unidade)}</p>
                  )}
                  {comCusto && l.empanado && <p className="text-3xs font-medium text-subtle">Empanado: custo por kg do produto pronto</p>}
                </div>
                <span className="text-right text-xs font-semibold tabular-nums text-fg-soft">
                  {l.tipo === "embalagem" ? "—" : fmtQtd(l.quantidade, l.unidade)}
                </span>
                {comCusto ? (
                  <>
                    <span className="text-2xs font-medium tabular-nums text-subtle sm:text-right sm:text-xs">
                      {l.tipo === "embalagem" ? "" : `${fmtBRL(l.custoUnitario, l.custoUnitario < 0.1 ? 4 : 2)}/${l.unidadeBase === "l" ? "L" : l.unidadeBase}`}
                    </span>
                    <span className="whitespace-nowrap text-right text-xs font-black tabular-nums text-fg">
                      {fmtReais(l.custo)}{preco > 0 && l.pctVenda !== null ? <span className="font-bold text-subtle"> · {fmtPct(l.pctVenda)}</span> : null}
                    </span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {comCusto && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 bg-surface px-3 py-2">
              <span className="text-2xs font-black uppercase tracking-wider text-fg-soft">Total da ficha</span>
              <span className="ml-auto whitespace-nowrap text-sm font-black tabular-nums text-fg">{fmtValorPct(resumo.custoReceita, preco)}</span>
            </div>
          )}
        </div>
      )}
      {comCusto && preco > 0 && resumo.porcoes !== 1 && (
        <p className="mt-1.5 text-3xs font-medium text-subtle">Percentual de cada linha: custo por porção (custo ÷ {resumo.porcoes.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} porções) sobre o preço de venda.</p>
      )}
    </section>
  );
}
