"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchProdutos, salvarProduto, removerProduto, removerProdutoComPedidos } from "../../../lib/vendas";
import { fetchMontagens, inserirMontagem } from "../../../lib/montagem";
import { fetchFichas } from "../../../lib/operacao"; // Pra linkar o custo
import { fetchEmbalagens } from "../../../lib/embalagens";
import { supabase } from "../../../lib/supabase";
import { UtensilsCrossed, Plus, Search, Edit3, X, Save, ArrowLeft, Tag, Barcode, Image as ImageIcon, Trash2, ListPlus, Percent, Sparkles, Loader2, Printer, ClipboardList, Package, UploadCloud } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
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
// Nº real de porções de uma ficha: direto (porções/un) ou derivado do peso
// total quando o rendimento é em kg/g/l/ml (peso total ÷ peso da porção).
function porcoesDaFicha(f) {
  const rend = Number(f?.rendimento_porcoes) || 1;
  const un = String(f?.rendimento_unidade || "porcao").toLowerCase();
  if (un === "porcao" || un === "un") return rend;
  const pesoPorcao = Number(f?.peso_porcao_g) || 0;
  const pesoTotalG = (un === "kg" || un === "l") ? rend * 1000 : rend;
  return pesoPorcao > 0 ? pesoTotalG / pesoPorcao : rend;
}

// Componentes do produto: a composição múltipla (várias fichas com quantidade)
// ou, nos produtos antigos, a ficha única como componente de qtd 1.
function componentesDoProduto(p) {
  if (Array.isArray(p?.composicao) && p.composicao.length) return p.composicao;
  return p?.ficha_id ? [{ ficha_id: p.ficha_id, qtd: 1 }] : [];
}

// Custo por porção do PRODUTO = soma dos componentes (porções de cada ficha × qtd) + embalagens
function custoPorcaoProduto(p, todasFichas, todasEmbalagens = []) {
  const comps = componentesDoProduto(p);
  let total = 0, achouAlguma = false;
  
  // 1. Custo das Fichas Técnicas
  if (comps.length) {
    comps.forEach(c => {
      const f = todasFichas.find(x => x.id === c.ficha_id);
      if (!f) return;
      achouAlguma = true;
      total += (custoTotalDaFicha(f, todasFichas) / porcoesDaFicha(f)) * (Number(c.qtd) || 1);
    });
  }

  // 2. Custo das Embalagens
  if (Array.isArray(p?.embalagens) && p.embalagens.length && todasEmbalagens.length) {
    p.embalagens.forEach(emb => {
      const dbEmb = todasEmbalagens.find(e => e.id === emb.embalagem_id);
      if (dbEmb) {
        achouAlguma = true;
        total += (Number(dbEmb.preco_unitario) || 0) * (Number(emb.qtd) || 1);
      }
    });
  }

  return achouAlguma ? total : null;
}

// CMV (%) = custo por porção do produto / preço de venda. null se não dá pra calcular.
function calcCmv(precoVenda, produto, todasFichas, todasEmbalagens = []) {
  const preco = Number(precoVenda) || 0;
  if (!preco) return null;
  const custoPorcao = custoPorcaoProduto(produto, todasFichas, todasEmbalagens);
  if (custoPorcao === null) return null;
  return (custoPorcao / preco) * 100;
}
const corCmv = (cmv) => cmv > 30
  ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-600" }
  : { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600" };

function CardapioRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const catUrl = searchParams.get("cat") || "";

  const { unidadeAtiva, unidadeInfo } = useERP();
  const [produtos, setProdutos] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [embalagensDB, setEmbalagensDB] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  
  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState({
     id: null,
     nome_produto: "",
     categoria: "Pratos Principais",
     departamento: "cozinha",
     tempo_preparo_base: 15,
     preco_venda: "",
     ficha_id: "",
     composicao: [],
     embalagens: [],
     codigo_barras: "",
     imagem_url: ""
  });

  const [novoModNome, setNovoModNome] = useState("");
  const [novoModPreco, setNovoModPreco] = useState("");

  // Categoria: filtro por chips + criação de categorias próprias no modal
  const [catFiltro, setCatFiltro] = useState(catUrl); // "" = todas
  const [criandoCategoria, setCriandoCategoria] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");

  const CATEGORIAS_PADRAO = ["Bebidas", "Entradas", "Pratos Principais", "Sobremesas", "Porções", "Combos", "Pizzas", "Lanches"];

  // Guia de montagem do prato (IA) — para padronizar e imprimir/colar na parede
  const [modalGuia, setModalGuia] = useState(false);
  const [guiaProduto, setGuiaProduto] = useState(null);
  const [guiaObs, setGuiaObs] = useState("");
  const [guiaLoading, setGuiaLoading] = useState(false);
  const [guiaResultado, setGuiaResultado] = useState(null);

  // Ingredientes por porção de um produto — soma TODOS os componentes da
  // composição (ou a ficha única dos produtos antigos).
  const ingredientesDoProduto = (produto) => {
    const resultado = [];
    componentesDoProduto(produto).forEach(comp => {
      const ficha = fichas.find(f => f.id === comp.ficha_id);
      if (!ficha) return;
      const nporc = porcoesDaFicha(ficha) || 1;
      const fator = (Number(comp.qtd) || 1) / nporc;
      (ficha.fichas_ingredientes || []).forEach(fi => {
        let nome, unidade, qtdBase;
        if (fi.insumos) { nome = fi.insumos.nome; unidade = fi.insumos.unidade_medida; qtdBase = fi.quantidade; }
        else { const base = fichas.find(x => x.id === fi.subficha_id); nome = base?.nome_receita || "Base"; unidade = base?.rendimento_unidade || "un"; qtdBase = fi.quantidade; }
        const porPorcao = (Number(qtdBase) || 0) * fator;
        const u = String(unidade).toLowerCase();
        let q = porPorcao, un = u;
        if (u === "kg") { q = porPorcao * 1000; un = "g"; }
        if (u === "l") { q = porPorcao * 1000; un = "ml"; }
        resultado.push({ nome, quantidade: Math.round(q * 100) / 100, unidade: un });
      });
    });
    return resultado;
  };

  const abrirGuia = (produto) => {
    setGuiaProduto(produto);
    setGuiaObs("");
    setGuiaResultado(null);
    setModalGuia(true);
  };

  const gerarGuia = async () => {
    if (!guiaProduto) return;
    setGuiaLoading(true);
    try {
      const res = await fetch("/api/ia-guia-montagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome_prato: guiaProduto.nome_produto,
          categoria: guiaProduto.categoria,
          ingredientes: ingredientesDoProduto(guiaProduto),
          observacoes: guiaObs,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao gerar o guia."); return; }
      setGuiaResultado(data);
    } catch {
      alert("Não consegui falar com a IA. Verifique a conexão.");
    } finally {
      setGuiaLoading(false);
    }
  };

  const imprimirGuia = () => {
    if (!guiaResultado || !guiaProduto) return;
    const g = guiaResultado;
    const win = window.open("", "_blank", "width=800,height=1000");
    if (!win) return alert("Habilite os popups para imprimir o guia.");
    const li = (arr) => (arr || []).map(x => `<li>${x}</li>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Guia - ${guiaProduto.nome_produto}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:28px;max-width:760px;margin:0 auto}
        .head{background:#0f172a;color:#fff;border-radius:16px;padding:20px 24px;margin-bottom:20px}
        .tag{font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#94a3b8;font-weight:bold}
        h1{font-size:34px;margin-top:4px}
        h2{font-size:15px;text-transform:uppercase;letter-spacing:2px;color:#0f172a;margin:22px 0 8px;border-bottom:2px solid #0f172a;padding-bottom:4px}
        .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;font-size:16px;line-height:1.5}
        table{width:100%;border-collapse:collapse;font-size:16px}
        td{padding:8px 6px;border-bottom:1px solid #e2e8f0}
        td.q{text-align:right;font-weight:bold;white-space:nowrap}
        ol,ul{margin-left:22px;font-size:16px;line-height:1.7}
        ol li{margin-bottom:4px}
        .dicas{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:14px 16px;font-size:15px}
        @media print{@page{margin:12mm}}
      </style></head><body>
      <div class="head">
        <div class="tag">Montagem${guiaProduto.categoria ? " — " + guiaProduto.categoria : ""}</div>
        <h1>${guiaProduto.nome_produto}</h1>
      </div>
      ${g.louca ? `<h2>Louça / Recipiente</h2><div class="box">${g.louca}</div>` : ""}
      ${(g.porcionamento || []).length ? `<h2>Porcionamento (quantidades exatas)</h2><table><tbody>${g.porcionamento.map(p => `<tr><td>${p.item || ""}</td><td class="q">${p.quantidade || ""}</td></tr>`).join("")}</tbody></table>` : ""}
      ${(g.montagem || []).length ? `<h2>Ordem de Montagem</h2><ol>${li(g.montagem)}</ol>` : ""}
      ${g.finalizacao ? `<h2>Finalização</h2><div class="box">${g.finalizacao}</div>` : ""}
      ${g.visual ? `<h2>Visual do prato pronto</h2><div class="box">${g.visual}</div>` : ""}
      ${(g.dicas || []).length ? `<h2>Dicas de padronização</h2><div class="dicas"><ul>${li(g.dicas)}</ul></div>` : ""}
      </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  async function carregar() {
    setLoading(true);
    let [prodRes, fichasRes, embRes] = await Promise.all([
      fetchProdutos(unidadeAtiva),
      fetchFichas(unidadeAtiva),
      fetchEmbalagens(unidadeAtiva)
    ]);

    // Sincroniza com as Fichas Técnicas: toda ficha de PRATO/DRINK sem
    // produto correspondente vira produto aguardando preço (retroativo)
    try {
      const prods = prodRes.data || [];
      const fichasPrato = (fichasRes.data || []).filter(f => !f.eh_base);
      const vinculadas = new Set();
      prods.forEach(p => {
        if (p.ficha_id) vinculadas.add(p.ficha_id);
        (Array.isArray(p.composicao) ? p.composicao : []).forEach(c => vinculadas.add(c.ficha_id));
      });
      const nomesProd = new Set(prods.map(p => (p.nome_produto || "").toLowerCase().trim()));
      const faltantes = fichasPrato.filter(f =>
        !vinculadas.has(f.id) && !nomesProd.has((f.nome_receita || "").toLowerCase().trim())
      );
      for (const f of faltantes) {
        await salvarProduto({
          unidade_id: unidadeAtiva,
          nome_produto: f.nome_receita,
          categoria: f.departamento === "bar" ? "Drinks" : "Pratos Principais",
          departamento: f.departamento,
          tempo_preparo_base: 15,
          preco_venda: 0,
          ficha_id: f.id,
          composicao: [{ ficha_id: f.id, qtd: 1 }],
        });
      }
      if (faltantes.length) {
        alert(`${faltantes.length} prato(s)/drink(s) das Receitas entraram em Produtos e Preços aguardando preço (R$ 0,00). Defina o preço de venda de cada um.`);
        prodRes = await fetchProdutos(unidadeAtiva);
      }
    } catch { /* sincronização é acessória */ }

    setProdutos(prodRes.data || []);
    setFichas(fichasRes.data || []);
    setEmbalagensDB(embRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  useEffect(() => { setCatFiltro(catUrl); }, [catUrl]);

  // Categorias em uso nos produtos (inclui as que você criou) + padrão no modal
  const categoriasEmUso = [...new Set(produtos.map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const categoriasModal = [...new Set([...CATEGORIAS_PADRAO, ...categoriasEmUso])].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filtrados = produtos
    .filter(p => p.nome_produto.toLowerCase().includes(busca.toLowerCase()))
    .filter(p => !catFiltro || p.categoria === catFiltro);

  // Agrupa por categoria para exibir o cardápio em seções
  const grupos = categoriasEmUso
    .map(cat => ({ categoria: cat, itens: filtrados.filter(p => p.categoria === cat) }))
    .filter(g => g.itens.length > 0);
  const semCategoria = filtrados.filter(p => !p.categoria);
  if (semCategoria.length > 0) grupos.push({ categoria: "Sem categoria", itens: semCategoria });

  // CMV médio do cardápio filtrado (só produtos com ficha vinculada e preço)
  const cmvsValidos = filtrados
    .map(p => calcCmv(p.preco_venda, p, fichas))
    .filter(v => v !== null);
  const cmvMedio = cmvsValidos.length > 0 ? cmvsValidos.reduce((a, b) => a + b, 0) / cmvsValidos.length : null;

  const abrirNovo = () => {
    setCriandoCategoria(false);
    setNovaCategoria("");
    setForm({
       id: null,
       nome_produto: "",
       categoria: catFiltro || "Pratos Principais",
       departamento: "cozinha",
       tempo_preparo_base: 15,
       preco_venda: "",
       ficha_id: "",
       composicao: [],
       codigo_barras: "",
       imagem_url: "",
       modificadores: [],
       ncm: "",
       cest: "",
       cfop: "5102",
       csosn: "102",
       origem_icms: "0"
    });
    setNovoModNome("");
    setNovoModPreco("");
    setModalNovo(true);
  };

  const abrirEditar = (prod) => {
    setCriandoCategoria(false);
    setNovaCategoria("");
    setForm({
       id: prod.id, 
       nome_produto: prod.nome_produto, 
       categoria: prod.categoria, 
       departamento: prod.departamento, 
       tempo_preparo_base: prod.tempo_preparo_base || 15,
       preco_venda: prod.preco_venda,
       ficha_id: prod.ficha_id || "",
       // Migra produto antigo (ficha única) para o formato de componentes
       composicao: Array.isArray(prod.composicao) && prod.composicao.length
          ? prod.composicao.map(c => ({ ...c }))
          : (prod.ficha_id ? [{ ficha_id: prod.ficha_id, qtd: 1 }] : []),
       codigo_barras: prod.codigo_barras || "",
       imagem_url: prod.imagem_url || "",
       modificadores: prod.modificadores || [],
       ncm: prod.ncm || "",
       cest: prod.cest || "",
       cfop: prod.cfop || "5102",
       csosn: prod.csosn || "102",
       origem_icms: prod.origem_icms || "0"
    });
    setNovoModNome("");
    setNovoModPreco("");
    setModalNovo(true);
  };

  const handleSalvar = async () => {
    if(!form.nome_produto.trim()) return alert("Digite o nome do produto");
    if(!form.preco_venda) return alert("Digite o preço de venda");

    // Categoria criada na hora pelo usuário
    let categoriaFinal = form.categoria;
    if (criandoCategoria) {
       categoriaFinal = novaCategoria.trim();
       if (!categoriaFinal) return alert("Digite o nome da nova categoria.");
    }

    // Componentes válidos (ficha + qtd > 0). ficha_id continua sendo o 1º
    // componente, por compatibilidade com o que ainda lê ficha única.
    const composicaoFinal = (form.composicao || [])
       .filter(c => c.ficha_id && Number(c.qtd) > 0)
       .map(c => ({ ficha_id: c.ficha_id, qtd: Number(c.qtd) }));

    const erro = await salvarProduto({
       ...form,
       categoria: categoriaFinal,
       unidade_id: unidadeAtiva,
       tempo_preparo_base: Number(form.tempo_preparo_base),
       preco_venda: Number(form.preco_venda),
       composicao: composicaoFinal.length ? composicaoFinal : null,
       ficha_id: composicaoFinal[0]?.ficha_id || null
    });

    if(erro.error) return alert("Erro ao salvar: " + erro.error);

    setModalNovo(false);
    carregar();

    // Prato NOVO: já entra automaticamente no módulo Guia de Montagem
    // (cozinha ou bar) para criar a montagem lá — sem duplicar por nome.
    if (!form.id) {
      const { data: montagens } = await fetchMontagens(unidadeAtiva, form.departamento);
      const jaExiste = (montagens || []).some(m => (m.nome || "").toLowerCase() === form.nome_produto.trim().toLowerCase());
      if (!jaExiste) {
        await inserirMontagem({
          nome: form.nome_produto.trim(),
          tipo: form.departamento === "bar" ? "drink" : "prato",
          departamento: form.departamento,
          descritivo: "",
          foto_url: form.imagem_url || "",
          estrutura_ia: null,
          tempo_preparo: null,
          rendimento: "",
          observacoes: `Criado automaticamente pelo Cardápio (${categoriaFinal}).`,
        }, unidadeAtiva);
      }
    }
  };

  const addModificador = () => {
     if(!novoModNome.trim()) return;
     const preco = Number(novoModPreco) || 0;
     setForm({
        ...form,
        modificadores: [...form.modificadores, { nome: novoModNome, preco }]
     });
     setNovoModNome("");
     setNovoModPreco("");
  };

  const removeModificador = (index) => {
     setForm({
        ...form,
        modificadores: form.modificadores.filter((_, i) => i !== index)
     });
  };

  // Excluir prato do cardápio. Se pedidos antigos de teste apontarem para
  // ele (FK), pergunta se pode levar esses registros junto.
  const handleExcluir = async (p) => {
    if (!confirm(`Excluir "${p.nome_produto}" do cardápio?\n\nEssa ação não pode ser desfeita.`)) return;
    const { error, temPedidos } = await removerProduto(p.id);
    if (temPedidos) {
      if (!confirm(`"${p.nome_produto}" aparece em registros ANTIGOS de pedidos (dados de teste de quando o sistema tinha PDV).\n\nExcluir o prato e apagar esses registros antigos junto?`)) return;
      const r2 = await removerProdutoComPedidos(p.id);
      if (r2.error) return alert("Erro ao excluir: " + r2.error);
    } else if (error) {
      return alert("Erro ao excluir: " + error);
    }
    carregar();
  };

  // Planilha imprimível: preços, custos e CMV de todo o cardápio, por categoria
  const imprimirTabelaCmv = () => {
    const lista = filtrados.length ? filtrados : produtos;
    if (!lista.length) return alert("Cadastre produtos no cardápio primeiro.");

    const gruposDoc = [...grupos];
    const linhaProduto = (p) => {
      const custo = custoPorcaoProduto(p, fichas, embalagensDB);
      const preco = Number(p.preco_venda) || 0;
      const cmv = calcCmv(p.preco_venda, p, fichas, embalagensDB);
      const margem = preco - (custo || 0);
      const temFicha = componentesDoProduto(p).length > 0;
      return `<tr>
        <td>${p.nome_produto}${!temFicha ? ' <span class="sem">sem ficha</span>' : ''}</td>
        <td class="c">${p.departamento || "—"}</td>
        <td class="r">${temFicha ? fmtBRL(custo) : "—"}</td>
        <td class="r"><b>${fmtBRL(preco)}</b></td>
        <td class="r">${temFicha ? fmtBRL(margem) : "—"}</td>
        <td class="c ${cmv !== null ? (cmv > 30 ? "ruim" : "bom") : ""}">${cmv !== null ? cmv.toFixed(1) + "%" : "—"}</td>
      </tr>`;
    };

    const secoes = gruposDoc.map(g => `
      <h2>${g.categoria}</h2>
      <table>
        <thead><tr><th>Produto</th><th class="c">Setor</th><th class="r">Custo/porção</th><th class="r">Preço (PDV)</th><th class="r">Margem</th><th class="c">CMV</th></tr></thead>
        <tbody>${g.itens.map(linhaProduto).join("")}</tbody>
      </table>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cardapio - Precos e CMV</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;padding:20px;max-width:760px;margin:0 auto}
        .head{border-bottom:3px solid #0f172a;padding-bottom:10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#64748b;font-weight:bold}
        h1{font-size:24px;margin-top:2px}
        .resumo{font-size:12px;color:#475569;text-align:right}
        .resumo b{font-size:18px;display:block}
        h2{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin:16px 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:3px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{text-align:left;padding:6px 6px;border-bottom:1px solid #e2e8f0}
        th{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#64748b}
        td.c,th.c{text-align:center}td.r,th.r{text-align:right}
        td.bom{color:#047857;font-weight:bold}
        td.ruim{color:#DC2626;font-weight:bold}
        .sem{color:#DC2626;font-size:9px;text-transform:uppercase;font-weight:bold}
        .obs{margin-top:18px;font-size:10px;color:#94a3b8}
        @media print{@page{margin:12mm}}
      </style></head><body>
      <div class="head">
        <div>
          <div class="tag">Produtos e Preços — Custos e CMV · ${unidadeInfo?.nome || ""}</div>
          <h1>Tabela de Produtos e Preços</h1>
        </div>
        ${cmvMedio !== null ? `<div class="resumo">CMV médio da carta<b style="color:${cmvMedio > 30 ? "#DC2626" : "#047857"}">${cmvMedio.toFixed(1)}%</b></div>` : ""}
      </div>
      ${secoes}
      <div class="obs">Meta de CMV: até 30% (verde). Margem = preço − custo por porção. Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Documento interno.</div>
      </body></html>`;

    let win = null;
    try { win = window.open("", "_blank", "width=860,height=1000"); } catch { win = null; }
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
        return alert("O navegador bloqueou a janela de impressão. Habilite os popups para este site.\n\nDetalhe: " + e.message);
      }
    }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // Card de produto (usado dentro de cada seção de categoria)
  const renderCard = (p) => {
     const cmv = calcCmv(p.preco_venda, p, fichas);
     return (
     <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col h-full">
        <div className="flex justify-between items-start mb-2 gap-2">
           <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest">
              {p.departamento}
           </span>
           <div className="flex items-center gap-2">
              {cmv !== null && (
                 <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${corCmv(cmv).bg} ${corCmv(cmv).text} border ${corCmv(cmv).border}`}>
                    CMV {cmv.toFixed(1)}%
                 </span>
              )}
              <button onClick={() => abrirGuia(p)} title="Guia de montagem do prato (IA)" className="text-slate-500 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"><ClipboardList size={18}/></button>
              <button onClick={() => abrirEditar(p)} title="Editar" className="text-slate-500 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Edit3 size={18}/></button>
              <button onClick={() => handleExcluir(p)} title="Excluir do cardápio" className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Trash2 size={18}/></button>
           </div>
        </div>

        <div className="flex gap-4 items-center mb-4 mt-2">
           {p.imagem_url ? (
              <img src={p.imagem_url} alt={p.nome_produto} className="w-16 h-16 object-cover rounded-xl border border-slate-100 shadow-sm" />
           ) : (
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-300">
                 <ImageIcon size={24} />
              </div>
           )}
           <h3 className="text-xl font-black text-slate-800 leading-tight flex-1">{p.nome_produto}</h3>
        </div>

        <div className="flex flex-col gap-2 mb-4 flex-1">
           {p.codigo_barras && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                 <Barcode size={14}/> {p.codigo_barras}
              </div>
           )}
           {p.modificadores && p.modificadores.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-md self-start">
                 <ListPlus size={14}/> {p.modificadores.length} Opcionais
              </div>
           )}
        </div>

        <div className="flex justify-between items-end mt-auto pt-4 border-t border-slate-100">
           <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Preço de Venda</p>
              {Number(p.preco_venda) > 0 ? (
                 <p className="font-black text-2xl text-emerald-600">{fmtBRL(p.preco_venda)}</p>
              ) : (
                 <button onClick={() => abrirEditar(p)} className="font-black text-xs text-amber-700 bg-amber-50 border border-amber-300 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition-colors uppercase tracking-widest">
                    Definir preço
                 </button>
              )}
           </div>
           <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Receita</p>
              {(() => {
                 const comps = componentesDoProduto(p);
                 if (!comps.length) return <p className="font-bold text-[10px] uppercase text-red-500">Não vinculada</p>;
                 if (comps.length === 1) {
                    const f = fichas.find(x => x.id === comps[0].ficha_id);
                    return <p className="font-bold text-[10px] uppercase text-emerald-600">{(f?.nome_receita || p.fichas_tecnicas?.nome_receita || 'Ficha').substring(0, 15)}</p>;
                 }
                 return <p className="font-bold text-[10px] uppercase text-emerald-600" title={comps.map(c => fichas.find(x => x.id === c.ficha_id)?.nome_receita).filter(Boolean).join(' + ')}>{comps.length} componentes</p>;
              })()}
           </div>
        </div>
     </div>
     );
  };

  return (
    <div className="min-h-screen pb-24 font-sans text-slate-800 bg-slate-50">
      
      {/* TOPBAR */}
      <div className="bg-white border-b border-slate-200 py-4 sm:py-6 px-4 sm:px-6 sticky top-0 z-10">
         <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button onClick={() => abrirMenu()} className="p-3 text-slate-500 hover:text-slate-800 bg-slate-50 rounded-full border border-slate-200">
                 <ArrowLeft size={20}/>
              </button>
               <div className="hidden sm:flex w-14 h-14 shrink-0 rounded-2xl bg-slate-100 text-emerald-600 items-center justify-center shadow-inner">
                 <Tag size={28} />
              </div>
              <div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tighter text-slate-900">Produtos e Preços</h1>
                  <p className="text-slate-700 font-bold uppercase tracking-wide sm:tracking-widest text-[10px] sm:text-xs mt-1">Precificação · liga direto no PDV · CMV automático</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
               {cmvMedio !== null && (
                  <div className={`px-4 py-2.5 rounded-2xl border ${corCmv(cmvMedio).bg} ${corCmv(cmvMedio).border}`}>
                     <p className={`text-[9px] font-black uppercase tracking-widest ${corCmv(cmvMedio).text}`}>CMV Médio</p>
                     <p className={`text-xl font-black ${corCmv(cmvMedio).text}`}>{cmvMedio.toFixed(1)}%</p>
                  </div>
               )}
               <button onClick={imprimirTabelaCmv} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-3 sm:px-5 py-3 rounded-xl font-bold whitespace-nowrap hover:bg-slate-50 transition-colors shadow-sm" title="Planilha com preços, custos e CMV">
                  <Printer size={18} /> <span className="hidden sm:inline">Imprimir Tabela</span>
               </button>
               <button onClick={abrirNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-3 sm:px-5 py-3 rounded-xl font-bold whitespace-nowrap hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20">
                  <Plus size={18} /> Novo Produto
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-4 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar produto no cardápio..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         {/* Chips de categoria (as que você criou aparecem aqui automaticamente) */}
         {categoriasEmUso.length > 0 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
               <button onClick={() => setCatFiltro("")} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-all active:scale-95 ${!catFiltro ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800'}`}>
                  Todas
               </button>
               {categoriasEmUso.map(cat => (
                  <button key={cat} onClick={() => setCatFiltro(cat)} className={`shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-all active:scale-95 ${catFiltro === cat ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800'}`}>
                     {cat} <span className="opacity-60">({produtos.filter(p => p.categoria === cat).length})</span>
                  </button>
               ))}
            </div>
         )}

         {loading ? (
            <p className="font-bold text-slate-500">Buscando produtos...</p>
         ) : filtrados.length === 0 ? (
            <div className="text-center p-10 bg-white border border-slate-200 rounded-3xl">
               <UtensilsCrossed size={40} className="mx-auto text-slate-500 mb-4"/>
               <h3 className="text-xl font-black text-slate-700">{produtos.length === 0 ? 'O cardápio está vazio' : 'Nada encontrado nesse filtro'}</h3>
               <p className="text-slate-500 mt-2 font-medium">{produtos.length === 0 ? 'Você precisa cadastrar produtos para que o garçom consiga lançar comandas.' : 'Tente outra categoria ou limpe a busca.'}</p>
            </div>
         ) : (
            <div className="space-y-10">
               {grupos.map(g => (
                  <div key={g.categoria}>
                     {/* Cabeçalho da seção de categoria */}
                     <div className="flex items-center gap-3 mb-4">
                        <h2 className="text-xl font-black text-slate-800 tracking-tight">{g.categoria}</h2>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">{g.itens.length} {g.itens.length === 1 ? 'item' : 'itens'}</span>
                        <div className="flex-1 h-px bg-slate-200" />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {g.itens.map(renderCard)}
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>

      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[92vh]">
               <div className="flex justify-between items-center p-4 sm:p-8 pb-4 sm:pb-6 border-b border-slate-100 shrink-0">
                  <h2 className="font-black text-2xl text-slate-800">{form.id ? "Editar Produto" : "Novo Produto"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar space-y-6">
                  {/* Básico */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Produto</label>
                        <input type="text" placeholder="Ex: Caipirinha de Morango" value={form.nome_produto} onChange={e=>setForm({...form, nome_produto: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-800"/>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Categoria</label>
                        {criandoCategoria ? (
                           <div className="flex gap-2 mt-1">
                              <input
                                 type="text"
                                 autoFocus
                                 placeholder="Nome da nova categoria..."
                                 value={novaCategoria}
                                 onChange={e=>setNovaCategoria(e.target.value)}
                                 className="flex-1 p-4 bg-emerald-50 border border-emerald-300 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500"
                              />
                              <button type="button" onClick={() => { setCriandoCategoria(false); setNovaCategoria(""); }} className="px-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 font-bold text-xs">
                                 Cancelar
                              </button>
                           </div>
                        ) : (
                           <select
                              value={form.categoria}
                              onChange={e => {
                                 if (e.target.value === "__nova__") { setCriandoCategoria(true); setNovaCategoria(""); }
                                 else setForm({...form, categoria: e.target.value});
                              }}
                              className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"
                           >
                              {categoriasModal.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                              <option value="__nova__">+ Criar nova categoria...</option>
                           </select>
                        )}
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Setor (Cozinha ou Bar)</label>
                        <select value={form.departamento} onChange={e=>setForm({...form, departamento: e.target.value, ficha_id: "", composicao: []})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                           <option value="cozinha">Cozinha</option>
                           <option value="bar">Bar</option>
                        </select>
                     </div>
                  </div>

                  {/* PRATO PRONTO — a montagem é feita na Ficha Técnica; aqui
                      só se escolhe o prato e o resto é financeiro (custo/preço/CMV) */}
                  <div className="pt-4 border-t border-slate-100">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{form.departamento === "bar" ? "Drink pronto (montado na Ficha de Drinks)" : "Prato pronto (montado na Ficha Técnica)"}</label>
                     <select
                        value={(form.composicao || []).length === 1 ? form.composicao[0].ficha_id : ""}
                        onChange={e => {
                           const id = e.target.value;
                           const ficha = fichas.find(f => f.id === id);
                           // Nome do produto vem da ficha automaticamente (a menos
                           // que você já tenha digitado um nome próprio)
                           const nomeAtual = (form.nome_produto || "").trim();
                           const nomeEhAutomatico = !nomeAtual || fichas.some(f => f.nome_receita === nomeAtual);
                           setForm({
                              ...form,
                              composicao: id ? [{ ficha_id: id, qtd: 1 }] : [],
                              ficha_id: id || "",
                              nome_produto: id && ficha && nomeEhAutomatico ? ficha.nome_receita : form.nome_produto,
                           });
                        }}
                        className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500"
                     >
                        <option value="">{form.departamento === "bar" ? "Selecione o drink..." : "Selecione o prato..."}</option>
                        {fichas.filter(f => f.departamento === form.departamento && !f.eh_base).map(f => <option key={f.id} value={f.id}>{f.nome_receita}</option>)}
                     </select>
                     <p className="text-[10px] text-slate-400 font-medium mt-1">A montagem (insumos + pré-preparos) é feita em Receitas. Aqui você só define o preço.</p>
                  </div>

                  {/* Compatibilidade: produto antigo montado com VÁRIOS componentes
                      aqui no cardápio — continua funcionando e editável */}
                  {(form.composicao || []).length > 1 && (
                     <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Produto antigo com múltiplos componentes — o custo soma todos</p>
                        {(form.composicao || []).map((c, idx) => {
                           const f = fichas.find(x => x.id === c.ficha_id);
                           const custoUnit = f ? custoTotalDaFicha(f, fichas) / porcoesDaFicha(f) : 0;
                           return (
                              <div key={c.ficha_id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl p-2.5">
                                 <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-700 text-sm truncate">{f?.nome_receita || "Ficha removida"}</p>
                                     {f?.peso_porcao_g ? (
                                        <p className="text-[10px] font-bold text-emerald-600">{fmtBRL(custoUnit / (f.peso_porcao_g / 1000))} / kg</p>
                                     ) : (
                                        <p className="text-[10px] font-bold text-emerald-600">{fmtBRL(custoUnit)} / porção</p>
                                     )}
                                 </div>
                                 <div className="text-center flex gap-2">
                                    {f?.peso_porcao_g ? (
                                       <div className="text-center">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Gramas</label>
                                          <input type="number" min="0" step="1" 
                                             value={c.qtd !== "" && c.qtd != null ? Math.round(Number(c.qtd) * f.peso_porcao_g) : ""} 
                                             onChange={e => setForm({ ...form, composicao: form.composicao.map((x, i) => i === idx ? { ...x, qtd: e.target.value === "" ? "" : Number(e.target.value) / f.peso_porcao_g } : x) })} 
                                             className="w-20 p-1.5 text-center bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"
                                             placeholder="Ex: 150"/>
                                       </div>
                                    ) : (
                                       <div className="text-center">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Porções</label>
                                          <input type="number" min="0" step="0.5" value={c.qtd} 
                                             onChange={e => setForm({ ...form, composicao: form.composicao.map((x, i) => i === idx ? { ...x, qtd: e.target.value } : x) })} 
                                             className="w-16 p-1.5 text-center bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"
                                          />
                                       </div>
                                    )}
                                 </div>
                                 <span className="font-black text-slate-600 text-sm w-20 text-right">{fmtBRL(custoUnit * (Number(c.qtd) || 0))}</span>
                                 <button type="button" onClick={() => setForm({ ...form, composicao: form.composicao.filter((_, i) => i !== idx) })} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg border border-slate-200"><Trash2 size={13}/></button>
                              </div>
                           );
                        })}
                     </div>
                  )}

                  {/* CUSTO (auto) → PREÇO (você define) → CMV (auto) */}
                  {(() => {
                     const custoLive = custoPorcaoProduto(form, fichas, embalagensDB);
                     const cmvLive = calcCmv(form.preco_venda, form, fichas, embalagensDB);
                     const cores = cmvLive !== null ? corCmv(cmvLive) : null;
                     return (
                        <div className="grid grid-cols-3 gap-3">
                           <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-center">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{form.departamento === "bar" ? "Custo do drink" : "Custo do prato"}</p>
                              <p className="text-xl font-black text-slate-800 mt-1">{(form.composicao || []).length ? fmtBRL(custoLive) : "—"}</p>
                              <p className="text-[9px] font-medium text-slate-400">automático da montagem</p>
                           </div>
                           <div className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 text-center">
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Preço de venda (R$)</p>
                              <input type="number" step="0.01" placeholder="0,00" value={form.preco_venda} onChange={e=>setForm({...form, preco_venda: e.target.value})} className="w-full mt-1 text-center bg-transparent font-black text-emerald-600 text-xl outline-none"/>
                              <p className="text-[9px] font-medium text-emerald-600/70">você define</p>
                           </div>
                           <div className={`p-4 rounded-2xl border text-center ${cmvLive !== null ? `${cores.bg} ${cores.border}` : "border-slate-200 bg-slate-50"}`}>
                              <p className={`text-[10px] font-black uppercase tracking-widest ${cmvLive !== null ? cores.text : "text-slate-500"}`}>CMV</p>
                              <p className={`text-xl font-black mt-1 ${cmvLive !== null ? cores.text : "text-slate-400"}`}>{cmvLive !== null ? `${cmvLive.toFixed(1)}%` : "—"}</p>
                              <p className={`text-[9px] font-medium ${cmvLive !== null ? cores.text : "text-slate-400"}`}>muda automático</p>
                           </div>
                        </div>
                     );
                  })()}

                  {/* Imagem do Produto */}
                  <div className="pt-4 border-t border-slate-100">
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-2"><ImageIcon size={14}/> Imagem do Produto (Opcional)</label>
                     <div className="flex gap-4 items-center mt-2">
                        {form.imagem_url ? (
                           <div className="relative w-24 h-24 rounded-2xl border border-slate-200 overflow-hidden shrink-0 shadow-sm bg-slate-50">
                              <img src={form.imagem_url} alt="Produto" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => setForm({...form, imagem_url: ""})} className="absolute top-1.5 right-1.5 bg-white rounded-full p-1.5 shadow-sm text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={12}/></button>
                           </div>
                        ) : (
                           <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 bg-slate-50 shrink-0">
                              <ImageIcon size={28} />
                           </div>
                        )}
                        <div className="flex-1">
                           <label className="cursor-pointer group flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition-colors rounded-xl p-4 font-bold text-sm w-full relative">
                              {loading ? <Loader2 className="animate-spin" size={18}/> : <UploadCloud size={18}/>}
                              <span>{loading ? "Enviando..." : "Selecionar arquivo do computador"}</span>
                              <input type="file" accept="image/*" disabled={loading} className="hidden" onChange={async (e) => {
                                 const file = e.target.files[0];
                                 if (!file) return;
                                 setLoading(true);
                                 const ext = file.name.split('.').pop();
                                 const fileName = `produto-${Date.now()}.${ext}`;
                                 const { error } = await supabase.storage.from("anexos").upload(`produtos/${fileName}`, file, { upsert: false });
                                 if (error) {
                                    alert("Erro ao enviar imagem: " + error.message);
                                    setLoading(false);
                                    return;
                                 }
                                 const { data: pubData } = supabase.storage.from("anexos").getPublicUrl(`produtos/${fileName}`);
                                 setForm({...form, imagem_url: pubData.publicUrl});
                                 setLoading(false);
                              }}/>
                           </label>
                           <p className="text-[11px] font-medium text-slate-400 mt-2 ml-1">Formatos: JPG, PNG, WEBP. A imagem será recortada como um quadrado.</p>
                        </div>
                     </div>
                  </div>

                  {/* Embalagens e Acessórios */}
                  <div className="pt-6 border-t border-slate-100">
                     <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                           <Package size={18}/> Embalagens e Acessórios
                        </h3>
                     </div>

                     <div className="mb-4">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Adicionar Embalagem / Item</label>
                        <select
                           value=""
                           onChange={e => {
                              const id = e.target.value;
                              if (!id || (form.embalagens || []).find(emb => emb.embalagem_id === id)) return;
                              setForm({ ...form, embalagens: [...(form.embalagens || []), { embalagem_id: id, qtd: 1 }] });
                           }}
                           className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500"
                        >
                           <option value="">+ Selecionar do estoque...</option>
                           {embalagensDB.filter(e => !(form.embalagens || []).find(emb => emb.embalagem_id === e.id)).map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
                        </select>
                     </div>

                     {form.embalagens && form.embalagens.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Custo e baixa somam todos ao vender</p>
                           {form.embalagens.map((emb, idx) => {
                              const eDB = embalagensDB.find(x => x.id === emb.embalagem_id);
                              const custoUnit = eDB ? Number(eDB.preco_unitario) : 0;
                              return (
                                 <div key={emb.embalagem_id} className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl p-2.5">
                                    <div className="flex-1 min-w-0">
                                       <p className="font-bold text-slate-700 text-sm truncate">{eDB?.nome || "Embalagem excluída"}</p>
                                       <p className="text-[10px] font-bold text-emerald-600">{fmtBRL(custoUnit)} / unidade</p>
                                    </div>
                                    <div className="text-center flex gap-2">
                                       <div className="text-center">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Qtd (Un)</label>
                                          <input type="number" min="1" step="1" value={emb.qtd} 
                                             onChange={e => setForm({ ...form, embalagens: form.embalagens.map((x, i) => i === idx ? { ...x, qtd: e.target.value } : x) })} 
                                             className="w-16 p-1.5 text-center bg-slate-50 border border-slate-200 rounded-lg font-black text-slate-700 outline-none focus:border-emerald-500"
                                          />
                                       </div>
                                    </div>
                                    <span className="font-black text-slate-600 text-sm w-20 text-right">{fmtBRL(custoUnit * (Number(emb.qtd) || 0))}</span>
                                    <button type="button" onClick={() => setForm({ ...form, embalagens: form.embalagens.filter((_, i) => i !== idx) })} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg border border-slate-200"><Trash2 size={13}/></button>
                                 </div>
                              );
                           })}
                        </div>
                     )}
                  </div>
               </div>

               <div className="p-4 sm:p-8 sm:pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0">
                  <button onClick={handleSalvar} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2">
                     <Save size={20}/> Salvar Produto
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* GUIA DE MONTAGEM DO PRATO (IA) */}
      {modalGuia && guiaProduto && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[92vh]">
               <div className="flex justify-between items-center p-4 sm:p-8 pb-4 sm:pb-6 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><ClipboardList size={22}/></div>
                     <div>
                        <h2 className="font-black text-2xl text-slate-800">{guiaProduto.departamento === "bar" ? "Montagem do Drink" : "Montagem do Prato"}</h2>
                        <p className="text-xs font-bold text-slate-500 mt-0.5">{guiaProduto.nome_produto} — padronize e cole na parede</p>
                     </div>
                  </div>
                  <button onClick={() => setModalGuia(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-4 sm:p-8 overflow-y-auto custom-scrollbar space-y-5">
                  {componentesDoProduto(guiaProduto).length === 0 && (
                     <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] font-bold text-amber-700">
                        Este produto não tem uma receita vinculada — a IA vai montar o passo a passo só pelo nome. Para quantidades exatas, vincule uma receita.
                     </div>
                  )}

                  {!guiaResultado ? (
                     <>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Observações do chef (opcional)</label>
                           <textarea
                              placeholder="Ex: sai em prato fundo, molho por cima na hora, salsinha picada por cima, servir bem quente..."
                              value={guiaObs}
                              onChange={e => setGuiaObs(e.target.value)}
                              className="w-full h-24 p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none"
                           ></textarea>
                        </div>
                        {ingredientesDoProduto(guiaProduto).length > 0 && (
                           <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Ingredientes por porção (da ficha)</p>
                              <p className="text-xs text-slate-500 font-medium">{ingredientesDoProduto(guiaProduto).map(i => `${i.nome} ${i.quantidade}${i.unidade}`).join(" · ")}</p>
                           </div>
                        )}
                        <button onClick={gerarGuia} disabled={guiaLoading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95">
                           {guiaLoading ? <><Loader2 size={18} className="animate-spin"/> Gerando guia...</> : <><Sparkles size={18}/> Gerar guia de montagem</>}
                        </button>
                     </>
                  ) : (
                     <div className="space-y-4">
                        {guiaResultado.louca && (
                           <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Louça / recipiente</p><p className="font-bold text-slate-800">{guiaResultado.louca}</p></div>
                        )}
                        {(guiaResultado.porcionamento || []).length > 0 && (
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Porcionamento</p>
                              <div className="space-y-1">
                                 {guiaResultado.porcionamento.map((p, i) => (
                                    <div key={i} className="flex justify-between text-sm bg-slate-50 rounded-lg px-3 py-2"><span className="font-bold text-slate-700">{p.item}</span><span className="font-black text-emerald-600">{p.quantidade}</span></div>
                                 ))}
                              </div>
                           </div>
                        )}
                        {(guiaResultado.montagem || []).length > 0 && (
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Ordem de montagem</p>
                              <ol className="list-decimal ml-5 space-y-1 text-sm font-medium text-slate-700">{guiaResultado.montagem.map((m, i) => <li key={i}>{m}</li>)}</ol>
                           </div>
                        )}
                        {guiaResultado.finalizacao && (
                           <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Finalização</p><p className="text-sm font-medium text-slate-700">{guiaResultado.finalizacao}</p></div>
                        )}
                        {guiaResultado.visual && (
                           <div><p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Visual esperado</p><p className="text-sm font-medium text-slate-700">{guiaResultado.visual}</p></div>
                        )}
                        {(guiaResultado.dicas || []).length > 0 && (
                           <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">Dicas de padronização</p>
                              <ul className="list-disc ml-4 text-sm font-medium text-emerald-800 space-y-0.5">{guiaResultado.dicas.map((d, i) => <li key={i}>{d}</li>)}</ul>
                           </div>
                        )}
                        <button onClick={() => setGuiaResultado(null)} className="text-xs font-bold text-slate-500 hover:text-slate-700">← Gerar de novo</button>
                     </div>
                  )}
               </div>

               {guiaResultado && (
                  <div className="p-4 sm:p-8 sm:pt-4 border-t border-slate-100 bg-slate-50 rounded-b-[32px] shrink-0">
                     <button onClick={imprimirGuia} className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-lg rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2">
                        <Printer size={20}/> Imprimir guia (colar na parede)
                     </button>
                  </div>
               )}
            </div>
         </div>
      )}

    </div>
  );
}

export default function ProdutosPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando Produtos...</div>}>
       <CardapioRunner />
    </Suspense>
  );
}
