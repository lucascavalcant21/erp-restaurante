import { imprimirHtml } from "./imprimir";
import { supabase, isSupabaseReady } from "./supabase";

const esc = (valor) => String(valor ?? "").replace(/[&<>\"]/g, (caractere) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
}[caractere]));

const dataBR = (valor) => {
  if (!valor) return "—";
  const [ano, mes, dia] = String(valor).slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : String(valor);
};

const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", {
  style: "currency", currency: "BRL",
});

const texto = (valor, vazio = "—") => esc(String(valor ?? "").trim() || vazio);
// Campo so entra no papel quando tem conteudo: recibo curto le melhor.
const campo = (rot, valor, largo = false) => {
  const v = String(valor ?? "").trim();
  if (!v || v === "—") return "";
  return `<div class="campo${largo ? " inteiro" : ""}"><span>${esc(rot)}</span><strong>${esc(v)}</strong></div>`;
};
// Linha de dinheiro so aparece se houver valor.
const linhaValor = (rot, valor, sinal = "") =>
  Number(valor) ? `<tr><td>${esc(rot)}</td><td>${sinal}${moeda(valor)}</td></tr>` : "";

function endereco(extra, dados) {
  const partes = [
    dados?.rua_av || extra?.rua_av,
    dados?.numero_casa || extra?.numero_casa,
    dados?.bairro || extra?.bairro,
    dados?.cidade_uf || extra?.cidade_uf,
  ].filter(Boolean);
  return partes.join(", ") || dados?.endereco || extra?.endereco || "—";
}

// ── TEXTOS EDITÁVEIS DO CABEÇALHO ───────────────────────────────────────────
// Cada casa chama o documento de um jeito ("Recibo de diária", "Recibo de
// prestação de serviço"...). Em vez de fixar no código, o texto fica em
// config_sistema.params.recibo_textos — mesmo padrão dos portais, sem migração.
export const RECIBO_TEXTOS_PADRAO = {
  titulo: "RECIBO DE PRESTAÇÃO DE SERVIÇO",
  subtitulo: "Prestação de serviço eventual · diária e acerto financeiro",
};

function normalizarTextos(config) {
  if (!config || typeof config !== "object") return { ...RECIBO_TEXTOS_PADRAO };
  const titulo = String(config.titulo ?? "").trim().slice(0, 120) || RECIBO_TEXTOS_PADRAO.titulo;
  // Subtítulo em branco é escolha válida: a linha simplesmente some do papel.
  const subtitulo = String(config.subtitulo ?? "").trim().slice(0, 160);
  return { titulo, subtitulo };
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
export function montarHtmlRecibo({ extra, recibo, unidadeNome, textos }) {
  const cabecalho = normalizarTextos(textos);
  const dados = recibo?.dados || {};
  const itens = Array.isArray(recibo?.itens) ? recibo.itens : [];
  const dias = Math.max(1, Number(recibo?.dias_contratados) || 1);
  const diaria = Number(recibo?.valor_diaria || 0);
  const base = diaria * dias;
  const transporte = Number(dados.vale_transporte || 0);
  const adicional = Number(dados.adicional || 0);
  const descontos = Number(dados.descontos || 0);
  const total = Number(recibo?.valor_total ?? Math.max(0, base + transporte + adicional - descontos));
  const atribuicoes = String(dados.topicos_funcao || extra?.topicos_funcao || "")
    .split(/\n|;/).map((item) => item.trim()).filter(Boolean);
  const hoje = new Date().toLocaleDateString("pt-BR");

  const html = `<!doctype html>
  <html lang="pt-BR"><head><meta charset="utf-8"/><title>${texto(recibo?.numero, "Recibo de extra")}</title>
  <style>
    @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0;font-size:11px;line-height:1.4}.topo{background:#064e3b;color:white;border-radius:12px;padding:17px 20px;display:flex;justify-content:space-between;gap:18px}.topo h1{font-size:20px;margin:3px 0}.marca{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.12em}.numero{text-align:right;font-size:9px;line-height:1.6}.secao{margin-top:12px;break-inside:avoid}.titulo{border-left:4px solid #10b981;background:#ecfdf5;color:#065f46;padding:6px 9px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.grade{display:grid;grid-template-columns:1fr 1fr;gap:7px 14px;margin-top:7px}.campo{border-bottom:1px solid #cbd5e1;padding:3px 2px 6px}.campo span{display:block;color:#64748b;font-size:8px;font-weight:800;text-transform:uppercase}.campo strong{display:block;margin-top:2px}.inteiro{grid-column:1/-1}table{width:100%;border-collapse:collapse;margin-top:7px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#f1f5f9;color:#475569;font-size:8px;text-transform:uppercase}.total{background:#ecfdf5;color:#065f46;font-size:13px}.caixa{border:1px solid #cbd5e1;background:#f8fafc;border-radius:8px;padding:8px 10px;margin-top:7px}.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:42px;margin-top:44px}.assinatura{border-top:1px solid #172033;padding-top:5px;text-align:center;font-size:9px}.rodape{text-align:center;color:#94a3b8;font-size:8px;margin-top:18px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body>
    <header class="topo"><div><div class="marca">${texto(unidadeNome, "Restaurante")}</div><h1>${esc(cabecalho.titulo)}</h1>${cabecalho.subtitulo ? `<div>${esc(cabecalho.subtitulo)}</div>` : ""}</div><div class="numero"><strong>${texto(recibo?.numero)}</strong><br/>Emitido em ${hoje}<br/>Via do restaurante e do prestador</div></header>

    <section class="secao"><div class="grade">
      <div class="campo"><span>Nome completo</span><strong>${texto(dados.nome || extra?.nome)}</strong></div>
      <div class="campo"><span>CPF / RG</span><strong>${texto(dados.cpf || extra?.cpf)} · ${texto(dados.rg || extra?.rg)}</strong></div>
      <div class="campo"><span>Telefone</span><strong>${texto(dados.telefone || extra?.telefone)}</strong></div>
      ${campo("Chave PIX", dados.chave_pix || extra?.chave_pix)}
      <div class="campo inteiro"><span>Endereço</span><strong>${texto(endereco(extra, dados))}</strong></div>
      <div class="campo"><span>Data inicial</span><strong>${dataBR(recibo?.data_trabalho)}</strong></div>
      <div class="campo"><span>Dias contratados</span><strong>${dias}</strong></div>
      <div class="campo"><span>Função</span><strong>${texto(recibo?.funcao || dados.funcao || extra?.cargo)}</strong></div>
      ${campo("Evento / ocasião", recibo?.evento || dados.evento)}
      <div class="campo"><span>Horário</span><strong>${texto(recibo?.hora_entrada || dados.entrada)} às ${texto(recibo?.hora_saida || dados.saida_final)}</strong></div>
      ${campo("Intervalo", dados.intervalo)}
      <div class="campo inteiro"><span>Refeição</span><strong>${recibo?.janta_ofertada ? "Janta oferecida pelo restaurante" : "Janta não incluída"}</strong></div>
    </div>${atribuicoes.length ? `<div class="caixa"><strong>Atribuições:</strong><br/>${atribuicoes.map((item) => `• ${esc(item.replace(/^[•\-*]\s*/, ""))}`).join("<br/>")}</div>` : ""}</section>

    ${itens.length ? `<section class="secao"><div class="titulo">Itens entregues para o trabalho</div><div class="caixa">${itens.map((item) => `☐ ${esc(item)}`).join(" &nbsp;&nbsp; ")}</div></section>` : ""}

    <section class="secao"><div class="titulo">Acerto financeiro</div><table><tbody>
      <tr><td>Diária acordada</td><td>${moeda(diaria)}</td></tr>
      <tr><td>Subtotal (${dias} diária${dias > 1 ? "s" : ""})</td><td>${moeda(base)}</td></tr>
      ${linhaValor("Vale-transporte", transporte)}
      ${linhaValor("Adicional / bônus", adicional)}
      ${linhaValor("Descontos", descontos, "− ")}
      <tr class="total"><td><strong>Total a pagar</strong></td><td><strong>${moeda(total)}</strong></td></tr>
    </tbody></table><div class="caixa"><strong>Pagamento:</strong> ${texto(recibo?.forma_pagamento)} · ${recibo?.pagamento_realizado ? `pago em ${dataBR(recibo?.data_pagamento)}` : "pendente"}</div></section>

    <p class="caixa">Declaro que recebi o valor descrito acima pela prestação eventual dos serviços informados neste recibo e que conferi os dados do acerto.</p>
    <div class="assinaturas"><div class="assinatura">Assinatura do profissional extra</div><div class="assinatura">Assinatura do responsável da empresa</div></div>
    <div class="rodape">Documento ${texto(recibo?.numero)} · vinculado ao cadastro do extra no ERP</div>
  </body></html>`;

  return html;
}

export function imprimirReciboExtra({ extra, recibo, unidadeNome, textos }) {
  const html = montarHtmlRecibo({ extra, recibo, unidadeNome, textos });
  return imprimirHtml(html, { aoFalhar: () => window.alert("Não foi possível abrir a impressão deste recibo.") });
}
