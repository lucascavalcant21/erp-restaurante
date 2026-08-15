"use client";

// CONTAGEM DE INVENTÁRIO POR VOZ
// A pessoa anda pela loja falando o que conta ("onze facas na cozinha, seis
// bandejas no bar") e a lista se monta sozinha, separada por categoria e por
// lugar. Antes de salvar dá para corrigir cada linha e tirar a foto daquele
// utensílio específico — a foto entra no cadastro e sai na lista impressa.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera, Loader2, Mic, MicOff, Plus, Printer, Save, Trash2, X,
} from "lucide-react";
import { criarEscuta, vozDisponivel } from "../lib/hefisto-voz";
import { imprimirHtml } from "../lib/imprimir";

const semAcento = (v) => {
  const d = String(v || "").normalize("NFD");
  let out = "";
  for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
  return out.toLowerCase().trim();
};

const escapar = (v) => String(v ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let seq = 0;
const linhaVazia = (extra = {}) => ({
  chave: `l${Date.now().toString(36)}${(seq += 1)}`,
  nome: "", quantidade: "", categoria: "Outros", localizacao: "", foto: "",
  ...extra,
});

export default function ContagemInventarioVoz({
  aberto, aoFechar, unidadeInfo, itens = [], categorias = [], aoConcluir,
}) {
  const [linhas, setLinhas] = useState([]);
  const [ouvindo, setOuvindo] = useState(false);
  const [transcricao, setTranscricao] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [local, setLocal] = useState("");        // lugar assumido para o que for falado
  const escutaRef = useRef(null);

  useEffect(() => () => escutaRef.current?.parar?.(), []);
  useEffect(() => { if (!aberto) { escutaRef.current?.parar?.(); setOuvindo(false); } }, [aberto]);

  const lugares = useMemo(
    () => [...new Set(itens.map(i => (i.localizacao || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [itens],
  );

  // Item já cadastrado com esse nome (para virar ajuste em vez de duplicata).
  const acharNoSistema = (nome) => {
    const alvo = semAcento(nome);
    if (!alvo) return null;
    return itens.find(i => semAcento(i.nome) === alvo)
      || itens.find(i => semAcento(i.nome).startsWith(alvo))
      || itens.find(i => semAcento(i.nome).includes(alvo));
  };

  // ── Voz ───────────────────────────────────────────────────────────────────
  const interpretar = async (texto) => {
    if (!String(texto || "").trim()) return;
    setLendo(true); setErro("");
    try {
      const r = await fetch("/api/ia-inventario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      const dados = await r.json();
      if (!r.ok || !dados?.itens?.length) {
        setErro(dados?.error || "Não consegui separar os itens. Fale assim: onze facas na cozinha, seis bandejas no bar.");
        return;
      }
      setLinhas(atual => [
        ...atual,
        ...dados.itens.map(it => linhaVazia({
          nome: it.nome,
          quantidade: String(it.quantidade ?? ""),
          categoria: categorias.includes(it.categoria) ? it.categoria : "Outros",
          localizacao: it.localizacao || local || "",
        })),
      ]);
      setTranscricao("");
    } catch {
      setErro("Sem conexão para interpretar a contagem.");
    } finally {
      setLendo(false);
    }
  };

  const alternarMicrofone = () => {
    if (ouvindo) { escutaRef.current?.parar?.(); return; }
    if (!vozDisponivel()) { setErro("Este navegador não reconhece voz. Use o Chrome no Android."); return; }
    setErro(""); setTranscricao("");
    const sessao = criarEscuta({
      continuo: true,
      silencioMs: 4000,
      onParcial: t => setTranscricao(t),
      onFinal: t => { setTranscricao(t); interpretar(t); },
      onErro: e => { setErro(e); setOuvindo(false); },
      onFim: () => setOuvindo(false),
    });
    if (!sessao) { setErro("Não consegui acessar o microfone."); return; }
    escutaRef.current = sessao;
    setOuvindo(true);
    sessao.iniciar();
  };

  // ── Linhas ────────────────────────────────────────────────────────────────
  const mudar = (chave, campos) => setLinhas(ls => ls.map(l => l.chave === chave ? { ...l, ...campos } : l));
  const remover = (chave) => setLinhas(ls => ls.filter(l => l.chave !== chave));
  const adicionar = () => setLinhas(ls => [...ls, linhaVazia({ localizacao: local })]);

  const tirarFoto = async (chave, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    mudar(chave, { foto: await fileParaBase64(file) });
  };

  // Agrupa como o usuário conta: por categoria e, dentro dela, por lugar.
  const grupos = useMemo(() => {
    const mapa = new Map();
    linhas.forEach(l => {
      const cat = l.categoria || "Outros";
      const lugar = (l.localizacao || "").trim() || "Sem lugar definido";
      if (!mapa.has(cat)) mapa.set(cat, new Map());
      const porLugar = mapa.get(cat);
      if (!porLugar.has(lugar)) porLugar.set(lugar, []);
      porLugar.get(lugar).push(l);
    });
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([cat, porLugar]) => [cat, [...porLugar.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))]);
  }, [linhas]);

  const totalContado = linhas.reduce((s, l) => s + (Number(l.quantidade) || 0), 0);
  const validas = linhas.filter(l => l.nome.trim() && Number(l.quantidade) >= 0 && l.quantidade !== "");

  // ── Imprimir ──────────────────────────────────────────────────────────────
  const imprimir = () => {
    if (!linhas.length) return;
    let corpo = "";
    grupos.forEach(([cat, porLugar]) => {
      porLugar.forEach(([lugar, lista]) => {
        const total = lista.reduce((s, l) => s + (Number(l.quantidade) || 0), 0);
        corpo += `<tr class="cab"><td colspan="4">${escapar(cat)} — ${escapar(lugar)}</td><td class="c">${total.toLocaleString("pt-BR")}</td><td></td></tr>`;
        corpo += lista.map(l => {
          const noSistema = acharNoSistema(l.nome);
          const antes = noSistema ? Number(noSistema.quantidade) || 0 : null;
          const contado = Number(l.quantidade) || 0;
          const dif = antes == null ? "" : (contado - antes > 0 ? `+${contado - antes}` : String(contado - antes));
          return `<tr>
            <td class="foto">${l.foto ? `<img src="data:image/jpeg;base64,${l.foto}"/>` : ""}</td>
            <td><b>${escapar(l.nome)}</b></td>
            <td>${escapar(l.localizacao || "")}</td>
            <td class="c">${antes == null ? "novo" : antes.toLocaleString("pt-BR")}</td>
            <td class="c">${contado.toLocaleString("pt-BR")}</td>
            <td class="c">${dif}</td>
          </tr>`;
        }).join("");
      });
    });

    imprimirHtml(`<meta charset="utf-8"/><title>Contagem de inventário</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px}
        .tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #94a3b8;padding:4px 6px;text-align:left;vertical-align:middle}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        tr{page-break-inside:avoid}
        tr.cab td{background:#f1f5f9;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:10px;color:#334155}
        td.foto{width:16mm;height:16mm;text-align:center;padding:1.5mm}
        td.foto img{width:13mm;height:13mm;object-fit:cover;border-radius:2mm}
        td.c{text-align:center;font-weight:bold}
        .assin{margin-top:16mm;display:flex;gap:30px}
        .assin div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:8mm}}
      </style>
      <div class="head">
        <div><div class="tag">Contagem de inventário</div><h1>${escapar(unidadeInfo?.nome || "Unidade")}</h1></div>
        <div class="meta">${linhas.length} linha(s) · ${totalContado.toLocaleString("pt-BR")} unidades<br/>${new Date().toLocaleString("pt-BR")}</div>
      </div>
      <table>
        <thead><tr><th>Foto</th><th>Item</th><th>Onde fica</th><th>No sistema</th><th>Contado</th><th>Diferença</th></tr></thead>
        <tbody>${corpo}</tbody>
      </table>
      <div class="assin"><div>Contado por</div><div>Conferido por</div><div>Data</div></div>`,
      { aoFalhar: () => setErro("Não consegui abrir a impressão. Verifique o bloqueio de janelas.") });
  };

  // ── Salvar ────────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!validas.length) { setErro("Nada para salvar."); return; }
    setSalvando(true); setErro("");
    let feitos = 0;
    for (const [i, linha] of validas.entries()) {
      setProgresso(`${i + 1} de ${validas.length}`);
      const existente = acharNoSistema(linha.nome);
      const ok = await aoConcluir?.({
        existente,
        nome: linha.nome.trim(),
        quantidade: Number(linha.quantidade) || 0,
        categoria: linha.categoria || "Outros",
        localizacao: linha.localizacao || null,
        foto: linha.foto || null,
      });
      if (ok !== false) feitos += 1;
    }
    setSalvando(false); setProgresso("");
    setLinhas([]);
    aoFechar?.(feitos);
  };

  if (!aberto) return null;

  const inputCls = "p-2 rounded-lg border font-bold text-sm outline-none";
  const inputStyle = { background: "var(--surface)", borderColor: "var(--line)", color: "var(--fg)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={() => !salvando && !lendo && aoFechar?.()}>
      <div className="my-3 flex max-h-[94vh] w-full max-w-3xl flex-col rounded-2xl border sm:my-8 sm:max-h-[90vh] sm:rounded-3xl"
        style={{ background: "var(--card)", borderColor: "var(--line)", boxShadow: "var(--shadow-float)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b p-4 sm:p-6" style={{ borderColor: "var(--line-soft)" }}>
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black" style={{ color: "var(--fg)" }}>
              <Mic size={20} style={{ color: "var(--accent-strong)" }} /> Contagem por voz
            </h2>
            <p className="mt-0.5 text-xs font-bold" style={{ color: "var(--muted)" }}>
              Fale o que está contando. Depois confira, tire a foto de cada item e salve.
            </p>
          </div>
          <button onClick={() => aoFechar?.()} className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--elevated)", color: "var(--muted)" }}><X size={17} /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
          {/* Microfone */}
          <div className="rounded-2xl border p-4" style={{ borderColor: ouvindo ? "var(--accent-strong)" : "var(--line)", background: "var(--elevated)" }}>
            <div className="flex items-center gap-3">
              <button onClick={alternarMicrofone} disabled={lendo}
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-black text-white transition-transform disabled:opacity-60"
                style={{ background: ouvindo ? "#DC2626" : "var(--accent-strong)", transform: ouvindo ? "scale(1.05)" : "none" }}>
                {ouvindo ? <MicOff size={26} /> : <Mic size={26} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black" style={{ color: "var(--fg)" }}>
                  {ouvindo ? "Ouvindo... pode falar sem pressa" : lendo ? "Separando os itens..." : "Toque para falar"}
                </p>
                <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--dim)" }}>
                  Ex.: “onze facas de mesa na cozinha, seis bandejas no bar, quatro potes de dois litros no depósito”
                </p>
              </div>
              {lendo && <Loader2 size={20} className="animate-spin shrink-0" style={{ color: "var(--accent-strong)" }} />}
            </div>

            {transcricao && (
              <p className="mt-3 rounded-xl p-3 text-sm font-semibold" style={{ background: "var(--surface)", color: "var(--fg-soft)" }}>{transcricao}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>Lugar de agora</span>
              <input value={local} onChange={e => setLocal(e.target.value)} list="lugares-contagem"
                placeholder="Cozinha, Bar, Depósito..."
                className={`${inputCls} flex-1 min-w-[140px]`} style={inputStyle} />
              <datalist id="lugares-contagem">{lugares.map(l => <option key={l} value={l} />)}</datalist>
              <button onClick={adicionar} className="flex items-center gap-1.5 rounded-lg border-2 border-dashed px-3 py-2 text-xs font-black"
                style={{ borderColor: "var(--line)", color: "var(--muted)" }}><Plus size={14} /> Linha manual</button>
            </div>
          </div>

          {erro && <p className="rounded-xl px-4 py-3 text-sm font-bold" style={{ background: "var(--danger-soft)", color: "var(--danger-strong)" }}>{erro}</p>}

          {/* Lista contada, por categoria e lugar */}
          {linhas.length === 0 ? (
            <p className="rounded-xl p-6 text-center text-sm font-bold" style={{ background: "var(--elevated)", color: "var(--dim)" }}>
              Nada contado ainda. Toque no microfone e comece a falar.
            </p>
          ) : grupos.map(([cat, porLugar]) => (
            <div key={cat}>
              <p className="erp-label mb-2">{cat}</p>
              {porLugar.map(([lugar, lista]) => (
                <div key={lugar} className="mb-3">
                  <p className="mb-1.5 text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>
                    {lugar} · {lista.reduce((s, l) => s + (Number(l.quantidade) || 0), 0).toLocaleString("pt-BR")} un
                  </p>
                  <div className="space-y-2">
                    {lista.map(l => {
                      const existente = acharNoSistema(l.nome);
                      const antes = existente ? Number(existente.quantidade) || 0 : null;
                      const dif = antes == null ? null : (Number(l.quantidade) || 0) - antes;
                      return (
                        <div key={l.chave} className="rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                          <div className="flex items-start gap-3">
                            {/* Foto daquele utensílio */}
                            <label className="relative flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed"
                              style={{ borderColor: "var(--line)", background: "var(--elevated)" }}>
                              {l.foto
                                ? <img src={`data:image/jpeg;base64,${l.foto}`} alt="" className="h-full w-full object-cover" />
                                : <Camera size={20} style={{ color: "var(--dim)" }} />}
                              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => tirarFoto(l.chave, e)} />
                            </label>

                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <input value={l.nome} onChange={e => mudar(l.chave, { nome: e.target.value })}
                                  placeholder="Nome do item" className={`${inputCls} w-full sm:min-w-[150px] sm:flex-1`} style={inputStyle} />
                                <input type="number" min="0" value={l.quantidade} onChange={e => mudar(l.chave, { quantidade: e.target.value })}
                                  className={`${inputCls} w-20 text-center`} style={inputStyle} />
                                <button onClick={() => remover(l.chave)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                                  style={{ background: "var(--elevated)", color: "var(--muted)" }}><Trash2 size={15} /></button>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <select value={l.categoria} onChange={e => mudar(l.chave, { categoria: e.target.value })}
                                  className={`${inputCls} text-xs`} style={inputStyle}>
                                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <input value={l.localizacao} onChange={e => mudar(l.chave, { localizacao: e.target.value })}
                                  list="lugares-contagem" placeholder="Onde fica"
                                  className={`${inputCls} w-full text-xs sm:min-w-[120px] sm:flex-1`} style={inputStyle} />
                              </div>
                              <p className="text-[11px] font-bold" style={{ color: dif == null ? "var(--accent-strong)" : dif === 0 ? "var(--dim)" : "#B45309" }}>
                                {dif == null
                                  ? "Item novo — será cadastrado"
                                  : dif === 0
                                    ? `Bate com o sistema (${antes} un)`
                                    : `Sistema tinha ${antes} un · diferença de ${dif > 0 ? "+" : ""}${dif}`}
                                {l.foto ? " · com foto" : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 border-t p-4 sm:p-5" style={{ borderColor: "var(--line-soft)" }}>
          <button onClick={imprimir} disabled={!linhas.length || salvando}
            className="flex items-center gap-1.5 rounded-xl border-2 px-4 py-3 text-sm font-black disabled:opacity-50"
            style={{ borderColor: "var(--line)", color: "var(--fg-soft)" }}>
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={salvar} disabled={!validas.length || salvando}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-base font-black text-white disabled:opacity-60"
            style={{ background: "var(--accent-strong)" }}>
            {salvando
              ? <><Loader2 size={18} className="animate-spin" /> Salvando {progresso}</>
              : <><Save size={18} /> Salvar contagem ({validas.length})</>}
          </button>
        </div>
      </div>
    </div>
  );
}
