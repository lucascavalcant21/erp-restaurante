"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import EditorMarmita from "../../../components/marmitaria/EditorMarmita";
import TrazerDeOutraUnidade from "../../../components/marmitaria/TrazerDeOutraUnidade";
import { Abas, Aviso, Botao, Campo, CampoNumero, Cartao, Secao, SemDados, Selo, brl, inputCls, pctTxt } from "../../../components/marmitaria/ui";
import { formDaMarmita } from "../../../lib/marmitaria/formulario.mjs";
import { resultadoPorCanal, precoSugerido } from "../../../lib/marmitaria/nucleo.mjs";
import { definirDisponibilidade } from "../../../lib/marmitaria/dados";
import { normalizarBusca } from "../../../lib/ingredientes-utils.mjs";
import { parseNumero } from "../../../lib/ficha-calculos.mjs";

function Conteudo() {
  const { base, custos, carregando, recarregar } = useMarmitaria();
  const params = useSearchParams();
  const router = useRouter();
  const [aba, setAba] = useState(params.get("aba") === "precos" ? "precos" : "cardapio");
  const [editando, setEditando] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [trazendo, setTrazendo] = useState(false);

  if (!base) return carregando ? <Cartao><p className="text-sm text-hf-muted">Carregando marmitas…</p></Cartao> : null;

  if (editando) {
    return (
      <EditorMarmita key={editando.id} form={editando}
        onFechar={() => setEditando(null)}
        onSalvo={(r) => { setEditando(null); setAviso(`Marmita salva${r?.codigo ? ` (${r.codigo})` : ""}.`); }} />
    );
  }

  const nova = () => setEditando(formDaMarmita(null, { insumos: base.insumos, fichas: base.fichas }));
  const editar = (m) => setEditando(formDaMarmita(m, { insumos: base.insumos, fichas: base.fichas }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1"><Abas abas={[{ id: "cardapio", rotulo: "Cardápio" }, { id: "precos", rotulo: "Preços por canal" }]} valor={aba} onChange={(v) => { setAba(v); router.replace(`?aba=${v}`); }} /></div>
        <Botao variante="secundario" onClick={() => setTrazendo(!trazendo)}>Trazer de outra unidade</Botao>
        <Botao onClick={nova}><Plus size={16} /> Nova marmita</Botao>
      </div>
      {trazendo && <TrazerDeOutraUnidade onFechar={() => setTrazendo(false)} />}
      {aviso && <Aviso>{aviso}</Aviso>}
      {aba === "cardapio" ? <Cardapio onEditar={editar} onNova={nova} recarregar={recarregar} /> : <PrecosPorCanal onEditar={editar} />}
    </div>
  );
}

function Cardapio({ onEditar, onNova, recarregar }) {
  const { base, custos } = useMarmitaria();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [erro, setErro] = useState(null);
  const canalPrincipal = base.config.canais.find((c) => c.ativo) || null;

  const lista = useMemo(() => {
    const t = normalizarBusca(busca);
    return base.marmitas
      .filter((m) => (filtro === "todas" ? true : filtro === "disponiveis" ? m.ativo !== false : m.ativo === false))
      .filter((m) => !t || normalizarBusca(`${m.nome_receita} ${m.codigo || ""} ${m.categoria || ""}`).includes(t));
  }, [base.marmitas, busca, filtro]);

  async function alternar(m) {
    setErro(null);
    const r = await definirDisponibilidade(m.id, m.ativo === false);
    if (r.error) setErro(r.error); else recarregar();
  }

  if (!base.marmitas.length) {
    return (
      <Secao titulo="Nenhuma marmita cadastrada">
        <p className="text-sm text-hf-text-2">Cadastre a primeira: escolha o arroz, o feijão e a proteína que você já tem no estoque, as embalagens, e veja o custo e a margem na hora.</p>
        <Botao className="mt-3" onClick={onNova}><Plus size={16} /> Cadastrar marmita</Botao>
      </Secao>
    );
  }

  return (
    <Secao>
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
          <input className={`${inputCls} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar marmita" />
        </div>
        <select className={`${inputCls} w-auto`} value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtro">
          <option value="todas">Todas</option><option value="disponiveis">No cardápio</option><option value="fora">Fora do cardápio</option>
        </select>
      </div>
      {erro && <Aviso tipo="alerta" className="mb-3">{erro}</Aviso>}
      <ul className="divide-y divide-hf-border">
        {lista.map((m) => {
          const c = custos.get(m.id);
          const preco = canalPrincipal && m.precos[canalPrincipal.id] !== undefined ? m.precos[canalPrincipal.id] : Number(m.preco_venda) || 0;
          const r = canalPrincipal && preco > 0 && c ? resultadoPorCanal({ preco, custoTecnico: c.total, canal: canalPrincipal, tributosPct: base.config.tributos_pct }) : null;
          return (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <button type="button" onClick={() => onEditar(m)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-hf-elevated">
                  {m.imagem ? <img src={m.imagem} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-hf-text">{m.nome_receita}</p>
                  <p className="text-xs text-hf-muted">{[m.codigo, m.tamanho_marmita, m.peso_final_g ? `${Number(m.peso_final_g)} g` : null, m.categoria].filter(Boolean).join(" · ")}</p>
                  {c && !c.completo && <p className="text-xs font-semibold text-hf-warning">Custo incompleto</p>}
                </div>
              </button>
              <div className="grid grid-cols-3 gap-4 text-right text-sm">
                <div><p className="text-[11px] text-hf-muted">Custo</p><p className="font-bold tabular-nums">{c ? brl(c.total) : "—"}</p></div>
                <div><p className="text-[11px] text-hf-muted">{canalPrincipal ? `Preço ${canalPrincipal.nome}` : "Preço"}</p><p className="font-bold tabular-nums">{preco > 0 ? brl(preco) : "—"}</p></div>
                <div><p className="text-[11px] text-hf-muted">Margem contrib.</p>
                  <p className={`font-bold tabular-nums ${r?.margemContribuicao < 0 ? "text-hf-danger" : ""}`}>{r?.valido && r.margemContribuicaoPct !== null ? pctTxt(r.margemContribuicaoPct) : "—"}</p></div>
              </div>
              <label className="flex min-h-[44px] items-center gap-2 text-xs font-semibold text-hf-text-2">
                <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={m.ativo !== false} onChange={() => alternar(m)} /> No cardápio
              </label>
            </li>
          );
        })}
      </ul>
      {!canalPrincipal && <Aviso className="mt-3">Configure os canais de venda em Configurações para ver a margem de cada marmita.</Aviso>}
    </Secao>
  );
}

// Simulador único de preço: escolha a marmita e o canal, mexa no preço e veja
// cada parcela. Tabela abaixo com todas as marmitas × canais.
function PrecosPorCanal({ onEditar }) {
  const { base, custos } = useMarmitaria();
  const canais = base.config.canais.filter((c) => c.ativo);
  const [sel, setSel] = useState({ marmita: base.marmitas[0]?.id || "", canal: canais[0]?.id || "", preco: "" });
  if (!base.marmitas.length) return <SemDados motivo="Cadastre uma marmita para simular o preço." />;
  if (!canais.length) return <SemDados titulo="Nenhum canal configurado" motivo="Cadastre os canais com as taxas do seu contrato." href="/dashboard/marmitaria/configuracoes" acao="Configurar canais" />;

  const m = base.marmitas.find((x) => x.id === sel.marmita) || base.marmitas[0];
  const canal = canais.find((c) => c.id === sel.canal) || canais[0];
  const c = custos.get(m.id);
  const precoAtual = m.precos[canal.id] ?? (Number(m.preco_venda) || 0);
  const preco = String(sel.preco).trim() ? parseNumero(sel.preco) : precoAtual;
  const r = resultadoPorCanal({ preco, custoTecnico: c?.total ?? null, canal, tributosPct: base.config.tributos_pct });
  const sug = precoSugerido({ custoTecnico: c?.total, canal, tributosPct: base.config.tributos_pct, margemAlvoPct: base.config.margem_alvo_pct });
  const linha = (rotulo, v, neg = true, forte = false) => (
    <div className={`flex justify-between gap-3 py-1.5 ${forte ? "border-t border-hf-border pt-2 font-bold" : ""}`}>
      <span className={forte ? "text-hf-text" : "text-hf-text-2"}>{rotulo}</span>
      <span className={`tabular-nums ${forte && v < 0 ? "text-hf-danger" : ""}`}>{v === null || v === undefined ? "—" : `${neg && v > 0 ? "− " : ""}${brl(v)}`}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <Secao titulo="Simulador de preço" subtitulo="Simulação: nada é gravado até você salvar a marmita.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Marmita"><select className={inputCls} value={m.id} onChange={(e) => setSel({ ...sel, marmita: e.target.value, preco: "" })}>{base.marmitas.map((x) => <option key={x.id} value={x.id}>{x.nome_receita}</option>)}</select></Campo>
          <Campo rotulo="Canal"><select className={inputCls} value={canal.id} onChange={(e) => setSel({ ...sel, canal: e.target.value, preco: "" })}>{canais.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></Campo>
          <Campo rotulo="Preço de venda (R$)" dica={`Hoje: ${brl(precoAtual)}`}><CampoNumero valor={sel.preco} onChange={(v) => setSel({ ...sel, preco: v })} placeholder={String(precoAtual).replace(".", ",")} /></Campo>
        </div>
        {r.valido ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="text-sm">
              {linha("Preço de venda", r.preco, false)}
              {linha("Promoção custeada pela empresa", r.promocao)}
              {linha("Tributos", r.tributos)}
              {linha("Comissão do canal", r.comissao)}
              {linha("Taxa de pagamento", r.taxaPagamento)}
              {linha("Taxa fixa por pedido", r.taxaFixa)}
              {linha("Entrega subsidiada", r.entrega)}
              {linha("Custo técnico (ficha)", r.custo)}
              {linha("Margem de contribuição", r.margemContribuicao, false, true)}
            </div>
            <div className="grid content-start gap-3">
              <Cartao><p className="text-xs text-hf-muted">Margem de contribuição</p><p className="text-2xl font-black tabular-nums">{pctTxt(r.margemContribuicaoPct)}</p><p className="text-xs text-hf-muted">da receita · não é lucro líquido</p></Cartao>
              <div className="grid grid-cols-2 gap-3">
                <Cartao><p className="text-xs text-hf-muted">CMV técnico</p><p className="text-lg font-bold tabular-nums">{pctTxt(r.cmvTecnicoPct)}</p></Cartao>
                <Cartao><p className="text-xs text-hf-muted">Markup</p><p className="text-lg font-bold tabular-nums">{r.markup !== null ? `${r.markup.toLocaleString("pt-BR")}×` : "—"}</p></Cartao>
              </div>
              <Cartao>
                <p className="text-xs text-hf-muted">Preço para {pctTxt(base.config.margem_alvo_pct, 0)} de margem</p>
                <p className="text-lg font-bold tabular-nums">{sug.preco !== null ? brl(sug.preco) : "—"}</p>
                {sug.motivo && <p className="text-xs text-hf-muted">{sug.motivo}</p>}
              </Cartao>
              {r.avisos.map((a) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}
              {c && !c.completo && <Aviso tipo="alerta">Custo incompleto: {c.pendencias.join(" ")}</Aviso>}
              <Botao variante="secundario" onClick={() => onEditar(m)}>Abrir a marmita para salvar o preço</Botao>
            </div>
          </div>
        ) : <Aviso className="mt-3">{r.motivo}</Aviso>}
      </Secao>

      <Secao titulo="Todas as marmitas por canal" subtitulo="Margem de contribuição prevista pela ficha técnica. Vermelho = vende abaixo do custo variável.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-hf-muted"><th className="py-2 pr-2">Marmita</th><th className="py-2 pr-2 text-right">Custo</th>{canais.map((x) => <th key={x.id} className="py-2 pr-2 text-right">{x.nome}</th>)}</tr></thead>
            <tbody className="divide-y divide-hf-border">
              {base.marmitas.map((mm) => {
                const cc = custos.get(mm.id);
                return (
                  <tr key={mm.id}>
                    <td className="py-2 pr-2"><button type="button" onClick={() => setSel({ marmita: mm.id, canal: sel.canal, preco: "" })} className="text-left font-semibold text-hf-text hover:text-hf-accent">{mm.nome_receita}</button></td>
                    <td className="py-2 pr-2 text-right tabular-nums">{cc ? brl(cc.total) : "—"}</td>
                    {canais.map((x) => {
                      const p = mm.precos[x.id] ?? (Number(mm.preco_venda) || 0);
                      const rr = resultadoPorCanal({ preco: p, custoTecnico: cc?.total ?? null, canal: x, tributosPct: base.config.tributos_pct });
                      return <td key={x.id} className={`py-2 pr-2 text-right tabular-nums ${rr.margemContribuicao < 0 ? "font-bold text-hf-danger" : ""}`}>{rr.valido && rr.margemContribuicao !== null ? <>{brl(p)}<br /><span className="text-xs">{pctTxt(rr.margemContribuicaoPct)}</span></> : "—"}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-hf-muted"><Selo natureza="previsto" /> Margem = preço − tributos − taxas do canal − custo técnico.</p>
      </Secao>
    </div>
  );
}

export default function MarmitasPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
