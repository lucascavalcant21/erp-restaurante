"use client";

// Cadastro do cliente pelo QR do restaurante. O cliente deixa nome e
// WhatsApp (e aniversário/e-mail, se o dono pediu), aceita o uso dos dados
// (LGPD) e ganha o desconto do dono nos pedidos pelo cardápio digital. Quem
// grava e quem dá o desconto é o servidor/banco; aqui só o formulário.

import { useEffect, useMemo, useState } from "react";
import { Check, Gift, Globe, Loader2 } from "lucide-react";
import { aplicarNome, localizarCardapio } from "../../lib/cardapio-digital.mjs";
import { IDIOMAS, detectarIdioma, infoIdioma, t } from "../../lib/cardapio-idiomas.mjs";
import { caminhoDoCardapio } from "../../lib/cardapio-link.mjs";
import { Folha, Foto } from "./partes";
import s from "./cardapio.module.css";

const chave = (u, k) => `hefisto-cardapio:${u}:${k}`;
const ler = (k, padrao) => { try { const v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* aba anônima */ } };
const ERRO_CAMPO = { nome: "erro_nome", telefone: "erro_tel", email: "cad_erro_email", aniversario: "cad_erro_aniversario", aceite: "cad_erro_aceite" };

export default function CadastroCliente({ unidadeId, cardapioBase }) {
  const [idioma, setIdioma] = useState("pt");
  const [escolherIdioma, setEscolherIdioma] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", aniversario: "", aceite: false, novidades: false });
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [pronto, setPronto] = useState(null);

  useEffect(() => {
    const salvo = ler(chave(unidadeId, "idioma"), "");
    setIdioma(salvo || detectarIdioma(navigator.languages || [navigator.language]));
    const nome = ler(chave(unidadeId, "nome"), "");
    const telefone = ler(chave(unidadeId, "telefone"), "");
    setForm((f) => ({ ...f, nome: typeof nome === "string" ? nome : "", telefone: typeof telefone === "string" ? telefone : "" }));
  }, [unidadeId]);

  const cardapio = useMemo(() => (cardapioBase ? localizarCardapio(cardapioBase, idioma) : null), [cardapioBase, idioma]);
  const lingua = cardapio?.idioma || "pt";
  const T = (k, v) => t(lingua, k, v);
  const cad = cardapio?.fidelidade?.cadastro || null;
  const casa = cardapio?.unidade.nome || "";
  const cores = cardapio?.cores || {};
  const estilo = {
    "--c-primaria": cores.primaria || "#14532d", "--c-sobre": cores.sobre_primaria || "#fff", "--c-fundo": cores.fundo || "#f4f4f4",
    "--c-texto": cores.texto || "#1a1a1a", "--c-suave": cores.texto_suave || "#5c5c5c", "--c-cartao": cores.cartao || "#ffffff",
    "--c-linha": cores.linha || "#e3e3e3", "--c-destaque": cores.destaque || "#14532d", "--c-primaria-suave": cores.suave_primaria || "#eaf4ee",
  };
  const idiomas = IDIOMAS.filter((i) => (cardapio?.idiomas || ["pt"]).includes(i.id));
  const campo = (k) => ({ value: form[k], onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  const enviar = async (e) => {
    e.preventDefault();
    setErros({});
    setErroGeral("");
    setEnviando(true);
    try {
      const r = await fetch("/api/public/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unidade: unidadeId, ...form, email: cad?.pedir_email ? form.email : "", aniversario: cad?.pedir_aniversario ? form.aniversario : "" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.campo && ERRO_CAMPO[j.campo]) setErros({ [j.campo]: T(ERRO_CAMPO[j.campo]) });
        else setErroGeral(j.codigo === "cadastro_indisponivel" ? T("cad_indisponivel") : j.codigo === "cadastro_fechado" ? T("cad_fechado") : T("erro_envio"));
        return;
      }
      // O cardápio deste aparelho já sabe o nome e o WhatsApp (e mostra a estimativa do desconto).
      gravar(chave(unidadeId, "nome"), form.nome.trim());
      gravar(chave(unidadeId, "telefone"), form.telefone.trim());
      gravar(chave(unidadeId, "cadastro"), { final: j.final, pct: j.desconto_pct, aplica: j.aplica, em: Date.now(), usado: false });
      setPronto(j);
    } catch {
      setErroGeral(T("sem_conexao"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={s.raiz} style={estilo} data-fonte={cardapio?.tema.fonte} lang={infoIdioma(lingua).lang}>
      <main className={s.cadastro}>
        <div className={s.cadastroTopo}>
          <Foto src={cardapio?.tema.logo_url} className={s.lojaLogo} alt="" />
          <p className={s.lojaNome}>{casa}</p>
          {idiomas.length > 1 ? (
            <button type="button" className={s.idiomaBotao} onClick={() => setEscolherIdioma(true)} aria-label={`${T("idioma")}: ${infoIdioma(lingua).nome}`}>
              <Globe size={18} aria-hidden="true" /> {lingua.toUpperCase()}
            </button>
          ) : null}
        </div>

        {!cad ? (
          <div className={s.vazio}><strong>{T("cad_fechado")}</strong><a className={s.primario} href={caminhoDoCardapio(unidadeId)}>{T("cad_abrir")}</a></div>
        ) : pronto ? (
          <section className={s.cadastroCartao} aria-live="polite">
            <div className={s.okIcone}><Check size={28} aria-hidden="true" /></div>
            <h1 className={s.detalheNome}>{aplicarNome(T("cad_pronto", { pct: pronto.desconto_pct }), { nome: form.nome })}</h1>
            <p className={s.detalheDescricao}>{T("cad_pronto_sub", { final: pronto.final })}</p>
            <a className={`${s.primario} ${s.largo}`} href={caminhoDoCardapio(unidadeId)}>{T("cad_abrir")}</a>
          </section>
        ) : (
          <form className={s.cadastroCartao} onSubmit={enviar} noValidate>
            <span className={s.fidIcone} aria-hidden="true"><Gift size={22} /></span>
            <h1 className={s.detalheNome}>{T("cad_titulo", { pct: cad.desconto_pct })}</h1>
            <p className={s.detalheDescricao} style={{ marginTop: 4 }}>{T(cad.aplica === "sempre" ? "cad_sub_sempre" : "cad_sub_primeiro")}</p>
            <div className={s.form}>
              <label className={s.rotulo}>{T("cad_nome")}
                <input className={s.campo} {...campo("nome")} autoComplete="name" maxLength={80} required />
                {erros.nome ? <p className={s.erro}>{erros.nome}</p> : null}
              </label>
              <label className={s.rotulo}>{T("cad_whats")}
                <input className={s.campo} {...campo("telefone")} inputMode="tel" autoComplete="tel" placeholder={T("whatsapp_placeholder")} maxLength={20} required />
                {erros.telefone ? <p className={s.erro}>{erros.telefone}</p> : null}
              </label>
              {cad.pedir_aniversario ? (
                <label className={s.rotulo}>{T("cad_aniversario")}
                  <input className={s.campo} type="date" {...campo("aniversario")} max={new Date().toISOString().slice(0, 10)} />
                  {erros.aniversario ? <p className={s.erro}>{erros.aniversario}</p> : null}
                </label>
              ) : null}
              {cad.pedir_email ? (
                <label className={s.rotulo}>{T("cad_email")}
                  <input className={s.campo} type="email" {...campo("email")} autoComplete="email" maxLength={254} />
                  {erros.email ? <p className={s.erro}>{erros.email}</p> : null}
                </label>
              ) : null}
              <label className={s.aceite}>
                <input type="checkbox" checked={form.aceite} onChange={(e) => setForm((f) => ({ ...f, aceite: e.target.checked }))} />
                <span>{T("cad_aceite", { casa })}</span>
              </label>
              {erros.aceite ? <p className={s.erro}>{erros.aceite}</p> : null}
              <label className={s.aceite}>
                <input type="checkbox" checked={form.novidades} onChange={(e) => setForm((f) => ({ ...f, novidades: e.target.checked }))} />
                <span>{T("cad_novidades")}</span>
              </label>
            </div>
            {erroGeral ? <p className={s.erro} role="alert">{erroGeral}</p> : null}
            <button type="submit" className={`${s.primario} ${s.largo}`} disabled={enviando}>
              {enviando ? <Loader2 size={18} className={s.girando} aria-hidden="true" /> : null} {T("cad_enviar")}
            </button>
            <p className={s.pedidoObs} style={{ margin: 0, textAlign: "center" }}>{T("cad_lgpd", { casa })}</p>
          </form>
        )}
      </main>

      {escolherIdioma ? (
        <Folha titulo={T("idioma")} onFechar={() => setEscolherIdioma(false)} idioma={lingua}>
          <ul className={s.idiomaLista}>
            {idiomas.map((i) => (
              <li key={i.id}>
                <button type="button" className={s.idiomaOpcao} aria-current={i.id === lingua ? "true" : undefined} lang={i.lang}
                  onClick={() => { setIdioma(i.id); gravar(chave(unidadeId, "idioma"), i.id); setEscolherIdioma(false); }}>
                  <span>{i.nome}</span>{i.id === lingua ? <Check size={18} aria-hidden="true" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </Folha>
      ) : null}
    </div>
  );
}
