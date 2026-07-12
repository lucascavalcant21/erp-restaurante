"use client";

import React, { useState, useEffect } from "react";
import { useERP } from "../../context/ERPContext";
import { fetchUnidades, atualizarUnidade } from "../../lib/unidades";
import { SkeletonList } from "../../components/ui";
import {
  Settings, Store, Phone, Clock, Save, CheckCircle, AlertCircle, Beaker, Trash2, RefreshCw,
  Landmark, MapPin, Mail, Loader2
} from "lucide-react";
import { gerarDadosFicticios, limparAmbienteTeste } from "../../lib/mock";
import { fetchPins, salvarPins } from "../../lib/seguranca";
import { fetchParams, salvarParams, PARAMS_PADRAO } from "../../lib/parametros";
import { Lock, SlidersHorizontal, Download, Smartphone } from "lucide-react";

// Instalar o app no aparelho (tablet/celular/PC). Usa o instalador nativo se o
// navegador ofereceu; senão mostra o caminho manual de cada aparelho.
function CardInstalar() {
  const [instalado, setInstalado] = useState(false);
  const [temPrompt, setTemPrompt] = useState(false);
  const [mostrarComo, setMostrarComo] = useState(false);

  useEffect(() => {
    try {
      setInstalado(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
      setTemPrompt(!!window.__hefistoInstallPrompt);
      const t = setInterval(() => setTemPrompt(!!window.__hefistoInstallPrompt), 1500);
      return () => clearInterval(t);
    } catch {}
  }, []);

  const instalar = async () => {
    const p = typeof window !== "undefined" && window.__hefistoInstallPrompt;
    if (!p) { setMostrarComo(true); return; }
    try { p.prompt(); await p.userChoice; window.__hefistoInstallPrompt = null; setTemPrompt(false); } catch {}
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center gap-2">
        <Smartphone size={18} className="text-emerald-600" />
        <h2 className="font-bold text-emerald-800">Instalar o Aplicativo (tablet, celular e computador)</h2>
      </div>
      <div className="p-6">
        {instalado ? (
          <p className="text-sm font-bold text-emerald-700 flex items-center gap-2"><CheckCircle size={16}/> Você já está usando o app instalado.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600 mb-4">Instalado, o Hefisto abre em tela cheia como um app de verdade — sem barra de navegador, e o Modo Ponto/Estações funcionam como quiosque.</p>
            <button type="button" onClick={instalar} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors">
              <Download size={18} /> {temPrompt ? "Instalar agora" : "Como instalar neste aparelho"}
            </button>
            {(mostrarComo || !temPrompt) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="font-black text-slate-700 mb-1">Android (Chrome)</p>
                  <p className="text-slate-600 font-medium">Toque no menu <b>⋮</b> (canto superior direito) → <b>"Instalar app"</b> ou <b>"Adicionar à tela inicial"</b>.</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="font-black text-slate-700 mb-1">iPhone / iPad (Safari)</p>
                  <p className="text-slate-600 font-medium">Toque em <b>Compartilhar</b> (quadrado com seta) → <b>"Adicionar à Tela de Início"</b>.</p>
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400 font-medium mt-3">Se já instalou antes e mudou a versão, desinstale e instale de novo para pegar a tela cheia nova.</p>
          </>
        )}
      </div>
    </div>
  );
}

// Parâmetros ajustáveis: tolerâncias do ponto, descontos, metas... O sistema
// passa a usar o valor novo assim que salvar.
function CardParametros({ unidadeAtiva }) {
  const [p, setP] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!unidadeAtiva) return;
    fetchParams(unidadeAtiva).then(r => setP(r.data));
  }, [unidadeAtiva]);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await salvarParams(unidadeAtiva, p);
    setSalvando(false);
    if (error) return alert("Erro ao salvar (rode o SQL da tabela config_sistema): " + error);
    setOk(true); setTimeout(() => setOk(false), 2500);
  };

  if (!p) return null;
  const GRUPOS = [
    ["Ponto Eletrônico", [
      ["tolerancia_entrada", "Liberar entrada (min antes do turno)", "A batida libera X minutos antes do horário"],
      ["tolerancia_marcacao", "Tolerância entrada/saída (min)", "Até X min grava o horário do turno (Súmula 366)"],
      ["tolerancia_retorno", "Tolerância volta do intervalo (min)", "Até X min depois grava a hora prevista"],
      ["limite_atraso", "Atraso que vira falta (min)", "Passou disso, a entrada bloqueia e conta falta"],
      ["lembrete_min", "Antecedência dos lembretes (min)", "Alerta de entrada/fim de intervalo no relógio"],
    ]],
    ["RH e Consumo", [
      ["desconto_func_pct", "Desconto do funcionário no consumo (%)", "Aplicado nos consumos e vales da equipe"],
    ]],
    ["Financeiro", [
      ["meta_cmv", "Meta de CMV (%)", "Acima disso o painel alerta em vermelho"],
      ["faturamento_minimo_cmo", "Faturamento mínimo p/ CMO % (R$)", "Abaixo disso o CMO % fica em branco"],
    ]],
    ["Estoque", [
      ["fator_reposicao", "Fator de reposição da lista de compras", "Sugere comprar até (fator × estoque mínimo)"],
    ]],
  ];
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
        <SlidersHorizontal size={18} className="text-slate-500" />
        <h2 className="font-bold text-slate-800">Parâmetros do Sistema</h2>
      </div>
      <div className="p-6 space-y-6">
        {GRUPOS.map(([titulo, campos]) => (
          <div key={titulo}>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">{titulo}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {campos.map(([k, label, hint]) => (
                <div key={k}>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</label>
                  <input type="number" min="0" step="1" value={p[k]}
                    onChange={e => setP(prev => ({ ...prev, [k]: e.target.value === "" ? "" : Number(e.target.value) }))}
                    className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:border-emerald-500" />
                  <p className="text-[10px] text-slate-400 font-medium mt-1">{hint} · padrão: {PARAMS_PADRAO[k]}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <button type="button" onClick={salvar} disabled={salvando}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
            {salvando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar parâmetros
          </button>
          <button type="button" onClick={() => setP({ ...PARAMS_PADRAO })} className="text-xs font-bold text-slate-500 hover:text-slate-700">Voltar aos padrões</button>
          {ok && <span className="text-emerald-600 font-bold text-sm flex items-center gap-1"><CheckCircle size={15}/> Salvo — já valendo!</span>}
        </div>
      </div>
    </div>
  );
}

// Senhas e PINs: PIN do gerente (ponto) + senhas de saída das estações
function CardSenhas({ unidadeAtiva }) {
  const [pins, setPins] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!unidadeAtiva) return;
    fetchPins(unidadeAtiva).then(r => setPins(r.data));
  }, [unidadeAtiva]);

  const salvar = async () => {
    for (const [k, v] of Object.entries(pins)) {
      if (!/^\d{4}$/.test(String(v || ""))) return alert("Todas as senhas devem ter exatamente 4 números.");
    }
    setSalvando(true);
    const { error } = await salvarPins(unidadeAtiva, pins);
    setSalvando(false);
    if (error) return alert("Erro ao salvar (rode o SQL da tabela config_pins): " + error);
    setOk(true); setTimeout(() => setOk(false), 2500);
  };

  if (!pins) return null;
  const CAMPOS_PIN = [
    ["pin_gerente", "PIN do Gerente (ponto)", "Libera entrada atrasada e destrava o Modo Tablet"],
    ["senha_cozinha", "Senha da Estação Cozinha", "Sair da estação Cozinha"],
    ["senha_bar", "Senha da Estação Bar", "Sair da estação Bar"],
    ["senha_salao", "Senha da Estação Salão", "Sair da estação Salão"],
  ];
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
        <Lock size={18} className="text-slate-500" />
        <h2 className="font-bold text-slate-800">Senhas e PINs (4 números)</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          {CAMPOS_PIN.map(([k, label, hint]) => (
            <div key={k}>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</label>
              <input type="text" inputMode="numeric" maxLength={4} value={pins[k] || ""}
                onChange={e => setPins(p => ({ ...p, [k]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 tracking-[0.5em] text-center outline-none focus:border-emerald-500" />
              <p className="text-[10px] text-slate-400 font-medium mt-1">{hint}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={salvar} disabled={salvando}
          className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
          {salvando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar senhas
        </button>
        {ok && <p className="text-emerald-600 font-bold text-sm mt-2 flex items-center gap-1"><CheckCircle size={15}/> Senhas atualizadas!</p>}
      </div>
    </div>
  );
}

const CAMPOS = {
  // públicos
  nome: "", telefone_contato: "", horario_funcionamento: "", email_unidade: "",
  // fiscais
  razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "", inscricao_municipal: "", regime_tributario: "",
  // endereço físico
  cep: "", endereco: "", numero: "", bairro: "", cidade: "", uf: "",
};

const mascaraCNPJ = (v) => {
  v = String(v || "").replace(/\D/g, "").slice(0, 14);
  v = v.replace(/^(\d{2})(\d)/, "$1.$2");
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
  v = v.replace(/(\d{4})(\d)/, "$1-$2");
  return v;
};

export default function ConfiguracoesPage() {
  const { unidadeAtiva } = useERP();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [dadosLoja, setDadosLoja] = useState({ ...CAMPOS });

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      if (!unidadeAtiva) return;
      const { data } = await fetchUnidades();
      const u = data?.find(x => x.id === unidadeAtiva);
      if (u) {
        const preenchido = {};
        Object.keys(CAMPOS).forEach(k => { preenchido[k] = u[k] ?? ""; });
        setDadosLoja(preenchido);
      }
      setLoading(false);
    }
    carregar();
  }, [unidadeAtiva]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDadosLoja(prev => ({ ...prev, [name]: name === "cnpj" ? mascaraCNPJ(value) : value }));
  };

  // CEP -> preenche endereço automaticamente (ViaCEP)
  const buscarCep = async (cepRaw) => {
    const limpo = String(cepRaw || "").replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const d = await res.json();
      if (!d.erro) {
        setDadosLoja(prev => ({
          ...prev,
          endereco: d.logradouro || prev.endereco,
          bairro: d.bairro || prev.bairro,
          cidade: d.localidade || prev.cidade,
          uf: d.uf || prev.uf,
        }));
      }
    } catch { /* offline: preenche à mão */ }
    setBuscandoCep(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSucesso(false);
    const updates = {};
    Object.keys(CAMPOS).forEach(k => { updates[k] = dadosLoja[k] === "" ? null : dadosLoja[k]; });
    updates.nome = dadosLoja.nome; // nome é obrigatório
    const { error } = await atualizarUnidade(unidadeAtiva, updates);
    setSaving(false);
    if (error) alert("Erro ao salvar: " + error);
    else { setSucesso(true); setTimeout(() => setSucesso(false), 3000); }
  };

  const [mockLoading, setMockLoading] = useState(false);
  const handleGerarMock = async () => {
    setMockLoading(true);
    const res = await gerarDadosFicticios();
    setMockLoading(false);
    if (res.error) alert("Erro: " + res.error);
    else { alert("Ambiente de teste criado! A página será atualizada."); window.location.reload(); }
  };
  const handleLimparMock = async () => {
    if (!confirm("CUIDADO: Tem certeza que deseja apagar o ambiente de testes? Isso apagará a loja falsa e todos os dados gerados nela. Seus dados reais estão seguros.")) return;
    setMockLoading(true);
    const res = await limparAmbienteTeste();
    setMockLoading(false);
    if (res.error) alert("Erro: " + res.error);
    else { alert("Ambiente de teste apagado com sucesso."); window.location.reload(); }
  };

  if (loading) return <div className="p-6"><SkeletonList /></div>;

  const inputCls = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none";
  const labelCls = "block text-xs font-bold text-slate-500 mb-1.5 uppercase";

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto w-full font-sans">

      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-lg">
          <Settings size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Configurações da Loja</h1>
          <p className="text-sm text-slate-500 font-medium">Dados cadastrais, fiscais e físicos da unidade — usados nos documentos impressos (atas, orçamentos, fichas).</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* CARD 1: Informações Públicas */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
            <Store size={18} className="text-slate-500" />
            <h2 className="font-bold text-slate-700">Informações Públicas</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className={labelCls}>Nome da Loja</label>
              <input type="text" name="nome" value={dadosLoja.nome} onChange={handleChange} required className={inputCls} placeholder="Ex: Seldeestrela" />
            </div>
            <div>
              <label className={`${labelCls} flex items-center gap-1`}><Phone size={12} /> Telefone / WhatsApp</label>
              <input type="text" name="telefone_contato" value={dadosLoja.telefone_contato} onChange={handleChange} className={inputCls} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className={`${labelCls} flex items-center gap-1`}><Clock size={12} /> Horário de Funcionamento</label>
              <input type="text" name="horario_funcionamento" value={dadosLoja.horario_funcionamento} onChange={handleChange} className={inputCls} placeholder="Ex: Ter a Dom das 18h às 23h" />
            </div>
            <div className="col-span-1 md:col-span-2">
              <label className={`${labelCls} flex items-center gap-1`}><Mail size={12} /> E-mail da unidade</label>
              <input type="email" name="email_unidade" value={dadosLoja.email_unidade} onChange={handleChange} className={inputCls} placeholder="contato@seldeestrela.com.br" />
            </div>
          </div>
        </div>

        {/* CARD 2: Dados Fiscais */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
            <Landmark size={18} className="text-emerald-600" />
            <h2 className="font-bold text-slate-700">Dados Fiscais</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Razão Social</label>
              <input type="text" name="razao_social" value={dadosLoja.razao_social} onChange={handleChange} className={inputCls} placeholder="Ex: Seldeestrela Restaurante LTDA" />
            </div>
            <div>
              <label className={labelCls}>Nome Fantasia</label>
              <input type="text" name="nome_fantasia" value={dadosLoja.nome_fantasia} onChange={handleChange} className={inputCls} placeholder="Ex: Seldeestrela" />
            </div>
            <div>
              <label className={labelCls}>CNPJ</label>
              <input type="text" name="cnpj" value={dadosLoja.cnpj} onChange={handleChange} className={inputCls} placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <label className={labelCls}>Regime Tributário</label>
              <select name="regime_tributario" value={dadosLoja.regime_tributario || ""} onChange={handleChange} className={inputCls}>
                <option value="">Selecione...</option>
                <option value="MEI">MEI</option>
                <option value="Simples Nacional">Simples Nacional</option>
                <option value="Lucro Presumido">Lucro Presumido</option>
                <option value="Lucro Real">Lucro Real</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Inscrição Estadual</label>
              <input type="text" name="inscricao_estadual" value={dadosLoja.inscricao_estadual} onChange={handleChange} className={inputCls} placeholder="Isento ou número" />
            </div>
            <div>
              <label className={labelCls}>Inscrição Municipal</label>
              <input type="text" name="inscricao_municipal" value={dadosLoja.inscricao_municipal} onChange={handleChange} className={inputCls} placeholder="Número (se houver)" />
            </div>
          </div>
        </div>

        {/* CARD 3: Endereço Físico */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center gap-2">
            <MapPin size={18} className="text-emerald-600" />
            <h2 className="font-bold text-slate-700">Endereço Físico</h2>
          </div>
          <div className="p-6 grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="col-span-2 md:col-span-2">
              <label className={`${labelCls} flex items-center gap-1`}>CEP {buscandoCep && <Loader2 size={11} className="animate-spin" />}</label>
              <input type="text" name="cep" value={dadosLoja.cep} onChange={handleChange} onBlur={e => buscarCep(e.target.value)} className={inputCls} placeholder="00000-000" />
              <p className="text-[10px] text-slate-400 mt-1">Digite o CEP e o endereço preenche sozinho.</p>
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className={labelCls}>Endereço (rua/avenida)</label>
              <input type="text" name="endereco" value={dadosLoja.endereco} onChange={handleChange} className={inputCls} placeholder="Ex: Av. Principal" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>Número</label>
              <input type="text" name="numero" value={dadosLoja.numero} onChange={handleChange} className={inputCls} placeholder="123" />
            </div>
            <div className="col-span-2 md:col-span-2">
              <label className={labelCls}>Bairro</label>
              <input type="text" name="bairro" value={dadosLoja.bairro} onChange={handleChange} className={inputCls} placeholder="Centro" />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className={labelCls}>Cidade</label>
              <input type="text" name="cidade" value={dadosLoja.cidade} onChange={handleChange} className={inputCls} placeholder="Ex: Belém" />
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className={labelCls}>UF</label>
              <input type="text" name="uf" value={dadosLoja.uf} onChange={handleChange} maxLength={2} className={`${inputCls} uppercase`} placeholder="PA" />
            </div>
          </div>
        </div>

        {/* BOTÕES */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {sucesso ? (
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-lg">
              <CheckCircle size={16} /> Configurações salvas com sucesso!
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 font-medium text-xs">
              <AlertCircle size={14} /> Esses dados saem no cabeçalho das atas, orçamentos e demais impressos.
            </div>
          )}
          <button type="submit" disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2">
            {saving ? "Salvando..." : <><Save size={18} /> Salvar Alterações</>}
          </button>
        </div>

      </form>

      {/* Senhas e PINs do sistema */}
      <CardSenhas unidadeAtiva={unidadeAtiva} />

      {/* Parâmetros ajustáveis (tolerâncias, metas, descontos) */}
      <CardParametros unidadeAtiva={unidadeAtiva} />

      {/* Instalar o app no aparelho */}
      <CardInstalar />

      {/* Sandbox de testes */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="bg-purple-50 border-b border-purple-100 p-4 flex items-center gap-2">
          <Beaker size={18} className="text-purple-600" />
          <h2 className="font-bold text-purple-800">Desenvolvimento e Testes (Sandbox)</h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 mb-6">
            Crie um <strong>Ambiente de Teste</strong> para visualizar o ERP funcionando sem sujar a sua loja oficial.
            Uma unidade falsa será criada com fichas técnicas, produtos e dados de exemplo.
          </p>
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleGerarMock} disabled={mockLoading} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
              <RefreshCw size={18} className={mockLoading ? "animate-spin" : ""} /> {mockLoading ? "Processando..." : "Gerar Ambiente de Teste"}
            </button>
            <button type="button" onClick={handleLimparMock} disabled={mockLoading} className="bg-red-50 text-red-600 hover:bg-red-100 font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50">
              <Trash2 size={18} /> Apagar Ambiente
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
