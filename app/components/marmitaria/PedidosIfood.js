"use client";

// Pedidos do iFood do dia para a cozinha: quanto separar de cada marmita,
// a lista dos pedidos (marcar como separado) e — só quando a unidade escolheu
// "baixa a cada pedido" — a baixa da ficha técnica no estoque.
// A baixa passa por marmitaria_baixar_pedidos → estoque_movimentar, com o
// usuário logado; reenviar não baixa de novo (versão por pedido).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, Secao, SemDados, brl, inputCls, num } from "./ui";
import { chamarApi, fetchPedidos, fetchMapeamento, marcarSeparacao, baixarPedidos } from "../../lib/ifood/dados";
import { totaisParaSeparar, consumoDoPedido, ajusteDeEstoque, ROTULO_STATUS } from "../../lib/ifood/nucleo.mjs";
import { ESTOQUE_MARMITARIA, ESTOQUE_EMBALAGENS } from "../../lib/marmitaria/dados";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");
const COR = { CANCELADO: "text-hf-danger", CONCLUIDO: "text-hf-text-2", RECEBIDO: "text-hf-warning" };

export default function PedidosIfood() {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [dia, setDia] = useState(hoje());
  const [pedidos, setPedidos] = useState(null);
  const [mapa, setMapa] = useState(new Map());
  const [baixaPorPedido, setBaixaPorPedido] = useState(false);
  const [erro, setErro] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!unidadeId) return;
    const [p, m, s] = await Promise.all([fetchPedidos(unidadeId, dia, dia), fetchMapeamento(unidadeId), chamarApi("/api/ifood/sincronizacao", "GET", null, unidadeId)]);
    setPedidos(p.data || []); setMapa(m.data || new Map()); setErro(p.error || null);
    setBaixaPorPedido(s?.ok && s.baixaEstoque === "pedido");
  }, [unidadeId, dia]);
  useEffect(() => { carregar(); }, [carregar]);

  const nomes = useMemo(() => new Map(base.marmitas.map((m) => [m.id, m.nome_receita])), [base]);
  const marmitas = useMemo(() => new Map(base.marmitas.map((m) => [m.id, m])), [base]);
  const saldos = useMemo(() => {
    const porId = new Map(base.estoques.map((e) => [e.id, e]));
    const prioridade = (e) => (e.slug === ESTOQUE_MARMITARIA || e.slug === ESTOQUE_EMBALAGENS ? 0 : 2);
    const m = new Map();
    for (const it of base.itensEstoque) {
      const e = porId.get(it.estoque_id);
      if (!e) continue;
      const l = m.get(it.insumo_id) || [];
      l.push({ estoque_id: e.id, saldo: Number(it.quantidade_atual) || 0, prioridade: prioridade(e) });
      m.set(it.insumo_id, l);
    }
    return m;
  }, [base]);

  // Baixas pendentes: pedido cujo estoque aplicado difere do que a ficha manda
  const ajustes = useMemo(() => {
    if (!baixaPorPedido || !pedidos) return [];
    return pedidos.map((p) => {
      const situacao = { status: p.status, confirmado: p.confirmado, preparoIniciado: p.preparo_iniciado };
      const c = consumoDoPedido({ pedido: p, situacao, mapeamento: mapa, marmitas, fichas: base.fichas, insumos: base.insumos, espelho: base.espelho });
      const a = ajusteDeEstoque({ aplicado: p.estoque_aplicado || {}, consumo: c.consumo, saldos });
      return { pedido: p, ...a, faltas: [...c.faltas, ...a.faltas], semMarmita: c.semMarmita };
    }).filter((a) => a.movimentos.length || a.faltas.length);
  }, [baixaPorPedido, pedidos, mapa, marmitas, base, saldos]);

  if (!pedidos) return null;
  const totais = totaisParaSeparar(pedidos, mapa, nomes);
  const ativos = pedidos.filter((p) => !p.teste);
  const prontos = ajustes.filter((a) => a.movimentos.length && !a.faltas.length);

  async function separar(p) {
    const r = await marcarSeparacao(p.id, p.separacao !== "separado");
    if (r.error) setMsg({ tipo: "alerta", texto: r.error });
    await carregar();
  }

  async function baixar() {
    if (ocupado || !prontos.length) return;
    setOcupado(true); setMsg(null);
    try {
      const r = await baixarPedidos(unidadeId, prontos.map((a) => ({
        pedido_id: a.pedido.id, versao: a.pedido.estoque_versao, aplicado: a.aplicado,
        movimentos: a.movimentos.map(({ estoque_id, insumo_id, tipo, quantidade }) => ({ estoque_id, insumo_id, tipo, quantidade })),
      })));
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      else setMsg({ tipo: "info", texto: `Estoque atualizado: ${r.data?.pedidos || 0} pedido(s), ${r.data?.movimentos || 0} movimento(s).` });
      await Promise.all([carregar(), recarregar()]);
    } finally { setOcupado(false); }
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Pedidos do iFood" subtitulo="Chegam sozinhos depois que a loja é conectada (Configurações → iFood)."
        direita={<Campo rotulo="Dia" className="w-[170px]"><input type="date" className={inputCls} value={dia} onChange={(e) => setDia(e.target.value || hoje())} /></Campo>}>
        {erro && <Aviso tipo="alerta" className="mb-3">{erro}</Aviso>}
        {!ativos.length ? <SemDados titulo="Nenhum pedido do iFood neste dia" motivo="Se a loja está conectada, use “Buscar pedidos agora” em Configurações → iFood." href="/dashboard/marmitaria/configuracoes" acao="Ir para o iFood" /> : (
          <>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-hf-muted">Separar agora</p>
            {totais.length ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {totais.map((t) => (
                  <span key={t.chave} className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 text-sm ${t.associado ? "border-hf-border bg-hf-surface" : "border-hf-warning/40 bg-hf-warning/5"}`}>
                    <b className="tabular-nums text-base">{num(t.quantidade, 0)}</b> {t.nome}{!t.associado && <span className="text-xs text-hf-warning">(sem marmita associada)</span>}
                  </span>
                ))}
              </div>
            ) : <p className="mb-4 text-sm text-hf-muted">Tudo separado.</p>}

            <ul className="divide-y divide-hf-border rounded-xl border border-hf-border">
              {ativos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start gap-3 p-3">
                  <label className="flex min-h-[44px] min-w-[44px] items-center justify-center">
                    <input type="checkbox" aria-label={`Pedido ${p.display_id} separado`} className="h-5 w-5 accent-[rgb(var(--hf-accent))]"
                      checked={p.separacao === "separado"} disabled={p.status === "CANCELADO"} onChange={() => separar(p)} />
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <b className="tabular-nums">#{p.display_id || p.pedido_externo_id.slice(0, 8)}</b>
                      <span className="ml-2 text-hf-muted">{p.agendado ? `agendado ${hora(p.agendado_para)}` : hora(p.criado_no_canal_em)}</span>
                      {p.cliente_nome && <span className="ml-2 text-hf-text-2">{p.cliente_nome}</span>}
                      <span className={`ml-2 text-xs font-bold ${COR[p.status] || "text-hf-accent"}`}>{ROTULO_STATUS[p.status]}</span>
                    </p>
                    {p.detalhes_carregados
                      ? <p className="mt-0.5 text-sm text-hf-text-2">{(p.itens || []).map((i) => `${num(i.quantidade, 0)}× ${i.nome}`).join(" · ")}</p>
                      : <p className="mt-0.5 text-xs text-hf-warning">Aguardando os detalhes do iFood.</p>}
                    {p.status === "CANCELADO" && p.cancelamento?.motivo && <p className="mt-0.5 text-xs text-hf-danger">Cancelado: {p.cancelamento.motivo}</p>}
                  </div>
                  <span className="tabular-nums text-sm font-semibold text-hf-text">{brl(p.valor_pedido)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Secao>

      {baixaPorPedido && (
        <Secao titulo="Baixa de estoque dos pedidos" subtitulo="Ficha técnica de cada pedido confirmado. Cancelado antes do preparo devolve ao estoque; depois do preparo, mantém.">
          {!ajustes.length ? <p className="text-sm text-hf-muted">Nenhuma baixa pendente neste dia.</p> : (
            <ul className="space-y-2">
              {ajustes.map((a) => (
                <li key={a.pedido.id} className="rounded-xl border border-hf-border p-3 text-sm">
                  <b>#{a.pedido.display_id}</b> · {a.movimentos.map((m) => `${m.tipo === "saida" ? "baixa" : "devolve"} ${num(m.quantidade)} de ${m.nome}`).join(" · ") || "—"}
                  {a.faltas.map((f) => <p key={f} className="mt-1 text-xs text-hf-warning">{f}</p>)}
                  {a.semMarmita.length > 0 && <p className="mt-1 text-xs text-hf-warning">Sem marmita associada: {a.semMarmita.join(", ")}.</p>}
                </li>
              ))}
            </ul>
          )}
          {msg && <Aviso tipo={msg.tipo} className="mt-3">{msg.texto}</Aviso>}
          <div className="mt-3 flex justify-end">
            <Botao onClick={baixar} disabled={ocupado || !prontos.length}>{ocupado ? "Baixando…" : `Baixar estoque (${prontos.length} pedido${prontos.length === 1 ? "" : "s"})`}</Botao>
          </div>
        </Secao>
      )}
      {!baixaPorPedido && msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
    </div>
  );
}
