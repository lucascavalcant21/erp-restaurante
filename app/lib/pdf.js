"use client";

// Baixa um PDF DE VERDADE a partir de um HTML de impressão.
// Para documentos pequenos (1-5 páginas), usa html2pdf (download direto em .pdf).
// Para documentos grandes (> 5 páginas / Livro com 100+ receitas), o html2canvas do navegador
// estoura o limite de altura da imagem (32k px) e geraria um PDF em branco. Nesses casos,
// usamos o gerador de PDF vetorial nativo do navegador (window.print), garantindo 100% dos
// 120+ arquivos sem páginas em branco e com texto nítido.
export function baixarPdfDeHtml(html, nomeArquivo, { formatoMm = null } = {}) {
  let win = null;
  try { win = window.open("", "_blank", "width=900,height=1000"); } catch { win = null; }
  if (!win) { alert("Habilite os popups para baixar o PDF."); return; }
  const nome = String(nomeArquivo || "documento").replace(/[^\wÀ-ÿ \-]/g, "").trim().replace(/\s+/g, "-") || "documento";
  const fmt = Array.isArray(formatoMm) ? JSON.stringify(formatoMm) : "'a4'";

  const estiloPdf = `<style>
    body{padding:0!important;background:#fff!important;max-width:none!important}
    .folha,.capa,.indice,.pagina,.pagina-livro,.ficha{box-shadow:none!important}
    @media print{
      @page{margin:6mm}
      body{padding:0!important;max-width:none!important}
      .quebra,.capa,.indice,.pagina-livro{page-break-after:always!important;break-after:page!important}
    }
  </style>`;

  const script = `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>`
    + `<script>(function(){
      var done = false;
      function run(){
        var totalPaginas = document.querySelectorAll('.pagina-livro, .quebra, .capa, .ficha').length;
        var alturaTotal = document.body.scrollHeight;

        if (totalPaginas > 5 || alturaTotal > 10000 || !window.html2pdf) {
          done = true;
          setTimeout(function(){ window.print(); }, 400);
          return;
        }

        done = true;
        html2pdf().set({
          margin: 0,
          filename: '${nome}.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: ${fmt}, orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        }).from(document.body).save().then(function(){
          setTimeout(function(){ try { window.close(); } catch(e){} }, 1000);
        }).catch(function(){
          window.print();
        });
      }

      window.addEventListener('load', function(){ setTimeout(run, 600); });
      setTimeout(function(){ if(!done){ window.print(); } }, 7000);
    })();<\/script>`;

  win.document.write(html.replace("</body>", estiloPdf + script + "</body>"));
  win.document.close();
}
