"use client";

import { formatarPreco, grupoDeTamanho } from "../../../lib/cardapio-digital.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import s from "./escolhas.module.css";

// Grupos de complementos do prato (protótipo TabletDetalhe: "Tamanho ·
// Escolha 1", "Turbine · Até 2"). `valor` = { grupoId: [opcaoId] }. Tamanho
// (escolha única obrigatória) mostra o preço cheio; os outros, "+ R$".
// Quem cobra é o servidor, com a mesma regra (precoDaLinha).

// `largo` (tablet): faixa cinza no nome do grupo e opções em duas colunas, como no protótipo.
// No tablet, com 2 grupos ou mais, o prato vira etapas (como no autoatendimento, pedido do
// dono 08/11/2026): faixa "1 Ponto · 2 Pão · 3 Retirar" no topo e, escolhida a opção única
// de uma etapa, a tela desce sozinha para a próxima.
export default function Escolhas({ produto, valor = {}, onMudar, idioma = "pt", destacarFaltando = false, largo = false }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const grupos = produto?.grupos || [];
  if (!grupos.length) return null;
  const emEtapas = largo && grupos.length > 1;
  const irPara = (g) => {
    if (typeof document === "undefined" || !g) return;
    document.getElementById(`grupo-${produto.id}-${g.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const marcar = (g, id) => {
    const atual = valor[g.id] || [];
    let novo;
    if (g.max === 1) novo = atual[0] === id && g.min === 0 ? [] : [id];
    else if (atual.includes(id)) novo = atual.filter((x) => x !== id);
    else if (atual.length < g.max) novo = [...atual, id];
    else return;
    onMudar?.({ ...valor, [g.id]: novo });
    // escolha única feita: próxima etapa que ainda pede escolha (ou a seguinte)
    if (emEtapas && g.max === 1 && novo.length) {
      const i = grupos.findIndex((x) => x.id === g.id);
      const prox = grupos.slice(i + 1).find((x) => (valor[x.id] || []).length < x.min) || grupos[i + 1];
      if (prox) setTimeout(() => irPara(prox), 180);
    }
  };
  return (
    <div className={`${s.grupos} ${largo ? s.largo : ""}`}>
      {emEtapas ? (
        <nav className={s.etapas} aria-label={T("etapas")}>
          {grupos.map((g, i) => {
            const n = (valor[g.id] || []).length;
            const feito = n > 0 && n >= g.min;
            const falta = g.min > 0 && n < g.min;
            return (
              <button key={g.id} type="button" className={`${s.etapa} ${feito ? s.etapaFeita : ""} ${falta && destacarFaltando ? s.etapaFalta : ""}`} onClick={() => irPara(g)}>
                <span className={s.etapaNumero} aria-hidden="true">{feito ? "✓" : i + 1}</span>
                <span className={s.etapaNome}>{g.nome}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
      {grupos.map((g) => {
        const sel = valor[g.id] || [];
        const tamanho = grupoDeTamanho(g);
        const ok = sel.length >= g.min;
        const regra = g.tipo === "retirar" ? T("tirar_ingredientes") : g.max === 1 ? T("escolha_1") : T("ate_n", { n: g.max });
        return (
          <fieldset key={g.id} id={`grupo-${produto.id}-${g.id}`} className={s.grupo}>
            <legend className={s.cabeca}>
              <span className={s.cabecaTextos}>
                <span className={s.nome}>{g.nome}</span>
                <span className={s.regra}>{regra}{g.descricao ? ` · ${g.descricao}` : ""}</span>
              </span>
              <span className={`${s.estado} ${ok && sel.length ? s.estadoOk : g.min > 0 ? (destacarFaltando ? s.estadoFalta : s.estadoObrigatorio) : ""}`}>
                {g.min > 0 && !ok ? T("obrigatorio") : g.max > 1 ? `${sel.length}/${g.max}` : sel.length ? `✓ ${T("ok_curto")}` : T("opcional")}
              </span>
            </legend>
            <div className={s.opcoes}>
              {g.opcoes.map((o) => {
                const marcado = sel.includes(o.id);
                const cheio = g.max > 1 && !marcado && sel.length >= g.max;
                return (
                  <label key={o.id} className={`${s.opcao} ${marcado ? s.opcaoMarcada : ""} ${cheio ? s.opcaoCheia : ""}`}>
                    <input type={g.max === 1 ? "radio" : "checkbox"} name={`g-${g.id}`} checked={marcado} disabled={cheio} onChange={() => marcar(g, o.id)} onClick={() => { if (g.max === 1 && marcado && g.min === 0) marcar(g, o.id); }} />
                    <span className={s.opcaoNome}>{o.nome}</span>
                    {g.tipo === "retirar" ? <span className={s.opcaoGratis}>{T("gratis")}</span> : tamanho ? (
                      <span className={s.opcaoPreco}>{formatarPreco((produto.preco || 0) + o.preco, idioma)}</span>
                    ) : o.preco > 0 ? <span className={s.opcaoPreco}>+ {formatarPreco(o.preco, idioma)}</span> : null}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
