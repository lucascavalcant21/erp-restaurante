"use client";

// Etapas 6 a 9: custos financeiros e preço, DRE do evento, orçamento para o
// cliente e pagamentos recebidos. Contas em resumoDoOrcamento
// (evento-orcamento.mjs). O DRE aqui é só do evento: não lê nem escreve o DRE
// do restaurante.

import { useState } from "react";
import { Download, Send, Wand2, Info, CalendarDays, Clock, Users, MapPin } from "lucide-react";
import { SECOES, tipoDoEvento, cardapioParaCliente, textoDoOrcamento, linkWhatsApp, novoId, linhasDeValor, realizadoDoEvento } from "../../../../../lib/evento-orcamento.mjs";
import { parseNumero } from "../../../../../lib/ficha-calculos.mjs";
import { fmtReais, fmtPct } from "../../../../../lib/valor-percentual.mjs";
import { Cartao, Campo, Texto, Numero, ModoValor, BotaoRemover, BotaoAdicionar, LinhaValor, vp } from "./ui";

const fmtNumBR = (v) => (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EtapaFinanceiro({ orc, setOrc, resumo: r }) {
  const f = orc.financeiro;
  const mudar = (m) => setOrc((o) => ({ ...o, financeiro: { ...o.financeiro, ...m } }));
  const mudarComissao = (id, m) => mudar({ comissoes: f.comissoes.map((c) => (c.id === id ? { ...c, ...m } : c)) });
  const usarSugerido = () => r.precoSugeridoPorPessoa && mudar({ preco_por_pessoa: fmtNumBR(r.precoSugeridoPorPessoa) });
  return (
    <div className="space-y-5">
      <Cartao titulo="Taxas" descricao="Saem do valor que o cliente paga. Vêm das configurações da casa; mude se este evento for diferente (ex.: pago no PIX, sem maquininha).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Impostos"><Numero valor={f.imposto_pct} onChange={(v) => mudar({ imposto_pct: v })} sufixo="%" /></Campo>
          <Campo rotulo="Taxa da maquininha"><Numero valor={f.maquininha_pct} onChange={(v) => mudar({ maquininha_pct: v })} sufixo="%" /></Campo>
        </div>
      </Cartao>

      <Cartao titulo="Pró-labore e comissões" descricao="Cada um em valor fixo (R$) ou em porcentagem do valor do evento (%).">
        <div className="flex flex-wrap items-end gap-2">
          <Campo rotulo="Seu pró-labore neste evento" className="min-w-0 flex-1"><Numero valor={f.prolabore.valor} onChange={(v) => mudar({ prolabore: { ...f.prolabore, valor: v } })}
            prefixo={f.prolabore.modo === "valor" ? "R$" : undefined} sufixo={f.prolabore.modo === "pct" ? "%" : undefined} /></Campo>
          <ModoValor modo={f.prolabore.modo} onChange={(m) => mudar({ prolabore: { ...f.prolabore, modo: m } })} />
          <span className="h-11 w-28 pt-2.5 text-right text-sm font-black tabular-nums text-slate-900">{fmtReais(r.prolabore)}</span>
        </div>
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {f.comissoes.map((c) => (
            <div key={c.id} className="flex flex-wrap items-end gap-2">
              <Campo rotulo="Comissão de" className="min-w-0 flex-[2] basis-full sm:basis-auto"><Texto valor={c.nome} onChange={(v) => mudarComissao(c.id, { nome: v })} placeholder="Vendedor, cerimonialista..." /></Campo>
              <Campo rotulo="Valor" className="min-w-0 flex-1"><Numero valor={c.valor} onChange={(v) => mudarComissao(c.id, { valor: v })}
                prefixo={c.modo === "valor" ? "R$" : undefined} sufixo={c.modo === "pct" ? "%" : undefined} /></Campo>
              <ModoValor modo={c.modo} onChange={(m) => mudarComissao(c.id, { modo: m })} />
              <span className="h-11 w-28 pt-2.5 text-right text-sm font-black tabular-nums text-slate-900">{fmtReais(r.comissoes.find((x) => x.id === c.id)?.total || 0)}</span>
              <BotaoRemover rotulo={`Remover comissão ${c.nome || ""}`} onClick={() => mudar({ comissoes: f.comissoes.filter((x) => x.id !== c.id) })} />
            </div>
          ))}
          <BotaoAdicionar onClick={() => mudar({ comissoes: [...f.comissoes, { id: novoId(), nome: "", modo: "pct", valor: "" }] })}>Comissão</BotaoAdicionar>
        </div>
      </Cartao>

      <Cartao titulo="Crianças e desconto" descricao={r.criancas > 0 ? `${r.criancas} criança(s) de ${r.convidados} pessoas (informado na etapa Cliente).` : "Sem crianças informadas na etapa Cliente. O desconto vale para qualquer evento."}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Criança paga" ajuda={f.preco_crianca.modo === "pct" ? "% do valor do adulto" : "Valor fixo por criança"}>
            <div className="flex gap-2">
              <Numero valor={f.preco_crianca.valor} onChange={(v) => mudar({ preco_crianca: { ...f.preco_crianca, valor: v } })} className="flex-1"
                prefixo={f.preco_crianca.modo === "valor" ? "R$" : undefined} sufixo={f.preco_crianca.modo === "pct" ? "%" : undefined} />
              <ModoValor modo={f.preco_crianca.modo} onChange={(m) => mudar({ preco_crianca: { ...f.preco_crianca, modo: m } })} />
            </div>
          </Campo>
          <Campo rotulo="Criança come" ajuda="% do que um adulto come. Entra no custo e nas compras."><Numero valor={f.consumo_crianca_pct} onChange={(v) => mudar({ consumo_crianca_pct: v })} sufixo="%" /></Campo>
          <Campo rotulo="Desconto no total" ajuda={r.desconto > 0 ? `= ${fmtReais(r.desconto)}` : "Opcional."}>
            <div className="flex gap-2">
              <Numero valor={f.desconto.valor} onChange={(v) => mudar({ desconto: { ...f.desconto, valor: v } })} className="flex-1"
                prefixo={f.desconto.modo === "valor" ? "R$" : undefined} sufixo={f.desconto.modo === "pct" ? "%" : undefined} />
              <ModoValor modo={f.desconto.modo} onChange={(m) => mudar({ desconto: { ...f.desconto, modo: m } })} />
            </div>
          </Campo>
        </div>
      </Cartao>

      <Cartao titulo="Valor para o cliente" descricao="O sistema sugere o valor por pessoa que cobre todos os custos e ainda deixa sua meta de lucro limpo. Você decide o valor final.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Meta de lucro limpo" ajuda="Vem da Pizza do Lucro; mude só para este evento."><Numero valor={f.meta_lucro_pct} onChange={(v) => mudar({ meta_lucro_pct: v })} sufixo="%" /></Campo>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sugerido por pessoa</p>
            <p className="text-xl font-black tabular-nums text-slate-900">{r.precoSugeridoPorPessoa ? fmtReais(r.precoSugeridoPorPessoa) : "—"}</p>
            {r.precoSugeridoPorPessoa && (
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <button type="button" onClick={usarSugerido} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"><Wand2 size={12} /> Usar este valor</button>
                {r.precoSugeridoRedondo && r.precoSugeridoRedondo !== r.precoSugeridoPorPessoa && (
                  <button type="button" onClick={() => mudar({ preco_por_pessoa: fmtNumBR(r.precoSugeridoRedondo) })} className="text-xs font-bold text-emerald-700 hover:underline">Usar {fmtReais(r.precoSugeridoRedondo)} (redondo)</button>
                )}
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mínimo (lucro zero)</p>
            <p className="text-xl font-black tabular-nums text-slate-900">{r.precoMinimoPorPessoa ? fmtReais(r.precoMinimoPorPessoa) : "—"}</p>
            <p className="text-xs font-medium text-slate-500">Abaixo disso, prejuízo.</p>
          </div>
        </div>
        {!(r.convidados > 0) && <p className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-700"><Info size={16} /> Informe quantas pessoas (etapa Cliente) para calcular o valor sugerido.</p>}
        <div className="mt-5 grid gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 sm:grid-cols-2">
          <Campo rotulo="Valor por pessoa que vou passar ao cliente">
            <Numero valor={f.preco_por_pessoa} onChange={(v) => mudar({ preco_por_pessoa: v })} prefixo="R$" placeholder="0,00" className="[&_input]:h-14 [&_input]:text-xl [&_input]:font-black" />
          </Campo>
          <div className="space-y-1 self-center">
            {r.criancas > 0 && <LinhaValor rotulo={`${r.adultos} adultos + ${r.criancas} crianças (${fmtReais(r.precoCrianca)} cada)`} valor={fmtReais(r.receitaBruta)} />}
            {r.desconto > 0 && <LinhaValor rotulo="Desconto" valor={`−${fmtReais(r.desconto)}`} />}
            <LinhaValor rotulo={`Total${r.convidados ? ` (${r.convidados} pessoas)` : ""}`} valor={fmtReais(r.receita)} />
            <LinhaValor forte rotulo="Meu lucro limpo" valor={r.receita > 0 ? vp(r.lucro, r.lucroPct) : "—"}
              tom={r.prejuizo ? "text-red-600" : r.meta.atingida ? "text-emerald-700" : "text-amber-700"} />
            {r.lucroPorPessoa !== null && <LinhaValor rotulo="Lucro por pessoa" valor={fmtReais(r.lucroPorPessoa)} />}
          </div>
        </div>
      </Cartao>
    </div>
  );
}

export function EtapaDRE({ orc, setOrc, resumo: r, recebido = 0 }) {
  const real = realizadoDoEvento(orc, r, { recebido });
  const estilo = { receita: "font-black text-slate-900", subtotal: "font-black text-slate-900 bg-slate-50", resultado: "font-black text-base", custo: "font-semibold text-slate-700" };
  const taxasPP = r.convidados > 0 ? (r.imposto + r.maquininha + r.comissoesTotal + r.prolabore) / r.convidados : 0;
  return (
    <div className="space-y-5">
      <Cartao titulo="DRE do evento" descricao="Só deste evento. Não entra no DRE do restaurante.">
        {!(r.receita > 0) && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">Defina o valor por pessoa (etapa Financeiro) para ver as porcentagens.</p>}
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <th className="px-2 py-2">Linha</th><th className="px-2 py-2 text-right">R$</th><th className="px-2 py-2 text-right">% do evento</th><th className="px-2 py-2 text-right">Por pessoa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {r.dre.map((l) => (
                <tr key={l.id} className={estilo[l.tipo]}>
                  <td className={`px-2 py-2 ${l.tipo === "resultado" ? (r.prejuizo ? "text-red-600" : "text-emerald-700") : ""}`}>{l.rotulo}</td>
                  <td className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${l.tipo === "resultado" ? (r.prejuizo ? "text-red-600" : "text-emerald-700") : ""}`}>{fmtReais(l.valor)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{fmtPct(l.pct)}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{l.porPessoa !== null ? fmtReais(l.porPessoa) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {r.meta.pct > 0 && r.receita > 0 && (
          <p className={`mt-3 text-sm font-bold ${r.meta.atingida ? "text-emerald-700" : "text-amber-700"}`}>
            Meta de lucro limpo: {fmtPct(r.meta.pct)} — {r.meta.atingida ? "atingida." : `abaixo da meta. Sugerido: ${r.precoSugeridoPorPessoa ? fmtReais(r.precoSugeridoPorPessoa) : "—"} por pessoa.`}
          </p>
        )}
      </Cartao>

      <Cartao titulo="Orçado × realizado" descricao="Depois do evento, lance o que foi gasto de verdade. Linha em branco fica com o valor orçado.">
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <th className="px-2 py-2">Linha</th><th className="px-2 py-2 text-right">Orçado</th><th className="px-2 py-2 text-right">Realizado</th><th className="px-2 py-2 text-right">Diferença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {real.linhas.map((l) => {
                const ruim = l.receita ? l.diferenca < -0.009 : l.diferenca > 0.009;
                const bom = l.receita ? l.diferenca > 0.009 : l.diferenca < -0.009;
                return (
                  <tr key={l.id}>
                    <td className="px-2 py-1.5 font-semibold text-slate-700">{l.rotulo}{l.receita && real.recebido > 0 ? <span className="block text-[10px] font-bold uppercase text-slate-400">recebido até agora: {fmtReais(real.recebido)}</span> : null}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-600">{fmtReais(l.orcado)}</td>
                    <td className="px-2 py-1.5">
                      <Numero valor={orc.realizado?.[l.id] ?? ""} onChange={(v) => setOrc((o) => ({ ...o, realizado: { ...(o.realizado || {}), [l.id]: v } }))}
                        prefixo="R$" placeholder={fmtNumBR(l.real)} className="ml-auto w-36 [&_input]:h-9 [&_input]:text-right" aria-label={`${l.rotulo} realizado`} />
                    </td>
                    <td className={`whitespace-nowrap px-2 py-1.5 text-right font-bold tabular-nums ${ruim ? "text-red-600" : bom ? "text-emerald-700" : "text-slate-400"}`}>
                      {l.origem === "orcado" ? "—" : `${l.diferenca > 0 ? "+" : ""}${fmtReais(l.diferenca)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 font-black">
                <td className="px-2 py-2 text-slate-900">Lucro limpo</td>
                <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700">{fmtReais(real.lucroOrcado)}</td>
                <td className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${real.lucroReal < 0 ? "text-red-600" : "text-emerald-700"}`}>{fmtReais(real.lucroReal)}{real.lucroRealPct !== null ? <span className="block text-xs font-bold text-slate-500">{fmtPct(real.lucroRealPct)}</span> : null}</td>
                <td className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${real.diferencaLucro < -0.009 ? "text-red-600" : real.diferencaLucro > 0.009 ? "text-emerald-700" : "text-slate-400"}`}>{real.diferencaLucro > 0 ? "+" : ""}{fmtReais(real.diferencaLucro)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {real.lancadas === 0 && <p className="mt-2 text-xs font-medium text-slate-500">Nenhum custo real lançado ainda.</p>}
      </Cartao>

      <Cartao titulo="Custo por pessoa" descricao="Quanto custa cada produto por convidado, e o custo final por pessoa contra o valor que você escolheu.">
        <div className="divide-y divide-slate-100">
          {r.itens.map((i) => <LinhaValor key={i.id} rotulo={<>{i.nome} <span className="text-xs font-medium text-slate-500">· {SECOES[i.secao].rotulo}</span></>} valor={fmtReais(i.custoPorPessoa)} />)}
          <LinhaValor forte rotulo="Cardápio por pessoa" valor={fmtReais(r.cmvPorPessoa)} />
          {r.convidados > 0 && (
            <>
              <LinhaValor rotulo="Equipe por pessoa" valor={fmtReais(r.equipe / r.convidados)} />
              <LinhaValor rotulo="Aluguel e extras por pessoa" valor={fmtReais(r.extras / r.convidados)} />
              {r.receita > 0 && <LinhaValor rotulo="Taxas, comissões e pró-labore por pessoa" valor={fmtReais(taxasPP)} />}
              <LinhaValor forte rotulo="Custo por pessoa" valor={fmtReais(r.custoTotalPorPessoa ?? r.custoOperacaoPorPessoa)} />
            </>
          )}
          <LinhaValor forte rotulo={r.criancas > 0 || r.desconto > 0 ? "Valor médio por pessoa (com crianças e desconto)" : "Valor por pessoa para o cliente"}
            valor={r.precoPorPessoa > 0 ? fmtReais(r.criancas > 0 || r.desconto > 0 ? r.precoMedioPorPessoa : r.precoPorPessoa) : "—"} tom="text-emerald-700" />
          {r.lucroPorPessoa !== null && <LinhaValor forte rotulo="Lucro limpo por pessoa" valor={fmtReais(r.lucroPorPessoa)} tom={r.prejuizo ? "text-red-600" : "text-emerald-700"} />}
        </div>
      </Cartao>
    </div>
  );
}

const fmtData = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "A definir");

// Orçamento para o cliente: produtos e valor por pessoa. Nenhum custo aparece.
export function EtapaProposta({ orc, setOrc, resumo: r, casa }) {
  const prop = orc.proposta || {};
  const mudarProp = (m) => setOrc((o) => ({ ...o, proposta: { ...(o.proposta || {}), ...m } }));
  const validoAte = (() => {
    const dias = Math.round(parseNumero(prop.validade_dias));
    if (!(dias > 0)) return null;
    const d = new Date(); d.setDate(d.getDate() + dias);
    return d.toLocaleDateString("pt-BR");
  })();
  const c = orc.cliente;
  const grupos = cardapioParaCliente(orc);
  const enviar = () => window.open(linkWhatsApp(c.cliente_telefone, textoDoOrcamento(orc, r, { casa })), "_blank", "noopener");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800"><Download size={16} /> Baixar PDF</button>
        <button type="button" onClick={enviar} className="flex h-11 items-center gap-2 rounded-xl bg-[#1fa855] px-5 text-sm font-bold text-white hover:bg-[#188f47]"><Send size={16} /> Enviar pelo WhatsApp</button>
        <div className="grid basis-full gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[160px_1fr]">
          <Campo rotulo="Validade"><Numero valor={prop.validade_dias} onChange={(v) => mudarProp({ validade_dias: v })} sufixo="dias" /></Campo>
          <Campo rotulo="Condições" ajuda="Sinal, cancelamento, o que está incluso. Vai no PDF e no WhatsApp.">
            <textarea value={prop.condicoes || ""} onChange={(e) => mudarProp({ condicoes: e.target.value })} rows={2} placeholder="Ex.: reserva confirmada com 50% de sinal; cancelamento até 7 dias antes."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" />
          </Campo>
        </div>
        <p className="basis-full text-xs font-medium text-slate-500">No PDF, escolha “Salvar como PDF” na janela de impressão. O WhatsApp abre com o texto pronto{c.cliente_telefone ? "" : " (sem número: escolha o contato)"}; quem envia é você.</p>
      </div>

      <article id="orcamento-cliente" className="mx-auto w-full max-w-[800px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <header className="bg-slate-900 px-6 py-8 text-white sm:px-10 print:bg-slate-900" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">{casa || "Orçamento"}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{c.nome_evento || "Orçamento do evento"}</h1>
          {c.cliente_nome && <p className="mt-1 text-lg font-semibold text-slate-200">Para {c.cliente_nome}</p>}
          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/15 pt-5 text-sm sm:grid-cols-4">
            {[[CalendarDays, "Data", fmtData(c.data_evento)], [Clock, "Horário", c.hora_inicio ? `${c.hora_inicio}${c.hora_fim ? ` às ${c.hora_fim}` : ""}` : "A definir"],
              [Users, "Pessoas", r.convidados || "A definir"], [MapPin, "Local", c.local_evento || "A definir"]].map(([Icone, rot, val]) => (
              <div key={rot} className="min-w-0">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-300"><Icone size={12} /> {rot}</p>
                <p className="mt-0.5 break-words font-bold text-white">{val}</p>
              </div>
            ))}
          </div>
        </header>
        <div className="space-y-8 px-6 py-8 sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">Serviço: {tipoDoEvento(orc.tipo).rotulo}</p>
          {grupos.length === 0 && <p className="text-sm font-medium text-slate-500">O cardápio ainda não foi montado.</p>}
          {grupos.map((g) => (
            <section key={g.secao} className="break-inside-avoid">
              <h2 className="border-b border-slate-200 pb-2 text-lg font-black uppercase tracking-tight text-slate-900">{g.rotulo}</h2>
              <ul className="mt-3 space-y-2">
                {g.itens.map((i, k) => (
                  <li key={k}>
                    <p className="font-bold text-slate-900">{i.nome}</p>
                    {i.descricao && <p className="text-sm font-medium text-slate-600">{i.descricao}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="break-inside-avoid rounded-2xl bg-emerald-50 p-5" style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Valor por pessoa</p>
            <p className="text-3xl font-black tabular-nums text-emerald-900">{r.precoPorPessoa > 0 ? fmtReais(r.precoPorPessoa) : "A definir"}</p>
            {r.precoPorPessoa > 0 && linhasDeValor(r).slice(1).map((l) => <p key={l} className="mt-1 text-sm font-bold text-emerald-900">{l}</p>)}
            {c.forma_pagamento && <p className="mt-3 text-sm font-semibold text-slate-700">Forma de pagamento: {c.forma_pagamento}</p>}
          </section>
          {prop.condicoes && (
            <section className="break-inside-avoid">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Condições</h2>
              <p className="mt-1 whitespace-pre-line text-sm font-medium text-slate-700">{prop.condicoes}</p>
            </section>
          )}
          {c.observacoes && <p className="whitespace-pre-line text-sm font-medium text-slate-700">{c.observacoes}</p>}
          {validoAte && <p className="text-xs font-semibold text-slate-500">Orçamento válido até {validoAte}.</p>}
        </div>
      </article>
    </div>
  );
}

export function EtapaPagamentos({ pagamentos, salvarPagamentos, resumo: r, salvando }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [novo, setNovo] = useState({ valor: "", data: hoje, metodo: "PIX", obs: "Sinal" });
  const recebido = pagamentos.reduce((t, p) => t + (Number(p.valor) || 0), 0);
  const registrar = async () => {
    const valor = parseNumero(novo.valor);
    if (!(valor > 0)) return;
    const ok = await salvarPagamentos([...pagamentos, { ...novo, id: novoId(), valor }]);
    if (ok) setNovo({ valor: "", data: hoje, metodo: "PIX", obs: "" });
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Valor do evento", fmtReais(r.receita), "text-slate-900"], ["Recebido", fmtReais(recebido), "text-emerald-700"], ["Falta receber", fmtReais(Math.max(0, r.receita - recebido)), r.receita - recebido > 0.009 ? "text-amber-700" : "text-slate-900"]].map(([rot, val, tom]) => (
          <div key={rot} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{rot}</p>
            <p className={`text-xl font-black tabular-nums ${tom}`}>{val}</p>
          </div>
        ))}
      </div>
      <Cartao titulo="Registrar pagamento">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-12 sm:items-end">
          <Campo rotulo="Valor" className="sm:col-span-3"><Numero valor={novo.valor} onChange={(v) => setNovo({ ...novo, valor: v })} prefixo="R$" placeholder="0,00" /></Campo>
          <Campo rotulo="Data" className="sm:col-span-3"><input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" /></Campo>
          <Campo rotulo="Forma" className="sm:col-span-2"><Texto valor={novo.metodo} onChange={(v) => setNovo({ ...novo, metodo: v })} /></Campo>
          <Campo rotulo="Observação" className="sm:col-span-2"><Texto valor={novo.obs} onChange={(v) => setNovo({ ...novo, obs: v })} /></Campo>
          <button type="button" onClick={registrar} disabled={salvando} className="col-span-2 h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50 sm:col-span-2">Registrar</button>
        </div>
      </Cartao>
      <Cartao titulo="Pagamentos recebidos">
        {pagamentos.length === 0 ? <p className="text-sm font-medium text-slate-500">Nenhum pagamento registrado.</p> : (
          <ul className="divide-y divide-slate-100">
            {pagamentos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="text-sm font-bold text-slate-900">{p.data ? new Date(`${String(p.data).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</span>
                <span className="text-sm font-semibold text-slate-700">{p.metodo}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{p.obs}</span>
                <span className="whitespace-nowrap text-sm font-black tabular-nums text-emerald-700">{fmtReais(p.valor)}</span>
                <BotaoRemover rotulo="Remover pagamento" onClick={() => salvarPagamentos(pagamentos.filter((x) => x.id !== p.id))} />
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}
