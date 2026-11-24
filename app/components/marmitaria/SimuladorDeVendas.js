"use client";

// Simulador de vendas: quantos de cada item por dia, em quantos dias do mês, e
// quanto isso fatura e lucra. Nada grava venda. Contas em
// lib/marmitaria/painel-lucro.mjs. As quantidades ficam só neste navegador.

import { useMemo, useState } from "react";
import { useMarmitaria } from "./contexto";
import { Aviso, Campo, CampoNumero, Secao, Selo, brl, lerNumero, pctTxt } from "./ui";
import { ehMei } from "../../lib/marmitaria/cardapio.mjs";
import { limiteMei, simularVendas } from "../../lib/marmitaria/painel-lucro.mjs";
import SimulacoesSalvas from "./SimulacoesSalvas";
import { contribuicaoMedia, pontoDeEquilibrio } from "../../lib/metas-negocio.mjs";

const inteiro = (v) => Number(v || 0).toLocaleString("pt-BR");

/** Um grupo de custos com cada linha e o total. */
function Detalhe({ titulo, total, linhas = [], porMarmita = false }) {
  return (
    <details className="rounded-2xl border border-hf-border p-3" open={linhas.length > 0 && linhas.length <= 8}>
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-hf-text">{titulo}{linhas.length ? ` (${linhas.length})` : ""}</span>
        <b className="shrink-0 tabular-nums text-hf-text">{brl(total)}{porMarmita ? " por marmita" : ""}</b>
      </summary>
      {linhas.length > 0 ? (
        <ul className="mt-2 divide-y divide-hf-border">
          {linhas.map((l, i) => (
            <li key={`${l.nome}-${i}`} className="flex items-baseline justify-between gap-3 py-1.5 text-sm text-hf-text-2">
              <span className="min-w-0 truncate">{l.nome}</span><span className="shrink-0 tabular-nums">{brl(l.valor)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-xs text-hf-muted">Valor único, sem o detalhe por conta. Detalhe em Configurações.</p>}
    </details>
  );
}

/** "Para pagar tudo você tem que vender X marmitas" por mês, semana e dia (dono, 24/11/2026). */
function ParaPagarTudo({ linhas, embutidos, vendas30, diasMes }) {
  const media = contribuicaoMedia(linhas, vendas30);
  const eq = pontoDeEquilibrio({ cmoMes: embutidos?.cmoMes ?? null, fixosMes: embutidos?.fixosMes ?? null, diasMes, contribuicao: media?.contribuicao ?? null, ticket: media?.ticket ?? null });
  return (
    <Secao titulo="Quanto preciso vender para pagar tudo" subtitulo="Funcionários, custos fixos e os custos de cada marmita (produtos, embalagem, impostos e taxas)." direita={<Selo natureza="estimado" />}>
      {eq.ok ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[["Por mês", eq.unidadesMes, eq.faturamentoMes], ["Por semana", eq.unidadesSemana, (eq.faturamentoMes * 12) / 52], ["Por dia", eq.unidadesDia, eq.faturamentoDia]].map(([t, q, fat]) => (
              <div key={t} className="min-w-0 rounded-2xl bg-hf-elevated p-3">
                <p className="text-xs font-bold text-hf-text-2">{t}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-hf-text">{inteiro(q)}</p>
                <p className="text-xs text-hf-text-2">marmitas · {brl(fat)}</p>
              </div>
            ))}
          </div>
          {/* Os custos do mês um a um (dono, 24/11/2026: "por meus custos detalhados mensais conforme eu acrescento") */}
          <div className="mt-4 space-y-3">
            <Detalhe titulo="Funcionários no mês" total={eq.cmoMes} linhas={embutidos?.cmoLinhas?.length ? embutidos.cmoLinhas : embutidos?.cmoPartes || []} />
            <Detalhe titulo="Custos fixos no mês" total={eq.fixosMes} linhas={embutidos?.fixosLinhas || []} />
            {(embutidos?.variaveisLinhas || []).length > 0 && (
              <Detalhe titulo="Custos que saem em cada marmita" total={embutidos.variaveisPorMarmita} linhas={embutidos.variaveisLinhas} porMarmita />
            )}
            <a href="/dashboard/marmitaria/configuracoes" className="inline-flex min-h-[44px] items-center rounded-full border border-hf-border px-4 text-sm font-bold text-hf-text">+ Acrescentar ou mudar custos</a>
          </div>
          <div className="mt-4 rounded-2xl bg-hf-elevated p-3">
            <div className="flex items-baseline justify-between gap-3 text-sm text-hf-text-2"><span>Total do mês</span><b className="tabular-nums text-hf-text">{brl(eq.custoMes)}</b></div>
            <div className="mt-1 flex items-baseline justify-between gap-3 text-sm text-hf-text-2"><span>Cada marmita deixa, depois dos custos dela</span><b className="tabular-nums text-hf-text">{brl(eq.contribuicao)}</b></div>
            <p className="mt-2 border-t border-hf-border pt-2 text-base font-black text-hf-text">
              {brl(eq.custoMes)} ÷ {brl(eq.contribuicao)} = {inteiro(eq.unidadesMes)} marmitas no mês
            </p>
          </div>
          <p className="mt-2 text-sm text-hf-text-2">
            Acima de {inteiro(eq.unidadesDia)} por dia, cada marmita vira lucro. Conta com {diasMes} dias de venda no mês e {media.ponderada ? "a mistura do que vendeu nos últimos 30 dias" : "a média simples das marmitas (sem vendas lançadas nos últimos 30 dias)"}.
          </p>
        </>
      ) : <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: {eq.motivo} Preencha em <a href="/dashboard/marmitaria/configuracoes" className="font-bold underline">Configurações</a>.</p>}
    </Secao>
  );
}

const GRUPOS = [["marmitas", "Sozinhos"], ["combos", "Combos"], ["promocoes", "Promoções"]];
const ler = (chave) => { try { return JSON.parse(localStorage.getItem(chave) || "{}") || {}; } catch { return {}; } };
const gravar = (chave, valor) => { try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* segue na memória */ } };

function Periodo({ titulo, p }) {
  return (
    <div className="min-w-0 rounded-2xl bg-hf-elevated p-3">
      <p className="text-xs font-bold text-hf-text-2">{titulo}</p>
      <p className={`mt-1 text-xl font-black tabular-nums ${p.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>{brl(p.lucro)}</p>
      <p className="text-xs text-hf-text-2">de lucro · {brl(p.faturamento)} faturados</p>
    </div>
  );
}

function Conta({ r, v, forte }) {
  return <div className={`flex justify-between gap-3 py-1 ${forte ? "border-t border-hf-border pt-2 text-base font-black text-hf-text" : "text-sm text-hf-text-2"}`}><dt>{r}</dt><dd className="shrink-0 tabular-nums">{v}</dd></div>;
}

export default function SimuladorDeVendas({ linhas, embutidos, config, vendas30 = [] }) {
  const { unidadeId } = useMarmitaria();
  const chave = `hefisto:marmitaria:simulador:${unidadeId}`;
  const [salvo, setSalvo] = useState(() => { const s = ler(chave); return { dias: s.dias ?? "25", quantidades: s.quantidades || {} }; });
  const mudar = (novo) => { const prox = { ...salvo, ...novo }; setSalvo(prox); gravar(chave, prox); };
  const quantidades = useMemo(() => Object.fromEntries(Object.entries(salvo.quantidades).map(([k, v]) => [k, lerNumero(v) || 0])), [salvo.quantidades]);
  const s = useMemo(() => simularVendas({ linhas, quantidades, diasMes: lerNumero(salvo.dias), embutidos }), [linhas, quantidades, salvo.dias, embutidos]);
  const ano = new Date().getFullYear();
  const passaDoMei = ehMei(config) && s.faturamentoAno > limiteMei(ano);
  const tem = s.itens.length > 0;
  const atual = () => ({
    dias: lerNumero(salvo.dias) || 25, quantidades: salvo.quantidades,
    resultado: { resumo: `lucro ${brl(s.mes.lucro)}/mês`, mes: s.mes },
  });

  return (
    <div className="space-y-4">
      <ParaPagarTudo linhas={linhas} embutidos={embutidos} vendas30={vendas30} diasMes={lerNumero(salvo.dias) || Number(config?.rateio?.dias_operacao_mes) || null} />
      <Secao titulo="Simulações salvas" subtitulo="Salve com um nome para abrir depois, de qualquer aparelho.">
        <SimulacoesSalvas unidadeId={unidadeId} tipo="vendas" atual={atual} aoAbrir={(x) => mudar({ dias: x.dias, quantidades: x.quantidades })} />
      </Secao>
      <Secao titulo="Quanto vou vender" subtitulo="Coloque quantos pedidos de cada item por dia." direita={<Selo natureza="simulacao" />}>
        <Campo rotulo="Dias de venda no mês" className="mb-3 max-w-[200px]"><CampoNumero valor={salvo.dias} onChange={(v) => mudar({ dias: v })} placeholder="25" /></Campo>
        <div className="space-y-4">
          {GRUPOS.map(([sec, titulo]) => {
            const lista = linhas.filter((l) => l.secao === sec);
            if (!lista.length) return null;
            return (
              <div key={sec}>
                <p className="text-xs font-black uppercase tracking-wide text-hf-muted">{titulo}</p>
                <ul className="divide-y divide-hf-border">
                  {lista.map((l) => {
                    const sobra = l.lucro == null ? null : l.sim?.com?.margemContribuicao ?? null;
                    return (
                      <li key={l.id} className="grid grid-cols-[1fr_96px] items-center gap-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-hf-text">{l.nome}{l.rotulo && sec === "promocoes" ? ` · ${l.rotulo}` : ""}</p>
                          <p className={`text-xs ${sobra === null ? "font-semibold text-hf-warning" : "text-hf-muted"}`}>{sobra === null ? l.veredito?.rotulo || "Sem dados" : `${brl(l.precoPago)} · sobram ${brl(sobra)} por pedido`}</p>
                        </div>
                        <CampoNumero valor={salvo.quantidades[l.id] ?? ""} disabled={sobra === null} placeholder="0" aria-label={`Pedidos por dia de ${l.nome}`}
                          onChange={(v) => mudar({ quantidades: { ...salvo.quantidades, [l.id]: v } })} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {!linhas.length && <p className="text-sm text-hf-text-2">Monte as fichas técnicas e os preços no Cardápio para simular.</p>}
        </div>
      </Secao>

      {tem ? (
        <Secao titulo="Quanto vou ganhar" subtitulo={`${s.dia.pedidos.toLocaleString("pt-BR")} pedidos por dia, ${s.dias} dias no mês.`} direita={<Selo natureza="simulacao" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Periodo titulo="Por dia" p={s.dia} />
            <Periodo titulo="Por semana" p={s.semana} />
            <Periodo titulo="Por mês" p={s.mes} />
          </div>
          <dl className="mt-3">
            <Conta r="Faturamento do mês" v={brl(s.mes.faturamento)} />
            <Conta r="Produtos e embalagens" v={`− ${brl(s.mes.produtos)}`} />
            <Conta r="Impostos e taxas das plataformas" v={`− ${brl(s.mes.taxas)}`} />
            <Conta r="Equipe (uma vez no mês)" v={s.mes.equipe === null ? "falta dado" : `− ${brl(s.mes.equipe)}`} />
            <Conta r="Custos fixos (uma vez no mês)" v={s.mes.fixos === null ? "falta dado" : `− ${brl(s.mes.fixos)}`} />
            <Conta forte r={s.faltando.length ? `Lucro antes de ${s.faltando.join(" e ")}` : "Lucro do mês"} v={`${brl(s.mes.lucro)} · ${pctTxt(s.lucroPct)}`} />
          </dl>
          {s.pedidosParaEmpatar !== null && !s.faltando.length && <p className="mt-2 text-sm text-hf-text-2">Nessa mistura, <b className="tabular-nums text-hf-text">{s.pedidosParaEmpatar.toLocaleString("pt-BR")}</b> pedidos por dia pagam a equipe e os custos fixos.</p>}
          {s.semDados > 0 && <Aviso tipo="alerta" className="mt-3">{s.semDados} item(ns) ficaram fora da conta (DADOS INSUFICIENTES).</Aviso>}
          {passaDoMei && <Aviso tipo="alerta" className="mt-3">Esse volume daria {brl(s.faturamentoAno)} por ano, acima do limite do MEI ({brl(limiteMei(ano))} em {ano}, {brl(limiteMei(ano + 1))} em {ano + 1}). Com esse faturamento, a conta sem imposto deixa de valer: confirme com seu contador.</Aviso>}
        </Secao>
      ) : <Secao titulo="Quanto vou ganhar"><p className="text-sm text-hf-text-2">Coloque as quantidades acima para ver o resultado.</p></Secao>}
    </div>
  );
}
