"use client";

// Card da lista de Fichas Técnicas: compacto quando fechado, análise
// financeira completa quando aberto — sem modal e sem sair da página.
//
// Nenhuma conta mora aqui: tudo vem pronto em `resumo`, montado por
// resumoFinanceiroDaFicha (app/lib/ficha-financeiro.mjs). O card só desenha.

import { useEffect, useState } from "react";
import { ChevronDown, UtensilsCrossed } from "lucide-react";
import { fmtBRL } from "../../../../components/ui";

const fmtPct = (v, casas = 1) => (v === null || v === undefined || !Number.isFinite(v)
  ? "—"
  : `${v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`);

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

function Titulo({ children }) {
  return <h4 className="mb-2 text-3xs font-black uppercase tracking-[0.14em] text-subtle">{children}</h4>;
}

function Linha({ rotulo, valor, destaque = false, nota = null, tom = "" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft py-1.5 last:border-b-0">
      <span className="min-w-0 text-xs font-semibold text-fg-soft">
        {rotulo}
        {nota ? <span className="block text-3xs font-medium text-subtle">{nota}</span> : null}
      </span>
      <span className={`shrink-0 text-right tabular-nums ${destaque ? "text-sm font-black" : "text-xs font-bold"} ${tom || "text-fg"}`}>{valor}</span>
    </div>
  );
}

function DetalheFinanceiro({ ficha, resumo, rendimentoTexto, podeVerCustos }) {
  if (!podeVerCustos) return <ComposicaoCusto resumo={resumo} comCusto={false} />;
  const ehPreparo = resumo.tipo === "preparo";
  const c = resumo.composicao;
  const unRend = String(ficha.rendimento_unidade || "un").toLowerCase();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="min-w-0 space-y-5">
        <section>
          <Titulo>Resumo da ficha</Titulo>
          <Linha rotulo="Rendimento total" valor={rendimentoTexto} />
          {ehPreparo ? (
            <>
              <Linha rotulo="Custo total do lote" valor={fmtBRL(resumo.custoReceita)} />
              <Linha rotulo={`Custo por ${unRend}`} valor={fmtBRL(resumo.custoPorcaoReceita)} destaque
                nota="É este valor que entra nos pratos que usam este pré-preparo." />
            </>
          ) : (
            <>
              <Linha rotulo="Porções" valor={resumo.porcoesDefinidas ? resumo.porcoes.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : "1"}
                nota={resumo.porcoesDefinidas ? null : "A ficha do prato é uma porção: o prato montado."} />
              <Linha rotulo="Custo total da ficha" valor={fmtBRL(resumo.custoReceita)} />
              <Linha rotulo="Custo por porção (receita)" valor={fmtBRL(resumo.custoPorcaoReceita)} />
              {resumo.embalagemPorcao > 0 && <Linha rotulo="Embalagem por porção" valor={fmtBRL(resumo.embalagemPorcao)} />}
              <Linha rotulo="CMV" valor={`${fmtBRL(resumo.cmvValor)} · ${fmtPct(resumo.cmvPct, 2)}`} destaque
                tom={resumo.status.id === "cmv_alto" ? "text-red-600" : ""} nota={`Meta da ficha: ${fmtPct(resumo.meta, 0)}`} />
              <Linha rotulo="Preço de venda" valor={resumo.preco > 0 ? fmtBRL(resumo.preco) : "Sem preço"} destaque tom="text-emerald-700" />
              <Linha rotulo={`Preço sugerido (CMV ${fmtPct(resumo.meta, 0)})`} valor={resumo.precoSugerido ? fmtBRL(resumo.precoSugerido) : "—"} />
              {c?.temPreco && (
                <>
                  <Linha rotulo="Margem de contribuição" valor={`${fmtBRL(c.margemContribuicao.valor)} · ${fmtPct(c.margemContribuicao.pct, 2)}`}
                    nota="Preço − custos variáveis (CMV, imposto e maquininha)." />
                  <Linha rotulo={c.fixos.rateado ? "Lucro estimado" : "Sobra antes dos custos fixos"}
                    valor={`${fmtBRL(c.lucro.valor)} · ${fmtPct(c.lucro.pct, 2)}`} destaque
                    tom={c.lucro.prejuizo ? "text-red-600" : "text-emerald-700"}
                    nota={c.fixos.rateado ? "Preço − custos variáveis − custos fixos rateados." : "Os custos fixos ainda não foram rateados — isto ainda não é lucro."} />
                </>
              )}
            </>
          )}
        </section>

        {!ehPreparo && <ComposicaoPreco c={c} cmvPct={resumo.cmvPct} />}
      </div>

      <ComposicaoCusto resumo={resumo} comCusto />
    </div>
  );
}

const SEGMENTOS = {
  variaveis: { rotulo: "Custos variáveis", cor: "bg-slate-700" },
  fixos: { rotulo: "Custos fixos", cor: "bg-slate-400" },
  lucro: { rotulo: "Lucro", cor: "bg-emerald-500" },
};

function ComposicaoPreco({ c, cmvPct }) {
  if (!c?.temPreco) {
    return (
      <section>
        <Titulo>Composição do preço de venda</Titulo>
        <p className="rounded-xl border border-line px-3 py-3 text-xs font-semibold text-fg-soft">Sem preço de venda no Cardápio: não há o que dividir.</p>
      </section>
    );
  }
  const legenda = [
    { id: "variaveis", ...c.variaveis },
    { id: "fixos", ...c.fixos },
    { id: "lucro", ...c.lucro },
  ];
  return (
    <section>
      <Titulo>Composição do preço de venda · {fmtBRL(c.preco)}</Titulo>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" role="img"
        aria-label={`Custos variáveis ${fmtPct(c.variaveis.pct, 2)}, custos fixos ${fmtPct(c.fixos.pct, 2)}, ${c.lucro.rotulo.toLowerCase()} ${fmtPct(c.lucro.pct, 2)}`}>
        {c.barra.map(s => <div key={s.id} className={`${SEGMENTOS[s.id].cor} h-full`} style={{ width: `${s.largura}%` }} />)}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {legenda.map(s => (
          <div key={s.id} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${SEGMENTOS[s.id].cor}`} />
              <span className="truncate text-2xs font-bold text-fg-soft">{s.id === "lucro" ? c.lucro.rotulo : SEGMENTOS[s.id].rotulo}</span>
            </div>
            {s.id === "fixos" && !c.fixos.rateado ? (
              <p className="mt-0.5 text-2xs font-semibold leading-snug text-subtle">{c.fixos.motivo}</p>
            ) : (
              <>
                <p className={`mt-0.5 text-sm font-black tabular-nums ${s.id === "lucro" && c.lucro.prejuizo ? "text-red-600" : "text-fg"}`}>{fmtBRL(s.valor)}</p>
                <p className="text-2xs font-bold tabular-nums text-subtle">{fmtPct(s.pct, 2)}</p>
                {(s.partes || []).length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {s.partes.map(p => (
                      <li key={p.rotulo} className="flex justify-between gap-2 text-3xs font-medium leading-tight text-subtle">
                        <span className="min-w-0">{p.rotulo}</span><span className="shrink-0 tabular-nums">{fmtBRL(p.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-2xs font-medium leading-snug text-subtle">
        {c.lucro.prejuizo
          ? `Prejuízo de ${fmtBRL(-c.lucro.valor)} por porção: os custos passam do preço de venda.`
          : `CMV de ${fmtPct(cmvPct)} não quer dizer ${fmtPct(cmvPct === null ? null : 100 - cmvPct)} de lucro: imposto, maquininha${c.fixos.rateado ? ", custos fixos e mão de obra" : " e, quando rateados, os custos fixos"} também saem do preço.`}
      </p>
    </section>
  );
}

function ComposicaoCusto({ resumo, comCusto }) {
  const linhas = resumo.linhas;
  return (
    <section className="min-w-0">
      <Titulo>Composição do custo da ficha</Titulo>
      {linhas.length === 0 ? (
        <p className="rounded-xl border border-line px-3 py-3 text-xs font-semibold text-fg-soft">Ficha sem ingredientes.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[minmax(0,1fr)_88px_96px_84px] gap-2 bg-surface px-3 py-2 text-3xs font-bold uppercase tracking-wider text-subtle sm:grid">
            <span>Ingrediente</span><span className="text-right">Quantidade</span>
            {comCusto ? <><span className="text-right">Custo unit.</span><span className="text-right">Na ficha</span></> : <><span /><span /></>}
          </div>
          <ul className="divide-y divide-[color:var(--line-soft)]">
            {linhas.map((l, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_88px_96px_84px] sm:items-baseline">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-fg">
                    {l.nome}
                    {l.tipo === "preparo" && <span className="ml-1.5 rounded border border-amber-300 px-1 text-3xs font-bold uppercase text-amber-700">preparo</span>}
                  </p>
                  {comCusto && l.perdaPct > 0 && (
                    <p className="text-3xs font-medium text-subtle">
                      Perda {fmtPct(l.perdaPct)} · compra {fmtBRL(l.custoCompra)}/{l.unidadeBase} → efetivo {fmtBRL(l.custoUnitario)}/{l.unidadeBase} · bruto {fmtQtd(l.quantidadeBruta, l.unidade)}
                    </p>
                  )}
                  {comCusto && l.fatorFicha > 0 && (
                    <p className="text-3xs font-medium text-subtle">Fator de correção da ficha +{fmtPct(l.fatorFicha)} · bruto {fmtQtd(l.quantidadeBruta, l.unidade)}</p>
                  )}
                  {comCusto && l.empanado && <p className="text-3xs font-medium text-subtle">Empanado: custo por kg do produto pronto</p>}
                </div>
                <span className="text-right text-xs font-semibold tabular-nums text-fg-soft sm:order-none">
                  {l.tipo === "embalagem" ? "—" : fmtQtd(l.quantidade, l.unidade)}
                </span>
                {comCusto ? (
                  <>
                    <span className="text-2xs font-medium tabular-nums text-subtle sm:text-right sm:text-xs">
                      {l.tipo === "embalagem" ? "" : `${fmtBRL(l.custoUnitario, l.custoUnitario < 0.1 ? 4 : 2)}/${l.unidadeBase === "l" ? "L" : l.unidadeBase}`}
                    </span>
                    <span className="text-right text-xs font-black tabular-nums text-fg">{fmtBRL(l.custo)}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {comCusto && (
            <div className="flex items-baseline justify-between bg-surface px-3 py-2">
              <span className="text-2xs font-black uppercase tracking-wider text-fg-soft">Total da ficha</span>
              <span className="text-sm font-black tabular-nums text-fg">{fmtBRL(resumo.custoReceita)}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
