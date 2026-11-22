"use client";

// Receita rápida (pedido do dono, 22/11/2026): a pessoa chega na receita em
// poucos toques e já ajusta a quantidade, dizendo se o ingrediente principal é
// cru ou cozido. A conta é feita aqui no aparelho (receitas-locais.mjs), na
// hora e sem internet. Ingredientes e passos podem ser marcados enquanto faz.

import { useMemo, useState } from "react";
import { Check, Clock, Minus, Plus, CalendarClock } from "lucide-react";
import { passosDaFicha, rendimentoBase, receitaNaMedida, quantidadeTexto } from "../../lib/intelligence/local/receitas-locais.mjs";

const VERDE = "var(--wa-verde-escuro, #005A49)";
const META = "var(--wa-meta, #667781)";
const FUNDO = "rgba(0, 90, 73, 0.07)";

function Chip({ ativo, onClick, children, destaque = false }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo}
      className={`min-h-[48px] flex-1 rounded-xl px-3 text-[16px] font-bold transition active:scale-[0.98] ${destaque && !ativo ? "animate-pulse" : ""}`}
      style={ativo ? { background: VERDE, color: "#fff" } : { background: "#fff", color: VERDE, boxShadow: destaque ? "inset 0 0 0 2.5px #F59E0B" : "inset 0 0 0 1.5px rgba(0,90,73,.25)" }}>
      {children}
    </button>
  );
}

export default function ReceitaRapida({ ficha, pedido = {} }) {
  const rend = rendimentoBase(ficha);
  const porcoes = rend.base === "porcoes";
  const volume = rend.base === "ml";
  const unidades = porcoes ? ["porções"] : volume ? ["L", "ml"] : ["kg", "g"];
  const unidadeInicial = pedido.unidade === "g" ? "g" : pedido.unidade === "ml" ? "ml" : pedido.unidade === "l" ? "L" : unidades[0];
  const [modo, setModo] = useState(pedido.qtd ? "outra" : "ficha");
  const [qtd, setQtd] = useState(pedido.qtd ? String(pedido.qtd).replace(".", ",") : "");
  const [unidade, setUnidade] = useState(unidadeInicial);
  const [estado, setEstado] = useState(pedido.estado || null);
  const [feitos, setFeitos] = useState(() => new Set());
  const [passosFeitos, setPassosFeitos] = useState(() => new Set());

  const numero = Number(String(qtd).replace(/\./g, "").replace(",", "."));
  const pedidoAtual = modo === "outra" && numero > 0
    ? { qtd: numero, unidade: porcoes ? "porcoes" : unidade.toLowerCase(), estado }
    : {};
  const calculada = useMemo(() => receitaNaMedida(ficha, pedidoAtual), [ficha, pedidoAtual.qtd, pedidoAtual.unidade, pedidoAtual.estado]); // eslint-disable-line react-hooks/exhaustive-deps
  const daFicha = useMemo(() => receitaNaMedida(ficha, {}), [ficha]);
  // Sem dizer se é cru ou cozido, a conta não sai: a lista fica a da ficha até a escolha.
  const m = calculada.precisaEstado ? { ...daFicha, principal: calculada.principal, precisaEstado: true } : calculada;
  const passos = useMemo(() => passosDaFicha(ficha), [ficha]);
  const principal = m.principal?.nome || null;
  const mostraEstado = modo === "outra" && principal && !porcoes && rend.base;
  const passo = (d) => {
    const atual = Number.isFinite(numero) && numero > 0 ? numero : 0;
    const step = unidade === "g" || unidade === "ml" ? 100 : porcoes ? 1 : 0.5;
    const novo = Math.max(0, Math.round((atual + d * step) * 100) / 100);
    setQtd(novo ? String(novo).replace(".", ",") : "");
    setModo("outra");
  };
  const alternar = (set, i) => set((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <section className="-mx-0.5 space-y-3" aria-label={`Receita de ${ficha.nome}`}>
      <header>
        <p className="text-[12.5px] font-bold uppercase tracking-wide" style={{ color: META }}>{ficha.base ? "Pré-preparo" : ficha.departamento === "bar" ? "Drink" : "Prato"}</p>
        <h3 className="text-[22px] font-extrabold leading-tight">{ficha.nome}</h3>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-[13.5px]" style={{ color: META }}>
          {rend.valor > 0 && <span>Ficha rende {porcoes ? `${String(ficha.rendQtd).replace(".", ",")} ${ficha.rendUn || "porções"}` : quantidadeTexto(ficha.rendQtd, ficha.rendUn)}</span>}
          {ficha.tempoMin ? <span className="inline-flex items-center gap-1"><Clock size={13} /> {ficha.tempoMin} min</span> : null}
          {ficha.validadeDias ? <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> validade {ficha.validadeDias} dia(s)</span> : null}
        </p>
      </header>

      {/* 1. QUANTO VAI FAZER */}
      <div className="space-y-2 rounded-2xl p-3" style={{ background: FUNDO }}>
        <p className="text-[16px] font-bold">Quanto você vai fazer?</p>
        <div className="flex gap-2">
          <Chip ativo={modo === "ficha"} onClick={() => { setModo("ficha"); setEstado(pedido.estado || null); }}>A da ficha</Chip>
          <Chip ativo={modo === "outra"} onClick={() => setModo("outra")}>Outra quantidade</Chip>
        </div>
        {modo === "outra" && (
          <>
            <div className="flex items-stretch gap-2">
              <button type="button" onClick={() => passo(-1)} aria-label="Menos" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl bg-white" style={{ color: VERDE }}><Minus size={22} /></button>
              <input inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" aria-label="Quantidade"
                className="h-[52px] min-w-0 flex-1 rounded-xl border-0 bg-white text-center text-[24px] font-extrabold tabular-nums outline-none" />
              <button type="button" onClick={() => passo(1)} aria-label="Mais" className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl bg-white" style={{ color: VERDE }}><Plus size={22} /></button>
              {unidades.length > 1 ? (
                <select value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade" className="h-[52px] rounded-xl border-0 bg-white px-2 text-[17px] font-bold" style={{ color: VERDE }}>
                  {unidades.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              ) : <span className="grid h-[52px] place-items-center px-1 text-[15px] font-bold">{unidades[0]}</span>}
            </div>
            {mostraEstado && (
              <div className="space-y-1.5">
                <p className="text-[15.5px] font-semibold">{principal} é cru ou cozido?</p>
                <div className="flex gap-2">
                  <Chip ativo={estado === "cru"} destaque={m.precisaEstado} onClick={() => setEstado("cru")}>Cru</Chip>
                  <Chip ativo={estado === "cozido"} destaque={m.precisaEstado} onClick={() => setEstado("cozido")}>Cozido (pronto)</Chip>
                </div>
                <p className="text-[13px]" style={{ color: META }}>
                  {estado === "cru" ? `Conta feita pelo ${principal.toLowerCase()} cru da ficha.` : estado === "cozido" ? "Conta feita pelo quanto a receita rende pronta." : "Escolha para eu ajustar os ingredientes."}
                </p>
              </div>
            )}
          </>
        )}
        {m.motivo && <p className="text-[14px] font-semibold text-amber-700">{m.motivo}</p>}
        {m.mudou && m.rendeTexto && (
          <p className="rounded-xl bg-white px-3 py-2 text-[15px]">Vai render cerca de <b>{m.rendeTexto}</b> <span className="text-[12.5px]" style={{ color: META }}>(estimativa)</span></p>
        )}
      </div>

      {/* 2. INGREDIENTES */}
      <div>
        <p className="mb-1 text-[13px] font-bold uppercase tracking-wide" style={{ color: META }}>Ingredientes {m.mudou ? "· na sua quantidade" : m.precisaEstado ? "· da ficha (falta escolher cru ou cozido)" : ""}</p>
        {m.ingredientes.length ? (
          <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl bg-white">
            {m.ingredientes.map((ing, i) => {
              const ok = feitos.has(i);
              return (
                <li key={i}>
                  <button type="button" onClick={() => alternar(setFeitos, i)} aria-pressed={ok}
                    className="grid min-h-[52px] w-full grid-cols-[28px_1fr_auto] items-center gap-3 px-3 text-left">
                    <span className="grid h-7 w-7 place-items-center rounded-full border-2" style={ok ? { background: VERDE, borderColor: VERDE, color: "#fff" } : { borderColor: "rgba(0,90,73,.35)" }}>{ok && <Check size={16} strokeWidth={3} />}</span>
                    <span className={`text-[16.5px] ${ing.principal ? "font-bold" : "font-medium"} ${ok ? "line-through opacity-50" : ""}`}>{ing.nome}</span>
                    <span className={`text-right text-[18px] font-extrabold tabular-nums ${ok ? "opacity-50" : ""}`} style={{ color: VERDE }}>{ing.texto}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-[15px]" style={{ color: META }}>Ingredientes não cadastrados na ficha.</p>}
      </div>

      {/* 3. PASSO A PASSO */}
      <div>
        <p className="mb-1 text-[13px] font-bold uppercase tracking-wide" style={{ color: META }}>Passo a passo</p>
        {m.mudou && passos.length > 0 && <p className="mb-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-[13.5px] text-amber-800">Se o passo falar em quantidade, use a da lista acima.</p>}
        {passos.length ? (
          <ol className="space-y-1.5">
            {passos.map((p, i) => {
              const ok = passosFeitos.has(i);
              return (
                <li key={i}>
                  <button type="button" onClick={() => alternar(setPassosFeitos, i)} aria-pressed={ok} className="flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] font-extrabold text-white" style={{ background: ok ? "#9CA3AF" : VERDE }}>{ok ? <Check size={16} strokeWidth={3} /> : i + 1}</span>
                    <span className={`pt-0.5 text-[16.5px] leading-snug ${ok ? "line-through opacity-50" : ""}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : <p className="text-[15px]" style={{ color: META }}>Modo de preparo não cadastrado na ficha.</p>}
      </div>
    </section>
  );
}
