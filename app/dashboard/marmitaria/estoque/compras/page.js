"use client";

// Compras da marmitaria: gerar o pedido com a data de chegada, conferir o que
// chegou e lançar no estoque. Exclusivo da marmitaria. Fica sob /estoque para
// herdar a mesma permissão de rota.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { ehEmbalagem } from "../../../../components/marmitaria/BuscaItens";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Secao, brl, inputCls, lerNumero, num } from "../../../../components/marmitaria/ui";
import { ESTOQUE_EMBALAGENS, ESTOQUE_MARMITARIA, criarPedido, fetchPedidos, novaChave, receberPedido } from "../../../../lib/marmitaria/dados";
import { ESTOQUE_LIMPEZA, conferencia, ehEstoqueDaMarmitaria, ehLimpeza, pedidosDaMarmitaria, somarDias } from "../../../../lib/marmitaria/cozinha.mjs";
import { custoUnitarioEfetivoInsumo } from "../../../../lib/ficha-calculos.mjs";
import { casaBusca } from "../../../../lib/busca.mjs";

const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const texto = (v) => (v === null || v === undefined ? "" : String(Math.round(Number(v) * 1000) / 1000).replace(".", ","));
const chip = (a) => `min-h-[44px] rounded-xl border px-4 text-sm font-bold ${a ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2"}`;
const COR_CONFERENCIA = { igual: "text-hf-accent", mais: "text-hf-warning", menos: "text-hf-danger" };

function NovoPedido({ estoques, aoCriar }) {
  const { base, unidadeId } = useMarmitaria();
  const hoje = hojeIso();
  const [chave, setChave] = useState(() => novaChave());
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState([]);
  const [chegada, setChegada] = useState(somarDias(hoje, 1));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const achados = useMemo(() => (busca.trim() ? base.insumosLista.filter((i) => !i.ficha_tecnica_id && casaBusca(i.nome, busca) && !itens.some((x) => x.insumo.id === i.id)).slice(0, 8) : []), [busca, base, itens]);
  const mudar = (id, campos) => setItens((l) => l.map((i) => (i.insumo.id === id ? { ...i, ...campos } : i)));
  const slugDe = (ins) => (ehEmbalagem(ins) ? ESTOQUE_EMBALAGENS : ehLimpeza(ins) ? ESTOQUE_LIMPEZA : ESTOQUE_MARMITARIA);
  const estoqueDe = (ins) => estoques.find((e) => e.slug === slugDe(ins))?.id;

  async function gerar() {
    if (salvando) return;
    if (!itens.length) return setErro("Escolha pelo menos um produto.");
    const linhas = itens.map((i) => ({ insumo: i.insumo, quantidade: lerNumero(i.qtd), valor: lerNumero(i.valor), estoque_id: estoqueDe(i.insumo) }));
    if (linhas.some((l) => !(l.quantidade > 0))) return setErro("Informe a quantidade de cada produto.");
    if (linhas.some((l) => l.valor === "")) return setErro("Informe o valor de cada produto.");
    if (linhas.some((l) => !l.estoque_id)) return setErro("Esse estoque ainda não foi ativado. Ative em Estoque.");
    setSalvando(true); setErro(null);
    try {
      const r = await criarPedido({ unidadeId, itens: linhas, chegada, hoje, chave });
      if (r.error) { setErro(r.error); return; }
      setItens([]); setChave(novaChave());
      await aoCriar();
    } finally { setSalvando(false); }
  }

  return (
    <Secao titulo="Gerar pedido" subtitulo="Escolha o produto, a quantidade e quando deve chegar.">
      <input className={inputCls} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto (frango, marmitex, detergente…)" aria-label="Buscar produto" />
      {achados.length > 0 && (
        <ul className="mt-1 max-h-64 divide-y divide-hf-border overflow-y-auto rounded-xl border border-hf-border">
          {achados.map((i) => (
            <li key={i.id}><button type="button" className="flex min-h-[48px] w-full items-center gap-2 px-3 text-left text-sm font-semibold text-hf-text hover:bg-hf-elevated"
              onClick={() => { setItens((l) => [...l, { insumo: i, qtd: "", valor: "" }]); setBusca(""); }}><Plus size={15} /> {i.nome}</button></li>
          ))}
        </ul>
      )}
      {itens.length > 0 && (
        <ul className="mt-3 divide-y divide-hf-border">
          {itens.map((i) => {
            const un = String(i.insumo.unidade_medida || "un").toLowerCase();
            const q = lerNumero(i.qtd); const c = custoUnitarioEfetivoInsumo(i.insumo);
            return (
              <li key={i.insumo.id} className="grid grid-cols-[1fr_1fr_44px] items-end gap-2 py-2">
                <p className="col-span-3 text-sm font-bold text-hf-text">{i.insumo.nome}</p>
                <Campo rotulo={`Quantidade (${un})`}><CampoNumero valor={i.qtd} onChange={(v) => { const nq = lerNumero(v); mudar(i.insumo.id, { qtd: v, valor: !i.mexeuValor && nq > 0 && c > 0 ? texto(Math.round(nq * c * 100) / 100) : i.valor }); }} /></Campo>
                <Campo rotulo="Valor total (R$)" dica={c > 0 && q > 0 ? `Último custo: ${brl(c)}/${un}` : "Sem custo cadastrado"}><CampoNumero valor={i.valor} onChange={(v) => mudar(i.insumo.id, { valor: v, mexeuValor: true })} /></Campo>
                <button type="button" aria-label={`Tirar ${i.insumo.nome}`} onClick={() => setItens((l) => l.filter((x) => x.insumo.id !== i.insumo.id))} className="mb-5 grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mb-1 mt-3 text-xs font-semibold text-hf-text-2">Quando deve chegar</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={chip(chegada === hoje)} onClick={() => setChegada(hoje)}>Hoje</button>
        <button type="button" className={chip(chegada === somarDias(hoje, 1))} onClick={() => setChegada(somarDias(hoje, 1))}>Amanhã</button>
        <input type="date" min={hoje} className={`${inputCls} max-w-[180px]`} value={chegada} onChange={(e) => e.target.value && setChegada(e.target.value)} aria-label="Data de chegada" />
      </div>
      {erro && <Aviso tipo="alerta" className="mt-3">{erro}</Aviso>}
      <Botao className="mt-3" type="button" onClick={gerar} disabled={salvando}>{salvando ? "Gerando…" : "Gerar pedido"}</Botao>
    </Secao>
  );
}

function Receber({ pedido, aoReceber }) {
  const { base, unidadeId } = useMarmitaria();
  const [linhas, setLinhas] = useState(() => pedido.itens.map((item) => ({
    item, insumo: base.insumos.get(item.insumo_id), pedida: Number(item.quantidade_pedida_embalagens ?? item.quantidade_embalagens) || 0, qtd: "", valor: texto(item.valor_total), validade: "",
  })));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const mudar = (id, campos) => setLinhas((l) => l.map((x) => (x.item.id === id ? { ...x, ...campos } : x)));

  async function lancar() {
    if (salvando) return;
    if (linhas.some((l) => String(l.qtd).trim() === "")) return setErro("Informe o que chegou de cada produto. Se não chegou, coloque 0.");
    setSalvando(true); setErro(null);
    try {
      const r = await receberPedido({ unidadeId, compra: pedido, hoje: hojeIso(), linhas: linhas.map((l) => ({ ...l, recebida: lerNumero(l.qtd), valor: lerNumero(l.valor) || 0 })) });
      if (r.error) { setErro(r.error); return; }
      await aoReceber();
    } finally { setSalvando(false); }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-hf-border pt-3">
      {linhas.map((l) => {
        const un = String(l.insumo?.unidade_medida || "un").toLowerCase();
        const c = conferencia(l.pedida, lerNumero(l.qtd));
        return (
          <div key={l.item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-hf-text">{l.item.descricao_snapshot}</p>
              <button type="button" onClick={() => mudar(l.item.id, { qtd: texto(l.pedida) })} className="min-h-[36px] text-sm font-bold text-hf-accent hover:underline">Igual ao pedido</button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Campo rotulo={`Chegou (pedido: ${num(l.pedida)} ${un})`}><CampoNumero valor={l.qtd} onChange={(v) => mudar(l.item.id, { qtd: v })} placeholder="0" /></Campo>
              <Campo rotulo="Valor cobrado (R$)"><CampoNumero valor={l.valor} onChange={(v) => mudar(l.item.id, { valor: v })} /></Campo>
              <Campo rotulo="Validade" className="col-span-2 sm:col-span-1"><input type="date" className={inputCls} value={l.validade} onChange={(e) => mudar(l.item.id, { validade: e.target.value })} /></Campo>
            </div>
            {c && <p className={`mt-1 text-sm font-bold ${COR_CONFERENCIA[c.id]}`}>{c.id === "igual" ? "Quantidade igual ao pedido" : `${num(Math.abs(c.diferenca))} ${un} a ${c.id === "mais" ? "mais" : "menos"}`}</p>}
          </div>
        );
      })}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <Botao type="button" onClick={lancar} disabled={salvando}>{salvando ? "Lançando…" : "Lançar no estoque"}</Botao>
    </div>
  );
}

export default function ComprasPage() {
  const { base, carregando, unidadeId, recarregar } = useMarmitaria();
  const [dados, setDados] = useState({ compras: [], itens: [] });
  const [aberto, setAberto] = useState(null);
  const estoques = useMemo(() => (base?.estoques || []).filter(ehEstoqueDaMarmitaria), [base]);
  const ids = estoques.map((e) => e.id).join();
  const carregar = async () => setDados(await fetchPedidos(unidadeId, estoques.map((e) => e.id)));
  useEffect(() => { if (unidadeId && ids) carregar(); }, [unidadeId, ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const { aguardando, recebidos } = useMemo(() => pedidosDaMarmitaria({ ...dados, hoje: hojeIso() }), [dados]);

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando compras…</p></Cartao> : null;
  if (!estoques.length) return <Aviso tipo="alerta">Ative o estoque da marmitaria na área Estoque para começar a comprar.</Aviso>;

  return (
    <div className="space-y-4">
      {dados.error && <Aviso tipo="alerta">{dados.error}</Aviso>}
      <Secao titulo="Aguardando chegada" subtitulo="Quando chegar, confira a quantidade e lance no estoque.">
        {!aguardando.length ? <p className="text-sm text-hf-text-2">Nenhum pedido aguardando.</p> : (
          <ul className="space-y-3">
            {aguardando.map((p) => (
              <li key={p.id} className={`rounded-2xl border-2 p-3 ${p.situacao.urgente ? "border-hf-warning" : "border-hf-border"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="relative flex h-3 w-3" aria-hidden="true">
                    <span className={`absolute inline-flex h-full w-full rounded-full bg-hf-warning opacity-75 ${p.situacao.urgente ? "motion-safe:animate-ping" : "motion-safe:animate-pulse"}`} />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-hf-warning" />
                  </span>
                  <p className="text-sm font-black text-hf-text">{p.situacao.rotulo}</p>
                  <button type="button" aria-expanded={aberto === p.id} onClick={() => setAberto(aberto === p.id ? null : p.id)} className="ml-auto min-h-[44px] rounded-xl bg-hf-accent px-4 text-sm font-bold text-hf-accent-fg">Chegou</button>
                </div>
                <p className="mt-1 text-sm text-hf-text-2">{p.itens.map((i) => `${i.descricao_snapshot} (${num(i.quantidade_pedida_embalagens ?? i.quantidade_embalagens)} ${String(base.insumos.get(i.insumo_id)?.unidade_medida || "un").toLowerCase()})`).join(" · ")}</p>
                {aberto === p.id && <Receber pedido={p} aoReceber={async () => { setAberto(null); await Promise.all([carregar(), recarregar()]); }} />}
              </li>
            ))}
          </ul>
        )}
      </Secao>
      <NovoPedido estoques={estoques} aoCriar={carregar} />
      {recebidos.length > 0 && (
        <Secao titulo="Recebidos">
          <ul className="divide-y divide-hf-border">
            {recebidos.slice(0, 15).map((p) => (
              <li key={p.id} className="py-2 text-sm text-hf-text-2">
                <b className="text-hf-text">{String(p.data_recebimento || "").split("-").reverse().join("/")}</b>: {p.itens.map((i) => {
                  const c = conferencia(i.quantidade_pedida_embalagens, i.quantidade_embalagens);
                  return `${i.descricao_snapshot} ${num(i.quantidade_embalagens)}${c && c.id !== "igual" ? ` (${c.diferenca > 0 ? "+" : ""}${num(c.diferenca)})` : ""}`;
                }).join(" · ")}
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </div>
  );
}
