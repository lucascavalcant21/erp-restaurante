"use client";

// Etapas 1 e 2: tipo do evento e cardápio. Cada produto vem de uma ficha
// técnica do sistema ou de uma ficha exclusiva criada aqui, com ingredientes
// que só existem neste evento (não aparecem nas fichas do restaurante).

import { useMemo, useState } from "react";
import { Search, ChefHat, Wine, FlaskConical, ChevronDown, ChevronUp, UtensilsCrossed, Soup, Sparkles } from "lucide-react";
import {
  TIPOS_EVENTO, SECOES, UNIDADES, tipoDoEvento, ingredienteVazio, custoDaFichaExclusiva, novoId,
} from "../../../../../lib/evento-orcamento.mjs";
import { custoPorcaoDaFicha } from "../../../../../lib/evento-financeiro.mjs";
import { tipoFichaDe, setorId } from "../../../../../lib/ficha-modelo.mjs";
import { fmtReais } from "../../../../../lib/valor-percentual.mjs";
import { Cartao, Campo, Texto, Numero, Selecao, BotaoRemover, BotaoAdicionar } from "./ui";

const ICONE_TIPO = { buffet: Soup, alacarte: UtensilsCrossed, unico: Sparkles };

export function EtapaTipo({ orc, setOrc }) {
  return (
    <Cartao titulo="Que tipo de evento é?" descricao="Isso define como o cardápio é montado e como aparece no orçamento do cliente. Dá para trocar depois.">
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tipo do evento">
        {TIPOS_EVENTO.map((t) => {
          const Icone = ICONE_TIPO[t.id];
          const ativo = orc.tipo === t.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={ativo} onClick={() => setOrc((o) => ({ ...o, tipo: t.id }))}
              className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-colors ${ativo ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${ativo ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}><Icone size={20} /></span>
              <strong className="text-base font-black text-slate-900">{t.rotulo}</strong>
              <span className="text-sm font-medium text-slate-600">{t.ajuda}</span>
              <span className="mt-auto flex flex-wrap gap-1 pt-1">
                {t.secoes.map((s) => <span key={s} className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{SECOES[s].rotulo}</span>)}
              </span>
            </button>
          );
        })}
      </div>
    </Cartao>
  );
}

// Busca de ficha técnica para a seção (bar → fichas do bar; comida → cozinha).
function BuscaFicha({ fichas, setor, onEscolher, onFechar }) {
  const [busca, setBusca] = useState("");
  const opcoes = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (fichas || [])
      .filter((f) => tipoFichaDe(f) !== "pre_preparo")
      .filter((f) => !setor || setorId(f.departamento) === setor)
      .filter((f) => !t || String(f.nome_receita || "").toLowerCase().includes(t))
      .slice(0, 30);
  }, [fichas, setor, busca]);
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ficha ${setor === "bar" ? "do bar" : setor === "cozinha" ? "da cozinha" : ""}...`}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" />
      </div>
      <ul className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl bg-white">
        {opcoes.length === 0 && <li className="p-4 text-center text-sm font-semibold text-slate-500">Nenhuma ficha encontrada.</li>}
        {opcoes.map((f) => {
          const c = custoPorcaoDaFicha(f, fichas);
          return (
            <li key={f.id}>
              <button type="button" onClick={() => onEscolher(f)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-emerald-50">
                <span className="min-w-0 truncate text-sm font-bold text-slate-900">{f.nome_receita}</span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-slate-600">{c > 0 ? `${fmtReais(c)} / porção` : "sem custo"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={onFechar} className="mt-2 text-sm font-bold text-slate-600 hover:text-slate-900">Fechar</button>
    </div>
  );
}

// Ingredientes da ficha exclusiva — quantidades para UMA porção.
function EditorExclusiva({ item, alterarItem }) {
  const c = custoDaFichaExclusiva(item.ingredientes);
  const porId = new Map(c.linhas.map((l) => [l.id, l]));
  const mudarIng = (id, campo, valor) => alterarItem({ ingredientes: item.ingredientes.map((g) => (g.id === id ? { ...g, [campo]: valor } : g)) });
  return (
    <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-3 sm:p-4">
      <p className="mb-3 text-xs font-semibold text-violet-900">
        Ingredientes para <strong>uma porção</strong> (um prato, um drink). Informe a embalagem como você compra e quanto vai na porção. Estes ingredientes ficam só neste evento.
      </p>
      <div className="space-y-3">
        {item.ingredientes.map((g) => {
          const l = porId.get(g.id);
          return (
            <div key={g.id} className="grid grid-cols-2 gap-x-2 gap-y-3 rounded-xl border border-violet-100 bg-white p-3 sm:grid-cols-12 sm:items-start">
              <Campo rotulo="Ingrediente" className="col-span-2 sm:col-span-4"><Texto valor={g.nome} onChange={(v) => mudarIng(g.id, "nome", v)} placeholder="Ex.: Cachaça" /></Campo>
              <Campo rotulo="Preço da embalagem" className="col-span-2 sm:col-span-3"><Numero valor={g.preco_embalagem} onChange={(v) => mudarIng(g.id, "preco_embalagem", v)} prefixo="R$" placeholder="0,00" /></Campo>
              <Campo rotulo="Embalagem com" className="col-span-2 sm:col-span-5">
                <div className="flex gap-1">
                  <Numero valor={g.tamanho_embalagem} onChange={(v) => mudarIng(g.id, "tamanho_embalagem", v)} placeholder="1" className="flex-1" />
                  <Selecao valor={g.unidade_embalagem} onChange={(v) => mudarIng(g.id, "unidade_embalagem", v)} opcoes={UNIDADES} className="!w-24" aria-label="Unidade da embalagem" />
                </div>
              </Campo>
              <Campo rotulo="Vai na porção" className="col-span-2 sm:col-span-4">
                <div className="flex gap-1">
                  <Numero valor={g.quantidade} onChange={(v) => mudarIng(g.id, "quantidade", v)} placeholder="50" className="flex-1" />
                  <Selecao valor={g.unidade_uso} onChange={(v) => mudarIng(g.id, "unidade_uso", v)} opcoes={UNIDADES} className="!w-24" aria-label="Unidade usada" />
                </div>
              </Campo>
              <Campo rotulo="Aproveitamento" ajuda="100% = sem perda" className="sm:col-span-3"><Numero valor={g.aproveitamento_pct} onChange={(v) => mudarIng(g.id, "aproveitamento_pct", v)} sufixo="%" /></Campo>
              <div className="flex items-start justify-between gap-2 sm:col-span-5">
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Custo na porção</span>
                  <span className={`block h-11 pt-2.5 text-sm font-black tabular-nums ${l && (!l.compativel || !l.completo) ? "text-amber-700" : "text-slate-900"}`}>
                    {l && !l.compativel ? "unidades não combinam" : l && !l.completo ? "—" : fmtReais(l?.custo || 0)}
                  </span>
                </div>
                <BotaoRemover rotulo={`Remover ${g.nome || "ingrediente"}`} onClick={() => alterarItem({ ingredientes: item.ingredientes.filter((x) => x.id !== g.id) })} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <BotaoAdicionar onClick={() => alterarItem({ ingredientes: [...item.ingredientes, ingredienteVazio()] })}>Ingrediente</BotaoAdicionar>
        <span className="text-sm font-bold text-slate-700">Custo da porção: <span className="font-black text-slate-900">{fmtReais(c.custoPorcao)}</span></span>
      </div>
    </div>
  );
}

function LinhaItem({ item, convidados, alterarItem, remover, aberto, alternar, ehBar }) {
  const exclusiva = item.origem === "exclusiva";
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-12 sm:items-end">
        <div className="col-span-2 sm:col-span-4">
          <span className={`mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${exclusiva ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"}`}>
            {exclusiva ? <><FlaskConical size={11} /> Exclusiva do evento</> : <><ChefHat size={11} /> Ficha técnica</>}
          </span>
          <Texto valor={item.nome} onChange={(v) => alterarItem({ nome: v })} aria-label="Nome do produto" readOnly={!exclusiva && !!item.ficha}
            className={!exclusiva && item.ficha ? "bg-slate-50" : ""} />
        </div>
        <Campo rotulo={ehBar ? "Por pessoa (doses)" : "Porções por pessoa"} className="sm:col-span-2">
          <Numero valor={item.por_pessoa} onChange={(v) => alterarItem({ por_pessoa: v })} />
        </Campo>
        <div className="sm:col-span-2">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Custo da porção</span>
          <span className={`block h-11 pt-2.5 text-sm font-bold tabular-nums ${item.semCusto ? "text-amber-700" : "text-slate-900"}`}>{item.semCusto ? "sem custo" : fmtReais(item.custoPorcao)}</span>
        </div>
        <div className="sm:col-span-2">
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-600">Por pessoa</span>
          <span className="block h-11 pt-2.5 text-sm font-black tabular-nums text-slate-900">{fmtReais(item.custoPorPessoa)}</span>
        </div>
        <div className="col-span-2 flex items-end justify-end gap-2 sm:col-span-2">
          {exclusiva && (
            <button type="button" onClick={alternar} aria-expanded={aberto}
              className="flex h-11 items-center gap-1 rounded-xl border border-violet-200 px-3 text-sm font-bold text-violet-800 hover:bg-violet-50">
              Ingredientes {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          <BotaoRemover rotulo={`Remover ${item.nome}`} onClick={remover} />
        </div>
      </div>
      <div className="mt-2">
        <Texto valor={item.descricao} onChange={(v) => alterarItem({ descricao: v })} placeholder="Descrição para o cliente (opcional) — ex.: com farofa de manteiga e vinagrete"
          className="!h-9 text-xs" aria-label="Descrição para o cliente" />
      </div>
      {item.problemas.length > 0 && <p className="mt-2 text-xs font-bold text-amber-700">{item.problemas.join(" · ")}</p>}
      {convidados > 0 && item.custoPorPessoa > 0 && (
        <p className="mt-1 text-xs font-medium text-slate-500">{(Number(item.porPessoa) * convidados).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} porções no evento · {fmtReais(item.custoPorPessoa * convidados)}</p>
      )}
      {exclusiva && aberto && <EditorExclusiva item={item} alterarItem={alterarItem} />}
    </li>
  );
}

export function EtapaCardapio({ orc, setOrc, resumo, fichas }) {
  const tipo = tipoDoEvento(orc.tipo);
  const [buscando, setBuscando] = useState(null); // seção com a busca aberta
  const [abertos, setAbertos] = useState(() => new Set());
  const alterarItem = (id, mud) => setOrc((o) => ({ ...o, cardapio: o.cardapio.map((i) => (i.id === id ? { ...i, ...mud } : i)) }));
  const remover = (id) => setOrc((o) => ({ ...o, cardapio: o.cardapio.filter((i) => i.id !== id) }));
  const adicionarFicha = (secao, f) => {
    setOrc((o) => ({ ...o, cardapio: [...o.cardapio, { id: novoId(), secao, origem: "ficha", ficha_id: f.id, nome: f.nome_receita, descricao: "", por_pessoa: "1", custo_porcao_gravado: custoPorcaoDaFicha(f, fichas) || 0 }] }));
    setBuscando(null);
  };
  const adicionarExclusiva = (secao) => {
    const id = novoId();
    setOrc((o) => ({ ...o, cardapio: [...o.cardapio, { id, secao, origem: "exclusiva", nome: secao === "bar" ? "Novo drink" : "Novo prato", descricao: "", por_pessoa: "1", ingredientes: [ingredienteVazio()] }] }));
    setAbertos((s) => new Set(s).add(id));
  };
  const alternar = (id) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
        <strong>{tipo.rotulo}.</strong> {orc.tipo === "buffet"
          ? "No buffet, diga quanto cada pessoa come de cada prato: 0,5 = meia porção por convidado."
          : orc.tipo === "alacarte"
            ? "Cada pessoa recebe 1 porção de cada item. Se houver opções à escolha (ex.: 2 pratos principais), use 0,5 em cada."
            : "Um item só: informe quanto vai por pessoa."}
      </p>
      {tipo.secoes.map((s) => {
        const sec = SECOES[s];
        const itens = resumo.itens.filter((i) => i.secao === s);
        const Icone = s === "bar" ? Wine : ChefHat;
        return (
          <Cartao key={s} titulo={<span className="flex items-center gap-2"><Icone size={18} className="text-emerald-600" /> {sec.rotulo}</span>}
            acoes={itens.length > 0 && <span className="text-sm font-bold text-slate-700">{fmtReais(itens.reduce((t, i) => t + i.custoPorPessoa, 0))} por pessoa</span>}>
            {itens.length === 0 && <p className="mb-3 text-sm font-medium text-slate-500">Nada nesta etapa ainda.{orc.tipo === "alacarte" ? " Se o evento não tiver esta etapa, deixe vazia." : ""}</p>}
            <ul className="space-y-3">
              {itens.map((i) => (
                <LinhaItem key={i.id} item={i} convidados={resumo.convidados} ehBar={s === "bar"}
                  alterarItem={(m) => alterarItem(i.id, m)} remover={() => remover(i.id)} aberto={abertos.has(i.id)} alternar={() => alternar(i.id)} />
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <BotaoAdicionar onClick={() => setBuscando(buscando === s ? null : s)}>Da ficha técnica</BotaoAdicionar>
              <BotaoAdicionar onClick={() => adicionarExclusiva(s)}>{s === "bar" ? "Criar drink exclusivo" : "Criar ficha exclusiva"}</BotaoAdicionar>
            </div>
            {buscando === s && <BuscaFicha fichas={fichas} setor={sec.setor} onEscolher={(f) => adicionarFicha(s, f)} onFechar={() => setBuscando(null)} />}
          </Cartao>
        );
      })}

      {resumo.itens.length > 0 && (
        <Cartao titulo="Custo por pessoa do cardápio" descricao="Só você vê esta parte. O cliente recebe apenas os nomes dos produtos e o valor por pessoa.">
          <div className="divide-y divide-slate-100">
            {resumo.itens.map((i) => (
              <div key={i.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{i.nome} <span className="text-xs font-medium text-slate-500">· {SECOES[i.secao].rotulo}</span></span>
                <span className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-900">{fmtReais(i.custoPorPessoa)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 pt-2">
              <span className="text-sm font-black uppercase text-slate-900">Cardápio por pessoa</span>
              <span className="whitespace-nowrap text-base font-black tabular-nums text-slate-900">{fmtReais(resumo.cmvPorPessoa)}</span>
            </div>
            {resumo.convidados > 0 && (
              <div className="flex items-baseline justify-between gap-3 pt-1">
                <span className="text-sm font-semibold text-slate-600">× {resumo.convidados} pessoas</span>
                <span className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-700">{fmtReais(resumo.cmv)}</span>
              </div>
            )}
          </div>
        </Cartao>
      )}
    </div>
  );
}
