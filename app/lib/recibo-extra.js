import { imprimirHtml } from "./imprimir";
import { supabase, isSupabaseReady } from "./supabase";

const esc = (valor) => String(valor ?? "").replace(/[&<>\"]/g, (caractere) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
}[caractere]));

const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", {
  style: "currency", currency: "BRL",
});

// Nomes fixos em vez de toLocaleDateString: a janela de impressão pode abrir
// com outro locale e trocar "terça-feira" por "Tuesday" no meio do documento.
const DIAS_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Meio-dia evita o recuo de fuso que joga a data para o dia anterior.
const comoData = (iso) => iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`) : null;
const diaSemana = (iso) => { const d = comoData(iso); return d ? DIAS_SEMANA[d.getDay()] : ""; };
const diaDoMes = (iso) => { const d = comoData(iso); return d ? d.getDate() : ""; };
const porExtenso = (iso) => {
  const d = comoData(iso);
  return d ? `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}` : "—";
};

// "18 e 25 de agosto de 2026" quando cabe no mesmo mês; a forma longa só quando
// o período atravessa mês ou ano, para o texto não ficar repetitivo à toa.
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

// "terça-feira (18), quarta-feira (19) e quinta-feira (20)"
function listarComE(itens) {
  const lista = itens.filter(Boolean);
  if (lista.length === 0) return "";
  if (lista.length === 1) return lista[0];
  return `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
}

// Todos os dias entre o primeiro e o último trabalhado, para descobrir quais
// ficaram de fora: é dessa diferença que sai a frase de "não houve expediente".
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

// Linha de dinheiro só aparece se houver valor.
const linhaValor = (rot, valor, sinal = "") =>
  Number(valor) ? `<tr><td>${esc(rot)}</td><td>${sinal}${moeda(valor)}</td></tr>` : "";

// ── TEXTOS EDITÁVEIS ────────────────────────────────────────────────────────
// Cada casa escreve o recibo com as próprias palavras. Em vez de fixar no
// código, tudo isto fica em config_sistema.params.recibo_textos — mesmo padrão
// dos portais, sem migração.
export const RECIBO_TEXTOS_PADRAO = {
  titulo: "RECIBO DE PAGAMENTO E SERVIÇO PRESTADO",
  responsavel_nome: "",
  responsavel_cargo: "Proprietário(a)",
  motivo_folga: "por ser o dia de folga do restaurante",
  observacao_horario: "Em razão da alta demanda de produção e do fluxo de trabalho do restaurante, o horário de saída pode variar, de acordo com a necessidade operacional de cada dia.",
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
    // Só o título é obrigatório; os demais em branco somem do papel de propósito.
    saida[chave] = chave === "titulo" ? (valor || RECIBO_TEXTOS_PADRAO.titulo) : valor;
  }
  // Primeira gravação: quem nunca configurou recebe os textos de exemplo.
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

  // Merge atômico quando a função existe: não pisa nas outras chaves do JSON.
  try {
    const { error } = await supabase.rpc("merge_config_sistema_params", {
      p_unidade_id: unidadeId, p_patch: { recibo_textos },
    });
    if (!error) return { data: recibo_textos, error: null };
  } catch { /* função ainda não criada — grava lendo e reescrevendo o JSON */ }

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

// Monta o HTML do recibo. Usado tanto pela impressão quanto pela pré-visualização
// ao lado do formulário, que atualiza a cada tecla.
//
// `unidade` é o registro inteiro da tabela unidades: dele saem razão social,
// CNPJ e cidade/UF. O nome solto continua aceito para chamadas antigas.
export function montarHtmlRecibo({ extra, recibo, unidade, unidadeNome, textos }) {
  const t = normalizarTextos(textos);
  const dados = recibo?.dados || {};
  const emp = unidade || {};

  const empresa = emp.razao_social || emp.nome_fantasia || emp.nome || unidadeNome || "Restaurante";
  const cnpj = String(emp.cnpj || "").trim();
  const cidadeUf = [emp.cidade, emp.uf].filter(Boolean).join("/");

  const nome = String(dados.nome || extra?.nome || "").trim() || "—";
  const cpf = String(dados.cpf || extra?.cpf || "").trim();
  const funcao = String(recibo?.funcao || dados.funcao || extra?.cargo || "").trim() || "prestador de serviço";

  // Só os dias efetivamente trabalhados entram aqui; o que faltar no meio do
  // intervalo vira a frase de folga mais abaixo.
  const trabalhados = (Array.isArray(recibo?.datas_contratadas) && recibo.datas_contratadas.length
    ? [...recibo.datas_contratadas]
    : [recibo?.data_trabalho].filter(Boolean)
  ).map((d) => String(d).slice(0, 10)).sort();

  const inicio = trabalhados[0] || recibo?.data_trabalho;
  const fim = trabalhados[trabalhados.length - 1] || inicio;
  const folgas = diasDoPeriodo(inicio, fim).filter((d) => !trabalhados.includes(d));

  const dias = trabalhados.length || Math.max(1, Number(recibo?.dias_contratados) || 1);
  const diaria = Number(recibo?.valor_diaria || 0);
  const base = diaria * dias;
  const transporte = Number(dados.vale_transporte || 0);
  const adicional = Number(dados.adicional || 0);
  const descontos = Number(dados.descontos || 0);
  const total = Number(recibo?.valor_total ?? Math.max(0, base + transporte + adicional - descontos));

  const b = (texto) => `<strong>${esc(texto)}</strong>`;

  // ── Parágrafo de abertura ──
  const abertura = `Declaro, para os devidos fins, que ${b(nome)}${cpf ? `, inscrito no CPF nº ${b(cpf)}` : ""}, ` +
    `prestou serviços como ${b(funcao)} no ${b(empresa)}${cnpj ? `, inscrito no CNPJ nº ${b(cnpj)}` : ""}, ` +
    `no período compreendido entre ${b(periodoPorExtenso(inicio, fim))}.`;

  // ── Parágrafo dos dias ──
  const entrada = String(recibo?.hora_entrada || dados.entrada || "").trim();
  const partes = [
    `A prestação de serviços teve início na ${b(`${diaSemana(inicio)}, dia ${porExtenso(inicio)}`)}` +
    `${entrada ? `, às ${b(entrada)}` : ""}.`,
  ];
  // Quando há folga no meio, a lista para antes dela: o dia da volta é dito na
  // frase seguinte, e repetir os dois lugares fica redundante no papel.
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

  // ── Pagamento ──
  const forma = String(recibo?.forma_pagamento || "").trim();
  const pagamento = `O pagamento referente aos serviços prestados é realizado ${b("ao final de cada turno de trabalho")}` +
    `${forma ? `, podendo ser efetuado ${b(`via ${forma}`)}` : ""}.`;

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
      <tr><td>Dias trabalhados</td><td>${dias}</td></tr>
      <tr><td>Subtotal das diárias</td><td>${moeda(base)}</td></tr>
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
      ${cnpj ? `<span>CNPJ: ${esc(cnpj)}</span>` : ""}
    </div>
  </div></body></html>`;

  return html;
}

export function imprimirReciboExtra({ extra, recibo, unidade, unidadeNome, textos }) {
  const html = montarHtmlRecibo({ extra, recibo, unidade, unidadeNome, textos });
  return imprimirHtml(html, { aoFalhar: () => window.alert("Não foi possível abrir a impressão deste recibo.") });
}
