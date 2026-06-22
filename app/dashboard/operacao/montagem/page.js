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
              <div className="flex items-center text-[var(--line-soft)] group-hover:text-orange-500 transition-colors">
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
              <div className="flex items-center text-[var(--line-soft)] group-hover:text-orange-500 transition-colors flex-row-reverse">
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
         <button onClick={adicionar} className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded flex items-center gap-1 hover:bg-orange-500/20 transition-colors">
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
                 className="col-span-2 bg-transparent border border-[var(--line)] rounded px-2 py-1.5 text-xs font-bold text-[var(--fg)] outline-none focus:border-orange-500" 
               />
               <select 
                 value={c.tipo} onChange={(e) => alterar(idx, "tipo", e.target.value)}
                 className="col-span-1 bg-transparent border border-[var(--line)] rounded px-1 py-1.5 text-[10px] uppercase font-bold text-[var(--subtle)] outline-none focus:border-orange-500"
               >
                 {TIPOS_IA.map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
               </select>
            </div>
            <button onClick={() => remover(idx)} className="p-2 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}


// =========================================================================
// FORMULÁRIO DE MONTAGEM
// =========================================================================
function FormMontagem({ inicial, deptInicial, onSalvar, onCancelar }) {
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
        body: JSON.stringify({ descritivo: f.descritivo })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro na IA");
      
      set("estrutura_ia", json.camadas);
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
        <Btn variant="ghost" onClick={() => inputRef.current?.click()} disabled={uploadando}>
          <Camera size={14} /> {uploadando ? "Enviando..." : (f.foto_url ? "Trocar foto" : "Adicionar foto")}
        </Btn>
      </Field>

      <div className="relative">
        <div className="flex items-center justify-between mb-1">
           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ingredientes e Passo a passo</label>
           <button onClick={invocarIA} disabled={gerandoIA || !f.descritivo} className="flex items-center gap-1.5 text-[11px] font-black uppercase text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 shadow-sm border border-purple-100">
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
function imprimirFicha(m) {
  let htmlCamadas = "";
  if (m.estrutura_ia && Array.isArray(m.estrutura_ia)) {
     // Na impressão, usamos uma lista limpa
     const lista = m.estrutura_ia.map(c => `
       <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
          <div style="width: 12px; height: 12px; border-radius: 2px; background: #94a3b8; flex-shrink: 0;"></div>
          <div style="font-size: 14px; font-weight: bold; color: #334155; flex: 1; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">${c.nome}</div>
          <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">${c.tipo.replace('_', ' ')}</div>
       </div>
     `).join("");

     htmlCamadas = `
       <div style="margin-top: 24px; padding: 16px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px;">
         <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin: 0 0 16px; text-align: center;">Estrutura de Montagem (De Cima para Baixo)</h3>
         ${lista}
       </div>
     `;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ficha de Montagem — ${m.nome}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 20px; color: #111; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    .badges { display: flex; gap: 6px; margin-bottom: 16px; }
    .badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #f1f5f9; color: #475569; }
    .foto { max-width: 100%; max-height: 320px; object-fit: cover; border-radius: 12px; margin-bottom: 16px; display: block; margin-left: auto; margin-right: auto; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-top: 24px; margin-bottom: 8px; }
    .descritivo { white-space: pre-wrap; line-height: 1.6; font-size: 15px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
    .info { padding: 12px; background: #f8fafc; border-radius: 8px; }
    .info-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .info-val { font-size: 16px; font-weight: 600; margin-top: 2px; }
    .obs { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 14px; border-radius: 6px; margin-top: 12px; font-size: 14px; }
    .rodape { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
    @media print { body { margin: 0; padding: 12px; } }
  </style>
</head>
<body>
  <h1>${m.nome}</h1>
  <div class="badges">
    <span class="badge">${m.tipo}</span>
    <span class="badge">${m.departamento}</span>
  </div>
  ${m.foto_url ? `<img src="${m.foto_url}" class="foto" alt="${m.nome}" />` : ""}

  ${htmlCamadas}

  <h2>Passo a Passo / Descritivo</h2>
  <div class="descritivo">${m.descritivo}</div>

  ${(m.tempo_preparo || m.rendimento) ? `
    <div class="grid">
      ${m.tempo_preparo ? `<div class="info"><div class="info-label">Tempo de preparo</div><div class="info-val">${m.tempo_preparo} min</div></div>` : ""}
      ${m.rendimento ? `<div class="info"><div class="info-label">Rendimento</div><div class="info-val">${m.rendimento}</div></div>` : ""}
    </div>
  ` : ""}

  ${m.observacoes ? `<h2>Observações</h2><div class="obs">${m.observacoes}</div>` : ""}

  <div class="rodape">Ficha gerada em ${new Date().toLocaleString("pt-BR")} · Hefisto ERP</div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>
`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
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
  const [salvou, setSalvou] = useState("");

  async function carregar() {
    setLoading(true);
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
      <PageHeader title={titulo} subtitle={subtitle} icon={ClipboardList} onAction={() => { setEditar(null); setModal(true); }} actionLabel="Nova Ficha" />
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
                    <div className="absolute top-4 right-4 bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center shadow-md z-10" title="Criado com Inteligência Artificial">
                       <Sparkles size={14} />
                    </div>
                  )}
                  
                  {/* Foto de Capa / Layout Central */}
                  <div className="w-full h-40 bg-slate-100 relative">
                    {m.foto_url ? (
                      <img src={m.foto_url} alt={m.nome} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
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
                       <button onClick={() => imprimirFicha(m)} className="w-10 h-10 rounded-lg flex items-center justify-center bg-orange-50 hover:bg-orange-100 text-orange-500 transition-colors" title="Imprimir">
                         <Printer size={16} />
                       </button>
                       <button onClick={() => remover(m.id)} className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 transition-colors" title="Remover">
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
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 md:p-6 overflow-y-auto">
           <div className="bg-[var(--surface)] rounded-[24px] shadow-2xl w-full max-w-4xl my-auto animate-in zoom-in-95 duration-200 border border-[var(--line)]">
             <div className="p-4 md:p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--panel)] rounded-t-[24px]">
                <h2 className="font-black text-lg md:text-xl text-[var(--fg)] flex items-center gap-2">
                  <ClipboardList size={22} className="text-orange-500" />
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
                   <FormMontagem inicial={editar} deptInicial={dept} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
                </div>
                
                {/* Coluna 2: Preview em tempo real da IA */}
                <div className="hidden lg:block border-l border-[var(--line)] pl-8 sticky top-0">
                   <h3 className="font-black text-[var(--fg)] text-lg mb-4">Prévia do Gráfico</h3>
                   <div className="text-[var(--subtle)] text-xs mb-4">
                      Veja em tempo real como o painel visual será gerado. Ele se adapta dependendo do tipo (Prato vs Drink) e da presença de foto.
                   </div>
                   <div className="scale-90 origin-top-left w-[110%]">
                      {/* A prévia foi movida para dentro do próprio formulário por simplicidade de estado, 
                          mas caso a tela seja grande, o layout continuará consistente */}
                   </div>
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
