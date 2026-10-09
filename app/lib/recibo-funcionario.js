import { imprimirHtml } from "./imprimir";

const esc = (valor) => String(valor ?? "").replace(/[&<>"]/g, (caractere) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;",
}[caractere]));

const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function imprimirReciboFuncionario(recibo, unidadeInfo, infoFuncionario) {
  const empresa = unidadeInfo?.nome || "A Empresa";
  const cnpj = unidadeInfo?.cnpj || "";
  const enderecoEmpresa = unidadeInfo?.endereco || unidadeInfo?.cidade_estado || "";

  const nome = infoFuncionario?.nome || "";
  const cpf = infoFuncionario?.cpf || "";
  const cargo = infoFuncionario?.cargo || "";

  const dataAtual = new Date().toLocaleDateString("pt-BR");

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Recibo de Pagamento - ${esc(nome)}</title>
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #000; max-width: 800px; margin: 0 auto; line-height: 1.6; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
      .title-box { display: flex; flex-direction: column; gap: 4px; }
      .title { font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; }
      .subtitle { font-size: 16px; font-weight: bold; color: #475569; text-transform: uppercase; }
      .empresa-info { text-align: right; font-size: 14px; color: #334155; }
      .valor-box { background: #f8fafc; border: 2px solid #000; padding: 15px 20px; font-size: 24px; font-weight: 900; text-align: center; margin-bottom: 30px; border-radius: 8px; }
      .content { font-size: 16px; text-align: justify; margin-bottom: 40px; }
      .assinatura-area { display: flex; justify-content: space-between; margin-top: 100px; gap: 40px; }
      .assinatura-box { flex: 1; text-align: center; border-top: 1px solid #000; padding-top: 10px; font-size: 14px; }
    </style>
  </head>
  <body>
    <!-- PRIMEIRA VIA (EMPREGADOR) -->
    <div style="min-height: 48vh;">
      <div class="header">
        <div class="title-box">
          <div class="title">Recibo de Pagamento</div>
          <div class="subtitle">${esc(recibo.tipo)}</div>
        </div>
        <div class="empresa-info">
          <strong>${esc(empresa)}</strong><br>
          ${cnpj ? `CNPJ: ${esc(cnpj)}<br>` : ""}
          ${enderecoEmpresa ? `${esc(enderecoEmpresa)}` : ""}
        </div>
      </div>

      <div class="valor-box">
        VALOR: ${moeda(recibo.valor)}
      </div>

      <div class="content">
        Recebi(emos) de <strong>${esc(empresa)}</strong> a importância de <strong>${moeda(recibo.valor)}</strong> 
        referente ao pagamento de <strong>${esc(recibo.tipo)}</strong> 
        do período de referência <strong>${esc(recibo.referencia)}</strong>.<br><br>
        
        <strong>Beneficiário:</strong> ${esc(nome)} ${cpf ? `(CPF: ${esc(cpf)})` : ""}<br>
        <strong>Cargo/Função:</strong> ${esc(cargo || "Não informado")}<br>
        <strong>Forma de pagamento:</strong> ${esc(recibo.formaPagamento)}<br>
        ${recibo.observacao ? `<strong>Observações:</strong> ${esc(recibo.observacao)}<br>` : ""}
      </div>

      <p style="text-align:right; font-size:14px;">Emitido em ${dataAtual} via Héfisto</p>

      <div class="assinatura-area">
        <div class="assinatura-box">
          <strong>${esc(nome)}</strong><br>
          Assinatura do Beneficiário
        </div>
        <div class="assinatura-box">
          <strong>${esc(empresa)}</strong><br>
          Assinatura da Empresa
        </div>
      </div>
    </div>
    
    <div style="border-bottom: 1px dashed #94a3b8; margin: 40px 0;"></div>

    <!-- SEGUNDA VIA (FUNCIONÁRIO) -->
    <div style="min-height: 48vh;">
      <div class="header">
        <div class="title-box">
          <div class="title">Recibo de Pagamento <span style="font-size:14px; font-weight:normal;">(Via do Funcionário)</span></div>
          <div class="subtitle">${esc(recibo.tipo)}</div>
        </div>
        <div class="empresa-info">
          <strong>${esc(empresa)}</strong><br>
          ${cnpj ? `CNPJ: ${esc(cnpj)}<br>` : ""}
          ${enderecoEmpresa ? `${esc(enderecoEmpresa)}` : ""}
        </div>
      </div>

      <div class="valor-box">
        VALOR: ${moeda(recibo.valor)}
      </div>

      <div class="content">
        Recebi(emos) de <strong>${esc(empresa)}</strong> a importância de <strong>${moeda(recibo.valor)}</strong> 
        referente ao pagamento de <strong>${esc(recibo.tipo)}</strong> 
        do período de referência <strong>${esc(recibo.referencia)}</strong>.<br><br>
        
        <strong>Beneficiário:</strong> ${esc(nome)} ${cpf ? `(CPF: ${esc(cpf)})` : ""}<br>
        <strong>Cargo/Função:</strong> ${esc(cargo || "Não informado")}<br>
        <strong>Forma de pagamento:</strong> ${esc(recibo.formaPagamento)}<br>
        ${recibo.observacao ? `<strong>Observações:</strong> ${esc(recibo.observacao)}<br>` : ""}
      </div>

      <p style="text-align:right; font-size:14px;">Emitido em ${dataAtual} via Héfisto</p>

      <div class="assinatura-area">
        <div class="assinatura-box">
          <strong>${esc(nome)}</strong><br>
          Assinatura do Beneficiário
        </div>
        <div class="assinatura-box">
          <strong>${esc(empresa)}</strong><br>
          Assinatura da Empresa
        </div>
      </div>
    </div>

  </body>
  </html>
  `;

  imprimirHtml(html);
}
