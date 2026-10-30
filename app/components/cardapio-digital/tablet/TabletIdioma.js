"use client";

import { useState } from "react";
import { IDIOMAS } from "../../../lib/cardapio-idiomas.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, BotaoRedondo, Icone } from "../ui";
import s from "./janela.module.css";

// Escolher o idioma no tablet (protótipo TabletIdioma, 9F). Cada idioma no
// próprio nome, com o nome em português embaixo; a escolha só vale ao
// confirmar. Cancelar e Confirmar já falam o idioma marcado.
const ORDEM = ["pt", "en", "es", "it", "fr", "zh", "ja", "ko"];
const SIGLA = { pt: "PT", en: "EN", es: "ES", it: "IT", fr: "FR", zh: "中", ja: "日", ko: "한" };
const EM_PORTUGUES = { pt: "Português (Brasil)", en: "Inglês", es: "Espanhol", it: "Italiano", fr: "Francês", zh: "Chinês (mandarim)", ja: "Japonês", ko: "Coreano" };

export default function TabletIdioma({ idioma = "pt", oferecidos = IDIOMAS.map((i) => i.id), onEscolher, onFechar }) {
  const [marcado, setMarcado] = useState(idioma);
  const T = (k) => textoDelivery(marcado, k);
  const lista = ORDEM.map((id) => IDIOMAS.find((i) => i.id === id)).filter((i) => i && oferecidos.includes(i.id));
  const lang = IDIOMAS.find((i) => i.id === marcado)?.lang;
  return (
    <div className={s.fundo} onClick={(e) => { if (e.target === e.currentTarget) onFechar?.(); }}>
      <div className={`${s.janela} ${s.janelaIdioma}`} role="dialog" aria-modal="true" aria-labelledby="t-idioma">
        <div className={s.cabeca}>
          <div className={s.cabecaTitulo}>
            <Icone nome="globo" tamanho={26} />
            <h1 id="t-idioma" className={s.titulo}>Idioma · Language</h1>
          </div>
          <BotaoRedondo rotulo={textoDelivery(idioma, "fechar")} onClick={onFechar} />
        </div>
        <div className={s.idiomas} role="radiogroup" aria-label="Idioma · Language">
          {lista.map((i) => {
            const sel = i.id === marcado;
            return (
              <button key={i.id} type="button" role="radio" aria-checked={sel} lang={i.lang} className={`${s.idioma} ${sel ? s.idiomaSel : ""}`} onClick={() => setMarcado(i.id)}>
                <span className={s.sigla}>{SIGLA[i.id]}</span>
                <span className={s.idiomaTextos}>
                  <span className={s.idiomaNome}>{i.id === "zh" ? "中文 (简体)" : i.nome}</span>
                  <span className={s.idiomaPt} lang="pt-BR">{EM_PORTUGUES[i.id]}</span>
                </span>
                {sel ? <Icone nome="check" tamanho={20} traco={2.4} className={s.idiomaCheck} /> : null}
              </button>
            );
          })}
        </div>
        <p className={s.nota} lang={lang}>{T("idioma_nota")}</p>
        <div className={s.pe} lang={lang}>
          <button type="button" className={s.cancelar} onClick={onFechar}>{T("cancelar_btn")}</button>
          <Botao tamanho={56} icone="check" className={s.confirmar} onClick={() => onEscolher?.(marcado)}>{T("confirmar_btn")}</Botao>
        </div>
      </div>
    </div>
  );
}
