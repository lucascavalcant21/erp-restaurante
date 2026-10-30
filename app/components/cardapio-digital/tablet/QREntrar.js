"use client";

import { useState } from "react";
import { cpfValido, mascaraCpf } from "../../../lib/cpf.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, Icone, PalavraDesconto } from "../ui";
import { Aneis } from "../delivery/DeliveryFidelidade";
import { FormCadastro, entrarPorCpf, useCpfServidor } from "./TabletEntrar";
import s from "./qr.module.css";

// Entrar com CPF pelo QR da mesa, no celular (protótipo QREntrar, 390×844).
// É a primeira tela de quem lê o QR quando a casa tem fidelidade; "quero só
// pedir" vai direto ao cardápio. O cadastro usa o mesmo formulário do tablet,
// em uma coluna. Quem confere e grava é o servidor (/api/public/cpf).
export default function QREntrar({ cardapio, idioma = "pt", mesa = "", unidadeId, onEntrou, onFechar, onIdioma, comecarCadastro = false }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const pct = cardapio.fidelidade?.cadastro?.desconto_pct || 0;
  const cashback = cardapio.fidelidade?.cashback;
  const nome = cardapio.unidade?.nome || "";
  const logo = cardapio.tema?.logo_url;
  const iniciais = nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const [tela, setTela] = useState(comecarCadastro ? "cadastro" : "cpf");
  const [cpf, setCpf] = useState("");
  const srv = useCpfServidor(unidadeId, T);
  const entrar = async () => {
    const c = await entrarPorCpf(srv, cpf, T);
    if (c) onEntrou?.(c);
  };

  return (
    <div className={s.tela} role="dialog" aria-modal="true" aria-labelledby="t-qr" lang={idioma}>
      <header className={s.topo}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className={s.logo} aria-hidden="true">{logo ? <img src={logo} alt="" /> : iniciais}</span>
        <span className={s.nome}>{nome}</span>
        {mesa ? <span className={s.mesa}>{T("mesa_n", { n: mesa })}</span> : null}
        {onIdioma ? (
          <button type="button" className={s.idioma} onClick={onIdioma} aria-label={T("idioma_botao")}>
            <Icone nome="globo" tamanho={18} />{idioma.toUpperCase()}
          </button>
        ) : null}
      </header>

      {tela === "cadastro" ? (
        <FormCadastro celular idioma={idioma} unidadeId={unidadeId} pct={pct} cpfInicial={cpf} onEntrou={onEntrou} onFechar={onFechar}
          onJaTenho={() => setTela("cpf")} />
      ) : (
        <>
          <section className={s.convite}>
            <Aneis />
            <h1 className={s.titulo}>{T("faca_parte")}</h1>
            {pct || cashback ? (
              <div className={s.vantagens}>
                {pct ? (
                  <div className={s.vantagem}>
                    <span className={s.vantagemValor}>{pct}% <span className={s.palavra}><PalavraDesconto idioma={idioma} espacoAntes={false} /></span></span>
                    <span className={s.vantagemTexto}>{T("desconto_todos")}</span>
                  </div>
                ) : null}
                {cashback ? (
                  <div className={s.vantagem}>
                    <span className={s.vantagemValor}>{T("pontos_real", { n: cashback.pontos_por_real ?? 1 })}</span>
                    <span className={s.vantagemTexto}>{T("aqui_delivery")}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className={s.corpo}>
            <h2 id="t-qr" className={s.subtitulo}>{T("ja_tem_conta")}</h2>
            <label className={s.rotulo}>CPF
              <input className={s.cpf} value={mascaraCpf(cpf)} onChange={(e) => setCpf(e.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" enterKeyHint="go"
                onKeyDown={(e) => { if (e.key === "Enter" && cpfValido(cpf)) entrar(); }} />
            </label>
            {srv.erro ? <span role="alert" className={s.erro}>{srv.erro}</span> : null}
            <Botao tamanho={56} larguraTotal disabled={!cpfValido(cpf) || srv.ocupado} onClick={entrar}>
              {pct ? <>{T("entrar_ganhar", { pct })} <PalavraDesconto idioma={idioma} espacoAntes={false} /></> : T("entrar")}
            </Botao>
            <div className={s.ou} aria-hidden="true"><span />{T("ou")}<span /></div>
            <button type="button" className={s.cadastre} onClick={() => { setTela("cadastro"); srv.setErro(""); }}>{T("cadastre_btn")}</button>
            <button type="button" className={s.soPedir} onClick={onFechar}>{T("so_pedir")}</button>
          </div>
          <p className={s.nota}>{T("qr_nota")}</p>
        </>
      )}
    </div>
  );
}
