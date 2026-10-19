"use client";
// Impressão automática do KDS: cada item novo que chega à fila do setor sai
// na impressora deste aparelho (configuração guardada aqui, por aparelho).

import { useCallback, useEffect, useRef, useState } from "react";
import { Printer, X, Plug, Check, TriangleAlert } from "lucide-react";
import { itensParaImprimir, marcarImpressos } from "../../lib/comanda-impressao.mjs";
import { CONFIG_PADRAO, gravarConfigImpressao, imprimirVias, lerConfigImpressao } from "../../lib/impressaoComanda";
import { conectarAssistenteImpressao } from "../../lib/impressaoTermica";

const idsDe = (tickets) => (tickets || []).flatMap((t) => (t.itens || []).map((i) => i.id));

export function useImpressaoKds({ unidadeId, setor, unidadeNome }) {
  const [cfg, setCfg] = useState(CONFIG_PADRAO);
  const [aviso, setAviso] = useState(null); // { tipo: "ok"|"erro", texto }
  const imprimindo = useRef(false);
  const chave = `kds-impressos:${unidadeId}:${setor}`;

  useEffect(() => { setCfg(lerConfigImpressao()); }, []);

  const lerImpressos = useCallback(() => {
    try { return JSON.parse(localStorage.getItem(chave) || "null"); } catch { return null; }
  }, [chave]);
  const gravarImpressos = useCallback((lista) => {
    try { localStorage.setItem(chave, JSON.stringify(lista)); } catch { /* segue */ }
  }, [chave]);

  const mudar = useCallback((parcial) => {
    setCfg((atual) => {
      const novo = { ...atual, ...parcial };
      gravarConfigImpressao(novo);
      // Ligou agora: o que já está na fila não sai; só o que chegar depois.
      if (parcial.auto === true && !atual.auto) { try { localStorage.removeItem(chave); } catch { /* segue */ } }
      return novo;
    });
  }, [chave]);

  const imprimir = useCallback(async (tickets, { marcar = true } = {}) => {
    const r = await imprimirVias(tickets, { ...cfg, setor, unidade: unidadeNome });
    if (r.erro) {
      setAviso({ tipo: "erro", texto: r.erro });
      return false;
    }
    if (marcar) gravarImpressos(marcarImpressos(lerImpressos() || [], idsDe(tickets)));
    setAviso({ tipo: "ok", texto: tickets.length > 1 ? `${tickets.length} vias impressas` : "Via impressa" });
    return true;
  }, [cfg, setor, unidadeNome, gravarImpressos, lerImpressos]);

  /** Chamado a cada leitura da fila. */
  const processarFila = useCallback(async (tickets) => {
    if (!cfg.auto || imprimindo.current || !unidadeId) return;
    const impressos = lerImpressos();
    if (impressos === null) { gravarImpressos(marcarImpressos([], idsDe(tickets))); return; }
    const novos = itensParaImprimir(tickets, impressos);
    if (!novos.length) return;
    imprimindo.current = true;
    try { await imprimir(novos); } finally { imprimindo.current = false; }
  }, [cfg.auto, unidadeId, lerImpressos, gravarImpressos, imprimir]);

  return { cfg, mudar, aviso, setAviso, imprimir, processarFila };
}

export function PainelImpressaoKds({ aberto, fechar, cfg, mudar, aviso, imprimirTeste }) {
  const [impressoras, setImpressoras] = useState([]);
  const [conectando, setConectando] = useState(false);
  const [erroQz, setErroQz] = useState("");

  const conectar = async () => {
    setConectando(true);
    setErroQz("");
    try {
      const r = await conectarAssistenteImpressao(cfg.impressora);
      setImpressoras(r.impressoras);
      if (!cfg.impressora && r.nome) mudar({ impressora: r.nome });
      if (!r.impressoras.length) setErroQz("O assistente não achou impressora neste computador.");
    } catch (e) {
      setErroQz("Não conectou. Abra o QZ Tray neste computador e autorize o Héfisto.");
    } finally {
      setConectando(false);
    }
  };

  if (!aberto) return null;
  const botao = (ativo) => `flex-1 px-3 py-2.5 rounded-xl border-2 text-sm font-bold transition-colors ${ativo ? "border-emerald-500 bg-emerald-500/15 text-hf-text" : "border-hf-border text-fg hover:text-hf-text"}`;
  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-6" onClick={fechar}>
      <div role="dialog" aria-modal="true" aria-label="Impressão da via" className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] bg-hf-surface border border-hf-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hf-border">
          <p className="text-lg font-black text-hf-text flex items-center gap-2"><Printer size={20} /> Impressão da via</p>
          <button onClick={fechar} aria-label="Fechar" className="p-2 rounded-xl bg-hf-elevated text-fg hover:text-hf-text"><X size={20} /></button>
        </div>
        <div className="p-5 flex flex-col gap-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-emerald-500" checked={cfg.auto} onChange={(e) => mudar({ auto: e.target.checked })} />
            <span>
              <span className="block font-black text-hf-text">Imprimir sozinho cada pedido novo</span>
              <span className="block text-sm font-bold text-fg">Vale para este aparelho e para o setor da tela. O que já está na fila não sai; só o que chegar depois. Item lançado depois na mesma comanda sai como acréscimo.</span>
            </span>
          </label>

          <div>
            <p className="text-xs font-black uppercase tracking-widest text-fg mb-2">Como imprimir</p>
            <div className="flex gap-2">
              <button className={botao(cfg.modo === "assistente")} aria-pressed={cfg.modo === "assistente"} onClick={() => mudar({ modo: "assistente" })}>Assistente QZ</button>
              <button className={botao(cfg.modo === "navegador")} aria-pressed={cfg.modo === "navegador"} onClick={() => mudar({ modo: "navegador" })}>Navegador</button>
            </div>
            <p className="mt-2 text-sm font-bold text-fg">
              {cfg.modo === "assistente"
                ? "Impressora térmica ligada a este computador, pelo QZ Tray: sai direto, sem perguntar."
                : "Usa a janela de impressão do navegador. Para sair sem perguntar, abra o Chrome com a opção --kiosk-printing e deixe a térmica como impressora padrão."}
            </p>
          </div>

          {cfg.modo === "assistente" && (
            <div className="flex flex-col gap-2">
              <button onClick={conectar} disabled={conectando} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-hf-elevated border border-hf-border font-bold text-hf-text disabled:opacity-60">
                <Plug size={18} /> {conectando ? "Conectando…" : impressoras.length ? "Procurar de novo" : "Conectar ao assistente"}
              </button>
              {erroQz && <p className="text-sm font-bold text-red-700">{erroQz}</p>}
              {(impressoras.length > 0 || cfg.impressora) && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-black uppercase tracking-widest text-fg">Impressora</span>
                  <select value={cfg.impressora} onChange={(e) => mudar({ impressora: e.target.value })} className="px-3 py-2.5 rounded-xl border border-hf-border bg-hf-surface font-bold text-hf-text">
                    <option value="">Escolha…</option>
                    {[...new Set([cfg.impressora, ...impressoras].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-black uppercase tracking-widest text-fg mb-2">Largura do papel</p>
            <div className="flex gap-2">
              {["80mm", "58mm"].map((l) => (
                <button key={l} className={botao(cfg.largura === l)} aria-pressed={cfg.largura === l} onClick={() => mudar({ largura: l })}>{l.replace("mm", " mm")}</button>
              ))}
            </div>
          </div>

          {aviso && (
            <p role="status" className={`flex items-center gap-2 text-sm font-bold ${aviso.tipo === "erro" ? "text-red-700" : "text-emerald-700"}`}>
              {aviso.tipo === "erro" ? <TriangleAlert size={16} /> : <Check size={16} />} {aviso.texto}
            </p>
          )}

          <button onClick={imprimirTeste} className="px-4 py-3 rounded-xl bg-emerald-500 text-white font-black uppercase tracking-widest">Imprimir teste</button>
        </div>
      </div>
    </div>
  );
}
