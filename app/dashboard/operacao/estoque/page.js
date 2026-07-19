"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchEstoque, ajustarEstoque, atualizarMinimoInsumo, atualizarMaximoInsumo, registrarCompra, fetchReposicaoMes } from "../../../lib/estoque";
import { salvarInsumo } from "../../../lib/operacao";
import { criarEtiqueta, gerarCodigo } from "../../../lib/etiquetas";
import { fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { useTempoReal } from "../../../lib/realtime";
import { PackageSearch, Edit3, X, Save, ArrowLeft, RefreshCw, AlertCircle, Search, Plus, TrendingUp, Printer, Camera, Loader2, CheckCircle2 } from "lucide-react";
import { fmtBRL } from "../../../components/ui";

function EstoqueRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept"); // 'cozinha' ou 'bar'
  
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("Todos"); // Todos | Ingredientes | Produtos prontos

  // Importar lista por IA (foto de planilha/caderno com nome, marca, quantidade)
  const [modalLista, setModalLista] = useState(false);
  const [listaLendo, setListaLendo] = useState(false);
  const [listaItens, setListaItens] = useState(null); // itens lidos p/ revisão
  const [listaSalvando, setListaSalvando] = useState(false);
  const inputListaRef = useRef(null);
  
  const [modalAjuste, setModalAjuste] = useState(false);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [itemAtual, setItemAtual] = useState(null);
  const [novoSaldo, setNovoSaldo] = useState("");
  const [minimoInput, setMinimoInput] = useState("");
  const [maximoInput, setMaximoInput] = useState("");
  const [fatorRep, setFatorRep] = useState(PARAMS_PADRAO.fator_reposicao);
  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") fetchParams(unidadeAtiva).then(r => setFatorRep(r.data.fator_reposicao)); }, [unidadeAtiva]);
  const [qtdEntrada, setQtdEntrada] = useState("");
  const [valorEntrada, setValorEntrada] = useState("");

  const [reposicaoMes, setReposicaoMes] = useState(0);
  const carregar = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const mes = new Date().toISOString().slice(0, 7);
    const [rEst, rRep] = await Promise.all([
      fetchEstoque(unidadeAtiva, deptUrl),
      fetchReposicaoMes(unidadeAtiva, mes),
    ]);
    setItens(rEst.data);
    setReposicaoMes(rRep.total || 0);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  // Tempo real: entradas, baixas e produções atualizam os saldos sozinhos
  useTempoReal(["estoque_atual", "insumos", "producao_diaria"], () => { if (unidadeAtiva) carregar(true); });

  const filtrados = itens.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) &&
    (tipoFiltro === "Todos" || (tipoFiltro === "Produtos prontos" ? i.tipo === "produto" : i.tipo !== "produto"))
  );

  // ── Importar lista por IA: foto → itens revisáveis → estoque + validade ──
  const lerFotoLista = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setListaLendo(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/ia-lista-estoque", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagem_base64: base64, media_type: file.type || "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao ler a lista."); return; }
      // Cada item ganha campos para o usuário completar: validade e preço de compra
      setListaItens(data.itens.map(i => ({ ...i, validade: "", preco: "" })));
    } catch { alert("Não consegui falar com a IA. Verifique a conexão."); } finally { setListaLendo(false); }
  };

  const salvarListaImportada = async () => {
    const validos = (listaItens || []).filter(i => i.nome.trim() && Number(i.quantidade) > 0);
    if (!validos.length) return alert("Nenhum item válido para dar entrada.");
    setListaSalvando(true);
    try {
      let ok = 0;
      for (const item of validos) {
        const qtd = Number(item.quantidade) || 1;
        const preco = parseFloat(String(item.preco).replace(",", ".")) || 0;
        // Já existe no estoque? Reaproveita; senão cadastra como produto pronto
        const existente = itens.find(x => x.nome.trim().toLowerCase() === item.nome.trim().toLowerCase());
        let insumoId = existente?.insumo_id;
        if (!insumoId) {
          const r = await salvarInsumo({
            unidade_id: unidadeAtiva,
            nome: item.nome.trim(),
            marca: item.marca || "",
            tipo: "produto",
            departamento: deptUrl || "cozinha",
            unidade_medida: String(item.unidade || "UN").toLowerCase(),
            custo_unitario: preco > 0 ? +(preco / qtd).toFixed(4) : 0,
          });
          if (r.error) { alert(`${item.nome}: ${r.error}`); continue; }
          insumoId = r.id;
        }
        // Entrada no saldo: com preço vira compra (entra na reposição do mês)
        if (preco > 0) {
          await registrarCompra(unidadeAtiva, insumoId, item.nome.trim(), deptUrl || "cozinha", qtd, preco);
        } else {
          const saldoAtual = Number(existente?.quantidade_atual || 0);
          await ajustarEstoque(unidadeAtiva, insumoId, saldoAtual + qtd);
        }
        // Com validade informada, gera uma etiqueta ativa: o Controle de Validade
        // passa a avisar o que vence primeiro (o que entrou deve sair primeiro)
        if (item.validade) {
          await criarEtiqueta({
            codigo: gerarCodigo(),
            produto: item.nome.trim() + (item.marca ? ` (${item.marca})` : ""),
            conservacao: "Ambiente",
            quantidade: qtd,
            unidade: String(item.unidade || "UN").toUpperCase(),
            manipulacao_em: new Date().toISOString(),
            validade_em: new Date(item.validade + "T12:00:00").toISOString(),
            responsavel: "Entrada por lista (IA)",
            custo_unit: preco > 0 ? +(preco / qtd).toFixed(4) : 0,
            status: "ativa",
            tipo_etiqueta: "fechado",
          }, unidadeAtiva);
        }
        ok++;
      }
      alert(`${ok} item(ns) deram entrada no estoque.${validos.some(i => i.validade) ? "\nOs que têm validade já estão no Controle de Validade — ele avisa o que deve sair primeiro." : ""}`);
      setModalLista(false);
      setListaItens(null);
      carregar();
    } finally { setListaSalvando(false); }
  };

  // Planilha em branco para preencher à mão e depois fotografar para a IA
  const imprimirPlanilhaLista = () => {
    const linhas = Array.from({ length: 22 }).map(() => `<tr><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Lista de Entrada de Produtos</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial;color:#111;padding:10mm}
      h1{font-size:18px;margin-bottom:2px}p{font-size:10px;color:#555;margin-bottom:8px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:9px 8px;font-size:12px;text-align:left}
      th{background:#eee;font-size:9px;text-transform:uppercase;letter-spacing:1px}td{height:9mm}
      @media print{@page{margin:8mm}}</style></head><body>
      <h1>Lista de Entrada de Produtos — ${unidadeInfo?.nome || ""}</h1>
      <p>Preencha à mão e depois tire uma foto no botão "Importar Lista (IA)" do Estoque: o sistema dá entrada sozinho.</p>
      <table><thead><tr><th style="width:34%">Produto</th><th style="width:18%">Marca</th><th style="width:12%">Qtd</th><th style="width:18%">Validade</th><th style="width:18%">Preço de compra</th></tr></thead>
      <tbody>${linhas}</tbody></table></body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
    else alert("Habilite os popups para imprimir.");
  };

  // Planilha de contagem imprimível: saldo do sistema + colunas em branco para
  // a contagem física e a diferença — agrupada por departamento.
  const imprimirPlanilha = () => {
    if (!itens.length) return alert("Estoque vazio — nada para imprimir.");
    const grupos = {};
    itens.forEach(i => { const d = (i.departamento || "geral").toLowerCase(); (grupos[d] = grupos[d] || []).push(i); });
    let corpo = "";
    Object.keys(grupos).sort().forEach(dep => {
      const lista = grupos[dep].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      corpo += `<tr class="cat"><td colspan="7">${dep.toUpperCase()}</td></tr>` + lista.map(i => {
        const saldo = Number(i.quantidade_atual) || 0;
        const custo = Number(i.custo_unitario) || 0;
        return `<tr>
          <td><b>${i.nome}</b></td>
          <td class="c">${String(i.unidade_medida || "").toUpperCase()}</td>
          <td class="c">${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</td>
          <td class="r">${custo > 0 ? fmtBRL(custo) : ""}</td>
          <td class="r">${custo > 0 ? fmtBRL(custo * saldo) : ""}</td>
          <td class="conta"></td>
          <td class="conta"></td>
        </tr>`;
      }).join("");
    });
    const valorTotal = itens.reduce((s, i) => s + (Number(i.custo_unitario) || 0) * (Number(i.quantidade_atual) || 0), 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Estoque — ${unidadeInfo?.nome || ""}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:8mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px}
        .tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #94a3b8;padding:5px 6px;text-align:left}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        tr{page-break-inside:avoid}
        tr.cat td{background:#f1f5f9;font-weight:bold;letter-spacing:1px;font-size:10px;color:#334155}
        td.c{text-align:center;font-weight:bold}
        td.r{text-align:right}
        td.conta{width:20mm;background:#fff}
        .totais{display:flex;justify-content:flex-end;margin-top:8px;font-size:12px;font-weight:bold}
        .assin{margin-top:16mm;display:flex;gap:30px}
        .assin div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:10px;text-align:center;color:#444}
        @media print{@page{margin:8mm}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Planilha de Contagem — Estoque${deptUrl ? ` · ${deptUrl}` : ""}</div><h1>${unidadeInfo?.nome || "Unidade"}</h1></div>
        <div class="meta">${itens.length} ingrediente(s)<br/>Impresso em ${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <table>
        <thead><tr><th>Ingrediente</th><th>Unid.</th><th>Saldo sistema</th><th>Custo/un.</th><th>Valor em estoque</th><th>Contagem física</th><th>Diferença</th></tr></thead>
        <tbody>${corpo}</tbody>
      </table>
      <div class="totais"><span>Valor total em estoque: ${fmtBRL(valorTotal)}</span></div>
      <div class="assin"><div>Contado por</div><div>Data da contagem</div><div>Assinatura do responsável</div></div>
      </body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir a planilha.");
  };

  const abrirAjuste = (item) => {
    setItemAtual(item);
    setNovoSaldo(item.quantidade_atual === 0 ? "" : item.quantidade_atual);
    setMinimoInput(item.estoque_minimo ?? "");
    setMaximoInput(item.estoque_maximo ?? "");
    setModalAjuste(true);
  };

  const handleSalvarAjuste = async () => {
    if(novoSaldo === "") return alert("Digite o saldo atual");
    if (minimoInput !== "" && maximoInput !== "" && Number(maximoInput) < Number(minimoInput)) {
      return alert("O estoque máximo não pode ser menor que o mínimo.");
    }
    await ajustarEstoque(unidadeAtiva, itemAtual.insumo_id, Number(novoSaldo));
    // Estoque mínimo (opcional): abaixo dele o item entra na lista de compras
    if (String(minimoInput) !== String(itemAtual.estoque_minimo ?? "")) {
      const { error } = await atualizarMinimoInsumo(itemAtual.insumo_id, minimoInput);
      if (error) alert(error);
    }
    // Estoque máximo (opcional): acima dele avisa que está sobrando
    if (String(maximoInput) !== String(itemAtual.estoque_maximo ?? "")) {
      const { error } = await atualizarMaximoInsumo(itemAtual.insumo_id, maximoInput);
      if (error) alert(error);
    }
    setModalAjuste(false);
    carregar();
  };

  // Lista de compras automática: tudo que está abaixo do mínimo definido
  const abaixoDoMinimo = itens.filter(i => Number(i.estoque_minimo) > 0 && Number(i.quantidade_atual) < Number(i.estoque_minimo));
  const imprimirCompras = () => {
    if (!abaixoDoMinimo.length) return alert("Nada abaixo do mínimo. Defina o estoque mínimo dos insumos no botão Ajustar.");
    const linhas = abaixoDoMinimo
      .sort((a, b) => (((Number(a.quantidade_atual) || 0) <= 0 ? 0 : 1) - ((Number(b.quantidade_atual) || 0) <= 0 ? 0 : 1)) || (a.departamento || "").localeCompare(b.departamento || "") || a.nome.localeCompare(b.nome, "pt-BR"))
      .map(i => {
        const saldo = Number(i.quantidade_atual) || 0;
        const min = Number(i.estoque_minimo) || 0;
        const sugerido = Math.max(0, +(min * fatorRep - saldo).toFixed(2)); // repõe até (fator × mínimo)
        const custo = (Number(i.custo_unitario) || 0) * sugerido;
        return { i, saldo, min, sugerido, custo };
      });
    const total = linhas.reduce((s, l) => s + l.custo, 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Lista de Compras — abaixo do mínimo</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:9mm}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px}
        .tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #94a3b8;padding:6px 7px;text-align:left}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        td.c{text-align:center;font-weight:bold}td.r{text-align:right;font-weight:bold}
        td.baixo{color:#dc2626}
        .tot{background:#f1f5f9;font-weight:bold}
        .check{width:10mm}
        @media print{@page{margin:8mm}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Lista de Compras — abaixo do estoque mínimo</div><h1>${unidadeInfo?.nome || "Unidade"}</h1></div>
        <div class="meta">${linhas.length} item(ns)<br/>${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <table>
        <thead><tr><th class="check">OK</th><th>Ingrediente</th><th>Depto</th><th>Saldo</th><th>Mínimo</th><th>Comprar (sug.)</th><th>Custo estimado</th></tr></thead>
        <tbody>
          ${linhas.map(l => `<tr>
            <td class="check"></td>
            <td><b>${l.i.nome}</b></td><td>${l.i.departamento || ""}</td>
            <td class="c baixo">${l.saldo.toLocaleString("pt-BR")} ${l.i.unidade_medida}</td>
            <td class="c">${l.min.toLocaleString("pt-BR")}</td>
            <td class="c">${l.sugerido.toLocaleString("pt-BR")} ${l.i.unidade_medida}</td>
            <td class="r">${fmtBRL(l.custo)}</td>
          </tr>`).join("")}
          <tr class="tot"><td colspan="6">TOTAL ESTIMADO</td><td class="r">${fmtBRL(total)}</td></tr>
        </tbody>
      </table>
      <p style="font-size:9px;color:#94a3b8;margin-top:8px">Sugestão de compra = repor até ${fatorRep}x o estoque mínimo. Custo estimado pelo último custo unitário.</p>
      </body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir.");
  };

  const abrirEntrada = (item) => {
    setItemAtual(item);
    setQtdEntrada("");
    setValorEntrada("");
    setModalEntrada(true);
  };

  const handleSalvarEntrada = async () => {
    if(!qtdEntrada || Number(qtdEntrada) <= 0) return alert("Digite a quantidade comprada.");
    const saldoAtual = Number(itemAtual.quantidade_atual || 0);
    const qtd = Number(qtdEntrada);
    const novaQtd = saldoAtual + qtd; // sempre SOMA ao saldo atual
    const valor = parseFloat(String(valorEntrada).replace(",", ".")) || 0;
    if (valor > 0) {
      // Registra a compra: soma o estoque E lança o valor (entra na reposição do mês)
      await registrarCompra(unidadeAtiva, itemAtual.insumo_id, itemAtual.nome, itemAtual.departamento, qtd, valor);
    } else {
      await ajustarEstoque(unidadeAtiva, itemAtual.insumo_id, novaQtd);
    }
    setModalEntrada(false);
    carregar();
    alert(`Entrada somada ao estoque! ${itemAtual.nome}: ${saldoAtual} + ${qtd} = ${novaQtd} ${itemAtual.unidade_medida}${valor > 0 ? `\nReposição de ${fmtBRL(valor)} lançada no mês.` : ""}`);
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
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
                 <PackageSearch size={28} />
              </div>
              <div>
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Estoque Físico</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Saldos e Entradas {deptUrl ? `- ${deptUrl}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
               <button onClick={() => { setModalLista(true); setListaItens(null); }} className="flex items-center justify-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-sm">
                  <Camera size={18} /> <span className="hidden sm:inline">Importar Lista (IA)</span><span className="sm:hidden">Lista IA</span>
               </button>
               <button onClick={imprimirCompras} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-colors shadow-sm ${abaixoDoMinimo.length ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"}`}>
                  <Plus size={18} /> Compras{abaixoDoMinimo.length ? ` (${abaixoDoMinimo.length})` : ""}
               </button>
               <button onClick={imprimirPlanilha} className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-4 py-3 rounded-xl font-bold hover:bg-slate-50 transition-colors shadow-sm">
                  <Printer size={18} /> Planilha
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-8">
         {/* Resumo: valor total parado no estoque + reposição (compras) do mês */}
         {(() => {
            const valorEstoque = itens.reduce((s, i) => s + (Number(i.custo_unitario) || 0) * (Number(i.quantidade_atual) || 0), 0);
            return (
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor total em estoque</p>
                     <p className="text-2xl font-black text-slate-800 mt-1">{fmtBRL(valorEstoque)}</p>
                     <p className="text-[10px] font-bold text-slate-400 mt-0.5">soma de todos os itens (custo × saldo)</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                     <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Reposição do mês</p>
                     <p className="text-2xl font-black text-emerald-700 mt-1">{fmtBRL(reposicaoMes)}</p>
                     <p className="text-[10px] font-bold text-slate-400 mt-0.5">compras lançadas neste mês</p>
                  </div>
                  <div className="bg-slate-900 rounded-2xl p-4 text-center shadow-sm">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estoque total do mês</p>
                     <p className="text-2xl font-black text-white mt-1">{fmtBRL(valorEstoque + reposicaoMes)}</p>
                     <p className="text-[10px] font-bold text-slate-500 mt-0.5">valor parado + reposição do mês</p>
                  </div>
               </div>
            );
         })()}
         <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 flex items-start gap-4">
            <AlertCircle className="text-slate-600 flex-shrink-0 mt-0.5" />
            <div>
               <h3 className="font-bold text-amber-800">Atenção ao Saldo Base</h3>
               <p className="text-emerald-700 text-sm mt-1">Para que a <strong>Produção do Dia</strong> funcione perfeitamente descontando insumos, certifique-se de que os ingredientes possuem saldo positivo aqui nesta tela.</p>
            </div>
         </div>

         <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-3 flex items-center gap-3 shadow-sm">
            <Search size={20} className="text-slate-500 ml-2" />
            <input type="text" placeholder="Buscar ingrediente ou produto..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-bold text-slate-700 p-2" />
         </div>

         {/* Ingredientes × produtos prontos */}
         <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
            {["Todos", "Ingredientes", "Produtos prontos"].map(t => {
               const n = t === "Todos" ? itens.length : itens.filter(i => t === "Produtos prontos" ? i.tipo === "produto" : i.tipo !== "produto").length;
               return (
                  <button key={t} onClick={() => setTipoFiltro(t)}
                     className={`px-3.5 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap transition-colors ${tipoFiltro === t ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}>
                     {t} <span className={tipoFiltro === t ? "text-slate-400" : "text-slate-400"}>({n})</span>
                  </button>
               );
            })}
         </div>

         <div className="rounded-2xl overflow-x-auto shadow-md border border-slate-200">
            {/* Header da tabela */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center min-w-[720px]">
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Ingrediente</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-24">Custo/Un.</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-20">Unid.</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-32">Saldo Atual</span>
               <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-right w-48">Ação</span>
            </div>

            {/* Linhas */}
            <div className="bg-white divide-y divide-slate-100">
               {loading && (
                 <div className="p-12 text-center">
                   <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                   <p className="text-slate-400 font-bold text-sm">Buscando saldos...</p>
                 </div>
               )}
               {!loading && filtrados.map((ins, idx) => {
                 const zerado = ins.quantidade_atual <= 0;
                 const min = Number(ins.estoque_minimo) || 0;
                 const max = Number(ins.estoque_maximo) || 0;
                 // Com mínimo definido, o alerta segue o mínimo; sem, mantém o padrão (<5)
                 const critico = !zerado && (min > 0 ? ins.quantidade_atual < min : ins.quantidade_atual < 5);
                 // Acima do máximo definido: está sobrando estoque
                 const acima = !zerado && !critico && max > 0 && ins.quantidade_atual > max;
                 const dept = ins.departamento?.toLowerCase();
                 const deptColor = dept === 'bar' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';
                 return (
                   <div key={ins.insumo_id} className={`px-6 py-4 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center min-w-[720px] group transition-all duration-150 ${zerado ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-emerald-50/40'}`}>
                     {/* Nome + Dept */}
                     <div className="flex items-center gap-3 min-w-0">
                       <div className={`w-1 h-10 rounded-full shrink-0 ${zerado ? 'bg-red-400' : critico ? 'bg-amber-400' : acima ? 'bg-sky-400' : 'bg-emerald-400'}`} />
                       <div className="min-w-0">
                         <p className="font-bold text-slate-800 text-[15px] leading-tight truncate">{ins.nome}{ins.marca ? <span className="text-slate-400 font-medium"> · {ins.marca}</span> : null}</p>
                         <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ${deptColor}`}>{ins.departamento}</span>
                         {ins.tipo === "produto" && <span className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-1 ml-1 bg-sky-100 text-sky-700">Produto pronto</span>}
                       </div>
                     </div>
                     {/* Custo */}
                     <div className="w-24 flex justify-center">
                       <span className="font-bold text-slate-500 text-sm">{fmtBRL(ins.custo_unitario)}</span>
                     </div>
                     {/* Unidade */}
                     <div className="w-20 flex justify-center">
                       <span className="bg-slate-800 text-white px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider shadow-sm">{ins.unidade_medida}</span>
                     </div>
                     {/* Saldo */}
                     <div className="w-32 flex flex-col items-center">
                       <span className={`font-black text-2xl leading-none ${zerado ? 'text-red-500' : critico ? 'text-amber-500' : acima ? 'text-sky-600' : 'text-emerald-600'}`}>
                         {Number(ins.quantidade_atual).toFixed(2)}
                       </span>
                       {zerado && <span className="text-[9px] font-black uppercase tracking-widest text-red-400 mt-1">Zerado</span>}
                       {critico && <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 mt-1">{min > 0 ? `Abaixo do mín (${min})` : "Crítico"}</span>}
                       {acima && <span className="text-[9px] font-black uppercase tracking-widest text-sky-500 mt-1">Acima do máx ({max})</span>}
                       {!zerado && !critico && !acima && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 mt-1">Normal</span>}
                     </div>
                     {/* Ação */}
                     <div className="w-48 flex items-center justify-end gap-2">
                       <button onClick={() => abrirEntrada(ins)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95">
                         <Plus size={13}/> Entrada
                       </button>
                       <button onClick={() => abrirAjuste(ins)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all shadow-sm active:scale-95">
                         <RefreshCw size={13}/> Ajustar
                       </button>
                     </div>
                   </div>
                 );
               })}
               {!loading && filtrados.length === 0 && (
                 <div className="p-16 text-center">
                   <PackageSearch size={40} className="text-slate-200 mx-auto mb-3" />
                   <p className="text-slate-400 font-bold">Nenhum ingrediente cadastrado ainda.</p>
                 </div>
               )}
            </div>
         </div>
      </div>

      {modalAjuste && itemAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-sm p-5 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Ajuste de Saldo</h2>
                  <button onClick={() => setModalAjuste(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                     <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">{itemAtual.nome}</p>
                     <p className="text-3xl font-black text-slate-800">{Number(itemAtual.quantidade_atual).toFixed(2)} <span className="text-lg text-slate-500">{itemAtual.unidade_medida}</span></p>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Novo Saldo Real (Balanço)</label>
                     <div className="relative">
                        <input
                           type="number" step="0.001" placeholder="0.00"
                           value={novoSaldo} onChange={e=>setNovoSaldo(e.target.value)}
                           className="w-full p-5 text-2xl bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-500">{itemAtual.unidade_medida}</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-xs font-bold text-amber-600 uppercase tracking-widest block mb-2">Mínimo (avisa)</label>
                        <div className="relative">
                           <input
                              type="number" step="0.001" min="0" placeholder="Ex: 5"
                              value={minimoInput} onChange={e=>setMinimoInput(e.target.value)}
                              className="w-full p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl font-black text-amber-800 outline-none focus:border-amber-500"
                           />
                           <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-amber-500 text-sm">{itemAtual.unidade_medida}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Abaixo dele: alerta e entra na lista de Compras.</p>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-sky-600 uppercase tracking-widest block mb-2">Máximo (opcional)</label>
                        <div className="relative">
                           <input
                              type="number" step="0.001" min="0" placeholder="Ex: 50"
                              value={maximoInput} onChange={e=>setMaximoInput(e.target.value)}
                              className="w-full p-4 bg-sky-50 border-2 border-sky-200 rounded-2xl font-black text-sky-800 outline-none focus:border-sky-500"
                           />
                           <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-sky-500 text-sm">{itemAtual.unidade_medida}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Acima dele: avisa que está sobrando.</p>
                     </div>
                  </div>
               </div>

               <button onClick={handleSalvarAjuste} className="w-full mt-8 py-5 bg-slate-800 hover:bg-slate-900 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-slate-500/20 active:scale-95 flex items-center justify-center gap-2">
                  <RefreshCw size={20}/> Sobrescrever Saldo
               </button>
            </div>
         </div>
      )}

      {modalEntrada && itemAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-sm p-5 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Lançar Entrada</h2>
                  <button onClick={() => setModalEntrada(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                     <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-1">{itemAtual.nome}</p>
                     <p className="text-sm font-medium text-emerald-700">Saldo Atual: {Number(itemAtual.quantidade_atual).toFixed(2)} {itemAtual.unidade_medida}</p>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Quantas {itemAtual.unidade_medida}s foram compradas?</label>
                     <div className="relative">
                        <input 
                           type="number" step="0.001" placeholder="Ex: 10" 
                           value={qtdEntrada} onChange={e=>setQtdEntrada(e.target.value)} 
                           className="w-full p-5 text-2xl bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-500">{itemAtual.unidade_medida}</span>
                     </div>
                  </div>
               </div>

               <button onClick={handleSalvarEntrada} className="w-full mt-8 py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2">
                  <TrendingUp size={20}/> Somar ao Estoque
               </button>
            </div>
         </div>
      )}

      {/* IMPORTAR LISTA POR IA */}
      {modalLista && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl p-5 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-4">
                  <h2 className="font-black text-2xl text-slate-800">Importar Lista de Produtos</h2>
                  <button onClick={() => { setModalLista(false); setListaItens(null); }} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <input ref={inputListaRef} type="file" accept="image/*" className="hidden" onChange={lerFotoLista} />

               {!listaItens ? (
                  <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-slate-200 rounded-2xl">
                     {listaLendo ? (
                        <>
                           <Loader2 size={40} className="animate-spin text-emerald-600" />
                           <p className="font-bold text-slate-600">A IA está lendo a lista (nome, marca e quantidade)...</p>
                        </>
                     ) : (
                        <>
                           <Camera size={40} className="text-emerald-600" />
                           <p className="font-bold text-slate-700 text-center">Tire uma foto da lista ou planilha de produtos<br/><span className="text-sm font-medium text-slate-400">A IA lê nome, marca e quantidade — você só completa validade e preço de compra</span></p>
                           <button onClick={() => inputListaRef.current?.click()} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2"><Camera size={16}/> Abrir câmera / galeria</button>
                           <button onClick={imprimirPlanilhaLista} className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Printer size={13}/> Imprimir planilha em branco para preencher à mão</button>
                        </>
                     )}
                  </div>
               ) : (
                  <>
                     <p className="text-xs font-bold text-slate-500 mb-3">{listaItens.length} item(ns) lidos. Confira e complete a <span className="text-amber-600">validade</span> e o <span className="text-emerald-600">preço de compra</span> (opcionais):</p>
                     <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                        {listaItens.map((it, idx) => (
                           <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                              <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                 <input value={it.nome} onChange={e => setListaItens(p => p.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))}
                                    className="font-bold text-slate-800 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-emerald-500" placeholder="Nome do produto" />
                                 <button onClick={() => setListaItens(p => p.filter((_, i) => i !== idx))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-red-500 flex items-center justify-center"><X size={14}/></button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                 <input value={it.marca} onChange={e => setListaItens(p => p.map((x, i) => i === idx ? { ...x, marca: e.target.value } : x))}
                                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 outline-none" placeholder="Marca" />
                                 <div className="flex items-center gap-1">
                                    <input type="number" value={it.quantidade} onChange={e => setListaItens(p => p.map((x, i) => i === idx ? { ...x, quantidade: e.target.value } : x))}
                                       className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-800 outline-none" placeholder="Qtd" />
                                    <span className="text-[10px] font-black text-slate-400">{it.unidade}</span>
                                 </div>
                                 <input type="date" value={it.validade} onChange={e => setListaItens(p => p.map((x, i) => i === idx ? { ...x, validade: e.target.value } : x))}
                                    className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-xs font-bold text-amber-800 outline-none" title="Validade" />
                                 <input type="number" step="0.01" value={it.preco} onChange={e => setListaItens(p => p.map((x, i) => i === idx ? { ...x, preco: e.target.value } : x))}
                                    className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-800 outline-none" placeholder="Preço R$ (total)" />
                              </div>
                           </div>
                        ))}
                     </div>
                     <div className="flex gap-3 mt-5">
                        <button onClick={() => setListaItens(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold">Ler outra foto</button>
                        <button onClick={salvarListaImportada} disabled={listaSalvando} className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                           {listaSalvando ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>} Dar entrada no estoque
                        </button>
                     </div>
                     <p className="text-[10px] font-medium text-slate-400 mt-3">Itens com validade entram no Controle de Validade e no aviso de "sai primeiro". Itens com preço entram como compra na reposição do mês.</p>
                  </>
               )}
            </div>
         </div>
      )}

    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold text-slate-500">Carregando Estoque...</div>}>
       <EstoqueRunner />
    </Suspense>
  );
}
