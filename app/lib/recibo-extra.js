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

export function montarHtmlRecibo({ extra, funcionario, recibo, unidade, unidadeInfo, unidadeNome, textos }) {
  const colab = extra || funcionario || {};
  const emp = unidade || unidadeInfo || {};
  const t = normalizarTextos(textos);
  const dados = recibo?.dados || {};

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

  const nome = String(dados.nome || colab?.nome || "").trim() || "—";
  const cpfRaw = String(dados.cpf || colab?.cpf || "").trim();
  const cpf = formatarCPF(cpfRaw);
  const tipoContrato = String(dados.tipo_contrato || colab?.tipo_contrato || "").trim();
  const ehFixo = tipoContrato && tipoContrato !== "Freelancer";
  const funcao = String(recibo?.funcao || dados.funcao || colab?.cargo || "").trim() || (ehFixo ? "colaborador(a)" : "prestador(a) de serviço");

  // Endereço completo do funcionário
  const rua = String(dados.endereco || dados.rua_av || colab?.endereco || colab?.rua_av || "").trim();
  const numCasa = String(dados.numero_casa || colab?.numero_casa || "").trim();
  const bairro = String(dados.bairro || colab?.bairro || "").trim();
  const cidadeColab = String(dados.cidade_uf || colab?.cidade_uf || "").trim();
  const cidadeUf = cidadeColab || (cidadeEmp ? (ufEmp ? `${cidadeEmp}/${ufEmp}` : cidadeEmp) : "");

  const partesEndereco = [];
  if (rua) partesEndereco.push(numCasa ? `${rua}, nº ${numCasa}` : rua);
  if (bairro) partesEndereco.push(bairro);
  if (cidadeColab) partesEndereco.push(cidadeColab);
  const enderecoCompleto = partesEndereco.join(" - ");

  // Dias detalhados com valor por dia/data (ex.: Terça 09/10 R$ 120,00 | Quinta 11/10 R$ 200,00)
  const diasDetalhadosRaw = Array.isArray(dados.dias_detalhados)
    ? dados.dias_detalhados
    : Array.isArray(recibo?.dias_detalhados)
      ? recibo.dias_detalhados
      : [];
  const diasDetalhados = diasDetalhadosRaw
    .filter((d) => d && (d.data || Number(String(d.valor ?? "").replace(",", ".")) > 0))
    .map((d) => ({
      data: String(d.data || recibo?.data_trabalho || "").slice(0, 10),
      valor: Number(String(d.valor ?? "").replace(",", ".")) || 0,
      obs: String(d.obs || d.observacao || d.descricao || "").trim(),
    }))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));

  const trabalhados = (
    diasDetalhados.length > 0
      ? diasDetalhados.map((d) => d.data).filter(Boolean)
      : Array.isArray(recibo?.datas_contratadas) && recibo.datas_contratadas.length
        ? [...recibo.datas_contratadas]
        : [recibo?.data_trabalho].filter(Boolean)
  ).map((d) => String(d).slice(0, 10)).filter(Boolean).sort();

  const inicio = trabalhados[0] || String(recibo?.data_trabalho || new Date().toISOString()).slice(0, 10);
  const fim = trabalhados[trabalhados.length - 1] || inicio;
  const folgas = diasDoPeriodo(inicio, fim).filter((d) => !trabalhados.includes(d));

  const somaDiasDetalhados = diasDetalhados.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
  const diasNum = diasDetalhados.length > 0
    ? diasDetalhados.length
    : (Number(recibo?.dias_contratados) || 1);
  const diasFormatado = (diasNum % 1 === 0) ? String(diasNum) : diasNum.toLocaleString("pt-BR", { minimumFractionDigits: 1 });
  const diaria = diasDetalhados.length > 0
    ? (somaDiasDetalhados / diasDetalhados.length)
    : Number(recibo?.valor_diaria || 0);

  const subtotalBruto = diasDetalhados.length > 0
    ? somaDiasDetalhados
    : (Number(dados.subtotal_bruto) || (diaria > 0 ? diaria * diasNum : Number(recibo?.valor_total || 0)));

  const transporte = Number(String(dados.vale_transporte || 0).replace(",", ".")) || 0;
  const adicional = Number(String(dados.adicional || 0).replace(",", ".")) || 0;

  // Descontos detalhados por produto / consumo (ex.: Coca-Cola R$ 8,00)
  const descontosItensRaw = Array.isArray(dados.descontos_itens)
    ? dados.descontos_itens
    : Array.isArray(recibo?.descontos_itens)
      ? recibo.descontos_itens
      : [];
  const descontosItens = descontosItensRaw
    .filter((it) => it && (String(it.descricao || it.nome || "").trim() || Number(String(it.valor ?? "").replace(",", ".")) > 0))
    .map((it) => ({
      descricao: String(it.descricao || it.nome || "Produto / Consumo").trim(),
      valor: Number(String(it.valor ?? "").replace(",", ".")) || 0,
    }));
  const somaDescontosItens = descontosItens.reduce((acc, it) => acc + it.valor, 0);
  const descontosCampo = Number(String(dados.descontos || 0).replace(",", ".")) || 0;
  const descontoExtraManual = descontosItens.length > 0
    ? Math.max(0, descontosCampo - somaDescontosItens)
    : descontosCampo;
  const totalDescontos = somaDescontosItens + descontoExtraManual;

  // Desmembramento de encargos e taxa de serviço
  const desmembrar = dados.desmembrar !== false;
  const taxaServico = desmembrar ? Number(dados.taxa_servico ?? recibo?.taxa_servico ?? (subtotalBruto * 0.10)) : 0;
  const inss = desmembrar ? Number(dados.inss ?? recibo?.inss ?? (subtotalBruto * 0.11)) : 0;
  const fgts = desmembrar ? Number(dados.fgts ?? recibo?.fgts ?? (subtotalBruto * 0.08)) : 0;

  const totalCalculado = Math.max(0, subtotalBruto + transporte + adicional - totalDescontos);
  const total = Number(recibo?.valor_total ?? totalCalculado);

  const b = (texto) => `<strong>${esc(texto)}</strong>`;

  // ── Parágrafo de abertura com endereço do restaurante ──
  const abertura = `Declaro, para os devidos fins, que ${b(nome)}${cpf ? `, inscrito(a) no CPF nº ${b(cpf)}` : ""}` +
    `${enderecoCompleto ? `, residente e domiciliado(a) em ${b(enderecoCompleto)}` : ""}, ` +
    `prestou serviços como ${b(funcao)} (${ehFixo ? "Colaborador Fixo" : "Extra / Eventual"}) no ${b(empresa)}${cnpj ? `, inscrito no CNPJ nº ${b(cnpj)}` : ""}` +
    `${enderecoEmpresa ? `, localizado em ${b(enderecoEmpresa)}` : ""}, ` +
    `no período compreendido entre ${b(periodoPorExtenso(inicio, fim))}.`;

  // ── Parágrafo dos dias, datas e valores trabalhados ──
  const entrada = String(recibo?.hora_entrada || dados.entrada || colab?.horario_entrada || "").trim();
  const saida = String(recibo?.hora_saida || dados.saida || colab?.horario_saida || "").trim();

  let horarioTexto = "";
  if (entrada && saida) {
    horarioTexto = `, no horário das ${b(entrada)} às ${b(saida)}`;
  } else if (entrada) {
    horarioTexto = `, com entrada às ${b(entrada)}`;
  } else if (saida) {
    horarioTexto = `, com término às ${b(saida)}`;
  }

  const partes = [];
  if (diasDetalhados.length > 0) {
    const descDias = diasDetalhados.map((d) => {
      const dtCurta = d.data ? d.data.split("-").reverse().slice(0, 2).join("/") : "—";
      const obsStr = d.obs ? ` - ${d.obs}` : "";
      return `${diaSemana(d.data)} dia ${dtCurta}${obsStr} (${moeda(d.valor)})`;
    });
    partes.push(
      `Os pagamentos por dia trabalhado neste período foram: ${b(listarComE(descDias))}${horarioTexto}, ` +
      `perfazendo o subtotal bruto de ${b(moeda(subtotalBruto))}.`
    );
  } else {
    partes.push(
      `A prestação de serviços teve início na ${b(`${diaSemana(inicio)}, dia ${porExtenso(inicio)}`)}${horarioTexto}.`
    );
    const ateAFolga = folgas.length ? trabalhados.filter((d) => d < folgas[0]) : trabalhados;
    if (ateAFolga.length > 1) {
      partes.push(`No período referente a este recibo, trabalhou na ` +
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
  }

  // ── Texto de descontos por item (se houver) ──
  if (descontosItens.length > 0 || descontoExtraManual > 0) {
    const listaDesc = [
      ...descontosItens.map((it) => `${it.descricao} (${moeda(it.valor)})`),
      ...(descontoExtraManual > 0 ? [`Outros descontos (${moeda(descontoExtraManual)})`] : []),
    ];
    partes.push(`Foram descontados ${b(moeda(totalDescontos))} referentes a: ${b(listarComE(listaDesc))}.`);
  }

  // ── Forma de Pagamento Única ou Dividida (Dinheiro + Pix) ──
  const forma = String(recibo?.forma_pagamento || dados.forma_pagamento || "").trim();
  const valPix = Number(String(dados.valor_pix || 0).replace(",", ".")) || 0;
  const valDinheiro = Number(String(dados.valor_dinheiro || 0).replace(",", ".")) || 0;

  let pagamentoFormaTexto = "";
  if (valPix > 0 && valDinheiro > 0) {
    pagamentoFormaTexto = `de forma dividida, sendo ${b(`${moeda(valDinheiro)} em Dinheiro`)} e ${b(`${moeda(valPix)} no Pix`)}`;
  } else if (forma.toLowerCase().includes("híbrido") || forma.toLowerCase().includes("hibrido") || forma.toLowerCase().includes("dividido")) {
    if (valPix > 0 || valDinheiro > 0) {
      const partesPag = [];
      if (valDinheiro > 0) partesPag.push(`${moeda(valDinheiro)} em Dinheiro`);
      if (valPix > 0) partesPag.push(`${moeda(valPix)} no Pix`);
      pagamentoFormaTexto = `de forma dividida, sendo ${b(listarComE(partesPag))}`;
    } else {
      pagamentoFormaTexto = `de forma dividida (Dinheiro + Pix)`;
    }
  } else if (forma) {
    pagamentoFormaTexto = `via ${b(forma)}`;
  } else {
    pagamentoFormaTexto = `via Pix`;
  }

  const pagamento = `O pagamento líquido no valor total de ${b(moeda(total))} foi efetuado ${pagamentoFormaTexto}.`;

  const hoje = new Date();
  const emissao = `${hoje.getDate()} de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  // Linhas da tabela: cada dia detalhado + subtotal + encargos + cada item de desconto + divisão do pagamento
  const linhasDiasTabela = diasDetalhados.length > 0
    ? diasDetalhados.map((d) => {
        const dtBr = d.data ? d.data.split("-").reverse().join("/") : "—";
        const diaSem = diaSemana(d.data);
        const diaLabel = diaSem ? `${diaSem.charAt(0).toUpperCase() + diaSem.slice(1)} (${dtBr})` : dtBr;
        return `<tr><td>Pagamento do dia — <strong>${esc(diaLabel)}</strong>${d.obs ? ` · ${esc(d.obs)}` : ""}</td><td>${moeda(d.valor)}</td></tr>`;
      }).join("")
    : `<tr><td>Diária / Valor base (${diasFormatado} ${diasNum === 1 ? "dia" : "dias"} × ${moeda(diaria)})</td><td>${moeda(subtotalBruto)}</td></tr>`;

  const linhasDescontosTabela = [
    ...descontosItens.map((it) => `<tr class="desconto-row"><td>Desconto: <strong>${esc(it.descricao)}</strong></td><td>− ${moeda(it.valor)}</td></tr>`),
    ...(descontoExtraManual > 0 ? [`<tr class="desconto-row"><td>Outros descontos</td><td>− ${moeda(descontoExtraManual)}</td></tr>`] : []),
  ].join("");

  const linhaDivisaoPagamento = (valPix > 0 && valDinheiro > 0)
    ? `<tr class="pagto-split"><td>Forma de pagamento (Dividido)</td><td>Dinheiro: ${moeda(valDinheiro)} &nbsp;|&nbsp; Pix: ${moeda(valPix)}</td></tr>`
    : `<tr class="pagto-split"><td>Forma de pagamento</td><td>${esc(forma || "Pix")}</td></tr>`;

  const renderVia = (identificacaoVia) => `
    <div class="folha">
      <div>
        <div class="topo-via">
          <span class="badge-tipo">${ehFixo ? "COLABORADOR FIXO" : "TRABALHO EXTRA / DIÁRIA"}</span>
          <h1>${esc(t.titulo)}</h1>
          <span class="badge-via">${esc(identificacaoVia)}</span>
        </div>

        <p>${abertura}</p>
        <p>${partes.join(" ")}</p>
        ${t.observacao_horario ? `<p>${esc(t.observacao_horario)}</p>` : ""}
        <p>${pagamento}</p>

        <table><tbody>
          ${linhasDiasTabela}
          ${diasDetalhados.length > 1 ? `<tr class="subtotal-row"><td>Subtotal dos dias trabalhados (${diasFormatado} dias)</td><td>${moeda(subtotalBruto)}</td></tr>` : ""}
          ${linhaValor("Taxa de serviço (10%)", taxaServico)}
          ${linhaValor("Retenção INSS (11%)", inss, "− ")}
          ${linhaValor("Recolhimento FGTS (8%)", fgts)}
          ${linhaValor("Vale-transporte", transporte)}
          ${linhaValor("Adicional / bônus", adicional)}
          ${linhasDescontosTabela}
          <tr class="total"><td>Total líquido ${recibo?.pagamento_realizado !== false ? "pago" : "a pagar"}</td><td>${moeda(total)}</td></tr>
          ${linhaDivisaoPagamento}
        </tbody></table>

        ${t.encerramento ? `<p class="encerramento">${esc(t.encerramento)}</p>` : ""}
      </div>

      <div class="rodape-bloco">
        <p class="local">${cidadeUf ? `${esc(cidadeUf)}, ` : ""}${esc(emissao)}.</p>

        <div class="assinaturas">
          <div class="bloco-assinatura">
            <div class="linha"></div>
            <strong>${esc(nome)}</strong>
            ${cpf ? `<span>CPF: ${esc(cpf)}</span>` : ""}
            <span>${ehFixo ? "Colaborador(a)" : "Prestador(a) de Serviço"} (${esc(funcao)})</span>
          </div>

          <div class="bloco-assinatura">
            <div class="linha"></div>
            ${t.responsavel_nome ? `<strong>${esc(t.responsavel_nome)}</strong>` : `<strong>${esc(empresa)}</strong>`}
            ${t.responsavel_cargo ? `<span>${esc(t.responsavel_cargo)}</span>` : ""}
            <span>${esc(empresa)}${cnpj ? ` - CNPJ: ${esc(cnpj)}` : ""}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const html = `<!doctype html>
  <html lang="pt-BR"><head><meta charset="utf-8"/><title>${esc(recibo?.numero || `Recibo - ${nome}`)}</title>
  <style>
    @page{size:A4 portrait;margin:6mm 9mm}
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:9.8px;line-height:1.36;background:#fff}
    .pagina-a4{display:flex;flex-direction:column;justify-content:space-between;min-height:282mm;max-height:284mm}
    .folha{border:1px solid #000;padding:10px 14px;display:flex;flex-direction:column;justify-content:space-between;min-height:135mm;max-height:137mm;page-break-inside:avoid;break-inside:avoid}
    .topo-via{display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:1px solid #000;padding-bottom:5px;margin-bottom:7px}
    .topo-via h1{font-size:12px;text-align:center;margin:0;letter-spacing:.02em;flex:1}
    .badge-via,.badge-tipo{font-size:8px;font-weight:bold;border:1px solid #000;padding:2px 6px;white-space:nowrap;text-transform:uppercase;background:#f8fafc}
    p{margin:0 0 5px;text-align:justify}
    .encerramento{font-size:9px;color:#111;margin-top:3px}
    table{width:100%;border-collapse:collapse;margin:4px 0 5px}
    th,td{border:1px solid #000;padding:2.5px 7px;text-align:left;font-size:9.3px}
    td:last-child{text-align:right;white-space:nowrap;width:36%}
    .subtotal-row td{font-weight:bold;background:#f8fafc}
    .desconto-row td{color:#7f1d1d;background:#fff5f5}
    .total td{font-weight:bold;font-size:10.5px;background:#ecfdf5;border-top:1.5px solid #000}
    .pagto-split td{font-size:8.8px;background:#f8fafc;font-weight:bold}
    .rodape-bloco{margin-top:4px}
    .local{margin:2px 0 0;font-weight:bold;text-align:right;font-size:9.2px}
    .assinaturas{margin-top:18px;display:flex;justify-content:space-between;gap:24px;text-align:center}
    .bloco-assinatura{flex:1;min-width:0}
    .linha{border-top:1px solid #000;width:85%;margin:0 auto 3px}
    .bloco-assinatura strong{display:block;font-size:9.8px;margin-top:2px}
    .bloco-assinatura span{display:block;font-size:8.4px;color:#222}
    .divisor-pontilhado{position:relative;border-top:1.5px dashed #000;margin:2.5mm 0;text-align:center;height:0}
    .divisor-pontilhado span{position:relative;top:-6px;background:#fff;padding:0 10px;font-size:8px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;color:#333}
    @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body>
    <div class="pagina-a4">
      ${renderVia("1ª VIA — FUNCIONÁRIO")}
      <div class="divisor-pontilhado"><span>✂ Linha pontilhada para recorte · 1ª Via Funcionário / 2ª Via Empresa</span></div>
      ${renderVia("2ª VIA — EMPRESA / RESTAURANTE")}
    </div>
  </body></html>`;

  return html;
}

export function imprimirReciboExtra({ extra, funcionario, recibo, unidade, unidadeInfo, unidadeNome, textos }) {
  const html = montarHtmlRecibo({ extra, funcionario, recibo, unidade, unidadeInfo, unidadeNome, textos });
  return imprimirHtml(html, { aoFalhar: () => window.alert("Não foi possível abrir a impressão deste recibo.") });
}

