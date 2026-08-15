import { imprimirHtml } from "./imprimir";

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

function endereco(extra, dados) {
  const partes = [
    dados?.rua_av || extra?.rua_av,
    dados?.numero_casa || extra?.numero_casa,
    dados?.bairro || extra?.bairro,
    dados?.cidade_uf || extra?.cidade_uf,
  ].filter(Boolean);
  return partes.join(", ") || dados?.endereco || extra?.endereco || "—";
}

export function imprimirReciboExtra({ extra, recibo, unidadeNome }) {
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
    <header class="topo"><div><div class="marca">${texto(unidadeNome, "Restaurante")}</div><h1>RECIBO DE TRABALHO EXTRA</h1><div>Prestação de serviço eventual · diária e acerto financeiro</div></div><div class="numero"><strong>${texto(recibo?.numero)}</strong><br/>Emitido em ${hoje}<br/>Via do restaurante e do prestador</div></header>

    <section class="secao"><div class="titulo">Prestador cadastrado</div><div class="grade">
      <div class="campo"><span>Nome completo</span><strong>${texto(dados.nome || extra?.nome)}</strong></div>
      <div class="campo"><span>CPF / RG</span><strong>${texto(dados.cpf || extra?.cpf)} · ${texto(dados.rg || extra?.rg)}</strong></div>
      <div class="campo inteiro"><span>Endereço</span><strong>${texto(endereco(extra, dados))}</strong></div>
      <div class="campo"><span>Telefone</span><strong>${texto(dados.telefone || extra?.telefone)}</strong></div>
      <div class="campo"><span>Chave PIX</span><strong>${texto(dados.chave_pix || extra?.chave_pix)}</strong></div>
    </div></section>

    <section class="secao"><div class="titulo">Trabalho realizado</div><div class="grade">
      <div class="campo"><span>Data inicial</span><strong>${dataBR(recibo?.data_trabalho)}</strong></div>
      <div class="campo"><span>Dias contratados</span><strong>${dias}</strong></div>
      <div class="campo"><span>Função</span><strong>${texto(recibo?.funcao || dados.funcao || extra?.cargo)}</strong></div>
      <div class="campo"><span>Evento / ocasião</span><strong>${texto(recibo?.evento || dados.evento)}</strong></div>
      <div class="campo"><span>Horário</span><strong>${texto(recibo?.hora_entrada || dados.entrada)} às ${texto(recibo?.hora_saida || dados.saida_final)}</strong></div>
      <div class="campo"><span>Intervalo</span><strong>${texto(dados.intervalo)}</strong></div>
      <div class="campo inteiro"><span>Refeição</span><strong>${recibo?.janta_ofertada ? "Janta oferecida pelo restaurante" : "Janta não incluída"}</strong></div>
    </div>${atribuicoes.length ? `<div class="caixa"><strong>Atribuições:</strong><br/>${atribuicoes.map((item) => `• ${esc(item.replace(/^[•\-*]\s*/, ""))}`).join("<br/>")}</div>` : ""}</section>

    ${itens.length ? `<section class="secao"><div class="titulo">Itens entregues para o trabalho</div><div class="caixa">${itens.map((item) => `☐ ${esc(item)}`).join(" &nbsp;&nbsp; ")}</div></section>` : ""}

    <section class="secao"><div class="titulo">Acerto financeiro</div><table><tbody>
      <tr><td>Diária acordada</td><td>${moeda(diaria)}</td></tr>
      <tr><td>Subtotal (${dias} diária${dias > 1 ? "s" : ""})</td><td>${moeda(base)}</td></tr>
      <tr><td>Vale-transporte</td><td>${moeda(transporte)}</td></tr>
      <tr><td>Adicional / bônus</td><td>${moeda(adicional)}</td></tr>
      <tr><td>Descontos</td><td>− ${moeda(descontos)}</td></tr>
      <tr class="total"><td><strong>Total a pagar</strong></td><td><strong>${moeda(total)}</strong></td></tr>
    </tbody></table><div class="caixa"><strong>Pagamento:</strong> ${texto(recibo?.forma_pagamento)} · ${recibo?.pagamento_realizado ? `pago em ${dataBR(recibo?.data_pagamento)}` : "pendente"}</div></section>

    <p class="caixa">Declaro que recebi o valor descrito acima pela prestação eventual dos serviços informados neste recibo e que conferi os dados do acerto.</p>
    <div class="assinaturas"><div class="assinatura">Assinatura do profissional extra</div><div class="assinatura">Assinatura do responsável da empresa</div></div>
    <div class="rodape">Documento ${texto(recibo?.numero)} · vinculado ao cadastro do extra no ERP</div>
  </body></html>`;

  return imprimirHtml(html, { aoFalhar: () => window.alert("Não foi possível abrir a impressão deste recibo.") });
}
