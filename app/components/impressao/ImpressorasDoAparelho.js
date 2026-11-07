"use client";

// Impressora de cada setor (cozinha, bar, caixa) NESTE aparelho, com teste.
// Fica guardado no navegador: cada tablet ou computador escolhe a sua.

import { useEffect, useState } from "react";
import { Bluetooth, Check, Loader2, Printer, Search, TriangleAlert, Usb } from "lucide-react";
import { CONEXOES, SETORES_DE_IMPRESSAO, faltaParaImprimir, gravarImpressoraDoSetor, imprimirNoSetor, lerImpressorasDoAparelho } from "../../lib/impressoras-aparelho";
import { conectarAssistenteImpressao } from "../../lib/impressaoTermica";
import { conectarImpressoraUsb, impressoraUsbConectada, reconectarImpressoraUsb, usbDisponivel } from "../../lib/impressaoUsb";
import { bluetoothDisponivel, conectarImpressoraBluetooth, impressoraBluetoothConectada, motivoBluetoothIndisponivel, nomeImpressoraBluetooth } from "../../lib/impressaoBluetooth";
import { linhasDeExemplo } from "./EditorDeModelos";

const inputCls = "min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none focus:border-hf-accent";
const VIA_DO_SETOR = { cozinha: "cozinha", bar: "bar", caixa: "recibo" };

function CartaoDoSetor({ setor, cfg, onChange, modelos }) {
  const [lista, setLista] = useState([]);
  const [estado, setEstado] = useState(null); // { tipo: "ok"|"erro"|"carregando", texto }
  const [usbOk, setUsbOk] = useState(false);
  const [btOk, setBtOk] = useState(false);
  const falta = faltaParaImprimir(cfg);

  useEffect(() => {
    if (cfg.conexao === "usb") reconectarImpressoraUsb().then(() => setUsbOk(impressoraUsbConectada())).catch(() => {});
    if (cfg.conexao === "bluetooth") setBtOk(impressoraBluetoothConectada());
  }, [cfg.conexao]);

  async function procurar() {
    setEstado({ tipo: "carregando", texto: "Procurando o assistente…" });
    try {
      const r = await conectarAssistenteImpressao(cfg.impressora);
      setLista(r.impressoras);
      if (!cfg.impressora && r.nome) onChange({ ...cfg, impressora: r.nome });
      setEstado({ tipo: "ok", texto: `${r.impressoras.length} impressora(s) encontrada(s).` });
    } catch (e) {
      setEstado({ tipo: "erro", texto: "Assistente não encontrado. Instale e abra o QZ Tray neste computador." });
    }
  }
  async function conectar(tipo) {
    setEstado({ tipo: "carregando", texto: "Conectando…" });
    try {
      const r = tipo === "usb" ? await conectarImpressoraUsb() : await conectarImpressoraBluetooth();
      if (tipo === "usb") setUsbOk(true); else setBtOk(true);
      onChange({ ...cfg, impressora: r.nome });
      setEstado({ tipo: "ok", texto: `Conectada: ${r.nome}.` });
    } catch (e) {
      setEstado({ tipo: "erro", texto: e?.name === "NotFoundError" ? "Nenhuma impressora escolhida." : e?.message || "Não conectou." });
    }
  }
  async function testar() {
    setEstado({ tipo: "carregando", texto: "Imprimindo…" });
    const via = VIA_DO_SETOR[setor];
    const r = await imprimirNoSetor(setor, [linhasDeExemplo(via, modelos)], { cortar: modelos[via].cortar, titulo: `Teste ${SETORES_DE_IMPRESSAO[setor]}` });
    setEstado(r.erro ? { tipo: "erro", texto: r.erro } : { tipo: "ok", texto: "Teste enviado. Confira o papel." });
  }

  const semUsb = cfg.conexao === "usb" && !usbDisponivel();
  const semBt = cfg.conexao === "bluetooth" && !bluetoothDisponivel();

  return (
    <section className="space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-4">
      <div className="flex items-center gap-2">
        <Printer size={18} className="text-hf-accent" />
        <h3 className="text-base font-black text-hf-text">{SETORES_DE_IMPRESSAO[setor]}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-bold text-hf-text-2">Ligação</span>
          <select className={`${inputCls} mt-1`} value={cfg.conexao} onChange={(e) => { setEstado(null); onChange({ ...cfg, conexao: e.target.value }); }}>
            {Object.entries(CONEXOES).map(([id, c]) => <option key={id} value={id}>{c.rotulo}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-bold text-hf-text-2">Papel</span>
          <select className={`${inputCls} mt-1 sm:w-28`} value={cfg.largura} onChange={(e) => onChange({ ...cfg, largura: e.target.value })}>
            <option value="80mm">80 mm</option><option value="58mm">58 mm</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-hf-text-2">{CONEXOES[cfg.conexao].ajuda}</p>

      {cfg.conexao === "assistente" && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          {lista.length ? (
            <select className={inputCls} value={cfg.impressora} onChange={(e) => onChange({ ...cfg, impressora: e.target.value })} aria-label="Impressora">
              <option value="">Escolha a impressora</option>
              {lista.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : <p className="flex min-h-[44px] items-center text-sm text-hf-text">{cfg.impressora || "Nenhuma impressora escolhida."}</p>}
          <button type="button" onClick={procurar} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-hf-border px-4 text-sm font-bold text-hf-text hover:bg-hf-elevated"><Search size={16} /> Procurar impressoras</button>
        </div>
      )}
      {cfg.conexao === "rede" && (
        <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
          <label className="block"><span className="text-xs font-bold text-hf-text-2">IP da impressora</span>
            <input className={`${inputCls} mt-1`} inputMode="decimal" placeholder="192.168.0.50" value={cfg.ip} onChange={(e) => onChange({ ...cfg, ip: e.target.value.replace(/[^0-9.]/g, "") })} /></label>
          <label className="block"><span className="text-xs font-bold text-hf-text-2">Porta</span>
            <input className={`${inputCls} mt-1`} inputMode="numeric" value={cfg.porta} onChange={(e) => onChange({ ...cfg, porta: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
      )}
      {cfg.conexao === "usb" && (semUsb ? <p className="text-sm font-semibold text-hf-warning">Este navegador não tem USB direto. Use o Chrome no computador ou no Android.</p> : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => conectar("usb")} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hf-border px-4 text-sm font-bold text-hf-text hover:bg-hf-elevated"><Usb size={16} /> {usbOk ? "Trocar impressora USB" : "Conectar impressora USB"}</button>
          {usbOk && <span className="text-sm text-hf-success">Conectada{cfg.impressora ? `: ${cfg.impressora}` : ""}</span>}
        </div>
      ))}
      {cfg.conexao === "bluetooth" && (semBt ? <p className="text-sm font-semibold text-hf-warning">{motivoBluetoothIndisponivel() || "Este navegador não tem Bluetooth."}</p> : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => conectar("bluetooth")} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hf-border px-4 text-sm font-bold text-hf-text hover:bg-hf-elevated"><Bluetooth size={16} /> {btOk ? "Trocar impressora" : "Conectar por Bluetooth"}</button>
          {btOk && <span className="text-sm text-hf-success">Conectada: {nomeImpressoraBluetooth() || cfg.impressora}</span>}
          <span className="w-full text-xs text-hf-muted">Ao recarregar a página, toque em conectar de novo: o navegador exige.</span>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-hf-border pt-3">
        <button type="button" onClick={testar} disabled={!!falta || estado?.tipo === "carregando"}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-bold text-hf-accent-fg disabled:opacity-50">
          {estado?.tipo === "carregando" ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Imprimir teste
        </button>
        {falta && <span className="text-sm text-hf-text-2">{falta}</span>}
        {estado && estado.tipo !== "carregando" && (
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${estado.tipo === "ok" ? "text-hf-success" : "text-hf-danger"}`} role="status">
            {estado.tipo === "ok" ? <Check size={16} /> : <TriangleAlert size={16} />} {estado.texto}
          </span>
        )}
      </div>
    </section>
  );
}

export default function ImpressorasDoAparelho({ modelos }) {
  const [cfgs, setCfgs] = useState(null);
  useEffect(() => { setCfgs(lerImpressorasDoAparelho()); }, []);
  if (!cfgs) return null;
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-hf-elevated p-3 text-sm text-hf-text">
        Isto fica guardado <b>só neste aparelho</b>. No tablet da cozinha, configure a Cozinha; no computador do caixa, o Caixa.
        A via da cozinha e a do bar saem da tela da cozinha de cada setor com a impressão automática ligada.
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        {Object.keys(SETORES_DE_IMPRESSAO).map((s) => (
          <CartaoDoSetor key={s} setor={s} cfg={cfgs[s]} modelos={modelos} onChange={(novo) => setCfgs(gravarImpressoraDoSetor(s, novo))} />
        ))}
      </div>
    </div>
  );
}
