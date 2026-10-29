"use client";

// Etapas 1 e 2: tipo do evento e cardápio. Cada produto vem de uma ficha
// técnica do sistema ou de uma ficha exclusiva criada aqui, com ingredientes
// que só existem neste evento (não aparecem nas fichas do restaurante).

import { Fragment, useMemo, useState } from "react";
import { Search, ChefHat, Wine, FlaskConical, ChevronDown, ChevronUp, UtensilsCrossed, Soup, Sparkles, Ticket } from "lucide-react";
import {
  TIPOS_EVENTO, SECOES, UNIDADES, tipoDoEvento, ingredienteVazio, custoDaFichaExclusiva, novoId, TIPOS_BASE, tipoDaBase, itensParaBase,
} from "../../../../../lib/evento-orcamento.mjs";
import { custoPorcaoDaFicha } from "../../../../../lib/evento-financeiro.mjs";
import { tipoFichaDe, setorId } from "../../../../../lib/ficha-modelo.mjs";
import { fmtReais } from "../../../../../lib/valor-percentual.mjs";
import { Cartao, Campo, Texto, Numero, Selecao, BotaoRemover, BotaoAdicionar } from "./ui";

const ICONE_TIPO = { buffet: Soup, alacarte: UtensilsCrossed, ticket: Ticket, unico: Sparkles };

export function EtapaTipo({ orc, setOrc, modelos = [], onAplicarModelo, onRemoverModelo }) {
  return (
    <div className="space-y-5">
    <Cartao titulo="Que tipo de evento é?" descricao="Isso define como o cardápio é montado e como aparece no orçamento do cliente. Dá para trocar depois.">
      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tipo do evento">
        {TIPOS_EVENTO.filter((t) => !t.oculto || orc.tipo === t.id).map((t) => {
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
    <Cartao titulo="Começar de um modelo" descricao="Modelos que você salvou (cardápio, equipe, extras, taxas e preço). Os dados do cliente deste evento continuam.">
      {modelos.length === 0 ? (
        <p className="text-sm font-medium text-slate-500">Nenhum modelo ainda. Monte um orçamento e use “Salvar como modelo”, no topo da página.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {modelos.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm font-bold text-slate-900">{m.nome}</strong>
                <span className="text-xs font-medium text-slate-500">{tipoDoEvento(m.orcamento?.tipo).rotulo} · {(m.orcamento?.cardapio || []).length} produto(s) · {(m.orcamento?.equipe || []).length} na equipe</span>
              </span>
              <button type="button" onClick={() => onAplicarModelo?.(m)} className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700">Usar</button>
              <BotaoRemover rotulo={`Apagar modelo ${m.nome}`} onClick={() => onRemoverModelo?.(m)} />
            </li>
          ))}
        </ul>
      )}
    </Cartao>
    </div>
  );
}

// Busca de ficha técnica para a seção (bar → fichas do bar; comida → cozinha).
// Antes listava só as 30 primeiras em ordem alfabética, sem pré-preparos: no
// cardápio real só apareciam os "Adicional - …" (pedido do dono, 27/10/2026).
// Agora mostra todas, separadas em Pratos prontos e Pré-preparos, por
// categoria, com os adicionais no fim.
const ehAdicionalFicha = (f) => /^adiciona(l|is)\b/i.test(String(f?.nome_receita || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// Pesquisar também pelo insumo (pedido do dono, 27/10/2026): "camarão" acha as
// fichas que levam camarão. Devolve o nome do insumo que casou (ou null).
const insumosDaFicha = (f) => (f.fichas_ingredientes || []).map((i) => i?.insumos?.nome || i?.nome || "").filter(Boolean);
const insumoQueCasa = (f, t) => (t ? insumosDaFicha(f).find((n) => semAcento(n).includes(t)) || null : null);
function BuscaFicha({ fichas, setor, onEscolher, onFechar }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("prontos");
  const [categoria, setCategoria] = useState("");
  const doSetor = useMemo(() => (fichas || []).filter((f) => f.ativo !== false && (!setor || setorId(f.departamento) === setor)), [fichas, setor]);
  const porTipo = useMemo(() => ({
    prontos: doSetor.filter((f) => tipoFichaDe(f) !== "pre_preparo"),
    preparos: doSetor.filter((f) => tipoFichaDe(f) === "pre_preparo"),
  }), [doSetor]);
  const grupos = useMemo(() => {
    const t = semAcento(busca.trim());
    const m = new Map();
    for (const f of porTipo[tipo]) {
      if (t && !semAcento(f.nome_receita).includes(t) && !insumoQueCasa(f, t)) continue;
      const cat = ehAdicionalFicha(f) ? "Adicionais" : String(f.categoria || "").trim() || "Outros";
      if (categoria && cat !== categoria) continue;
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat).push(f);
    }
    const peso = (c) => (c === "Adicionais" ? 2 : c === "Outros" ? 1 : 0);
    return [...m.entries()].sort(([a], [b]) => peso(a) - peso(b) || a.localeCompare(b, "pt-BR"))
      .map(([cat, lista]) => [cat, lista.sort((x, y) => String(x.nome_receita).localeCompare(String(y.nome_receita), "pt-BR"))]);
  }, [porTipo, tipo, busca, categoria]);
  const categorias = useMemo(() => {
    const set = new Set(porTipo[tipo].map((f) => (ehAdicionalFicha(f) ? "Adicionais" : String(f.categoria || "").trim() || "Outros")));
    return [...set].sort((a, b) => (a === "Adicionais") - (b === "Adicionais") || a.localeCompare(b, "pt-BR"));
  }, [porTipo, tipo]);
  const total = grupos.reduce((t, [, l]) => t + l.length, 0);
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200" role="tablist" aria-label="Tipo de ficha">
        {[["prontos", "Pratos prontos"], ["preparos", "Pré-preparos"]].map(([id, rot]) => (
          <button key={id} type="button" role="tab" aria-selected={tipo === id} onClick={() => { setTipo(id); setCategoria(""); }}
            className={`h-9 rounded-lg text-sm font-bold ${tipo === id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}>
            {rot} <span className="text-xs font-semibold opacity-70">{porTipo[id].length}</span>
          </button>
        ))}
      </div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${tipo === "preparos" ? "pré-preparo" : "prato"} ou insumo (ex.: camarão)…`}
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500" />
      </div>
      {categorias.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {["", ...categorias].map((c) => (
            <button key={c || "todas"} type="button" onClick={() => setCategoria(c)} aria-pressed={categoria === c}
              className={`h-8 shrink-0 rounded-full border px-3 text-xs font-bold ${categoria === c ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{c || "Todas"}</button>
          ))}
        </div>
      )}
      <div className="mt-2 max-h-80 overflow-y-auto rounded-xl bg-white">
        {total === 0 && <p className="p-4 text-center text-sm font-semibold text-slate-500">Nenhuma ficha encontrada.</p>}
        {grupos.map(([cat, lista]) => (
          <div key={cat}>
            <p className="sticky top-0 bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-slate-500">{cat} · {lista.length}</p>
            <ul className="divide-y divide-slate-100">
              {lista.map((f) => {
                const c = custoPorcaoDaFicha(f, fichas);
                const t = semAcento(busca.trim());
                const peloInsumo = t && !semAcento(f.nome_receita).includes(t) ? insumoQueCasa(f, t) : null;
                return (
                  <li key={f.id}>
                    <button type="button" onClick={() => onEscolher(f)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-emerald-50">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-900">{f.nome_receita}</span>
                        {peloInsumo ? <span className="block truncate text-[11px] font-semibold text-emerald-700">leva {peloInsumo}</span> : null}
                      </span>
                      <span className={`shrink-0 text-xs font-bold tabular-nums ${c > 0 ? "text-slate-600" : "text-amber-700"}`}>{c > 0 ? `${fmtReais(c)} / porção` : "sem custo"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
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
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-100/40 p-3 sm:p-4">
      <p className="mb-3 text-xs font-semibold text-zinc-900">
        Ingredientes para <strong>uma porção</strong> (um prato, um drink). Informe a embalagem como você compra e quanto vai na porção. Estes ingredientes ficam só neste evento.
      </p>
      <Campo rotulo="Peso da porção pronta (g)" ajuda="Opcional. Necessário para informar o buffet em gramas por pessoa." className="mb-3 max-w-xs">
        <Numero valor={item.peso_porcao_g} onChange={(v) => alterarItem({ peso_porcao_g: v })} sufixo="g" />
      </Campo>
      <div className="space-y-3">
        {item.ingredientes.map((g) => {
          const l = porId.get(g.id);
          return (
            <div key={g.id} className="grid grid-cols-2 gap-x-2 gap-y-3 rounded-xl border border-zinc-200 bg-white p-3 sm:grid-cols-12 sm:items-start">
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

function LinhaItem({ item, convidados, alterarItem, remover, aberto, alternar, ehBar, onVincular, mesaFechada = false }) {
  const exclusiva = item.origem === "exclusiva";
  // Ordem do dono (28/10/2026): 1 nome do prato, 2 receita, 3 porção.
  const semReceita = !!item.receita_pendente;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      {/* Linha 1: o que é + nome + excluir */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <span className={`mb-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${exclusiva ? "bg-zinc-100 text-zinc-800" : "bg-slate-100 text-slate-700"}`}>
            {exclusiva ? <><FlaskConical size={11} /> Exclusiva do evento</> : <><ChefHat size={11} /> Ficha técnica</>}
          </span>
          <Texto valor={item.nome} onChange={(v) => alterarItem({ nome: v })} aria-label="Nome do prato" placeholder="Nome do prato" />
          {!semReceita && (
            <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-slate-500">
              {!exclusiva && item.ficha ? <>Receita: ficha técnica “{item.ficha.nome_receita}”</> : exclusiva ? "Receita: ingredientes deste evento" : null}
              {onVincular && <button type="button" onClick={onVincular} className="font-bold text-emerald-700 hover:underline">trocar pela ficha técnica</button>}
            </span>
          )}
        </div>
        <div className="pt-6"><BotaoRemover rotulo={`Remover ${item.nome}`} onClick={remover} /></div>
      </div>

      {semReceita && (
        <div className="mt-3 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-3">
          <p className="text-sm font-black text-slate-900">2 · Qual é a receita deste prato?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={onVincular} className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700"><ChefHat size={16} /> Usar uma ficha técnica</button>
            <button type="button" onClick={() => { alterarItem({ receita_pendente: false, ingredientes: [ingredienteVazio()] }); if (!aberto) alternar(); }} className="flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"><FlaskConical size={16} /> Montar os ingredientes</button>
          </div>
          <p className="mt-2 text-xs font-medium text-slate-500">Depois você porciona: quanto cada pessoa come ou em quantas porções o prato se divide.</p>
        </div>
      )}
      {!semReceita && <p className="mt-3 text-[11px] font-black uppercase tracking-wide text-emerald-800">3 · Porcionar</p>}
      {/* Linha 2: quantidade, custos e ingredientes — cada caixa com o título em cima do valor */}
      <div className={`mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-stretch ${semReceita ? "hidden" : ""}`}>
        <div className="col-span-2 rounded-xl bg-slate-50 p-2.5 sm:col-span-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600">{item.emTotal ? (mesaFechada ? "Quantidade na mesa" : "Quantidade no evento") : ehBar ? "Doses por pessoa" : item.emGramas ? "Gramas por pessoa" : item.dividido ? `Porções de ${item.divisaoG} g por pessoa` : "Porções por pessoa"}</span>
            {!mesaFechada && (
              <span className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200" role="radiogroup" aria-label="Medir por">
                {/* "total": quantidade fechada para o evento (2 bolos, 30 sanduíches, 1 suco de 2 L) */}
                {(ehBar ? [["porcao", "por pessoa"], ["total", "total"]] : [["porcao", "porções"], ["g", "gramas"], ["total", "total"]]).map(([m, rot]) => {
                  const atual = item.emTotal ? "total" : item.emGramas ? "g" : "porcao";
                  const ativo = m === atual;
                  return (
                    <button key={m} type="button" role="radio" aria-checked={ativo} onClick={() => alterarItem({ medida: m })}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${ativo ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}>{rot}</button>
                  );
                })}
              </span>
            )}
          </div>
          {item.emTotal ? (
            <div className="space-y-1.5">
              <Numero valor={item.quantidade_total} onChange={(v) => alterarItem({ quantidade_total: v })} sufixo={item.pesoPorcao > 0 ? `× ${item.pesoPorcao} ${ehBar ? "ml" : "g"}` : "porções"} aria-label="Quantidade para o evento" />
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                Dividir em {ehBar ? "copos" : "fatias"} de
                <span className="w-24"><Numero valor={item.fatia_g} onChange={(v) => alterarItem({ fatia_g: v })} sufixo={ehBar ? "ml" : "g"} aria-label={ehBar ? "Tamanho do copo" : "Peso da fatia"} /></span>
              </label>
              {item.fatias != null && <span className="block text-xs font-black text-emerald-800">Dá {item.fatias.toLocaleString("pt-BR")} {ehBar ? "copos" : "fatias"}{convidados > 0 ? ` · ${(item.fatias / convidados).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} por pessoa` : ""}</span>}
            </div>
          ) : item.emGramas
            ? <Numero valor={item.gramas_por_pessoa} onChange={(v) => alterarItem({ gramas_por_pessoa: v })} sufixo="g" aria-label="Gramas por pessoa" />
            : <Numero valor={item.por_pessoa} onChange={(v) => alterarItem({ por_pessoa: v })} aria-label={ehBar ? "Doses por pessoa" : "Porções por pessoa"} />}
          {/* Divisão do prato: o peso vem da ficha; o dono escolhe o tamanho da porção da mesa. */}
          {!ehBar && !item.emGramas && !item.emTotal && (
            <div className="mt-2 space-y-1">
              <span className="block text-[11px] font-bold text-slate-600">{item.pesoPorcao > 0 ? <>Prato da ficha: <b className="text-slate-900">{item.pesoPorcao.toLocaleString("pt-BR")} g</b></> : "A ficha não tem o peso do prato."}</span>
              {item.pesoPorcao > 0 && (
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                  Dividir em porções de
                  <span className="w-24"><Numero valor={item.fatia_g} onChange={(v) => alterarItem({ fatia_g: v })} sufixo="g" aria-label="Peso da porção dividida" /></span>
                </label>
              )}
              {item.dividido && <span className="block text-xs font-black text-emerald-800">1 prato = {item.porcoesPorFicha.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} porções de {item.divisaoG} g · {fmtReais(item.custoPorcaoDividida)} cada</span>}
            </div>
          )}
          {item.emGramas && item.pesoPorcao > 0 && <span className="mt-1 block text-[11px] font-medium text-slate-500">= {item.porPessoa.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} porção de {item.pesoPorcao} g</span>}
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">{item.dividido ? `Custo da porção de ${item.divisaoG} g` : "Custo da porção"}</span>
          <span className={`mt-2 block text-base font-black tabular-nums ${item.semCusto ? "text-amber-700" : "text-slate-900"}`}>{item.semCusto ? "sem custo" : fmtReais(item.dividido ? item.custoPorcaoDividida : item.custoPorcao)}</span>
          {item.dividido && !item.semCusto && <span className="block text-[11px] font-bold text-slate-500">prato inteiro {fmtReais(item.custoPorcao)}</span>}
        </div>
        <div className="rounded-xl bg-slate-50 p-2.5">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-600">{item.emTotal ? "Custo total" : "Custo por pessoa"}</span>
          <span className="mt-2 block text-base font-black tabular-nums text-slate-900">{fmtReais(item.emTotal ? item.custoTotalFixo : item.custoPorPessoa)}</span>
          {item.emTotal && convidados > 0 && item.custoTotalFixo > 0 && <span className="block text-[11px] font-bold text-slate-500">{fmtReais(item.custoTotalFixo / convidados)} por pessoa</span>}
        </div>
        {exclusiva && (
          <button type="button" onClick={alternar} aria-expanded={aberto}
            className="col-span-2 flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-zinc-200 px-3 text-sm font-bold text-zinc-800 hover:bg-zinc-100 sm:col-span-1">
            Ingredientes {aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>
      <div className="mt-2">
        <Texto valor={item.descricao} onChange={(v) => alterarItem({ descricao: v })} placeholder="Descrição para o cliente (opcional) — ex.: com farofa de manteiga e vinagrete"
          className="!h-9 text-xs" aria-label="Descrição para o cliente" />
      </div>
      {!semReceita && item.problemas.length > 0 && <p className="mt-2 text-xs font-bold text-amber-700">{item.problemas.join(" · ")}</p>}
      {convidados > 0 && item.custoPorPessoa > 0 && (
        <p className="mt-1 text-xs font-medium text-slate-500">{item.dividido
          ? <>{(Number(item.porPessoa) * convidados * item.porcoesPorFicha).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} porções de {item.divisaoG} g para {convidados} pessoas = {Math.ceil(Number(item.porPessoa) * convidados - 1e-9).toLocaleString("pt-BR")} pratos · {fmtReais(item.custoPorPessoa * convidados)}</>
          : <>{(Number(item.porPessoa) * convidados).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} porções para {convidados} pessoas · {fmtReais(item.custoPorPessoa * convidados)}</>}</p>
      )}
      {exclusiva && aberto && <EditorExclusiva item={item} alterarItem={alterarItem} />}
    </li>
  );
}

export function EtapaCardapio({ orc, setOrc, resumo, fichas, bases = [], onSalvarBase, onUsarBase, onApagarBase }) {
  const tipo = tipoDoEvento(orc.tipo);
  const [buscando, setBuscando] = useState(null); // seção com a busca aberta
  const [vinculando, setVinculando] = useState(null); // prato (id) escolhendo a ficha técnica
  const [novoNome, setNovoNome] = useState({}); // seção → nome digitado
  // 1º o nome do prato; a receita e a porção vêm depois (pedido do dono, 28/10/2026).
  const adicionarPeloNome = (secao) => {
    const nome = String(novoNome[secao] || "").trim();
    if (!nome) return;
    const fechado = tipoDoEvento(orc.tipo).quantidadeFechada ? { medida: "total", quantidade_total: "1" } : {};
    setOrc((o) => ({ ...o, cardapio: [...o.cardapio, { id: novoId(), secao, origem: "exclusiva", nome, descricao: "", por_pessoa: "1", ingredientes: [], receita_pendente: true, ...fechado }] }));
    setNovoNome((x) => ({ ...x, [secao]: "" }));
  };
  const vincularFicha = (itemId, f) => {
    setOrc((o) => ({ ...o, cardapio: o.cardapio.map((i) => (i.id === itemId ? { ...i, origem: "ficha", ficha_id: f.id, custo_porcao_gravado: custoPorcaoDaFicha(f, fichas) || 0, receita_pendente: false, ingredientes: [] } : i)) }));
    setVinculando(null);
  };
  const [abertos, setAbertos] = useState(() => new Set());
  const alterarItem = (id, mud) => setOrc((o) => ({ ...o, cardapio: o.cardapio.map((i) => (i.id === id ? { ...i, ...mud } : i)) }));
  const remover = (id) => setOrc((o) => ({ ...o, cardapio: o.cardapio.filter((i) => i.id !== id) }));
  const adicionarFicha = (secao, f) => {
    // Ticket por pessoa: o item já entra em quantidade fechada para o evento.
    const fechado = tipoDoEvento(orc.tipo).quantidadeFechada ? { medida: "total", quantidade_total: "1" } : {};
    setOrc((o) => ({ ...o, cardapio: [...o.cardapio, { id: novoId(), secao, origem: "ficha", ficha_id: f.id, nome: f.nome_receita, descricao: "", por_pessoa: "1", custo_porcao_gravado: custoPorcaoDaFicha(f, fichas) || 0, ...fechado }] }));
    setBuscando(null);
  };
  const alternar = (id) => setAbertos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
        <strong>{tipo.rotulo}.</strong> {orc.tipo === "buffet"
          ? "No buffet, diga quanto cada pessoa come de cada prato: 0,5 = meia porção por convidado."
          : orc.tipo === "ticket"
            ? "Diga quanto vai no total para o evento (2 bolos, 30 sanduíches, 1 suco de 2 L). O custo por pessoa e o ticket aparecem embaixo."
          : orc.tipo === "alacarte"
            ? "Cada pessoa recebe 1 porção de cada item. Se houver opções à escolha (ex.: 2 pratos principais), use 0,5 em cada."
            : "Um item só: informe quanto vai por pessoa."}
      </p>
      {onSalvarBase && <BasesDoCardapio orc={orc} bases={bases} onSalvar={onSalvarBase} onUsar={onUsarBase} onApagar={onApagarBase} />}
      {/* Ticket por pessoa: monta a mesa e diz quantas pessoas comem dela. */}
      {tipo.quantidadeFechada && (
        <Cartao titulo="Mesa do evento" descricao="Monte a mesa com os pratos e diga quantas pessoas vão comer dela. Não importa quanto cada um come: o custo da mesa é dividido por todos.">
          <div className="flex flex-wrap items-end gap-4">
            <label className="w-48 text-[11px] font-bold uppercase tracking-wide text-slate-600">Quantas pessoas vão comer?
              <Numero valor={orc.cliente?.convidados ?? ""} onChange={(v) => setOrc((o) => ({ ...o, cliente: { ...o.cliente, convidados: v } }))} sufixo="pessoas" aria-label="Quantas pessoas vão comer" />
            </label>
            <div className="grid flex-1 grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[11px] font-bold uppercase text-slate-500">Custo da mesa</p><p className="text-lg font-black tabular-nums text-slate-900">{fmtReais(resumo.cmv)}</p></div>
              <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[11px] font-bold uppercase text-slate-500">Pessoas</p><p className="text-lg font-black tabular-nums text-slate-900">{resumo.convidados || "—"}</p></div>
              <div className="rounded-xl bg-emerald-50 p-2.5"><p className="text-[11px] font-bold uppercase text-emerald-800">Custo por pessoa</p><p className="text-lg font-black tabular-nums text-emerald-900">{resumo.convidados > 0 ? fmtReais(resumo.cmv / resumo.convidados) : "—"}</p></div>
            </div>
          </div>
        </Cartao>
      )}
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
                <Fragment key={i.id}>
                  <LinhaItem item={i} convidados={resumo.convidados} ehBar={s === "bar"} mesaFechada={!!tipo.quantidadeFechada} onVincular={() => setVinculando(vinculando === i.id ? null : i.id)}
                    alterarItem={(m) => alterarItem(i.id, m)} remover={() => remover(i.id)} aberto={abertos.has(i.id)} alternar={() => alternar(i.id)} />
                  {vinculando === i.id && <li className="list-none"><BuscaFicha fichas={fichas} setor={sec.setor} onEscolher={(f) => vincularFicha(i.id, f)} onFechar={() => setVinculando(null)} /></li>}
                </Fragment>
              ))}
            </ul>
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); adicionarPeloNome(s); }}>
              <span className="min-w-[14rem] flex-1"><Texto valor={novoNome[s] || ""} onChange={(v) => setNovoNome((x) => ({ ...x, [s]: v }))} placeholder={s === "bar" ? "1 · Nome do drink (ex.: Caipirinha de cupuaçu)" : "1 · Nome do prato (ex.: Peixe ao molho de camarão)"} aria-label={`Nome do ${s === "bar" ? "drink" : "prato"}`} /></span>
              <button type="submit" disabled={!String(novoNome[s] || "").trim()} className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-40">Adicionar {s === "bar" ? "drink" : "prato"}</button>
            </form>
            <div className="mt-2 flex flex-wrap gap-2">
              <BotaoAdicionar onClick={() => setBuscando(buscando === s ? null : s)}>Ou escolher direto da ficha técnica</BotaoAdicionar>
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
                <span className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-900">{i.emTotal ? <>{resumo.pessoasConsumo > 0 ? fmtReais(i.custoTotalFixo / resumo.pessoasConsumo) : "—"} <span className="text-xs font-medium text-slate-500">({fmtReais(i.custoTotalFixo)} no total)</span></> : fmtReais(i.custoPorPessoa)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3 pt-2">
              <span className="text-sm font-black uppercase text-slate-900">Cardápio por pessoa</span>
              <span className="whitespace-nowrap text-base font-black tabular-nums text-slate-900">{fmtReais(resumo.cmvPorPessoa)}</span>
            </div>
            {resumo.convidados > 0 && (
              <div className="flex items-baseline justify-between gap-3 pt-1">
                <span className="text-sm font-semibold text-slate-600">
                  × {resumo.pessoasConsumo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} pessoas{resumo.criancas > 0 ? ` (${resumo.criancas} crianças comem menos)` : ""}{resumo.sobraPct > 0 ? ` + ${resumo.sobraPct.toLocaleString("pt-BR")}% de sobra` : ""}
                </span>
                <span className="whitespace-nowrap text-sm font-bold tabular-nums text-slate-700">{fmtReais(resumo.cmv)}</span>
              </div>
            )}
          </div>
          {/* Conta do ticket (pedido do dono, 28/10/2026): "gasto R$ 100 para servir
              40 pessoas, sai tanto por pessoa, e quero vender por R$ 35". */}
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
            <p className="text-sm font-black text-slate-900">Ticket por pessoa</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="w-36 text-[11px] font-bold uppercase tracking-wide text-slate-600">Vender a
                <Numero valor={orc.financeiro?.preco_por_pessoa || ""} onChange={(v) => setOrc((o) => ({ ...o, financeiro: { ...o.financeiro, preco_por_pessoa: v } }))} sufixo="R$/pessoa" aria-label="Ticket por pessoa" />
              </label>
              {resumo.convidados > 0 && resumo.cmv > 0 ? (
                <p className="text-sm font-semibold text-slate-700">
                  Gasto <b>{fmtReais(resumo.cmv)}</b> para servir <b>{resumo.convidados}</b> pessoas = <b>{fmtReais(resumo.cmv / resumo.convidados)}</b> por pessoa.
                  {Number(resumo.precoPorPessoa) > 0 && <> Vendendo a <b>{fmtReais(resumo.precoPorPessoa)}</b>, sobram <b className={resumo.precoPorPessoa - resumo.cmv / resumo.convidados < 0 ? "text-red-700" : "text-emerald-800"}>{fmtReais(resumo.precoPorPessoa - resumo.cmv / resumo.convidados)}</b> por pessoa ({fmtReais(resumo.receita - resumo.cmv)} no evento) antes de equipe, aluguel e taxas — o lucro líquido sai na etapa de custos.</>}
                </p>
              ) : <p className="text-xs font-semibold text-slate-500">Informe as pessoas e os itens para ver o custo por pessoa.</p>}
            </div>
          </div>
{!tipo.quantidadeFechada && (          <Campo rotulo="Sobra de segurança" ajuda="Quanto a mais preparar e comprar, além do consumo previsto (não vale para itens em quantidade fechada). Entra no custo e na lista de compras." className="mt-4 max-w-xs">
            <Numero valor={orc.sobra_pct} onChange={(v) => setOrc((o) => ({ ...o, sobra_pct: v }))} sufixo="%" />
          </Campo>)}
        </Cartao>
      )}
    </div>
  );
}

/* Bases do cardápio (pedido do dono, 29/10/2026): buffet base, mesa de
 * comidas e bebidas base. Salva quantas quiser e põe em qualquer evento. */
function BasesDoCardapio({ orc, bases, onSalvar, onUsar, onApagar }) {
  const [filtro, setFiltro] = useState("todas");
  const [salvando, setSalvando] = useState(null); // tipo da base sendo salva
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lista = bases.filter((b) => filtro === "todas" || b.tipo === filtro);
  const chip = (ativo) => `h-9 rounded-full border px-3 text-xs font-bold transition ${ativo ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  const salvar = async () => {
    setOcupado(true);
    const ok = await onSalvar(nome, salvando);
    setOcupado(false);
    if (ok) { setSalvando(null); setNome(""); }
  };
  return (
    <Cartao titulo="Bases do cardápio" descricao="Buffet base, mesa de comidas e bebidas que você usa sempre. Salve quantas quiser e coloque em qualquer evento; equipe e preço não mudam.">
      <div className="flex flex-wrap items-center gap-2">
        {[["todas", `Todas (${bases.length})`], ...TIPOS_BASE.map((t) => [t.id, `${t.rotulo} (${bases.filter((b) => b.tipo === t.id).length})`])].map(([id, rot]) => (
          <button key={id} type="button" className={chip(filtro === id)} onClick={() => setFiltro(id)}>{rot}</button>
        ))}
      </div>
      {lista.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{bases.length ? "Nenhuma base desse tipo." : "Nenhuma base ainda. Monte o cardápio abaixo e salve as comidas ou as bebidas como base."}</p>
      ) : (
        <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((b) => {
            const Icone = tipoDaBase(b.tipo).grupo === "bebida" ? Wine : ChefHat;
            return (
              <li key={b.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Icone size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{b.nome}</p>
                    <p className="text-xs text-slate-500">{tipoDaBase(b.tipo).rotulo} · {(b.itens || []).length} item(ns)</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{(b.itens || []).map((i) => i.nome).filter(Boolean).join(", ")}</p>
                  </div>
                  <BotaoRemover rotulo={`Apagar base ${b.nome}`} onClick={() => onApagar?.(b)} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onUsar?.(b, false)} className="h-9 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700">Adicionar ao cardápio</button>
                  <button type="button" onClick={() => { if (window.confirm(`Trocar as ${tipoDaBase(b.tipo).grupo === "bebida" ? "bebidas" : "comidas"} deste evento pela base “${b.nome}”?`)) onUsar?.(b, true); }} className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">Trocar</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-4 border-t border-slate-100 pt-3">
        {salvando ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[220px] flex-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">Nome da {tipoDaBase(salvando).rotulo.toLowerCase()}
              <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder={tipoDaBase(salvando).rotulo} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium normal-case text-slate-900" />
            </label>
            <span className="text-xs text-slate-500">{itensParaBase(orc, salvando).length} item(ns) do cardápio</span>
            <button type="button" disabled={ocupado} onClick={salvar} className="h-11 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-60">{ocupado ? "Salvando…" : "Salvar base"}</button>
            <button type="button" onClick={() => setSalvando(null)} className="h-11 rounded-xl px-3 text-sm font-bold text-slate-600">Cancelar</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-500">Salvar este cardápio como</span>
            {TIPOS_BASE.map((t) => {
              const n = itensParaBase(orc, t.id).length;
              return <button key={t.id} type="button" disabled={!n} onClick={() => { setSalvando(t.id); setNome(""); }} className={`${chip(false)} disabled:opacity-40`} title={n ? "" : "Sem pratos desse tipo no cardápio"}>+ {t.rotulo}</button>;
            })}
          </div>
        )}
      </div>
    </Cartao>
  );
}
