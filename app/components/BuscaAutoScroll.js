"use client";

import { useEffect } from "react";

// Ao digitar em QUALQUER campo de busca do ERP, a barra de busca sobe para o
// topo da área de conteúdo — assim os resultados aparecem logo abaixo, sem o
// usuário precisar rolar a página para baixo procurando a lista.
// Fica no layout: vale para todas as telas, sem alterar página por página.

const ehCampoDeBusca = (el) => {
  if (!el || el.tagName !== "INPUT") return false;
  if (el.type === "search") return true;
  const ph = (el.getAttribute("placeholder") || "").toLowerCase();
  return ph.includes("buscar") || ph.includes("pesquis") || ph.includes("procur");
};

export default function BuscaAutoScroll() {
  useEffect(() => {
    let timer = null;

    const aoDigitar = (evento) => {
      const campo = evento.target;
      if (!ehCampoDeBusca(campo)) return;
      if (!String(campo.value || "").trim()) return;

      // Campo dentro de modal/janela própria não mexe na rolagem da página.
      if (campo.closest("[role='dialog'], .erp-modal")) return;

      const area = document.querySelector(".erp-main-content");
      if (!area) return;

      clearTimeout(timer);
      timer = setTimeout(() => {
        // Sobe a barra de busca até o topo da área rolável.
        const caixa = campo.closest(".erp-busca-fixa") || campo.parentElement;
        if (!caixa) return;
        const topoArea = area.getBoundingClientRect().top;
        const topoCaixa = caixa.getBoundingClientRect().top;
        const deslocamento = topoCaixa - topoArea;
        // Já está no topo? não faz nada (evita "pular" a cada tecla).
        if (Math.abs(deslocamento) < 24) return;
        area.scrollTo({ top: area.scrollTop + deslocamento - 8, behavior: "smooth" });
      }, 260);
    };

    document.addEventListener("input", aoDigitar, true);
    return () => { clearTimeout(timer); document.removeEventListener("input", aoDigitar, true); };
  }, []);

  return null;
}
