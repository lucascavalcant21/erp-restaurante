// Imprime um HTML SEM abrir aba nova: usa um iframe invisível na própria
// página. Isso resolve o caso mais comum de "não acontece nada" — o navegador
// bloqueia window.open silenciosamente (pop-up), e o usuário nunca vê o
// diálogo de impressão. Devolve true se conseguiu disparar a impressão.
export function imprimirHtml(html, { aoFalhar } = {}) {
  if (typeof window === "undefined") return false;
  try {
    const antigo = document.getElementById("__frame_impressao");
    if (antigo) antigo.remove();

    const frame = document.createElement("iframe");
    frame.id = "__frame_impressao";
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
    document.body.appendChild(frame);

    const doc = frame.contentWindow?.document;
    if (!doc) throw new Error("iframe sem documento");
    doc.open();
    doc.write(html);
    doc.close();

    const disparar = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {
        if (aoFalhar) aoFalhar(e);
      }
      // Mantém o iframe um tempo: remover cedo cancela o diálogo em alguns navegadores.
      setTimeout(() => { try { frame.remove(); } catch {} }, 60000);
    };

    // Espera as imagens (QR, logo) carregarem antes de mandar imprimir.
    if (doc.readyState === "complete") setTimeout(disparar, 300);
    else frame.onload = () => setTimeout(disparar, 300);
    return true;
  } catch (e) {
    if (aoFalhar) aoFalhar(e);
    return false;
  }
}

// Injeta um botão "Fechar" e fecha a aba sozinha após imprimir/cancelar.
// No celular, a aba aberta para impressão ficava presa e o usuário não
// conseguia voltar ao app. Usar em toda impressão que abre uma nova aba.
export function comFecharImpressao(html) {
  const extra = `
    <style>@media print{.__fechar-imp{display:none!important}}</style>
    <button class="__fechar-imp" onclick="window.close()" style="position:fixed;top:10px;right:10px;z-index:2147483647;padding:12px 18px;font:700 15px sans-serif;background:#0f172a;color:#fff;border:0;border-radius:12px;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer">✕ Fechar</button>
    <script>window.onafterprint=function(){setTimeout(function(){try{window.close()}catch(e){}},200)}<\/script>`;
  return html.includes("</body>") ? html.replace("</body>", extra + "</body>") : html + extra;
}
