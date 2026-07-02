"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas, salvarFicha, removerFicha, fetchInsumos, salvarInsumo } from "../../../lib/operacao";
import { LayoutList, Plus, Search, Trash2, Edit3, X, Save, ArrowLeft, UtensilsCrossed, Wine, ChevronRight, Printer, Sparkles, Loader2, Camera, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

// Converte um File de imagem em base64 puro (sem o prefixo "data:...;base64,")
function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Normaliza texto pra comparação de nomes (minúsculo, sem acento, sem espaço extra)
const REGEX_DIACRITICOS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");
function normalizarNome(s) {
  const semAcento = String(s || "").toLowerCase().normalize("NFD").replace(REGEX_DIACRITICOS, "");
  return semAcento.trim();
}

// Converte uma quantidade lida (na unidade da receita) para a unidade-base do insumo vinculado
function converterParaBase(quantidadeLida, unidadeLida, unidadeBaseInsumo) {
  if (unidadeLida === unidadeBaseInsumo) return quantidadeLida;
  if (unidadeLida === "g" && unidadeBaseInsumo === "kg") return quantidadeLida / 1000;
  if (unidadeLida === "ml" && unidadeBaseInsumo === "l") return quantidadeLida / 1000;
  if (unidadeLida === "kg" && unidadeBaseInsumo === "g") return quantidadeLida * 1000;
  if (unidadeLida === "l" && unidadeBaseInsumo === "ml") return quantidadeLida * 1000;
  return quantidadeLida; // unidades incompatíveis — usa como veio, revisável na tela
}

// Sub-unidades para lançamento em ficha. O custo do insumo é por unidade-base
// (R$/kg, R$/L). Em receita pensamos em g/ml, então convertemos: 1 base = `f` sub.
// Ex: kg → g (f=1000). Insumos em "un" não têm sub-unidade.
const SUB_UNIDADES = {
  kg: { sub: "g",  f: 1000 },
  l:  { sub: "ml", f: 1000 },
};
const getSub = (unidade) => SUB_UNIDADES[String(unidade || "").toLowerCase()] || null;

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
// guard evita loop infinito se alguém criar uma referência circular.
function custoTotalDaFicha(f, todasFichas, guard = new Set()) {
  if (!f || guard.has(f.id)) return 0;
  guard.add(f.id);
  let total = 0;
  (f.fichas_ingredientes || []).forEach(fi => {
    if (fi.insumos) {
      total += (fi.insumos.custo_unitario || 0) * (fi.quantidade || 0);
    } else if (fi.subficha_id) {
      const base = todasFichas.find(x => x.id === fi.subficha_id);
      const custoBaseUnit = base ? custoTotalDaFicha(base, todasFichas, guard) / (base.rendimento_porcoes || 1) : 0;
      total += custoBaseUnit * (fi.quantidade || 0);
    }
  });
  return total;
}
// Custo por unidade-de-rendimento de uma base (usado quando ela vira ingrediente)
function custoUnitBase(base, todasFichas) {
  return custoTotalDaFicha(base, todasFichas) / (base.rendimento_porcoes || 1);
}

// Peso total produzido (g) a partir do rendimento + unidade + peso da porção
function pesoTotalDaFicha(rendimento, unidade, pesoPorcaoG) {
  const un = String(unidade || "porcao").toLowerCase();
  if (un === "kg" || un === "l") return rendimento * 1000;
  if (un === "g" || un === "ml") return rendimento;
  return pesoPorcaoG > 0 ? rendimento * pesoPorcaoG : 0; // porções ou unidades
}

// Info de peso de uma ficha: peso total produzido (g), custo por kg, peso por
// porção e QUANTAS porções renderam. Vale quando a ficha tem peso_porcao_g
// preenchido OU quando rende direto em peso/volume (kg/g/l/ml).
function infoPesoFicha(f, todasFichas) {
  const rendimento = Number(f.rendimento_porcoes) || 0;
  const pesoPorcao = Number(f.peso_porcao_g) || 0;
  const un = String(f.rendimento_unidade || "porcao").toLowerCase();
  const pesoTotalG = pesoTotalDaFicha(rendimento, un, pesoPorcao);
  if (!pesoTotalG || !rendimento) return null;
  const custoTotal = custoTotalDaFicha(f, todasFichas);
  // Nº de porções: direto do rendimento (porções/un) ou derivado do peso
  const porcoes = (un === "porcao" || un === "un")
    ? rendimento
    : (pesoPorcao > 0 ? pesoTotalG / pesoPorcao : null);
  return {
    pesoTotalG,
    custoKg: custoTotal / (pesoTotalG / 1000),
    custoPorcao: porcoes > 0 ? custoTotal / porcoes : null,
    pesoPorcaoG: pesoPorcao > 0 ? pesoPorcao : null,
    porcoes,
    liquido: un === "l" || un === "ml",
  };
}
const fmtG = (g) => g >= 1000
  ? `${(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`
  : `${(+g.toFixed(1)).toLocaleString("pt-BR")} g`;

// Soma dos ingredientes → rendimento bruto estimado da receita (antes de perdas
// no cozimento). Separa sólidos (g) de líquidos (ml). Itens em "un" sem peso
// conhecido não entram. Sugere a unidade conforme o que domina.
function rendimentoPelosIngredientes(ingLista) {
  let solidosG = 0, liquidosMl = 0;
  (ingLista || []).forEach(ing => {
    const u = String(ing.unidade || "").toLowerCase();
    const q = Number(ing.quantidade) || 0;
    if (u === "kg") solidosG += q * 1000;
    else if (u === "g") solidosG += q;
    else if (u === "l") liquidosMl += q * 1000;
    else if (u === "ml") liquidosMl += q;
    // "un"/"porcao": sem peso conhecido, ignora
  });
  const total = solidosG + liquidosMl;
  if (total <= 0) return null;
  const ehLiquido = liquidosMl > solidosG;
  const unidade = total >= 1000 ? (ehLiquido ? "l" : "kg") : (ehLiquido ? "ml" : "g");
  const valor = (unidade === "kg" || unidade === "l") ? total / 1000 : total;
  return { totalG: total, unidade, valor: Math.round(valor * 1000) / 1000 };
}

function FichasRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "cozinha"; // 'cozinha' ou 'bar'
  
  const { unidadeAtiva } = useERP();
  const [fichas, setFichas] = useState([]);
  const [insumosAtivos, setInsumosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  
  // Estado do formulário da Ficha
  const [form, setForm] = useState({
    id: null,
    departamento: deptUrl,
    nome_receita: "",
    rendimento_porcoes: "1",
    modo_preparo: "",
    eh_base: false,
    rendimento_unidade: "porcao",
    peso_porcao_g: ""
  });

  // Calculadora de desmembramento (digita uma quantidade, vê custo/peso/unidades)
  const [calcQtd, setCalcQtd] = useState("");
  const [calcUn, setCalcUn] = useState("g");

  // Ingredientes da ficha. Cada item tem `chave` (insumo_id OU subficha_id),
  // `tipo` ('insumo'|'base'), `custo_unitario` (por unidade-base) e `unidade`.
  const [ingFicha, setIngFicha] = useState([]);

  // Bases disponíveis (fichas marcadas como pré-preparo), exceto a própria ficha em edição
  const basesDisponiveis = fichas.filter(f => f.eh_base && f.id !== form.id);

  // ─── Montar Ficha Técnica inteira com IA (texto/foto da receita) ───────────
  const [modalIAFicha, setModalIAFicha] = useState(false);
  const [iaFTexto, setIaFTexto] = useState("");
  const [iaFImagem, setIaFImagem] = useState(null); // { base64, mediaType, previewUrl, nomeArquivo }
  const [iaFLoading, setIaFLoading] = useState(false);
  const [iaFResultado, setIaFResultado] = useState(null); // { nome_receita, rendimento_porcoes, modo_preparo, itens: [...] }
  const fileInputFichaRef = useRef(null);

  const abrirModalIAFicha = () => {
    setIaFTexto("");
    setIaFImagem(null);
    setIaFResultado(null);
    setModalIAFicha(true);
  };

  const handleSelecionarImagemFicha = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await fileParaBase64(file);
    setIaFImagem({ base64, mediaType: file.type || "image/jpeg", previewUrl: URL.createObjectURL(file), nomeArquivo: file.name });
  };

  // Tenta casar o nome extraído pela IA com um insumo já cadastrado no departamento
  const encontrarInsumoCorrespondente = (nome) => {
    const alvo = normalizarNome(nome);
    if (!alvo) return null;
    const exato = insumosAtivos.find(i => normalizarNome(i.nome) === alvo);
    if (exato) return exato;
    return insumosAtivos.find(i => {
      const n = normalizarNome(i.nome);
      return n.includes(alvo) || alvo.includes(n);
    }) || null;
  };

  const gerarFichaIA = async () => {
    if (!iaFTexto.trim() && !iaFImagem) return alert("Cole a receita em texto ou envie uma foto.");
    setIaFLoading(true);
    try {
      const res = await fetch("/api/ia-ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: iaFTexto,
          imagem_base64: iaFImagem?.base64 || null,
          imagem_media_type: iaFImagem?.mediaType || null,
          departamento: deptUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Falha ao ler a receita.");
        return;
      }
      const itens = data.ingredientes.map(ing => {
        const match = encontrarInsumoCorrespondente(ing.nome);
        return {
          nomeOriginal: ing.nome,
          quantidade_lida: ing.quantidade_lida,
          unidade_lida: ing.unidade_lida,
          vinculoId: match ? match.id : "novo",
          novo: { marca: "", unidade_medida: ing.unidade_lida === "g" ? "kg" : ing.unidade_lida === "ml" ? "l" : ing.unidade_lida, custo_unitario: "" },
          cadastrando: false,
        };
      });
      setIaFResultado({
        nome_receita: data.nome_receita,
        rendimento_porcoes: data.rendimento_porcoes,
        modo_preparo: data.modo_preparo,
        itens,
      });
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setIaFLoading(false);
    }
  };

  const atualizarItemIAFicha = (idx, campos) => {
    setIaFResultado(res => ({
      ...res,
      itens: res.itens.map((it, i) => i === idx ? { ...it, ...campos } : it),
    }));
  };

  const cadastrarInsumoIAFicha = async (idx) => {
    const item = iaFResultado.itens[idx];
    if (!item.novo.custo_unitario || Number(item.novo.custo_unitario) <= 0) {
      return alert("Digite o custo do novo ingrediente antes de cadastrar.");
    }
    atualizarItemIAFicha(idx, { cadastrando: true });
    const resp = await salvarInsumo({
      departamento: deptUrl,
      nome: item.nomeOriginal,
      marca: item.novo.marca.trim(),
      unidade_medida: item.novo.unidade_medida,
      custo_unitario: Number(item.novo.custo_unitario),
      unidade_id: unidadeAtiva,
    });
    if (resp.error || !resp.id) {
      atualizarItemIAFicha(idx, { cadastrando: false });
      return alert("Erro ao cadastrar ingrediente: " + (resp.error || "id não retornado"));
    }
    const novoInsumo = {
      id: resp.id, nome: item.nomeOriginal, marca: item.novo.marca,
      unidade_medida: item.novo.unidade_medida, custo_unitario: Number(item.novo.custo_unitario),
      departamento: deptUrl,
    };
    setInsumosAtivos(lista => [...lista, novoInsumo]);
    atualizarItemIAFicha(idx, { vinculoId: resp.id, cadastrando: false });
  };

  const usarFichaIA = () => {
    const pendente = iaFResultado.itens.find(it => it.vinculoId === "novo");
    if (pendente) return alert(`Cadastre ou vincule "${pendente.nomeOriginal}" antes de continuar.`);

    const novosIngFicha = iaFResultado.itens.map(it => {
      const insumo = insumosAtivos.find(i => i.id === it.vinculoId);
      const quantidade = converterParaBase(it.quantidade_lida, it.unidade_lida, insumo.unidade_medida);
      return {
        chave: insumo.id, tipo: "insumo", insumo_id: insumo.id,
        nome: insumo.nome, unidade: insumo.unidade_medida,
        custo_unitario: insumo.custo_unitario, quantidade,
        modo: getSub(insumo.unidade_medida) ? "sub" : "base",
      };
    });

    setForm({
      id: null, departamento: deptUrl,
      nome_receita: iaFResultado.nome_receita,
      rendimento_porcoes: String(iaFResultado.rendimento_porcoes || 1),
      modo_preparo: iaFResultado.modo_preparo,
      eh_base: false, rendimento_unidade: "porcao", peso_porcao_g: "",
    });
    setIngFicha(novosIngFicha);
    setIaExplicacao("");
    setModalIAFicha(false);
    setModalNovo(true);
  };

  // Assistente de IA para o Modo de Preparo
  const [iaExplicacao, setIaExplicacao] = useState("");
  const [iaLoading, setIaLoading] = useState(false);

  const gerarPreparoIA = async () => {
    if (!iaExplicacao.trim()) return alert("Explique com suas palavras como o prato é feito.");
    setIaLoading(true);
    try {
      const res = await fetch("/api/ia-preparo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          explicacao: iaExplicacao,
          nome_receita: form.nome_receita,
          porcoes: form.rendimento_porcoes,
          ingredientes: ingFicha.map(i => ({ nome: i.nome, quantidade: i.quantidade, unidade: i.unidade })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || "Falha ao gerar o modo de preparo.");
        return;
      }
      setForm(f => ({ ...f, modo_preparo: data.modo_preparo }));
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setIaLoading(false);
    }
  };

  const carregar = async () => {
    setLoading(true);
    const [resFichas, resInsumos] = await Promise.all([
       fetchFichas(unidadeAtiva, deptUrl),
       fetchInsumos(unidadeAtiva, deptUrl)
    ]);
    setFichas(resFichas.data || []);
    setInsumosAtivos(resInsumos.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  const filtradas = fichas.filter(f => f.nome_receita.toLowerCase().includes(busca.toLowerCase()));

  const abrirNova = () => {
    setForm({ id: null, departamento: deptUrl, nome_receita: "", rendimento_porcoes: "1", modo_preparo: "", eh_base: false, rendimento_unidade: "porcao", peso_porcao_g: "" });
    setIngFicha([]);
    setIaExplicacao("");
    setCalcQtd("");
    setModalNovo(true);
  };

  const abrirEditar = (ficha) => {
    setForm({
       id: ficha.id,
       departamento: ficha.departamento,
       nome_receita: ficha.nome_receita,
       rendimento_porcoes: ficha.rendimento_porcoes,
       modo_preparo: ficha.modo_preparo || "",
       eh_base: !!ficha.eh_base,
       rendimento_unidade: ficha.rendimento_unidade || "porcao",
       peso_porcao_g: ficha.peso_porcao_g || ""
    });
    setCalcQtd("");
    // Reconstrói os ingredientes: cada um é um INSUMO ou uma BASE (sub-ficha).
    const mapIng = (ficha.fichas_ingredientes || []).map(fi => {
       if (fi.subficha_id) {
          const base = fichas.find(x => x.id === fi.subficha_id);
          return {
             chave: fi.subficha_id, tipo: "base", subficha_id: fi.subficha_id,
             nome: base?.nome_receita || "Base",
             unidade: base?.rendimento_unidade || "un",
             custo_unitario: base ? custoUnitBase(base, fichas) : 0,
             quantidade: fi.quantidade,
             modo: getSub(base?.rendimento_unidade) ? "sub" : "base",
          };
       }
       return {
          chave: fi.insumos.id, tipo: "insumo", insumo_id: fi.insumos.id,
          nome: fi.insumos.nome, unidade: fi.insumos.unidade_medida,
          custo_unitario: fi.insumos.custo_unitario, quantidade: fi.quantidade,
          modo: getSub(fi.insumos.unidade_medida) ? "sub" : "base",
       };
    });
    setIngFicha(mapIng);
    setIaExplicacao("");
    setModalNovo(true);
  };

  const calcularCustoTotal = (ingredientesLista) => {
    return ingredientesLista.reduce((acc, ing) => acc + (ing.custo_unitario * ing.quantidade), 0);
  };

  // Adiciona insumo ou base. `valor` = "insumo:<id>" ou "base:<id>"
  const addIngrediente = (valor) => {
    if (!valor) return;
    const [tipo, id] = valor.split(":");
    if (ingFicha.find(i => i.chave === id)) return; // já existe

    if (tipo === "base") {
       const base = fichas.find(f => f.id === id);
       if (!base) return;
       setIngFicha([...ingFicha, {
          chave: base.id, tipo: "base", subficha_id: base.id,
          nome: base.nome_receita, unidade: base.rendimento_unidade || "un",
          custo_unitario: custoUnitBase(base, fichas), quantidade: 0,
          modo: getSub(base.rendimento_unidade) ? "sub" : "base",
       }]);
    } else {
       const insumoDb = insumosAtivos.find(i => i.id === id);
       if (!insumoDb) return;
       setIngFicha([...ingFicha, {
          chave: insumoDb.id, tipo: "insumo", insumo_id: insumoDb.id,
          nome: insumoDb.nome, unidade: insumoDb.unidade_medida,
          custo_unitario: insumoDb.custo_unitario, quantidade: 0,
          modo: getSub(insumoDb.unidade_medida) ? "sub" : "base",
       }]);
    }
  };

  // Recebe a quantidade JÁ em unidade-base (a conversão acontece no onChange do input)
  const updateQtd = (chave, qtdBase) => {
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, quantidade: Number(qtdBase) || 0 } : i));
  };

  const toggleModo = (chave) => {
    setIngFicha(lista => lista.map(i => i.chave === chave ? { ...i, modo: i.modo === 'sub' ? 'base' : 'sub' } : i));
  };

  const removeIngrediente = (chave) => {
    setIngFicha(lista => lista.filter(i => i.chave !== chave));
  };

  const handleSalvar = async () => {
    if(!form.nome_receita.trim()) return alert("Digite o nome da receita");
    if(!form.rendimento_porcoes) return alert("Digite o rendimento");

    // Filtra ingredientes que estão com qtd = 0
    const ingValidos = ingFicha.filter(i => i.quantidade > 0);
    if(ingValidos.length === 0) return alert("Adicione pelo menos um ingrediente com quantidade válida.");

    const erro = await salvarFicha(
       {
          id: form.id,
          unidade_id: unidadeAtiva,
          departamento: form.departamento,
          nome_receita: form.nome_receita,
          rendimento_porcoes: Number(form.rendimento_porcoes),
          modo_preparo: form.modo_preparo,
          eh_base: !!form.eh_base,
          rendimento_unidade: form.rendimento_unidade || "porcao",
          peso_porcao_g: form.peso_porcao_g ? Number(form.peso_porcao_g) : null
       },
       ingValidos.map(i => ({
          insumo_id: i.tipo === "insumo" ? i.insumo_id : null,
          subficha_id: i.tipo === "base" ? i.subficha_id : null,
          quantidade: i.quantidade
       }))
    );

    if(erro.error) return alert("Erro ao salvar: " + erro.error);
    
    setModalNovo(false);
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Deseja excluir esta ficha técnica permanentemente?")) {
       await removerFicha(id);
       carregar();
    }
  };

  const imprimirFicha = (f) => {
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) return alert("Habilite os popups para imprimir a ficha técnica.");
    const SUB = { kg: { s: 'g', fa: 1000 }, l: { s: 'ml', fa: 1000 } };
    const fmtQtd = (qtd, un) => {
       const c = SUB[String(un || '').toLowerCase()];
       return c ? `${(+(qtd * c.fa)).toLocaleString('pt-BR')} ${c.s}` : `${qtd} ${String(un || '').toUpperCase()}`;
    };
    let custoTotal = 0;
    const rows = (f.fichas_ingredientes || []).map(fi => {
       let nome, unidade, custo;
       if (fi.subficha_id) {
          const base = fichas.find(x => x.id === fi.subficha_id);
          nome = (base?.nome_receita || 'Base') + ' (base)';
          unidade = base?.rendimento_unidade;
          custo = base ? custoUnitBase(base, fichas) * fi.quantidade : 0;
       } else {
          nome = fi.insumos?.nome || 'Insumo';
          unidade = fi.insumos?.unidade_medida;
          custo = (fi.insumos?.custo_unitario || 0) * fi.quantidade;
       }
       custoTotal += custo;
       return `<tr><td>${nome}</td><td class="c">${fmtQtd(fi.quantidade, unidade)}</td><td class="r">R$ ${custo.toFixed(2)}</td></tr>`;
    }).join('');
    const rende = f.rendimento_porcoes || 1;
    const peso = infoPesoFicha(f, fichas);
    // Porções reais: derivadas do peso quando o rendimento é em kg/g/l/ml
    const porcoesReais = peso?.porcoes || rende;
    const custoPorcao = custoTotal / (porcoesReais || 1);
    const unR = String(f.rendimento_unidade || 'porcao').toLowerCase();
    const labelUnPrint = { porcao: `porç${rende > 1 ? 'ões' : 'ão'}`, kg: 'kg', g: 'g', l: 'L', ml: 'ml', un: 'un' }[unR] || unR;
    const linhaRendeu = (unR !== 'porcao' && unR !== 'un' && peso?.porcoes && peso?.pesoPorcaoG)
       ? ` — rendeu ${(+peso.porcoes.toFixed(1)).toLocaleString('pt-BR')} porções de ${peso.pesoPorcaoG}g`
       : '';
    const linhaPeso = peso
       ? `<div class="meta">Peso total: ${fmtG(peso.pesoTotalG)}${peso.pesoPorcaoG ? ` (${peso.pesoPorcaoG}g por porção)` : ''} · ${peso.liquido ? '1 L' : '1 kg'} = R$ ${peso.custoKg.toFixed(2)}</div>`
       : '';
    win.document.write(`
       <!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ficha Técnica - ${f.nome_receita}</title>
       <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:24px;max-width:720px;margin:0 auto}
          .head{border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:16px}
          .tag{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
          h1{font-size:26px;margin:4px 0}
          .meta{font-size:13px;color:#475569;font-weight:bold}
          h2{font-size:13px;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin:20px 0 8px}
          table{width:100%;border-collapse:collapse;font-size:14px}
          th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #e2e8f0}
          th{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b}
          td.c{text-align:center}td.r,th.r{text-align:right}
          .totais{display:flex;justify-content:flex-end;gap:24px;margin-top:12px;font-size:14px}
          .totais b{font-size:18px}
          .preparo{margin-top:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
          @media print{@page{margin:14mm}}
       </style></head><body>
          <div class="head">
             <div class="tag">Ficha Técnica${f.departamento ? ' — ' + f.departamento : ''}</div>
             <h1>${f.nome_receita}</h1>
             <div class="meta">Rendimento: ${Number(rende).toLocaleString('pt-BR')} ${labelUnPrint}${linhaRendeu}</div>
             ${linhaPeso}
          </div>
          <h2>Ingredientes</h2>
          <table>
             <thead><tr><th>Ingrediente</th><th class="c">Quantidade</th><th class="r">Custo</th></tr></thead>
             <tbody>${rows || '<tr><td colspan="3">Sem ingredientes cadastrados.</td></tr>'}</tbody>
          </table>
          <div class="totais">
             <div>Custo por porção: <b>R$ ${custoPorcao.toFixed(2)}</b></div>
             <div>Custo total: <b>R$ ${custoTotal.toFixed(2)}</b></div>
          </div>
          <h2>Modo de Preparo</h2>
          <div class="preparo">${f.modo_preparo ? f.modo_preparo : 'Não informado.'}</div>
       </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 pt-6 pb-6 px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${deptUrl === 'bar' ? 'bg-slate-100 text-emerald-600' : 'bg-slate-100 text-slate-800'}`}>
                 <LayoutList size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Fichas Técnicas</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Receituário e Custos - {deptUrl}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <button onClick={abrirModalIAFicha} className="flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-5 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-sm">
                  <Sparkles size={18} /> Montar com IA
               </button>
               <button onClick={abrirNova} className="flex items-center gap-2 text-white px-5 py-3 rounded-xl font-bold transition-colors shadow-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20">
                  <Plus size={18} /> Nova Ficha
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-6 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar receita..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         {loading ? (
            <p className="font-bold text-slate-500">Buscando receitas...</p>
         ) : filtradas.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <LayoutList size={40} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-xl font-black text-slate-700">Nenhuma ficha encontrada</h3>
               <p className="text-slate-500 mt-2 font-medium">Cadastre suas receitas para calcular automaticamente o custo do prato.</p>
            </div>
         ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {filtradas.map(f => {
                  // Custo recursivo (resolve bases/sub-receitas)
                  const custoFicha = custoTotalDaFicha(f, fichas);
                  const peso = infoPesoFicha(f, fichas);
                  // Custo por porção: usa as porções REAIS (derivadas do peso quando
                  // o rendimento é em kg/g/l/ml), senão divide pelo rendimento direto
                  const custoPorcao = peso?.custoPorcao ?? (custoFicha / (f.rendimento_porcoes || 1));
                  const unR = String(f.rendimento_unidade || "porcao").toLowerCase();
                  const labelUn = { porcao: "Porções", kg: "kg", g: "g", l: "L", ml: "ml", un: "un" }[unR] || unR;

                  return (
                     <div key={f.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                           <span className={`w-10 h-10 rounded-full flex items-center justify-center ${f.departamento === 'bar' ? 'bg-slate-50 text-emerald-600' : 'bg-slate-50 text-emerald-600'}`}>
                              {f.departamento === 'bar' ? <Wine size={18}/> : <UtensilsCrossed size={18}/>}
                           </span>
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => imprimirFicha(f)} title="Imprimir ficha técnica" className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-emerald-600"><Printer size={16}/></button>
                              <button onClick={() => abrirEditar(f)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-emerald-600"><Edit3 size={16}/></button>
                              <button onClick={() => handleRemover(f.id)} className="p-2 bg-slate-50 rounded-lg text-slate-500 hover:text-emerald-600"><Trash2 size={16}/></button>
                           </div>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 leading-tight mb-1">{f.nome_receita}</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                           Rende: {Number(f.rendimento_porcoes).toLocaleString("pt-BR")} {labelUn}
                           {unR === "porcao" && f.peso_porcao_g ? ` de ${f.peso_porcao_g}g` : ''}
                        </p>
                        {!peso ? <div className="mb-4"/> : (
                           <div className="mb-4">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                 Peso total: {fmtG(peso.pesoTotalG)} · {peso.liquido ? '1 L' : '1 kg'} = <span className="text-emerald-600">{fmtBRL(peso.custoKg)}</span>
                              </p>
                              {/* Quando rende em peso e tem porção definida: mostra quantas porções saíram */}
                              {unR !== "porcao" && unR !== "un" && peso.porcoes !== null && peso.pesoPorcaoG && (
                                 <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mt-0.5">
                                    = {(+peso.porcoes.toFixed(1)).toLocaleString("pt-BR")} porções de {peso.pesoPorcaoG}g
                                 </p>
                              )}
                           </div>
                        )}

                        <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                           <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Custo / Porção</p>
                              <p className="text-2xl font-black text-emerald-600">{fmtBRL(custoPorcao)}</p>
                           </div>
                           <p className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-md">Total: {fmtBRL(custoFicha)}</p>
                        </div>
                     </div>
                  );
               })}
            </div>
         )}
      </div>

      {/* MODAL DE CRIAÇÃO DA FICHA TÉCNICA */}
      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col">
               
               {/* HEADER DO MODAL */}
               <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Receita" : "Nova Receita"}</h2>
                     <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Custo Total Atual: <span className="text-emerald-600 font-black">{fmtBRL(calcularCustoTotal(ingFicha))}</span></p>
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* BODY DO MODAL COM SCROLL */}
               <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8">
                  
                  {/* COLUNA ESQUERDA: Dados Básicos */}
                  <div className="space-y-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome da Receita</label>
                        <input type="text" placeholder="Ex: Caipirinha de Morango" value={form.nome_receita} onChange={e=>setForm({...form, nome_receita: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                     </div>
                     <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={form.eh_base} onChange={e=>setForm({...form, eh_base: e.target.checked})} className="w-4 h-4 accent-purple-600"/>
                           <span className="text-xs font-black text-purple-700 uppercase tracking-widest">É uma base / pré-preparo</span>
                        </label>
                        <p className="text-[11px] text-purple-500 mt-1 font-medium">Marque se esta receita é usada como ingrediente de outros pratos (ex.: base de tucupi, molho, massa).</p>
                     </div>
                     <div className="grid grid-cols-2 gap-3">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Rendimento (quanto a receita gera)</label>
                           <input type="number" step="0.01" placeholder="Ex: 4 ou 2349" value={form.rendimento_porcoes} onChange={e=>setForm({...form, rendimento_porcoes: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Unidade de medida</label>
                           <select value={form.rendimento_unidade} onChange={e=>setForm({...form, rendimento_unidade: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500 shadow-sm">
                              <option value="porcao">Porções</option>
                              <option value="kg">Kilos (kg)</option>
                              <option value="g">Gramas (g)</option>
                              <option value="l">Litros (L)</option>
                              <option value="ml">Mililitros (ml)</option>
                              <option value="un">Unidades (un)</option>
                           </select>
                        </div>
                     </div>

                     {/* Rendimento estimado pela SOMA dos ingredientes */}
                     {(() => {
                        const est = rendimentoPelosIngredientes(ingFicha);
                        if (!est) return null;
                        const label = { kg: "kg", g: "g", l: "L", ml: "ml" }[est.unidade];
                        return (
                           <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Pelos ingredientes: {est.valor.toLocaleString("pt-BR")} {label}</p>
                                 <p className="text-[10px] font-medium text-emerald-700/70">Soma total das quantidades (antes de perdas no cozimento).</p>
                              </div>
                              <button type="button" onClick={() => setForm(f => ({ ...f, rendimento_porcoes: String(est.valor), rendimento_unidade: est.unidade }))} className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors active:scale-95">
                                 Usar
                              </button>
                           </div>
                        );
                     })()}

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Peso por porção/unidade em gramas (opcional)</label>
                        <input type="number" step="0.1" min="0" placeholder="Ex: 35 (cada bolinho pesa 35g)" value={form.peso_porcao_g} onChange={e=>setForm({...form, peso_porcao_g: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-sm"/>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Com rendimento em porções: calcula o peso total. Com rendimento em kg/g: calcula quantas porções renderam. Sempre dá o custo do kg e o desmembrar.</p>
                     </div>

                     {/* PESO TOTAL + CUSTO/KG + DESMEMBRAR (ao vivo, conforme preenche) */}
                     {(() => {
                        const rendimento = Number(form.rendimento_porcoes) || 0;
                        const pesoPorcao = Number(form.peso_porcao_g) || 0;
                        const unR = String(form.rendimento_unidade || "porcao").toLowerCase();
                        const pesoTotalG = pesoTotalDaFicha(rendimento, unR, pesoPorcao);
                        if (!pesoTotalG) return null;

                        const custoTotal = calcularCustoTotal(ingFicha);
                        const custoKg = custoTotal / (pesoTotalG / 1000);
                        const labelKg = (unR === "l" || unR === "ml") ? "1 L" : "1 kg";
                        // Quantas porções essa produção rende (peso total ÷ peso da porção)
                        const porcoesRendidas = (unR === "porcao" || unR === "un")
                           ? rendimento
                           : (pesoPorcao > 0 ? pesoTotalG / pesoPorcao : null);

                        // desmembrar: converte a quantidade digitada para gramas
                        const q = Number(calcQtd) || 0;
                        let gramas = 0;
                        if (calcUn === "g") gramas = q;
                        else if (calcUn === "kg") gramas = q * 1000;
                        else gramas = pesoPorcao > 0 ? q * pesoPorcao : 0;
                        const custoCalc = custoKg * (gramas / 1000);
                        const unidadesCalc = pesoPorcao > 0 ? gramas / pesoPorcao : null;

                        return (
                           <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-3">
                              <div className="flex justify-between items-center">
                                 <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Peso total produzido</p>
                                    <p className="text-lg font-black">{fmtG(pesoTotalG)}</p>
                                    {porcoesRendidas !== null && pesoPorcao > 0 && (
                                       <p className="text-[10px] font-bold text-slate-400">= {(+porcoesRendidas.toFixed(1)).toLocaleString("pt-BR")} porções de {pesoPorcao}g</p>
                                    )}
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{labelKg} deste produto custa</p>
                                    <p className="text-lg font-black text-emerald-400">{fmtBRL(custoKg)}</p>
                                 </div>
                              </div>
                              <div className="border-t border-slate-700 pt-3">
                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Desmembrar — quanto vou usar?</p>
                                 <div className="flex gap-2">
                                    <input type="number" step="0.01" min="0" placeholder="Qtd" value={calcQtd} onChange={e=>setCalcQtd(e.target.value)} className="flex-1 p-2.5 bg-slate-800 border border-slate-700 rounded-lg font-black text-white outline-none focus:border-emerald-500 text-center"/>
                                    <select value={calcUn} onChange={e=>setCalcUn(e.target.value)} className="w-20 p-2.5 bg-slate-800 border border-slate-700 rounded-lg font-bold text-white outline-none focus:border-emerald-500 text-sm">
                                       <option value="g">g</option>
                                       <option value="kg">kg</option>
                                       {pesoPorcao > 0 && <option value="un">un</option>}
                                    </select>
                                 </div>
                                 {gramas > 0 && (
                                    <div className="flex justify-between items-center mt-2 text-sm">
                                       <span className="font-bold text-slate-300">
                                          = {fmtG(gramas)}{unidadesCalc !== null ? ` · ${(+unidadesCalc.toFixed(1)).toLocaleString("pt-BR")} un` : ""}
                                       </span>
                                       <span className="font-black text-emerald-400 text-lg">{fmtBRL(custoCalc)}</span>
                                    </div>
                                 )}
                              </div>
                           </div>
                        );
                     })()}

                     {/* COMPOSIÇÃO DA PORÇÃO: quantas gramas de cada ingrediente vão em 1 porção */}
                     {(() => {
                        const rendimento = Number(form.rendimento_porcoes) || 0;
                        if (!rendimento) return null;
                        const pesoPorcaoFinal = Number(form.peso_porcao_g) || 0;

                        // Nº de porções: direto (porções/un) ou derivado do peso total
                        const unR = String(form.rendimento_unidade || "porcao").toLowerCase();
                        const pesoTotalG = pesoTotalDaFicha(rendimento, unR, pesoPorcaoFinal);
                        const nPorcoes = (unR === "porcao" || unR === "un")
                           ? rendimento
                           : (pesoPorcaoFinal > 0 && pesoTotalG > 0 ? pesoTotalG / pesoPorcaoFinal : 0);
                        if (!nPorcoes) return null;

                        // Converte cada ingrediente pesável para gramas por porção
                        const composicao = ingFicha.map(ing => {
                           const u = String(ing.unidade).toLowerCase();
                           let g = null;
                           if ((u === "kg" || u === "l") && ing.quantidade > 0) {
                              g = (ing.quantidade * 1000) / nPorcoes;
                           } else if (ing.tipo === "base" && u === "un" && ing.quantidade > 0) {
                              const b = fichas.find(x => x.id === ing.subficha_id);
                              const pg = Number(b?.peso_porcao_g) || 0;
                              if (pg) g = (ing.quantidade * pg) / nPorcoes;
                           }
                           return g ? { nome: ing.nome, g } : null;
                        }).filter(Boolean);

                        if (composicao.length < 2) return null;
                        const totalInNatura = composicao.reduce((a, c) => a + c.g, 0);
                        // % sobre o peso final da porção (se informado) ou sobre o total in natura
                        const baseRef = pesoPorcaoFinal > 0 ? pesoPorcaoFinal : totalInNatura;
                        const difPreparo = pesoPorcaoFinal > 0 ? ((pesoPorcaoFinal - totalInNatura) / totalInNatura) * 100 : null;

                        return (
                           <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Composição da porção{pesoPorcaoFinal > 0 ? ` (${pesoPorcaoFinal}g final)` : ''}</p>
                              <div className="space-y-2">
                                 {composicao.map((c, i) => {
                                    const pct = (c.g / baseRef) * 100;
                                    return (
                                       <div key={i}>
                                          <div className="flex justify-between text-xs font-bold text-slate-700 mb-0.5">
                                             <span className="truncate">{c.nome}</span>
                                             <span className="shrink-0 ml-2">{(+c.g.toFixed(1)).toLocaleString("pt-BR")} g · {pct.toFixed(0)}%</span>
                                          </div>
                                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                             <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(pct, 100)}%` }} />
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                              <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 text-[10px] font-bold text-slate-500">
                                 <span>Total in natura: {(+totalInNatura.toFixed(1)).toLocaleString("pt-BR")} g / porção</span>
                                 {difPreparo !== null && Math.abs(difPreparo) >= 1 && (
                                    <span className={difPreparo < 0 ? "text-red-500" : "text-emerald-600"}>
                                       {difPreparo < 0 ? `Perda no preparo: ${Math.abs(difPreparo).toFixed(0)}%` : `Ganho no preparo: +${difPreparo.toFixed(0)}%`}
                                    </span>
                                 )}
                              </div>
                           </div>
                        );
                     })()}

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modo de Preparo</label>

                        {/* Assistente de IA: você explica solto, a IA estrutura em etapas */}
                        <div className="mt-1 mb-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                           <div className="flex items-center gap-2 mb-2">
                              <Sparkles size={15} className="text-emerald-600" />
                              <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Explique com suas palavras — a IA organiza</span>
                           </div>
                           <textarea
                              placeholder="Ex: refogo a cebola no azeite numa panela, junto o camarão, deixo uns 5 min, jogo o leite de coco e o tucupi e cozinho até engrossar..."
                              value={iaExplicacao}
                              onChange={e => setIaExplicacao(e.target.value)}
                              className="w-full h-20 p-3 bg-white border border-emerald-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                           <button
                              type="button"
                              onClick={gerarPreparoIA}
                              disabled={iaLoading}
                              className="mt-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                           >
                              {iaLoading
                                 ? <><Loader2 size={16} className="animate-spin" /> Estruturando etapas...</>
                                 : <><Sparkles size={16} /> Gerar modo de preparo</>}
                           </button>
                           <p className="text-[10px] text-emerald-700/70 font-medium mt-1.5 leading-tight">A IA deduz panela, se vai ao fogo, o tempo de cada etapa e o tempo total. Você pode editar o texto depois.</p>
                        </div>

                        <textarea placeholder="Passo a passo da execução..." value={form.modo_preparo} onChange={e=>setForm({...form, modo_preparo: e.target.value})} className="w-full h-40 p-4 mt-1 bg-white border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm resize-none"></textarea>
                     </div>
                  </div>

                  {/* COLUNA DIREITA: Ingredientes da Ficha */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full max-h-[500px]">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 block">Composição (Ingredientes)</label>
                     
                     {/* ADD INGREDIENTE */}
                     <div className="flex gap-2 mb-4">
                        <select onChange={e => { addIngrediente(e.target.value); e.target.value=""; }} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-600 outline-none focus:border-emerald-500 text-sm">
                           <option value="">+ Adicionar insumo ou base...</option>
                           <optgroup label="Insumos">
                              {insumosAtivos.map(i => <option key={i.id} value={`insumo:${i.id}`}>{i.nome} ({i.unidade_medida})</option>)}
                           </optgroup>
                           {basesDisponiveis.length > 0 && (
                              <optgroup label="Bases / Pré-preparos">
                                 {basesDisponiveis.map(b => <option key={b.id} value={`base:${b.id}`}>{b.nome_receita} ({b.rendimento_unidade})</option>)}
                              </optgroup>
                           )}
                        </select>
                     </div>

                     {/* LISTA DE INGREDIENTES */}
                     <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {ingFicha.length === 0 && (
                           <div className="text-center p-6 text-slate-500 font-medium text-sm">
                              Selecione ingredientes acima para montar a ficha técnica e calcular o custo.
                           </div>
                        )}
                        {ingFicha.map(ing => {
                           const sub = getSub(ing.unidade);
                           const emSub = sub && ing.modo === "sub";
                           const fator = emSub ? sub.f : 1;
                           const unidadeLabel = emSub ? sub.sub : ing.unidade;
                           // valor exibido = quantidade-base convertida pra unidade de digitação
                           const valorExibido = ing.quantidade ? +(ing.quantidade * fator).toFixed(4) : "";
                           const onChangeQtd = (e) => {
                              const v = Number(e.target.value) || 0;
                              updateQtd(ing.chave, v / fator); // sempre grava em unidade-base
                           };
                           return (
                           <div key={ing.chave} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3 group">
                              <div className="flex-1 min-w-0">
                                 <p className="font-bold text-slate-800 text-sm truncate flex items-center gap-1.5">
                                    {ing.nome}
                                    {ing.tipo === "base" && <span className="text-[8px] font-black uppercase tracking-widest bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Base</span>}
                                 </p>
                                 <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Custo: {fmtBRL(ing.custo_unitario * ing.quantidade)}</p>
                                 {/* Equivalência em peso: 5 un de bolinho de 35g = 175 g (0,175 kg) */}
                                 {(() => {
                                    if (ing.tipo !== "base" || String(ing.unidade).toLowerCase() !== "un" || !ing.quantidade) return null;
                                    const baseFicha = fichas.find(x => x.id === ing.subficha_id);
                                    const pg = Number(baseFicha?.peso_porcao_g) || 0;
                                    if (!pg) return null;
                                    const g = ing.quantidade * pg;
                                    return (
                                       <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                                          = {(+g.toFixed(1)).toLocaleString("pt-BR")} g ({(g / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg)
                                       </p>
                                    );
                                 })()}
                              </div>
                              <div className="flex items-center gap-2">
                                 <input
                                    type="number"
                                    step={emSub ? "1" : "0.001"}
                                    min="0"
                                    placeholder="0"
                                    value={valorExibido}
                                    onChange={onChangeQtd}
                                    className="w-20 p-2 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"
                                 />
                                 {sub ? (
                                    <button
                                       type="button"
                                       onClick={() => toggleModo(ing.chave)}
                                       title="Alternar unidade de lançamento"
                                       className="text-[10px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md px-1.5 py-1 uppercase w-9 transition-colors"
                                    >
                                       {unidadeLabel}
                                    </button>
                                 ) : (
                                    <span className="text-[10px] font-black text-slate-500 uppercase w-9 text-center">{unidadeLabel}</span>
                                 )}
                              </div>
                              <button onClick={() => removeIngrediente(ing.chave)} className="p-2 text-slate-500 hover:text-slate-600 transition-colors bg-white rounded-lg border border-slate-200">
                                 <Trash2 size={14}/>
                              </button>
                           </div>
                           );
                        })}
                     </div>

                  </div>

               </div>

               {/* FOOTER DO MODAL */}
               <div className="p-6 border-t border-slate-100 bg-white">
                  <button onClick={handleSalvar} className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> Salvar Receita ({fmtBRL(calcularCustoTotal(ingFicha))})
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* MONTAR FICHA COM IA (texto/foto da receita) */}
      {modalIAFicha && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-[32px] w-full max-w-3xl my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center p-8 pb-6 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Sparkles size={22}/></div>
                     <div>
                        <h2 className="font-black text-2xl text-slate-800">Montar Ficha Técnica com IA</h2>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">Cole a receita ou envie uma foto — a IA monta nome, ingredientes e modo de preparo</p>
                     </div>
                  </div>
                  <button onClick={() => setModalIAFicha(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-8 overflow-y-auto custom-scrollbar space-y-5">
                  {!iaFResultado ? (
                     <>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Colar a receita (opcional se enviar foto)</label>
                           <textarea
                              placeholder={"Ex:\nTacacá: refogo camarão seco no azeite, junto tucupi e goma, cozinho 15 min mexendo, sirvo com jambu e pimenta..."}
                              value={iaFTexto}
                              onChange={e => setIaFTexto(e.target.value)}
                              className="w-full h-32 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ou enviar foto (caderno de receitas, print, etc)</label>
                           <input ref={fileInputFichaRef} type="file" accept="image/*" onChange={handleSelecionarImagemFicha} className="hidden" />
                           {iaFImagem ? (
                              <div className="mt-1 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                 <img src={iaFImagem.previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                                 <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-700 truncate">{iaFImagem.nomeArquivo}</p>
                                    <button onClick={() => setIaFImagem(null)} className="text-xs font-bold text-red-500 hover:text-red-600 mt-1">Remover foto</button>
                                 </div>
                              </div>
                           ) : (
                              <button type="button" onClick={() => fileInputFichaRef.current?.click()} className="w-full mt-1 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center gap-2 text-slate-400 hover:text-emerald-600 hover:border-emerald-300 transition-colors">
                                 <Camera size={24} />
                                 <span className="font-bold text-sm">Tirar foto ou escolher da galeria</span>
                              </button>
                           )}
                        </div>

                        <button
                           onClick={gerarFichaIA}
                           disabled={iaFLoading}
                           className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                           {iaFLoading ? <><Loader2 size={18} className="animate-spin"/> Montando ficha técnica...</> : <><Sparkles size={18}/> Montar ficha técnica</>}
                        </button>
                     </>
                  ) : (
                     <>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do prato (vai pro cardápio)</label>
                           <input type="text" value={iaFResultado.nome_receita} onChange={e=>setIaFResultado({...iaFResultado, nome_receita: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500" />
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-3 block">Rendimento (porções)</label>
                           <input type="number" value={iaFResultado.rendimento_porcoes} onChange={e=>setIaFResultado({...iaFResultado, rendimento_porcoes: e.target.value})} className="w-24 p-3 mt-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 outline-none focus:border-emerald-500" />
                        </div>

                        <div>
                           <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ingredientes identificados</p>
                           <div className="space-y-2">
                              {iaFResultado.itens.map((it, idx) => {
                                 const vinculado = it.vinculoId !== "novo";
                                 return (
                                    <div key={idx} className={`p-3 rounded-xl border ${vinculado ? 'bg-emerald-50/40 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                                       <div className="flex items-center gap-2 flex-wrap">
                                          {vinculado ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0"/> : <AlertTriangle size={16} className="text-amber-600 shrink-0"/>}
                                          <span className="font-bold text-slate-800 text-sm">{it.nomeOriginal}</span>
                                          <span className="text-xs font-bold text-slate-400">({it.quantidade_lida}{it.unidade_lida})</span>
                                          <select
                                             value={it.vinculoId}
                                             onChange={e => atualizarItemIAFicha(idx, { vinculoId: e.target.value })}
                                             className="ml-auto p-2 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-emerald-500"
                                          >
                                             <option value="novo">-- Cadastrar novo --</option>
                                             {insumosAtivos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                                          </select>
                                       </div>

                                       {!vinculado && (
                                          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                                             <input type="text" placeholder="Marca (opcional)" value={it.novo.marca} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, marca: e.target.value } })} className="w-32 p-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-emerald-500" />
                                             <select value={it.novo.unidade_medida} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, unidade_medida: e.target.value } })} className="w-20 p-2 bg-white border border-slate-200 rounded-lg font-bold text-xs outline-none focus:border-emerald-500">
                                                <option value="kg">KG</option>
                                                <option value="l">L</option>
                                                <option value="un">UN</option>
                                                <option value="g">G</option>
                                                <option value="ml">ML</option>
                                             </select>
                                             <input type="number" step="0.01" placeholder="Custo/base" value={it.novo.custo_unitario} onChange={e=>atualizarItemIAFicha(idx, { novo: { ...it.novo, custo_unitario: e.target.value } })} className="w-24 p-2 bg-emerald-50 border border-emerald-200 rounded-lg font-black text-emerald-600 text-xs outline-none focus:border-emerald-500" />
                                             <button onClick={() => cadastrarInsumoIAFicha(idx)} disabled={it.cadastrando} className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
                                                {it.cadastrando ? <Loader2 size={12} className="animate-spin"/> : null} Cadastrar e usar
                                             </button>
                                          </div>
                                       )}
                                    </div>
                                 );
                              })}
                           </div>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Modo de preparo (editável)</label>
                           <textarea value={iaFResultado.modo_preparo} onChange={e=>setIaFResultado({...iaFResultado, modo_preparo: e.target.value})} className="w-full h-32 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 text-sm outline-none focus:border-emerald-500 resize-none"></textarea>
                        </div>

                        <button onClick={() => setIaFResultado(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">← Voltar e enviar outra receita/foto</button>
                     </>
                  )}
               </div>

               {iaFResultado && (
                  <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0">
                     <button onClick={usarFichaIA} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                        <Save size={20}/> Usar esta ficha
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
       <FichasRunner />
    </Suspense>
  );
}
