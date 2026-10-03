"use client";

// Etapas 3 a 5: equipe, aluguel/decoração/música/outros e dados do cliente.

import { AREAS_EQUIPE, CATEGORIAS_EXTRAS, FORMAS_PAGAMENTO, novoId } from "../../../../../lib/evento-orcamento.mjs";
import { fmtReais } from "../../../../../lib/valor-percentual.mjs";
import { parseNumero } from "../../../../../lib/ficha-calculos.mjs";
import { Cartao, Campo, Texto, Numero, Selecao, BotaoRemover, BotaoAdicionar, LinhaValor } from "./ui";

const n = (v) => Math.max(0, parseNumero(v));

export function EtapaEquipe({ orc, setOrc, resumo }) {
  const mudar = (id, m) => setOrc((o) => ({ ...o, equipe: o.equipe.map((p) => (p.id === id ? { ...p, ...m } : p)) }));
  const porArea = AREAS_EQUIPE.map((a) => {
    const lista = orc.equipe.filter((p) => (p.area || "Outros") === a);
    return { area: a, pessoas: lista.reduce((t, p) => t + (n(p.quantidade) || 1), 0), total: lista.reduce((t, p) => t + (n(p.quantidade) || 1) * n(p.valor), 0) };
  }).filter((x) => x.pessoas > 0);
  return (
    <div className="space-y-5">
      <Cartao titulo="Equipe do evento" descricao="Quem vai trabalhar, em qual área e quanto custa cada um. Para várias pessoas com o mesmo valor (ex.: 4 garçons), use a quantidade.">
        {orc.equipe.length === 0 && <p className="mb-3 text-sm font-medium text-slate-500">Ninguém escalado ainda.</p>}
        <ul className="space-y-3">
          {orc.equipe.map((p) => (
            <li key={p.id} className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-12 sm:items-end">
              <Campo rotulo="Área" className="sm:col-span-2"><Selecao valor={p.area} onChange={(v) => mudar(p.id, { area: v })} opcoes={AREAS_EQUIPE} /></Campo>
              <Campo rotulo="Função" className="sm:col-span-2"><Texto valor={p.funcao} onChange={(v) => mudar(p.id, { funcao: v })} placeholder="Garçom" /></Campo>
              <Campo rotulo="Nome" className="col-span-2 sm:col-span-3"><Texto valor={p.nome} onChange={(v) => mudar(p.id, { nome: v })} placeholder="Nome (opcional)" /></Campo>
              <Campo rotulo="Qtd." className="sm:col-span-1"><Numero valor={p.quantidade} onChange={(v) => mudar(p.id, { quantidade: v })} /></Campo>
              <Campo rotulo="Valor de cada" className="sm:col-span-2"><Numero valor={p.valor} onChange={(v) => mudar(p.id, { valor: v })} prefixo="R$" placeholder="0,00" /></Campo>
              <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-2">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Total</span>
                  <span className="block h-11 pt-2.5 text-sm font-black tabular-nums text-slate-900">{fmtReais((n(p.quantidade) || 1) * n(p.valor))}</span>
                </div>
                <BotaoRemover rotulo={`Remover ${p.nome || p.funcao || "pessoa"}`} onClick={() => setOrc((o) => ({ ...o, equipe: o.equipe.filter((x) => x.id !== p.id) }))} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <BotaoAdicionar onClick={() => setOrc((o) => ({ ...o, equipe: [...o.equipe, { id: novoId(), area: "Salão", funcao: "", nome: "", quantidade: "1", valor: "" }] }))}>Pessoa</BotaoAdicionar>
        </div>
      </Cartao>
      {porArea.length > 0 && (
        <Cartao titulo="Resumo da equipe">
          <div className="divide-y divide-slate-100">
            {porArea.map((a) => <LinhaValor key={a.area} rotulo={`${a.area} · ${a.pessoas} pessoa(s)`} valor={fmtReais(a.total)} />)}
            <LinhaValor forte rotulo={`Total · ${resumo.pessoasEquipe} pessoa(s)`} valor={fmtReais(resumo.equipe)} />
            {resumo.convidados > 0 && <LinhaValor rotulo="Por convidado" valor={fmtReais(resumo.equipe / resumo.convidados)} />}
          </div>
        </Cartao>
      )}
      <Cartao titulo="Observações para a equipe" descricao="Utensílios, uniforme, horário de chegada. Só uso interno.">
        <textarea value={orc.obs_equipe || ""} onChange={(e) => setOrc((o) => ({ ...o, obs_equipe: e.target.value }))} rows={3}
          className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" />
      </Cartao>
    </div>
  );
}

export function EtapaExtras({ orc, setOrc, resumo }) {
  const mudar = (id, m) => setOrc((o) => ({ ...o, extras: o.extras.map((x) => (x.id === id ? { ...x, ...m } : x)) }));
  const adicionar = (categoria) => setOrc((o) => ({ ...o, extras: [...o.extras, { id: novoId(), categoria, descricao: "", valor: "" }] }));
  return (
    <div className="space-y-5">
      {CATEGORIAS_EXTRAS.map((c) => {
        const itens = orc.extras.filter((x) => (x.categoria || "outros") === c.id);
        const total = resumo.extrasPorCategoria.find((x) => x.id === c.id)?.valor || 0;
        return (
          <Cartao key={c.id} titulo={c.rotulo} acoes={total > 0 && <span className="text-sm font-black tabular-nums text-slate-900">{fmtReais(total)}</span>}
            descricao={{ aluguel: "Espaço, mesas, cadeiras, louça, tendas.", decoracao: "Flores, painel, toalhas, iluminação.", musica: "DJ, banda, som.", outros: "Fretes, limpeza extra, gelo, brindes, qualquer outro custo." }[c.id]}>
            <ul className="space-y-2">
              {itens.map((x) => (
                <li key={x.id} className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
                  <Campo rotulo="Descrição" className="min-w-0 flex-1 basis-full sm:basis-auto"><Texto valor={x.descricao} onChange={(v) => mudar(x.id, { descricao: v })} placeholder={c.rotulo} /></Campo>
                  <Campo rotulo="Valor" className="w-40 flex-1 sm:flex-none"><Numero valor={x.valor} onChange={(v) => mudar(x.id, { valor: v })} prefixo="R$" placeholder="0,00" /></Campo>
                  <BotaoRemover rotulo={`Remover ${x.descricao || c.rotulo}`} onClick={() => setOrc((o) => ({ ...o, extras: o.extras.filter((y) => y.id !== x.id) }))} />
                </li>
              ))}
            </ul>
            <div className={itens.length ? "mt-3" : ""}><BotaoAdicionar onClick={() => adicionar(c.id)}>{c.rotulo}</BotaoAdicionar></div>
          </Cartao>
        );
      })}
      <Cartao>
        <LinhaValor forte rotulo="Total de aluguel e extras" valor={fmtReais(resumo.extras)} />
        {resumo.convidados > 0 && <LinhaValor rotulo="Por convidado" valor={fmtReais(resumo.extras / resumo.convidados)} />}
      </Cartao>
    </div>
  );
}

export function EtapaCliente({ orc, setOrc }) {
  const c = orc.cliente;
  const mudar = (m) => setOrc((o) => ({ ...o, cliente: { ...o.cliente, ...m } }));
  return (
    <Cartao titulo="Dados do cliente e do evento" descricao="Aparecem no orçamento que o cliente recebe.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome do cliente"><Texto valor={c.cliente_nome} onChange={(v) => mudar({ cliente_nome: v })} placeholder="Maria Souza" autoComplete="off" /></Campo>
        <Campo rotulo="WhatsApp do cliente" ajuda="Com DDD. É para onde o orçamento vai."><Texto valor={c.cliente_telefone} onChange={(v) => mudar({ cliente_telefone: v })} placeholder="(81) 99999-9999" inputMode="tel" autoComplete="off" /></Campo>
        <Campo rotulo="Nome do evento" className="sm:col-span-2"><Texto valor={c.nome_evento} onChange={(v) => mudar({ nome_evento: v })} placeholder="Aniversário de 30 anos" /></Campo>
        <Campo rotulo="Data do evento"><input type="date" value={c.data_evento || ""} onChange={(e) => mudar({ data_evento: e.target.value })}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" /></Campo>
        <Campo rotulo="Quantas pessoas"><Numero valor={c.convidados || ""} onChange={(v) => mudar({ convidados: v })} placeholder="100" /></Campo>
        <Campo rotulo="Início"><input type="time" value={c.hora_inicio || ""} onChange={(e) => mudar({ hora_inicio: e.target.value })}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" /></Campo>
        <Campo rotulo="Término"><input type="time" value={c.hora_fim || ""} onChange={(e) => mudar({ hora_fim: e.target.value })}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" /></Campo>
        <Campo rotulo="Local do evento" className="sm:col-span-2"><Texto valor={c.local_evento} onChange={(v) => mudar({ local_evento: v })} placeholder="No restaurante, ou o endereço" /></Campo>
        <Campo rotulo="Forma de pagamento"><Selecao valor={c.forma_pagamento} onChange={(v) => mudar({ forma_pagamento: v })} opcoes={[["", "A combinar"], ...FORMAS_PAGAMENTO.map((f) => [f, f]), ["50% de sinal + 50% no dia", "50% de sinal + 50% no dia"]]} /></Campo>
        <Campo rotulo="Observações para o cliente" className="sm:col-span-2">
          <textarea value={c.observacoes || ""} onChange={(e) => mudar({ observacoes: e.target.value })} rows={3} placeholder="Ex.: orçamento válido por 15 dias."
            className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" />
        </Campo>
      </div>
    </Cartao>
  );
}
