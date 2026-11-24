"use client";

// Concorrentes do delivery (pedido do dono, 17/11/2026): os cardápios que o
// Jhon leu dos prints (o que vem em cada prato, peso, preço e adicionais),
// guardados com a data, e a comparação com as nossas marmitas e adicionais.
// Guardar é pela conversa com o Jhon (prévia e confirmação); aqui se consulta,
// compara e apaga uma leitura errada. Preço deles: REAL, lido do print na data.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, MessageCircle, Trash2 } from "lucide-react";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { Aviso, Botao, Cartao, Secao, Selo, brl } from "../../../components/marmitaria/ui";
import { apagarLeitura, carregarConcorrentes, carregarItens, carregarNossosAdicionais } from "../../../lib/marmitaria/concorrentes-dados";
import { TIPOS_ITEM, compararComNossas, linhasDaComparacao, linhasDosAdicionais, rotuloPlataforma, textoDaComparacao } from "../../../lib/marmitaria/concorrentes.mjs";

const PEDIDO_JHON = "/dashboard/inteligencia/assistente?q=" + encodeURIComponent("Jhon, vou te mandar o cardápio de um concorrente");
const TITULO_TIPO = { prato: "Pratos", combo: "Combos", adicional: "Adicionais", bebida: "Bebidas", sobremesa: "Sobremesas", outro: "Outros" };
const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const fold = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Nossas marmitas com o preço do app em que o concorrente está (sem o app: sem preço, nunca outro). */
function nossasNoApp(base, plataforma) {
  const rotulo = fold(rotuloPlataforma(plataforma));
  const canal = (base?.config?.canais || []).find((c) => c.ativo !== false && (fold(c.nome).includes(rotulo) || fold(c.id).includes(fold(plataforma))));
  const nossas = (base?.marmitas || []).filter((m) => m.ativo !== false).map((m) => ({
    id: m.id,
    nome: m.nome_receita || m.nome_comercial || "Marmita",
    preco: canal ? Number(m.precos?.[canal.id]) || null : null,
    peso_g: [m.peso_final_g, m.peso_porcao_g].map(Number).find((v) => v > 0) || null,
    componentes: (m.itens || []).map((it) => (it.subficha_id ? base.fichas.find((f) => f.id === it.subficha_id)?.nome_receita : base.insumos.get(it.insumo_id)?.nome)).filter(Boolean),
  }));
  return { nossas, canal };
}

function Linhas({ itens }) {
  return (
    <ul className="divide-y divide-hf-border">
      {itens.map((l, k) => (
        <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
          <span className="min-w-0 text-hf-text">{l.rotulo}</span>
          <span className="font-medium tabular-nums text-hf-text">{l.valor}</span>
        </li>
      ))}
    </ul>
  );
}

function Cardapio({ itens }) {
  const grupos = TIPOS_ITEM.map((t) => ({ t, lista: itens.filter((i) => i.tipo === t) })).filter((g) => g.lista.length);
  return (
    <div className="space-y-4">
      {grupos.map(({ t, lista }) => (
        <div key={t}>
          <p className="mb-1 text-[13px] font-medium text-hf-muted">{TITULO_TIPO[t]} ({lista.length})</p>
          <ul className="divide-y divide-hf-border">
            {lista.map((i) => (
              <li key={i.id || `${i.ordem}`} className="py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-sm font-semibold text-hf-text">
                    {i.nome}
                    {i.grupo && t === "adicional" ? <span className="font-normal text-hf-muted"> · {i.grupo}</span> : null}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-hf-text">
                    {i.preco_original ? <s className="mr-1 font-normal text-hf-muted">{brl(i.preco_original)}</s> : null}{brl(i.preco)}
                  </span>
                </div>
                {(i.componentes?.length > 0 || i.peso_g || i.serve_pessoas > 1) && (
                  <p className="mt-0.5 text-[13px] text-hf-muted">
                    {[i.componentes?.length ? i.componentes.join(", ") : null, i.peso_g ? `${Number(i.peso_g).toLocaleString("pt-BR")} g` : null, i.serve_pessoas > 1 ? `serve ${i.serve_pessoas}` : null].filter(Boolean).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Concorrente({ concorrente, leituras, base, nossosAdicionais, unidadeId, aoApagar }) {
  const [aberto, setAberto] = useState(false);
  const [leituraId, setLeituraId] = useState(leituras[0]?.id || null);
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState("comparar");
  const [apagando, setApagando] = useState(false);
  const leitura = leituras.find((l) => l.id === leituraId) || leituras[0];

  useEffect(() => {
    if (!aberto || !leitura) return;
    let vivo = true;
    setItens(null);
    carregarItens(unidadeId, leitura.id).then((r) => { if (vivo) { setItens(r.data); setErro(r.error); } });
    return () => { vivo = false; };
  }, [aberto, leitura, unidadeId]);

  const cmp = useMemo(() => {
    if (!itens || !base) return null;
    const { nossas, canal } = nossasNoApp(base, concorrente.plataforma);
    return { ...compararComNossas({ nossas, nossosAdicionais, leitura: { concorrente: concorrente.nome, plataforma: concorrente.plataforma, observado_em: leitura.observado_em, itens } }), semApp: !canal && nossas.length > 0 };
  }, [itens, base, nossosAdicionais, concorrente, leitura]);

  async function apagar() {
    if (!window.confirm(`Apagar o cardápio da ${concorrente.nome} visto em ${dataBR(leitura.observado_em)}? Os outros cardápios guardados continuam.`)) return;
    setApagando(true);
    const r = await apagarLeitura(leitura.id);
    setApagando(false);
    if (r.error) setErro(r.error); else aoApagar();
  }

  return (
    <div className="min-w-0 rounded-2xl border border-hf-border bg-hf-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.04)]">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-hf-text">{concorrente.nome}</p>
          <p className="text-[13px] text-hf-muted">
            {rotuloPlataforma(concorrente.plataforma)} · último cardápio em {dataBR(leituras[0]?.observado_em)} · {leituras[0]?.qtd_itens ?? "—"} itens
            {leituras.length > 1 ? ` · ${leituras.length} leituras` : ""}
          </p>
        </div>
        {aberto ? <ChevronUp size={18} className="text-hf-muted" /> : <ChevronDown size={18} className="text-hf-muted" />}
      </button>
      {aberto && (
        <div className="border-t border-hf-border px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {leituras.length > 1 && (
              <select value={leitura.id} onChange={(e) => setLeituraId(e.target.value)} aria-label="Data do cardápio"
                className="min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text">
                {leituras.map((l) => <option key={l.id} value={l.id}>Visto em {dataBR(l.observado_em)} ({l.qtd_itens} itens)</option>)}
              </select>
            )}
            {[["comparar", "Comparação"], ["cardapio", "Cardápio deles"]].map(([id, rotulo]) => (
              <button key={id} type="button" onClick={() => setAba(id)}
                className={`min-h-[44px] rounded-full px-4 text-sm font-medium ${aba === id ? "bg-hf-menu text-white" : "bg-hf-elevated text-hf-text"}`}>{rotulo}</button>
            ))}
            <span className="ml-auto"><Selo natureza="real" /></span>
          </div>
          {(leitura.taxa_entrega != null || leitura.pedido_minimo != null || leitura.tempo_entrega || leitura.avaliacao != null) && (
            <p className="mb-3 text-[13px] text-hf-muted">
              {[leitura.taxa_entrega != null ? `Taxa de entrega ${Number(leitura.taxa_entrega) === 0 ? "grátis" : brl(leitura.taxa_entrega)}` : null,
                leitura.pedido_minimo != null ? `pedido mínimo ${brl(leitura.pedido_minimo)}` : null,
                leitura.tempo_entrega ? `entrega ${leitura.tempo_entrega}` : null,
                leitura.avaliacao != null ? `nota ${Number(leitura.avaliacao).toLocaleString("pt-BR")}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
          {erro && <Aviso tipo="alerta" className="mb-3">{erro}</Aviso>}
          {!itens ? <p className="text-sm text-hf-muted">Carregando o cardápio…</p> : aba === "cardapio" ? <Cardapio itens={itens} /> : cmp && (
            <div className="space-y-4">
              <p className="text-sm text-hf-text">{textoDaComparacao(cmp)}</p>
              {cmp.semApp && (
                <Aviso tipo="alerta">DADOS INSUFICIENTES do nosso preço no {rotuloPlataforma(concorrente.plataforma)}: esse app não está em Custos e apps da marmitaria, então o valor das nossas não é comparado.</Aviso>
              )}
              {cmp.pares.length > 0 && (
                <div>
                  <p className="mb-1 text-[13px] font-medium text-hf-muted">Nossas marmitas × {concorrente.nome}</p>
                  <Linhas itens={linhasDaComparacao(cmp)} />
                </div>
              )}
              {cmp.semPar.length > 0 && (
                <div>
                  <p className="mb-1 text-[13px] font-medium text-hf-muted">Pratos deles sem parecido aqui</p>
                  <Linhas itens={cmp.semPar.map((i) => ({ rotulo: i.nome, valor: brl(i.preco) }))} />
                </div>
              )}
              {(cmp.adicionais || cmp.adicionaisDeles.length > 0) && (
                <div>
                  <p className="mb-1 text-[13px] font-medium text-hf-muted">Adicionais{cmp.adicionais ? ": deles × nossos" : " deles"}</p>
                  <Linhas itens={linhasDosAdicionais(cmp)} />
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Botao type="button" variante="secundario" onClick={apagar} disabled={apagando}><Trash2 size={16} /> {apagando ? "Apagando…" : "Apagar este cardápio"}</Botao>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConcorrentesPage() {
  const { base, unidadeId } = useMarmitaria();
  const [dados, setDados] = useState(null);
  const [nossosAdicionais, setNossosAdicionais] = useState(null);

  const recarregar = useCallback(async () => {
    if (!unidadeId) return;
    const [c, a] = await Promise.all([carregarConcorrentes(unidadeId), carregarNossosAdicionais(unidadeId)]);
    setDados(c);
    setNossosAdicionais(a.data);
  }, [unidadeId]);
  useEffect(() => { recarregar(); }, [recarregar]);

  const grupos = useMemo(() => {
    if (!dados) return [];
    return dados.concorrentes
      .map((c) => ({ c, leituras: dados.leituras.filter((l) => l.concorrente_id === c.id) }))
      .filter((g) => g.leituras.length)
      .sort((a, b) => String(b.leituras[0].observado_em).localeCompare(String(a.leituras[0].observado_em)));
  }, [dados]);

  return (
    <Secao titulo="Concorrentes do delivery"
      subtitulo="Cardápios dos concorrentes lidos pelo Jhon: o que vem em cada prato, o preço e os adicionais, comparados com as nossas marmitas."
      direita={<Link href={PEDIDO_JHON} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-hf-menu px-4 text-sm font-semibold text-white"><MessageCircle size={16} /> Mandar cardápio ao Jhon</Link>}>
      {!dados ? <Cartao><p className="text-sm text-hf-muted">Carregando…</p></Cartao>
        : dados.error ? <Aviso tipo="alerta">{dados.error}</Aviso>
          : !grupos.length ? (
            <Cartao>
              <p className="text-sm font-semibold text-hf-text">DADOS INSUFICIENTES: nenhum cardápio de concorrente guardado ainda.</p>
              <p className="mt-1 text-sm text-hf-muted">Na conversa com o Jhon, toque no + e escolha &quot;Cardápio de concorrente&quot;. Mande até 6 prints com o nome do restaurante, os pratos com descrição e preço e a tela dos adicionais. Ele mostra o que leu para você conferir antes de guardar.</p>
            </Cartao>
          ) : (
            <div className="space-y-3">
              {!nossosAdicionais && <Aviso tipo="info">Os nossos adicionais vêm do grupo de adicionais do Cardápio digital. Sem ele cadastrado, mostro só os adicionais dos concorrentes.</Aviso>}
              {grupos.map((g) => (
                <Concorrente key={g.c.id} concorrente={g.c} leituras={g.leituras} base={base} nossosAdicionais={nossosAdicionais} unidadeId={unidadeId} aoApagar={recarregar} />
              ))}
            </div>
          )}
    </Secao>
  );
}
