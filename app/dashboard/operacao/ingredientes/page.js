"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  FileText,
  History,
  Package,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchFornecedores } from "../../../lib/fornecedores";
import { fetchHistoricoPrecos, fetchInsumos, removerInsumo, salvarInsumo } from "../../../lib/operacao";
import { fetchPrecosDoInsumo, salvarPrecoFornecedor } from "../../../lib/insumo-fornecedores";
import { CATEGORIAS_INSUMO, adivinharCategoria, categoriaDoProdutoBar, obterTodasCategoriasInsumo, salvarNovaCategoriaCustom } from "../../../lib/categorias-insumo";
import { comprimirFotoParaIA } from "../../../lib/imagem";
import {
  UNIDADES_INGREDIENTE,
  calcularCustoSolicitado,
  calcularPrecoNormalizado,
  normalizarBusca,
  ordenarIngredientes,
  parseNumeroBR,
  precoNormalizadoDoInsumo,
  textoPesquisavel,
  unidadeNormalizada,
} from "../../../lib/ingredientes-utils.mjs";
import { fmtBRL } from "../../../components/ui";

const PAGE_SIZE = 10;

const ORDENACOES = [
  { value: "nome-asc", label: "Nome A–Z" },
  { value: "nome-desc", label: "Nome Z–A" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "recentes", label: "Atualizado recentemente" },
];

const unidadeLabel = unidade => UNIDADES_INGREDIENTE.find(item => item.value === unidade)?.label || unidade;

function novoFormulario(departamento = "cozinha") {
  return {
    id: null,
    departamento,
    nome: "",
    nome_interno: "",
    marca: "",
    categoria: "",
    codigo_interno: "",
    tamanho_embalagem: "1",
    unidade_medida: "kg",
    valor_embalagem: "",
    fornecedor_atual_id: "",
    fornecedor_ids: [],
    densidade_g_ml: "",
    peso_bruto_g: "",
    perda_g: "",
    empanado: false,
    ganho_pct: "",
    custo_empanado_kg: "",
  };
}

function fmtQuantidade(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function fmtDataHoraBR(iso) {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "—";
  return `${data.toLocaleDateString("pt-BR")} às ${data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function nomeFornecedorAtual(insumo) {
  const atual = (insumo.fornecedores_vinculados || []).find(
    fornecedor => fornecedor.id === insumo.fornecedor_atual_id,
  );
  return atual?.nome || insumo.fornecedor || insumo.fornecedores_vinculados?.[0]?.nome || "Não informado";
}

function CalculadoraRapida({ insumo, estado, onChange }) {
  const unidadeInicial = insumo.unidade_medida || "kg";
  const quantidade = estado?.quantidade ?? "";
  const unidade = estado?.unidade || unidadeInicial;
  const resultado = calcularCustoSolicitado(insumo, quantidade, unidade);

  return (
    <div className="min-w-[156px]">
      <div className="flex h-8 overflow-hidden rounded-md border border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
        <input
          aria-label={`Quantidade de ${insumo.nome}`}
          inputMode="decimal"
          value={quantidade}
          placeholder="0"
          onChange={event => {
            const valor = event.target.value;
            if (valor.startsWith("-")) return;
            onChange({ quantidade: valor, unidade });
          }}
          className="w-[68px] min-w-0 px-2 text-xs font-bold text-slate-700 outline-none"
        />
        <select
          aria-label={`Unidade para ${insumo.nome}`}
          value={unidade}
          onChange={event => onChange({ quantidade, unidade: event.target.value })}
          className="min-w-[54px] flex-1 border-l border-slate-200 bg-slate-50 px-1 text-[11px] font-bold text-slate-600 outline-none"
        >
          {UNIDADES_INGREDIENTE.map(item => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
        {quantidade !== "" && (
          <button
            type="button"
            aria-label="Limpar cálculo"
            title="Limpar cálculo"
            onClick={() => onChange({ quantidade: "", unidade })}
            className="border-l border-slate-200 px-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {resultado.erro ? (
        <p className="mt-1 max-w-[190px] text-[10px] font-semibold leading-tight text-amber-700">{resultado.erro}</p>
      ) : (
        <p className="mt-0.5 text-[11px] font-bold text-slate-500">
          {resultado.valor === null ? "Informe uma quantidade" : `= ${fmtBRL(resultado.valor)}`}
        </p>
      )}
    </div>
  );
}

function VariacaoPreco({ insumo }) {
  const variacao = Number(insumo.variacao_preco_pct);
  if (!Number.isFinite(variacao)) {
    return (
      <div className="min-w-[98px] text-xs">
        <p className="font-bold text-slate-500">Primeiro valor</p>
        <p className="mt-1 text-[10px] text-slate-400">Sem comparação</p>
      </div>
    );
  }
  const subiu = variacao > 0;
  const caiu = variacao < 0;
  return (
    <div className="min-w-[98px] text-xs">
      <p className={`flex items-center gap-1 font-black ${subiu ? "text-red-600" : caiu ? "text-emerald-600" : "text-slate-500"}`}>
        {subiu ? <ArrowUp size={12} /> : caiu ? <ArrowDown size={12} /> : null}
        {variacao > 0 ? "+" : ""}{variacao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
      </p>
      <p className="mt-1 text-[10px] text-slate-400">Preço normalizado</p>
    </div>
  );
}

function IngredientesRunner() {
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept");
  const { abrirMenu, unidadeAtiva } = useERP();
  const ehBar = deptUrl === "bar";
  const rotuloItem = ehBar ? "produto" : "ingrediente";
  const rotuloItens = ehBar ? "produtos" : "ingredientes";

  const [insumos, setInsumos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [ordenacao, setOrdenacao] = useState("nome-asc");
  const [pagina, setPagina] = useState(1);
  const [calculos, setCalculos] = useState({});
  const [form, setForm] = useState(() => novoFormulario(deptUrl || "cozinha"));
  const [modalCadastro, setModalCadastro] = useState(false);
  const [modalHistorico, setModalHistorico] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [precosForn, setPrecosForn] = useState([]);   // preço por fornecedor do insumo em edição
  const [precoFornMsg, setPrecoFornMsg] = useState(""); // aviso quando a migração não rodou
  const [toast, setToast] = useState(null);

  // Estados da migração por print/imagem ou texto
  const [modalMigrar, setModalMigrar] = useState(false);
  const [migrarTexto, setMigrarTexto] = useState("");
  const [migrarArquivo, setMigrarArquivo] = useState(null);
  const [migrarProcessando, setMigrarProcessando] = useState(false);
  const [migrarSalvando, setMigrarSalvando] = useState(false);
  const [itensMigracao, setItensMigracao] = useState([]);

  const mostrarToast = (mensagem, tipo = "ok") => {
    setToast({ mensagem, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const carregar = async () => {
    if (!unidadeAtiva) return;
    setLoading(true);
    const [resInsumos, resFornecedores] = await Promise.all([
      fetchInsumos(unidadeAtiva, deptUrl),
      fetchFornecedores(unidadeAtiva),
    ]);
    setInsumos((resInsumos.data || []).map(item => (
      ehBar ? { ...item, categoria: categoriaDoProdutoBar(item) } : item
    )));
    setFornecedores(resFornecedores.data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, [unidadeAtiva, deptUrl]);

  const categorias = useMemo(() => {
    if (deptUrl) {
      return [...new Set([
        ...obterTodasCategoriasInsumo(deptUrl),
        ...insumos.map(item => item.categoria).filter(Boolean)
      ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    }
    return [...new Set([
      ...obterTodasCategoriasInsumo("cozinha"),
      ...obterTodasCategoriasInsumo("bar"),
      ...insumos.map(item => item.categoria).filter(Boolean),
    ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [deptUrl, insumos]);

  const processarMigracaoIA = async () => {
    if (!migrarArquivo && !migrarTexto.trim()) return alert("Selecione uma imagem/print ou digite um texto.");
    setMigrarProcessando(true);
    try {
      let imagemBase64 = null;
      let mediaType = "image/jpeg";
      if (migrarArquivo) {
        imagemBase64 = await comprimirFotoParaIA(migrarArquivo, 1800, 0.85);
        mediaType = migrarArquivo.type || "image/jpeg";
      }

      const res = await fetch("/api/ia-insumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: migrarTexto,
          imagem_base64: imagemBase64,
          imagem_media_type: mediaType,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Não foi possível extrair a lista.");
        setMigrarProcessando(false);
        return;
      }

      setItensMigracao(data.itens || []);
    } catch (e) {
      alert("Erro ao processar: " + (e.message || "Tente novamente."));
    } finally {
      setMigrarProcessando(false);
    }
  };

  const atualizarItemMigracao = (idx, campo, valor) => {
    setItensMigracao(prev => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [campo]: valor };
      return copia;
    });
  };

  const removerItemMigracao = idx => {
    setItensMigracao(prev => prev.filter((_, i) => i !== idx));
  };

  const confirmarSalvarMigracao = async () => {
    if (!itensMigracao.length) return;
    setMigrarSalvando(true);
    let salvos = 0;

    for (const item of itensMigracao) {
      const nome = String(item.nome || "").trim();
      if (!nome) continue;
      const dept = item.departamento || deptUrl || "cozinha";
      const qtd = parseNumeroBR(item.quantidade) || 1;
      const valor = parseNumeroBR(item.valor_total) || 0;
      const unidade = item.unidade || "kg";
      const marca = item.marca || null;
      const categoria = item.categoria || adivinharCategoria(nome, dept, marca) || "Outros";

      const existente = insumos.find(i => 
        (i.departamento || "cozinha") === dept && 
        i.nome.toLowerCase().trim() === nome.toLowerCase().trim()
      );

      let valorFinal = valor;
      let qtdFinal = qtd;
      let targetId = null;

      if (existente) {
        targetId = existente.id;
        const valorExistente = Number(existente.custo_compra || existente.custo_unitario) || 0;
        if (valorExistente > valor) {
          valorFinal = valorExistente;
          qtdFinal = Number(existente.tamanho_embalagem) || qtd;
        }
      }

      const precoNorm = calcularPrecoNormalizado(qtdFinal, unidade, valorFinal);

      await salvarInsumo({
        id: targetId,
        unidade_id: unidadeAtiva,
        departamento: dept,
        nome,
        marca: marca || existente?.marca || null,
        categoria,
        tamanho_embalagem: qtdFinal,
        unidade_medida: unidade,
        custo_compra: valorFinal,
        custo_unitario: valorFinal / qtdFinal,
        preco_normalizado: precoNorm,
      }, { origem: "Migração por Print / Lista" });

      if (categoria) {
        salvarNovaCategoriaCustom(categoria, dept);
      }
      salvos++;
    }

    setMigrarSalvando(false);
    setModalMigrar(false);
    await carregar();
    mostrarToast(`${salvos} ingrediente(s) migrado(s) com sucesso! Duplicados mantidos pelo maior valor.`);
  };

  const filtrados = useMemo(() => {
    const termo = normalizarBusca(busca);
    const lista = insumos.filter(insumo => {
      const correspondeBusca = !termo || textoPesquisavel(insumo).includes(termo);
      const correspondeCategoria = categoria === "Todas" || (insumo.categoria || "Outros") === categoria;
      return correspondeBusca && correspondeCategoria;
    });
    return ordenarIngredientes(lista, ordenacao);
  }, [insumos, busca, categoria, ordenacao]);

  useEffect(() => {
    setPagina(1);
  }, [busca, categoria, ordenacao, deptUrl, insumos.length]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  const estatisticas = useMemo(() => {
    const limiteRecente = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return {
      total: insumos.length,
      semMarca: insumos.filter(item => !item.marca).length,
      semFornecedor: insumos.filter(item => !item.fornecedor && !item.fornecedores_vinculados?.length).length,
      recentes: insumos.filter(item => new Date(item.preco_atualizado_em || 0).getTime() >= limiteRecente).length,
    };
  }, [insumos]);

  const abrirNovo = () => {
    setForm(novoFormulario(deptUrl || "cozinha"));
    setPrecosForn([]); setPrecoFornMsg("");
    setModalCadastro(true);
  };

  const abrirEditar = insumo => {
    setForm({
      id: insumo.id,
      departamento: insumo.departamento || deptUrl || "cozinha",
      nome: insumo.nome || "",
      nome_interno: insumo.nome_interno || "",
      marca: insumo.marca || "",
      categoria: insumo.categoria || "",
      codigo_interno: insumo.codigo_interno || "",
      tamanho_embalagem: String(insumo.tamanho_embalagem || 1),
      unidade_medida: insumo.unidade_medida || "kg",
      valor_embalagem: String(Number(insumo.custo_compra) > 0 ? insumo.custo_compra : (insumo.custo_unitario || "")),
      fornecedor_atual_id: insumo.fornecedor_atual_id || "",
      fornecedor_ids: (insumo.fornecedores_vinculados || []).map(item => item.id).filter(Boolean),
      densidade_g_ml: insumo.densidade_g_ml ? String(insumo.densidade_g_ml) : "",
      peso_bruto_g: insumo.peso_bruto_padrao != null ? String(insumo.peso_bruto_padrao) : "",
      perda_g: insumo.perda_g != null ? String(insumo.perda_g) : "",
      empanado: !!insumo.empanado,
      ganho_pct: insumo.ganho_pct != null ? String(insumo.ganho_pct) : "",
      custo_empanado_kg: insumo.custo_empanado_kg != null ? String(insumo.custo_empanado_kg) : "",
    });
    setPrecosForn([]); setPrecoFornMsg("");
    fetchPrecosDoInsumo(insumo.id).then(r => {
      if (r.error === "sem_migracao") { setPrecoFornMsg("Rode db/migracao_insumo_fornecedor_precos.sql no Supabase para ativar preço por fornecedor."); return; }
      setPrecosForn((r.data || []).map(x => ({
        id: x.id, fornecedor_id: x.fornecedor_id,
        preco: x.preco != null ? String(x.preco) : "",
        tamanho: x.tamanho_embalagem != null ? String(x.tamanho_embalagem) : String(insumo.tamanho_embalagem || 1),
        unidade: x.unidade_embalagem || insumo.unidade_medida || "kg",
      })));
    });
    setModalCadastro(true);
  };

  const precoDe = fid => precosForn.find(p => p.fornecedor_id === fid);
  const setPrecoDe = (fid, patch) => setPrecosForn(prev => {
    const i = prev.findIndex(p => p.fornecedor_id === fid);
    if (i === -1) return [...prev, { fornecedor_id: fid, preco: "", tamanho: form.tamanho_embalagem, unidade: form.unidade_medida, ...patch }];
    const c = [...prev]; c[i] = { ...c[i], ...patch }; return c;
  });
  const usarPrecoFornecedor = fid => {
    const p = precoDe(fid);
    setForm(a => ({
      ...a,
      fornecedor_atual_id: fid,
      fornecedor_ids: [...new Set([...a.fornecedor_ids, fid])],
      valor_embalagem: p?.preco ? String(p.preco) : a.valor_embalagem,
      tamanho_embalagem: p?.tamanho ? String(p.tamanho) : a.tamanho_embalagem,
      unidade_medida: p?.unidade || a.unidade_medida,
    }));
  };

  const selecionarFornecedorAtual = fornecedorId => {
    setForm(atual => ({
      ...atual,
      fornecedor_atual_id: fornecedorId,
      fornecedor_ids: fornecedorId
        ? [...new Set([...atual.fornecedor_ids, fornecedorId])]
        : atual.fornecedor_ids,
    }));
  };

  const alternarFornecedor = fornecedorId => {
    setForm(atual => {
      const marcado = atual.fornecedor_ids.includes(fornecedorId);
      if (marcado && atual.fornecedor_atual_id === fornecedorId) return atual;
      return {
        ...atual,
        fornecedor_ids: marcado
          ? atual.fornecedor_ids.filter(id => id !== fornecedorId)
          : [...atual.fornecedor_ids, fornecedorId],
      };
    });
  };

  const handleSalvar = async () => {
    const nome = form.nome.trim();
    const quantidade = parseNumeroBR(form.tamanho_embalagem);
    const valor = parseNumeroBR(form.valor_embalagem);
    const densidade = form.densidade_g_ml ? parseNumeroBR(form.densidade_g_ml) : null;
    if (!nome) return alert(`Informe o nome original/oficial do ${rotuloItem}.`);
    if (!Number.isFinite(quantidade) || quantidade <= 0) return alert("A quantidade da embalagem deve ser maior que zero.");
    if (!Number.isFinite(valor) || valor <= 0) return alert("O valor da embalagem deve ser maior que zero.");
    if (densidade !== null && (!Number.isFinite(densidade) || densidade <= 0)) {
      return alert("A densidade precisa ser maior que zero.");
    }

    const fornecedorAtual = fornecedores.find(item => item.id === form.fornecedor_atual_id);
    const precoNormalizado = calcularPrecoNormalizado(quantidade, form.unidade_medida, valor);
    const pesoBruto = form.peso_bruto_g ? parseNumeroBR(form.peso_bruto_g) : null;
    const perdaG = form.perda_g ? parseNumeroBR(form.perda_g) : null;
    const perdaPct = (Number.isFinite(pesoBruto) && pesoBruto > 0 && Number.isFinite(perdaG)) ? (perdaG / pesoBruto) * 100 : null;
    setSalvando(true);
    const resultado = await salvarInsumo({
      id: form.id,
      unidade_id: unidadeAtiva,
      departamento: form.departamento,
      nome,
      nome_interno: form.nome_interno.trim() || null,
      marca: form.marca.trim() || null,
      categoria: form.categoria || adivinharCategoria(nome, form.departamento, form.marca) || "Outros",
      codigo_interno: form.codigo_interno.trim() || null,
      tamanho_embalagem: quantidade,
      unidade_medida: form.unidade_medida,
      custo_compra: valor,
      custo_unitario: valor / quantidade,
      preco_normalizado: precoNormalizado,
      fornecedor_atual_id: form.fornecedor_atual_id || null,
      fornecedor: fornecedorAtual?.nome || null,
      fornecedor_ids: form.fornecedor_ids,
      densidade_g_ml: densidade,
      peso_bruto_padrao: Number.isFinite(pesoBruto) ? pesoBruto : null,
      perda_g: Number.isFinite(perdaG) ? perdaG : null,
      perda_pct: perdaPct != null ? Number(perdaPct.toFixed(3)) : null,
      empanado: !!form.empanado,
      ganho_pct: form.empanado && form.ganho_pct ? parseNumeroBR(form.ganho_pct) : null,
      custo_empanado_kg: form.empanado && form.custo_empanado_kg ? parseNumeroBR(form.custo_empanado_kg) : null,
    }, { origem: form.id ? "Edição manual do ingrediente" : "Cadastro manual do ingrediente" });
    setSalvando(false);

    if (resultado.error) return alert(`Erro ao salvar ingrediente: ${resultado.error}`);

    // Preço por fornecedor: grava o do fornecedor ativo (= valor principal) e os
    // demais informados. Silencioso se a migração ainda não rodou.
    const insumoId = form.id || resultado.id;
    if (insumoId) {
      const vistos = new Set();
      const jobs = [];
      if (form.fornecedor_atual_id) {
        vistos.add(form.fornecedor_atual_id);
        jobs.push(salvarPrecoFornecedor({ unidadeId: unidadeAtiva, insumoId, insumoNome: nome, fornecedorId: form.fornecedor_atual_id, fornecedorNome: fornecedorAtual?.nome, preco: valor, tamanho: quantidade, unidade: form.unidade_medida }));
      }
      for (const p of precosForn) {
        if (vistos.has(p.fornecedor_id)) continue;
        const pv = parseNumeroBR(p.preco);
        if (!Number.isFinite(pv) || pv <= 0) continue;
        const forn = fornecedores.find(f => f.id === p.fornecedor_id);
        jobs.push(salvarPrecoFornecedor({ unidadeId: unidadeAtiva, insumoId, insumoNome: nome, fornecedorId: p.fornecedor_id, fornecedorNome: forn?.nome, preco: pv, tamanho: parseNumeroBR(p.tamanho) || quantidade, unidade: p.unidade || form.unidade_medida }));
      }
      if (jobs.length) await Promise.all(jobs).catch(() => {});
    }

    setModalCadastro(false);
    await carregar();
    mostrarToast(form.id ? `${ehBar ? "Produto" : "Ingrediente"} atualizado.` : `${ehBar ? "Produto" : "Ingrediente"} cadastrado.`);
  };

  const handleRemover = async insumo => {
    if (!confirm(`Deseja remover o ${rotuloItem} "${insumo.nome}" do catálogo?`)) return;
    const { error } = await removerInsumo(insumo.id);
    if (error) {
      mostrarToast(`Não foi possível remover. Verifique se o ${rotuloItem} está sendo usado em uma ficha técnica.`, "erro");
      return;
    }
    await carregar();
    mostrarToast(`${ehBar ? "Produto" : "Ingrediente"} removido.`);
  };

  const abrirHistorico = async insumo => {
    setModalHistorico(insumo);
    setHistorico([]);
    setHistoricoLoading(true);
    const resposta = await fetchHistoricoPrecos(unidadeAtiva, insumo.id);
    let linhas = resposta.data || [];
    if (insumo.fornecedor_id) linhas = linhas.filter(r => r.fornecedor_id === insumo.fornecedor_id);
    setHistorico(linhas);
    setHistoricoLoading(false);
  };

  if (!unidadeAtiva) {
    return <div className="min-h-screen bg-slate-50 p-12 text-center font-bold text-slate-500">Selecione uma unidade para consultar os ingredientes.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-4 sm:px-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={abrirMenu}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900"
              title="Voltar ao menu"
            >
              <ArrowLeft size={19} />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">{ehBar ? "Produtos cadastrados" : "Ingredientes cadastrados"}</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">{ehBar ? "Catálogo de produtos do Bar e histórico de preços" : "Catálogo de ingredientes e histórico de preços"}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm sm:w-[500px]">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                value={busca}
                onChange={event => setBusca(event.target.value)}
                placeholder={`Buscar ${rotuloItem} por nome, apelido, marca, fornecedor, código ou categoria...`}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
              />
              {busca && (
                <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-700" title="Limpar busca">
                  <X size={16} />
                </button>
              )}
            </label>
            <button
              onClick={() => { setModalMigrar(true); setItensMigracao([]); setMigrarTexto(""); setMigrarArquivo(null); }}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              <Camera size={18} /> Migrar por Print / Lista
            </button>
            <button
              onClick={abrirNovo}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700"
            >
              <Plus size={18} /> Novo {rotuloItem}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 py-4 sm:px-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: Package, label: `Total de ${rotuloItens}`, value: estatisticas.total, note: "No catálogo", color: "emerald" },
            { icon: Tag, label: "Sem marca", value: estatisticas.semMarca, note: "Cadastro incompleto", color: "amber" },
            { icon: Users, label: "Sem fornecedor", value: estatisticas.semFornecedor, note: "Nenhum vínculo", color: "violet" },
            { icon: Clock3, label: "Preço atualizado", value: estatisticas.recentes, note: "Últimos 30 dias", color: "blue" },
          ].map(card => {
            const cores = {
              emerald: "bg-emerald-50 text-emerald-600",
              amber: "bg-amber-50 text-amber-600",
              violet: "bg-violet-50 text-violet-600",
              blue: "bg-blue-50 text-blue-600",
            };
            return (
              <div key={card.label} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cores[card.color]}`}>
                  <card.icon size={18} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-500">{card.label}</p>
                  <p className="text-lg font-black leading-tight text-slate-900">{card.value}</p>
                  <p className="hidden text-[11px] text-slate-400 sm:block">{card.note}</p>
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            {["Todas", ...categorias].map(item => (
              <button
                key={item}
                onClick={() => setCategoria(item)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                  categoria === item ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <select
            value={ordenacao}
            onChange={event => setOrdenacao(event.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-emerald-500"
            aria-label={`Ordenação dos ${rotuloItens}`}
          >
            {ORDENACOES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </section>

        <section className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
          <table className="w-full min-w-[1050px] table-fixed text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <th className="w-[190px] px-4 py-3">{ehBar ? "Produto" : "Ingrediente"}</th>
                <th className="w-[85px] px-2.5 py-3">Marca</th>
                <th className="w-[80px] px-2.5 py-3">Embalagem</th>
                <th className="w-[125px] px-2.5 py-3">Fornecedor</th>
                <th className="w-[110px] px-2.5 py-3">Valor atual</th>
                <th className="w-[170px] px-2.5 py-3">Calcular quantidade</th>
                <th className="w-[95px] px-2.5 py-3">Variação</th>
                <th className="w-[95px] px-2.5 py-3">Histórico</th>
                <th className="sticky right-0 z-[6] w-[85px] bg-slate-50 px-2.5 py-3 text-right shadow-[-8px_0_14px_-12px_rgba(15,23,42,0.45)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center text-sm font-bold text-slate-400">Carregando {rotuloItens}...</td></tr>
              ) : paginados.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-sm font-bold text-slate-400">Nenhum {rotuloItem} encontrado.</td></tr>
              ) : paginados.map(insumo => {
                const vinculados = insumo.fornecedores_vinculados || [];
                const outros = Math.max(0, vinculados.length - 1);
                const normalizado = precoNormalizadoDoInsumo(insumo);
                return (
                  <tr key={insumo.id} className="align-middle transition hover:bg-emerald-50/30">
                    <td className="px-4 py-2">
                      <p className="truncate text-sm font-black text-slate-900">{insumo.nome}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {insumo.codigo_interno || "Sem código"}
                        {insumo.nome_interno ? ` · ${insumo.nome_interno}` : ""}
                        {insumo.categoria ? ` · ${insumo.categoria}` : ""}
                      </p>
                    </td>
                    <td className="px-2.5 py-2 text-xs font-bold text-slate-600">{insumo.marca || "Sem marca"}</td>
                    <td className="px-2.5 py-2 text-xs font-bold text-slate-700">
                      {fmtQuantidade(insumo.tamanho_embalagem || 1)} {unidadeLabel(insumo.unidade_medida)}
                    </td>
                    <td className="px-2.5 py-2">
                      <p className="truncate text-xs font-bold text-slate-700">{nomeFornecedorAtual(insumo)}</p>
                      {outros > 0 && <p className="mt-1 text-[11px] font-bold text-emerald-600">+{outros} fornecedor{outros > 1 ? "es" : ""}</p>}
                    </td>
                    <td className="px-2.5 py-2">
                      <p className="text-sm font-black text-slate-900">{fmtBRL(insumo.custo_compra ?? 0)}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {fmtBRL(normalizado)}/{unidadeNormalizada(insumo.unidade_medida)}
                      </p>
                    </td>
                    <td className="px-2.5 py-2">
                      <CalculadoraRapida
                        insumo={insumo}
                        estado={calculos[insumo.id]}
                        onChange={estado => setCalculos(atual => ({ ...atual, [insumo.id]: estado }))}
                      />
                    </td>
                    <td className="px-2.5 py-2"><VariacaoPreco insumo={insumo} /></td>
                    <td className="px-2.5 py-2">
                      <button
                        onClick={() => abrirHistorico(insumo)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        Ver histórico
                      </button>
                    </td>
                    <td className="sticky right-0 z-[3] bg-white px-2.5 py-2 shadow-[-8px_0_14px_-12px_rgba(15,23,42,0.45)]">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => abrirEditar(insumo)} title="Editar" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600">
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => handleRemover(insumo)} title="Remover" className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="mt-3 space-y-2 lg:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400">Carregando {rotuloItens}...</div>
          ) : paginados.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-400">Nenhum {rotuloItem} encontrado.</div>
          ) : paginados.map(insumo => {
            const vinculados = insumo.fornecedores_vinculados || [];
            const normalizado = precoNormalizadoDoInsumo(insumo);
            return (
              <article key={insumo.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-black text-slate-900">{insumo.nome}</h2>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {insumo.nome_interno || insumo.codigo_interno || insumo.categoria || (ehBar ? "Produto" : "Ingrediente")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-black text-slate-600">{insumo.marca || "Sem marca"}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Embalagem</p>
                    <p className="mt-1 font-bold">{fmtQuantidade(insumo.tamanho_embalagem || 1)} {unidadeLabel(insumo.unidade_medida)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Fornecedor</p>
                    <p className="mt-1 truncate font-bold">{nomeFornecedorAtual(insumo)}</p>
                    {vinculados.length > 1 && <p className="text-[10px] font-bold text-emerald-600">+{vinculados.length - 1} outro(s)</p>}
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Valor atual</p>
                    <p className="mt-1 font-black">{fmtBRL(insumo.custo_compra ?? 0)}</p>
                    <p className="text-xs text-slate-500">{fmtBRL(normalizado)}/{unidadeNormalizada(insumo.unidade_medida)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Variação</p>
                    <div className="mt-1"><VariacaoPreco insumo={insumo} /></div>
                  </div>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-400">Calcular quantidade</p>
                  <CalculadoraRapida
                    insumo={insumo}
                    estado={calculos[insumo.id]}
                    onChange={estado => setCalculos(atual => ({ ...atual, [insumo.id]: estado }))}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => abrirHistorico(insumo)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold text-slate-600">Ver histórico</button>
                  <button onClick={() => abrirEditar(insumo)} className="rounded-lg border border-slate-200 p-2.5 text-slate-500"><Edit3 size={16} /></button>
                  <button onClick={() => handleRemover(insumo)} className="rounded-lg border border-slate-200 p-2.5 text-slate-500"><Trash2 size={16} /></button>
                </div>
              </article>
            );
          })}
        </section>

        {!loading && filtrados.length > 0 && (
          <footer className="mt-4 flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row">
            <p className="text-xs font-medium text-slate-500">
              Mostrando {(paginaAtual - 1) * PAGE_SIZE + 1} a {Math.min(paginaAtual * PAGE_SIZE, filtrados.length)} de {filtrados.length} {rotuloItens}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina(valor => Math.max(1, valor - 1))}
                disabled={paginaAtual === 1}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-30"
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 text-xs font-black text-slate-600">{paginaAtual} / {totalPaginas}</span>
              <button
                onClick={() => setPagina(valor => Math.min(totalPaginas, valor + 1))}
                disabled={paginaAtual === totalPaginas}
                className="rounded-lg border border-slate-200 p-2 text-slate-500 disabled:opacity-30"
                aria-label="Próxima página"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        )}
      </main>

      {modalCadastro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
              <div>
                <h2 className="text-xl font-black text-slate-900">{form.id ? `Editar ${rotuloItem}` : `Novo ${rotuloItem}`}</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">Cadastre a identificação, a embalagem e o preço atual.</p>
              </div>
              <button onClick={() => setModalCadastro(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
              <section>
                <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Identificação</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="text-xs font-bold text-slate-600">Nome original/oficial do {rotuloItem} *</span>
                    <input
                      value={form.nome}
                      onChange={event => {
                        const nome = event.target.value;
                        setForm(atual => ({
                          ...atual,
                          nome,
                          categoria: atual.categoria || adivinharCategoria(nome, atual.departamento, atual.marca) || "",
                        }));
                      }}
                      placeholder="Ex.: Açafrão-da-terra"
                      maxLength={100}
                      className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-bold outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-bold text-slate-600">Marca</span>
                    <input value={form.marca} onChange={event => setForm({ ...form, marca: event.target.value })} placeholder="Deixe vazio para Sem marca" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-600">Categoria</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nova = prompt("Digite o nome da nova categoria:");
                          if (nova && nova.trim()) {
                            const cat = nova.trim();
                            salvarNovaCategoriaCustom(cat, form.departamento);
                            setForm({ ...form, categoria: cat });
                          }
                        }}
                        className="text-[10px] font-bold text-emerald-600 hover:underline"
                      >
                        + Criar categoria
                      </button>
                    </div>
                    <select value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-bold outline-none focus:border-emerald-500">
                      <option value="">Selecione...</option>
                      {obterTodasCategoriasInsumo(form.departamento).map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-bold text-slate-600">Departamento</span>
                    <select value={form.departamento} onChange={event => setForm({ ...form, departamento: event.target.value, categoria: "" })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-bold outline-none focus:border-emerald-500">
                      <option value="cozinha">Cozinha</option>
                      <option value="bar">Bar</option>
                    </select>
                  </label>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Embalagem e valor</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <label>
                    <span className="text-xs font-bold text-slate-600">Quantidade *</span>
                    <input inputMode="decimal" value={form.tamanho_embalagem} onChange={event => !event.target.value.startsWith("-") && setForm({ ...form, tamanho_embalagem: event.target.value })} placeholder="500" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-bold outline-none focus:border-emerald-500" />
                  </label>
                  <label>
                    <span className="text-xs font-bold text-slate-600">Unidade *</span>
                    <select value={form.unidade_medida} onChange={event => setForm({ ...form, unidade_medida: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold outline-none focus:border-emerald-500">
                      {UNIDADES_INGREDIENTE.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2">
                    <span className="text-xs font-bold text-slate-600">Valor da embalagem *</span>
                    <div className="mt-1.5 flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 focus-within:border-emerald-500">
                      <span className="mr-2 text-sm font-bold text-slate-400">R$</span>
                      <input inputMode="decimal" value={form.valor_embalagem} onChange={event => !event.target.value.startsWith("-") && setForm({ ...form, valor_embalagem: event.target.value })} placeholder="0,00" className="min-w-0 flex-1 bg-transparent font-black text-emerald-700 outline-none" />
                    </div>
                  </label>
                </div>
                {Number.isFinite(parseNumeroBR(form.tamanho_embalagem)) && Number.isFinite(parseNumeroBR(form.valor_embalagem)) && (
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <span className="text-xs font-bold text-emerald-800">Preço normalizado calculado</span>
                    <span className="text-sm font-black text-emerald-700">
                      {fmtBRL(calcularPrecoNormalizado(parseNumeroBR(form.tamanho_embalagem), form.unidade_medida, parseNumeroBR(form.valor_embalagem)))}/{unidadeNormalizada(form.unidade_medida)}
                    </span>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Perda e rendimento</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <label>
                    <span className="text-xs font-bold text-slate-600">Peso bruto (g)</span>
                    <input inputMode="decimal" value={form.peso_bruto_g} onChange={e => !e.target.value.startsWith("-") && setForm({ ...form, peso_bruto_g: e.target.value })} placeholder="Ex.: 1000" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 outline-none focus:border-emerald-500" />
                  </label>
                  <label>
                    <span className="text-xs font-bold text-slate-600">Perda (g)</span>
                    <input inputMode="decimal" value={form.perda_g} onChange={e => !e.target.value.startsWith("-") && setForm({ ...form, perda_g: e.target.value })} placeholder="Ex.: 200" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 outline-none focus:border-emerald-500" />
                  </label>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-600">Perda calculada</span>
                    <div className="mt-1.5 flex h-11 items-center rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 font-black text-emerald-700">
                      {(() => { const b = parseNumeroBR(form.peso_bruto_g), p = parseNumeroBR(form.perda_g); return (Number.isFinite(b) && b > 0 && Number.isFinite(p)) ? ((p / b) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%" : "—"; })()}
                    </div>
                  </div>
                </div>
                <label className="mt-4 flex items-center gap-2">
                  <input type="checkbox" checked={form.empanado} onChange={e => setForm({ ...form, empanado: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
                  <span className="text-xs font-bold text-slate-600">Produto empanado (ganha peso e tem custo do empanamento)</span>
                </label>
                {form.empanado && (
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <label>
                      <span className="text-xs font-bold text-slate-600">Ganho de peso (%)</span>
                      <input inputMode="decimal" value={form.ganho_pct} onChange={e => !e.target.value.startsWith("-") && setForm({ ...form, ganho_pct: e.target.value })} placeholder="Ex.: 30" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 outline-none focus:border-emerald-500" />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-slate-600">Custo do empanado (R$/kg final)</span>
                      <input inputMode="decimal" value={form.custo_empanado_kg} onChange={e => !e.target.value.startsWith("-") && setForm({ ...form, custo_empanado_kg: e.target.value })} placeholder="Ex.: 8,00" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 outline-none focus:border-emerald-500" />
                    </label>
                  </div>
                )}
                <p className="mt-2 text-[11px] font-medium text-slate-400">A perda passa a ser do ingrediente (o FC sai da ficha técnica). Empanado: o produto rende mais peso, com o custo do empanamento somado ao custo final.</p>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-400">Fornecedores</h3>
                <label>
                  <span className="text-xs font-bold text-slate-600">Fornecedor do valor atual</span>
                  <select value={form.fornecedor_atual_id} onChange={event => selecionarFornecedorAtual(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-bold outline-none focus:border-emerald-500">
                    <option value="">Não informado</option>
                    {fornecedores.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                  </select>
                </label>
                {precoFornMsg && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-medium text-amber-800">{precoFornMsg}</p>}
                {form.id && form.fornecedor_ids.length > 0 && !precoFornMsg && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-bold text-slate-600">Preço por fornecedor</p>
                    <div className="space-y-2">
                      {form.fornecedor_ids.map(fid => {
                        const forn = fornecedores.find(f => f.id === fid);
                        if (!forn) return null;
                        const p = precoDe(fid);
                        const atual = form.fornecedor_atual_id === fid;
                        return (
                          <div key={fid} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2.5 ${atual ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                            <span className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-bold text-slate-700">{forn.nome}{atual && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">Em uso</span>}</span>
                            <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-2">
                              <span className="mr-1 text-xs font-bold text-slate-400">R$</span>
                              <input inputMode="decimal" value={p?.preco ?? ""} onChange={e => setPrecoDe(fid, { preco: e.target.value })} placeholder="0,00" className="w-20 bg-transparent text-sm font-black text-emerald-700 outline-none" />
                            </div>
                            {!atual && <button type="button" onClick={() => usarPrecoFornecedor(fid)} className="h-9 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-black text-emerald-700 hover:bg-emerald-50">Usar</button>}
                            <button type="button" onClick={() => abrirHistorico({ id: form.id, nome: form.nome, fornecedor_id: fid })} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Histórico</button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] font-medium text-slate-400">O preço do fornecedor "Em uso" vira o custo do ingrediente nas fichas. Salve para guardar os preços e o histórico.</p>
                  </div>
                )}
                {fornecedores.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-bold text-slate-600">Outros fornecedores vinculados</p>
                    <div className="grid max-h-40 gap-2 overflow-y-auto rounded-xl border border-slate-200 p-3 sm:grid-cols-2">
                      {fornecedores.map(item => (
                        <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={form.fornecedor_ids.includes(item.id)}
                            disabled={form.fornecedor_atual_id === item.id}
                            onChange={() => alternarFornecedor(item.id)}
                            className="h-4 w-4 accent-emerald-600"
                          />
                          <span className="truncate text-xs font-semibold text-slate-600">{item.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-7">
              <button onClick={() => setModalCadastro(false)} className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
              <button disabled={salvando} onClick={handleSalvar} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50">
                {salvando ? "Salvando..." : `Salvar ${rotuloItem}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={() => setModalHistorico(null)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-5 sm:px-7">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black text-slate-900"><History size={20} className="text-emerald-600" /> Histórico de preços</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{modalHistorico.nome}</p>
              </div>
              <button onClick={() => setModalHistorico(null)} className="rounded-full bg-slate-100 p-2 text-slate-500"><X size={18} /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-7">
              {historicoLoading ? (
                <p className="py-12 text-center text-sm font-bold text-slate-400">Carregando histórico...</p>
              ) : historico.length === 0 ? (
                <p className="py-12 text-center text-sm font-bold text-slate-400">Nenhuma alteração de preço registrada.</p>
              ) : historico.map(registro => {
                const normalizadoAnterior = registro.preco_normalizado_anterior ?? registro.custo_anterior;
                const normalizadoNovo = registro.preco_normalizado_novo ?? registro.custo_novo;
                const percentual = registro.diferenca_percentual ?? (
                  Number(normalizadoAnterior) > 0
                    ? ((Number(normalizadoNovo) - Number(normalizadoAnterior)) / Number(normalizadoAnterior)) * 100
                    : null
                );
                const subiu = Number(percentual) > 0;
                return (
                  <article key={registro.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-800">{registro.fornecedor_nome || "Fornecedor não informado"}</p>
                        <p className="mt-1 text-xs text-slate-500">{fmtDataHoraBR(registro.created_at)} · {registro.usuario_nome || "Usuário do sistema"}</p>
                      </div>
                      {percentual !== null && (
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${subiu ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                          {Number(percentual) > 0 ? "+" : ""}{Number(percentual).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                        </span>
                      )}
                    </div>
                    <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Embalagem anterior</p>
                        <p className="mt-1 text-xs font-bold text-slate-600">
                          {registro.embalagem_quantidade_anterior
                            ? `${fmtQuantidade(registro.embalagem_quantidade_anterior)} ${unidadeLabel(registro.embalagem_unidade_anterior)} por ${fmtBRL(registro.valor_anterior)}`
                            : "Cadastro inicial"}
                        </p>
                        {normalizadoAnterior !== null && <p className="mt-1 text-xs text-slate-500">{fmtBRL(normalizadoAnterior)}/{unidadeNormalizada(registro.embalagem_unidade_anterior || modalHistorico.unidade_medida)}</p>}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Nova embalagem</p>
                        <p className="mt-1 text-xs font-bold text-slate-700">
                          {fmtQuantidade(registro.embalagem_quantidade_nova || modalHistorico.tamanho_embalagem)} {unidadeLabel(registro.embalagem_unidade_nova || modalHistorico.unidade_medida)} por {fmtBRL(registro.valor_novo ?? modalHistorico.custo_compra)}
                        </p>
                        <p className="mt-1 text-xs font-bold text-emerald-700">{fmtBRL(normalizadoNovo)}/{unidadeNormalizada(registro.embalagem_unidade_nova || modalHistorico.unidade_medida)}</p>
                      </div>
                    </div>
                    {registro.diferenca_valor !== null && registro.diferenca_valor !== undefined && (
                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        Diferença normalizada: {Number(registro.diferenca_valor) > 0 ? "+" : ""}{fmtBRL(registro.diferenca_valor)}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] font-medium text-slate-400">Origem: {registro.origem || "Cadastro de ingredientes"}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modalMigrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm" onClick={() => setModalMigrar(false)}>
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="flex items-center gap-2.5 text-xl font-black text-slate-900">
                  <Sparkles className="text-emerald-600" size={22} /> Migração Inteligente por Print / Lista
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Envie o print da lista de ingredientes ou cole o texto. O sistema separa Bar e Cozinha e consolida duplicados mantendo o <strong>maior valor</strong>.
                </p>
              </div>
              <button onClick={() => setModalMigrar(false)} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-5 text-center">
                  <div>
                    <Camera size={32} className="mx-auto text-emerald-600 mb-2" />
                    <p className="text-sm font-bold text-slate-700">Print / Foto da Lista</p>
                    <p className="text-xs text-slate-400 mt-1">Selecione uma imagem (PNG, JPG, WEBP) do celular ou computador.</p>
                  </div>
                  <div className="mt-4">
                    <input
                      type="file"
                      accept="image/*"
                      id="file-print-upload"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) setMigrarArquivo(file);
                      }}
                    />
                    <label htmlFor="file-print-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100">
                      <Upload size={15} /> {migrarArquivo ? migrarArquivo.name : "Escolher Imagem / Print"}
                    </label>
                  </div>
                </div>

                <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4">
                  <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                    <span>Texto / Lista Copiada</span>
                    <span className="text-[10px] text-slate-400">Opcional</span>
                  </label>
                  <textarea
                    rows={4}
                    value={migrarTexto}
                    onChange={e => setMigrarTexto(e.target.value)}
                    placeholder="Cole aqui nomes, valores, quantidades de produtos..."
                    className="w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  disabled={migrarProcessando || (!migrarArquivo && !migrarTexto.trim())}
                  onClick={processarMigracaoIA}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {migrarProcessando ? (
                    <>Lendo print e consolidando (maior valor)...</>
                  ) : (
                    <><Sparkles size={18} /> Analisar Print com IA</>
                  )}
                </button>
              </div>

              {itensMigracao.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800">
                      Itens Extraídos ({itensMigracao.length})
                    </h3>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800">
                      Duplicados consolidados pelo maior valor
                    </span>
                  </div>

                  <div className="max-h-[320px] overflow-y-auto rounded-xl border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 font-bold text-slate-600">
                        <tr>
                          <th className="p-3">Nome</th>
                          <th className="p-3">Marca</th>
                          <th className="p-3">Setor</th>
                          <th className="p-3">Qtd</th>
                          <th className="p-3">Unidade</th>
                          <th className="p-3">Valor Total (R$)</th>
                          <th className="p-3">Categoria</th>
                          <th className="p-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {itensMigracao.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="p-2">
                              <input
                                value={item.nome}
                                onChange={e => atualizarItemMigracao(idx, "nome", e.target.value)}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-800"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                value={item.marca || ""}
                                onChange={e => atualizarItemMigracao(idx, "marca", e.target.value)}
                                placeholder="Marca"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.departamento || "cozinha"}
                                onChange={e => atualizarItemMigracao(idx, "departamento", e.target.value)}
                                className="rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-700"
                              >
                                <option value="cozinha">Cozinha</option>
                                <option value="bar">Bar</option>
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                value={item.quantidade}
                                onChange={e => atualizarItemMigracao(idx, "quantidade", e.target.value)}
                                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center font-bold"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.unidade}
                                onChange={e => atualizarItemMigracao(idx, "unidade", e.target.value)}
                                className="rounded-lg border border-slate-200 px-1 py-1 font-bold"
                              >
                                {UNIDADES_INGREDIENTE.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                value={item.valor_total}
                                onChange={e => atualizarItemMigracao(idx, "valor_total", e.target.value)}
                                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right font-black text-emerald-700"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                value={item.categoria || ""}
                                onChange={e => atualizarItemMigracao(idx, "categoria", e.target.value)}
                                placeholder="Categoria"
                                className="w-full rounded-lg border border-slate-200 px-2 py-1"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                onClick={() => removerItemMigracao(idx)}
                                className="text-slate-400 hover:text-red-600"
                                title="Remover item"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setModalMigrar(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                disabled={itensMigracao.length === 0 || migrarSalvando}
                onClick={confirmarSalvarMigracao}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {migrarSalvando ? "Salvando ingredientes..." : `Salvar e Migrar ${itensMigracao.length} Ingrediente(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-5 right-5 z-[70] flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white shadow-2xl ${toast.tipo === "erro" ? "bg-red-600" : "bg-emerald-600"}`}>
          {toast.tipo === "erro" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          {toast.mensagem}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-12 text-center font-bold text-slate-400">Carregando ingredientes...</div>}>
      <IngredientesRunner />
    </Suspense>
  );
}
