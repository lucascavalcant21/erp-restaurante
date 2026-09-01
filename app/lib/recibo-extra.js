import { imprimirHtml } from "./imprimir";
import { supabase, isSupabaseReady } from "./supabase";

const esc = (valor) => String(valor ?? "").replace(/[&<>\"]/g, (caractere) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
}[caractere]));

const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", {
  style: "currency", currency: "BRL",
});

// Formatadores auxiliares para CPF e CNPJ
function formatarCPF(v) {
  const limpo = String(v || "").replace(/\D/g, "");
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return String(v || "");
}

function formatarCNPJ(v) {
  const limpo = String(v || "").replace(/\D/g, "");
  if (limpo.length === 14) {
    return limpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return String(v || "");
}

const DIAS_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const comoData = (iso) => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`) : null;
const diaSemana = (iso) => { const d = comoData(iso); return d ? DIAS_SEMANA[d.getDay()] : ""; };
const diaDoMes = (iso) => { const d = comoData(iso); return d ? d.getDate() : ""; };
const porExtenso = (iso) => {
  const d = comoData(iso);
  return d ? `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` : "—";
};

function periodoPorExtenso(inicio, fim) {
  const a = comoData(inicio);
  const b = comoData(fim);
  if (!a) return "—";
  if (!b || a.getTime() === b.getTime()) return porExtenso(inicio);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.getDate()} e ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`;
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} de ${MESES[a.getMonth()]} e ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`;
  }
  return `${porExtenso(inicio)} e ${porExtenso(fim)}`;
}

function listarComE(itens) {
  const lista = itens.filter(Boolean);
  if (lista.length === 0) return "";
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
}

function diasDoPeriodo(inicio, fim) {
  const a = comoData(inicio);
  const b = comoData(fim);
  if (!a || !b) return [];
  const dias = [];
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

const linhaValor = (rot, valor, sinal = "") =>
  Number(valor) ? `<tr><td>${esc(rot)}</td><td>${sinal}${moeda(valor)}</td></tr>` : "";

export const RECIBO_TEXTOS_PADRAO = {
  titulo: "RECIBO DE PAGAMENTO E SERVIÇO PRESTADO",
  responsavel_nome: "",
  responsavel_cargo: "Proprietário(a)",
  motivo_folga: "por ser o dia de folga do restaurante",
  observacao_horario: "",
  encerramento: "O presente recibo é emitido para comprovação dos serviços prestados e dos respectivos pagamentos referentes ao período acima mencionado.",
};

const LIMITES = {
  titulo: 120, responsavel_nome: 120, responsavel_cargo: 80,
  motivo_folga: 160, observacao_horario: 400, encerramento: 400,
};

function normalizarTextos(config) {
  const base = config && typeof config === "object" ? config : {};
  const saida = {};
  for (const chave of Object.keys(RECIBO_TEXTOS_PADRAO)) {
    const valor = String(base[chave] ?? "").trim().slice(0, LIMITES[chave]);
    saida[chave] = chave === "titulo" ? (valor || RECIBO_TEXTOS_PADRAO.titulo) : valor;
  }
  if (!config) return { ...RECIBO_TEXTOS_PADRAO };
  return saida;
}

export async function fetchReciboTextos(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") {
    return { data: { ...RECIBO_TEXTOS_PADRAO } };
  }
  const { data, error } = await supabase.from("config_sistema")
    .select("params").eq("unidade_id", unidadeId).limit(1);
  if (error) return { data: { ...RECIBO_TEXTOS_PADRAO }, error: error.message };
  return { data: normalizarTextos(data?.[0]?.params?.recibo_textos) };
}

export async function salvarReciboTextos(unidadeId, textos) {
  if (!isSupabaseReady()) return { error: "Sistema sem conexão com o banco." };
  if (!unidadeId || unidadeId === "todas") return { error: "Selecione uma unidade específica." };
  const recibo_textos = normalizarTextos(textos);

  try {
    const { error } = await supabase.rpc("merge_config_sistema_params", {
      p_unidade_id: unidadeId, p_patch: { recibo_textos },
    });
    if (!error) return { data: recibo_textos, error: null };
  } catch {}

  const { data: registros, error: erroLeitura } = await supabase
    .from("config_sistema").select("id, params").eq("unidade_id", unidadeId).limit(1);
  if (erroLeitura) return { error: erroLeitura.message };

  const registro = registros?.[0];
  const params = { ...(registro?.params || {}), recibo_textos };
  if (registro) {
    const { error } = await supabase.from("config_sistema").update({ params }).eq("id", registro.id);
    return { data: recibo_textos, error: error?.message || null };
  }
  const { error } = await supabase.from("config_sistema").insert([{ unidade_id: unidadeId, params }]);
  return { data: recibo_textos, error: error?.message || null };
}

export function montarHtmlRecibo({ extra, recibo, unidade, unidadeNome, textos }) {
  const t = normalizarTextos(textos);
  const dados = recibo?.dados || {};
  const emp = unidade || {};

  const empresa = emp.razao_social || emp.nome_fantasia || emp.nome || unidadeNome || "Seldeestrela Comidas Nortistas Ltda";
  const cnpjRaw = String(emp.cnpj || "42021920000136").trim();
  const cnpj = formatarCNPJ(cnpjRaw);

  // Endereço oficial da empresa/restaurante
  const ruaEmp = String(emp.endereco || emp.rua_av || emp.rua || "Rua Doutor Dirceu Lopes").trim();
  const numEmp = String(emp.numero || emp.numero_estabelecimento || "1812").trim();
  const bairroEmp = String(emp.bairro || "Yolanda").trim();
  const cidadeEmp = String(emp.cidade || "Foz do Iguaçu").trim();
  const ufEmp = String(emp.uf || "PR").trim();

  const partesEmp = [];
  if (ruaEmp) partesEmp.push(numEmp ? `${ruaEmp}, nº ${numEmp}` : ruaEmp);
  if (bairroEmp) partesEmp.push(`Bairro ${bairroEmp}`);
  if (cidadeEmp && ufEmp) partesEmp.push(`${cidadeEmp}/${ufEmp}`);
  const enderecoEmpresa = partesEmp.join(", ");

  const nome = String(dados.nome || extra?.nome || "").trim() || "—";
  const cpfRaw = String(dados.cpf || extra?.cpf || "").trim();
  const cpf = formatarCPF(cpfRaw);
  const funcao = String(recibo?.funcao || dados.funcao || extra?.cargo || "").trim() || "prestador de serviço";

  // Endereço completo do funcionário extra
  const rua = String(dados.endereco || dados.rua_av || extra?.endereco || extra?.rua_av || "").trim();
  const numCasa = String(dados.numero_casa || extra?.numero_casa || "").trim();
  const bairro = String(dados.bairro || extra?.bairro || "").trim();
  const cidadeColab = String(dados.cidade_uf || extra?.cidade_uf || "").trim();

  const partesEndereco = [];
  if (rua) partesEndereco.push(numCasa ? `${rua}, nº ${numCasa}` : rua);
  if (bairro) partesEndereco.push(bairro);
  if (cidadeColab) partesEndereco.push(cidadeColab);
  const enderecoCompleto = partesEndereco.join(" - ");

  const trabalhados = (Array.isArray(recibo?.datas_contratadas) && recibo.datas_contratadas.length
    ? [...recibo.datas_contratadas]
    : [recibo?.data_trabalho].filter(Boolean)
  ).map((d) => String(d).slice(0, 10)).sort();

  const inicio = trabalhados[0] || recibo?.data_trabalho;
  const fim = trabalhados[trabalhados.length - 1] || inicio;
  const folgas = diasDoPeriodo(inicio, fim).filter((d) => !trabalhados.includes(d));

  const diasNum = Number(recibo?.dias_contratados) || 1;
  const diasFormatado = (diasNum % 1 === 0) ? String(diasNum) : diasNum.toLocaleString("pt-BR", { minimumFractionDigits: 1 });
  const diaria = Number(recibo?.valor_diaria || 0);
  const base = Number(recibo?.valor_total) || (diaria * diasNum);
  const transporte = Number(dados.vale_transporte || 0);
  const adicional = Number(dados.adicional || 0);
  const descontos = Number(dados.descontos || 0);

  // Desmembramento de encargos e taxa de serviço
  const taxaServico = Number(dados.taxa_servico || recibo?.taxa_servico || 0);
  const inss = Number(dados.inss || recibo?.inss || 0);
  const fgts = Number(dados.fgts || recibo?.fgts || 0);

  const total = Number(recibo?.valor_total ?? Math.max(0, base + taxaServico + transporte + adicional - inss - descontos));

  const b = (texto) => `<strong>${esc(texto)}</strong>`;

  // ── Parágrafo de abertura com endereço do restaurante ──
  const abertura = `Declaro, para os devidos fins, que ${b(nome)}${cpf ? `, inscrito no CPF nº ${b(cpf)}` : ""}` +
    `${enderecoCompleto ? `, residente e domiciliado(a) em ${b(enderecoCompleto)}` : ""}, ` +
    `prestou serviços como ${b(funcao)} no ${b(empresa)}${cnpj ? `, inscrito no CNPJ nº ${b(cnpj)}` : ""}` +
    `${enderecoEmpresa ? `, localizado em ${b(enderecoEmpresa)}` : ""}, ` +
    `no período compreendido entre ${b(periodoPorExtenso(inicio, fim))}.`;

  // ── Parágrafo dos dias e horários (início e fim) ──
  const entrada = String(recibo?.hora_entrada || dados.entrada || extra?.horario_entrada || "").trim();
  const saida = String(recibo?.hora_saida || dados.saida || extra?.horario_saida || "").trim();

  let horarioTexto = "";
  if (entrada && saida) {
    horarioTexto = `, das ${b(entrada)} às ${b(saida)}`;
  } else if (entrada) {
    horarioTexto = `, às ${b(entrada)}`;
  } else if (saida) {
    horarioTexto = `, com término às ${b(saida)}`;
  }

  const partes = [
    `A prestação de serviços teve início na ${b(`${diaSemana(inicio)}, dia ${porExtenso(inicio)}`)}${horarioTexto}.`,
  ];

  const ateAFolga = folgas.length ? trabalhados.filter((d) => d < folgas[0]) : trabalhados;
  if (ateAFolga.length > 1) {
    partes.push(`No período referente a este recibo, o prestador trabalhou na ` +
      `${b(listarComE(ateAFolga.map((d) => `${diaSemana(d)} (${diaDoMes(d)})`)))}.`);
  }
  if (folgas.length) {
    const retomada = trabalhados.filter((d) => d > folgas[folgas.length - 1])[0];
    partes.push(
      `Na ${b(listarComE(folgas.map((d) => `${diaSemana(d)} (${diaDoMes(d)})`)))}, não houve expediente` +
      `${t.motivo_folga ? `, ${esc(t.motivo_folga)}` : ""}` +
      `${retomada ? `, retornando normalmente às atividades na ${b(`${diaSemana(retomada)}, dia ${porExtenso(retomada)}`)}` : ""}.`
    );
  }

  // ── Forma de Pagamento Única ou Híbrida ──
  const forma = String(recibo?.forma_pagamento || "").trim();
  const valPix = Number(dados.valor_pix || 0);
  const valDinheiro = Number(dados.valor_dinheiro || 0);

  let pagamentoFormaTexto = "";
  if (valPix > 0 && valDinheiro > 0) {
    pagamentoFormaTexto = `de forma híbrida, sendo ${b(`${moeda(valPix)} via Pix`)} e ${b(`${moeda(valDinheiro)} em Dinheiro`)}`;
  } else if (forma.toLowerCase().includes("híbrido") || forma.toLowerCase().includes("hibrido")) {
    if (valPix > 0 || valDinheiro > 0) {
      const partesPag = [];
      if (valPix > 0) partesPag.push(`${moeda(valPix)} via Pix`);
      if (valDinheiro > 0) partesPag.push(`${moeda(valDinheiro)} em Dinheiro`);
      pagamentoFormaTexto = `de forma híbrida, sendo ${b(listarComE(partesPag))}`;
    } else {
      pagamentoFormaTexto = `de forma híbrida (Pix + Dinheiro)`;
    }
  } else if (forma) {
    pagamentoFormaTexto = `via ${b(forma)}`;
  } else {
    pagamentoFormaTexto = `via Pix`;
  }

  const pagamento = `O pagamento referente aos serviços prestados foi efetuado ${pagamentoFormaTexto}.`;

  const hoje = new Date();
  const emissao = `${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  const html = `<!doctype html>
  <html lang="pt-BR"><head><meta charset="utf-8"/><title>${esc(recibo?.numero || "Recibo de extra")}</title>
  <style>
    @page{size:A4 portrait;margin:14mm}
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:12px;line-height:1.65}
    .folha{border:1px solid #000;padding:26px 30px}
    h1{font-size:15px;text-align:center;margin:0 0 26px;letter-spacing:.02em}
    p{margin:0 0 15px;text-align:justify}
    table{width:100%;border-collapse:collapse;margin:0 0 15px}
    th,td{border:1px solid #000;padding:6px 9px;text-align:left}
    th{font-size:10px;text-transform:uppercase;letter-spacing:.06em}
    td:last-child{text-align:right;white-space:nowrap;width:32%}
    .total td{font-weight:bold}
    .local{margin-top:26px;font-weight:bold}
    .assinatura{margin-top:64px;text-align:center}
    .linha{border-top:1px solid #000;width:62%;margin:0 auto 6px}
    .assinatura strong{display:block}
    .assinatura span{display:block;font-size:11px}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><div class="folha">
    <h1>${esc(t.titulo)}</h1>

    <p>${abertura}</p>
    <p>${partes.join(" ")}</p>
    ${t.observacao_horario ? `<p>${esc(t.observacao_horario)}</p>` : ""}
    <p>${pagamento}</p>

    <table><tbody>
      <tr><td>Diária acordada</td><td>${moeda(diaria)}</td></tr>
      <tr><td>Dias trabalhados / Diária</td><td>${diasFormatado}</td></tr>
      <tr><td>Subtotal das diárias</td><td>${moeda(base)}</td></tr>
      ${linhaValor("Taxa de serviço", taxaServico)}
      ${linhaValor("Retenção INSS", inss, "− ")}
      ${linhaValor("Recolhimento FGTS", fgts)}
      ${linhaValor("Vale-transporte", transporte)}
      ${linhaValor("Adicional / bônus", adicional)}
      ${linhaValor("Descontos", descontos, "− ")}
      <tr class="total"><td>Total ${recibo?.pagamento_realizado ? "pago" : "a pagar"}</td><td>${moeda(total)}</td></tr>
    </tbody></table>

    ${t.encerramento ? `<p>${esc(t.encerramento)}</p>` : ""}

    <p class="local">${cidadeUf ? `${esc(cidadeUf)}, ` : ""}${esc(emissao)}.</p>

    <div class="assinatura">
      <div class="linha"></div>
      ${t.responsavel_nome ? `<strong>${esc(t.responsavel_nome)}</strong>` : ""}
      ${t.responsavel_cargo ? `<span>${esc(t.responsavel_cargo)} do ${esc(empresa)}</span>` : ""}
      <span>${esc(empresa)}${cnpj ? ` - CNPJ: ${esc(cnpj)}` : ""}</span>
      ${enderecoEmpresa ? `<span>${esc(enderecoEmpresa)}</span>` : ""}
    </div>
  </div></body></html>`;

  return html;
}

export function imprimirReciboExtra({ extra, recibo, unidade, unidadeNome, textos }) {
  const html = montarHtmlRecibo({ extra, recibo, unidade, unidadeNome, textos });
  return imprimirHtml(html, { aoFalhar: () => window.alert("Não foi possível abrir a impressão deste recibo.") });
}
