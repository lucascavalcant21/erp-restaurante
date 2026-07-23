"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchInsumos, salvarInsumo, removerInsumo, fetchHistoricoPrecos, atualizarCustoUnitario } from "../../../lib/operacao";
import { CATEGORIAS_INSUMO, adivinharCategoria } from "../../../lib/categorias-insumo";
import { FlaskConical, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft, CheckCircle2, AlertTriangle, Sparkles, Loader2, Camera, History, TrendingUp, TrendingDown, ArrowLeftRight, Calculator } from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { comprimirFotoParaIA } from "../../../lib/imagem";
import RecipeWorkspace from "../../../components/RecipeWorkspace";

// Converte um File de imagem em base64 puro (sem o prefixo "data:...;base64,")
const fileParaBase64 = (file) => comprimirFotoParaIA(file); // comprime: foto crua estourava o limite da Vercel

function IngredientesRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "cozinha"; // fluxo sempre separado por Cozinha ou Bar
  
  const { unidadeAtiva } = useERP();
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const [modalNovo, setModalNovo] = useState(false);
  // custo_compra = preço como comprado; peso bruto/limpo calculam a perda de limpeza
  // (casca, espinha, apara). Se for empanado, soma o custo do empanamento e divide
  // pelo ganho de peso. custo_unitario salvo no banco = custo REAL do kg PRONTO.
  const [form, setForm] = useState({ id: null, departamento: deptUrl || "cozinha", nome: "", marca: "", categoria: "", unidade_medida: "kg", tamanho_embalagem: "1", valor_embalagem: "", custo_compra: "", frete: "", peso_medio_g: "", peso_bruto_g: "", peso_liquido_g: "", eh_empanado: false, custo_empanamento: "", peso_in_natura_g: "", peso_empanado_g: "", categoria_manual: false, fornecedor: "", observacoes: "", estoque_inicial: "", estoque_minimo: "", estoque_maximo: "" });
  const [catFiltro, setCatFiltro] = useState("Todas");

  // Aproveitamento (%) derivado dos pesos: 650g limpos de 1000g brutos = 65%
  const aproveitamentoForm = (() => {
    const bruto = Number(form.peso_bruto_g) || 0;
    const limpo = Number(form.peso_liquido_g) || 0;
    if (bruto > 0 && limpo > 0 && limpo <= bruto) return (limpo / bruto) * 100;
    return 100;
  })();
  
  const tamanhoReal = Number(form.tamanho_embalagem) || 1;
  const valorPagoReal = Number(form.valor_embalagem) || 0;
  // Exibimos o valor pago cheio, mas o CUSTO POR UNIDADE (usado na ficha/CMV) é o
  // valor pago dividido pelo tamanho: 200 ml por R$2 = R$0,01/ml (100 ml = R$1).
  const custoBase = valorPagoReal / tamanhoReal;
  const custoRealForm = custoBase ? custoBase / (aproveitamentoForm / 100) : 0;

  // Empanamento: fator de ganho de peso (1000g in natura -> 1360g empanado = 1,36)
  const fatorEmpanadoForm = (() => {
    if (!form.eh_empanado) return 1;
    const inNatura = Number(form.peso_in_natura_g) || 0;
    const empanado = Number(form.peso_empanado_g) || 0;
    if (inNatura > 0 && empanado > 0) return empanado / inNatura;
    return 1;
  })();
  // Custo final do kg PRONTO: (kg limpo + empanamento) dividido pelo peso que virou
  const custoFinalForm = form.eh_empanado
    ? (custoRealForm + (Number(form.custo_empanamento) || 0)) / fatorEmpanadoForm
    : custoRealForm;

  // Importação em massa via IA (texto colado e/ou foto)
  const [modalIA, setModalIA] = useState(false);
  const [iaDept, setIaDept] = useState(deptUrl || "cozinha");
  const [iaTexto, setIaTexto] = useState("");
  const [iaImagem, setIaImagem] = useState(null); // { base64, mediaType, previewUrl, nomeArquivo }
  const [iaLoading, setIaLoading] = useState(false);
  const [iaItens, setIaItens] = useState(null); // array revisável antes de salvar
  const [iaSalvando, setIaSalvando] = useState(false);
  const fileInputRef = useRef(null);

  // Feedback de sucesso (toast flutuante autodescartável)
  const [toast, setToast] = useState(null); // { msg, tipo: 'ok' | 'erro' }

  // Histórico de preços do ingrediente (cada alteração fica registrada)
  const [modalHist, setModalHist] = useState(null); // insumo aberto
  const [histPrecos, setHistPrecos] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const abrirHistorico = async (ins) => {
    setModalHist(ins);
    setHistLoading(true);
    const { data } = await fetchHistoricoPrecos(unidadeAtiva, ins.id);
    setHistPrecos(data || []);
    setHistLoading(false);
  };
  const fmtDataHoraBR = (iso) => iso
    ? `${new Date(iso).toLocaleDateString("pt-BR")} às ${new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
    : "—";
  const showToast = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2800);
  };

  // Recalcular custo por unidade (corrige itens salvos com o cálculo antigo)
  const [modalRecalc, setModalRecalc] = useState(null); // lista de {ins, atual, novo}
  const [recalcLoading, setRecalcLoading] = useState(false);

  // Custo por unidade CORRETO a partir dos campos gravados (valor pago / volume,
  // corrigido por perda de limpeza e empanamento quando houver).
  const custoUnitarioCorreto = (ins) => {
    const valorPago = Number(ins.custo_compra);
    const tam = Number(ins.tamanho_embalagem) || 1;
    if (!valorPago || valorPago <= 0 || tam <= 0) return null;
    const custoPorUnidade = valorPago / tam;
    const pct = Number(ins.aproveitamento_pct) || 100;
    const custoLimpo = custoPorUnidade / (pct / 100);
    const fator = Number(ins.fator_empanamento) || 0;
    const custoEmp = Number(ins.custo_empanamento) || 0;
    const real = fator > 0 ? (custoLimpo + custoEmp) / fator : custoLimpo;
    return Math.round(real * 10000) / 10000;
  };

  const abrirRecalc = () => {
    const mudancas = insumos.map(ins => {
      const novo = custoUnitarioCorreto(ins);
      return novo === null ? null : { ins, atual: Number(ins.custo_unitario) || 0, novo };
    }).filter(m => m && Math.abs(m.novo - m.atual) > 0.005);
    setModalRecalc(mudancas);
  };

  const aplicarRecalc = async () => {
    if (!modalRecalc || modalRecalc.length === 0) return;
    setRecalcLoading(true);
    let ok = 0;
    for (const m of modalRecalc) {
      const { error } = await atualizarCustoUnitario(m.ins.id, m.novo);
      if (!error) ok++;
    }
    setRecalcLoading(false);
    setModalRecalc(null);
    await carregar();
    showToast(`${ok} ingrediente(s) recalculado(s).`);
  };

  // Paginação client-side
  const PAGE_SIZE = 10;
  const [pagina, setPagina] = useState(1);

  const carregar = async () => {
    setLoading(true);
    // Se não tiver dept na URL, traz todos da unidade. Senão, filtra pelo dept.
    const { data } = await fetchInsumos(unidadeAtiva, deptUrl);
    setInsumos(data);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  // Busca por nome OU marca; filtro por categoria
  const buscaLower = busca.toLowerCase();
  const filtrados = insumos.filter(i =>
    (!deptUrl || (i.departamento || "").toLowerCase() === deptUrl) &&
    (i.nome.toLowerCase().includes(buscaLower) || (i.marca || "").toLowerCase().includes(buscaLower) || (i.categoria || "").toLowerCase().includes(buscaLower)) &&
    (catFiltro === "Todas" || (i.categoria || "Outros") === catFiltro)
  );
  const categoriasDept = CATEGORIAS_INSUMO[deptUrl || "cozinha"] || CATEGORIAS_INSUMO.cozinha;
    setIaTexto("");
    setIaImagem(null);
    setIaItens(null);
    setModalIA(true);
  };

  const handleSelecionarImagem = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileParaBase64(file);
    setIaImagem({ base64, mediaType: file.type || "image/jpeg", previewUrl: URL.createObjectURL(file), nomeArquivo: file.name });
  };

  const gerarInsumosIA = async () => {
    if (!iaTexto.trim() && !iaImagem) return alert("Cole uma lista de texto ou envie uma foto.");
    setIaLoading(true);
    setIaItens(null);
    try {
      const res = await fetch("/api/ia-insumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: iaTexto,
          imagem_base64: iaImagem?.base64 || null,
          imagem_media_type: iaImagem?.mediaType || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Falha ao ler a lista/foto.");
        return;
      }
      // Cada item vira uma linha revisável, com checkbox de inclusão
      setIaItens(data.itens.map(it => ({ ...it, incluir: true })));
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setIaLoading(false);
    }
  };

  const atualizarItemIA = (idx, campo, valor) => {
    setIaItens(lista => lista.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  };

  const salvarItensIA = async () => {
    const selecionados = (iaItens || []).filter(it => it.incluir);
    if (selecionados.length === 0) return alert("Selecione ao menos um ingrediente.");
    for (const it of selecionados) {
      if (!it.nome.trim() || !it.custo_unitario || Number(it.custo_unitario) <= 0) {
        return alert(`Confira o ingrediente "${it.nome || '(sem nome)'}": nome e custo são obrigatórios.`);
      }
    }
    setIaSalvando(true);
    let erros = 0;
    for (const it of selecionados) {
      const erro = await salvarInsumo({
        departamento: iaDept,
        nome: it.nome.trim(),
        marca: (it.marca || "").trim(),
        unidade_medida: it.unidade_medida,
        custo_unitario: Number(it.custo_unitario),
        unidade_id: unidadeAtiva,
      });
      if (erro.error) erros++;
    }
    setIaSalvando(false);
    setModalIA(false);
    await carregar();
    if (erros > 0) {
      showToast(`${selecionados.length - erros} salvos, ${erros} falharam.`, "erro");
    } else {
      showToast(`${selecionados.length} ingrediente(s) cadastrado(s)!`);
    }
  };

  const handleSalvar = async () => {
    if(!form.nome.trim()) return alert("Digite o nome do ingrediente");
    if(form.nome.length > 100) return alert("Nome não pode ter mais de 100 caracteres");
    
    const valorEmb = Number(form.valor_embalagem);
    if(valorEmb <= 0) return alert("Valor da embalagem deve ser um número maior que zero");
    if(valorEmb > 999999.99) return alert("Valor não pode ser maior que R$ 999.999,99");

    const tamEmb = Number(form.tamanho_embalagem) || 1;
    if(tamEmb <= 0) return alert("Tamanho/Volume da embalagem deve ser maior que zero");

    // valorPago = valor cheio pago (para exibir na lista, sem cálculo).
    // custoPorUnidade = valor pago dividido pelo tamanho (para a ficha/CMV usarem
    // proporcionalmente: 200 ml por R$2 → R$0,01/ml → 100 ml custam R$1).
    const freteTotal = Number(form.frete) || 0;
    const valorPago = valorEmb + freteTotal;
    const custoPorUnidade = valorPago / tamEmb;

    const bruto = Number(form.peso_bruto_g) || 0;
    const limpo = Number(form.peso_liquido_g) || 0;
    if ((bruto > 0) !== (limpo > 0)) return alert("Para calcular a perda, preencha os DOIS pesos (bruto e limpo) — ou deixe ambos vazios.");
    if (bruto > 0 && limpo > bruto) return alert("O peso limpo não pode ser maior que o peso bruto.");

    const pct = bruto > 0 ? (limpo / bruto) * 100 : 100;
    const custoLimpo = custoPorUnidade / (pct / 100);

    // Empanamento: soma o custo dos ingredientes de empanar e divide pelo ganho de peso
    let fator = null;
    let custoEmp = null;
    if (form.eh_empanado) {
       const inNatura = Number(form.peso_in_natura_g) || 0;
       const empanado = Number(form.peso_empanado_g) || 0;
       if (!inNatura || !empanado) return alert("Produto empanado: preencha os DOIS pesos (in natura e empanado).");
       custoEmp = Number(form.custo_empanamento) || 0;
       fator = empanado / inNatura;
    const custoFinalKg = (form.eh_empanado && fator && fator > 0)
       ? (custoLimpo + (custoEmp / fator)) / fator
       : custoLimpo;

    const payload = {
       ...form,
       departamento: form.departamento || deptUrl || "cozinha",
       unidade_id: unidadeAtiva,
       custo_compra: valorPago,
       custo_unitario: custoFinalKg,
       aproveitamento_pct: pct,
       peso_bruto_g: bruto || null,
       peso_liquido_g: limpo || null,
       fator_empanamento: fator || null,
       custo_empanamento: custoEmp || null,
       tamanho_embalagem: tamEmb,
       estoque_inicial: Number(form.estoque_inicial) || 0,
       estoque_minimo: Number(form.estoque_minimo) || 0,
       estoque_maximo: Number(form.estoque_maximo) || 0
    };

    const { error } = await salvarInsumo(payload);
    if(error) {
       alert("Erro ao salvar ingrediente: " + error);
       return;
    }

    const editando = !!form.id;
    setModalNovo(false);
    await carregar();
    showToast(editando ? "Ingrediente atualizado!" : "Ingrediente cadastrado!");
  };

  const handleRemover = async (id) => {
    const ingrediente = insumos.find(i => i.id === id);
    if(!ingrediente) return;

    if(confirm(`Deseja deletar "${ingrediente.nome}"?\n\nAviso: Se este ingrediente estiver em uso numa Ficha Técnica, a exclusão falhará.`)) {
       const { error } = await removerInsumo(id);
       if(error) {
         if(error.toLowerCase().includes("foreign") || error.toLowerCase().includes("ficha")) {
           alert(`Não é possível deletar "${ingrediente.nome}" pois ele está sendo usado em uma Ficha Técnica.\n\nDelete a ficha técnica primeiro.`);
         } else {
           alert(`Erro ao deletar "${ingrediente.nome}": ${error}`);
         }
       } else {
         await carregar();
         showToast(`"${ingrediente.nome}" removido.`);
       }
    }
  };

  // Move o ingrediente entre Cozinha e Bar com um clique (na etiqueta do setor).
  // Envia custo_unitario junto p/ não registrar falsa mudança de preço.
  const moverDepartamento = async (ins) => {
    const novo = (ins.departamento || "").toLowerCase() === "bar" ? "cozinha" : "bar";
    const { error } = await salvarInsumo({
      id: ins.id,
      departamento: novo,
      custo_unitario: ins.custo_unitario,
      unidade_id: unidadeAtiva,
      nome: ins.nome,
    });
    if (error) { showToast("Erro ao mover: " + error, "erro"); return; }
    showToast(`"${ins.nome}" movido para ${novo === "bar" ? "Bar" : "Cozinha"}.`);
    await carregar();
  };

  if(!unidadeAtiva) {
    return (
      <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <FlaskConical size={32} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">Nenhuma Loja Ativa</h2>
          <p className="text-slate-600 font-semibold">Selecione uma loja na barra superior para gerenciar ingredientes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      <RecipeWorkspace
        active="ingredientes"
        dept={deptUrl || "cozinha"}
        title={deptUrl === "bar" ? "Ingredientes do Bar" : "Ingredientes da Cozinha"}
        description={deptUrl === "bar"
          ? "Centralize bebidas, frutas, xaropes e insumos com o custo correto para alimentar drinks e fichas do bar."
          : "Cadastre insumos, perdas, rendimento e preços. Esses custos alimentam automaticamente fichas, CMV e montagem."}
        total={filtrados.length}
        onPrimary={abrirNovo}
        primaryLabel="Cadastrar insumo"
      >
               <button onClick={abrirRecalc} title="Recalcular o custo por unidade de todos os ingredientes" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">
                  <Calculator size={18} /> Recalcular custos
               </button>
               <button onClick={abrirModalIA} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/15">
                  <Sparkles size={18} /> Importar com IA
               </button>
      </RecipeWorkspace>

      <div className="max-w-7xl mx-auto px-3 sm:px-5 mt-5 sm:mt-6">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-4 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar por nome, marca ou categoria..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         {/* Filtro por categoria (quebra em linhas, sem rolagem horizontal) */}
         <div className="flex flex-wrap gap-2 mb-5">
            {["Todas", ...categoriasDept].map(c => { const nCat = c === "Todas" ? insumos.filter(i => !deptUrl || (i.departamento || "").toLowerCase() === deptUrl).length : insumos.filter(i => (!deptUrl || (i.departamento || "").toLowerCase() === deptUrl) && (i.categoria || "Outros") === c).length; return (
               <button key={c} onClick={() => setCatFiltro(c)}
                  className={`flex-shrink-0 px-3.5 py-1.5 rounded-full font-bold text-xs transition-all ${catFiltro === c ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                  {c} <span className={catFiltro === c ? "text-slate-300" : "text-slate-400"}>({nCat})</span>
               </button>
            );})}
         </div>

         <div className="rounded-2xl overflow-hidden shadow-md border border-slate-200">
            {/* Header */}
            <div className="hidden md:grid bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 grid-cols-[1fr_auto_auto_auto] gap-4 items-center">
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Ingrediente</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-28">Volume / Unid.</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-36">Valor Pago</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-right w-32">Ações</span>
            </div>
            {/* Linhas */}
            <div className="bg-white divide-y divide-slate-100">
               {loading && (
                 <div className="p-12 text-center">
                   <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                   <p className="text-slate-400 font-bold text-sm">Carregando ingredientes{deptUrl ? ` de ${deptUrl}` : ''}...</p>
                 </div>
               )}
               {!loading && paginados.map(ins => {
                 const dept = ins.departamento?.toLowerCase();
                 const deptColor = dept === 'bar' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';
                 return (
                   <div key={ins.id} className={`p-4 sm:px-6 sm:py-4 grid grid-cols-2 md:grid-cols-[1fr_auto_auto_auto] gap-4 items-center group transition-all duration-150 ${dept === "bar" ? "hover:bg-violet-50/50" : "hover:bg-emerald-50/40"}`}>
                     {/* Nome + Dept */}
                     <div className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
                       <div className={`w-1 h-10 rounded-full shrink-0 ${dept === "bar" ? "bg-violet-400" : "bg-emerald-400"}`} />
                       <div className="min-w-0">
                         <p className="font-bold text-slate-800 text-[15px] leading-tight truncate">{ins.nome}{ins.marca ? <span className="text-slate-400 font-medium"> · {ins.marca}</span> : null}</p>
                         <div className="flex items-center gap-1.5 mt-1">
                           <button onClick={() => moverDepartamento(ins)} title={`Clique para mover para ${dept === 'bar' ? 'Cozinha' : 'Bar'}`} className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${deptColor} hover:ring-2 hover:ring-offset-1 hover:ring-slate-300 transition-all`}>{ins.departamento} <ArrowLeftRight size={9} /></button>
                           {ins.categoria && <span className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{ins.categoria}</span>}
                           {ins.eh_empanado && Number(ins.fator_empanamento) > 0 && (
                             <span className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-100 text-sky-700" title={`1 kg in natura vira ${Number(ins.fator_empanamento).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg empanado`}>
                               empanado {Number(ins.fator_empanamento) > 1 ? '+' : ''}{((Number(ins.fator_empanamento) - 1) * 100).toFixed(0)}%
                             </span>
                           )}
                         </div>
                       </div>
                     </div>
                     {/* Volume + unidade de medida, bem visível */}
                     <div className="w-auto md:w-28 flex flex-col items-start md:items-center gap-0.5">
                       <span className="md:hidden text-[9px] font-black uppercase tracking-widest text-slate-400">Volume</span>
                       <span className="bg-slate-800 text-white px-3 py-2 rounded-lg font-black text-sm uppercase tracking-wide shadow-sm whitespace-nowrap">
                         {Number(ins.tamanho_embalagem) > 0
                           ? `${Number(ins.tamanho_embalagem).toLocaleString('pt-BR')} ${ins.unidade_medida}`
                           : ins.unidade_medida}
                       </span>
                       {ins.unidade_medida === 'un' && Number(ins.peso_medio_g) > 0 && (
                         <span className="text-[9px] font-black text-slate-400">≈ {Number(ins.peso_medio_g).toLocaleString('pt-BR')}{String(ins.departamento).toLowerCase() === 'bar' ? 'ml' : 'g'}</span>
                       )}
                     </div>
                     {/* Valor pago cheio + custo por unidade (usado na ficha) */}
                     <div className="w-auto md:w-36 text-right md:text-center">
                       <span className="md:hidden block text-[9px] font-black uppercase tracking-widest text-slate-400">Valor pago</span>
                       <span className="font-black text-xl text-emerald-600">{fmtBRL(ins.custo_compra ?? ins.custo_unitario)}</span>
                       {Number(ins.tamanho_embalagem) > 1 && (
                         <p className="text-[10px] font-bold text-slate-500 mt-0.5" title="Custo por unidade usado na ficha técnica e no CMV">
                           {fmtBRL(ins.custo_unitario)} / {ins.unidade_medida}
                         </p>
                       )}
                       {Number(ins.aproveitamento_pct) > 0 && Number(ins.aproveitamento_pct) < 100 && (
                         <p className="text-[9px] font-black uppercase tracking-widest text-red-500 mt-0.5" title={`Valor pago: ${fmtBRL(ins.custo_compra)} · aproveitamento ${Number(ins.aproveitamento_pct).toFixed(0)}%`}>
                           perda {(100 - Number(ins.aproveitamento_pct)).toFixed(0)}%
                         </p>
                       )}
                       <p className="text-[9px] font-bold text-slate-400 mt-0.5" title="Última atualização de preço">
                         {fmtDataHoraBR(ins.preco_atualizado_em || ins.created_at)}
                       </p>
                     </div>
                     {/* Ações */}
                     <div className="col-span-2 md:col-span-1 w-full md:w-32 flex justify-end gap-2 border-t border-slate-100 pt-3 md:border-0 md:pt-0">
                       <button onClick={() => abrirHistorico(ins)} className="p-2 bg-slate-100 hover:bg-amber-100 text-slate-500 hover:text-amber-600 rounded-lg transition-all" title="Histórico de preços">
                         <History size={16}/>
                       </button>
                       <button onClick={() => abrirEditar(ins)} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-all" title="Editar">
                         <Edit3 size={16}/>
                       </button>
                       <button onClick={() => handleRemover(ins.id)} className="p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500 rounded-lg transition-all" title="Remover">
                         <Trash2 size={16}/>
                       </button>
                     </div>
                   </div>
                 );
               })}
               {!loading && filtrados.length === 0 && (
                 <div className="p-16 text-center">
                   <p className="text-slate-400 font-bold">Nenhum ingrediente encontrado.</p>
                 </div>
               )}
            </div>

            {/* Controles de paginação */}
            {!loading && filtrados.length > PAGE_SIZE && (
              <div className="bg-white border-t border-slate-100 px-6 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  Mostrando {(paginaAtual - 1) * PAGE_SIZE + 1}–{Math.min(paginaAtual * PAGE_SIZE, filtrados.length)} de {filtrados.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={paginaAtual === 1}
                    className="px-3 py-1.5 rounded-lg font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>
                  <span className="text-xs font-black text-slate-600 px-2">{paginaAtual} / {totalPaginas}</span>
                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={paginaAtual === totalPaginas}
                    className="px-3 py-1.5 rounded-lg font-bold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Próxima →
                  </button>
                </div>
              </div>
            )}
         </div>
      </div>

      {/* Toast flutuante de feedback */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] animate-in slide-in-from-bottom-4 fade-in">
          <div className={`px-5 py-3 rounded-xl shadow-2xl font-bold text-white flex items-center gap-2 ${toast.tipo === 'erro' ? 'bg-red-600' : 'bg-emerald-600'}`}>
            {toast.tipo === 'erro' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />} {toast.msg}
          </div>
        </div>
      )}

      {/* MODAL: RECALCULAR CUSTO POR UNIDADE (prévia antes de aplicar) */}
      {modalRecalc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setModalRecalc(null)}>
          <div className="bg-white rounded-[28px] w-full max-w-lg max-h-[85vh] p-6 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calculator size={20} className="text-slate-600" /> Recalcular custos</h2>
              <button onClick={() => setModalRecalc(null)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={17} /></button>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-4">Corrige o custo por unidade (valor pago ÷ volume) usado na ficha técnica e no CMV. Confira antes de aplicar.</p>

            {modalRecalc.length === 0 ? (
              <div className="text-center py-10">
                <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                <p className="font-bold text-slate-700">Tudo certo! Nenhum custo precisa de correção.</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {modalRecalc.map(({ ins, atual, novo }) => (
                    <div key={ins.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{ins.nome}</p>
                        <p className="text-[10px] font-bold text-slate-400">{Number(ins.tamanho_embalagem).toLocaleString('pt-BR')} {ins.unidade_medida} · pago {fmtBRL(ins.custo_compra)}</p>
                      </div>
                      <div className="text-right shrink-0 text-sm font-black">
                        <span className="text-slate-400 line-through">{fmtBRL(atual)}</span>
                        <span className="text-slate-300 mx-1">→</span>
                        <span className="text-emerald-600">{fmtBRL(novo)}</span>
                        <span className="text-[10px] font-bold text-slate-400"> /{ins.unidade_medida}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-4 shrink-0">
                  <button onClick={() => setModalRecalc(null)} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Cancelar</button>
                  <button onClick={aplicarRecalc} disabled={recalcLoading} className="flex-1 py-3 rounded-xl font-black bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {recalcLoading ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />} Aplicar em {modalRecalc.length}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL: HISTÓRICO DE PREÇOS do ingrediente */}
      {modalHist && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={() => setModalHist(null)}>
            <div className="bg-white rounded-[32px] w-full max-w-md my-8 p-7 shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
               <div className="flex justify-between items-center mb-4 shrink-0">
                  <div>
                     <h2 className="font-black text-xl text-slate-800">Histórico de Preços</h2>
                     <p className="text-sm font-bold text-slate-500 mt-0.5">{modalHist.nome} · atual {fmtBRL(modalHist.custo_unitario)}/{modalHist.unidade_medida}</p>
                  </div>
                  <button onClick={() => setModalHist(null)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={17}/></button>
               </div>
               <div className="overflow-y-auto space-y-2">
                  {histLoading ? (
                     <p className="text-center font-bold text-slate-400 py-6"><Loader2 size={20} className="animate-spin inline"/> Carregando...</p>
                  ) : histPrecos.length === 0 ? (
                     <p className="text-sm font-medium text-slate-400 text-center py-6">Nenhuma alteração registrada ainda. A partir de agora, toda mudança de preço fica salva aqui.</p>
                  ) : histPrecos.map(h => {
                     const antigo = Number(h.custo_anterior);
                     const novo = Number(h.custo_novo) || 0;
                     const temAntigo = h.custo_anterior !== null && antigo > 0;
                     const varPct = temAntigo ? ((novo - antigo) / antigo) * 100 : null;
                     const subiu = varPct !== null && varPct > 0;
                     return (
                        <div key={h.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                           <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${varPct === null ? "bg-slate-200 text-slate-500" : subiu ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
                              {varPct === null ? <Plus size={15}/> : subiu ? <TrendingUp size={15}/> : <TrendingDown size={15}/>}
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-700">
                                 {temAntigo ? <>{fmtBRL(antigo)} <span className="text-slate-400">→</span> {fmtBRL(novo)}</> : <>Cadastro inicial: {fmtBRL(novo)}</>}
                              </p>
                              <p className="text-[10px] font-medium text-slate-400">{fmtDataHoraBR(h.created_at)}</p>
                           </div>
                           {varPct !== null && (
                              <span className={`text-xs font-black shrink-0 ${subiu ? "text-red-600" : "text-emerald-600"}`}>{subiu ? "+" : ""}{varPct.toFixed(1)}%</span>
                           )}
                        </div>
                     );
                  })}
               </div>
               <p className="text-[10px] font-medium text-slate-400 mt-3 shrink-0">Toda alteração de preço recalcula automaticamente as fichas, o cardápio e o CMV.</p>
            </div>
         </div>
      )}

      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[92vh] flex flex-col">
               <div className="flex justify-between items-center mb-6 shrink-0">
                  <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Insumo" : "Novo Insumo"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
                  {/* Sempre visível: permite atribuir/mover o ingrediente entre Cozinha e Bar,
                      inclusive quando você entrou por um setor específico. */}
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Departamento</label>
                     <select value={form.departamento} onChange={e=>setForm({...form, departamento: e.target.value, categoria: form.categoria_manual ? form.categoria : ""})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                        <option value="cozinha">Cozinha</option>
                        <option value="bar">Bar</option>
                     </select>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Ingrediente</label>
                     <input type="text" placeholder="Ex: Tomate" value={form.nome} onChange={e=>{
                        const nome = e.target.value;
                        // Enquanto você digita, o sistema adivinha a categoria (se você não escolheu manualmente)
                        const sugerida = form.categoria_manual ? form.categoria : (adivinharCategoria(nome, form.departamento, form.marca) || form.categoria);
                        setForm({...form, nome, categoria: sugerida});
                     }} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Marca (opcional)</label>
                        <input type="text" placeholder="Ex: Carmem" value={form.marca || ""} onChange={e=>setForm({...form, marca: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">Categoria {!form.categoria_manual && form.categoria && <span className="text-[9px] font-black text-emerald-600">(auto)</span>}</label>
                        <div className="flex gap-2 mt-1">
                           <select value={form.categoria || ""} onChange={e=>setForm({...form, categoria: e.target.value, categoria_manual: true})} className="flex-1 min-w-0 p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                              <option value="">Selecione...</option>
                              {(() => {
                                 const padrao = CATEGORIAS_INSUMO[form.departamento] || CATEGORIAS_INSUMO.cozinha;
                                 const extras = [...new Set(insumos.map(i => i.categoria).filter(c => c && !padrao.includes(c)))].sort();
                                 return [...padrao, ...extras].map(c => <option key={c} value={c}>{c}</option>);
                              })()}
                              {form.categoria && !(CATEGORIAS_INSUMO[form.departamento] || CATEGORIAS_INSUMO.cozinha).includes(form.categoria) && !insumos.some(i => i.categoria === form.categoria) && <option value={form.categoria}>{form.categoria}</option>}
                           </select>
                           <button type="button" title="Criar nova categoria" onClick={() => {
                              const nova = prompt("Nome da nova categoria:");
                              if (nova && nova.trim()) setForm({ ...form, categoria: nova.trim(), categoria_manual: true });
                           }} className="w-12 shrink-0 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 font-black text-xl border border-slate-200">+</button>
                        </div>
                     </div>
                  </div>

                  {/* Fornecedor e observações (opcionais) — padrão de cadastro completo */}
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fornecedor — opcional</label>
                     <input type="text" list="fornecedores-insumo" placeholder="Selecionar ou digitar..." value={form.fornecedor || ""} onChange={e=>setForm({...form, fornecedor: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                     <datalist id="fornecedores-insumo">
                        {[...new Set(insumos.map(i => i.fornecedor).filter(Boolean))].sort().map(fn => <option key={fn} value={fn} />)}
                     </datalist>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Observações — opcional</label>
                     <textarea rows={2} placeholder="Notas sobre o insumo..." value={form.observacoes || ""} onChange={e=>setForm({...form, observacoes: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500 resize-none"/>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vol / Tamanho</label>
                        <input type="number" step="0.01" min="0" placeholder="Ex: 750" value={form.tamanho_embalagem} onChange={e=>setForm({...form, tamanho_embalagem: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Unidade</label>
                        <select value={form.unidade_medida} onChange={e=>setForm({...form, unidade_medida: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                           <option value="kg">Kilo (KG)</option>
                           <option value="l">Litro (L)</option>
                           <option value="un">Unid (UN)</option>
                           <option value="g">Grama (G)</option>
                           <option value="ml">Mililitro (ML)</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valor Pago</label>
                        <input type="number" step="0.01" min="0" max="999999.99" placeholder="0.00" value={form.valor_embalagem} onChange={e=>setForm({...form, valor_embalagem: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-600 outline-none focus:border-emerald-500"/>
                     </div>
                  </div>

                  {/* Frete (produtos que vêm de fora): soma no custo do ingrediente */}
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Frete (opcional)</label>
                     <input type="number" step="0.01" min="0" placeholder="0,00" value={form.frete || ""} onChange={e=>setForm({...form, frete: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                     <p className="text-[10px] text-slate-400 font-medium mt-1">Para produtos de fora: o valor do frete é somado ao valor pago antes de calcular o custo por unidade.</p>
                  </div>

                  {/* Medida de referência: quanto pesa/rende 1 unidade (tomate 1 un = 100g,
                      caixa de leite = 1000 ml). Aparece quando a unidade base é "un". */}
                  {form.unidade_medida === "un" && (
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                           Cada unidade equivale a ({form.departamento === "bar" ? "ml" : "g/ml"}) — opcional
                        </label>
                        <input type="number" step="0.1" min="0" placeholder="Ex: 100 (tomate) · 1000 (caixa de leite)" value={form.peso_medio_g} onChange={e=>setForm({...form, peso_medio_g: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Peso/volume médio de 1 unidade. Serve de referência para lançar na ficha e converter entre unidade e gramas/ml.</p>
                     </div>
                  )}

                  {/* Controle de Estoque Inicial e Alertas Mínimo/Máximo */}
                  <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 space-y-3">
                     <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                           📦
                        </div>
                        <div>
                           <p className="text-xs font-black uppercase tracking-wider text-emerald-900">Estoque Inicial & Alertas (Opcional)</p>
                           <p className="text-[10px] text-emerald-700 font-medium">Informe a quantidade em unidades/embalagens para cadastrar o estoque inicial</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-3 gap-3 pt-1">
                        <div>
                           <label className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Qtd. Inicial (Un)</label>
                           <input type="number" min="0" placeholder="Ex: 24" value={form.estoque_inicial} onChange={e=>setForm({...form, estoque_inicial: e.target.value})} className="w-full p-3 mt-1 bg-white border border-emerald-200 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-500 shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Qtd. Mínima</label>
                           <input type="number" min="0" placeholder="Ex: 5" value={form.estoque_minimo} onChange={e=>setForm({...form, estoque_minimo: e.target.value})} className="w-full p-3 mt-1 bg-white border border-amber-200 rounded-xl font-bold text-amber-700 outline-none focus:border-amber-500 shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Qtd. Máxima</label>
                           <input type="number" min="0" placeholder="Ex: 50" value={form.estoque_maximo} onChange={e=>setForm({...form, estoque_maximo: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-slate-500 shadow-sm"/>
                        </div>
                     </div>
                  </div>

                  {/* Perda na limpeza: pesa bruto (com casca/espinha) e limpo (aproveitável) */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                     <p className="text-[11px] font-black uppercase tracking-widest text-amber-700 mb-1">Perda na limpeza (opcional)</p>
                     <p className="text-[10px] font-medium text-amber-700/70 mb-3 leading-tight">Ex.: banana com casca vs sem casca, peixe inteiro vs filé. Meça uma amostra bruta e o que sobrou limpo — o sistema corrige o custo real.</p>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Peso/Volume Bruto</label>
                           <input type="number" step="1" min="0" placeholder="Ex: 1000" value={form.peso_bruto_g} onChange={e=>setForm({...form, peso_bruto_g: e.target.value})} className="w-full p-3 mt-1 bg-white border border-amber-200 rounded-lg font-bold text-slate-700 outline-none focus:border-amber-500"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Peso/Volume Limpo</label>
                           <input type="number" step="1" min="0" placeholder="Ex: 650" value={form.peso_liquido_g} onChange={e=>setForm({...form, peso_liquido_g: e.target.value})} className="w-full p-3 mt-1 bg-white border border-amber-200 rounded-lg font-bold text-slate-700 outline-none focus:border-amber-500"/>
                        </div>
                     </div>
                     {aproveitamentoForm < 100 && (
                        <div className="flex justify-between items-center mt-3 bg-white border border-amber-200 rounded-lg p-3">
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Perda: {(100 - aproveitamentoForm).toFixed(1)}%</p>
                              <p className="text-[10px] font-bold text-slate-500">Aproveitamento: {aproveitamentoForm.toFixed(1)}%</p>
                           </div>
                           <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Custo do kg limpo</p>
                              <p className="text-xl font-black text-emerald-600">{fmtBRL(custoRealForm)}</p>
                           </div>
                        </div>
                     )}
                  </div>

                  {/* Empanamento: o produto ganha peso ao empanar, e o empanamento tem custo próprio */}
                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.eh_empanado} onChange={e=>setForm({...form, eh_empanado: e.target.checked})} className="w-4 h-4 accent-sky-600"/>
                        <span className="text-[11px] font-black uppercase tracking-widest text-sky-700">Este produto é empanado</span>
                     </label>
                     {form.eh_empanado && (
                        <div className="mt-3 space-y-3">
                           <div>
                              <label className="text-[10px] font-bold text-sky-700 uppercase tracking-widest">Custo do empanamento (R$ por kg in natura)</label>
                              <input type="number" step="0.01" min="0" placeholder="Ex: 4.50 (farinha, ovo, temperos p/ empanar 1kg)" value={form.custo_empanamento} onChange={e=>setForm({...form, custo_empanamento: e.target.value})} className="w-full p-3 mt-1 bg-white border border-sky-200 rounded-lg font-bold text-slate-700 outline-none focus:border-sky-500"/>
                           </div>
                           <div className="grid grid-cols-2 gap-3">
                              <div>
                                 <label className="text-[10px] font-bold text-sky-700 uppercase tracking-widest">Peso in natura (g)</label>
                                 <input type="number" step="1" min="0" placeholder="Ex: 1000" value={form.peso_in_natura_g} onChange={e=>setForm({...form, peso_in_natura_g: e.target.value})} className="w-full p-3 mt-1 bg-white border border-sky-200 rounded-lg font-bold text-slate-700 outline-none focus:border-sky-500"/>
                              </div>
                              <div>
                                 <label className="text-[10px] font-bold text-sky-700 uppercase tracking-widest">Peso empanado (g)</label>
                                 <input type="number" step="1" min="0" placeholder="Ex: 1360" value={form.peso_empanado_g} onChange={e=>setForm({...form, peso_empanado_g: e.target.value})} className="w-full p-3 mt-1 bg-white border border-sky-200 rounded-lg font-bold text-slate-700 outline-none focus:border-sky-500"/>
                              </div>
                           </div>
                           {fatorEmpanadoForm !== 1 && (
                              <div className="bg-white border border-sky-200 rounded-lg p-3 space-y-2">
                                 <div className="flex justify-between items-center">
                                    <div>
                                       <p className="text-[10px] font-black uppercase tracking-widest text-sky-600">Rendimento: {fatorEmpanadoForm > 1 ? '+' : ''}{((fatorEmpanadoForm - 1) * 100).toFixed(1)}% no peso</p>
                                       <p className="text-[10px] font-bold text-slate-500">1 kg in natura vira {(fatorEmpanadoForm).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg empanado</p>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Custo do kg empanado</p>
                                       <p className="text-xl font-black text-emerald-600">{fmtBRL(custoFinalForm)}</p>
                                    </div>
                                 </div>
                                 <p className="text-[10px] font-bold text-slate-500 border-t border-sky-100 pt-2">
                                    Em 1 kg empanado: {Math.round(1000 / fatorEmpanadoForm).toLocaleString("pt-BR")} g de {form.nome || 'produto'} + {Math.round(1000 - 1000 / fatorEmpanadoForm).toLocaleString("pt-BR")} g de empanamento
                                 </p>
                              </div>
                           )}
                        </div>
                     )}
                  </div>

                  {/* ESTOQUE INICIAL E PARÂMETROS */}
                  {!form.id && (
                    <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3">
                       <div className="flex items-center justify-between">
                          <p className="text-xs font-black uppercase tracking-widest text-emerald-800 flex items-center gap-1.5">
                             📦 Estoque Inicial no Cadastro (opcional)
                          </p>
                          <span className="text-[10px] font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md">Entrada Automática</span>
                       </div>
                       <div>
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-widest block mb-1">
                             Quantas unidades / embalagens você já tem no estoque hoje?
                          </label>
                          <div className="relative">
                             <input
                                type="number" step="1" min="0" placeholder="Ex: 24 (garrafas / pacotes / caixas)"
                                value={form.estoque_inicial}
                                onChange={e => setForm({ ...form, estoque_inicial: e.target.value })}
                                className="w-full p-3.5 bg-white border border-emerald-300 rounded-xl font-black text-slate-800 outline-none focus:border-emerald-500"
                             />
                             <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xs">unidades</span>
                          </div>
                          {Number(form.tamanho_embalagem) > 1 && Number(form.estoque_inicial) > 0 && (
                             <p className="text-[11px] font-bold text-emerald-700 mt-1">
                                ✓ {form.estoque_inicial} unidades × {form.tamanho_embalagem} {form.unidade_medida} = <b>{(Number(form.estoque_inicial) * Number(form.tamanho_embalagem)).toLocaleString('pt-BR')} {form.unidade_medida}</b> serão adicionados ao estoque.
                             </p>
                          )}
                       </div>
                    </div>
                  )}

                  {/* ESTOQUE MÍNIMO E MÁXIMO (ALERTAS) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                     <p className="text-xs font-black uppercase tracking-widest text-slate-700">⚙️ Alertas de Reposição (Estoque Mínimo / Máximo)</p>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block mb-1">Mínimo (em unidades)</label>
                           <input
                              type="number" step="1" min="0" placeholder="Ex: 5 un."
                              value={form.estoque_minimo}
                              onChange={e => setForm({ ...form, estoque_minimo: e.target.value })}
                              className="w-full p-3 bg-white border border-amber-200 rounded-xl font-bold text-amber-900 outline-none focus:border-amber-500"
                           />
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-sky-700 uppercase tracking-widest block mb-1">Máximo (em unidades)</label>
                           <input
                              type="number" step="1" min="0" placeholder="Ex: 50 un."
                              value={form.estoque_maximo}
                              onChange={e => setForm({ ...form, estoque_maximo: e.target.value })}
                              className="w-full p-3 bg-white border border-sky-200 rounded-xl font-bold text-sky-900 outline-none focus:border-sky-500"
                           />
                        </div>
                     </div>
                  </div>

                  <p className="text-[11px] font-medium text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-4">
                     Dica: informe o volume, a unidade e o valor pago. Ex.: Heineken 600 ml por R$ 8,50 → Vol "600", Unidade "ML", Valor "8,50". Se informar 24 unidades no estoque inicial, o produto já entra disponível no estoque do bar/cozinha automaticamente.
                  </p>
               </div>

               <button onClick={handleSalvar} className="w-full mt-6 shrink-0 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                  <Save size={20}/> Salvar Ingrediente
               </button>
            </div>
         </div>
      )}

      {/* IMPORTAÇÃO EM MASSA VIA IA */}
      {modalIA && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] w-full max-w-3xl my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center p-4 sm:p-8 pb-4 sm:pb-6 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Sparkles size={22}/></div>
                     <div>
                        <h2 className="font-black text-2xl text-slate-800">Importar Ingredientes com IA</h2>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">Cole uma lista ou envie foto de nota fiscal / lista de compras</p>
                     </div>
                  </div>
                  <button onClick={() => setModalIA(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar space-y-5">
                  {!iaItens ? (
                     <>
                        {!deptUrl && (
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Departamento destes ingredientes</label>
                              <select value={iaDept} onChange={e=>setIaDept(e.target.value)} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                                 <option value="cozinha">Cozinha</option>
                                 <option value="bar">Bar</option>
                              </select>
                           </div>
                        )}

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Colar lista (opcional se enviar foto)</label>
                           <textarea
                              placeholder={"Ex:\nTomate Carmem 2kg R$ 15,80\nFilé de Frango Sadia 3kg R$ 42,00\nVodka Smirnoff 1L R$ 60,00"}
                              value={iaTexto}
                              onChange={e => setIaTexto(e.target.value)}
                              className="w-full h-32 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ou enviar foto (nota fiscal, lista, etiqueta)</label>
                           <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSelecionarImagem} className="hidden" />
                           {iaImagem ? (
                              <div className="mt-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                 <img src={iaImagem.previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                                 <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-700 truncate">{iaImagem.nomeArquivo}</p>
                                    <button onClick={() => setIaImagem(null)} className="text-xs font-bold text-red-500 hover:text-red-600 mt-1">Remover foto</button>
                                 </div>
                              </div>
                           ) : (
                              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full mt-1 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors">
                                 <Camera size={24} />
                                 <span className="font-bold text-sm">Tirar foto ou escolher da galeria</span>
                              </button>
                           )}
                        </div>

                        <button
                           onClick={gerarInsumosIA}
                           disabled={iaLoading}
                           className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                           {iaLoading ? <><Loader2 size={18} className="animate-spin"/> Lendo ingredientes...</> : <><Sparkles size={18}/> Extrair ingredientes</>}
                        </button>
                     </>
                  ) : (
                     <>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Confira antes de salvar ({iaItens.filter(i=>i.incluir).length} de {iaItens.length} selecionados)</p>
                        <div className="space-y-2">
                           {iaItens.map((it, idx) => (
                              <div key={idx} className={`p-3 rounded-xl border flex flex-wrap items-center gap-2 ${it.incluir ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                 <input type="checkbox" checked={it.incluir} onChange={e=>atualizarItemIA(idx, "incluir", e.target.checked)} className="w-5 h-5 accent-emerald-600" />
                                 <input type="text" value={it.nome} onChange={e=>atualizarItemIA(idx, "nome", e.target.value)} placeholder="Nome" className="flex-1 min-w-[140px] p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-emerald-500" />
                                 <input type="text" value={it.marca} onChange={e=>atualizarItemIA(idx, "marca", e.target.value)} placeholder="Marca" className="w-28 p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500" />
                                 <select value={it.unidade_medida} onChange={e=>atualizarItemIA(idx, "unidade_medida", e.target.value)} className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-emerald-500">
                                    <option value="kg">KG</option>
                                    <option value="l">L</option>
                                    <option value="un">UN</option>
                                    <option value="g">G</option>
                                    <option value="ml">ML</option>
                                 </select>
                                 <input type="number" step="0.01" value={it.custo_unitario} onChange={e=>atualizarItemIA(idx, "custo_unitario", e.target.value)} placeholder="Custo/base" className="w-28 p-2 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-600 text-sm outline-none focus:border-emerald-500" />
                              </div>
                           ))}
                        </div>
                        <button onClick={() => setIaItens(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">← Voltar e enviar outra lista/foto</button>
                     </>
                  )}
               </div>

               {iaItens && (
                  <div className="p-4 sm:p-8 sm:pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0">
                     <button onClick={salvarItensIA} disabled={iaSalvando} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                        {iaSalvando ? <><Loader2 size={20} className="animate-spin"/> Salvando...</> : <><Save size={20}/> Salvar {iaItens.filter(i=>i.incluir).length} Ingrediente(s)</>}
                     </button>
                  </div>
               )}
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando módulo...</div>}>
       <IngredientesRunner />
    </Suspense>
  );
}
