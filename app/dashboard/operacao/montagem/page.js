"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClipboardList, Plus, Trash2, Edit3, Printer, Camera, Clock, Sparkles, Loader2, ArrowUp, ArrowDown, SlidersHorizontal, Save, RotateCcw, ImageIcon, Type, Palette, ListChecks, Download, Share2, X, Eye, Wine } from "lucide-react";
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
import { fetchModeloMontagem, salvarModeloMontagem } from "../../../lib/parametros";
import { logoSeldeestrelaSVG } from "../../../lib/marca";
import { CATALOGO_COPOS, desenhoCopoSVG, ilustracaoDrinkSVG } from "../../../lib/copos";

const VAZIO = {
  nome: "", tipo: "prato", departamento: "cozinha",
  descritivo: "", foto_url: "", estrutura_ia: null,
  tempo_preparo: "", rendimento: "", observacoes: "",
};

const CFG_MODELO_PADRAO = {
  porPagina: 1,
  fotoPct: 80,
  tituloPx: 34,
  textoPx: 15,
  tituloNegrito: true,
  textoNegrito: false,
  orientacao: "retrato",
  estilo: "chef",
  corDestaque: "#059669",
  fonte: "Segoe UI",
  ajusteFoto: "contain",
  posicaoFoto: "center",
  cantosFoto: "suave",
  alinhamentoTitulo: "center",
  alinhamentoTexto: "left",
  tituloMaiusculo: true,
  entrelinha: 1.5,
  margemMm: 6,
  mostrarFoto: true,
  mostrarDetalhes: true,
  mostrarCamadas: true,
  mostrarObservacoes: true,
  mostrarRodape: true,
  numerarPassos: true,
  borda: "nenhuma", // "nenhuma" | "simples" | "dupla"
};

const PRESETS_MODELO = {
  chef: {
    estilo: "chef", fotoPct: 100, tituloPx: 38, textoPx: 15, porPagina: 1,
    ajusteFoto: "contain", mostrarDetalhes: true, mostrarCamadas: false,
    mostrarObservacoes: true, corDestaque: "#059669",
  },
  operacional: {
    estilo: "operacional", fotoPct: 65, tituloPx: 30, textoPx: 14, porPagina: 1,
    ajusteFoto: "contain", mostrarDetalhes: true, mostrarCamadas: true,
    mostrarObservacoes: true, corDestaque: "#0F766E",
  },
  compacto: {
    estilo: "compacto", fotoPct: 45, tituloPx: 26, textoPx: 12, porPagina: 2,
    ajusteFoto: "contain", mostrarDetalhes: true, mostrarCamadas: false,
    mostrarObservacoes: false, corDestaque: "#334155",
  },
};

const CORES_MODELO = ["#059669", "#0F766E", "#2563EB", "#7C3AED", "#EA580C", "#334155", "#111827"];
const FONTES_MODELO = ["Segoe UI", "Arial", "Georgia", "Trebuchet MS"];

function limitarNumero(valor, min, max, fallback) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return fallback;
  return Math.min(max, Math.max(min, numero));
}

function normalizarCfgModelo(valor = {}) {
  const cfg = { ...CFG_MODELO_PADRAO, ...(valor || {}) };
  return {
    ...cfg,
    _updatedAt: Number.isFinite(Number(cfg._updatedAt)) ? Number(cfg._updatedAt) : 0,
    porPagina: Number(cfg.porPagina) === 2 ? 2 : 1,
    fotoPct: limitarNumero(cfg.fotoPct, 20, 150, CFG_MODELO_PADRAO.fotoPct),
    tituloPx: limitarNumero(cfg.tituloPx, 18, 64, CFG_MODELO_PADRAO.tituloPx),
    textoPx: limitarNumero(cfg.textoPx, 10, 30, CFG_MODELO_PADRAO.textoPx),
    entrelinha: limitarNumero(cfg.entrelinha, 1.15, 2, CFG_MODELO_PADRAO.entrelinha),
    margemMm: limitarNumero(cfg.margemMm, 3, 14, CFG_MODELO_PADRAO.margemMm),
    orientacao: cfg.orientacao === "paisagem" ? "paisagem" : "retrato",
    estilo: ["chef", "operacional", "compacto"].includes(cfg.estilo) ? cfg.estilo : "chef",
    corDestaque: CORES_MODELO.includes(cfg.corDestaque) ? cfg.corDestaque : CFG_MODELO_PADRAO.corDestaque,
    fonte: FONTES_MODELO.includes(cfg.fonte) ? cfg.fonte : CFG_MODELO_PADRAO.fonte,
    ajusteFoto: cfg.ajusteFoto === "cover" ? "cover" : "contain",
    posicaoFoto: ["top", "center", "bottom"].includes(cfg.posicaoFoto) ? cfg.posicaoFoto : "center",
    cantosFoto: ["reto", "suave", "redondo"].includes(cfg.cantosFoto) ? cfg.cantosFoto : "suave",
    alinhamentoTitulo: cfg.alinhamentoTitulo === "left" ? "left" : "center",
    alinhamentoTexto: ["left", "center", "justify"].includes(cfg.alinhamentoTexto) ? cfg.alinhamentoTexto : "left",
    borda: ["nenhuma", "simples", "dupla"].includes(cfg.borda) ? cfg.borda : "nenhuma",
  };
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function raioFoto(cfg) {
  if (cfg.cantosFoto === "reto") return "0";
  if (cfg.cantosFoto === "redondo") return "999px";
  return "14px";
}

function dimensoesPapel(cfg) {
  const paisagem = cfg.orientacao === "paisagem";
  const largura = paisagem ? 297 : 210;
  const altura = paisagem ? 210 : 297;
  return {
    larguraUtil: largura - (cfg.margemMm * 2),
    alturaUtil: altura - (cfg.margemMm * 2),
  };
}

function alturaFotoMm(cfg) {
  const duas = Number(cfg.porPagina) === 2;
  const paisagem = cfg.orientacao === "paisagem";
  const base = paisagem ? (duas ? 82 : 108) : (duas ? 56 : 132);
  const fatorEstilo = cfg.estilo === "compacto" ? 0.82 : cfg.estilo === "operacional" ? 0.92 : 1;
  return Math.round(base * (cfg.fotoPct / 100) * fatorEstilo);
}

function chaveLocalModelo(unidadeId) {
  return `hefisto_modelo_montagem:${unidadeId || "local"}`;
}

function BotaoOpcao({ ativo, children, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-xl border px-3 py-2 text-[11px] font-black transition-all ${className}`}
      style={ativo
        ? { background: "var(--accent-strong)", color: "var(--accent-fg)", borderColor: "var(--accent-strong)" }
        : { background: "var(--card)", color: "var(--muted)", borderColor: "var(--line)" }}
    >
      {children}
    </button>
  );
}

function ControleFaixa({ label, valor, sufixo, min, max, step = 1, onChange }) {
  return (
    <label className="block rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
      <span className="mb-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        <span>{label}</span>
        <span className="rounded-md px-2 py-1" style={{ background: "var(--elevated)", color: "var(--fg)" }}>{valor}{sufixo}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer accent-emerald-600"
      />
    </label>
  );
}

function AlternadorDesigner({ marcado, onChange, children }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--fg-soft)" }}>
      <input type="checkbox" checked={marcado} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 shrink-0 accent-emerald-600" />
      <span>{children}</span>
    </label>
  );
}

function SecaoDesigner({ icon: Icon, titulo, abertoInicial = true, children }) {
  const [aberto, setAberto] = useState(abertoInicial);
  return (
    <section className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: "var(--line)", background: "var(--elevated)" }}>
      <button type="button" onClick={() => setAberto((valor) => !valor)} aria-expanded={aberto} className="flex min-h-10 w-full items-center gap-2 text-left text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--fg-soft)" }}>
        <Icon size={15} /> {titulo}
        <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-base" style={{ background: "var(--card)", color: "var(--muted)" }}>{aberto ? "−" : "+"}</span>
      </button>
      {aberto && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

function ControlesDesigner({ cfg, onChange, onPreset, onReset, onSave, salvando = false, compacto = false }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: "var(--line)", background: "var(--elevated)" }}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-black" style={{ color: "var(--fg)" }}><SlidersHorizontal size={16} /> Designer da ficha</p>
            <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--dim)" }}>A prévia e a impressão usam exatamente estas escolhas.</p>
          </div>
          <button type="button" onClick={onReset} title="Restaurar o padrão" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: "var(--line)", color: "var(--muted)", background: "var(--card)" }}><RotateCcw size={15} /></button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <BotaoOpcao ativo={cfg.estilo === "chef"} onClick={() => onPreset("chef")}>Chef</BotaoOpcao>
          <BotaoOpcao ativo={cfg.estilo === "operacional"} onClick={() => onPreset("operacional")}>Operacional</BotaoOpcao>
          <BotaoOpcao ativo={cfg.estilo === "compacto"} onClick={() => onPreset("compacto")}>Compacto</BotaoOpcao>
        </div>
      </div>

      <SecaoDesigner icon={ImageIcon} titulo="Foto">
          <ControleFaixa label="Tamanho da imagem" valor={cfg.fotoPct} sufixo="%" min={20} max={150} step={5} onChange={(fotoPct) => onChange({ fotoPct })} />
          <div className="grid grid-cols-2 gap-2">
            {[['contain', 'Foto inteira'], ['cover', 'Preencher área']].map(([valor, label]) => (
              <BotaoOpcao key={valor} ativo={cfg.ajusteFoto === valor} onClick={() => onChange({ ajusteFoto: valor })}>{label}</BotaoOpcao>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['top', 'Topo'], ['center', 'Centro'], ['bottom', 'Base']].map(([valor, label]) => (
              <BotaoOpcao key={valor} ativo={cfg.posicaoFoto === valor} onClick={() => onChange({ posicaoFoto: valor })}>{label}</BotaoOpcao>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[['reto', 'Reto'], ['suave', 'Suave'], ['redondo', 'Redondo']].map(([valor, label]) => (
              <BotaoOpcao key={valor} ativo={cfg.cantosFoto === valor} onClick={() => onChange({ cantosFoto: valor })}>{label}</BotaoOpcao>
            ))}
          </div>
      </SecaoDesigner>

      <SecaoDesigner icon={Type} titulo="Letras e leitura" abertoInicial={!compacto}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ControleFaixa label="Título" valor={cfg.tituloPx} sufixo=" px" min={18} max={64} step={2} onChange={(tituloPx) => onChange({ tituloPx })} />
            <ControleFaixa label="Texto" valor={cfg.textoPx} sufixo=" px" min={10} max={30} onChange={(textoPx) => onChange({ textoPx })} />
          </div>
          <ControleFaixa label="Espaço entre linhas" valor={cfg.entrelinha} sufixo="" min={1.15} max={2} step={0.05} onChange={(entrelinha) => onChange({ entrelinha })} />
          <label className="block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Fonte
            <select value={cfg.fonte} onChange={(e) => onChange({ fonte: e.target.value })} className="mt-2 h-11 w-full rounded-xl border px-3 text-sm font-bold outline-none" style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--fg)" }}>
              {FONTES_MODELO.map((fonte) => <option key={fonte} value={fonte}>{fonte}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <AlternadorDesigner marcado={cfg.tituloNegrito} onChange={(tituloNegrito) => onChange({ tituloNegrito })}>Título em negrito</AlternadorDesigner>
            <AlternadorDesigner marcado={cfg.textoNegrito} onChange={(textoNegrito) => onChange({ textoNegrito })}>Texto em negrito</AlternadorDesigner>
            <AlternadorDesigner marcado={cfg.tituloMaiusculo} onChange={(tituloMaiusculo) => onChange({ tituloMaiusculo })}>Título maiúsculo</AlternadorDesigner>
            <AlternadorDesigner marcado={cfg.numerarPassos} onChange={(numerarPassos) => onChange({ numerarPassos })}>Numerar passos</AlternadorDesigner>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Alinhamento do título</p>
            <div className="grid grid-cols-2 gap-2">
              {[['left', 'Esquerda'], ['center', 'Centro']].map(([valor, label]) => <BotaoOpcao key={valor} ativo={cfg.alinhamentoTitulo === valor} onClick={() => onChange({ alinhamentoTitulo: valor })}>{label}</BotaoOpcao>)}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Alinhamento do texto</p>
            <div className="grid grid-cols-3 gap-2">
              {[['left', 'Esquerda'], ['center', 'Centro'], ['justify', 'Justificado']].map(([valor, label]) => <BotaoOpcao key={valor} ativo={cfg.alinhamentoTexto === valor} onClick={() => onChange({ alinhamentoTexto: valor })}>{label}</BotaoOpcao>)}
            </div>
          </div>
      </SecaoDesigner>

      <SecaoDesigner icon={Palette} titulo="Visual e conteúdo" abertoInicial={!compacto}>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Cor de destaque</p>
            <div className="flex flex-wrap gap-2">
              {CORES_MODELO.map((cor) => (
                <button key={cor} type="button" aria-label={`Usar cor ${cor}`} onClick={() => onChange({ corDestaque: cor })} className="h-10 w-10 rounded-full border-4 transition-transform hover:scale-105" style={{ background: cor, borderColor: cfg.corDestaque === cor ? "var(--fg)" : "transparent", boxShadow: "0 0 0 1px var(--line)" }} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--muted)" }}>Borda da ficha</p>
            <div className="grid grid-cols-3 gap-2">
              {[["nenhuma", "Sem borda"], ["simples", "Simples"], ["dupla", "Dupla"]].map(([valor, label]) => (
                <BotaoOpcao key={valor} ativo={cfg.borda === valor} onClick={() => onChange({ borda: valor })}>{label}</BotaoOpcao>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <AlternadorDesigner marcado={cfg.mostrarFoto} onChange={(mostrarFoto) => onChange({ mostrarFoto })}>Exibir foto</AlternadorDesigner>
            <AlternadorDesigner marcado={cfg.mostrarDetalhes} onChange={(mostrarDetalhes) => onChange({ mostrarDetalhes })}>Tipo, setor e tempo</AlternadorDesigner>
            <AlternadorDesigner marcado={cfg.mostrarCamadas} onChange={(mostrarCamadas) => onChange({ mostrarCamadas })}>Sequência de camadas</AlternadorDesigner>
            <AlternadorDesigner marcado={cfg.mostrarObservacoes} onChange={(mostrarObservacoes) => onChange({ mostrarObservacoes })}>Observações</AlternadorDesigner>
            <AlternadorDesigner marcado={cfg.mostrarRodape} onChange={(mostrarRodape) => onChange({ mostrarRodape })}>Rodapé e data</AlternadorDesigner>
          </div>
      </SecaoDesigner>

      <SecaoDesigner icon={ListChecks} titulo="Papel" abertoInicial={!compacto}>
          {/* Orientação e "por página" agora são escolhidos na hora de imprimir. */}
          <ControleFaixa label="Margem da folha" valor={cfg.margemMm} sufixo=" mm" min={3} max={14} onChange={(margemMm) => onChange({ margemMm })} />
      </SecaoDesigner>

      <button type="button" onClick={onSave} disabled={salvando} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">
        {salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {salvando ? "Salvando..." : "Salvar como padrão da unidade"}
      </button>
    </div>
  );
}

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
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-4 md:p-8 shadow-sm mt-4 overflow-x-auto relative">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--subtle)] mb-8 text-center">Visão Radial</h3>
      <div className="flex items-center justify-between gap-4 md:gap-8 relative min-h-[250px] min-w-[520px] md:min-w-0">
        
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
function PreviaModeloChef({ m, lista, cfg: cfgProp }) {
  const cfg = normalizarCfgModelo(cfgProp);
  // Com lista (impressão de várias), a prévia mostra a PRIMEIRA PÁGINA real —
  // inclusive as 2 fichas juntas quando for 2 por página.
  const fichasPrevia = (Array.isArray(lista) && lista.length ? lista : (m ? [m] : [])).slice(0, cfg.porPagina);
  if (!fichasPrevia.length || !fichasPrevia[0]?.nome) {
    return (
      <div className="rounded-2xl border-2 border-dashed p-10 text-center text-sm font-medium" style={{ borderColor: "var(--line)", color: "var(--dim)" }}>
        Preencha o nome do prato — a prévia aparece aqui.
      </div>
    );
  }
  const deptLabel = fichasPrevia[0].departamento === "bar" ? "Bar" : "Cozinha";
  const html = gerarHtmlModelo(fichasPrevia, cfg, deptLabel, { previsualizacao: true });
  const larguraPapel = cfg.orientacao === "paisagem" ? 297 : 210;
  const alturaPapel = cfg.orientacao === "paisagem" ? 210 : 297;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--dim)" }}>
        <span>Prévia real do A4</span>
        <span>{cfg.orientacao === "paisagem" ? "A4 horizontal" : "A4 vertical"} · {cfg.porPagina}/pág.</span>
      </div>
      <div
        className="mx-auto w-full overflow-hidden rounded-xl border bg-white shadow-lg"
        style={{
          aspectRatio: `${larguraPapel} / ${alturaPapel}`,
          borderColor: "var(--line)",
          maxWidth: cfg.orientacao === "paisagem" ? 620 : 430,
        }}
      >
        <iframe
          key={`${cfg.orientacao}-${cfg.porPagina}-${cfg.fotoPct}-${cfg.tituloPx}-${cfg.textoPx}-${cfg.estilo}-${cfg.borda}-${fichasPrevia.length}`}
          title={`Prévia de impressão de ${fichasPrevia[0].nome}`}
          srcDoc={html}
          sandbox="allow-scripts"
          className="block h-full w-full border-0"
        />
      </div>
      <p className="mt-2 text-center text-[10px] font-medium" style={{ color: "var(--dim)" }}>A folha acima usa o mesmo HTML, margens, fonte e conteúdo enviados à impressora. Se algo não couber, o sistema amplia para uma folha inteira sem cortar.</p>
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

  // Seções do drink: as mesmas informações que saem no Guia de Drinks —
  // copo/taça, ingredientes com dosagem e o modo de preparo.
  const [receitaIA, setReceitaIA] = useState(""); // receita colada para a IA montar tudo
  const camadasAtuais = Array.isArray(f.estrutura_ia) ? f.estrutura_ia : [];
  const copoAtual = camadasAtuais.find((c) => c.tipo === "copo")?.nome || "";
  const ingredientesTexto = camadasAtuais.filter((c) => c.tipo !== "copo").map((c) => c.nome).join("\n");
  const setCopo = (valor) => {
    const outras = camadasAtuais.filter((c) => c.tipo !== "copo");
    const nova = valor.trim() ? [{ tipo: "copo", nome: valor }, ...outras] : outras;
    set("estrutura_ia", nova.length ? nova : null);
  };
  const setIngredientesTexto = (txt) => {
    const copo = camadasAtuais.find((c) => c.tipo === "copo");
    const linhas = txt.split("\n").map((s) => s.replace(/^[-•\d.\)\s]+/, "").trim()).filter(Boolean).map((nome) => ({ tipo: "liquido", nome }));
    const nova = copo ? [copo, ...linhas] : linhas;
    set("estrutura_ia", nova.length ? nova : null);
  };

  // Alimenta a prévia ao lado (a ficha como vai sair impressa).
  // COM PAUSA: atualizar a cada tecla recarregava o iframe da prévia sem parar
  // e ele ficava em branco enquanto se digita. Espera 500ms de pausa.
  useEffect(() => {
    if (!onPreview) return;
    const t = setTimeout(() => onPreview(f), 500);
    return () => clearTimeout(t);
  }, [f]);

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
    // Nos drinks, a IA parte dos ingredientes digitados na aba; nos pratos, do descritivo.
    const fonte = f.tipo === "drink" ? (ingredientesTexto || f.descritivo) : f.descritivo;
    if (!fonte.trim()) {
      setErro(f.tipo === "drink" ? "Escreva os ingredientes primeiro!" : "Escreva o descritivo dos ingredientes primeiro!");
      return;
    }
    setGerandoIA(true);
    setErro("");
    try {
      const res = await fetch("/api/ia-montagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descritivo: fonte, nome: f.nome, tipo: f.tipo })
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

  // Cola a RECEITA COMPLETA do drink e a IA preenche tudo: copo, ingredientes
  // com dosagem e o modo de preparo numerado.
  async function montarDrinkComIA() {
    if (!receitaIA.trim()) { setErro("Cole a receita do drink primeiro!"); return; }
    setGerandoIA(true);
    setErro("");
    try {
      const res = await fetch("/api/ia-montagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descritivo: receitaIA, nome: f.nome, tipo: "drink" })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro na IA");
      if (Array.isArray(json.camadas) && json.camadas.length) set("estrutura_ia", json.camadas);
      if (json.modo_preparo) set("descritivo", json.modo_preparo);
      setReceitaIA("");
    } catch (e) {
      setErro("Falha ao montar com IA: " + e.message);
    }
    setGerandoIA(false);
  }

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do prato/drink.");
    if (f.tipo === "drink") {
      if (!f.descritivo.trim() && !ingredientesTexto.trim()) return setErro("Preencha os ingredientes ou o modo de preparo do drink.");
    } else if (!f.descritivo.trim()) {
      return setErro("Informe o passo a passo de montagem.");
    }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {f.tipo === "drink" ? (
        <div className="space-y-4">
          {/* MONTAR COM IA: cola a receita inteira e ela preenche as seções */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={13} /> Montar com IA</label>
            </div>
            <textarea
              value={receitaIA}
              onChange={(e) => setReceitaIA(e.target.value)}
              placeholder={"Cole a receita do drink aqui (de qualquer jeito) e a IA separa copo, ingredientes com dosagem e o preparo.\nEx: Moscow Mule: 50ml de vodka, suco de meio limão e espuma de gengibre na caneca de cobre com gelo..."}
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "#fff", color: "var(--fg)", border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
            <button onClick={montarDrinkComIA} disabled={gerandoIA || !receitaIA.trim()} className="mt-2 w-full flex items-center justify-center gap-1.5 text-[12px] font-black uppercase text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-2.5 rounded-xl transition-colors disabled:opacity-50">
              {gerandoIA ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {gerandoIA ? "Montando o drink..." : "Montar drink automaticamente"}
            </button>
          </div>

          {/* SEÇÃO: Ingredientes & Dosagem */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-slate-600 uppercase tracking-widest">Ingredientes &amp; Dosagem</label>
              <button onClick={invocarIA} disabled={gerandoIA || (!ingredientesTexto && !f.descritivo)} title="Gera só o passo a passo a partir dos ingredientes abaixo" className="flex items-center gap-1.5 text-[11px] font-black uppercase text-emerald-600 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 shadow-sm border border-slate-200">
                {gerandoIA ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {gerandoIA ? "Gerando..." : "Preparo com IA"}
              </button>
            </div>
            <textarea
              value={ingredientesTexto}
              onChange={(e) => setIngredientesTexto(e.target.value)}
              placeholder={"Um por linha, com a dosagem:\n50 ml de vodka\n100 ml de espuma de gengibre\nSuco de 1/2 limão\nCubos de gelo"}
              rows={5}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--elevated)", color: "var(--fg)", border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          {/* SEÇÃO: Copo / Taça — com o desenho que sai no guia */}
          <div>
            <label className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-1">Copo / Taça (sai com o desenho no guia)</label>
            <div className="flex items-stretch gap-3">
              <div className="w-14 flex items-center justify-center rounded-xl border shrink-0" style={{ borderColor: "var(--line)", background: "#fdf9ef" }}
                dangerouslySetInnerHTML={{ __html: desenhoCopoSVG(copoAtual || "copo", { altura: 52 }) }} />
              <div className="flex-1 min-w-0 space-y-2">
                <Select value={CATALOGO_COPOS.find((c) => c.nome === copoAtual)?.nome || ""} onChange={(e) => e.target.value && setCopo(e.target.value)}>
                  <option value="">Escolher do catálogo...</option>
                  {CATALOGO_COPOS.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </Select>
                <TextInput value={copoAtual} onChange={(e) => setCopo(e.target.value)} placeholder="ou digite: ex. Taça Coupette, Caneca de Cobre" />
              </div>
            </div>
          </div>

          {/* SEÇÃO: Modo de Preparo */}
          <div>
            <label className="text-xs font-black text-slate-600 uppercase tracking-widest block mb-1">Modo de Preparo</label>
            <textarea
              value={f.descritivo}
              onChange={(e) => set("descritivo", e.target.value)}
              placeholder={"Um passo por linha (sai numerado no guia):\nColoque o gelo na caneca\nJunte a vodka e o suco de limão\nComplete com a espuma de gengibre\nFinalize com rodela de limão"}
              rows={5}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--elevated)", color: "var(--fg)", border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
            />
          </div>
        </div>
      ) : (
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
      )}

      {/* Editor interativo da estrutura — só nos pratos (nos drinks as abas já
          cuidam de copo/ingredientes) */}
      {f.tipo !== "drink" && f.estrutura_ia && (
        <EditorCamadas camadas={f.estrutura_ia} setCamadas={(nova) => set("estrutura_ia", nova)} />
      )}

      {/* Renderiza a prévia visual se existir (só pratos) */}
      {f.tipo !== "drink" && f.estrutura_ia && (
        <div className="mt-4">
           <SectionLabel>Prévia do Gráfico Visual</SectionLabel>
           <EstruturaVisual camadas={f.estrutura_ia} tipo={f.tipo} fotoUrl={f.foto_url} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
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
async function aguardarRecursosImpressao(contexto) {
  const doc = contexto?.document;
  if (!doc) return;
  const fontes = doc.fonts?.ready || Promise.resolve();
  const imagens = Array.from(doc.images || []).map((img) => {
    if (img.complete) return typeof img.decode === "function" ? img.decode().catch(() => {}) : Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  });
  await Promise.race([
    Promise.all([fontes, ...imagens]),
    new Promise((resolve) => setTimeout(resolve, 10000)),
  ]);
}

// Injeta um botão "Fechar" e fecha a aba sozinha após imprimir/cancelar — no
// celular a aba de impressão ficava aberta e o usuário não conseguia voltar.
function injetarFecharImpressao(html) {
  const extra = `
    <style>@media print{.__fechar-imp{display:none!important}}</style>
    <button class="__fechar-imp" onclick="window.close()" style="position:fixed;top:10px;right:10px;z-index:2147483647;padding:12px 18px;font:700 15px sans-serif;background:#0f172a;color:#fff;border:0;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer">✕ Fechar</button>
    <script>window.onafterprint=function(){setTimeout(function(){try{window.close()}catch(e){}},200)}<\/script>`;
  return html.includes("</body>") ? html.replace("</body>", extra + "</body>") : html + extra;
}

function abrirImpressaoHtml(htmlEntrada, prepararAntesDeImprimir) {
  const html = injetarFecharImpressao(htmlEntrada);
  let popup = null;
  try { popup = window.open("", "_blank", "width=980,height=1000"); } catch { popup = null; }
  try { if (popup) popup.opener = null; } catch {}

  const imprimirQuandoPronto = async (contexto, limpar) => {
    await aguardarRecursosImpressao(contexto);
    if (prepararAntesDeImprimir) await prepararAntesDeImprimir(contexto.document);
    try {
      contexto.focus();
      contexto.print();
    } catch (e) {
      alert("Não consegui abrir a impressão: " + e.message);
    }
    if (limpar) setTimeout(limpar, 60000);
  };

  if (!popup) {
    try {
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
      document.body.appendChild(iframe);
      iframe.onload = () => imprimirQuandoPronto(iframe.contentWindow, () => iframe.remove());
      iframe.srcdoc = html;
      return;
    } catch (e) {
      alert("O navegador bloqueou a impressão. Habilite os popups.\n\nDetalhe: " + e.message);
      return;
    }
  }

  let iniciou = false;
  const iniciar = () => {
    if (iniciou) return;
    iniciou = true;
    imprimirQuandoPronto(popup);
  };
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.addEventListener("load", iniciar, { once: true });
  if (popup.document.readyState === "complete") setTimeout(iniciar, 80);
  else setTimeout(iniciar, 1200);
}

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
        <h3>${escaparHtml(m.nome)}</h3>
        <span class="tag">${escaparHtml(m.tipo || "")}${m.tempo_preparo ? ` · ${escaparHtml(m.tempo_preparo)} min` : ""}</span>
      </div>
      ${camadas.length ? `<div class="camadas"><b>Montagem (de cima p/ baixo):</b> ${camadas.map(c => escaparHtml(c.nome || c.tipo || "Camada")).join(" → ")}</div>` : ""}
      ${passos.length ? `<ol>${passos.map(p => `<li>${escaparHtml(p.replace(/^\d+[\.\)]\s*/, ""))}</li>`).join("")}</ol>` : `<p class="vazio">Sem passo a passo cadastrado — edite a ficha para adicionar.</p>`}
      ${m.observacoes && !String(m.observacoes).startsWith("Criado automaticamente") ? `<p class="obs">${escaparHtml(m.observacoes)}</p>` : ""}
    </div>`;
  };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Montagens — ${escaparHtml(deptLabel)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:5mm 6mm;font-size:${escala}px}
      .grade{display:grid;grid-template-columns:repeat(${cols},1fr);gap:4mm}
      .card{border:1.5px solid #333;border-radius:8px;padding:${porFolha <= 2 ? "6mm" : "3.5mm"};height:${alturaCard};overflow:hidden;overflow-wrap:anywhere;break-inside:avoid;page-break-inside:avoid;display:flex;flex-direction:column}
      .card.card-longo{height:auto;min-height:${alturaCard};overflow:visible;grid-column:1/-1;break-inside:auto;page-break-inside:auto}
      .topo{display:flex;justify-content:space-between;align-items:baseline;gap:6px;border-bottom:2px solid #111;padding-bottom:3px;margin-bottom:5px}
      h3{font-size:1.25em;text-transform:uppercase;letter-spacing:.5px}
      .tag{font-size:.75em;text-transform:uppercase;color:#555;font-weight:bold}
      .camadas{font-size:.85em;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:5px;padding:4px 6px;margin-bottom:5px;color:#334155}
      ol{padding-left:1.4em;flex:1}
      li{font-size:.95em;line-height:1.45;margin-bottom:2px;color:#222}
      .vazio{font-size:.85em;color:#999;font-style:italic}
      .obs{font-size:.8em;color:#666;border-top:1px dashed #999;padding-top:3px;margin-top:4px}
      @media print{@page{margin:0}}
    </style></head><body>
    <div class="grade">${fichas.map(cardHTML).join("")}</div>
    </body></html>`;

  abrirImpressaoHtml(html, (doc) => {
    let encontrouLonga = false;
    doc.querySelectorAll(".card").forEach((card) => {
      if (card.scrollHeight > card.clientHeight + 2 || card.scrollWidth > card.clientWidth + 2) {
        card.classList.add("card-longo");
        encontrouLonga = true;
      }
    });
    if (encontrouLonga) alert("Uma ou mais fichas compactas precisaram de espaço extra. Todo o conteúdo será mantido, sem cortes.");
  });
}

// =========================================================================
// MODELO DO CHEF — título + foto + descritivo (padrão do PDF do usuário),
// com tamanhos e negrito ajustáveis e 1 ou 2 fichas por página (A4).
// =========================================================================
// Único renderizador do modelo personalizado. A prévia e todos os botões de
// impressão entregam a mesma configuração para esta função.
function gerarHtmlModelo(fichas, cfgEntrada, deptLabel, { previsualizacao = false } = {}) {
  if (!fichas.length) return "";
  const cfg = normalizarCfgModelo(cfgEntrada);
  const duas = cfg.porPagina === 2;
  const paisagem = cfg.orientacao === "paisagem";
  const larguraPapel = paisagem ? 297 : 210;
  const alturaPapel = paisagem ? 210 : 297;
  const { larguraUtil, alturaUtil } = dimensoesPapel(cfg);
  const fotoH = alturaFotoMm(cfg);
  const porPagina = duas ? 2 : 1;
  const paginas = [];
  for (let i = 0; i < fichas.length; i += porPagina) paginas.push(fichas.slice(i, i + porPagina));

  const cardHTML = (m) => {
    const nome = escaparHtml(m.nome || "Ficha de montagem");
    const etapas = String(m.descritivo || "").split("\n").map((s) => s.trim().replace(/^\d+[\.\)]\s*/, "")).filter(Boolean);
    const camadas = Array.isArray(m.estrutura_ia) ? m.estrutura_ia : [];
    // Em cima só o tipo/setor; tempo e rendimento vão ABAIXO dos ingredientes
    const detalhes = [
      m.tipo ? escaparHtml(String(m.tipo).toUpperCase()) : "",
      escaparHtml(deptLabel || m.departamento || "Operação"),
    ].filter(Boolean);
    const infoFinal = [
      m.tempo_preparo ? `Tempo de preparo: ${escaparHtml(m.tempo_preparo)} min` : "",
      m.rendimento ? `Rendimento: ${escaparHtml(m.rendimento)}` : "",
    ].filter(Boolean);

    const passos = etapas.length
      ? (cfg.numerarPassos
        ? `<ol class="passos">${etapas.map((etapa) => `<li>${escaparHtml(etapa)}</li>`).join("")}</ol>`
        : `<div class="passosLivres">${etapas.map((etapa) => `<p>${escaparHtml(etapa)}</p>`).join("")}</div>`)
      : `<p class="vazio">Sem modo de montagem cadastrado.</p>`;

    const blocoDetalhes = cfg.mostrarDetalhes && detalhes.length
      ? `<div class="detalhes">${detalhes.map((item) => `<span>${item}</span>`).join("")}</div>`
      : "";
    const blocoFoto = cfg.mostrarFoto && m.foto_url
      ? `<div class="fotoBox"><img src="${escaparHtml(m.foto_url)}" alt="Foto de ${nome}"/></div>`
      : "";
    const blocoCamadas = cfg.mostrarCamadas && camadas.length
      ? `<section class="secao blocoCamadas"><h2>Sequência de montagem</h2><div class="camadas">${camadas.map((camada, indice) => `<span><b>${indice + 1}</b>${escaparHtml(camada.nome || camada.tipo || `Camada ${indice + 1}`)}</span>`).join("")}</div></section>`
      : "";
    const observacaoValida = m.observacoes && !String(m.observacoes).startsWith("Criado automaticamente");
    const blocoObservacao = cfg.mostrarObservacoes && observacaoValida
      ? `<section class="observacao"><b>Observações</b><p>${escaparHtml(m.observacoes)}</p></section>`
      : "";
    const blocoRodape = cfg.mostrarRodape
      ? `<footer><span>Uso interno · ${escaparHtml(deptLabel || m.departamento || "Operação")}</span><span>${new Date().toLocaleDateString("pt-BR")}</span></footer>`
      : "";

    const blocoInfoFinal = cfg.mostrarDetalhes && infoFinal.length
      ? `<div class="infoFinal">${infoFinal.map((item) => `<span>${item}</span>`).join("")}</div>`
      : "";

    return `<article class="fichaM estilo-${cfg.estilo} borda-${cfg.borda}">
      <header class="cabecalho">
        <div class="kicker">Ficha de montagem · ${escaparHtml(deptLabel || m.departamento || "Operação")}</div>
        <h1>${nome}</h1>
      </header>
      ${blocoDetalhes}
      ${blocoFoto}
      ${blocoCamadas}
      <section class="secao modo"><h2>Modo de montagem</h2>${passos}</section>
      ${blocoInfoFinal}
      ${blocoObservacao}
      ${blocoRodape}
    </article>`;
  };

  const colunasPagina = duas && paisagem ? "repeat(2,minmax(0,1fr))" : "1fr";
  const linhasPagina = duas && !paisagem ? "repeat(2,minmax(0,1fr))" : "1fr";
  const alturaFicha = duas && !paisagem ? alturaUtil / 2 : alturaUtil;
  const fotoSoloH = alturaFotoMm({ ...cfg, porPagina: 1 });
  const preenchimento = cfg.estilo === "compacto" ? 4 : 6;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Fichas — ${escaparHtml(deptLabel)}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      @page{size:A4 ${paisagem ? "landscape" : "portrait"};margin:${cfg.margemMm}mm}
      html,body{background:#fff}
      body{font-family:'${cfg.fonte}',Arial,sans-serif;color:#172033;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .pagina{width:${larguraUtil}mm;height:${alturaUtil}mm;display:grid;grid-template-columns:${colunasPagina};grid-template-rows:${linhasPagina};overflow:hidden;break-after:page;page-break-after:always}
      .pagina:last-child{break-after:auto;page-break-after:auto}
      .fichaM{--foto-altura:${fotoH}mm;position:relative;width:100%;min-width:0;height:${alturaFicha}mm;padding:${preenchimento}mm;display:flex;flex-direction:column;align-items:stretch;overflow:hidden;overflow-wrap:anywhere;break-inside:avoid;page-break-inside:avoid;background:#fff;border-top:5px solid ${cfg.corDestaque}}
      .pagina.pagina-solo{grid-template-columns:1fr;grid-template-rows:1fr}
      .pagina.pagina-solo .fichaM{--foto-altura:${fotoSoloH}mm;height:${alturaUtil}mm}
      .pagina.pagina-longa{height:auto;min-height:${alturaUtil}mm;overflow:visible}
      .pagina.pagina-longa .fichaM{height:auto;min-height:${alturaUtil}mm;overflow:visible;break-inside:auto;page-break-inside:auto}
      .fichaM + .fichaM{border-${paisagem ? "left" : "top"}:2px dashed #cbd5e1}
      .fichaM.estilo-operacional{border:2px solid ${cfg.corDestaque};border-top-width:8px}
      .fichaM.estilo-compacto{border-top-width:3px}
      .fichaM.borda-simples{border:1.5px solid ${cfg.corDestaque};border-top-width:5px;border-radius:8px}
      .fichaM.borda-dupla{border:5px double ${cfg.corDestaque};border-radius:8px}
      .infoFinal{display:flex;flex-wrap:wrap;gap:2mm;margin-top:3.5mm}
      .infoFinal span{padding:1.6mm 3mm;border-radius:6px;background:${cfg.corDestaque}10;border:1px solid ${cfg.corDestaque}30;color:#172033;font-size:${Math.max(10, cfg.textoPx - 2)}px;font-weight:800}
      .cabecalho{padding-bottom:3mm;border-bottom:1px solid ${cfg.corDestaque}38}
      .kicker{margin-bottom:1.5mm;color:${cfg.corDestaque};font-size:9px;font-weight:900;letter-spacing:1.6px;text-transform:uppercase}
      h1{font-size:${cfg.tituloPx}px;font-weight:${cfg.tituloNegrito ? 900 : 500};line-height:1.08;text-align:${cfg.alinhamentoTitulo};text-transform:${cfg.tituloMaiusculo ? "uppercase" : "none"};letter-spacing:${cfg.tituloMaiusculo ? "1px" : "0"};overflow-wrap:anywhere}
      .detalhes{display:flex;flex-wrap:wrap;gap:2mm;margin:3mm 0}
      .detalhes span{padding:1.3mm 2.6mm;border-radius:999px;background:${cfg.corDestaque}12;border:1px solid ${cfg.corDestaque}30;color:${cfg.corDestaque};font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.5px}
      .fotoBox{width:100%;height:var(--foto-altura);flex:0 0 var(--foto-altura);display:flex;align-items:center;justify-content:center;margin:4mm 0}
      .fotoBox img{display:block;width:${Math.min(cfg.fotoPct, 100)}%;height:100%;max-width:none;max-height:none;object-fit:${cfg.ajusteFoto};object-position:center ${cfg.posicaoFoto};border-radius:${raioFoto(cfg)};border:1px solid #e2e8f0;background:#f8fafc}
      .secao{width:100%;margin-top:3mm}
      .secao h2,.observacao b{display:block;margin-bottom:2mm;color:${cfg.corDestaque};font-size:.78em;font-weight:900;letter-spacing:1.2px;text-transform:uppercase}
      .modo{font-size:${cfg.textoPx}px;font-weight:${cfg.textoNegrito ? 700 : 400};line-height:${cfg.entrelinha};text-align:${cfg.alinhamentoTexto}}
      .passos{padding-left:1.55em}
      .passos li{padding-left:.25em;margin-bottom:.28em;break-inside:avoid}
      .passos li::marker{color:${cfg.corDestaque};font-weight:900}
      .passosLivres p{margin-bottom:.35em}
      .vazio{color:#94a3b8;font-style:italic}
      .blocoCamadas{padding:3mm;border:1px solid ${cfg.corDestaque}32;border-radius:10px;background:${cfg.corDestaque}0D;font-size:${Math.max(10, cfg.textoPx - 2)}px}
      .camadas{display:grid;gap:1.4mm}
      .camadas span{display:flex;align-items:center;gap:2mm}
      .camadas b{width:6mm;height:6mm;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:${cfg.corDestaque};color:#fff;font-size:9px;flex:none}
      .observacao{margin-top:4mm;padding:3mm 3.5mm;border-left:4px solid ${cfg.corDestaque};background:#f8fafc;border-radius:6px;font-size:${Math.max(10, cfg.textoPx - 2)}px;line-height:${cfg.entrelinha}}
      footer{margin-top:auto;padding-top:4mm;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:4mm;color:#64748b;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
      .avisoOverflow{position:absolute;z-index:5;left:3mm;right:3mm;bottom:3mm;padding:2mm;border-radius:5px;background:#fff7ed;border:1px solid #fb923c;color:#9a3412;font-size:10px;font-weight:900;text-align:center;text-transform:uppercase}
      @media screen{body{padding:20px;background:#e2e8f0}.pagina{margin:0 auto 20px;background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.16)}}
      @media print{body{padding:0}.pagina{margin:0;box-shadow:none}}
      ${previsualizacao ? `html,body{width:100%;height:100%;overflow:hidden}body{padding:0!important;background:#e2e8f0}.papelPreview{position:relative;width:${larguraPapel}mm;height:${alturaPapel}mm;background:#fff;transform-origin:top left}.papelPreview>.pagina{position:absolute;left:${cfg.margemMm}mm;top:${cfg.margemMm}mm;margin:0!important;box-shadow:none!important}.avisoAjuste{position:absolute;z-index:10;right:2mm;top:2mm;max-width:70mm;padding:1.4mm 2mm;border-radius:4px;background:#fff7ed;border:1px solid #fb923c;color:#9a3412;font-size:8px;font-weight:900;text-align:center;text-transform:uppercase}` : ""}
    </style></head><body>
      ${previsualizacao ? `<div class="papelPreview">` : ""}
      ${paginas.map((pagina) => `<main class="pagina">${pagina.map(cardHTML).join("")}</main>`).join("")}
      ${previsualizacao ? `</div>` : ""}
      ${previsualizacao ? `<script>
        (function(){
          var papel=document.querySelector('.papelPreview');
          var pagina=document.querySelector('.pagina');
          if(!papel||!pagina)return;
          function ajustar(){papel.style.transform='none';papel.style.transform='scale('+(document.documentElement.clientWidth/papel.offsetWidth)+')';}
          requestAnimationFrame(function(){
            var fichas=[].slice.call(pagina.querySelectorAll('.fichaM'));
            var estourou=fichas.some(function(fc){return fc.scrollHeight>fc.clientHeight+2||fc.scrollWidth>fc.clientWidth+2;});
            if(estourou){
              if(${duas ? "true" : "false"}){
                // "2 na mesma página": encolhe TODAS as fichas pelo MESMO fator
                // (o menor necessário) — assim ficam alinhadas e do mesmo tamanho.
                var rMin=1;
                fichas.forEach(function(fc){
                  var r=Math.min(fc.clientHeight/fc.scrollHeight,fc.clientWidth/fc.scrollWidth,1);
                  if(r<rMin) rMin=r;
                });
                if(rMin<1){
                  var z=Math.max(0.45,rMin*0.98);
                  fichas.forEach(function(fc){fc.style.zoom=z;});
                }
                var ajuste=document.createElement('div');
                ajuste.className='avisoAjuste';
                ajuste.textContent='Fichas reduzidas para caberem as 2 juntas';
                papel.appendChild(ajuste);
                requestAnimationFrame(function(){
                  var r2min=1;
                  fichas.forEach(function(fc){
                    if(fc.scrollHeight>fc.clientHeight+2){
                      var r2=fc.clientHeight/fc.scrollHeight;
                      if(r2<r2min) r2min=r2;
                    }
                  });
                  if(r2min<1){
                    var z2=Math.max(0.4,(parseFloat(fichas[0].style.zoom)||1)*r2min*0.98);
                    fichas.forEach(function(fc){fc.style.zoom=z2;});
                  }
                  ajustar();
                });
              } else {
                var fc0=fichas[0];
                requestAnimationFrame(function(){
                  if(fc0&&(fc0.scrollHeight>fc0.clientHeight+2||fc0.scrollWidth>fc0.clientWidth+2)){
                    var aviso=document.createElement('div');
                    aviso.className='avisoOverflow';
                    aviso.textContent='Esta ficha usará mais de uma folha para não cortar';
                    fc0.appendChild(aviso);
                  }
                  ajustar();
                });
              }
            }
            ajustar();
          });
          addEventListener('resize',ajustar);
        })();
      </script>` : ""}
    </body></html>`;

  return html;
}

async function ajustarFichasQueExcedemFolha(doc, cfg) {
  if (cfg.porPagina !== 2) {
    let encontrouLonga = false;
    doc.querySelectorAll(".pagina").forEach((pagina) => {
      const ficha = pagina.querySelector(".fichaM");
      if (ficha && (ficha.scrollHeight > ficha.clientHeight + 2 || ficha.scrollWidth > ficha.clientWidth + 2)) {
        pagina.classList.add("pagina-longa");
        encontrouLonga = true;
      }
    });
    if (encontrouLonga) alert("Uma ficha precisa de mais de uma folha com os tamanhos escolhidos. Todo o conteúdo será mantido, sem cortes.");
    return;
  }
  let mudouParaFolhaInteira = false;
  const paginas = Array.from(doc.querySelectorAll(".pagina"));
  paginas.forEach((pagina) => {
    const fichas = Array.from(pagina.querySelectorAll(":scope > .fichaM"));
    const excedidas = fichas.filter((ficha) => ficha.scrollHeight > ficha.clientHeight + 2 || ficha.scrollWidth > ficha.clientWidth + 2);
    if (!excedidas.length) return;
    // "2 na mesma página" promete ENCOLHER para caber as duas — só cai para
    // folha inteira se a redução necessária deixar ilegível (abaixo de 45%).
    const menorR = Math.min(...excedidas.map((ficha) => Math.min(ficha.clientHeight / ficha.scrollHeight, ficha.clientWidth / ficha.scrollWidth))) * 0.98;
    if (menorR >= 0.45) {
      // Mesmo fator para TODAS as fichas da página — imprime alinhado e uniforme
      fichas.forEach((ficha) => { ficha.style.zoom = menorR; });
      return;
    }
    const novasPaginas = doc.createDocumentFragment();
    fichas.forEach((ficha) => {
      const paginaSolo = doc.createElement("main");
      paginaSolo.className = "pagina pagina-solo";
      paginaSolo.appendChild(ficha);
      novasPaginas.appendChild(paginaSolo);
    });
    pagina.replaceWith(novasPaginas);
    mudouParaFolhaInteira = true;
  });

  if (!mudouParaFolhaInteira) return;
  await new Promise((resolve) => doc.defaultView.requestAnimationFrame(() => doc.defaultView.requestAnimationFrame(resolve)));
  doc.querySelectorAll(".pagina-solo").forEach((pagina) => {
    const ficha = pagina.querySelector(".fichaM");
    if (ficha && (ficha.scrollHeight > ficha.clientHeight + 2 || ficha.scrollWidth > ficha.clientWidth + 2)) pagina.classList.add("pagina-longa");
  });
  alert("Uma ou mais fichas não cabiam em meia folha com os tamanhos escolhidos. Para não cortar informações, elas serão impressas em uma folha inteira.");
}

function imprimirModelo(fichas, cfgEntrada, deptLabel) {
  if (!fichas.length) return alert("Nenhuma ficha para imprimir.");
  const cfg = normalizarCfgModelo(cfgEntrada);
  const html = gerarHtmlModelo(fichas, cfg, deptLabel);
  abrirImpressaoHtml(html, (doc) => ajustarFichasQueExcedemFolha(doc, cfg));
}

// =========================================================================
// GUIA DE DRINKS (Bar) — pôster estilo kanban p/ o bartender imprimir e usar.
// Grade de cards com FOTO REAL quadrada, nome grande, copo, INGREDIENTES com
// dosagem e PREPARO numerado em sequência. Diferente das fichas da cozinha.
// =========================================================================
// A IA identifica o que é drink sem depender só do tipo marcado à mão: além do
// tipo "drink", reconhece pela estrutura (copo/gelo/líquido/decoração) e pelo
// nome (coquetéis clássicos e bebidas) — mas nunca pega pratos/petiscos.
const PALAVRAS_DRINK = /(caipir|mojito|margarita|negroni|spritz|\bgin\b|vodka|tequila|\brum\b|whisk|\bdrink|coquetel|batida|daiquiri|martini|mule|t[ôo]nica|licor|sangria|espumante|\bshot\b|\bdose\b|soda|aperol|campari|cuba|pi[ñn]a colada|bloody mary|cosmopolitan)/i;
const TIPOS_CAMADA_DRINK = new Set(["copo", "gelo", "liquido", "decoracao"]);
function ehDrinkGuia(m) {
  if (!m) return false;
  if (m.tipo === "drink") return true;
  const camadas = Array.isArray(m.estrutura_ia) ? m.estrutura_ia : [];
  if (camadas.some((c) => TIPOS_CAMADA_DRINK.has(c.tipo))) return true;
  return PALAVRAS_DRINK.test(m.nome || "");
}

// Bebida alcoólica: detecta pelo texto dos ingredientes/nome/preparo.
const PALAVRAS_ALCOOL = /(vodka|\bgin\b|\bgim\b|tequila|\brum\b|cacha[çc]a|whisk|u[íi]sque|licor|vermute|campari|aperol|conhaque|cognac|\bvinho|espumante|champa|cerveja|chopp|saqu[êe]|\bsak[êe]|cointreau|triple sec|cura[çc]au|bourbon|absinto|fernet|amaretto|prosecco|pisco|catuaba|steinhaeger|j[äa]ger|\bbitter|licoroso|steinhager|contreau)/i;
function temAlcool(m) {
  const camadas = Array.isArray(m.estrutura_ia) ? m.estrutura_ia : [];
  const texto = camadas.map((c) => c.nome).join(" ") + " " + (m.nome || "") + " " + (m.descritivo || "");
  return PALAVRAS_ALCOOL.test(texto);
}
// Dose/shot: uma medida única de destilado.
const PALAVRAS_DOSE = /(\bdose\b|\bshot\b|\bshots\b|\bcavalinho\b)/i;
function categoriaDrink(m) {
  const camadas = Array.isArray(m.estrutura_ia) ? m.estrutura_ia : [];
  const texto = camadas.map((c) => c.nome).join(" ") + " " + (m.nome || "");
  if (PALAVRAS_DOSE.test(texto)) return "Doses";
  return temAlcool(m) ? "Com Álcool" : "Sem Álcool";
}
// Um drink só entra no guia se tiver conteúdo de montagem (ingredientes ou
// preparo). Bebidas engarrafadas (água, cerveja) importadas do cardápio ficam
// sem conteúdo e não aparecem no guia.
function temConteudoDrink(m) {
  const camadas = Array.isArray(m.estrutura_ia) ? m.estrutura_ia : [];
  const temIng = camadas.some((c) => c.tipo !== "copo" && (c.nome || "").trim());
  return temIng || String(m.descritivo || "").trim().length > 0;
}
// Só os drinks que valem para o guia (é drink + tem receita/montagem).
function drinksDoGuia(lista) {
  return (lista || []).filter((m) => ehDrinkGuia(m) && temConteudoDrink(m));
}

// Cor de cada categoria (usada nos títulos e no índice/livro).
const COR_CATEGORIA = { "Com Álcool": "#1f7a33", "Sem Álcool": "#b45309", "Doses": "#7c3aed" };
const ORDEM_CATEGORIA = ["Com Álcool", "Sem Álcool", "Doses"];

// HTML de um card de drink (kanban) — reaproveitado pelo pôster e pelo livro.
function drinkCardHTML(m) {
  const nome = escaparHtml((m.nome || "Drink").toUpperCase());
  const camadas = Array.isArray(m.estrutura_ia) ? m.estrutura_ia : [];
  const copo = camadas.find((c) => c.tipo === "copo");
  const ingredientes = camadas.filter((c) => c.tipo !== "copo" && (c.nome || "").trim());
  const passos = String(m.descritivo || "").split("\n").map((s) => s.trim().replace(/^\d+[\.\)]\s*/, "")).filter(Boolean);
  // Sem foto real, a IA ilustra: o copo certo pintado com a cor do líquido
  // deduzida dos ingredientes.
  const textoIngredientes = ingredientes.map((c) => c.nome).join(" ") + " " + (m.nome || "");
  const foto = m.foto_url
    ? `<div class="foto"><img src="${escaparHtml(m.foto_url)}" alt="${nome}"/></div>`
    : `<div class="foto ilustrada">${ilustracaoDrinkSVG(copo?.nome || m.nome, textoIngredientes, 96)}</div>`;
  const subtitulo = m.rendimento ? `<p class="copo">${escaparHtml(m.rendimento)}</p>` : "";
  const blocoIngredientes = ingredientes.length
    ? `<div class="bloco"><p class="rot">Ingredientes</p><ul>${ingredientes.map((c) => `<li>${escaparHtml(c.nome)}</li>`).join("")}</ul></div>` : "";
  const blocoPreparo = passos.length
    ? `<div class="bloco"><p class="rot">Preparo</p><ol>${passos.map((p) => `<li>${escaparHtml(p)}</li>`).join("")}</ol></div>`
    : `<div class="bloco"><p class="rot">Preparo</p><p class="vazio">Sem passo a passo cadastrado.</p></div>`;
  // Seção "Copo" abaixo do preparo: desenho da taça/copo + nome.
  const blocoCopo = copo && (copo.nome || "").trim()
    ? `<div class="bloco"><p class="rot">Copo</p><div class="copoRow">${desenhoCopoSVG(copo.nome, { altura: 58 })}<span>${escaparHtml(copo.nome)}</span></div></div>`
    : "";
  return `<article class="drink"><div class="cab">${foto}<div class="tit"><h2>${nome}</h2>${subtitulo}</div></div>${blocoIngredientes}${blocoPreparo}${blocoCopo}</article>`;
}

// CSS dos cards (compartilhado). `colunas` controla o tamanho de fonte/foto.
function drinkCardCSS(colunas) {
  return `
    .grade{display:grid;grid-template-columns:repeat(${colunas},1fr);gap:3.5mm}
    .drink{border:2.5px solid #111;border-radius:10px;padding:3.5mm;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid;background:#fff}
    .cab{display:flex;gap:3mm;align-items:center;margin-bottom:2.5mm}
    .foto{width:${colunas >= 4 ? 16 : colunas === 3 ? 20 : 26}mm;height:${colunas >= 4 ? 16 : colunas === 3 ? 20 : 26}mm;flex:none;border:2px solid #111;border-radius:8px;overflow:hidden;background:#f4f4f5}
    .foto img{width:100%;height:100%;object-fit:cover;display:block}
    .foto.semFoto{display:flex;align-items:center;justify-content:center;text-align:center;color:#a1a1aa;font-weight:800;text-transform:uppercase;font-size:8px;letter-spacing:.5px}
    .tit{min-width:0;flex:1}
    .drink h2{font-size:${colunas >= 4 ? 18 : colunas === 3 ? 22 : 28}px;font-weight:900;line-height:1.05;letter-spacing:.5px;text-transform:uppercase}
    .copo{font-size:${colunas >= 4 ? 11 : 13}px;font-weight:800;color:#444;margin-top:2px}
    .bloco{margin-top:2.5mm}
    .rot{font-size:${colunas >= 4 ? 12 : 14}px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid #111;padding-bottom:2px;margin-bottom:3px}
    .drink ul,.drink ol{padding-left:1.3em}
    .drink li{font-size:${colunas >= 4 ? 13 : colunas === 3 ? 15 : 17}px;font-weight:700;line-height:1.35;margin-bottom:2px}
    .drink ol li::marker{font-weight:900}
    .vazio{font-size:13px;color:#999;font-style:italic}
    .foto.ilustrada{display:flex;align-items:center;justify-content:center;background:#fdf9ef}
    .foto.ilustrada svg{width:76%;height:86%}
    .copoRow{display:flex;align-items:center;gap:2.5mm}
    .copoRow svg{height:${colunas >= 4 ? 12 : 15}mm;width:auto;flex:none}
    .copoRow span{font-size:${colunas >= 4 ? 12 : 14}px;font-weight:800}`;
}

// Prévia na tela do card do drink — o MESMO HTML/CSS do Guia impresso.
function PreviaCardDrink({ m }) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Poppins','Segoe UI',Arial,sans-serif;color:#111;background:#e2e8f0;display:flex;justify-content:center;padding:14px}
    #w{width:100mm;max-width:100%}
    ${drinkCardCSS(1)}
  </style></head><body><div id="w">${drinkCardHTML(m)}</div></body></html>`;
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--dim)" }}>Prévia real do card do Guia de Drinks</p>
      <iframe title={`Prévia ${m.nome}`} srcDoc={html} className="w-full rounded-2xl border" style={{ height: 460, borderColor: "var(--line)", background: "#e2e8f0" }} />
    </div>
  );
}

// PÔSTER (kanban) — cards em grade, seções Com/Sem Álcool/Doses. Margem mínima.
function imprimirGuiaDrinks(fichas, colunas = 3) {
  const drinks = (fichas || []).filter(Boolean);
  if (!drinks.length) return alert("Nenhum drink para o guia.");
  const porCat = {};
  drinks.forEach((d) => { const c = categoriaDrink(d); (porCat[c] = porCat[c] || []).push(d); });
  ORDEM_CATEGORIA.forEach((c) => (porCat[c] || []).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));

  const margemMm = 4;
  const secoes = ORDEM_CATEGORIA.filter((c) => (porCat[c] || []).length).map((c) => {
    const cor = COR_CATEGORIA[c];
    return `<h2 class="secao-titulo" style="color:${cor};border-color:${cor}">${c} <span class="cont" style="background:${cor}">${porCat[c].length}</span></h2><div class="grade">${porCat[c].map(drinkCardHTML).join("")}</div>`;
  }).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Guia de Drinks</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      @page{size:A4 portrait;margin:${margemMm}mm}
      html,body{background:#fff}
      body{font-family:'Poppins','Segoe UI',Arial,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .cabeca{display:flex;align-items:center;gap:12px;border-bottom:3px solid #111;padding-bottom:5px;margin-bottom:5mm}
      .cabeca h1{font-size:26px;font-weight:900;letter-spacing:2px;text-transform:uppercase}
      .cabeca .risco{flex:1;height:3px;background:#111}
      .secao-titulo{font-size:17px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:6mm 0 3mm;padding-bottom:3px;border-bottom:2.5px solid;display:flex;align-items:center;gap:8px}
      .secao-titulo:first-of-type{margin-top:2mm}
      .secao-titulo .cont{font-size:12px;color:#fff;border-radius:999px;padding:1px 9px}
      ${drinkCardCSS(colunas)}
      @media screen{body{padding:16px;background:#e2e8f0}.folha{background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.16);padding:${margemMm}mm;max-width:210mm;margin:0 auto}}
      @media print{.folha{padding:0}}
    </style></head><body>
      <div class="folha">
        <div class="cabeca">${logoSeldeestrelaSVG(38)}<h1>Guia de Drinks</h1><span class="risco"></span></div>
        ${secoes}
      </div>
    </body></html>`;

  abrirImpressaoHtml(html, (doc) => {
    const ref = doc.createElement("div");
    ref.style.cssText = `position:absolute;visibility:hidden;width:1mm;height:${297 - 2 * margemMm}mm`;
    doc.body.appendChild(ref);
    const alturaPagina = ref.offsetHeight;
    ref.remove();
    if (!alturaPagina) return;
    doc.querySelectorAll(".drink").forEach((card) => {
      if (card.offsetHeight > alturaPagina) card.style.zoom = Math.max(0.5, (alturaPagina - 6) / card.offsetHeight);
    });
  });
}

// LIVRO — capa, índice e páginas numeradas; drinks por ordem alfabética dentro
// de cada categoria (Com Álcool, Sem Álcool, Doses).
function imprimirLivroDrinks(fichas) {
  const drinks = (fichas || []).filter(Boolean);
  if (!drinks.length) return alert("Nenhum drink para o livro.");
  const CARDS_POR_PAGINA = 6; // 2 colunas × 3 linhas
  const colunas = 2;

  const porCat = {};
  drinks.forEach((d) => { const c = categoriaDrink(d); (porCat[c] = porCat[c] || []).push(d); });
  ORDEM_CATEGORIA.forEach((c) => (porCat[c] || []).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));

  // Páginas de conteúdo: cada categoria começa em página nova.
  const paginas = [];
  ORDEM_CATEGORIA.forEach((cat) => {
    const items = porCat[cat] || [];
    for (let i = 0; i < items.length; i += CARDS_POR_PAGINA) paginas.push({ cat, cor: COR_CATEGORIA[cat], cards: items.slice(i, i + CARDS_POR_PAGINA) });
  });
  const pagPorDrink = {};
  paginas.forEach((pg, pi) => pg.cards.forEach((c) => { pagPorDrink[c.id] = pi + 3; })); // capa=1, índice=2

  const indiceHTML = ORDEM_CATEGORIA.filter((c) => (porCat[c] || []).length).map((cat) => {
    const cor = COR_CATEGORIA[cat];
    return `<div class="ind-sec" style="color:${cor};border-color:${cor}">${cat} <span>${porCat[cat].length}</span></div>` +
      porCat[cat].map((d) => `<div class="ind-item"><span>${escaparHtml(d.nome)}</span><span class="pontos"></span><span class="pg">${pagPorDrink[d.id]}</span></div>`).join("");
  }).join("");

  const conteudo = paginas.map((pg, pi) => `<section class="pagina">
      <div class="cat-band" style="background:${pg.cor}">${pg.cat}</div>
      <div class="conteudo"><div class="grade">${pg.cards.map(drinkCardHTML).join("")}</div></div>
      <div class="rodape-livro"><span>${escaparHtml(pg.cat)}</span><span>Página ${pi + 3}</span></div>
    </section>`).join("");

  // Margem esquerda maior (18mm): folga para furar/encadernar o livro.
  const margemMm = 8;
  const margemEncadernacaoMm = 18;
  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Livro de Drinks</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      @page{size:A4 portrait;margin:${margemMm}mm ${margemMm}mm ${margemMm}mm ${margemEncadernacaoMm}mm}
      html,body{background:#fff}
      body{font-family:'Poppins','Segoe UI',Arial,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .capa,.indice,.pagina{break-after:page;page-break-after:always}
      .capa{height:${297 - 2 * margemMm}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
      .capa h1{font-size:44px;font-weight:900;letter-spacing:3px;text-transform:uppercase;margin:24px 0 10px}
      .capa p{font-size:16px;color:#64748b;font-weight:700}
      .indice h1{font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:14px}
      .ind-sec{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:14px 0 6px;padding-bottom:3px;border-bottom:2px solid;display:flex;gap:8px;align-items:center}
      .ind-sec span{font-size:11px;background:currentColor;color:#fff;border-radius:999px;padding:1px 8px}
      .ind-item{display:flex;align-items:baseline;gap:6px;font-size:13px;font-weight:700;margin:3px 0}
      .ind-item .pontos{flex:1;border-bottom:1.5px dotted #cbd5e1;transform:translateY(-3px)}
      .ind-item .pg{font-weight:900}
      .pagina{height:${297 - 2 * margemMm}mm;display:flex;flex-direction:column}
      .cat-band{color:#fff;font-weight:900;text-transform:uppercase;letter-spacing:2px;font-size:15px;padding:5px 10px;border-radius:8px;margin-bottom:4mm}
      .conteudo{flex:1;overflow:hidden}
      .grade{align-content:start}
      .rodape-livro{margin-top:4mm;padding-top:5px;border-top:1px solid #cbd5e1;display:flex;justify-content:space-between;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#64748b}
      ${drinkCardCSS(colunas)}
      @media screen{body{padding:16px;background:#e2e8f0}.capa,.indice,.pagina{background:#fff;box-shadow:0 12px 35px rgba(15,23,42,.16);max-width:210mm;margin:0 auto 16px;padding:${margemMm}mm ${margemMm}mm ${margemMm}mm ${margemEncadernacaoMm}mm}}
    </style></head><body>
      <section class="capa">${logoSeldeestrelaSVG(80)}<h1>Guia de Drinks</h1><p>${drinks.length} drinks catalogados</p><p style="margin-top:6px;font-size:13px;color:#94a3b8">${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p></section>
      <section class="indice"><h1>Índice</h1>${indiceHTML}<div class="rodape-livro"><span>Guia de Drinks</span><span>Página 2</span></div></section>
      ${conteudo}
    </body></html>`;

  // Se os 6 cards não couberem na página, reduz a grade proporcionalmente.
  abrirImpressaoHtml(html, (doc) => {
    doc.querySelectorAll(".pagina").forEach((pg) => {
      const cont = pg.querySelector(".conteudo");
      const grade = pg.querySelector(".grade");
      if (cont && grade && cont.scrollHeight > cont.clientHeight + 4) {
        grade.style.zoom = Math.max(0.5, cont.clientHeight / cont.scrollHeight);
      }
    });
  });
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
  // ?q=Nome abre já filtrado (link vindo da Ficha Técnica do prato)
  const [busca, setBusca] = useState(searchParams.get("q") || "");
  const [tipo, setTipo] = useState("Todos");
  const [dept, setDept] = useState(deptInicial);
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [previewFicha, setPreviewFicha] = useState(null); // estado vivo do formulário p/ prévia
  const [previewCard, setPreviewCard] = useState(null); // ficha aberta ao clicar num card (modelo pronto)
  // Opções escolhidas na hora de imprimir (saíram do editor)
  const [impOrient, setImpOrient] = useState("retrato");   // "retrato" | "paisagem"
  const [impPorPagina, setImpPorPagina] = useState(1);      // 1 | 2 (fichas por folha)
  const [modalImpressao, setModalImpressao] = useState(false); // impressão em lote
  const [modalGuia, setModalGuia] = useState(false); // escolha cartões × livro (bar)
  const [preenchendoIA, setPreenchendoIA] = useState(false); // receitas em lote (bar)

  // Preenche de uma vez, via IA, todas as bebidas do bar que estão sem receita:
  // cada drink ganha copo, ingredientes com dosagem e preparo clássicos — para
  // você revisar e editar. Engarrafadas (água/cerveja) ficam sem receita mesmo.
  const preencherVaziosIA = async () => {
    const vazios = lista.filter((m) => !temConteudoDrink(m));
    if (!vazios.length) return alert("Todas as bebidas do bar já têm receita.");
    if (!confirm(`A IA vai montar a receita clássica de ${vazios.length} bebida(s) sem conteúdo — copo, dosagens e preparo — para você editar depois.\nÁgua/cerveja engarrafada ficam de fora. Continuar?`)) return;
    setPreenchendoIA(true);
    try {
      const res = await fetch("/api/ia-drinks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomes: vazios.map((v) => v.nome) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao montar as receitas."); return; }
      const porNome = new Map(vazios.map((v) => [v.nome.trim().toLowerCase(), v]));
      let ok = 0, engarrafadas = 0;
      for (const d of (data.drinks || [])) {
        const alvo = porNome.get(d.nome.trim().toLowerCase());
        if (!alvo) continue;
        if (d.engarrafada) { engarrafadas++; continue; }
        if (!d.ingredientes.length && !d.preparo.length) continue;
        const camadas = [
          ...(d.copo ? [{ tipo: "copo", nome: d.copo }] : []),
          ...d.ingredientes.map((nome) => ({ tipo: "liquido", nome })),
        ];
        await atualizarMontagem(alvo.id, {
          estrutura_ia: camadas.length ? camadas : null,
          descritivo: d.preparo.map((p, i) => `${i + 1}. ${p}`).join("\n"),
        });
        ok++;
      }
      alert(`${ok} receita(s) montadas pela IA — revise e edite como quiser.${engarrafadas ? `\n${engarrafadas} bebida(s) engarrafada(s) seguem sem receita (não entram no guia).` : ""}`);
      carregar();
    } catch { alert("Não consegui falar com a IA. Verifique a conexão."); } finally { setPreenchendoIA(false); }
  };
  // Seleção de fichas para imprimir juntas (ex.: 2 receitas na mesma página)
  const [selecionadas, setSelecionadas] = useState([]);
  const toggleSel = (id) => setSelecionadas(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  useEffect(() => { setSelecionadas([]); }, [dept]);
  const [salvou, setSalvou] = useState("");
  const [porFolha, setPorFolha] = useState(4); // fichas por página na impressão

  // Designer compartilhado: responde imediatamente na tela, fica salvo neste
  // aparelho e pode ser definido como padrão para toda a unidade.
  const [cfgModelo, setCfgModelo] = useState(() => normalizarCfgModelo(CFG_MODELO_PADRAO));
  const [salvandoModelo, setSalvandoModelo] = useState(false);
  useEffect(() => {
    let ativo = true;
    const chave = chaveLocalModelo(unidadeAtiva);
    let local = null;
    let temLocalDaUnidade = false;
    try {
      const salvoDaUnidade = localStorage.getItem(chave);
      const salvo = salvoDaUnidade || localStorage.getItem("hefisto_modelo_montagem");
      if (salvo) {
        local = JSON.parse(salvo);
        temLocalDaUnidade = !!salvoDaUnidade;
      }
    } catch {}
    const localNormalizado = normalizarCfgModelo(local || CFG_MODELO_PADRAO);
    if (ativo) setCfgModelo(localNormalizado);

    if (unidadeAtiva && unidadeAtiva !== "todas") {
      fetchModeloMontagem(unidadeAtiva).then(({ data }) => {
        if (!ativo || !data) return;
        const remoto = normalizarCfgModelo(data);
        if (temLocalDaUnidade && localNormalizado._updatedAt > remoto._updatedAt) return;
        setCfgModelo(remoto);
        try { localStorage.setItem(chave, JSON.stringify(remoto)); } catch {}
      }).catch(() => {});
    }
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  const mudarCfg = (patch) => setCfgModelo(c => {
    const novo = normalizarCfgModelo({ ...c, ...patch, _updatedAt: Date.now() });
    try { localStorage.setItem(chaveLocalModelo(unidadeAtiva), JSON.stringify(novo)); } catch {}
    return novo;
  });

  const aplicarPreset = (nome) => mudarCfg(PRESETS_MODELO[nome] || {});
  const restaurarModelo = () => {
    const padrao = normalizarCfgModelo({ ...CFG_MODELO_PADRAO, _updatedAt: Date.now() });
    setCfgModelo(padrao);
    try { localStorage.setItem(chaveLocalModelo(unidadeAtiva), JSON.stringify(padrao)); } catch {}
  };
  const salvarPadraoUnidade = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setSalvou("Selecione uma unidade para salvar o designer.");
      setTimeout(() => setSalvou(""), 3200);
      return;
    }
    setSalvandoModelo(true);
    let error = "";
    try {
      const modeloSalvar = normalizarCfgModelo({ ...cfgModelo, _updatedAt: Date.now() });
      setCfgModelo(modeloSalvar);
      try { localStorage.setItem(chaveLocalModelo(unidadeAtiva), JSON.stringify(modeloSalvar)); } catch {}
      const resultado = await salvarModeloMontagem(unidadeAtiva, modeloSalvar);
      error = resultado.error || "";
    } catch (e) {
      error = e?.message || "Falha de conexão";
    } finally {
      setSalvandoModelo(false);
    }
    setSalvou(error ? `Não foi possível salvar o designer: ${error}` : "Designer salvo como padrão da unidade!");
    setTimeout(() => setSalvou(""), 3500);
  };

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

  // O que vai pra impressora: as marcadas nos cards; sem marcação, as filtradas
  const alvoImpressao = selecionadas.length ? lista.filter(m => selecionadas.includes(m.id)) : filtrados;

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
    setPreviewCard((atual) => (atual && atual.id === id ? null : atual));
  }

  const deptLabelAtual = () => (dept === "bar" ? "Bar" : "Cozinha");

  // Baixar em PDF: abre a janela de impressão do modelo — o usuário escolhe
  // "Salvar como PDF". É o caminho nativo (sem depender de bibliotecas extras).
  // Toda impressão respeita o setor: no BAR os drinks saem no modelo kanban do
  // Guia (não na ficha A4 da cozinha); petisco do bar sem cara de drink e toda
  // a cozinha continuam no modelo A4.
  function imprimirFichasSetor(fichas) {
    const lote = (fichas || []).filter(Boolean);
    if (!lote.length) return alert("Nenhuma ficha para imprimir.");
    if (dept === "bar") {
      const drinks = lote.filter(ehDrinkGuia);
      const outros = lote.filter((m) => !ehDrinkGuia(m));
      if (drinks.length) imprimirGuiaDrinks(drinks, drinks.length === 1 ? 2 : 3);
      if (outros.length) imprimirModelo(outros, cfgModelo, "Bar");
      return;
    }
    imprimirModelo(lote, cfgModelo, "Cozinha");
  }

  function baixarPdf(m) {
    imprimirFichasSetor([m]);
    setSalvou('Na janela de impressão, escolha "Salvar como PDF".');
    setTimeout(() => setSalvou(""), 4000);
  }

  // Compartilhar: usa o compartilhamento nativo do aparelho. Manda a foto do
  // prato como imagem quando possível; se não der, envia o texto; por último,
  // copia para a área de transferência.
  async function compartilharFicha(m) {
    const texto = `${m.nome || "Ficha"}${m.descritivo ? " — " + m.descritivo : ""}`;
    try {
      if (m.foto_url && typeof navigator !== "undefined" && navigator.canShare) {
        try {
          const resp = await fetch(m.foto_url);
          const blob = await resp.blob();
          const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
          const file = new File([blob], `${(m.nome || "ficha").replace(/[^\w.-]+/g, "_")}.${ext}`, { type: blob.type || "image/jpeg" });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: m.nome, text: texto });
            return;
          }
        } catch (_) { /* cai para o compartilhamento de texto abaixo */ }
      }
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: m.nome, text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setSalvou("Ficha copiada para a área de transferência.");
      setTimeout(() => setSalvou(""), 2600);
    } catch (e) {
      if (e && e.name === "AbortError") return; // usuário cancelou
      try {
        await navigator.clipboard.writeText(texto);
        setSalvou("Ficha copiada para a área de transferência.");
        setTimeout(() => setSalvou(""), 2600);
      } catch (_) {
        setSalvou("Não foi possível compartilhar neste aparelho.");
        setTimeout(() => setSalvou(""), 3000);
      }
    }
  }

  const titulo = dept === "bar" ? "Montagem — Bar" : "Montagem — Cozinha";
  const subtitle = dept === "bar"
    ? "Fichas de montagem de drinks e coquetéis"
    : "Fichas de montagem e engenharia de cardápio com Inteligência Artificial";

  return (
    <div className="min-h-screen">
      <PageHeader title={titulo} subtitle={subtitle} icon={ClipboardList} onAction={() => { setEditar(null); setModal(true); }} actionLabel="Nova Ficha">
        {dept === "bar" && (() => {
          // Só drinks COM receita/montagem entram no guia (a IA identifica; as
          // bebidas engarrafadas sem preparo ficam de fora).
          const drinksGuia = drinksDoGuia(alvoImpressao);
          const vazios = lista.filter((m) => !temConteudoDrink(m)).length;
          return (
            <>
              {vazios > 0 && (
                <button onClick={preencherVaziosIA} disabled={preenchendoIA}
                  title="A IA monta a receita clássica (copo, dosagem e preparo) de todas as bebidas sem conteúdo — para você editar depois"
                  className="erp-btn erp-btn-ghost !h-9 text-xs">
                  {preenchendoIA ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {preenchendoIA ? "Montando..." : `Receitas com IA (${vazios})`}
                </button>
              )}
              <button onClick={() => drinksGuia.length ? setModalGuia(true) : alert(vazios ? `Nenhum drink com receita ainda. Use o botão "Receitas com IA" para a IA montar as ${vazios} bebidas de uma vez, ou cadastre manualmente.` : "Nenhum drink com receita para o guia.")}
                title="Guia de Drinks: pôster em cartões ou livro com capa e índice — só os drinks com receita" className="erp-btn erp-btn-primary !h-9 text-xs">
                <Wine size={14} /> Guia de Drinks{drinksGuia.length ? ` (${drinksGuia.length})` : ""}
              </button>
            </>
          );
        })()}
        <button onClick={() => setModalImpressao(true)} className="erp-btn erp-btn-ghost !h-9 text-xs"><Printer size={14} /> Impressão{selecionadas.length ? ` (${selecionadas.length})` : ""}</button>
      </PageHeader>
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <KpiGrid>
          <Kpi icon={ClipboardList} label="Fichas cadastradas" value={lista.length} tint="var(--accent-fg)" />
          <Kpi icon={Sparkles} label="Geradas com IA" value={lista.filter(l => !!l.estrutura_ia).length} tint="#9333EA" />
          <Kpi icon={Clock} label="Tempo médio" value={`${lista.length ? Math.round(lista.reduce((a, m) => a + (m.tempo_preparo || 0), 0) / lista.length) : 0} min`} tint="#3B82F6" />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar prato/drink..." autoFocus />
        <Chips options={["bar", "cozinha"]} value={dept} onChange={setDept} />
        <Chips options={["Todos", "Prato", "Drink"]} value={tipo} onChange={setTipo} />

        <div>
          <SectionLabel>{filtrados.length} ficha{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={ClipboardList} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={ClipboardList} title={busca ? "Nenhuma ficha encontrada" : "Sem fichas cadastradas"} hint={busca ? "Ajuste a busca" : "Clique em Nova para adicionar"} />
          ) : (
            <>
            <p className="text-[11px] font-medium mb-3" style={{ color: "var(--dim)" }}>Toque num card para ver o modelo pronto e escolher imprimir, baixar, compartilhar ou excluir.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filtrados.map((m) => (
                <button key={m.id} type="button" onClick={() => setPreviewCard(m)} title="Ver modelo pronto"
                  className="text-left rounded-2xl bg-white border border-slate-200 hover:shadow-lg hover:border-slate-300 transition-all relative overflow-hidden group">
                  {m.estrutura_ia && (
                    <div className="absolute top-2 right-2 bg-white/90 text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center shadow z-10" title="Criado com Inteligência Artificial">
                       <Sparkles size={12} />
                    </div>
                  )}

                  {/* Foto de capa (menor) */}
                  <div className="w-full h-28 sm:h-32 bg-slate-100 relative">
                    {/* Seleção p/ imprimir juntas (não abre o preview) */}
                    <label className="absolute top-2 left-2 z-10 bg-white/90 backdrop-blur rounded-md p-1 cursor-pointer shadow-sm" title="Selecionar para impressão" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selecionadas.includes(m.id)} onChange={() => toggleSel(m.id)} className="w-4 h-4 accent-emerald-600 block cursor-pointer" />
                    </label>
                    {m.foto_url ? (
                      <img src={m.foto_url} alt={m.nome} className="w-full h-full object-cover opacity-95 group-hover:opacity-100 transition-opacity" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                         <Camera size={24} />
                         <span className="text-[9px] uppercase font-bold mt-1">Sem foto</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    <span className="absolute top-2 left-9 px-1.5 py-0.5 rounded uppercase font-bold text-[8px] bg-black/30 text-white backdrop-blur-sm">{m.tipo}</span>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                       <span className="flex items-center gap-1.5 text-white text-xs font-bold bg-black/45 rounded-full px-3 py-1.5 backdrop-blur-sm"><Eye size={14} /> Ver modelo</span>
                    </div>
                  </div>

                  <div className="px-3 py-2.5">
                    <h3 className="font-black text-sm leading-tight text-slate-800 line-clamp-2">{m.nome}</h3>
                  </div>
                </button>
              ))}
            </div>
            </>
          )}
        </div>
      </PageBody>

      {/* PREVIEW DO MODELO PRONTO (ao clicar num card) + ações discretas */}
      {previewCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setPreviewCard(null)}>
          <div className="erp-card w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] overflow-y-auto p-4 sm:p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-base font-black truncate" style={{ color: "var(--fg)" }}>{previewCard.nome}</h3>
              <button onClick={() => setPreviewCard(null)} title="Sair" className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full" style={{ background: "var(--elevated)", color: "var(--muted)" }}><X size={16} /></button>
            </div>

            {/* No bar, o drink aparece exatamente como sai no Guia (card kanban);
                na cozinha continua a prévia do A4. */}
            {dept === "bar" && ehDrinkGuia(previewCard)
              ? <PreviaCardDrink m={previewCard} />
              : <PreviaModeloChef m={previewCard} cfg={{ ...cfgModelo, porPagina: 1 }} />}

            {/* Ações discretas */}
            <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {[
                { icon: X, label: "Sair", onClick: () => setPreviewCard(null) },
                { icon: Edit3, label: "Editar", onClick: () => { setEditar(previewCard); setModal(true); setPreviewCard(null); } },
                { icon: Printer, label: "Imprimir", onClick: () => imprimirFichasSetor([previewCard]) },
                { icon: Download, label: "PDF", onClick: () => baixarPdf(previewCard) },
                { icon: Share2, label: "Compartilhar", onClick: () => compartilharFicha(previewCard) },
                { icon: Trash2, label: "Excluir", onClick: () => remover(previewCard.id), perigo: true },
              ].map(({ icon: Ic, label, onClick, perigo }) => (
                <button key={label} onClick={onClick}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 text-[11px] font-bold transition-colors"
                  style={{ background: "var(--elevated)", color: perigo ? "#DC2626" : "var(--muted)" }}
                  title={label}>
                  <Ic size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL GIGANTE para comportar o editor */}
      {/* MODAL DO GUIA DE DRINKS: cartões (pôster) ou livro (capa + índice) */}
      {modalGuia && (() => {
        const drinksGuia = drinksDoGuia(alvoImpressao);
        const fechar = () => setModalGuia(false);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={fechar}>
            <div className="erp-card w-full max-w-md p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-black flex items-center gap-2" style={{ color: "var(--fg)" }}><Wine size={18} /> Guia de Drinks</h3>
                <button onClick={fechar} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--elevated)", color: "var(--muted)" }}>×</button>
              </div>
              <p className="text-[11px] font-medium mb-4" style={{ color: "var(--dim)" }}>
                {selecionadas.length ? `${drinksGuia.length} drink(s) marcado(s).` : `${drinksGuia.length} drink(s) com receita.`} Divididos em Com Álcool, Sem Álcool e Doses, em ordem alfabética.
              </p>
              <div className="grid gap-3">
                <button onClick={() => { fechar(); imprimirGuiaDrinks(drinksGuia, 3); }} className="flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors hover:bg-emerald-50" style={{ borderColor: "var(--line)" }}>
                  <ClipboardList size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div><p className="font-black text-slate-800 text-sm">Cartões (pôster)</p><p className="text-xs font-medium text-slate-400 mt-0.5">Grade compacta para colar na parede/bancada. Margem mínima, cabe o máximo por folha.</p></div>
                </button>
                <button onClick={() => { fechar(); imprimirLivroDrinks(drinksGuia); }} className="flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors hover:bg-emerald-50" style={{ borderColor: "var(--line)" }}>
                  <Printer size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div><p className="font-black text-slate-800 text-sm">Livro (capa + índice)</p><p className="text-xs font-medium text-slate-400 mt-0.5">Capa, índice com páginas, categorias em ordem alfabética e páginas numeradas.</p></div>
                </button>
              </div>
              <p className="text-[10px] font-medium mt-4" style={{ color: "var(--dim)" }}>Dica: marque drinks nos cards para imprimir só alguns (ex.: 2 ou mais). Sem marcar, entra todo o bar.</p>
            </div>
          </div>
        );
      })()}

      {/* MODAL DE IMPRESSÃO EM LOTE (padrão compacto + modelo com foto) */}
      {modalImpressao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setModalImpressao(false)}>
          <div className="erp-card w-full max-w-6xl max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6" onClick={e => e.stopPropagation()}>
            <div className="sticky -top-4 sm:-top-6 z-20 flex items-center justify-between mb-1 py-2" style={{ background: "var(--card)" }}>
              <h3 className="text-lg font-black flex items-center gap-2" style={{ color: "var(--fg)" }}><Printer size={18} /> Impressão das fichas</h3>
              <button onClick={() => setModalImpressao(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--elevated)", color: "var(--muted)" }}>×</button>
            </div>
            <p className="text-[11px] font-medium mb-4" style={{ color: "var(--dim)" }}>
              {selecionadas.length
                ? `Imprimindo as ${alvoImpressao.length} ficha(s) MARCADAS nos cards (desmarque para voltar a todas).`
                : "Marque fichas nos cards para imprimir só algumas (ex.: 2 receitas na mesma página)."}
            </p>
            {dept === "bar" && (
              <p className="text-[11px] font-black mb-4 px-3 py-2 rounded-xl" style={{ background: "rgba(34,197,94,0.10)", color: "#15803D" }}>
                No Bar, os drinks saem no modelo do GUIA DE DRINKS (card com foto, dosagem e preparo) — o designer abaixo vale só para itens que não são drinks.
              </p>
            )}

            {/* Modelo personalizado — as mesmas definições da prévia vão à impressora */}
            <div className="rounded-2xl border p-3 sm:p-4" style={{ borderColor: "var(--line)" }}>
              <div className="mb-4">
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "var(--fg-soft)" }}>Modelo personalizado</p>
                <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--dim)" }}>Ajuste aqui e confira a primeira ficha antes de imprimir. Foto, letras e detalhes serão mantidos no papel.</p>
              </div>
              {/* Como montar a folha: 2 juntas ou cada uma na sua, em pé ou deitada.
                  O sistema encolhe/amplia as fichas para completar a página e a
                  prévia ao lado mostra o resultado na hora. */}
              {alvoImpressao.length >= 2 && (
              <div className="rounded-2xl border p-3 sm:p-4 mb-4" style={{ borderColor: "var(--accent-strong)", background: "var(--accent-soft)" }}>
                <p className="text-[11px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--accent-strong)" }}>
                  Como imprimir as {alvoImpressao.length} montagens?
                </p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <BotaoOpcao ativo={cfgModelo.porPagina === 2} onClick={() => mudarCfg({ porPagina: 2 })}>2 na mesma página<span className="block text-[9px] font-bold normal-case opacity-75">encolhe para caber as duas</span></BotaoOpcao>
                  <BotaoOpcao ativo={cfgModelo.porPagina === 1} onClick={() => mudarCfg({ porPagina: 1 })}>Cada uma em 1 página<span className="block text-[9px] font-bold normal-case opacity-75">amplia para completar a folha</span></BotaoOpcao>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <BotaoOpcao ativo={cfgModelo.orientacao === "retrato"} onClick={() => mudarCfg({ orientacao: "retrato" })}>Vertical (A4 em pé){cfgModelo.porPagina === 2 && <span className="block text-[9px] font-bold normal-case opacity-75">uma sobre a outra</span>}</BotaoOpcao>
                  <BotaoOpcao ativo={cfgModelo.orientacao === "paisagem"} onClick={() => mudarCfg({ orientacao: "paisagem" })}>Horizontal (A4 deitado){cfgModelo.porPagina === 2 && <span className="block text-[9px] font-bold normal-case opacity-75">lado a lado</span>}</BotaoOpcao>
                </div>
              </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)] gap-5">
                <ControlesDesigner
                  cfg={cfgModelo}
                  onChange={mudarCfg}
                  onPreset={aplicarPreset}
                  onReset={restaurarModelo}
                  onSave={salvarPadraoUnidade}
                  salvando={salvandoModelo}
                  compacto
                />
                <div className="min-w-0 lg:sticky lg:top-0 lg:self-start">
                  <PreviaModeloChef lista={alvoImpressao} cfg={cfgModelo} />
                  {alvoImpressao.length > 1 && <p className="mt-2 text-center text-[10px] font-bold" style={{ color: "var(--dim)" }}>A prévia mostra a 1ª página — a mesma configuração vale para as {alvoImpressao.length} fichas.</p>}
                </div>
              </div>
              <button type="button" onClick={() => imprimirFichasSetor(alvoImpressao)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700">
                <Printer size={16} /> Imprimir personalizado ({alvoImpressao.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 md:p-6 overflow-y-auto">
           <div className="bg-[var(--surface)] sm:rounded-[24px] shadow-2xl w-full max-w-7xl min-h-full sm:min-h-0 my-auto animate-in zoom-in-95 duration-200 border border-[var(--line)]">
             <div className="p-3 sm:p-5 md:p-6 border-b border-[var(--line)] flex justify-between items-center bg-[var(--panel)] sm:rounded-t-[24px] sticky top-0 z-20">
                <h2 className="font-black text-base sm:text-lg md:text-xl text-[var(--fg)] flex items-center gap-2">
                  <ClipboardList size={20} className="text-slate-600 shrink-0" />
                  {editar ? "Editar Ficha de Montagem" : "Nova Ficha de Montagem"}
                </h2>
                <button onClick={() => { setModal(false); setEditar(null); }} className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-[var(--surface)] text-[var(--subtle)] border border-[var(--line)] hover:bg-[var(--elevated)] hover:text-[var(--fg)]">
                   <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
             </div>

             {/* Celular/tablet: prévia FIXA no topo, formulário abaixo e designer por último.
                 Desktop: formulário à esquerda, prévia (fixa) + designer à direita. */}
             <div className="p-3 sm:p-5 md:p-6 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,.9fr)] lg:grid-rows-[auto_1fr] gap-4 lg:gap-x-8 lg:gap-y-4 max-h-[calc(100dvh-4rem)] lg:max-h-[78vh] overflow-y-auto custom-scrollbar">

                {/* PRÉVIA — celular ordem 1 (fixa no topo); desktop coluna direita, linha 1 */}
                <div className="order-1 lg:order-none lg:col-start-2 lg:row-start-1 sticky top-0 z-10 -mx-3 sm:mx-0 px-3 sm:px-0 pb-2 lg:pb-0" style={{ background: "var(--surface)" }}>
                  <div className="lg:sticky lg:top-0">
                    <h3 className="font-black text-[var(--fg)] text-sm sm:text-lg mb-0.5">Prévia da ficha impressa</h3>
                    <p className="text-[var(--subtle)] text-[11px] sm:text-xs mb-2 hidden sm:block">Acompanha cada ajuste em tempo real — é exatamente o que vai para a impressão, com a foto inteira.</p>
                    <div className="max-w-[240px] sm:max-w-[300px] lg:max-w-none mx-auto">
                      <PreviaModeloChef m={previewFicha} cfg={cfgModelo} />
                    </div>
                  </div>
                </div>

                {/* FORMULÁRIO — celular ordem 2; desktop coluna esquerda (2 linhas) */}
                <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 lg:row-span-2 space-y-4">
                   <FormMontagem inicial={editar} deptInicial={dept} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} onPreview={setPreviewFicha} />
                </div>

                {/* DESIGNER — celular ordem 3; desktop coluna direita, linha 2 */}
                <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-2 space-y-4 border-t border-[var(--line)] pt-4 lg:border-0 lg:pt-0">
                    <ControlesDesigner
                      cfg={cfgModelo}
                      onChange={mudarCfg}
                      onPreset={aplicarPreset}
                      onReset={restaurarModelo}
                      onSave={salvarPadraoUnidade}
                      salvando={salvandoModelo}
                    />
                    <button type="button" onClick={() => previewFicha?.nome && imprimirFichasSetor([previewFicha])} disabled={!previewFicha?.nome} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">
                      <Printer size={15} /> Imprimir esta ficha com o designer
                    </button>
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
