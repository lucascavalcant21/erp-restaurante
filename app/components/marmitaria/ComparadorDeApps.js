"use client";

// Simulador de vendas por app e comparativo entre eles (dono, 17/11/2026).
// As mesmas vendas em cada app, com o preço e as taxas de cada um; depois a
// mistura (quanto das vendas vai para cada app). As quantidades são as mesmas
// do "Simulador de vendas" (mesmo navegador). Contas em
// lib/marmitaria/comparar-apps.mjs. Nada grava venda: SIMULAÇÃO.

import { useMemo, useState } from "react";
import { useMarmitaria } from "./contexto";
import { Aviso, Campo, CampoNumero, Secao, Selo, brl, lerNumero, pctTxt } from "./ui";
import { catalogoParaCombo, cardapioDeVendas } from "../../lib/marmitaria/promocoes.mjs";
import { custoPorcaoDaFicha } from "../../lib/evento-financeiro.mjs";
import { compararApps, mixIgual } from "../../lib/marmitaria/comparar-apps.mjs";
import SimulacoesSalvas from "./SimulacoesSalvas";

const ler = (chave) => { try { return JSON.parse(localStorage.getItem(chave) || "{}") || {}; } catch { return {}; } };
const gravar = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* segue na memória */ } };
const GRUPOS = [["marmitas", "Sozinhos"], ["combos", "Combos"], ["promocoes", "Promoções"]];

function Linha({ r, v, forte = false, cor = "" }) {
  return <div className={`flex justify-between gap-3 py-1 ${forte ? "border-t border-hf-border pt-2 font-black text-hf-text" : "text-sm text-hf-text-2"}`}><dt>{r}</dt><dd className={`shrink-0 tabular-nums ${cor}`}>{v}</dd></div>;
}

export default function ComparadorDeApps({ canais, combos, ofertas, tributosPct, embutidos }) {
  const { base, custos, unidadeId } = useMarmitaria();
  const chaveSim = `hefisto:marmitaria:simulador:${unidadeId}`;
  const chaveMix = `hefisto:marmitaria:mix-apps:${unidadeId}`;
  const [sim, setSim] = useState(() => { const s = ler(chaveSim); return { dias: s.dias ?? "25", quantidades: s.quantidades || {} }; });
  const [mix, setMix] = useState(() => { const m = ler(chaveMix); return Object.keys(m).length ? m : mixIgual(canais); });
  const mudarSim = (novo) => { const prox = { ...ler(chaveSim), ...sim, ...novo }; setSim(prox); gravar(chaveSim, prox); };
  const mudarMix = (id, v) => { const prox = { ...mix, [id]: v }; setMix(prox); gravar(chaveMix, prox); };

  // as linhas do Cardápio calculadas em cada app (preço e taxas daquele app)
  const porCanal = useMemo(() => canais.map((canal) => {
    const catalogo = catalogoParaCombo({
      marmitas: base.marmitas, custos, fichas: base.fichas,
      custoFicha: (f) => { const c = custoPorcaoDaFicha(f, base.fichas); return c > 0 ? c : null; },
      canalId: canal.id,
    });
    return { canal, linhas: cardapioDeVendas({ catalogo, marmitas: base.marmitas, ofertas, combos, canal, tributosPct, embutidos, metaPct: null }) };
  }), [canais, base, custos, ofertas, combos, tributosPct, embutidos]);

  const quantidades = useMemo(() => Object.fromEntries(Object.entries(sim.quantidades).map(([k, v]) => [k, lerNumero(v) || 0])), [sim.quantidades]);
  const mixNum = useMemo(() => Object.fromEntries(Object.entries(mix).map(([k, v]) => [k, lerNumero(v) || 0])), [mix]);
  const c = useMemo(() => compararApps({ porCanal, quantidades, diasMes: lerNumero(sim.dias), embutidos, mix: mixNum }), [porCanal, quantidades, sim.dias, embutidos, mixNum]);

  // os itens: a união dos apps (o nome vem do primeiro app que tiver)
  const itens = useMemo(() => {
    const m = new Map();
    for (const { linhas } of porCanal) for (const l of linhas) if (!m.has(l.id)) m.set(l.id, l);
    return [...m.values()];
  }, [porCanal]);
  const tem = Object.values(quantidades).some((q) => q > 0);
  const atual = () => ({
    dias: lerNumero(sim.dias) || 25, quantidades: sim.quantidades, mix,
    resultado: { resumo: [c.melhor ? `melhor: ${c.melhor.nome}` : null, c.mistura?.lucroMes != null ? `lucro ${brl(c.mistura.lucroMes)}/mês` : null].filter(Boolean).join(" · "), apps: c.apps.map((a) => ({ id: a.id, sobraMes: a.sobraMes, lucroMes: a.lucroMes })), mistura: c.mistura ? { sobraMes: c.mistura.sobraMes, lucroMes: c.mistura.lucroMes } : null },
  });
  const abrir = (s) => { mudarSim({ dias: s.dias, quantidades: s.quantidades }); if (s.mix) { setMix(s.mix); gravar(chaveMix, s.mix); } };

  return (
    <div className="space-y-4">
      <Secao titulo="Simulações salvas" subtitulo="Salve com um nome para abrir depois, de qualquer aparelho.">
        <SimulacoesSalvas unidadeId={unidadeId} tipo="apps" atual={atual} aoAbrir={abrir} />
      </Secao>
      <Secao titulo="Quanto vou vender" subtitulo="Pedidos por dia de cada item. Os mesmos números valem para todos os apps." direita={<Selo natureza="simulacao" />}>
        <Campo rotulo="Dias de venda no mês" className="mb-3 max-w-[200px]"><CampoNumero valor={sim.dias} onChange={(v) => mudarSim({ dias: v })} placeholder="25" /></Campo>
        {GRUPOS.map(([sec, titulo]) => {
          const lista = itens.filter((l) => l.secao === sec);
          if (!lista.length) return null;
          return (
            <div key={sec} className="mb-3">
              <p className="text-xs font-black uppercase tracking-wide text-hf-muted">{titulo}</p>
              <ul className="divide-y divide-hf-border">
                {lista.map((l) => (
                  <li key={l.id} className="grid grid-cols-[1fr_96px] items-center gap-3 py-2">
                    <p className="min-w-0 text-sm font-bold text-hf-text">{l.nome}</p>
                    <CampoNumero valor={sim.quantidades[l.id] ?? ""} placeholder="0" aria-label={`Pedidos por dia de ${l.nome}`}
                      onChange={(v) => mudarSim({ quantidades: { ...sim.quantidades, [l.id]: v } })} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {!itens.length && <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: monte as fichas e os preços no Cardápio para comparar.</p>}
      </Secao>

      {!tem ? <Secao titulo="Comparativo entre apps"><p className="text-sm text-hf-text-2">Coloque as quantidades acima para comparar.</p></Secao> : (
        <>
          <Secao titulo="Comparativo entre apps" subtitulo={`Se todas as vendas fossem em um app só, no mês (${c.apps[0]?.dias ?? 25} dias).`} direita={<Selo natureza="simulacao" />}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {c.apps.map((a) => {
                const melhor = c.melhor?.id === a.id;
                return (
                  <div key={a.id} className={`min-w-0 rounded-2xl border p-4 ${melhor ? "border-hf-accent bg-hf-surface" : "border-hf-border bg-hf-elevated"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-base font-black text-hf-text">{a.nome}</p>
                      {melhor && <span className="rounded-full bg-hf-menu px-2.5 py-1 text-[11px] font-bold text-white">Melhor app</span>}
                    </div>
                    <p className={`mt-2 text-2xl font-black tabular-nums ${a.sobraMes < 0 ? "text-hf-danger" : "text-hf-text"}`}>{brl(a.sobraMes)}</p>
                    <p className="text-xs text-hf-muted">sobram no mês depois de produtos, impostos e taxas</p>
                    <dl className="mt-2">
                      <Linha r="Faturamento" v={brl(a.faturamentoMes)} />
                      <Linha r="Produtos e embalagens" v={`− ${brl(a.produtosMes)}`} />
                      <Linha r="Impostos e taxas do app" v={`− ${brl(a.taxasMes)}${a.taxasPct != null ? ` (${pctTxt(a.taxasPct)})` : ""}`} />
                      <Linha r="Sobra por pedido" v={a.sobraPorPedido != null ? brl(a.sobraPorPedido) : "—"} />
                      <Linha forte r={c.faltandoFixos ? "Lucro (falta equipe/fixos)" : "Lucro do mês"} v={a.lucroMes != null ? brl(a.lucroMes) : "DADOS INSUFICIENTES"} cor={a.lucroMes != null && a.lucroMes < 0 ? "text-hf-danger" : ""} />
                    </dl>
                    {a.diferencaParaMelhor != null && a.diferencaParaMelhor < 0 && <p className="mt-2 text-sm font-semibold text-hf-warning">{brl(Math.abs(a.diferencaParaMelhor))} a menos que no {c.melhor.nome}</p>}
                    {a.semPreco.length > 0 && <p className="mt-2 text-sm text-hf-warning">Sem preço neste app: {a.semPreco.join(", ")} (fora da conta).</p>}
                  </div>
                );
              })}
            </div>
            {!c.melhor && <Aviso tipo="alerta" className="mt-3">Nenhum app tem preço para todos os itens: preencha os preços no Cardápio para comparar de igual para igual.</Aviso>}
            {c.faltandoFixos && <Aviso tipo="info" className="mt-3">Equipe e custos fixos não estão configurados: a comparação mostra a sobra; o lucro do mês fica sem número.</Aviso>}
          </Secao>

          <Secao titulo="Mistura de apps" subtitulo="Que parte das vendas vai para cada app. Equipe e custos fixos entram uma vez." direita={<Selo natureza="simulacao" />}>
            <ul className="divide-y divide-hf-border">
              {canais.map((cn) => {
                const p = c.mistura?.partes.find((x) => x.id === cn.id);
                return (
                  <li key={cn.id} className="grid grid-cols-[1fr_88px] items-center gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-hf-text">{cn.nome}</p>
                      {p && p.pct > 0 && <p className="text-xs text-hf-muted">{p.pedidosDia.toLocaleString("pt-BR")} pedidos/dia · sobram {brl(p.sobraMes)} no mês</p>}
                    </div>
                    <CampoNumero valor={mix[cn.id] ?? ""} placeholder="0" aria-label={`% das vendas no ${cn.nome}`} onChange={(v) => mudarMix(cn.id, v)} />
                  </li>
                );
              })}
            </ul>
            {c.mistura ? (
              <>
                {!c.mistura.fechaEm100 && <Aviso tipo="alerta" className="mt-2">As partes somam {pctTxt(c.mistura.somaPct)}; o certo é 100%.</Aviso>}
                <dl className="mt-3">
                  <Linha r="Faturamento do mês" v={brl(c.mistura.faturamentoMes)} />
                  <Linha r="Impostos e taxas dos apps" v={`− ${brl(c.mistura.taxasMes)}`} />
                  <Linha r="Sobra (depois de produtos e taxas)" v={brl(c.mistura.sobraMes)} />
                  <Linha r="Equipe e custos fixos (uma vez)" v={c.faltandoFixos ? "falta dado" : `− ${brl((embutidos?.cmoMes || 0) + (embutidos?.fixosMes || 0))}`} />
                  <Linha forte r="Lucro do mês" v={c.mistura.lucroMes != null ? `${brl(c.mistura.lucroMes)} · ${pctTxt(c.mistura.lucroPct)}` : "DADOS INSUFICIENTES"} cor={c.mistura.lucroMes != null && c.mistura.lucroMes < 0 ? "text-hf-danger" : ""} />
                </dl>
                {c.mistura.ganhoNoMelhor > 0 && <p className="mt-2 text-sm text-hf-text-2">Se tudo fosse vendido no <b className="text-hf-text">{c.melhor.nome}</b>, sobrariam <b className="tabular-nums text-hf-text">{brl(c.mistura.ganhoNoMelhor)}</b> a mais por mês.</p>}
                {c.mistura.semPreco.length > 0 && <Aviso tipo="alerta" className="mt-2">Fora da conta (sem preço em algum app da mistura): {c.mistura.semPreco.join(", ")}.</Aviso>}
              </>
            ) : <p className="mt-2 text-sm text-hf-text-2">Coloque a % de cada app.</p>}
          </Secao>
        </>
      )}
    </div>
  );
}
