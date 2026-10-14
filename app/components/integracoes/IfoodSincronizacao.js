"use client";

// Depois da conexão: como os pedidos do iFood chegam e o que fazer quando
// algo falha. Tudo numa caixa só, logo abaixo do cadastro do iFood:
//   - situação (última busca, pendentes, falhas) + "Buscar pedidos agora";
//   - reprocessar falhas (seguro: gravar de novo não duplica);
//   - onde baixa o estoque (na produção — padrão — ou a cada pedido);
//   - itens do cardápio do iFood → marmita;
//   - histórico dos últimos eventos.

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { chamarApi, fetchPedidos, fetchMapeamento, salvarMapeamento, MSG_MIGRACAO_IFOOD } from "../../lib/ifood/dados";
import { itensVistos, ROTULO_STATUS, STATUS_DO_EVENTO } from "../../lib/ifood/nucleo.mjs";

const ROTA = "/api/ifood/sincronizacao";
const btn = "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-4 text-sm font-bold text-hf-text hover:bg-hf-elevated disabled:opacity-50";
const sel = "w-full min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none focus:border-hf-accent";
const quando = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "nunca");
const ROTULO_EVENTO = { RECEBIDO: "Na fila", ERRO_PROCESSAMENTO: "Tentando de novo", FALHA: "Falhou", PROCESSADO: "Processado", IGNORADO: "Ignorado", QUARANTINED_INVALID_EVENT: "Inválido" };

export default function IfoodSincronizacao({ unidadeId, marmitas = [] }) {
  const [info, setInfo] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [mapa, setMapa] = useState(new Map());
  const [ocupado, setOcupado] = useState(null);
  const [msg, setMsg] = useState(null);

  const carregar = useCallback(async () => {
    if (!unidadeId) return;
    const de = new Date(Date.now() - 60 * 86_400_000).toLocaleDateString("sv-SE");
    const [r, p, m] = await Promise.all([chamarApi(ROTA, "GET", null, unidadeId), fetchPedidos(unidadeId, de), fetchMapeamento(unidadeId)]);
    setInfo(r); setPedidos(p.data || []); setMapa(m.data || new Map());
    if (p.migracaoPendente) setMsg({ ok: false, texto: MSG_MIGRACAO_IFOOD });
  }, [unidadeId]);
  useEffect(() => { carregar(); }, [carregar]);

  const itens = useMemo(() => {
    const vistos = itensVistos(pedidos);
    for (const [codigo, m] of mapa) if (!vistos.some((v) => v.codigo === codigo)) vistos.push({ codigo, nome: m.nome_externo || codigo, vezes: 0 });
    return vistos;
  }, [pedidos, mapa]);
  const semMarmita = itens.filter((i) => !mapa.has(i.codigo)).length;

  async function acao(nome, corpo = {}) {
    if (ocupado) return;
    setOcupado(nome); setMsg(null);
    try {
      const r = await chamarApi(ROTA, "POST", { acao: nome, ...corpo }, unidadeId);
      if (!r.ok) setMsg({ ok: false, texto: r.erro || "Não foi possível concluir." });
      else if (nome === "sincronizar") setMsg({ ok: true, texto: `${r.recebidos || 0} evento(s) recebido(s), ${r.fila?.pedidos || 0} pedido(s) atualizado(s)${r.fila?.tentarDepois ? `, ${r.fila.tentarDepois} para tentar de novo` : ""}.` });
      else if (nome === "reprocessar") setMsg({ ok: true, texto: "Falhas devolvidas à fila. Toque em Buscar pedidos agora para processar." });
      await carregar();
    } finally { setOcupado(null); }
  }

  async function associar(item, escolha) {
    setMsg(null);
    const r = await salvarMapeamento(unidadeId, { codigo: item.codigo, nome: item.nome, escolha });
    if (r.error) setMsg({ ok: false, texto: r.error });
    await carregar();
  }

  if (!unidadeId || !info) return null;
  if (!info.ok) return <p className="rounded-xl bg-hf-elevated/60 p-3 text-sm text-hf-text-2">{info.erro}</p>;
  const c = info.contagem || {};

  return (
    <div className="mt-5 space-y-4 border-t border-hf-border pt-4">
      <div>
        <h3 className="text-sm font-bold text-hf-text">Pedidos do iFood</h3>
        <p className="mt-0.5 text-xs text-hf-muted">
          O Héfisto só acompanha os pedidos: quem aceita, prepara e despacha continua sendo o seu sistema da loja. {info.conectado ? "" : "Conecte a loja acima para os pedidos começarem a chegar."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-hf-text-2">
        <span>Última busca: <b className="text-hf-text">{quando(info.ultimaSincronizacao)}</b></span>
        {c.pendentes + c.tentando > 0 && <span>{c.pendentes + c.tentando} na fila</span>}
        {c.falhas > 0 && <span className="font-semibold text-hf-danger">{c.falhas} com falha</span>}
        {semMarmita > 0 && <span className="font-semibold text-hf-warning">{semMarmita} item(ns) sem marmita</span>}
      </div>
      {info.ultimoErro && <p className="rounded-xl bg-hf-danger/5 p-3 text-sm text-hf-danger">{info.ultimoErro}</p>}
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-hf-accent/10 text-hf-text" : "bg-hf-danger/5 text-hf-danger"}`}>{msg.texto}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={!!ocupado || !info.conectado} onClick={() => acao("sincronizar")}><RefreshCw size={15} className={ocupado === "sincronizar" ? "animate-spin" : ""} /> {ocupado === "sincronizar" ? "Buscando…" : "Buscar pedidos agora"}</button>
        {c.falhas > 0 && <button type="button" className={btn} disabled={!!ocupado} onClick={() => acao("reprocessar")}><RotateCcw size={15} /> Reprocessar falhas</button>}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-semibold text-hf-text-2">Baixa de estoque das marmitas vendidas</legend>
        {[["producao", "Na produção (recomendado)", "O estoque sai quando você registra a produção do lote. Os pedidos não baixam nada (evita baixar duas vezes)."],
          ["pedido", "A cada pedido", "Para quem monta a marmita na hora: em Estoque e Produção → Pedidos do iFood, o botão baixa a ficha técnica de cada pedido. Não registre produção dessas marmitas."]].map(([v, rot, dica]) => (
          <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${info.baixaEstoque === v ? "border-hf-accent bg-hf-accent/5" : "border-hf-border"}`}>
            <input type="radio" name="baixa-ifood" className="mt-1 h-4 w-4 accent-[rgb(var(--hf-accent))]" checked={info.baixaEstoque === v} disabled={!!ocupado}
              onChange={() => acao("preferencias", { baixaEstoque: v })} />
            <span><span className="block text-sm font-semibold text-hf-text">{rot}</span><span className="block text-xs text-hf-muted">{dica}</span></span>
          </label>
        ))}
      </fieldset>

      <div>
        <p className="mb-2 text-xs font-semibold text-hf-text-2">Itens do cardápio do iFood → marmita</p>
        {itens.length ? (
          <div className="divide-y divide-hf-border rounded-xl border border-hf-border">
            {itens.map((it) => {
              const m = mapa.get(it.codigo);
              const valor = m?.ignorar ? "ignorar" : m?.ficha_id || "";
              return (
                <div key={it.codigo} className="grid gap-2 p-3 sm:grid-cols-[1fr_minmax(0,280px)] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-hf-text">{it.nome}</p>
                    <p className="text-xs text-hf-muted">Código {it.codigo}{it.vezes ? ` · ${it.vezes} vendido(s) em 60 dias` : ""}</p>
                  </div>
                  <select className={`${sel} ${!m ? "border-hf-warning" : ""}`} value={valor} onChange={(e) => associar(it, e.target.value)} aria-label={`Marmita de ${it.nome}`}>
                    <option value="">Escolha a marmita…</option>
                    {marmitas.map((f) => <option key={f.id} value={f.id}>{f.nome_receita}</option>)}
                    <option value="ignorar">Não é marmita (bebida, adicional…)</option>
                  </select>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-hf-muted">Os itens aparecem aqui quando o primeiro pedido chegar.</p>}
      </div>

      {info.historico?.length > 0 && (
        <details className="rounded-xl border border-hf-border p-3">
          <summary className="cursor-pointer text-sm font-semibold text-hf-text">Histórico de eventos ({info.historico.length})</summary>
          <ul className="mt-2 divide-y divide-hf-border text-sm">
            {info.historico.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                <span className="tabular-nums text-xs text-hf-muted">{quando(e.em)}</span>
                <span className="font-semibold text-hf-text">{ROTULO_STATUS[STATUS_DO_EVENTO[e.codigo]] || e.codigo}</span>
                {e.pedido && <span className="font-mono text-xs text-hf-muted">pedido {e.pedido}</span>}
                <span className={`text-xs font-bold ${e.status === "FALHA" ? "text-hf-danger" : e.status === "PROCESSADO" ? "text-hf-accent" : "text-hf-text-2"}`}>{ROTULO_EVENTO[e.status] || e.status}{e.tentativas > 1 ? ` (${e.tentativas}×)` : ""}</span>
                {e.erro && <span className="w-full text-xs text-hf-muted">{e.erro}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
