"use client";

// Fidelidade no cardápio do cliente: cartões de selo por produto e cashback.
// As REGRAS vêm do cardápio montado (cardapio.fidelidade); o SALDO vem de
// /api/public/fidelidade, provado pelos pedidos que este aparelho fez. Sem
// saldo conhecido, mostra só as regras — nunca um número inventado.

import { Gift, Stamp, Check, ChevronRight } from "lucide-react";
import { formatarPreco } from "../../lib/cardapio-digital.mjs";
import { progressoDoCartao } from "../../lib/fidelidade.mjs";
import { infoIdioma, t } from "../../lib/cardapio-idiomas.mjs";
import { caminhoDoCadastro } from "../../lib/cardapio-link.mjs";
import s from "./cardapio.module.css";

const data = (iso, idioma) => new Date(iso).toLocaleDateString(infoIdioma(idioma).locale, { day: "2-digit", month: "2-digit" });
// 2.5 → "2,5" onde a vírgula é a casa decimal.
const pct = (v, idioma) => (["en", "zh", "ja", "ko"].includes(idioma) ? String(v) : String(v).replace(".", ","));

/** Bolinhas do cartão: cheias até onde o cliente chegou (só com saldo conhecido). */
function Bolinhas({ total, cheias, idioma }) {
  return (
    <span className={s.bolinhas} role="img" aria-label={t(idioma, "fid_selos_de", { n: cheias, total })}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`${s.bolinha} ${i < cheias ? s.bolinhaCheia : ""}`} aria-hidden="true">
          {i < cheias ? <Check size={12} strokeWidth={3} /> : null}
        </span>
      ))}
    </span>
  );
}

function linhaCartao(c, saldo, idioma) {
  const p = saldo ? progressoDoCartao(c, saldo.selos) : null;
  const falta = p ? (p.completos ? t(idioma, "fid_completo") : p.faltam === 1 ? t(idioma, "fid_falta_um") : t(idioma, "fid_faltam", { n: p.faltam })) : "";
  return { p, falta };
}

/** Convite para o cadastro pelo QR (ou o aviso de que este aparelho já se cadastrou). */
function ConviteCadastro({ cardapio, unidadeId, cadastroLocal }) {
  const cad = cardapio.fidelidade?.cadastro;
  const idioma = cardapio.idioma || "pt";
  if (!cad) return null;
  if (cadastroLocal?.final) {
    return <span className={s.fidFeito}><Check size={16} aria-hidden="true" /> {t(idioma, "cad_desconto_linha")} · {t(idioma, "fid_whats", { final: cadastroLocal.final })}</span>;
  }
  return (
    <a className={s.fidConvite} href={caminhoDoCadastro(unidadeId)} onClick={(e) => e.stopPropagation()}>
      <span>{t(idioma, "cad_titulo", { pct: cad.desconto_pct })}</span>
      <span>{t(idioma, "cad_convite")} <ChevronRight size={14} aria-hidden="true" style={{ verticalAlign: "-2px" }} /></span>
    </a>
  );
}

/** Cartão compacto da tela inicial. Toque abre os detalhes. */
export function CartaoFidelidade({ cardapio, status, onAbrir, unidadeId, cadastroLocal }) {
  const f = cardapio.fidelidade;
  if (!f) return null;
  const idioma = cardapio.idioma || "pt";
  const conhecido = status?.identificado && status?.disponivel;
  const soCadastro = !f.cartoes.length && !f.cashback;
  if (soCadastro) {
    return (
      <div className={s.fidCartao}>
        <span className={s.fidIcone} aria-hidden="true"><Gift size={20} /></span>
        <span className={s.fidCorpo}>
          <strong>{t(idioma, "fid_titulo")}</strong>
          <span className={s.fidLinha}>{t(idioma, f.cadastro.aplica === "sempre" ? "cad_sub_sempre" : "cad_sub_primeiro")}</span>
          <ConviteCadastro cardapio={cardapio} unidadeId={unidadeId} cadastroLocal={cadastroLocal} />
        </span>
      </div>
    );
  }
  return (
    <div className={s.fidCartao}>
      <span className={s.fidIcone} aria-hidden="true"><Gift size={20} /></span>
      <span className={s.fidCorpo}>
        <button type="button" className={s.fidAbrir} onClick={onAbrir}>
          <strong>{t(idioma, "fid_titulo")}</strong>
          {f.cartoes.map((c) => {
            const { p, falta } = linhaCartao(c, conhecido ? status.cartoes?.[c.id] || { selos: 0 } : null, idioma);
            return (
              <span key={c.id} className={s.fidLinha}>
                <span>{t(idioma, "fid_cartao", { n: c.selos, premio: c.recompensa })}</span>
                {p ? <><Bolinhas total={c.selos} cheias={p.completos ? c.selos : p.no_cartao} idioma={idioma} /><span className={s.fidFalta}>{falta}</span></> : null}
              </span>
            );
          })}
          {f.cashback ? (
            <span className={s.fidLinha}>
              <span>{t(idioma, "fid_cashback", { pct: pct(f.cashback.percentual, idioma) })}</span>
              {conhecido && status.cashback?.saldo > 0 ? <strong className={s.fidSaldo}>{t(idioma, "fid_saldo", { valor: formatarPreco(status.cashback.saldo, idioma) })}</strong> : null}
            </span>
          ) : null}
        </button>
        <ConviteCadastro cardapio={cardapio} unidadeId={unidadeId} cadastroLocal={cadastroLocal} />
      </span>
    </div>
  );
}

/** Detalhes (folha): cada cartão com as bolinhas, os pratos que valem selo e o cashback. */
export function DetalheFidelidade({ cardapio, status, onAbrirPrato, unidadeId, cadastroLocal }) {
  const f = cardapio.fidelidade;
  if (!f) return null;
  const idioma = cardapio.idioma || "pt";
  const porId = new Map(cardapio.produtos.map((p) => [p.id, p]));
  const conhecido = status?.identificado && status?.disponivel;
  return (
    <div className={s.fidDetalhe}>
      {conhecido ? <p className={s.pedidoObs} style={{ margin: 0 }}>{t(idioma, "fid_whats", { final: status.final })}</p> : null}
      {status?.identificado && !status?.disponivel ? <p className={s.pedidoObs} style={{ margin: 0 }}>{t(idioma, "fid_em_breve")}</p> : null}
      {!status?.identificado ? <p className={s.pedidoObs} style={{ margin: 0 }}>{t(idioma, "fid_como")}</p> : null}

      {f.cartoes.map((c) => {
        const saldo = conhecido ? status.cartoes?.[c.id] || { selos: 0 } : null;
        const { p, falta } = linhaCartao(c, saldo, idioma);
        return (
          <section key={c.id} className={s.fidBloco}>
            <h3><Stamp size={18} aria-hidden="true" /> {c.nome}</h3>
            <p>{t(idioma, "fid_cartao", { n: c.selos, premio: c.recompensa })} · {t(idioma, c.por === "pedido" ? "fid_regra_pedido" : "fid_regra_unidade")}</p>
            {p ? (
              <>
                <Bolinhas total={c.selos} cheias={p.completos ? c.selos : p.no_cartao} idioma={idioma} />
                <p className={s.fidFalta}>{falta}{saldo?.vence_em ? ` · ${t(idioma, "fid_vence", { data: data(saldo.vence_em, idioma) })}` : ""}</p>
              </>
            ) : null}
            <div className={s.fidPratos}>
              {c.produto_ids.map((id) => porId.get(id)).filter(Boolean).map((prato) => (
                <button key={prato.id} type="button" className={s.secundario} onClick={() => onAbrirPrato(prato.id)}>{prato.nome}</button>
              ))}
            </div>
          </section>
        );
      })}

      {f.cadastro ? (
        <section className={s.fidBloco}>
          <h3><Gift size={18} aria-hidden="true" /> {t(idioma, "cad_desconto_linha")}</h3>
          <p>{t(idioma, "cad_titulo", { pct: f.cadastro.desconto_pct })} {t(idioma, f.cadastro.aplica === "sempre" ? "cad_sub_sempre" : "cad_sub_primeiro")}</p>
          <ConviteCadastro cardapio={cardapio} unidadeId={unidadeId} cadastroLocal={cadastroLocal} />
        </section>
      ) : null}

      {f.cashback ? (
        <section className={s.fidBloco}>
          <h3><Gift size={18} aria-hidden="true" /> {t(idioma, "fid_linha")}</h3>
          <p>
            {t(idioma, "fid_cashback", { pct: pct(f.cashback.percentual, idioma) })}
            {f.cashback.minimo_pedido > 0 ? ` (${t(idioma, "fid_cashback_min", { valor: formatarPreco(f.cashback.minimo_pedido, idioma) })})` : ""}
          </p>
          {conhecido ? (
            <p className={s.fidSaldo}>
              {t(idioma, "fid_saldo", { valor: formatarPreco(status.cashback?.saldo || 0, idioma) })}
              {status.cashback?.vence_em && status.cashback.saldo > 0 ? ` · ${t(idioma, "fid_vence", { data: data(status.cashback.vence_em, idioma) })}` : ""}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** Cartões que um prato alimenta (para o selo no prato e no detalhe). */
export function cartoesDoPrato(cardapio, produtoId) {
  return (cardapio?.fidelidade?.cartoes || []).filter((c) => c.produto_ids.includes(produtoId));
}
