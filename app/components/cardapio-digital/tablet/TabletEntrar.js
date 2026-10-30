"use client";

import { useState } from "react";
import { cpfValido, mascaraCpf, UFS } from "../../../lib/cpf.mjs";
import { textoDelivery } from "../../../lib/cardapio-textos-delivery.mjs";
import { Botao, Icone, PalavraDesconto } from "../ui";
import { Aneis } from "../delivery/DeliveryFidelidade";
import s from "./entrar.module.css";

// Entrar com CPF e cadastro no tablet da mesa (protótipos TabletEntrar e
// TabletCadastro, 9N). À esquerda o convite (desconto e pontos de verdade da
// casa); à direita o teclado do CPF ou o formulário. Quem confere e grava é o
// servidor (/api/public/cpf). O tablet não guarda nada: ao enviar o pedido,
// os dados saem da tela.

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

export default function TabletEntrar({
  cardapio, idioma = "pt", mesa = "", unidadeId, onEntrou, onFechar, onIdioma, comecarCadastro = false,
}) {
  const T = (k, v) => textoDelivery(idioma, k, v);
  const pct = cardapio.fidelidade?.cadastro?.desconto_pct || 0;
  const pontos = Boolean(cardapio.fidelidade?.cashback);
  const [tela, setTela] = useState(comecarCadastro ? "cadastro" : "cpf");
  const [cpf, setCpf] = useState("");
  const [form, setForm] = useState({ nome: "", cpf: "", aniversario: "", uf: "", cidade: "", bairro: "", telefone: "", aceite: false, novidades: false });
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
  const entrar = async () => {
    const j = await chamar({ acao: "entrar", cpf });
    if (!j) return;
    if (!j.encontrado) { setErro(T("cpf_nao_achado")); setForm((f) => ({ ...f, cpf })); return; }
    onEntrou?.({ cpf: cpfValido(cpf), nome: j.nome, desconto_pct: j.desconto_pct });
  };
  const cadastrar = async () => {
    if (faltando.length) { setTentouCadastro(true); setErro(T("campos_obrigatorios")); return; }
    const j = await chamar({ acao: "cadastrar", ...form });
    if (j) onEntrou?.({ cpf: cpfValido(form.cpf), nome: j.nome, desconto_pct: j.desconto_pct });
  };
  const tecla = (k) => setCpf((c) => (k === "limpar" ? "" : k === "apagar" ? c.slice(0, -1) : (c + k).slice(0, 11)));
  // Cadastro: todos os campos são obrigatórios (o servidor confere de novo). Só "promoções no WhatsApp" é opcional (LGPD).
  const faltando = [
    form.nome.trim().split(/s+/).filter(Boolean).length < 2 && "nome", !cpfValido(form.cpf) && "cpf", !form.aniversario && "aniversario",
    !form.uf && "uf", !form.cidade.trim() && "cidade", !form.bairro.trim() && "bairro",
    !/^d{10,11}$/.test(form.telefone.replace(/D/g, "").replace(/^55(?=d{10,11}$)/, "")) && "telefone", !form.aceite && "aceite",
  ].filter(Boolean);
  const [tentouCadastro, setTentouCadastro] = useState(false);
  const muda = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const campo = (nome) => `${s.entrada} ${campoErro === nome || (tentouCadastro && faltando.includes(nome)) ? s.entradaErro : ""}`;

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
              {erro ? <span role="alert" className={s.erro}>{erro}</span> : null}
              <Botao tamanho={56} larguraTotal disabled={!cpfValido(cpf) || ocupado} onClick={entrar}>
                {pct ? <>{T("entrar_ganhar", { pct })} <PalavraDesconto idioma={idioma} espacoAntes={false} /></> : T("entrar")}
              </Botao>
              <button type="button" className={s.link} onClick={() => { setTela("cadastro"); setErro(""); setForm((f) => ({ ...f, cpf: f.cpf || cpf })); }}>{T("nao_tenho_conta")}</button>
              <button type="button" className={s.soPedir} onClick={onFechar}>{T("so_pedir")}</button>
            </div>
          </section>
        ) : (
          <section className={s.lado}>
            <div className={s.formTopo}>
              <div>
                <h2 id="t-entrar" className={s.formTitulo}>{T("seu_cadastro")}</h2>
                <span className={s.formSub}>{T("campos_obrigatorios")}</span>
              </div>
              <button type="button" className={s.link} onClick={() => { setTela("cpf"); setErro(""); }}>{T("ja_tenho_cadastro")}</button>
            </div>
            <div className={s.form}>
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
              <label className={`${s.marcar} ${s.inteiro} ${campoErro === "aceite" || (tentouCadastro && !form.aceite) ? s.marcarErro : ""}`}><input type="checkbox" checked={form.aceite} onChange={muda("aceite")} />{T("aceite_dados")}</label>
              <label className={`${s.marcar} ${s.inteiro}`}><input type="checkbox" checked={form.novidades} onChange={muda("novidades")} />{T("quero_promos")}</label>
            </div>
            {erro ? <span role="alert" className={s.erro}>{erro}</span> : null}
            <div className={s.formPe}>
              <button type="button" className={s.agoraNao} onClick={onFechar}>{T("agora_nao_btn")}</button>
              <Botao tamanho={56} className={s.cadastrar} disabled={ocupado} onClick={cadastrar} aria-disabled={faltando.length > 0}>
                {pct ? <>{T("cadastrar_ganhar", { pct })} <PalavraDesconto idioma={idioma} espacoAntes={false} /></> : T("cadastrar")}
              </Botao>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
