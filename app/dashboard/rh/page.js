"use client";

import { useState, useEffect, useRef } from "react";
import { comprimirFotoParaIA } from "../../lib/imagem";
import { useRouter } from "next/navigation";
import { useERP } from "../../context/ERPContext";
import {
  fetchColaboradores, inserirColaborador, removerColaborador, atualizarColaborador, 
  fetchDocumentos, uploadDocumentoRH, removerDocumento,
  fetchCargos, fetchHistoricoPromocoes,
  fetchAllFolgasDaUnidade, fetchFolgasEsporadicas, inserirFolgaEsporadica, removerFolgaEsporadica,
  fetchConsumoFuncionario, inserirConsumoFuncionario, atualizarStatusConsumo, removerConsumoFuncionario,
  fetchBancoHoras, inserirBancoHoras, removerBancoHoras, BANCO_LIMITE_MIN, BANCO_ALERTA_MIN,
  fetchAdvertenciasColab, inserirAdvertencia, removerAdvertencia,
  fetchFeriados, inserirFeriado, removerFeriado,
  liberarPontoDia, fetchLiberacoesColab, removerLiberacao,
  salvarReciboPrestacao, fetchRecibosPrestacao, atualizarPagamentoRecibo, anexarFotoReciboAssinado,
  desligarColaborador
} from "../../lib/rh";
import { fetchPontoHoje, fetchPontosMes, fetchPontosMesUnidade, fetchHistoricoPontoCompleto } from "../../lib/ponto";
import { situacaoDoPonto } from "../../lib/ponto-status.mjs";
import { situacaoExperiencia, emExperiencia, tempoDeCasa, aniversario, ESTADOS_CIVIS, ESCOLARIDADES, GENEROS } from "../../lib/contrato-experiencia.mjs";
import { fetchValesPendentes } from "../../lib/rh";
import { calcularAdicionaisMes, calcularAdicionaisPorDia, jornadaContratadaMin } from "../../lib/rh";
import { mascaraCPF, mascaraRG, mascaraTelefone } from "../../lib/mascaras.mjs";
import { salvarConta, fetchContas, fetchLancamentos } from "../../lib/financeiro";
import { fetchCardapio } from "../../lib/cardapio";
import { fetchProdutos } from "../../lib/vendas";
import { fetchParams, PARAMS_PADRAO } from "../../lib/parametros";
import { useTempoReal } from "../../lib/realtime";

// Desconto do funcionário sobre o valor de cardápio (funcionário paga o restante)
// Desconto do funcionário: ajustável em Configurações > Parâmetros (paramsSis)
import { 
  Users, UserPlus, FileText, Upload, Save, X, Search, Trash2, Loader2, CalendarHeart, Star, Phone, CreditCard, ClipboardList, Clock, CalendarDays, ShoppingBag, CheckCircle, Store, Printer, UtensilsCrossed, LogOut, RotateCcw, ChevronDown, Camera, Award
} from "lucide-react";
import { fmtBRL } from "../../components/ui";
import { comFecharImpressao } from "../../lib/imprimir";
import BancoTalentos from "./components/BancoTalentos";
import PlanoCargos, { imprimirCertificadoPromocao } from "./components/PlanoCargos";

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

function percentualCadastroFuncionario(f) {
  const campos = [
    f?.nome, f?.cargo, f?.telefone, f?.cpf, f?.rg, f?.rua_av, f?.bairro,
    f?.cidade_uf, f?.cep, f?.data_nascimento, f?.chave_pix, f?.salario,
    f?.data_admissao, f?.horario_entrada, f?.horario_saida, f?.dias_trabalho,
  ];
  return Math.round((campos.filter(valor => String(valor ?? "").trim()).length / campos.length) * 100);
}

export default function RHPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  // "71 dias de Seldeestrela" diz mais que "71 dias de casa": a equipe chama a
  // unidade pelo nome, e quem opera mais de uma precisa saber de qual se trata.
  const nomeDaCasa = unidadeInfo?.nome || "casa";
  
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
  const statePadrao = { foto: "", nome: "", cargo: "", salario: "", vale_alimentacao: "", taxa_servico_mes: "", horario_entrada: "", horario_saida: "", horario_dom_entrada: "", horario_dom_saida: "", intervalo_inicio: "", intervalo_fim: "", intervalo_dom_inicio: "", intervalo_dom_fim: "", horario_por_dia: false, horarios_dia: {}, dias_trabalho: "1,2,3,4,5,6", tempo_intervalo: 60, tipo_contrato: "Fixo", telefone: "", email: "", cpf: "", rg: "", rua_av: "", numero_casa: "", bairro: "", cidade_uf: "", chave_pix: "", avaliacao_estrelas: 0, anotacoes_rh: "", data_admissao: "", status_contrato: "Definitivo", supervisor_id: "", supervisores_ids: [], endereco: "", cep: "", cidade_nascimento: "", data_nascimento: "", tem_transporte: false, tipo_transporte: "", usa_vale_transporte: false, pontos_taxa: "", genero: "", escolaridade: "", estado_civil: "", nome_pai: "", nome_mae: "", filhos: [],
    // Dados do Recibo de Trabalho Extra: ficam no cadastro para o recibo já sair preenchido
    topicos_funcao: "", itens_emprestados: "", forma_pagamento: "Pix", vale_transporte_val: "", setor_entrega: "", janta_ofertada: true };
  // Cargos de liderança sempre disponíveis, além dos cargos cadastrados
  const CARGOS_LIDERANCA = ["CEO", "Supervisor", "Gerente"];
  const [modalNovo, setModalNovo] = useState(false);
  const [menuAcoes, setMenuAcoes] = useState(null);
  const [detAberto, setDetAberto] = useState({}); // detalhamento salarial por card // funcionário com o menu "Ações" aberto
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

  // Liberar o ponto do extra/freelancer para hoje (com a diária combinada).
  const dataHojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const liberarPontoHoje = async (f) => {
    const bruto = prompt(`Liberar o ponto de HOJE para ${f.nome}.\n\nValor da diária combinada (R$):`, f?.salario ? String(f.salario) : "");
    if (bruto === null) return;
    const valor = parseFloat(String(bruto).replace(",", ".")) || 0;
    const { error } = await liberarPontoDia(f.id, unidadeAtiva, dataHojeISO(), valor);
    if (error) return alert(/rh_ponto_liberado/.test(error) ? "Rode o SQL da tabela rh_ponto_liberado (te passei no chat)." : "Erro ao liberar: " + error);
    alert(`Ponto liberado para ${f.nome} hoje. Diária: ${fmtBRL(valor)}. Ele já pode bater o ponto.`);
  };

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

  // Trajetória / Linha do Tempo de Carreira
  const [modalCarreira, setModalCarreira] = useState(null); // { func, lista, loading }
  const abrirHistoricoCarreira = async (f) => {
    setModalCarreira({ func: f, lista: [], loading: true });
    const data = await fetchHistoricoPromocoes(f.id);
    setModalCarreira({ func: f, lista: data || [], loading: false });
  };

  const abrirModalFicha = (f) => {
    if (!f?.id) {
      setBuscaRecibo("");
      setModalEscolherExtra(true);
      return;
    }
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
    const ad = calcularAdicionaisMes(meusPontos, fixo, feriadosMesAtual, { contratadaDoDia: (d) => jornadaContratadaMin(f, d) });
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
    const { error } = await removerBancoHoras(id);
    if (error) return alert(`Não consegui remover este lançamento: ${error}`);
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
      const ad = calcularAdicionaisMes(pontos || [], f.salario, feriadosMes || [], { contratadaDoDia: (d) => jornadaContratadaMin(f, d) });
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
  // ── HOLERITE (recibo de pagamento) com INSS progressivo e FGTS ────────────
  // Tabela INSS vigente (2025) — atualizar as faixas quando o governo reajustar.
  const INSS_FAIXAS = [
    { ate: 1518.00, aliq: 0.075 },
    { ate: 2793.88, aliq: 0.09 },
    { ate: 4190.83, aliq: 0.12 },
    { ate: 8157.41, aliq: 0.14 },
  ];
  const calcularINSS = (base) => {
    let inss = 0, anterior = 0;
    for (const fx of INSS_FAIXAS) {
      if (base > anterior) inss += (Math.min(base, fx.ate) - anterior) * fx.aliq;
      anterior = fx.ate;
    }
    return Math.round(inss * 100) / 100;
  };

  const gerarHolerite = (f, p) => {
    const mesLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const brutoTrib = (p.fixo || 0) + (p.adicionais || 0) + (p.taxa || 0); // base de INSS/FGTS
    const inss = calcularINSS(brutoTrib);
    const fgts = Math.round(brutoTrib * 0.08 * 100) / 100; // depósito do empregador (informativo)
    const liquido = brutoTrib + (p.va || 0) - inss - (p.descontos || 0);
    const linha = (desc, prov, descto) => `<tr><td>${desc}</td><td class="r">${prov ? fmtBRL(prov) : ""}</td><td class="r">${descto ? fmtBRL(descto) : ""}</td></tr>`;
    let linhas = linha("Salário base", p.fixo, 0);
    if (p.ad?.valorExtra > 0) linhas += linha("Horas extras (+50%)", p.ad.valorExtra, 0);
    if (p.ad?.valorNoturno > 0) linhas += linha("Adicional noturno (+20%)", p.ad.valorNoturno, 0);
    if (p.ad?.valorFeriado > 0) linhas += linha("Feriado trabalhado (+100%)", p.ad.valorFeriado, 0);
    if (p.taxa > 0) linhas += linha("Taxa de serviço (gorjeta)", p.taxa, 0);
    if (p.va > 0) linhas += linha("Vale-alimentação (benefício)", p.va, 0);
    linhas += linha("INSS (tabela progressiva)", 0, inss);
    if (p.descontos > 0) linhas += linha("Vales / adiantamentos", 0, p.descontos);
    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) return alert("Habilite os popups para gerar o holerite.");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Holerite — ${f.nome}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;padding:12mm;max-width:720px;margin:0 auto;font-size:13px}
      .head{border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end}
      h1{font-size:20px;text-transform:uppercase;letter-spacing:2px}.mes{font-weight:900;font-size:14px;text-transform:capitalize}
      .dados{font-size:12px;color:#333;margin-bottom:10px;line-height:1.6}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:7px 8px;font-size:12px}
      th{background:#f1f5f9;text-transform:uppercase;font-size:10px;letter-spacing:1px}td.r{text-align:right;width:110px;font-weight:bold}
      .tot{background:#f8fafc;font-weight:900}
      .liq{margin-top:10px;display:flex;justify-content:space-between;border:2px solid #111;border-radius:8px;padding:10px 14px;font-size:16px;font-weight:900}
      .fgts{margin-top:8px;font-size:11px;color:#475569}
      .assin{margin-top:34px;display:flex;justify-content:space-between;gap:40px}.assin div{flex:1;border-top:1px solid #111;padding-top:4px;font-size:10px;text-align:center;color:#444}
      @media print{@page{margin:10mm}}
    </style></head><body>
      <div class="head"><h1>Recibo de Pagamento</h1><span class="mes">${mesLabel}</span></div>
      <div class="dados"><b>${f.nome}</b> · ${f.cargo || "—"}${f.cpf ? ` · CPF: ${f.cpf}` : ""}<br/>${unidadeInfoRH()}</div>
      <table><thead><tr><th>Descrição</th><th>Proventos</th><th>Descontos</th></tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr class="tot"><td>Totais</td><td class="r">${fmtBRL(brutoTrib + (p.va || 0))}</td><td class="r">${fmtBRL(inss + (p.descontos || 0))}</td></tr></tfoot></table>
      <div class="liq"><span>LÍQUIDO A RECEBER</span><span>${fmtBRL(liquido)}</span></div>
      <div class="fgts">FGTS do mês (depósito do empregador, não descontado): <b>${fmtBRL(fgts)}</b> (8% sobre ${fmtBRL(brutoTrib)}) · Base INSS: ${fmtBRL(brutoTrib)} · DSR incluso na remuneração mensal (Lei 605/49).</div>
      <div class="assin"><div>Empregador</div><div>${f.nome}</div></div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };
  const unidadeInfoRH = () => (unidadeInfo?.nome ? `Unidade: ${unidadeInfo.nome}` : "");

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
      const resp = await fetch("/api/ia-ficha-extra", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imagem_base64: base64, media_type: "image/jpeg" }) });
      const d = await resp.json();
      if (!resp.ok || d.error) { alert(d.error || "Falha ao ler a ficha."); return; }
      if (!confirm(`A IA leu na ficha:\n\nNome: ${d.nome}\nDiária: R$ ${(d.diaria || 0).toFixed(2)}\nTelefone: ${d.telefone || "—"}\nCPF: ${d.cpf || "—"}\nPIX: ${d.chave_pix || "—"}\n\nCadastrar como EXTRA e anexar a foto da ficha no sistema?`)) return;
      const jaExiste = funcionarios.find(f => (f.nome || "").toLowerCase() === d.nome.toLowerCase());
      let colabId = jaExiste?.id;
      if (!colabId) {
        const r = await inserirColaborador({ unidade_id: unidadeAtiva, nome: d.nome, cargo: "Extra", tipo_contrato: "Freelancer", salario: d.diaria || 0, telefone: d.telefone || null, cpf: d.cpf || null, chave_pix: d.chave_pix || null, anotacoes_rh: d.observacoes || null, dias_trabalho: "" });
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
  const filtrados = abaAtiva === "Ex-funcionários"
    ? funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()) && ehInativo(f))
    : funcionarios.filter(f => f.nome.toLowerCase().includes(busca.toLowerCase()) && (f.tipo_contrato || "Fixo") === abaAtiva && !ehInativo(f));

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
    const hoje = new Date().toLocaleDateString('pt-BR');
    const dados = opcoes.dados || {};
    const esc = (valor) => String(valor ?? "").replace(/[&<>"]/g, caractere => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
    }[caractere]));
    const seguro = (valor, vazio = "—") => esc(String(valor || "").trim() || vazio);
    const dataBR = (valor) => {
      if (!valor) return "—";
      const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
      return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
    };
    const nome = seguro(dados.nome || funcionario?.nome);
    const cpf = seguro(formatarCPF(dados.cpf || funcionario?.cpf));
    const rg = seguro(dados.rg || funcionario?.rg);
    const cargo = seguro(dados.funcao || funcionario?.cargo);

    // Diária desmembrada (mesma regra do "Lançar Diária"): fixo + INSS 5% + FGTS 8% + taxa de serviço 10%
    // O valor digitado na hora da impressão tem prioridade sobre o cadastro.
    const diariaTotal = parseFloat(String(opcoes.diaria ?? (funcionario?.salario || "")).replace(",", ".")) || 0;
    // Nº de dias combinados (ex.: terça a domingo = 6). O total soma diária × dias.
    const dias = Math.max(1, Number(opcoes.dias) || 1);
    const totalGeral = diariaTotal * dias;
    // Itens escolhidos na hora (ou o kit padrão)
    const itensLista = Array.isArray(opcoes.itens) && opcoes.itens.length ? opcoes.itens : ITENS_FICHA_PADRAO;
    const dInss = diariaTotal * 0.05;
    const dFgts = diariaTotal * 0.08;
    const dTaxa = diariaTotal * 0.10;
    const dFixo = diariaTotal - dInss - dFgts - dTaxa;
    const money = (v) => diariaTotal > 0 ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
    const moedaOpcional = (valor) => {
      const numero = parseFloat(String(valor || "").replace(",", ".")) || 0;
      return numero ? `R$ ${numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 0,00";
    };
    const telefone = seguro(dados.telefone || funcionario?.telefone);
    const pix = seguro(dados.chave_pix || funcionario?.chave_pix);
    const endereco = seguro(formatarEnderecoComp(dados, funcionario));
    const horaIni = seguro(dados.entrada || funcionario?.horario_entrada);
    const horaFim = seguro(dados.saida_final || funcionario?.horario_saida);
    const diariaAcordada = diariaTotal > 0 ? money(diariaTotal) : "R$ 0,00";
    const valeTransporte = parseFloat(String(dados.vale_transporte || "").replace(",", ".")) || 0;
    const adicional = parseFloat(String(dados.adicional || "").replace(",", ".")) || 0;
    const descontos = parseFloat(String(dados.descontos || "").replace(",", ".")) || 0;
    const totalPagar = Math.max(0, totalGeral + valeTransporte + adicional - descontos);
    const reciboNumero = opcoes.numero || `RPS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(funcionario?.id || Date.now()).slice(-6).toUpperCase()}`;
    const topicosFuncao = String(dados.topicos_funcao || "").split("\n").map(l => l.trim()).filter(Boolean);
    
    const html = `
      <html>
        <head>
          <title>Recibo de Prestação de Serviço</title>
          <style>
            @page { size: A4 portrait; margin: 9mm; }
            * { box-sizing: border-box; }
            body { font-family: Inter, Arial, sans-serif; padding: 4px; color: #172033; line-height: 1.35; font-size: 11px; }
            .document-header { display:flex; align-items:center; justify-content:space-between; gap:18px; background:linear-gradient(135deg,#064e3b,#047857); color:#fff; border-radius:12px; padding:15px 18px; margin-bottom:12px; }
            .brand { font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; opacity:.9; }
            h1 { margin: 3px 0 2px; font-size: 21px; line-height:1.05; letter-spacing:.02em; }
            .subtitle { font-size:9px; opacity:.82; }
            .receipt-id { text-align:right; font-size:9px; line-height:1.5; white-space:nowrap; }
            .section { margin-bottom: 10px; break-inside: avoid; }
            .section-title { font-size: 10px; font-weight: 900; color:#065f46; border-left:4px solid #10b981; background:#ecfdf5; padding: 5px 8px; border-radius: 0 6px 6px 0; margin-bottom: 6px; text-transform: uppercase; letter-spacing:.08em; }
            .data-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; }
            .field { border-bottom:1px solid #cbd5e1; padding:3px 2px 5px; min-height:24px; }
            .field span { display:block; color:#64748b; font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; }
            .field strong { display:block; margin-top:2px; font-size:11px; color:#172033; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; font-size: 10px; }
            th { background: #f1f5f9; font-size: 8px; text-transform: uppercase; color: #475569; letter-spacing:.04em; }
            .signature-box { height: 34px; }
            .checkbox { width: 12px; height: 12px; border: 1px solid #64748b; display: inline-flex; align-items:center; justify-content:center; margin-right: 6px; vertical-align: middle; border-radius: 3px; font-size:9px; font-weight:900; }
            .agreement { font-size:9px; color:#334155; border:1px solid #cbd5e1; border-radius:8px; padding:7px 9px; line-height:1.45; margin:0; background:#f8fafc; }
            .signatures { display:flex; justify-content:space-between; gap:34px; margin-top:34px; }
            .signature { flex:1; border-top:1px solid #172033; padding-top:4px; text-align:center; font-size:9px; }
            .topics-box { background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:7px 10px; font-size:10px; line-height:1.5; color:#1e293b; }
            .topic-item { margin-bottom:3px; display:flex; align-items:flex-start; gap:4px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <header class="document-header">
            <div>
              <div class="brand">${seguro(unidadeInfo?.nome, "Seldeestrela")}</div>
              <h1>RECIBO DE PRESTAÇÃO DE SERVIÇO</h1>
              <div class="subtitle">Comprovante de diária, atribuições operacionais e acerto financeiro</div>
            </div>
            <div class="receipt-id"><strong>${reciboNumero}</strong><br/>Emitido em ${hoje}<br/>Via do Restaurante e do Prestador</div>
          </header>

          <div class="section">
             <div class="section-title">Dados Pessoais do Prestador</div>
             <div class="data-grid">
                <div class="field"><span>Nome completo</span><strong>${nome}</strong></div>
                <div class="field"><span>CPF / RG</span><strong>${cpf} · ${rg}</strong></div>
                <div class="field" style="grid-column:1/-1"><span>Endereço (Rua/Av, Nº, Bairro)</span><strong>${endereco}</strong></div>
                <div class="field"><span>Telefone</span><strong>${telefone}</strong></div>
                <div class="field"><span>Chave PIX</span><strong>${pix}</strong></div>
             </div>
          </div>

          <div class="section">
             <div class="section-title">Acordo de Trabalho e Função</div>
             <div class="data-grid">
                <div class="field"><span>Data do trabalho</span><strong>${dataBR(dados.data_trabalho)}</strong></div>
                <div class="field"><span>Evento / ocasião</span><strong>${seguro(dados.evento)}</strong></div>
                <div class="field"><span>Função exercida</span><strong>${cargo}</strong></div>
                <div class="field"><span>Carga acordada</span><strong>${horaIni} às ${horaFim} · intervalo ${seguro(dados.intervalo)}</strong></div>
                <div class="field" style="grid-column:1/-1"><span>Benefício durante o turno</span><strong>${dados.janta_ofertada ? "Janta ofertada pelo restaurante" : "Janta não incluída"}</strong></div>
                <div style="grid-column: 1 / -1; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; padding:6px 9px;">
                   <strong>Diária acordada: ${diariaAcordada}</strong>
                   ${dias > 1 ? `&nbsp;·&nbsp; <strong>Dias: ${dias}</strong> &nbsp;·&nbsp; <strong>Subtotal: ${money(totalGeral) || "R$ 0,00"}</strong>` : ""}
                   <span style="color:#64748b; font-size:8px; display:block; margin-top:2px;">Valores e composição detalhados no acerto financeiro.</span>
                </div>
             </div>
          </div>

          ${topicosFuncao.length > 0 ? `
          <div class="section">
             <div class="section-title">Atribuições / O que fará no trabalho</div>
             <div class="topics-box">
                ${topicosFuncao.map(t => `<div class="topic-item"><span>•</span> <span>${esc(t.replace(/^[•\-\*]\s*/, ""))}</span></div>`).join("")}
             </div>
          </div>
          ` : ""}

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
                   <td class="signature-box"><strong>${horaIni}</strong></td>
                   <td class="signature-box"><strong>${seguro(dados.saida_intervalo)}</strong></td>
                   <td class="signature-box"><strong>${seguro(dados.retorno_intervalo)}</strong></td>
                   <td class="signature-box"><strong>${horaFim}</strong></td>
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
                   <td><span class="checkbox">✓</span> ${esc(item)}</td>
                   <td class="signature-box"></td>
                   <td class="signature-box"></td>
                 </tr>`).join("")}
               </tbody>
            </table>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 10px;">
               <div><strong>Entregue por:</strong><br/>${seguro(dados.responsavel_entrega)}</div>
               <div><strong>Local / setor:</strong><br/>${seguro(dados.setor_entrega)}</div>
               <div><strong>Devolução conferida por:</strong><br/>${seguro(dados.conferencia_devolucao)}</div>
               <div><strong>Horário da devolução:</strong> ${seguro(dados.horario_devolucao)}<br/></div>
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
                   ${dias > 1 ? `<tr style="background:#f1f5f9;">
                     <td><strong>Total dos dias (${dias} × ${money(diariaTotal) || "diária"})</strong></td>
                     <td><strong>${diariaTotal > 0 ? money(totalGeral) : ""}</strong></td>
                   </tr>` : ""}
                   <tr>
                     <td>Vale Transporte / Passagem</td>
                     <td>${moedaOpcional(dados.vale_transporte)}</td>
                   </tr>
                   <tr>
                     <td>Adicional / Bônus</td>
                     <td>${moedaOpcional(dados.adicional)}</td>
                   </tr>
                   <tr>
                     <td>Descontos / Faltas / Quebras</td>
                     <td>${moedaOpcional(dados.descontos)}</td>
                   </tr>
                   <tr>
                     <td><strong>Total a Pagar${dias > 1 ? ` (${dias} dias)` : ""}</strong></td>
                     <td><strong>${diariaTotal > 0 ? `R$ ${totalPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 0,00"}</strong></td>
                   </tr>
                 </tbody>
               </table>
               
               <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 10px;">
                  <div>
                    <strong>Forma de Pagamento:</strong><br/>
                    <span class="checkbox" style="margin-top:3px;">${dados.forma_pagamento === "Pix" ? "✓" : ""}</span> Pix
                    <span class="checkbox" style="margin-top:3px; margin-left: 10px;">${dados.forma_pagamento === "Dinheiro" ? "✓" : ""}</span> Dinheiro
                    <span class="checkbox" style="margin-top:3px; margin-left: 10px;">${dados.forma_pagamento === "Transferência" ? "✓" : ""}</span> Transferência
                  </div>
                  <div>
                    <strong>Assinatura de Recebimento:</strong><br/>
                    <div style="border-bottom: 1px solid #000; width: 100%; height: 18px;"></div>
                  </div>
               </div>
               <div style="margin-top:6px; padding:6px 8px; border-radius:6px; background:${dados.pagamento_realizado ? "#ecfdf5" : "#fff7ed"}; color:${dados.pagamento_realizado ? "#065f46" : "#9a3412"}; font-size:9px; font-weight:800;">
                 ${dados.pagamento_realizado ? `Pagamento realizado em ${dataBR(dados.data_pagamento)}.` : "Pagamento pendente."}
               </div>
            </div>
            </div>

            <div class="section" style="margin-top: 14px;">
               <p class="agreement">
                  Declaro que <strong>li e estou de acordo</strong> com o valor da diária e seu desmembramento (valor fixo, INSS, FGTS e taxa de serviço), com a carga de trabalho acordada para o dia e com a responsabilidade pela devolução dos itens recebidos, em perfeito estado, no caixa, ao término do turno.
               </p>
               <div class="signatures">
                  <div class="signature">
                     Assinatura do profissional extra
                  </div>
                  <div class="signature">
                     Assinatura do responsável da empresa
                  </div>
               </div>
               <p style="font-size: 8px; color: #94a3b8; margin-top: 10px; text-align: center; margin-bottom: 0;">Documento ${reciboNumero} · Emitido pelo sistema em ${hoje} · Arquivar junto ao cadastro do profissional.</p>
            </div>
          </body>
        </html>
    `;

    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para gerar o recibo.");
    win.document.write(comFecharImpressao(html));
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const abrirModalNovo = () => {
    setEditandoId(null);
    setNovoFunc(statePadrao);
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
    setNovoFunc({
       foto: f.foto || "",
       nome: f.nome || "",
       cargo: f.cargo || "",
       salario: f.salario || "",
       horario_entrada: f.horario_entrada || "",
       horario_saida: f.horario_saida || "",
       horario_dom_entrada: f.horario_dom_entrada || "",
       horario_dom_saida: f.horario_dom_saida || "",
       horario_por_dia: !!f.horario_por_dia,
       horarios_dia: (f.horarios_dia && typeof f.horarios_dia === "object") ? f.horarios_dia : {},
       dias_trabalho: f.dias_trabalho || "1,2,3,4,5,6",
       tempo_intervalo: f.tempo_intervalo || 60,
       intervalo_inicio: f.intervalo_inicio || "",
       intervalo_fim: f.intervalo_fim || "",
       intervalo_dom_inicio: f.intervalo_dom_inicio || "",
       intervalo_dom_fim: f.intervalo_dom_fim || "",
       tipo_contrato: f.tipo_contrato || "Fixo",
       telefone: f.telefone || "",
       email: f.email || "",
       cpf: f.cpf || "",
       rg: f.rg || "",
       rua_av: f.rua_av || f.rua || "",
       numero_casa: f.numero_casa || f.numero || "",
       bairro: f.bairro || "",
       cidade_uf: f.cidade_uf || f.cidade || "",
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
       nome_pai: f.nome_pai || "",
       nome_mae: f.nome_mae || "",
       filhos: Array.isArray(f.filhos) ? f.filhos : [],
       data_nascimento: f.data_nascimento || "",
       tem_transporte: !!f.tem_transporte,
       tipo_transporte: f.tipo_transporte || "",
       usa_vale_transporte: !!f.usa_vale_transporte,
       pontos_taxa: f.pontos_taxa != null ? String(f.pontos_taxa) : "",
       genero: f.genero || "",
       escolaridade: f.escolaridade || "",
       estado_civil: f.estado_civil || "",
       // Dados que alimentam o Recibo de Trabalho Extra
       topicos_funcao: f.topicos_funcao || "",
       itens_emprestados: f.itens_emprestados || "",
       forma_pagamento: f.forma_pagamento || "Pix",
       vale_transporte_val: f.vale_transporte_val ?? "",
       setor_entrega: f.setor_entrega || "",
       janta_ofertada: f.janta_ofertada !== false
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
    if (editandoId) {
      const { error } = await atualizarColaborador(editandoId, payload);
      if (error) return alert("Erro ao atualizar: " + error);
    } else {
      const { data, error } = await inserirColaborador(payload);
      if (error) return alert("Erro ao salvar: " + error);
      colaboradorSalvo = data || payload;
    }
    
    setModalNovo(false);
    setEditandoId(null);
    setNovoFunc(statePadrao);
    await carregar();
    if (cadastroNovo && payload.tipo_contrato === "Freelancer") {
      abrirModalFicha(colaboradorSalvo || payload);
    }
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
      const { error } = await removerColaborador(id);
      if (error) return alert(`Não consegui apagar este funcionário: ${error}`);
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
     
     // Tempo de casa: aparece para todo mundo, em experiência ou efetivo.
     const casa = tempoDeCasa(f, hj);
     if (casa) badges.push({ text: `${casa.texto} de ${nomeDaCasa}`, color: 'text-slate-700 bg-slate-100 border-slate-200' });

     // Aniversário próximo (ou hoje) — o RH costuma querer lembrar.
     const aniv = aniversario(f, hj);
     if (aniv?.ehHoje) badges.push({ text: `Aniversário hoje (${aniv.idade} anos)`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' });
     else if (aniv && aniv.faltam <= 15) badges.push({ text: `Aniversário em ${aniv.faltam} dia(s) · ${aniv.diaMes}`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' });

     if (emExperiencia(f)) {
        // A experiência renova sozinha no 2º período até alguém efetivar.
        const s = situacaoExperiencia(f, hj);
        if (s && !s.erro) {
           if (s.vencido) {
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
        const { error } = await removerDocumento(docId, url);
        if (error) return alert(`Não consegui apagar este documento: ${error}`);
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
            <div className="flex items-center gap-2 flex-wrap">
               <button onClick={abrirModalNovo} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20">
                  <UserPlus size={16} /> Novo funcionário
               </button>
               <button onClick={() => router.push("/dashboard/rh/extra")} className="flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors">
                  <UserPlus size={16} /> Cadastro de extras
               </button>
               <button onClick={() => router.push('/dashboard/rh/fechamento')} className="flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors">
                  <ClipboardList size={16} /> Fechar folha
               </button>
               <button onClick={() => { setAbaAtiva("Freelancer"); abrirModalFicha(null); }} className="flex items-center gap-2 bg-white text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-colors">
                  <Printer size={16} /> Recibos de extras
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
            <a
               href={(!unidadeAtiva || unidadeAtiva === "todas") ? "#" : `/exportar-afd?unidadeId=${unidadeAtiva}`}
               onClick={(e) => { if(!unidadeAtiva || unidadeAtiva === "todas") { e.preventDefault(); alert("Por favor, selecione uma unidade específica no menu lateral esquerdo para exportar o AFD daquela empresa."); } }}
               target={(!unidadeAtiva || unidadeAtiva === "todas") ? "_self" : "_blank"}
               rel="noreferrer"
               className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs transition-colors border ${(!unidadeAtiva || unidadeAtiva === "todas") ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"}`}>
               <FileText size={14} /> Exportar AFD
            </a>
            {abaAtiva === "Freelancer" && (
               <>
               <button onClick={() => abrirModalFicha(null)} className="flex items-center gap-1.5 bg-white text-amber-700 border border-amber-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-amber-50 transition-colors">
                  <Printer size={14} /> Recibo de Trabalho Extra
               </button>
               <input ref={inputFichaExtraRef} type="file" accept="image/*" onChange={lerFichaExtraFoto} className="hidden" />
               <button onClick={() => inputFichaExtraRef.current?.click()} disabled={lendoFichaExtra}
                  title="Tire a foto de um recibo preenchido: a IA lê os dados, cadastra o extra e anexa a foto como documento"
                  className="flex items-center gap-1.5 bg-white text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-colors disabled:opacity-60">
                  {lendoFichaExtra ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Ler Recibo Preenchido (IA)
               </button>
               </>
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
            // Gasto POR DIA: fixos = salário rateado pelos dias da escala;
            // extras = diárias de quem bateu ponto hoje
            const fixosDia = fixos.reduce((s, f) => {
               const n = (f.dias_trabalho || "").split(",").filter(Boolean).length;
               return s + (n ? (Number(f.salario) || 0) / (n * 4.345) : 0);
            }, 0);
            const idsPontoHoje = new Set(pontosHoje.map(p => p.colaborador_id));
            const extrasDiaHoje = extras.filter(f => idsPontoHoje.has(f.id)).reduce((s, f) => s + (Number(f.salario) || 0), 0);
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
            const trabalhandoAgora = new Set(pontosHoje.map(p => p.colaborador_id)).size;
            const emExperiencia = fixos.filter(f => String(f.status_contrato || "").toLowerCase().includes("experi")).length;
            const incompletos = ativos.filter(f => !f.data_admissao || !f.cpf).length;
            const cards = [
               { rot: "Funcionários", val: ativos.length, sub: `${fixos.length} fixos · ${extras.length} extras` },
               { rot: "Bateram ponto hoje", val: trabalhandoAgora, sub: "presença registrada" },
               { rot: "Em experiência", val: emExperiencia, sub: "contrato de experiência" },
               { rot: "Folha prevista (mês)", val: fmtBRL(folhaFixa), sub: `${fixos.length} fixos · salário + VA + taxa` },
               { rot: "Gasto com extras (mês)", val: fmtBRL(gastoExtras), sub: `${extras.length} extras · diárias batidas` },
               { rot: "CMO total", val: fmtBRL(total), sub: pct === null ? "folha + extras" : `${pct.toFixed(1)}% do faturamento` },
            ];
            return (
               <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {cards.map(c => (
                     <div key={c.rot} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-3 py-2.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-tight">{c.rot}</p>
                        <p className="text-lg font-black text-emerald-700 mt-0.5">{c.val}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate">{c.sub}</p>
                     </div>
                  ))}
                  {incompletos > 0 && (
                     <div className="bg-red-50 rounded-2xl border border-red-200 shadow-sm px-3 py-2.5">
                        <p className="text-[9px] font-black uppercase tracking-wider text-red-400 leading-tight">Cadastros incompletos</p>
                        <p className="text-lg font-black text-red-600 mt-0.5">{incompletos}</p>
                        <p className="text-[10px] font-bold text-red-400 truncate">sem admissão / CPF</p>
                     </div>
                  )}
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
            const cores = { erro: "bg-rose-50 border-rose-200 text-rose-700", aviso: "bg-emerald-50 border-emerald-200 text-emerald-800", info: "bg-emerald-50 border-emerald-100 text-emerald-700" };
            return <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
               <div className="flex items-center justify-between mb-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Central de prazos</p><h3 className="font-black text-slate-800">Experiência, admissão e revisão de férias</h3></div><span className="text-xs font-black bg-rose-100 text-rose-700 px-2.5 py-1 rounded-full">{alertas.length}</span></div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{alertas.slice(0, 8).map(a => <button key={`${a.id}-${a.texto}`} onClick={() => router.push(`/dashboard/rh/funcionario/${a.id}`)} className={`text-left border rounded-xl px-3 py-2 transition-all hover:shadow-sm ${cores[a.nivel]}`}><p className="text-xs font-black">{a.nome}</p><p className="text-[10px] font-bold mt-0.5">{a.texto} · toque para abrir</p></button>)}</div>
               {alertas.length > 8 && <p className="text-[10px] font-bold text-slate-400 mt-2">Mais {alertas.length - 8} alerta(s) nos cadastros abaixo.</p>}
               <p className="text-[9px] font-medium text-slate-400 mt-3">Avisos operacionais para conferência do RH. A concessão de férias e decisões contratuais devem ser validadas pelo responsável e pela contabilidade.</p>
            </div>;
         })()}
      </div>

      {/* Composição da equipe + Ações rápidas */}
      {funcionarios.length > 0 && (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-4">
         <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_1.4fr] gap-3">
            {/* Donut de composição */}
            {(() => {
               const todos = funcionarios;
               const total = todos.length || 1;
               const inativos = todos.filter(f => ehInativo(f)).length;
               const ativos = todos.filter(f => !ehInativo(f));
               const extras = ativos.filter(f => f.tipo_contrato === "Freelancer").length;
               const exp = ativos.filter(f => f.tipo_contrato !== "Freelancer" && String(f.status_contrato || "").toLowerCase().includes("experi")).length;
               const fixos = ativos.length - extras - exp;
               const segs = [
                  { rot: "Fixos ativos", n: fixos, cor: "#059669" },
                  { rot: "Em experiência", n: exp, cor: "#6ee7b7" },
                  { rot: "Extras", n: extras, cor: "#94a3b8" },
                  { rot: "Inativos", n: inativos, cor: "#cbd5e1" },
               ].filter(s => s.n > 0);
               let acc = 0;
               const stops = segs.map(s => { const ini = (acc / total) * 360; acc += s.n; const fim = (acc / total) * 360; return `${s.cor} ${ini}deg ${fim}deg`; }).join(", ");
               return (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
                     <div className="relative w-24 h-24 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops || "#e2e8f0 0deg 360deg"})` }}>
                        <div className="absolute inset-[14px] rounded-full bg-white flex flex-col items-center justify-center">
                           <span className="text-xl font-black text-slate-800 leading-none">{todos.length}</span>
                           <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Total</span>
                        </div>
                     </div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Composição da equipe</p>
                        <div className="space-y-1">
                           {segs.map(s => (
                              <div key={s.rot} className="flex items-center gap-2 text-xs">
                                 <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.cor }} />
                                 <span className="font-bold text-slate-600 flex-1 truncate">{s.rot}</span>
                                 <span className="font-black text-slate-800">{s.n}</span>
                                 <span className="text-slate-400 font-bold w-10 text-right">{Math.round((s.n / total) * 100)}%</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               );
            })()}

            {/* Ações rápidas */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
               <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Ações rápidas</p>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                     { icon: Printer, rot: "Recibo de extra", on: () => { setAbaAtiva("Freelancer"); abrirModalFicha(null); } },
                     { icon: ClipboardList, rot: "Fechar folha", on: () => router.push('/dashboard/rh/fechamento') },
                     { icon: Clock, rot: "Faltas e atrasos", on: () => imprimirFaltasAtrasos() },
                     { icon: CalendarDays, rot: "Feriados", on: () => abrirModalFeriados() },
                     { icon: Users, rot: "Organograma", on: () => router.push('/dashboard/rh/organograma') },
                     { icon: Award, rot: "Cargos", on: () => setAbaAtiva("Cargos & Carreiras") },
                     { icon: LogOut, rot: "Ex-funcionários", on: () => setAbaAtiva("Ex-funcionários") },
                  ].map(a => (
                     <button key={a.rot} onClick={a.on} className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 py-3 px-1 text-center transition-all">
                        <a.icon size={18} className="text-emerald-600" />
                        <span className="text-[10px] font-black text-slate-600 leading-tight">{a.rot}</span>
                     </button>
                  ))}
               </div>
            </div>
         </div>
      </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

         <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
            {[["Fixo", "Equipe Fixa"], ["Cargos & Carreiras", "Cargos & Carreiras"], ["Ex-funcionários", "Ex-funcionários"]].map(([id, rot]) => (
               <button key={id} onClick={() => setAbaAtiva(id)}
                  className={`px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shrink-0 ${abaAtiva === id ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                  {rot}
               </button>
            ))}
         </div>

         {abaAtiva === "Cargos & Carreiras" ? (
            <PlanoCargos
               cargos={cargos}
               funcionarios={funcionarios}
               unidadeAtiva={unidadeAtiva}
               unidadeInfo={unidadeInfo}
               onRecarregar={() => carregar(true)}
            />
         ) : abaAtiva === "Banco de Talentos" ? (
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
                        const cls = (c) => `text-[11px] font-bold px-2.5 py-1 rounded-md border inline-flex items-center gap-1 ${c}`;
                        const hoje = new Date();
                        const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
                        const diaSemana = hoje.getDay(); // 0 = domingo
                        const entradaEsperada = horarioDoDia(f, diaSemana).entrada;
                        if (!pt) {
                           const ehFeriado = (feriadosMesAtual || []).some(fe => String(fe.data).slice(0, 10) === hojeStr);
                           if (ehFeriado) return <span className={cls("text-violet-700 bg-violet-100 border-violet-200")}>Feriado</span>;
                           const folgaEsporadica = (folgasUnidade || []).some(fl => fl.colaborador_id === f.id && String(fl.data_folga).slice(0, 10) === hojeStr);
                           const folgaFixa = f.dias_trabalho ? !f.dias_trabalho.split(',').includes(String(diaSemana)) : false;
                           if (folgaEsporadica || folgaFixa) return <span className={cls("text-sky-700 bg-sky-100 border-sky-200")}>{diaSemana === 0 ? "Folga (domingo)" : "Folga hoje"}</span>;
                           if (entradaEsperada) {
                              const minAgora = hoje.getHours() * 60 + hoje.getMinutes();
                              if (minAgora > strToMin(entradaEsperada)) return <span className={cls("text-rose-700 bg-rose-100 border-rose-200")}>Atrasado (era p/ {entradaEsperada})</span>;
                           }
                           return <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">{situacaoDoPonto(null).texto}</span>;
                        }
                        // A frase base vem do módulo de status, para o RH falar
                        // igual em toda tela. O que a tela acrescenta são os
                        // avisos que só ela calcula: atraso na entrada e
                        // intervalo estourado — informação que o dono cobra.
                        const situacao = situacaoDoPonto(pt);
                        if (pt.status_jornada === 1) {
                           let atrasado = false;
                           if (entradaEsperada) { const mPt = dateToMin(pt.hora_entrada), mAg = strToMin(entradaEsperada); atrasado = mPt > mAg + 5; }
                           return <span className={cls(atrasado ? "text-rose-700 bg-rose-100 border-rose-200" : "text-emerald-700 bg-emerald-100 border-emerald-200")}>{situacao.texto}{atrasado ? ` (era p/ ${entradaEsperada})` : ""}</span>;
                        }
                        if (pt.status_jornada === 2) return <span className={cls("text-amber-700 bg-amber-100 border-amber-200")}>{situacao.texto}</span>;
                        if (pt.status_jornada === 3) {
                           const minSaida = dateToMin(pt.hora_saida_intervalo); let minVolta = dateToMin(pt.hora_retorno_intervalo); if (minVolta < minSaida) minVolta += 1440;
                           const duracao = minVolta - minSaida, limite = f.tempo_intervalo || 60;
                           if (duracao > limite) return <span className={cls("text-rose-700 bg-rose-100 border-rose-200")}>{situacao.texto} · passou do intervalo ({minToStr(duracao)}/{minToStr(limite)})</span>;
                           return <span className={cls("text-emerald-700 bg-emerald-100 border-emerald-200")}>{situacao.texto}</span>;
                        }
                        if (pt.status_jornada === 4) return <span className={cls(situacao.semIntervalo ? "text-rose-700 bg-rose-100 border-rose-200" : "text-blue-700 bg-blue-100 border-blue-200")}>{situacao.texto}</span>;
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
                                 {f.telefone && <a href={`https://wa.me/55${String(f.telefone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-emerald-700 hover:underline"><Phone size={10} /> {f.telefone}</a>}
                                 {f.chave_pix && <span className="flex items-center gap-1"><CreditCard size={10} /> {f.chave_pix}</span>}
                              </div>
                           )}
                           {/* Vida do contrato: quando entrou, que vínculo tem, há quanto tempo está aqui e quando faz aniversário */}
                           {(() => {
                              const casa = tempoDeCasa(f);
                              const aniv = aniversario(f);
                              const adm = f.data_admissao ? new Date(`${String(f.data_admissao).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : null;
                              if (!adm && !casa && !aniv && !f.tipo_contrato) return null;
                              return (
                                 <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500">
                                    {f.tipo_contrato && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">{f.tipo_contrato}</span>}
                                    {adm && <span>Admissão {adm}</span>}
                                    {casa && <span className="text-emerald-700">{casa.textoDias} de {nomeDaCasa}</span>}
                                    {aniv && <span className={aniv.ehHoje ? "text-amber-600" : ""}>Aniversário {aniv.diaMes}{aniv.ehHoje ? " · é hoje" : ""}</span>}
                                 </div>
                              );
                           })()}
                           <div>{pontoBadge}</div>
                           <div>
                              {ehFreela ? (
                                 <div className="font-black text-emerald-700">{fmtBRL(f.salario)} <span className="text-[10px] font-bold text-slate-400">/ diária</span></div>
                              ) : (
                                 (() => {
                                 // Dia a dia do mês: alimenta os cliques (extra/noturno/feriado) e os contadores
                                 const meusPontos = pontosMesUnidade.filter(x => x.colaborador_id === f.id);
                                 const porDia = calcularAdicionaisPorDia(meusPontos, feriadosMesAtual, { contratadaDoDia: (d) => jornadaContratadaMin(f, d) });
                                 const fSet = new Set((feriadosMesAtual || []).map(x => x.data || x));
                                 const diasTrab = [...new Set(meusPontos.filter(x => x.hora_entrada).map(x => x.data_referencia))];
                                 const escala = new Set(String(f.dias_trabalho || "").split(",").filter(Boolean));
                                 const feriadosTrab = diasTrab.filter(d => fSet.has(d));
                                 const folgasVendidas = diasTrab.filter(d => escala.size && !escala.has(String(new Date(d + "T12:00:00").getDay())));
                                 const agoraD = new Date();
                                 const totalDiasMes = new Date(agoraD.getFullYear(), agoraD.getMonth() + 1, 0).getDate();
                                 let diasPrevistos = 0;
                                 for (let d = 1; d <= totalDiasMes; d++) if (escala.has(String(new Date(agoraD.getFullYear(), agoraD.getMonth(), d).getDay()))) diasPrevistos++;
                                 const fmtDia = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
                                 const alertaDias = (titulo, campo, regra) => {
                                    const ls = porDia.filter(x => x[campo] > 0).map(x => `• ${fmtDia(x.data)} — ${x[campo]} min`);
                                    const tot = porDia.reduce((s, x) => s + x[campo], 0);
                                    alert(`${titulo}\n\n${ls.join("\n") || "Nenhum dia registrado."}\n\nTotal: ${tot} min\n${regra}`);
                                 };
                                 return (
                                 <div className="rounded-xl bg-slate-50 border border-slate-100 p-2.5 text-[12px]" onClick={(e) => e.stopPropagation()}>
                                    {detAberto[f.id] && (<><div className="flex justify-between"><span className="text-slate-500 font-semibold">Salário base</span><span className="font-bold text-slate-700">{fmtBRL(p.fixo)}</span></div>
                                    {p.va > 0 && <div className="flex justify-between cursor-pointer" title="Clique para entender" onClick={() => alert(`VA — Vale-alimentação: ${fmtBRL(p.va)}\n\nValor fixo definido no cadastro do funcionário. Somado ao pagamento do mês.`)}><span className="text-teal-600 font-semibold">+ Vale-alimentação</span><span className="font-bold text-teal-700">{fmtBRL(p.va)}</span></div>}
                                    {p.taxa > 0 && <div className="flex justify-between cursor-pointer" title="Clique para entender" onClick={() => alert(`TAXA de serviço (gorjeta): ${fmtBRL(p.taxa)}\n\nValor mensal definido no cadastro (rateio da taxa de 10%). Entra no total e no holerite no fim do mês.\n\nTrabalhou até agora: ${diasTrab.length} dia(s) — por dia dá ${fmtBRL(p.taxa / Math.max(1, diasTrab.length))}.`)}><span className="text-indigo-600 font-semibold">+ Taxa de serviço</span><span className="font-bold text-indigo-700">{fmtBRL(p.taxa)}</span></div>}
                                    {p.ad.valorExtra > 0 && <div className="flex justify-between cursor-pointer" title="Clique para ver os dias" onClick={() => alertaDias(`HORA EXTRA (+50%): ${fmtBRL(p.ad.valorExtra)}`, "minExtra", "Regra: após 00:00, hora + 50% (base = salário ÷ 220).")}><span className="text-emerald-600 font-semibold">+ Hora extra (+50%)</span><span className="font-bold text-emerald-700">{fmtBRL(p.ad.valorExtra)}</span></div>}
                                    {p.ad.valorNoturno > 0 && <div className="flex justify-between cursor-pointer" title="Clique para ver os dias" onClick={() => alertaDias(`ADICIONAL NOTURNO (+20%): ${fmtBRL(p.ad.valorNoturno)}`, "minNoturno", "Regra: minutos entre 23:30 e 00:00 pagam +20%.")}><span className="text-sky-600 font-semibold">+ Ad. noturno (+20%)</span><span className="font-bold text-sky-700">{fmtBRL(p.ad.valorNoturno)}</span></div>}
                                    {p.ad.valorFeriado > 0 && <div className="flex justify-between cursor-pointer" title="Clique para ver os dias" onClick={() => alertaDias(`FERIADO TRABALHADO (+100% — pago em dobro): ${fmtBRL(p.ad.valorFeriado)}`, "minFeriado", "Regra: todas as horas do feriado pagam em dobro (Lei 605/49).")}><span className="text-amber-600 font-semibold">+ Feriado (+100%)</span><span className="font-bold text-amber-700">{fmtBRL(p.ad.valorFeriado)}</span></div>}
                                    {p.descontos > 0 && <div className="flex justify-between cursor-pointer" title="Clique para entender" onClick={() => alert(`VALES / DESCONTOS: ${fmtBRL(p.descontos)}\n\nSoma dos vales e consumos pendentes (adiantamentos e consumo no cardápio da equipe). Desconto na folha. Detalhe em Ações → Consumo / Vales.`)}><span className="text-rose-600 font-semibold">− Vales / descontos</span><span className="font-bold text-rose-700">{fmtBRL(p.descontos)}</span></div>}
                                    </>)}
                                    <div className="flex justify-between pt-1.5 mt-1.5 border-t border-slate-200"><span className="font-black text-slate-700">Total previsto</span><span className="font-black text-emerald-700">{fmtBRL(p.previsto)}</span></div>
                                    {(() => {
                                       const nDias = (f.dias_trabalho || "").split(",").filter(Boolean).length;
                                       if (!nDias || !p.fixo) return null;
                                       return <div className="flex justify-between mt-0.5"><span className="text-[10px] font-bold text-slate-400">Valor por dia trabalhado</span><span className="text-[10px] font-black text-slate-500">{fmtBRL(p.fixo / (nDias * 4.345))}/dia</span></div>;
                                    })()}
                                    {detAberto[f.id] && (<>{/* Dias do mês: previstos, trabalhados até agora, feriados (dobro) e folgas vendidas */}
                                    <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t border-slate-200 text-[10px] font-bold">
                                       <span className="text-slate-500">Dias no mês (escala)</span><span className="text-right text-slate-700 font-black">{diasPrevistos}</span>
                                       <span className="text-slate-500">Trabalhou até agora</span><span className="text-right text-emerald-700 font-black">{diasTrab.length}</span>
                                       <span className={feriadosTrab.length ? "text-amber-700 cursor-pointer" : "text-slate-500"} onClick={() => feriadosTrab.length && alert(`FERIADOS TRABALHADOS (pagos em dobro):\n\n${feriadosTrab.map(fmtDia).map(d => `• ${d}`).join("\n")}`)}>Feriados (em dobro)</span><span className="text-right text-amber-700 font-black">{feriadosTrab.length}</span>
                                       <span className={folgasVendidas.length ? "text-purple-700 cursor-pointer" : "text-slate-500"} onClick={() => folgasVendidas.length && alert(`FOLGAS VENDIDAS (trabalhou no dia de folga):\n\n${folgasVendidas.map(fmtDia).map(d => `• ${d}`).join("\n")}`)}>Folgas vendidas</span><span className="text-right text-purple-700 font-black">{folgasVendidas.length}</span>
                                    </div>
                                    </>)}
                                    <button onClick={(e) => { e.stopPropagation(); setDetAberto(prev => ({ ...prev, [f.id]: !prev[f.id] })); }} className="w-full text-[10px] font-black text-slate-400 hover:text-slate-600 mt-1.5 uppercase tracking-widest">{detAberto[f.id] ? "ocultar detalhes" : "ver detalhes"}</button>
                                    <button onClick={() => gerarHolerite(f, p)} className="w-full mt-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-black text-[11px] flex items-center justify-center gap-1.5">
                                       <Printer size={12} /> Holerite
                                    </button>
                                 </div>
                                 );
                                 })()
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
            <div className="bg-white rounded-[28px] w-full max-w-md md:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="flex items-center justify-between mb-4">
                  <div className="min-w-0">
                     <h2 className="font-black text-xl text-slate-800 truncate">{f.nome}</h2>
                     <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{f.cargo || "—"}</p>
                  </div>
                  <button onClick={fechar} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 shrink-0"><X size={17}/></button>
               </div>

               <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                  <Grupo titulo="Ponto e Jornada">
                     <Acao icon={Clock} onClick={() => ir(() => router.push(`/dashboard/rh/espelho/${f.id}?mes=${new Date().toISOString().slice(0,7)}`))}>Espelho de Ponto</Acao>
                     <Acao icon={Clock} cor={critico ? "text-red-700" : alerta ? "text-amber-700" : "text-sky-700"} bg={critico ? "bg-red-50 hover:bg-red-100" : alerta ? "bg-amber-50 hover:bg-amber-100" : "bg-sky-50 hover:bg-sky-100"}
                        onClick={() => ir(() => abrirModalBanco(f))}
                        extra={tb > 0 && <span className="text-xs font-black">{fmtMin(tb)}{critico ? " LIMITE!" : ""}</span>}>
                        Banco de Horas
                     </Acao>
                     <Acao icon={CalendarHeart} cor="text-rose-600" bg="bg-rose-50 hover:bg-rose-100" onClick={() => ir(() => abrirModalFolgas(f))}>Folgas</Acao>
                     <Acao icon={Award} cor="text-purple-600" bg="bg-purple-50 hover:bg-purple-100" onClick={() => ir(() => abrirHistoricoCarreira(f))}>Linha do Tempo de Carreira</Acao>
                  </Grupo>

                  <Grupo titulo="Financeiro">
                     <Acao icon={ShoppingBag} cor="text-teal-700" bg="bg-teal-50 hover:bg-teal-100" onClick={() => ir(() => abrirModalConsumo(f))} extra={(() => { const t = valesPendentes.filter(v => v.funcionario_id === f.id).reduce((sm, v) => sm + (Number(v.valor_final ?? v.valor_desconto ?? v.valor_original) || 0), 0); return t > 0 ? <span className="text-xs font-black">{fmtBRL(t)} pend.</span> : null; })()}>Consumo / Vales</Acao>
                     <Acao icon={CreditCard} cor="text-emerald-700" bg="bg-emerald-50 hover:bg-emerald-100" onClick={() => ir(() => handleLancarFinanceiro(f))}>Lançar {f.tipo_contrato === "Freelancer" ? "Diária" : "Salário"}</Acao>
                     {f.tipo_contrato === "Freelancer" && (
                        <>
                          <Acao icon={CheckCircle} cor="text-violet-700" bg="bg-violet-50 hover:bg-violet-100" onClick={() => ir(() => liberarPontoHoje(f))}>Liberar ponto de hoje</Acao>
                          <Acao icon={Clock} cor="text-slate-700" onClick={() => ir(() => abrirHistoricoDiarias(f))}>Histórico completo do extra</Acao>
                        </>
                     )}
                  </Grupo>

                  <Grupo titulo="Documentos">
                     <Acao icon={FileText} cor="text-emerald-700" bg="bg-emerald-50 hover:bg-emerald-100" onClick={() => ir(() => gerarContrato(f))}>Contrato de Trabalho</Acao>
                     <Acao icon={FileText} onClick={() => ir(() => router.push(`/dashboard/rh/contrato/${f.id}`))}>Regulamento</Acao>
                     {f.tipo_contrato === "Freelancer" && (
                        <Acao icon={Printer} cor="text-emerald-700" bg="bg-emerald-50 hover:bg-emerald-100" onClick={() => ir(() => abrirModalFicha(f))}>Recibo de Trabalho Extra</Acao>
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
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
            <div className="erp-editor-funcionario bg-white sm:rounded-[32px] w-full max-w-5xl shadow-2xl animate-in zoom-in-95 flex flex-col h-[100dvh] sm:h-auto sm:max-h-[calc(100dvh-2rem)] overflow-hidden">
               <style>{`
                 .erp-editor-funcionario label { font-size: 12px !important; line-height: 1.35; }
                 .erp-editor-funcionario input:not([type="checkbox"]):not([type="file"]), .erp-editor-funcionario select { min-height: 48px; font-size: 15px; }
                 .erp-editor-funcionario textarea { font-size: 15px; line-height: 1.6; }
                 .erp-editor-funcionario section[id], .erp-editor-funcionario div[id^="func-"] { scroll-margin-top: 88px; }
               `}</style>
               <div className="flex justify-between items-center gap-4 shrink-0 border-b border-slate-100 p-4 sm:px-6 sm:py-5">
                  <div className="min-w-0">
                     <p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700">Equipe fixa · cadastro completo</p>
                     <h2 className="truncate font-black text-2xl text-slate-800">{editandoId ? "Editar funcionário" : "Novo funcionário fixo"}</h2>
                     <p className="mt-1 text-xs font-bold text-slate-500">{percentualCadastroFuncionario(novoFunc)}% preenchido · dados usados no ponto, folha, organograma e portal</p>
                  </div>
                  <button onClick={() => setModalNovo(false)} className="w-12 h-12 shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={21}/></button>
               </div>

               <nav className="flex shrink-0 gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
                  {[
                    ["func-identificacao", "1. Identificação"], ["func-pessoais", "2. Dados pessoais"],
                    ["func-contrato", "3. Contrato e valores"], ["func-jornada", "4. Jornada"], ["func-observacoes", "5. Observações"],
                  ].map(([id, label]) => <button key={id} type="button" onClick={() => irSecaoCadastro(id)} className="min-h-10 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:border-emerald-300 hover:text-emerald-700">{label}</button>)}
               </nav>

               <div className="space-y-5 flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50/60">
                  <section id="func-identificacao" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Identificação profissional</p><p className="mt-1 text-xs font-semibold text-slate-500">Foto, nome, função, contato e posição no organograma.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase text-emerald-700">Funcionário fixo</span></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">Tipo de Contrato</label>
                        <div className="flex min-h-12 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 font-black text-emerald-800">Equipe fixa (CLT / mensalista)</div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Telefone / WhatsApp</label>
                        <input type="text" inputMode="numeric" value={novoFunc.telefone} onChange={e=>setNovoFunc({...novoFunc, telefone: mascaraTelefone(e.target.value)})} placeholder="(00) 00000-0000" className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">E-mail</label>
                        <input type="email" value={novoFunc.email || ""} onChange={e=>setNovoFunc({...novoFunc, email: e.target.value})} placeholder="nome@email.com" className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">CPF</label>
                        <input type="text" inputMode="numeric" value={novoFunc.cpf} onChange={e=>setNovoFunc({...novoFunc, cpf: mascaraCPF(e.target.value)})} placeholder="000.000.000-00" className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">RG</label>
                        <input type="text" inputMode="numeric" value={novoFunc.rg || ""} onChange={e=>setNovoFunc({...novoFunc, rg: mascaraRG(e.target.value)})} placeholder="000.000-0" className="w-full p-3.5 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                  </div>
                  </section>

                  {/* ── DADOS PESSOAIS ─────────────────────────────────────── */}
                  <div id="func-pessoais" className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                     <div><p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Endereço e dados pessoais</p><p className="mt-1 text-xs font-semibold text-slate-500">Informações completas para documentos e gestão do RH.</p></div>
                     
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="col-span-2">
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rua / Avenida</label>
                           <input type="text" value={novoFunc.rua_av || ""} onChange={e=>setNovoFunc({...novoFunc, rua_av: e.target.value, endereco: `${e.target.value}${novoFunc.numero_casa ? `, ${novoFunc.numero_casa}` : ""}${novoFunc.bairro ? `, ${novoFunc.bairro}` : ""}`})} placeholder="Ex.: Av. Paulista" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Número</label>
                           <input type="text" value={novoFunc.numero_casa || ""} onChange={e=>setNovoFunc({...novoFunc, numero_casa: e.target.value})} placeholder="Ex.: 1500 ou S/N" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bairro</label>
                           <input type="text" value={novoFunc.bairro || ""} onChange={e=>setNovoFunc({...novoFunc, bairro: e.target.value})} placeholder="Ex.: Bela Vista" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cidade / UF</label>
                           <input type="text" value={novoFunc.cidade_uf || ""} onChange={e=>setNovoFunc({...novoFunc, cidade_uf: e.target.value})} placeholder="Ex.: São Paulo / SP" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CEP</label>
                           <input type="text" value={novoFunc.cep || ""} onChange={e=>setNovoFunc({...novoFunc, cep: e.target.value})} placeholder="00000-000" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
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
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do pai</label>
                           <input type="text" value={novoFunc.nome_pai || ""} onChange={e=>setNovoFunc({...novoFunc, nome_pai: e.target.value})} placeholder="Como consta no documento" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome da mãe</label>
                           <input type="text" value={novoFunc.nome_mae || ""} onChange={e=>setNovoFunc({...novoFunc, nome_mae: e.target.value})} placeholder="Como consta no documento" className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                        </div>
                        {/* Filhos com nome e CPF: entram no contrato */}
                        <div className="sm:col-span-2">
                           <div className="flex items-center justify-between gap-2">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Filhos</label>
                              <button type="button" onClick={() => setNovoFunc({ ...novoFunc, filhos: [...(novoFunc.filhos || []), { nome: "", cpf: "" }] })} className="text-xs font-black text-emerald-700 hover:underline">+ Adicionar filho</button>
                           </div>
                           <div className="mt-2 space-y-2">
                              {(novoFunc.filhos || []).length === 0 && <p className="text-xs font-semibold text-slate-400">Nenhum filho cadastrado.</p>}
                              {(novoFunc.filhos || []).map((filho, idx) => (
                                 <div key={idx} className="flex flex-wrap items-center gap-2">
                                    <input type="text" value={filho.nome || ""} placeholder="Nome do filho"
                                       onChange={e => setNovoFunc({ ...novoFunc, filhos: novoFunc.filhos.map((x, k) => k === idx ? { ...x, nome: e.target.value } : x) })}
                                       className="min-w-[150px] flex-1 p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                                    <input type="text" inputMode="numeric" value={filho.cpf || ""} placeholder="000.000.000-00"
                                       onChange={e => setNovoFunc({ ...novoFunc, filhos: novoFunc.filhos.map((x, k) => k === idx ? { ...x, cpf: mascaraCPF(e.target.value) } : x) })}
                                       className="w-40 p-3 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500"/>
                                    <button type="button" onClick={() => setNovoFunc({ ...novoFunc, filhos: novoFunc.filhos.filter((_, k) => k !== idx) })}
                                       className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50">×</button>
                                 </div>
                              ))}
                           </div>
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
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado civil</label>
                           <select value={novoFunc.estado_civil || ""} onChange={e=>setNovoFunc({...novoFunc, estado_civil: e.target.value})} className="w-full p-3 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500">
                              <option value="">Selecione...</option>
                              {ESTADOS_CIVIS.map(v => <option key={v} value={v}>{v}</option>)}
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
                     </div>
                     <div className="flex flex-wrap items-center gap-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={novoFunc.tem_transporte}
                              onChange={e=>setNovoFunc({...novoFunc, tem_transporte: e.target.checked, tipo_transporte: e.target.checked ? novoFunc.tipo_transporte : ""})}
                              className="w-4 h-4 accent-emerald-600"/>
                           <span className="text-xs font-bold text-slate-600">Possui transporte próprio</span>
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
                                    <span className="text-xs font-bold text-slate-600">{v}</span>
                                 </label>
                              ))}
                           </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer">
                           <input type="checkbox" checked={novoFunc.usa_vale_transporte} onChange={e=>setNovoFunc({...novoFunc, usa_vale_transporte: e.target.checked})} className="w-4 h-4 accent-emerald-600"/>
                           <span className="text-xs font-bold text-slate-600">Usa vale transporte</span>
                        </label>
                     </div>
                  </div>

                  <div id="func-contrato" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                  <div><p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Contrato, pagamento e benefícios</p><p className="mb-4 mt-1 text-xs font-semibold text-slate-500">Salário, PIX, admissão, fase do contrato e composição mensal.</p></div>
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

                  {/* EXTRA: o que o recibo precisa fica aqui no cadastro e migra sozinho */}
                  {novoFunc.tipo_contrato === "Freelancer" && (
                     <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Dados do Recibo de Trabalho Extra</p>
                        <p className="mt-1 mb-4 text-[12px] font-medium text-slate-500">Preenchido uma vez aqui, o recibo já sai pronto toda vez que esta pessoa trabalhar.</p>

                        <label className="block">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">O que a função faz (sai impresso no recibo)</span>
                           <textarea rows={3} value={novoFunc.topicos_funcao} onChange={e=>setNovoFunc({...novoFunc, topicos_funcao: e.target.value})}
                              placeholder="Ex.: Atender mesas, levar pedidos, repor bebidas, apoiar a limpeza do salão."
                              className="w-full p-3.5 mt-1 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:border-emerald-500" />
                        </label>

                        <label className="mt-4 block">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Itens emprestados (separe por vírgula)</span>
                           <input type="text" value={novoFunc.itens_emprestados} onChange={e=>setNovoFunc({...novoFunc, itens_emprestados: e.target.value})}
                              placeholder="Uniforme / Camisa, Avental, Cartão de Consumo"
                              className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" />
                        </label>

                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Forma de pagamento</label>
                              <select value={novoFunc.forma_pagamento} onChange={e=>setNovoFunc({...novoFunc, forma_pagamento: e.target.value})}
                                 className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500">
                                 {["Pix", "Dinheiro", "Transferência"].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vale transporte (R$)</label>
                              <input type="number" step="0.01" value={novoFunc.vale_transporte_val} onChange={e=>setNovoFunc({...novoFunc, vale_transporte_val: e.target.value})}
                                 placeholder="0,00" className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" />
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Setor</label>
                              <input type="text" value={novoFunc.setor_entrega} onChange={e=>setNovoFunc({...novoFunc, setor_entrega: e.target.value})}
                                 placeholder="Salão, Cozinha, Bar" className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500" />
                           </div>
                        </div>

                        <label className="mt-4 flex items-center gap-2.5">
                           <input type="checkbox" checked={novoFunc.janta_ofertada !== false} onChange={e=>setNovoFunc({...novoFunc, janta_ofertada: e.target.checked})} className="h-5 w-5 accent-emerald-600" />
                           <span className="text-sm font-bold text-slate-700">A casa oferece a janta</span>
                        </label>
                     </div>
                  )}

                  {novoFunc.tipo_contrato !== "Freelancer" && (
                     <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-3">Composição da remuneração (além do fixo)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vale Alimentação (R$/mês)</label>
                              <input type="number" min="0" step="0.01" placeholder="0,00" value={novoFunc.vale_alimentacao} onChange={e=>setNovoFunc({...novoFunc, vale_alimentacao: e.target.value})} className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500"/>
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Pontos na taxa de serviço</label>
                              {/* A taxa é rateada por pontos, não digitada em
                                  reais pessoa por pessoa: o valor do ponto só
                                  se sabe no fim do mês, quando se divide o que
                                  foi arrecadado pela soma dos pontos. */}
                              <select value={novoFunc.pontos_taxa ?? ""} onChange={e=>setNovoFunc({...novoFunc, pontos_taxa: e.target.value})}
                                 className="w-full p-4 mt-1 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-emerald-500">
                                 <option value="">Não participa</option>
                                 {["0.5","1","1.5","2"].map(v => (
                                    <option key={v} value={v}>{v.replace(".", ",")} {v === "1" ? "ponto" : "pontos"}</option>
                                 ))}
                              </select>
                              <p className="text-[10px] text-slate-400 font-medium mt-1">De 0,5 a 2 pontos. O valor em reais sai do rateio no fechamento do mês.</p>
                           </div>
                        </div>
                        <p className="text-[10px] font-medium text-emerald-700/70 mt-3">Adicional noturno (20% das 22h às 5h, com hora noturna reduzida de 52min30s) e hora extra (+50% além da jornada contratada) são calculados automaticamente pelo ponto. Hora normal = salário ÷ 220.</p>
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
                  </div>

                  <div id="func-jornada" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
                     <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Jornada de trabalho</p>
                        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                           <input type="checkbox" checked={novoFunc.horario_por_dia} onChange={e=>setNovoFunc({...novoFunc, horario_por_dia: e.target.checked})} style={{accentColor:"#059669"}} />
                           Horário diferente por dia da semana
                        </label>
                     </div>

                     {!novoFunc.horario_por_dia ? (
                     <>
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
                     </>
                     ) : (
                     <div className="space-y-1.5">
                        <p className="text-[10px] font-medium text-slate-400 mb-2">Preencha entrada e saída de cada dia. Dia em branco = folga. O intervalo (abaixo) é descontado de cada dia.</p>
                        {[['0','Domingo'],['1','Segunda'],['2','Terça'],['3','Quarta'],['4','Quinta'],['5','Sexta'],['6','Sábado']].map(([d,lbl]) => {
                           const hd = (novoFunc.horarios_dia && novoFunc.horarios_dia[d]) || {};
                           const setDia = (campo,val) => setNovoFunc(nf => ({...nf, horarios_dia: {...(nf.horarios_dia||{}), [d]: {...((nf.horarios_dia||{})[d]||{}), [campo]: val}}}));
                           const limpar = () => setNovoFunc(nf => { const c={...(nf.horarios_dia||{})}; delete c[d]; return {...nf, horarios_dia:c}; });
                           const trabalha = !!(hd.e || hd.s);
                           return (
                              <div key={d} className="flex items-center gap-2">
                                 <span className="w-16 text-[10px] font-black uppercase text-slate-500 shrink-0">{lbl}</span>
                                 <input type="time" value={hd.e||""} onChange={e=>setDia('e',e.target.value)} className="flex-1 min-w-0 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-emerald-500"/>
                                 <span className="text-slate-300 shrink-0">→</span>
                                 <input type="time" value={hd.s||""} onChange={e=>setDia('s',e.target.value)} className="flex-1 min-w-0 p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-sm outline-none focus:border-emerald-500"/>
                                 <button type="button" onClick={limpar} title="Marcar folga neste dia" className="text-[10px] font-bold shrink-0 w-12 text-center rounded-md py-1 border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200">{trabalha ? "folga" : "—"}</button>
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
                              <div className={`mt-2 rounded-lg px-3 py-2 text-[12px] font-bold ${acima ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-emerald-50 border border-emerald-100 text-emerald-700"}`}>
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

                  {/* Janela do intervalo. Os minutos acima servem ao banco de
                      horas; estas duas horas são o que sai impresso na folha de
                      jornada, no formato "int: 17:00 as 18:00". */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intervalo começa</label>
                        <input type="time" value={novoFunc.intervalo_inicio || ""} onChange={e=>setNovoFunc({...novoFunc, intervalo_inicio: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intervalo termina</label>
                        <input type="time" value={novoFunc.intervalo_fim || ""} onChange={e=>setNovoFunc({...novoFunc, intervalo_fim: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                     </div>
                     {/* Só aparece para quem trabalha domingo com jornada
                         diferente — caso da chefia de cozinha. */}
                     {(novoFunc.horario_dom_entrada || novoFunc.horario_dom_saida) && <>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intervalo domingo · início</label>
                           <input type="time" value={novoFunc.intervalo_dom_inicio || ""} onChange={e=>setNovoFunc({...novoFunc, intervalo_dom_inicio: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                        <div>
                           <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intervalo domingo · fim</label>
                           <input type="time" value={novoFunc.intervalo_dom_fim || ""} onChange={e=>setNovoFunc({...novoFunc, intervalo_dom_fim: e.target.value})} className="w-full p-3 mt-1 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-emerald-500"/>
                        </div>
                     </>}
                  </div>

                  <div id="func-observacoes" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
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
                  </div>
               </div>

               <div className="border-t border-slate-200 bg-white p-3 sm:p-4 shrink-0">
                  <button onClick={handleSalvar} disabled={!novoFunc.nome || !novoFunc.cargo} className="w-full min-h-14 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-lg rounded-2xl transition-all shadow-xl shadow-emerald-600/20 active:scale-95">
                     {editandoId ? "Salvar Alterações" : "Salvar Colaborador"}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Modal Gerenciar Folgas */}
      {/* O recibo só pode ser gerado para um extra já cadastrado */}
      {modalEscolherExtra && (() => {
         const extrasCadastrados = funcionarios
           .filter(f => f.tipo_contrato === "Freelancer" && !ehInativo(f))
           .filter(f => String(f.nome || "").toLocaleLowerCase("pt-BR").includes(buscaRecibo.toLocaleLowerCase("pt-BR")));
         return (
           <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm" onClick={() => setModalEscolherExtra(false)}>
             <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Recibo de Trabalho Extra</p>
                   <h2 className="mt-1 text-xl font-black text-slate-900">Escolha um extra cadastrado</h2>
                   <p className="mt-1 text-xs font-bold text-slate-500">Por segurança, não é possível gerar recibo para uma pessoa sem cadastro.</p>
                 </div>
                 <button onClick={() => setModalEscolherExtra(false)} className="rounded-full bg-slate-100 p-2.5 text-slate-500"><X size={18}/></button>
               </div>
               <div className="p-5">
                 <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3">
                   <Search size={17} className="text-slate-400"/>
                   <input autoFocus value={buscaRecibo} onChange={e => setBuscaRecibo(e.target.value)} placeholder="Buscar extra por nome..." className="w-full bg-transparent py-3 text-sm font-bold text-slate-700 outline-none"/>
                 </div>
                 <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
                   {extrasCadastrados.length ? extrasCadastrados.map(extra => (
                     <button key={extra.id} onClick={() => { setModalEscolherExtra(false); abrirModalFicha(extra); }} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50">
                       <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">{String(extra.nome || "E").charAt(0).toUpperCase()}</div>
                       <div className="min-w-0 flex-1">
                         <p className="truncate text-sm font-black text-slate-800">{extra.nome}</p>
                         <p className="truncate text-xs font-bold text-slate-400">{extra.cargo || "Extra"} · {extra.cpf || "CPF não informado"} · {fmtBRL(extra.salario || 0)}/diária</p>
                       </div>
                       <Printer size={17} className="text-emerald-700"/>
                     </button>
                   )) : (
                     <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                       <p className="text-sm font-black text-slate-700">Nenhum extra cadastrado encontrado</p>
                       <p className="mt-1 text-xs font-bold text-slate-400">Cadastre o profissional como “Freelancer / Extra” antes de gerar o recibo.</p>
                       <button onClick={() => { setModalEscolherExtra(false); abrirModalNovo(); }} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white">Cadastrar extra</button>
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
<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl sm:rounded-[32px] w-full max-w-3xl my-3 sm:my-8 p-4 sm:p-8 shadow-2xl animate-in zoom-in-95 max-h-[94vh] sm:max-h-[90vh] overflow-y-auto">
               <div className="flex flex-wrap justify-between items-center gap-2 mb-5">
                  <div>
                     <h2 className="font-black text-2xl text-slate-800">Preparar Recibo de Trabalho Extra</h2>
                     <p className="text-sm font-bold text-slate-500 mt-1">{fichaFunc ? `${fichaFunc.nome} · dados importados do cadastro` : "Preencha os dados pelo sistema; somente as assinaturas ficarão para a caneta."}</p>
                  </div>
                  <button onClick={() => setModalFicha(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={20}/></button>
               </div>

               <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-5">
                  <div className="mb-4 bg-white p-3 rounded-xl border border-emerald-200">
                     <label className="text-xs font-black text-emerald-800 block mb-1">Puxar dados do cadastro do colaborador:</label>
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
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dados que sairão no recibo</p>
                        <p className="text-xs font-bold text-slate-400">Quando o colaborador é selecionado, estes campos são puxados automaticamente do cadastro.</p>
                     </div>
                     {fichaFunc && <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">Importado do cadastro</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     <label className="text-xs font-bold text-slate-600">Nome completo
                        <input type="text" value={fichaDados.nome} onChange={e => setFichaDados(d => ({...d, nome: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="text-xs font-bold text-slate-600">CPF
                        <input type="text" value={fichaDados.cpf} onChange={e => setFichaDados(d => ({...d, cpf: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="text-xs font-bold text-slate-600">RG
                        <input type="text" value={fichaDados.rg} onChange={e => setFichaDados(d => ({...d, rg: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="text-xs font-bold text-slate-600">Telefone
                        <input type="text" value={fichaDados.telefone} onChange={e => setFichaDados(d => ({...d, telefone: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="sm:col-span-2 text-xs font-bold text-slate-600">Chave PIX
                        <input type="text" value={fichaDados.chave_pix} onChange={e => setFichaDados(d => ({...d, chave_pix: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                     </label>

                     {/* Endereço Estruturado */}
                     <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-200 pt-3 mt-1">
                       <label className="sm:col-span-2 text-xs font-bold text-slate-600">Rua ou Avenida
                         <input type="text" value={fichaDados.rua_av} onChange={e => setFichaDados(d => ({...d, rua_av: e.target.value}))} placeholder="Ex.: Av. Paulista" className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                       </label>
                       <label className="text-xs font-bold text-slate-600">Número da casa/apto
                         <input type="text" value={fichaDados.numero_casa} onChange={e => setFichaDados(d => ({...d, numero_casa: e.target.value}))} placeholder="Ex.: 1500 ou S/N" className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                       </label>
                       <label className="sm:col-span-2 text-xs font-bold text-slate-600">Bairro
                         <input type="text" value={fichaDados.bairro} onChange={e => setFichaDados(d => ({...d, bairro: e.target.value}))} placeholder="Ex.: Bela Vista" className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                       </label>
                       <label className="text-xs font-bold text-slate-600">Cidade / UF
                         <input type="text" value={fichaDados.cidade_uf} onChange={e => setFichaDados(d => ({...d, cidade_uf: e.target.value}))} placeholder="Ex.: São Paulo / SP" className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-800 outline-none focus:border-emerald-500"/>
                       </label>
                     </div>
                  </div>
               </div>

               <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Trabalho e controle do turno</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                     <label className="col-span-2 text-xs font-bold text-slate-600">Data do trabalho
                       <input type="date" value={fichaDados.data_trabalho} onChange={e => setFichaDados(d => ({...d, data_trabalho: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="col-span-2 text-xs font-bold text-slate-600">Evento / ocasião
                       <input type="text" value={fichaDados.evento} onChange={e => setFichaDados(d => ({...d, evento: e.target.value}))} placeholder="Ex.: casamento, festival, reforço de salão" className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="col-span-2 text-xs font-bold text-slate-600">Função no dia
                       <input type="text" value={fichaDados.funcao} onChange={e => setFichaDados(d => ({...d, funcao: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="col-span-2 sm:col-span-4 text-xs font-bold text-slate-600">Descreva por tópicos o que irá fazer no trabalho (atribuições)
                       <textarea
                         rows={3}
                         value={fichaDados.topicos_funcao}
                         onChange={e => setFichaDados(d => ({...d, topicos_funcao: e.target.value}))}
                         placeholder={"Digite em tópicos o que o profissional irá fazer, por exemplo:\n- Atendimento de mesas no salão\n- Montagem e organização da praça\n- Limpeza e fechamento"}
                         className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-medium text-slate-800 outline-none focus:border-emerald-500 text-xs"
                       />
                     </label>
                     {[
                       ["entrada", "Entrada"], ["saida_intervalo", "Saída intervalo"],
                       ["retorno_intervalo", "Retorno intervalo"], ["saida_final", "Saída final"],
                     ].map(([campo, label]) => (
                       <label key={campo} className="text-xs font-bold text-slate-600">{label}
                         <input type="time" value={fichaDados[campo]} onChange={e => setFichaDados(d => ({...d, [campo]: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"/>
                       </label>
                     ))}
                     <label className="col-span-2 text-xs font-bold text-slate-600">Intervalo acordado
                       <input type="text" value={fichaDados.intervalo} onChange={e => setFichaDados(d => ({...d, intervalo: e.target.value}))} placeholder="Ex.: 60 min" className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"/>
                     </label>
                     <label className="col-span-2 flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800">
                       <input type="checkbox" checked={!!fichaDados.janta_ofertada} onChange={e => setFichaDados(d => ({...d, janta_ofertada: e.target.checked}))} className="h-5 w-5 accent-emerald-700"/>
                       Janta ofertada pelo restaurante
                     </label>
                  </div>
               </div>

               {/* Valor pago -> desmembramento automático */}
               <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-emerald-700 block mb-1">Valor pago da diária (R$)</label>
                  <input type="number" min="0" step="0.01" value={fichaValor} onChange={e=>setFichaValor(e.target.value)} placeholder="Ex: 150,00"
                     className="w-full p-3.5 bg-white border-2 border-emerald-300 rounded-xl font-black text-2xl text-emerald-700 outline-none focus:border-emerald-500"/>

                  {/* Nº de dias combinados: soma o total (ex.: terça a domingo = 6 dias) */}
                  <div className="flex items-center gap-3 mt-3">
                     <label className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Dias combinados</label>
                     <div className="flex items-center gap-1">
                        <button type="button" onClick={()=>setFichaDias(String(Math.max(1, nDias-1)))} className="w-8 h-8 rounded-lg bg-white border border-emerald-300 font-black text-emerald-700">−</button>
                        <input type="number" min="1" step="1" value={fichaDias} onChange={e=>setFichaDias(e.target.value)} className="w-16 p-2 text-center bg-white border-2 border-emerald-300 rounded-lg font-black text-emerald-700 outline-none focus:border-emerald-500"/>
                        <button type="button" onClick={()=>setFichaDias(String(nDias+1))} className="w-8 h-8 rounded-lg bg-white border border-emerald-300 font-black text-emerald-700">+</button>
                     </div>
                     <div className="flex flex-wrap gap-1">
                        {[1,3,6,7].map(n => <button key={n} type="button" onClick={()=>setFichaDias(String(n))} className={`text-[10px] font-bold px-2 py-1 rounded-md ${nDias===n?"bg-emerald-600 text-white":"bg-white border border-emerald-200 text-emerald-700"}`}>{n}d</button>)}
                     </div>
                  </div>

                  {total > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs font-bold text-slate-600">
                        <span>Valor Fixo: <b className="text-slate-800">{fmt(fixo)}</b></span>
                        <span>INSS (5%): <b className="text-slate-800">{fmt(inss)}</b></span>
                        <span>FGTS (8%): <b className="text-slate-800">{fmt(fgts)}</b></span>
                        <span>Taxa de Serviço (10%): <b className="text-slate-800">{fmt(taxa)}</b></span>
                        <span className="col-span-2 pt-2 mt-1 border-t border-emerald-200 text-sm">
                           {nDias > 1
                              ? <>Total: <b className="text-emerald-700">{fmt(totalGeral)}</b> <span className="font-medium text-slate-500">({nDias} dias × {fmt(total)})</span></>
                              : <>Total do dia: <b className="text-emerald-700">{fmt(total)}</b></>}
                        </span>
                     </div>
                  ) : (
                     <p className="text-[10px] font-medium text-emerald-700/70 mt-2">Sem valor, o acerto sai em branco para preencher à mão.</p>
                  )}
               </div>

               <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Ajustes e pagamento</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {[
                      ["vale_transporte", "Vale-transporte"], ["adicional", "Adicional / bônus"], ["descontos", "Descontos"],
                    ].map(([campo, label]) => (
                      <label key={campo} className="text-xs font-bold text-slate-600">{label} (R$)
                        <input type="number" min="0" step="0.01" value={fichaDados[campo]} onChange={e => setFichaDados(d => ({...d, [campo]: e.target.value}))} placeholder="0,00" className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"/>
                      </label>
                    ))}
                    <label className="text-xs font-bold text-slate-600">Forma de pagamento
                      <select value={fichaDados.forma_pagamento} onChange={e => setFichaDados(d => ({...d, forma_pagamento: e.target.value}))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-emerald-500">
                        <option>Pix</option><option>Dinheiro</option><option>Transferência</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800">
                      <input type="checkbox" checked={!!fichaDados.pagamento_realizado} onChange={e => setFichaDados(d => ({ ...d, pagamento_realizado: e.target.checked }))} className="h-5 w-5 accent-emerald-700" />
                      Pagamento já realizado
                    </label>
                    <label className="text-xs font-bold text-slate-600">Data do pagamento
                      <input type="date" disabled={!fichaDados.pagamento_realizado} value={fichaDados.data_pagamento || ""} onChange={e => setFichaDados(d => ({ ...d, data_pagamento: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500 disabled:bg-slate-100" />
                    </label>
                  </div>
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

               <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Entrega e devolução dos itens</p>
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
                          <label className="text-xs font-bold text-slate-600">Entregue por
                            <select value={fichaDados.responsavel_entrega || ""} onChange={e => setFichaDados(d => ({ ...d, responsavel_entrega: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-emerald-500 font-bold">
                              <option value="">Selecione o responsável...</option>
                              {lideres.map(l => (
                                <option key={l.id} value={l.nome}>{l.nome} ({l.cargo || "Supervisor/Líder"})</option>
                              ))}
                            </select>
                          </label>

                          <label className="text-xs font-bold text-slate-600">Local / setor
                            <input type="text" value={fichaDados.setor_entrega} onChange={e => setFichaDados(d => ({ ...d, setor_entrega: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"/>
                          </label>

                          <label className="text-xs font-bold text-slate-600">Devolução conferida por (Chef / Supervisor)
                            <select value={fichaDados.conferencia_devolucao || ""} onChange={e => setFichaDados(d => ({ ...d, conferencia_devolucao: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 outline-none focus:border-emerald-500 font-bold">
                              <option value="">Selecione o Chef / Supervisor / Responsável...</option>
                              {lideres.map(l => (
                                <option key={l.id} value={l.nome}>{l.nome} ({l.cargo || "Chef / Supervisor"})</option>
                              ))}
                            </select>
                          </label>

                          <label className="text-xs font-bold text-slate-600">Horário da devolução
                            <input type="time" value={fichaDados.horario_devolucao} onChange={e => setFichaDados(d => ({ ...d, horario_devolucao: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-emerald-500"/>
                          </label>
                        </>
                      );
                    })()}
                  </div>
               </div>

               <button disabled={salvandoRecibo} onClick={imprimirFichaPreparada} className="w-full py-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-black text-lg rounded-2xl transition-all active:scale-95 shadow-xl shadow-emerald-700/20 flex items-center justify-center gap-2">
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
            let datas = Array.isArray(recibo.datas_contratadas) && recibo.datas_contratadas.length ? recibo.datas_contratadas : [recibo.data_trabalho];
            datas.forEach(data => Object.assign(linha(data), { recibo, valor: Number(recibo.valor_diaria) || 0 }));
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
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setModalDiarias(null)}>
            <div className="bg-white rounded-[28px] w-full max-w-5xl max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
               <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-black text-slate-800 flex items-center gap-2"><Clock size={18} className="text-emerald-600" /> Histórico completo do extra</h2>
                  <button onClick={() => setModalDiarias(null)} className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={17} /></button>
               </div>
               <p className="text-xs font-bold text-slate-500 mb-4">{modalDiarias.func?.nome} — dias, horários, recibos, pagamentos e ocorrências reunidos no cadastro.</p>
               {modalDiarias.loading ? (
                  <p className="text-center font-bold text-slate-400 py-8">Carregando...</p>
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
                         <div key={rotulo} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                           <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{rotulo}</p>
                           <p className="mt-1 text-lg font-black text-slate-900">{valor}</p>
                         </div>
                       ))}
                     </div>

                     <div className="mt-5">
                       <h3 className="mb-2 text-sm font-black text-slate-800">Dias, valores e horários</h3>
                       {dias.length === 0 ? (
                         <p className="rounded-xl bg-slate-50 p-5 text-center text-sm font-medium text-slate-400">Nenhum dia contratado ou trabalhado registrado.</p>
                       ) : (
                         <div className="overflow-x-auto rounded-2xl border border-slate-200">
                           <table className="w-full min-w-[720px] text-left text-xs">
                             <thead className="bg-slate-900 text-white"><tr><th className="p-3">Data</th><th className="p-3">Situação</th><th className="p-3">Horário do dia</th><th className="p-3">Valor</th><th className="p-3">Pagamento</th><th className="p-3">Ação</th></tr></thead>
<tbody className="divide-y divide-slate-100">
                               {dias.map(item => (
                                 <tr key={item.data}>
                                   <td className="p-3 font-black">{dataBR(item.data)}</td>
                                   <td className="p-3"><span className={`rounded-full px-2 py-1 font-black ${item.ponto?.hora_entrada ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{item.ponto?.hora_entrada ? "Trabalhou" : "Contratado"}</span></td>
                                   <td className="p-3 font-bold text-slate-600">{hora(item.ponto?.hora_entrada || item.recibo?.hora_entrada)} às {hora(item.ponto?.hora_saida || item.recibo?.hora_saida)}</td>
                                   <td className="p-3 font-black text-emerald-700">{fmtBRL(item.valor || 0)}</td>
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
                          <h3 className="mb-2 text-sm font-black text-slate-800">Histórico de recibos de prestação</h3>
                          <div className="space-y-3">
                            {recibos.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-400">Nenhum recibo emitido.</p> : recibos.map(recibo => {
                              const funcNome = recibo.funcao || recibo.dados?.funcao || modalDiarias.func?.cargo || "Prestador Extra";
                              const hEntrada = recibo.hora_entrada || recibo.dados?.entrada || "—";
                              const hSaida = recibo.hora_saida || recibo.dados?.saida_final || "—";
                              const temFoto = !!recibo.dados?.foto_recibo_assinado;
                              const topicos = String(recibo.dados?.topicos_funcao || "").split("\n").map(t => t.trim()).filter(Boolean);

                              return (
                              <div key={recibo.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
                                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-2">
                                  <div>
                                    <p className="font-black text-slate-900 text-sm">{recibo.numero}</p>
                                    <p className="text-xs font-bold text-slate-500">{dataBR(recibo.data_trabalho)} · {recibo.dias_contratados} dia(s) · <b className="text-emerald-700">{fmtBRL(recibo.valor_total)}</b></p>
                                  </div>
                                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${recibo.pagamento_realizado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{recibo.pagamento_realizado ? `Pago em ${dataBR(recibo.data_pagamento)}` : "Pagamento Pendente"}</span>
                                </div>

                                <div className="text-xs space-y-1">
                                  <p className="font-bold text-slate-800">🛠️ Função exercida: <span className="text-emerald-800">{funcNome}</span></p>
                                  <p className="font-medium text-slate-600">⏰ Horário de trabalho: <b>{hEntrada} às {hSaida}</b></p>
                                  {topicos.length > 0 && (
                                    <div className="mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 text-[11px] font-medium text-slate-700">
                                      <p className="font-bold text-slate-500 text-[10px] uppercase mb-0.5">Atribuições do dia:</p>
                                      {topicos.map((t, idx) => <p key={idx} className="truncate">• {t.replace(/^[•\-\*]\s*/, "")}</p>)}
                                    </div>
                                  )}
                                </div>

                                {temFoto && (
                                  <div className="flex items-center gap-2 pt-1">
                                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                      ✓ Recibo Assinado Anexado
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setFotoAmpliada(recibo.dados.foto_recibo_assinado)}
                                      className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
                                    >
                                      <Camera size={13} /> Ver Foto do Recibo
                                    </button>
                                  </div>
                                )}

                                <div className="mt-2 flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                                  <button onClick={() => imprimirFichaExtra(modalDiarias.func, { numero: recibo.numero, diaria: recibo.valor_diaria, dias: recibo.dias_contratados, itens: recibo.itens || [], dados: recibo.dados || {} })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"><Printer size={13} className="mr-1 inline" />Reimprimir</button>
                                  <button onClick={async () => { const pago = !recibo.pagamento_realizado; const resposta = await atualizarPagamentoRecibo(recibo.id, pago); if (resposta.error) alert(resposta.error); else abrirHistoricoDiarias(modalDiarias.func); }} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">{recibo.pagamento_realizado ? "Marcar pendente" : "Marcar como pago"}</button>
                                  <label className="cursor-pointer rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 inline-flex items-center gap-1.5 shadow-sm">
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
                          {modalDiarias.func?.anotacoes_rh && <p className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900"><b>Anotação do cadastro:</b> {modalDiarias.func.anotacoes_rh}</p>}
                          <div className="space-y-2">
                            {advertencias.length === 0 && !modalDiarias.func?.anotacoes_rh ? <p className="rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-700">Nenhum problema registrado.</p> : advertencias.map(adv => (
                              <div key={adv.id} className="rounded-xl border border-rose-200 bg-rose-50 p-3"><p className="text-xs font-black text-rose-700">{dataBR(adv.data)} · {adv.tipo || "Ocorrência"}</p><p className="mt-1 text-sm text-slate-700">{adv.motivo || adv.descricao || adv.observacao || "Registro disciplinar"}</p></div>
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
