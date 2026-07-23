"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import {
  fetchEstoque,
  ajustarEstoque,
  atualizarMinimoInsumo,
  atualizarMaximoInsumo,
  registrarCompra,
  fetchReposicaoMes,
  fetchMovimentosEstoque,
  registrarMovimentoEstoque
} from "../../../lib/estoque";
import { salvarInsumo } from "../../../lib/operacao";
import { comprimirFotoParaIA } from "../../../lib/imagem";
import { criarEtiqueta, gerarCodigo } from "../../../lib/etiquetas";
import { fetchParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { useTempoReal } from "../../../lib/realtime";
import {
  PackageSearch, Edit3, X, Save, ArrowLeft, RefreshCw, AlertCircle, Search,
  Plus, TrendingUp, TrendingDown, Printer, Camera, Loader2, CheckCircle2,
  History, PackageMinus, PackagePlus, CalendarDays, UserRound, Filter, ShieldAlert
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";

const agoraLocal = () => {
  const data = new Date();
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 16);
};

const fmtDataHora = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

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
  const [abaEstoque, setAbaEstoque] = useState("atual"); // "atual" | "historico"
  const [movimentos, setMovimentos] = useState([]);
  const [filtroMovimento, setFiltroMovimento] = useState("todos"); // "todos" | "entrada" | "saida"

  // Importar lista por IA
  const [modalLista, setModalLista] = useState(false);
  const [listaLendo, setListaLendo] = useState(false);
  const [listaItens, setListaItens] = useState(null);
  const [listaSalvando, setListaSalvando] = useState(false);
  const inputListaRef = useRef(null);

  // Contagem de estoque por IA
  const [modalContagem, setModalContagem] = useState(false);
  const [contagemLendo, setContagemLendo] = useState(false);
  const [contagemItens, setContagemItens] = useState(null);
  const [contagemSalvando, setContagemSalvando] = useState(false);
  const [ditado, setDitado] = useState("");
  const [gravando, setGravando] = useState(false);
  const inputContagemRef = useRef(null);
  const reconhecimentoRef = useRef(null);
  
  // Modais de Operações em Itens
  const [modalAjuste, setModalAjuste] = useState(false);
  const [modalMovimento, setModalMovimento] = useState(false);
  const [itemAtual, setItemAtual] = useState(null);
  const [tipoMovimento, setTipoMovimento] = useState("entrada"); // "entrada" ou "saida"

  // Campos de Entrada / Saída
  const [qtdUnidades, setQtdUnidades] = useState("");
  const [valorPago, setValorPago] = useState("");
  const [responsavelMov, setResponsavelMov] = useState("");
  const [motivoMov, setMotivoMov] = useState("");
  const [dataMov, setDataMov] = useState(agoraLocal());
  const [salvandoMov, setSalvandoMov] = useState(false);

  // Campos de Ajuste Balanço
  const [novoSaldoUnidades, setNovoSaldoUnidades] = useState("");
  const [minimoUnidades, setMinimoUnidades] = useState("");
  const [maximoUnidades, setMaximoUnidades] = useState("");

  const [fatorRep, setFatorRep] = useState(PARAMS_PADRAO.fator_reposicao);
  useEffect(() => {
    if (unidadeAtiva && unidadeAtiva !== "todas") {
      fetchParams(unidadeAtiva).then(r => setFatorRep(r.data.fator_reposicao));
    }
  }, [unidadeAtiva]);

  const [reposicaoMes, setReposicaoMes] = useState(0);

  const carregar = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const mes = new Date().toISOString().slice(0, 7);
    const [rEst, rRep, rMov] = await Promise.all([
      fetchEstoque(unidadeAtiva, deptUrl),
      fetchReposicaoMes(unidadeAtiva, mes),
      fetchMovimentosEstoque(unidadeAtiva, deptUrl),
    ]);
    setItens(rEst.data || []);
    setReposicaoMes(rRep.total || 0);
    setMovimentos(rMov.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl]);

  // Tempo real
  useTempoReal(["estoque_atual", "estoque_movimentos", "insumos", "producao_diaria"], () => {
    if (unidadeAtiva) carregar(true);
  });

  const filtrados = itens.filter(i =>
    i.nome.toLowerCase().includes(busca.toLowerCase()) &&
    (tipoFiltro === "Todos" || (tipoFiltro === "Produtos prontos" ? i.tipo === "produto" : i.tipo !== "produto"))
  );

  const movimentosFiltrados = movimentos.filter(m =>
    filtroMovimento === "todos" || m.tipo === filtroMovimento
  );

  // ── Importar lista por IA ──
  const lerFotoLista = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setListaLendo(true);
    try {
      const base64 = await comprimirFotoParaIA(file);
      const res = await fetch("/api/ia-lista-estoque", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagem_base64: base64, media_type: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao ler a lista."); return; }
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

        if (preco > 0) {
          await registrarCompra(unidadeAtiva, insumoId, item.nome.trim(), deptUrl || "cozinha", qtd, preco);
        }
        
        await registrarMovimentoEstoque({
          unidadeId: unidadeAtiva,
          insumoId,
          departamento: deptUrl || "cozinha",
          tipo: "entrada",
          quantidadeUnidades: qtd,
          responsavel: "Lista IA",
          motivo: "Importação por Foto (IA)",
        });

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
      alert(`${ok} item(ns) deram entrada no estoque.`);
      setModalLista(false);
      setListaItens(null);
      carregar();
    } finally { setListaSalvando(false); }
  };

  // ── Contagem por IA ──
  const casarContagem = (lidos) => lidos.map(l => {
    const alvo = l.nome.trim().toLowerCase();
    const insumo = itens.find(x => x.nome.trim().toLowerCase() === alvo)
      || itens.find(x => x.nome.toLowerCase().includes(alvo) || alvo.includes(x.nome.toLowerCase()));
    return { ...l, insumo: insumo || null };
  });

  const lerFotoContagem = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setContagemLendo(true);
    try {
      const base64 = await comprimirFotoParaIA(file);
      const res = await fetch("/api/ia-contagem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagem_base64: base64, media_type: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao ler a contagem."); return; }
      setContagemItens(casarContagem(data.itens));
    } catch { alert("Não consegui falar com a IA. Verifique a conexão."); } finally { setContagemLendo(false); }
  };

  const interpretarDitado = async () => {
    if (!ditado.trim()) return alert("Fale ou digite a contagem primeiro.");
    setContagemLendo(true);
    try {
      const res = await fetch("/api/ia-contagem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: ditado }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { alert(data.error || "Falha ao interpretar a contagem."); return; }
      setContagemItens(casarContagem(data.itens));
    } catch { alert("Não consegui falar com a IA. Verifique a conexão."); } finally { setContagemLendo(false); }
  };

  const alternarGravacao = () => {
    if (gravando) { try { reconhecimentoRef.current?.stop(); } catch {} setGravando(false); return; }
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) return alert("Navegador sem suporte a ditado por voz. Use o Chrome ou digite.");
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev) => {
      const trecho = Array.from(ev.results).slice(ev.resultIndex).map(r => r[0]?.transcript || "").join(" ");
      if (trecho.trim()) setDitado(p => (p ? p + ", " : "") + trecho.trim());
    };
    rec.onerror = () => setGravando(false);
    rec.onend = () => setGravando(false);
    reconhecimentoRef.current = rec;
    setDitado("");
    setGravando(true);
    try { rec.start(); } catch { setGravando(false); }
  };

  const aplicarContagem = async () => {
    const validos = (contagemItens || []).filter(c => c.insumo && Number.isFinite(Number(c.quantidade)));
    if (!validos.length) return alert("Nenhum item casou com o estoque. Confira os nomes.");
    setContagemSalvando(true);
    try {
      for (const c of validos) {
        const conteudo = Number(c.insumo.tamanho_embalagem) || 1;
        await ajustarEstoque(unidadeAtiva, c.insumo.insumo_id, Number(c.quantidade) * conteudo);
      }
      alert(`Contagem aplicada: ${validos.length} item(ns) atualizados.`);
      setModalContagem(false);
      setContagemItens(null);
      setDitado("");
      carregar();
    } finally { setContagemSalvando(false); }
  };

  // ── Impressão de Planilhas ──
  const imprimirPlanilhaLista = () => {
    const linhas = Array.from({ length: 22 }).map(() => `<tr><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Lista de Entrada de Produtos</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial;color:#111;padding:10mm}
      h1{font-size:18px;margin-bottom:2px}p{font-size:10px;color:#555;margin-bottom:8px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #555;padding:9px 8px;font-size:12px;text-align:left}
      th{background:#eee;font-size:9px;text-transform:uppercase;letter-spacing:1px}td{height:9mm}
      @media print{@page{margin:8mm}}</style></head><body>
      <h1>Lista de Entrada de Produtos — ${unidadeInfo?.nome || ""}</h1>
      <p>Preencha à mão e tire foto no botão "Importar Lista (IA)" do Estoque.</p>
      <table><thead><tr><th style="width:34%">Produto</th><th style="width:18%">Marca</th><th style="width:12%">Qtd</th><th style="width:18%">Validade</th><th style="width:18%">Preço de compra</th></tr></thead>
      <tbody>${linhas}</tbody></table></body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300); }
  };

  const imprimirPlanilha = () => {
    if (!itens.length) return alert("Estoque vazio.");
    const grupos = {};
    itens.forEach(i => { const d = (i.departamento || "geral").toLowerCase(); (grupos[d] = grupos[d] || []).push(i); });
    let corpo = "";
    Object.keys(grupos).sort().forEach(dep => {
      const lista = grupos[dep].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      corpo += `<tr class="cat"><td colspan="7">${dep.toUpperCase()}</td></tr>` + lista.map(i => {
        const conteudo = Number(i.tamanho_embalagem) || 1;
        const unDisponiveis = (Number(i.quantidade_atual) || 0) / conteudo;
        const custo = Number(i.custo_unitario) || 0;
        return `<tr>
          <td><b>${i.nome}</b> ${i.marca ? `(${i.marca})` : ''}</td>
          <td class="c">${conteudo > 1 ? `${conteudo} ${i.unidade_medida}` : String(i.unidade_medida).toUpperCase()}</td>
          <td class="c">${unDisponiveis.toFixed(2)} un.</td>
          <td class="r">${custo > 0 ? fmtBRL(custo) : ""}</td>
          <td class="r">${custo > 0 ? fmtBRL(custo * unDisponiveis) : ""}</td>
          <td class="conta"></td>
          <td class="conta"></td>
        </tr>`;
      }).join("");
    });
    const valorTotal = itens.reduce((s, i) => {
      const un = (Number(i.quantidade_atual) || 0) / (Number(i.tamanho_embalagem) || 1);
      return s + (Number(i.custo_unitario) || 0) * un;
    }, 0);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Estoque — ${unidadeInfo?.nome || ""}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:8mm}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px}.tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #94a3b8;padding:5px 6px;text-align:left}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        tr.cat td{background:#f1f5f9;font-weight:bold;letter-spacing:1px;font-size:10px;color:#334155}
        td.c{text-align:center;font-weight:bold}td.r{text-align:right}td.conta{width:20mm;background:#fff}
        .totais{display:flex;justify-content:flex-end;margin-top:8px;font-size:12px;font-weight:bold}
        .assin{margin-top:16mm;display:flex;gap:30px}
        .assin div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:10px;text-align:center;color:#444}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Planilha de Contagem — Estoque${deptUrl ? ` · ${deptUrl}` : ""}</div><h1>${unidadeInfo?.nome || "Unidade"}</h1></div>
        <div class="meta">${itens.length} produto(s)<br/>Impresso em ${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <table>
        <thead><tr><th>Produto</th><th>Embalagem</th><th>Saldo Sistema</th><th>Custo/un.</th><th>Valor Total</th><th>Contagem Física</th><th>Diferença</th></tr></thead>
        <tbody>${corpo}</tbody>
      </table>
      <div class="totais"><span>Valor total em estoque: ${fmtBRL(valorTotal)}</span></div>
      <div class="assin"><div>Contado por</div><div>Data da contagem</div><div>Assinatura do responsável</div></div>
      </body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
  };

  const abaixoDoMinimo = itens.filter(i => {
    const conteudo = Number(i.tamanho_embalagem) || 1;
    const minUn = i.estoque_minimo == null ? 0 : Number(i.estoque_minimo) / conteudo;
    const saldoUn = Number(i.quantidade_atual || 0) / conteudo;
    return minUn > 0 && saldoUn < minUn;
  });

  const imprimirCompras = () => {
    if (!abaixoDoMinimo.length) return alert("Nenhum item abaixo do estoque mínimo.");
    const linhas = abaixoDoMinimo.map(i => {
      const conteudo = Number(i.tamanho_embalagem) || 1;
      const saldoUn = (Number(i.quantidade_atual) || 0) / conteudo;
      const minUn = Number(i.estoque_minimo || 0) / conteudo;
      const sugerido = Math.max(0, +(minUn * fatorRep - saldoUn).toFixed(2));
      const custo = (Number(i.custo_unitario) || 0) * sugerido;
      return { i, saldoUn, minUn, sugerido, custo, conteudo };
    });
    const total = linhas.reduce((s, l) => s + l.custo, 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Lista de Compras</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:9mm}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px}.tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #94a3b8;padding:6px 7px;text-align:left}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        td.c{text-align:center;font-weight:bold}td.r{text-align:right;font-weight:bold}
        td.baixo{color:#dc2626}.tot{background:#f1f5f9;font-weight:bold}.check{width:10mm}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Lista de Compras — Reposição de Estoque</div><h1>${unidadeInfo?.nome || "Unidade"}</h1></div>
        <div class="meta">${linhas.length} item(ns)<br/>${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
      <table>
        <thead><tr><th class="check">OK</th><th>Produto</th><th>Depto</th><th>Saldo Atual</th><th>Mínimo</th><th>Comprar (Sugestão)</th><th>Custo Estimado</th></tr></thead>
        <tbody>
          ${linhas.map(l => `<tr>
            <td class="check"></td>
            <td><b>${l.i.nome}</b> ${l.i.marca ? `(${l.i.marca})` : ''}</td>
            <td>${l.i.departamento || ""}</td>
            <td class="c baixo">${l.saldoUn.toFixed(1)} un.</td>
            <td class="c">${l.minUn.toFixed(1)} un.</td>
            <td class="c">${l.sugerido.toFixed(0)} un. (${(l.sugerido * l.conteudo).toLocaleString('pt-BR')} ${l.i.unidade_medida})</td>
            <td class="r">${fmtBRL(l.custo)}</td>
          </tr>`).join("")}
          <tr class="tot"><td colspan="6">TOTAL ESTIMADO</td><td class="r">${fmtBRL(total)}</td></tr>
        </tbody>
      </table>
      </body></html>`;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 400); }
  };

  // ── Abertura de Modais de Operação ──
  const abrirMovimentoModal = (item, tipo) => {
    setItemAtual(item);
    setTipoMovimento(tipo); // "entrada" ou "saida"
    setQtdUnidades("");
    setValorPago("");
    setResponsavelMov("");
    setMotivoMov(tipo === "entrada" ? "Compra / reposição" : "Uso na operação (Bar)");
    setDataMov(agoraLocal());
    setModalMovimento(true);
  };

  const handleSalvarMovimento = async () => {
    if (!qtdUnidades || Number(qtdUnidades) <= 0) {
      return alert("Digite quantas unidades foram " + (tipoMovimento === "entrada" ? "compradas/recebidas." : "retiradas."));
    }
    if (tipoMovimento === "saida" && !responsavelMov.trim()) {
      return alert("Informe quem retirou o produto do estoque.");
    }
    setSalvandoMov(true);

    try {
      const un = Number(qtdUnidades);
      const valor = parseFloat(String(valorPago).replace(",", ".")) || 0;

      // Se for entrada e informou valor pago, registra no financeiro e atualiza custo unitário
      if (tipoMovimento === "entrada" && valor > 0) {
        await registrarCompra(
          unidadeAtiva,
          itemAtual.insumo_id,
          itemAtual.nome,
          itemAtual.departamento,
          un,
          valor,
          motivoMov
        );
      }

      const { error } = await registrarMovimentoEstoque({
        unidadeId: unidadeAtiva,
        insumoId: itemAtual.insumo_id,
        departamento: itemAtual.departamento,
        tipo: tipoMovimento,
        quantidadeUnidades: un,
        responsavel: responsavelMov,
        motivo: motivoMov,
        dataMovimento: dataMov,
      });

      if (error) { alert("Erro ao registrar: " + error); return; }

      setModalMovimento(false);
      await carregar(true);
      alert(`${tipoMovimento === "entrada" ? "Entrada (+)" : "Baixa (-)"} de ${un} unidade(s) registrada com sucesso!`);
    } finally {
      setSalvandoMov(false);
    }
  };

  const abrirAjuste = (item) => {
    const conteudo = Number(item.tamanho_embalagem) || 1;
    setItemAtual(item);
    const saldoUn = Number(item.quantidade_atual || 0) / conteudo;
    const minUn = item.estoque_minimo == null ? "" : Number(item.estoque_minimo) / conteudo;
    const maxUn = item.estoque_maximo == null ? "" : Number(item.estoque_maximo) / conteudo;

    setNovoSaldoUnidades(item.quantidade_atual === 0 ? "" : saldoUn);
    setMinimoUnidades(minUn);
    setMaximoUnidades(maxUn);
    setModalAjuste(true);
  };

  const handleSalvarAjuste = async () => {
    if (novoSaldoUnidades === "") return alert("Digite o saldo real em unidades.");
    const conteudo = Number(itemAtual.tamanho_embalagem) || 1;
    const novoSaldoBase = Number(novoSaldoUnidades) * conteudo;
    const minBase = minimoUnidades === "" ? null : Number(minimoUnidades) * conteudo;
    const maxBase = maximoUnidades === "" ? null : Number(maximoUnidades) * conteudo;

    await ajustarEstoque(unidadeAtiva, itemAtual.insumo_id, novoSaldoBase);

    if (String(minimoUnidades) !== String(itemAtual.estoque_minimo == null ? "" : Number(itemAtual.estoque_minimo) / conteudo)) {
      await atualizarMinimoInsumo(itemAtual.insumo_id, minBase);
    }
    if (String(maximoUnidades) !== String(itemAtual.estoque_maximo == null ? "" : Number(itemAtual.estoque_maximo) / conteudo)) {
      await atualizarMaximoInsumo(itemAtual.insumo_id, maxBase);
    }

    setModalAjuste(false);
    carregar();
    alert("Saldo e parâmetros atualizados com sucesso!");
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
                 <h1 className="text-3xl font-black tracking-tighter text-slate-900">Estoque do Bar e Cozinha</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">
                   Controle de Entradas, Baixas e Saldos {deptUrl ? `- ${deptUrl}` : ''}
                 </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
               <button onClick={() => { setModalLista(true); setListaItens(null); }} className="flex items-center justify-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-4 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-sm">
                  <Camera size={18} /> <span className="hidden sm:inline">Importar Lista (IA)</span><span className="sm:hidden">Lista IA</span>
               </button>
               <button onClick={imprimirCompras} className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold transition-colors shadow-sm ${abaixoDoMinimo.length ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"}`}>
                  <Plus size={18} /> Compras{abaixoDoMinimo.length ? ` (${abaixoDoMinimo.length})` : ""}
               </button>
               <button onClick={() => { setModalContagem(true); setContagemItens(null); }} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-sm">
                  <RefreshCw size={18} /> <span className="hidden sm:inline">Contagem (IA)</span><span className="sm:hidden">Contagem</span>
               </button>
            </div>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-6">
         {/* Resumo */}
         {(() => {
            const valorTotalEstoque = itens.reduce((s, i) => {
              const un = (Number(i.quantidade_atual) || 0) / (Number(i.tamanho_embalagem) || 1);
              return s + (Number(i.custo_unitario) || 0) * un;
            }, 0);
            return (
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor total em estoque</p>
                     <p className="text-2xl font-black text-slate-800 mt-1">{fmtBRL(valorTotalEstoque)}</p>
                     <p className="text-[10px] font-bold text-slate-400 mt-0.5">{itens.length} produtos cadastrados</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center shadow-sm">
                     <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Reposição do mês</p>
                     <p className="text-2xl font-black text-emerald-700 mt-1">{fmtBRL(reposicaoMes)}</p>
                     <p className="text-[10px] font-bold text-slate-400 mt-0.5">entradas/compras neste mês</p>
                  </div>
                  <div className="bg-slate-900 rounded-2xl p-4 text-center shadow-sm">
                     <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">Abaixo do Mínimo</p>
                     <p className="text-2xl font-black text-white mt-1">{abaixoDoMinimo.length} item(ns)</p>
                     <p className="text-[10px] font-bold text-slate-400 mt-0.5">precisam de reposição rápida</p>
                  </div>
               </div>
            );
         })()}

         {/* ABAS DO ESTOQUE: ESTOQUE ATUAL vs HISTÓRICO DE MOVIMENTAÇÕES */}
         <div className="flex gap-2 mb-6 border-b border-slate-200 pb-3">
            <button
              onClick={() => setAbaEstoque("atual")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all ${abaEstoque === "atual" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
               <PackageSearch size={18} /> Estoque Atual ({itens.length})
            </button>
            <button
              onClick={() => setAbaEstoque("historico")}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-sm transition-all ${abaEstoque === "historico" ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
               <History size={18} /> Histórico de Entradas & Baixas ({movimentos.length})
            </button>
         </div>

         {/* ABA 1: ESTOQUE ATUAL */}
         {abaEstoque === "atual" && (
           <>
             <div className="bg-white p-3 rounded-2xl border border-slate-200 mb-3 flex items-center gap-3 shadow-sm">
                <Search size={20} className="text-slate-500 ml-2" />
                <input
                  type="text"
                  placeholder="Buscar produto por nome ou marca..."
                  value={busca}
                  onChange={e=>setBusca(e.target.value)}
                  className="flex-1 outline-none font-bold text-slate-700 p-2"
                />
             </div>

             <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
                {["Todos", "Ingredientes", "Produtos prontos"].map(t => {
                   const n = t === "Todos" ? itens.length : itens.filter(i => t === "Produtos prontos" ? i.tipo === "produto" : i.tipo !== "produto").length;
                   return (
                      <button key={t} onClick={() => setTipoFiltro(t)}
                         className={`px-3.5 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap transition-colors ${tipoFiltro === t ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-200"}`}>
                         {t} <span className="text-slate-400">({n})</span>
                      </button>
                   );
                })}
             </div>

             <div className="rounded-2xl overflow-x-auto shadow-md border border-slate-200">
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center min-w-[820px]">
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Produto & Marca</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-28">Embalagem</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-28">Custo/Un.</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-36">Saldo Disponível</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-right w-56">Movimentação</span>
                </div>

                <div className="bg-white divide-y divide-slate-100">
                   {loading && (
                     <div className="p-12 text-center">
                       <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                       <p className="text-slate-400 font-bold text-sm">Carregando estoque...</p>
                     </div>
                   )}
                   {!loading && filtrados.map((ins) => {
                     const conteudo = Number(ins.tamanho_embalagem) || 1;
                     const saldoUnidades = (Number(ins.quantidade_atual) || 0) / conteudo;
                     const zerado = saldoUnidades <= 0;
                     
                     const minUn = ins.estoque_minimo == null ? 0 : Number(ins.estoque_minimo) / conteudo;
                     const maxUn = ins.estoque_maximo == null ? 0 : Number(ins.estoque_maximo) / conteudo;

                     const critico = !zerado && (minUn > 0 ? saldoUnidades < minUn : saldoUnidades < 5);
                     const acima = !zerado && !critico && maxUn > 0 && saldoUnidades > maxUn;
                     const dept = ins.departamento?.toLowerCase();
                     const deptColor = dept === 'bar' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700';

                     return (
                       <div key={ins.insumo_id} className={`px-6 py-4 grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center min-w-[820px] group transition-all duration-150 ${zerado ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-emerald-50/40'}`}>
                         {/* Nome + Marca */}
                         <div className="flex items-center gap-3 min-w-0">
                           <div className={`w-1.5 h-12 rounded-full shrink-0 ${zerado ? 'bg-red-500' : critico ? 'bg-amber-500' : acima ? 'bg-sky-500' : 'bg-emerald-500'}`} />
                           <div className="min-w-0">
                             <p className="font-bold text-slate-800 text-[15px] leading-tight truncate">
                               {ins.nome}
                               {ins.marca ? <span className="text-slate-400 font-medium"> · {ins.marca}</span> : null}
                             </p>
                             <div className="flex items-center gap-1 mt-1">
                               <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${deptColor}`}>{ins.departamento}</span>
                               {ins.tipo === "produto" && <span className="inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">Produto Pronto</span>}
                             </div>
                           </div>
                         </div>

                         {/* Embalagem */}
                         <div className="w-28 flex flex-col items-center">
                           <span className="font-black text-slate-700 text-xs uppercase bg-slate-100 px-2.5 py-1 rounded-lg">
                             {conteudo > 1 ? `${conteudo} ${ins.unidade_medida}` : ins.unidade_medida}
                           </span>
                           <span className="text-[10px] text-slate-400 font-medium mt-0.5">conteúdo por un.</span>
                         </div>

                         {/* Custo */}
                         <div className="w-28 flex flex-col items-center">
                           <span className="font-bold text-slate-800 text-sm">{fmtBRL(ins.custo_unitario)}</span>
                           <span className="text-[10px] text-slate-400 font-medium">por unidade</span>
                         </div>

                         {/* Saldo Atual */}
                         <div className="w-36 flex flex-col items-center">
                           <div className="flex items-baseline gap-1">
                             <span className={`font-black text-2xl leading-none ${zerado ? 'text-red-500' : critico ? 'text-amber-500' : acima ? 'text-sky-600' : 'text-emerald-600'}`}>
                               {saldoUnidades.toFixed(saldoUnidades % 1 === 0 ? 0 : 1)}
                             </span>
                             <span className="font-black text-xs text-slate-500">un.</span>
                           </div>
                           {conteudo > 1 && (
                             <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                               ({(Number(ins.quantidade_atual) || 0).toLocaleString('pt-BR')} {ins.unidade_medida})
                             </span>
                           )}

                           {zerado && <span className="text-[9px] font-black uppercase tracking-widest text-red-500 mt-1">Zerado</span>}
                           {critico && <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 mt-1">{minUn > 0 ? `Mín: ${minUn} un.` : "Crítico"}</span>}
                           {acima && <span className="text-[9px] font-black uppercase tracking-widest text-sky-600 mt-1">Máx: {maxUn} un.</span>}
                         </div>

                         {/* Ações Rápidas */}
                         <div className="w-56 flex items-center justify-end gap-1.5">
                           <button
                             onClick={() => abrirMovimentoModal(ins, "entrada")}
                             className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all shadow-sm active:scale-95"
                             title="Dar entrada no estoque">
                             <Plus size={13}/> Entrada
                           </button>
                           <button
                             onClick={() => abrirMovimentoModal(ins, "saida")}
                             className="flex items-center gap-1 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs rounded-xl transition-all shadow-sm active:scale-95"
                             title="Dar baixa / retirar do estoque">
                             <PackageMinus size={13}/> Baixa
                           </button>
                           <button
                             onClick={() => abrirAjuste(ins)}
                             className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-all"
                             title="Ajuste manual de balanço e min/máx">
                             <RefreshCw size={14}/>
                           </button>
                         </div>
                       </div>
                     );
                   })}
                   {!loading && filtrados.length === 0 && (
                     <div className="p-16 text-center">
                       <PackageSearch size={40} className="text-slate-200 mx-auto mb-3" />
                       <p className="text-slate-400 font-bold">Nenhum produto encontrado.</p>
                     </div>
                   )}
                </div>
             </div>
           </>
         )}

         {/* ABA 2: HISTÓRICO DE MOVIMENTAÇÕES */}
         {abaEstoque === "historico" && (
           <div className="space-y-4">
             <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                   <Filter size={18} className="text-slate-400" />
                   <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Filtrar Movimentos:</span>
                </div>
                <div className="flex gap-1.5">
                   {[["todos", "Todos"], ["entrada", "🟢 Entradas"], ["saida", "🔴 Baixas / Saídas"]].map(([val, label]) => (
                      <button key={val} onClick={() => setFiltroMovimento(val)}
                         className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${filtroMovimento === val ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                         {label}
                      </button>
                   ))}
                </div>
             </div>

             <div className="rounded-2xl overflow-x-auto shadow-md border border-slate-200">
                <div className="bg-slate-800 px-6 py-4 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center min-w-[850px]">
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 w-32">Data / Hora</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Produto</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-28">Tipo</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-32">Qtd Unidades</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-center w-32">Saldo Anterior → Novo</span>
                   <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 text-right w-44">Responsável / Motivo</span>
                </div>

                <div className="bg-white divide-y divide-slate-100">
                   {movimentosFiltrados.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 font-bold">Nenhuma movimentação registrada no histórico.</div>
                   ) : (
                      movimentosFiltrados.map((mov) => {
                        const eEntrada = mov.tipo === "entrada";
                        const conteudo = Number(mov.conteudo_por_unidade) || 1;
                        const qtdUn = Number(mov.quantidade_unidades) || 0;
                        const saldoAntUn = (Number(mov.saldo_anterior) || 0) / conteudo;
                        const saldoPostUn = (Number(mov.saldo_posterior) || 0) / conteudo;

                        return (
                          <div key={mov.id} className="px-6 py-3.5 grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center min-w-[850px] hover:bg-slate-50">
                             {/* Data */}
                             <span className="text-xs font-bold text-slate-600 w-32">
                               {fmtDataHora(mov.data_movimento || mov.created_at)}
                             </span>

                             {/* Produto */}
                             <div>
                                <p className="font-bold text-slate-800 text-sm">{mov.insumo?.nome || "Produto"}</p>
                                {mov.insumo?.marca && <p className="text-[10px] text-slate-400 font-medium">{mov.insumo.marca}</p>}
                             </div>

                             {/* Tipo */}
                             <div className="w-28 flex justify-center">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${eEntrada ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                   {eEntrada ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                                   {eEntrada ? "Entrada" : "Baixa"}
                                </span>
                             </div>

                             {/* Qtd */}
                             <div className="w-32 text-center">
                                <span className={`font-black text-sm ${eEntrada ? "text-emerald-600" : "text-rose-600"}`}>
                                   {eEntrada ? "+" : "-"}{qtdUn} un.
                                </span>
                                {conteudo > 1 && (
                                   <p className="text-[10px] font-bold text-slate-400">({(qtdUn * conteudo).toLocaleString('pt-BR')} {mov.unidade_medida})</p>
                                )}
                             </div>

                             {/* Saldo */}
                             <div className="w-32 text-center">
                                <span className="text-xs font-bold text-slate-500">
                                   {saldoAntUn.toFixed(1)} un. → <b className="text-slate-800">{saldoPostUn.toFixed(1)} un.</b>
                                </span>
                             </div>

                             {/* Responsável / Motivo */}
                             <div className="w-44 text-right">
                                <p className="text-xs font-bold text-slate-700 truncate">{mov.responsavel || "Sistema"}</p>
                                <p className="text-[10px] text-slate-400 font-medium truncate">{mov.motivo || "—"}</p>
                             </div>
                          </div>
                        );
                      })
                   )}
                </div>
             </div>
           </div>
         )}
      </div>

      {/* MODAL DE ENTRADA OU BAIXA */}
      {modalMovimento && itemAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-5">
                  <h2 className="font-black text-2xl text-slate-800 flex items-center gap-2">
                     {tipoMovimento === "entrada" ? (
                       <span className="text-emerald-600 flex items-center gap-1.5"><TrendingUp size={24}/> Lançar Entrada</span>
                     ) : (
                       <span className="text-rose-600 flex items-center gap-1.5"><TrendingDown size={24}/> Lançar Baixa</span>
                     )}
                  </h2>
                  <button onClick={() => setModalMovimento(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  {/* Produto Selecionado */}
                  <div className={`p-4 rounded-2xl border text-center ${tipoMovimento === "entrada" ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"}`}>
                     <p className={`text-xs font-black uppercase tracking-widest mb-1 ${tipoMovimento === "entrada" ? "text-emerald-700" : "text-rose-700"}`}>{itemAtual.nome}</p>
                     <p className="text-sm font-bold text-slate-700">
                        Saldo Atual: <strong>{((Number(itemAtual.quantidade_atual) || 0) / (Number(itemAtual.tamanho_embalagem) || 1)).toFixed(1)} unidades</strong>
                        {Number(itemAtual.tamanho_embalagem) > 1 && ` (${(Number(itemAtual.quantidade_atual) || 0).toLocaleString('pt-BR')} ${itemAtual.unidade_medida})`}
                     </p>
                  </div>

                  {/* Quantidade em Unidades */}
                  <div>
                     <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block mb-1.5">
                        Quantas UNIDADES / EMBALAGENS {tipoMovimento === "entrada" ? "entraram?" : "saíram?"}
                     </label>
                     <div className="relative">
                        <input 
                           type="number" step="1" min="1" placeholder="Ex: 10" 
                           value={qtdUnidades} onChange={e=>setQtdUnidades(e.target.value)} 
                           className={`w-full p-4 text-2xl bg-white border-2 rounded-2xl font-black text-slate-800 outline-none ${tipoMovimento === "entrada" ? "focus:border-emerald-500 border-slate-200" : "focus:border-rose-500 border-slate-200"}`}
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-500">un.</span>
                     </div>

                     {/* Explicação de conversão automática */}
                     {Number(itemAtual.tamanho_embalagem) > 1 && Number(qtdUnidades) > 0 && (
                        <div className="mt-2 p-3 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-between">
                           <span>1 unidade = {itemAtual.tamanho_embalagem} {itemAtual.unidade_medida}</span>
                           <span className={tipoMovimento === "entrada" ? "text-emerald-700 font-black" : "text-rose-700 font-black"}>
                              {tipoMovimento === "entrada" ? "+" : "-"}{(Number(qtdUnidades) * Number(itemAtual.tamanho_embalagem)).toLocaleString('pt-BR')} {itemAtual.unidade_medida}
                           </span>
                        </div>
                     )}
                  </div>

                  {/* Se for saída, pede responsável obrigatório */}
                  {tipoMovimento === "saida" && (
                    <div>
                       <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block mb-1.5">
                          Quem retirou? (Responsável) <span className="text-rose-500">*</span>
                       </label>
                       <input 
                          type="text" placeholder="Ex: Bartender Ana, Garçom João..." 
                          value={responsavelMov} onChange={e=>setResponsavelMov(e.target.value)}
                          className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-rose-500"
                       />
                    </div>
                  )}

                  {/* Se for entrada, valor pago opcional */}
                  {tipoMovimento === "entrada" && (
                    <div>
                       <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block mb-1.5">
                          Valor total pago na compra R$ (Opcional)
                       </label>
                       <input 
                          type="number" step="0.01" placeholder="Ex: 85.00" 
                          value={valorPago} onChange={e=>setValorPago(e.target.value)}
                          className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500"
                       />
                       <p className="text-[10px] text-slate-400 font-medium mt-1">Lança a compra no financeiro do mês e atualiza o custo unitário.</p>
                    </div>
                  )}

                  {/* Motivo */}
                  <div>
                     <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block mb-1.5">Motivo / Observação</label>
                     {tipoMovimento === "saida" ? (
                       <select value={motivoMov} onChange={e=>setMotivoMov(e.target.value)} className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-rose-500">
                          <option value="Uso na operação (Bar)">Uso na Operação (Bar)</option>
                          <option value="Consumo em Evento">Consumo em Evento</option>
                          <option value="Quebra / Perda / Avaria">Quebra / Perda / Avaria</option>
                          <option value="Validade Vencida">Validade Vencida</option>
                          <option value="Ajuste de Balanço">Ajuste de Balanço</option>
                       </select>
                     ) : (
                       <input 
                          type="text" placeholder="Ex: Compra Distribuidora X" 
                          value={motivoMov} onChange={e=>setMotivoMov(e.target.value)}
                          className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500"
                       />
                     )}
                  </div>

                  {/* Data e Horário */}
                  <div>
                     <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block mb-1.5">Data e Horário</label>
                     <input 
                        type="datetime-local" value={dataMov} onChange={e=>setDataMov(e.target.value)}
                        className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 text-sm outline-none"
                     />
                  </div>
               </div>

               <button
                  onClick={handleSalvarMovimento}
                  disabled={salvandoMov}
                  className={`w-full mt-6 py-4 text-white font-black text-lg rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 ${tipoMovimento === "entrada" ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" : "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20"}`}>
                  {salvandoMov ? <Loader2 size={20} className="animate-spin"/> : tipoMovimento === "entrada" ? <TrendingUp size={20}/> : <PackageMinus size={20}/>}
                  {tipoMovimento === "entrada" ? "Somar ao Estoque" : "Confirmar Baixa de Estoque"}
               </button>
            </div>
         </div>
      )}

      {/* MODAL DE AJUSTE DE BALANÇO MANUAL */}
      {modalAjuste && itemAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-sm p-6 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="font-black text-2xl text-slate-800">Ajuste de Balanço</h2>
                  <button onClick={() => setModalAjuste(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                     <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">{itemAtual.nome}</p>
                     <p className="text-3xl font-black text-slate-800">
                       {((Number(itemAtual.quantidade_atual) || 0) / (Number(itemAtual.tamanho_embalagem) || 1)).toFixed(1)} <span className="text-lg text-slate-500">un.</span>
                     </p>
                  </div>

                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Novo Saldo Real em UNIDADES</label>
                     <div className="relative">
                        <input
                           type="number" step="0.1" placeholder="Ex: 24"
                           value={novoSaldoUnidades} onChange={e=>setNovoSaldoUnidades(e.target.value)}
                           className="w-full p-4 text-2xl bg-white border-2 border-slate-200 rounded-2xl font-black text-slate-800 outline-none focus:border-emerald-500"
                        />
                        <span className="absolute right-5 top-1/2 -translate-y-1/2 font-black text-slate-500">un.</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-xs font-bold text-amber-600 uppercase tracking-widest block mb-2">Mínimo (un.)</label>
                        <input
                           type="number" step="1" min="0" placeholder="Ex: 5"
                           value={minimoUnidades} onChange={e=>setMinimoUnidades(e.target.value)}
                           className="w-full p-3 bg-amber-50 border-2 border-amber-200 rounded-xl font-black text-amber-800 outline-none focus:border-amber-500"
                        />
                     </div>
                     <div>
                        <label className="text-xs font-bold text-sky-600 uppercase tracking-widest block mb-2">Máximo (un.)</label>
                        <input
                           type="number" step="1" min="0" placeholder="Ex: 50"
                           value={maximoUnidades} onChange={e=>setMaximoUnidades(e.target.value)}
                           className="w-full p-3 bg-sky-50 border-2 border-sky-200 rounded-xl font-black text-sky-800 outline-none focus:border-sky-500"
                        />
                     </div>
                  </div>
               </div>

               <button onClick={handleSalvarAjuste} className="w-full mt-6 py-4 bg-slate-800 hover:bg-slate-900 text-white font-black text-lg rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2">
                  <RefreshCw size={20}/> Sobrescrever Saldo
               </button>
            </div>
         </div>
      )}

      {/* CONTAGEM DE ESTOQUE POR IA */}
      {modalContagem && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl p-5 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-4">
                  <h2 className="font-black text-2xl text-slate-800">Contagem de Estoque por IA</h2>
                  <button onClick={() => { setModalContagem(false); setContagemItens(null); try { reconhecimentoRef.current?.stop(); } catch {} }} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <input ref={inputContagemRef} type="file" accept="image/*" className="hidden" onChange={lerFotoContagem} />

               {contagemLendo ? (
                  <div className="flex flex-col items-center gap-4 p-10">
                     <Loader2 size={40} className="animate-spin text-emerald-600" />
                     <p className="font-bold text-slate-600">A IA está lendo a contagem...</p>
                  </div>
               ) : !contagemItens ? (
                  <div className="space-y-4">
                     <div className="grid sm:grid-cols-2 gap-3">
                        <button onClick={imprimirPlanilha} className="p-4 rounded-2xl border-2 border-slate-200 text-left hover:border-slate-400 transition-colors">
                           <Printer size={22} className="text-slate-600 mb-2" />
                           <p className="font-black text-slate-800 text-sm">1. Imprimir planilha</p>
                           <p className="text-xs font-medium text-slate-400 mt-0.5">Com coluna "Contagem física" em branco.</p>
                        </button>
                        <button onClick={() => inputContagemRef.current?.click()} className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 text-left hover:border-emerald-400 transition-colors">
                           <Camera size={22} className="text-emerald-600 mb-2" />
                           <p className="font-black text-slate-800 text-sm">2. Fotografar planilha preenchida</p>
                           <p className="text-xs font-medium text-slate-400 mt-0.5">A IA lê os números e atualiza os saldos.</p>
                        </button>
                     </div>
                     <div className="p-4 rounded-2xl border-2 border-slate-200">
                        <p className="font-black text-slate-800 text-sm mb-1">Ou conte por voz</p>
                        <p className="text-xs font-medium text-slate-400 mb-3">Fale: "heineken vinte quatro, agua dez, absolut duas".</p>
                        <div className="flex gap-2">
                           <button onClick={alternarGravacao} className={`px-4 py-3 rounded-xl font-black text-sm flex items-center gap-2 transition-colors ${gravando ? "bg-red-600 text-white animate-pulse" : "bg-slate-900 text-white"}`}>
                              {gravando ? "Parar" : "Falar"}
                           </button>
                           <textarea value={ditado} onChange={e => setDitado(e.target.value)} rows={2} placeholder="Sua fala aparece aqui..."
                              className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 resize-none" />
                        </div>
                        <button onClick={interpretarDitado} disabled={!ditado.trim()} className="w-full mt-3 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm disabled:opacity-50">
                           Interpretar contagem com IA
                        </button>
                     </div>
                  </div>
               ) : (
                  <>
                     <p className="text-xs font-bold text-slate-500 mb-3">Confira o resultado da contagem física em unidades:</p>
                     <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                        {contagemItens.map((c, idx) => (
                           <div key={idx} className={`p-3 rounded-xl border ${c.insumo ? "border-slate-200 bg-slate-50" : "border-red-200 bg-red-50/50"}`}>
                              <div className="flex items-center justify-between gap-3">
                                 <div className="min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{c.insumo ? c.insumo.nome : c.nome}</p>
                                    {c.insumo
                                       ? <p className="text-[10px] font-bold text-slate-400">virará {Number(c.quantidade) || 0} unidades</p>
                                       : <p className="text-[10px] font-black text-red-600">"{c.nome}" não encontrado</p>}
                                 </div>
                                 <div className="flex items-center gap-1.5 shrink-0">
                                    <input type="number" step="1" value={c.quantidade}
                                       onChange={e => setContagemItens(p => p.map((x, i) => i === idx ? { ...x, quantidade: e.target.value } : x))}
                                       className="w-24 bg-white border-2 border-slate-200 rounded-lg px-2.5 py-2 text-sm font-black text-slate-800 text-center outline-none focus:border-emerald-500" />
                                    <button onClick={() => setContagemItens(p => p.filter((_, i) => i !== idx))} className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-red-500 flex items-center justify-center"><X size={14}/></button>
                                 </div>
                              </div>
                           </div>
                        ))}
                     </div>
                     <div className="flex gap-3 mt-5">
                        <button onClick={() => setContagemItens(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-600 font-bold">Voltar</button>
                        <button onClick={aplicarContagem} disabled={contagemSalvando} className="flex-1 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
                           {contagemSalvando ? <Loader2 size={18} className="animate-spin"/> : <CheckCircle2 size={18}/>} Aplicar contagem
                        </button>
                     </div>
                  </>
               )}
            </div>
         </div>
      )}

      {/* IMPORTAR LISTA POR IA */}
      {modalLista && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl p-5 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-4">
                  <h2 className="font-black text-2xl text-slate-800">Importar Lista por Foto (IA)</h2>
                  <button onClick={() => { setModalLista(false); setListaItens(null); }} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <input ref={inputListaRef} type="file" accept="image/*" className="hidden" onChange={lerFotoLista} />

               {!listaItens ? (
                  <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-slate-200 rounded-2xl">
                     {listaLendo ? (
                        <>
                           <Loader2 size={40} className="animate-spin text-emerald-600" />
                           <p className="font-bold text-slate-600">A IA está lendo a lista...</p>
                        </>
                     ) : (
                        <>
                           <Camera size={40} className="text-emerald-600" />
                           <p className="font-bold text-slate-700 text-center">Tire foto de uma lista ou nota fiscal de produtos<br/><span className="text-sm font-medium text-slate-400">O sistema dá entrada automática em cada item</span></p>
                           <button onClick={() => inputListaRef.current?.click()} className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2"><Camera size={16}/> Abrir câmera / foto</button>
                           <button onClick={imprimirPlanilhaLista} className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><Printer size={13}/> Imprimir planilha em branco</button>
                        </>
                     )}
                  </div>
               ) : (
                  <>
                     <p className="text-xs font-bold text-slate-500 mb-3">{listaItens.length} item(ns) lidos. Confira as quantidades em unidades:</p>
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
                                       className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-800 outline-none" placeholder="Qtd un." />
                                    <span className="text-[10px] font-black text-slate-400">un.</span>
                                 </div>
                                 <input type="date" value={it.validade} onChange={e => setListaItens(p => p.map((x, i) => i === idx ? { ...x, validade: e.target.value } : x))}
                                    className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-xs font-bold text-amber-800 outline-none" title="Validade" />
                                 <input type="number" step="0.01" value={it.preco} onChange={e => setListaItens(p => p.map((x, i) => i === idx ? { ...x, preco: e.target.value } : x))}
                                    className="bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-emerald-800 outline-none" placeholder="Preço R$ total" />
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
