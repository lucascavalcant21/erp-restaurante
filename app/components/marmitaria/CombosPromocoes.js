"use client";

// COMBOS E PROMOÇÕES (pedido do dono, 28/10/2026): combos de comida + bebida
// e comida + bebida + sobremesa; simular desconto e 2 por 1 vendo o lucro
// "tirando todos os custos". Contas em lib/marmitaria/promocoes.mjs. É
// simulação: nada grava venda. Os combos ficam salvos em config_sistema.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, Selo, brl, inputCls, pctTxt } from "./ui";
import {
  CANAL_DIRETO, TIPOS_OFERTA, MODELOS_COMBO, ROTULO_GRUPO,
  simularOferta, fixosPctDoResultado, catalogoParaCombo, normalizarCombo, itensDoCombo,
} from "../../lib/marmitaria/promocoes.mjs";
import { custoPorcaoDaFicha } from "../../lib/evento-financeiro.mjs";
import { fetchResultadoMensal, fetchCombosMarmitaria, salvarCombosMarmitaria } from "../../lib/parametros";

const chip = (ativo) => `h-10 rounded-xl border px-3 text-sm font-bold transition ${ativo ? "border-hf-accent bg-hf-accent text-white" : "border-hf-border bg-hf-surface text-hf-text-2 hover:bg-hf-elevated"}`;

export default function CombosPromocoes() {
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
  }, [unidadeId]);

  const catalogo = useMemo(() => catalogoParaCombo({
    marmitas: base.marmitas, custos, fichas: base.fichas,
    custoFicha: (f) => { const c = custoPorcaoDaFicha(f, base.fichas); return c > 0 ? c : null; },
    canalId: canal.id === "direto" ? null : canal.id,
  }), [base, custos, canal]);

  const comum = { canal, tributosPct: base.config.tributos_pct, fixosPct: fixosPct === "" ? null : fixosPct };

  async function salvarCombos(lista) {
    setSalvando(true); setMsg(null);
    const r = await salvarCombosMarmitaria(unidadeId, lista);
    setSalvando(false);
    setMsg(r?.error ? { tipo: "alerta", t: `Não foi possível salvar: ${r.error}` } : { tipo: "info", t: "Combos salvos." });
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Onde vende e custos fixos" subtitulo="Valem para as simulações abaixo.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Canal">
            <div className="flex flex-wrap gap-2">{canais.map((c) => <button key={c.id} type="button" className={chip(c.id === canal.id)} onClick={() => setCanalId(c.id)}>{c.nome}</button>)}</div>
          </Campo>
          <Campo rotulo="Custos fixos (% do faturamento)" dica={fixosDoMes != null ? `Resultado do mês: ${pctTxt(fixosDoMes)} (aluguel, energia, outros e depreciação). Equipe não entra aqui.` : "Preencha o Resultado do mês (Financeiro) para vir automático, ou digite."}>
            <CampoNumero valor={fixosPct} onChange={setFixosPct} placeholder="ex.: 15" />
          </Campo>
        </div>
        {canal.id === "direto" && <Aviso className="mt-3">Nenhum canal configurado: a conta usa venda direta, sem comissão. Configure iFood e WhatsApp em Configurações para ver por canal.</Aviso>}
        {(base.config.tributos_pct == null) && <Aviso tipo="alerta" className="mt-3">Impostos em branco: preencha em Financeiro → Resultado do mês.</Aviso>}
      </Secao>

      <SimuladorPromocao catalogo={catalogo} comum={comum} />

      <Secao titulo="Combos" subtitulo="Comida + bebida ou comida + bebida + sobremesa, com o lucro de cada um."
        direita={<div className="flex flex-wrap gap-2">
          {MODELOS_COMBO.map((m) => <Botao key={m.id} variante="secundario" onClick={() => setCombos((l) => [...l, normalizarCombo({ modelo: m.id, nome: m.rotulo })])}><Plus size={14} /> {m.rotulo}</Botao>)}
        </div>}>
        {!combos.length && <p className="text-sm text-hf-text-2">Nenhum combo ainda. Toque em um dos botões acima para montar.</p>}
        <ul className="space-y-3">
          {combos.map((c) => <LinhaCombo key={c.id} combo={c} catalogo={catalogo} comum={comum}
            onChange={(novo) => setCombos((l) => l.map((x) => (x.id === c.id ? normalizarCombo(novo) : x)))}
            onRemover={() => setCombos((l) => l.filter((x) => x.id !== c.id))} />)}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Botao onClick={() => salvarCombos(combos)} disabled={salvando}>{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar combos</Botao>
          {msg && <span className={`text-sm font-bold ${msg.tipo === "alerta" ? "text-hf-danger" : "text-hf-accent"}`}>{msg.t}</span>}
        </div>
      </Secao>
    </div>
  );
}

function SimuladorPromocao({ catalogo, comum }) {
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
    <Secao titulo="Simular promoção" subtitulo="Escolha a marmita e a promoção: veja o lucro com tudo descontado.">
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

function Comparacao({ s, rotuloCom = "Com promoção", rotuloSem = "Sem promoção" }) {
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
      <div className="grid gap-3 sm:grid-cols-2">{col(rotuloSem, s.sem, false)}{col(rotuloCom, s.com, true)}</div>
      <p className="mt-2 text-sm font-semibold text-hf-text">
        {s.prejuizo ? <span className="text-hf-danger">Essa promoção dá prejuízo em cada pedido.</span>
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
