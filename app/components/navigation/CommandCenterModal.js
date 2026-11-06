"use client";

// CENTRAL DE COMANDO (Ctrl/Cmd+K): busca global, comandos ("abrir estoque") e
// atalhos. Regras em app/lib/central-comando.mjs (testadas); aqui só a tela.
// Teclado: ↑ ↓ navegam por TODOS os itens visíveis, Enter abre, Esc fecha.
// Sem resultado, Enter manda a frase para o "Pergunte ao Héfisto".

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import * as Icones from "lucide-react";
import { getAccessibleNavigation } from "../../lib/navigation-registry.mjs";
import { hasPermission } from "../../lib/permissions-catalog.mjs";
import { getRecentItems, getFavoriteItems, getUsageCounts, isFavorite, toggleFavoriteItem } from "../../lib/user-preferences.js";
import { buscar, explorar, montarInicio, nomeCurto, nomeDo, categoriaDo } from "../../lib/central-comando.mjs";
import { useERP } from "../../context/ERPContext";

const { Search, X, Star, CornerDownLeft, ArrowUp, ArrowDown, Compass, ChevronLeft, MessageSquare } = Icones;
const ICONE_ALIAS = { BarChart: "BarChart2" };
const iconeDo = (nome) => Icones[ICONE_ALIAS[nome] || nome] || Icones.Circle;

function Estrela({ item, sessao, fav, onAlternar }) {
  const rot = fav ? "Remover dos favoritos" : "Favoritar";
  return (
    <button type="button" tabIndex={-1} aria-label={`${rot}: ${nomeDo(item)}`} title={rot}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onAlternar(item.id); }}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg transition ${fav ? "text-hf-warning" : "text-hf-muted opacity-0 hover:text-hf-text group-hover:opacity-100 [@media(hover:none)]:opacity-100"}`}>
      <Star size={15} className={fav ? "fill-current" : ""} />
    </button>
  );
}

function Linha({ item, indice, selecionado, onAbrir, onHover, sessao, fav, onAlternar }) {
  const Ic = iconeDo(item.icon);
  return (
    <li role="option" id={`cc-op-${indice}`} aria-selected={selecionado} data-indice={indice}
      onMouseMove={() => onHover(indice)} onClick={() => onAbrir(item)}
      className={`group flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1 transition ${selecionado ? "bg-hf-elevated ring-1 ring-hf-border-strong" : "hover:bg-hf-elevated/70"}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${selecionado ? "border-hf-accent/40 text-hf-accent" : "border-hf-border text-hf-text-2"}`}><Ic size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-hf-text">{nomeCurto(item)}</span>
        {categoriaDo(item) && <span className="block truncate text-xs text-hf-text-2">{categoriaDo(item)}</span>}
      </span>
      <Estrela item={item} sessao={sessao} fav={fav} onAlternar={onAlternar} />
      {selecionado && <CornerDownLeft size={14} className="hidden shrink-0 text-hf-muted sm:block" />}
    </li>
  );
}

function Atalho({ item, indice, selecionado, onAbrir, onHover }) {
  const Ic = iconeDo(item.icon);
  return (
    <li role="option" id={`cc-op-${indice}`} aria-selected={selecionado} data-indice={indice} onMouseMove={() => onHover(indice)} onClick={() => onAbrir(item)}
      className={`flex min-h-[92px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center transition ${selecionado ? "border-hf-accent bg-hf-elevated" : "border-hf-border bg-hf-surface"}`}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-hf-accent/15 text-hf-text"><Ic size={18} aria-hidden="true" /></span>
      <span className="line-clamp-2 text-xs font-bold leading-tight text-hf-text">{nomeCurto(item)}</span>
    </li>
  );
}

const Titulo = ({ children, direita }) => (
  <div className="flex items-center justify-between px-2.5 pb-1 pt-3">
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-hf-muted">{children}</h3>
    {direita}
  </div>
);

export default function CommandCenterModal({ isOpen, onClose, sessao }) {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const naMarmitaria = (usePathname() || "").startsWith("/dashboard/marmitaria");
  const negocio = naMarmitaria ? "marmitaria" : unidadeAtiva;
  const [consulta, setConsulta] = useState("");
  const [sel, setSel] = useState(0);
  const [modo, setModo] = useState("inicio"); // inicio | explorar
  const [prefs, setPrefs] = useState({ recentes: [], favoritos: [], uso: {}, favIds: new Set() });
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  const acessiveis = useMemo(() => getAccessibleNavigation(sessao), [sessao]);
  const podeHefisto = !!sessao && (!sessao.gerenciado || hasPermission(sessao, "dashboard.intelligence.view"));

  const recarregar = useCallback(() => {
    if (!sessao) return;
    const favoritos = getFavoriteItems(sessao);
    setPrefs({ recentes: getRecentItems(sessao), favoritos, uso: getUsageCounts(sessao), favIds: new Set(favoritos.map((f) => f.id)) });
  }, [sessao]);

  useEffect(() => {
    if (!isOpen) return;
    setConsulta(""); setSel(0); setModo("inicio"); recarregar();
    // No toque, o teclado esconderia os atalhos: ele só abre quando a pessoa toca na busca.
    const toque = window.matchMedia?.("(hover: none)").matches;
    const t = toque ? null : setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen, recarregar]);

  useEffect(() => {
    const atualizar = () => recarregar();
    window.addEventListener("hefisto:favorites-changed", atualizar);
    window.addEventListener("hefisto:recents-changed", atualizar);
    return () => { window.removeEventListener("hefisto:favorites-changed", atualizar); window.removeEventListener("hefisto:recents-changed", atualizar); };
  }, [recarregar]);

  // Blocos visíveis, na ordem em que o teclado percorre
  const blocos = useMemo(() => {
    if (consulta.trim()) {
      const r = buscar(consulta, sessao, { uso: prefs.uso, limite: 12, unidadeId: negocio });
      return [{ id: "resultados", titulo: r.comando ? `Abrir “${r.termo || "…"}”` : "Resultados", itens: r.itens }];
    }
    if (modo === "explorar") return explorar(acessiveis, negocio).map((g) => ({ id: g.area, titulo: g.area, itens: g.itens }));
    const inicio = montarInicio({ acessiveis, favoritos: prefs.favoritos, recentes: prefs.recentes, uso: prefs.uso, unidadeId: negocio });
    return [
      { id: "atalhos", titulo: "Atalhos", grade: true, itens: inicio.atalhos },
      ...(inicio.recentes.length ? [{ id: "recentes", titulo: "Recentes", itens: inicio.recentes }] : []),
    ];
  }, [consulta, modo, sessao, prefs, acessiveis, negocio]);

  const planos = useMemo(() => blocos.flatMap((b) => b.itens), [blocos]);
  useEffect(() => { if (sel >= planos.length) setSel(Math.max(0, planos.length - 1)); }, [planos.length, sel]);
  useEffect(() => { listaRef.current?.querySelector(`[data-indice="${sel}"]`)?.scrollIntoView({ block: "nearest" }); }, [sel]);

  const abrir = useCallback((item) => { onClose(); router.push(item.route); }, [onClose, router]);
  const perguntar = useCallback(() => {
    const texto = consulta.trim().slice(0, 500);
    if (!texto) return;
    onClose();
    setTimeout(() => window.dispatchEvent(new CustomEvent("hefisto:perguntar", { detail: { texto } })), 60);
  }, [consulta, onClose]);
  const alternarFav = useCallback((id) => {
    const agora = toggleFavoriteItem(sessao, id);
    window.dispatchEvent(new CustomEvent("erp:feedback", { detail: { texto: agora ? "Adicionado aos favoritos" : "Removido dos favoritos", tipo: agora ? "ok" : "salvando", duracao: 1400 } }));
  }, [sessao]);

  const teclado = (e) => {
    if (e.key === "Escape") { e.preventDefault(); if (modo === "explorar" && !consulta) setModo("inicio"); else onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (planos.length ? (s + 1) % planos.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (planos.length ? (s - 1 + planos.length) % planos.length : 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (planos[sel]) abrir(planos[sel]);
      else if (podeHefisto && consulta.trim()) perguntar();
    }
  };

  if (!isOpen) return null;
  let indice = -1;
  const semResultado = consulta.trim() && planos.length === 0;

  return (
    <div role="dialog" aria-modal="true" aria-label="Central de Comando" onKeyDown={teclado}
      className="fixed inset-0 z-[120] bg-zinc-900/30 p-0 backdrop-blur-sm sm:p-4 sm:pt-[10vh]">
      <div className="fixed inset-0" onClick={onClose} />
      {/* Sem "justify-center" na janela: a regra global de modal do celular a empurraria para baixo. */}
      <div className="relative z-10 flex h-[100dvh] w-full flex-col sm:mx-auto overflow-hidden border-hf-border bg-hf-surface shadow-2xl shadow-black/15 sm:h-auto sm:max-h-[78vh] sm:max-w-[640px] sm:rounded-2xl sm:border">
        {/* Cabeçalho + busca */}
        <div className="flex items-center gap-2 border-b border-hf-border px-3 pb-3 pt-[calc(var(--erp-safe-top,0px)+0.75rem)] sm:px-4 sm:pt-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-hf-border bg-hf-bg px-3 transition focus-within:border-hf-accent/60 focus-within:ring-2 focus-within:ring-hf-accent/15">
            <Search size={18} className="shrink-0 text-hf-muted" aria-hidden="true" />
            <input ref={inputRef} value={consulta} onChange={(e) => { setConsulta(e.target.value); setSel(0); }}
              role="combobox" aria-expanded="true" aria-controls="cc-lista" aria-activedescendant={planos.length ? `cc-op-${sel}` : undefined}
              aria-label="Buscar no Héfisto"
              placeholder="O que você procura?"
              className="min-h-[48px] min-w-0 flex-1 bg-transparent text-base text-hf-text outline-none placeholder:text-hf-muted" />
            {consulta ? (
              <button type="button" onClick={() => { setConsulta(""); inputRef.current?.focus(); }} aria-label="Limpar" className="grid h-9 w-9 place-items-center rounded-md text-hf-muted hover:text-hf-text"><X size={15} /></button>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text"><X size={20} /></button>
        </div>

        {/* Lista */}
        <div ref={listaRef} id="cc-lista" role="listbox" aria-label="Módulos" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 sm:px-2.5">
          {modo === "explorar" && !consulta && (
            <button type="button" onClick={() => setModo("inicio")} className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-hf-text-2 hover:bg-hf-elevated hover:text-hf-text">
              <ChevronLeft size={14} />Voltar
            </button>
          )}

          {blocos.map((b) => (b.itens.length > 0 || b.id === "resultados") && (
            <section key={b.id}>
              <Titulo direita={b.subtitulo && <span className="text-[11px] text-hf-muted">{b.subtitulo}</span>}>{b.titulo}</Titulo>
              <ul className={b.grade ? "grid grid-cols-3 gap-2 px-1" : "space-y-0.5"}>
                {b.itens.map((item) => {
                  indice += 1;
                  if (b.grade) return <Atalho key={item.id} item={item} indice={indice} selecionado={indice === sel} onAbrir={abrir} onHover={setSel} />;
                  return <Linha key={`${b.id}-${item.id}`} item={item} indice={indice} selecionado={indice === sel} onAbrir={abrir} onHover={setSel}
                    sessao={sessao} fav={prefs.favIds.has(item.id)} onAlternar={alternarFav} />;
                })}
              </ul>
            </section>
          ))}

          {semResultado && (
            <div className="mx-1 mt-3 rounded-xl border border-hf-border bg-hf-bg p-4 text-center">
              <p className="text-sm font-semibold text-hf-text">Nenhum módulo para “{consulta.trim()}”.</p>
              {podeHefisto
                ? <button type="button" onClick={perguntar} className="mt-3 inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-hf-accent px-3 text-xs font-bold text-hf-accent-fg hover:brightness-110"><MessageSquare size={14} />Perguntar ao Héfisto</button>
                : <p className="mt-1 text-xs text-hf-text-2">Tente outro termo ou explore os módulos.</p>}
            </div>
          )}

          {consulta.trim() && planos.length > 0 && podeHefisto && (
            <button type="button" onClick={perguntar} className="mt-2 flex min-h-[48px] w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm font-semibold text-hf-text-2 hover:bg-hf-elevated">
              <MessageSquare size={16} className="shrink-0" aria-hidden="true" /><span className="min-w-0 truncate">Perguntar ao Héfisto: {consulta.trim()}</span>
            </button>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex min-h-[48px] items-center justify-between gap-3 border-t border-hf-border px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-xs text-hf-muted sm:px-4">
          {modo === "inicio" && !consulta ? (
            <button type="button" onClick={() => { setModo("explorar"); setSel(0); inputRef.current?.focus(); }} className="inline-flex items-center gap-1.5 font-semibold text-hf-text-2 hover:text-hf-text">
              <Compass size={15} />Ver todas as telas <span className="text-hf-muted">({acessiveis.length})</span>
            </button>
          ) : <span>{planos.length} {planos.length === 1 ? "item" : "itens"}</span>}
          <span className="hidden items-center gap-3 sm:flex">
            <span className="inline-flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} />navegar</span>
            <span className="inline-flex items-center gap-1"><CornerDownLeft size={11} />abrir</span>
            <span><kbd className="rounded border border-hf-border px-1 font-sans">Esc</kbd> para fechar</span>
          </span>
        </div>
      </div>
    </div>
  );
}
