"use client";

// Produção do dia: a tela do tablet da cozinha. Mostra o que tem no estoque, o que
// já está produzido e o que precisa ser produzido hoje e amanhã. Produzir baixa
// os ingredientes e dá entrada no estoque de produção (marmitaria_produzir_preparo).
// Fica sob /estoque para herdar a mesma permissão de rota.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import AbasDaProducao from "../../../../components/marmitaria/AbasDaProducao";
import RetirarProduto from "../../../../components/marmitaria/RetirarProduto";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Secao, brl, inputCls, lerNumero, num } from "../../../../components/marmitaria/ui";
import { fetchPedidos, fetchPlanosDaCozinha, fetchPreparosDoDia, novaChave, produzirPreparo, salvarPlanoDaCozinha } from "../../../../lib/marmitaria/dados";
import { ESTOQUE_LIMPEZA, ESTOQUE_PRODUCAO, baixasDoPreparo, ehEstoqueDaMarmitaria, pedidosDaMarmitaria, planilhaDaCozinha, saldoProduzido, saldosDaMarmitaria, somarDias } from "../../../../lib/marmitaria/cozinha.mjs";
import { fatorSaldo } from "../../../../lib/marmitaria/nucleo.mjs";

const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const unTxt = (u) => (String(u).toLowerCase() === "l" ? "L" : u || "un");
const chip = (a) => `min-h-[44px] rounded-xl border px-3 text-sm font-bold ${a ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2"}`;

function Produzir({ inicial, onFechar, aoProduzir }) {
  const { base, unidadeId } = useMarmitaria();
  const hoje = hojeIso();
  const [lote] = useState(() => novaChave());
  const [fichaId, setFichaId] = useState(inicial.ficha_id || base.prePreparos[0]?.id || "");
  const [qtd, setQtd] = useState(inicial.quantidade ? String(inicial.quantidade).replace(".", ",") : "");
  const [para, setPara] = useState(inicial.para || hoje);
  const [validade, setValidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const ficha = base.prePreparos.find((f) => f.id === fichaId);
  const q = lerNumero(qtd) || 0;
  const saldos = useMemo(() => saldosDaMarmitaria(base), [base]);
  const calc = ficha && q > 0 ? baixasDoPreparo({ ficha, quantidade: q, fichas: base.fichas, insumos: base.insumos, espelho: base.espelho, saldos }) : null;
  const un = ficha?.rendimento_unidade || "un";

  async function produzir() {
    if (salvando || !calc || calc.faltas.length) return;
    const espelho = base.insumos.get(base.espelho.get(ficha.id));
    setSalvando(true); setErro(null);
    try {
      const r = await produzirPreparo({ lote_id: lote, unidade_id: unidadeId, ficha_id: ficha.id, quantidade: q, quantidade_saldo: Math.round(q * fatorSaldo(espelho) * 1000) / 1000,
        data: hoje, para_o_dia: para, validade: validade || null, custo_previsto: calc.custo,
        baixas: calc.baixas.map(({ estoque_id, insumo_id, quantidade }) => ({ estoque_id, insumo_id, quantidade })) });
      if (r.error) { setErro(r.error); return; }
      await aoProduzir();
    } finally { setSalvando(false); }
  }

  return (
    <Secao titulo="Produzir" subtitulo="Baixa os ingredientes do estoque e coloca o subproduto na produção.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Subproduto" dica={ficha?.peso_porcao_g ? `Porção de ${Number(ficha.peso_porcao_g)} g` : null}>
          <select className={inputCls} value={fichaId} onChange={(e) => setFichaId(e.target.value)}>{base.prePreparos.map((f) => <option key={f.id} value={f.id}>{f.nome_receita}</option>)}</select>
        </Campo>
        <Campo rotulo={`Quantidade produzida (${unTxt(un)})`}><CampoNumero valor={qtd} onChange={setQtd} /></Campo>
      </div>
      <p className="mb-1 mt-3 text-xs font-semibold text-hf-text-2">Para quando</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(para === hoje)} onClick={() => setPara(hoje)}>Para hoje</button>
        <button type="button" className={chip(para === somarDias(hoje, 1))} onClick={() => setPara(somarDias(hoje, 1))}>Hoje para amanhã</button>
        <input type="date" className={`${inputCls} max-w-[180px]`} value={validade} onChange={(e) => setValidade(e.target.value)} aria-label="Validade" title="Validade" />
      </div>
      {calc && (
        <div className="mt-3 text-sm text-hf-text-2">
          <p className="font-semibold text-hf-text">Sai do estoque</p>
          <ul>{calc.baixas.map((b) => <li key={b.insumo_id}>{b.nome}: {num(b.quantidadeNaUnidade)} {unTxt(b.unidade)}</li>)}</ul>
          {calc.custo > 0 && <p className="mt-1">Custo previsto: <b className="tabular-nums">{brl(calc.custo)}</b></p>}
          {calc.faltas.map((f) => <Aviso key={f} tipo="alerta" className="mt-2">{f}</Aviso>)}
        </div>
      )}
      {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" type="button" onClick={onFechar}>Cancelar</Botao>
        <Botao type="button" onClick={produzir} disabled={salvando || !calc || calc.faltas.length > 0}>{salvando ? "Produzindo…" : "Produzir e baixar do estoque"}</Botao>
      </div>
    </Secao>
  );
}

function Plano({ titulo, dia, linhas, ehAmanha, onAdicionar, onMudar, onRemover, onProduzir }) {
  const { base } = useMarmitaria();
  const [ficha, setFicha] = useState("");
  const [qtd, setQtd] = useState("");
  const f = base.prePreparos.find((x) => x.id === ficha);
  return (
    <Secao titulo={titulo}>
      {!linhas.length ? <p className="text-sm text-hf-text-2">Nada planejado.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[340px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-hf-muted"><th className="py-2 pr-2">Item</th><th className="py-2 pr-2 text-right">Precisa</th><th className="py-2 pr-2 text-right">Tem</th><th className="py-2 pr-2 text-right">Falta</th><th /></tr></thead>
            <tbody className="divide-y divide-hf-border">
              {linhas.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="py-2 pr-2">
                    <p className="font-bold text-hf-text">{l.nome}</p>
                    {ehAmanha && !l.pronto && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {[["hoje", "Adiantar hoje"], ["no_dia", "Fazer amanhã"]].map(([v, r]) => (
                          <button key={v} type="button" aria-pressed={(l.quando || "no_dia") === v} onClick={() => onMudar(dia, l.id, { quando: v })}
                            className={`min-h-[36px] rounded-lg border px-2 text-xs font-bold ${(l.quando || "no_dia") === v ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border text-hf-text-2"}`}>{r}</button>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{num(l.necessario)} {unTxt(l.unidade)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{num(l.tem)}</td>
                  <td className={`py-2 pr-2 text-right font-black tabular-nums ${l.pronto ? "text-hf-accent" : "text-hf-danger"}`}>{l.pronto ? "Pronto" : num(l.falta)}</td>
                  <td className="py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      {!l.pronto && <button type="button" onClick={() => onProduzir({ ficha_id: l.ficha_id, quantidade: l.falta, para: dia })} className="min-h-[40px] rounded-lg bg-hf-accent px-3 text-sm font-bold text-hf-accent-fg">Produzir</button>}
                      <button type="button" aria-label={`Tirar ${l.nome}`} onClick={() => onRemover(dia, l.id)} className="grid h-10 w-10 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={15} /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 grid grid-cols-[1fr_96px_auto] items-end gap-2">
        <Campo rotulo="Adicionar"><select className={inputCls} value={ficha} onChange={(e) => setFicha(e.target.value)}><option value="">Escolha…</option>{base.prePreparos.map((x) => <option key={x.id} value={x.id}>{x.nome_receita}</option>)}</select></Campo>
        <Campo rotulo={f ? `Precisa (${unTxt(f.rendimento_unidade)})` : "Precisa"}><CampoNumero valor={qtd} onChange={setQtd} /></Campo>
        <Botao variante="secundario" type="button" disabled={!f || !(lerNumero(qtd) > 0)} onClick={() => { onAdicionar(dia, f, lerNumero(qtd)); setFicha(""); setQtd(""); }}>Incluir</Botao>
      </div>
    </Secao>
  );
}

export default function CozinhaPage() {
  const { base, carregando, unidadeId, recarregar } = useMarmitaria();
  const hoje = hojeIso();
  const amanha = somarDias(hoje, 1);
  const [planos, setPlanos] = useState({});
  const [pedidos, setPedidos] = useState({ compras: [], itens: [] });
  const [feitos, setFeitos] = useState([]);
  const [produzindo, setProduzindo] = useState(null);
  const [retirando, setRetirando] = useState(null);
  const [erro, setErro] = useState(null);
  const estoques = useMemo(() => (base?.estoques || []).filter(ehEstoqueDaMarmitaria), [base]);
  const ids = estoques.map((e) => e.id).join();

  const carregarDia = async () => { const r = await fetchPreparosDoDia(unidadeId, hoje); setFeitos(r.data); };
  useEffect(() => {
    if (!unidadeId) return;
    fetchPlanosDaCozinha(unidadeId, [hoje, amanha]).then((r) => setPlanos(Object.fromEntries(r.data.map((p) => [p.data_planejada, { id: p.id, itens: p.dados_completos?.itens || [] }]))));
    carregarDia();
  }, [unidadeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (unidadeId && ids) fetchPedidos(unidadeId, estoques.map((e) => e.id)).then(setPedidos); }, [unidadeId, ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const produzido = useMemo(() => (base ? saldoProduzido(base) : new Map()), [base]);
  const itensDe = (d) => planos[d]?.itens || [];
  const planilha = useMemo(() => planilhaDaCozinha({ planoHoje: itensDe(hoje), planoAmanha: itensDe(amanha), produzido }), [planos, produzido]); // eslint-disable-line react-hooks/exhaustive-deps
  const chegando = useMemo(() => pedidosDaMarmitaria({ ...pedidos, hoje }).aguardando.filter((p) => p.situacao.urgente), [pedidos, hoje]);

  async function gravar(dia, itens) {
    const id = planos[dia]?.id || novaChave();
    setPlanos((p) => ({ ...p, [dia]: { id, itens } }));
    setErro(null);
    const r = await salvarPlanoDaCozinha({ id, unidadeId, dia, itens });
    if (r.error) setErro(r.error);
  }
  const adicionar = (dia, f, necessario) => gravar(dia, [...itensDe(dia), { id: novaChave(), ficha_id: f.id, nome: f.nome_receita, unidade: f.rendimento_unidade || "un", necessario, quando: "no_dia" }]);
  const mudar = (dia, id, campos) => gravar(dia, itensDe(dia).map((i) => (i.id === id ? { ...i, ...campos } : i)));
  const remover = (dia, id) => gravar(dia, itensDe(dia).filter((i) => i.id !== id));

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando cozinha…</p></Cartao> : null;
  const semProducao = !estoques.some((e) => e.slug === ESTOQUE_PRODUCAO);
  const comSaldo = base.itensEstoque.filter((i) => estoques.some((e) => e.id === i.estoque_id && ![ESTOQUE_PRODUCAO, ESTOQUE_LIMPEZA].includes(e.slug))).map((i) => {
    const ins = base.insumos.get(i.insumo_id);
    return { id: i.id, estoque_id: i.estoque_id, ins, saldo: (Number(i.quantidade_atual) || 0) / fatorSaldo(ins) };
  }).filter((i) => i.ins).sort((a, b) => String(a.ins.nome).localeCompare(String(b.ins.nome), "pt-BR"));
  const feitosHoje = (fichaId) => feitos.filter((l) => l.ficha_id === fichaId).reduce((t, l) => t + (Number(l.quantidade_produzida) || 0), 0);

  return (
    <div className="space-y-4">
      <AbasDaProducao ativa="hoje" />
      {semProducao && <Aviso tipo="alerta">O banco ainda não recebeu a atualização da produção (MARM-PROD-1). Até lá, dá para planejar, mas não para produzir.</Aviso>}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      {chegando.length > 0 && (
        <Link href="/dashboard/marmitaria/estoque/compras" className="flex min-h-[52px] items-center gap-3 rounded-2xl border-2 border-hf-warning bg-hf-surface p-3">
          <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true"><span className="absolute inline-flex h-full w-full rounded-full bg-hf-warning opacity-75 motion-safe:animate-ping" /><span className="relative inline-flex h-3 w-3 rounded-full bg-hf-warning" /></span>
          <span className="text-sm font-bold text-hf-text">{chegando.length} pedido(s) para chegar: {chegando.flatMap((p) => p.itens.map((i) => i.descricao_snapshot)).join(", ")}</span>
        </Link>
      )}
      {produzindo && <Produzir key={`${produzindo.ficha_id}-${produzindo.para}`} inicial={produzindo} onFechar={() => setProduzindo(null)} aoProduzir={async () => { setProduzindo(null); await Promise.all([recarregar(), carregarDia()]); }} />}
      {retirando && <RetirarProduto key={retirando.id} item={retirando} onFechar={() => setRetirando(null)} />}
      {!produzindo && !semProducao && <div className="flex justify-end"><Botao type="button" disabled={!base.prePreparos.length} onClick={() => setProduzindo({ para: hoje })}>Nova produção</Botao></div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Plano titulo="Produzir hoje" dia={hoje} linhas={planilha.hoje} onAdicionar={adicionar} onMudar={mudar} onRemover={remover} onProduzir={setProduzindo} />
        <Plano titulo="Produzir para amanhã" dia={amanha} ehAmanha linhas={planilha.amanha} onAdicionar={adicionar} onMudar={mudar} onRemover={remover} onProduzir={setProduzindo} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="O que temos produzido" subtitulo="Estoque de produção da marmitaria.">
          {!produzido.size ? <p className="text-sm text-hf-text-2">Nada produzido.</p> : (
            <ul className="divide-y divide-hf-border">
              {[...produzido.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map((p) => (
                <li key={p.fichaId} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0"><span className="block text-sm font-bold text-hf-text">{p.nome}</span>{feitosHoje(p.fichaId) > 0 && <span className="block text-xs text-hf-muted">Feito hoje: {num(feitosHoje(p.fichaId))} {unTxt(p.unidade)}</span>}</span>
                  <span className="shrink-0 text-sm font-black tabular-nums text-hf-text">{num(p.quantidade)} {unTxt(p.unidade)}</span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
        <Secao titulo="O que temos no estoque" subtitulo="O que foi comprado e ainda não saiu.">
          {!comSaldo.length ? <p className="text-sm text-hf-text-2">Estoque vazio.</p> : (
            <ul className="divide-y divide-hf-border">
              {comSaldo.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 text-sm font-bold text-hf-text">{i.ins.nome}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className={`text-sm font-black tabular-nums ${i.saldo > 0 ? "text-hf-text" : "text-hf-danger"}`}>{num(i.saldo)} {unTxt(i.ins.unidade_medida)}</span>
                    {i.saldo > 0 && <button type="button" onClick={() => setRetirando(i)} className="min-h-[40px] text-sm font-bold text-hf-accent hover:underline">Retirar</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  );
}
