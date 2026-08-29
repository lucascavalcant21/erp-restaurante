"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  Mic,
  MicOff,
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
  EMBALAGENS_INGREDIENTE, UNIDADES_INGREDIENTE, calcularCustoSolicitado, calcularPrecoNormalizado, ehUnidadeContada, ehUnidadeUnitaria, normalizarBusca, ordenarIngredientes, parseNumeroBR, precoNormalizadoDoInsumo, rotuloPesoUnitario, rotuloVolumeUnitario, textoPesquisavel, unidadeNormalizada, unidadesDoDepartamento,
} from "../../../lib/ingredientes-utils.mjs";
import { fmtBRL } from "../../../components/ui";
import { criarEscuta, vozDisponivel } from "../../../lib/hefisto-voz";
import { registrarAuditoria } from "../../../lib/hefisto-acoes";

const PAGE_SIZE = 50;
const TAMANHOS_PAGINA = [25, 50, 100, 200];

const ORDENACOES = [
  { value: "nome-asc", label: "Nome A–Z" },
  { value: "nome-desc", label: "Nome Z–A" },
  { value: "maior-preco", label: "Maior preço" },
  { value: "menor-preco", label: "Menor preço" },
  { value: "recentes", label: "Atualizado recentemente" },
];

const unidadeLabel = unidade => UNIDADES_INGREDIENTE.find(item => item.value === unidade)?.label || unidade;

function novoFormulario(departamento = "cozinha") {
  const ehBar = departamento === "bar";
  return {
    id: null,
    departamento,
    nome: "",
    nome_interno: "",
    marca: "",
    categoria: "",
    codigo_interno: "",
    tamanho_embalagem: "1",
    unidade_medida: ehBar ? "ml" : "kg",
    volume_unidade_ml: "",
    unidade_comercial: "",
    peso_medio_g: "",
    valor_embalagem: "",
    fornecedor_atual_id: "",
    fornecedor_ids: [],
    densidade_g_ml: "",
    peso_bruto_g: "",
    perda_g: "",
    peso_peca_g: "",
    pecas_por_kg: "",
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
  const { abrirMenu, unidadeAtiva, sessao } = useERP();
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
  const [porPagina, setPorPagina] = useState(PAGE_SIZE);
  const [destacado, setDestacado] = useState(null); // item recém-salvo, para não sumir de vista
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

  // Estados da migração por print/imagem (suporta múltiplas fotos) ou texto
  const [modalMigrar, setModalMigrar] = useState(false);
  const [migrarTexto, setMigrarTexto] = useState("");
  const [migrarArquivos, setMigrarArquivos] = useState([]);
  const [migrarProcessando, setMigrarProcessando] = useState(false);
  const [migrarSalvando, setMigrarSalvando] = useState(false);
  const [itensMigracao, setItensMigracao] = useState([]);
  const [ouvindoIngredientes, setOuvindoIngredientes] = useState(false);
  const [respostaVozIngredientes, setRespostaVozIngredientes] = useState("");
  const [origemMigracaoVoz, setOrigemMigracaoVoz] = useState(false);
  const escutaIngredientesRef = useRef(null);

  const mostrarToast = (mensagem, tipo = "ok") => {
    setToast({ mensagem, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  const iniciarCadastroPorVoz = (reiniciar = true) => {
    setModalMigrar(true);
    if (reiniciar) {
      setItensMigracao([]);
      setMigrarArquivos([]);
      setMigrarTexto("");
    }
    setOrigemMigracaoVoz(true);
    if (!vozDisponivel()) {
      setRespostaVozIngredientes("Este navegador nao reconhece voz. Use o Chrome no Android ou o Safari no iPhone e autorize o microfone.");
      return;
    }
    escutaIngredientesRef.current?.parar?.();
    setOuvindoIngredientes(true);
    setRespostaVozIngredientes("Ouvindo. Diga os ingredientes, quantidades, unidades e valores.");
    const sessaoVoz = criarEscuta({
      onParcial: parcial => setMigrarTexto(parcial),
      onFinal: final => {
        const comando = normalizarBusca(final);
        const confirmouCadastro = /\b(?:confirmar|confirme|confirmo)\b.*\b(?:cadastro|ingredientes?|itens?|lista)\b|\b(?:pode salvar|salvar agora)\b/.test(comando);
        if (confirmouCadastro) {
          if (!itensMigracao.length) {
            setRespostaVozIngredientes("Ainda não há ingredientes analisados para confirmar.");
            return;
          }
          if (migrarSalvando) {
            setRespostaVozIngredientes("Os ingredientes já estão sendo salvos.");
            return;
          }
          setRespostaVozIngredientes("Confirmação por voz recebida. Salvando os ingredientes.");
          confirmarSalvarMigracao(final);
          return;
        }
        setMigrarTexto(final);
        setRespostaVozIngredientes("Comando transcrito. Confira o texto e toque em Analisar com IA.");
      },
      onErro: erro => { setOuvindoIngredientes(false); setRespostaVozIngredientes(erro); },
      onFim: () => setOuvindoIngredientes(false),
    });
    escutaIngredientesRef.current = sessaoVoz;
    if (!sessaoVoz) {
      setOuvindoIngredientes(false);
      setRespostaVozIngredientes("Nao consegui acessar o microfone neste aparelho.");
      return;
    }
    sessaoVoz.iniciar();
  };

  useEffect(() => () => escutaIngredientesRef.current?.parar?.(), []);
  useEffect(() => {
    if (!modalMigrar) {
      escutaIngredientesRef.current?.parar?.();
      setOuvindoIngredientes(false);
    }
  }, [modalMigrar]);

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
    if (!migrarArquivos.length && !migrarTexto.trim()) return alert("Selecione pelo menos uma imagem/print ou digite um texto.");
    setMigrarProcessando(true);
    try {
      const imagens = await Promise.all(
        migrarArquivos.map(async file => {
          const b64 = await comprimirFotoParaIA(file, 1000, 0.70);
          return { base64: b64, media_type: file.type || "image/jpeg" };
        })
      );

      const res = await fetch("/api/ia-insumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: migrarTexto,
          imagens,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Não foi possível extrair a lista das fotos.");
        setMigrarProcessando(false);
        return;
      }

      setItensMigracao(data.itens || []);
      if (origemMigracaoVoz) setRespostaVozIngredientes("Confira os itens. Para concluir, toque no microfone e diga: confirmar cadastro.");
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

  const confirmarSalvarMigracao = async (comandoConfirmacao = "") => {
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
    await registrarAuditoria({
      unidadeId: unidadeAtiva,
      usuarioId: sessao?.user?.id || sessao?.id || null,
      usuarioNome: sessao?.nome || sessao?.user?.email || "",
      comando: origemMigracaoVoz
        ? `${migrarTexto}${comandoConfirmacao ? `; Confirmação por voz: ${comandoConfirmacao}` : ""}`
        : "Importacao de ingredientes por lista ou imagem",
      intencao: { origem: origemMigracaoVoz ? "voz" : "lista", itens: itensMigracao.map(item => ({ nome: item.nome, quantidade: item.quantidade, unidade: item.unidade, valor_total: item.valor_total, departamento: item.departamento })) },
      acao: origemMigracaoVoz ? "inventory.ingredients.voice_batch" : "inventory.ingredients.import_batch",
      modulo: "inventory",
      valorAnterior: insumos.length,
      valorNovo: insumos.length + salvos,
      resultado: "sucesso",
      exigiuConfirmacao: true,
    });
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
  }, [busca, categoria, ordenacao, deptUrl, porPagina]);

  // porPagina 0 = "Todos": o catálogo inteiro numa página só.
  const tamanhoPagina = porPagina > 0 ? porPagina : Math.max(1, filtrados.length);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  // A lista é alfabética e paginada: um "Tomate" recém-cadastrado cai numa
  // página que ninguém está olhando e parece ter sumido. Depois de salvar,
  // vamos até a página onde ele está e o destacamos por alguns segundos.
  useEffect(() => {
    if (!destacado) return;
    const indice = filtrados.findIndex(item => item.id === destacado);
    if (indice < 0) return;
    setPagina(Math.floor(indice / tamanhoPagina) + 1);
    const limpar = setTimeout(() => setDestacado(null), 5000);
    return () => clearTimeout(limpar);
  }, [destacado, filtrados, tamanhoPagina]);

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
    const dep = insumo.departamento || deptUrl || "cozinha";
    let un = insumo.unidade_medida || (dep === "bar" ? "ml" : "kg");
    setForm({
      id: insumo.id,
      departamento: dep,
      nome: insumo.nome || "",
      nome_interno: insumo.nome_interno || "",
      marca: insumo.marca || "",
      categoria: insumo.categoria || "",
      codigo_interno: insumo.codigo_interno || "",
      tamanho_embalagem: String(insumo.tamanho_embalagem || 1),
      unidade_medida: un,
      volume_unidade_ml: insumo.volume_unidade_ml ? String(insumo.volume_unidade_ml) : "",
      unidade_comercial: insumo.unidade_comercial || "",
      peso_medio_g: insumo.peso_medio_g ? String(insumo.peso_medio_g) : "",
      valor_embalagem: String(Number(insumo.custo_compra) > 0 ? insumo.custo_compra : (insumo.custo_unitario || "")),
      fornecedor_atual_id: insumo.fornecedor_atual_id || "",
      fornecedor_ids: (insumo.fornecedores_vinculados || []).map(item => item.id).filter(Boolean),
      densidade_g_ml: insumo.densidade_g_ml ? String(insumo.densidade_g_ml) : "",
      peso_bruto_g: insumo.peso_bruto_padrao != null ? String(insumo.peso_bruto_padrao) : "",
      perda_g: insumo.perda_g != null ? String(insumo.perda_g) : "",
      peso_peca_g: insumo.peso_peca_g != null ? String(insumo.peso_peca_g) : "",
      pecas_por_kg: insumo.pecas_por_kg != null ? String(insumo.pecas_por_kg) : "",
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
        unidade: x.unidade_embalagem || un,
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
      // Em que a quantidade acima vem. Vazio = a granel, pesado na balanca.
      unidade_comercial: form.unidade_comercial || null,
      // Só faz sentido em garrafa/lata/barril. Trocar para ml zera o campo, senão
      // ficaria um volume órfão contradizendo a unidade.
      volume_unidade_ml: ehUnidadeContada(form.unidade_medida)
        ? (parseNumeroBR(form.volume_unidade_ml) > 0 ? parseNumeroBR(form.volume_unidade_ml) : null)
        : null,
      // Mesma ideia do volume, do lado do peso: "1 un" de tomate só serve para
      // a receita quando alguém diz quanto pesa.
      peso_medio_g: ehUnidadeUnitaria(form.unidade_medida)
        ? (parseNumeroBR(form.peso_medio_g) > 0 ? parseNumeroBR(form.peso_medio_g) : null)
        : null,
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
      peso_peca_g: form.peso_peca_g ? parseNumeroBR(form.peso_peca_g) : null,
      pecas_por_kg: form.pecas_por_kg ? parseNumeroBR(form.pecas_por_kg) : null,
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
    // Cadastro novo entra no fim do alfabeto ou fora do filtro ativo. Limpar
    // busca e categoria garante que ele esteja na lista; o efeito de destaque
    // leva até a página dele.
    if (!form.id) { setBusca(""); setCategoria("Todas"); }
    setDestacado(insumoId || null);
    await carregar();

    // Salvou em outro setor? Esta tela lista só o setor da URL, então o item
    // não apareceria aqui e o sumiço não teria explicação na tela.
    const setorDaTela = deptUrl || null;
    if (setorDaTela && form.departamento !== setorDaTela) {
      alert(`Salvo no setor "${form.departamento}", e esta tela lista apenas "${setorDaTela}".\n\n`
        + `Por isso ele não aparece nesta lista. Abra o catálogo de ${form.departamento} para vê-lo, `
        + `ou edite o item e troque o setor para "${setorDaTela}".`);
      return;
    }
    mostrarToast(form.id ? `${ehBar ? "Produto" : "Ingrediente"} atualizado.` : `${ehBar ? "Produto" : "Ingrediente"} cadastrado.`);
  };

  // Seleção múltipla: apagar 40 itens um a um, com um confirm cada, é o tipo de
  // tarefa que ninguém termina. Guardamos ids, não objetos — a lista recarrega
  // e os objetos trocam de identidade.
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [removendoLote, setRemovendoLote] = useState(false);

  const alternarSelecao = (id) => setSelecionados(atual => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id); else proximo.add(id);
    return proximo;
  });

  // Marca/desmarca só o que está VISÍVEL na página. Selecionar em silêncio o que
  // o filtro escondeu é a receita para apagar o que não se viu.
  const todosDaPaginaMarcados = paginados.length > 0 && paginados.every(i => selecionados.has(i.id));
  const alternarPagina = () => setSelecionados(atual => {
    const proximo = new Set(atual);
    if (todosDaPaginaMarcados) paginados.forEach(i => proximo.delete(i.id));
    else paginados.forEach(i => proximo.add(i.id));
    return proximo;
  });

  const removerSelecionados = async () => {
    const alvo = filtrados.filter(i => selecionados.has(i.id));
    if (!alvo.length) return;
    const nomes = alvo.slice(0, 5).map(i => i.nome).join(", ");
    const resto = alvo.length > 5 ? ` e mais ${alvo.length - 5}` : "";
    if (!confirm(`Remover ${alvo.length} ${alvo.length === 1 ? rotuloItem : rotuloItens} do catálogo?\n\n${nomes}${resto}\n\nEles saem também das fichas técnicas e dos estoques. Não tem volta.`)) return;

    setRemovendoLote(true);
    // Um a um de propósito: removerInsumo limpa vínculo por vínculo e devolve o
    // motivo de cada falha. Em lote, um item preso levaria os outros junto.
    const falhas = [];
    for (const item of alvo) {
      const { error } = await removerInsumo(item.id);
      if (error) falhas.push(`${item.nome}: ${error}`);
    }
    setRemovendoLote(false);
    // Quem falhou continua marcado, para a pessoa ver o que sobrou e tentar de novo.
    setSelecionados(new Set(alvo.filter(i => falhas.some(f => f.startsWith(`${i.nome}:`))).map(i => i.id)));
    await carregar();
    if (falhas.length) {
      mostrarToast(`${alvo.length - falhas.length} removido(s). Falhou: ${falhas.slice(0, 2).join(" | ")}`, "erro");
    } else {
      mostrarToast(`${alvo.length} ${alvo.length === 1 ? rotuloItem : rotuloItens} removido(s).`);
    }
  };

  const handleRemover = async insumo => {
    if (!confirm(`Deseja remover o ${rotuloItem} "${insumo.nome}" do catálogo? Esta ação excluirá este ingrediente e desvinculará de fichas técnicas e estoques.`)) return;
    const { error } = await removerInsumo(insumo.id);
    if (error) {
      mostrarToast(`Não foi possível remover: ${error}`, "erro");
      return;
    }
    await carregar();
    mostrarToast(`${ehBar ? "Produto" : "Ingrediente"} removido com sucesso.`);
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
          <div className="erp-busca-fixa flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 items-center gap-2 rounded-2xl border-2 border-slate-300 bg-white px-3.5 shadow-sm transition-all focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-500/20 sm:w-[500px]">
              <Search size={19} className="shrink-0 text-slate-700 font-bold" />
              <input
                value={busca}
                onChange={event => setBusca(event.target.value)}
                placeholder={`Buscar ${rotuloItem} por nome, marca, fornecedor...`}
                className="h-11 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
              />
              {busca && (
                <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-700" title="Limpar busca">
                  <X size={16} />
                </button>
              )}
            </label>
            <button
              onClick={() => { setModalMigrar(true); setItensMigracao([]); setMigrarTexto(""); setMigrarArquivos([]); setOrigemMigracaoVoz(false); setRespostaVozIngredientes(""); }}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-600/30 bg-emerald-50 px-4 text-sm font-black text-emerald-700 shadow-sm transition hover:bg-emerald-100"
            >
              <Camera size={18} /> Migrar por Print / Lista
            </button>
            <button
              onClick={() => iniciarCadastroPorVoz(true)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-600/30 bg-violet-50 px-4 text-sm font-black text-violet-700 shadow-sm transition hover:bg-violet-100"
            >
              <Mic size={18} /> Adicionar por voz
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
            { id: "todos", icon: Package, label: `Total de ${rotuloItens}`, value: estatisticas.total, note: "Clique p/ ver todos", color: "emerald", action: () => setBusca("") },
            { id: "semMarca", icon: Tag, label: "Sem marca", value: estatisticas.semMarca, note: "Clique p/ filtrar", color: "amber", action: () => setBusca("sem marca") },
            { id: "semFornecedor", icon: Users, label: "Sem fornecedor", value: estatisticas.semFornecedor, note: "Clique p/ filtrar", color: "violet", action: () => setBusca("Sem vínculo") },
            { id: "recentes", icon: Clock3, label: "Preço atualizado", value: estatisticas.recentes, note: "Últimos 30 dias", color: "blue", action: () => setOrdenacao("recentes") },
          ].map(card => {
            const cores = {
              emerald: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
              amber: "bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white",
              violet: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
              blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
            };
            return (
              <button
                key={card.label}
                type="button"
                onClick={card.action}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/50 hover:shadow-md active:scale-95 cursor-pointer"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${cores[card.color]}`}>
                  <card.icon size={20} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-500">{card.label}</p>
                  <p className="text-xl font-black leading-tight text-slate-900">{card.value}</p>
                  <p className="hidden text-[11px] font-semibold text-emerald-600 sm:block">{card.note}</p>
                </div>
              </button>
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

        {/* Barra da seleção: só aparece com algo marcado, e some sozinha depois.
            Fica acima das duas listas (tabela e cards) para servir às duas. */}
        {selecionados.size > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-sm font-black text-emerald-900">
              {selecionados.size} {selecionados.size === 1 ? rotuloItem : rotuloItens} selecionado(s)
            </span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelecionados(new Set())} disabled={removendoLote}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                Limpar seleção
              </button>
              <button type="button" onClick={removerSelecionados} disabled={removendoLote}
                className="rounded-xl border-2 border-red-300 bg-white px-3.5 py-2 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50">
                {removendoLote ? "Removendo..." : `Remover ${selecionados.size} do catálogo`}
              </button>
            </div>
          </div>
        )}

        <section className="mt-3 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
          <table className="w-full min-w-[1050px] table-fixed text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wide text-slate-500">
                <th className="w-9 pl-3 pr-0">
                  <input type="checkbox" aria-label="Selecionar os desta página"
                    checked={todosDaPaginaMarcados} onChange={alternarPagina}
                    className="h-4 w-4 accent-emerald-600" />
                </th>
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
                <tr><td colSpan={10} className="py-16 text-center text-sm font-bold text-slate-400">Carregando {rotuloItens}...</td></tr>
              ) : paginados.length === 0 ? (
                <tr><td colSpan={10} className="py-16 text-center text-sm font-bold text-slate-400">Nenhum {rotuloItem} encontrado.</td></tr>
              ) : paginados.map(insumo => {
                const vinculados = insumo.fornecedores_vinculados || [];
                const outros = Math.max(0, vinculados.length - 1);
                const normalizado = precoNormalizadoDoInsumo(insumo);
                return (
                  <tr key={insumo.id} className={`align-middle transition ${destacado === insumo.id ? "bg-emerald-100 ring-2 ring-inset ring-emerald-400" : selecionados.has(insumo.id) ? "bg-emerald-50" : "hover:bg-emerald-50/30"}`}>
                    <td className="w-9 pl-3 pr-0">
                      <input type="checkbox" aria-label={`Selecionar ${insumo.nome}`}
                        checked={selecionados.has(insumo.id)} onChange={() => alternarSelecao(insumo.id)}
                        className="h-4 w-4 accent-emerald-600" />
                    </td>
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
                      {(() => {
                        const pG = Number(insumo.peso_peca_g);
                        const pK = Number(insumo.pecas_por_kg);
                        if (normalizado > 0 && (pG > 0 || pK > 0)) {
                          const custoPeca = pG > 0 ? normalizado * (pG / 1000) : normalizado / pK;
                          const pesoF = pG || (1000 / pK);
                          return (
                            <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-200">
                              ~{fmtBRL(custoPeca)}/un ({pesoF.toFixed(0)}g)
                            </span>
                          );
                        }
                        return null;
                      })()}
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
              <article key={insumo.id} className={`rounded-xl border bg-white p-3 shadow-sm ${destacado === insumo.id ? "border-emerald-500 ring-2 ring-emerald-300" : selecionados.has(insumo.id) ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <input type="checkbox" aria-label={`Selecionar ${insumo.nome}`}
                    checked={selecionados.has(insumo.id)} onChange={() => alternarSelecao(insumo.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" />
                  <div className="min-w-0 flex-1">
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
                    {(() => {
                      const pG = Number(insumo.peso_peca_g);
                      const pK = Number(insumo.pecas_por_kg);
                      if (normalizado > 0 && (pG > 0 || pK > 0)) {
                        const custoPeca = pG > 0 ? normalizado * (pG / 1000) : normalizado / pK;
                        const pesoF = pG || (1000 / pK);
                        return (
                          <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-800 border border-emerald-200">
                            ~{fmtBRL(custoPeca)}/un ({pesoF.toFixed(0)}g)
                          </span>
                        );
                      }
                      return null;
                    })()}
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
              Mostrando {(paginaAtual - 1) * tamanhoPagina + 1} a {Math.min(paginaAtual * tamanhoPagina, filtrados.length)} de {filtrados.length} {rotuloItens}
            </p>
            <div className="flex items-center gap-2">
              <select
                value={porPagina}
                onChange={e => setPorPagina(Number(e.target.value))}
                aria-label={`Quantidade de ${rotuloItens} por página`}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-black text-slate-600 outline-none"
              >
                {TAMANHOS_PAGINA.map(valor => <option key={valor} value={valor}>{valor} por página</option>)}
                <option value={0}>Todos</option>
              </select>
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
                    {(() => {
                      // O bar mede tudo em volume; garrafa/lata/barril sairam daqui
                      // e viraram a pergunta separada "Embalado em".
                      const lista = unidadesDoDepartamento(form.departamento);
                      return (
                        <select value={form.unidade_medida} onChange={event => setForm({ ...form, unidade_medida: event.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold outline-none focus:border-emerald-500">
                          {lista.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      );
                    })()}
                  </label>
                  {/* "un" nao tem tamanho de embalagem que revele o peso: 1 tomate
                      nao e "1 kg de tomate". Aqui a pessoa diz quanto pesa uma peca,
                      senao o item fica fora do rendimento da ficha. */}
                  {ehUnidadeUnitaria(form.unidade_medida) && (
                    <label className="col-span-2">
                      <span className="text-xs font-bold text-slate-600">Quanto pesa 1 unidade (g)</span>
                      <input inputMode="decimal" value={form.peso_medio_g}
                        onChange={event => !event.target.value.startsWith("-") && setForm({ ...form, peso_medio_g: event.target.value })}
                        placeholder="100"
                        className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-bold outline-none focus:border-emerald-500" />
                      <span className="mt-1 block text-[11px] font-medium text-slate-400">
                        {parseNumeroBR(form.peso_medio_g) > 0
                          ? rotuloPesoUnitario({ unidade_medida: "un", peso_medio_g: parseNumeroBR(form.peso_medio_g) })
                          : "Tomate: 100. Ovo: 50. Sem isso a receita nao sabe quanto rende."}
                      </span>
                    </label>
                  )}
                  {/* Onde esse volume/peso esta. "500 ml" sozinho nao diz se e
                      garrafa, lata ou barril, e era essa a informacao que faltava
                      para a ficha tecnica somar 1 garrafa como 500 ml. */}
                  <label className="col-span-2">
                    <span className="text-xs font-bold text-slate-600">Embalado em</span>
                    <select value={form.unidade_comercial || ""}
                      onChange={event => setForm({ ...form, unidade_comercial: event.target.value })}
                      className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-bold outline-none focus:border-emerald-500">
                      {EMBALAGENS_INGREDIENTE.map(item => <option key={item.value || "granel"} value={item.value}>{item.label}</option>)}
                    </select>
                    <span className="mt-1 block text-[11px] font-medium text-slate-400">
                      {rotuloVolumeUnitario({ unidade_medida: form.unidade_medida, tamanho_embalagem: parseNumeroBR(form.tamanho_embalagem), unidade_comercial: form.unidade_comercial })
                        || rotuloPesoUnitario({ unidade_medida: form.unidade_medida, tamanho_embalagem: parseNumeroBR(form.tamanho_embalagem), unidade_comercial: form.unidade_comercial })
                        || "Sem embalagem a receita nao sabe quanto rende 1 peca."}
                    </span>
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

                {/* Porcionamento & Custo por Peça (Ex: R$ 90/kg, 150g/peça -> R$ 13,50/un) */}
                <div className="mt-4 border-t border-slate-100 pt-3 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Calculator size={14} className="text-emerald-600" />
                    Porcionamento por Peça / Unidade (Opcional)
                  </h4>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label>
                      <span className="text-xs font-bold text-slate-600">Peso médio de 1 peça (g)</span>
                      <input
                        inputMode="decimal"
                        value={form.peso_peca_g}
                        onChange={e => {
                          const val = e.target.value;
                          const numG = parseNumeroBR(val);
                          const pecas = Number.isFinite(numG) && numG > 0 ? (1000 / numG).toFixed(2).replace('.', ',') : "";
                          setForm({ ...form, peso_peca_g: val, pecas_por_kg: pecas });
                        }}
                        placeholder="Ex.: 150 (g por unidade)"
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none focus:border-emerald-500 text-slate-800"
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold text-slate-600">Qtd. média de peças por kg</span>
                      <input
                        inputMode="decimal"
                        value={form.pecas_por_kg}
                        onChange={e => {
                          const val = e.target.value;
                          const numPec = parseNumeroBR(val);
                          const peso = Number.isFinite(numPec) && numPec > 0 ? (1000 / numPec).toFixed(1).replace('.', ',') : "";
                          setForm({ ...form, pecas_por_kg: val, peso_peca_g: peso });
                        }}
                        placeholder="Ex.: 6 (un por kg)"
                        className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold outline-none focus:border-emerald-500 text-slate-800"
                      />
                    </label>
                  </div>

                  {(() => {
                    const pKg = calcularPrecoNormalizado(parseNumeroBR(form.tamanho_embalagem), form.unidade_medida, parseNumeroBR(form.valor_embalagem));
                    const pesoG = parseNumeroBR(form.peso_peca_g);
                    const pecasKg = parseNumeroBR(form.pecas_por_kg);
                    if (pKg > 0 && (pesoG > 0 || pecasKg > 0)) {
                      const custoPeca = pesoG > 0 ? pKg * (pesoG / 1000) : pKg / pecasKg;
                      const pecasCalc = pecasKg || (1000 / pesoG);
                      const pesoCalc = pesoG || (1000 / pecasKg);
                      return (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 space-y-1">
                          <div className="flex justify-between items-center font-black text-emerald-900">
                            <span>🥩 Custo estimado por peça/unidade:</span>
                            <span className="text-sm font-black text-emerald-700">{fmtBRL(custoPeca)} / unidade</span>
                          </div>
                          <p className="font-semibold text-emerald-800">
                            ~<strong>{pesoCalc.toFixed(0)}g</strong> por peça · Rende cerca de <strong>{pecasCalc.toFixed(1)} peças por kg</strong>.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </section>

              {!ehBar && (
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
              )}

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
                      multiple
                      id="file-print-upload"
                      className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        if (files.length) {
                          setMigrarArquivos(prev => [...prev, ...files]);
                        }
                      }}
                    />
                    <label htmlFor="file-print-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-100">
                      <Upload size={15} /> Adicionar Fotos / Prints
                    </label>
                    {migrarArquivos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
                        {migrarArquivos.map((file, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                            <Camera size={12} /> {file.name}
                            <button
                              type="button"
                              onClick={() => setMigrarArquivos(prev => prev.filter((_, i) => i !== idx))}
                              className="ml-1 text-emerald-600 hover:text-emerald-950"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
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
                  {origemMigracaoVoz && <div className="mt-2"><p className="rounded-lg bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-700">{respostaVozIngredientes || "Use o microfone para ditar a lista."}</p><button type="button" onClick={ouvindoIngredientes ? () => escutaIngredientesRef.current?.parar?.() : () => iniciarCadastroPorVoz(false)} className={`mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-xs font-black text-white ${ouvindoIngredientes ? "bg-rose-600" : "bg-violet-600"}`}>{ouvindoIngredientes ? <><MicOff size={16}/> Parar de ouvir</> : <><Mic size={16}/> Falar ou confirmar por voz</>}</button></div>}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  disabled={migrarProcessando || (!migrarArquivos.length && !migrarTexto.trim())}
                  onClick={processarMigracaoIA}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {migrarProcessando ? (
                    <>Lendo {migrarArquivos.length} foto(s) e consolidando...</>
                  ) : (
                    <><Sparkles size={18} /> Analisar lista com IA</>
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
                onClick={() => confirmarSalvarMigracao()}
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
