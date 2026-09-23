"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Tag, Save, Plus, Trash2, Printer, CheckCircle, Info, Loader2 } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchPerfisEtiquetas, salvarPerfisEtiquetas } from "../../../lib/parametros";
import { PRESETS_ETIQUETAS, getDefaultPerfilFisico } from "../../../lib/etiquetasUtils";
import { imprimirEtiquetaMdk022Usb } from "../../../lib/impressaoMdk022";

export default function ConfiguracaoEtiquetasPage() {
  const { unidadeAtiva } = useERP();
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  
  const [setorSelecionado, setSetorSelecionado] = useState("cozinha");
  const [perfilAtual, setPerfilAtual] = useState(null);

  useEffect(() => {
    async function carregar() {
      if (!unidadeAtiva || unidadeAtiva === "todas") return;
      setLoading(true);
      const res = await fetchPerfisEtiquetas(unidadeAtiva);
      const data = res.data || [];
      setPerfis(data);
      
      const p = data.find(x => x.setor === setorSelecionado);
      setPerfilAtual(p ? { ...p } : getDefaultPerfilFisico(setorSelecionado));
      setLoading(false);
    }
    carregar();
  }, [unidadeAtiva, setorSelecionado]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let finalValue = value;
    if (type === "number") finalValue = value === "" ? "" : Number(value);
    if (type === "checkbox") finalValue = checked;
    
    setPerfilAtual(prev => ({ ...prev, [name]: finalValue }));
  };

  const aplicarPreset = (preset) => {
    setPerfilAtual(prev => ({
      ...prev,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
      gapMm: preset.gapMm,
    }));
  };

  const handleSave = async () => {
    if (!perfilAtual.widthMm || !perfilAtual.heightMm) {
      return alert("Largura e altura são obrigatórios.");
    }
    setSaving(true);
    let novosPerfis = perfis.filter(p => p.setor !== setorSelecionado);
    novosPerfis.push(perfilAtual);

    const { error } = await salvarPerfisEtiquetas(unidadeAtiva, novosPerfis);
    setSaving(false);
    
    if (error) alert("Erro ao salvar: " + error);
    else {
      setPerfis(novosPerfis);
      setSucesso(true);
      setTimeout(() => setSucesso(false), 3000);
    }
  };

  const imprimirTeste = async () => {
    try {
      await imprimirEtiquetaMdk022Usb({
        dados: { testeCalibracao: true },
        tamanho: "custom",
        copias: 1,
        perfilFisico: perfilAtual
      });
      alert("Teste enviado para a impressora.");
    } catch (err) {
      alert("Erro ao imprimir teste: " + err.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Carregando perfis...</div>;

  const isCustom = !PRESETS_ETIQUETAS.some(p => p.widthMm === perfilAtual.widthMm && p.heightMm === perfilAtual.heightMm);

  const proporcaoY = Math.max(1, perfilAtual.heightMm || 40);
  const proporcaoX = Math.max(1, perfilAtual.widthMm || 60);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto w-full font-sans space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/configuracoes" className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg">
            <Tag size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Tamanhos e Perfis de Etiquetas</h1>
            <p className="text-sm text-muted font-medium">Configure a impressora e o tamanho físico do rolo para cada setor.</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-full sm:w-fit">
        {["cozinha", "bar"].map(setor => (
          <button
            key={setor}
            onClick={() => setSetorSelecionado(setor)}
            className={`flex-1 sm:flex-none px-6 py-2 rounded-lg font-bold text-sm capitalize transition-all ${setorSelecionado === setor ? "bg-white text-emerald-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {setor}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LADO ESQUERDO: CONFIGURAÇÕES */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
            <div className="bg-slate-50 border-b border-line-soft p-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2"><Printer size={18} className="text-emerald-600"/> 1. Impressora e Presets</h2>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase tracking-wider">Driver / Conexão</label>
                <select name="printerType" value={perfilAtual.printerType} onChange={handleChange} className="w-full bg-slate-50 border border-line rounded-xl px-4 py-3 text-slate-800 font-medium outline-none focus:border-emerald-500">
                  <option value="mdk022">MDK-022 (WebUSB TSPL)</option>
                  <option value="tp20">TP20 / POS-80 (QZ Tray ESC/POS)</option>
                  <option value="bluetooth">Impressora Térmica Portátil (Bluetooth)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">Presets de Tamanho (Largura × Altura)</label>
                <div className="flex flex-wrap gap-2">
                  {PRESETS_ETIQUETAS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => aplicarPreset(p)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${perfilAtual.widthMm === p.widthMm && perfilAtual.heightMm === p.heightMm ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-slate-50 border-line text-slate-600 hover:bg-slate-100"}`}
                    >
                      {p.nome}
                    </button>
                  ))}
                  <button
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors border ${isCustom ? "bg-indigo-50 border-indigo-300 text-indigo-800" : "bg-slate-50 border-line text-slate-600 hover:bg-slate-100"}`}
                  >
                    PERSONALIZADO
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-line-soft pt-4">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Largura (mm)</label>
                  <input type="number" step="0.1" name="widthMm" value={perfilAtual.widthMm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Altura (mm)</label>
                  <input type="number" step="0.1" name="heightMm" value={perfilAtual.heightMm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted mb-1.5 uppercase">GAP (mm)</label>
                  <input type="number" step="0.1" name="gapMm" value={perfilAtual.gapMm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold outline-none focus:border-emerald-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-line overflow-hidden">
            <div className="bg-slate-50 border-b border-line-soft p-4">
              <h2 className="font-bold text-slate-800">2. Margens, Ajuste Fino e Rotação</h2>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Sup. (mm)</label>
                <input type="number" step="0.1" name="marginTopMm" value={perfilAtual.marginTopMm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Inf. (mm)</label>
                <input type="number" step="0.1" name="marginBottomMm" value={perfilAtual.marginBottomMm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Esq. (mm)</label>
                <input type="number" step="0.1" name="marginLeftMm" value={perfilAtual.marginLeftMm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Dir. (mm)</label>
                <input type="number" step="0.1" name="marginRightMm" value={perfilAtual.marginRightMm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold" />
              </div>
            </div>
            <div className="p-5 border-t border-line-soft grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Offset X (mm)</label>
                <input type="number" step="0.1" name="offsetXmm" value={perfilAtual.offsetXmm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold bg-amber-50 focus:bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Offset Y (mm)</label>
                <input type="number" step="0.1" name="offsetYmm" value={perfilAtual.offsetYmm} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold bg-amber-50 focus:bg-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5 uppercase">Rotação (°)</label>
                <select name="rotation" value={perfilAtual.rotation} onChange={handleChange} className="w-full p-3 border border-line rounded-xl text-slate-800 font-bold">
                  <option value="0">0°</option>
                  <option value="90">90°</option>
                  <option value="180">180°</option>
                  <option value="270">270°</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
             <div className="flex items-center gap-2">
               <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer">
                 <input type="checkbox" name="isDefault" checked={perfilAtual.isDefault} onChange={handleChange} className="w-5 h-5 accent-emerald-600" />
                 Definir como padrão para {setorSelecionado}
               </label>
             </div>
             <div className="flex gap-2">
                {sucesso && <span className="text-success font-bold text-sm flex items-center gap-1 px-4"><CheckCircle size={18}/> Perfil salvo!</span>}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Perfil
                </button>
             </div>
          </div>

        </div>

        {/* LADO DIREITO: PREVIEW */}
        <div className="space-y-6">
          <div className="bg-slate-50 border border-line rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <h3 className="font-bold text-slate-800 mb-4 uppercase tracking-widest text-xs">Preview Proporcional</h3>
            <div 
              className="bg-white border-2 border-dashed border-slate-300 shadow-sm relative flex items-center justify-center overflow-hidden"
              style={{
                 width: "100%",
                 aspectRatio: `${proporcaoX} / ${proporcaoY}`,
                 maxWidth: "250px"
              }}
            >
              {/* Representação visual simplificada das margens */}
              <div 
                className="absolute border border-emerald-500/50 bg-emerald-500/10"
                style={{
                  top: `${(perfilAtual.marginTopMm / proporcaoY) * 100}%`,
                  bottom: `${(perfilAtual.marginBottomMm / proporcaoY) * 100}%`,
                  left: `${(perfilAtual.marginLeftMm / proporcaoX) * 100}%`,
                  right: `${(perfilAtual.marginRightMm / proporcaoX) * 100}%`,
                }}
              >
                <div className="w-full h-full flex flex-col items-center justify-center p-2 opacity-50">
                  <span className="text-xs font-bold text-emerald-800 whitespace-nowrap">Área Útil</span>
                </div>
              </div>
            </div>
            <p className="text-xs font-medium text-muted mt-4">
              A área verde representa onde o texto será impresso dentro da etiqueta.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-2"><Info size={18}/> Teste de Calibração</h3>
            <p className="text-xs text-amber-800 mb-4 leading-relaxed">
              Imprima uma etiqueta de teste para verificar se o texto não está cortando nas bordas. 
              Ajuste as margens ou offsets (X, Y) até os sinais de "+" ficarem visíveis nos quatro cantos.
            </p>
            <button
              onClick={imprimirTeste}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl shadow-md transition-colors flex justify-center items-center gap-2 text-sm"
            >
              <Printer size={16}/> Imprimir Teste (MDK-022)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
