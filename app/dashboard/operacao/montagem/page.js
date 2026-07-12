"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Plus, Trash2, Edit3, Printer, Camera, Clock, Sparkles, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import {
  fetchMontagens, inserirMontagem, atualizarMontagem, removerMontagem,
  uploadFotoMontagem,
} from "../../../lib/montagem";
import { fetchProdutos } from "../../../lib/vendas";

const VAZIO = {
  nome: "", tipo: "prato", departamento: "cozinha",
  descritivo: "", foto_url: "", estrutura_ia: null,
  tempo_preparo: "", rendimento: "", observacoes: "",
};

// =========================================================================
// VISUALIZAÇÃO: Desenho Vertical Explodido (Hambúrgueres/Drinks)
// =========================================================================
function RenderCamadaVertical({ camada }) {
  let shapeStyle = {};
  switch(camada.tipo) {
    case 'pao_topo':
      shapeStyle = { background: 'linear-gradient(to bottom, #D97706, #F59E0B)', borderRadius: '40px 40px 10px 10px', height: '40px' }; break;
    case 'pao_base':
      shapeStyle = { background: 'linear-gradient(to bottom, #F59E0B, #D97706)', borderRadius: '10px 10px 30px 30px', height: '30px' }; break;
    case 'carne':
      shapeStyle = { background: 'linear-gradient(to bottom, #78350F, #451A03)', borderRadius: '12px', height: '24px' }; break;
    case 'queijo':
      shapeStyle = { background: '#FBBF24', borderRadius: '4px', height: '14px', transform: 'skewX(-15deg)', borderBottom: '2px solid #F59E0B' }; break;
    case 'molho':
      shapeStyle = { background: '#FEF3C7', borderRadius: '8px', height: '10px', border: '1px solid #FDE68A', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }; break;
    case 'vegetal':
      shapeStyle = { background: '#4ADE80', borderRadius: '10px', height: '16px', borderBottom: '2px dashed #16A34A' }; break;
    case 'bacon':
      shapeStyle = { background: '#991B1B', borderRadius: '4px', height: '12px', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)' }; break;
    case 'cebola':
      shapeStyle = { background: 'transparent', borderRadius: '50%', height: '16px', border: '3px solid #D946EF' }; break;
    case 'fritura':
      shapeStyle = { background: '#F59E0B', borderRadius: '4px', height: '18px', border: '2px dotted #B45309' }; break;
    case 'copo':
      shapeStyle = { background: 'rgba(255,255,255,0.5)', borderRadius: '0 0 20px 20px', height: '40px', border: '2px solid #94A3B8', borderTop: 'none' }; break;
    case 'liquido':
      shapeStyle = { background: '#FCA5A5', borderRadius: '4px', height: '20px', opacity: 0.8 }; break;
    case 'gelo':
      shapeStyle = { background: '#E0F2FE', borderRadius: '4px', height: '16px', border: '1px solid #BAE6FD', transform: 'rotate(10deg)' }; break;
    default:
      shapeStyle = { background: '#E2E8F0', borderRadius: '8px', height: '20px' }; break;
  }

  return (
    <div className="flex items-center gap-4 relative group hover:bg-[var(--elevated)] p-2 rounded-xl transition-colors">
      <div className="w-32 flex-shrink-0 flex items-center justify-center relative">
         <div style={{...shapeStyle, width: '100%', boxShadow: '0 4px 10px -2px rgba(0, 0, 0, 0.4)'}} />
      </div>
      
      <div className="flex-1 border-t-2 border-dashed border-[var(--line-soft)] relative group-hover:border-[var(--subtle)] transition-colors">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--line-soft)] group-hover:bg-[var(--subtle)]" />
      </div>

      <div className="w-48 text-right flex-shrink-0">
         <p className="font-bold text-[13px] text-[var(--fg)] leading-tight">{camada.nome}</p>
         <p className="text-[9px] uppercase text-[var(--subtle)] font-bold">{camada.tipo.replace('_', ' ')}</p>
      </div>
    </div>
  )
}

function EstruturaVertical({ camadas }) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-6 shadow-sm mt-4">
       <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)] mb-6 text-center">Estrutura Explodida (Vertical)</h3>
       <div className="flex flex-col gap-1">
          {camadas.map((cam, idx) => <RenderCamadaVertical key={idx} camada={cam} />)}
       </div>
    </div>
  )
}

// =========================================================================
// VISUALIZAÇÃO: Desenho Radial (Pratos com Foto)
// =========================================================================
function EstruturaRadial({ camadas, fotoUrl }) {
  const meio = Math.ceil(camadas.length / 2);
  const esq = camadas.slice(0, meio);
  const dir = camadas.slice(meio);

  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-6 md:p-8 shadow-sm mt-4 overflow-hidden relative">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)] mb-8 text-center">Visão Radial</h3>
      <div className="flex items-center justify-between gap-4 md:gap-8 relative min-h-[250px]">
        
        {/* Coluna Esquerda */}
        <div className="flex-1 flex flex-col justify-around h-full gap-6 items-end z-20">
          {esq.map((c, i) => (
            <div key={i} className="flex items-center gap-2 md:gap-4 w-full group">
              <div className="flex-1 text-right">
                  <p className="font-bold text-[11px] md:text-[13px] text-[var(--fg)] leading-tight">{c.nome}</p>
                  <p className="text-[9px] uppercase text-[var(--subtle)] font-bold">{c.tipo.replace('_', ' ')}</p>
              </div>
              <div className="flex items-center text-[var(--line-soft)] group-hover:text-slate-600 transition-colors">
                <div className="w-8 md:w-16 h-px border-t-2 border-dashed border-current relative"></div>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="ml-[-4px]">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Foto Central Redonda */}
        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border-[6px] border-[var(--surface)] shadow-[0_0_30px_rgba(249,115,22,0.15)] overflow-hidden relative z-30 flex-shrink-0 bg-[var(--panel)]">
          {fotoUrl ? (
             <img src={fotoUrl} alt="Prato Central" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
          ) : (
             <div className="w-full h-full flex flex-col items-center justify-center text-[var(--subtle)]">
               <Camera size={32} className="mb-2 opacity-50" />
               <span className="text-[10px] font-bold uppercase tracking-widest">Sem Foto</span>
             </div>
          )}
        </div>

        {/* Coluna Direita */}
        <div className="flex-1 flex flex-col justify-around h-full gap-6 items-start z-20">
          {dir.map((c, i) => (
            <div key={i} className="flex items-center gap-2 md:gap-4 w-full group">
              <div className="flex items-center text-[var(--line-soft)] group-hover:text-slate-600 transition-colors flex-row-reverse">
                <div className="w-8 md:w-16 h-px border-t-2 border-dashed border-current relative"></div>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="mr-[-4px]">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
              <div className="flex-1 text-left">
                  <p className="font-bold text-[11px] md:text-[13px] text-[var(--fg)] leading-tight">{c.nome}</p>
                  <p className="text-[9px] uppercase text-[var(--subtle)] font-bold">{c.tipo.replace('_', ' ')}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

function EstruturaVisual({ camadas, tipo, fotoUrl }) {
  if (!camadas || !Array.isArray(camadas) || camadas.length === 0) return null;
  // Se for "prato" e tiver foto (ou quisermos forçar o radial para pratos), usamos Radial.
  if (tipo === 'prato' && fotoUrl) {
    return <EstruturaRadial camadas={camadas} fotoUrl={fotoUrl} />;
  }
  return <EstruturaVertical camadas={camadas} />;
}

// =========================================================================
// EDITOR INTERATIVO DE CAMADAS (Usado no Form)
// =========================================================================
const TIPOS_IA = [
  "pao_topo", "pao_base", "carne", "queijo", "molho", 
  "vegetal", "bacon", "cebola", "fritura", 
  "copo", "liquido", "gelo", "decoracao", "outro"
];

function EditorCamadas({ camadas, setCamadas }) {
  if (!camadas || camadas.length === 0) return null;

  function mover(idx, dir) {
    if (idx + dir < 0 || idx + dir >= camadas.length) return;
    const novo = [...camadas];
    const temp = novo[idx];
    novo[idx] = novo[idx + dir];
    novo[idx + dir] = temp;
    setCamadas(novo);
  }

  function alterar(idx, campo, valor) {
    const novo = [...camadas];
    novo[idx][campo] = valor;
    setCamadas(novo);
  }

  function remover(idx) {
    setCamadas(camadas.filter((_, i) => i !== idx));
  }

  function adicionar() {
    setCamadas([...camadas, { nome: "Novo Ingrediente", tipo: "outro" }]);
  }

  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 mt-3">
      <div className="flex items-center justify-between mb-3">
         <h4 className="text-xs font-black uppercase text-[var(--subtle)]">Ajuste de Camadas (IA)</h4>
         <button onClick={adicionar} className="text-xs font-bold text-slate-600 bg-emerald-500/10 px-2 py-1 rounded flex items-center gap-1 hover:bg-emerald-500/20 transition-colors">
            <Plus size={12}/> Adicionar
         </button>
      </div>
      <div className="space-y-2">
        {camadas.map((c, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-[var(--surface)] p-2 border border-[var(--line)] rounded-lg shadow-sm">
            <div className="flex flex-col gap-1">
               <button onClick={() => mover(idx, -1)} disabled={idx === 0} className="p-1 rounded bg-[var(--elevated)] text-[var(--subtle)] hover:text-[var(--fg)] disabled:opacity-30"><ArrowUp size={12} /></button>
               <button onClick={() => mover(idx, 1)} disabled={idx === camadas.length - 1} className="p-1 rounded bg-[var(--elevated)] text-[var(--subtle)] hover:text-[var(--fg)] disabled:opacity-30"><ArrowDown size={12} /></button>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2">
               <input 
                 value={c.nome} onChange={(e) => alterar(idx, "nome", e.target.value)} 
                 className="col-span-2 bg-transparent border border-[var(--line)] rounded px-2 py-1.5 text-xs font-bold text-[var(--fg)] outline-none focus:border-emerald-500" 
               />
               <select 
                 value={c.tipo} onChange={(e) => alterar(idx, "tipo", e.target.value)}
                 className="col-span-1 bg-transparent border border-[var(--line)] rounded px-1 py-1.5 text-[10px] uppercase font-bold text-[var(--subtle)] outline-none focus:border-emerald-500"
               >
                 {TIPOS_IA.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
               </select>
            </div>
            <button onClick={() => remover(idx)} className="p-2 text-slate-600 hover:text-slate-500 hover:bg-emerald-500/10 rounded-lg transition-colors"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}


// =========================================================================
// PRÉVIA DA FICHA IMPRESSA (Modelo com foto) — espelha imprimirModelo
// =========================================================================
function PreviaModeloChef({ m, cfg: cfgProp }) {
  // Ajustes do "Modelo com foto": vem por prop (ao vivo no Editar) ou do salvo
  let cfg = { fotoPct: 80, tituloPx: 34, textoPx: 15, tituloNegrito: true, textoNegrito: false };
  if (cfgProp) cfg = { ...cfg, ...cfgProp };
  else try {
    const salvo = typeof window !== "undefined" && localStorage.getItem("hefisto_modelo_montagem");
    if (salvo) cfg = { ...cfg, ...JSON.parse(salvo) };
  } catch {}
  const ESC = 0.72; // escala da folha para caber na coluna

  if (!m || !m.nome) {
    return (
      <div className="rounded-2xl border-2 border-dashed p-10 text-center text-sm font-medium" style={{ borderColor: "var(--line)", color: "var(--dim)" }}>
        Preencha o nome do prato — a prévia aparece aqui.
      </div>
    );
  }
  const etapas = String(m.descritivo || "").split("\n").map(s => s.trim().replace(/^\d+[\.\)]\s*/, "")).filter(Boolean);
  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 flex flex-col items-center" style={{ minHeight: 320 }}>
      <h1 className="text-center uppercase leading-tight mb-4" style={{ fontSize: cfg.tituloPx * ESC, fontWeight: cfg.tituloNegrito ? 900 : 500, letterSpacing: 1, color: "#0f172a" }}>
        {m.nome}
      </h1>
      {m.foto_url && (
        <div className="w-full flex justify-center mb-4" style={{ height: 170 }}>
          <img src={m.foto_url} alt="Foto do prato" className="max-h-full rounded-xl border border-slate-200 bg-slate-50 object-contain" style={{ maxWidth: `${Math.min(100, cfg.fotoPct)}%` }} />
        </div>
      )}
      <div className="w-full" style={{ fontSize: cfg.textoPx * ESC + 2, fontWeight: cfg.textoNegrito ? 700 : 400, color: "#1e293b", lineHeight: 1.6 }}>
        {etapas.length > 1 ? (
          <ol className="list-decimal pl-6 space-y-1">
            {etapas.map((e, i) => <li key={i}>{e}</li>)}
          </ol>
        ) : (
          <p className={etapas[0] ? "" : "italic text-slate-400"}>{etapas[0] || "Sem descritivo — escreva o passo a passo no formulário."}</p>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// FORMULÁRIO DE MONTAGEM
// =========================================================================
function FormMontagem({ inicial, deptInicial, onSalvar, onCancelar, onPreview }) {
  const [f, setF] = useState(
    inicial
      ? {
          ...inicial,
          tempo_preparo: String(inicial.tempo_preparo || ""),
        }
      : { ...VAZIO, departamento: deptInicial, tipo: deptInicial === "bar" ? "drink" : "prato" }
  );
  const [erro, setErro] = useState("");
  const [uploadando, setUploadando] = useState(false);
  const [gerandoIA, setGerandoIA] = useState(false);
  const inputRef = useRef(null);

  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  // Alimenta a prévia ao lado (a ficha como vai sair impressa)
  useEffect(() => { if (onPreview) onPreview(f); }, [f]);

  async function escolherFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadando(true);
    const { url, error } = await uploadFotoMontagem(file, f.nome || "montagem");
    setUploadando(false);
    if (error) { setErro("Erro ao enviar foto: " + error); return; }
    set("foto_url", url);
  }

  async function invocarIA() {
    if (!f.descritivo.trim()) {
      setErro("Escreva o descritivo dos ingredientes primeiro!");
      return;
    }
    setGerandoIA(true);
    setErro("");
    try {
      const res = await fetch("/api/ia-montagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descritivo: f.descritivo, nome: f.nome, tipo: f.tipo })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro na IA");

      if (Array.isArray(json.camadas) && json.camadas.length) set("estrutura_ia", json.camadas);
      // Preenche o passo a passo profissional gerado (substitui a descrição curta)
      if (json.modo_preparo) set("descritivo", json.modo_preparo);
    } catch (e) {
      setErro("Falha ao gerar com IA: " + e.message);
    }
    setGerandoIA(false);
  }

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do prato/drink.");
    if (!f.descritivo.trim()) return setErro("Informe o passo a passo de montagem.");
    onSalvar({
      nome: f.nome.trim(),
      tipo: f.tipo,
      departamento: f.departamento,
      descritivo: f.descritivo.trim(),
      foto_url: f.foto_url || null,
      estrutura_ia: f.estrutura_ia || null,
      tempo_preparo: f.tempo_preparo ? Number(f.tempo_preparo) : null,
      rendimento: f.rendimento || null,
      observacoes: f.observacoes || null,
    });
  }

  return (
    <>
      <Field label="Nome do prato/drink">
        <TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Mojito, Banzai Burger" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo (Muda a visão IA)">
          <Select value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>
            <option value="prato">Prato (Visão Radial)</option>
            <option value="drink">Drink / Lanche (Pilha Vertical)</option>
          </Select>
        </Field>
        <Field label="Departamento">
          <Select value={f.departamento} onChange={(e) => set("departamento", e.target.value)}>
            <option value="cozinha">Cozinha</option>
            <option value="bar">Bar</option>
          </Select>
        </Field>
      </div>

      <Field label="Foto">
        {f.foto_url && (
          <div className="mb-2">
            <img src={f.foto_url} alt="Foto" style={{ maxWidth: "100%", borderRadius: 8, maxHeight: 200, objectFit: "cover" }} />
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={escolherFoto} style={{ display: "none" }} />
        <div className="flex items-center gap-2">
          <Btn variant="ghost" onClick={() => inputRef.current?.click()} disabled={uploadando}>
            <Camera size={14} /> {uploadando ? "Enviando..." : (f.foto_url ? "Trocar foto" : "Adicionar foto")}
          </Btn>
          {f.foto_url && (
            <button type="button" onClick={() => set("foto_url", "")} className="text-xs font-bold text-rose-500 hover:text-rose-600">Remover foto</button>
          )}
        </div>
      </Field>

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ingredientes e Passo a passo</label>
           <button onClick={invocarIA} disabled={gerandoIA || !f.descritivo} className="flex items-center gap-1.5 text-[11px] font-black uppercase text-emerald-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 shadow-sm border border-slate-200">
             {gerandoIA ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
             {gerandoIA ? "Mágica rolando..." : "Desenhar com IA"}
           </button>
        </div>
        <textarea
          value={f.descritivo}
          onChange={(e) => set("descritivo", e.target.value)}
          placeholder="Ex: 1 hamburguer 150g, 2 fatias de queijo cheddar, alface, tomate, molho especial na tampa"
          rows={4}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            background: "var(--elevated)", color: "var(--fg)",
            border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", resize: "vertical",
          }}
        />
      </div>

      {/* EDitor Interativo da Estrutura */}
      {f.estrutura_ia && (
        <EditorCamadas camadas={f.estrutura_ia} setCamadas={(nova) => set("estrutura_ia", nova)} />
      )}

      {/* Renderiza a prévia visual se existir */}
      {f.estrutura_ia && (
        <div className="mt-4">
           <SectionLabel>Prévia do Gráfico Visual</SectionLabel>
           <EstruturaVisual camadas={f.estrutura_ia} tipo={f.tipo} fotoUrl={f.foto_url} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label="Tempo de preparo (min)">
          <NumberInput value={f.tempo_preparo} onChange={(e) => set("tempo_preparo", e.target.value)} placeholder="5" step="1" />
        </Field>
        <Field label="Rendimento">
          <TextInput value={f.rendimento} onChange={(e) => set("rendimento", e.target.value)} placeholder="1 porção, 350ml" />
        </Field>
      </div>

      <Field label="Observações (opcional)">
        <textarea
          value={f.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          placeholder="Dicas, alertas ou variações"
          rows={2}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 8,
            background: "var(--elevated)", color: "var(--fg)",
            border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", resize: "vertical",
          }}
        />
      </Field>

      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3 mt-2">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar Ficha" : "Adicionar Ficha"}</Btn>
      </div>
    </>
  );
}

// =========================================================================
// IMPRESSÃO (Inclui IA se houver)
// =========================================================================
// Imprime VÁRIAS fichas na mesma folha (1, 2, 4, 6 ou 8 por página),
// cada uma com o passo a passo — para colar na parede da cozinha/bar.
function imprimirLote(fichas, porFolha, deptLabel) {
  if (!fichas.length) return alert("Nenhuma ficha para imprimir.");
  const cols = porFolha <= 2 ? 1 : 2;
  const rows = Math.ceil(porFolha / cols);
  const alturaCard = `${Math.floor(277 / rows)}mm`;
  const escala = { 1: 15, 2: 12.5, 4: 11, 6: 9.5, 8: 8.5 }[porFolha] || 11;

  const cardHTML = (m) => {
    const passos = String(m.descritivo || "").split("\n").map(t => t.trim()).filter(Boolean);
    const camadas = Array.isArray(m.estrutura_ia) ? m.estrutura_ia : [];
    return `
    <div class="card">
      <div class="topo">
        <h3>${m.nome}</h3>
        <span class="tag">${m.tipo || ""}${m.tempo_preparo ? ` · ${m.tempo_preparo} min` : ""}</span>
      </div>
      ${camadas.length ? `<div class="camadas"><b>Montagem (de cima p/ baixo):</b> ${camadas.map(c => c.nome).join(" → ")}</div>` : ""}
      ${passos.length ? `<ol>${passos.map(p => `<li>${p.replace(/^\d+[\.\)]\s*/, "")}</li>`).join("")}</ol>` : `<p class="vazio">Sem passo a passo cadastrado — edite a ficha para adicionar.</p>`}
      ${m.observacoes && !String(m.observacoes).startsWith("Criado automaticamente") ? `<p class="obs">${m.observacoes}</p>` : ""}
    </div>`;
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Montagens — ${deptLabel}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:5mm 6mm;font-size:${escala}px}
      .grade{display:grid;grid-template-columns:repeat(${cols},1fr);gap:4mm}
      .card{border:1.5px solid #333;border-radius:8px;padding:${porFolha <= 2 ? "6mm" : "3.5mm"};height:${alturaCard};overflow:hidden;break-inside:avoid;page-break-inside:avoid;display:flex;flex-direction:column}
      .topo{display:flex;justify-content:space-between;align-items:baseline;gap:6px;border-bottom:2px solid #111;padding-bottom:3px;margin-bottom:5px}
      h3{font-size:1.25em;text-transform:uppercase;letter-spacing:.5px}
      .tag{font-size:.75em;text-transform:uppercase;color:#555;font-weight:bold;white-space:nowrap}
      .camadas{font-size:.85em;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:5px;padding:4px 6px;margin-bottom:5px;color:#334155}
      ol{padding-left:1.4em;flex:1}
      li{font-size:.95em;line-height:1.45;margin-bottom:2px;color:#222}
      .vazio{font-size:.85em;color:#999;font-style:italic}
      .obs{font-size:.8em;color:#666;border-top:1px dashed #999;padding-top:3px;margin-top:4px}
      @media print{@page{margin:0}}
    </style></head><body>
    <div class="grade">${fichas.map(cardHTML).join("")}</div>
    </body></html>`;

  let win = null;
  try { win = window.open("", "_blank", "width=880,height=1000"); } catch { win = null; }
  if (!win) {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      iframe.srcdoc = html;
      iframe.onload = () => {
        setTimeout(() => {
          try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert("Não consegui abrir a impressão: " + e.message); }
          setTimeout(() => iframe.remove(), 60000);
        }, 300);
      };
      return;
    } catch (e) {
      return alert("O navegador bloqueou a impressão. Habilite os popups.\n\nDetalhe: " + e.message);
    }
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// =========================================================================
// MODELO DO CHEF — título + foto + descritivo (padrão do PDF do usuário),
// com tamanhos e negrito ajustáveis e 1 ou 2 fichas por página (A4).
// =========================================================================
function imprimirModelo(fichas, cfg, deptLabel) {
  if (!fichas.length) return alert("Nenhuma ficha para imprimir.");
  const duas = Number(cfg.porPagina) === 2;
  const alturaFicha = duas ? 135 : 275;                 // mm úteis por ficha
  const fotoBase = duas ? 58 : 130;                     // mm de altura da foto no 100%
  const fotoH = Math.round(fotoBase * (cfg.fotoPct / 100));

  const cardHTML = (m, i) => {
    const etapas = String(m.descritivo || "").split("\n").map(s => s.trim().replace(/^\d+[\.\)]\s*/, "")).filter(Boolean);
    const descr = etapas.length > 1
      ? `<ol>${etapas.map(e => `<li>${e.replace(/</g, "&lt;")}</li>`).join("")}</ol>`
      : `<p>${(etapas[0] || "").replace(/</g, "&lt;") || "<i>Sem descritivo cadastrado.</i>"}</p>`;
    // Quebra: a cada ficha (1/pág) ou a cada 2 (2/pág), exceto na última
    const quebra = (i < fichas.length - 1) && (!duas || i % 2 === 1) ? " quebra" : "";
    return `
    <div class="fichaM${quebra}">
      <h1>${m.nome}</h1>
      ${m.foto_url ? `<div class="fotoBox"><img src="${m.foto_url}"/></div>` : ""}
      <div class="descr">${descr}</div>
    </div>`;
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Fichas — ${deptLabel}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .fichaM{height:${alturaFicha}mm;display:flex;flex-direction:column;align-items:center;padding:8mm 12mm;overflow:hidden;page-break-inside:avoid}
      .fichaM.quebra{page-break-after:always}
      .fichaM + .fichaM{border-top:2px dashed #cbd5e1}
      h1{font-size:${cfg.tituloPx}px;font-weight:${cfg.tituloNegrito ? 900 : 500};text-align:center;text-transform:uppercase;letter-spacing:1px;line-height:1.1;margin-bottom:5mm}
      .fotoBox{width:100%;height:${fotoH}mm;display:flex;justify-content:center;align-items:center;margin-bottom:5mm;flex-shrink:0}
      .fotoBox img{max-width:${Math.min(100, cfg.fotoPct)}%;max-height:100%;object-fit:contain;border-radius:14px}
      .descr{font-size:${cfg.textoPx}px;font-weight:${cfg.textoNegrito ? 700 : 400};width:100%;line-height:1.6;color:#1e293b;overflow:hidden}
      .descr ol{padding-left:1.6em}
      .descr li{margin-bottom:.35em}
      @media print{@page{margin:6mm}}
    </style></head><body>
    ${fichas.map(cardHTML).join("")}
    </body></html>`;

  let win = null;
  try { win = window.open("", "_blank", "width=880,height=1000"); } catch { win = null; }
  if (!win) {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      iframe.srcdoc = html;
      iframe.onload = () => {
        setTimeout(() => {
          try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { alert("Não consegui abrir a impressão: " + e.message); }
          setTimeout(() => iframe.remove(), 60000);
        }, 400);
      };
      return;
    } catch (e) {
      return alert("O navegador bloqueou a impressão. Habilite os popups.\n\nDetalhe: " + e.message);
    }
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

function imprimirFicha(m) {
  const isBar = m.departamento === "bar";
  const accent = isBar ? "#7C3AED" : "#059669";

  // Sequência de montagem (de cima p/ baixo) numerada e com o tipo de camada
  let seqMontagem = "";
  if (Array.isArray(m.estrutura_ia) && m.estrutura_ia.length) {
    const passos = m.estrutura_ia.map((c, i) => `
      <div class="camada">
        <span class="cnum">${i + 1}</span>
        <div class="cinfo">
          <span class="cnome">${c.nome}</span>
          <span class="ctipo">${String(c.tipo || "").replace(/_/g, " ")}</span>
        </div>
      </div>`).join("");
    seqMontagem = `
      <div class="secao">
        <h2>Sequência de Montagem <small>(de cima para baixo)</small></h2>
        <div class="camadas">${passos}</div>
      </div>`;
  }

  // Passo a passo: cada linha do descritivo vira uma etapa numerada
  const etapas = String(m.descritivo || "").split("\n").map(s => s.trim().replace(/^\d+[\.\)]\s*/, "")).filter(Boolean);
  const preparoHtml = etapas.length
    ? `<ol class="passos">${etapas.map(e => `<li>${e.replace(/</g, "&lt;")}</li>`).join("")}</ol>`
    : `<p class="vazio">Sem passo a passo cadastrado. Edite a ficha e gere o modo de preparo.</p>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ficha de Montagem — ${m.nome}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .capa{position:relative;height:${m.foto_url ? "340px" : "150px"};background:${m.foto_url ? `url('${m.foto_url}') center/cover no-repeat` : `linear-gradient(135deg, ${accent}, #0b1020)`};color:#fff;display:flex;flex-direction:column;justify-content:flex-end;padding:24px}
    .capa::after{content:"";position:absolute;inset:0;background:linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.15) 55%, rgba(0,0,0,.35) 100%)}
    .capa .conteudo{position:relative;z-index:1}
    .tag{display:inline-block;background:${accent};color:#fff;font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:4px 12px;border-radius:999px;margin-bottom:8px}
    .capa h1{font-size:38px;font-weight:900;line-height:1.05;text-shadow:0 2px 12px rgba(0,0,0,.5)}
    .capa .chips{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}
    .chip{background:rgba(255,255,255,.2);backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,.3);font-size:12px;font-weight:700;padding:5px 12px;border-radius:8px}
    .corpo{padding:24px 26px}
    .secao{margin-bottom:22px}
    h2{font-size:13px;text-transform:uppercase;letter-spacing:2px;color:${accent};font-weight:800;border-bottom:2px solid ${accent}33;padding-bottom:6px;margin-bottom:12px}
    h2 small{color:#94a3b8;font-weight:600;letter-spacing:1px;text-transform:none}
    .camadas{display:flex;flex-direction:column;gap:6px}
    .camada{display:flex;align-items:center;gap:12px;background:#f8fafc;border:1px solid #eef2f7;border-left:4px solid ${accent};border-radius:8px;padding:9px 12px}
    .cnum{width:24px;height:24px;border-radius:50%;background:${accent};color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .cinfo{display:flex;justify-content:space-between;align-items:baseline;flex:1;gap:10px}
    .cnome{font-weight:700;font-size:14.5px;color:#1e293b}
    .ctipo{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:800;white-space:nowrap}
    .passos{list-style:none;counter-reset:p}
    .passos li{counter-increment:p;position:relative;padding:10px 0 10px 44px;border-bottom:1px dashed #e2e8f0;font-size:15px;line-height:1.5;color:#334155}
    .passos li:last-child{border-bottom:none}
    .passos li::before{content:counter(p);position:absolute;left:0;top:8px;width:28px;height:28px;border-radius:8px;background:${accent}18;color:${accent};font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center}
    .vazio{color:#94a3b8;font-style:italic}
    .infos{display:flex;gap:12px;margin-bottom:22px}
    .info{flex:1;background:#f8fafc;border:1px solid #eef2f7;border-radius:10px;padding:12px 14px}
    .info .l{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:800}
    .info .v{font-size:20px;font-weight:900;color:#1e293b;margin-top:2px}
    .obs{background:#fffbeb;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;padding:12px 14px;font-size:14px;color:#78350f;line-height:1.5;white-space:pre-wrap}
    .rodape{border-top:1px solid #e2e8f0;padding:14px 26px;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
    @media print{@page{margin:0}.secao,.camada,.info{break-inside:avoid}}
  </style></head><body>
    <div class="capa"><div class="conteudo">
      <span class="tag">Ficha de Montagem · ${isBar ? "Bar" : "Cozinha"}</span>
      <h1>${m.nome}</h1>
      <div class="chips">
        <span class="chip">${m.tipo || (isBar ? "drink" : "prato")}</span>
        ${m.tempo_preparo ? `<span class="chip">⏱ ${m.tempo_preparo} min</span>` : ""}
        ${m.rendimento ? `<span class="chip">Rende: ${m.rendimento}</span>` : ""}
      </div>
    </div></div>

    <div class="corpo">
      ${seqMontagem}
      <div class="secao">
        <h2>Modo de Preparo — Passo a Passo</h2>
        ${preparoHtml}
      </div>
      ${m.observacoes && !String(m.observacoes).startsWith("Criado automaticamente") ? `
      <div class="secao">
        <h2>Padrão de Finalização e Dicas</h2>
        <div class="obs">${m.observacoes}</div>
      </div>` : ""}
    </div>

    <div class="rodape">
      <span>${m.nome} · ${isBar ? "Bar" : "Cozinha"} · uso interno</span>
      <span>Gerado em ${new Date().toLocaleDateString("pt-BR")}</span>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
  else alert("O navegador bloqueou a impressão. Habilite os popups.");
}

// =========================================================================
// PÁGINA PRINCIPAL
// =========================================================================
function MontagemPageInner() {
  const { unidadeAtiva } = useERP();
  const searchParams = useSearchParams();
  const deptInicial = searchParams.get("dept") || "cozinha";

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("Todos");
  const [dept, setDept] = useState(deptInicial);
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [previewFicha, setPreviewFicha] = useState(null); // estado vivo do formulário p/ prévia
  const [modalImpressao, setModalImpressao] = useState(false); // impressão em lote
  const [salvou, setSalvou] = useState("");
  const [porFolha, setPorFolha] = useState(4); // fichas por página na impressão

  // Modelo do Chef (título + foto + descritivo) — ajustes salvos no aparelho
  const CFG_PADRAO = { porPagina: 1, fotoPct: 80, tituloPx: 34, textoPx: 15, tituloNegrito: true, textoNegrito: false };
  const [cfgModelo, setCfgModelo] = useState(CFG_PADRAO);
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("hefisto_modelo_montagem");
      if (salvo) setCfgModelo({ ...CFG_PADRAO, ...JSON.parse(salvo) });
    } catch {}
  }, []);
  const mudarCfg = (patch) => setCfgModelo(c => {
    const novo = { ...c, ...patch };
    try { localStorage.setItem("hefisto_modelo_montagem", JSON.stringify(novo)); } catch {}
    return novo;
  });

  async function carregar() {
    setLoading(true);
    // Sincroniza com o Cardápio: todo produto do setor sem ficha de montagem
    // ganha uma automaticamente (cobre os pratos criados antes da automação)
    try {
      const [rMont, rProds] = await Promise.all([
        fetchMontagens(unidadeAtiva, dept),
        fetchProdutos(unidadeAtiva, dept),
      ]);
      const nomes = new Set((rMont.data || []).map(m => (m.nome || "").toLowerCase().trim()));
      const faltantes = (rProds.data || []).filter(p => p.nome_produto && !nomes.has(p.nome_produto.toLowerCase().trim()));
      for (const p of faltantes) {
        await inserirMontagem({
          nome: p.nome_produto,
          tipo: dept === "bar" ? "drink" : "prato",
          departamento: dept,
          descritivo: "",
          foto_url: p.imagem_url || "",
          estrutura_ia: null,
          tempo_preparo: null,
          rendimento: "",
          observacoes: "Criado automaticamente pelo Cardápio.",
        }, unidadeAtiva);
      }
      if (faltantes.length) {
        setSalvou(`${faltantes.length} prato(s) do cardápio importado(s) para a montagem!`);
        setTimeout(() => setSalvou(""), 3500);
      }
    } catch { /* sincronização é acessória */ }
    const { data } = await fetchMontagens(unidadeAtiva, dept);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, [unidadeAtiva, dept]);

  const filtrados = useMemo(() => lista.filter((m) => {
    const mb = m.nome?.toLowerCase().includes(busca.toLowerCase());
    const mt = tipo === "Todos" || m.tipo === tipo.toLowerCase();
    return mb && mt;
  }), [lista, busca, tipo]);

  async function salvar(dados) {
    if (editar) {
      await atualizarMontagem(editar.id, dados);
    } else {
      await inserirMontagem(dados, unidadeAtiva);
    }
    setModal(false); setEditar(null); setSalvou("Ficha de montagem salva!");
    setTimeout(() => setSalvou(""), 2600);
    carregar();
  }

  async function remover(id) {
    if (!confirm("Remover esta ficha de montagem?")) return;
    await removerMontagem(id);
    setLista((p) => p.filter((m) => m.id !== id));
  }

  const titulo = dept === "bar" ? "Montagem — Bar" : "Montagem — Cozinha";
  const subtitle = dept === "bar"
    ? "Fichas de montagem de drinks e coquetéis"
    : "Fichas de montagem e engenharia de cardápio com Inteligência Artificial";

  return (
    <div className="min-h-screen">
      <PageHeader title={titulo} subtitle={subtitle} icon={ClipboardList} onAction={() => { setEditar(null); setModal(true); }} actionLabel="Nova Ficha">
        <button onClick={() => setModalImpressao(true)} className="erp-btn erp-btn-ghost !h-9 text-xs"><Printer size={14} /> Impressão</button>
      </PageHeader>
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <KpiGrid>
          <Kpi icon={ClipboardList} label="Fichas cadastradas" value={lista.length} tint="var(--accent-fg)" />
          <Kpi icon={Sparkles} label="Geradas com IA" value={lista.filter(l => !!l.estrutura_ia).length} tint="#9333EA" />
          <Kpi icon={Clock} label="Tempo médio" value={`${lista.length ? Math.round(lista.reduce((a, m) => a + (m.tempo_preparo || 0), 0) / lista.length) : 0} min`} tint="#3B82F6" />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar prato/drink..." />
        <Chips options={["bar", "cozinha"]} value={dept} onChange={setDept} />
        <Chips options={["Todos", "Prato", "Drink"]} value={tipo} onChange={setTipo} />

        <div>
          <SectionLabel>{filtrados.length} ficha{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={ClipboardList} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={ClipboardList} title={busca ? "Nenhuma ficha encontrada" : "Sem fichas cadastradas"} hint={busca ? "Ajuste a busca" : "Clique em Nova para adicionar"} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtrados.map((m) => (
                <Card key={m.id} className="!p-0 hover:shadow-xl transition-shadow relative overflow-hidden group flex flex-col justify-between">
                  {m.estrutura_ia && (
                    <div className="absolute top-4 right-4 bg-slate-100 text-emerald-700 w-8 h-8 rounded-full flex items-center justify-center shadow-md z-10" title="Criado com Inteligência Artificial">
                       <Sparkles size={14} />
                    </div>
                  )}
                  
                  {/* Foto de Capa / Layout Central */}
                  <div className="w-full h-40 bg-slate-100 relative">
                    {m.foto_url ? (
                      <img src={m.foto_url} alt={m.nome} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                         <Camera size={32} />
                         <span className="text-[10px] uppercase font-bold mt-2">Sem foto</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                       <div className="text-white">
                         <span className="px-2 py-0.5 rounded uppercase font-bold text-[9px] bg-white/20 backdrop-blur-sm mb-1 inline-block">{m.tipo}</span>
                         <h3 className="font-black text-lg leading-tight">{m.nome}</h3>
                       </div>
                    </div>
                  </div>

                  <div className="p-4 flex flex-col flex-1 justify-between">
                    <p className="text-[12px] line-clamp-2 text-slate-500 font-medium mb-3">{m.descritivo}</p>
                    
                    {/* Botões */}
                    <div className="flex gap-2 border-t border-slate-100 pt-3 mt-auto">
                       <button onClick={() => { setEditar(m); setModal(true); }} className="flex-1 py-2 rounded-lg flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-colors" title="Editar Ficha e Layout IA">
                         <Edit3 size={14} /> Editar
                       </button>
                       <button onClick={() => imprimirFicha(m)} className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors" title="Imprimir">
                         <Printer size={16} />
                       </button>
                       <button onClick={() => remover(m.id)} className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors" title="Remover">
                         <Trash2 size={16} />
                       </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      {/* MODAL GIGANTE para comportar o editor */}
      {/* MODAL DE IMPRESSÃO EM LOTE (padrão compacto + modelo com foto) */}
      {modalImpressao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setModalImpressao(false)}>
          <div className="erp-card w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black flex items-center gap-2" style={{ color: "var(--fg)" }}><Printer size={18} /> Impressão das fichas</h3>
              <button onClick={() => setModalImpressao(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--elevated)", color: "var(--muted)" }}>×</button>
            </div>

            {/* Padrão: várias por folha, com passo a passo */}
            <div className="rounded-2xl border p-4 mb-4" style={{ borderColor: "var(--line)" }}>
              <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--fg-soft)" }}>Padrão (passo a passo)</p>
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Por folha:</span>
                {[1, 2, 4, 6, 8].map(n => (
                  <button key={n} onClick={() => setPorFolha(n)}
                    className="w-9 h-9 rounded-lg font-black text-sm transition-all"
                    style={porFolha === n ? { background: "var(--accent-strong)", color: "var(--accent-fg)" } : { background: "var(--elevated)", color: "var(--muted)" }}>
                    {n}
                  </button>
                ))}
              </div>
              <Btn variant="primary" className="!h-9 text-xs w-full" onClick={() => imprimirLote(filtrados, porFolha, dept === "bar" ? "Bar" : "Cozinha")}>
                <Printer size={14} /> Imprimir {filtrados.length} ficha{filtrados.length !== 1 ? "s" : ""}
              </Btn>
            </div>

            {/* Modelo com foto (os ajustes finos ficam no Editar de cada ficha) */}
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--line)" }}>
              <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--fg-soft)" }}>Modelo com foto (título + foto + descritivo)</p>
              <p className="text-[11px] font-medium mb-3" style={{ color: "var(--dim)" }}>Usa os tamanhos e negrito ajustados no Editar de cada ficha.</p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Por página:</span>
                {[1, 2].map(n => (
                  <button key={n} onClick={() => mudarCfg({ porPagina: n })}
                    className="w-9 h-9 rounded-lg font-black text-sm transition-all"
                    style={cfgModelo.porPagina === n ? { background: "var(--accent-strong)", color: "var(--accent-fg)" } : { background: "var(--elevated)", color: "var(--muted)" }}>
                    {n}
                  </button>
                ))}
              </div>
              <Btn variant="ghost" className="!h-9 text-xs w-full" onClick={() => imprimirModelo(filtrados, cfgModelo, dept === "bar" ? "Bar" : "Cozinha")}>
                <Printer size={14} /> Imprimir modelo ({filtrados.length})
              </Btn>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-6 overflow-y-auto">
           <div className="bg-[var(--surface)] rounded-[24px] shadow-2xl w-full max-w-4xl my-auto animate-in zoom-in-95 duration-200 border border-[var(--line)]">
             <div className="p-4 md:p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--panel)] rounded-t-[24px]">
                <h2 className="font-black text-lg md:text-xl text-[var(--fg)] flex items-center gap-2">
                  <ClipboardList size={22} className="text-slate-600" />
                  {editar ? "Editar Ficha de Montagem" : "Nova Ficha de Montagem"}
                </h2>
                <button onClick={() => { setModal(false); setEditar(null); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface)] text-[var(--subtle)] border border-[var(--line)] hover:bg-[var(--elevated)] hover:text-[var(--fg)]">
                   <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
             </div>
             
             {/* Layout Split: Esquerda Formulário, Direita Prévia */}
             <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                
                {/* Coluna 1: Dados e Editor */}
                <div className="space-y-4">
                   <FormMontagem inicial={editar} deptInicial={dept} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} onPreview={setPreviewFicha} />
                </div>

                {/* Coluna 2: prévia da FICHA IMPRESSA + ajustes ao vivo */}
                <div className="hidden lg:block border-l border-[var(--line)] pl-8">
                   <h3 className="font-black text-[var(--fg)] text-lg mb-1">Prévia da Ficha Impressa</h3>
                   <p className="text-[var(--subtle)] text-xs mb-3">
                      É assim que ela sai no "Modelo com foto". Ajuste abaixo e veja mudar na hora — os ajustes ficam salvos para todas as fichas.
                   </p>

                   {/* Ajustes: mexa e a prévia acompanha */}
                   <div className="rounded-2xl border p-3 mb-4" style={{ borderColor: "var(--line)", background: "var(--elevated)" }}>
                      <div className="grid grid-cols-3 gap-3 mb-2">
                         <div>
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
                               <span>Foto</span><span>{cfgModelo.fotoPct}%</span>
                            </div>
                            <input type="range" min="40" max="120" step="5" value={cfgModelo.fotoPct} onChange={e => mudarCfg({ fotoPct: Number(e.target.value) })} className="w-full accent-emerald-600" />
                         </div>
                         <div>
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
                               <span>Título</span><span>{cfgModelo.tituloPx}px</span>
                            </div>
                            <input type="range" min="18" max="56" step="2" value={cfgModelo.tituloPx} onChange={e => mudarCfg({ tituloPx: Number(e.target.value) })} className="w-full accent-emerald-600" />
                         </div>
                         <div>
                            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
                               <span>Texto</span><span>{cfgModelo.textoPx}px</span>
                            </div>
                            <input type="range" min="10" max="26" step="1" value={cfgModelo.textoPx} onChange={e => mudarCfg({ textoPx: Number(e.target.value) })} className="w-full accent-emerald-600" />
                         </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                         <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold" style={{ color: "var(--fg-soft)" }}>
                            <input type="checkbox" checked={cfgModelo.tituloNegrito} onChange={e => mudarCfg({ tituloNegrito: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                            Título negrito
                         </label>
                         <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold" style={{ color: "var(--fg-soft)" }}>
                            <input type="checkbox" checked={cfgModelo.textoNegrito} onChange={e => mudarCfg({ textoNegrito: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                            Texto negrito
                         </label>
                         <button onClick={() => previewFicha?.nome && imprimirModelo([previewFicha], cfgModelo, dept === "bar" ? "Bar" : "Cozinha")}
                            className="ml-auto flex items-center gap-1.5 text-[11px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2 rounded-lg transition-colors">
                            <Printer size={13} /> Imprimir esta ficha
                         </button>
                      </div>
                   </div>

                   <PreviaModeloChef m={previewFicha} cfg={cfgModelo} />
                </div>

             </div>
           </div>
        </div>
      )}
    </div>
  );
}

export default function MontagemPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <MontagemPageInner />
    </Suspense>
  );
}
