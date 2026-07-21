"use client";

// Baixa um PDF DE VERDADE a partir de um HTML de impressão (html2pdf via CDN,
// mesmo esquema do Orçamento de Eventos). Se a biblioteca não carregar em 9s,
// cai para a janela de impressão (onde dá para "Salvar como PDF").
// `formatoMm`: [largura, altura] em mm (ex.: [148, 210] para A5); nulo = A4.
export function baixarPdfDeHtml(html, nomeArquivo, { formatoMm = null } = {}) {
  let win = null;
  try { win = window.open("", "_blank", "width=900,height=1000"); } catch { win = null; }
  if (!win) { alert("Habilite os popups para baixar o PDF."); return; }
  const nome = String(nomeArquivo || "documento").replace(/[^\wÀ-ÿ \-]/g, "").trim().replace(/\s+/g, "-") || "documento";
  const fmt = Array.isArray(formatoMm) ? JSON.stringify(formatoMm) : "'a4'";
  // Limpa o visual de tela (fundo cinza, sombras) antes de fotografar o HTML.
  const estiloPdf = `<style>body{padding:0!important;background:#fff!important}.folha,.capa,.indice,.pagina{box-shadow:none!important;margin:0 auto!important}</style>`;
  const script = `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>`
    + `<script>(function(){var done=false;function run(){if(window.html2pdf){done=true;html2pdf().set({margin:0,filename:'${nome}.pdf',image:{type:'jpeg',quality:0.95},html2canvas:{scale:2,useCORS:true},jsPDF:{unit:'mm',format:${fmt},orientation:'portrait'},pagebreak:{mode:['css','legacy']}}).from(document.body).save().then(function(){setTimeout(function(){try{window.close()}catch(e){}},900);});}else{setTimeout(run,300);}}window.addEventListener('load',function(){setTimeout(run,500);});setTimeout(function(){if(!done){window.print();}},9000);})();<\/script>`;
  win.document.write(html.replace("</body>", estiloPdf + script + "</body>"));
  win.document.close();
}
