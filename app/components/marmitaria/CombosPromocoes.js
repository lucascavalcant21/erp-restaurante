"use client";

// CARDÁPIO DA MARMITARIA (pedidos do dono, 28/10 e 05/11/2026): cada item
// sozinho ou em combo, por plataforma, com preço, markup, CMV e o que sobra
// tirando todos os custos; promoções como "compre 1 e ganhe outra" mostram o
// lucro antes de publicar. Contas em lib/marmitaria/promocoes.mjs e
// cardapio.mjs. É simulação: nada grava venda. Combos e promoções ficam em
// config_sistema; o preço de cada plataforma, em marmitaria_precificacao_canais.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, UtensilsCrossed, CupSoda, IceCreamCone, SlidersHorizontal } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Abas, Aviso, Botao, Campo, CampoNumero, Secao, Selo, brl, markupTxt, inputCls, lerNumero, pctTxt } from "./ui";
import {
  TIPOS_OFERTA, MODELOS_COMBO, ROTULO_GRUPO,
  simularOferta, catalogoParaCombo, normalizarCombo, itensDoCombo,
  cardapioDeVendas, projecaoDeVendas, normalizarOferta, rotuloDaOferta,
} from "../../lib/marmitaria/promocoes.mjs";
import { canaisDoCardapio, ehMei, ordenarCategorias, rotuloDoLucro } from "../../lib/marmitaria/cardapio.mjs";
import { precoSugerido } from "../../lib/marmitaria/nucleo.mjs";
import { precoPorMarkup } from "../../lib/marmitaria/dia.mjs";
import { definirDisponibilidade, salvarPrecoNoCanal } from "../../lib/marmitaria/dados";
import { useCustosEmbutidos } from "./useCustosEmbutidos";
import { custoPorcaoDaFicha } from "../../lib/evento-financeiro.mjs";
import { fetchCombosMarmitaria, salvarCombosMarmitaria, fetchOfertasMarmitaria, salvarOfertasMarmitaria } from "../../lib/parametros";

const chip = (ativo) => `h-10 rounded-xl border px-3 text-sm font-bold transition ${ativo ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text-2 hover:bg-hf-elevated"}`;

export default function CombosPromocoes({ onEditar, abaInicial = "cardapio" }) {
  const [aba, setAba] = useState(["cardapio", "combos", "promocoes"].includes(abaInicial) ? abaInicial : "cardapio");
  const { base, custos, unidadeId } = useMarmitaria();
  const canais = useMemo(() => canaisDoCardapio(base.config), [base]);
  const [canalId, setCanalId] = useState(canais[0].id);
  const canal = canais.find((c) => c.id === canalId) || canais[0];
  const embutidos = useCustosEmbutidos();
  const [combos, setCombos] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [metaPct, setMetaPct] = useState(base.config.margem_alvo_pct == null ? "" : String(base.config.margem_alvo_pct).replace(".", ","));
  const [diasSemana, setDiasSemana] = useState("6");
  const chaveVendas = `hefisto:marmitaria:vendas-dia:${unidadeId}`;
  const [vendas, setVendas] = useState(() => { try { return JSON.parse(localStorage.getItem(chaveVendas) || "{}") || {}; } catch { return {}; } });
  const mudarVenda = (id, v) => setVendas((x) => { const n = { ...x, [id]: v }; try { localStorage.setItem(chaveVendas, JSON.stringify(n)); } catch { /* segue */ } return n; });
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!unidadeId) return;
    fetchCombosMarmitaria(unidadeId).then((r) => setCombos((r.data || []).map(normalizarCombo)));
    fetchOfertasMarmitaria(unidadeId).then((r) => setOfertas((r.data || []).map(normalizarOferta)));
  }, [unidadeId]);

  const catalogo = useMemo(() => catalogoParaCombo({
    marmitas: base.marmitas, custos, fichas: base.fichas,
    custoFicha: (f) => { const c = custoPorcaoDaFicha(f, base.fichas); return c > 0 ? c : null; },
    canalId: canal.id,
  }), [base, custos, canal]);

  const comum = { canal, tributosPct: base.config.tributos_pct, embutidos };
  const linhas = useMemo(() => cardapioDeVendas({ catalogo, marmitas: base.marmitas, ofertas, combos, ...comum, metaPct: metaPct === "" ? null : metaPct }),
    [catalogo, base.marmitas, ofertas, combos, canal, base.config.tributos_pct, embutidos, metaPct]); // eslint-disable-line react-hooks/exhaustive-deps
  async function gravarOfertas(lista) {
    setOfertas(lista);
    const r = await salvarOfertasMarmitaria(unidadeId, lista);
    setMsg(r?.error ? { tipo: "alerta", t: `Não foi possível salvar a promoção: ${r.error}` } : { tipo: "info", t: "Cardápio salvo." });
  }

  async function salvarCombos(lista) {
    setSalvando(true); setMsg(null);
    const r = await salvarCombosMarmitaria(unidadeId, lista);
    setSalvando(false);
    setMsg(r?.error ? { tipo: "alerta", t: `Não foi possível salvar: ${r.error}` } : { tipo: "info", t: "Combos salvos." });
  }

  const qtd = { marmitas: linhas.filter((l) => l.secao === "marmitas").length, combos: combos.length, promocoes: ofertas.length };
  const novoCombo = (modelo) => { setCombos((l) => [...l, normalizarCombo({ modelo: modelo.id, nome: modelo.rotulo })]); setAba("combos"); };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-3xl border border-hf-border bg-hf-surface">
        <div className="bg-gradient-to-br from-hf-accent/15 via-hf-accent/5 to-transparent p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-wider text-hf-accent">Cardápio</p>
          <h2 className="mt-0.5 text-lg font-black text-hf-text sm:text-xl">Forme o preço e veja o que sobra em cada venda</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[["Itens", qtd.marmitas, "cardapio"], ["Combos", qtd.combos, "combos"], ["Promoções", qtd.promocoes, "promocoes"]].map(([rot, n, id]) => (
              <button key={id} type="button" onClick={() => setAba(id)} className="rounded-2xl bg-hf-surface/90 p-3 text-left shadow-sm ring-1 ring-hf-border transition hover:ring-hf-accent">
                <p className="text-2xl font-black tabular-nums text-hf-text">{n}</p>
                <p className="text-xs font-bold text-hf-text-2">{rot}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-hf-muted">Vendendo em</span>
            {canais.map((c) => <button key={c.id} type="button" className={chip(c.id === canal.id)} onClick={() => setCanalId(c.id)}>{c.nome}</button>)}
          </div>
        </div>
      </section>

      <Abas abas={[{ id: "cardapio", rotulo: "Itens" }, { id: "combos", rotulo: "Combos" }, { id: "promocoes", rotulo: "Promoções" }]} valor={aba} onChange={setAba} />

      {linhas[0]?.falta && <Aviso tipo="alerta">{linhas[0].falta}: preencha em <a href="/dashboard/marmitaria/configuracoes" className="font-bold underline">Configurações</a> para ver o lucro.</Aviso>}
      {!embutidos.completo && <Aviso>Equipe e custos fixos ainda não entram por completo (falta {embutidos.faltando.join(", ")}). Preencha em <a href="/dashboard/marmitaria/configuracoes" className="font-bold underline">Configurações</a>.</Aviso>}

      {aba === "cardapio" && <CardapioVendas linhas={linhas} vendas={vendas} mudarVenda={mudarVenda} diasSemana={diasSemana} custos={custos} onEditar={onEditar} comum={comum} metaPct={metaPct}
        onRemoverOferta={(id) => gravarOfertas(ofertas.filter((o) => o.id !== id))} msg={msg} irPara={setAba} />}

      {aba === "promocoes" && <SimuladorPromocao catalogo={catalogo} comum={comum} bloqueio={linhas[0]?.falta || null}
        onAdicionar={(fichaId, o) => { gravarOfertas([...ofertas, normalizarOferta({ ...o, ficha_id: fichaId })]); setAba("cardapio"); }} />}

      {aba === "combos" && (
        <Secao titulo="Montar combos" subtitulo="Escolha o tipo, os itens e o preço. Com preço, o combo entra no cardápio.">
          <div className="grid gap-3 sm:grid-cols-2">
            {MODELOS_COMBO.map((m) => (
              <button key={m.id} type="button" onClick={() => novoCombo(m)}
                className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-hf-accent/40 bg-hf-accent/5 p-4 text-left transition hover:border-hf-accent hover:bg-hf-accent/10">
                <span className="flex shrink-0 -space-x-2">
                  {m.grupos.map((g) => { const I = ICONE_GRUPO[g]; return <span key={g} className="grid h-10 w-10 place-items-center rounded-full border-2 border-hf-surface bg-hf-accent text-white"><I size={18} /></span>; })}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-hf-text"><Plus size={14} className="mr-1 inline" />{m.rotulo}</span>
                  <span className="block text-xs text-hf-text-2">{m.grupos.length === 3 ? "Ex.: marmita + suco + pudim" : "Ex.: marmita + refrigerante"}</span>
                </span>
              </button>
            ))}
          </div>
          {!combos.length && <p className="mt-3 text-sm text-hf-text-2">Nenhum combo ainda. Toque em um dos tipos acima.</p>}
          <ul className="mt-3 space-y-3">
            {combos.map((c) => <LinhaCombo key={c.id} combo={c} catalogo={catalogo} comum={comum}
              onChange={(novo) => setCombos((l) => l.map((x) => (x.id === c.id ? normalizarCombo(novo) : x)))}
              onRemover={() => setCombos((l) => l.filter((x) => x.id !== c.id))} />)}
          </ul>
          {combos.length > 0 && (
            <div className="sticky bottom-3 mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-hf-surface/95 p-2 shadow-lg ring-1 ring-hf-border">
              <Botao onClick={() => salvarCombos(combos)} disabled={salvando}>{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar combos</Botao>
              {msg && <span className={`text-sm font-bold ${msg.tipo === "alerta" ? "text-hf-danger" : "text-hf-accent"}`}>{msg.t}</span>}
            </div>
          )}
        </Secao>
      )}

      <details className="group rounded-2xl border border-hf-border bg-hf-surface p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-black text-hf-text">
          <SlidersHorizontal size={16} className="text-hf-accent" /> Ajustes da conta
          <span className="ml-auto text-xs font-semibold text-hf-text-2">{ehMei(base.config) ? "MEI · " : ""}meta {metaPct === "" ? "—" : `${metaPct}%`} · {diasSemana || "—"} dias/semana</span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-hf-elevated p-3 text-sm">
            <p className="text-xs font-semibold text-hf-text-2">Em cada marmita <Selo natureza="estimado" /></p>
            <p className="mt-1 text-hf-text">Equipe {embutidos.cmoPorMarmita == null ? "—" : brl(embutidos.cmoPorMarmita)}</p>
            <p className="text-hf-text">Custos fixos {embutidos.fixosPorMarmita == null ? "—" : brl(embutidos.fixosPorMarmita)}</p>
          </div>
          <Campo rotulo="Meta de lucro (%)" dica="Acima dela: faz sentido. Para fixar, use Configurações."><CampoNumero valor={metaPct} onChange={setMetaPct} placeholder="ex.: 15" /></Campo>
          <Campo rotulo="Dias que vende por semana"><CampoNumero valor={diasSemana} onChange={setDiasSemana} /></Campo>
        </div>
      </details>
    </div>
  );
}

const ICONE_GRUPO = { marmita: UtensilsCrossed, bebida: CupSoda, sobremesa: IceCreamCone };

const BORDA_VEREDITO = { ok: "border-l-hf-accent", baixo: "border-l-hf-warning", prejuizo: "border-l-hf-danger", lucro: "border-l-hf-border", sem_dados: "border-l-hf-border" };
const VEREDITO_COR = { ok: "bg-hf-accent/10 text-hf-accent", baixo: "bg-hf-warning/10 text-hf-warning", prejuizo: "bg-hf-danger/10 text-hf-danger", lucro: "bg-hf-elevated text-hf-text-2", sem_dados: "bg-hf-elevated text-hf-muted" };
const SECOES_CARDAPIO = [["promocoes", "Promoções"], ["combos", "Combos"], ["marmitas", "Sozinhos"]];

// Cardápio como o cliente vê (estilo iFood) e, ao lado, o lucro de cada item.
function CardapioVendas({ linhas, vendas, mudarVenda, diasSemana, custos, onRemoverOferta, msg, onEditar, irPara, comum, metaPct }) {
  const { recarregar } = useMarmitaria();
  const [aberto, setAberto] = useState(null);
  const [precoAberto, setPrecoAberto] = useState(null);
  const [erro, setErro] = useState(null);
  const rotuloLucro = rotuloDoLucro(comum.embutidos);
  async function tirarDoCardapio(ficha) {
    setErro(null);
    const r = await definirDisponibilidade(ficha.id, false);
    if (r.error) setErro(r.error); else await recarregar();
  }
  const p = projecaoDeVendas(linhas, vendas, { diasPorSemana: diasSemana });
  return (
    <Secao titulo={`Cardápio no ${comum.canal.nome}`} subtitulo="O preço de cada item nessa plataforma e quanto sobra para você em cada pedido.">
      {erro && <p className="mb-2 text-sm font-bold text-hf-danger">{erro}</p>}
      {msg && <p className={`mb-2 text-sm font-bold ${msg.tipo === "alerta" ? "text-hf-danger" : "text-hf-accent"}`}>{msg.t}</p>}
      <div className="space-y-5">
        {SECOES_CARDAPIO.map(([sec, rot]) => {
          const lista = linhas.filter((l) => l.secao === sec);
          if (!lista.length) {
            if (sec === "marmitas" || !irPara) return null;
            return (
              <button key={sec} type="button" onClick={() => irPara(sec)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-hf-border p-4 text-left hover:border-hf-accent">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-hf-accent/10 text-hf-accent"><Plus size={18} /></span>
                <span><span className="block text-sm font-black text-hf-text">{sec === "combos" ? "Montar o primeiro combo" : "Criar a primeira promoção"}</span>
                  <span className="block text-xs text-hf-text-2">{sec === "combos" ? "Comida + bebida, ou comida + bebida + sobremesa." : "Desconto, 2 por 1 ou 3 por 2, vendo o lucro antes."}</span></span>
              </button>
            );
          }
          // "Sozinhos" vem separado pelas categorias da Ficha técnica.
          const blocos = sec === "marmitas"
            ? ordenarCategorias(lista.map((l) => l.categoria)).map((c) => [c, lista.filter((l) => l.categoria === c)])
            : [[rot, lista]];
          return blocos.map(([titulo, itens]) => (
            <div key={`${sec}-${titulo}`}>
              <p className="mb-2 flex items-center gap-2 text-sm font-black text-hf-text">{titulo} <span className="rounded-full bg-hf-elevated px-2 text-xs text-hf-text-2">{itens.length}</span></p>
              <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {itens.map((l) => {
                  const img = l.ficha?.imagem;
                  const abrir = aberto === l.id;
                  const c = l.ficha ? custos.get(l.ficha.id) : null;
                  return (
                    <li key={l.id} className={`rounded-2xl border border-hf-border border-l-4 bg-hf-surface p-3 ${BORDA_VEREDITO[l.veredito.id] || ""}`}>
                      <div className="flex items-start gap-3">
                        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-hf-elevated text-hf-muted">{img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed size={20} />}</div>
                        <div className="min-w-0 flex-1">
                          {l.rotulo && l.secao !== "marmitas" ? <span className="mb-0.5 inline-block rounded-md bg-hf-danger/10 px-1.5 py-0.5 text-[11px] font-black text-hf-danger">{l.rotulo}</span> : null}
                          <p className="break-words text-sm font-bold text-hf-text">{l.nome}</p>
                          {l.descricao && <p className="text-xs text-hf-muted">{l.descricao}</p>}
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                        <Numero r="Preço" v={l.semPreco ? "—" : brl(l.precoPago)} riscado={l.precoCheio > l.precoPago ? brl(l.precoCheio) : null} />
                        <Numero r="Custo" v={l.custo == null ? "—" : brl(l.custo)} />
                        <Numero r="Markup" v={markupTxt(l.markup)} />
                        <Numero r="CMV" v={l.cmvPct == null ? "—" : pctTxt(l.cmvPct)} />
                      </dl>
                      <div className="mt-2 grid grid-cols-[1fr_96px] items-end gap-3 rounded-xl bg-hf-elevated p-2.5">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase text-hf-muted">{rotuloLucro}</p>
                          <p className={`text-xl font-black tabular-nums ${l.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>{l.lucro == null ? "—" : brl(l.lucro)} <span className="text-xs font-bold text-hf-text-2">{l.lucro == null ? "" : pctTxt(l.lucroPct)}</span></p>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-black ${VEREDITO_COR[l.veredito.id]}`}>{l.veredito.rotulo}</span>
                        </div>
                        <label className="text-[11px] font-bold uppercase text-hf-muted">Vendo/dia
                          <CampoNumero valor={vendas[l.id] ?? ""} onChange={(v) => mudarVenda(l.id, v)} placeholder="0" aria-label={`Vendas por dia de ${l.nome}`} />
                        </label>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {l.secao === "marmitas" && <button type="button" onClick={() => setPrecoAberto(precoAberto === l.id ? null : l.id)} aria-expanded={precoAberto === l.id} className="min-h-[32px] text-xs font-bold text-hf-accent hover:underline">Formar preço</button>}
                        {!l.semPreco && !l.falta && <button type="button" onClick={() => setAberto(abrir ? null : l.id)} aria-expanded={abrir} className="inline-flex min-h-[32px] items-center gap-1 text-xs font-bold text-hf-accent hover:underline">{abrir ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Ver a conta</button>}
                        {onEditar && l.ficha && <button type="button" onClick={() => onEditar(l.ficha)} className="min-h-[32px] text-xs font-bold text-hf-text hover:underline">Editar ficha</button>}
                        {l.secao === "marmitas" && l.ficha && <button type="button" onClick={() => tirarDoCardapio(l.ficha)} className="min-h-[32px] text-xs font-bold text-hf-text-2 hover:text-hf-danger">Tirar do cardápio</button>}
                        {l.secao === "promocoes" && <button type="button" onClick={() => onRemoverOferta(l.id)} className="min-h-[32px] text-xs font-bold text-hf-text-2 hover:text-hf-danger">Tirar do cardápio</button>}
                      </div>
                      {precoAberto === l.id && <FormarPreco linha={l} comum={comum} metaPct={metaPct} aoSalvar={() => setPrecoAberto(null)} />}
                      {abrir && l.sim && (
                        <div className="mt-2">
                          {c && <p className="text-xs text-hf-text-2">Custo de 1 unidade: alimentos {brl(c.alimentos)} · pré-preparos {brl(c.prePreparos)} · embalagens {brl(c.embalagens)} = <b>{brl(c.total)}</b>{!c.completo ? " (incompleto)" : ""}</p>}
                          {l.secao === "combos" && <p className="text-xs text-hf-text-2">Itens: {l.itens.map((i) => `${i.nome} (custo ${i.custo == null ? "—" : brl(i.custo)})`).join(" · ")}</p>}
                          {l.secao === "marmitas" ? <Comparacao s={{ ...l.sim, sem: l.sim.com }} rotuloSem="Preço cheio" rotuloCom="Preço cheio" unico rotuloLucro={rotuloLucro} /> : <Comparacao s={l.sim} rotuloSem={l.secao === "combos" ? "Separado" : "Sem promoção"} rotuloCom={l.secao === "combos" ? "Combo" : "Com promoção"} rotuloLucro={rotuloLucro} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ));
        })}
        {!linhas.length && <p className="text-sm text-hf-text-2">Monte as fichas técnicas para formar o cardápio.</p>}
      </div>
      <div className="mt-5 rounded-2xl border-2 border-hf-accent/30 bg-hf-accent/5 p-4">
        <p className="text-sm font-black text-hf-text">Se eu vender isso <Selo natureza="simulacao" /></p>
        {p.dia.pedidos > 0 ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {[["Por dia", p.dia], [`Por semana (${p.diasPorSemana} dias)`, p.semana], ["Por mês", p.mes]].map(([rot, v]) => (
              <div key={rot} className="rounded-xl bg-hf-surface p-3">
                <p className="text-[11px] font-bold uppercase text-hf-muted">{rot}</p>
                <p className={`text-xl font-black tabular-nums ${v.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>{brl(v.lucro)}</p>
                <p className="text-xs text-hf-text-2">de lucro · {brl(v.faturamento)} vendidos · {v.pedidos.toLocaleString("pt-BR")} pedidos</p>
              </div>
            ))}
          </div>
        ) : <p className="mt-1 text-sm text-hf-text-2">Preencha “Vendo/dia” nos itens acima para ver o lucro do dia, da semana e do mês.</p>}
        {p.semDados > 0 && <p className="mt-2 text-xs font-bold text-hf-warning">{p.semDados} item(ns) sem custo ou sem preço ficaram fora da conta (DADOS INSUFICIENTES).</p>}
      </div>
    </Secao>
  );
}

function Numero({ r, v, riscado }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold text-hf-muted">{r}</dt>
      <dd className="text-sm font-bold tabular-nums text-hf-text">{v}</dd>
      {riscado && <dd className="text-[11px] tabular-nums text-hf-muted line-through">{riscado}</dd>}
    </div>
  );
}

// Forma o preço do item nesta plataforma. A conta muda a cada tecla; só grava no botão.
function FormarPreco({ linha, comum, metaPct, aoSalvar }) {
  const { unidadeId, recarregar } = useMarmitaria();
  const item = linha.itens[0];
  const [preco, setPreco] = useState(item.preco > 0 ? String(item.preco).replace(".", ",") : "");
  const [markup, setMarkup] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const valor = lerNumero(preco);
  const s = valor > 0 ? simularOferta({ itens: [{ ...item, preco: valor, qtd: 1 }], oferta: { tipo: "nenhuma" }, ...comum }) : null;
  const custoComEmbutidos = item.custo == null ? null : item.custo + (item.grupo === "marmita" ? comum.embutidos.totalPorMarmita || 0 : 0);
  const sug = precoSugerido({ custoTecnico: custoComEmbutidos, canal: { ...comum.canal, itens_por_pedido: 1 }, tributosPct: comum.tributosPct, margemAlvoPct: metaPct === "" ? null : metaPct });
  const usar = (v) => { setPreco(String(v).replace(".", ",")); setErro(null); };

  async function salvar() {
    if (salvando) return;
    setSalvando(true); setErro(null);
    try {
      const r = await salvarPrecoNoCanal({ unidadeId, fichaId: item.id, canal: comum.canal.id, preco: valor });
      if (r.error) { setErro(r.error); return; }
      await recarregar();
      aoSalvar();
    } finally { setSalvando(false); }
  }

  return (
    <div className="mt-2 rounded-xl border border-hf-border p-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Markup desejado" dica={item.custo == null ? "Precisa do custo completo." : "Preço = custo × markup."}>
          <CampoNumero valor={markup} disabled={item.custo == null} placeholder="ex.: 3" onChange={(v) => { setMarkup(v); const novo = precoPorMarkup(item.custo, lerNumero(v)); if (novo !== null) usar(novo); }} />
        </Campo>
        <Campo rotulo={`Preço no ${comum.canal.nome} (R$)`}><CampoNumero valor={preco} onChange={(v) => { setPreco(v); setMarkup(""); }} placeholder="0,00" /></Campo>
      </div>
      {sug.preco !== null && !linha.falta && <button type="button" onClick={() => { usar(sug.preco); setMarkup(""); }} className="mt-2 min-h-[32px] text-xs font-bold text-hf-accent hover:underline">Usar {brl(sug.preco)}, que dá {pctTxt(lerNumero(metaPct), 0)} de lucro</button>}
      {s?.com.valido && !linha.falta && (
        <p className="mt-2 text-sm text-hf-text-2">Markup <b className="tabular-nums">{markupTxt(s.com.markup)}</b> · CMV <b className="tabular-nums">{pctTxt(s.com.cmvTecnicoPct)}</b> · Sobra <b className={`tabular-nums ${s.com.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>{brl(s.com.lucro)}</b></p>
      )}
      {erro && <Aviso tipo="alerta" className="mt-2">{erro}</Aviso>}
      <Botao className="mt-2" type="button" onClick={salvar} disabled={salvando || !(valor > 0)}>{salvando ? "Salvando…" : `Salvar preço no ${comum.canal.nome}`}</Botao>
    </div>
  );
}

function SimuladorPromocao({ catalogo, comum, bloqueio, onAdicionar }) {
  const opcoes = [...catalogo.marmita, ...catalogo.bebida.filter((i) => i.propria), ...catalogo.sobremesa.filter((i) => i.propria)];
  const [itemId, setItemId] = useState(catalogo.marmita[0]?.id || opcoes[0]?.id || "");
  const [qtd, setQtd] = useState("1");
  const [precoSim, setPrecoSim] = useState("");
  const [oferta, setOferta] = useState({ tipo: "leve_pague", leve: "2", pague: "1", valor: "" });
  const base0 = opcoes.find((o) => o.id === itemId);
  // Preço digitado só para simular (o da marmita não muda).
  const item = base0 && String(precoSim).trim() ? { ...base0, preco: precoSim } : base0;
  if (!opcoes.length) return <Secao titulo="Simular promoção"><p className="text-sm text-hf-text-2">Cadastre uma marmita para simular.</p></Secao>;
  const s = item ? simularOferta({ itens: [{ ...item, qtd }], oferta, ...comum }) : null;
  const atalhos = [["Compre 1, ganhe 1", { tipo: "leve_pague", leve: "2", pague: "1" }], ["3 por 2", { tipo: "leve_pague", leve: "3", pague: "2" }], ["10% off", { tipo: "desconto_pct", valor: "10" }], ["20% off", { tipo: "desconto_pct", valor: "20" }], ["R$ 5 off", { tipo: "desconto_rs", valor: "5" }]];
  return (
    <Secao titulo="Nova promoção" subtitulo="Escolha o item e a promoção, veja o que sobra e coloque no cardápio.">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px]">
        <Campo rotulo="Produto">
          <select className={inputCls} value={itemId} onChange={(e) => { setItemId(e.target.value); setPrecoSim(""); }}>
            {["marmita", "bebida", "sobremesa"].map((g) => opcoes.some((o) => o.grupo === g) ? <optgroup key={g} label={ROTULO_GRUPO[g]}>{opcoes.filter((o) => o.grupo === g).map((o) => <option key={o.id} value={o.id}>{o.nome}{o.preco ? ` · ${brl(o.preco)}` : ""}</option>)}</optgroup> : null)}
          </select>
        </Campo>
        <Campo rotulo="Preço (R$)" dica={base0?.preco ? `Hoje: ${brl(base0.preco)}` : "Sem preço cadastrado"}><CampoNumero valor={precoSim} onChange={setPrecoSim} placeholder={base0?.preco ? String(base0.preco).replace(".", ",") : "0,00"} /></Campo>
        <Campo rotulo="Quantidade"><CampoNumero valor={qtd} onChange={setQtd} /></Campo>
      </div>
      {base0 && !(Number(String(item.preco).replace(",", ".")) > 0) && <Aviso tipo="alerta" className="mt-3">{base0.nome} está sem preço: digite um preço acima para simular, ou salve em Formar preço.</Aviso>}
      <div className="mt-3 flex flex-wrap gap-2">
        {atalhos.map(([rot, o]) => {
          const ativo = oferta.tipo === o.tipo && (o.tipo === "leve_pague" ? oferta.leve === o.leve && oferta.pague === o.pague : String(oferta.valor) === o.valor);
          return <button key={rot} type="button" className={chip(ativo)} onClick={() => setOferta({ ...oferta, ...o })}>{rot}</button>;
        })}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Tipo">
          <select className={inputCls} value={oferta.tipo} onChange={(e) => setOferta({ ...oferta, tipo: e.target.value })}>
            {TIPOS_OFERTA.filter((t) => t.id !== "preco_fixo").map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
          </select>
        </Campo>
        {oferta.tipo === "leve_pague" ? <>
          <Campo rotulo="Leva"><CampoNumero valor={oferta.leve} onChange={(v) => setOferta({ ...oferta, leve: v })} /></Campo>
          <Campo rotulo="Paga"><CampoNumero valor={oferta.pague} onChange={(v) => setOferta({ ...oferta, pague: v })} /></Campo>
        </> : oferta.tipo !== "nenhuma" ? (
          <Campo rotulo={oferta.tipo === "desconto_pct" ? "Desconto (%)" : "Desconto (R$)"}><CampoNumero valor={oferta.valor} onChange={(v) => setOferta({ ...oferta, valor: v })} /></Campo>
        ) : null}
      </div>
      {item && item.custo == null && <Aviso tipo="alerta" className="mt-3">{item.nome} está sem custo na ficha: o lucro não dá para calcular (DADOS INSUFICIENTES).</Aviso>}
      {bloqueio ? <Aviso tipo="alerta" className="mt-3">{bloqueio}: preencha em Configurações para ver o lucro.</Aviso> : s && <Comparacao s={s} rotuloLucro={rotuloDoLucro(comum.embutidos)} />}
      {onAdicionar && item && oferta.tipo !== "nenhuma" && !String(precoSim).trim() && (
        <Botao className="mt-3" onClick={() => onAdicionar(item.id, oferta)}><Plus size={16} /> Colocar “{rotuloDaOferta(oferta)}” no cardápio</Botao>
      )}
    </Secao>
  );
}

function LinhaCombo({ combo, catalogo, comum, onChange, onRemover }) {
  const itens = itensDoCombo(combo, catalogo);
  const soma = itens ? itens.reduce((t, i) => t + (Number(i.preco) || 0), 0) : null;
  const s = itens && String(combo.preco).trim() ? simularOferta({ itens, oferta: { tipo: "preco_fixo", valor: combo.preco }, ...comum }) : null;
  const modelo = MODELOS_COMBO.find((m) => m.id === combo.modelo);
  return (
    <li className="rounded-2xl border border-hf-border p-3 sm:p-4">
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo={modelo?.rotulo || "Combo"} className="min-w-[200px] flex-1"><input className={inputCls} value={combo.nome} onChange={(e) => onChange({ ...combo, nome: e.target.value })} placeholder="Nome do combo" /></Campo>
        <button type="button" onClick={onRemover} aria-label={`Remover ${combo.nome || "combo"}`} className="grid h-11 w-11 place-items-center rounded-xl border border-hf-border text-hf-text-2 hover:text-hf-danger"><Trash2 size={16} /></button>
      </div>
      <div className={`mt-3 grid gap-3 ${combo.itens.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {combo.itens.map((slot) => (
          <Campo key={slot.grupo} rotulo={ROTULO_GRUPO[slot.grupo]}>
            <select className={inputCls} value={slot.id} onChange={(e) => onChange({ ...combo, itens: combo.itens.map((x) => (x.grupo === slot.grupo ? { ...x, id: e.target.value } : x)) })}>
              <option value="">Escolha…</option>
              {catalogo[slot.grupo].map((o) => <option key={o.id} value={o.id}>{o.nome}{o.preco ? ` · ${brl(o.preco)}` : ""}</option>)}
            </select>
            {!catalogo[slot.grupo].length && <span className="mt-1 block text-xs text-hf-muted">Nenhuma ficha de {ROTULO_GRUPO[slot.grupo].toLowerCase()} ativa.</span>}
          </Campo>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr] sm:items-end">
        <Campo rotulo="Preço do combo (R$)" dica={soma != null ? `Separado: ${brl(soma)}` : "Escolha os itens."}><CampoNumero valor={combo.preco} onChange={(v) => onChange({ ...combo, preco: v })} /></Campo>
        {soma != null && soma > 0 && (
          <div className="flex flex-wrap gap-2">
            {[10, 15, 20].map((d) => <button key={d} type="button" className={chip(false)} onClick={() => onChange({ ...combo, preco: String(Math.floor(soma * (1 - d / 100) * 100) / 100).replace(".", ",") })}>{d}% abaixo · {brl(soma * (1 - d / 100))}</button>)}
          </div>
        )}
      </div>
      {s && <Comparacao s={s} rotuloCom="Combo" rotuloSem="Separado" rotuloLucro={rotuloDoLucro(comum.embutidos)} />}
    </li>
  );
}

function Comparacao({ s, rotuloCom = "Com promoção", rotuloSem = "Sem promoção", unico = false, rotuloLucro = "Lucro" }) {
  const col = (titulo, r, destaque) => (
    <div className={`rounded-2xl p-3 ${destaque ? "border-2 border-hf-accent/40 bg-hf-accent/5" : "bg-hf-elevated"}`}>
      <p className="text-xs font-black uppercase tracking-wide text-hf-text-2">{titulo}</p>
      {!r.valido ? <p className="mt-1 text-sm text-hf-text-2">{r.motivo}</p> : (
        <dl className="mt-1 space-y-0.5 text-sm">
          <L r="Cliente paga" v={brl(r.pedido.paga)} forte />
          {r.pedido.unidades > 1 && <L r="Sai da cozinha" v={`${r.pedido.unidades} unidades`} />}
          {r.pedido.desconto > 0 && <L r="Desconto dado" v={`− ${brl(r.pedido.desconto)}`} />}
          <L r="Impostos" v={r.tributos > 0 ? `− ${brl(r.tributos)}` : brl(0)} />
          {r.comissao > 0 && <L r="Comissão da plataforma" v={`− ${brl(r.comissao)}`} />}
          {r.taxaPagamento > 0 && <L r="Maquininha / pagamento" v={`− ${brl(r.taxaPagamento)}`} />}
          {r.taxaFixa > 0 && <L r="Taxa fixa" v={`− ${brl(r.taxaFixa)}`} />}
          {r.entrega > 0 && <L r="Entrega" v={`− ${brl(r.entrega)}`} />}
          <L r="Custo dos produtos" v={r.custo == null ? "—" : `− ${brl(r.custo)}`} />
          <L r="Equipe (CMO)" v={r.cmo == null ? "falta dado" : `− ${brl(r.cmo)}`} />
          <L r="Custos fixos" v={r.fixos == null ? "falta dado" : `− ${brl(r.fixos)}`} />
          <div className={`mt-1 flex justify-between gap-3 border-t border-hf-border pt-1.5 text-base font-black ${r.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>
            <dt>{rotuloLucro}</dt><dd className="shrink-0 tabular-nums">{r.lucro == null ? "—" : `${brl(r.lucro)} · ${pctTxt(r.lucroPct)}`}</dd>
          </div>
          <L r="Markup · CMV" v={`${markupTxt(r.markup)} · ${pctTxt(r.cmvTecnicoPct)}`} />
        </dl>
      )}
    </div>
  );
  return (
    <div className="mt-4">
      <div className={`grid gap-3 ${unico ? "" : "sm:grid-cols-2"}`}>{!unico && col(rotuloSem, s.sem, false)}{col(rotuloCom, s.com, true)}</div>
      <p className="mt-2 text-sm font-semibold text-hf-text">
        {unico ? null : s.prejuizo ? <span className="text-hf-danger">Essa promoção dá prejuízo em cada pedido.</span>
          : s.vezesParaEmpatar != null && s.vezesParaEmpatar > 1 ? <>Para lucrar o mesmo que sem promoção, você precisa vender <b>{s.vezesParaEmpatar.toLocaleString("pt-BR")}×</b> mais pedidos.</>
          : s.vezesParaEmpatar != null ? <>A promoção lucra igual ou mais por pedido.</> : null}
        {" "}<Selo natureza="simulacao" />
      </p>
    </div>
  );
}

function L({ r, v, forte }) {
  return <div className={`flex justify-between gap-3 ${forte ? "font-black text-hf-text" : "text-hf-text-2"}`}><dt>{r}</dt><dd className="tabular-nums">{v}</dd></div>;
}
