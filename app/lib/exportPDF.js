/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPORTAÇÃO PDF — Cerebro ERP
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usa a API nativa do browser (window.print) com um <style> de impressão
 * injetado dinamicamente. Não requer nenhuma biblioteca externa.
 *
 * Como usar em qualquer módulo:
 *
 *   import { exportarPDF } from "@/app/lib/exportPDF";
 *
 *   exportarPDF({
 *     titulo:    "DRE Gerencial — Junho 2026",
 *     subtitulo: "Demonstrativo de Resultado do Exercício",
 *     linhas: [
 *       { label: "Receita Bruta",  valor: "R$ 28.450,00", destaque: true },
 *       { label: "(-) CMV",        valor: "R$ 10.990,00" },
 *       { label: "Lucro Bruto",    valor: "R$ 17.460,00", total: true },
 *     ],
 *     rodape: "Dados gerados automaticamente pelo Cerebro ERP",
 *   });
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @typedef {Object} LinhaPDF
 * @property {string} label       - Descrição do item
 * @property {string} valor       - Valor formatado (ex: "R$ 1.200,00" ou "61,3%")
 * @property {boolean} [destaque] - Fundo levemente cinza
 * @property {boolean} [total]    - Negrito e borda superior
 * @property {boolean} [separador]- Linha vazia de separação entre seções
 */

/**
 * Abre o diálogo de impressão/salvar PDF do browser com o conteúdo formatado.
 *
 * @param {Object} opts
 * @param {string} opts.titulo
 * @param {string} [opts.subtitulo]
 * @param {LinhaPDF[]} opts.linhas
 * @param {string} [opts.rodape]
 */
export function exportarPDF({ titulo, subtitulo = "", linhas = [], rodape = "" }) {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const linhasHTML = linhas.map(l => {
    if (l.separador) return `<tr><td colspan="2" style="padding:6px 0;"></td></tr>`;
    const bg     = l.destaque ? "background:#f9f9f9;" : "";
    const bold   = l.total    ? "font-weight:700;" : "font-weight:400;";
    const border = l.total    ? "border-top:1.5px solid #222; padding-top:8px;" : "";
    return `
      <tr style="${bg}${border}">
        <td style="padding:5px 8px; font-size:12px; color:#333; ${bold}">${l.label}</td>
        <td style="padding:5px 8px; font-size:12px; color:#111; text-align:right; ${bold}">${l.valor}</td>
      </tr>`;
  }).join("");

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>${titulo}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; background: #fff; padding: 32px; }
        .header { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #10b981; margin-bottom: 4px; }
        h1 { font-size: 20px; font-weight: 900; color: #111; }
        .sub { font-size: 12px; color: #666; margin-top: 2px; }
        .data { font-size: 11px; color: #999; margin-top: 8px; }
        table { width: 100%; border-collapse: collapse; }
        .rodape { margin-top: 32px; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; text-align: center; }
        @media print {
          body { padding: 16px; }
          @page { margin: 1.5cm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">Cerebro ERP</div>
        <h1>${titulo}</h1>
        ${subtitulo ? `<div class="sub">${subtitulo}</div>` : ""}
        <div class="data">Gerado em ${hoje}</div>
      </div>
      <table>
        <tbody>${linhasHTML}</tbody>
      </table>
      ${rodape ? `<div class="rodape">${rodape}</div>` : ""}
    </body>
    </html>`;

  const janela = window.open("", "_blank", "width=800,height=700");
  if (!janela) {
    alert("Permita pop-ups para exportar PDF.");
    return;
  }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  // Aguarda carregamento e abre diálogo de impressão
  janela.onload = () => {
    setTimeout(() => {
      janela.print();
    }, 300);
  };
}

/**
 * Versão simplificada: exporta uma tabela com colunas arbitrárias.
 *
 * @param {Object} opts
 * @param {string} opts.titulo
 * @param {string[]} opts.colunas       - Cabeçalhos
 * @param {string[][]} opts.dados       - Linhas de dados
 * @param {string} [opts.rodape]
 */
export function exportarTabelaPDF({ titulo, colunas = [], dados = [], rodape = "" }) {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const cabecalho = colunas.map(c =>
    `<th style="padding:6px 8px; font-size:11px; font-weight:900; text-align:left; border-bottom:2px solid #111;">${c}</th>`
  ).join("");

  const linhas = dados.map(row =>
    `<tr>${row.map(cel =>
      `<td style="padding:5px 8px; font-size:11px; border-bottom:1px solid #eee;">${cel}</td>`
    ).join("")}</tr>`
  ).join("");

  const html = `
    <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:-apple-system,sans-serif; color:#111; background:#fff; padding:32px; }
      .logo { font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:2px; color:#10b981; margin-bottom:4px; }
      h1 { font-size:18px; font-weight:900; margin-bottom:4px; }
      .data { font-size:11px; color:#999; margin-bottom:20px; }
      table { width:100%; border-collapse:collapse; }
      .rodape { margin-top:24px; font-size:10px; color:#aaa; text-align:center; }
      @media print { body { padding:16px; } @page { margin:1.5cm; } }
    </style></head>
    <body>
      <div class="logo">Cerebro ERP</div>
      <h1>${titulo}</h1>
      <div class="data">Gerado em ${hoje}</div>
      <table><thead><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table>
      ${rodape ? `<div class="rodape">${rodape}</div>` : ""}
    </body></html>`;

  const janela = window.open("", "_blank", "width=900,height=700");
  if (!janela) { alert("Permita pop-ups para exportar PDF."); return; }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  janela.onload = () => setTimeout(() => janela.print(), 300);
}
