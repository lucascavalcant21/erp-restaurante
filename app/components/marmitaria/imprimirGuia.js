"use client";

// Imprime o guia de montagem por um iframe escondido (sem janela nova, que o
// tablet bloqueia). O HTML vem de lib/marmitaria/guia-impresso.mjs.

import { htmlDosGuias } from "../../lib/marmitaria/guia-impresso.mjs";

export function imprimirGuias(guias) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open(); doc.write(htmlDosGuias(guias)); doc.close();
  const imprimir = () => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } finally { setTimeout(() => iframe.remove(), 60000); }
  };
  // Espera as fotos carregarem (no máximo 4 s) antes de imprimir.
  const imgs = [...doc.images];
  if (!imgs.length) return setTimeout(imprimir, 50);
  let falta = imgs.length;
  const pronto = () => { if (--falta === 0) imprimir(); };
  imgs.forEach((im) => (im.complete ? pronto() : (im.onload = im.onerror = pronto)));
  setTimeout(() => { if (falta > 0) { falta = 0; imprimir(); } }, 4000);
}
