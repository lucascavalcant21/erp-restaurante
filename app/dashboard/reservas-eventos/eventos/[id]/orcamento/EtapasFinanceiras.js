"use client";

// Etapas 6, 7 e 9: custos financeiros e preço, DRE do evento e pagamentos
// recebidos (o orçamento para o cliente está em EtapaProposta.js). Contas em resumoDoOrcamento
// (evento-orcamento.mjs). O DRE aqui é só do evento: não lê nem escreve o DRE
// do restaurante.

import { useState } from "react";
import { Wand2, Info } from "lucide-react";
import { FORMAS_PAGAMENTO, SECOES, novoId, realizadoDoEvento } from "../../../../../lib/evento-orcamento.mjs";
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
      <Cartao titulo="Valor para o cliente" descricao="O sistema sugere o valor por pessoa que cobre todos os custos e ainda deixa sua meta de lucro líquido. Você decide o valor final.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Meta de lucro líquido" ajuda="Vem do Resultado do mês (Financeiro); mude só para este evento."><Numero valor={f.meta_lucro_pct} onChange={(v) => mudar({ meta_lucro_pct: v })} sufixo="%" /></Campo>
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
          <div className="space-y-3">
            <Campo rotulo={r.temMesa ? "Valor por pessoa (buffet e bar)" : "Valor por pessoa que vou passar ao cliente"}>
              <Numero valor={f.preco_por_pessoa} onChange={(v) => mudar({ preco_por_pessoa: v })} prefixo="R$" placeholder="0,00" className="[&_input]:h-14 [&_input]:text-xl [&_input]:font-black" />
            </Campo>
            {/* Mesa montada vendida como pacote fechado (pedido do dono, 03/11/2026). */}
            {r.temMesa && (
              <Campo rotulo="Mesa montada (pacote fechado)" ajuda={`Custo da mesa ${fmtReais(r.custoMesa)}${r.precoSugeridoMesa ? ` · para a meta, ${fmtReais(r.precoSugeridoMesa)}` : ""}`}>
                <Numero valor={f.preco_mesa} onChange={(v) => mudar({ preco_mesa: v })} prefixo="R$" placeholder="0,00" className="[&_input]:h-14 [&_input]:text-xl [&_input]:font-black" />
              </Campo>
            )}
          </div>
          <div className="space-y-1 self-center">
            {r.criancas > 0 && <LinhaValor rotulo={`${r.adultos} adultos + ${r.criancas} crianças (${fmtReais(r.precoCrianca)} cada)`} valor={fmtReais(r.receitaBruta)} />}
            {r.precoMesa > 0 && <LinhaValor rotulo="Mesa montada (pacote)" valor={fmtReais(r.precoMesa)} />}
            {r.desconto > 0 && <LinhaValor rotulo="Desconto" valor={`−${fmtReais(r.desconto)}`} />}
            <LinhaValor rotulo={`Total${r.convidados ? ` (${r.convidados} pessoas)` : ""}`} valor={fmtReais(r.receita)} />
            <LinhaValor forte rotulo="Meu lucro líquido" valor={r.receita > 0 ? vp(r.lucro, r.lucroPct) : "—"}
              tom={r.prejuizo ? "text-red-600" : r.meta.atingida ? "text-emerald-700" : "text-amber-700"} />
            {!(r.receita > 0) && <p className="text-xs font-semibold text-slate-600">Digite o valor ou toque em “Usar este valor” para ver o lucro líquido.</p>}
            {r.lucroPorPessoa !== null && <LinhaValor rotulo="Lucro por pessoa" valor={fmtReais(r.lucroPorPessoa)} />}
          </div>
        </div>
        {/* Para onde vai cada R$ que o cliente paga (pedido do dono, 28/10/2026: "melhore"). */}
        {r.receita > 0 && (() => {
          const fatias = [
            ["Cardápio", r.cmv, "#0f766e"], ["Equipe", r.equipe, "#2563eb"], ["Aluguel e extras", r.extras, "#7c3aed"],
            ["Impostos e cartão", r.imposto + r.maquininha, "#b45309"], ["Comissões e pró-labore", r.comissoesTotal + r.prolabore, "#64748b"],
            [r.lucro >= 0 ? "Lucro líquido" : "Prejuízo", Math.abs(r.lucro), r.lucro >= 0 ? "#15803d" : "#dc2626"],
          ].filter(([, v]) => v > 0);
          const base = fatias.reduce((t, [, v]) => t + v, 0) || 1;
          return (
            <div className="mt-5">
              <p className="text-sm font-black text-slate-900">Para onde vai o dinheiro do cliente</p>
              <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-slate-100">{fatias.map(([n, v, c]) => <span key={n} style={{ width: `${(v / base) * 100}%`, background: c }} title={n} />)}</div>
              <ul className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {fatias.map(([n, v, c]) => (
                  <li key={n} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold text-slate-700"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{n}</span>
                    <span className="font-black tabular-nums text-slate-900">{fmtReais(v)} <span className="text-xs font-bold text-slate-500">{fmtPct((v / r.receita) * 100)}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
      </Cartao>

      <Cartao titulo="Taxas" descricao="Saem do valor que o cliente paga. Vêm do Resultado do mês (Financeiro); mude se este evento for diferente (ex.: pago no PIX, sem maquininha).">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Impostos"><Numero valor={f.imposto_pct} onChange={(v) => mudar({ imposto_pct: v })} sufixo="%" /></Campo>
          <Campo rotulo="Taxa da maquininha"><Numero valor={f.maquininha_pct} onChange={(v) => mudar({ maquininha_pct: v })} sufixo="%" /></Campo>
        </div>
        {!(parseNumero(f.imposto_pct) > 0) && !(parseNumero(f.maquininha_pct) > 0) && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Impostos e cartão estão em 0%. Se o restaurante paga, preencha em <a href="/dashboard/financeiro/resultado" className="font-black underline">Financeiro → Resultado do mês</a> e todos os eventos novos já vêm com os valores.
          </p>
        )}
        {parseNumero(f.maquininha_pct) > 0 && (
          <button type="button" onClick={() => mudar({ maquininha_pct: "0" })} className="mt-3 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 hover:bg-slate-50">Cliente paga no PIX (sem maquininha)</button>
        )}
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
            Meta de lucro líquido: {fmtPct(r.meta.pct)} — {r.meta.atingida ? "atingida." : `abaixo da meta. Sugerido: ${r.precoSugeridoPorPessoa ? fmtReais(r.precoSugeridoPorPessoa) : "—"} por pessoa.`}
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
                <td className="px-2 py-2 text-slate-900">Lucro líquido</td>
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
          {r.lucroPorPessoa !== null && <LinhaValor forte rotulo="Lucro líquido por pessoa" valor={fmtReais(r.lucroPorPessoa)} tom={r.prejuizo ? "text-red-600" : "text-emerald-700"} />}
        </div>
      </Cartao>
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
    if (ok) setNovo({ valor: "", data: hoje, metodo: novo.metodo, obs: "Restante" });
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
      {/* Pagamentos mais rápidos (pedido do dono, 28/10/2026: "muda"): barra do
          que já entrou, atalhos de valor e forma/observação em botões. */}
      {r.receita > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm font-bold text-slate-700"><span>Pago</span><span>{fmtPct(Math.min(100, (recebido / r.receita) * 100), 0)}</span></div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (recebido / r.receita) * 100)}%` }} /></div>
        </div>
      )}
      <Cartao titulo="Registrar pagamento">
        <div className="space-y-4">
          {r.receita > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold text-slate-600">Valor rápido</p>
              <div className="flex flex-wrap gap-2">
                {[["Sinal 30%", r.receita * 0.3, "Sinal"], ["Sinal 50%", r.receita * 0.5, "Sinal"], ["Restante", Math.max(0, r.receita - recebido), "Restante"]].filter(([, v]) => v > 0.009).map(([rot, v, obs]) => (
                  <button key={rot} type="button" onClick={() => setNovo({ ...novo, valor: fmtNumBR(v), obs })} className="h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-black text-emerald-900 hover:bg-emerald-100">{rot} · {fmtReais(v)}</button>
                ))}
              </div>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Valor"><Numero valor={novo.valor} onChange={(v) => setNovo({ ...novo, valor: v })} prefixo="R$" placeholder="0,00" className="[&_input]:h-12 [&_input]:text-lg [&_input]:font-black" /></Campo>
            <Campo rotulo="Data"><input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })}
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" /></Campo>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-600">Forma</p>
            <div role="radiogroup" aria-label="Forma de pagamento" className="flex flex-wrap gap-2">
              {FORMAS_PAGAMENTO.map((fp) => (
                <button key={fp} type="button" role="radio" aria-checked={novo.metodo === fp} onClick={() => setNovo({ ...novo, metodo: fp })}
                  className={`h-10 rounded-xl border px-3 text-sm font-bold ${novo.metodo === fp ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>{fp}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-slate-600">É o quê?</p>
            <div className="flex flex-wrap items-center gap-2">
              {["Sinal", "Parcela", "Restante", "Pagamento total"].map((o) => (
                <button key={o} type="button" aria-pressed={novo.obs === o} onClick={() => setNovo({ ...novo, obs: o })}
                  className={`h-10 rounded-xl border px-3 text-sm font-bold ${novo.obs === o ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}>{o}</button>
              ))}
              <span className="min-w-[10rem] flex-1"><Texto valor={novo.obs} onChange={(v) => setNovo({ ...novo, obs: v })} placeholder="ou escreva" aria-label="Observação" /></span>
            </div>
          </div>
          <button type="button" onClick={registrar} disabled={salvando || !(parseNumero(novo.valor) > 0)} className="h-12 w-full rounded-xl bg-emerald-600 px-4 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-50">
            Registrar {parseNumero(novo.valor) > 0 ? fmtReais(parseNumero(novo.valor)) : "pagamento"}
          </button>
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
