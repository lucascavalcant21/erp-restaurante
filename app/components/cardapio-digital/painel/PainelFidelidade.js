"use client";

import { CANAIS_FIDELIDADE } from "../../../lib/fidelidade.mjs";
import MenuPainel from "./MenuPainel";
import s from "./painel.module.css";

// Painel → Fidelidade e selos (protótipo PainelFidelidade, 9N): validar o
// código de prêmio que o cliente mostra, a regra de pontos/cashback e os
// canais que contam, os cartões de selos e as retiradas recentes. Só desenha;
// quem lê e grava é a página (o banco confere permissão e saldo).

const ROTULO_CANAL = { mesa: "Mesa", delivery: "Delivery", balcao: "Balcão" };
const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const dia = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function PainelFidelidade({
  nomeLoja = "", itensMenu, codigo = "", onCodigo, onValidar, resultado = null, onConfirmar, ocupado = false,
  regras, setRegras, onSalvarRegras, regrasMudaram = false, cartoes = [], numeros = {}, retiradas = [], premiosLigados = true,
  ligado = false, erro = "", aviso = "", linkCartoes = "#",
}) {
  const canais = regras.canais?.length ? regras.canais : CANAIS_FIDELIDADE;
  const alternarCanal = (c) => {
    const n = new Set(canais);
    if (n.has(c)) n.delete(c); else n.add(c);
    const lista = CANAIS_FIDELIDADE.filter((x) => n.has(x));
    setRegras((r) => ({ ...r, canais: lista.length === CANAIS_FIDELIDADE.length ? [] : lista }));
  };
  const muda = (campo) => (e) => setRegras((r) => ({ ...r, cashback: { ...r.cashback, [campo]: e.target.value } }));

  return (
    <div className={s.raiz}>
      <MenuPainel atual="fidelidade" nomeLoja={nomeLoja} itens={itensMenu} />
      <main className={s.conteudo}>
        <div className={s.topo}><h1 className={s.titulo}>Fidelidade e selos</h1></div>
        {erro ? <div role="alert" className={s.erro}>{erro}</div> : null}
        {aviso ? <div className={s.aviso}>{aviso}</div> : null}

        <section aria-labelledby="t-validar" className={s.fidValidar}>
          <h2 id="t-validar" className={s.fidValidarTitulo}>Validar código de prêmio</h2>
          <form className={s.fidValidarLinha} onSubmit={(e) => { e.preventDefault(); onValidar?.(); }}>
            <label className={s.fidValidarCampo}>
              <span className={s.fidValidarRotulo}>Código que o cliente mostrou</span>
              <input className={s.fidCodigo} value={codigo} maxLength={9} autoComplete="off" spellCheck={false} aria-label="Código do prêmio"
                onChange={(e) => onCodigo?.(e.target.value.toUpperCase())} placeholder="ABC-123" />
            </label>
            <button type="submit" className={s.fidValidarBotao} disabled={ocupado || codigo.replace(/[^A-Z0-9]/gi, "").length < 6}>Validar</button>
          </form>
          {resultado ? (
            <div className={`${s.fidResultado} ${resultado.pode ? "" : s.fidResultadoRuim}`} role="status">
              <span aria-hidden="true" className={s.fidResultadoIcone}>{resultado.pode ? "✓" : "!"}</span>
              <div className={s.fidResultadoTextos}>
                <span className={s.fidResultadoTitulo}>{resultado.titulo}</span>
                {resultado.detalhe ? <span className={s.fidResultadoDetalhe}>{resultado.detalhe}</span> : null}
              </div>
              {resultado.pode ? <button type="button" className={s.fidConfirmar} disabled={ocupado} onClick={onConfirmar}>Confirmar retirada</button> : null}
            </div>
          ) : null}
        </section>

        <div className={s.fidColunas}>
          <section aria-labelledby="t-pontos" className={s.fidCaixa}>
            <h2 id="t-pontos" className={s.fidCaixaTitulo}>Pontos e cashback</h2>
            <div className={s.fidRegra}>
              A cada R$ <input className={`${s.promoEntrada} ${s.fidNumero}`} inputMode="decimal" value="1,00" readOnly aria-label="Valor gasto" />
              o cliente ganha <input className={`${s.promoEntrada} ${s.fidNumero}`} inputMode="decimal" value={regras.cashback.pontos_por_real} onChange={muda("pontos_por_real")} aria-label="Pontos" /> ponto(s)
            </div>
            <div className={s.fidRegra}>
              <input className={`${s.promoEntrada} ${s.fidNumero}`} value="100" readOnly aria-label="Pontos para trocar" /> pontos = R$
              <input className={`${s.promoEntrada} ${s.fidNumero}`} inputMode="decimal" value={regras.cashback.valor_100} onChange={muda("valor_100")} aria-label="Valor do cashback" />
              de <strong className={s.fidPalavra}>CASHBACK</strong>
            </div>
            <div className={s.promoCanais}>
              {CANAIS_FIDELIDADE.map((c) => (
                <label key={c} className={s.promoMarcar}><input type="checkbox" checked={canais.includes(c)} onChange={() => alternarCanal(c)} />{ROTULO_CANAL[c]}</label>
              ))}
            </div>
            <label className={s.promoMarcar}>
              <input type="checkbox" checked={!!regras.cashback.ativo} onChange={(e) => setRegras((r) => ({ ...r, ativo: e.target.checked ? true : r.ativo, cashback: { ...r.cashback, ativo: e.target.checked } }))} />
              Cashback ligado
            </label>
            <div className={s.fidNota}>
              Mesmo WhatsApp soma em todos os canais marcados. Pontos entram depois do pagamento
              {regras.cashback.validade_dias ? ` e valem ${regras.cashback.validade_dias} dias sem compra` : " e não vencem"}. Pedidos de iFood e outros apps não contam.
            </div>
            {regrasMudaram ? <button type="button" className={s.promoSalvar} disabled={ocupado} onClick={onSalvarRegras}>Salvar regras</button> : null}
          </section>

          <section aria-labelledby="t-selos" className={s.fidCaixa}>
            <div className={s.fidCaixaTopo}>
              <h2 id="t-selos" className={s.fidCaixaTitulo}>Cartões de selos</h2>
              <a href={linkCartoes} className={s.acaoPrincipal}>+ Novo cartão</a>
            </div>
            {!cartoes.length ? <div className={s.promoVazio}>Nenhum cartão ainda. Crie o primeiro (ex.: 6 Tacacás = 1 grátis).</div> : null}
            {cartoes.map((c) => (
              <div key={c.id} className={s.fidCartao}>
                <div className={s.fidCartaoTopo}>
                  <span className={s.fidCartaoNome}>{c.nome}</span>
                  <span className={`${s.fidStatus} ${c.ativo && ligado ? "" : s.fidStatusOff}`}>{c.ativo && ligado ? "Ativo" : "Pausado"}</span>
                </div>
                <span className={s.fidCartaoRegra}>
                  {c.por === "pedido" ? "Cada pedido com o prato" : "Cada prato comprado"} = 1 selo. {c.selos} selos = {c.recompensa || "prêmio"}.
                  {c.validade_dias ? ` Selos valem ${c.validade_dias} dias sem compra.` : ""} Código vale 30 dias.
                </span>
                <div className={s.fidCartaoNumeros}>
                  <span>{numeros[c.id]?.andamento ?? 0} em andamento</span>
                  <span>{numeros[c.id]?.completosMes ?? 0} completos no mês</span>
                  <span>{c.produto_ids.length} prato{c.produto_ids.length === 1 ? "" : "s"}</span>
                </div>
              </div>
            ))}
          </section>
        </div>

        <section aria-labelledby="t-log" className={s.fidLog}>
          <h2 id="t-log" className={s.fidCaixaTitulo}>Retiradas recentes</h2>
          <div className={s.tabelaCaixa}>
            <table className={s.tabela}>
              <thead><tr><th>QUANDO</th><th>CLIENTE</th><th>PRÊMIO</th><th>CÓDIGO</th><th>LIBERADO POR</th></tr></thead>
              <tbody>
                {retiradas.map((r) => (
                  <tr key={r.codigo}>
                    <td>{quando(r.quando)}</td><td><strong>{r.cliente}</strong></td><td>{r.premio}</td>
                    <td><strong className={s.fidCodigoTabela}>{r.codigo.slice(0, 3)}-{r.codigo.slice(3)}</strong></td><td>{r.quem}</td>
                  </tr>
                ))}
                {!retiradas.length ? (
                  <tr><td colSpan={5} className={s.fidNota}>{premiosLigados ? "Nenhuma retirada ainda." : "As retiradas por código aparecem aqui quando o banco tiver a atualização FIDELIDADE-2."}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Texto do resultado da validação (o que a equipe lê antes de entregar). */
export function resultadoDoCodigo(d) {
  if (!d?.ok) return { pode: false, titulo: "Código não encontrado", detalhe: "Confira as letras com o cliente." };
  const quem = d.cliente ? `${d.cliente} (final ${d.final})` : `Cliente final ${d.final}`;
  if (d.retirado_em) return { pode: false, titulo: `Já retirado em ${quando(d.retirado_em)}`, detalhe: `${d.recompensa || d.cartao} · ${quem}` };
  if (d.vencido) return { pode: false, titulo: "Código vencido", detalhe: `Valia até ${dia(d.valido_ate)} · ${quem}` };
  return { pode: true, titulo: `${d.recompensa || "Prêmio"} para ${quem}`, detalhe: `${d.cartao} completo em ${dia(d.completo_em)} · válido até ${dia(d.valido_ate)}` };
}
