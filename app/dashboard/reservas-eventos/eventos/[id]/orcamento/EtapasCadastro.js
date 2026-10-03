"use client";

// Etapas 3 a 5: equipe, aluguel/decoração/música/outros e dados do cliente.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search, History } from "lucide-react";
import { AREAS_EQUIPE, CATEGORIAS_EXTRAS, FORMAS_PAGAMENTO, novoId, custoDaPessoa } from "../../../../../lib/evento-orcamento.mjs";
import { rotuloEtapa, normalizarEtapa } from "../../../../../lib/evento-financeiro.mjs";
import { fmtReais } from "../../../../../lib/valor-percentual.mjs";
import { parseNumero } from "../../../../../lib/ficha-calculos.mjs";
import { mascaraTelefone } from "../../../../../lib/mascaras.mjs";
import { supabase } from "../../../../../lib/supabase";
import { Cartao, Campo, Texto, Numero, Selecao, BotaoRemover, BotaoAdicionar, LinhaValor } from "./ui";

const n = (v) => Math.max(0, parseNumero(v));
const qtdDe = (p) => (p.quantidade === "" || p.quantidade === undefined ? 1 : n(p.quantidade));
const inputData = "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500";

export function EtapaEquipe({ orc, setOrc, resumo, sugestoesEquipe = [], conflitos = [] }) {
  const mudar = (id, m) => setOrc((o) => ({ ...o, equipe: o.equipe.map((p) => (p.id === id ? { ...p, ...m } : p)) }));
  // Nome digitado igual a alguém de eventos anteriores: completa área, função e valor vazios.
  const mudarNome = (p, nome) => {
    const s = sugestoesEquipe.find((x) => x.nome.toLowerCase() === nome.trim().toLowerCase());
    if (!s) return mudar(p.id, { nome });
    mudar(p.id, { nome: s.nome, funcao: p.funcao || s.funcao, area: p.funcao || p.valor ? p.area : s.area || p.area, modo: p.valor ? p.modo : s.modo, valor: p.valor || s.valor, horas: p.horas || s.horas });
  };
  const porArea = AREAS_EQUIPE.map((a) => {
    const lista = orc.equipe.filter((p) => (p.area || "Outros") === a);
    return { area: a, pessoas: lista.reduce((t, p) => t + qtdDe(p), 0), total: lista.reduce((t, p) => t + custoDaPessoa(p), 0) };
  }).filter((x) => x.pessoas > 0);
  return (
    <div className="space-y-5">
      {conflitos.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>Já escalado(a) em outro evento no mesmo dia: {conflitos.map((c, i) => (
            <span key={i}>{i > 0 ? ", " : ""}<strong>{c.nome}</strong> (<Link href={`/dashboard/reservas-eventos/eventos/${c.eventoId}`} className="underline">{c.evento}</Link>)</span>
          ))}.</span>
        </div>
      )}
      <Cartao titulo="Equipe do evento" descricao="Quem vai trabalhar, em qual área e quanto custa. Pague por diária ou por hora. Para várias pessoas com o mesmo valor (ex.: 4 garçons), use a quantidade.">
        {orc.equipe.length === 0 && <p className="mb-3 text-sm font-medium text-slate-500">Ninguém escalado ainda.</p>}
        <datalist id="sugestoes-equipe">{sugestoesEquipe.map((s) => <option key={s.nome} value={s.nome}>{[s.area, s.funcao].filter(Boolean).join(" · ")}</option>)}</datalist>
        <ul className="space-y-3">
          {orc.equipe.map((p) => (
            <li key={p.id} className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 p-3 sm:grid-cols-12 sm:items-end">
              <Campo rotulo="Nome" className="col-span-2 sm:col-span-4"><Texto valor={p.nome} onChange={(v) => mudarNome(p, v)} placeholder="Nome (opcional)" list="sugestoes-equipe" autoComplete="off" /></Campo>
              <Campo rotulo="Área" className="sm:col-span-2"><Selecao valor={p.area} onChange={(v) => mudar(p.id, { area: v })} opcoes={AREAS_EQUIPE} /></Campo>
              <Campo rotulo="Função" className="sm:col-span-3"><Texto valor={p.funcao} onChange={(v) => mudar(p.id, { funcao: v })} placeholder="Garçom" /></Campo>
              <Campo rotulo="Qtd." className="sm:col-span-1"><Numero valor={p.quantidade} onChange={(v) => mudar(p.id, { quantidade: v })} /></Campo>
              <Campo rotulo="Pago por" className="sm:col-span-2"><Selecao valor={p.modo || "diaria"} onChange={(v) => mudar(p.id, { modo: v })} opcoes={[["diaria", "Diária"], ["hora", "Hora"]]} /></Campo>
              {p.modo === "hora" && <Campo rotulo="Horas" className="sm:col-span-2"><Numero valor={p.horas} onChange={(v) => mudar(p.id, { horas: v })} sufixo="h" /></Campo>}
              <Campo rotulo={p.modo === "hora" ? "Valor da hora" : "Valor da diária"} className="sm:col-span-3"><Numero valor={p.valor} onChange={(v) => mudar(p.id, { valor: v })} prefixo="R$" placeholder="0,00" /></Campo>
              <div className={`col-span-2 flex items-end justify-between gap-2 ${p.modo === "hora" ? "sm:col-span-7" : "sm:col-span-9"}`}>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Total</span>
                  <span className="block h-11 pt-2.5 text-sm font-black tabular-nums text-slate-900">{fmtReais(custoDaPessoa(p))}</span>
                </div>
                <BotaoRemover rotulo={`Remover ${p.nome || p.funcao || "pessoa"}`} onClick={() => setOrc((o) => ({ ...o, equipe: o.equipe.filter((x) => x.id !== p.id) }))} />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <BotaoAdicionar onClick={() => setOrc((o) => ({ ...o, equipe: [...o.equipe, { id: novoId(), area: "Salão", funcao: "", nome: "", quantidade: "1", modo: "diaria", horas: "", valor: "" }] }))}>Pessoa</BotaoAdicionar>
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

// Busca no cadastro de clientes (CRM) pelo nome ou pelos últimos dígitos do telefone.
function BuscaCliente({ unidadeAtiva, onEscolher }) {
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState([]);
  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2 || !unidadeAtiva) { setLista([]); return; }
    let ativo = true;
    const id = setTimeout(async () => {
      const digitos = t.replace(/\D/g, "");
      const filtro = digitos.length >= 4 ? `telefone.ilike.%${digitos.slice(-4)}%,nome.ilike.%${t}%` : `nome.ilike.%${t}%`;
      const { data, error } = await supabase.from("clientes").select("id, nome, telefone").eq("unidade_id", unidadeAtiva).or(filtro).limit(8);
      if (ativo) setLista(error ? [] : data || []);
    }, 300);
    return () => { ativo = false; clearTimeout(id); };
  }, [termo, unidadeAtiva]);
  return (
    <div className="relative">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={termo} onChange={(e) => setTermo(e.target.value.replace(/[,()%]/g, ""))} placeholder="Buscar no cadastro de clientes (nome ou telefone)"
        aria-label="Buscar no cadastro de clientes"
        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" />
      {lista.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {lista.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { onEscolher(c); setTermo(""); setLista([]); }} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-emerald-50">
                <span className="truncate text-sm font-bold text-slate-900">{c.nome}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-500">{c.telefone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EtapaCliente({ orc, setOrc, unidadeAtiva, historico = [] }) {
  const c = orc.cliente;
  const mudar = (m) => setOrc((o) => ({ ...o, cliente: { ...o.cliente, ...m } }));
  return (
    <div className="space-y-5">
      <Cartao titulo="Dados do cliente e do evento" descricao="Aparecem no orçamento que o cliente recebe.">
        <div className="mb-4"><BuscaCliente unidadeAtiva={unidadeAtiva} onEscolher={(x) => mudar({ cliente_id: x.id, cliente_nome: x.nome || "", cliente_telefone: mascaraTelefone(x.telefone || "") })} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do cliente"><Texto valor={c.cliente_nome} onChange={(v) => mudar({ cliente_nome: v, cliente_id: null })} placeholder="Maria Souza" autoComplete="off" /></Campo>
          <Campo rotulo="WhatsApp do cliente" ajuda="Com DDD. É para onde o orçamento vai."><Texto valor={c.cliente_telefone} onChange={(v) => mudar({ cliente_telefone: mascaraTelefone(v) })} placeholder="(81) 99999-9999" inputMode="tel" autoComplete="off" /></Campo>
          <Campo rotulo="Nome do evento" className="sm:col-span-2"><Texto valor={c.nome_evento} onChange={(v) => mudar({ nome_evento: v })} placeholder="Aniversário de 30 anos" /></Campo>
          <Campo rotulo="Data do evento"><input type="date" value={c.data_evento || ""} onChange={(e) => mudar({ data_evento: e.target.value })} className={inputData} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Total de pessoas"><Numero valor={c.convidados || ""} onChange={(v) => mudar({ convidados: v })} placeholder="100" /></Campo>
            <Campo rotulo="Destas, crianças" ajuda="Preço e consumo em Custos e preço."><Numero valor={c.criancas || ""} onChange={(v) => mudar({ criancas: v })} placeholder="0" /></Campo>
          </div>
          <Campo rotulo="Início"><input type="time" value={c.hora_inicio || ""} onChange={(e) => mudar({ hora_inicio: e.target.value })} className={inputData} /></Campo>
          <Campo rotulo="Término"><input type="time" value={c.hora_fim || ""} onChange={(e) => mudar({ hora_fim: e.target.value })} className={inputData} /></Campo>
          <Campo rotulo="Local do evento" className="sm:col-span-2"><Texto valor={c.local_evento} onChange={(v) => mudar({ local_evento: v })} placeholder="No restaurante, ou o endereço" /></Campo>
          <Campo rotulo="Forma de pagamento"><Selecao valor={c.forma_pagamento} onChange={(v) => mudar({ forma_pagamento: v })} opcoes={[["", "A combinar"], ...FORMAS_PAGAMENTO.map((f) => [f, f]), ["50% de sinal + 50% no dia", "50% de sinal + 50% no dia"]]} /></Campo>
          <Campo rotulo="Observações para o cliente" className="sm:col-span-2">
            <textarea value={c.observacoes || ""} onChange={(e) => mudar({ observacoes: e.target.value })} rows={3} placeholder="Ex.: inclui louça e toalhas."
              className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium text-slate-900 outline-none focus:border-emerald-500" />
          </Campo>
        </div>
      </Cartao>
      {historico.length > 0 && (
        <Cartao titulo={<span className="flex items-center gap-2"><History size={18} className="text-emerald-600" /> Outros eventos deste cliente</span>}>
          <ul className="divide-y divide-slate-100">
            {historico.map((h) => (
              <li key={h.id}>
                <Link href={`/dashboard/reservas-eventos/eventos/${h.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:text-emerald-800">
                  <span className="text-sm font-bold text-slate-900">{h.data ? new Date(`${h.data}T12:00:00`).toLocaleDateString("pt-BR") : "sem data"}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{h.nome}</span>
                  <span className="text-xs font-semibold text-slate-500">{rotuloEtapa(normalizarEtapa(h.etapa))}{h.pessoas ? ` · ${h.pessoas} pessoas` : ""}</span>
                  <span className="whitespace-nowrap text-sm font-black tabular-nums text-slate-900">{h.valor > 0 ? fmtReais(h.valor) : "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Cartao>
      )}
    </div>
  );
}
