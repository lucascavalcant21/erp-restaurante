"use client";

// Fidelidade no balcão: a equipe busca o cliente pelo WhatsApp e vê os selos
// de cada cartão, o cashback e o histórico; entrega o prêmio, usa o cashback
// numa compra do balcão e lança selo de compra feita fora do cardápio (com
// motivo). Tudo grava pelo banco (FIDELIDADE-1), que confere permissão e
// saldo. Também mostra os últimos cadastros feitos pelo QR (CRM).

import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Search, Stamp, UserPlus } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { PageBody, PageHeader } from "../../../components/ui";
import { Aviso, Botao, Campo, Chip, Secao, inputCls } from "../../../components/cardapio-digital/editor/ui";
import { formatarPreco } from "../../../lib/cardapio-digital.mjs";
import { progressoDoCartao } from "../../../lib/fidelidade.mjs";
import { buscarClienteFidelidade, carregarFidelidadePainel, lancarFidelidade, resgatarSelos, usarCashbackNoBalcao } from "../../../lib/fidelidade-painel";

const ROTULO = {
  selo: "Selo ganho", selo_estorno: "Selo estornado (pedido cancelado)", selo_resgate: "Prêmio entregue", selo_ajuste: "Selo lançado no balcão/ajuste",
  selo_expira: "Selos vencidos", cashback: "Cashback ganho", cashback_estorno: "Cashback estornado (pedido cancelado)",
  cashback_uso: "Cashback usado", cashback_uso_estorno: "Cashback devolvido (pedido cancelado)", cashback_ajuste: "Cashback lançado/ajuste",
  cashback_expira: "Cashback vencido",
};
const data = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const mascara = (tel) => (String(tel || "").length === 11 ? `(${tel.slice(0, 2)}) ${tel.slice(2, 7)}-${tel.slice(7)}` : String(tel || "").length === 10 ? `(${tel.slice(0, 2)}) ${tel.slice(2, 6)}-${tel.slice(6)}` : tel);

function Bolinhas({ total, cheias }) {
  return (
    <span className="flex flex-wrap gap-1.5" role="img" aria-label={`${cheias} de ${total} selos`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-6 w-6 rounded-full border-2 ${i < cheias ? "border-hf-accent bg-hf-accent" : "border-dashed border-hf-border-strong"}`} />
      ))}
    </span>
  );
}

export default function FidelidadePainelPage() {
  const { unidadeAtiva } = useERP();
  const [base, setBase] = useState(null);
  const [tel, setTel] = useState("");
  const [cliente, setCliente] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [valorCash, setValorCash] = useState("");
  const [lanc, setLanc] = useState({ tipo: "selo", cartao: "", qtd: "1", motivo: "" });

  const carregar = useCallback(async () => {
    setBase(null);
    setCliente(null);
    setBase(await carregarFidelidadePainel(unidadeAtiva));
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);

  const buscar = async (t = tel) => {
    if (!base?.config) return;
    setBuscando(true);
    setMsg(null);
    const r = await buscarClienteFidelidade(unidadeAtiva, t, base.config);
    setBuscando(false);
    if (r.erro) { setCliente(null); setMsg({ ok: false, texto: r.erro === "sem_livro" ? "O livro da fidelidade ainda não existe no banco (APR-014)." : r.erro }); return; }
    setCliente(r);
    setLanc((l) => ({ ...l, cartao: l.cartao || base.config.cartoes[0]?.id || "" }));
  };
  const depois = async (r, texto) => {
    setOcupado("");
    if (r.erro) { setMsg({ ok: false, texto: r.erro }); return; }
    setMsg({ ok: true, texto });
    await buscar(cliente.tel);
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (<><PageHeader title="Fidelidade e cadastro" icon={Gift} /><PageBody><Aviso>Escolha uma unidade no topo.</Aviso></PageBody></>);
  }
  const cfg = base?.config;

  return (
    <>
      <PageHeader title="Fidelidade e cadastro" subtitle="Selos, cashback e clientes cadastrados pelo QR" icon={Gift} />
      <PageBody>
        <div className="mx-auto max-w-4xl space-y-4">
          {!base ? <p className="flex items-center gap-2 text-sm text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando…</p> : null}
          {base && !base.livro ? (
            <Aviso tipo="alerta">O livro da fidelidade ainda não existe no banco (migração FIDELIDADE-1, aguardando aprovação: APR-014). Até lá não há saldo para consultar nem prêmio para entregar.</Aviso>
          ) : null}
          {base && !cfg?.ativo ? <Aviso>O programa está desligado. Ligue e configure em Cardápio digital → Fidelidade.</Aviso> : null}

          <Secao titulo="Buscar cliente" subtitulo="Pelo WhatsApp que o cliente usa nos pedidos.">
            <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); buscar(); }}>
              <input className={`${inputCls} min-w-[200px] flex-1`} value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="(91) 98888-7777" aria-label="WhatsApp do cliente" />
              <Botao type="submit" disabled={buscando || !base}>{buscando ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Buscar</Botao>
            </form>
            {msg ? <Aviso tipo={msg.ok ? "info" : "alerta"} className="mt-3">{msg.texto}</Aviso> : null}
          </Secao>

          {cliente ? (
            <>
              <Secao titulo={cliente.cliente?.nome || "Cliente sem cadastro no CRM"} subtitulo={mascara(cliente.tel)}>
                <div className="flex flex-wrap gap-2 text-xs">
                  {cliente.cliente?.cadastro_em ? <span className="rounded-full bg-hf-accent/10 px-3 py-1 font-semibold text-hf-accent">Cadastrado pelo QR em {data(cliente.cliente.cadastro_em)}</span> : null}
                  {cliente.cliente?.aceita_novidades ? <span className="rounded-full bg-hf-elevated px-3 py-1 font-semibold text-hf-text-2">Aceita novidades no WhatsApp</span> : null}
                  {cliente.cliente?.aniversario ? <span className="rounded-full bg-hf-elevated px-3 py-1 font-semibold text-hf-text-2">Aniversário {String(cliente.cliente.aniversario).split("-").reverse().slice(0, 2).join("/")}</span> : null}
                </div>
              </Secao>

              {(cfg?.cartoes || []).map((c) => {
                const s = cliente.saldo.cartoes[c.id] || { selos: 0, vencidos: 0, vence_em: null };
                const p = progressoDoCartao(c, s.selos);
                return (
                  <Secao key={c.id} titulo={<span className="flex items-center gap-2"><Stamp size={18} className="text-hf-accent" /> {c.nome}</span>}
                    subtitulo={`${c.selos} selos = ${c.recompensa || "prêmio não definido"}${c.ativo ? "" : " · cartão desligado"}`}>
                    <Bolinhas total={c.selos} cheias={p.completos ? c.selos : p.no_cartao} />
                    <p className="mt-2 text-sm text-hf-text-2">
                      {s.selos} selo(s){p.completos ? ` · ${p.completos} prêmio(s) disponível(is)` : ` · faltam ${p.faltam}`}
                      {s.vence_em ? ` · vencem em ${data(s.vence_em)}` : ""}{s.vencidos ? ` · ${s.vencidos} vencido(s)` : ""}
                    </p>
                    <Botao className="mt-3" disabled={!p.completos || ocupado === c.id}
                      onClick={async () => { if (!confirm(`Entregar o prêmio "${c.recompensa}" e tirar ${c.selos} selos?`)) return; setOcupado(c.id); depois(await resgatarSelos(unidadeAtiva, cliente.tel, c.id, "Entregue no balcão"), "Prêmio entregue e selos baixados."); }}>
                      <Gift size={16} /> Entregar prêmio
                    </Botao>
                  </Secao>
                );
              })}

              <Secao titulo="Cashback" subtitulo={cfg?.cashback.ativo ? `${String(cfg.cashback.percentual).replace(".", ",")}% do que o cliente paga volta para o próximo pedido` : "Cashback desligado"}>
                <p className="text-2xl font-bold text-hf-text">{formatarPreco(cliente.saldo.cashback.saldo)}</p>
                <p className="text-xs text-hf-muted">{cliente.saldo.cashback.vence_em ? `Vence em ${data(cliente.saldo.cashback.vence_em)}` : ""}{cliente.saldo.cashback.vencido ? ` · ${formatarPreco(cliente.saldo.cashback.vencido)} vencido` : ""}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input className={`${inputCls} w-36`} inputMode="decimal" value={valorCash} onChange={(e) => setValorCash(e.target.value)} placeholder="R$ 0,00" aria-label="Valor de cashback a usar" />
                  <Botao variante="secundario" disabled={!(Number(valorCash.replace(",", ".")) > 0) || ocupado === "cash"}
                    onClick={async () => { setOcupado("cash"); const v = Math.round(Number(valorCash.replace(",", ".")) * 100) / 100; depois(await usarCashbackNoBalcao(unidadeAtiva, cliente.tel, v, "Usado no balcão"), `${formatarPreco(v)} de cashback usados.`); setValorCash(""); }}>
                    Usar no balcão
                  </Botao>
                </div>
              </Secao>

              <Secao titulo="Lançar no balcão" subtitulo="Selo de compra feita fora do cardápio, ou correção. Fica registrado quem lançou e o motivo.">
                <div className="flex flex-wrap gap-2">
                  <Chip ativo={lanc.tipo === "selo"} onClick={() => setLanc((l) => ({ ...l, tipo: "selo" }))}>Selos</Chip>
                  <Chip ativo={lanc.tipo === "cashback"} onClick={() => setLanc((l) => ({ ...l, tipo: "cashback" }))}>Cashback (R$)</Chip>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {lanc.tipo === "selo" ? (
                    <Campo rotulo="Cartão">
                      <select className={inputCls} value={lanc.cartao} onChange={(e) => setLanc((l) => ({ ...l, cartao: e.target.value }))}>
                        {(cfg?.cartoes || []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                    </Campo>
                  ) : null}
                  <Campo rotulo={lanc.tipo === "selo" ? "Selos (negativo tira)" : "Valor (negativo tira)"}>
                    <input className={inputCls} inputMode="decimal" value={lanc.qtd} onChange={(e) => setLanc((l) => ({ ...l, qtd: e.target.value }))} />
                  </Campo>
                  <Campo rotulo="Motivo">
                    <input className={inputCls} value={lanc.motivo} maxLength={200} onChange={(e) => setLanc((l) => ({ ...l, motivo: e.target.value }))} placeholder="Ex.: 2 cafés no balcão" />
                  </Campo>
                </div>
                <Botao className="mt-3" variante="secundario" disabled={ocupado === "lanc" || lanc.motivo.trim().length < 3}
                  onClick={async () => {
                    const n = Number(String(lanc.qtd).replace(",", "."));
                    setOcupado("lanc");
                    const r = await lancarFidelidade(unidadeAtiva, cliente.tel, lanc.tipo === "selo"
                      ? { cartaoId: lanc.cartao, selos: Math.round(n), motivo: lanc.motivo }
                      : { valor: Math.round(n * 100) / 100, motivo: lanc.motivo });
                    await depois(r, "Lançado.");
                    if (!r.erro) setLanc((l) => ({ ...l, qtd: "1", motivo: "" }));
                  }}>
                  Lançar
                </Botao>
              </Secao>

              <Secao titulo="Histórico" subtitulo="Do mais recente ao mais antigo.">
                {!cliente.movimentos.length ? <p className="text-sm text-hf-muted">Nada lançado ainda para este WhatsApp.</p> : (
                  <ul className="divide-y divide-hf-border">
                    {[...cliente.movimentos].reverse().slice(0, 60).map((m) => (
                      <li key={m.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-semibold text-hf-text">{ROTULO[m.tipo] || m.tipo}</span>
                          {m.cartao_id ? <span className="text-hf-muted"> · {cfg?.cartoes.find((c) => c.id === m.cartao_id)?.nome || m.cartao_id}</span> : null}
                          {m.observacao ? <span className="block text-xs text-hf-muted">{m.observacao}</span> : null}
                        </span>
                        <span className="text-right">
                          <span className={`font-bold ${(Number(m.selos) || Number(m.valor)) < 0 ? "text-hf-danger" : "text-hf-accent"}`}>
                            {m.tipo.startsWith("selo") ? `${m.selos > 0 ? "+" : ""}${m.selos} selo(s)` : `${Number(m.valor) > 0 ? "+" : "−"}${formatarPreco(Math.abs(Number(m.valor)))}`}
                          </span>
                          <span className="block text-xs text-hf-muted">{data(m.created_at)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Secao>
            </>
          ) : null}

          {base?.cadastros?.length ? (
            <Secao titulo={<span className="flex items-center gap-2"><UserPlus size={18} className="text-hf-accent" /> Últimos cadastros pelo QR</span>} subtitulo="Clientes que se cadastraram no QR do restaurante (CRM).">
              <ul className="divide-y divide-hf-border">
                {base.cadastros.map((c) => (
                  <li key={c.id}>
                    <button type="button" className="flex min-h-[48px] w-full items-center justify-between gap-2 text-left text-sm hover:bg-hf-elevated/60"
                      onClick={() => { setTel(c.tel); buscar(c.tel); }}>
                      <span className="min-w-0 truncate font-semibold text-hf-text">{c.nome}</span>
                      <span className="text-xs text-hf-muted">{mascara(c.tel)} · {data(c.cadastro_em)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Secao>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
