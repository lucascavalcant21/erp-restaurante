"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import {
  fetchColaboradores, inserirColaborador, removerColaborador, atualizarColaborador, 
  fetchDocumentos, uploadDocumentoRH, removerDocumento,
  fetchCargos,
  fetchAllFolgasDaUnidade, fetchFolgasEsporadicas, inserirFolgaEsporadica, removerFolgaEsporadica,
  fetchConsumoFuncionario, inserirConsumoFuncionario, atualizarStatusConsumo, removerConsumoFuncionario,
  fetchBancoHoras, inserirBancoHoras, removerBancoHoras, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN,
  fetchAdvertenciasColab, inserirAdvertencia, removerAdvertencia,
  fetchFeriados, inserirFeriado, removerFeriado,
  desligarColaborador
} from "../../lib/rh";
import { fetchPontoHoje, fetchPontosMes, fetchPontosMesUnidade } from "../../lib/ponto";
import { fetchValesPendentes } from "../../lib/rh";
import { calcularAdicionaisMes } from "../../lib/rh";
import { salvarConta, fetchContas, fetchLancamentos } from "../../lib/financeiro";
import { fetchCardapio } from "../../lib/cardapio";
import { fetchParams, PARAMS_PADRAO } from "../../lib/parametros";
import { useTempoReal } from "../../lib/realtime";

// Desconto do funcionário sobre o valor de cardápio (funcionário paga o restante)
// Desconto do funcionário: ajustável em Configurações > Parâmetros (paramsSis)
import { 
  Users, UserPlus, FileText, Upload, Save, X, Search, Trash2, Loader2, CalendarHeart, Star, Phone, CreditCard, ClipboardList, Clock, CalendarDays, ShoppingBag, CheckCircle, Store, Printer, UtensilsCrossed, LogOut, RotateCcw, ChevronDown, Camera
} from "lucide-react";
import { fmtBRL } from "../../components/ui";
import { comFecharImpressao } from "../../lib/imprimir";
import BancoTalentos from "./components/BancoTalentos";

export default function RHPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  
  const [funcionarios, setFuncionarios] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [valesPendentes, setValesPendentes] = useState([]);       // desconto em folha pendente
  const [pontosMesUnidade, setPontosMesUnidade] = useState([]);   // p/ extras e feriados do mês
  const [feriadosMesAtual, setFeriadosMesAtual] = useState([]);
  const [folgasUnidade, setFolgasUnidade] = useState([]);       // p/ relatório de faltas
  const [paramsSis, setParamsSis] = useState(PARAMS_PADRAO);     // parâmetros ajustáveis
  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") fetchParams(unidadeAtiva).then(r => setParamsSis(r.data)); }, [unidadeAtiva]);
  const [lancamentos, setLancamentos] = useState([]);             // p/ faturamento do mês (CMO %)
  const [cargos, setCargos] = useState([]);
  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("Fixo");
  const statePadrao = { foto: "", nome: "", cargo: "", salario: "", vale_alimentacao: "", taxa_servico_mes: "", horario_entrada: "", horario_saida: "", horario_dom_entrada: "", horario_dom_saida: "", dias_trabalho: "1,2,3,4,5,6", tempo_intervalo: 60, tipo_contrato: "Fixo", telefone: "", cpf: "", chave_pix: "", avaliacao_estrelas: 0, anotacoes_rh: "", data_admissao: "", status_contrato: "Definitivo", supervisor_id: "", supervisores_ids: [], endereco: "", cep: "", cidade_nascimento: "", data_nascimento: "", tem_filhos: false, qtd_filhos: "", tem_transporte: false, usa_vale_transporte: false, genero: "", escolaridade: "" };
  // Cargos de liderança sempre disponíveis, além dos cargos cadastrados
  const CARGOS_LIDERANCA = ["CEO", "Supervisor", "Gerente"];
  const [modalNovo, setModalNovo] = useState(false);
  const [menuAcoes, setMenuAcoes] = useState(null); // funcionário com o menu "Ações" aberto
  const [novoFunc, setNovoFunc] = useState(statePadrao);
  
  const [modalLancamento, setModalLancamento] = useState(false);
  const [funcParaLancamento, setFuncParaLancamento] = useState(null);
  const [formLancamento, setFormLancamento] = useState({ total: "0.00", fixo: "0.00", inss: "0.00", fgts: "0.00", taxa: "0.00" });
  const [editandoId, setEditandoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);

  const fileInputRef = useRef(null);
  const [funcParaUpload, setFuncParaUpload] = useState(null);
  
  const [modalFolgas, setModalFolgas] = useState(false);
  const [funcParaFolgas, setFuncParaFolgas] = useState(null);
  const [folgasEsporadicas, setFolgasEsporadicas] = useState([]);
  const [todasFolgasDaUnidade, setTodasFolgasDaUnidade] = useState([]);
  const [novaFolgaData, setNovaFolgaData] = useState("");
  const [domingosProximos, setDomingosProximos] = useState([]);

  // Estados Modal Consumo (Vales)
  // Ficha de extra: antes de imprimir, escolhe os itens emprestados e o valor
  // pago — o desmembramento (fixo/INSS/FGTS/taxa) é calculado na hora.
  const ITENS_FICHA_PADRAO = ["Uniforme / Camisa", "Avental", "Cartão de Consumo", "Rádio Comunicador / Fone"];
  const [modalFicha, setModalFicha] = useState(false);
  const [fichaFunc, setFichaFunc] = useState(null);
  const [fichaValor, setFichaValor] = useState("");
  const [fichaItens, setFichaItens] = useState([]);
  const [fichaNovoItem, setFichaNovoItem] = useState("");

  const abrirModalFicha = (f) => {
    setFichaFunc(f);
    setFichaValor(f?.salario ? String(f.salario) : "");
    setFichaItens(ITENS_FICHA_PADRAO.map(nome => ({ nome, incluir: true })));
    setFichaNovoItem("");
    setModalFicha(true);
  };

  const addItemFicha = () => {
    const nome = fichaNovoItem.trim();
    if (!nome) return;
    setFichaItens(lista => [...lista, { nome, incluir: true }]);
    setFichaNovoItem("");
  };

  const imprimirFichaPreparada = () => {
    imprimirFichaExtra(fichaFunc, {
      diaria: fichaValor,
      itens: fichaItens.filter(i => i.incluir).map(i => i.nome),
    });
    setModalFicha(false);
  };

  // Feriados do mês: dias marcados pagam +100% (dobro) para quem trabalhar
  const [modalFeriados, setModalFeriados] = useState(false);
  const [feriadosLista, setFeriadosLista] = useState([]);
  const [feriadoForm, setFeriadoForm] = useState({ data: "", nome: "" });
  const [mesFeriados, setMesFeriados] = useState(new Date().toISOString().slice(0, 7));

  const carregarFeriados = async (mes) => {
    const { data } = await fetchFeriados(unidadeAtiva, mes);
    setFeriadosLista(data || []);
  };
  const abrirModalFeriados = () => {
    const mes = new Date().toISOString().slice(0, 7);
    setMesFeriados(mes);
    setFeriadoForm({ data: "", nome: "" });
    setModalFeriados(true);
    carregarFeriados(mes);
  };
  const salvarFeriado = async (e) => {
    e.preventDefault();
    if (!feriadoForm.data) return alert("Escolha a data do feriado.");
    const { error } = await inserirFeriado(unidadeAtiva, feriadoForm.data, feriadoForm.nome);
    if (error) return alert("Erro: " + error);
    setFeriadoForm({ data: "", nome: "" });
    carregarFeriados(mesFeriados);
  };
  const excluirFeriado = async (id) => {
    await removerFeriado(id);
    carregarFeriados(mesFeriados);
  };

  // Advertências: geradas aqui, aparecem na vida do colaborador
  const [modalAdv, setModalAdv] = useState(false);
  const [funcAdv, setFuncAdv] = useState(null);
  const [advLista, setAdvLista] = useState([]);
  const [advForm, setAdvForm] = useState({ data: "", gravidade: "leve", motivo: "", descricao: "" });

  const abrirModalAdv = async (f) => {
    setFuncAdv(f);
    setAdvForm({ data: new Date().toISOString().split("T")[0], gravidade: "leve", motivo: "", descricao: "" });
    setModalAdv(true);
    const { data } = await fetchAdvertenciasColab(f.id);
    setAdvLista(data || []);
  };

  const salvarAdvertencia = async (e) => {
    e.preventDefault();
    if (!advForm.motivo.trim()) return alert("Informe o motivo da advertência.");
    const { error } = await inserirAdvertencia({
      unidade_id: unidadeAtiva,
      colaborador_id: funcAdv.id,
      data: advForm.data,
      gravidade: advForm.gravidade,
      motivo: advForm.motivo.trim(),
      descricao: advForm.descricao || null,
    });
    if (error) return alert("Erro: " + error);
    const { data } = await fetchAdvertenciasColab(funcAdv.id);
    setAdvLista(data || []);
    setAdvForm({ data: new Date().toISOString().split("T")[0], gravidade: "leve", motivo: "", descricao: "" });
  };

  const excluirAdvertencia = async (id) => {
    if (!confirm("Excluir esta advertência?")) return;
    await removerAdvertencia(id);
    const { data } = await fetchAdvertenciasColab(funcAdv.id);
    setAdvLista(data || []);
  };

  // Termo de advertência imprimível (modelo CLT) para assinatura
  const imprimirTermoAdvertencia = (f, adv) => {
    const dataFmt = adv.data ? adv.data.split("-").reverse().join("/") : "____/____/______";
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Termo de Advertencia - ${f.nome}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Georgia,'Times New Roman',serif;color:#111;padding:10mm 12mm;max-width:700px;margin:0 auto;line-height:1.8}
        h1{text-align:center;font-size:18px;letter-spacing:4px;text-transform:uppercase;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:18px}
        p{font-size:13px;text-align:justify;margin-bottom:10px}
        .dados{font-family:Arial,sans-serif;font-size:12px;border:1px solid #999;border-radius:6px;padding:10px 12px;margin-bottom:14px}
        .grav{font-weight:bold;text-transform:uppercase}
        .assin{margin-top:40px;display:flex;flex-direction:column;gap:34px}
        .assin div{border-top:1px solid #111;padding-top:4px;font-size:11px;text-align:center;width:320px;margin:0 auto;font-family:Arial,sans-serif}
        @media print{@page{margin:0}}
      </style></head><body>
      <h1>Termo de Advertência</h1>
      <div class="dados">
        <b>Colaborador:</b> ${f.nome} &nbsp;·&nbsp; <b>Função:</b> ${f.cargo || "—"} &nbsp;·&nbsp; <b>CPF:</b> ${f.cpf || "____________"}<br/>
        <b>Data da ocorrência:</b> ${dataFmt} &nbsp;·&nbsp; <b>Gravidade:</b> <span class="grav">${adv.gravidade}</span>
      </div>
      <p>Pelo presente, fica o(a) colaborador(a) acima identificado(a) <b>ADVERTIDO(A)</b> em razão de: <b>${adv.motivo}</b>.</p>
      ${adv.descricao ? `<p><b>Descrição da ocorrência:</b> ${adv.descricao}</p>` : ""}
      <p>Advertimos que a reincidência em faltas desta natureza poderá ensejar sanções mais severas, na forma do art. 482 da CLT, incluindo suspensão disciplinar e rescisão contratual por justa causa.</p>
      <p>O(a) colaborador(a) declara ciência do presente termo, recebendo uma via.</p>
      <div class="assin">
        <div>Assinatura do(a) colaborador(a)</div>
        <div>Assinatura do empregador / gerente</div>
        <div>Testemunha (nome e assinatura)</div>
      </div>
      </body></html>`;
    let win = null;
    try { win = window.open("", "_blank", "width=820,height=1000"); } catch { win = null; }
    if (!win) return alert("Habilite os popups para imprimir o termo.");
    win.document.write(comFecharImpressao(html));
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // Banco de horas: intervalo de 1h não tirado acumula (limite 8h/mês)
  const [bancoHoras, setBancoHoras] = useState([]);
  const [modalBanco, setModalBanco] = useState(false);
  const [funcBanco, setFuncBanco] = useState(null);
  const [formBanco, setFormBanco] = useState({ data: "", minutos: "60", observacao: "" });

  const [modalConsumo, setModalConsumo] = useState(false);
  const [funcionarioConsumo, setFuncionarioConsumo] = useState(null);
  const [listaConsumo, setListaConsumo] = useState([]);
  const [cardapioConsumo, setCardapioConsumo] = useState([]);
  const [buscaPrato, setBuscaPrato] = useState("");
  const stateConsumo = { descricao: "", valor_original: "", forma_pagamento: "Desconto em Folha", data_consumo: new Date().toISOString().substring(0,16) };
  const [novoConsumo, setNovoConsumo] = useState(stateConsumo);
  const [loadingConsumo, setLoadingConsumo] = useState(false);

  const carregar = async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    const mesAtual = new Date().toISOString().slice(0, 7);
    const [resRh, resPonto, resCargos, resBanco, resVales, resPontosMes, resFeriadosMes, resFolgas] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva),
      fetchCargos(unidadeAtiva),
      fetchBancoHoras(unidadeAtiva, mesAtual),
      fetchValesPendentes(unidadeAtiva),
      fetchPontosMesUnidade(unidadeAtiva, mesAtual),
      fetchFeriados(unidadeAtiva, mesAtual),
      fetchAllFolgasDaUnidade(unidadeAtiva),
    ]);
    const resLanc = await fetchLancamentos(unidadeAtiva);
    setLancamentos(resLanc.data || []);

    const comDocs = await Promise.all((resRh.data || []).map(async (f) => {
       const docsResp = await fetchDocumentos(f.id);
       return { ...f, docs: docsResp.data || [] };
    }));

    setFuncionarios(comDocs);
    setPontosHoje(resPonto.data || []);
    setCargos(resCargos.data || []);
    setBancoHoras(resBanco.data || []);
    setValesPendentes(resVales.data || []);
    setPontosMesUnidade(resPontosMes.data || []);
    setFeriadosMesAtual(resFeriadosMes.data || []);
    setFolgasUnidade(resFolgas.data || []);
    setLoading(false);
  };

  // ── Relatório do mês: faltas e atrasos dos fixos + extras por dia ──────────
  const imprimirFaltasAtrasos = () => {
    const hoje = new Date();
    const mesAtual = hoje.toISOString().slice(0, 7);
    const diaHoje = hoje.getDate();
    const ativos = funcionarios.filter(f => (f.status || "ativo") !== "inativo");
    const fixos = ativos.filter(f => f.tipo_contrato !== "Freelancer");
    const extras = ativos.filter(f => f.tipo_contrato === "Freelancer");

    const dataStr = (d) => `${mesAtual}-${String(d).padStart(2, "0")}`;
    const pontoDe = (fid, dStr) => pontosMesUnidade.find(p => p.colaborador_id === fid && p.data_referencia === dStr);
    const temFolga = (fid, dStr) => folgasUnidade.some(fl => fl.colaborador_id === fid && String(fl.data_folga).slice(0, 10) === dStr);

    const linhasFixos = fixos.map(f => {
      const dias = String(f.dias_trabalho || "").split(",").map(s => s.trim()).filter(Boolean);
      let previstos = 0, presencas = 0, faltas = [], atrasos = 0, minAtraso = 0;
      for (let d = 1; d <= diaHoje; d++) {
        const dt = new Date(hoje.getFullYear(), hoje.getMonth(), d);
        if (dias.length && !dias.includes(String(dt.getDay()))) continue; // folga semanal
        const dStr = dataStr(d);
        if (temFolga(f.id, dStr)) continue; // folga programada
        previstos++;
        const p = pontoDe(f.id, dStr);
        if (!p || !p.hora_entrada) { faltas.push(d); continue; }
        presencas++;
        // Atraso: entrada gravada depois da prevista (a tolerância já ajusta por dentro)
        const prevStr = dt.getDay() === 0 ? (f.horario_dom_entrada || f.horario_entrada) : f.horario_entrada;
        if (prevStr) {
          const [hh, mm] = prevStr.split(":").map(Number);
          const prev = new Date(dt); prev.setHours(hh || 0, mm || 0, 0, 0);
          const atrasoMin = Math.round((new Date(p.hora_entrada).getTime() - prev.getTime()) / 60000);
          if (atrasoMin >= 1) { atrasos++; minAtraso += atrasoMin; }
        }
      }
      return { f, previstos, presencas, faltas, atrasos, minAtraso };
    }).sort((a, b) => (b.faltas.length - a.faltas.length) || (b.minAtraso - a.minAtraso));

    // Extras por dia: quem bateu ponto em cada dia × diária
    const linhasExtras = [];
    for (let d = 1; d <= diaHoje; d++) {
      const dStr = dataStr(d);
      const doDia = extras.filter(f => pontoDe(f.id, dStr));
      if (!doDia.length) continue;
      linhasExtras.push({
        dia: `${String(d).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}`,
        qtd: doDia.length,
        nomes: doDia.map(f => f.nome.split(" ")[0]).join(", "),
        custo: doDia.reduce((s, f) => s + (Number(f.salario) || 0), 0),
      });
    }
    const totalDiarias = linhasExtras.reduce((s, l) => s + l.qtd, 0);
    const totalCustoExtras = linhasExtras.reduce((s, l) => s + l.custo, 0);

    const mesNome = hoje.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Faltas e Atrasos — ${mesNome}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:9mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}
        h1{font-size:20px;text-transform:capitalize}
        .tag{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#555;font-weight:bold}
        .meta{font-size:11px;color:#555;font-weight:bold;text-align:right}
        h2{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#334155;margin:14px 0 6px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #94a3b8;padding:5px 6px;text-align:left}
        th{background:#e2e8f0;font-size:9px;text-transform:uppercase;letter-spacing:1px}
        td.c{text-align:center;font-weight:bold}
        td.falta{color:#dc2626;font-weight:bold}
        td.r{text-align:right;font-weight:bold}
        tr{page-break-inside:avoid}
        .tot{background:#f1f5f9;font-weight:bold}
        @media print{@page{margin:8mm}}
      </style></head><body>
      <div class="head">
        <div><div class="tag">Relatório de Presença — RH</div><h1>${mesNome}</h1></div>
        <div class="meta">${unidadeAtiva ? "" : ""}até ${hoje.toLocaleDateString("pt-BR")}<br/>${fixos.length} fixo(s) · ${extras.length} extra(s)</div>
      </div>

      <h2>Faltas e Atrasos — Equipe Fixa</h2>
      <table>
        <thead><tr><th>Colaborador</th><th>Função</th><th>Dias previstos</th><th>Presenças</th><th>Faltas</th><th>Dias das faltas</th><th>Atrasos</th><th>Min. de atraso</th></tr></thead>
        <tbody>
          ${linhasFixos.map(l => `<tr>
            <td><b>${l.f.nome}</b></td><td>${l.f.cargo || ""}</td>
            <td class="c">${l.previstos}</td><td class="c">${l.presencas}</td>
            <td class="c ${l.faltas.length ? "falta" : ""}">${l.faltas.length}</td>
            <td>${l.faltas.map(d => String(d).padStart(2, "0")).join(", ") || "—"}</td>
            <td class="c">${l.atrasos}</td><td class="c">${l.minAtraso > 0 ? l.minAtraso + " min" : "—"}</td>
          </tr>`).join("") || '<tr><td colspan="8">Nenhum fixo ativo.</td></tr>'}
        </tbody>
      </table>

      <h2>Extras por Dia (diárias pelo ponto)</h2>
      <table>
        <thead><tr><th>Dia</th><th>Qtd extras</th><th>Quem</th><th>Custo (diárias)</th></tr></thead>
        <tbody>
          ${linhasExtras.map(l => `<tr><td class="c">${l.dia}</td><td class="c">${l.qtd}</td><td>${l.nomes}</td><td class="r">${fmtBRL(l.custo)}</td></tr>`).join("") || '<tr><td colspan="4">Nenhum extra bateu ponto no mês.</td></tr>'}
          ${linhasExtras.length ? `<tr class="tot"><td>TOTAL</td><td class="c">${totalDiarias} diária(s)</td><td></td><td class="r">${fmtBRL(totalCustoExtras)}</td></tr>` : ""}
        </tbody>
      </table>
      <p style="font-size:9px;color:#94a3b8;margin-top:8px">Falta = dia de trabalho previsto sem batida de ponto (desconta folgas semanais e programadas). Atraso = entrada gravada após o horário; a tolerância legal já é aplicada na marcação. Gerado em ${new Date().toLocaleString("pt-BR")}.</p>
      </body></html>`;
    const win = window.open("", "_blank", "width=980,height=1000");
    if (win) { win.document.write(comFecharImpressao(html)); win.document.close(); setTimeout(() => win.print(), 400); }
    else alert("Habilite os popups para imprimir o relatório.");
  };

  // Salário previsto do mês. A remuneração cheia = FIXO + VALE + TAXA DE SERVIÇO;
  // em cima entram feriado/extra/noturno (calculados sobre o fixo, regra CLT) e
  // saem os vales pendentes com desconto em folha. Atualiza conforme o mês anda.
  const previsaoDe = (f) => {
    const fixo = Number(f.salario) || 0;
    const va = Number(f.vale_alimentacao) || 0;
    const taxa = Number(f.taxa_servico_mes) || 0;
    const base = fixo + va + taxa; // remuneração cheia
    const meusPontos = pontosMesUnidade.filter(p => p.colaborador_id === f.id);
    const ad = calcularAdicionaisMes(meusPontos, fixo, feriadosMesAtual);
    const descontos = valesPendentes
      .filter(v => v.funcionario_id === f.id)
      .reduce((s, v) => s + (Number(v.valor_final ?? v.valor_desconto ?? v.valor_original) || 0), 0);
    const adicionais = (ad.valorExtra || 0) + (ad.valorFeriado || 0) + (ad.valorNoturno || 0);
    return { fixo, va, taxa, base, adicionais, descontos, ad, previsto: base + adicionais - descontos };
  };

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  // Tempo real: lançamentos (ponto, vales, folgas, contas...) aparecem sozinhos
  useTempoReal(["colaboradores", "registro_ponto", "rh_consumo_funcionarios", "rh_banco_horas", "rh_folgas_esporadicas", "lancamentos", "contas_pagar", "documentos_rh"], () => { if (unidadeAtiva) carregar(true); });

  // --- Banco de Horas ---
  const fmtMin = (m) => `${Math.floor(m / 60)}h${String(Math.round(m) % 60).padStart(2, "0")}`;
  // Só créditos contam para as 8h — "excesso" (passou do intervalo) é ocorrência
  const totalBancoDe = (colabId) => bancoHoras
    .filter(b => b.colaborador_id === colabId && b.tipo !== "excesso")
    .reduce((s, b) => s + (Number(b.minutos) || 0), 0);

  const abrirModalBanco = (f) => {
    setFuncBanco(f);
    setFormBanco({ data: new Date().toISOString().split("T")[0], minutos: "60", observacao: "" });
    setCompensarData(new Date().toISOString().split("T")[0]);
    setModalBanco(true);
  };

  const lancarBancoHoras = async (e) => {
    e.preventDefault();
    const min = Number(formBanco.minutos) || 0;
    if (min <= 0) return alert("Informe os minutos que faltaram do intervalo.");
    if (min > 60) return alert("O lançamento é por dia e o intervalo é de 1h — máximo 60 minutos por dia.");
    if (!formBanco.data) return alert("Informe a data.");
    const totalAtual = totalBancoDe(funcBanco.id);
    if (totalAtual + min > BANCO_LIMITE_MIN) {
      return alert(`Não dá: ${funcBanco.nome} já tem ${fmtMin(totalAtual)} acumuladas neste mês. O limite é 8h — restam só ${fmtMin(BANCO_LIMITE_MIN - totalAtual)}. Programe a folga dele(a)!`);
    }
    const { error } = await inserirBancoHoras(unidadeAtiva, funcBanco.id, formBanco.data, min, formBanco.observacao);
    if (error) return alert("Erro ao lançar: " + error);
    const novoTotal = totalAtual + min;
    if (novoTotal >= BANCO_ALERTA_MIN) {
      alert(`Atenção: ${funcBanco.nome} chegou a ${fmtMin(novoTotal)} de banco de horas no mês (limite 8h). Programe a compensação!`);
    }
    setFormBanco({ data: new Date().toISOString().split("T")[0], minutos: "60", observacao: "" });
    carregar();
  };

  const excluirBancoHoras = async (id) => {
    if (!confirm("Remover este lançamento do banco de horas?")) return;
    await removerBancoHoras(id);
    carregar();
  };

  // Compensar o banco com uma folga: registra a folga e zera os créditos do mês
  const [compensarData, setCompensarData] = useState("");
  const compensarBanco = async () => {
    const creditos = bancoHoras.filter(b => b.colaborador_id === funcBanco.id && b.tipo !== "excesso");
    const total = creditos.reduce((s, b) => s + (Number(b.minutos) || 0), 0);
    if (total <= 0) return alert("Não há créditos para compensar.");
    if (!compensarData) return alert("Escolha a data da folga compensatória.");
    if (!confirm(`Dar folga compensatória em ${compensarData.split("-").reverse().join("/")} para ${funcBanco.nome} e ZERAR ${fmtMin(total)} do banco de horas?`)) return;
    const { error } = await inserirFolgaEsporadica(unidadeAtiva, funcBanco.id, compensarData, `Folga compensatória — banco de horas (${fmtMin(total)})`);
    if (error) return alert("Erro ao registrar a folga: " + error);
    for (const b of creditos) await removerBancoHoras(b.id);
    alert(`Pronto: folga registrada e ${fmtMin(total)} compensadas. O banco de ${funcBanco.nome.split(" ")[0]} voltou a zero.`);
    setModalBanco(false);
    carregar();
  };

  // Lança a folha do mês no Financeiro: fixo + vale alimentação + taxa de
  // serviço + adicional noturno e horas extras calculados do ponto (CLT)
  const lancarFolhaMes = async () => {
    const fixos = funcionarios.filter(f => f.tipo_contrato !== "Freelancer" && (f.status || "ativo") !== "inativo" && Number(f.salario) > 0);
    if (!fixos.length) return alert("Nenhum funcionário fixo com salário cadastrado.");
    const agora = new Date();
    const mesISO = agora.toISOString().slice(0, 7);
    const mesKey = `${String(agora.getMonth() + 1).padStart(2, "0")}/${agora.getFullYear()}`;
    const prox = new Date(agora.getFullYear(), agora.getMonth() + 1, 5);
    const venc = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-05`;

    // Monta a folha completa de cada um antes de confirmar
    const { data: feriadosMes } = await fetchFeriados(unidadeAtiva, mesISO);
    const folha = [];
    for (const f of fixos) {
      const { data: pontos } = await fetchPontosMes(f.id, mesISO);
      const ad = calcularAdicionaisMes(pontos || [], f.salario, feriadosMes || []);
      const fixo = Number(f.salario) || 0;
      const va = Number(f.vale_alimentacao) || 0;
      const taxa = Number(f.taxa_servico_mes) || 0;
      const total = fixo + va + taxa + ad.valorNoturno + ad.valorExtra + ad.valorFeriado;
      folha.push({ f, fixo, va, taxa, ad, total });
    }
    const totalGeral = folha.reduce((s, x) => s + x.total, 0);
    const resumo = folha.map(x =>
      `${x.f.nome.split(" ")[0]}: ${fmtBRL(x.total)} (fixo ${fmtBRL(x.fixo)}${x.va ? ` + VA ${fmtBRL(x.va)}` : ""}${x.taxa ? ` + taxa ${fmtBRL(x.taxa)}` : ""}${x.ad.valorNoturno ? ` + noturno ${fmtBRL(x.ad.valorNoturno)}` : ""}${x.ad.valorExtra ? ` + extra ${fmtBRL(x.ad.valorExtra)}` : ""}${x.ad.valorFeriado ? ` + feriado ${fmtBRL(x.ad.valorFeriado)}` : ""})`
    ).join("\n");
    if (!confirm(`Lançar a folha de ${mesKey}?\n\n${resumo}\n\nTOTAL: ${fmtBRL(totalGeral)}\nCada um vira uma conta a pagar (mão de obra), venc. 05/${String(prox.getMonth() + 1).padStart(2, "0")}. Quem já foi lançado no mês não duplica.`)) return;

    const { data: contasExistentes } = await fetchContas(unidadeAtiva, "");
    const jaLancadas = new Set((contasExistentes || []).map(c => c.descricao));
    let ok = 0, pulados = 0;
    for (const x of folha) {
      const descricao = `Folha ${mesKey}: ${x.f.nome} - ${x.f.cargo || "—"}`;
      if (jaLancadas.has(descricao)) { pulados++; continue; }
      const { error } = await salvarConta({
        unidade_id: unidadeAtiva,
        descricao,
        valor: Math.round(x.total * 100) / 100,
        data_vencimento: venc,
        categoria: "cmo",
        status: "pendente",
      });
      if (!error) ok++;
    }
    alert(`Folha lançada: ${ok} conta(s) criada(s)${pulados ? ` · ${pulados} já estavam lançadas` : ""}.`);
  };

  // --- Funções de Consumo ---
  const carregarConsumo = async (funcId) => {
    setLoadingConsumo(true);
    const { data } = await fetchConsumoFuncionario(funcId);
    setListaConsumo(data || []);
    setLoadingConsumo(false);
  };

  const abrirModalConsumo = async (f) => {
    setFuncionarioConsumo(f);
    setNovoConsumo({ ...stateConsumo, data_consumo: new Date().toISOString().substring(0,16) });
    setListaConsumo([]);
    setBuscaPrato("");
    setModalConsumo(true);
    carregarConsumo(f.id);
    const { data } = await fetchCardapio(unidadeAtiva);
    setCardapioConsumo((data || []).filter(p => p.ativo !== false));
  };

  // Seleciona um prato do cardápio: preenche descrição e valor original
  const escolherPrato = (prato) => {
    setNovoConsumo(nc => ({ ...nc, descricao: prato.nome, valor_original: String(prato.preco ?? "") }));
  };

  const salvarConsumo = async () => {
    if (!novoConsumo.descricao || !novoConsumo.valor_original) return alert("Preencha descrição e valor.");
    
    const valOriginal = Number(novoConsumo.valor_original);
    const valDesconto = valOriginal * (1 - (paramsSis.desconto_func_pct / 100)); // funcionário paga o restante
    const statPagto = novoConsumo.forma_pagamento === "Desconto em Folha" ? "Pendente" : "Pago";
    
    const payload = {
      unidade_id: unidadeAtiva,
      funcionario_id: funcionarioConsumo.id,
      descricao: novoConsumo.descricao,
      valor_original: valOriginal,
      valor_desconto: valDesconto,
      forma_pagamento: novoConsumo.forma_pagamento,
      status_pagamento: statPagto,
      data_consumo: new Date(novoConsumo.data_consumo).toISOString(),
    };
    if (statPagto === "Pago") payload.data_pagamento = new Date().toISOString();

    const { error } = await inserirConsumoFuncionario(payload);
    if (error) return alert("Erro: " + error);
    
    setNovoConsumo({ ...stateConsumo, data_consumo: new Date().toISOString().substring(0,16) });
    carregarConsumo(funcionarioConsumo.id);
  };

  const quitarConsumo = async (consumoId) => {
    if (!confirm("Confirmar quitação (pagamento recebido) deste consumo?")) return;
    const { error } = await atualizarStatusConsumo(consumoId, "Pago");
    if (error) alert("Erro: " + error);
    else carregarConsumo(funcionarioConsumo.id);
  };

  const alterarFormaPagamentoConsumo = async (consumoId, statusAtual, novaForma) => {
    const { error } = await atualizarStatusConsumo(consumoId, statusAtual, novaForma);
    if (error) alert("Erro: " + error);
    else carregarConsumo(funcionarioConsumo.id);
  };

  const apagarConsumo = async (consumoId) => {
    if (!confirm("Apagar este registro?")) return;
    const { error } = await removerConsumoFuncionario(consumoId);
    if (error) alert("Erro: " + error);
    else carregarConsumo(funcionarioConsumo.id);
  };

  const ehInativo = (f) => (f.status || "ativo") === "inativo";
  const filtrados = abaAtiva === "Ex-funcionários"
    ? funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()) && ehInativo(f))
    : funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()) && (f.tipo_contrato || "Fixo") === abaAtiva && !ehInativo(f));

  const imprimirFichaExtra = (funcionario, opcoes = {}) => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const nome = funcionario ? funcionario.nome : "__________________________________________________";
    const cpf = funcionario ? (funcionario.cpf || "___.___.___-__") : "___.___.___-__";
    const cargo = funcionario ? (funcionario.cargo || "___________________") : "___________________";

    // Diária desmembrada (mesma regra do "Lançar Diária"): fixo + INSS 5% + FGTS 8% + taxa de serviço 10%
    // O valor digitado na hora da impressão tem prioridade sobre o cadastro.
    const diariaTotal = parseFloat(String(opcoes.diaria ?? (funcionario?.salario || "")).replace(",", ".")) || 0;
    // Itens escolhidos na hora (ou o kit padrão)
    const itensLista = Array.isArray(opcoes.itens) && opcoes.itens.length ? opcoes.itens : ITENS_FICHA_PADRAO;
    const dInss = diariaTotal * 0.05;
    const dFgts = diariaTotal * 0.08;
    const dTaxa = diariaTotal * 0.10;
    const dFixo = diariaTotal - dInss - dFgts - dTaxa;
    // Na ficha em branco (ou sem diária cadastrada) os valores ficam vazios p/ preencher à mão
    const money = (v) => diariaTotal > 0 ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
    const telefone = funcionario?.telefone || "____________________________";
    const pix = funcionario?.chave_pix || "________________________________________";
    const horaIni = funcionario?.horario_entrada || "____:____";
    const horaFim = funcionario?.horario_saida || "____:____";
    const diariaAcordada = diariaTotal > 0 ? money(diariaTotal) : "R$ ______________";
    
    const html = `
      <html>
        <head>
          <title>Ficha de Controle de Extras</title>
          <style>
            @page { size: A4 portrait; margin: 8mm; }
            * { box-sizing: border-box; }
            body { font-family: sans-serif; padding: 12px; color: #1e293b; line-height: 1.4; font-size: 12px; }
            h1 { text-align: center; margin: 0 0 3px; font-size: 21px; text-transform: uppercase; }
            h2 { text-align: center; font-size: 11px; font-weight: normal; margin: 0 0 14px; color: #64748b; }
            .section { margin-bottom: 14px; }
            .section-title { font-size: 12px; font-weight: bold; background: #f1f5f9; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; font-size: 11px; }
            th { background: #f8fafc; font-size: 10px; text-transform: uppercase; color: #64748b; }
            .signature-box { height: 34px; }
            .checkbox { width: 12px; height: 12px; border: 1px solid #94a3b8; display: inline-block; margin-right: 6px; vertical-align: middle; border-radius: 2px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Ficha de Extra / Diária</h1>
          <h2>Termo de trabalho e responsabilidade · Emitida em ${hoje} · Via única — fica arquivada com a empresa</h2>

          <div class="section">
             <div class="section-title">Dados Pessoais</div>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                <div><strong>Nome:</strong> ${nome}</div>
                <div><strong>CPF:</strong> ${cpf} &nbsp;&nbsp; <strong>RG:</strong> __________________</div>
                <div style="grid-column: 1 / -1;"><strong>Endereço:</strong> ________________________________________________________________________________</div>
                <div><strong>Telefone:</strong> ${telefone}</div>
                <div><strong>Chave PIX:</strong> ${pix}</div>
             </div>
          </div>

          <div class="section">
             <div class="section-title">Acordo do Dia</div>
             <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px;">
                <div><strong>Data do trabalho:</strong> ____/____/______</div>
                <div><strong>Evento / Ocasião:</strong> ______________________________</div>
                <div><strong>Função no dia:</strong> ${cargo}</div>
                <div><strong>Carga acordada:</strong> das ${horaIni} às ${horaFim} · Intervalo: __________</div>
                <div style="grid-column: 1 / -1; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:5px 8px;">
                   <strong>Valor da diária acordado: ${diariaAcordada}</strong>
                   <span style="color:#64748b; font-size:9px;"> (desmembramento detalhado no acerto financeiro abaixo)</span>
                </div>
             </div>
          </div>

          <div class="section">
             <div class="section-title">Controle de Ponto (Turno)</div>
             <table>
               <thead>
                 <tr>
                   <th>Entrada</th>
                   <th>Saída Intervalo</th>
                   <th>Retorno Intervalo</th>
                   <th>Saída Final</th>
                 </tr>
               </thead>
               <tbody>
                 <tr>
                   <td class="signature-box"></td>
                   <td class="signature-box"></td>
                   <td class="signature-box"></td>
                   <td class="signature-box"></td>
                 </tr>
               </tbody>
             </table>
          </div>

          <div class="section" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start;">
            <div>
             <div class="section-title">Itens Disponibilizados pela Empresa</div>
             <p style="font-size: 10px; color: #64748b; margin: 0 0 6px;"><strong>Declaro ter recebido os itens abaixo em perfeito estado</strong> para uso em serviço, e me comprometo a <strong>devolvê-los em perfeito estado, no CAIXA, ao término do turno</strong>. Em caso de perda ou dano, o valor poderá ser descontado do acerto da diária.</p>

             <table>
               <thead>
                 <tr>
                   <th style="width: 46%;">Item Emprestado</th>
                   <th>Visto Receb.</th>
                   <th>Visto Devol.</th>
                 </tr>
               </thead>
               <tbody>
                 ${itensLista.map(item => `
                 <tr>
                   <td><span class="checkbox"></span> ${item}</td>
                   <td class="signature-box"></td>
                   <td class="signature-box"></td>
                 </tr>`).join("")}
                 <tr>
                   <td><span class="checkbox"></span> Outro: ____________</td>
                   <td class="signature-box"></td>
                   <td class="signature-box"></td>
                 </tr>
               </tbody>
            </table>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 10px;">
               <div><strong>Itens entregues por (responsável):</strong><br/>_______________________</div>
               <div><strong>Local / setor da entrega:</strong><br/>_______________________</div>
               <div><strong>Devolução no caixa — conferida por:</strong><br/>_______________________</div>
               <div><strong>Horário da devolução:</strong> ____:____<br/><strong>Tudo em perfeito estado?</strong> <span class="checkbox"></span> Sim <span class="checkbox" style="margin-left:6px;"></span> Não</div>
            </div>
            </div>

            <div>
               <div class="section-title">Acerto Financeiro (Desmembramento)</div>
               <table>
                 <thead>
                   <tr>
                     <th>Descrição</th>
                     <th>Valor (R$)</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr>
                     <td>Valor Fixo</td>
                     <td>${money(dFixo)}</td>
                   </tr>
                   <tr>
                     <td>INSS (5%)</td>
                     <td>${money(dInss)}</td>
                   </tr>
                   <tr>
                     <td>FGTS (8%)</td>
                     <td>${money(dFgts)}</td>
                   </tr>
                   <tr>
                     <td>Taxa de Serviço (10%)</td>
                     <td>${money(dTaxa)}</td>
                   </tr>
                   <tr style="background:#f8fafc;">
                     <td><strong>Diária Base (soma)</strong></td>
                     <td><strong>${money(diariaTotal)}</strong></td>
                   </tr>
                   <tr>
                     <td>Vale Transporte / Passagem</td>
                     <td></td>
                   </tr>
                   <tr>
                     <td>Adicional / Bônus</td>
                     <td></td>
                   </tr>
                   <tr>
                     <td>Descontos / Faltas / Quebras</td>
                     <td></td>
                   </tr>
                   <tr>
                     <td><strong>Total a Pagar</strong></td>
                     <td><strong></strong></td>
                   </tr>
                 </tbody>
               </table>
               
               <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 10px;">
                  <div>
                    <strong>Forma de Pagamento:</strong><br/>
                    <span class="checkbox" style="margin-top:3px;"></span> Pix
                    <span class="checkbox" style="margin-top:3px; margin-left: 10px;"></span> Dinheiro
                  </div>
                  <div>
                    <strong>Assinatura de Recebimento:</strong><br/>
                    <div style="border-bottom: 1px solid #000; width: 100%; height: 18px;"></div>
                  </div>
               </div>
            </div>
            </div>

            <div class="section" style="margin-top: 14px;">
               <p style="font-size: 10px; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; line-height: 1.5; margin: 0;">
                  Declaro que <strong>li e estou de acordo</strong> com o valor da diária e seu desmembramento (valor fixo, INSS, FGTS e taxa de serviço), com a carga de trabalho acordada para o dia e com a responsabilidade pela devolução dos itens recebidos, em perfeito estado, no caixa, ao término do turno.
               </p>
               <div style="display: flex; justify-content: space-between; gap: 40px; margin-top: 42px;">
                  <div style="flex:1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 11px;">
                     Assinatura do Extra / Diarista
                  </div>
                  <div style="flex:1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 11px;">
                     Gerente / Responsável da Empresa
                  </div>
               </div>
               <p style="font-size: 9px; color: #94a3b8; margin-top: 12px; text-align: center; margin-bottom: 0;">Via única — este documento fica arquivado com a empresa.</p>
            </div>
          </body>
        </html>
    `;

    const win = window.open("", "_blank");
    win.document.write(comFecharImpressao(html));
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const abrirModalNovo = () => {
    setEditandoId(null);
    setNovoFunc(statePadrao);
    setModalNovo(true);
  };

  // Foto do colaborador: comprime (máx. 400px, jpeg) e guarda em base64.
  const fotoInputRef = useRef(null);
  const escolherFotoColab = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 400;
      const escala = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      setNovoFunc(nf => ({ ...nf, foto: canvas.toDataURL("image/jpeg", 0.7).split(",")[1] || "" }));
    };
    img.src = url;
  };

  const abrirModalEdicao = (f) => {
    setEditandoId(f.id);
    setNovoFunc({
       foto: f.foto || "",
       nome: f.nome || "",
       cargo: f.cargo || "",
       salario: f.salario || "",
       horario_entrada: f.horario_entrada || "",
       horario_saida: f.horario_saida || "",
       horario_dom_entrada: f.horario_dom_entrada || "",
       horario_dom_saida: f.horario_dom_saida || "",
       dias_trabalho: f.dias_trabalho || "1,2,3,4,5,6",
       tempo_intervalo: f.tempo_intervalo || 60,
       tipo_contrato: f.tipo_contrato || "Fixo",
       telefone: f.telefone || "",
       cpf: f.cpf || "",
       chave_pix: f.chave_pix || "",
       avaliacao_estrelas: f.avaliacao_estrelas || 0,
       anotacoes_rh: f.anotacoes_rh || "",
       data_admissao: f.data_admissao || "",
       status_contrato: f.status_contrato || "Definitivo",
       supervisor_id: f.supervisor_id || "",
       supervisores_ids: Array.isArray(f.supervisores_ids) ? f.supervisores_ids : (f.supervisor_id ? [f.supervisor_id] : []),
       vale_alimentacao: f.vale_alimentacao || "",
       taxa_servico_mes: f.taxa_servico_mes || "",
       endereco: f.endereco || "",
       cep: f.cep || "",
       cidade_nascimento: f.cidade_nascimento || "",
       data_nascimento: f.data_nascimento || "",
       tem_filhos: !!f.tem_filhos,
       qtd_filhos: f.qtd_filhos || "",
       tem_transporte: !!f.tem_transporte,
       usa_vale_transporte: !!f.usa_vale_transporte,
       genero: f.genero || "",
       escolaridade: f.escolaridade || ""
    });
    setModalNovo(true);
  };

  const handleSalvar = async () => {
    if(!novoFunc.nome || !novoFunc.cargo) return alert("Por favor, preencha o Nome e a Função/Cargo antes de salvar.");
    
    const payload = {
      unidade_id: unidadeAtiva,
      nome: novoFunc.nome,
      cargo: novoFunc.cargo,
      salario: Number(novoFunc.salario) || 0,
      horario_entrada: novoFunc.horario_entrada,
      horario_saida: novoFunc.horario_saida,
      horario_dom_entrada: novoFunc.horario_dom_entrada || null,
      horario_dom_saida: novoFunc.horario_dom_saida || null,
      dias_trabalho: novoFunc.dias_trabalho,
      tempo_intervalo: Number(novoFunc.tempo_intervalo) || 60,
      tipo_contrato: novoFunc.tipo_contrato,
      telefone: novoFunc.telefone,
      cpf: novoFunc.cpf,
      chave_pix: novoFunc.chave_pix,
      avaliacao_estrelas: Number(novoFunc.avaliacao_estrelas) || 0,
      anotacoes_rh: novoFunc.anotacoes_rh,
      data_admissao: novoFunc.data_admissao || null,
      status_contrato: novoFunc.status_contrato,
      supervisor_id: (novoFunc.supervisores_ids && novoFunc.supervisores_ids[0]) || novoFunc.supervisor_id || null,
      supervisores_ids: novoFunc.supervisores_ids && novoFunc.supervisores_ids.length ? novoFunc.supervisores_ids : null,
      vale_alimentacao: Number(novoFunc.vale_alimentacao) || 0,
      taxa_servico_mes: Number(novoFunc.taxa_servico_mes) || 0,
      endereco: novoFunc.endereco || null,
      cep: novoFunc.cep || null,
      cidade_nascimento: novoFunc.cidade_nascimento || null,
      data_nascimento: novoFunc.data_nascimento || null,
      tem_filhos: !!novoFunc.tem_filhos,
      qtd_filhos: novoFunc.tem_filhos ? (Number(novoFunc.qtd_filhos) || 0) : null,
      tem_transporte: !!novoFunc.tem_transporte,
      usa_vale_transporte: !!novoFunc.usa_vale_transporte,
      genero: novoFunc.genero || null,
      escolaridade: novoFunc.escolaridade || null,
      foto: novoFunc.foto || null
    };

    if (editandoId) {
      const { error } = await atualizarColaborador(editandoId, payload);
      if (error) return alert("Erro ao atualizar: " + error);
    } else {
      const { error } = await inserirColaborador(payload);
      if (error) return alert("Erro ao salvar: " + error);
    }
    
    setModalNovo(false);
    setEditandoId(null);
    setNovoFunc(statePadrao);
    carregar();
  };

  // Desligamento: arquiva (não apaga) — a vida do funcionário fica preservada
  const [modalDeslig, setModalDeslig] = useState(false);
  const [funcDeslig, setFuncDeslig] = useState(null);
  const [desligForm, setDesligForm] = useState({ data: "", tipo: "Pedido de demissão", motivo: "" });
  const abrirDesligamento = (f) => {
    setFuncDeslig(f);
    setDesligForm({ data: new Date().toISOString().split("T")[0], tipo: "Pedido de demissão", motivo: "" });
    setModalDeslig(true);
  };
  const confirmarDesligamento = async (e) => {
    e.preventDefault();
    const { error } = await desligarColaborador(funcDeslig.id, {
      data_desligamento: desligForm.data,
      tipo_desligamento: desligForm.tipo,
      motivo_desligamento: desligForm.motivo,
    });
    if (error) return alert("Erro: " + error);
    setModalDeslig(false);
    carregar();
  };

  const handleRemover = async (id) => {
    if(confirm("Apagar DEFINITIVAMENTE este funcionário e toda a vida dele?\n\nPara manter o histórico, use 'Desligar' — ele vai para o arquivo de ex-funcionários.")) {
      await removerColaborador(id);
      carregar();
    }
  };

  const calcularProgresso = (f) => {
     if (f.tipo_contrato !== "Fixo" || !f.data_admissao) return null;
     const badges = [];
     const dAdm = new Date(f.data_admissao + "T12:00:00Z");
     const hj = new Date();
     hj.setHours(0,0,0,0);
     dAdm.setHours(0,0,0,0);
     
     const diffDias = Math.floor((hj - dAdm) / (1000 * 60 * 60 * 24));
     const anoAtual = hj.getFullYear();
     
     if (f.status_contrato && f.status_contrato.startsWith("Experiência")) {
        const m = f.status_contrato.match(/\d+/);
        if (m) {
           const diasTotal = parseInt(m[0], 10);
           const faltam = diasTotal - diffDias;
           if (faltam > 0) badges.push({ text: `Faltam ${faltam} dias (Experiência)`, color: 'text-amber-700 bg-amber-50 border-amber-200' });
           else badges.push({ text: `Vencido há ${Math.abs(faltam)} dias`, color: 'text-rose-700 bg-rose-50 border-rose-200' });
        }
     } else if (f.status_contrato === "Definitivo") {
        let prox = new Date(dAdm);
        prox.setFullYear(anoAtual);
        if (hj > prox) prox.setFullYear(anoAtual + 1);
        const faltamFerias = Math.floor((prox - hj) / (1000 * 60 * 60 * 24));
        badges.push({ text: `1 Ano em ${faltamFerias} dias`, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' });
     }

     let proxColetiva = new Date(anoAtual, 11, 21);
     if (hj > proxColetiva) proxColetiva.setFullYear(anoAtual + 1);
     const faltamColetiva = Math.floor((proxColetiva - hj) / (1000 * 60 * 60 * 24));
     badges.push({ text: `Coletivas em ${faltamColetiva} dias (21/12)`, color: 'text-teal-700 bg-teal-50 border-teal-200' });

     return badges;
  };

  const handleLancarFinanceiro = async (f) => {
    const isFree = f.tipo_contrato === "Freelancer";
    if (isFree) {
       const totalStr = f.salario ? String(f.salario).replace(',','.') : "0";
       const total = parseFloat(totalStr) || 0;
       
       const inss = total * 0.05;
       const fgts = total * 0.08;
       const taxa = total * 0.10;
       const fixo = total - inss - fgts - taxa;
       
       setFormLancamento({
          total: total.toFixed(2),
          fixo: fixo.toFixed(2),
          inss: inss.toFixed(2),
          fgts: fgts.toFixed(2),
          taxa: taxa.toFixed(2)
       });
       setFuncParaLancamento(f);
       setModalLancamento(true);
    } else {
       const labelLabel = "Salário";
       if(confirm(`Deseja lançar R$ ${f.salario} no Financeiro como ${labelLabel} para o funcionário ${f.nome}?`)) {
          const hoje = new Date().toISOString().split('T')[0];
          await salvarConta({
             unidade_id: unidadeAtiva,
             descricao: `${labelLabel}: ${f.nome} - ${f.cargo}`,
             valor: f.salario,
             data_vencimento: hoje,
             categoria: 'cmo',
             status: 'pago',
             data_pagamento: hoje
          });
          alert("Lançado com sucesso em Contas a Pagar (Financeiro)!");
       }
    }
  };

  const handleTotalLancamentoChange = (newTotalStr) => {
      const valStr = newTotalStr.replace(',','.');
      const total = parseFloat(valStr);
      if(isNaN(total)) {
         setFormLancamento({...formLancamento, total: newTotalStr});
         return;
      }
      const inss = total * 0.05;
      const fgts = total * 0.08;
      const taxa = total * 0.10;
      const fixo = total - inss - fgts - taxa;
      setFormLancamento({
         total: newTotalStr,
         fixo: fixo.toFixed(2),
         inss: inss.toFixed(2),
         fgts: fgts.toFixed(2),
         taxa: taxa.toFixed(2)
      });
  };

  const salvarLancamentoFinanceiro = async () => {
     if(!funcParaLancamento) return;
     const f = funcParaLancamento;
     const hoje = new Date().toISOString().split('T')[0];
     
     const l = [
       { label: "Diária Base", val: parseFloat(formLancamento.fixo) },
       { label: "INSS", val: parseFloat(formLancamento.inss) },
       { label: "FGTS", val: parseFloat(formLancamento.fgts) },
       { label: "Taxa de Serviço", val: parseFloat(formLancamento.taxa) }
     ];
     
     let sucessos = 0;
     for (let item of l) {
        if (item.val && item.val > 0) {
           const { error } = await salvarConta({
              unidade_id: unidadeAtiva,
              descricao: `${item.label} (Extra): ${f.nome} - ${f.cargo}`,
              valor: item.val,
              data_vencimento: hoje,
              categoria: 'cmo',
              status: 'pago',
              data_pagamento: hoje
           });
           if(!error) sucessos++;
        }
     }
     alert(`Desmembramento lançado! ${sucessos} contas criadas no Financeiro.`);
     setModalLancamento(false);
  };

  const acionarUpload = (f) => {
    setFuncParaUpload(f.id);
    fileInputRef.current.click();
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !funcParaUpload) return;

    setUploadingId(funcParaUpload);
    const { error } = await uploadDocumentoRH(funcParaUpload, file);
    setUploadingId(null);
    setFuncParaUpload(null);
    fileInputRef.current.value = ""; 

    if (error) {
       alert(error);
    } else {
       carregar();
    }
  };

  const handleApagarDoc = async (docId, url) => {
     if(confirm("Apagar este documento permanentemente?")) {
        await removerDocumento(docId, url);
        carregar();
     }
  };

  const abrirModalFolgas = async (f) => {
     setFuncParaFolgas(f);
     setModalFolgas(true);
     setNovaFolgaData("");
     
     // Só os PRÓXIMOS domingos (de hoje em diante, 5 semanas à frente) —
     // domingo que já passou some da lista e não pode mais ser agendado.
     const domingos = [];
     const hoje = new Date();
     for (let i = 0; i <= 35 && domingos.length < 5; i++) {
        const d = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i, 12, 0, 0));
        if (d.getUTCDay() === 0) {
           domingos.push({
              data: d.toISOString().split('T')[0],
              label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
           });
        }
     }
     setDomingosProximos(domingos);

     const res = await fetchFolgasEsporadicas(f.id);
     setFolgasEsporadicas(res.data || []);
     
     const resTodas = await fetchAllFolgasDaUnidade(unidadeAtiva);
     setTodasFolgasDaUnidade(resTodas.data || []);
  };
  
  const handleAdicionarFolga = async (dataAdicionar, descricao) => {
     if(!dataAdicionar) return;
     // Data que já passou não vira folga (o dia já aconteceu)
     const hojeISO = new Date().toISOString().split("T")[0];
     if (dataAdicionar < hojeISO) return alert("Essa data já passou — escolha um dia de hoje em diante.");
     const { error } = await inserirFolgaEsporadica(unidadeAtiva, funcParaFolgas.id, dataAdicionar, descricao);
     if (error) {
        alert("Erro ao salvar folga: " + error);
        return;
     }
     setNovaFolgaData("");
     
     const res = await fetchFolgasEsporadicas(funcParaFolgas.id);
     setFolgasEsporadicas(res.data || []);
     const resTodas = await fetchAllFolgasDaUnidade(unidadeAtiva);
     setTodasFolgasDaUnidade(resTodas.data || []);
  };

  const handleRemoverFolga = async (id) => {
     if(confirm("Remover esta folga?")) {
        const { error } = await removerFolgaEsporadica(id);
        if (error) {
           alert("Erro ao remover: " + error);
           return;
        }
        const res = await fetchFolgasEsporadicas(funcParaFolgas.id);
        setFolgasEsporadicas(res.data || []);
        const resTodas = await fetchAllFolgasDaUnidade(unidadeAtiva);
        setTodasFolgasDaUnidade(resTodas.data || []);
     }
  };

  return (
    <div className="min-h-screen font-sans pb-24 text-slate-800">
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadFile} accept=".pdf,.png,.jpg,.jpeg" />
      
      {/* HEADER: título + destaque; barra de ferramentas em linha própria, sem estourar */}
      <div className="pt-5 sm:pt-6 pb-6 px-4 sm:px-6 max-w-5xl mx-auto">
         <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-emerald-600 flex items-center justify-center shadow-inner">
                 <Users size={32} />
              </div>
              <div>
                 <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900">RH & Equipe</h1>
                 <p className="text-slate-700 font-bold uppercase tracking-widest text-xs mt-1">Gestão de Funcionários</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={() => router.push('/dashboard/rh/fechamento')} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-600/20">
                  <ClipboardList size={16} /> Fechar Folha
               </button>
               <button onClick={abrirModalNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20">
                  <UserPlus size={16} /> Contratar
               </button>
            </div>
         </div>

         {/* Ferramentas secundárias: linha própria, compactas, com quebra */}
         <div className="flex items-center gap-2 flex-wrap mt-4">
            <button onClick={lancarFolhaMes} title="Cria uma conta a pagar por funcionário fixo (mão de obra), sem duplicar" className="flex items-center gap-1.5 bg-white text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-colors">
               <CreditCard size={14} /> Lançar Folha (mês)
            </button>
            <button onClick={imprimirFaltasAtrasos} title="Faltas e atrasos dos fixos + extras por dia (mês atual)" className="flex items-center gap-1.5 bg-white text-rose-700 border border-rose-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-rose-50 transition-colors">
               <Clock size={14} /> Faltas e Atrasos
            </button>
            <button onClick={abrirModalFeriados} title="Dias de feriado pagam +100% para quem trabalhar (CLT)" className="flex items-center gap-1.5 bg-white text-rose-600 border border-slate-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-rose-50 transition-colors">
               <CalendarDays size={14} /> Feriados
            </button>
            <button onClick={() => router.push('/dashboard/rh/cardapio-funcionarios')} className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-slate-50 transition-colors">
               <UtensilsCrossed size={14} /> Cardápio Equipe
            </button>
            <a
               href={(!unidadeAtiva || unidadeAtiva === "todas") ? "#" : `/exportar-afd?unidadeId=${unidadeAtiva}`}
               onClick={(e) => { if(!unidadeAtiva || unidadeAtiva === "todas") { e.preventDefault(); alert("Por favor, selecione uma unidade específica no menu lateral esquerdo para exportar o AFD daquela empresa."); } }}
               target={(!unidadeAtiva || unidadeAtiva === "todas") ? "_self" : "_blank"}
               rel="noreferrer"
               className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs transition-colors border ${(!unidadeAtiva || unidadeAtiva === "todas") ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
               <FileText size={14} /> Exportar AFD
            </a>
            {abaAtiva === "Freelancer" && (
               <button onClick={() => abrirModalFicha(null)} className="flex items-center gap-1.5 bg-white text-amber-700 border border-amber-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-amber-50 transition-colors">
                  <Printer size={14} /> Ficha em Branco
               </button>
            )}
         </div>

         {/* ── RESUMO CMO: folha fixa + gasto com extras + % sobre o faturamento ── */}
         {(() => {
            const mes = new Date().toISOString().slice(0, 7);
            const ativos = funcionarios.filter(f => (f.status || "ativo") !== "inativo");
            const fixos = ativos.filter(f => f.tipo_contrato !== "Freelancer");
            const extras = ativos.filter(f => f.tipo_contrato === "Freelancer");
            // Remuneração cheia: fixo + vale alimentação + taxa de serviço
            const folhaFixa = fixos.reduce((s, f) => s + (Number(f.salario) || 0) + (Number(f.vale_alimentacao) || 0) + (Number(f.taxa_servico_mes) || 0), 0);
            // Extras: diária × dias efetivamente trabalhados no mês (pelo ponto)
            const gastoExtras = extras.reduce((s, f) => {
               const dias = new Set(pontosMesUnidade.filter(p => p.colaborador_id === f.id).map(p => p.data_referencia)).size;
               return s + dias * (Number(f.salario) || 0);
            }, 0);
            const total = folhaFixa + gastoExtras;
            const fat = lancamentos
               .filter(l => l.tipo === "entrada" && String(l.data || "").slice(0, 7) === mes)
               .reduce((s, l) => s + (Number(l.valor) || 0), 0);
            // Fica EM BRANCO até o faturamento do mês ser lançado de verdade
            // (abaixo de R$ 1.000 trata como ainda não informado — evita %
            // absurdo com lançamentos de teste). Ao lançar, o % aparece sozinho.
            const FAT_MINIMO = paramsSis.faturamento_minimo_cmo;
            const pct = fat >= FAT_MINIMO ? (total / fat) * 100 : null;
            if (!ativos.length) return null;
            return (
               <div className="mt-4 bg-slate-900 text-white rounded-2xl px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Folha fixa (mês)</p>
                     <p className="text-lg font-black">{fmtBRL(folhaFixa)}</p>
                     <p className="text-[10px] font-bold text-slate-500">{fixos.length} fixo(s) · salário + VA + taxa</p>
                  </div>
                  <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Gasto com extras (mês)</p>
                     <p className="text-lg font-black text-amber-400">{fmtBRL(gastoExtras)}</p>
                     <p className="text-[10px] font-bold text-slate-500">{extras.length} extra(s) · diária × dias batidos</p>
                  </div>
                  <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">CMO total</p>
                     <p className="text-lg font-black text-emerald-400">{fmtBRL(total)}</p>
                     <p className="text-[10px] font-bold text-slate-500">folha + extras</p>
                  </div>
                  <div>
                     <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">CMO % do faturamento</p>
                     <p className={`text-lg font-black ${pct === null ? "text-slate-500" : pct <= 30 ? "text-emerald-400" : pct <= 40 ? "text-amber-400" : "text-red-400"}`}>{pct === null ? "—" : `${pct.toFixed(1)}%`}</p>
                     <p className="text-[10px] font-bold text-slate-500">{pct === null ? "aparece ao lançar o faturamento do mês" : `faturamento ${fmtBRL(fat)}`}</p>
                  </div>
               </div>
            );
         })()}

         {(() => {
            const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
            const alertas = [];
            funcionarios.filter(f => !ehInativo(f) && f.tipo_contrato !== "Freelancer").forEach(f => {
               if (!f.data_admissao) {
                  alertas.push({ id: f.id, nome: f.nome, texto: "Sem data de admissão", nivel: "erro" });
                  return;
               }
               const adm = new Date(`${f.data_admissao}T12:00:00`); adm.setHours(0, 0, 0, 0);
               const diasDesdeAdmissao = Math.floor((hoje - adm) / 86400000);
               if (f.status_contrato?.startsWith("Experiência")) {
                  const prazo = Number(f.status_contrato.match(/\d+/)?.[0] || 90);
                  const faltam = prazo - diasDesdeAdmissao;
                  if (faltam <= 15) alertas.push({ id: f.id, nome: f.nome, texto: faltam < 0 ? `Experiência vencida há ${Math.abs(faltam)} dia(s)` : `Experiência termina em ${faltam} dia(s)`, nivel: faltam < 0 ? "erro" : "aviso" });
               } else {
                  const aniversario = new Date(adm); aniversario.setFullYear(hoje.getFullYear());
                  if (aniversario < hoje) aniversario.setFullYear(hoje.getFullYear() + 1);
                  const faltam = Math.floor((aniversario - hoje) / 86400000);
                  if (faltam <= 45) alertas.push({ id: f.id, nome: f.nome, texto: `Aniversário de admissão em ${faltam} dia(s) — revisar férias`, nivel: "info" });
               }
            });
            if (!alertas.length) return null;
            const cores = { erro: "bg-rose-50 border-rose-200 text-rose-700", aviso: "bg-amber-50 border-amber-200 text-amber-700", info: "bg-indigo-50 border-indigo-200 text-indigo-700" };
            return <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
               <div className="flex items-center justify-between mb-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Central de prazos</p><h3 className="font-black text-slate-800">Experiência, admissão e revisão de férias</h3></div><span className="text-xs font-black bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full">{alertas.length}</span></div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{alertas.slice(0, 8).map(a => <div key={`${a.id}-${a.texto}`} className={`border rounded-xl px-3 py-2 ${cores[a.nivel]}`}><p className="text-xs font-black">{a.nome}</p><p className="text-[10px] font-bold mt-0.5">{a.texto}</p></div>)}</div>
               {alertas.length > 8 && <p className="text-[10px] font-bold text-slate-400 mt-2">Mais {alertas.length - 8} alerta(s) nos cadastros abaixo.</p>}
               <p className="text-[9px] font-medium text-slate-400 mt-3">Avisos operacionais para conferência do RH. A concessão de férias e decisões contratuais devem ser validadas pelo responsável e pela contabilidade.</p>
            </div>;
         })()}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
         
         <div className="flex gap-4 mb-4">
            <button onClick={()=>setAbaAtiva("Fixo")} className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${abaAtiva === "Fixo" ? "bg-slate-800 text-white shadow-lg shadow-slate-800/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>Equipe Fixa</button>
            <button onClick={()=>setAbaAtiva("Freelancer")} className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${abaAtiva === "Freelancer" ? "bg-slate-800 text-white shadow-lg shadow-slate-800/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>Freelancers Extras</button>
            <button onClick={()=>setAbaAtiva("Banco de Talentos")} className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${abaAtiva === "Banco de Talentos" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-white text-indigo-500 border border-indigo-200 hover:bg-indigo-50"}`}>Banco de Talentos</button>
            <button onClick={()=>setAbaAtiva("Ex-funcionários")} className={`flex-1 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${abaAtiva === "Ex-funcionários" ? "bg-slate-600 text-white shadow-lg shadow-slate-600/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>Ex-funcionários</button>
         </div>

         {abaAtiva === "Banco de Talentos" ? (
            <BancoTalentos unidadeAtiva={unidadeAtiva} />
         ) : (
            <>
               <div className="bg-white p-4 rounded-t-3xl border border-slate-200 border-b-0 flex items-center gap-3">
                  <Search size={18} className="text-slate-500" />
                  <input type="text" placeholder="Buscar funcionário..." value={busca} onChange={e=>setBusca(e.target.value)} className="flex-1 outline-none font-medium text-slate-700" />
               </div>

               <div className="bg-white rounded-b-3xl border border-slate-200 border-t-0 shadow-sm p-3 sm:p-4">
                  {loading ? (
                     <p className="p-10 text-center text-slate-500 font-bold">Carregando...</p>
                  ) : filtrados.length === 0 ? (
                     <p className="p-10 text-center text-slate-500 font-bold">Nenhum funcionário cadastrado.</p>
                  ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtrados.map(f => {
                     const ehFreela = f.tipo_contrato === "Freelancer";
                     const p = ehFreela ? null : previsaoDe(f);
                     const pontoBadge = (() => {
                        const pt = pontosHoje.find(x => x.colaborador_id === f.id);
                        const strToMin = (s) => { if (!s) return null; const [h, m] = s.split(':').map(Number); return h * 60 + m; };
                        const dateToMin = (d) => { if (!d) return null; const x = new Date(d); return x.getHours() * 60 + x.getMinutes(); };
                        const minToStr = (m) => { if (m < 0) m += 1440; const hh = Math.floor(m / 60), mm = m % 60; return hh === 0 ? `${mm}min` : `${hh}h${String(mm).padStart(2, '0')}`; };
                        const cls = (c) => `text-[11px] font-bold px-2.5 py-1 rounded-md border ${c}`;
                        if (!pt) {
                           if (f.horario_entrada && f.dias_trabalho && f.dias_trabalho.split(',').includes(new Date().getDay().toString())) {
                              const minAgora = new Date().getHours() * 60 + new Date().getMinutes();
                              if (minAgora > strToMin(f.horario_entrada)) return <span className={cls("text-rose-700 bg-rose-100 border-rose-200")}>Atrasado (Era p/ {f.horario_entrada})</span>;
                           }
                           return <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">Não iniciou</span>;
                        }
                        const hrEntrada = new Date(pt.hora_entrada).toLocaleTimeString('pt-BR').slice(0, 5);
                        if (pt.status_jornada === 1) {
                           let extra = "";
                           if (f.horario_entrada) { const mPt = dateToMin(pt.hora_entrada), mAg = strToMin(f.horario_entrada); extra = mPt > mAg + 5 ? ` (Era p/ ${f.horario_entrada})` : ` (No horário)`; }
                           const atrasado = extra.includes("Era p/");
                           return <span className={cls(atrasado ? "text-rose-700 bg-rose-100 border-rose-200" : "text-emerald-700 bg-emerald-100 border-emerald-200")}>Entrou {hrEntrada}{extra}</span>;
                        }
                        if (pt.status_jornada === 2) return <span className={cls("text-amber-700 bg-amber-100 border-amber-200")}>No intervalo: {new Date(pt.hora_saida_intervalo).toLocaleTimeString('pt-BR').slice(0, 5)}</span>;
                        if (pt.status_jornada === 3) {
                           const hrVolta = new Date(pt.hora_retorno_intervalo).toLocaleTimeString('pt-BR').slice(0, 5);
                           const minSaida = dateToMin(pt.hora_saida_intervalo); let minVolta = dateToMin(pt.hora_retorno_intervalo); if (minVolta < minSaida) minVolta += 1440;
                           const duracao = minVolta - minSaida, limite = f.tempo_intervalo || 60;
                           if (duracao > limite) return <span className={cls("text-rose-700 bg-rose-100 border-rose-200")}>Voltou {hrVolta} (Tirou {minToStr(duracao)}/{minToStr(limite)})</span>;
                           return <span className={cls("text-emerald-700 bg-emerald-100 border-emerald-200")}>Voltou {hrVolta} (OK)</span>;
                        }
                        if (pt.status_jornada === 4) return <span className={cls("text-blue-700 bg-blue-100 border-blue-200")}>Concluído: saiu {new Date(pt.hora_saida).toLocaleTimeString('pt-BR').slice(0, 5)}</span>;
                        return <span className="text-[11px] font-bold text-slate-400">--</span>;
                     })();
                     const tb = totalBancoDe(f.id);
                     return (
                        <div key={f.id} onClick={() => abrirModalEdicao(f)}
                           className="text-left rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all p-3 cursor-pointer flex flex-col gap-2.5">
                           <div className="flex items-center gap-3">
                              {f.foto
                                 ? <img src={`data:image/jpeg;base64,${f.foto}`} alt={f.nome} className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0" />
                                 : <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 shrink-0">{(f.nome || "?")[0].toUpperCase()}</div>}
                              <div className="min-w-0 flex-1">
                                 <p className="font-black text-slate-800 truncate">{f.nome}</p>
                                 <p className="text-xs font-bold text-slate-500 truncate">{f.cargo || "—"}</p>
                                 {ehFreela && (
                                    <div className="flex text-amber-400 mt-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={11} className={i < (f.avaliacao_estrelas || 0) ? "fill-amber-400" : "text-slate-200"} />)}</div>
                                 )}
                              </div>
                              {ehInativo(f) && <span className="text-[9px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 shrink-0">{f.tipo_desligamento || "Desligado"}</span>}
                           </div>
                           {(f.telefone || f.chave_pix) && (
                              <div className="text-[11px] font-semibold text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                                 {f.telefone && <span className="flex items-center gap-1"><Phone size={10} /> {f.telefone}</span>}
                                 {f.chave_pix && <span className="flex items-center gap-1"><CreditCard size={10} /> {f.chave_pix}</span>}
                              </div>
                           )}
                           <div>{pontoBadge}</div>
                           <div>
                              {ehFreela ? (
                                 <div className="font-black text-emerald-700">{fmtBRL(f.salario)} <span className="text-[10px] font-bold text-slate-400">/ diária</span></div>
                              ) : (
                                 <>
                                    <div className="font-black text-emerald-700">{fmtBRL(p.previsto)}</div>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                       {p.descontos > 0 && <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">Vales: {fmtBRL(p.descontos)}</span>}
                                       {p.ad.valorExtra > 0 && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">Extra: {fmtBRL(p.ad.valorExtra)}</span>}
                                       {Number(f.vale_alimentacao) > 0 && <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 rounded px-1.5 py-0.5">VA: {fmtBRL(f.vale_alimentacao)}</span>}
                                       {Number(f.taxa_servico_mes) > 0 && <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">Taxa: {fmtBRL(f.taxa_servico_mes)}</span>}
                                    </div>
                                 </>
                              )}
                           </div>
                           <div className="flex items-center justify-between gap-2 mt-auto pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                 {f.docs?.length > 0
                                    ? <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md flex items-center gap-1"><FileText size={10} /> {f.docs.length}</span>
                                    : <span className="text-[10px] text-slate-400">Sem docs</span>}
                                 {tb >= BANCO_ALERTA_MIN && (
                                    <button onClick={() => abrirModalBanco(f)} className={`text-[10px] font-black px-2 py-1 rounded-md flex items-center gap-1 ${tb >= BANCO_LIMITE_MIN ? "text-red-700 bg-red-100" : "text-amber-700 bg-amber-100"}`}>
                                       <Clock size={10} /> {fmtMin(tb)}{tb >= BANCO_LIMITE_MIN ? "!" : ""}
                                    </button>
                                 )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                 <button onClick={() => abrirModalEdicao(f)} className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50">Editar</button>
                                 <button onClick={() => setMenuAcoes(f)} className="flex items-center gap-1 text-xs font-black text-white bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-900">Ações <ChevronDown size={12} /></button>
                              </div>
                           </div>
                        </div>
                     );
                  })}
                  </div>
                  )}
               </div>
         </>
         )}

      </div>

      {/* MENU DE AÇÕES DO FUNCIONÁRIO — tudo organizado por grupo */}
      {menuAcoes && (() => {
         const f = menuAcoes;
         const fechar = () => setMenuAcoes(null);
         const ir = (fn) => { fechar(); fn(); };
         const tb = totalBancoDe(f.id);
         const critico = tb >= BANCO_LIMITE_MIN, alerta = tb >= BANCO_ALERTA_MIN;
         const Acao = ({ icon: Icon, cor = "text-slate-700", bg = "bg-slate-50 hover:bg-slate-100", onClick, children, extra }) => (
            <button onClick={onClick} className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl font-bold text-sm text-left transition-colors ${bg} ${cor}`}>
               <Icon size={16} className="shrink-0" /> <span className="flex-1">{children}</span> {extra}
            </button>
         );
         const Grupo = ({ titulo, children }) => (
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 px-1">{titulo}</p>
               <div className="space-y-1.5">{children}</div>
            </div>
         );
         return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={fechar}>
            <div className="bg-white rounded-[28px] w-full max-w-md max-h-[88vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="flex items-center justify-between mb-4">
                  <div className="min-w-0">
                     <h2 className="font-black text-xl text-slate-800 truncate">{f.nome}</h2>
                     <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{f.cargo || "—"}</p>
                  </div>
                  <button onClick={fechar} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 shrink-0"><X size={17}/></button>
               </div>

               <div className="space-y-4">
                  <Grupo titulo="Ponto e Jornada">
                     <Acao icon={Clock} onClick={() => ir(() => router.push(`/dashboard/rh/espelho/${f.id}?mes=${new Date().toISOString().slice(0,7)}`))}>Espelho de Ponto</Acao>
                     <Acao icon={Clock} cor={critico ? "text-red-700" : alerta ? "text-amber-700" : "text-sky-700"} bg={critico ? "bg-red-50 hover:bg-red-100" : alerta ? "bg-amber-50 hover:bg-amber-100" : "bg-sky-50 hover:bg-sky-100"}
                        onClick={() => ir(() => abrirModalBanco(f))}
                        extra={tb > 0 && <span className="text-xs font-black">{fmtMin(tb)}{critico ? " LIMITE!" : ""}</span>}>
                        Banco de Horas
                     </Acao>
                     <Acao icon={CalendarHeart} cor="text-rose-600" bg="bg-rose-50 hover:bg-rose-100" onClick={() => ir(() => abrirModalFolgas(f))}>Folgas</Acao>
                  </Grupo>

                  <Grupo titulo="Financeiro">
                     <Acao icon={ShoppingBag} cor="text-teal-700" bg="bg-teal-50 hover:bg-teal-100" onClick={() => ir(() => abrirModalConsumo(f))}>Consumo / Vales</Acao>
                     <Acao icon={CreditCard} cor="text-emerald-700" bg="bg-emerald-50 hover:bg-emerald-100" onClick={() => ir(() => handleLancarFinanceiro(f))}>Lançar {f.tipo_contrato === "Freelancer" ? "Diária" : "Salário"}</Acao>
                  </Grupo>

                  <Grupo titulo="Documentos">
                     <Acao icon={FileText} onClick={() => ir(() => router.push(`/dashboard/rh/contrato/${f.id}`))}>Regulamento</Acao>
                     {f.tipo_contrato === "Freelancer" && (
                        <Acao icon={Printer} cor="text-amber-700" bg="bg-amber-50 hover:bg-amber-100" onClick={() => ir(() => abrirModalFicha(f))}>Ficha Controle</Acao>
                     )}
                     <Acao icon={Upload} onClick={() => ir(() => acionarUpload(f))}>Anexar Documento</Acao>
                     {(f.docs || []).map(d => (
                        <div key={d.id} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50">
                           <a href={d.url_arquivo} target="_blank" rel="noreferrer" className="flex-1 flex items-center gap-2 text-xs font-bold text-emerald-700 hover:underline min-w-0">
                              <FileText size={13} className="shrink-0"/> <span className="truncate">{d.nome_arquivo}</span>
                           </a>
                           <button onClick={() => handleApagarDoc(d.id, d.url_arquivo)} className="text-slate-400 hover:text-red-500 shrink-0"><X size={14}/></button>
                        </div>
                     ))}
                  </Grupo>

                  <Grupo titulo="Gestão e Disciplina">
                     <Acao icon={FileText} cor="text-red-600" bg="bg-red-50 hover:bg-red-100" onClick={() => ir(() => abrirModalAdv(f))}>Advertências</Acao>
                     {abaAtiva !== "Ex-funcionários" && (
                        <Acao icon={LogOut} cor="text-orange-600" bg="bg-orange-50 hover:bg-orange-100" onClick={() => ir(() => abrirDesligamento(f))}>Desligar (arquiva com histórico)</Acao>
                     )}
                     <Acao icon={Trash2} cor="text-slate-500" onClick={() => ir(() => handleRemover(f.id))}>Apagar definitivamente</Acao>
                  </Grupo>
               </div>
            </div>
         </div>
         );
      })()}

      {/* Modal Adicionar/Editar Funcionário */}
      {modalNovo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] overflow-hidden">
               <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-4">
                  <h2 className="font-black text-2xl text-slate-800">{editandoId ? "Editar Colaborador" : "Novo Funcionário"}</h2>
                  <button onClick={() => setModalNovo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="space-y-4 flex-1 overflow-y-auto pr-2 pb-4 custom-scrollbar">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo de Contrato</label>
                        <select value={novoFunc.tipo_contrato} onChange={e=>setNovoFunc({...novoFunc, tipo_contrato: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-700 appearance-none">
                           <option value="Fixo">Equipe Fixa (CLT/Mensalista)</option>
                           <option value="Freelancer">Freelancer / Extra (Diária)</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
                        <div className="flex items-center gap-3 mt-1">
                           {/* Foto do colaborador (aparece no ponto, organograma e portal) */}
                           <div className="relative shrink-0">
                              <button type="button" onClick={() => fotoInputRef.current?.click()} title="Adicionar/trocar foto"
                                 className="w-14 h-14 rounded-full overflow-hidden border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center hover:border-emerald-400">
                                 {novoFunc.foto
                                    ? <img src={`data:image/jpeg;base64,${novoFunc.foto}`} alt="Foto" className="w-full h-full object-cover" />
                                    : <Camera size={18} className="text-slate-400" />}
                              </button>
                              {novoFunc.foto && (
                                 <button type="button" onClick={() => setNovoFunc({ ...novoFunc, foto: "" })} title="Remover foto"
                                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs">×</button>
                              )}
                              <input ref={fotoInputRef} type="file" accept="image/*" onChange={escolherFotoColab} className="hidden" />
                           </div>
                           <input type="text" value={novoFunc.nome} onChange={e=>setNovoFunc({...novoFunc, nome: e.target.value})} className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                     </div>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Função / Cargo</label>
                     <select value={novoFunc.cargo} onChange={e=>setNovoFunc({...novoFunc, cargo: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 appearance-none text-slate-700">
                        <option value="">Selecione um Cargo</option>
                        <optgroup label="Liderança">
                           {CARGOS_LIDERANCA.map(c => <option key={c} value={c}>{c}</option>)}
                        </optgroup>
                        {cargos.length > 0 && (
                           <optgroup label="Cargos da unidade">
                              {cargos.filter(c => !CARGOS_LIDERANCA.includes(c.nome)).map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                           </optgroup>
                        )}
                        {novoFunc.cargo && ![...CARGOS_LIDERANCA, ...cargos.map(c => c.nome)].includes(novoFunc.cargo) && <option value={novoFunc.cargo}>{novoFunc.cargo}</option>}
                     </select>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Supervisor(es) diretos — organograma</label>
                     <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-32 overflow-y-auto space-y-1">
                        {funcionarios.filter(f => f.id !== editandoId && (f.status || "ativo") !== "inativo").length === 0 ? (
                           <p className="text-xs font-medium text-slate-400">Nenhum outro colaborador cadastrado ainda.</p>
                        ) : funcionarios.filter(f => f.id !== editandoId && (f.status || "ativo") !== "inativo").map(f => {
                           const marcado = (novoFunc.supervisores_ids || []).includes(f.id);
                           return (
                              <label key={f.id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer ${marcado ? "bg-emerald-100" : "hover:bg-slate-100"}`}>
                                 <input type="checkbox" checked={marcado} onChange={e=>{
                                    const atual = novoFunc.supervisores_ids || [];
                                    setNovoFunc({...novoFunc, supervisores_ids: e.target.checked ? [...atual, f.id] : atual.filter(x => x !== f.id)});
                                 }} className="w-4 h-4 accent-emerald-600"/>
                                 <span className="text-sm font-bold text-slate-700">{f.nome}</span>
                                 <span className="text-[10px] font-medium text-slate-400 ml-auto">{f.cargo || "—"}</span>
                              </label>
                           );
                        })}
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium mt-1">Pode marcar mais de um. Sem supervisor = topo da hierarquia no Organograma.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Telefone / WhatsApp</label>
                        <input type="text" value={novoFunc.telefone} onChange={e=>setNovoFunc({...novoFunc, telefone: e.target.value})} placeholder="(00) 00000-0000" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">CPF</label>
                        <input type="text" value={novoFunc.cpf} onChange={e=>setNovoFunc({...novoFunc, cpf: e.target.value})} placeholder="000.000.000-00" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>

                  {/* ── DADOS PESSOAIS ─────────────────────────────────────── */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
                     <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Dados Pessoais</p>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="col-span-2">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Endereço</label>
                           <input type="text" value={novoFunc.endereco} onChange={e=>setNovoFunc({...novoFunc, endereco: e.target.value})} placeholder="Rua, número, bairro" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CEP</label>
                           <input type="text" value={novoFunc.cep} onChange={e=>setNovoFunc({...novoFunc, cep: e.target.value})} placeholder="00000-000" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Data de Nascimento</label>
                           <input type="date" value={novoFunc.data_nascimento || ""} onChange={e=>setNovoFunc({...novoFunc, data_nascimento: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                           {novoFunc.data_nascimento && (() => {
                              const n = new Date(novoFunc.data_nascimento + "T12:00:00");
                              const hoje = new Date();
                              let idade = hoje.getFullYear() - n.getFullYear();
                              if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) idade--;
                              return <p className="text-[10px] font-black text-emerald-600 mt-1">{idade} anos</p>;
                           })()}
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cidade de Nascimento</label>
                           <input type="text" value={novoFunc.cidade_nascimento} onChange={e=>setNovoFunc({...novoFunc, cidade_nascimento: e.target.value})} placeholder="Ex: Belém - PA" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gênero</label>
                           <select value={novoFunc.genero} onChange={e=>setNovoFunc({...novoFunc, genero: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500">
                              <option value="">Selecione...</option>
                              <option value="Feminino">Feminino</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Outro">Outro</option>
                              <option value="Prefere não dizer">Prefere não dizer</option>
                           </select>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Escolaridade</label>
                           <select value={novoFunc.escolaridade} onChange={e=>setNovoFunc({...novoFunc, escolaridade: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500">
                              <option value="">Selecione...</option>
                              <option value="Fundamental incompleto">Fundamental incompleto</option>
                              <option value="Fundamental completo">Fundamental completo</option>
                              <option value="Médio incompleto">Médio incompleto</option>
                              <option value="Médio completo">Médio completo</option>
                              <option value="Superior incompleto">Superior incompleto</option>
                              <option value="Superior completo">Superior completo</option>
                              <option value="Pós-graduação">Pós-graduação</option>
                           </select>
                        </div>
                        <div className="flex flex-col justify-end gap-2">
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={novoFunc.tem_filhos} onChange={e=>setNovoFunc({...novoFunc, tem_filhos: e.target.checked})} className="w-4 h-4 accent-emerald-600"/>
                              <span className="text-xs font-bold text-slate-600">Possui filhos</span>
                           </label>
                           {novoFunc.tem_filhos && (
                              <input type="number" min="1" value={novoFunc.qtd_filhos} onChange={e=>setNovoFunc({...novoFunc, qtd_filhos: e.target.value})} placeholder="Quantos?" className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-medium text-sm outline-none focus:border-emerald-500"/>
                           )}
                        </div>
                     </div>
                     <div className="flex flex-wrap gap-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={novoFunc.tem_transporte} onChange={e=>setNovoFunc({...novoFunc, tem_transporte: e.target.checked})} className="w-4 h-4 accent-emerald-600"/>
                           <span className="text-xs font-bold text-slate-600">Possui transporte próprio</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={novoFunc.usa_vale_transporte} onChange={e=>setNovoFunc({...novoFunc, usa_vale_transporte: e.target.checked})} className="w-4 h-4 accent-emerald-600"/>
                           <span className="text-xs font-bold text-slate-600">Usa vale transporte</span>
                        </label>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chave PIX</label>
                        <input type="text" value={novoFunc.chave_pix} onChange={e=>setNovoFunc({...novoFunc, chave_pix: e.target.value})} placeholder="Chave para pagamento" className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{novoFunc.tipo_contrato === "Freelancer" ? "Valor da Diária Base (R$)" : "Salário Fixo (R$)"}</label>
                        <input type="number" value={novoFunc.salario} onChange={e=>setNovoFunc({...novoFunc, salario: e.target.value})} className="w-full p-4 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-600 outline-none focus:border-emerald-500"/>
                     </div>
                  </div>

                  {novoFunc.tipo_contrato !== "Freelancer" && (
                     <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-3">Composição da remuneração (além do fixo)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vale Alimentação (R$/mês)</label>
                              <input type="number" min="0" step="0.01" placeholder="0,00" value={novoFunc.vale_alimentacao} onChange={e=>setNovoFunc({...novoFunc, vale_alimentacao: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Taxa de Serviço do mês (R$)</label>
                              <input type="number" min="0" step="0.01" placeholder="0,00" value={novoFunc.taxa_servico_mes} onChange={e=>setNovoFunc({...novoFunc, taxa_servico_mes: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                              <p className="text-[10px] text-slate-400 font-medium mt-1">Varia com as vendas — atualize no fim do mês, antes de lançar a folha.</p>
                           </div>
                        </div>
                        <p className="text-[10px] font-medium text-emerald-700/70 mt-3">Adicional noturno (20% após 23h30) e hora extra (+50% após 00h00) são calculados automaticamente pelo ponto, nos moldes da CLT (hora normal = salário ÷ 220).</p>
                     </div>
                  )}

                  {novoFunc.tipo_contrato === "Fixo" && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-4 bg-indigo-50/30 p-4 rounded-2xl">
                        <div>
                           <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-1">Data de Admissão</label>
                           <input type="date" value={novoFunc.data_admissao || ""} onChange={e=>setNovoFunc({...novoFunc, data_admissao: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-700"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-1">Fase do Contrato</label>
                           <select value={novoFunc.status_contrato} onChange={e=>setNovoFunc({...novoFunc, status_contrato: e.target.value})} className="w-full p-4 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-indigo-500 text-slate-700 appearance-none">
                              <option value="Experiência (30 dias)">Experiência (30 dias)</option>
                              <option value="Experiência (45 dias)">Experiência (45 dias)</option>
                              <option value="Experiência (90 dias)">Experiência (90 dias)</option>
                              <option value="Definitivo">Contrato Definitivo</option>
                           </select>
                        </div>
                     </div>
                  )}

                  <div className="border-t border-slate-100 pt-4 mt-4">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Horário — dias normais (seg a sáb)</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Entrada</label>
                           <input type="time" value={novoFunc.horario_entrada || ""} onChange={e=>setNovoFunc({...novoFunc, horario_entrada: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Saída</label>
                           <input type="time" value={novoFunc.horario_saida || ""} onChange={e=>setNovoFunc({...novoFunc, horario_saida: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                     </div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 mt-3">Horário de domingo <span className="normal-case font-medium text-slate-400">(deixe vazio se for igual)</span></p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Entrada (dom)</label>
                           <input type="time" value={novoFunc.horario_dom_entrada || ""} onChange={e=>setNovoFunc({...novoFunc, horario_dom_entrada: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Saída (dom)</label>
                           <input type="time" value={novoFunc.horario_dom_saida || ""} onChange={e=>setNovoFunc({...novoFunc, horario_dom_saida: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                     </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Dias Trabalho</label>
                        <div className="flex flex-wrap gap-1">
                           {[ {v:'0',l:'D'},{v:'1',l:'S'},{v:'2',l:'T'},{v:'3',l:'Q'},{v:'4',l:'Q'},{v:'5',l:'S'},{v:'6',l:'S'} ].map(dia => {
                              const selecionados = novoFunc.dias_trabalho ? novoFunc.dias_trabalho.split(',') : [];
                              const ativo = selecionados.includes(dia.v);
                              return (
                                 <button key={dia.v} type="button" onClick={() => {
                                    let novos = [...selecionados];
                                    if(ativo) novos = novos.filter(d => d !== dia.v);
                                    else novos.push(dia.v);
                                    setNovoFunc({...novoFunc, dias_trabalho: novos.sort().join(',')});
                                 }} className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${ativo ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                                    {dia.l}
                                 </button>
                              );
                           })}
                        </div>
                        {/* Valor por dia trabalhado: (fixo + VA + taxa) / (dias por semana × 4,345) */}
                        {(() => {
                           const nDias = (novoFunc.dias_trabalho || "").split(",").filter(Boolean).length;
                           const sal = (Number(novoFunc.salario) || 0) + (Number(novoFunc.vale_alimentacao) || 0) + (Number(novoFunc.taxa_servico_mes) || 0);
                           if (!nDias || !sal || novoFunc.tipo_contrato === "Freelancer") return null;
                           const diasMes = nDias * 4.345;
                           return (
                              <p className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5 mt-2 inline-block">
                                 {fmtBRL(sal / diasMes)} por dia trabalhado
                                 <span className="text-emerald-600/70 font-bold"> · fixo + VA + taxa · {nDias} dia(s)/semana ≈ {Math.round(diasMes)} dias/mês</span>
                              </p>
                           );
                        })()}
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intervalo (Minutos)</label>
                        <input type="number" value={novoFunc.tempo_intervalo || ""} onChange={e=>setNovoFunc({...novoFunc, tempo_intervalo: e.target.value})} placeholder="Ex: 60" className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 mt-4">
                     {novoFunc.tipo_contrato === "Freelancer" && (
                        <div className="mb-4">
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Avaliação do Freelancer (Estrelas)</label>
                           <div className="flex gap-2">
                              {[1,2,3,4,5].map(star => (
                                 <button key={star} type="button" onClick={() => setNovoFunc({...novoFunc, avaliacao_estrelas: star})} className={`p-2 rounded-lg transition-colors ${novoFunc.avaliacao_estrelas >= star ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}>
                                    <Star size={24} className={novoFunc.avaliacao_estrelas >= star ? 'fill-amber-500' : ''} />
                                 </button>
                              ))}
                           </div>
                        </div>
                     )}
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Anotações / Ocorrências (Oculto para o funcionário)</label>
                        <textarea value={novoFunc.anotacoes_rh} onChange={e=>setNovoFunc({...novoFunc, anotacoes_rh: e.target.value})} rows="3" placeholder="Registre advertências, faltas não justificadas, comportamento, etc..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500 text-slate-700 resize-none"></textarea>
                     </div>
                  </div>
               </div>

               <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
                  <button onClick={handleSalvar} disabled={!novoFunc.nome} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                     {editandoId ? "Salvar Alterações" : "Salvar Colaborador"}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Modal Gerenciar Folgas */}
      {/* MODAL: PREPARAR FICHA DE EXTRA (valor pago + itens emprestados) */}
      {modalFicha && (() => {
         const total = parseFloat(String(fichaValor).replace(",", ".")) || 0;
         const inss = total * 0.05, fgts = total * 0.08, taxa = total * 0.10;
         const fixo = total - inss - fgts - taxa;
         const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
         return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-lg my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[94vh] sm:max-h-[88vh] overflow-y-auto">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Preparar Ficha de Extra</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">{fichaFunc ? fichaFunc.nome : "Ficha em branco (extra não cadastrado)"}</p>
                  </div>
                  <button onClick={() => setModalFicha(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* Valor pago -> desmembramento automático */}
               <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block mb-1">Valor pago da diária (R$)</label>
                  <input type="number" min="0" step="0.01" value={fichaValor} onChange={e=>setFichaValor(e.target.value)} placeholder="Ex: 150,00"
                     className="w-full p-3.5 bg-white border-2 border-emerald-300 rounded-xl font-black text-2xl text-emerald-700 outline-none focus:border-emerald-500"/>
                  {total > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs font-bold text-slate-600">
                        <span>Valor Fixo: <b className="text-slate-800">{fmt(fixo)}</b></span>
                        <span>INSS (5%): <b className="text-slate-800">{fmt(inss)}</b></span>
                        <span>FGTS (8%): <b className="text-slate-800">{fmt(fgts)}</b></span>
                        <span>Taxa de Serviço (10%): <b className="text-slate-800">{fmt(taxa)}</b></span>
                        <span className="col-span-2 pt-1 border-t border-emerald-200">Sai impresso já desmembrado na ficha.</span>
                     </div>
                  ) : (
                     <p className="text-[10px] font-medium text-emerald-700/70 mt-2">Sem valor, o acerto sai em branco para preencher à mão.</p>
                  )}
               </div>

               {/* Itens emprestados: escolhe na hora */}
               <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Itens que a empresa vai emprestar (só os marcados saem na ficha)</p>
                  <div className="space-y-1.5 mb-3">
                     {fichaItens.map((it, idx) => (
                        <label key={idx} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border ${it.incluir ? "bg-white border-emerald-200" : "bg-slate-100 border-slate-200 opacity-60"}`}>
                           <input type="checkbox" checked={it.incluir} onChange={e=>setFichaItens(lista => lista.map((x, i) => i === idx ? { ...x, incluir: e.target.checked } : x))} className="w-4 h-4 accent-emerald-600"/>
                           <span className="text-sm font-bold text-slate-700 flex-1">{it.nome}</span>
                        </label>
                     ))}
                  </div>
                  <div className="flex gap-2">
                     <input type="text" value={fichaNovoItem} onChange={e=>setFichaNovoItem(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addItemFicha(); } }} placeholder="Adicionar outro item (ex: Faca do chef, Touca...)"
                        className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-medium text-sm outline-none focus:border-emerald-500"/>
                     <button type="button" onClick={addItemFicha} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-sm rounded-xl">+ Add</button>
                  </div>
               </div>

               <button onClick={imprimirFichaPreparada} className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black text-lg rounded-2xl transition-all active:scale-95 shadow-xl shadow-amber-600/20 flex items-center justify-center gap-2">
                  <Printer size={20}/> Imprimir Ficha
               </button>
            </div>
         </div>
         );
      })()}

      {/* MODAL: FERIADOS da unidade (dias que pagam +100% p/ quem trabalhar) */}
      {modalFeriados && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-md my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[94vh] sm:max-h-[85vh] flex flex-col">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Feriados</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">Quem trabalhar nesses dias recebe +100% (dobro, CLT)</p>
                  </div>
                  <button onClick={() => setModalFeriados(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <form onSubmit={salvarFeriado} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-4 shrink-0 space-y-3">
                  <div className="flex gap-3">
                     <input type="date" value={feriadoForm.data} onChange={e=>setFeriadoForm({...feriadoForm, data: e.target.value})} className="p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-rose-400"/>
                     <input type="text" placeholder="Nome (ex: Natal)" value={feriadoForm.nome} onChange={e=>setFeriadoForm({...feriadoForm, nome: e.target.value})} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-rose-400"/>
                  </div>
                  <button type="submit" className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl transition-colors">Adicionar Feriado</button>
               </form>

               <div className="flex items-center gap-2 mb-3 shrink-0">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mês:</label>
                  <input type="month" value={mesFeriados} onChange={e=>{ setMesFeriados(e.target.value); carregarFeriados(e.target.value); }} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm text-slate-700 outline-none"/>
               </div>

               <div className="overflow-y-auto space-y-2">
                  {feriadosLista.length === 0 ? (
                     <p className="text-sm font-medium text-slate-400 text-center py-4">Nenhum feriado marcado neste mês.</p>
                  ) : feriadosLista.map(fe => (
                     <div key={fe.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                        <span className="text-sm font-black text-rose-600 shrink-0">{fe.data?.split("-").reverse().slice(0, 2).join("/")}</span>
                        <span className="flex-1 text-sm font-bold text-slate-700 truncate">{fe.nome || "Feriado"}</span>
                        <button onClick={() => excluirFeriado(fe.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* MODAL: DESLIGAMENTO (arquiva o funcionário com a vida dele) */}
      {modalDeslig && funcDeslig && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-md p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[94vh] overflow-y-auto">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Desligar Funcionário</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">{funcDeslig.nome} · {funcDeslig.cargo || "—"}</p>
                  </div>
                  <button onClick={() => setModalDeslig(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>
               <p className="text-xs font-medium text-slate-500 mb-4 bg-slate-50 border border-slate-100 rounded-xl p-3">Ele sai da equipe ativa e vai para o arquivo de <b>Ex-funcionários</b>. Todo o histórico (ponto, advertências, documentos, banco de horas) fica preservado.</p>
               <form onSubmit={confirmarDesligamento} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Data</label>
                        <input type="date" value={desligForm.data} onChange={e=>setDesligForm({...desligForm, data: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-orange-400"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo</label>
                        <select value={desligForm.tipo} onChange={e=>setDesligForm({...desligForm, tipo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-orange-400">
                           <option>Pedido de demissão</option>
                           <option>Demissão sem justa causa</option>
                           <option>Demissão por justa causa</option>
                           <option>Fim de contrato</option>
                           <option>Fim de experiência</option>
                           <option>Acordo</option>
                        </select>
                     </div>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Motivo / observações (opcional)</label>
                     <textarea rows={2} value={desligForm.motivo} onChange={e=>setDesligForm({...desligForm, motivo: e.target.value})} placeholder="Ex: reestruturação, desempenho, iniciativa do colaborador..." className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm text-slate-700 outline-none focus:border-orange-400 resize-none"/>
                  </div>
                  <div className="flex gap-3">
                     <button type="button" onClick={() => setModalDeslig(false)} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl">Cancelar</button>
                     <button type="submit" className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl flex items-center justify-center gap-2"><LogOut size={18}/> Desligar</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* MODAL: ADVERTÊNCIAS do colaborador */}
      {modalAdv && funcAdv && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-lg my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[94vh] sm:max-h-[88vh] flex flex-col">
               <div className="flex justify-between items-center mb-5 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Advertências</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">{funcAdv.nome} · aparecem na vida do colaborador</p>
                  </div>
                  <button onClick={() => setModalAdv(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <form onSubmit={salvarAdvertencia} className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 shrink-0 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Nova advertência</p>
                  <div className="flex gap-3">
                     <input type="date" value={advForm.data} onChange={e=>setAdvForm({...advForm, data: e.target.value})} className="p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-red-400"/>
                     <select value={advForm.gravidade} onChange={e=>setAdvForm({...advForm, gravidade: e.target.value})} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-red-400">
                        <option value="leve">Leve</option>
                        <option value="media">Média</option>
                        <option value="grave">Grave</option>
                     </select>
                  </div>
                  <input type="text" placeholder="Motivo (ex: atraso sem justificativa)" value={advForm.motivo} onChange={e=>setAdvForm({...advForm, motivo: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-red-400"/>
                  <textarea placeholder="Descrição da ocorrência (opcional)" rows={2} value={advForm.descricao} onChange={e=>setAdvForm({...advForm, descricao: e.target.value})} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-medium text-sm text-slate-700 outline-none focus:border-red-400 resize-none"/>
                  <button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-xl transition-colors">Registrar Advertência</button>
               </form>

               <div className="overflow-y-auto space-y-2">
                  {advLista.length === 0 ? (
                     <p className="text-sm font-medium text-slate-400 text-center py-4">Nenhuma advertência registrada.</p>
                  ) : advLista.map(a => (
                     <div key={a.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md shrink-0 ${a.gravidade === "grave" ? "bg-red-100 text-red-700" : a.gravidade === "media" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>{a.gravidade}</span>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-bold text-slate-700 truncate">{a.motivo}</p>
                           <p className="text-[10px] font-medium text-slate-400">{a.data ? a.data.split("-").reverse().join("/") : "—"}{a.descricao ? ` · ${a.descricao}` : ""}</p>
                        </div>
                        <button onClick={() => imprimirTermoAdvertencia(funcAdv, a)} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg" title="Imprimir termo para assinatura"><Printer size={14}/></button>
                        <button onClick={() => excluirAdvertencia(a.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg" title="Excluir"><Trash2 size={14}/></button>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* MODAL: BANCO DE HORAS (intervalo não tirado; limite 8h/mês) */}
      {modalBanco && funcBanco && (() => {
         const lancs = bancoHoras.filter(b => b.colaborador_id === funcBanco.id);
         const total = lancs.filter(b => b.tipo !== "excesso").reduce((s, b) => s + (Number(b.minutos) || 0), 0);
         const pct = Math.min(100, (total / BANCO_LIMITE_MIN) * 100);
         const critico = total >= BANCO_LIMITE_MIN;
         const alerta = total >= BANCO_ALERTA_MIN;
         return (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-lg my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[94vh] sm:max-h-[88vh] flex flex-col">
               <div className="flex justify-between items-center mb-5 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Banco de Horas</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">{funcBanco.nome} · mês atual</p>
                  </div>
                  <button onClick={() => setModalBanco(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* Acumulado do mês vs limite de 8h */}
               <div className={`p-4 rounded-2xl border mb-5 shrink-0 ${critico ? "bg-red-50 border-red-200" : alerta ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex justify-between items-baseline mb-2">
                     <span className={`text-[10px] font-black uppercase tracking-widest ${critico ? "text-red-600" : alerta ? "text-amber-700" : "text-slate-500"}`}>
                        {critico ? "Limite de 8h atingido!" : alerta ? "Perto de estourar as 8h!" : "Acumulado no mês"}
                     </span>
                     <span className={`text-2xl font-black ${critico ? "text-red-600" : alerta ? "text-amber-700" : "text-slate-800"}`}>{fmtMin(total)} <span className="text-sm font-bold text-slate-400">/ 8h00</span></span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden bg-white border border-slate-200">
                     <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: critico ? "#DC2626" : alerta ? "#F59E0B" : "#059669" }} />
                  </div>
                  {(alerta || critico) && <p className="text-[11px] font-bold mt-2 text-slate-600">Programe a compensação/folga de {funcBanco.nome.split(" ")[0]} para zerar o banco.</p>}
               </div>

               {/* Compensar tudo com uma folga (registra a folga e zera os créditos) */}
               {total > 0 && (
                  <div className="flex flex-wrap items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-5 shrink-0">
                     <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 flex-1">Compensar com folga:</span>
                     <input type="date" value={compensarData} onChange={e=>setCompensarData(e.target.value)} className="p-2 bg-white border border-emerald-200 rounded-lg font-bold text-sm text-slate-700 outline-none focus:border-emerald-500"/>
                     <button onClick={compensarBanco} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-colors">
                        Dar folga e zerar {fmtMin(total)}
                     </button>
                  </div>
               )}

               {/* Lançar minutos não tirados do dia */}
               <form onSubmit={lancarBancoHoras} className="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-5 shrink-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-sky-700 mb-3">Lançar intervalo não tirado</p>
                  <div className="flex flex-wrap items-end gap-3">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Dia</label>
                        <input type="date" value={formBanco.data} onChange={e=>setFormBanco({...formBanco, data: e.target.value})} className="p-2.5 mt-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-sky-500"/>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Minutos que faltaram</label>
                        <input type="number" min="1" max="60" value={formBanco.minutos} onChange={e=>setFormBanco({...formBanco, minutos: e.target.value})} className="w-24 p-2.5 mt-1 text-center bg-white border border-slate-200 rounded-lg font-black text-slate-800 outline-none focus:border-sky-500"/>
                     </div>
                     <button type="submit" className="ml-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-sm rounded-xl transition-colors">Lançar</button>
                  </div>
                  <input type="text" placeholder="Motivo (opcional): casa cheia, evento, faltou gente..." value={formBanco.observacao} onChange={e=>setFormBanco({...formBanco, observacao: e.target.value})} className="w-full p-2.5 mt-3 bg-white border border-slate-200 rounded-lg font-medium text-sm text-slate-700 outline-none focus:border-sky-500"/>
                  <p className="text-[10px] font-medium text-sky-700/70 mt-2">Ex.: só tirou 20 min do intervalo de 1h → lance 40 minutos. Máx. 60 por dia.</p>
               </form>

               {/* Lançamentos do mês */}
               <div className="overflow-y-auto space-y-2">
                  {lancs.length === 0 ? (
                     <p className="text-sm font-medium text-slate-400 text-center py-4">Nenhum lançamento neste mês.</p>
                  ) : lancs.map(b => (
                     <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border ${b.tipo === "excesso" ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100"}`}>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-bold text-slate-700">
                              {b.data ? b.data.split("-").reverse().join("/") : "—"} ·{" "}
                              {b.tipo === "excesso"
                                 ? <span className="text-amber-700">passou {fmtMin(Number(b.minutos) || 0)} do intervalo</span>
                                 : <span className="text-sky-700">{fmtMin(Number(b.minutos) || 0)}</span>}
                           </p>
                           {b.observacao && <p className="text-[11px] font-medium text-slate-400 truncate">{b.observacao}</p>}
                        </div>
                        <button onClick={() => excluirBancoHoras(b.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
                     </div>
                  ))}
               </div>
            </div>
         </div>
         );
      })()}

      {modalFolgas && funcParaFolgas && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-[800px] p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5 sm:mb-6 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Gerenciar Folgas</h2>
                     <p className="text-xs font-bold text-slate-500">{funcParaFolgas.nome}</p>
                  </div>
                  <button onClick={() => setModalFolgas(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="flex-1 overflow-y-auto pr-0 sm:pr-2 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                  {/* Coluna 1: Adicionar Folgas */}
                  <div>
                     <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Folgas Fixas (Semanais)</p>
                        <p className="text-sm font-medium text-slate-700 leading-snug">
                           As folgas semanais de <b>{funcParaFolgas.nome}</b> são os dias da semana que NÃO estão marcados na ficha de contratação.
                        </p>
                     </div>

                     <div className="mb-6">
                        <label className="text-xs font-bold text-indigo-600 uppercase tracking-widest block mb-2">Folga Dominical (1 ao Mês)</label>
                        <div className="space-y-2">
                           {domingosProximos.map(dom => {
                              // Verifica conflitos com outras pessoas
                              const folgasNestaData = todasFolgasDaUnidade.filter(f => f.data_folga === dom.data && f.colaborador_id !== funcParaFolgas.id);
                              const nomesConflito = folgasNestaData.map(f => {
                                 const colab = funcionarios.find(func => func.id === f.colaborador_id);
                                 return colab ? colab.nome : "Desconhecido";
                              }).join(", ");
                              const hasConflito = folgasNestaData.length > 0;
                              const jaTemFolgaNesteDia = folgasEsporadicas.some(f => f.data_folga === dom.data);

                              return (
                                 <div key={dom.data} className="flex flex-col bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                                    <div className="flex items-center justify-between mb-1">
                                       <span className="font-bold text-slate-700">Dom, {dom.label}</span>
                                       <button 
                                          onClick={() => handleAdicionarFolga(dom.data, "Domingo")} 
                                          disabled={jaTemFolgaNesteDia}
                                          className="bg-indigo-50 text-indigo-700 px-3 py-1 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                          {jaTemFolgaNesteDia ? "Agendado" : "Agendar"}
                                       </button>
                                    </div>
                                    {hasConflito && (
                                       <span className="text-[10px] font-bold text-rose-500">
                                          Aviso: {folgasNestaData.length} funcionário(s) de folga ({nomesConflito})
                                       </span>
                                    )}
                                 </div>
                              )
                           })}
                        </div>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Folga Extra (Feriado ou Outro)</label>
                        <div className="flex gap-2">
                           <input type="date" min={new Date().toISOString().split("T")[0]} value={novaFolgaData} onChange={e=>setNovaFolgaData(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-700"/>
                           <button onClick={() => handleAdicionarFolga(novaFolgaData, "Extra / Feriado")} className="bg-emerald-600 text-white px-4 font-bold rounded-xl hover:bg-emerald-700 transition-colors">Adicionar</button>
                        </div>
                     </div>
                  </div>

                  {/* Coluna 2: Folgas Agendadas */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
                     <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 border-b border-slate-200 pb-2">Folgas Extras Agendadas</h3>
                     <div className="space-y-3">
                        {folgasEsporadicas.length === 0 ? (
                           <p className="text-center text-sm font-bold text-slate-400 py-4">Nenhuma folga extra agendada.</p>
                        ) : folgasEsporadicas.map(folga => (
                           <div key={folga.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                              <div>
                                 <div className="font-black text-slate-700">{new Date(folga.data_folga).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</div>
                                 <div className="text-[10px] font-bold text-indigo-500 uppercase">{folga.descricao || "Folga Extra"}</div>
                              </div>
                              <button onClick={() => handleRemoverFolga(folga.id)} className="text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 p-2 rounded-lg"><Trash2 size={16}/></button>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Modal Consumo de Funcionários (Vales / Lanches / etc) */}
      {modalConsumo && funcionarioConsumo && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-[900px] p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5 sm:mb-6 shrink-0 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center">
                        <ShoppingBag size={24} />
                     </div>
                     <div>
                        <h2 className="font-black text-2xl text-slate-800">Consumo & Vales</h2>
                        <p className="text-xs font-bold text-slate-500">{funcionarioConsumo.nome}</p>
                     </div>
                  </div>
                  <button onClick={() => setModalConsumo(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"><X size={20}/></button>
               </div>

               <div className="flex-1 overflow-y-auto pr-0 sm:pr-2 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                  {/* Lado Esquerdo: Adicionar Consumo */}
                  <div className="flex flex-col">
                     <div className="bg-teal-50 p-4 rounded-2xl mb-6 border border-teal-100">
                        <p className="text-xs font-bold text-teal-700 uppercase tracking-widest mb-1">{Math.round((paramsSis.desconto_func_pct / 100) * 100)}% de Desconto Automático</p>
                        <p className="text-sm font-medium text-teal-800 leading-snug">
                           Escolha um prato do cardápio ou digite manualmente. O sistema aplica o desconto do funcionário sobre o valor original.
                        </p>
                     </div>

                     {/* Pratos do cardápio: clique para preencher descrição + valor */}
                     <div className="mb-5">
                        <div className="flex items-center justify-between mb-2">
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><UtensilsCrossed size={13} /> Pratos do Cardápio</label>
                           {cardapioConsumo.length > 0 && <span className="text-[10px] font-bold text-slate-400">{cardapioConsumo.length} itens</span>}
                        </div>
                        {cardapioConsumo.length === 0 ? (
                           <p className="text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 rounded-xl p-3">Nenhum prato no cardápio desta unidade. Cadastre em Catálogo e Preços, ou digite manualmente abaixo.</p>
                        ) : (
                           <>
                              <div className="relative mb-2">
                                 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                 <input type="text" value={buscaPrato} onChange={e => setBuscaPrato(e.target.value)} placeholder="Buscar prato..." className="w-full p-2.5 pl-9 bg-slate-50 border border-slate-200 rounded-xl font-medium text-sm outline-none focus:border-teal-500 text-slate-700" />
                              </div>
                              <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5">
                                 {cardapioConsumo
                                    .filter(p => !buscaPrato || (p.nome || "").toLowerCase().includes(buscaPrato.toLowerCase()) || (p.categoria || "").toLowerCase().includes(buscaPrato.toLowerCase()))
                                    .map(p => {
                                       const selecionado = novoConsumo.descricao === p.nome;
                                       return (
                                          <button key={p.id} type="button" onClick={() => escolherPrato(p)}
                                             className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${selecionado ? "bg-teal-50 border-teal-400" : "bg-white border-slate-200 hover:border-teal-300"}`}>
                                             <div className="min-w-0">
                                                <p className="font-bold text-sm text-slate-800 truncate">{p.nome}</p>
                                                {p.categoria && <p className="text-[10px] font-medium text-slate-400">{p.categoria}</p>}
                                             </div>
                                             <span className="font-black text-sm text-slate-700 shrink-0">{fmtBRL(p.preco)}</span>
                                          </button>
                                       );
                                    })}
                              </div>
                           </>
                        )}
                     </div>

                     <div className="space-y-4 flex-1">
                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Descrição do Consumo</label>
                           <input type="text" value={novoConsumo.descricao} onChange={e=>setNovoConsumo({...novoConsumo, descricao: e.target.value})} placeholder="Ex: Almoço, Cerveja, Hambúrguer..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500 text-slate-700"/>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Data / Hora</label>
                              <input type="datetime-local" value={novoConsumo.data_consumo} onChange={e=>setNovoConsumo({...novoConsumo, data_consumo: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500 text-slate-700"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Valor Original (R$)</label>
                              <input type="number" step="0.01" value={novoConsumo.valor_original} onChange={e=>setNovoConsumo({...novoConsumo, valor_original: e.target.value})} placeholder="Ex: 50.00" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-700 outline-none focus:border-teal-500"/>
                           </div>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Forma de Pagamento</label>
                           <select value={novoConsumo.forma_pagamento} onChange={e=>setNovoConsumo({...novoConsumo, forma_pagamento: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-teal-500 text-slate-700 appearance-none">
                              <option value="Desconto em Folha">Desconto em Folha (Fica Pendente)</option>
                              <option value="Dinheiro">Dinheiro (Pago na hora)</option>
                              <option value="Pix">PIX (Pago na hora)</option>
                              <option value="Cartão">Cartão (Pago na hora)</option>
                           </select>
                        </div>
                     </div>

                     <div className="mt-6 pt-6 border-t border-slate-100">
                        {novoConsumo.valor_original && (
                           <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl text-white mb-4">
                              <span className="font-bold">Total a Pagar (com {Math.round((paramsSis.desconto_func_pct / 100) * 100)}% desc.):</span>
                              <span className="font-black text-xl text-emerald-400">{fmtBRL(Number(novoConsumo.valor_original) * (1 - (paramsSis.desconto_func_pct / 100)))}</span>
                           </div>
                        )}
                        <button onClick={salvarConsumo} disabled={!novoConsumo.descricao || !novoConsumo.valor_original} className="w-full py-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-teal-600/20 active:scale-95">
                           Lançar Consumo
                        </button>
                     </div>
                  </div>

                  {/* Lado Direito: Histórico */}
                  <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 flex flex-col h-full overflow-hidden">
                     <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs mb-4 border-b border-slate-200 pb-2 flex items-center justify-between">
                        <span>Extrato de Consumo</span>
                        {listaConsumo.length > 0 && (
                           <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{listaConsumo.length} itens</span>
                        )}
                     </h3>
                     
                     <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-4">
                        {loadingConsumo && <p className="text-center text-sm font-bold text-slate-400 py-4">Carregando histórico...</p>}
                        {!loadingConsumo && listaConsumo.length === 0 && (
                           <p className="text-center text-sm font-bold text-slate-400 py-4 flex flex-col items-center">
                              <Store size={32} className="text-slate-300 mb-2"/>
                              Nenhum consumo registrado.
                           </p>
                        )}
                        {!loadingConsumo && listaConsumo.map(item => {
                           const isPago = item.status_pagamento === "Pago";
                           return (
                              <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative group">
                                 <div className="flex justify-between items-start mb-2">
                                    <div>
                                       <div className="font-black text-slate-800 leading-tight">{item.descricao}</div>
                                       <div className="text-[10px] font-bold text-slate-400">
                                          {new Date(item.data_consumo).toLocaleString('pt-BR')}
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <div className="font-black text-teal-700">{fmtBRL(item.valor_desconto)}</div>
                                       <div className="text-[10px] font-medium text-slate-400 line-through">De {fmtBRL(item.valor_original)}</div>
                                    </div>
                                 </div>
                                 
                                 <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                    <div className="flex items-center gap-2">
                                       {isPago ? (
                                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                             <CheckCircle size={10}/> PAGO
                                          </span>
                                       ) : (
                                          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                             <Clock size={10}/> PENDENTE
                                          </span>
                                       )}
                                       
                                       <select 
                                          value={item.forma_pagamento} 
                                          onChange={(e) => alterarFormaPagamentoConsumo(item.id, item.status_pagamento, e.target.value)}
                                          className="text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-600 rounded-md px-1 py-1 outline-none focus:border-teal-500 max-w-[120px]"
                                       >
                                          <option value="Desconto em Folha">Desconto em Folha</option>
                                          <option value="Dinheiro">Dinheiro</option>
                                          <option value="PIX">PIX</option>
                                          <option value="Cartão">Cartão</option>
                                       </select>
                                       
                                       {!isPago && (
                                          <button onClick={() => quitarConsumo(item.id)} className="text-[10px] font-bold uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md transition-colors">
                                             Quitar agora
                                          </button>
                                       )}
                                    </div>
                                    
                                    <button onClick={() => apagarConsumo(item.id)} className="text-slate-400 hover:text-rose-600 transition-colors bg-slate-50 p-1.5 rounded-lg opacity-0 group-hover:opacity-100">
                                       <Trash2 size={14}/>
                                    </button>
                                 </div>
                              </div>
                           )
                        })}
                     </div>
                     
                     {!loadingConsumo && listaConsumo.length > 0 && (
                        <div className="pt-4 border-t border-slate-200 mt-2">
                           <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">Total Pendente</span>
                              <span className="font-black text-rose-600 text-lg">
                                 {fmtBRL(listaConsumo.filter(i => i.status_pagamento !== "Pago").reduce((acc, curr) => acc + curr.valor_desconto, 0))}
                              </span>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </div>
      )}
      {/* Modal Lancamento Financeiro (Desmembramento) */}
      {modalLancamento && funcParaLancamento && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex items-center justify-between mb-6">
                  <div>
                     <h2 className="text-2xl font-black tracking-tight text-slate-800">Lançar Diária</h2>
                     <p className="text-slate-500 font-medium text-sm">Desmembramento do Financeiro</p>
                  </div>
                  <button onClick={() => setModalLancamento(false)} className="w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors">
                     <X size={20} />
                  </button>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                     <label className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block mb-1">Valor Total Pago (R$)</label>
                     <input type="text" value={formLancamento.total} onChange={e => handleTotalLancamentoChange(e.target.value)} className="w-full bg-transparent text-2xl font-black text-emerald-800 outline-none" />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">INSS (5%)</label>
                        <input type="text" value={formLancamento.inss} onChange={e => setFormLancamento({...formLancamento, inss: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">FGTS (8%)</label>
                        <input type="text" value={formLancamento.fgts} onChange={e => setFormLancamento({...formLancamento, fgts: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Taxa Serviço (10%)</label>
                        <input type="text" value={formLancamento.taxa} onChange={e => setFormLancamento({...formLancamento, taxa: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Valor Fixo Base</label>
                        <input type="text" value={formLancamento.fixo} onChange={e => setFormLancamento({...formLancamento, fixo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500" />
                     </div>
                  </div>
                  
                  <button onClick={salvarLancamentoFinanceiro} className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black tracking-wide text-lg mt-2 shadow-lg shadow-slate-800/20 hover:bg-slate-900 transition-colors">
                     Lançar Desmembramento
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
