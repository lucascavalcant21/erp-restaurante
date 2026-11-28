"use client";
import { custoDeProduzirFicha as custoTotalDaFicha, porcoesParaCusto } from "../../../lib/ficha-calculos.mjs";
// tempo real: recarrega sozinho a cada 15s e quando o banco muda

import { useState, useEffect, Suspense, useRef } from "react";
import { useTempoReal } from "../../../lib/realtime";
import { useSearchParams, useRouter } from "next/navigation";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProducoesPeriodo, registrarProducaoSimples } from "../../../lib/estoque";
import { fetchColaboradores } from "../../../lib/rh";
import { fetchMemorandoOperacao } from "../../../lib/memorandos";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchEstoques, fetchItensEstoque } from "../../../lib/estoques-multiplos";
import { Flame, Droplets, X, Maximize, Printer, ClipboardList, Search, CheckCircle2 } from "lucide-react";
import { dataOperacional, ehEstoqueavel, unidadeProducao, previaProducaoSimples, registroDeProducao } from "../../../lib/producao-calculos.mjs";
import { salvarPlanoProducao } from "../../../lib/memorandos";
import { fmtBRL } from "../../../components/ui";
import { casaBusca } from "../../../lib/busca.mjs";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";

// Custo total de PRODUZIR uma ficha, resolvendo bases (sub-receitas) em cascata.
// guard evita loop infinito se alguém criar uma referência circular.


// Nº real de porções: direto (porções/un) ou derivado do peso total quando
// o rendimento é em kg/g/l/ml (peso total ÷ peso da porção).
// Regra única de porções (ficha-calculos.mjs). Prato que rende em peso é
// uma porção: dividir pela soma dos pesos dava custo por kg.
function porcoesDaFicha(f) {
  return porcoesParaCusto(f).porcoes;
}

// CMV (%) = custo por porção / preço de venda do produto vinculado à ficha.
// Cor muda no limiar de 30%: <=30% saudável (verde), >30% consumindo margem (vermelho).
function calcCmv(ficha, todasFichas, produtoDaFicha) {
  const produto = produtoDaFicha[ficha.id];
  if (!produto || !produto.preco_venda) return null;
  const custoPorcao = custoTotalDaFicha(ficha, todasFichas) / porcoesDaFicha(ficha);
  return (custoPorcao / produto.preco_venda) * 100;
}
const corCmv = (cmv) => cmv > 30
  ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-600" }
  : { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600" };

function ProducaoRunner() {
  const router = useRouter();
  const { abrirMenu } = useERP();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept") || "cozinha";
  
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [producoes, setProducoes] = useState([]);
  const [saldosProntos, setSaldosProntos] = useState([]);
  const [buscaFicha, setBuscaFicha] = useState("");
  const [loading, setLoading] = useState(true);

  const [modalProduzir, setModalProduzir] = useState(false);
  const [fichaAtual, setFichaAtual] = useState(null);

  // Planejamento do dia: { [ficha_id]: { qtd, resp } } — vira planilha impressa
  const [modalPlanejar, setModalPlanejar] = useState(false);
  const [plano, setPlano] = useState({});
  const [dataPlano, setDataPlano] = useState(() => dataOperacional());
  const [planoCarregado, setPlanoCarregado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [erroPrevia, setErroPrevia] = useState("");
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [erroCarga, setErroCarga] = useState("");
  const [incluirPratos, setIncluirPratos] = useState(false);
  const [aviso, setAviso] = useState("");
  const chaveProducao = useRef(null);
  const travaConfirmacao = useRef(false);
  const chavePlano = `producao_plano_${unidadeAtiva || ""}_${deptUrl}_${dataPlano}`;

  // Rascunho do plano sobrevive a refresh (por unidade+departamento)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(chavePlano);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d.plano === "object") setPlano(d.plano);
      } else {
        setPlano({});
      }
    } catch { setPlano({}); }
    setPlanoCarregado(chavePlano);
  }, [chavePlano]);
  useEffect(() => {
    if (planoCarregado !== chavePlano) return;
    try { localStorage.setItem(chavePlano, JSON.stringify({ plano, data: dataPlano })); } catch { }
  }, [plano, dataPlano, chavePlano, planoCarregado]);

  const setPlanoItem = (fichaId, patch) => {
    setPlano(p => ({ ...p, [fichaId]: { qtd: "", resp: "", ...(p[fichaId] || {}), ...patch } }));
  };
  const itensPlanejados = fichas
    .map(f => ({ ficha: f, ...(plano[f.id] || {}) }))
    .filter(x => Number(String(x.qtd || "").replace(",", ".")) > 0);

  // Planilha A4 da produção do dia: item, quantidade e espaço para escrever
  // quem fez + horários — vai impressa para a parede da cozinha.
  const imprimirPlanoDoDia = () => {
    if (itensPlanejados.length === 0) return alert("Defina a quantidade de pelo menos um item para imprimir.");
    let win = null;
    try { win = window.open("", "_blank", "width=900,height=1000"); } catch { win = null; }

    const dataFmt = dataPlano ? dataPlano.split("-").reverse().join("/") : new Date().toLocaleDateString("pt-BR");
    const diaSemana = dataPlano ? ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"][new Date(dataPlano + "T12:00:00").getDay()] : "";

    const linhasTab = itensPlanejados.map((x, i) => `
      <tr>
        <td class="n">${i + 1}</td>
        <td class="item"><b>${x.ficha.nome_receita}</b></td>
        <td class="qtd">${(Number(String(x.qtd).replace(",", ".")) || 0).toLocaleString("pt-BR")} ${unidadeProducao(x.ficha)}</td>
        <td class="nome">${x.resp || ""}</td>
        <td class="hora"></td>
        <td class="hora"></td>
        <td class="ok"></td>
      </tr>`).join("");
    const linhasVazias = Array.from({ length: 3 }).map((_, i) => `
      <tr>
        <td class="n">${itensPlanejados.length + i + 1}</td>
        <td class="item"></td>
        <td class="qtd"></td>
        <td class="nome"></td>
        <td class="hora"></td>
        <td class="hora"></td>
        <td class="ok"></td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Producao do Dia - ${dataFmt}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:14mm 12mm}
        .head{border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
        .tag{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#555;font-weight:bold}
        h1{font-size:22px;margin-top:2px}
        .quando{font-size:14px;font-weight:bold;text-align:right}
        .quando span{display:block;font-size:11px;color:#555;font-weight:normal}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #333;padding:7px 6px;font-size:12px;vertical-align:middle}
        th{background:#eee;text-transform:uppercase;letter-spacing:.5px;font-size:9px}
        td{height:38px}
        td.n{width:5%;text-align:center;color:#666}
        td.item{width:30%}
        td.qtd{width:12%;text-align:center;font-weight:bold}
        td.nome{width:23%}
        td.hora{width:10%}
        td.ok{width:8%}
        .legenda{margin-top:8px;font-size:10px;color:#555}
        .assin{margin-top:24px;display:flex;justify-content:space-between;gap:40px}
        .assin div{flex:1;border-top:1px solid #333;padding-top:4px;font-size:10px;text-align:center;color:#444}
        @media print{@page{size:A4 landscape;margin:10mm}}
      </style></head><body>
      <div class="head">
        <div>
          <div class="tag">Produção do Dia — ${deptUrl === "bar" ? "Bar" : "Cozinha"} · ${unidadeInfo?.nome || ""}</div>
          <h1>O que produzir hoje</h1>
        </div>
        <div class="quando">${dataFmt}<span>${diaSemana}</span></div>
      </div>

      <table>
        <thead>
          <tr><th>#</th><th>Item (ficha técnica)</th><th>Quantidade</th><th>Feito por (nome)</th><th>Início</th><th>Término</th><th>OK</th></tr>
        </thead>
        <tbody>${linhasTab}${linhasVazias}</tbody>
      </table>
      <div class="legenda">Quem produzir escreve o próprio nome, os horários de início/término e marca OK ao finalizar. Depois, registre no sistema (Produção do Dia) para dar baixa no estoque.</div>
      <div class="assin">
        <div>Responsável pela ${deptUrl === "bar" ? "produção do bar" : "cozinha"}</div>
        <div>Gerente / Conferência</div>
      </div>
      </body></html>`;

    if (!win) {
      // Popup bloqueado: imprime via iframe invisível na própria aba
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

  // Form de produção
  const [qtdProd, setQtdProd] = useState("1");
  const [colabSelecionado, setColabSelecionado] = useState("");
  const [localArmazenamento, setLocalArmazenamento] = useState("");

  // Memorando planejado para HOJE — a equipe abre a Produção e já vê o que
  // precisa preparar, sem depender do papel impresso ou do WhatsApp.
  const [memoHoje, setMemoHoje] = useState(null);

  const carregar = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const hojeISO = dataPlano;
    const [resFichas, resProdutos, resColab, resMemo, resProducoes, resEstoques] = await Promise.all([
       fetchFichas(unidadeAtiva),
       fetchProdutos(unidadeAtiva, deptUrl),
       fetchColaboradores(unidadeAtiva),
       fetchMemorandoOperacao(unidadeAtiva, hojeISO).catch(() => ({ data: null })),
       fetchProducoesPeriodo(unidadeAtiva, 30),
       fetchEstoques(unidadeAtiva),
    ]);
    setErroCarga([resFichas, resProdutos, resColab, resMemo, resProducoes, resEstoques].map(r => r?.error).filter(Boolean).join(" · "));
    setFichas(resFichas.data || []);
    setProdutos(resProdutos.data || []);
    setColaboradores((resColab.data || []).filter(c => c.ativo !== false && c.status !== "inativo"));
    setMemoHoje(resMemo?.data || null);
    const idsDoSetor = new Set((resFichas.data || []).filter(f => f.departamento === deptUrl).map(item => String(item.id)));
    setProducoes((resProducoes.data || []).filter(item => idsDoSetor.has(String(item.ficha_id))));
    const estoquePreparo = (resEstoques.data || []).find(item => String(item.slug || "").toLowerCase() === `pre-preparos-${deptUrl}`);
    if (estoquePreparo?.id) {
      const saldos = await fetchItensEstoque(estoquePreparo.id, unidadeAtiva);
      setSaldosProntos((saldos.data || []).filter(item => Number(item.quantidade_atual || 0) > 0));
    } else setSaldosProntos([]);
    setLoading(false);
  };

  // Primeiro produto de venda vinculado a cada ficha (produtos.ficha_id -> fichas_tecnicas.id)
  const produtoDaFicha = {};
  produtos.forEach(p => { if (p.ficha_id && !produtoDaFicha[p.ficha_id]) produtoDaFicha[p.ficha_id] = p; });

  // CMV médio de todos os produtos criados (com ficha e preço de venda válidos)
  const cmvsValidos = fichas
    .map(f => calcCmv(f, fichas, produtoDaFicha))
    .filter(v => v !== null);
  const cmvMedio = cmvsValidos.length > 0 ? cmvsValidos.reduce((a, b) => a + b, 0) / cmvsValidos.length : null;

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva, deptUrl, dataPlano]);
  useTempoReal(null, () => carregar(true)); // atualiza sozinho (15s / mudanca no banco)

  const abrirProduzir = (ficha) => {
    setFichaAtual(ficha);
    setQtdProd(String(Number(plano[ficha.id]?.qtd) || Number(ficha.rendimento_porcoes) || 1));
    chaveProducao.current = crypto.randomUUID();
    setPrevia(null);
    const responsavelPlanejado = plano[ficha.id]?.resp;
    const planejado = colaboradores.find(item => item.nome === responsavelPlanejado);
    let ultimo = "";
    try { ultimo = localStorage.getItem(`producao_responsavel_${unidadeAtiva}`) || ""; } catch {}
    setColabSelecionado(planejado?.id || colaboradores.find(item => String(item.id) === String(ultimo))?.id || "");
    setLocalArmazenamento(deptUrl === "bar" ? "Geladeira do Bar" : "Freezer 1");
    setModalProduzir(true);
  };

  // Prévia do consumo calculada aqui, pela mesma conta das fichas (perda do
  // ingrediente, subfichas). É conferência: não trava por saldo de estoque.
  useEffect(() => {
    if (!modalProduzir || !fichaAtual || !(Number(String(qtdProd).replace(",", ".")) > 0)) { setPrevia(null); setErroPrevia(""); return; }
    const p = previaProducaoSimples(fichaAtual, qtdProd, fichas);
    setPrevia(p.erros.length ? null : p);
    setErroPrevia(p.erros.join(" "));
    setCarregandoPrevia(false);
  }, [modalProduzir, fichaAtual, qtdProd, fichas]);

  const handleConfirmar = async () => {
    if (travaConfirmacao.current) return;
    if (!colabSelecionado) return alert("Selecione quem está produzindo.");
    const numQtd = Number(String(qtdProd).replace(",", "."));
    if (!Number.isFinite(numQtd) || numQtd <= 0) return alert("Informe uma quantidade maior que zero.");
    if (!previa) return alert(erroPrevia || "A ficha tem um problema que impede calcular a produção.");
    travaConfirmacao.current = true; setSalvando(true);
    try {
      const res = await registrarProducaoSimples(registroDeProducao({
        unidadeId: unidadeAtiva, ficha: fichaAtual, quantidade: numQtd, colaboradorId: colabSelecionado,
        previa, departamento: deptUrl, localArmazenamento, chave: chaveProducao.current,
      }));
      if (res.error) return alert("Produção não registrada: " + res.error);
      setAviso(`Produção registrada: ${numQtd.toLocaleString("pt-BR")} ${unidadeProducao(fichaAtual)} de ${fichaAtual.nome_receita}${previa.custo_estimado != null ? ` · custo ${fmtBRL(previa.custo_estimado)}` : ""}.`);
      setTimeout(() => setAviso(""), 6000);
      try { localStorage.setItem(`producao_responsavel_${unidadeAtiva}`, String(colabSelecionado)); } catch {}
      setModalProduzir(false);
      await carregar(true);
    } catch (e) { alert("Não foi possível confirmar: " + e.message + ". Confira o histórico antes de iniciar outra produção."); }
    finally { travaConfirmacao.current = false; setSalvando(false); }
  };

  const salvarPlanejamento = async () => {
    const res = await salvarPlanoProducao(unidadeAtiva, deptUrl, dataPlano, plano);
    if (res.error) return alert(res.error);
    await carregar(true);
  };

  const containerRef = useRef(null);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
       containerRef.current?.requestFullscreen?.();
    } else {
       document.exitFullscreen?.();
    }
  };

  const isBar = deptUrl === 'bar';
  const estoqueHref = `/dashboard/operacao/estoque?dept=${deptUrl}`;
  const fichasDoSetor = fichas.filter(f => f.departamento === deptUrl);
  const fichasFiltradas = fichasDoSetor.filter(f => incluirPratos || ehEstoqueavel(f)).filter(ficha => casaBusca(ficha.nome_receita, buscaFicha));

  return (
    <div ref={containerRef} className="min-h-screen pb-24 font-sans text-slate-800 bg-hf-bg">
      
      {erroCarga && <p role="alert" className="m-4 rounded-xl bg-red-50 p-4 text-red-700">Falha ao carregar: {erroCarga}</p>}
      {aviso && <p role="status" className="fixed bottom-4 left-1/2 z-[95] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-lg">{aviso}</p>}
      {/* CABEÇALHO (visual do Nina) */}
      <div className="sticky top-0 z-10 bg-hf-bg/95 backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <CabecalhoTela titulo="Produção do dia" subtitulo="Baixa automática de estoque">
            <button onClick={() => router.push("/dashboard/operacao/producao/memorando")} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold text-hf-text shadow-none hover:bg-hf-elevated">
              <ClipboardList size={17}/> <span className="hidden sm:inline">Memorando de amanhã</span><span className="sm:hidden">Memorando</span>
            </button>
            <button onClick={() => setModalPlanejar(true)} className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full bg-hf-menu px-4 text-sm font-semibold text-white shadow-none hover:bg-hf-menu-hover">
              <ClipboardList size={17}/> <span className="hidden sm:inline">Planejar e imprimir o dia</span><span className="sm:hidden">Planejar</span>
              {itensPlanejados.length > 0 && <span className="rounded-full bg-hf-accent px-1.5 py-0.5 text-3xs font-bold text-hf-accent-fg">{itensPlanejados.length}</span>}
            </button>
            {cmvMedio !== null && (
              <div className={`hidden rounded-full border px-3.5 py-1.5 sm:block ${corCmv(cmvMedio).bg} ${corCmv(cmvMedio).border}`}>
                <p className={`text-sm font-semibold ${corCmv(cmvMedio).text}`}>CMV médio {cmvMedio.toFixed(1)}%</p>
              </div>
            )}
            <button onClick={toggleFullscreen} className="hidden h-11 w-11 place-items-center sm:grid rounded-full border border-hf-border bg-hf-surface text-hf-text-2 shadow-none hover:bg-hf-elevated" title="Tela cheia" aria-label="Tela cheia">
              <Maximize size={18}/>
            </button>
          </CabecalhoTela>
        </div>
      </div>
      {/* Tela limpa (dono, 28/11/2026: "deixe mais limpa, simples, que eu consiga
          visualizar tudo assim que eu entrar"): a data do plano fica no
          planejador; os 4 passos explicativos saíram. */}
      {/* MEMORANDO DE HOJE: o que a gerência planejou para este setor */}
      {(() => {
         if (!memoHoje) return null;
         const setorChave = deptUrl === "bar" ? "bar" : "cozinha";
         const plano = memoHoje[setorChave] || {};
         const itens = Object.entries(plano)
            .map(([fichaId, dados]) => ({ ficha: fichas.find(f => String(f.id) === String(fichaId)), ...dados }))
            .filter(item => item.ficha && Number(item.qtd) > 0);
         if (!itens.length) return null;
         return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-6">
               <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                     <div>
                        <p className="text-2xs font-bold uppercase tracking-widest text-accent">Produção planejada para hoje</p>
                        <p className="text-sm font-bold text-slate-900">{itens.length} preparação(ões) no memorando de {deptUrl === "bar" ? "Bar" : "Cozinha"}</p>
                     </div>
                     <button onClick={() => router.push("/dashboard/operacao/producao/memorando")}
                        className="shrink-0 rounded-xl border border-emerald-300 bg-card px-3 py-2 text-xs font-bold text-accent-strong hover:bg-accent-soft">
                        Abrir memorando
                     </button>
                  </div>
                  <div className="space-y-2">
                     {itens.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-card px-3 py-2.5">
                           <div className="min-w-0">
                              <p className="text-[15px] font-black text-slate-800 truncate">{item.ficha.nome_receita}</p>
                              {(item.responsavel || item.observacao) && (
                                 <p className="text-xs font-bold text-fg truncate">
                                    {item.responsavel || ""}{item.responsavel && item.observacao ? " · " : ""}{item.observacao || ""}
                                 </p>
                              )}
                           </div>
                           <span className="shrink-0 rounded-lg bg-accent px-2.5 py-1 text-sm font-black text-accent-fg">
                              {Number(item.qtd).toLocaleString("pt-BR")} porções
                           </span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         );
      })()}

      <section className="mx-auto mt-4 max-w-5xl space-y-3 px-4 sm:px-6">
         {/* Três números, uma linha */}
         <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setModalPlanejar(true)} className="rounded-2xl border border-hf-border bg-hf-surface p-3 text-left">
               <span className="block text-[11px] font-semibold text-hf-muted">Planejado</span>
               <strong className="block text-xl font-black text-hf-text">{itensPlanejados.length}</strong>
               <span className="block truncate text-[11px] text-hf-muted">{dataPlano ? dataPlano.split("-").reverse().slice(0, 2).join("/") : "hoje"}</span>
            </button>
            <button onClick={() => router.push(estoqueHref)} className="rounded-2xl border border-hf-border bg-hf-surface p-3 text-left">
               <span className="block text-[11px] font-semibold text-hf-muted">Pronto</span>
               <strong className="block text-xl font-black text-hf-text">{saldosProntos.length}</strong>
               <span className="block truncate text-[11px] text-hf-muted">itens no estoque</span>
            </button>
            <div className="rounded-2xl border border-hf-border bg-hf-surface p-3">
               <span className="block text-[11px] font-semibold text-hf-muted">Feito em 30 dias</span>
               <strong className="block text-xl font-black text-hf-text">{producoes.length}</strong>
               <span className="block truncate text-[11px] text-hf-muted">produções</span>
            </div>
         </div>

         {/* O que já está pronto: lista que quebra linha, sem arrastar de lado */}
         {saldosProntos.length > 0 && (
            <div className="rounded-2xl border border-hf-border bg-hf-surface p-3">
               <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-1.5 text-sm font-bold text-hf-text"><CheckCircle2 size={16} className="text-hf-success"/>Já temos pronto</h2>
                  <button onClick={() => router.push(estoqueHref)} className="text-xs font-semibold text-hf-text-2 underline">Ver tudo</button>
               </div>
               <div className="flex flex-wrap gap-1.5">
                  {saldosProntos.slice(0, 12).map(item => (
                     <span key={item.id} className="rounded-full bg-hf-elevated px-2.5 py-1 text-xs text-hf-text">
                        <b>{item.nome}</b> · {Number(item.quantidade_atual || 0).toLocaleString("pt-BR")} {item.unidade_medida || "un"}{item.local_interno ? ` · ${item.local_interno}` : ""}
                     </span>
                  ))}
               </div>
            </div>
         )}

         {/* Plano do dia, se houver */}
         {itensPlanejados.length > 0 && (
            <div className="rounded-2xl border border-hf-border bg-hf-surface p-3">
               <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-hf-text">Para produzir hoje</h2>
                  <button onClick={() => setModalPlanejar(true)} className="text-xs font-semibold text-hf-text-2 underline">Editar plano</button>
               </div>
               <ul className="divide-y divide-hf-border">
                  {itensPlanejados.map(item => (
                     <li key={item.ficha.id} className="flex items-center justify-between gap-2 py-2">
                        <span className="min-w-0 truncate text-sm font-semibold text-hf-text">{item.ficha.nome_receita}</span>
                        <span className="flex shrink-0 items-center gap-2">
                           <b className="text-sm tabular-nums text-hf-text">{Number(String(item.qtd).replace(",", ".")).toLocaleString("pt-BR")} {unidadeProducao(item.ficha)}</b>
                           <button onClick={() => abrirProduzir(item.ficha)} className="min-h-[36px] rounded-full bg-hf-menu px-3 text-xs font-bold text-white">Produzir</button>
                        </span>
                     </li>
                  ))}
               </ul>
            </div>
         )}
      </section>

      {/* Receitas: busca + lista compacta, cada uma com o rendimento */}
      <div className="mx-auto mt-4 max-w-5xl px-4 sm:px-6">
         <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-black text-hf-text">Produzir</h2>
            <label className="flex min-h-[40px] items-center gap-2 text-xs font-semibold text-hf-text-2">
               <input type="checkbox" checked={incluirPratos} onChange={e => setIncluirPratos(e.target.checked)} className="h-5 w-5 accent-[rgb(var(--hf-accent))]" /> Mostrar pratos
            </label>
         </div>
         <label className="relative mb-2 block"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted"/><input value={buscaFicha} onChange={e => setBuscaFicha(e.target.value)} placeholder="Buscar receita" className="h-12 w-full rounded-xl border border-hf-border bg-hf-surface pl-10 pr-4 text-base outline-none focus:border-hf-accent"/></label>

         {loading ? (
            <p className="py-6 text-center text-sm text-hf-muted">Carregando receitas…</p>
         ) : fichas.length === 0 ? (
            <div className="rounded-2xl border border-hf-border bg-hf-surface p-6 text-center">
               <h3 className="text-base font-bold text-hf-text">Nenhuma ficha cadastrada</h3>
               <p className="mt-1 text-sm text-hf-muted">Crie as fichas técnicas para poder produzir.</p>
            </div>
         ) : fichasFiltradas.length === 0 ? (
            <p className="rounded-2xl border border-hf-border bg-hf-surface p-4 text-center text-sm text-hf-muted">
               {buscaFicha ? "Nenhuma receita com esse nome." : "Nenhuma base para produzir."}{!incluirPratos ? " Marque Mostrar pratos para ver os pratos também." : ""}
            </p>
         ) : (
            <ul className="divide-y divide-hf-border overflow-hidden rounded-2xl border border-hf-border bg-hf-surface">
               {fichasFiltradas.map(f => {
                  const rend = Number(f.rendimento_porcoes) || 0;
                  return (
                     <li key={f.id}>
                        <button onClick={() => abrirProduzir(f)} className="flex min-h-[60px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-hf-elevated">
                           <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold text-hf-text">{f.nome_receita}</span>
                              <span className="block truncate text-xs text-hf-muted">
                                 {rend > 0 ? `Rende ${rend.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unidadeProducao(f)} por receita` : "Rendimento não informado"} · {f.fichas_ingredientes?.length || 0} ingredientes
                              </span>
                           </span>
                           <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-hf-menu px-3 py-2 text-xs font-bold text-white">
                              {isBar ? <Droplets size={14}/> : <Flame size={14}/>} Produzir
                           </span>
                        </button>
                     </li>
                  );
               })}
            </ul>
         )}

         {producoes.length > 0 && (
            <details className="mt-3 rounded-2xl border border-hf-border bg-hf-surface">
               <summary className="flex min-h-[48px] cursor-pointer items-center px-3 text-sm font-semibold text-hf-text">Últimas produções ({producoes.length})</summary>
               <ul className="divide-y divide-hf-border px-3">
                  {producoes.slice(0, 10).map(item => (
                     <li key={item.id} className="flex items-center justify-between gap-2 py-2">
                        <span className="min-w-0"><b className="block truncate text-sm text-hf-text">{item.fichas_tecnicas?.nome_receita || "Base"}</b><small className="text-xs text-hf-muted">{new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {item.colaboradores?.nome || "sem responsável"}</small></span>
                        <b className="shrink-0 text-sm tabular-nums text-hf-text">{Number(item.quantidade_produzida || 0).toLocaleString("pt-BR")} {item.fichas_tecnicas?.rendimento_unidade || ""}</b>
                     </li>
                  ))}
               </ul>
            </details>
         )}
      </div>

      {/* Modal: planejar a produção do dia e imprimir a planilha */}
      {modalPlanejar && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-card rounded-[32px] w-full max-w-2xl my-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[88vh]">
               <div className="flex justify-between items-center p-4 sm:p-8 pb-4 sm:pb-5 border-b border-line-soft shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Produção do Dia — Planejamento</h2>
                     <p className="text-xs font-bold text-fg mt-1">Defina o que produzir e quanto. Designe quem faz (ou deixe em branco para escreverem o nome na folha).</p>
                  </div>
                  <button onClick={() => setModalPlanejar(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="p-4 sm:p-8 pt-4 sm:pt-5 overflow-y-auto space-y-3">
                  <div className="flex items-center gap-3">
                     <label className="text-3xs font-bold uppercase tracking-widest text-fg">Data da produção</label>
                     <input type="date" value={dataPlano} onChange={e=>setDataPlano(e.target.value)} className="p-2.5 bg-white border border-line rounded-lg font-bold text-fg-soft outline-none focus:border-emerald-500"/>
                     {itensPlanejados.length > 0 && (
                        <button onClick={() => { if (confirm("Limpar o planejamento do dia?")) setPlano({}); }} className="ml-auto text-3xs font-bold text-red-400 hover:text-red-600 uppercase tracking-widest">Limpar tudo</button>
                     )}
                  </div>

                  {fichasDoSetor.filter(ehEstoqueavel).map(f => {
                     const item = plano[f.id] || {};
                     const ativo = Number(String(item.qtd || "").replace(",", ".")) > 0;
                     return (
                        <div key={f.id} className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3 transition-colors ${ativo ? "border-emerald-300 bg-emerald-50/40" : "border-line bg-white/50"}`}>
                           <p className={`flex-1 font-bold text-sm ${ativo ? "text-slate-800" : "text-fg"}`}>{f.nome_receita}</p>
                           <div className="flex items-center gap-2">
                              <input type="number" min="0" placeholder="0" value={item.qtd || ""} onChange={e=>setPlanoItem(f.id, { qtd: e.target.value })}
                                 className="w-20 p-2.5 text-center bg-card border border-line rounded-lg font-black text-slate-800 outline-none focus:border-emerald-500"/>
                              <span className="text-3xs font-bold text-subtle uppercase">{unidadeProducao(f)}</span>
                              <select value={item.resp || ""} onChange={e=>setPlanoItem(f.id, { resp: e.target.value })}
                                 className="p-2.5 bg-card border border-line rounded-lg font-bold text-xs text-slate-900 outline-none focus:border-emerald-500 max-w-[170px]">
                                 <option value="">Nome em branco (escrever à mão)</option>
                                 {colaboradores.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                              </select>
                           </div>
                        </div>
                     );
                  })}
               </div>

               <div className="p-4 sm:p-8 sm:pt-4 border-t border-line-soft bg-white rounded-b-[32px] shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="flex-1 text-xs font-bold text-fg">{itensPlanejados.length} item(ns) no plano</p>
                  <button onClick={salvarPlanejamento} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white">Salvar planejamento</button>
                  <button onClick={imprimirPlanoDoDia} className="flex items-center gap-2 bg-accent hover:bg-accent text-accent-fg px-6 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl shadow-emerald-600/20">
                     <Printer size={18}/> Imprimir Planilha do Dia
                  </button>
               </div>
            </div>
         </div>
      )}

      {modalProduzir && fichaAtual && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-card rounded-[32px] w-full max-w-lg p-5 sm:p-8 max-h-[calc(100dvh-1rem)] overflow-y-auto shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Registrar Produção</h2>
                     <p className="text-sm font-bold text-fg mt-1">{fichaAtual.nome_receita}</p>
                  </div>
                  <button onClick={() => setModalProduzir(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-6">
                  {/* Quem fez? */}
                  <div>
                     <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-2">Quem está preparando?</label>
                     <select value={colabSelecionado} onChange={e=>setColabSelecionado(e.target.value)} className="w-full p-4 bg-white border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-slate-800">
                        <option value="">-- Selecione seu nome --</option>
                        {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.cargo})</option>)}
                     </select>
                  </div>

                  {fichaAtual.eh_base && <div>
                     <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-2">Onde será guardado?</label>
                     <div className="grid grid-cols-2 gap-2 mb-2">
                        {(isBar ? ["Geladeira do Bar", "Prateleira do Bar", "Freezer do Bar", "Câmara fria"] : ["Freezer 1", "Freezer 2", "Geladeira", "Câmara fria"]).map(local => (
                           <button type="button" key={local} onClick={() => setLocalArmazenamento(local)} className={`min-h-11 rounded-xl border px-3 text-sm font-black ${localArmazenamento === local ? "border-amber-600 bg-amber-600 text-white" : "border-line bg-card text-slate-900"}`}>{local}</button>
                        ))}
                     </div>
                     <input value={localArmazenamento} onChange={e => setLocalArmazenamento(e.target.value)} placeholder={isBar ? "Ex.: Geladeira dos xaropes" : "Ex.: Freezer 3"} className="w-full p-4 bg-white border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-amber-600" />
                     <p className="mt-2 text-xs font-semibold text-amber-700">O local será registrado junto à produção e ao item de estoque.</p>
                  </div>}

                  {/* Quantidade */}
                  <div className="bg-white p-6 rounded-2xl border border-line">
                     <label className="text-xs font-bold text-fg uppercase tracking-widest block text-center mb-4">Quantidade produzida ({unidadeProducao(fichaAtual)})</label>
                     <div className="flex items-center justify-center gap-4">
                        <button onClick={()=>setQtdProd(p => Math.max(0.001, Number(p)-1))} className="w-14 h-14 rounded-full bg-card border border-line flex items-center justify-center text-3xl font-black text-fg hover:text-slate-800">-</button>
                        <input 
                           type="number" 
                           value={qtdProd} 
                           onChange={e=>setQtdProd(e.target.value)} 
                           className="w-24 p-2 text-center text-4xl font-black text-slate-800 bg-transparent outline-none"
                        />
                        <button onClick={()=>setQtdProd(p => Number(p)+1)} className="w-14 h-14 rounded-full bg-card border border-line flex items-center justify-center text-3xl font-black text-fg hover:text-slate-800">+</button>
                     </div>
                     {/* Pela receita (dono, 28/11/2026: "a quantidade é baseada no
                         rendimento de cada receita"). */}
                     {Number(fichaAtual.rendimento_porcoes) > 0 && (
                        <div className="mt-4 grid grid-cols-4 gap-2">
                           {[0.5, 1, 2, 3].map(m => {
                              const v = +(Number(fichaAtual.rendimento_porcoes) * m).toFixed(3);
                              const ativo = Math.abs(Number(String(qtdProd).replace(",", ".")) - v) < 0.0005;
                              return (
                                 <button key={m} type="button" onClick={() => setQtdProd(String(v))}
                                    className={`min-h-[52px] rounded-xl border px-1 text-center ${ativo ? "border-hf-menu bg-hf-menu text-white" : "border-line bg-card text-slate-800"}`}>
                                    <b className="block text-sm">{m === 0.5 ? "½" : m} {m > 1 ? "receitas" : "receita"}</b>
                                    <span className="block text-[11px]">{v.toLocaleString("pt-BR")} {unidadeProducao(fichaAtual)}</span>
                                 </button>
                              );
                           })}
                        </div>
                     )}
                  </div>

                  {/* Valor Total Médio da Produção + CMV desta ficha */}
                  {(() => {
                     const custoPorcao = custoTotalDaFicha(fichaAtual, fichas) / Number(fichaAtual.rendimento_porcoes || 1);
                     const valorTotalProducao = custoPorcao * Number(qtdProd || 0);
                     const cmv = calcCmv(fichaAtual, fichas, produtoDaFicha);
                     const cores = cmv !== null ? corCmv(cmv) : null;
                     return (
                        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between gap-4">
                           <div>
                              <p className="text-3xs font-bold uppercase tracking-widest text-accent">Valor Total Médio desta Produção</p>
                              <p className="text-3xs font-bold text-emerald-700/70 mt-0.5">{fmtBRL(custoPorcao)} / {unidadeProducao(fichaAtual)} × {qtdProd || 0}</p>
                              <p className="text-3xl font-black text-accent mt-1">{fmtBRL(valorTotalProducao)}</p>
                           </div>
                           {cmv !== null && (
                              <div className={`px-3 py-2 rounded-xl border shrink-0 text-center ${cores.bg} ${cores.border}`}>
                                 <p className={`text-3xs font-bold uppercase tracking-widest ${cores.text}`}>CMV</p>
                                 <p className={`text-xl font-black ${cores.text}`}>{cmv.toFixed(1)}%</p>
                              </div>
                           )}
                        </div>
                     );
                  })()}

                  <div className="space-y-2 text-sm" aria-live="polite">
                    <a href={`/dashboard/operacao/fichas/${fichaAtual.id}`} className="font-bold text-emerald-700 underline">Ver ficha técnica</a>
                    {erroPrevia && <p role="alert" className="text-red-700 font-bold">{erroPrevia}</p>}
                    {previa && (
                      <div className="rounded-xl border border-line">
                        <p className="border-b border-line px-3 py-2 text-xs font-bold text-slate-900">
                          {Number(previa.receitas).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} receita(s) · custo estimado <b>{previa.custo_estimado != null ? fmtBRL(previa.custo_estimado) : "—"}</b>
                        </p>
                        <p className="px-3 pt-2 text-3xs font-bold uppercase tracking-wider text-subtle">Vai consumir (peso bruto, com a perda)</p>
                        <ul className="divide-y divide-[color:var(--line-soft)] px-3 pb-1">
                          {previa.itens.map(item => (
                            <li key={item.chave} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-xs">
                              <span className="font-bold text-fg-soft">{item.nome}</span>
                              <span className="ml-auto whitespace-nowrap font-black tabular-nums text-fg">{Number(item.necessario).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} {item.unidade}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-3xs font-semibold text-subtle">O registro guarda o que foi produzido, por quem e o custo. O estoque não é baixado automaticamente: o CMV real vem da contagem de estoque.</p>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-line">
                     <button type="button" onClick={() => setModalProduzir(false)} className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl font-bold text-slate-900 transition-colors">
                        Cancelar
                     </button>
                     <button type="button" onClick={handleConfirmar} disabled={salvando || !previa} className="flex-1 py-4 bg-accent hover:bg-accent text-accent-fg rounded-2xl font-black transition-colors disabled:opacity-50">
                        {salvando ? "Confirmando..." : "Confirmar Produção"}
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

export default function ProducaoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-bold text-fg">Carregando produção...</div>}>
      <ProducaoRunner />
    </Suspense>
  );
}

