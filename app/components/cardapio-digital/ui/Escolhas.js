"use client";

import { formatarPreco, grupoDeTamanho } from "../../../lib/cardapio-digital.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import s from "./escolhas.module.css";

// Grupos de complementos do prato (protótipo TabletDetalhe: "Tamanho ·
// Escolha 1", "Turbine · Até 2"). `valor` = { grupoId: [opcaoId] }. Tamanho
// (escolha única obrigatória) mostra o preço cheio; os outros, "+ R$".
// Quem cobra é o servidor, com a mesma regra (precoDaLinha).

// `largo` (tablet): faixa cinza no nome do grupo e opções em duas colunas, como no protótipo.
export default function Escolhas({ produto, valor = {}, onMudar, idioma = "pt", destacarFaltando = false, largo = false }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const grupos = produto?.grupos || [];
  if (!grupos.length) return null;
  const marcar = (g, id) => {
    const atual = valor[g.id] || [];
    let novo;
    if (g.max === 1) novo = atual[0] === id && g.min === 0 ? [] : [id];
    else if (atual.includes(id)) novo = atual.filter((x) => x !== id);
    else if (atual.length < g.max) novo = [...atual, id];
    else return;
    onMudar?.({ ...valor, [g.id]: novo });
  };
  return (
    <div className={`${s.grupos} ${largo ? s.largo : ""}`}>
      {grupos.map((g) => {
        const sel = valor[g.id] || [];
        const tamanho = grupoDeTamanho(g);
        const ok = sel.length >= g.min;
        const regra = g.tipo === "retirar" ? T("tirar_ingredientes") : g.max === 1 ? T("escolha_1") : T("ate_n", { n: g.max });
        return (
          <fieldset key={g.id} className={s.grupo}>
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
                    {g.tipo === "retirar" ? null : tamanho ? (
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
