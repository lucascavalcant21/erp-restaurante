"use client";

// COMBOS E PROMOÇÕES (pedido do dono, 28/10/2026): combos de comida + bebida
// e comida + bebida + sobremesa; simular desconto e 2 por 1 vendo o lucro
// "tirando todos os custos". Contas em lib/marmitaria/promocoes.mjs. É
// simulação: nada grava venda. Os combos ficam salvos em config_sistema.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, UtensilsCrossed, CupSoda, IceCreamCone, SlidersHorizontal } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Abas, Aviso, Botao, Campo, CampoNumero, Secao, Selo, brl, inputCls, pctTxt } from "./ui";
import {
  CANAL_DIRETO, TIPOS_OFERTA, MODELOS_COMBO, ROTULO_GRUPO,
  simularOferta, fixosPctDoResultado, catalogoParaCombo, normalizarCombo, itensDoCombo,
  cardapioDeVendas, projecaoDeVendas, normalizarOferta, rotuloDaOferta,
} from "../../lib/marmitaria/promocoes.mjs";
import { custoPorcaoDaFicha } from "../../lib/evento-financeiro.mjs";
import { fetchResultadoMensal, fetchCombosMarmitaria, salvarCombosMarmitaria, fetchOfertasMarmitaria, salvarOfertasMarmitaria } from "../../lib/parametros";

const chip = (ativo) => `h-10 rounded-xl border px-3 text-sm font-bold transition ${ativo ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text-2 hover:bg-hf-elevated"}`;

export default function CombosPromocoes({ onEditar, abaInicial = "cardapio" }) {
  const [aba, setAba] = useState(["cardapio", "combos", "promocoes"].includes(abaInicial) ? abaInicial : "cardapio");
  const { base, custos, unidadeId } = useMarmitaria();
  const canais = useMemo(() => {
    const l = base.config.canais.filter((c) => c.ativo);
    return l.length ? l : [CANAL_DIRETO];
  }, [base]);
  const [canalId, setCanalId] = useState(canais[0].id);
  const canal = canais.find((c) => c.id === canalId) || canais[0];
  const [fixosDoMes, setFixosDoMes] = useState(null);
  const [fixosPct, setFixosPct] = useState("");
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
    fetchResultadoMensal(unidadeId).then((r) => {
      const v = fixosPctDoResultado(r.data || {}, new Date().toISOString().slice(0, 7));
      setFixosDoMes(v);
      setFixosPct((x) => (x === "" && v != null ? String(v).replace(".", ",") : x));
    });
    fetchCombosMarmitaria(unidadeId).then((r) => setCombos((r.data || []).map(normalizarCombo)));
    fetchOfertasMarmitaria(unidadeId).then((r) => setOfertas((r.data || []).map(normalizarOferta)));
  }, [unidadeId]);

  const catalogo = useMemo(() => catalogoParaCombo({
    marmitas: base.marmitas, custos, fichas: base.fichas,
    custoFicha: (f) => { const c = custoPorcaoDaFicha(f, base.fichas); return c > 0 ? c : null; },
    canalId: canal.id === "direto" ? null : canal.id,
  }), [base, custos, canal]);

  const comum = { canal, tributosPct: base.config.tributos_pct, fixosPct: fixosPct === "" ? null : fixosPct };
  const linhas = useMemo(() => cardapioDeVendas({ catalogo, marmitas: base.marmitas, ofertas, combos, ...comum, metaPct: metaPct === "" ? null : metaPct }),
    [catalogo, base.marmitas, ofertas, combos, canal, base.config.tributos_pct, fixosPct, metaPct]); // eslint-disable-line react-hooks/exhaustive-deps
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
          <p className="text-xs font-black uppercase tracking-wider text-hf-accent">Combos e promoções</p>
          <h2 className="mt-0.5 text-lg font-black text-hf-text sm:text-xl">Monte o cardápio como no iFood e veja o lucro de cada pedido</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[["Marmitas", qtd.marmitas, "cardapio"], ["Combos", qtd.combos, "combos"], ["Promoções", qtd.promocoes, "promocoes"]].map(([rot, n, id]) => (
              <button key={id} type="button" onClick={() => setAba(id)} className="rounded-2xl bg-hf-surface/90 p-3 text-left shadow-sm ring-1 ring-hf-border transition hover:ring-hf-accent">
                <p className="text-2xl font-black tabular-nums text-hf-text">{n}</p>
                <p className="text-xs font-bold text-hf-text-2">{rot}</p>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase text-hf-muted">Vendendo no</span>
            {canais.map((c) => <button key={c.id} type="button" className={chip(c.id === canal.id)} onClick={() => setCanalId(c.id)}>{c.nome}</button>)}
          </div>
        </div>
      </section>

      <Abas abas={[{ id: "cardapio", rotulo: "Cardápio" }, { id: "combos", rotulo: "Combos" }, { id: "promocoes", rotulo: "Promoções" }]} valor={aba} onChange={setAba} />

      {canal.id === "direto" && <Aviso>Nenhum canal configurado: a conta usa venda direta, sem comissão. Configure iFood e WhatsApp em Ajustes para ver por canal.</Aviso>}
      {(base.config.tributos_pct == null) && <Aviso tipo="alerta">Impostos em branco: preencha em Financeiro → Resultado do mês.</Aviso>}

      {aba === "cardapio" && <CardapioVendas linhas={linhas} vendas={vendas} mudarVenda={mudarVenda} diasSemana={diasSemana} custos={custos} onEditar={onEditar}
        onRemoverOferta={(id) => gravarOfertas(ofertas.filter((o) => o.id !== id))} msg={msg} irPara={setAba} />}

      {aba === "promocoes" && <SimuladorPromocao catalogo={catalogo} comum={comum}
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
          <span className="ml-auto text-xs font-semibold text-hf-text-2">fixos {fixosPct === "" ? "não informados" : `${fixosPct}%`} · meta {metaPct === "" ? "—" : `${metaPct}%`} · {diasSemana || "—"} dias/semana</span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Custos fixos (% do faturamento)" dica={fixosDoMes != null ? `Resultado do mês: ${pctTxt(fixosDoMes)} (aluguel, energia, outros e depreciação). Equipe não entra aqui.` : "Preencha o Resultado do mês (Financeiro) para vir automático, ou digite."}>
            <CampoNumero valor={fixosPct} onChange={setFixosPct} placeholder="ex.: 15" />
          </Campo>
          <Campo rotulo="Meta de lucro (%)" dica="Acima dela: faz sentido."><CampoNumero valor={metaPct} onChange={setMetaPct} placeholder="ex.: 15" /></Campo>
          <Campo rotulo="Dias que vende por semana"><CampoNumero valor={diasSemana} onChange={setDiasSemana} /></Campo>
        </div>
      </details>
    </div>
  );
}

const ICONE_GRUPO = { marmita: UtensilsCrossed, bebida: CupSoda, sobremesa: IceCreamCone };

const BORDA_VEREDITO = { ok: "border-l-hf-accent", baixo: "border-l-hf-warning", prejuizo: "border-l-hf-danger", lucro: "border-l-hf-border", sem_dados: "border-l-hf-border" };
const VEREDITO_COR = { ok: "bg-hf-accent/10 text-hf-accent", baixo: "bg-hf-warning/10 text-hf-warning", prejuizo: "bg-hf-danger/10 text-hf-danger", lucro: "bg-hf-elevated text-hf-text-2", sem_dados: "bg-hf-elevated text-hf-muted" };
const SECOES_CARDAPIO = [["promocoes", "Promoções"], ["combos", "Combos"], ["marmitas", "Marmitas"]];

// Cardápio como o cliente vê (estilo iFood) e, ao lado, o lucro de cada item.
function CardapioVendas({ linhas, vendas, mudarVenda, diasSemana, custos, onRemoverOferta, msg, onEditar, irPara }) {
  const [aberto, setAberto] = useState(null);
  const p = projecaoDeVendas(linhas, vendas, { diasPorSemana: diasSemana });
  return (
    <Secao titulo="Cardápio de vendas" subtitulo="Como o cliente vê e, ao lado, quanto sobra para você em cada pedido (já sem impostos, taxas do canal, custo e fixos).">
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
          return (
            <div key={sec}>
              <p className="mb-2 flex items-center gap-2 text-sm font-black text-hf-text">{rot} <span className="rounded-full bg-hf-elevated px-2 text-xs text-hf-text-2">{lista.length}</span></p>
              <ul className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {lista.map((l) => {
                  const img = l.ficha?.imagem;
                  const abrir = aberto === l.id;
                  const c = l.ficha ? custos.get(l.ficha.id) : null;
                  return (
                    <li key={l.id} className={`rounded-2xl border border-hf-border border-l-4 bg-hf-surface p-3 ${BORDA_VEREDITO[l.veredito.id] || ""}`}>
                      <div className="flex items-start gap-3">
                        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-hf-elevated text-hf-muted">{img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed size={22} />}</div>
                        <div className="min-w-0 flex-1">
                          {l.rotulo && l.secao !== "marmitas" ? <span className="mb-0.5 inline-block rounded-md bg-hf-danger/10 px-1.5 py-0.5 text-[11px] font-black text-hf-danger">{l.rotulo}</span> : null}
                          <p className="break-words text-sm font-bold text-hf-text">{l.nome}</p>
                          {l.descricao && <p className="truncate text-xs text-hf-muted">{l.descricao}</p>}
                          <p className="text-sm font-bold tabular-nums text-hf-text">
                            {l.semPreco ? <span className="text-hf-warning">Sem preço</span> : <>
                              {l.precoCheio > l.precoPago && <span className="mr-1.5 text-xs font-semibold text-hf-muted line-through">{brl(l.precoCheio)}</span>}
                              {brl(l.precoPago)}{l.oferta?.tipo === "leve_pague" ? <span className="text-xs font-semibold text-hf-muted"> por {l.sim?.com?.pedido?.unidades} un.</span> : null}
                            </>}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-[1fr_96px] items-end gap-3 rounded-xl bg-hf-elevated p-2.5">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase text-hf-muted">Lucro líquido por pedido</p>
                          <p className={`text-lg font-black tabular-nums ${l.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>{l.lucro == null ? "—" : brl(l.lucro)} <span className="text-xs font-bold text-hf-text-2">{pctTxt(l.lucroPct)}</span></p>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-black ${VEREDITO_COR[l.veredito.id]}`}>{l.veredito.rotulo}</span>
                        </div>
                        <label className="text-[11px] font-bold uppercase text-hf-muted">Vendo/dia
                          <CampoNumero valor={vendas[l.id] ?? ""} onChange={(v) => mudarVenda(l.id, v)} placeholder="0" aria-label={`Vendas por dia de ${l.nome}`} />
                        </label>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3">
                        {!l.semPreco && <button type="button" onClick={() => setAberto(abrir ? null : l.id)} aria-expanded={abrir} className="inline-flex items-center gap-1 text-xs font-bold text-hf-accent hover:underline">{abrir ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {abrir ? "Esconder custos" : "Ver custos e se faz sentido"}</button>}
                        {onEditar && l.ficha && <button type="button" onClick={() => onEditar(l.ficha)} className="text-xs font-bold text-hf-text hover:underline">Editar marmita</button>}
                        {l.secao === "promocoes" && <button type="button" onClick={() => onRemoverOferta(l.id)} className="text-xs font-bold text-hf-text-2 hover:text-hf-danger">Tirar do cardápio</button>}
                      </div>
                      {abrir && l.sim && (
                        <div className="mt-2">
                          {c && <p className="text-xs text-hf-text-2">Custo de 1 marmita: alimentos {brl(c.alimentos)} · pré-preparos {brl(c.prePreparos)} · embalagens {brl(c.embalagens)} = <b>{brl(c.total)}</b>{!c.completo ? " (incompleto)" : ""}</p>}
                          {l.secao === "combos" && <p className="text-xs text-hf-text-2">Itens: {l.itens.map((i) => `${i.nome} (custo ${i.custo == null ? "—" : brl(i.custo)})`).join(" · ")}</p>}
                          {l.secao === "marmitas" ? <Comparacao s={{ ...l.sim, sem: l.sim.com }} rotuloSem="Preço cheio" rotuloCom="Preço cheio" unico /> : <Comparacao s={l.sim} rotuloSem={l.secao === "combos" ? "Separado" : "Sem promoção"} rotuloCom={l.secao === "combos" ? "Combo" : "Com promoção"} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {!linhas.length && <p className="text-sm text-hf-text-2">Cadastre marmitas para montar o cardápio.</p>}
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

function SimuladorPromocao({ catalogo, comum, onAdicionar }) {
  const opcoes = [...catalogo.marmita, ...catalogo.bebida, ...catalogo.sobremesa];
  const [itemId, setItemId] = useState(catalogo.marmita[0]?.id || opcoes[0]?.id || "");
  const [qtd, setQtd] = useState("1");
  const [precoSim, setPrecoSim] = useState("");
  const [oferta, setOferta] = useState({ tipo: "leve_pague", leve: "2", pague: "1", valor: "" });
  const base0 = opcoes.find((o) => o.id === itemId);
  // Preço digitado só para simular (o da marmita não muda).
  const item = base0 && String(precoSim).trim() ? { ...base0, preco: precoSim } : base0;
  if (!opcoes.length) return <Secao titulo="Simular promoção"><p className="text-sm text-hf-text-2">Cadastre uma marmita para simular.</p></Secao>;
  const s = item ? simularOferta({ itens: [{ ...item, qtd }], oferta, ...comum }) : null;
  const atalhos = [["2 por 1", { tipo: "leve_pague", leve: "2", pague: "1" }], ["3 por 2", { tipo: "leve_pague", leve: "3", pague: "2" }], ["10% off", { tipo: "desconto_pct", valor: "10" }], ["20% off", { tipo: "desconto_pct", valor: "20" }], ["R$ 5 off", { tipo: "desconto_rs", valor: "5" }]];
  return (
    <Secao titulo="Nova promoção" subtitulo="Escolha a marmita e a promoção, veja o lucro e coloque no cardápio.">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px]">
        <Campo rotulo="Produto">
          <select className={inputCls} value={itemId} onChange={(e) => { setItemId(e.target.value); setPrecoSim(""); }}>
            {["marmita", "bebida", "sobremesa"].map((g) => catalogo[g].length ? <optgroup key={g} label={ROTULO_GRUPO[g]}>{catalogo[g].map((o) => <option key={o.id} value={o.id}>{o.nome}{o.preco ? ` · ${brl(o.preco)}` : ""}</option>)}</optgroup> : null)}
          </select>
        </Campo>
        <Campo rotulo="Preço (R$)" dica={base0?.preco ? `Hoje: ${brl(base0.preco)}` : "Sem preço cadastrado"}><CampoNumero valor={precoSim} onChange={setPrecoSim} placeholder={base0?.preco ? String(base0.preco).replace(".", ",") : "0,00"} /></Campo>
        <Campo rotulo="Quantidade"><CampoNumero valor={qtd} onChange={setQtd} /></Campo>
      </div>
      {base0 && !(Number(String(item.preco).replace(",", ".")) > 0) && <Aviso tipo="alerta" className="mt-3">{base0.nome} está sem preço: digite um preço acima para simular, ou cadastre na marmita.</Aviso>}
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
      {s && <Comparacao s={s} />}
      {onAdicionar && item && catalogo.marmita.some((m) => m.id === item.id) && oferta.tipo !== "nenhuma" && !String(precoSim).trim() && (
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
      {s && <Comparacao s={s} rotuloCom="Combo" rotuloSem="Separado" />}
    </li>
  );
}

function Comparacao({ s, rotuloCom = "Com promoção", rotuloSem = "Sem promoção", unico = false }) {
  const col = (titulo, r, destaque) => (
    <div className={`rounded-2xl p-3 ${destaque ? "border-2 border-hf-accent/40 bg-hf-accent/5" : "bg-hf-elevated"}`}>
      <p className="text-xs font-black uppercase tracking-wide text-hf-text-2">{titulo}</p>
      {!r.valido ? <p className="mt-1 text-sm text-hf-text-2">{r.motivo}</p> : (
        <dl className="mt-1 space-y-0.5 text-sm">
          <L r="Cliente paga" v={brl(r.pedido.paga)} forte />
          {r.pedido.unidades > 1 && <L r="Sai da cozinha" v={`${r.pedido.unidades} unidades`} />}
          {r.pedido.desconto > 0 && <L r="Desconto dado" v={`− ${brl(r.pedido.desconto)}`} />}
          <L r="Impostos" v={`− ${brl(r.tributos)}`} />
          <L r="Taxas do canal" v={`− ${brl(r.variaveis)}`} />
          <L r="Custo dos produtos" v={r.custo == null ? "—" : `− ${brl(r.custo)}`} />
          <L r="Custos fixos (rateio)" v={r.fixos == null ? "não informado" : `− ${brl(r.fixos)}`} />
          <div className={`mt-1 flex justify-between border-t border-hf-border pt-1.5 text-base font-black ${r.lucro < 0 ? "text-hf-danger" : "text-hf-text"}`}>
            <dt>{r.fixosInformados ? "Lucro líquido" : "Lucro antes dos fixos"}</dt><dd className="tabular-nums">{r.lucro == null ? "—" : `${brl(r.lucro)} · ${pctTxt(r.lucroPct)}`}</dd>
          </div>
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
