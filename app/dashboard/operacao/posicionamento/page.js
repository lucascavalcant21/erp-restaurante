"use client";

// POSICIONAMENTO (pedido do dono, 23/11/2026): quanto de cada produto vai no
// prato. "Filé de frango 200 g", "Picanha média de 250 g", "Batata frita 100 g,
// aceita de 90 a 100 g". Serve para restaurante, marmitaria e eventos.
// A equipe pergunta ao Nico/Jhon ("posicionamento", "posicionamento do filé").
// Contas e textos: app/lib/posicionamento.mjs. Guardado em
// config_sistema.params.posicionamento.

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Plus, Printer, Scale, Search, Trash2, X } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import { useERP } from "../../../context/ERPContext";
import { usePermission } from "../../../components/access-control/PermissionGate";
import { fetchPosicionamento, salvarPosicionamento } from "../../../lib/parametros";
import { UNIDADES_POSICIONAMENTO, conferirItemPos, normalizarItemPos, normalizarPosicionamento, novoIdPos, textoAlvo, textoFaixa } from "../../../lib/posicionamento.mjs";

/** Imprime por um iframe escondido (o tablet bloqueia janela nova). */
function imprimirHtml(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } finally { setTimeout(() => iframe.remove(), 60000); } }, 50);
}

const inputCls = "h-12 w-full rounded-full border border-hf-border bg-hf-surface px-4 text-[16px] font-semibold text-hf-text outline-none focus:border-hf-accent";
const VAZIO = { nome: "", unidade: "g", alvo: "", min: "", max: "", media: false, obs: "" };
const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function Formulario({ inicial, outros, onSalvar, onCancelar, salvando }) {
  const [f, setF] = useState({ ...VAZIO, ...inicial, alvo: inicial?.alvo ?? "", min: inicial?.min ?? "", max: inicial?.max ?? "" });
  const [erros, setErros] = useState([]);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const un = f.unidade === "un" ? "un" : f.unidade;
  function salvar() {
    const e = conferirItemPos(f, outros);
    setErros(e);
    if (!e.length) onSalvar(normalizarItemPos({ ...f, atualizado_em: new Date().toISOString() }));
  }
  return (
    <div className="space-y-3 rounded-3xl border border-hf-border bg-hf-surface p-4">
      <label className="block">
        <span className="text-[13px] font-medium text-hf-muted">Produto</span>
        <input autoFocus value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Filé de frango" className={`${inputCls} mt-1`} />
      </label>
      <div>
        <span className="text-[13px] font-medium text-hf-muted">Medida</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {UNIDADES_POSICIONAMENTO.map((u) => (
            <button key={u.id} type="button" aria-pressed={f.unidade === u.id} onClick={() => set("unidade", u.id)}
              className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${f.unidade === u.id ? "bg-hf-menu text-white" : "border border-hf-border text-hf-text-2"}`}>{u.rotulo}</button>
          ))}
          <button type="button" aria-pressed={f.media} onClick={() => set("media", !f.media)}
            className={`min-h-[44px] rounded-full px-4 text-sm font-bold ${f.media ? "bg-hf-menu text-white" : "border border-hf-border text-hf-text-2"}`}>É uma média</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[["alvo", f.media ? `Média (${un})` : `No prato (${un})`], ["min", `Mínimo (${un})`], ["max", `Máximo (${un})`]].map(([k, rot]) => (
          <label key={k} className="block min-w-0">
            <span className="text-[13px] font-medium text-hf-muted">{rot}</span>
            <input inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={k === "alvo" ? "200" : "opcional"} className={`${inputCls} mt-1 text-center tabular-nums`} />
          </label>
        ))}
      </div>
      <label className="block">
        <span className="text-[13px] font-medium text-hf-muted">Observação (opcional)</span>
        <input value={f.obs} onChange={(e) => set("obs", e.target.value)} placeholder="Ex.: pesar depois de frito" className={`${inputCls} mt-1`} />
      </label>
      {erros.length > 0 && <ul className="space-y-1 text-[14px] font-semibold text-hf-danger">{erros.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-hf-border text-sm font-bold text-hf-text-2"><X size={16} /> Cancelar</button>
        <button type="button" onClick={salvar} disabled={salvando} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-hf-menu text-sm font-black text-white disabled:opacity-50">
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Salvar
        </button>
      </div>
    </div>
  );
}

export default function Posicionamento() {
  const { unidadeAtiva } = useERP();
  const podeCriar = usePermission("cozinha.portioning.create");
  const podeEditar = usePermission("cozinha.portioning.edit");
  const podeExcluir = usePermission("cozinha.portioning.delete");
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  const [editando, setEditando] = useState(null); // id, "novo" ou null
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    fetchPosicionamento(unidadeAtiva).then(({ data, error }) => {
      if (!vivo) return;
      setErroCarga(error || "");
      setItens(normalizarPosicionamento(data).itens);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const lista = useMemo(() => {
    const q = semAcento(busca).trim();
    return q ? itens.filter((i) => semAcento(i.nome).includes(q)) : itens;
  }, [itens, busca]);

  async function gravar(novos, msg) {
    setSalvando(true);
    const dados = normalizarPosicionamento({ itens: novos });
    const r = await salvarPosicionamento(unidadeAtiva, dados);
    setSalvando(false);
    if (r?.error) { setAviso(`Não salvou: ${r.error}`); return false; }
    setItens(dados.itens);
    setEditando(null);
    setAviso(msg);
    setTimeout(() => setAviso(""), 3000);
    return true;
  }

  const salvarItem = (item) => gravar(editando === "novo" ? [...itens, { ...item, id: novoIdPos() }] : itens.map((i) => (i.id === item.id ? item : i)), `${item.nome} salvo.`);
  const excluir = (item) => { if (window.confirm(`Tirar "${item.nome}" do posicionamento?`)) gravar(itens.filter((i) => i.id !== item.id), `${item.nome} removido.`); };

  function imprimir() {
    imprimirHtml(`<html><head><meta charset="utf-8"><title>Posicionamento</title><style>
      body{font-family:system-ui,sans-serif;padding:24px;color:#111827} h1{font-size:22px;margin:0 0 12px}
      table{width:100%;border-collapse:collapse;font-size:16px} td,th{border-bottom:1px solid #d1d5db;padding:8px 6px;text-align:left} td.n{text-align:right;font-weight:800;white-space:nowrap}
      .s{color:#4b5563;font-size:13px}</style></head><body><h1>Posicionamento · quanto vai no prato</h1>
      <table><tr><th>Produto</th><th style="text-align:right">No prato</th><th>Aceita</th></tr>
      ${itens.map((i) => `<tr><td>${esc(i.nome)}${i.obs ? `<div class="s">${esc(i.obs)}</div>` : ""}</td><td class="n">${esc(textoAlvo(i))}</td><td>${esc(textoFaixa(i)) || "—"}</td></tr>`).join("")}
      </table></body></html>`);
  }

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-center font-bold text-hf-text-2">Escolha uma unidade para ver o posicionamento.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6">
      <CabecalhoTela titulo="Posicionamento" subtitulo="Quantas gramas de cada produto vão no prato" icone={Scale}>
        {itens.length > 0 && (
          <button type="button" onClick={imprimir} className="inline-flex h-11 items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-bold text-hf-text"><Printer size={16} /> Imprimir</button>
        )}
      </CabecalhoTela>

      <p className="rounded-2xl bg-hf-elevated px-4 py-3 text-[14px] text-hf-text-2">
        A equipe pergunta ao assistente: <b>“posicionamento”</b> mostra a lista toda; <b>“posicionamento do filé de frango”</b> mostra só ele.
      </p>
      {aviso && <p role="status" className="rounded-full bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-text">{aviso}</p>}
      {erroCarga && <p role="alert" className="rounded-2xl bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-danger">Não consegui carregar: {erroCarga}</p>}

      {podeCriar && editando !== "novo" && (
        <button type="button" onClick={() => setEditando("novo")} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-menu text-[15px] font-black text-white">
          <Plus size={18} /> Adicionar produto
        </button>
      )}
      {editando === "novo" && <Formulario inicial={VAZIO} outros={itens} salvando={salvando} onSalvar={salvarItem} onCancelar={() => setEditando(null)} />}

      {itens.length > 6 && (
        <label className="flex h-12 items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4">
          <Search size={16} className="text-hf-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar produto" aria-label="Procurar produto" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        </label>
      )}

      {carregando ? (
        <p className="py-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando…</p>
      ) : !itens.length ? (
        <div className="rounded-3xl border border-dashed border-hf-border px-4 py-8 text-center">
          <p className="font-black text-hf-text">Nenhum produto cadastrado ainda.</p>
          <p className="mt-1 text-sm text-hf-muted">Ex.: Filé de frango 200 g · Picanha média de 250 g · Batata frita 100 g (de 90 a 100 g).</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lista.map((i) => editando === i.id ? (
            <li key={i.id}><Formulario inicial={i} outros={itens} salvando={salvando} onSalvar={salvarItem} onCancelar={() => setEditando(null)} /></li>
          ) : (
            <li key={i.id} className="flex items-center gap-3 rounded-3xl border border-hf-border bg-hf-surface px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-hf-text">{i.nome}</p>
                {(textoFaixa(i) || i.obs) && <p className="text-[13.5px] text-hf-muted">{textoFaixa(i) ? `Aceita ${textoFaixa(i)}` : ""}{textoFaixa(i) && i.obs ? " · " : ""}{i.obs}</p>}
              </div>
              <span className="shrink-0 text-right text-[19px] font-black tabular-nums text-hf-text">{textoAlvo(i)}</span>
              {podeEditar && <button type="button" aria-label={`Editar ${i.nome}`} onClick={() => setEditando(i.id)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border text-hf-text-2"><Pencil size={16} /></button>}
              {podeExcluir && <button type="button" aria-label={`Excluir ${i.nome}`} onClick={() => excluir(i)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hf-border text-hf-danger"><Trash2 size={16} /></button>}
            </li>
          ))}
          {!lista.length && <li className="py-6 text-center text-sm font-semibold text-hf-muted">Nenhum produto com esse nome.</li>}
        </ul>
      )}
    </div>
  );
}
