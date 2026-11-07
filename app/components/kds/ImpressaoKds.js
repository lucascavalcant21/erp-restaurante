"use client";
// Impressão automática do KDS: cada item novo que chega à fila sai na
// impressora do SETOR do item neste aparelho (cozinha ou bar), com o modelo
// editado em Configurações → Impressão. Ligar/desligar fica por setor da tela:
// a cozinha pode ter só tela, só impressão ou as duas (07/11/2026).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Printer, X, Check, TriangleAlert, Settings2 } from "lucide-react";
import { itensParaImprimir, marcarImpressos } from "../../lib/comanda-impressao.mjs";
import { linhasDaProducao, mesclarModelos } from "../../lib/impressao-modelos.mjs";
import { CONEXOES, imprimirNoSetor, lerImpressorasDoAparelho } from "../../lib/impressoras-aparelho";
import { fetchModelosImpressao } from "../../lib/parametros";

const idsDe = (tickets) => (tickets || []).flatMap((t) => (t.itens || []).map((i) => i.id));
const RELER_MODELOS_MS = 5 * 60 * 1000;
const setoresDaTela = (setor) => (setor === "todos" ? ["cozinha", "bar"] : [setor === "bar" ? "bar" : "cozinha"]);

function lerAuto(setor) {
  try {
    const v = localStorage.getItem(`kds-auto:${setor}`);
    if (v !== null) return v === "1";
    // Configuração antiga (uma só por aparelho): vale como ponto de partida.
    return !!JSON.parse(localStorage.getItem("kds-impressao") || "null")?.auto;
  } catch { return false; }
}

/** Resumo da impressora de um setor neste aparelho, para a tela. */
export function resumoDaImpressora(cfg) {
  if (!cfg) return "";
  const onde = cfg.conexao === "rede" ? (cfg.ip ? ` ${cfg.ip}` : "") : cfg.impressora ? `: ${cfg.impressora}` : "";
  return `${CONEXOES[cfg.conexao]?.rotulo || cfg.conexao}${onde} · ${cfg.largura.replace("mm", " mm")}`;
}

export function useImpressaoKds({ unidadeId, setor }) {
  const [auto, setAuto] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "ok"|"erro", texto }
  const imprimindo = useRef(false);
  const modelos = useRef({ dados: mesclarModelos(null), lidoEm: 0 });
  const chave = `kds-impressos:${unidadeId}:${setor}`;

  useEffect(() => { setAuto(lerAuto(setor)); }, [setor]);

  const lerModelos = useCallback(async () => {
    if (!unidadeId || Date.now() - modelos.current.lidoEm < RELER_MODELOS_MS) return modelos.current.dados;
    const r = await fetchModelosImpressao(unidadeId).catch(() => ({ data: null }));
    modelos.current = { dados: mesclarModelos(r?.data), lidoEm: Date.now() };
    return modelos.current.dados;
  }, [unidadeId]);
  useEffect(() => { modelos.current.lidoEm = 0; lerModelos(); }, [lerModelos]);

  const lerImpressos = useCallback(() => {
    try { return JSON.parse(localStorage.getItem(chave) || "null"); } catch { return null; }
  }, [chave]);
  const gravarImpressos = useCallback((lista) => {
    try { localStorage.setItem(chave, JSON.stringify(lista)); } catch { /* segue */ }
  }, [chave]);

  const mudarAuto = useCallback((ligado) => {
    setAuto(ligado);
    try { localStorage.setItem(`kds-auto:${setor}`, ligado ? "1" : "0"); } catch { /* segue */ }
    // Ligou agora: o que já está na fila não sai; só o que chegar depois.
    if (ligado) { try { localStorage.removeItem(chave); } catch { /* segue */ } }
  }, [setor, chave]);

  /** Imprime os tickets: cada item vai para a impressora do setor dele. */
  const imprimir = useCallback(async (tickets, { marcar = true } = {}) => {
    const m = await lerModelos();
    const erros = [];
    let vias = 0;
    for (const s of ["cozinha", "bar"]) {
      const doSetor = (tickets || []).map((t) => ({ ...t, itens: (t.itens || []).filter((i) => (i.setor || "cozinha") === s) })).filter((t) => t.itens.length);
      if (!doSetor.length) continue;
      const r = await imprimirNoSetor(s, doSetor.map((t) => linhasDaProducao(s, t, m)), { copias: m[s].copias, cortar: m[s].cortar, titulo: s === "bar" ? "Bar" : "Cozinha" });
      if (r.erro) erros.push(`${s === "bar" ? "Bar" : "Cozinha"}: ${r.erro}`);
      else vias += doSetor.length;
    }
    if (erros.length) {
      setAviso({ tipo: "erro", texto: erros.join(" ") });
      return false;
    }
    if (marcar) gravarImpressos(marcarImpressos(lerImpressos() || [], idsDe(tickets)));
    setAviso({ tipo: "ok", texto: vias > 1 ? `${vias} vias impressas` : "Via impressa" });
    return true;
  }, [lerModelos, gravarImpressos, lerImpressos]);

  /** Chamado a cada leitura da fila. */
  const processarFila = useCallback(async (tickets) => {
    if (!auto || imprimindo.current || !unidadeId) return;
    const impressos = lerImpressos();
    if (impressos === null) { gravarImpressos(marcarImpressos([], idsDe(tickets))); return; }
    const novos = itensParaImprimir(tickets, impressos);
    if (!novos.length) return;
    imprimindo.current = true;
    try { await imprimir(novos); } finally { imprimindo.current = false; }
  }, [auto, unidadeId, lerImpressos, gravarImpressos, imprimir]);

  return { cfg: { auto }, mudarAuto, aviso, setAviso, imprimir, processarFila };
}

export function PainelImpressaoKds({ aberto, fechar, setor, auto, mudarAuto, aviso, imprimirTeste }) {
  const [impressoras, setImpressoras] = useState(null);
  useEffect(() => { if (aberto) setImpressoras(lerImpressorasDoAparelho()); }, [aberto]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label="Impressão da via" className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-hf-surface border border-hf-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hf-border">
          <p className="text-lg font-black text-hf-text flex items-center gap-2"><Printer size={20} /> Impressão da via</p>
          <button onClick={fechar} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-xl bg-hf-elevated text-fg hover:text-hf-text"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-500" checked={auto} onChange={(e) => mudarAuto(e.target.checked)} />
            <span>
              <span className="block font-black text-hf-text">Imprimir sozinho cada pedido novo</span>
              <span className="block text-sm font-bold text-fg">Vale para esta tela neste aparelho. Desligado, a tela só mostra; ligado, mostra e imprime. O que já está na fila não sai; só o que chegar depois. Item lançado depois na mesma comanda sai como acréscimo.</span>
            </span>
          </label>

          <div className="rounded-2xl border border-hf-border p-4">
            <p className="text-xs font-black uppercase tracking-widest text-fg mb-2">Impressora neste aparelho</p>
            <ul className="space-y-1">
              {setoresDaTela(setor).map((s) => (
                <li key={s} className="text-sm text-hf-text"><b>{s === "bar" ? "Bar" : "Cozinha"}:</b> {impressoras ? resumoDaImpressora(impressoras[s]) : "…"}</li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/dashboard/configuracoes/impressao?aba=impressoras" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hf-border px-4 text-sm font-bold text-hf-text hover:bg-hf-elevated"><Settings2 size={16} /> Trocar impressora</Link>
              <Link href="/dashboard/configuracoes/impressao" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hf-border px-4 text-sm font-bold text-hf-text hover:bg-hf-elevated">Editar o modelo da via</Link>
            </div>
          </div>

          {aviso && (
            <p role="status" className={`flex items-center gap-2 text-sm font-bold ${aviso.tipo === "erro" ? "text-red-700" : "text-emerald-700"}`}>
              {aviso.tipo === "erro" ? <TriangleAlert size={16} /> : <Check size={16} />} {aviso.texto}
            </p>
          )}

          <button onClick={imprimirTeste} className="min-h-[48px] px-4 py-3 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-widest">Imprimir teste</button>
        </div>
      </div>
    </div>
  );
}
