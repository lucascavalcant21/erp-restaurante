"use client";

// Conciliação da fatura do app (especificação do dono, 21/11/2026, item F):
// importar a planilha de faturamento do app, conferir pedido por pedido e ver
// a diferença entre a taxa do contrato e a que o app cobrou. Os pedidos
// viram vendas (receita REAL no DRE), sem repetir e sem edição.

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, Secao, brl, inputCls, pctTxt } from "./ui";
import { CAMPOS, conciliar, detectarColunas, lerCsv, pedidosDaPlanilha, vendasDaFatura } from "../../lib/marmitaria/conciliacao.mjs";
import { lerXlsx } from "../../lib/planilha-xlsx.mjs";
import { importarFatura, referenciasDaFatura, salvarFaturaNoCanal } from "../../lib/marmitaria/dados";
import { normalizarCanal } from "../../lib/marmitaria/nucleo.mjs";

const dataBR = (d) => (d ? d.split("-").reverse().join("/") : "—");

export default function Conciliacao() {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const apps = useMemo(() => (base?.config?.canais || []).map(normalizarCanal).filter((c) => c.id && c.id !== "balcao" && !/balc|retirada/i.test(c.nome)), [base]);
  const [canalId, setCanalId] = useState(apps[0]?.id || "");
  const [arquivo, setArquivo] = useState(null);
  const [linhas, setLinhas] = useState(null);
  const [det, setDet] = useState(null);
  const [ja, setJa] = useState(new Set());
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [verTodos, setVerTodos] = useState(false);

  const canal = apps.find((c) => c.id === canalId) || null;
  const contratoPct = canal && canal.comissao_pct != null ? Math.round(((canal.comissao_pct || 0) + (canal.pagamento_na_comissao ? 0 : canal.taxa_pagamento_pct || 0)) * 100) / 100 : null;
  const lidos = useMemo(() => (linhas && det ? pedidosDaPlanilha(linhas, det) : null), [linhas, det]);
  const c = useMemo(() => (lidos ? conciliar(lidos.pedidos, { contratoPct }) : null), [lidos, contratoPct]);
  const novas = useMemo(() => (c && canal ? vendasDaFatura(c.linhas, { canal: canal.id, jaImportadas: ja }) : []), [c, canal, ja]);

  async function abrir(f) {
    if (!f) return;
    setLendo(true); setMsg(null); setLinhas(null); setDet(null); setArquivo(f.name);
    try {
      const l = /\.xlsx$/i.test(f.name) ? await lerXlsx(await f.arrayBuffer()) : lerCsv(await f.text());
      if (!l.length) throw new Error("A planilha está vazia.");
      setLinhas(l); setDet(detectarColunas(l));
      if (canalId) setJa(await referenciasDaFatura(unidadeId, canalId));
    } catch (e) {
      setMsg({ tipo: "alerta", texto: /\.xls$/i.test(f.name) ? "Arquivo .xls antigo: salve como .xlsx ou .csv e envie de novo." : `Não consegui ler a planilha: ${e.message}` });
    } finally { setLendo(false); }
  }

  async function trocarCanal(id) {
    setCanalId(id);
    if (linhas) setJa(await referenciasDaFatura(unidadeId, id));
  }

  async function gravarVendas() {
    if (salvando || !novas.length) return;
    setSalvando(true); setMsg(null);
    try {
      const r = await importarFatura(unidadeId, novas);
      if (r.error) { setMsg({ tipo: "alerta", texto: `${r.gravadas ? `${r.gravadas} pedidos gravados, mas parou: ` : ""}${r.error}` }); return; }
      setJa(await referenciasDaFatura(unidadeId, canalId));
      setMsg({ tipo: "info", texto: `${r.gravadas} pedidos gravados como vendas do ${canal.nome}. Já aparecem no DRE.` });
    } finally { setSalvando(false); }
  }

  async function usarComoFatura() {
    if (salvando || !c) return;
    setSalvando(true); setMsg(null);
    try {
      const r = await salvarFaturaNoCanal(unidadeId, canalId, { ganhos: c.total.bruto, ofertas: c.total.ofertas, taxas: c.total.taxas, periodo: c.periodo ? `${dataBR(c.periodo.de)} a ${dataBR(c.periodo.ate)}` : "" });
      if (r.error) { setMsg({ tipo: "alerta", texto: r.error }); return; }
      await recarregar();
      setMsg({ tipo: "info", texto: `Taxa real do ${canal.nome} atualizada: ${pctTxt(c.totalPct)} (em Configurações › Apps e taxas).` });
    } finally { setSalvando(false); }
  }

  if (!base) return null;
  if (!apps.length) return <Secao titulo="Conciliação da fatura"><p className="text-sm text-hf-text-2">Cadastre um app em Configurações › Apps e taxas primeiro.</p></Secao>;

  const mostrar = c ? (verTodos ? c.linhas : c.linhas.filter((l) => l.problemas.length)).slice(0, 200) : [];

  return (
    <div className="space-y-4">
      <Secao titulo="Conciliação da fatura do app" subtitulo="Envie a planilha de faturamento que o app manda (.xlsx ou .csv). O sistema confere pedido por pedido e mostra quanto o app cobrou de verdade.">
        <div className="flex flex-wrap gap-1.5">
          {apps.map((a) => <button key={a.id} type="button" aria-pressed={a.id === canalId} onClick={() => trocarCanal(a.id)}
            className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${a.id === canalId ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border bg-hf-surface text-hf-text-2"}`}>{a.nome}</button>)}
        </div>
        <label className="mt-3 flex min-h-[64px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-hf-border p-4 text-sm font-bold text-hf-text hover:border-hf-accent">
          {lendo ? "Lendo a planilha…" : <><Upload size={18} /> {arquivo ? `Trocar planilha (${arquivo})` : "Escolher a planilha da fatura"}</>}
          <input type="file" accept=".xlsx,.csv,text/csv" className="hidden" onChange={(e) => abrir(e.target.files?.[0])} />
        </label>
        {contratoPct != null && <p className="mt-2 text-xs text-hf-muted">Contrato do {canal?.nome}: {pctTxt(contratoPct)} (comissão + pagamento).</p>}
      </Secao>

      {det && linhas && (
        <Secao titulo="Colunas da planilha" subtitulo="Conferi o cabeçalho sozinho. Se alguma coluna estiver errada, troque aqui.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPOS.map((f) => (
              <Campo key={f.id} rotulo={f.rotulo}>
                <select className={inputCls} value={det.mapa[f.id] ?? ""} onChange={(e) => setDet({ ...det, mapa: { ...det.mapa, [f.id]: e.target.value === "" ? undefined : Number(e.target.value) } })}>
                  <option value="">— não tem</option>
                  {det.cabecalho.map((h, i) => <option key={i} value={i}>{String(h || `Coluna ${i + 1}`)}</option>)}
                </select>
              </Campo>
            ))}
          </div>
          {(det.mapa.pedido == null || det.mapa.bruto == null) && <Aviso tipo="alerta" className="mt-3">Escolha pelo menos a coluna do número do pedido e a do valor do pedido.</Aviso>}
        </Secao>
      )}

      {c && c.total.pedidos > 0 && (
        <Secao titulo={`Resultado: ${c.total.pedidos} pedidos${c.periodo ? ` de ${dataBR(c.periodo.de)} a ${dataBR(c.periodo.ate)}` : ""}`} subtitulo={lidos.ignoradas.length ? `${lidos.ignoradas.length} linha(s) ignoradas (total, repetidas ou sem valor).` : undefined}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-hf-elevated p-3"><p className="text-[11px] text-hf-muted">Valor dos pedidos</p><p className="text-lg font-black tabular-nums">{brl(c.total.bruto)}</p></div>
            <div className="rounded-xl bg-hf-elevated p-3"><p className="text-[11px] text-hf-muted">Ofertas da loja</p><p className="text-lg font-black tabular-nums">{brl(c.total.ofertas)}</p><p className="text-[11px] text-hf-muted">{pctTxt(c.ofertasPct)}</p></div>
            <div className="rounded-xl bg-hf-elevated p-3"><p className="text-[11px] text-hf-muted">Taxas cobradas</p><p className="text-lg font-black tabular-nums">{brl(c.total.taxas)}</p><p className="text-[11px] text-hf-muted">{pctTxt(c.taxasPct)}{contratoPct != null ? ` · contrato ${pctTxt(contratoPct)}` : ""}</p></div>
            <div className="rounded-xl bg-hf-elevated p-3"><p className="text-[11px] text-hf-muted">Chegou para você</p><p className="text-lg font-black tabular-nums">{brl(c.total.liquido)}</p></div>
          </div>
          {c.diferencaContrato != null && (
            <Aviso tipo={c.diferencaContrato > 0.5 ? "alerta" : "info"} className="mt-3">
              {c.diferencaContrato > 0.5 ? `O app cobrou ${brl(c.diferencaContrato)} a mais do que o contrato daria (${brl(c.esperadoContrato)}).` : c.diferencaContrato < -0.5 ? `As taxas ficaram ${brl(-c.diferencaContrato)} abaixo do contrato.` : "As taxas bateram com o contrato."}
            </Aviso>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-hf-text">{c.comProblema ? <><AlertTriangle size={15} className="mr-1 inline text-hf-warning" />{c.comProblema} pedido(s) para conferir</> : <><CheckCircle2 size={15} className="mr-1 inline text-hf-success" />Nenhum pedido com diferença</>}</p>
            <button type="button" onClick={() => setVerTodos(!verTodos)} className="min-h-[40px] text-xs font-bold text-hf-accent">{verTodos ? "Só os com diferença" : "Ver todos"}</button>
          </div>
          {mostrar.length > 0 && (
            <ul className="mt-2 divide-y divide-hf-border rounded-xl border border-hf-border">
              {mostrar.map((l) => (
                <li key={l.pedido} className="px-3 py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 font-semibold text-hf-text">Pedido {l.pedido} <span className="text-xs font-normal text-hf-muted">{dataBR(l.data)}</span></span>
                    <span className="shrink-0 tabular-nums">{brl(l.bruto)} <span className="text-xs text-hf-muted">taxa {l.taxaPct == null ? "—" : pctTxt(l.taxaPct)}</span></span>
                  </div>
                  {l.problemas.map((p) => <p key={p} className="text-xs text-hf-warning">{p}</p>)}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 space-y-2">
            <Botao type="button" onClick={gravarVendas} disabled={salvando || !novas.length}><FileSpreadsheet size={16} /> {novas.length ? `Gravar ${novas.length} pedidos como vendas do ${canal?.nome}` : "Todos os pedidos já foram gravados"}</Botao>
            {ja.size > 0 && novas.length > 0 && <p className="text-xs text-hf-muted">{c.total.pedidos - novas.length} pedido(s) desta planilha já estavam gravados e não se repetem.</p>}
            <p className="text-xs text-hf-muted">Vira receita real no DRE. Se você já lançou essas vendas à mão em Vendas, apague as manuais para não contar duas vezes. Pedido gravado pela fatura não se edita.</p>
            <Botao type="button" variante="secundario" onClick={usarComoFatura} disabled={salvando}>Usar estes totais como a taxa real do {canal?.nome}</Botao>
          </div>
        </Secao>
      )}
      {c && c.total.pedidos === 0 && <Aviso tipo="alerta">Não achei pedidos nessa planilha com as colunas escolhidas.</Aviso>}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
    </div>
  );
}
