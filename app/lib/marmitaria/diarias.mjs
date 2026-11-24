// Equipe do delivery (dono, 21/11/2026): fixos com cadastro completo (dias da
// semana, entrada, saída, intervalo, documentos) e extras pagos por diária, com
// recibo, histórico e impressão iguais aos do RH do restaurante. Mesmo formato
// de colaboradores e rh_recibos_prestacao, então o CMO e o RH leem igual.
// Funções puras (testes em diarias.test.mjs).

export const DIAS_SEMANA = [
  { id: 1, curto: "Seg" }, { id: 2, curto: "Ter" }, { id: 3, curto: "Qua" }, { id: 4, curto: "Qui" },
  { id: 5, curto: "Sex" }, { id: 6, curto: "Sáb" }, { id: 0, curto: "Dom" },
];
export const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)"];
export const FORMAS_PAGAMENTO = ["Pix", "Dinheiro"];

const digitos = (v) => String(v ?? "").replace(/\D/g, "");
const texto = (v) => { const s = String(v ?? "").trim(); return s || null; };
const numeroBR = (v) => { if (typeof v === "number") return Number.isFinite(v) ? v : 0; const n = Number(String(v ?? "").replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round(n * 100) / 100;

export const ehExtra = (c) => /freelancer|extra|diarista/i.test(String(c?.tipo_contrato || ""));

/** "1,2,3" ⇄ [1,2,3] (0 = domingo), sem repetir e na ordem da semana. */
export function diasDoTexto(t) {
  return [...new Set(String(t ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
}
export function textoDosDias(dias = []) {
  const ordem = DIAS_SEMANA.map((d) => d.id);
  return [...new Set(dias)].filter((d) => ordem.includes(d)).sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)).join(",");
}

/** CPF válido pelos dígitos verificadores (vazio também é aceito: o campo é opcional). */
export function cpfValido(v) {
  const d = digitos(v);
  if (!d) return true;
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/**
 * Monta o cadastro do colaborador. `tipo` = "fixo" ou "extra".
 * Devolve { erros, payload }. O salário do extra é o valor da diária (igual ao RH).
 */
export function cadastroDoColaborador(f = {}, { unidadeId, tipo = "fixo" } = {}) {
  const erros = [];
  const nome = String(f.nome || "").trim();
  if (nome.length < 2) erros.push("Informe o nome.");
  if (!cpfValido(f.cpf)) erros.push("CPF inválido. Confira os números.");
  const tel = digitos(f.telefone);
  if (tipo === "extra" && tel.length < 10) erros.push("Informe o telefone com DDD.");
  if (tel && tel.length < 10) erros.push("Telefone incompleto: coloque o DDD.");
  const valor = numeroBR(f.salario);
  if (tipo === "extra" && !(valor > 0)) erros.push("Informe o valor da diária.");
  if (tipo === "fixo" && !String(f.cargo || "").trim()) erros.push("Informe a função.");
  const dias = Array.isArray(f.dias) ? f.dias : diasDoTexto(f.dias_trabalho);
  const intervalo = numeroBR(f.tempo_intervalo);
  if (erros.length) return { erros, payload: null };
  const rua = texto(f.rua_av), num = texto(f.numero_casa), bairro = texto(f.bairro), cidade = texto(f.cidade_uf);
  return {
    erros: [],
    payload: {
      unidade_id: unidadeId, status: "ativo",
      tipo_contrato: tipo === "extra" ? "Freelancer" : (texto(f.tipo_contrato) || "CLT"),
      nome, cargo: String(f.cargo || "").trim() || (tipo === "extra" ? "Extra" : ""),
      salario: valor,
      telefone: tel || null, cpf: digitos(f.cpf) || null, rg: texto(f.rg),
      data_nascimento: f.data_nascimento || null, estado_civil: texto(f.estado_civil),
      tem_filhos: !!f.tem_filhos, qtd_filhos: f.tem_filhos ? Math.max(0, Math.round(numeroBR(f.qtd_filhos))) : null,
      rua_av: rua, numero_casa: num, bairro, cidade_uf: cidade, cep: digitos(f.cep) || null,
      endereco: [rua, num, bairro, cidade].filter(Boolean).join(", ") || null,
      chave_pix: texto(f.chave_pix),
      dias_trabalho: tipo === "extra" ? "" : textoDosDias(dias),
      horario_entrada: f.horario_entrada || null, horario_saida: f.horario_saida || null,
      tempo_intervalo: intervalo > 0 ? Math.round(intervalo) : 0,
      data_admissao: tipo === "fixo" ? (f.data_admissao || null) : null,
    },
  };
}

/**
 * Recibo de diárias no formato de rh_recibos_prestacao (o mesmo do RH, para
 * imprimir com imprimirReciboExtra e entrar no CMO). `dias` = [{ data, valor }].
 */
export function reciboDeDiarias({ extra, dias = [], forma = "Pix", valeTransporte = 0, alimentacao = false, unidadeId, numero, hoje } = {}) {
  const validos = dias.map((d) => ({ data: String(d.data || "").slice(0, 10), valor: r2(numeroBR(d.valor)), obs: String(d.obs || "").trim() }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.data) && d.valor > 0).sort((a, b) => a.data.localeCompare(b.data));
  if (!extra?.id) return { erro: "Escolha o extra.", recibo: null };
  if (!validos.length) return { erro: "Informe pelo menos um dia com data e valor.", recibo: null };
  const subtotal = r2(validos.reduce((s, d) => s + d.valor, 0));
  const vt = r2(numeroBR(valeTransporte));
  const total = r2(subtotal + vt);
  const formaOk = FORMAS_PAGAMENTO.includes(forma) ? forma : "Pix";
  const datas = validos.map((d) => d.data);
  return {
    erro: null,
    recibo: {
      unidade_id: unidadeId, colaborador_id: extra.id,
      numero: numero || `REC-${datas[0].replaceAll("-", "")}-${String(Date.now()).slice(-6)}`,
      data_trabalho: datas[0], datas_contratadas: datas, dias_contratados: datas.length,
      valor_diaria: r2(subtotal / datas.length), valor_total: total,
      pagamento_realizado: true, data_pagamento: hoje || new Date().toLocaleDateString("sv-SE"),
      forma_pagamento: formaOk,
      hora_entrada: extra.horario_entrada || null, hora_saida_intervalo: null, hora_retorno_intervalo: null, hora_saida: extra.horario_saida || null,
      evento: null, funcao: extra.cargo || "Extra", janta_ofertada: !!alimentacao, itens: [],
      dados: {
        nome: extra.nome || "", cpf: extra.cpf || "", rg: extra.rg || "", tipo_contrato: extra.tipo_contrato || "Freelancer",
        telefone: extra.telefone || "", chave_pix: extra.chave_pix || "", endereco: extra.endereco || "",
        rua_av: extra.rua_av || "", numero_casa: extra.numero_casa || "", bairro: extra.bairro || "", cidade_uf: extra.cidade_uf || "",
        topicos_funcao: extra.topicos_funcao || "", setor_entrega: "Delivery",
        alimentacao_fornecida: !!alimentacao, materiais_fornecidos: false,
        dias_detalhados: validos, subtotal_bruto: subtotal, vale_transporte: vt, adicional: 0,
        descontos_itens: [], descontos: 0, forma_pagamento: formaOk,
        valor_pix: formaOk === "Pix" ? total : 0, valor_dinheiro: formaOk === "Dinheiro" ? total : 0,
        desmembrar: false, taxa_servico: 0, inss: 0, fgts: 0,
      },
    },
  };
}
