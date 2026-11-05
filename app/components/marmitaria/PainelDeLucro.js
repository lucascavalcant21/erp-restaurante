"use client";

// O que mudou de custo, o que dá mais lucro e o que combinar. Contas em
// lib/marmitaria/painel-lucro.mjs; os números são os mesmos do Cardápio.

import { useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { useCardapio } from "./useCardapio";
import { Aviso, Botao, Campo, Secao, Selo, brl, inputCls, lerNumero, markupTxt, pctTxt } from "./ui";
import { fetchVendas } from "../../lib/marmitaria/dados";
import { MODELOS_COMBO, normalizarCombo } from "../../lib/marmitaria/promocoes.mjs";
import { compararPromocoes, painelDeLucro, sugerirCombos } from "../../lib/marmitaria/painel-lucro.mjs";
import { salvarCombosMarmitaria } from "../../lib/parametros";
import { somarDiasIso } from "../../lib/cmv-real.mjs";

const chip = (ativo) => `min-h-[40px] rounded-xl border px-3 text-sm font-bold transition ${ativo ? "border-hf-accent bg-hf-accent text-hf-accent-fg" : "border-hf-border bg-hf-surface text-hf-text-2 hover:bg-hf-elevated"}`;
const dataBr = (iso) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");
const sinalPct = (v) => (v == null ? "—" : `${v > 0 ? "+" : ""}${pctTxt(v)}`);
const corLucro = (v) => (v < 0 ? "text-hf-danger" : "text-hf-text");

function Linha({ titulo, detalhe, valor, nota, negativo }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-hf-text">{titulo}</p>
        {detalhe && <p className="text-xs text-hf-muted">{detalhe}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-black tabular-nums ${negativo ? "text-hf-danger" : "text-hf-text"}`}>{valor}</p>
        {nota && <p className="text-xs tabular-nums text-hf-muted">{nota}</p>}
      </div>
    </li>
  );
}

function Destaque({ rotulo, nome, valor }) {
  return (
    <div className="min-w-0 rounded-2xl bg-hf-elevated p-3">
      <p className="text-xs font-semibold text-hf-text-2">{rotulo}</p>
      <p className="mt-1 text-lg font-black tabular-nums text-hf-text">{valor}</p>
      {nome && <p className="text-xs text-hf-text-2">{nome}</p>}
    </div>
  );
}

function MudancasDeCusto({ mudancas }) {
  return (
    <Secao titulo="Mudanças de custo" subtitulo="Últimos 30 dias, com o preço de venda igual ao de hoje.">
      {!mudancas.length ? <p className="text-sm text-hf-text-2">Nenhum custo dos seus pratos mudou nesse período.</p> : (
        <ul className="space-y-3">
          {mudancas.map((m) => {
            const Icone = m.subiu ? TrendingUp : TrendingDown;
            return (
              <li key={m.insumoId} className={`rounded-2xl border-l-4 bg-hf-elevated/60 p-3 ${m.subiu ? "border-l-hf-danger" : "border-l-hf-accent"}`}>
                <p className="flex items-start gap-2 text-sm font-bold text-hf-text">
                  <Icone size={17} className={`mt-0.5 shrink-0 ${m.subiu ? "text-hf-danger" : "text-hf-accent"}`} />
                  <span>{m.nome} {m.subiu ? "subiu" : "caiu"} de {brl(m.valorAntes)} para {brl(m.valorAgora)}{m.porUnidade ? " por unidade de medida" : ""} ({sinalPct(m.pct)})</span>
                </p>
                <p className="ml-6 text-xs text-hf-muted">{m.data ? `Em ${dataBr(m.data)}` : ""}</p>
                <ul className="ml-6 mt-2 space-y-1.5">
                  {m.pratos.map((p) => (
                    <li key={p.id} className="text-sm text-hf-text-2">
                      <b className="text-hf-text">{p.nome}</b>: custo {sinalPct(p.custoPct)} ({brl(p.custoAntes)} para {brl(p.custoDepois)})
                      {p.lucroDepois != null && <>. Lucro {p.lucroDepois < p.lucroAntes ? "caiu" : "subiu"} de {brl(p.lucroAntes)} para <b className={corLucro(p.lucroDepois)}>{brl(p.lucroDepois)}</b></>}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Secao>
  );
}

function Sugestoes({ catalogo, comum, alvoPct, combos, setCombos, unidadeId }) {
  const [modeloId, setModeloId] = useState(MODELOS_COMBO[0].id);
  const [desconto, setDesconto] = useState(10);
  const [msg, setMsg] = useState(null);
  const r = useMemo(() => sugerirCombos({ catalogo, modeloId, comum, descontoPct: desconto, alvoPct }), [catalogo, modeloId, comum, desconto, alvoPct]);
  const nomes = (c) => c.itens.map((i) => i.nome).join(" + ");

  async function usar(c) {
    const novo = normalizarCombo({ nome: nomes(c), modelo: c.modelo, itens: c.itens.map((i) => ({ grupo: i.grupo, id: i.id })), preco: String(c.preco).replace(".", ",") });
    const lista = [...combos, novo];
    setMsg(null);
    const res = await salvarCombosMarmitaria(unidadeId, lista);
    if (res?.error) { setMsg({ tipo: "alerta", texto: `Não foi possível salvar: ${res.error}` }); return; }
    setCombos(lista);
    setMsg({ tipo: "info", texto: `${novo.nome} entrou no Cardápio.` });
  }

  return (
    <Secao titulo="Sugestões de combos" subtitulo={alvoPct == null ? "Testa todas as combinações que têm preço e custo." : `Testa todas as combinações que têm preço e custo, para manter ${pctTxt(alvoPct)} de lucro.`}
      direita={<Selo natureza="simulacao" />}>
      <div className="flex flex-wrap gap-2">
        {MODELOS_COMBO.map((m) => <button key={m.id} type="button" className={chip(m.id === modeloId)} onClick={() => setModeloId(m.id)}>{m.rotulo}</button>)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-hf-text-2">Desconto sobre a soma</span>
        {[0, 5, 10, 15, 20].map((d) => <button key={d} type="button" className={chip(d === desconto)} onClick={() => setDesconto(d)}>{d}%</button>)}
      </div>
      {!r.total ? <p className="mt-3 text-sm text-hf-text-2">DADOS INSUFICIENTES: faltam itens com preço e custo para esse tipo de combo, ou as taxas da plataforma.</p> : (
        <div className="mt-3 space-y-3">
          <p className="text-xs font-black uppercase tracking-wide text-hf-muted">Melhores opções</p>
          <ul className="space-y-2">
            {r.melhores.map((c) => (
              <li key={c.id} className="rounded-2xl border border-hf-border p-3">
                <p className="text-sm font-bold text-hf-text">{nomes(c)}</p>
                <p className="text-sm text-hf-text-2">Venda por <b className="tabular-nums text-hf-text">{brl(c.preco)}</b> (separado {brl(c.soma)}) e sobram <b className={`tabular-nums ${corLucro(c.lucro)}`}>{brl(c.lucro)}</b>, {pctTxt(c.lucroPct)}.</p>
                {alvoPct != null && !c.noAlvo && c.precoParaAlvo != null && <p className="text-xs font-semibold text-hf-warning">Para manter {pctTxt(alvoPct)}, o preço seria {brl(c.precoParaAlvo)}.</p>}
                <Botao variante="secundario" className="mt-2" type="button" onClick={() => usar(c)}>Colocar no Cardápio</Botao>
              </li>
            ))}
          </ul>
          {r.piores.length > 0 && <>
            <p className="text-xs font-black uppercase tracking-wide text-hf-muted">Evite</p>
            <ul className="space-y-2">
              {r.piores.map((c) => (
                <li key={c.id} className="rounded-2xl border-l-4 border-l-hf-danger bg-hf-elevated/60 p-3 text-sm text-hf-text-2">
                  <b className="text-hf-text">{nomes(c)}</b>: por {brl(c.preco)} {c.lucro < 0 ? "dá prejuízo de" : "sobram só"} <b className={`tabular-nums ${corLucro(c.lucro)}`}>{brl(Math.abs(c.lucro))}</b>. Melhor fazer {nomes(r.melhores[0])}.
                </li>
              ))}
            </ul>
          </>}
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
        </div>
      )}
    </Secao>
  );
}

export default function PainelDeLucro() {
  const { unidadeId } = useMarmitaria();
  const { canais, canal, setCanalId, combos, setCombos, metaPct, catalogo, comum, linhas, mudancas } = useCardapio();
  const [vendas, setVendas] = useState([]);
  const [itemId, setItemId] = useState("");

  useEffect(() => {
    if (!unidadeId) return;
    let vivo = true;
    const hoje = new Date().toLocaleDateString("sv-SE");
    fetchVendas(unidadeId, somarDiasIso(hoje, -30), hoje).then((r) => { if (vivo) setVendas(r.data || []); });
    return () => { vivo = false; };
  }, [unidadeId]);

  const p = useMemo(() => painelDeLucro({ linhas, vendas }), [linhas, vendas]);
  const falta = linhas[0]?.falta || null;
  const meta = lerNumero(metaPct);
  const alvoPct = meta === "" ? p.mediaPct : meta;
  const opcoes = useMemo(() => [...catalogo.marmita, ...catalogo.sobremesa.filter((i) => i.propria), ...catalogo.bebida.filter((i) => i.propria)].filter((i) => i.preco > 0 && i.custo != null), [catalogo]);
  const item = opcoes.find((i) => i.id === itemId) || opcoes[0] || null;
  const comparacao = useMemo(() => compararPromocoes({ item, comum }), [item, comum]);
  const margem = [...p.pratos].sort((a, b) => b.lucroPct - a.lucroPct);
  const pior = p.pratos[p.pratos.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase text-hf-muted">Vendendo em</span>
        {canais.map((c) => <button key={c.id} type="button" className={chip(c.id === canal.id)} onClick={() => setCanalId(c.id)}>{c.nome}</button>)}
      </div>
      {falta && <Aviso tipo="alerta">{falta}: preencha em <a href="/dashboard/marmitaria/configuracoes" className="font-bold underline">Configurações</a> para ver o lucro.</Aviso>}

      <MudancasDeCusto mudancas={mudancas} />

      {!falta && (p.pratos.length > 0 ? <>
        <Secao titulo="Lucratividade" subtitulo="Por pedido, nesta plataforma." direita={<Selo natureza="estimado" />}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Destaque rotulo="Maior lucro por pedido" nome={p.pratos[0].nome} valor={brl(p.pratos[0].lucro)} />
            <Destaque rotulo="Melhor margem" nome={margem[0].nome} valor={pctTxt(margem[0].lucroPct)} />
            <Destaque rotulo="Menor lucro por pedido" nome={pior.nome} valor={brl(pior.lucro)} />
            <Destaque rotulo={p.mediaPonderada ? "Média pelas vendas" : "Média dos pratos"} valor={pctTxt(p.mediaPct)} />
          </div>
          <ul className="mt-3 divide-y divide-hf-border">
            {p.pratos.map((x) => <Linha key={x.id} titulo={x.nome} detalhe={`${x.categoria} · Markup ${markupTxt(x.markup)} · CMV ${pctTxt(x.cmvPct)}`} valor={brl(x.lucro)} nota={pctTxt(x.lucroPct)} negativo={x.lucro < 0} />)}
          </ul>
        </Secao>

        <Secao titulo="O que mais rendeu" subtitulo="Vendas lançadas nos últimos 30 dias × lucro de hoje por pedido." direita={<Selo natureza="estimado" />}>
          {p.maisGanho.length ? (
            <ul className="divide-y divide-hf-border">
              {p.maisGanho.map((x) => <Linha key={x.id} titulo={x.nome} detalhe={`${x.vendidas.toLocaleString("pt-BR")} vendidas`} valor={brl(x.ganho)} negativo={x.ganho < 0} />)}
            </ul>
          ) : <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: nenhuma venda lançada nos últimos 30 dias.</p>}
        </Secao>
      </> : <Secao titulo="Lucratividade"><p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: faltam pratos com preço e custo nesta plataforma.</p></Secao>)}

      {!falta && <>
        <Secao titulo="Combos" subtitulo="Comparados com os mesmos itens vendidos separados." direita={<Selo natureza="simulacao" />}>
          {p.combos.length ? (
            <ul className="divide-y divide-hf-border">
              {p.combos.map((c) => <Linha key={c.id} titulo={c.nome} detalhe={c.lucroSem == null ? null : `Separado: ${brl(c.lucroSem)}`} valor={brl(c.lucro)} nota={c.diferenca == null ? pctTxt(c.lucroPct) : `${c.diferenca >= 0 ? "+" : "−"} ${brl(Math.abs(c.diferenca))} por pedido`} negativo={c.lucro < 0} />)}
            </ul>
          ) : <p className="text-sm text-hf-text-2">Nenhum combo com preço no Cardápio.</p>}
        </Secao>

        <Secao titulo="Promoções" subtitulo="O que sobra em cada pedido." direita={<Selo natureza="simulacao" />}>
          {p.promocoes.length > 0 && (
            <ul className="mb-3 divide-y divide-hf-border">
              {p.promocoes.map((c) => <Linha key={c.id} titulo={`${c.nome}: ${c.rotulo}`} detalhe={c.prejuizo ? "Dá prejuízo em cada pedido" : c.vezes > 1 ? `Precisa vender ${c.vezes.toLocaleString("pt-BR")}× mais para empatar` : null} valor={brl(c.lucro)} nota={pctTxt(c.lucroPct)} negativo={c.lucro < 0} />)}
            </ul>
          )}
          {item ? <>
            <Campo rotulo="2 por 1 ou só desconto? Compare">
              <select className={inputCls} value={item.id} onChange={(e) => setItemId(e.target.value)}>{opcoes.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}</select>
            </Campo>
            <ul className="mt-2 divide-y divide-hf-border">
              {comparacao.map((c) => <Linha key={c.id} titulo={c.rotulo} detalhe={`Cliente paga ${brl(c.paga)} e leva ${c.unidades}`} valor={brl(c.lucro)} nota={c.unidades > 1 ? `${brl(c.lucroPorUnidade)} por unidade` : pctTxt(c.lucroPct)} negativo={c.lucro < 0} />)}
            </ul>
          </> : <p className="text-sm text-hf-text-2">Faltam itens com preço e custo para comparar.</p>}
        </Secao>

        <Sugestoes catalogo={catalogo} comum={comum} alvoPct={alvoPct} combos={combos} setCombos={setCombos} unidadeId={unidadeId} />
      </>}
    </div>
  );
}
