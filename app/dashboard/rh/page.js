"use client";

import { useState, useEffect, useRef } from "react";
import { comprimirFotoParaIA } from "../../lib/imagem";
import { useRouter, useSearchParams } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import RhNav from "./RhNav";
import VisaoColaboradores from "./VisaoColaboradores";
import VisaoSemana from "./VisaoSemana";
import PainelRH from "./PainelRH";
import {
  fetchColaboradores, inserirColaborador, atualizarColaborador,
  fetchDocumentos, uploadDocumentoRH, removerDocumento,
  fetchCargos,
  fetchAllFolgasDaUnidade, fetchFolgasEsporadicas, inserirFolgaEsporadica, removerFolgaEsporadica,
  fetchConsumoFuncionario, inserirConsumoFuncionario, atualizarStatusConsumo, removerConsumoFuncionario,
  fetchBancoHoras, inserirBancoHoras, removerBancoHoras, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN,
  fetchAdvertenciasColab, inserirAdvertencia, removerAdvertencia,
  fetchFeriados, inserirFeriado, removerFeriado, fetchAtestadosUnidade,
  fetchLiberacoesColab, removerLiberacao,
  salvarReciboPrestacao, fetchRecibosPrestacao, atualizarPagamentoRecibo, anexarFotoReciboAssinado,
  desligarColaborador, registrarAvisoPrevio, cancelarAvisoPrevio
} from "../../lib/rh";
import { fetchPontoHoje, fetchPontosMesUnidade, fetchHistoricoPontoCompleto, fetchPontoDoDia } from "../../lib/ponto";
import { domingosParaFolga, folgasDeDomingoNoMes, avisosDaFolga, dataCurta } from "../../lib/folgas-domingo.mjs";
import { situacaoDoPonto, atestadoNaData } from "../../lib/ponto-status.mjs";
import { TOLERANCIA_MARCACAO_MIN } from "../../lib/jornada-calculo.mjs";
import { situacaoExperiencia, emExperiencia, faseContratoCalculada, situacaoAvisoPrevio, tempoDeCasa, aniversario, aniversariantesDoMes, fraseAniversario, ESTADOS_CIVIS, ESCOLARIDADES, GENEROS } from "../../lib/contrato-experiencia.mjs";
import { fetchValesPendentes } from "../../lib/rh";
import { calcularAdicionaisMes, calcularAdicionaisPorDia, jornadaContratadaMin, opcoesDaCasa } from "../../lib/rh";
import { mascaraCPF, mascaraRG, mascaraTelefone } from "../../lib/mascaras.mjs";
import { salvarConta, fetchLancamentos } from "../../lib/financeiro";
import { hojeLocal, novaChave } from "../../lib/contas-pagar.mjs";
import { fetchCardapio } from "../../lib/cardapio";
import { fetchProdutos } from "../../lib/vendas";
import { fetchParams, PARAMS_PADRAO } from "../../lib/parametros";
import { useTempoReal } from "../../lib/realtime";
import { supabase } from "../../lib/supabase";

// Desconto do funcionário sobre o valor de cardápio (funcionário paga o restante)
// Desconto do funcionário: ajustável em Configurações > Parâmetros (paramsSis)
import { 
  Users, UserPlus, FileText, Upload, Save, X, Search, Trash2, Loader2, CalendarHeart, Star, Phone, CreditCard, ClipboardList, Clock, CalendarDays, ShoppingBag, CheckCircle, Store, Printer, UtensilsCrossed, LogOut, RotateCcw, ChevronDown, Camera, Award, Link2
} from "lucide-react";
import { fmtBRL } from "../../components/ui";
import { comFecharImpressao } from "../../lib/imprimir";
import { imprimirReciboExtra } from "../../lib/recibo-extra";
import { abrirArquivoRH } from "../../lib/rh-arquivos";
import PlanoCargos, { imprimirCertificadoPromocao } from "./components/PlanoCargos";
import CampoDecimal from "../../components/CampoDecimal";
import { formularioDeEdicao, validarCadastro, progressoCadastro, acharDuplicado } from "../../lib/colaborador-cadastro.mjs";
import { fetchConvencaoAtiva } from "../../lib/trabalhista/convencoes-dados";
import { regrasDaCompetencia } from "../../lib/trabalhista/regras-competencia.mjs";
import CadastroAssistente, { limparRascunhoCadastro } from "./CadastroAssistente";
import { citar } from "../../lib/trabalhista/cct-foz-2026-2027.mjs";
import { fetchComSessao } from "../../lib/api-sessao.js";

// Horário esperado de um colaborador para um dia da semana (0=Dom..6=Sáb).
// Usa a jornada por-dia se ativada; senão o horário de domingo; senão o fixo.
export function horarioDoDia(f, weekday) {
  const wd = String(weekday);
  if (f?.horario_por_dia && f?.horarios_dia && f.horarios_dia[wd]) {
    const h = f.horarios_dia[wd];
    return { entrada: h.e || "", saida: h.s || "" };
  }
  if (Number(weekday) === 0 && (f?.horario_dom_entrada || f?.horario_dom_saida)) {
    return { entrada: f.horario_dom_entrada || f.horario_entrada || "", saida: f.horario_dom_saida || f.horario_saida || "" };
  }
  return { entrada: f?.horario_entrada || "", saida: f?.horario_saida || "" };
}


export default function RHPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abaModulo = searchParams.get("aba") || "visao";
  const { unidadeAtiva, unidadeInfo } = useERP();
  
  // "71 dias de Seldeestrela" diz mais que "71 dias de casa": a equipe chama a
  // unidade pelo nome, e quem opera mais de uma precisa saber de qual se trata.
  const nomeDaCasa = unidadeInfo?.nome || "casa";
  
  const [funcionarios, setFuncionarios] = useState([]);
  const [pontosHoje, setPontosHoje] = useState([]);
  const [valesPendentes, setValesPendentes] = useState([]);       // desconto em folha pendente
  const [pontosMesUnidade, setPontosMesUnidade] = useState([]);   // p/ extras e feriados do mês
  const [feriadosMesAtual, setFeriadosMesAtual] = useState([]);
  // Convenção coletiva ativa (RH-3): percentuais de extra/noturno da competência
  const [convencao, setConvencao] = useState(null);
  useEffect(() => { fetchConvencaoAtiva(unidadeAtiva).then(setConvencao); }, [unidadeAtiva]);
  const [folgasUnidade, setFolgasUnidade] = useState([]);       // p/ relatório de faltas
  const [atestadosMes, setAtestadosMes] = useState([]);         // atestado não é falta
  const [paramsSis, setParamsSis] = useState(PARAMS_PADRAO);     // parâmetros ajustáveis
  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") fetchParams(unidadeAtiva).then(r => setParamsSis(r.data)); }, [unidadeAtiva]);
  const [lancamentos, setLancamentos] = useState([]);             // p/ faturamento do mês (CMO %)
  const [cargos, setCargos] = useState([]);
  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState(null);
  const statePadrao = { foto: "", nome: "", cargo: "", salario: "", vale_alimentacao: "", taxa_servico_mes: "", horario_entrada: "", horario_saida: "", horario_dom_entrada: "", horario_dom_saida: "", intervalo_inicio: "", intervalo_fim: "", intervalo_dom_inicio: "", intervalo_dom_fim: "", horario_por_dia: false, horarios_dia: {}, dias_trabalho: "1,2,3,4,5,6", tempo_intervalo: 60, tipo_contrato: "Fixo", telefone: "", email: "", cpf: "", rg: "", rua_av: "", numero_casa: "", bairro: "", cidade_uf: "", chave_pix: "", avaliacao_estrelas: 0, data_admissao: "", status_contrato: "Definitivo", supervisor_id: "", supervisores_ids: [], endereco: "", cep: "", cidade_nascimento: "", data_nascimento: "", tem_transporte: false, tipo_transporte: "", usa_vale_transporte: false, pontos_taxa: "", genero: "", escolaridade: "", estado_civil: "", nome_pai: "", nome_mae: "", filhos: [],
    // Dados do Recibo de Trabalho Extra: ficam no cadastro para o recibo já sair preenchido
    topicos_funcao: "", itens_emprestados: "", forma_pagamento: "Pix", vale_transporte_val: "", setor_entrega: "", janta_ofertada: true };
  // Cargos de liderança sempre disponíveis, além dos cargos cadastrados
  const CARGOS_LIDERANCA = ["CEO", "Supervisor", "Gerente"];
  const [detalheKpi, setDetalheKpi] = useState(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [modoAssistente, setModoAssistente] = useState(true); // cadastro novo em etapas (Fase 5)
  const [menuAcoes, setMenuAcoes] = useState(null);
  const [abaMenuAcoes, setAbaMenuAcoes] = useState("trabalho");
  const [detAberto, setDetAberto] = useState({}); // detalhamento salarial por card // funcionário com o menu "Ações" aberto
  const [novoFunc, setNovoFunc] = useState(statePadrao);
  
  const [modalLancamento, setModalLancamento] = useState(false);
  const [funcParaLancamento, setFuncParaLancamento] = useState(null);
  const [formLancamento, setFormLancamento] = useState({ total: "0.00", fixo: "0.00", inss: "0.00", fgts: "0.00", taxa: "0.00" });
  const [editandoId, setEditandoId] = useState(null);
  const [versaoQuadro, setVersaoQuadro] = useState(0); // recarrega o quadro e o perfil aberto depois de salvar
  // Fase 1 (HDEV-RH-001): erros por campo, duplicado encontrado e trava de duplo clique
  const [errosCadastro, setErrosCadastro] = useState({});
  const [duplicado, setDuplicado] = useState(null);
  const [erroSalvar, setErroSalvar] = useState("");
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const limparEstadoCadastro = () => { setErrosCadastro({}); setDuplicado(null); setErroSalvar(""); };
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null);

  const fileInputRef = useRef(null);
  const [funcParaUpload, setFuncParaUpload] = useState(null);
  
  const [modalFolgas, setModalFolgas] = useState(false);
  const [funcParaFolgas, setFuncParaFolgas] = useState(null);
  const [folgasEsporadicas, setFolgasEsporadicas] = useState([]);
  const [todasFolgasDaUnidade, setTodasFolgasDaUnidade] = useState([]);
  const [novaFolgaData, setNovaFolgaData] = useState("");
  const [mesesDeDomingo, setMesesDeDomingo] = useState([]);

  // Estados Modal Consumo (Vales)
  // Recibo de prestação de serviço: recebe dados do cadastro e permite completar
  // o acordo antes de imprimir; somente as assinaturas ficam manuscritas.
  // pago — o desmembramento (fixo/INSS/FGTS/taxa) é calculado na hora.
  const ITENS_FICHA_PADRAO = ["Uniforme / Camisa", "Avental", "Cartão de Consumo", "Rádio Comunicador / Fone"];
  const [modalFicha, setModalFicha] = useState(false);
  const [modalEscolherExtra, setModalEscolherExtra] = useState(false);
  const [buscaRecibo, setBuscaRecibo] = useState("");
  const [fichaFunc, setFichaFunc] = useState(null);
  const [fichaValor, setFichaValor] = useState("");
  const [fichaDias, setFichaDias] = useState("1"); // nº de dias combinados
  const [fichaItens, setFichaItens] = useState([]);
  const [fichaNovoItem, setFichaNovoItem] = useState("");
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [anexandoFotoId, setAnexandoFotoId] = useState(null);

  const dadosReciboVazios = {
    nome: "", cpf: "", rg: "", endereco: "", rua_av: "", numero_casa: "", bairro: "", cidade_uf: "", telefone: "", chave_pix: "",
    data_trabalho: new Date().toISOString().slice(0, 10), evento: "", funcao: "", topicos_funcao: "",
    entrada: "", saida_intervalo: "", retorno_intervalo: "", saida_final: "", intervalo: "",
    vale_transporte: "", adicional: "", descontos: "", forma_pagamento: "Pix",
    responsavel_entrega: "", setor_entrega: "", conferencia_devolucao: "", horario_devolucao: "",
    janta_ofertada: true, foto_recibo_assinado: "",
    pagamento_realizado: true, data_pagamento: new Date().toISOString().slice(0, 10),
  };
  const [fichaDados, setFichaDados] = useState(dadosReciboVazios);
  const [salvandoRecibo, setSalvandoRecibo] = useState(false);

  // "Liberar ponto de hoje" do extra saiu (RH-B1): a tabela rh_ponto_liberado
  // não existe no banco e os dois relógios tiram os extras da lista — a
  // liberação não tinha onde gravar nem efeito. Extra é controlado pelo recibo.

  // Histórico diário do extra: cada dia liberado (diária) + total.
  const [modalDiarias, setModalDiarias] = useState(null);
  const abrirHistoricoDiarias = async (f) => {
    setModalDiarias({ func: f, liberacoes: [], pontos: [], recibos: [], advertencias: [], loading: true });
    const [liberacoes, pontos, recibos, advertencias] = await Promise.all([
      fetchLiberacoesColab(f.id, 365),
      fetchHistoricoPontoCompleto(f.id, 365),
      fetchRecibosPrestacao(f.id),
      fetchAdvertenciasColab(f.id),
    ]);
    setModalDiarias({
      func: f,
      liberacoes: liberacoes.data || [],
      pontos: pontos.data || [],
      recibos: recibos.data || [],
      advertencias: advertencias.data || [],
      erroRecibos: recibos.error || "",
      loading: false,
    });
  };

  const abrirModalFicha = (f) => {
    if (!f?.id) {
      setBuscaRecibo("");
      setModalEscolherExtra(true);
      return;
    }
    router.push(`/dashboard/rh/extra/${f.id}/recibo`);
    return;
    setFichaFunc(f);
    setFichaValor(f?.salario ? String(f.salario) : "");
    setFichaDias("1");
    let rAv = f?.rua_av || f?.rua || "";
    let nCasa = f?.numero_casa || f?.numero || "";
    let bai = f?.bairro || "";
    let cid = f?.cidade_uf || f?.cidade || "";
    if (!rAv && f?.endereco) {
      const partes = String(f.endereco).split(",").map(p => p.trim());
      if (partes[0]) rAv = partes[0];
      if (partes[1]) nCasa = partes[1];
      if (partes[2]) bai = partes[2];
      if (partes[3]) cid = partes[3];
    }
    setFichaDados({
      ...dadosReciboVazios,
      nome: f?.nome || "",
      cpf: f?.cpf || "",
      rg: f?.rg || "",
      endereco: f?.endereco || "",
      rua_av: rAv,
      numero_casa: nCasa,
      bairro: bai,
      cidade_uf: cid,
      telefone: f?.telefone || "",
      chave_pix: f?.chave_pix || f?.pix || "",
      funcao: f?.cargo || f?.funcao || "",
      entrada: f?.horario_entrada || "",
      saida_final: f?.horario_saida || "",
      intervalo: f?.tempo_intervalo ? `${f.tempo_intervalo} min` : "",
      // Textos do recibo que agora vivem no cadastro da pessoa
      topicos_funcao: f?.topicos_funcao || "",
      forma_pagamento: f?.forma_pagamento || "Pix",
      vale_transporte: f?.vale_transporte_val != null && f?.vale_transporte_val !== "" ? String(f.vale_transporte_val) : "",
      setor_entrega: f?.setor_entrega || "",
      janta_ofertada: f?.janta_ofertada !== false,
    });
    // Itens emprestados: usa a lista do cadastro; sem ela, cai no padrão da casa.
    const itensDoCadastro = String(f?.itens_emprestados || "")
      .split(",").map(s => s.trim()).filter(Boolean);
    setFichaItens((itensDoCadastro.length ? itensDoCadastro : ITENS_FICHA_PADRAO).map(nome => ({ nome, incluir: true })));
    setFichaNovoItem("");
    setModalFicha(true);
  };

  const addItemFicha = () => {
    const nome = fichaNovoItem.trim();
    if (!nome) return;
    setFichaItens(lista => [...lista, { nome, incluir: true }]);
    setFichaNovoItem("");
  };

  const imprimirFichaPreparada = async () => {
    if (!fichaFunc?.id) return alert("Selecione um extra cadastrado antes de gerar o recibo.");
    const diaria = parseFloat(String(fichaValor || "").replace(",", ".")) || 0;
    const dias = Math.max(1, Number(fichaDias) || 1);
    const vale = parseFloat(String(fichaDados.vale_transporte || "").replace(",", ".")) || 0;
    const adicional = parseFloat(String(fichaDados.adicional || "").replace(",", ".")) || 0;
    const descontos = parseFloat(String(fichaDados.descontos || "").replace(",", ".")) || 0;
    const numero = `RPS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Date.now()).slice(-6)}`;
    const inicio = new Date(`${fichaDados.data_trabalho}T12:00:00`);
    const datasContratadas = Array.from({ length: dias }, (_, indice) => {
      const data = new Date(inicio);
      data.setDate(data.getDate() + indice);
      return data.toISOString().slice(0, 10);
    });
    const itens = fichaItens.filter(i => i.incluir).map(i => i.nome);
    const valorTotal = Math.max(0, (diaria * dias) + vale + adicional - descontos);
    setSalvandoRecibo(true);
    const resposta = await salvarReciboPrestacao({
      unidade_id: unidadeAtiva,
      colaborador_id: fichaFunc.id,
      numero,
      data_trabalho: fichaDados.data_trabalho,
      datas_contratadas: datasContratadas,
      dias_contratados: dias,
      valor_diaria: diaria,
      valor_total: valorTotal,
      pagamento_realizado: !!fichaDados.pagamento_realizado,
      data_pagamento: fichaDados.pagamento_realizado ? fichaDados.data_pagamento : null,
      forma_pagamento: fichaDados.forma_pagamento,
      hora_entrada: fichaDados.entrada || null,
      hora_saida_intervalo: fichaDados.saida_intervalo || null,
      hora_retorno_intervalo: fichaDados.retorno_intervalo || null,
      hora_saida: fichaDados.saida_final || null,
      evento: fichaDados.evento || null,
      funcao: fichaDados.funcao || null,
      janta_ofertada: !!fichaDados.janta_ofertada,
      itens,
      dados: fichaDados,
    });
    setSalvandoRecibo(false);
    if (resposta.error) {
      if (!/rh_recibos_prestacao/.test(resposta.error)) {
        return alert(`Erro ao salvar o recibo: ${resposta.error}`);
      }
      console.warn("Aviso ao salvar histórico de recibo:", resposta.error);
    }
    imprimirFichaExtra(fichaFunc, {
      numero,
      diaria,
      dias,
      itens,
      dados: fichaDados,
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
    const _hj = new Date();
    const mesAtual = `${_hj.getFullYear()}-${String(_hj.getMonth() + 1).padStart(2, "0")}`;
    const [resRh, resPonto, resCargos, resBanco, resVales, resPontosMes, resFeriadosMes, resFolgas, resAtestados] = await Promise.all([
      fetchColaboradores(unidadeAtiva),
      fetchPontoHoje(unidadeAtiva),
      fetchCargos(unidadeAtiva),
      fetchBancoHoras(unidadeAtiva, mesAtual),
      fetchValesPendentes(unidadeAtiva),
      fetchPontosMesUnidade(unidadeAtiva, mesAtual),
      fetchFeriados(unidadeAtiva, mesAtual),
      fetchAllFolgasDaUnidade(unidadeAtiva),
      fetchAtestadosUnidade(unidadeAtiva, { desde: `${mesAtual}-01` }),
    ]);
    setAtestadosMes(resAtestados.data || []);
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
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const diaHoje = hoje.getDate();
    const minAgora = hoje.getHours() * 60 + hoje.getMinutes();
    const ativos = funcionarios.filter(f => (f.status || "ativo") !== "inativo");
    const fixos = ativos.filter(f => f.tipo_contrato !== "Freelancer");

    const dataStr = (d) => `${mesAtual}-${String(d).padStart(2, "0")}`;
    const pontoDe = (fid, dStr) => pontosMesUnidade.find(p => p.colaborador_id === fid && p.data_referencia === dStr);
    const temFolga = (fid, dStr) => folgasUnidade.some(fl => fl.colaborador_id === fid && String(fl.data_folga).slice(0, 10) === dStr);
    const emMin = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return (h || 0) * 60 + (m || 0); };

    // Regras (RH-B2): dia antes da admissão não é falta; atestado não é falta;
    // hoje só vira falta depois da entrada + tolerância; horário por dia da
    // semana vale; atraso usa a mesma tolerância do relógio (CLT art. 58 §1º).
    const linhasFixos = fixos.map(f => {
      const dias = String(f.dias_trabalho || "").split(",").map(s => s.trim()).filter(Boolean);
      const admissao = String(f.data_admissao || "").slice(0, 10);
      const atestadosDele = atestadosMes.filter(a => a.colaborador_id === f.id);
      let previstos = 0, presencas = 0, faltas = [], atrasos = 0, minAtraso = 0, atestados = 0;
      for (let d = 1; d <= diaHoje; d++) {
        const dt = new Date(hoje.getFullYear(), hoje.getMonth(), d);
        const dStr = dataStr(d);
        if (admissao && dStr < admissao) continue;
        if (dias.length && !dias.includes(String(dt.getDay()))) continue; // folga semanal
        if (temFolga(f.id, dStr)) continue; // folga programada
        const prevStr = horarioDoDia(f, dt.getDay()).entrada;
        const p = pontoDe(f.id, dStr);
        if (d === diaHoje && !p?.hora_entrada && (!prevStr || minAgora <= emMin(prevStr) + TOLERANCIA_MARCACAO_MIN)) continue; // turno ainda não começou
        previstos++;
        if (!p || !p.hora_entrada) {
          if (atestadoNaData(atestadosDele, dStr)) { atestados++; continue; }
          faltas.push(d); continue;
        }
        presencas++;
        if (prevStr) {
          const prev = new Date(dt); prev.setHours(0, emMin(prevStr), 0, 0);
          const atrasoMin = Math.round((new Date(p.hora_entrada).getTime() - prev.getTime()) / 60000);
          if (atrasoMin > TOLERANCIA_MARCACAO_MIN) { atrasos++; minAtraso += atrasoMin; }
        }
      }
      return { f, previstos, presencas, faltas, atrasos, minAtraso, atestados };
    }).sort((a, b) => (b.faltas.length - a.faltas.length) || (b.minAtraso - a.minAtraso));

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
        <div class="meta">${unidadeAtiva ? "" : ""}até ${hoje.toLocaleDateString("pt-BR")}<br/>${fixos.length} fixo(s)</div>
      </div>

      <h2>Faltas e Atrasos — Equipe Fixa</h2>
      <table>
        <thead><tr><th>Colaborador</th><th>Função</th><th>Dias previstos</th><th>Presenças</th><th>Faltas</th><th>Dias das faltas</th><th>Atestados</th><th>Atrasos</th><th>Min. de atraso</th></tr></thead>
        <tbody>
          ${linhasFixos.map(l => `<tr>
            <td><b>${l.f.nome}</b></td><td>${l.f.cargo || ""}</td>
            <td class="c">${l.previstos}</td><td class="c">${l.presencas}</td>
            <td class="c ${l.faltas.length ? "falta" : ""}">${l.faltas.length}</td>
            <td>${l.faltas.map(d => String(d).padStart(2, "0")).join(", ") || "—"}</td>
            <td class="c">${l.atestados || "—"}</td>
            <td class="c">${l.atrasos}</td><td class="c">${l.minAtraso > 0 ? l.minAtraso + " min" : "—"}</td>
          </tr>`).join("") || '<tr><td colspan="9">Nenhum fixo ativo.</td></tr>'}
        </tbody>
      </table>

      <p style="font-size:9px;color:#94a3b8;margin-top:8px">Falta = dia de trabalho previsto, a partir da admissão, sem batida de entrada e sem atestado (desconta folgas semanais e marcadas; hoje só conta depois do horário de entrada). Atraso = entrada mais de ${TOLERANCIA_MARCACAO_MIN} min depois do horário do dia (CLT art. 58 §1º). Extras ficam fora: são pagos por recibo. Gerado em ${new Date().toLocaleString("pt-BR")}.</p>
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
    const { regras } = regrasDaCompetencia(new Date().toISOString().slice(0, 7), { convencao });
    const ad = calcularAdicionaisMes(meusPontos, fixo, feriadosMesAtual, opcoesDaCasa(f, { folgas: folgasUnidade, regras }));
    const descontos = valesPendentes
      .filter(v => v.funcionario_id === f.id)
      .reduce((s, v) => s + (Number(v.valor_final ?? v.valor_desconto ?? v.valor_original) || 0), 0);
    const adicionais = (ad.valorExtra || 0) + (ad.valorFeriado || 0) + (ad.valorNoturno || 0);
    return { fixo, va, taxa, base, adicionais, descontos, ad, previsto: base + adicionais - descontos };
  };

  // ── Gera o CONTRATO DE TRABALHO já preenchido com os dados e a jornada ────────
  const gerarContrato = (f) => {
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const linha = (v) => v ? esc(v) : "_______________________________";
    const dataBR = (d) => { if (!d) return "____/____/______"; const x = new Date(d); return Number.isNaN(x.getTime()) ? "____/____/______" : x.toLocaleDateString("pt-BR"); };
    const emp = unidadeInfo || {};
    const empNome = emp.nome_fantasia || emp.nome || "";
    const fixo = Number(f.salario) || 0, va = Number(f.vale_alimentacao) || 0, taxa = Number(f.taxa_servico_mes) || 0;
    const ehFree = f.tipo_contrato === "Freelancer";
    const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

    // Jornada (usa horário por dia se existir; senão fixo + domingo)
    let jornadaHTML = "", cargaMin = 0, diasTrab = 0;
    const interv = Number(f.tempo_intervalo) || 0;
    const linhasJ = [];
    for (let d = 0; d <= 6; d++) {
      const h = horarioDoDia(f, d);
      const trabalha = (String(f.dias_trabalho || "").split(",").includes(String(d))) && h.entrada;
      if (trabalha) {
        linhasJ.push(`<tr><td>${DIAS[d]}</td><td>${esc(h.entrada || "—")}</td><td>${esc(h.saida || "—")}</td></tr>`);
        if (h.entrada && h.saida) {
          const [eh, em] = h.entrada.split(":").map(Number), [sh, sm] = h.saida.split(":").map(Number);
          let dur = (sh * 60 + sm) - (eh * 60 + em); if (dur < 0) dur += 1440; dur -= interv;
          if (dur > 0) { cargaMin += dur; diasTrab++; }
        }
      } else {
        linhasJ.push(`<tr><td>${DIAS[d]}</td><td colspan="2" style="text-align:center;color:#94a3b8">Folga / descanso</td></tr>`);
      }
    }
    const horasSem = cargaMin / 60;
    jornadaHTML = `<table class="jt"><thead><tr><th>Dia</th><th>Entrada</th><th>Saída</th></tr></thead><tbody>${linhasJ.join("")}</tbody></table>
      <p class="obs">Intervalo para refeição e descanso: <b>${interv} minutos</b> por dia trabalhado. Carga horária semanal aproximada: <b>${Math.floor(horasSem)}h${String(Math.round((horasSem % 1) * 60)).padStart(2, "0")}</b> em ${diasTrab} dia(s), respeitado o limite legal de 44 horas semanais.</p>`;

    const remHTML = ehFree
      ? `<p>3.1. Pela prestação dos serviços, o(a) CONTRATADO(A) receberá o valor de <b>${fmtBRL(fixo)}</b> por diária efetivamente trabalhada, sem vínculo empregatício de natureza mensal.</p>`
      : `<p>3.1. O(A) EMPREGADO(A) perceberá salário mensal de <b>${fmtBRL(fixo)}</b>${va > 0 ? `, acrescido de vale-alimentação de <b>${fmtBRL(va)}</b>` : ""}${taxa > 0 ? `, além da participação na taxa de serviço estimada em <b>${fmtBRL(taxa)}</b>` : ""}, pago até o 5º dia útil do mês subsequente.</p>`;

    const titulo = ehFree ? "CONTRATO DE PRESTAÇÃO DE SERVIÇO (DIARISTA / EXTRA)" : "CONTRATO INDIVIDUAL DE TRABALHO";
    const experiencia = !ehFree && (f.status_contrato === "Experiência" || String(f.status_contrato || "").toLowerCase().includes("experi"));

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Contrato — ${esc(f.nome)}</title>
      <style>
        @page { size: A4 portrait; margin: 18mm; }
        body { font-family: 'Times New Roman', Georgia, serif; color: #0f172a; line-height: 1.55; font-size: 12.5px; }
        h1 { text-align: center; font-size: 17px; margin: 0 0 4px; text-transform: uppercase; }
        h2 { text-align: center; font-size: 12px; font-weight: normal; color: #475569; margin: 0 0 18px; }
        .clausula { margin: 12px 0 4px; font-weight: bold; text-transform: uppercase; font-size: 12px; }
        p { margin: 4px 0; text-align: justify; }
        .partes p { margin: 2px 0; }
        table.jt { width: 100%; border-collapse: collapse; margin: 6px 0; font-family: Arial, sans-serif; font-size: 11px; }
        table.jt th, table.jt td { border: 1px solid #cbd5e1; padding: 4px 8px; text-align: left; }
        table.jt th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; }
        .obs { font-size: 11px; color: #334155; }
        ul.filhos { margin: 2px 0 6px 18px; font-size: 11px; color: #334155; }
        .assinaturas { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
        .assinaturas div { flex: 1; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: 11px; }
        .test { margin-top: 30px; font-size: 11px; }
        .test div { border-top: 1px solid #94a3b8; margin-top: 26px; padding-top: 3px; }
      </style></head><body>
      <h1>${titulo}</h1>
      <h2>${empNome ? esc(empNome) : "Empregador"}${emp.cnpj ? " — CNPJ " + esc(emp.cnpj) : ""}</h2>

      <div class="partes">
        <p><b>EMPREGADOR(A):</b> ${linha(empNome)}, inscrita no CNPJ sob o nº ${linha(emp.cnpj)}, com estabelecimento em ${linha(emp.endereco || emp.cidade)}, doravante denominada CONTRATANTE.</p>
        <p><b>EMPREGADO(A):</b> ${linha(f.nome)}, portador(a) do CPF nº ${linha(f.cpf)}${f.data_nascimento ? `, nascido(a) em ${dataBR(f.data_nascimento)}` : ""}${f.cidade_nascimento ? `, natural de ${esc(f.cidade_nascimento)}` : ""}, residente em ${linha(f.endereco)}${f.cep ? `, CEP ${esc(f.cep)}` : ""}, doravante denominado(a) CONTRATADO(A).</p>
        ${(() => {
          const filhos = (f.filhos || []).filter(x => String(x?.nome || "").trim());
          if (!filhos.length) return f.tem_filhos ? `<p class="obs">Declara possuir ${esc(String(f.qtd_filhos || ""))} filho(s).</p>` : "";
          const itens = filhos.map(x => `<li>${esc(x.nome)}${x.cpf ? ` — CPF ${esc(x.cpf)}` : ""}</li>`).join("");
          return `<p class="obs">Filhos declarados (${filhos.length}):</p><ul class="filhos">${itens}</ul>`;
        })()}
      </div>

      <p>As partes acima identificadas têm, entre si, justo e acordado o presente contrato, que se regerá pelas cláusulas seguintes e pelas condições da <b>Consolidação das Leis do Trabalho (CLT)</b>.</p>

      <div class="clausula">Cláusula 1ª — Da função</div>
      <p>1.1. O(A) CONTRATADO(A) exercerá a função de <b>${linha(f.cargo)}</b>, comprometendo-se a desempenhar as atividades correlatas com zelo e assiduidade, no estabelecimento da CONTRATANTE.</p>

      <div class="clausula">Cláusula 2ª — Da jornada de trabalho</div>
      <p>2.1. A jornada semanal, conforme os dados cadastrais, é a seguinte:</p>
      ${jornadaHTML}

      <div class="clausula">Cláusula 3ª — Da remuneração</div>
      ${remHTML}

      <div class="clausula">Cláusula 4ª — Da vigência</div>
      <p>4.1. O presente contrato terá início em <b>${dataBR(f.data_admissao)}</b>${experiencia ? ", a título de <b>experiência</b>, pelo prazo de até 90 (noventa) dias, nos termos do art. 445, parágrafo único, da CLT, podendo ser prorrogado uma única vez dentro desse período." : ", por prazo indeterminado."}</p>

      <div class="clausula">Cláusula 5ª — Das obrigações</div>
      <p>5.1. O(A) CONTRATADO(A) obriga-se a cumprir as normas internas, o horário e as determinações da CONTRATANTE, zelando pelo patrimônio e pela higiene do ambiente de trabalho.</p>
      <p>5.2. Aplicam-se ao presente contrato todas as demais disposições da CLT e das convenções coletivas da categoria.</p>

      <p style="margin-top:18px">E, por estarem assim justos e contratados, firmam o presente em duas vias de igual teor.</p>
      <p style="text-align:right;margin-top:10px">${esc(emp.cidade || "")}${emp.cidade ? ", " : ""}____ de _______________ de ${new Date().getFullYear()}.</p>

      <div class="assinaturas">
        <div>${linha(f.nome)}<br/>Empregado(a)</div>
        <div>${linha(empNome)}<br/>Empregador(a)</div>
      </div>
      <div class="test">
        <div>Testemunha 1 — Nome / CPF</div>
        <div>Testemunha 2 — Nome / CPF</div>
      </div>
      </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para gerar o contrato.");
    win.document.write(comFecharImpressao(html));
    win.document.close();
    setTimeout(() => win.print(), 400);
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
    .filter(b => b.colaborador_id === colabId && (!b.tipo || b.tipo === "credito"))
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
    const creditos = bancoHoras.filter(b => b.colaborador_id === funcBanco.id && (!b.tipo || b.tipo === "credito"));
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

  // ── Ler a ficha do EXTRA preenchida à mão (foto) via IA e anexar ──────────
  const inputFichaExtraRef = useRef(null);
  const [lendoFichaExtra, setLendoFichaExtra] = useState(false);
  const lerFichaExtraFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLendoFichaExtra(true);
    try {
      const base64 = await comprimirFotoParaIA(file); // comprime: foto de celular estourava o limite da Vercel
      const resp = await fetchComSessao("/api/ia-ficha-extra", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagem_base64: base64, media_type: "image/jpeg" }) });
      const d = await resp.json();
      if (!resp.ok || d.error) { alert(d.error || "Falha ao ler a ficha."); return; }
      if (!confirm(`A IA leu na ficha:\n\nNome: ${d.nome}\nDiária: R$ ${(d.diaria || 0).toFixed(2)}\nTelefone: ${d.telefone || "—"}\nCPF: ${d.cpf || "—"}\nPIX: ${d.chave_pix || "—"}\n\nCadastrar como EXTRA e anexar a foto da ficha no sistema?`)) return;
      const jaExiste = funcionarios.find(f => (f.nome || "").toLowerCase() === d.nome.toLowerCase());
      let colabId = jaExiste?.id;
      if (!colabId) {
        const r = await inserirColaborador({ unidade_id: unidadeAtiva, nome: d.nome, cargo: "Extra", tipo_contrato: "Freelancer", salario: d.diaria || 0, telefone: d.telefone || null, cpf: d.cpf || null, chave_pix: d.chave_pix || null, dias_trabalho: "" });
        if (r.error || !r.data?.id) { alert("Erro ao cadastrar: " + (r.error || "desconhecido")); return; }
        colabId = r.data.id;
      }
      const up = await uploadDocumentoRH(colabId, file);
      alert(`${jaExiste ? `Ficha anexada em ${d.nome} (já estava cadastrado).` : `${d.nome} cadastrado como extra!`}${up?.error ? "\nAtenção: a foto não subiu (" + up.error + ")" : "\nFoto da ficha anexada nos documentos."}`);
      carregar();
    } catch { alert("Não consegui falar com a IA."); } finally { setLendoFichaExtra(false); }
  };

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
    // Pratos E drinks gerados pelas FICHAS TÉCNICAS (Catálogo e Preços) +
    // itens cadastrados direto no cardápio — sem duplicar pelo nome.
    const [rProd, rCard] = await Promise.all([fetchProdutos(unidadeAtiva), fetchCardapio(unidadeAtiva)]);
    const itens = [];
    const vistos = new Set();
    (rProd.data || []).forEach(x => {
      const chave = String(x.nome_produto || "").toLowerCase().trim();
      if (!chave || vistos.has(chave)) return;
      vistos.add(chave);
      itens.push({ id: `p-${x.id}`, nome: x.nome_produto, preco: x.preco_venda, categoria: x.categoria || (String(x.departamento).toLowerCase() === "bar" ? "Drinks" : "Pratos") });
    });
    (rCard.data || []).filter(p => p.ativo !== false).forEach(x => {
      const chave = String(x.nome || "").toLowerCase().trim();
      if (!chave || vistos.has(chave)) return;
      vistos.add(chave);
      itens.push({ id: `c-${x.id}`, nome: x.nome, preco: x.preco, categoria: x.categoria });
    });
    itens.sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
    setCardapioConsumo(itens);
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


  const formatarCPF = (valor) => {
    if (!valor) return "—";
    const num = String(valor).replace(/\D/g, "");
    if (num.length === 11) {
      return num.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return valor;
  };

  const formatarEnderecoComp = (d, f) => {
    const rua = (d?.rua_av || f?.rua_av || "").trim();
    const num = (d?.numero_casa || f?.numero_casa || "").trim();
    const bai = (d?.bairro || f?.bairro || "").trim();
    const cid = (d?.cidade_uf || f?.cidade_uf || "").trim();
    if (rua || num || bai) {
      const p = [];
      if (rua) p.push(rua);
      if (num) p.push(`Nº ${num}`);
      if (bai) p.push(`Bairro: ${bai}`);
      if (cid) p.push(cid);
      return p.join(" · ");
    }
    return (d?.endereco || f?.endereco || "—").trim();
  };

  const imprimirFichaExtra = (funcionario, opcoes = {}) => {
    const dados = opcoes.dados || {};
    const diariaTotal = parseFloat(String(opcoes.diaria ?? (funcionario?.salario || "")).replace(",", ".")) || 0;
    const dias = Math.max(1, Number(opcoes.dias) || 1);
    const totalGeral = diariaTotal * dias;
    const valeTransporte = parseFloat(String(dados.vale_transporte || "").replace(",", ".")) || 0;
    const adicional = parseFloat(String(dados.adicional || "").replace(",", ".")) || 0;
    const descontos = parseFloat(String(dados.descontos || "").replace(",", ".")) || 0;
    const totalPagar = opcoes.recibo?.valor_total ?? Math.max(0, totalGeral + valeTransporte + adicional - descontos);
    const reciboNumero = opcoes.numero || opcoes.recibo?.numero || `RPS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(funcionario?.id || Date.now()).slice(-6).toUpperCase()}`;

    const reciboMontado = opcoes.recibo || {
      numero: reciboNumero,
      data_trabalho: dados.data_trabalho || new Date().toISOString().slice(0, 10),
      datas_contratadas: Array.isArray(dados.datas_contratadas) && dados.datas_contratadas.length
        ? dados.datas_contratadas
        : [dados.data_trabalho || new Date().toISOString().slice(0, 10)],
      dias_contratados: dias,
      valor_diaria: diariaTotal,
      valor_total: totalPagar,
      pagamento_realizado: dados.pagamento_realizado !== false,
      data_pagamento: dados.data_pagamento || new Date().toISOString().slice(0, 10),
      forma_pagamento: dados.forma_pagamento || "Pix",
      hora_entrada: dados.entrada || funcionario?.horario_entrada || null,
      hora_saida: dados.saida_final || dados.saida || funcionario?.horario_saida || null,
      funcao: dados.funcao || funcionario?.cargo || "Colaborador",
      itens: Array.isArray(opcoes.itens) ? opcoes.itens : [],
      dados,
    };

    return imprimirReciboExtra({
      extra: funcionario,
      funcionario,
      recibo: reciboMontado,
      unidade: unidadeInfo,
      unidadeInfo,
      unidadeNome: unidadeInfo?.nome,
    });
  };

  const imprimirPerfilFuncionario = (f) => {
    const esc = valor => String(valor ?? "").replace(/[&<>"']/g, caractere => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[caractere]));
    const seguro = valor => esc(String(valor ?? "").trim() || "Não informado");
    const dataBR = valor => {
      if (!valor) return "Não informado";
      const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
      return ano && mes && dia ? `${dia}/${mes}/${ano}` : seguro(valor);
    };
    const simNao = valor => valor ? "Sim" : "Não";
    const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const diasTrabalho = String(f.dias_trabalho || "").split(",").filter(Boolean).map(dia => dias[Number(dia)]).filter(Boolean).join(", ") || "Não informado";
    const filhos = Array.isArray(f.filhos) ? f.filhos.filter(item => item?.nome) : [];
    const foto = f.foto ? `<img class="foto" src="data:image/jpeg;base64,${f.foto}" alt="Foto"/>` : `<div class="foto vazia">${esc((f.nome || "?")[0].toUpperCase())}</div>`;
    const campo = (rotulo, valor) => `<div class="campo"><span>${esc(rotulo)}</span><strong>${seguro(valor)}</strong></div>`;
    const secao = (titulo, conteudo) => `<section><h2>${esc(titulo)}</h2><div class="grade">${conteudo}</div></section>`;
    const salario = f.tipo_contrato === "Freelancer" ? `${fmtBRL(f.salario)} / diária` : fmtBRL(f.salario);
    const domingoDiferente = !!(f.horario_dom_entrada && f.horario_dom_saida)
      && (f.horario_dom_entrada !== f.horario_entrada || f.horario_dom_saida !== f.horario_saida);
    const campoHorarioDomingo = domingoDiferente
      ? campo("Horário de domingo", `${f.horario_dom_entrada} às ${f.horario_dom_saida}`)
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Perfil - ${esc(f.nome)}</title><style>
      @page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,sans-serif;color:#172033;font-size:10px;line-height:1.25}.pagina{width:100%;max-height:281mm;overflow:hidden}.cab{display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:13px;background:linear-gradient(135deg,#064e3b,#059669);color:white}.foto{width:66px;height:66px;flex:0 0 66px;border-radius:14px;object-fit:cover;border:2px solid rgba(255,255,255,.8)}.foto.vazia{display:grid;place-items:center;background:#d1fae5;color:#065f46;font-size:28px;font-weight:900}.cab h1{font-size:22px;line-height:1.05;margin:0 0 4px}.cab p{margin:1px 0;opacity:.9}.selo{margin-left:auto;text-align:right;font-size:7.5px;line-height:1.5;text-transform:uppercase;letter-spacing:.07em}.conteudo{display:grid;grid-template-columns:1fr 1fr;align-items:start;gap:0 14px}.coluna{min-width:0}section{margin-top:9px;break-inside:avoid}h2{margin:0 0 4px;padding:5px 7px;border-left:3px solid #10b981;border-radius:0 6px 6px 0;background:#ecfdf5;color:#065f46;font-size:9px;line-height:1.15;text-transform:uppercase;letter-spacing:.07em}.grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 9px}.campo{min-width:0;min-height:34px;padding:4px 2px;border-bottom:1px solid #d5dbe3}.campo span{display:block;color:#64748b;font-size:7.5px;font-weight:800;line-height:1.15;text-transform:uppercase;letter-spacing:.035em}.campo strong{display:block;margin-top:2px;font-size:10px;line-height:1.22;overflow-wrap:anywhere}.rodape{margin-top:10px;padding-top:5px;border-top:1px solid #cbd5e1;color:#64748b;font-size:7.5px;text-align:center}@media print{html,body{width:100%;height:auto;overflow:hidden}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.pagina{break-after:avoid;page-break-after:avoid}}
    </style></head><body><main class="pagina"><header class="cab">${foto}<div><h1>${seguro(f.nome)}</h1><p>${seguro(f.cargo)}</p><p>${seguro(f.tipo_contrato)} · ${seguro(f.status_contrato)}</p></div><div class="selo"><b>Perfil do colaborador</b><br/>${seguro(unidadeInfo?.nome || nomeDaCasa)}<br/>Emitido em ${new Date().toLocaleDateString("pt-BR")}</div></header>
    <div class="conteudo"><div class="coluna">
      ${secao("Contato e identificação", campo("Nome completo", f.nome) + campo("Telefone", f.telefone) + campo("E-mail", f.email) + campo("CPF", formatarCPF(f.cpf)) + campo("RG", f.rg) + campo("Data de nascimento", dataBR(f.data_nascimento)) + campo("Gênero", f.genero) + campo("Estado civil", f.estado_civil) + campo("Escolaridade", f.escolaridade) + campo("Cidade de nascimento", f.cidade_nascimento))}
      ${secao("Endereço", campo("Rua / Avenida", f.rua_av || f.endereco) + campo("Número", f.numero_casa) + campo("Bairro", f.bairro) + campo("Cidade / UF", f.cidade_uf) + campo("CEP", f.cep))}
    </div><div class="coluna">
      ${secao("Contrato e valores", campo("Cargo", f.cargo) + campo("Tipo de contrato", f.tipo_contrato) + campo("Status do contrato", f.status_contrato) + campo("Data de admissão", dataBR(f.data_admissao)) + campo("Salário / diária", salario) + campo("Vale-alimentação", fmtBRL(f.vale_alimentacao)) + campo("Taxa de serviço mensal", fmtBRL(f.taxa_servico_mes)) + campo("Chave Pix", f.chave_pix))}
      ${secao("Jornada", campo("Dias de trabalho", diasTrabalho) + campo("Horário padrão", `${f.horario_entrada || "—"} às ${f.horario_saida || "—"}`) + campo("Intervalo", `${f.intervalo_inicio || "—"} às ${f.intervalo_fim || "—"} (${f.tempo_intervalo || 60} min)`) + campoHorarioDomingo)}
      ${secao("Família e transporte", campo("Nome da mãe", f.nome_mae) + campo("Nome do pai", f.nome_pai) + campo("Filhos", filhos.length ? filhos.map(item => `${item.nome}${item.data_nascimento ? ` (${dataBR(item.data_nascimento)})` : ""}`).join("; ") : "Nenhum informado") + campo("Possui transporte", simNao(f.tem_transporte)) + campo("Tipo de transporte", f.tipo_transporte) + campo("Usa vale-transporte", simNao(f.usa_vale_transporte)))}
    </div></div><div class="rodape">Documento interno e confidencial · Perfil gerado pelo Hefisto</div></main></body></html>`;
    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para abrir o perfil.");
    win.document.write(comFecharImpressao(html));
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  // O AFD é registro de ponto legal, com CPF: a rota exige sessão desde a
  // correção SEC-RH-1.1. Um <a href> não manda o token, então a busca é feita
  // aqui e o arquivo é entregue pelo Blob.
  const [baixandoAfd, setBaixandoAfd] = useState(false);
  const exportarAFD = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      return alert("Selecione uma unidade específica no menu lateral para exportar o AFD dela.");
    }
    setBaixandoAfd(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) { alert("Sua sessão expirou. Entre novamente para exportar."); return; }

      const resposta = await fetch(`/exportar-afd?unidadeId=${encodeURIComponent(unidadeAtiva)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resposta.ok) {
        const motivo = await resposta.text().catch(() => "");
        alert(resposta.status === 403
          ? "Você não tem acesso aos dados desta unidade."
          : motivo || `Não foi possível exportar (HTTP ${resposta.status}).`);
        return;
      }

      // O nome do arquivo vem do Content-Disposition, que segue a portaria.
      const disp = resposta.headers.get("content-disposition") || "";
      const nome = (disp.match(/filename="?([^"]+)"?/) || [])[1] || `AFD-${unidadeAtiva}.txt`;
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (erro) {
      alert("Falha ao exportar o AFD: " + (erro?.message || "erro desconhecido"));
    } finally {
      setBaixandoAfd(false);
    }
  };

  const compartilharLinkAtualizacao = async (f) => {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (!accessToken) return alert("Sua sessão expirou. Entre novamente para gerar o link.");
      const resposta = await fetch("/api/rh/perfil-compartilhado", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ colaboradorId: f.id }),
      });
      const resultado = await resposta.json();
      if (!resposta.ok || !resultado.url) return alert(resultado.error || "Não foi possível gerar o link.");
      const texto = `${f.nome}, use este link seguro para conferir e atualizar seus dados no RH. Ele vale por 30 dias: ${resultado.url}`;
      if (navigator.share) {
        try { await navigator.share({ title: "Atualização de cadastro do RH", text: texto, url: resultado.url }); return; } catch (erro) { if (erro?.name === "AbortError") return; }
      }
      await navigator.clipboard.writeText(texto);
      alert("Link copiado. Agora é só colar no WhatsApp ou enviar como preferir.");
    } catch (erro) {
      alert("Não foi possível compartilhar o link: " + (erro?.message || "tente novamente"));
    }
  };

  const abrirModalNovo = () => {
    setEditandoId(null);
    limparEstadoCadastro();
    setNovoFunc(statePadrao);
    setModoAssistente(true);
    setModalNovo(true);
  };

  const irSecaoCadastro = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    // Extra tem cadastro próprio, em página separada do funcionário fixo.
    if (f?.tipo_contrato === "Freelancer") { router.push(`/dashboard/rh/extra/${f.id}`); return; }
    setEditandoId(f.id);
    limparEstadoCadastro();
    setNovoFunc(formularioDeEdicao(f));
    setModoAssistente(false);
    setModalNovo(true);
  };

  const handleSalvar = async ({ ignorarHomonimo = false } = {}) => {
    if (salvandoCadastro) return; // duplo clique não grava duas vezes
    const validacao = validarCadastro(novoFunc);
    setErrosCadastro(validacao.erros);
    setErroSalvar("");
    if (!validacao.ok) return;
    // Mesma pessoa já cadastrada (inclusive desligada): abre o cadastro dela em vez de criar outro.
    const dup = acharDuplicado(novoFunc, funcionarios, editandoId);
    if (dup && !(dup.motivo === "nome_telefone" && ignorarHomonimo)) { setDuplicado(dup); return; }
    setDuplicado(null);
    
    const payload = {
      unidade_id: unidadeAtiva,
      nome: novoFunc.nome,
      cargo: novoFunc.cargo,
      salario: Number(novoFunc.salario) || 0,
      horario_entrada: novoFunc.horario_entrada,
      horario_saida: novoFunc.horario_saida,
      horario_dom_entrada: novoFunc.horario_dom_entrada || null,
      horario_dom_saida: novoFunc.horario_dom_saida || null,
      horario_por_dia: !!novoFunc.horario_por_dia,
      horarios_dia: novoFunc.horario_por_dia ? (novoFunc.horarios_dia || {}) : null,
      // No modo por-dia, os dias de trabalho (para folga) são os dias com horário preenchido.
      dias_trabalho: novoFunc.horario_por_dia
        ? Object.entries(novoFunc.horarios_dia || {}).filter(([, h]) => h && h.e && h.s).map(([d]) => d).sort().join(",")
        : novoFunc.dias_trabalho,
      tempo_intervalo: Number(novoFunc.tempo_intervalo) || 60,
      intervalo_inicio: novoFunc.intervalo_inicio || null,
      intervalo_fim: novoFunc.intervalo_fim || null,
      intervalo_dom_inicio: novoFunc.intervalo_dom_inicio || null,
      intervalo_dom_fim: novoFunc.intervalo_dom_fim || null,
      tipo_contrato: novoFunc.tipo_contrato,
      telefone: novoFunc.telefone,
      email: novoFunc.email || null,
      cpf: novoFunc.cpf,
      rg: novoFunc.rg || null,
      rua_av: novoFunc.rua_av || null,
      numero_casa: novoFunc.numero_casa || null,
      bairro: novoFunc.bairro || null,
      cidade_uf: novoFunc.cidade_uf || null,
      chave_pix: novoFunc.chave_pix,
      // Textos do recibo guardados no cadastro (migram sozinhos para o recibo)
      topicos_funcao: novoFunc.topicos_funcao || null,
      itens_emprestados: novoFunc.itens_emprestados || null,
      forma_pagamento: novoFunc.forma_pagamento || null,
      vale_transporte_val: novoFunc.vale_transporte_val === "" ? null : Number(novoFunc.vale_transporte_val),
      setor_entrega: novoFunc.setor_entrega || null,
      janta_ofertada: novoFunc.janta_ofertada !== false,
      avaliacao_estrelas: Number(novoFunc.avaliacao_estrelas) || 0,
      data_admissao: novoFunc.data_admissao || null,
      status_contrato: novoFunc.status_contrato,
      supervisor_id: (novoFunc.supervisores_ids && novoFunc.supervisores_ids[0]) || novoFunc.supervisor_id || null,
      supervisores_ids: novoFunc.supervisores_ids && novoFunc.supervisores_ids.length ? novoFunc.supervisores_ids : null,
      vale_alimentacao: Number(novoFunc.vale_alimentacao) || 0,
      taxa_servico_mes: Number(novoFunc.taxa_servico_mes) || 0,
      endereco: novoFunc.endereco || null,
      cep: novoFunc.cep || null,
      cidade_nascimento: novoFunc.cidade_nascimento || null,
      nome_pai: novoFunc.nome_pai || null,
      nome_mae: novoFunc.nome_mae || null,
      filhos: (novoFunc.filhos || []).filter(x => String(x?.nome || "").trim()),
      data_nascimento: novoFunc.data_nascimento || null,
      // Derivados da lista: manter checkbox e contador separados criava o
      // clássico "diz que tem 2 filhos e cadastrou 3". A lista é a verdade.
      tem_filhos: (novoFunc.filhos || []).some(x => String(x?.nome || "").trim()),
      qtd_filhos: (novoFunc.filhos || []).filter(x => String(x?.nome || "").trim()).length || null,
      tipo_transporte: novoFunc.tem_transporte ? (novoFunc.tipo_transporte || null) : null,
      pontos_taxa: novoFunc.pontos_taxa === "" ? null : Number(novoFunc.pontos_taxa),
      tem_transporte: !!novoFunc.tem_transporte,
      usa_vale_transporte: !!novoFunc.usa_vale_transporte,
      genero: novoFunc.genero || null,
      escolaridade: novoFunc.escolaridade || null,
      estado_civil: novoFunc.estado_civil || null,
      foto: novoFunc.foto || null
    };

    let colaboradorSalvo = null;
    const cadastroNovo = !editandoId;
    setSalvandoCadastro(true);
    try {
      if (editandoId) {
        const { error, colunasIgnoradas } = await atualizarColaborador(editandoId, payload);
        if (error) { setErroSalvar("Não foi possível salvar as alterações: " + error); return; }
        if (colunasIgnoradas?.length) alert("Salvo, mas estes campos ainda não existem no banco e não foram gravados: " + colunasIgnoradas.join(", "));
      } else {
        const { data, error } = await inserirColaborador(payload);
        if (error) { setErroSalvar("Não foi possível cadastrar: " + error); return; }
        colaboradorSalvo = data || payload;
      }
    } finally {
      setSalvandoCadastro(false);
    }
    limparEstadoCadastro();
    if (cadastroNovo) limparRascunhoCadastro(unidadeAtiva);
    setVersaoQuadro((v) => v + 1);
    
    setModalNovo(false);
    setEditandoId(null);
    setNovoFunc(statePadrao);
    await carregar();
    if (cadastroNovo && payload.tipo_contrato === "Freelancer") {
      abrirModalFicha(colaboradorSalvo || payload);
    }
  };

  // Desligamento & Aviso Prévio — a vida do funcionário fica preservada
  const [modalDeslig, setModalDeslig] = useState(false);
  const [funcDeslig, setFuncDeslig] = useState(null);
  const [desligForm, setDesligForm] = useState({
    modo: "aviso", // 'aviso' ou 'imediato'
    data: new Date().toISOString().split("T")[0],
    inicio_aviso: new Date().toISOString().split("T")[0],
    dias_aviso: "27",
    tipo_aviso: "Trabalhado",
    tipo: "Demissão sem justa causa",
    motivo: "",
  });

  // O prontuário (/dashboard/rh/funcionario/[id]) chama Editar e Desligar pelo
  // endereço: ?editar=<id> ou ?desligar=<id>. Abre uma vez, quando o quadro carrega.
  const pedidoDaUrl = useRef(false);
  useEffect(() => {
    const editarId = searchParams.get("editar"), desligarId = searchParams.get("desligar");
    if ((!editarId && !desligarId) || pedidoDaUrl.current || !funcionarios.length) return;
    const alvo = funcionarios.find((x) => x.id === (editarId || desligarId));
    if (!alvo) return;
    pedidoDaUrl.current = true;
    if (editarId) abrirModalEdicao(alvo); else abrirDesligamento(alvo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarios, searchParams]);

  const abrirDesligamento = (f) => {
    setFuncDeslig(f);
    const hj = new Date().toISOString().split("T")[0];
    const emAviso = f.em_aviso_previo || f.status_aviso === "cumprindo_aviso";
    setDesligForm({
      modo: emAviso ? "imediato" : "aviso",
      data: hj,
      inicio_aviso: f.inicio_aviso_previo || hj,
      dias_aviso: String(f.dias_aviso_previo || 27),
      tipo_aviso: f.tipo_aviso_previo || "Trabalhado",
      tipo: f.tipo_desligamento || "Demissão sem justa causa",
      motivo: f.motivo_desligamento || "",
    });
    setModalDeslig(true);
  };

  const confirmarDesligamento = async (e) => {
    e.preventDefault();
    if (!funcDeslig?.id) return;
    if (desligForm.modo === "aviso") {
      const { error } = await registrarAvisoPrevio(funcDeslig.id, {
        inicio_aviso: desligForm.inicio_aviso,
        dias_aviso: Number(desligForm.dias_aviso) || 30,
        tipo_aviso: desligForm.tipo_aviso,
        motivo: desligForm.motivo,
      });
      if (error) return alert("Erro ao registrar aviso prévio: " + error);
      alert(`Aviso prévio registrado para ${funcDeslig.nome}! O colaborador permanecerá na lista da equipe cumprindo os ${desligForm.dias_aviso} dias.`);
    } else {
      const { error } = await desligarColaborador(funcDeslig.id, {
        data_desligamento: desligForm.data,
        tipo_desligamento: desligForm.tipo,
        motivo_desligamento: desligForm.motivo,
      });
      if (error) return alert("Erro ao desligar: " + error);
      alert(`${funcDeslig.nome} foi desligado(a) e movido(a) para o arquivo de Ex-funcionários.`);
    }
    setModalDeslig(false);
    carregar();
  };

  const handleCancelarAviso = async (f) => {
    if (!confirm(`Cancelar o aviso prévio de ${f.nome} e mantê-lo(a) normalmente na equipe?`)) return;
    const { error } = await cancelarAvisoPrevio(f.id);
    if (error) alert("Erro: " + error);
    else carregar();
  };

  // "Apagar definitivamente" saiu (RH-B1): o DELETE em colaboradores apaga em
  // cascata o registro_ponto, as folgas, o banco de horas e as advertências —
  // registro de ponto é obrigação legal. Quem sai da casa é desligado.

  const calcularProgresso = (f) => {
     if (f.tipo_contrato !== "Fixo" || !f.data_admissao) return null;
     const badges = [];
     const dAdm = new Date(f.data_admissao + "T12:00:00Z");
     const hj = new Date();
     hj.setHours(0,0,0,0);
     dAdm.setHours(0,0,0,0);
     
     // Aviso Prévio em andamento
     const av = situacaoAvisoPrevio(f, hj);
     if (av) {
        if (av.concluido) {
           badges.push({ text: `Aviso Prévio Concluído (${av.diasTotal}d) · Finalizar Desligamento`, color: 'text-rose-800 bg-rose-100 border-rose-300 font-black animate-pulse' });
        } else {
           badges.push({ text: `Cumprindo Aviso Prévio (${av.diasTotal} dias) · Faltam ${av.diasRestantes} dia(s) (Término ${av.fimPrevisto.toLocaleDateString("pt-BR")})`, color: 'text-amber-800 bg-amber-100 border-amber-300 font-bold' });
        }
     }
     
     const diffDias = Math.floor((hj - dAdm) / (1000 * 60 * 60 * 24));
     const anoAtual = hj.getFullYear();
     
     // Tempo de casa: aparece para todo mundo, em experiência ou efetivo.
     const casa = tempoDeCasa(f, hj);
     if (casa) badges.push({ text: `${casa.texto} de ${nomeDaCasa}`, color: 'text-fg-soft bg-card border-line' });

     // Aniversário próximo (ou hoje) — o RH costuma querer lembrar.
     const aniv = aniversario(f, hj);
     if (aniv?.ehHoje) badges.push({ text: `Aniversário hoje (${aniv.idade} anos)`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' });
     else if (aniv && aniv.faltam <= 15) badges.push({ text: `Aniversário em ${aniv.faltam} dia(s) · ${aniv.diaMes}`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' });

     if (emExperiencia(f)) {
        const s = situacaoExperiencia(f, hj);
        if (s && !s.erro) {
           if (s.efetivadoAutomatico) {
              badges.push({ text: `Contrato Definitivo (Efetivado após 90 dias)`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' });
           } else if (s.vencido) {
              badges.push({ text: `Experiência encerrada — efetive ou desligue`, color: 'text-rose-700 bg-rose-50 border-rose-200' });
           } else {
              const cor = s.decidirAgora ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-emerald-800 bg-emerald-50 border-emerald-200';
              badges.push({ text: `Experiência ${s.periodo}º período (${s.prazo}d) · faltam ${s.diasRestantes} dia(s)`, color: cor });
           }
        }
     } else if (f.status_contrato === "Definitivo") {
        let prox = new Date(dAdm);
        prox.setFullYear(anoAtual);
        if (hj > prox) prox.setFullYear(anoAtual + 1);
        const faltamFerias = Math.floor((prox - hj) / (1000 * 60 * 60 * 24));
        badges.push({ text: `1 Ano em ${faltamFerias} dias`, color: 'text-zinc-700 bg-zinc-100 border-zinc-200' });
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
          // Conta nasce pendente: o pagamento é registrado em Contas a Pagar com a data real.
          const { error } = await salvarConta({
             unidade_id: unidadeAtiva,
             descricao: `${labelLabel}: ${f.nome} - ${f.cargo}`,
             valor: f.salario,
             data_vencimento: hojeLocal(),
             competencia: hojeLocal().slice(0, 7),
             categoria_codigo: 'pessoal_salarios',
          }, { chave: novaChave(), origem_tipo: 'RH' });
          if (error) alert("Não foi possível lançar no Financeiro: " + error);
          else alert("Lançado em Contas a Pagar como PENDENTE. Registre o pagamento lá, com a data real.");
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
     const hoje = hojeLocal();
     
     const l = [
       { label: "Diária Base", val: parseFloat(formLancamento.fixo) },
       { label: "INSS", val: parseFloat(formLancamento.inss) },
       { label: "FGTS", val: parseFloat(formLancamento.fgts) },
       { label: "Taxa de Serviço", val: parseFloat(formLancamento.taxa) }
     ];
     
     let sucessos = 0;
     const falhas = [];
     const chaveLote = novaChave();
     const CATEGORIA_ITEM = { "Diária Base": "pessoal_extras", "INSS": "pessoal_encargos", "FGTS": "pessoal_encargos", "Taxa de Serviço": "pessoal_taxa_servico" };
     for (let item of l) {
        if (item.val && item.val > 0) {
           // Conta nasce pendente; o pagamento é registrado em Contas a Pagar com a data real.
           const { error } = await salvarConta({
              unidade_id: unidadeAtiva,
              descricao: `${item.label} (Extra): ${f.nome} - ${f.cargo}`,
              valor: item.val,
              data_vencimento: hoje,
              competencia: hoje.slice(0, 7),
              categoria_codigo: CATEGORIA_ITEM[item.label] || 'pessoal_extras',
           }, { chave: `${chaveLote}:${item.label}`, origem_tipo: 'RH' });
           if (error) falhas.push(`${item.label}: ${error}`); else sucessos++;
        }
     }
     alert(`${sucessos} conta(s) lançada(s) como PENDENTE em Contas a Pagar.${falhas.length ? `\n\n${falhas.length} NÃO foram lançadas:\n${falhas.join("\n")}` : ""}`);
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
     
     // Domingos do mês passado até 5 semanas à frente: a folga do mês que já
     // passou também pode ser lançada (pede confirmação ao gravar).
     setMesesDeDomingo(domingosParaFolga(hojeLocal()));

     const res = await fetchFolgasEsporadicas(f.id);
     setFolgasEsporadicas(res.data || []);
     
     const resTodas = await fetchAllFolgasDaUnidade(unidadeAtiva);
     setTodasFolgasDaUnidade(resTodas.data || []);
  };
  
  const handleAdicionarFolga = async (dataAdicionar, descricao) => {
     if(!dataAdicionar) return;
     if (folgasEsporadicas.some(f => String(f.data_folga).slice(0, 10) === dataAdicionar)) return alert(`${funcParaFolgas.nome} já tem folga em ${dataCurta(dataAdicionar)}.`);
     // Data passada vale (folga do mês que passou), mas confirma antes: diz o
     // que muda no espelho e avisa se a pessoa bateu ponto nesse dia.
     const hoje = hojeLocal();
     const { data: pontoDoDia } = dataAdicionar <= hoje ? await fetchPontoDoDia(funcParaFolgas.id, dataAdicionar) : { data: null };
     const avisos = avisosDaFolga({
        data: dataAdicionar, hoje, nome: funcParaFolgas.nome, folgas: folgasEsporadicas, pontoDoDia,
        horaLocal: (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
        genero: funcParaFolgas.genero,
     });
     if (avisos.length && !confirm(`${avisos.join("\n\n")}\n\nLançar a folga de ${dataCurta(dataAdicionar)} mesmo assim?`)) return;
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
      <RhNav />
      <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadFile} accept=".pdf,.png,.jpg,.jpeg" />
      
      {abaModulo === "quadro" && <VisaoColaboradores onEditar={abrirModalEdicao} onNovo={abrirModalNovo} onDesligar={abrirDesligamento} versao={versaoQuadro}
        // O menu de ações (banco de horas, folgas, vales, advertências, documentos)
        // ficou sem botão quando a lista da Visão Geral saiu: abre pelo perfil do Quadro.
        onAcoes={(c) => { setAbaMenuAcoes("trabalho"); setMenuAcoes(funcionarios.find((x) => x.id === c.id) || c); }} />}
      {abaModulo === "escala" && <VisaoSemana />}
      {abaModulo === "visao" && (
        <>
          <PainelRH
            unidadeAtiva={unidadeAtiva} unidadeInfo={unidadeInfo} funcionarios={funcionarios}
            pontosHoje={pontosHoje} folgasUnidade={folgasUnidade} atestadosMes={atestadosMes}
            pontosMesUnidade={pontosMesUnidade} lancamentos={lancamentos} paramsSis={paramsSis}
            convencao={convencao} previsaoDe={previsaoDe}
            onNovo={abrirModalNovo} onFaltas={imprimirFaltasAtrasos} onFeriados={abrirModalFeriados}
            onAfd={exportarAFD} baixandoAfd={baixandoAfd}
            onReciboExtra={() => abrirModalFicha(null)}
            onAcoes={(c) => { setAbaMenuAcoes("trabalho"); setMenuAcoes(funcionarios.find((x) => x.id === c.id) || c); }}
          />
          {/* Ler recibo preenchido (IA): mesmo fluxo de antes, agora sempre à mão. */}
          <div className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
            <input ref={inputFichaExtraRef} type="file" accept="image/*" onChange={lerFichaExtraFoto} className="hidden" />
            <button type="button" onClick={() => inputFichaExtraRef.current?.click()} disabled={lendoFichaExtra}
              title="Foto de um recibo de extra preenchido: a IA lê os dados e anexa a foto ao cadastro"
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-white disabled:opacity-60">
              {lendoFichaExtra ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Ler recibo de extra preenchido (IA)
            </button>
          </div>
        </>
      )}

      {/* Modais e menus do RH: fora do bloco da Visão Geral para abrirem em qualquer aba
          (o Editar do perfil, na aba Quadro, não abria nada porque o modal só existia na Visão Geral). */}

      {/* MENU DE AÇÕES DO FUNCIONÁRIO — uma categoria por vez para ficar compacto */}
      {menuAcoes && (() => {
         const f = menuAcoes;
         const fechar = () => setMenuAcoes(null);
         const ir = (fn) => { fechar(); fn(); };
         const tb = totalBancoDe(f.id);
         const critico = tb >= BANCO_LIMITE_MIN, alerta = tb >= BANCO_ALERTA_MIN;
         const Acao = ({ icon: Icon, cor = "text-fg-soft", bg = "bg-white group-hover:bg-card", onClick, children, extra }) => (
            <button onClick={onClick} className="group flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border border-line bg-card px-2.5 py-2 text-left transition-all hover:border-slate-300 hover:shadow-sm sm:min-h-[56px] sm:rounded-2xl sm:px-3">
               <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${bg} ${cor}`}><Icon size={17}/></span>
               <span className={`min-w-0 flex-1 text-[13px] font-black leading-tight sm:text-sm ${cor}`}>{children}</span>
               {extra}
            </button>
         );
         const abas = [
            ["trabalho", "Trabalho", Clock],
            ["financeiro", "Financeiro", CreditCard],
            ["documentos", "Documentos", FileText],
            ["gestao", "Gestão", ClipboardList],
         ];
         return (
         <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/65 px-0 pb-0 backdrop-blur-sm sm:items-center sm:p-3" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }} onClick={fechar}>
            <div className="flex max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-0.75rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl sm:max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] sm:rounded-[28px]" onClick={e => e.stopPropagation()}>
               <div className="flex shrink-0 items-center gap-2.5 bg-gradient-to-br from-hf-surface to-hf-elevated px-4 py-3 text-white sm:gap-3 sm:px-5 sm:py-4">
                  {f.foto
                     ? <img src={`data:image/jpeg;base64,${f.foto}`} alt="" className="h-10 w-10 shrink-0 rounded-xl border-2 border-hf-border object-cover sm:h-12 sm:w-12 sm:rounded-2xl"/>
                     : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-hf-elevated text-lg font-black sm:h-12 sm:w-12 sm:rounded-2xl sm:text-xl">{(f.nome || "?")[0].toUpperCase()}</span>}
                  <div className="min-w-0 flex-1">
                     <p className="text-3xs font-bold uppercase tracking-[.16em] text-emerald-700 sm:text-3xs">Ações do colaborador</p>
                     <h2 className="truncate text-base font-black sm:text-lg">{f.nome}</h2>
                     <p className="truncate text-3xs font-bold text-dim sm:text-2xs">{f.cargo || "Sem cargo informado"}</p>
                  </div>
                  <button onClick={fechar} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-hf-elevated text-hf-text hover:bg-hf-border"><X size={17}/></button>
               </div>

               <nav className="grid shrink-0 grid-cols-4 gap-1 border-b border-line bg-card p-1.5 sm:p-2">
                  {abas.map(([id, rotulo, Icone]) => (
                     <button key={id} onClick={() => setAbaMenuAcoes(id)} className={`flex min-h-10 items-center justify-center gap-1 rounded-lg px-1 text-3xs font-bold transition-colors sm:min-h-11 sm:rounded-xl sm:text-3xs ${abaMenuAcoes === id ? "bg-slate-900 text-white shadow-sm" : "text-fg hover:bg-card"}`}>
                        <Icone size={15}/><span className="truncate">{rotulo}</span>
                     </button>
                  ))}
               </nav>

               <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2.5 sm:p-4">
                  {abaMenuAcoes === "trabalho" && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                     <Acao icon={Clock} onClick={() => ir(() => router.push(`/dashboard/rh/espelho/${f.id}?mes=${new Date().toISOString().slice(0,7)}`))}>Espelho de Ponto</Acao>
                     <Acao icon={Clock} cor="text-emerald-700" bg="bg-emerald-50 group-hover:bg-emerald-100" onClick={() => ir(() => router.push(`/dashboard/rh/ponto/corrigir?colab=${f.id}&data=${new Date().toISOString().slice(0,10)}`))}>Ajustar / Corrigir Ponto</Acao>
                     <Acao icon={Clock} cor={critico ? "text-red-700" : alerta ? "text-amber-700" : "text-zinc-700"} bg={critico ? "bg-red-50 group-hover:bg-red-100" : alerta ? "bg-amber-50 group-hover:bg-amber-100" : "bg-zinc-100 group-hover:bg-zinc-100"}
                        onClick={() => ir(() => abrirModalBanco(f))}
                        extra={tb > 0 && <span className="shrink-0 rounded-lg bg-card px-2 py-1 text-3xs font-bold text-fg-soft">{fmtMin(tb)}{critico ? "!" : ""}</span>}>
                        Banco de Horas
                     </Acao>
                     <Acao icon={CalendarHeart} cor="text-rose-600" bg="bg-rose-50 group-hover:bg-rose-100" onClick={() => ir(() => abrirModalFolgas(f))}>Folgas e Domingos</Acao>
                     <Acao icon={Award} cor="text-emerald-700" bg="bg-zinc-100 group-hover:bg-zinc-100" onClick={() => ir(() => router.push(`/dashboard/rh/funcionario/${f.id}`))}>Prontuário (carreira e histórico)</Acao>
                  </div>}

                  {abaMenuAcoes === "financeiro" && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                     <Acao icon={ShoppingBag} cor="text-teal-700" bg="bg-teal-50 group-hover:bg-teal-100" onClick={() => ir(() => abrirModalConsumo(f))} extra={(() => { const t = valesPendentes.filter(v => v.funcionario_id === f.id).reduce((sm, v) => sm + (Number(v.valor_final ?? v.valor_desconto ?? v.valor_original) || 0), 0); return t > 0 ? <span className="shrink-0 text-3xs font-bold text-teal-700">{fmtBRL(t)}</span> : null; })()}>Consumo / Vales</Acao>
                     {/* Salário do fixo vai pelo Fechar folha (chave por mês, não duplica).
                         O "Lançar Salário" avulso criava outra conta a cada clique. */}
                     {f.tipo_contrato === "Freelancer" && (
                        <>
                          <Acao icon={CreditCard} cor="text-emerald-700" bg="bg-emerald-50 group-hover:bg-emerald-100" onClick={() => ir(() => handleLancarFinanceiro(f))}>Lançar Diária</Acao>
                          <Acao icon={Clock} cor="text-fg-soft" onClick={() => ir(() => abrirHistoricoDiarias(f))}>Histórico completo do extra</Acao>
                        </>
                     )}
                  </div>}

                  {abaMenuAcoes === "documentos" && <div>
                     <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                     <Acao icon={Printer} cor="text-zinc-700" bg="bg-zinc-100 group-hover:bg-zinc-100" onClick={() => ir(() => imprimirPerfilFuncionario(f))}>Perfil em PDF / imprimir</Acao>
                     <Acao icon={Link2} cor="text-zinc-700" bg="bg-zinc-100 group-hover:bg-zinc-100" onClick={() => ir(() => compartilharLinkAtualizacao(f))}>Link para atualizar dados</Acao>
                     <Acao icon={FileText} cor="text-emerald-700" bg="bg-emerald-50 group-hover:bg-emerald-100" onClick={() => ir(() => gerarContrato(f))}>Contrato de Trabalho</Acao>
                     <Acao icon={FileText} onClick={() => ir(() => router.push(`/dashboard/rh/contrato/${f.id}`))}>Regulamento</Acao>
                     <Acao icon={Printer} cor="text-emerald-700" bg="bg-emerald-50 group-hover:bg-emerald-100" onClick={() => ir(() => abrirModalFicha(f))}>Recibo de Pagamento / Extra</Acao>
                     <Acao icon={Upload} onClick={() => ir(() => acionarUpload(f))}>Anexar Documento</Acao>
                     </div>
                     {(f.docs || []).length > 0 && <div className="mt-4 space-y-2 border-t border-line pt-4"><p className="text-3xs font-bold uppercase tracking-widest text-subtle">Arquivos anexados</p>{(f.docs || []).map(d => (
                        <div key={d.id} className="flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2">
                           <a href="#" onClick={(e) => { e.preventDefault(); abrirArquivoRH("documento", d.id); }} className="flex-1 flex items-center gap-2 text-xs font-bold text-accent hover:underline min-w-0">
                              <FileText size={13} className="shrink-0"/> <span className="truncate">{d.nome_arquivo}</span>
                           </a>
                           <button onClick={() => handleApagarDoc(d.id, d.url_arquivo)} className="text-subtle hover:text-red-500 shrink-0"><X size={14}/></button>
                        </div>
                     ))}</div>}
                  </div>}

                  {abaMenuAcoes === "gestao" && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                     <Acao icon={FileText} cor="text-red-600" bg="bg-red-50 group-hover:bg-red-100" onClick={() => ir(() => abrirModalAdv(f))}>Advertências</Acao>
                     {!ehInativo(f) && (
                        <Acao icon={LogOut} cor="text-orange-600" bg="bg-orange-50 group-hover:bg-orange-100" onClick={() => ir(() => abrirDesligamento(f))}>Desligar e arquivar</Acao>
                     )}
                  </div>}
               </div>
               <div className="flex shrink-0 items-center justify-between border-t border-line bg-card px-3 py-2 sm:px-4 sm:py-3" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
                  <p className="hidden text-3xs font-bold text-subtle sm:block">Mostrando somente {abas.find(([id]) => id === abaMenuAcoes)?.[1].toLowerCase()}</p>
                  <button onClick={fechar} className="ml-auto min-h-9 rounded-lg bg-card px-4 text-xs font-bold text-slate-900 hover:bg-slate-200 sm:rounded-xl">Fechar</button>
               </div>
            </div>
         </div>
         );
      })()}

      {/* Modal Adicionar/Editar Funcionário */}
      {modalNovo && (
         <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm px-0 pb-0 sm:px-4 sm:pb-4" style={{ paddingTop: "calc(var(--erp-safe-top, 3.5rem) + 1rem)" }}>
            <div className="erp-editor-funcionario bg-card rounded-t-[28px] sm:rounded-[32px] w-full max-w-5xl shadow-2xl animate-in zoom-in-95 flex flex-col h-[calc(100dvh-var(--erp-safe-top,3.5rem)-1.5rem)] sm:h-auto sm:max-h-[calc(100dvh-var(--erp-safe-top,3.5rem)-2rem)] overflow-hidden">
               <style>{`
                 .erp-editor-funcionario label { font-size: 12px !important; line-height: 1.35; }
                 .erp-editor-funcionario input:not([type="checkbox"]):not([type="file"]), .erp-editor-funcionario select { min-height: 48px; font-size: 16px; }
                 .erp-editor-funcionario textarea { font-size: 16px; line-height: 1.6; }
                 .erp-editor-funcionario section[id], .erp-editor-funcionario div[id^="func-"] { scroll-margin-top: 88px; }
               `}</style>
               <div className="flex justify-between items-center gap-4 shrink-0 border-b border-line-soft p-4 sm:px-6 sm:py-5">
                  <div className="min-w-0">
                     <p className="text-3xs font-bold uppercase tracking-[.18em] text-accent">{!editandoId && modoAssistente ? "Cadastro em etapas" : "Equipe fixa · cadastro completo"}</p>
                     <h2 className="truncate font-black text-2xl text-slate-800">{editandoId ? "Editar colaborador" : "Novo colaborador"}</h2>
                     {(() => { const p = progressoCadastro(novoFunc); return (<>
                       <p className="mt-1 text-xs font-bold text-fg">{p.pct}% do essencial preenchido ({p.feitos} de {p.total}) · <span className="text-red-700">*</span> obrigatório</p>
                       <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: p.pct + "%" }} /></div>
                     </>); })()}
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-12 h-12 shrink-0 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={21}/></button>
               </div>

               {!editandoId && modoAssistente ? (
                  <CadastroAssistente unidadeId={unidadeAtiva} form={novoFunc} setForm={setNovoFunc}
                     cargos={[...new Set([...CARGOS_LIDERANCA, ...cargos.map((c) => c.nome)])]}
                     supervisores={funcionarios.filter((f) => (f.status || "ativo") !== "inativo" && f.tipo_contrato !== "Freelancer").map((f) => ({ id: f.id, nome: f.nome }))}
                     piso={convencao?.cct?.piso ? { valor: convencao.cct.piso.mensal, fonte: citar(convencao.cct.piso.fonte) } : null}
                     salvando={salvandoCadastro} onSalvar={() => handleSalvar()} onFormularioCompleto={() => setModoAssistente(false)} />
               ) : (<>
               <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-line-soft bg-white px-4 py-3 sm:px-6">
                  {[
                    ["func-identificacao", "1. Identificação"], ["func-pessoais", "2. Dados pessoais"],
                    ["func-contrato", "3. Contrato e valores"], ["func-jornada", "4. Jornada"],
                  ].map(([id, label]) => <button key={id} type="button" onClick={() => irSecaoCadastro(id)} className="min-h-10 shrink-0 rounded-xl border border-line bg-card px-3 text-xs font-bold text-slate-900 hover:border-emerald-300 hover:text-accent">{label}</button>)}
               </nav>

               <div className="space-y-5 flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-white/60">
                  <section id="func-identificacao" className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-2xs font-bold uppercase tracking-widest text-accent">Identificação profissional</p><p className="mt-1 text-xs font-semibold text-fg">Foto, nome, função, contato e posição no organograma.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-3xs font-bold uppercase text-emerald-700">Funcionário fixo</span></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-1">Tipo de Contrato</label>
                        <div className="flex min-h-12 items-center rounded-xl border border-emerald-200 bg-accent-soft px-4 font-black text-accent-strong">Equipe fixa (CLT / mensalista)</div>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-fg uppercase tracking-widest">Nome Completo <span className="text-red-700">*</span></label>
                        <div className="flex items-center gap-3 mt-1">
                           {/* Foto do colaborador (aparece no ponto, organograma e portal) */}
                           <div className="relative shrink-0">
                              <button type="button" onClick={() => fotoInputRef.current?.click()} title="Adicionar/trocar foto"
                                 className="w-14 h-14 rounded-full overflow-hidden border-2 border-dashed border-slate-300 bg-white flex items-center justify-center hover:border-emerald-400">
                                 {novoFunc.foto
                                    ? <img src={`data:image/jpeg;base64,${novoFunc.foto}`} alt="Foto" className="w-full h-full object-cover" />
                                    : <Camera size={18} className="text-subtle" />}
                              </button>
                              {novoFunc.foto && (
                                 <button type="button" onClick={() => setNovoFunc({ ...novoFunc, foto: "" })} title="Remover foto"
                                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs">×</button>
                              )}
                              <input ref={fotoInputRef} type="file" accept="image/*" onChange={escolherFotoColab} className="hidden" />
                           </div>
                           <input type="text" value={novoFunc.nome} onChange={e=>setNovoFunc({...novoFunc, nome: e.target.value})} className="flex-1 p-4 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                     </div>
                  </div>
                  <div>
                     <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-1">Função / Cargo <span className="text-red-700">*</span></label>
                     <select value={novoFunc.cargo} onChange={e=>setNovoFunc({...novoFunc, cargo: e.target.value})} className="w-full p-4 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500 appearance-none text-fg-soft">
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
                     <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-1">Supervisor(es) diretos — organograma</label>
                     <div className="bg-white border border-line rounded-xl p-3 max-h-32 overflow-y-auto space-y-1">
                        {funcionarios.filter(f => f.id !== editandoId && (f.status || "ativo") !== "inativo").length === 0 ? (
                           <p className="text-xs font-medium text-subtle">Nenhum outro colaborador cadastrado ainda.</p>
                        ) : funcionarios.filter(f => f.id !== editandoId && (f.status || "ativo") !== "inativo").map(f => {
                           const marcado = (novoFunc.supervisores_ids || []).includes(f.id);
                           return (
                              <label key={f.id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer ${marcado ? "bg-emerald-100" : "hover:bg-card"}`}>
                                 <input type="checkbox" checked={marcado} onChange={e=>{
                                    const atual = novoFunc.supervisores_ids || [];
                                    setNovoFunc({...novoFunc, supervisores_ids: e.target.checked ? [...atual, f.id] : atual.filter(x => x !== f.id)});
                                 }} className="w-4 h-4 accent-emerald-600"/>
                                 <span className="text-sm font-bold text-fg-soft">{f.nome}</span>
                                 <span className="text-3xs font-medium text-subtle ml-auto">{f.cargo || "—"}</span>
                              </label>
                           );
                        })}
                     </div>
                     <p className="text-3xs text-subtle font-medium mt-1">Pode marcar mais de um. Sem supervisor = topo da hierarquia no Organograma.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                     <div>
                        <label className="text-xs font-bold text-fg uppercase tracking-widest">Telefone / WhatsApp</label>
                        <input type="text" inputMode="numeric" value={novoFunc.telefone} onChange={e=>setNovoFunc({...novoFunc, telefone: mascaraTelefone(e.target.value)})} placeholder="(00) 00000-0000" className="w-full p-3.5 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        {errosCadastro.telefone && <p className="mt-1 text-xs font-bold text-red-700">{errosCadastro.telefone}</p>}
                     </div>
                     <div>
                        <label className="text-xs font-bold text-fg uppercase tracking-widest">E-mail</label>
                        <input type="email" value={novoFunc.email || ""} onChange={e=>setNovoFunc({...novoFunc, email: e.target.value})} placeholder="nome@email.com" className="w-full p-3.5 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        {errosCadastro.email && <p className="mt-1 text-xs font-bold text-red-700">{errosCadastro.email}</p>}
                     </div>
                     <div>
                        <label className="text-xs font-bold text-fg uppercase tracking-widest">CPF</label>
                        <input type="text" inputMode="numeric" value={novoFunc.cpf} onChange={e=>setNovoFunc({...novoFunc, cpf: mascaraCPF(e.target.value)})} placeholder="000.000.000-00" className="w-full p-3.5 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        {errosCadastro.cpf && <p className="mt-1 text-xs font-bold text-red-700">{errosCadastro.cpf}</p>}
                     </div>
                     <div>
                        <label className="text-xs font-bold text-fg uppercase tracking-widest">RG</label>
                        <input type="text" inputMode="numeric" value={novoFunc.rg || ""} onChange={e=>setNovoFunc({...novoFunc, rg: mascaraRG(e.target.value)})} placeholder="000.000-0" className="w-full p-3.5 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  </section>

                  {/* ── DADOS PESSOAIS ─────────────────────────────────────── */}
                  <div id="func-pessoais" className="bg-card border border-line rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                     <div><p className="text-2xs font-bold uppercase tracking-widest text-accent">Endereço e dados pessoais</p><p className="mt-1 text-xs font-semibold text-fg">Informações completas para documentos e gestão do RH.</p></div>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="col-span-2">
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Rua / Avenida</label>
                           <input type="text" value={novoFunc.rua_av || ""} onChange={e=>setNovoFunc({...novoFunc, rua_av: e.target.value, endereco: `${e.target.value}${novoFunc.numero_casa ? `, ${novoFunc.numero_casa}` : ""}${novoFunc.bairro ? `, ${novoFunc.bairro}` : ""}`})} placeholder="Ex.: Av. Paulista" className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Número</label>
                           <input type="text" value={novoFunc.numero_casa || ""} onChange={e=>setNovoFunc({...novoFunc, numero_casa: e.target.value})} placeholder="Ex.: 1500 ou S/N" className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Bairro</label>
                           <input type="text" value={novoFunc.bairro || ""} onChange={e=>setNovoFunc({...novoFunc, bairro: e.target.value})} placeholder="Ex.: Bela Vista" className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Cidade / UF</label>
                           <input type="text" value={novoFunc.cidade_uf || ""} onChange={e=>setNovoFunc({...novoFunc, cidade_uf: e.target.value})} placeholder="Ex.: São Paulo / SP" className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">CEP</label>
                           <input type="text" value={novoFunc.cep || ""} onChange={e=>setNovoFunc({...novoFunc, cep: e.target.value})} placeholder="00000-000" className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Data de Nascimento</label>
                           <input type="date" value={novoFunc.data_nascimento || ""} onChange={e=>setNovoFunc({...novoFunc, data_nascimento: e.target.value})} className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                           {novoFunc.data_nascimento && (() => {
                              const n = new Date(novoFunc.data_nascimento + "T12:00:00");
                              const hoje = new Date();
                              let idade = hoje.getFullYear() - n.getFullYear();
                              if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) idade--;
                              return <p className="text-3xs font-bold text-success mt-1">{idade} anos</p>;
                           })()}
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Cidade de Nascimento</label>
                           <input type="text" value={novoFunc.cidade_nascimento} onChange={e=>setNovoFunc({...novoFunc, cidade_nascimento: e.target.value})} placeholder="Ex: Belém - PA" className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Nome do pai</label>
                           <input type="text" value={novoFunc.nome_pai || ""} onChange={e=>setNovoFunc({...novoFunc, nome_pai: e.target.value})} placeholder="Como consta no documento" className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Nome da mãe</label>
                           <input type="text" value={novoFunc.nome_mae || ""} onChange={e=>setNovoFunc({...novoFunc, nome_mae: e.target.value})} placeholder="Como consta no documento" className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        {/* Filhos com nome e CPF: entram no contrato */}
                        <div className="sm:col-span-2">
                           <div className="flex items-center justify-between gap-2">
                              <label className="text-3xs font-bold text-fg uppercase tracking-widest">Filhos</label>
                              <button type="button" onClick={() => setNovoFunc({ ...novoFunc, filhos: [...(novoFunc.filhos || []), { nome: "", cpf: "" }] })} className="text-xs font-bold text-accent hover:underline">+ Adicionar filho</button>
                           </div>
                           <div className="mt-2 space-y-2">
                              {(novoFunc.filhos || []).length === 0 && <p className="text-xs font-semibold text-subtle">Nenhum filho cadastrado.</p>}
                              {(novoFunc.filhos || []).map((filho, idx) => (
                                 <div key={idx} className="flex flex-wrap items-center gap-2">
                                    <input type="text" value={filho.nome || ""} placeholder="Nome do filho"
                                       onChange={e => setNovoFunc({ ...novoFunc, filhos: novoFunc.filhos.map((x, k) => k === idx ? { ...x, nome: e.target.value } : x) })}
                                       className="min-w-[150px] flex-1 p-3 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                                    <input type="text" inputMode="numeric" value={filho.cpf || ""} placeholder="000.000.000-00"
                                       onChange={e => setNovoFunc({ ...novoFunc, filhos: novoFunc.filhos.map((x, k) => k === idx ? { ...x, cpf: mascaraCPF(e.target.value) } : x) })}
                                       className="w-40 p-3 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500"/>
                                    <button type="button" onClick={() => setNovoFunc({ ...novoFunc, filhos: novoFunc.filhos.filter((_, k) => k !== idx) })}
                                       className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50">×</button>
                                 </div>
                              ))}
                           </div>
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Gênero</label>
                           <select value={novoFunc.genero} onChange={e=>setNovoFunc({...novoFunc, genero: e.target.value})} className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500">
                              <option value="">Selecione...</option>
                              <option value="Feminino">Feminino</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Outro">Outro</option>
                              <option value="Prefere não dizer">Prefere não dizer</option>
                           </select>
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Estado civil</label>
                           <select value={novoFunc.estado_civil || ""} onChange={e=>setNovoFunc({...novoFunc, estado_civil: e.target.value})} className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500">
                              <option value="">Selecione...</option>
                              {ESTADOS_CIVIS.map(v => <option key={v} value={v}>{v}</option>)}
                           </select>
                        </div>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Escolaridade</label>
                           <select value={novoFunc.escolaridade} onChange={e=>setNovoFunc({...novoFunc, escolaridade: e.target.value})} className="w-full p-3 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500">
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
                     </div>
                     <div className="flex flex-wrap items-center gap-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={novoFunc.tem_transporte}
                              onChange={e=>setNovoFunc({...novoFunc, tem_transporte: e.target.checked, tipo_transporte: e.target.checked ? novoFunc.tipo_transporte : ""})}
                              className="w-4 h-4 accent-emerald-600"/>
                           <span className="text-xs font-bold text-slate-900">Possui transporte próprio</span>
                        </label>
                        {/* Moto ou carro muda o que a casa precisa saber: vaga,
                            seguro e quem pode fazer entrega. Perguntar só "tem
                            transporte" deixava a informação pela metade. */}
                        {novoFunc.tem_transporte && (
                           <div className="flex items-center gap-2">
                              {["Moto", "Carro"].map(v => (
                                 <label key={v} className="flex cursor-pointer items-center gap-1.5">
                                    <input type="radio" name="tipo_transporte" value={v}
                                       checked={novoFunc.tipo_transporte === v}
                                       onChange={()=>setNovoFunc({...novoFunc, tipo_transporte: v})}
                                       className="h-4 w-4 accent-emerald-600"/>
                                    <span className="text-xs font-bold text-slate-900">{v}</span>
                                 </label>
                              ))}
                           </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={novoFunc.usa_vale_transporte} onChange={e=>setNovoFunc({...novoFunc, usa_vale_transporte: e.target.checked})} className="w-4 h-4 accent-emerald-600"/>
                           <span className="text-xs font-bold text-slate-900">Usa vale transporte</span>
                        </label>
                     </div>
                  </div>

                  <div id="func-contrato" className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-sm">
                  <div><p className="text-2xs font-bold uppercase tracking-widest text-accent">Contrato, pagamento e benefícios</p><p className="mb-4 mt-1 text-xs font-semibold text-fg">Salário, PIX, admissão, fase do contrato e composição mensal.</p></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-fg uppercase tracking-widest">Chave PIX</label>
                        <input type="text" value={novoFunc.chave_pix} onChange={e=>setNovoFunc({...novoFunc, chave_pix: e.target.value})} placeholder="Chave para pagamento" className="w-full p-4 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-fg uppercase tracking-widest">{novoFunc.tipo_contrato === "Freelancer" ? "Valor da Diária Base (R$)" : "Salário Fixo (R$)"}</label>
                        <CampoDecimal value={novoFunc.salario} onChange={e=>setNovoFunc({...novoFunc, salario: e.target.value})} className="w-full p-4 mt-1 bg-white border border-line rounded-xl font-black text-success outline-none focus:border-emerald-500"/>
                     </div>
                  </div>

                  {/* EXTRA: o que o recibo precisa fica aqui no cadastro e migra sozinho */}
                  {novoFunc.tipo_contrato === "Freelancer" && (
                     <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-accent">Dados do Recibo de Trabalho Extra</p>
                        <p className="mt-1 mb-4 text-xs font-medium text-fg">Preenchido uma vez aqui, o recibo já sai pronto toda vez que esta pessoa trabalhar.</p>

                        <label className="block">
                           <span className="text-xs font-bold text-fg uppercase tracking-widest">O que a função faz (sai impresso no recibo)</span>
                           <textarea rows={3} value={novoFunc.topicos_funcao} onChange={e=>setNovoFunc({...novoFunc, topicos_funcao: e.target.value})}
                              placeholder="Ex.: Atender mesas, levar pedidos, repor bebidas, apoiar a limpeza do salão."
                              className="w-full p-3.5 mt-1 bg-card border border-line rounded-xl font-medium outline-none focus:border-emerald-500" />
                        </label>

                        <label className="mt-4 block">
                           <span className="text-xs font-bold text-fg uppercase tracking-widest">Itens emprestados (separe por vírgula)</span>
                           <input type="text" value={novoFunc.itens_emprestados} onChange={e=>setNovoFunc({...novoFunc, itens_emprestados: e.target.value})}
                              placeholder="Uniforme / Camisa, Avental, Cartão de Consumo"
                              className="w-full p-4 mt-1 bg-card border border-line rounded-xl font-bold outline-none focus:border-emerald-500" />
                        </label>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                           <div>
                              <label className="text-xs font-bold text-fg uppercase tracking-widest">Forma de pagamento</label>
                              <select value={novoFunc.forma_pagamento} onChange={e=>setNovoFunc({...novoFunc, forma_pagamento: e.target.value})}
                                 className="w-full p-4 mt-1 bg-card border border-line rounded-xl font-bold outline-none focus:border-emerald-500">
                                 {["Pix", "Dinheiro", "Transferência"].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-fg uppercase tracking-widest">Vale transporte (R$)</label>
                              <CampoDecimal value={novoFunc.vale_transporte_val} onChange={e=>setNovoFunc({...novoFunc, vale_transporte_val: e.target.value})}
                                 placeholder="0,00" className="w-full p-4 mt-1 bg-card border border-line rounded-xl font-bold outline-none focus:border-emerald-500" />
                           </div>
                           <div>
                              <label className="text-xs font-bold text-fg uppercase tracking-widest">Setor</label>
                              <input type="text" value={novoFunc.setor_entrega} onChange={e=>setNovoFunc({...novoFunc, setor_entrega: e.target.value})}
                                 placeholder="Salão, Cozinha, Bar" className="w-full p-4 mt-1 bg-card border border-line rounded-xl font-bold outline-none focus:border-emerald-500" />
                           </div>
                        </div>

                        <label className="mt-4 flex items-center gap-2.5">
                           <input type="checkbox" checked={novoFunc.janta_ofertada !== false} onChange={e=>setNovoFunc({...novoFunc, janta_ofertada: e.target.checked})} className="h-5 w-5 accent-emerald-600" />
                           <span className="text-sm font-bold text-fg-soft">A casa oferece a janta</span>
                        </label>
                     </div>
                  )}

                  {novoFunc.tipo_contrato !== "Freelancer" && (
                     <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
                        <p className="text-3xs font-bold uppercase tracking-widest text-accent mb-3">Composição da remuneração (além do fixo)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-bold text-fg uppercase tracking-widest">Vale Alimentação (R$/mês)</label>
                              <CampoDecimal placeholder="0,00" value={novoFunc.vale_alimentacao} onChange={e=>setNovoFunc({...novoFunc, vale_alimentacao: e.target.value})} className="w-full p-4 mt-1 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-fg uppercase tracking-widest">Pontos na taxa de serviço</label>
                              {/* A taxa é rateada por pontos, não digitada em
                                  reais pessoa por pessoa: o valor do ponto só
                                  se sabe no fim do mês, quando se divide o que
                                  foi arrecadado pela soma dos pontos. */}
                              <select value={novoFunc.pontos_taxa ?? ""} onChange={e=>setNovoFunc({...novoFunc, pontos_taxa: e.target.value})}
                                 className="w-full p-4 mt-1 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500">
                                 <option value="">Não participa</option>
                                 {["0.5","1","1.5","2"].map(v => (
                                    <option key={v} value={v}>{v.replace(".", ",")} {v === "1" ? "ponto" : "pontos"}</option>
                                 ))}
                              </select>
                              <p className="text-3xs text-subtle font-medium mt-1">De 0,5 a 2 pontos. O valor em reais sai do rateio no fechamento do mês.</p>
                           </div>
                        </div>
                        <p className="text-3xs font-medium text-emerald-700/70 mt-3">{(() => { const rg = regrasDaCompetencia(new Date().toISOString().slice(0, 7), { convencao }).regras; return `Adicional noturno (${rg.noturnoPct}% das ${rg.noturnoInicioH}h às ${rg.noturnoFimH}h, com hora noturna reduzida de 52min30s) e hora extra (+${rg.extraPct}% além da jornada contratada) são calculados automaticamente pelo ponto, pela regra ${rg.id === "clt" ? "da CLT" : "da convenção coletiva"}. Hora normal = salário ÷ 220.`; })()}</p>
                     </div>
                  )}

                  {novoFunc.tipo_contrato === "Fixo" && (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-line-soft pt-4 mt-4 bg-zinc-100/30 p-4 rounded-2xl">
                        <div>
                           <label className="text-xs font-bold text-emerald-700 uppercase tracking-widest block mb-1">Data de Admissão</label>
                           <input type="date" value={novoFunc.data_admissao || ""} onChange={e=>setNovoFunc({...novoFunc, data_admissao: e.target.value})} className="w-full p-4 bg-card border border-line rounded-xl font-bold outline-none focus:border-emerald-600 text-fg-soft"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-emerald-700 uppercase tracking-widest block mb-1">Fase do Contrato</label>
                           {/* Mudança de fase de quem já está cadastrado passa pelo vínculo, com
                               aprovação e histórico (prontuário > Contratos). Antes este campo e os
                               botões gravavam direto no cadastro: o contrato ficava diferente do
                               vínculo, e "Não renovar" nem chegava a ser salvo (RH-B2). */}
                           {editandoId ? (
                              <div className="flex min-h-12 items-center rounded-xl border border-line bg-card px-4 font-bold text-fg-soft">{novoFunc.status_contrato || "não informado"}</div>
                           ) : (
                           <select value={novoFunc.status_contrato} onChange={e=>setNovoFunc({...novoFunc, status_contrato: e.target.value})} className="w-full p-4 bg-card border border-line rounded-xl font-bold outline-none focus:border-emerald-600 text-fg-soft appearance-none">
                              <option value="Experiência 45">Experiência (45 + 45 dias)</option>
                              <option value="Experiência 30">Experiência (30 + 60 dias)</option>
                              <option value="Definitivo">Contrato Definitivo</option>
                           </select>
                           )}
                           {(() => {
                              const info = faseContratoCalculada(novoFunc);
                              return (
                                 <div className="mt-2 flex flex-col gap-2">
                                    <p className="text-xs font-bold text-zinc-700 bg-zinc-100/80 p-2.5 rounded-xl border border-zinc-200">
                                       {info.fase}: {info.detalhe}
                                    </p>
                                    {editandoId && (
                                       <button type="button" onClick={() => { setModalNovo(false); router.push(`/dashboard/rh/funcionario/${editandoId}?aba=contratos`); }} className="self-start px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-3xs rounded-lg border border-emerald-200 transition-colors">
                                          Prorrogar, efetivar ou mudar contrato no prontuário
                                       </button>
                                    )}
                                 </div>
                              );
                           })()}
                        </div>
                     </div>
                  )}
                  </div>

                  <div id="func-jornada" className="rounded-2xl border border-line bg-card p-4 sm:p-5 shadow-sm">
                     <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                        <p className="text-3xs font-bold uppercase tracking-widest text-fg">Jornada de trabalho</p>
                        <label className="flex items-center gap-2 text-2xs font-bold text-slate-900 cursor-pointer">
                           <input type="checkbox" checked={novoFunc.horario_por_dia} onChange={e=>setNovoFunc({...novoFunc, horario_por_dia: e.target.checked})} style={{accentColor:"#059669"}} />
                           Horário diferente por dia da semana
                        </label>
                     </div>

                     {!novoFunc.horario_por_dia ? (
                     <>
                     <p className="text-3xs font-bold uppercase tracking-widest text-fg mb-2">Horário — dias normais (seg a sáb)</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-fg uppercase tracking-widest">Entrada</label>
                           <input type="time" value={novoFunc.horario_entrada || ""} onChange={e=>setNovoFunc({...novoFunc, horario_entrada: e.target.value})} className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-fg uppercase tracking-widest">Saída</label>
                           <input type="time" value={novoFunc.horario_saida || ""} onChange={e=>setNovoFunc({...novoFunc, horario_saida: e.target.value})} className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                     </div>
                     <p className="text-3xs font-bold uppercase tracking-widest text-fg mb-2 mt-3">Horário de domingo <span className="normal-case font-medium text-subtle">(deixe vazio se for igual)</span></p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                           <label className="text-xs font-bold text-fg uppercase tracking-widest">Entrada (dom)</label>
                           <input type="time" value={novoFunc.horario_dom_entrada || ""} onChange={e=>setNovoFunc({...novoFunc, horario_dom_entrada: e.target.value})} className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-fg uppercase tracking-widest">Saída (dom)</label>
                           <input type="time" value={novoFunc.horario_dom_saida || ""} onChange={e=>setNovoFunc({...novoFunc, horario_dom_saida: e.target.value})} className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                     </div>
                     </>
                     ) : (
                     <div className="space-y-1.5">
                        <p className="text-3xs font-medium text-subtle mb-2">Preencha entrada e saída de cada dia. Dia em branco = folga. O intervalo (abaixo) é descontado de cada dia.</p>
                        {[['0','Domingo'],['1','Segunda'],['2','Terça'],['3','Quarta'],['4','Quinta'],['5','Sexta'],['6','Sábado']].map(([d,lbl]) => {
                           const hd = (novoFunc.horarios_dia && novoFunc.horarios_dia[d]) || {};
                           const setDia = (campo,val) => setNovoFunc(nf => ({...nf, horarios_dia: {...(nf.horarios_dia||{}), [d]: {...((nf.horarios_dia||{})[d]||{}), [campo]: val}}}));
                           const limpar = () => setNovoFunc(nf => { const c={...(nf.horarios_dia||{})}; delete c[d]; return {...nf, horarios_dia:c}; });
                           const trabalha = !!(hd.e || hd.s);
                           return (
                              <div key={d} className="flex items-center gap-2">
                                 <span className="w-16 text-3xs font-bold uppercase text-fg shrink-0">{lbl}</span>
                                 <input type="time" value={hd.e||""} onChange={e=>setDia('e',e.target.value)} className="flex-1 min-w-0 p-2 bg-white border border-line rounded-lg font-bold text-sm outline-none focus:border-emerald-500"/>
                                 <span className="text-dim shrink-0">→</span>
                                 <input type="time" value={hd.s||""} onChange={e=>setDia('s',e.target.value)} className="flex-1 min-w-0 p-2 bg-white border border-line rounded-lg font-bold text-sm outline-none focus:border-emerald-500"/>
                                 <button type="button" onClick={limpar} title="Marcar folga neste dia" className="text-3xs font-bold shrink-0 w-12 text-center rounded-md py-1 border border-line text-subtle hover:text-rose-500 hover:border-rose-200">{trabalha ? "folga" : "—"}</button>
                              </div>
                           );
                        })}
                        {(() => {
                           const interv = Number(novoFunc.tempo_intervalo)||0;
                           let totalMin = 0, diasTrab = 0;
                           Object.values(novoFunc.horarios_dia||{}).forEach(h => {
                              if (!h || !h.e || !h.s) return;
                              const [eh,em]=h.e.split(':').map(Number), [sh,sm]=h.s.split(':').map(Number);
                              let dur = (sh*60+sm)-(eh*60+em); if (dur<0) dur+=1440; dur -= interv;
                              if (dur>0){ totalMin+=dur; diasTrab++; }
                           });
                           const horas = totalMin/60;
                           const acima = horas > 44;
                           return (
                              <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-bold ${acima ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-accent-soft border border-emerald-100 text-accent-strong"}`}>
                                 Carga semanal: {Math.floor(horas)}h{String(Math.round((horas%1)*60)).padStart(2,'0')} em {diasTrab} dia(s) (intervalo já descontado).
                                 {acima ? " Acima do limite CLT de 44h/semana — ajuste os horários." : " Dentro do limite CLT (44h/semana)."}
                              </div>
                           );
                        })()}
                     </div>
                     )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest block mb-2">Dias Trabalho</label>
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
                                 }} className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all ${ativo ? 'bg-accent text-accent-fg shadow-md' : 'bg-card text-subtle hover:bg-slate-200'}`}>
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
                              <p className="text-2xs font-bold text-accent-strong bg-accent-soft border border-emerald-100 rounded-lg px-2.5 py-1.5 mt-2 inline-block">
                                 {fmtBRL(sal / diasMes)} por dia trabalhado
                                 <span className="text-emerald-600/70 font-bold"> · fixo + VA + taxa · {nDias} dia(s)/semana ≈ {Math.round(diasMes)} dias/mês</span>
                              </p>
                           );
                        })()}
                     </div>
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest">Intervalo (Minutos)</label>
                        <input type="number" value={novoFunc.tempo_intervalo || ""} onChange={e=>setNovoFunc({...novoFunc, tempo_intervalo: e.target.value})} placeholder="Ex: 60" className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>

                  {/* Janela do intervalo. Os minutos acima servem ao banco de
                      horas; estas duas horas são o que sai impresso na folha de
                      jornada, no formato "int: 17:00 as 18:00". */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest">Intervalo começa</label>
                        <input type="time" value={novoFunc.intervalo_inicio || ""} onChange={e=>setNovoFunc({...novoFunc, intervalo_inicio: e.target.value})} className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest">Intervalo termina</label>
                        <input type="time" value={novoFunc.intervalo_fim || ""} onChange={e=>setNovoFunc({...novoFunc, intervalo_fim: e.target.value})} className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     {/* Só aparece para quem trabalha domingo com jornada
                         diferente — caso da chefia de cozinha. */}
                     {(novoFunc.horario_dom_entrada || novoFunc.horario_dom_saida) && <>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Intervalo domingo · início</label>
                           <input type="time" value={novoFunc.intervalo_dom_inicio || ""} onChange={e=>setNovoFunc({...novoFunc, intervalo_dom_inicio: e.target.value})} className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-3xs font-bold text-fg uppercase tracking-widest">Intervalo domingo · fim</label>
                           <input type="time" value={novoFunc.intervalo_dom_fim || ""} onChange={e=>setNovoFunc({...novoFunc, intervalo_dom_fim: e.target.value})} className="w-full p-3 mt-1 bg-white border border-line rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                     </>}
                  </div>

               </div>

               </>)}

               <div className={`border-t border-line bg-card p-3 sm:p-4 shrink-0 space-y-2 ${!editandoId && modoAssistente && !duplicado && !erroSalvar && !Object.keys(errosCadastro).length ? "hidden" : ""}`}>
                  {duplicado && (
                    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <p className="font-bold">{duplicado.motivo === "cpf" ? "Já existe um colaborador com este CPF" : "Já existe um colaborador com este nome e telefone"}: {duplicado.colaborador.nome}{(duplicado.colaborador.status || "ativo") === "inativo" ? " (desligado)" : ""}.</p>
                      <p className="mt-0.5 text-xs">Cada pessoa tem um cadastro só na empresa. Abra o cadastro existente: recontratação ou mudança de contrato vira um novo vínculo nele, sem criar outro cadastro.</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => abrirModalEdicao(duplicado.colaborador)} className="min-h-10 rounded-xl bg-emerald-700 px-3 text-xs font-bold text-white">Abrir o cadastro existente</button>
                        {duplicado.motivo === "nome_telefone" && <button type="button" onClick={() => handleSalvar({ ignorarHomonimo: true })} className="min-h-10 rounded-xl border border-amber-400 px-3 text-xs font-bold">É outra pessoa: cadastrar mesmo assim</button>}
                      </div>
                    </div>
                  )}
                  {Object.keys(errosCadastro).length > 0 && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800" role="alert">
                      Corrija antes de salvar: {Object.values(errosCadastro).join(" ")}
                    </div>
                  )}
                  {erroSalvar && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800" role="alert">{erroSalvar}</div>}
                  {!(!editandoId && modoAssistente) && <button onClick={() => handleSalvar()} disabled={!novoFunc.nome || !novoFunc.cargo || salvandoCadastro} className="w-full min-h-14 bg-accent hover:bg-accent disabled:bg-slate-300 text-accent-fg font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                     {salvandoCadastro ? "Salvando..." : editandoId ? "Salvar alterações" : "Salvar colaborador"}
                  </button>}
               </div>
            </div>
         </div>
      )}

      {/* Modal Gerenciar Folgas */}
      {/* O recibo pode ser gerado para qualquer funcionário (Extra ou Fixo) */}
      {modalEscolherExtra && (() => {
         const extrasCadastrados = funcionarios
           .filter(f => !ehInativo(f))
           .filter(f => String(f.nome || "").toLocaleLowerCase("pt-BR").includes(buscaRecibo.toLocaleLowerCase("pt-BR")));
         return (
           <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }} onClick={() => setModalEscolherExtra(false)}>
             <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="flex items-start justify-between gap-3 border-b border-line p-5">
                 <div>
                   <p className="text-3xs font-bold uppercase tracking-widest text-accent">Recibo de Pagamento (Extra ou Fixo)</p>
                   <h2 className="mt-1 text-xl font-black text-fg">Escolha o funcionário</h2>
                   <p className="mt-1 text-xs font-bold text-fg">Gere recibo com diferentes valores por dia, descontos de produtos e pagamento dividido (2 vias na mesma folha A4).</p>
                 </div>
                 <button onClick={() => setModalEscolherExtra(false)} className="rounded-full bg-card p-2.5 text-fg"><X size={18}/></button>
               </div>
               <div className="p-5">
                 <div className="flex items-center gap-2 rounded-xl border border-line px-3">
                   <Search size={17} className="text-subtle"/>
                   <input autoFocus value={buscaRecibo} onChange={e => setBuscaRecibo(e.target.value)} placeholder="Buscar funcionário (Extra ou Fixo) por nome..." className="w-full bg-transparent py-3 text-sm font-bold text-fg-soft outline-none"/>
                 </div>
                 <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
                   {extrasCadastrados.length ? extrasCadastrados.map(extra => {
                     const ehFree = extra.tipo_contrato === "Freelancer";
                     return (
                       <button key={extra.id} onClick={() => { setModalEscolherExtra(false); abrirModalFicha(extra); }} className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left hover:border-emerald-300 hover:bg-emerald-50">
                         <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black ${ehFree ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{String(extra.nome || "F").charAt(0).toUpperCase()}</div>
                         <div className="min-w-0 flex-1">
                           <div className="flex items-center gap-2">
                             <p className="truncate text-sm font-black text-slate-800">{extra.nome}</p>
                             <span className={`rounded-full px-2 py-0.5 text-3xs font-bold uppercase ${ehFree ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>{ehFree ? "Extra" : "Fixo"}</span>
                           </div>
                           <p className="truncate text-xs font-bold text-subtle">{extra.cargo || (ehFree ? "Extra" : "Fixo")} · {extra.cpf || "CPF não informado"} · {fmtBRL(extra.salario || 0)}{ehFree ? "/diária" : "/mês"}</p>
                         </div>
                         <Printer size={17} className="text-accent"/>
                       </button>
                     );
                   }) : (
                     <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                       <p className="text-sm font-black text-fg-soft">Nenhum funcionário encontrado</p>
                       <p className="mt-1 text-xs font-bold text-subtle">Cadastre o colaborador antes de gerar o recibo.</p>
                       <button onClick={() => { setModalEscolherExtra(false); abrirModalNovo(); }} className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-black text-accent-fg">Cadastrar funcionário</button>
                     </div>
                   )}
                 </div>
               </div>
             </div>
           </div>
         );
      })()}

      {/* MODAL: PREPARAR RECIBO DE PRESTAÇÃO DE SERVIÇO */}
      {modalFicha && (() => {
         const total = parseFloat(String(fichaValor).replace(",", ".")) || 0;
         const nDias = Math.max(1, Number(fichaDias) || 1);
         const totalGeral = total * nDias;
         const inss = total * 0.05, fgts = total * 0.08, taxa = total * 0.10;
         const fixo = total - inss - fgts - taxa;
         const fmt = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
         return (
<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }}>
            <div className="bg-card rounded-2xl sm:rounded-[32px] w-full max-w-3xl my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] overflow-y-auto">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Preparar Recibo de Trabalho Extra</h2>
                     <p className="text-sm font-bold text-fg mt-1">{fichaFunc ? `${fichaFunc.nome} · dados importados do cadastro` : "Preencha os dados pelo sistema; somente as assinaturas ficarão para a caneta."}</p>
                  </div>
                  <button onClick={() => setModalFicha(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="rounded-2xl border border-line bg-white p-4 mb-5">
                  <div className="mb-4 bg-card p-3 rounded-xl border border-emerald-200">
                     <label className="text-xs font-bold text-emerald-800 block mb-1">Puxar dados do cadastro do colaborador:</label>
                     <select
                       onChange={e => {
                         const fid = e.target.value;
                         const func = (funcionarios || []).find(f => String(f.id) === String(fid));
                         if (func) {
                           setFichaFunc(func);
                           let rAv = func.rua_av || func.rua || "";
                           let nCasa = func.numero_casa || func.numero || "";
                           let bai = func.bairro || "";
                           let cid = func.cidade_uf || func.cidade || "";
                           if (!rAv && func.endereco) {
                             const partes = String(func.endereco).split(",").map(p => p.trim());
                             if (partes[0]) rAv = partes[0];
                             if (partes[1]) nCasa = partes[1];
                             if (partes[2]) bai = partes[2];
                             if (partes[3]) cid = partes[3];
                           }
                           setFichaDados(d => ({
                             ...d,
                             nome: func.nome || "",
                             cpf: func.cpf || "",
                             rg: func.rg || "",
                             telefone: func.telefone || "",
                             chave_pix: func.chave_pix || func.pix || "",
                             funcao: func.cargo || func.funcao || "",
                             rua_av: func.rua_av || func.rua || "",
                             numero_casa: func.numero_casa || func.numero || "",
                             bairro: func.bairro || "",
                             cidade_uf: func.cidade_uf || func.cidade || "",
                           }));
                           if (func.salario) setFichaValor(String(func.salario));
                         }
                       }}
                       className="w-full rounded-lg border border-emerald-300 bg-emerald-50/50 p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                     >
                       <option value="">Selecione um colaborador cadastrado para auto-preencher...</option>
                       {(funcionarios || []).map(f => (
                         <option key={f.id} value={f.id}>{f.nome} — {f.cargo || "Sem cargo"} ({f.cpf ? `CPF: ${f.cpf}` : "Sem CPF"})</option>
                       ))}
                     </select>
                  </div>

                  <div className="flex items-center justify-between gap-3 mb-3">
                     <div>
                        <p className="text-3xs font-bold uppercase tracking-widest text-fg">Dados que sairão no recibo</p>
                        <p className="text-xs font-bold text-subtle">Quando o colaborador é selecionado, estes campos são puxados automaticamente do cadastro.</p>
                     </div>
                     {fichaFunc && <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-3xs font-bold text-emerald-700">Importado do cadastro</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <label className="text-xs font-bold text-slate-900">Nome completo
                        <input type="text" value={fichaDados.nome} onChange={e => setFichaDados(d => ({...d, nome: e.target.value}))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="text-xs font-bold text-slate-900">CPF
                        <input type="text" inputMode="numeric" value={fichaDados.cpf} onChange={e => setFichaDados(d => ({...d, cpf: mascaraCPF(e.target.value)}))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="text-xs font-bold text-slate-900">RG
                        <input type="text" value={fichaDados.rg} onChange={e => setFichaDados(d => ({...d, rg: mascaraRG(e.target.value)}))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="text-xs font-bold text-slate-900">Telefone
                        <input type="text" inputMode="tel" value={fichaDados.telefone} onChange={e => setFichaDados(d => ({...d, telefone: mascaraTelefone(e.target.value)}))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="sm:col-span-2 text-xs font-bold text-slate-900">Chave PIX
                        <input type="text" value={fichaDados.chave_pix} onChange={e => setFichaDados(d => ({...d, chave_pix: e.target.value}))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>

                     {/* Endereço Estruturado */}
                     <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-line pt-3 mt-1">
                       <label className="sm:col-span-2 text-xs font-bold text-slate-900">Rua ou Avenida
                         <input type="text" value={fichaDados.rua_av} onChange={e => setFichaDados(d => ({...d, rua_av: e.target.value}))} placeholder="Ex.: Av. Paulista" className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                       </label>
                       <label className="text-xs font-bold text-slate-900">Número da casa/apto
                         <input type="text" value={fichaDados.numero_casa} onChange={e => setFichaDados(d => ({...d, numero_casa: e.target.value}))} placeholder="Ex.: 1500 ou S/N" className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                       </label>
                       <label className="sm:col-span-2 text-xs font-bold text-slate-900">Bairro
                         <input type="text" value={fichaDados.bairro} onChange={e => setFichaDados(d => ({...d, bairro: e.target.value}))} placeholder="Ex.: Bela Vista" className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                       </label>
                       <label className="text-xs font-bold text-slate-900">Cidade / UF
                         <input type="text" value={fichaDados.cidade_uf} onChange={e => setFichaDados(d => ({...d, cidade_uf: e.target.value}))} placeholder="Ex.: São Paulo / SP" className="mt-1 w-full rounded-xl border border-line bg-card p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                       </label>
                     </div>
                  </div>
               </div>

               <div className="rounded-2xl border border-line bg-card p-4 mb-5">
                  <p className="text-3xs font-bold uppercase tracking-widest text-fg mb-3">Trabalho e controle do turno</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                     <label className="col-span-2 text-xs font-bold text-slate-900">Data do trabalho
                       <input type="date" value={fichaDados.data_trabalho} onChange={e => setFichaDados(d => ({...d, data_trabalho: e.target.value}))} className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="col-span-2 text-xs font-bold text-slate-900">Evento / ocasião
                       <input type="text" value={fichaDados.evento} onChange={e => setFichaDados(d => ({...d, evento: e.target.value}))} placeholder="Ex.: casamento, festival, reforço de salão" className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="col-span-2 text-xs font-bold text-slate-900">Função no dia
                       <input type="text" value={fichaDados.funcao} onChange={e => setFichaDados(d => ({...d, funcao: e.target.value}))} className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="col-span-2 sm:col-span-4 text-xs font-bold text-slate-900">Descreva por tópicos o que irá fazer no trabalho (atribuições)
                       <textarea
                         rows={3}
                         value={fichaDados.topicos_funcao}
                         onChange={e => setFichaDados(d => ({...d, topicos_funcao: e.target.value}))}
                         placeholder={"Digite em tópicos o que o profissional irá fazer, por exemplo:\n- Atendimento de mesas no salão\n- Montagem e organização da praça\n- Limpeza e fechamento"}
                         className="mt-1 w-full rounded-xl border border-line p-3 font-medium text-slate-800 outline-none focus:border-emerald-500 text-xs"
                       />
                     </label>
                     {[
                       ["entrada", "Entrada"], ["saida_intervalo", "Saída intervalo"],
                       ["retorno_intervalo", "Retorno intervalo"], ["saida_final", "Saída final"],
                     ].map(([campo, label]) => (
                       <label key={campo} className="text-xs font-bold text-slate-900">{label}
                         <input type="time" value={fichaDados[campo]} onChange={e => setFichaDados(d => ({...d, [campo]: e.target.value}))} className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500"/>
                       </label>
                     ))}
                     <label className="col-span-2 text-xs font-bold text-slate-900">Intervalo acordado
                       <input type="text" value={fichaDados.intervalo} onChange={e => setFichaDados(d => ({...d, intervalo: e.target.value}))} placeholder="Ex.: 60 min" className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-accent-soft p-3 text-sm font-black text-accent-strong">
                       <input type="checkbox" checked={!!fichaDados.janta_ofertada} onChange={e => setFichaDados(d => ({...d, janta_ofertada: e.target.checked}))} className="h-5 w-5 accent-emerald-700"/>
                       Janta ofertada pelo restaurante
                     </label>
                  </div>
               </div>

               {/* Valor pago -> desmembramento automático */}
               <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5">
                  <label className="text-3xs font-bold uppercase tracking-widest text-accent block mb-1">Valor pago da diária (R$)</label>
                  <CampoDecimal value={fichaValor} onChange={e=>setFichaValor(e.target.value)} placeholder="Ex: 150,00"
                     className="w-full p-3.5 bg-card border-2 border-emerald-300 rounded-xl font-black text-2xl text-accent outline-none focus:border-emerald-500"/>

                  {/* Nº de dias combinados: soma o total (ex.: terça a domingo = 6 dias) */}
                  <div className="flex items-center gap-3 mt-3">
                     <label className="text-3xs font-bold uppercase tracking-widest text-accent">Dias combinados</label>
                     <div className="flex items-center gap-1">
                        <button type="button" onClick={()=>setFichaDias(String(Math.max(1, nDias-1)))} className="w-8 h-8 rounded-lg bg-card border border-emerald-300 font-black text-accent">−</button>
                        <input type="number" min="1" step="1" value={fichaDias} onChange={e=>setFichaDias(e.target.value)} className="w-16 p-2 text-center bg-card border-2 border-emerald-300 rounded-lg font-black text-accent outline-none focus:border-emerald-500"/>
                        <button type="button" onClick={()=>setFichaDias(String(nDias+1))} className="w-8 h-8 rounded-lg bg-card border border-emerald-300 font-black text-accent">+</button>
                     </div>
                     <div className="flex flex-wrap gap-1">
                        {[1,3,6,7].map(n => <button key={n} type="button" onClick={()=>setFichaDias(String(n))} className={`text-3xs font-bold px-2 py-1 rounded-md ${nDias===n?"bg-accent text-accent-fg":"bg-card border border-emerald-200 text-emerald-700"}`}>{n}d</button>)}
                     </div>
                  </div>

                  {total > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs font-bold text-slate-900">
                        <span>Valor Fixo: <b className="text-slate-800">{fmt(fixo)}</b></span>
                        <span>INSS (5%): <b className="text-slate-800">{fmt(inss)}</b></span>
                        <span>FGTS (8%): <b className="text-slate-800">{fmt(fgts)}</b></span>
                        <span>Taxa de Serviço (10%): <b className="text-slate-800">{fmt(taxa)}</b></span>
                        <span className="col-span-2 pt-2 mt-1 border-t border-emerald-200 text-sm">
                           {nDias > 1
                              ? <>Total: <b className="text-accent">{fmt(totalGeral)}</b> <span className="font-medium text-fg">({nDias} dias × {fmt(total)})</span></>
                              : <>Total do dia: <b className="text-accent">{fmt(total)}</b></>}
                        </span>
                     </div>
                  ) : (
                     <p className="text-3xs font-medium text-emerald-700/70 mt-2">Sem valor, o acerto sai em branco para preencher à mão.</p>
                  )}
               </div>

               <div className="rounded-2xl border border-line bg-card p-4 mb-5">
                  <p className="text-3xs font-bold uppercase tracking-widest text-fg mb-3">Ajustes e pagamento</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {[
                      ["vale_transporte", "Vale-transporte"], ["adicional", "Adicional / bônus"], ["descontos", "Descontos"],
                    ].map(([campo, label]) => (
                      <label key={campo} className="text-xs font-bold text-slate-900">{label} (R$)
                        <CampoDecimal value={fichaDados[campo]} onChange={e => setFichaDados(d => ({...d, [campo]: e.target.value}))} placeholder="0,00" className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500"/>
                      </label>
                    ))}
                    <label className="text-xs font-bold text-slate-900">Forma de pagamento
                      <select value={fichaDados.forma_pagamento} onChange={e => setFichaDados(d => ({...d, forma_pagamento: e.target.value}))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 outline-none focus:border-emerald-500">
                        <option>Pix</option><option>Dinheiro</option><option>Híbrido (Pix + Dinheiro)</option><option>Transferência</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-accent-soft p-3 text-sm font-black text-accent-strong">
                      <input type="checkbox" checked={!!fichaDados.pagamento_realizado} onChange={e => setFichaDados(d => ({ ...d, pagamento_realizado: e.target.checked }))} className="h-5 w-5 accent-emerald-700" />
                      Pagamento já realizado
                    </label>
                    <label className="text-xs font-bold text-slate-900">Data do pagamento
                      <input type="date" disabled={!fichaDados.pagamento_realizado} value={fichaDados.data_pagamento || ""} onChange={e => setFichaDados(d => ({ ...d, data_pagamento: e.target.value }))} className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500 disabled:bg-card" />
                    </label>
                  </div>
               </div>

               {/* Itens emprestados: escolhe na hora */}
               <div className="bg-white border border-line rounded-2xl p-4 mb-6">
                  <p className="text-3xs font-bold uppercase tracking-widest text-fg mb-3">Itens que a empresa vai emprestar (só os marcados saem na ficha)</p>
                  <div className="space-y-1.5 mb-3">
                     {fichaItens.map((it, idx) => (
                        <label key={idx} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer border ${it.incluir ? "bg-card border-emerald-200" : "bg-card border-line opacity-60"}`}>
                           <input type="checkbox" checked={it.incluir} onChange={e=>setFichaItens(lista => lista.map((x, i) => i === idx ? { ...x, incluir: e.target.checked } : x))} className="w-4 h-4 accent-emerald-600"/>
                           <span className="text-sm font-bold text-fg-soft flex-1">{it.nome}</span>
                        </label>
                     ))}
                  </div>
                  <div className="flex gap-2">
                     <input type="text" value={fichaNovoItem} onChange={e=>setFichaNovoItem(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addItemFicha(); } }} placeholder="Adicionar outro item (ex: Faca do chef, Touca...)"
                        className="flex-1 p-2.5 bg-card border border-line rounded-xl font-medium text-sm outline-none focus:border-emerald-500"/>
                     <button type="button" onClick={addItemFicha} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-sm rounded-xl">+ Add</button>
                  </div>
               </div>

               <div className="rounded-2xl border border-line bg-card p-4 mb-5">
                  <p className="text-3xs font-bold uppercase tracking-widest text-fg mb-3">Entrega e devolução dos itens</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(() => {
                      const lideres = (funcionarios || []).filter(f => {
                        const st = (f.status || "ativo").toLowerCase();
                        if (st === "inativo") return false;
                        const cg = String(f.cargo || f.setor || "").toLowerCase();
                        return /chef|supervisor|gerente|encarregad|coordenad|chefe|lider|líd|maitre/.test(cg) || true;
                      });
                      return (
                        <>
                          <label className="text-xs font-bold text-slate-900">Entregue por
                            <select value={fichaDados.responsavel_entrega || ""} onChange={e => setFichaDados(d => ({ ...d, responsavel_entrega: e.target.value }))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 outline-none focus:border-emerald-500 font-bold">
                              <option value="">Selecione o responsável...</option>
                              {lideres.map(l => (
                                <option key={l.id} value={l.nome}>{l.nome} ({l.cargo || "Supervisor/Líder"})</option>
                              ))}
                            </select>
                          </label>

                          <label className="text-xs font-bold text-slate-900">Local / setor
                            <input type="text" value={fichaDados.setor_entrega} onChange={e => setFichaDados(d => ({ ...d, setor_entrega: e.target.value }))} className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500"/>
                          </label>

                          <label className="text-xs font-bold text-slate-900">Devolução conferida por (Chef / Supervisor)
                            <select value={fichaDados.conferencia_devolucao || ""} onChange={e => setFichaDados(d => ({ ...d, conferencia_devolucao: e.target.value }))} className="mt-1 w-full rounded-xl border border-line bg-card p-3 outline-none focus:border-emerald-500 font-bold">
                              <option value="">Selecione o Chef / Supervisor / Responsável...</option>
                              {lideres.map(l => (
                                <option key={l.id} value={l.nome}>{l.nome} ({l.cargo || "Chef / Supervisor"})</option>
                              ))}
                            </select>
                          </label>

                          <label className="text-xs font-bold text-slate-900">Horário da devolução
                            <input type="time" value={fichaDados.horario_devolucao} onChange={e => setFichaDados(d => ({ ...d, horario_devolucao: e.target.value }))} className="mt-1 w-full rounded-xl border border-line p-3 outline-none focus:border-emerald-500"/>
                          </label>
                        </>
                      );
                    })()}
                  </div>
               </div>

               <button disabled={salvandoRecibo} onClick={imprimirFichaPreparada} className="w-full py-4 bg-accent hover:opacity-90 disabled:opacity-60 text-accent-fg font-black text-lg rounded-2xl transition-all active:scale-95 shadow-xl shadow-emerald-700/20 flex items-center justify-center gap-2">
                  {salvandoRecibo ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20}/>} {salvandoRecibo ? "Salvando no histórico..." : "Gerar e imprimir recibo"}
               </button>
            </div>
         </div>
         );
      })()}

      {/* MODAL: HISTÓRICO COMPLETO DO EXTRA */}
      {modalDiarias && (() => {
         const liberacoes = modalDiarias.liberacoes || [];
         const pontos = modalDiarias.pontos || [];
         const recibos = modalDiarias.recibos || [];
         const advertencias = modalDiarias.advertencias || [];
         const porData = new Map();
         const linha = data => {
            const chave = String(data || "").slice(0, 10);
            if (!porData.has(chave)) porData.set(chave, { data: chave });
            return porData.get(chave);
         };
         liberacoes.forEach(item => Object.assign(linha(item.data), { liberacao: item, valor: Number(item.valor_diaria) || 0 }));
         pontos.forEach(item => Object.assign(linha(item.data_referencia), { ponto: item }));
         recibos.forEach(recibo => {
            const diasDet = Array.isArray(recibo.dados?.dias_detalhados) ? recibo.dados.dias_detalhados.filter(d => d && d.data) : [];
            if (diasDet.length > 0) {
               diasDet.forEach(d => Object.assign(linha(d.data), { recibo, valor: Number(d.valor) || Number(recibo.valor_diaria) || 0 }));
            } else {
               let datas = Array.isArray(recibo.datas_contratadas) && recibo.datas_contratadas.length ? recibo.datas_contratadas : [recibo.data_trabalho];
               datas.forEach(data => Object.assign(linha(data), { recibo, valor: Number(recibo.valor_diaria) || 0 }));
            }
         });
         const dias = [...porData.values()].filter(item => item.data).sort((a, b) => b.data.localeCompare(a.data));
         const diasContratados = dias.filter(item => item.liberacao || item.recibo).length;
         const diasTrabalhados = dias.filter(item => item.ponto?.hora_entrada).length;
         const totalPago = recibos.filter(item => item.pagamento_realizado).reduce((soma, item) => soma + (Number(item.valor_total) || 0), 0);
         const hora = valor => {
            if (!valor) return "—";
            if (/^\d{2}:\d{2}/.test(String(valor))) return String(valor).slice(0, 5);
            const data = new Date(valor);
            return Number.isNaN(data.getTime()) ? String(valor) : data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
         };
         const dataBR = valor => String(valor || "").slice(0, 10).split("-").reverse().join("/");
         return (
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }} onClick={() => setModalDiarias(null)}>
            <div className="bg-card rounded-[28px] w-full max-w-5xl max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] overflow-y-auto p-4 sm:p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Clock size={18} className="text-success" /> Histórico de Diárias e Recibos</h2>
                  <div className="flex items-center gap-2">
                     {modalDiarias.func?.id && (
                        <button type="button" onClick={() => { const id = modalDiarias.func.id; setModalDiarias(null); router.push(`/dashboard/rh/extra/${id}/recibo`); }} className="rounded-xl bg-accent px-3 py-1.5 text-xs font-black text-accent-fg hover:opacity-90">
                           + Emitir Recibo (2 vias)
                        </button>
                     )}
                     <button onClick={() => setModalDiarias(null)} className="w-9 h-9 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={17} /></button>
                  </div>
               </div>
               <p className="text-xs font-bold text-fg mb-4">{modalDiarias.func?.nome} — dias, horários, recibos (2 vias A4), pagamentos e ocorrências reunidos no cadastro.</p>
               {modalDiarias.loading ? (
                  <p className="text-center font-bold text-subtle py-8">Carregando...</p>
               ) : (
                  <>
                     {modalDiarias.erroRecibos && (
                       <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">O histórico antigo de ponto está disponível, mas a tabela de recibos ainda precisa ser ativada no banco.</p>
                     )}
                     <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                       {[
                         ["Dias contratados", diasContratados],
                         ["Dias trabalhados", diasTrabalhados],
                         ["Recibos emitidos", recibos.length],
                         ["Total já pago", fmtBRL(totalPago)],
                       ].map(([rotulo, valor]) => (
                         <div key={rotulo} className="rounded-2xl border border-line bg-white p-3">
                           <p className="text-3xs font-bold uppercase tracking-wider text-fg">{rotulo}</p>
                           <p className="mt-1 text-lg font-black text-fg">{valor}</p>
                         </div>
                       ))}
                     </div>

                     <div className="mt-5">
                       <h3 className="mb-2 text-sm font-black text-slate-800">Dias, valores e horários</h3>
                       {dias.length === 0 ? (
                         <p className="rounded-xl bg-white p-5 text-center text-sm font-medium text-subtle">Nenhum dia contratado ou trabalhado registrado.</p>
                       ) : (
                         <div className="overflow-x-auto rounded-2xl border border-line">
                           <table className="w-full min-w-[720px] text-left text-xs">
                             <thead className="bg-slate-900 text-white"><tr><th className="p-3">Data</th><th className="p-3">Situação</th><th className="p-3">Horário do dia</th><th className="p-3">Valor</th><th className="p-3">Pagamento</th><th className="p-3">Ação</th></tr></thead>
<tbody className="divide-y divide-slate-100">
                               {dias.map(item => (
                                 <tr key={item.data}>
                                   <td className="p-3 font-black">{dataBR(item.data)}</td>
                                   <td className="p-3"><span className={`rounded-full px-2 py-1 font-black ${item.ponto?.hora_entrada ? "bg-accent-soft text-accent-strong" : "bg-amber-50 text-amber-700"}`}>{item.ponto?.hora_entrada ? "Trabalhou" : "Contratado"}</span></td>
                                   <td className="p-3 font-bold text-slate-900">{hora(item.ponto?.hora_entrada || item.recibo?.hora_entrada)} às {hora(item.ponto?.hora_saida || item.recibo?.hora_saida)}</td>
                                   <td className="p-3 font-black text-accent">{fmtBRL(item.valor || 0)}</td>
                                   <td className="p-3 font-bold">{item.recibo ? (item.recibo.pagamento_realizado ? "Pago" : "Pendente") : "Sem recibo"}</td>
                                   <td className="p-3">{item.liberacao && !item.recibo && <button onClick={async () => { if (confirm("Remover esta liberação?")) { await removerLiberacao(item.liberacao.id); abrirHistoricoDiarias(modalDiarias.func); } }} className="rounded-lg bg-rose-50 p-2 text-rose-600"><Trash2 size={14} /></button>}</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                       )}
                     </div>

                     <div className="mt-5 grid gap-5 lg:grid-cols-2">
                        <section>
                          <h3 className="mb-2 text-sm font-black text-slate-800">Histórico de recibos de pagamento</h3>
                          <div className="space-y-3">
                            {recibos.length === 0 ? <p className="rounded-xl bg-white p-4 text-sm text-subtle">Nenhum recibo emitido.</p> : recibos.map(recibo => {
                              const funcNome = recibo.funcao || recibo.dados?.funcao || modalDiarias.func?.cargo || "Prestador";
                              const hEntrada = recibo.hora_entrada || recibo.dados?.entrada || "—";
                              const hSaida = recibo.hora_saida || recibo.dados?.saida_final || "—";
                              const temFoto = !!recibo.dados?.foto_recibo_assinado;
                              const topicos = String(recibo.dados?.topicos_funcao || "").split("\n").map(t => t.trim()).filter(Boolean);
                              const diasDet = Array.isArray(recibo.dados?.dias_detalhados) ? recibo.dados.dias_detalhados.filter(d => d && (d.data || Number(d.valor) > 0)) : [];
                              const descItens = Array.isArray(recibo.dados?.descontos_itens) ? recibo.dados.descontos_itens.filter(d => d && (d.descricao || Number(d.valor) > 0)) : [];
                              const vDin = Number(recibo.dados?.valor_dinheiro) || 0;
                              const vPix = Number(recibo.dados?.valor_pix) || 0;

                              return (
                              <div key={recibo.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm space-y-2">
                                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line-soft pb-2">
                                  <div>
                                    <p className="font-black text-fg text-sm">{recibo.numero}</p>
                                    <p className="text-xs font-bold text-fg">{dataBR(recibo.data_trabalho)} · {recibo.dias_contratados || diasDet.length || 1} dia(s) · <b className="text-accent">{fmtBRL(recibo.valor_total)}</b></p>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-3xs font-bold ${recibo.pagamento_realizado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{recibo.pagamento_realizado ? `Pago em ${dataBR(recibo.data_pagamento)}` : "Pagamento Pendente"}</span>
                                </div>

                                <div className="text-xs space-y-1">
                                  <p className="font-bold text-slate-800">Função exercida: <span className="text-emerald-800">{funcNome}</span></p>
                                  <p className="font-medium text-slate-900">⏰ Horário de trabalho: <b>{hEntrada} às {hSaida}</b></p>
                                  {(vDin > 0 || vPix > 0) && (
                                    <p className="font-bold text-slate-800">
                                      💵 Pagamento:{" "}
                                      {vDin > 0 && vPix > 0
                                        ? `${fmtBRL(vDin)} no Dinheiro + ${fmtBRL(vPix)} no Pix`
                                        : vDin > 0
                                        ? `${fmtBRL(vDin)} no Dinheiro`
                                        : `${fmtBRL(vPix)} no Pix`}
                                    </p>
                                  )}
                                  {diasDet.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {diasDet.map((d, idx) => (
                                        <span key={idx} className="rounded-md bg-white border border-line px-2 py-0.5 text-3xs font-bold text-slate-700">
                                          {d.dia_semana ? `${d.dia_semana} ` : ""}{dataBR(d.data)}: {fmtBRL(d.valor)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {descItens.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {descItens.map((d, idx) => (
                                        <span key={idx} className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-3xs font-bold text-rose-700">
                                          - {d.descricao || "Item"}: {fmtBRL(d.valor)}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {topicos.length > 0 && (
                                    <div className="mt-1 bg-white border border-line rounded-xl p-2 text-2xs font-medium text-fg-soft">
                                      <p className="font-bold text-fg text-3xs uppercase mb-0.5">Atribuições do dia:</p>
                                      {topicos.map((t, idx) => <p key={idx} className="truncate">• {t.replace(/^[•\-\*]\s*/, "")}</p>)}
                                    </div>
                                  )}
                                </div>

                                {temFoto && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="inline-flex items-center gap-1 text-3xs font-bold text-accent-strong bg-accent-soft border border-emerald-200 px-2 py-0.5 rounded-md">
                                      ✓ Recibo Assinado Anexado
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setFotoAmpliada(recibo.dados.foto_recibo_assinado)}
                                      className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
                                    >
                                      <Camera size={13} /> Ver Foto do Recibo
                                    </button>
                                  </div>
                                )}

                                <div className="mt-2 flex flex-wrap items-center gap-2 pt-1 border-t border-line-soft">
                                  <button onClick={() => imprimirFichaExtra(modalDiarias.func, { numero: recibo.numero, diaria: recibo.valor_diaria, dias: recibo.dias_contratados, itens: recibo.itens || [], dados: recibo.dados || {} })} className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-fg-soft hover:bg-card"><Printer size={13} className="mr-1 inline" />Reimprimir (2 vias A4)</button>
                                  <button onClick={async () => { const pago = !recibo.pagamento_realizado; const resposta = await atualizarPagamentoRecibo(recibo.id, pago); if (resposta.error) alert(resposta.error); else abrirHistoricoDiarias(modalDiarias.func); }} className="rounded-xl border border-emerald-200 bg-accent-soft px-3 py-2 text-xs font-bold text-accent-strong hover:bg-emerald-100">{recibo.pagamento_realizado ? "Marcar pendente" : "Marcar como pago"}</button>
                                  <label className="cursor-pointer rounded-xl bg-accent px-3 py-2 text-xs font-bold text-accent-fg hover:bg-accent inline-flex items-center gap-1.5 shadow-sm">
                                    {anexandoFotoId === recibo.id ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                                    {temFoto ? "Trocar Foto" : "Anexar Foto do Recibo Assinado"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setAnexandoFotoId(recibo.id);
                                        try {
                                          const b64 = await comprimirFotoParaIA(file, 1600, 0.85);
                                          const mediaType = file.type || "image/jpeg";
                                          const dataUrl = b64.startsWith("data:") ? b64 : `data:${mediaType};base64,${b64}`;
                                          const res = await anexarFotoReciboAssinado(recibo.id, dataUrl);
                                          if (res.error) alert("Erro ao anexar foto: " + res.error);
                                          else {
                                            alert("Foto do recibo assinado anexada com sucesso ao histórico!");
                                            abrirHistoricoDiarias(modalDiarias.func);
                                          }
                                        } catch (err) {
                                          alert("Erro ao processar imagem: " + err.message);
                                        } finally {
                                          setAnexandoFotoId(null);
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            );})}
                          </div>
                        </section>

                        <section>
                          <h3 className="mb-2 text-sm font-black text-slate-800">Problemas e ocorrências</h3>
                          <div className="space-y-2">
                            {advertencias.length === 0 ? <p className="rounded-xl bg-accent-soft p-4 text-sm font-bold text-accent-strong">Nenhum problema registrado.</p> : advertencias.map(adv => (
                              <div key={adv.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-xs font-bold text-rose-700">{dataBR(adv.data)} · {adv.tipo || "Ocorrência"}</p><p className="mt-1 text-sm text-fg-soft">{adv.motivo || adv.descricao || adv.observacao || "Registro disciplinar"}</p></div>
                            ))}
                          </div>
                        </section>
                      </div>
                  </>
               )}
            </div>
         </div>
         );
      })()}

      {/* MODAL: FERIADOS da unidade (dias que pagam +100% p/ quem trabalhar) */}
      {modalFeriados && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }}>
            <div className="bg-card rounded-2xl sm:rounded-[32px] w-full max-w-md my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] flex flex-col">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Feriados</h2>
                     <p className="text-sm font-bold text-fg mt-1">Quem trabalhar nesses dias recebe +100% (dobro, CLT)</p>
                  </div>
                  <button onClick={() => setModalFeriados(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={20}/></button>
               </div>

               <form onSubmit={salvarFeriado} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-4 shrink-0 space-y-3">
                  <div className="flex gap-3">
                     <input type="date" value={feriadoForm.data} onChange={e=>setFeriadoForm({...feriadoForm, data: e.target.value})} className="p-3 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-rose-400"/>
                     <input type="text" placeholder="Nome (ex: Natal)" value={feriadoForm.nome} onChange={e=>setFeriadoForm({...feriadoForm, nome: e.target.value})} className="flex-1 p-3 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-rose-400"/>
                  </div>
                  <button type="submit" className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl transition-colors">Adicionar Feriado</button>
               </form>

               <div className="flex items-center gap-2 mb-3 shrink-0">
                  <label className="text-3xs font-bold uppercase tracking-widest text-subtle">Mês:</label>
                  <input type="month" value={mesFeriados} onChange={e=>{ setMesFeriados(e.target.value); carregarFeriados(e.target.value); }} className="p-2 bg-white border border-line rounded-lg font-bold text-sm text-fg-soft outline-none"/>
               </div>

               <div className="overflow-y-auto space-y-2">
                  {feriadosLista.length === 0 ? (
                     <p className="text-sm font-medium text-subtle text-center py-4">Nenhum feriado marcado neste mês.</p>
                  ) : feriadosLista.map(fe => (
                     <div key={fe.id} className="p-3 bg-white border border-line-soft rounded-xl flex items-center gap-3">
                        <span className="text-sm font-black text-rose-600 shrink-0">{fe.data?.split("-").reverse().slice(0, 2).join("/")}</span>
                        <span className="flex-1 text-sm font-bold text-fg-soft truncate">{fe.nome || "Feriado"}</span>
                        <button onClick={() => excluirFeriado(fe.id)} className="p-2 text-subtle hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* MODAL: DESLIGAMENTO & AVISO PRÉVIO */}
      {modalDeslig && funcDeslig && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }}>
            <div className="bg-card rounded-2xl sm:rounded-[32px] w-full max-w-lg p-4 sm:p-7 shadow-2xl animate-in zoom-in-95 my-4 max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] overflow-y-auto">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Desligamento / Aviso Prévio</h2>
                     <p className="text-sm font-bold text-fg mt-0.5">{funcDeslig.nome} · {funcDeslig.cargo || "Sem cargo"}</p>
                  </div>
                  <button onClick={() => setModalDeslig(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* Se o funcionário já está cumprindo aviso */}
               {(funcDeslig.em_aviso_previo || funcDeslig.status_aviso === "cumprindo_aviso") && (
                  <div className="mb-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
                     <p className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">Atualmente Cumprindo Aviso Prévio</p>
                     <p className="text-xs text-amber-800 font-medium">Início em <b>{funcDeslig.inicio_aviso_previo ? new Date(funcDeslig.inicio_aviso_previo + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</b> ({funcDeslig.dias_aviso_previo || 30} dias contratados).</p>
                     <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => handleCancelarAviso(funcDeslig)} className="py-2 px-3 bg-card border border-amber-300 text-amber-900 font-bold text-xs rounded-xl hover:bg-amber-100">Cancelar Aviso</button>
                     </div>
                  </div>
               )}

               {/* Alternador de Modo: Cumprir Aviso vs Desligar Imediatamente */}
               <div className="grid grid-cols-2 gap-2 mb-4 bg-card p-1.5 rounded-2xl">
                  <button type="button" onClick={() => setDesligForm({ ...desligForm, modo: "aviso" })} className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${desligForm.modo === "aviso" ? "bg-card text-slate-800 shadow-sm" : "text-fg hover:text-fg-soft"}`}>
                     1. Cumprindo Aviso Prévio
                  </button>
                  <button type="button" onClick={() => setDesligForm({ ...desligForm, modo: "imediato" })} className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all ${desligForm.modo === "imediato" ? "bg-rose-600 text-white shadow-sm" : "text-fg hover:text-fg-soft"}`}>
                     2. Desligar Imediatamente
                  </button>
               </div>

               <form onSubmit={confirmarDesligamento} className="space-y-4">
                  {desligForm.modo === "aviso" ? (
                     <div className="space-y-3 bg-amber-50/60 border border-amber-200/80 p-4 rounded-2xl">
                        <p className="text-2xs font-bold uppercase tracking-widest text-amber-800">Parâmetros do Aviso Prévio</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           <div>
                              <label className="text-xs font-bold text-slate-900 uppercase tracking-widest block mb-1">Início do Aviso</label>
                              <input type="date" value={desligForm.inicio_aviso} onChange={e=>setDesligForm({...desligForm, inicio_aviso: e.target.value})} className="w-full p-3 bg-card border border-amber-200 rounded-xl font-bold text-fg-soft outline-none focus:border-amber-500"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-900 uppercase tracking-widest block mb-1">Dias de Aviso</label>
                              <input type="number" min="1" max="90" value={desligForm.dias_aviso} onChange={e=>setDesligForm({...desligForm, dias_aviso: e.target.value})} placeholder="Ex: 27 ou 30" className="w-full p-3 bg-card border border-amber-200 rounded-xl font-black text-amber-900 outline-none focus:border-amber-500"/>
                           </div>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-slate-900 uppercase tracking-widest block mb-1">Tipo de Aviso</label>
                           <select value={desligForm.tipo_aviso} onChange={e=>setDesligForm({...desligForm, tipo_aviso: e.target.value})} className="w-full p-3 bg-card border border-amber-200 rounded-xl font-bold text-fg-soft outline-none focus:border-amber-500">
                              <option value="Trabalhado">Trabalhado (cumpre horário no restaurante)</option>
                              <option value="Indenizado">Indenizado (sem cumprimento presencial)</option>
                           </select>
                        </div>

                        {/* Cálculo ao vivo do término */}
                        {(() => {
                           if (!desligForm.inicio_aviso || !desligForm.dias_aviso) return null;
                           const ini = new Date(`${desligForm.inicio_aviso}T12:00:00`);
                           const dias = Number(desligForm.dias_aviso) || 30;
                           const fim = new Date(ini.getTime() + dias * 86400000);
                           const hj = new Date(); hj.setHours(0,0,0,0); ini.setHours(0,0,0,0);
                           const faltam = Math.ceil((fim - hj) / 86400000);
                           return (
                              <div className="bg-card border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-900">
                                 Término previsto do aviso: <b>{fim.toLocaleDateString("pt-BR")}</b>
                                 {faltam > 0 ? <span className="block mt-0.5 text-amber-700">· Faltam <b>{faltam} dia(s)</b> de trabalho</span> : <span className="block mt-0.5 text-rose-700">· Prazo de aviso já finalizado!</span>}
                              </div>
                           );
                        })()}
                     </div>
                  ) : (
                     <div className="space-y-3 bg-rose-50/60 border border-rose-200/80 p-4 rounded-2xl">
                        <p className="text-2xs font-bold uppercase tracking-widest text-rose-800">Desligamento Definitivo & Arquivamento</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           <div>
                              <label className="text-xs font-bold text-slate-900 uppercase tracking-widest block mb-1">Data de Saída</label>
                              <input type="date" value={desligForm.data} onChange={e=>setDesligForm({...desligForm, data: e.target.value})} className="w-full p-3 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-rose-500"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-900 uppercase tracking-widest block mb-1">Tipo de Recisão</label>
                              <select value={desligForm.tipo} onChange={e=>setDesligForm({...desligForm, tipo: e.target.value})} className="w-full p-3 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-rose-500">
                                 <option>Pedido de demissão</option>
                                 <option>Demissão sem justa causa</option>
                                 <option>Demissão por justa causa</option>
                                 <option>Fim de contrato / experiência</option>
                                 <option>Acordo entre as partes</option>
                              </select>
                           </div>
                        </div>
                     </div>
                  )}

                  <div>
                     <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-1">Motivo / Observações</label>
                     <textarea rows={2} value={desligForm.motivo} onChange={e=>setDesligForm({...desligForm, motivo: e.target.value})} placeholder="Ex: cumprindo aviso de 27 dias / iniciativa do colaborador..." className="w-full p-3 bg-white border border-line rounded-xl font-medium text-sm text-fg-soft outline-none focus:border-emerald-500 resize-none"/>
                  </div>

                  <div className="flex gap-3 pt-2">
                     <button type="button" onClick={() => setModalDeslig(false)} className="flex-1 py-3.5 bg-card hover:bg-slate-200 text-slate-900 font-bold rounded-xl">Cancelar</button>
                     <button type="submit" className={`flex-1 py-3.5 text-white font-black rounded-xl flex items-center justify-center gap-2 transition-colors ${desligForm.modo === "aviso" ? "bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20" : "bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-600/20"}`}>
                        <LogOut size={18}/> {desligForm.modo === "aviso" ? "Registrar Aviso Prévio" : "Desligar e Arquivar"}
                     </button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* MODAL: ADVERTÊNCIAS do colaborador */}
      {modalAdv && funcAdv && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }}>
            <div className="bg-card rounded-2xl sm:rounded-[32px] w-full max-w-lg my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] flex flex-col">
               <div className="flex justify-between items-center mb-5 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Advertências</h2>
                     <p className="text-sm font-bold text-fg mt-1">{funcAdv.nome} · aparecem na vida do colaborador</p>
                  </div>
                  <button onClick={() => setModalAdv(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={20}/></button>
               </div>

               <form onSubmit={salvarAdvertencia} className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 shrink-0 space-y-3">
                  <p className="text-3xs font-bold uppercase tracking-widest text-red-600">Nova advertência</p>
                  <div className="flex gap-3">
                     <input type="date" value={advForm.data} onChange={e=>setAdvForm({...advForm, data: e.target.value})} className="p-3 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-red-400"/>
                     <select value={advForm.gravidade} onChange={e=>setAdvForm({...advForm, gravidade: e.target.value})} className="flex-1 p-3 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-red-400">
                        <option value="leve">Leve</option>
                        <option value="media">Média</option>
                        <option value="grave">Grave</option>
                     </select>
                  </div>
                  <input type="text" placeholder="Motivo (ex: atraso sem justificativa)" value={advForm.motivo} onChange={e=>setAdvForm({...advForm, motivo: e.target.value})} className="w-full p-3 bg-card border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-red-400"/>
                  <textarea placeholder="Descrição da ocorrência (opcional)" rows={2} value={advForm.descricao} onChange={e=>setAdvForm({...advForm, descricao: e.target.value})} className="w-full p-3 bg-card border border-line rounded-xl font-medium text-sm text-fg-soft outline-none focus:border-red-400 resize-none"/>
                  <button type="submit" className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-xl transition-colors">Registrar Advertência</button>
               </form>

               <div className="overflow-y-auto space-y-2">
                  {advLista.length === 0 ? (
                     <p className="text-sm font-medium text-subtle text-center py-4">Nenhuma advertência registrada.</p>
                  ) : advLista.map(a => (
                     <div key={a.id} className="p-3 bg-white border border-line-soft rounded-xl flex items-center gap-3">
                        <span className={`text-3xs font-bold uppercase tracking-widest px-2 py-1 rounded-md shrink-0 ${a.gravidade === "grave" ? "bg-red-100 text-red-700" : a.gravidade === "media" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-900"}`}>{a.gravidade}</span>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-bold text-fg-soft truncate">{a.motivo}</p>
                           <p className="text-3xs font-medium text-subtle">{a.data ? a.data.split("-").reverse().join("/") : "—"}{a.descricao ? ` · ${a.descricao}` : ""}</p>
                        </div>
                        <button onClick={() => imprimirTermoAdvertencia(funcAdv, a)} className="p-2 text-subtle hover:text-fg-soft rounded-lg" title="Imprimir termo para assinatura"><Printer size={14}/></button>
                        <button onClick={() => excluirAdvertencia(a.id)} className="p-2 text-subtle hover:text-red-500 rounded-lg" title="Excluir"><Trash2 size={14}/></button>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* MODAL: BANCO DE HORAS (intervalo não tirado; limite 8h/mês) */}
      {modalBanco && funcBanco && (() => {
         const lancs = bancoHoras.filter(b => b.colaborador_id === funcBanco.id);
         const total = lancs.filter(b => !b.tipo || b.tipo === "credito").reduce((s, b) => s + (Number(b.minutos) || 0), 0);
         const pct = Math.min(100, (total / BANCO_LIMITE_MIN) * 100);
         const critico = total >= BANCO_LIMITE_MIN;
         const alerta = total >= BANCO_ALERTA_MIN;
         return (
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }}>
            <div className="bg-card rounded-2xl sm:rounded-[32px] w-full max-w-lg my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] flex flex-col">
               <div className="flex justify-between items-center mb-5 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Banco de Horas</h2>
                     <p className="text-sm font-bold text-fg mt-1">{funcBanco.nome} · mês atual</p>
                  </div>
                  <button onClick={() => setModalBanco(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={20}/></button>
               </div>

               {/* Acumulado do mês vs limite de 8h */}
               <div className={`p-4 rounded-2xl border mb-5 shrink-0 ${critico ? "bg-red-50 border-red-200" : alerta ? "bg-amber-50 border-amber-200" : "bg-white border-line"}`}>
                  <div className="flex justify-between items-baseline mb-2">
                     <span className={`text-3xs font-bold uppercase tracking-widest ${critico ? "text-red-600" : alerta ? "text-amber-700" : "text-fg"}`}>
                        {critico ? "Limite de 8h atingido!" : alerta ? "Perto de estourar as 8h!" : "Acumulado no mês"}
                     </span>
                     <span className={`text-2xl font-black ${critico ? "text-red-600" : alerta ? "text-amber-700" : "text-slate-800"}`}>{fmtMin(total)} <span className="text-sm font-bold text-subtle">/ 8h00</span></span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden bg-card border border-line">
                     <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: critico ? "#DC2626" : alerta ? "#F59E0B" : "#059669" }} />
                  </div>
                  {(alerta || critico) && <p className="text-2xs font-bold mt-2 text-slate-900">Programe a compensação/folga de {funcBanco.nome.split(" ")[0]} para zerar o banco.</p>}
               </div>

               {/* Compensar tudo com uma folga (registra a folga e zera os créditos) */}
               {total > 0 && (
                  <div className="flex flex-wrap items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-5 shrink-0">
                     <span className="text-3xs font-bold uppercase tracking-widest text-accent flex-1">Compensar com folga:</span>
                     <input type="date" value={compensarData} onChange={e=>setCompensarData(e.target.value)} className="p-2 bg-card border border-emerald-200 rounded-lg font-bold text-sm text-fg-soft outline-none focus:border-emerald-500"/>
                     <button onClick={compensarBanco} className="px-4 py-2 bg-accent hover:bg-accent text-accent-fg font-bold text-xs rounded-xl transition-colors">
                        Dar folga e zerar {fmtMin(total)}
                     </button>
                  </div>
               )}

               {/* Lançar minutos não tirados do dia */}
               <form onSubmit={lancarBancoHoras} className="bg-zinc-100 border border-zinc-200 rounded-2xl p-4 mb-5 shrink-0">
                  <p className="text-3xs font-bold uppercase tracking-widest text-zinc-700 mb-3">Lançar intervalo não tirado</p>
                  <div className="flex flex-wrap items-end gap-3">
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest block">Dia</label>
                        <input type="date" value={formBanco.data} onChange={e=>setFormBanco({...formBanco, data: e.target.value})} className="p-2.5 mt-1 bg-card border border-line rounded-lg font-bold text-fg-soft outline-none focus:border-emerald-600"/>
                     </div>
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest block">Minutos que faltaram</label>
                        <input type="number" min="1" max="60" value={formBanco.minutos} onChange={e=>setFormBanco({...formBanco, minutos: e.target.value})} className="w-24 p-2.5 mt-1 text-center bg-card border border-line rounded-lg font-black text-slate-800 outline-none focus:border-emerald-600"/>
                     </div>
                     <button type="submit" className="ml-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm rounded-xl transition-colors">Lançar</button>
                  </div>
                  <input type="text" placeholder="Motivo (opcional): casa cheia, evento, faltou gente..." value={formBanco.observacao} onChange={e=>setFormBanco({...formBanco, observacao: e.target.value})} className="w-full p-2.5 mt-3 bg-card border border-line rounded-lg font-medium text-sm text-fg-soft outline-none focus:border-emerald-600"/>
                  <p className="text-3xs font-medium text-zinc-700/70 mt-2">Ex.: só tirou 20 min do intervalo de 1h → lance 40 minutos. Máx. 60 por dia.</p>
               </form>

               {/* Lançamentos do mês */}
               <div className="overflow-y-auto space-y-2">
                  {lancs.length === 0 ? (
                     <p className="text-sm font-medium text-subtle text-center py-4">Nenhum lançamento neste mês.</p>
                  ) : lancs.map(b => (
                     <div key={b.id} className={`flex items-center gap-3 p-3 rounded-xl border ${b.tipo === "excesso" ? "bg-amber-50 border-amber-200" : "bg-white border-line-soft"}`}>
                        <div className="flex-1 min-w-0">
                           <p className="text-sm font-bold text-fg-soft">
                              {b.data ? b.data.split("-").reverse().join("/") : "—"} ·{" "}
                              {b.tipo === "excesso"
                                 ? <span className="text-amber-700">passou {fmtMin(Number(b.minutos) || 0)} do intervalo</span>
                                 : b.tipo === "intervalo_curto"
                                 ? <span className="text-subtle">intervalo curto (só anotação, não é crédito)</span>
                                 : <span className="text-zinc-700">{fmtMin(Number(b.minutos) || 0)}</span>}
                           </p>
                           {b.observacao && <p className="text-2xs font-medium text-subtle truncate">{b.observacao}</p>}
                        </div>
                        <button onClick={() => excluirBancoHoras(b.id)} className="p-2 text-subtle hover:text-red-500 rounded-lg"><Trash2 size={14}/></button>
                     </div>
                  ))}
               </div>
            </div>
         </div>
         );
      })()}

      {modalFolgas && funcParaFolgas && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }}>
            <div className="bg-card rounded-2xl sm:rounded-[32px] w-full max-w-[800px] p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] overflow-hidden flex flex-col">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5 sm:mb-6 shrink-0">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Gerenciar Folgas</h2>
                     <p className="text-xs font-bold text-fg">{funcParaFolgas.nome}</p>
                  </div>
                  <button onClick={() => setModalFolgas(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="flex-1 overflow-y-auto pr-0 sm:pr-2 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
                  {/* Coluna 1: Adicionar Folgas */}
                  <div>
                     <div className="bg-white p-4 rounded-2xl mb-6 border border-slate-200">
                        <p className="text-xs font-bold text-fg uppercase tracking-widest mb-2">Folgas Fixas (Semanais)</p>
                        <p className="text-sm font-medium text-slate-800 leading-snug">
                           As folgas semanais de <b>{funcParaFolgas.nome}</b> são os dias da semana que NÃO estão marcados na ficha de contratação.
                        </p>
                     </div>

                     <div className="mb-6">
                        <label className="text-xs font-bold text-zinc-700 uppercase tracking-widest block mb-1">Folga de domingo (1 p/ mês, 2 para mulheres)</label>
                        <p className="text-xs font-medium text-slate-500 mb-3">Inclui o mês passado: dá para lançar a folga de um domingo que já foi.</p>
                        <div className="space-y-4">
                           {mesesDeDomingo.map(mes => {
                              const domingosComFolga = folgasDeDomingoNoMes(folgasEsporadicas, mes.anoMes);
                              return (
                                 <div key={mes.anoMes}>
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 mb-1.5">
                                       <p className="text-xs font-black uppercase tracking-wider text-slate-700">
                                          {mes.rotulo}{mes.relativo && <span className="ml-1.5 font-bold normal-case tracking-normal text-slate-500">· {mes.relativo}</span>}
                                       </p>
                                       <span className={`text-2xs font-bold ${domingosComFolga.length ? "text-emerald-700" : "text-amber-700"}`}>
                                          {domingosComFolga.length ? `folga em ${domingosComFolga.map(dataCurta).join(", ")}` : "sem folga de domingo"}
                                       </span>
                                    </div>
                                    <div className="space-y-2">
                                       {mes.domingos.map(dom => {
                                          // Verifica conflitos com outras pessoas
                                          const folgasNestaData = todasFolgasDaUnidade.filter(f => String(f.data_folga).slice(0, 10) === dom.data && f.colaborador_id !== funcParaFolgas.id);
                                          const nomesConflito = folgasNestaData.map(f => {
                                             const colab = funcionarios.find(func => func.id === f.colaborador_id);
                                             return colab ? colab.nome : "Desconhecido";
                                          }).join(", ");
                                          const hasConflito = folgasNestaData.length > 0;
                                          const jaTemFolgaNesteDia = folgasEsporadicas.some(f => String(f.data_folga).slice(0, 10) === dom.data);

                                          return (
                                             <div key={dom.data} className={`flex flex-col border border-slate-200 p-3 rounded-xl shadow-sm ${dom.passou ? "bg-slate-50" : "bg-white"}`}>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                   <span className="font-bold text-slate-800">
                                                      Dom, {dom.label}
                                                      {dom.passou && <span className="ml-2 text-2xs font-bold uppercase tracking-wider text-slate-500">já passou</span>}
                                                   </span>
                                                   <button
                                                      onClick={() => handleAdicionarFolga(dom.data, "Domingo")}
                                                      disabled={jaTemFolgaNesteDia}
                                                      className="shrink-0 bg-zinc-100 text-zinc-700 px-3 py-1 text-xs font-bold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                      {jaTemFolgaNesteDia ? (dom.passou ? "Lançada" : "Agendada") : (dom.passou ? "Lançar folga" : "Agendar")}
                                                   </button>
                                                </div>
                                                {hasConflito && (
                                                   <span className="text-3xs font-bold text-rose-600">
                                                      Aviso: {folgasNestaData.length} funcionário(s) de folga ({nomesConflito})
                                                   </span>
                                                )}
                                             </div>
                                          );
                                       })}
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-widest block mb-1">Outra folga</label>
                        <p className="text-xs font-medium text-slate-500 mb-2">Qualquer data, inclusive uma que já passou (pede confirmação). Folga que compensa um feriado trabalhado, marcada em até 30 dias, tira o pagamento em dobro daquele feriado.</p>
                        <div className="flex flex-wrap gap-2">
                           <input type="date" value={novaFolgaData} onChange={e=>setNovaFolgaData(e.target.value)} className="flex-1 min-w-[150px] p-3 bg-white border border-slate-300 rounded-xl font-bold outline-none focus:border-emerald-500 text-slate-800"/>
                           <button onClick={() => handleAdicionarFolga(novaFolgaData, "Folga avulsa")} className="bg-emerald-600 text-white px-4 py-3 font-bold rounded-xl hover:bg-emerald-700 transition-colors">Folga avulsa</button>
                           <button onClick={() => handleAdicionarFolga(novaFolgaData, "Compensação de feriado")} className="bg-white border border-emerald-600 text-emerald-700 px-4 py-3 font-bold rounded-xl hover:bg-emerald-50 transition-colors">Compensa feriado</button>
                        </div>
                     </div>
                  </div>

                  {/* Coluna 2: Folgas Agendadas */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-4">
                     <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-4 border-b border-slate-200 pb-2">Folgas lançadas</h3>
                     <div className="space-y-3">
                        {folgasEsporadicas.length === 0 ? (
                           <p className="text-center text-sm font-bold text-slate-500 py-4">Nenhuma folga lançada.</p>
                        ) : folgasEsporadicas.map(folga => (
                           <div key={folga.id} className="flex items-center justify-between bg-card p-3 rounded-xl border border-slate-200 shadow-sm">
                              <div>
                                 <div className="font-black text-slate-800">{new Date(folga.data_folga).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</div>
                                 <div className="text-3xs font-bold text-emerald-700 uppercase">{folga.descricao || "Folga Extra"}</div>
                              </div>
                              <button onClick={() => handleRemoverFolga(folga.id)} className="text-slate-500 hover:text-rose-600 transition-colors bg-white p-2 rounded-lg"><Trash2 size={16}/></button>
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
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }}>
            <div className="bg-card rounded-2xl sm:rounded-[32px] w-full max-w-[900px] p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] overflow-hidden flex flex-col">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5 sm:mb-6 shrink-0 border-b border-line-soft pb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center">
                        <ShoppingBag size={24} />
                     </div>
                     <div>
                        <h2 className="font-black text-2xl text-slate-800">Consumo & Vales</h2>
                        <p className="text-xs font-bold text-fg">{funcionarioConsumo.nome}</p>
                     </div>
                  </div>
                  <button onClick={() => setModalConsumo(false)} className="w-10 h-10 bg-card rounded-full flex items-center justify-center text-fg hover:bg-slate-200 transition-colors"><X size={20}/></button>
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
                           <label className="text-xs font-bold text-fg uppercase tracking-widest flex items-center gap-1.5"><UtensilsCrossed size={13} /> Pratos do Cardápio</label>
                           {cardapioConsumo.length > 0 && <span className="text-3xs font-bold text-subtle">{cardapioConsumo.length} itens</span>}
                        </div>
                        {cardapioConsumo.length === 0 ? (
                           <p className="text-xs font-medium text-subtle bg-white border border-line-soft rounded-xl p-3">Nenhum prato no cardápio desta unidade. Cadastre em Catálogo e Preços, ou digite manualmente abaixo.</p>
                        ) : (
                           <>
                              <div className="relative mb-2">
                                 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                                 <input type="text" value={buscaPrato} onChange={e => setBuscaPrato(e.target.value)} placeholder="Buscar prato..." className="w-full p-2.5 pl-9 bg-white border border-line rounded-xl font-medium text-sm outline-none focus:border-teal-500 text-fg-soft" />
                              </div>
                              <div className="max-h-40 overflow-y-auto pr-1 space-y-1.5">
                                 {cardapioConsumo
                                    .filter(p => !buscaPrato || (p.nome || "").toLowerCase().includes(buscaPrato.toLowerCase()) || (p.categoria || "").toLowerCase().includes(buscaPrato.toLowerCase()))
                                    .map(p => {
                                       const selecionado = novoConsumo.descricao === p.nome;
                                       return (
                                          <button key={p.id} type="button" onClick={() => escolherPrato(p)}
                                             className={`w-full flex items-center justify-between gap-2 p-2.5 rounded-xl border text-left transition-all ${selecionado ? "bg-teal-50 border-teal-400" : "bg-card border-line hover:border-teal-300"}`}>
                                             <div className="min-w-0">
                                                <p className="font-bold text-sm text-slate-800 truncate">{p.nome}</p>
                                                {p.categoria && <p className="text-3xs font-medium text-subtle">{p.categoria}</p>}
                                             </div>
                                             <span className="font-black text-sm text-fg-soft shrink-0">{fmtBRL(p.preco)}</span>
                                          </button>
                                       );
                                    })}
                              </div>
                           </>
                        )}
                     </div>

                     <div className="space-y-4 flex-1">
                        <div>
                           <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-1">Descrição do Consumo</label>
                           <input type="text" value={novoConsumo.descricao} onChange={e=>setNovoConsumo({...novoConsumo, descricao: e.target.value})} placeholder="Ex: Almoço, Cerveja, Hambúrguer..." className="w-full p-4 bg-white border border-line rounded-xl font-bold outline-none focus:border-teal-500 text-fg-soft"/>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-1">Data / Hora</label>
                              <input type="datetime-local" value={novoConsumo.data_consumo} onChange={e=>setNovoConsumo({...novoConsumo, data_consumo: e.target.value})} className="w-full p-4 bg-white border border-line rounded-xl font-bold outline-none focus:border-teal-500 text-fg-soft"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-1">Valor Original (R$)</label>
                              <CampoDecimal value={novoConsumo.valor_original} onChange={e=>setNovoConsumo({...novoConsumo, valor_original: e.target.value})} placeholder="Ex: 50,00" className="w-full p-4 bg-white border border-line rounded-xl font-black text-fg-soft outline-none focus:border-teal-500"/>
                           </div>
                        </div>

                        <div>
                           <label className="text-xs font-bold text-fg uppercase tracking-widest block mb-1">Forma de Pagamento</label>
                           <select value={novoConsumo.forma_pagamento} onChange={e=>setNovoConsumo({...novoConsumo, forma_pagamento: e.target.value})} className="w-full p-4 bg-white border border-line rounded-xl font-bold outline-none focus:border-teal-500 text-fg-soft appearance-none">
                              <option value="Desconto em Folha">Desconto em Folha (Fica Pendente)</option>
                              <option value="Dinheiro">Dinheiro (Pago na hora)</option>
                              <option value="Pix">PIX (Pago na hora)</option>
                              <option value="Cartão">Cartão (Pago na hora)</option>
                           </select>
                        </div>
                     </div>

                     <div className="mt-6 pt-6 border-t border-line-soft">
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
                  <div className="bg-white rounded-2xl border border-line-soft p-4 flex flex-col h-full overflow-hidden">
                     <h3 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-4 border-b border-line pb-2 flex items-center justify-between">
                        <span>Extrato de Consumo</span>
                        {listaConsumo.length > 0 && (
                           <span className="text-3xs bg-slate-200 text-slate-900 px-2 py-0.5 rounded-full">{listaConsumo.length} itens</span>
                        )}
                     </h3>
                     
                     <div className="space-y-3 overflow-y-auto flex-1 pr-1 pb-4">
                        {loadingConsumo && <p className="text-center text-sm font-bold text-subtle py-4">Carregando histórico...</p>}
                        {!loadingConsumo && listaConsumo.length === 0 && (
                           <p className="text-center text-sm font-bold text-subtle py-4 flex flex-col items-center">
                              <Store size={32} className="text-dim mb-2"/>
                              Nenhum consumo registrado.
                           </p>
                        )}
                        {!loadingConsumo && listaConsumo.map(item => {
                           const isPago = item.status_pagamento === "Pago";
                           return (
                              <div key={item.id} className="bg-card p-3 rounded-xl border border-line shadow-sm relative group">
                                 <div className="flex justify-between items-start mb-2">
                                    <div>
                                       <div className="font-black text-slate-800 leading-tight">{item.descricao}</div>
                                       <div className="text-3xs font-bold text-subtle">
                                          {new Date(item.data_consumo).toLocaleString('pt-BR')}
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <div className="font-black text-teal-700">{fmtBRL(item.valor_desconto)}</div>
                                       <div className="text-3xs font-medium text-subtle line-through">De {fmtBRL(item.valor_original)}</div>
                                    </div>
                                 </div>
                                 
                                 <div className="flex items-center justify-between mt-3 pt-3 border-t border-line-soft">
                                    <div className="flex items-center gap-2">
                                       {isPago ? (
                                          <span className="flex items-center gap-1 text-3xs font-bold text-accent-strong bg-accent-soft px-2 py-1 rounded-md border border-emerald-100">
                                             <CheckCircle size={10}/> PAGO
                                          </span>
                                       ) : (
                                          <span className="flex items-center gap-1 text-3xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                             <Clock size={10}/> PENDENTE
                                          </span>
                                       )}
                                       
                                       <select 
                                          value={item.forma_pagamento} 
                                          onChange={(e) => alterarFormaPagamentoConsumo(item.id, item.status_pagamento, e.target.value)}
                                          className="text-3xs font-bold bg-white border border-line text-slate-900 rounded-md px-1 py-1 outline-none focus:border-teal-500 max-w-[120px]"
                                       >
                                          <option value="Desconto em Folha">Desconto em Folha</option>
                                          <option value="Dinheiro">Dinheiro</option>
                                          <option value="PIX">PIX</option>
                                          <option value="Cartão">Cartão</option>
                                       </select>
                                       
                                       {!isPago && (
                                          <button onClick={() => quitarConsumo(item.id)} className="text-3xs font-bold uppercase tracking-wider text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-md transition-colors">
                                             Quitar agora
                                          </button>
                                       )}
                                    </div>
                                    
                                    <button onClick={() => apagarConsumo(item.id)} className="text-subtle hover:text-rose-600 transition-colors bg-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100">
                                       <Trash2 size={14}/>
                                    </button>
                                 </div>
                              </div>
                           )
                        })}
                     </div>
                     
                     {!loadingConsumo && listaConsumo.length > 0 && (
                        <div className="pt-4 border-t border-line mt-2">
                           <div className="flex justify-between items-center text-sm">
                              <span className="font-bold text-fg uppercase tracking-widest text-xs">Total Pendente</span>
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
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" style={{ paddingTop: "calc(var(--erp-safe-top, 2.75rem) + 0.75rem)" }}>
            <div className="bg-card rounded-[32px] w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-var(--erp-safe-top,2.75rem)-1.5rem)] overflow-y-auto">
               <div className="flex items-center justify-between mb-6">
                  <div>
                     <h2 className="text-2xl font-black tracking-tight text-slate-800">Lançar Diária</h2>
                     <p className="text-fg font-medium text-sm">Desmembramento do Financeiro</p>
                  </div>
                  <button onClick={() => setModalLancamento(false)} className="w-10 h-10 flex items-center justify-center bg-card text-fg rounded-full hover:bg-slate-200 transition-colors">
                     <X size={20} />
                  </button>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                     <label className="text-3xs font-bold text-success uppercase tracking-widest block mb-1">Valor Total Pago (R$)</label>
                     <input type="text" value={formLancamento.total} onChange={e => handleTotalLancamentoChange(e.target.value)} className="w-full bg-transparent text-2xl font-black text-emerald-800 outline-none" />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest block mb-1">INSS (5%)</label>
                        <input type="text" value={formLancamento.inss} onChange={e => setFormLancamento({...formLancamento, inss: e.target.value})} className="w-full p-3 bg-white border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500" />
                     </div>
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest block mb-1">FGTS (8%)</label>
                        <input type="text" value={formLancamento.fgts} onChange={e => setFormLancamento({...formLancamento, fgts: e.target.value})} className="w-full p-3 bg-white border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500" />
                     </div>
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest block mb-1">Taxa Serviço (10%)</label>
                        <input type="text" value={formLancamento.taxa} onChange={e => setFormLancamento({...formLancamento, taxa: e.target.value})} className="w-full p-3 bg-white border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500" />
                     </div>
                     <div>
                        <label className="text-3xs font-bold text-fg uppercase tracking-widest block mb-1">Valor Fixo Base</label>
                        <input type="text" value={formLancamento.fixo} onChange={e => setFormLancamento({...formLancamento, fixo: e.target.value})} className="w-full p-3 bg-white border border-line rounded-xl font-bold text-fg-soft outline-none focus:border-emerald-500" />
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
