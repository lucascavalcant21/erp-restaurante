"use client";

import { useState } from "react";
import { camposFaltando, cpfValido, mascaraCpf, UFS } from "../../../lib/cpf.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, Icone, PalavraDesconto } from "../ui";
import { Aneis } from "../delivery/DeliveryFidelidade";
import s from "./entrar.module.css";

// Entrar com CPF e cadastro no tablet da mesa (protótipos TabletEntrar e
// TabletCadastro, 9N). À esquerda o convite (desconto e pontos de verdade da
// casa); à direita o teclado do CPF ou o formulário. Quem confere e grava é o
// servidor (/api/public/cpf). O tablet não guarda nada: ao enviar o pedido,
// os dados saem da tela. O celular da mesa (QREntrar) usa o mesmo formulário.

/** Conversa com /api/public/cpf: erro da tela, campo com erro e "ocupado". */
export function useCpfServidor(unidadeId, T) {
  const [erro, setErro] = useState("");
  const [campoErro, setCampoErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const chamar = async (corpo) => {
    setOcupado(true);
    setErro("");
    setCampoErro("");
    try {
      const r = await fetch("/api/public/cpf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unidade: unidadeId, ...corpo }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErro(j.codigo === "cpf_indisponivel" ? T("cpf_indisponivel") : j.erro || T("erro_envio"));
        setCampoErro(j.campo || "");
        return null;
      }
      return j;
    } catch {
      setErro(T("sem_conexao"));
      return null;
    } finally {
      setOcupado(false);
    }
  };
  return { chamar, erro, setErro, campoErro, ocupado };
}

/** Entrar pelo CPF: devolve o cliente ou mostra "não achamos". */
export async function entrarPorCpf(srv, cpf, T) {
  const j = await srv.chamar({ acao: "entrar", cpf });
  if (!j) return null;
  if (!j.encontrado) { srv.setErro(T("cpf_nao_achado")); return null; }
  return { cpf: cpfValido(cpf), nome: j.nome, desconto_pct: j.desconto_pct };
}

function Convite({ unidade, mesa, logo, pct, pontos, cadastro, T, idioma }) {
  const iniciais = String(unidade || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <aside className={s.convite}>
      <Aneis />
      <div className={s.marca}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className={s.logo} aria-hidden="true">{logo ? <img src={logo} alt="" /> : iniciais}</span>
        <span className={s.marcaNome}>{unidade}{mesa ? ` · ${T("mesa_n", { n: mesa })}` : ""}</span>
      </div>
      <h1 className={s.titulo}>{T("faca_parte")}</h1>
      <p className={s.texto}>{cadastro ? T("cadastre_1_minuto") : T("entre_ou_cadastre")}</p>
      {pct ? (
        <div className={s.vantagem}><strong className={s.vantagemValor}>{pct}%</strong><span>{T("de_cashback")} <PalavraDesconto idioma={idioma} espacoAntes={false} /> {T("desconto_todos")}</span></div>
      ) : null}
      {pontos ? <div className={s.vantagem}><strong className={s.vantagemValor}>R$1</strong><span>{T("ponto_aqui_delivery")}</span></div> : null}
      <p className={s.nota}>{T("nao_fica_logado")}</p>
    </aside>
  );
}

/**
 * Formulário do cadastro (TabletCadastro). Todos os campos são obrigatórios
 * (o servidor confere de novo); só "promoções no WhatsApp" é opcional (LGPD).
 * `celular`: uma coluna, para o QR da mesa.
 */
export function FormCadastro({ idioma = "pt", unidadeId, pct = 0, cpfInicial = "", onEntrou, onFechar, onJaTenho, celular = false }) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const srv = useCpfServidor(unidadeId, T);
  const [form, setForm] = useState({ nome: "", cpf: cpfInicial, aniversario: "", uf: "", cidade: "", bairro: "", telefone: "", aceite: false, novidades: false });
  const [tentou, setTentou] = useState(false);
  const faltando = camposFaltando(form);
  const cadastrar = async () => {
    if (faltando.length) { setTentou(true); srv.setErro(T("campos_obrigatorios")); return; }
    const j = await srv.chamar({ acao: "cadastrar", ...form });
    if (j) onEntrou?.({ cpf: cpfValido(form.cpf), nome: j.nome, desconto_pct: j.desconto_pct });
  };
  const muda = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const campo = (nome) => `${s.entrada} ${srv.campoErro === nome || (tentou && faltando.includes(nome)) ? s.entradaErro : ""}`;
  return (
    <section className={`${s.lado} ${celular ? s.ladoCelular : ""}`}>
      <div className={s.formTopo}>
        <div>
          <h2 id="t-entrar" className={s.formTitulo}>{T("seu_cadastro")}</h2>
          <span className={s.formSub}>{T("campos_obrigatorios")}</span>
        </div>
        <button type="button" className={s.link} onClick={onJaTenho}>{T("ja_tenho_cadastro")}</button>
      </div>
      <div className={`${s.form} ${celular ? s.formCelular : ""}`}>
        <label className={`${s.campo} ${s.inteiro}`}>{T("nome_completo")}<input className={campo("nome")} value={form.nome} onChange={muda("nome")} maxLength={80} placeholder={T("como_documento")} autoComplete="name" /></label>
        <label className={s.campo}>CPF<input className={campo("cpf")} value={mascaraCpf(form.cpf)} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value.replace(/\D/g, "").slice(0, 11) }))} inputMode="numeric" placeholder="000.000.000-00" /></label>
        <label className={s.campo}>{T("data_nascimento")}<input className={campo("aniversario")} type="date" value={form.aniversario} onChange={muda("aniversario")} max={new Date().toISOString().slice(0, 10)} /></label>
        <label className={s.campo}>{T("estado")}
          <select className={campo("uf")} value={form.uf} onChange={muda("uf")}>
            <option value="">{T("selecione")}</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className={s.campo}>{T("municipio")}<input className={campo("cidade")} value={form.cidade} onChange={muda("cidade")} maxLength={80} autoComplete="address-level2" /></label>
        <label className={s.campo}>{T("bairro_mora")}<input className={campo("bairro")} value={form.bairro} onChange={muda("bairro")} maxLength={80} /></label>
        <label className={s.campo}>WhatsApp<input className={campo("telefone")} value={form.telefone} onChange={muda("telefone")} inputMode="tel" maxLength={20} placeholder="(00) 00000-0000" autoComplete="tel" /></label>
        <label className={`${s.marcar} ${s.inteiro} ${srv.campoErro === "aceite" || (tentou && !form.aceite) ? s.marcarErro : ""}`}><input type="checkbox" checked={form.aceite} onChange={muda("aceite")} />{T("aceite_dados")}</label>
        <label className={`${s.marcar} ${s.inteiro}`}><input type="checkbox" checked={form.novidades} onChange={muda("novidades")} />{T("quero_promos")}</label>
      </div>
      {srv.erro ? <span role="alert" className={s.erro}>{srv.erro}</span> : null}
      <div className={`${s.formPe} ${celular ? s.formPeCelular : ""}`}>
        <button type="button" className={s.agoraNao} onClick={onFechar}>{T("agora_nao_btn")}</button>
        <Botao tamanho={56} className={s.cadastrar} disabled={srv.ocupado} onClick={cadastrar} aria-disabled={faltando.length > 0}>
          {pct ? <>{T("cadastrar_ganhar", { pct })} <PalavraDesconto idioma={idioma} espacoAntes={false} /></> : T("cadastrar")}
        </Botao>
      </div>
    </section>
  );
}

export default function TabletEntrar({
  cardapio, idioma = "pt", mesa = "", unidadeId, onEntrou, onFechar, onIdioma, comecarCadastro = false,
}) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const pct = cardapio.fidelidade?.cadastro?.desconto_pct || 0;
  const pontos = Boolean(cardapio.fidelidade?.cashback);
  const [tela, setTela] = useState(comecarCadastro ? "cadastro" : "cpf");
  const [cpf, setCpf] = useState("");
  const [cpfCadastro, setCpfCadastro] = useState("");
  const srv = useCpfServidor(unidadeId, T);

  const entrar = async () => {
    const c = await entrarPorCpf(srv, cpf, T);
    if (c) onEntrou?.(c);
    else setCpfCadastro(cpf);
  };
  const tecla = (k) => setCpf((c) => (k === "limpar" ? "" : k === "apagar" ? c.slice(0, -1) : (c + k).slice(0, 11)));

  return (
    <div className={s.fundo} role="dialog" aria-modal="true" aria-labelledby="t-entrar" lang={idioma}>
      <div className={s.caixa}>
        <Convite unidade={cardapio.unidade?.nome} mesa={mesa} logo={cardapio.tema?.logo_url} pct={pct} pontos={pontos} cadastro={tela === "cadastro"} T={T} idioma={idioma} />
        {tela === "cpf" ? (
          <section className={s.lado}>
            {onIdioma ? <button type="button" className={s.idioma} onClick={onIdioma}><Icone nome="globo" tamanho={18} />{T("idioma_botao")} · {idioma.toUpperCase()}</button> : null}
            <div className={s.cpfCaixa}>
              <h2 id="t-entrar" className={s.cpfTitulo}>{T("ja_tem_conta")}</h2>
              <label className={s.rotulo} htmlFor="cpf-mesa">CPF</label>
              <output id="cpf-mesa" className={`${s.cpfVisor} ${cpf ? "" : s.cpfVazio}`} aria-live="polite">{cpf ? mascaraCpf(cpf) : "___.___.___-__"}</output>
              <div className={s.teclado}>
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => <button key={k} type="button" className={s.tecla} onClick={() => tecla(k)}>{k}</button>)}
                <button type="button" className={`${s.tecla} ${s.teclaAcao}`} onClick={() => tecla("limpar")}>{T("limpar")}</button>
                <button type="button" className={s.tecla} onClick={() => tecla("0")}>0</button>
                <button type="button" className={`${s.tecla} ${s.teclaAcao}`} onClick={() => tecla("apagar")} aria-label={T("apagar")}>⌫</button>
              </div>
              {srv.erro ? <span role="alert" className={s.erro}>{srv.erro}</span> : null}
              <Botao tamanho={56} larguraTotal disabled={!cpfValido(cpf) || srv.ocupado} onClick={entrar}>
                {pct ? <>{T("entrar_ganhar", { pct })} <PalavraDesconto idioma={idioma} espacoAntes={false} /></> : T("entrar")}
              </Botao>
              <button type="button" className={s.link} onClick={() => { setTela("cadastro"); srv.setErro(""); setCpfCadastro((c) => c || cpf); }}>{T("nao_tenho_conta")}</button>
              <button type="button" className={s.soPedir} onClick={onFechar}>{T("so_pedir")}</button>
            </div>
          </section>
        ) : (
          <FormCadastro idioma={idioma} unidadeId={unidadeId} pct={pct} cpfInicial={cpfCadastro} onEntrou={onEntrou} onFechar={onFechar}
            onJaTenho={() => { setTela("cpf"); srv.setErro(""); }} />
        )}
      </div>
    </div>
  );
}
