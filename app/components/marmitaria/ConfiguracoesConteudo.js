"use client";

// Os números que só o dono sabe: taxas de cada plataforma, regime de imposto,
// o que entra no custo de cada marmita, meta, encargos e rateio. O Cardápio lê
// tudo daqui. Nenhum vem preenchido com "valor de mercado": campo vazio = não
// configurado. Regime e custos mensais ficam dentro de `rateio` (jsonb).
//
// Sequência da marmitaria (16/11/2026): a mesma tela em duas partes, uma por
// passo. parte="custos" (passo 2: equipe, custos fixos e variáveis, imposto,
// encargos) e parte="apps" (passo 3: apps, planos, taxas e a calculadora de
// cada um). parte="tudo" mostra as duas (Custos e apps, no dia a dia).

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, brl, inputCls, lerNumero } from "./ui";
import { useBaseDosCustos } from "./useCustosEmbutidos";
import { salvarConfig, carregarEquipe } from "../../lib/marmitaria/dados";
import IfoodConexao from "../integracoes/IfoodConexao";
import IfoodSincronizacao from "../integracoes/IfoodSincronizacao";
import { MODELOS_CANAL, PLATAFORMAS_PADRAO, taxaDaFatura, normalizarCanal, novoPlanoDoCanal, resultadoPorCanal, validarCanal, encargosDaConfig, ENCARGOS_LEGAIS } from "../../lib/marmitaria/nucleo.mjs";
import { useJornada } from "./useJornada";
import { custosEmbutidos } from "../../lib/marmitaria/cardapio.mjs";

const SUGESTOES_FIXAS = ["Pró-labore", "Aluguel", "Luz", "Água", "Gás", "Telefone", "Internet", "Materiais de limpeza", "Contador", "Sistemas"];
// Gasto que acompanha cada marmita vendida e não está na ficha técnica.
const SUGESTOES_VARIAVEIS = ["Gás por marmita", "Talher descartável", "Guardanapo", "Sachês", "Etiqueta"];
const vazio = (v) => v === null || v === undefined ? "" : String(v).replace(".", ",");
// Taxa em branco é "não configurado"; só a comissão do balcão nasce zerada.
const canalEmBranco = (m) => {
  const c = normalizarCanal(m);
  return { ...c, comissao_pct: vazio(m.comissao_pct), taxa_pagamento_pct: "", taxa_fixa_pedido: "", entrega_subsidiada_pedido: "", promocao_pct: "", itens_por_pedido: 1 };
};

// Calculadora de cada app: "vendendo a R$ X, quanto sobra para mim?"
function Calculadora({ canal, tributosPct }) {
  const [preco, setPreco] = useState("");
  const P = lerNumero(preco);
  const c = normalizarCanal({ ...canal, ...Object.fromEntries(["comissao_pct", "taxa_pagamento_pct", "promocao_pct", "taxa_fixa_pedido", "entrega_subsidiada_pedido", "itens_por_pedido"].map((k) => [k, lerNumero(canal[k])])) });
  const r = P > 0 ? resultadoPorCanal({ preco: P, custoTecnico: 0, canal: c, tributosPct }) : null;
  return (
    <div className="mt-3 rounded-lg bg-hf-elevated p-3">
      <p className="mb-2 text-xs font-bold text-hf-text-2">Calculadora deste app</p>
      <div className="grid items-end gap-3 sm:grid-cols-[160px_1fr]">
        <Campo rotulo="Vendendo a"><CampoNumero prefixo="R$" valor={preco} onChange={setPreco} placeholder="ex.: 25,90" /></Campo>
        {r?.valido ? (
          <p className="text-sm text-hf-text-2">
            O app e o pagamento ficam com <b className="tabular-nums">{brl(r.taxasCanal + r.entrega + r.promocao)}</b>
            {r.tributos > 0 && <>, o imposto com <b className="tabular-nums">{brl(r.tributos)}</b></>}.
            {" "}Sobram <b className="tabular-nums text-hf-text">{brl(r.margemContribuicao)}</b> para pagar a marmita e o lucro.
            {r.avisos.length > 0 && <span className="block text-xs text-hf-warning">{r.avisos[0]}</span>}
          </p>
        ) : <p className="text-sm text-hf-muted">Digite um preço para ver quanto sobra.</p>}
      </div>
    </div>
  );
}

// Fatura do app (especificação do dono, 21/11/2026): a taxa do contrato e a
// taxa REAL da fatura podem ser diferentes. Ex. 99Food: contrato 8,9% + 3,2%;
// fatura 02/11–06/12: ganhos R$ 799,80, ofertas R$ 85,92, taxas R$ 107,02 →
// 24,12% no total. A taxa da fatura é média do período (HIPÓTESE), não contrato.
const pctBR = (v) => `${String(Math.round(v * 100) / 100).replace(".", ",")}%`;
function FaturaDoApp({ canal, mudar }) {
  const f = taxaDaFatura({ ganhos: canal.fatura_ganhos, ofertas: canal.fatura_ofertas, taxas: canal.fatura_taxas });
  const contrato = (Number(String(canal.comissao_pct ?? "").replace(",", ".")) || 0) + (canal.pagamento_na_comissao ? 0 : Number(String(canal.taxa_pagamento_pct ?? "").replace(",", ".")) || 0);
  const preenchida = [canal.fatura_ganhos, canal.fatura_ofertas, canal.fatura_taxas].some((v) => String(v ?? "").trim() !== "");
  return (
    <details className="mt-2 rounded-xl border border-hf-border bg-hf-elevated/40 p-3" open={!!canal.usar_fatura}>
      <summary className="min-h-[36px] cursor-pointer py-1 text-sm font-bold text-hf-text">Conferir com a fatura do app {f ? `· ${pctBR(f.totalPct)} real` : ""}</summary>
      <p className="mt-1 text-xs text-hf-text-2">Copie os totais de uma fatura. O sistema mostra quanto o app levou de verdade, para comparar com o contrato.</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Campo rotulo="Ganhos totais"><CampoNumero prefixo="R$" valor={canal.fatura_ganhos ?? ""} onChange={(v) => mudar("fatura_ganhos", v)} placeholder="0,00" /></Campo>
        <Campo rotulo="Ofertas pagas pela loja"><CampoNumero prefixo="R$" valor={canal.fatura_ofertas ?? ""} onChange={(v) => mudar("fatura_ofertas", v)} placeholder="0,00" /></Campo>
        <Campo rotulo="Taxas do app"><CampoNumero prefixo="R$" valor={canal.fatura_taxas ?? ""} onChange={(v) => mudar("fatura_taxas", v)} placeholder="0,00" /></Campo>
        <Campo rotulo="Período da fatura"><input className={inputCls} value={canal.fatura_periodo || ""} onChange={(e) => mudar("fatura_periodo", e.target.value)} placeholder="Ex.: 02/11 a 06/12" /></Campo>
      </div>
      {preenchida && !f && <Aviso tipo="alerta" className="mt-2">Confira os valores: ofertas mais taxas não podem passar dos ganhos.</Aviso>}
      {f && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-hf-surface p-2"><p className="text-[11px] text-hf-muted">Chegou para você</p><p className="font-black tabular-nums">{brl(f.liquido)}</p><p className="text-[11px] text-hf-muted">{pctBR(f.repassePct)}</p></div>
            <div className="rounded-lg bg-hf-surface p-2"><p className="text-[11px] text-hf-muted">Ofertas da loja</p><p className="font-black tabular-nums">{pctBR(f.ofertasPct)}</p></div>
            <div className="rounded-lg bg-hf-surface p-2"><p className="text-[11px] text-hf-muted">Taxas reais</p><p className="font-black tabular-nums">{pctBR(f.taxasPct)}</p><p className="text-[11px] text-hf-muted">contrato: {contrato > 0 ? pctBR(contrato) : "não informado"}</p></div>
            <div className="rounded-lg bg-hf-surface p-2"><p className="text-[11px] text-hf-muted">Total que o app levou</p><p className="font-black tabular-nums">{pctBR(f.totalPct)}</p></div>
          </div>
          <label className="mt-3 flex min-h-[44px] items-start gap-2 text-sm text-hf-text">
            <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[rgb(var(--hf-accent))]" checked={!!canal.usar_fatura} onChange={(e) => mudar("usar_fatura", e.target.checked)} />
            <span>Calcular os preços deste app com a taxa real da fatura ({pctBR(f.totalPct)}). <span className="text-hf-muted">É uma média do período (estimativa), não o contrato.</span></span>
          </label>
        </>
      )}
    </details>
  );
}

export default function ConfiguracoesConteudo({ parte = "tudo" }) {
  const mostraApps = parte !== "custos";
  const mostraCustos = parte !== "apps";
  const { recarregarJornada } = useJornada();
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [cfg, setCfg] = useState(null);
  const [rhConfig, setRhConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const doSistema = useBaseDosCustos();
  const previa = useMemo(() => (cfg ? custosEmbutidos({ ...doSistema, config: { rateio: { ...cfg.rateio, custos_fixos: cfg.rateio.custos_fixos.map((x) => ({ ...x, valor: lerNumero(x.valor) })), custos_variaveis: cfg.rateio.custos_variaveis.map((x) => ({ ...x, valor: lerNumero(x.valor) })) } } }) : null), [cfg, doSistema]);

  useEffect(() => {
    if (!base) return;
    const c = base.config;
    const salvos = c.canais.map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "number" && !["itens_por_pedido"].includes(k) ? vazio(v) : v])));
    const faltam = MODELOS_CANAL.filter((m) => PLATAFORMAS_PADRAO.includes(m.id) && !salvos.some((x) => x.id === m.id)).map(canalEmBranco);
    setCfg({
      canais: [...salvos, ...faltam],
      // O que veio do Resultado do mês fica vazio aqui (só aparece como sugestão),
      // senão salvar a config congelaria o valor daquele mês na marmitaria.
      tributos_pct: c.doResultado?.tributos_pct ? "" : vazio(c.tributos_pct),
      // O dono avisou que será MEI: vale de saída, até ele salvar outra escolha.
      regime: c.rateio?.regime ?? (base.configSalva ? "" : "mei"),
      margem_alvo_pct: c.doResultado?.margem_alvo_pct ? "" : vazio(c.margem_alvo_pct),
      encargos: { ...c.encargos }, rateio: { meta_lucro_reais: vazio(c.rateio?.meta_lucro_reais), meta_lucro_ate: vazio(c.rateio?.meta_lucro_ate), meta_faturamento_mes: vazio(c.rateio?.meta_faturamento_mes), dias_operacao_mes: vazio(c.rateio?.dias_operacao_mes), horas_operacao_dia: vazio(c.rateio?.horas_operacao_dia), padrao_pct: vazio(c.rateio?.padrao_pct), por_categoria: { ...(c.rateio?.por_categoria || {}), }, marmitas_mes: vazio(c.rateio?.marmitas_mes), cmo_mes: vazio(c.rateio?.cmo_mes), custos_fixos: (c.rateio?.custos_fixos || []).map((x) => ({ nome: x.nome, valor: vazio(x.valor) })), custos_variaveis: (c.rateio?.custos_variaveis || []).map((x) => ({ nome: x.nome, valor: vazio(x.valor) })) },
      centros_diretos: c.centros_diretos,
    });
  }, [base]);
  useEffect(() => { if (unidadeId) carregarEquipe(unidadeId).then((r) => setRhConfig(r.rhConfig || null)); }, [unidadeId]);

  if (!base || !cfg) return null;
  const usados = new Set(cfg.canais.map((c) => c.id));
  const mudarCanal = (i, campo, valor) => setCfg({ ...cfg, canais: cfg.canais.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)) });
  const enc = encargosDaConfig(Object.fromEntries(Object.entries(cfg.encargos).map(([k, v]) => [k, typeof v === "string" ? lerNumero(v) : v])), rhConfig);

  async function salvar() {
    if (salvando) return;
    setMsg(null);
    const canais = cfg.canais.map((c) => normalizarCanal({ ...c, ...Object.fromEntries(["comissao_pct", "taxa_pagamento_pct", "promocao_pct", "taxa_fixa_pedido", "entrega_subsidiada_pedido", "itens_por_pedido", "fatura_ganhos", "fatura_ofertas", "fatura_taxas"].map((k) => [k, lerNumero(c[k])])) }));
    const erros = canais.flatMap((c) => validarCanal(c).map((e) => `${c.nome || "Canal"}: ${e}`));
    if (new Set(canais.map((c) => c.id)).size !== canais.length) erros.push("Há dois canais com o mesmo identificador.");
    const mei = cfg.regime === "mei";
    const t = mei ? 0 : lerNumero(cfg.tributos_pct); const m = lerNumero(cfg.margem_alvo_pct);
    if (t !== "" && (t < 0 || t >= 100)) erros.push("Alíquota de tributos precisa ficar entre 0 e 100%.");
    if (m !== "" && (m < 0 || m >= 100)) erros.push("Margem-alvo precisa ficar entre 0 e 100%.");
    if (erros.length) return setMsg({ tipo: "alerta", texto: erros.join(" ") });
    const encargos = Object.fromEntries(Object.entries(cfg.encargos).map(([k, v]) => [k, k === "criterio" ? v : lerNumero(v)]).filter(([, v]) => v !== ""));
    const porCat = Object.fromEntries(Object.entries(cfg.rateio.por_categoria).map(([k, v]) => [k, lerNumero(v)]).filter(([, v]) => v !== ""));
    setSalvando(true);
    try {
      const r = await salvarConfig(unidadeId, {
        canais, tributos_pct: t, margem_alvo_pct: m, encargos,
        // Chaves do rateio que esta tela não edita ficam como estavam.
        rateio: { ...(base.config.rateio || {}), padrao_pct: lerNumero(cfg.rateio.padrao_pct), por_categoria: porCat, regime: mei ? "mei" : "", meta_lucro_reais: lerNumero(cfg.rateio.meta_lucro_reais), meta_lucro_ate: lerNumero(cfg.rateio.meta_lucro_ate), meta_faturamento_mes: lerNumero(cfg.rateio.meta_faturamento_mes), dias_operacao_mes: lerNumero(cfg.rateio.dias_operacao_mes), horas_operacao_dia: lerNumero(cfg.rateio.horas_operacao_dia),
          marmitas_mes: lerNumero(cfg.rateio.marmitas_mes), cmo_mes: lerNumero(cfg.rateio.cmo_mes),
          custos_fixos: cfg.rateio.custos_fixos.map((x) => ({ nome: String(x.nome || "").trim(), valor: lerNumero(x.valor) })).filter((x) => x.nome),
          custos_variaveis: cfg.rateio.custos_variaveis.map((x) => ({ nome: String(x.nome || "").trim(), valor: lerNumero(x.valor) })).filter((x) => x.nome) },
        centros_diretos: cfg.centros_diretos,
      });
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      else { setMsg({ tipo: "info", texto: "Configurações salvas." }); await recarregar(); recarregarJornada(); }
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      {mostraApps && (<>
      <Secao titulo="Apps e taxas" subtitulo="Cada app (e cada plano do mesmo app) com as taxas do seu contrato. Campo vazio = não configurado, e o lucro desse app não é calculado.">
        <div className="space-y-4">
          {cfg.canais.map((c, i) => (
            <div key={i} className="rounded-xl border border-hf-border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input className={`${inputCls} max-w-[200px] font-bold`} value={c.nome} onChange={(e) => mudarCanal(i, "nome", e.target.value)} aria-label="Nome do canal" />
                                <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={c.ativo !== false} onChange={(e) => mudarCanal(i, "ativo", e.target.checked)} />Ativo</label>
                <button type="button" aria-label="Remover canal" onClick={() => setCfg({ ...cfg, canais: cfg.canais.filter((_, j) => j !== i) })} className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Campo rotulo="Comissão da plataforma"><CampoNumero sufixo="%" valor={c.comissao_pct} onChange={(v) => mudarCanal(i, "comissao_pct", v)} placeholder="não configurado" /></Campo>
                <Campo rotulo="Taxa da maquininha / pagamento"><CampoNumero sufixo="%" valor={c.taxa_pagamento_pct} onChange={(v) => mudarCanal(i, "taxa_pagamento_pct", v)} placeholder="não configurado" disabled={c.pagamento_na_comissao} /></Campo>
                <Campo rotulo="Valor da entrega por pedido" dica="O que sai do seu bolso em cada entrega."><CampoNumero prefixo="R$" valor={c.entrega_subsidiada_pedido} onChange={(v) => mudarCanal(i, "entrega_subsidiada_pedido", v)} placeholder="0,00" /></Campo>
                <Campo rotulo="Taxa fixa por pedido"><CampoNumero prefixo="R$" valor={c.taxa_fixa_pedido} onChange={(v) => mudarCanal(i, "taxa_fixa_pedido", v)} placeholder="0,00" /></Campo>
              </div>
              <details className="mt-2">
                <summary className="min-h-[36px] cursor-pointer py-2 text-xs font-bold text-hf-text-2">Mais opções</summary>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <Campo rotulo="Modalidade"><input className={inputCls} value={c.modalidade || ""} onChange={(e) => mudarCanal(i, "modalidade", e.target.value)} placeholder="Ex.: plano, entrega própria" /></Campo>
                  <Campo rotulo="Comissão calculada sobre">
                    <select className={inputCls} value={c.comissao_base} onChange={(e) => mudarCanal(i, "comissao_base", e.target.value)}>
                      <option value="receita">Preço com desconto</option><option value="bruto">Preço cheio</option>
                    </select>
                  </Campo>
                  <label className="flex min-h-[44px] items-end gap-2 pb-2 text-sm text-hf-text-2"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={!!c.pagamento_na_comissao} onChange={(e) => mudarCanal(i, "pagamento_na_comissao", e.target.checked)} />Pagamento já incluso na comissão</label>
                  <Campo rotulo="Promoção custeada (% do preço)"><CampoNumero sufixo="%" valor={c.promocao_pct} onChange={(v) => mudarCanal(i, "promocao_pct", v)} placeholder="0" /></Campo>
                  <Campo rotulo="Marmitas por pedido (média)" dica="Divide as taxas por pedido."><CampoNumero sufixo="por pedido" valor={c.itens_por_pedido} onChange={(v) => mudarCanal(i, "itens_por_pedido", v)} placeholder="1" /></Campo>
                </div>
              </details>
              <FaturaDoApp canal={c} mudar={(k, v) => mudarCanal(i, k, v)} />
              <Calculadora canal={c} tributosPct={cfg.regime === "mei" ? 0 : lerNumero(cfg.tributos_pct) === "" ? base.config.tributos_pct : lerNumero(cfg.tributos_pct)} />
              <button type="button" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-hf-text-2 hover:text-hf-text"
                onClick={() => {
                  const novo = novoPlanoDoCanal(normalizarCanal({ ...c, comissao_pct: null }), cfg.canais.map((x) => x.id));
                  const canais = [...cfg.canais];
                  canais.splice(i + 1, 0, novo);
                  setCfg({ ...cfg, canais });
                }}><Plus size={15} /> Outro plano de {String(c.nome || "este app").split(" · ")[0]}</button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODELOS_CANAL.filter((m) => !usados.has(m.id)).map((m) => (
            <Botao key={m.id} variante="secundario" type="button" onClick={() => setCfg({ ...cfg, canais: [...cfg.canais, canalEmBranco(m)] })}><Plus size={15} /> {m.nome}</Botao>
          ))}
          <Botao variante="texto" type="button" onClick={() => {
            let n = cfg.canais.length + 1;
            while (usados.has(`canal_${n}`)) n++;
            setCfg({ ...cfg, canais: [...cfg.canais, { ...normalizarCanal({ id: `canal_${n}`, nome: "Outro canal" }), comissao_pct: "", taxa_pagamento_pct: "", itens_por_pedido: 1 }] });
          }}><Plus size={15} /> Outro canal</Botao>
        </div>
      </Secao>

      </>)}

      {mostraCustos && (<>
      <Secao titulo="Custos fixos, variáveis e equipe" subtitulo="Custos do mês divididos pelas marmitas do mês, mais o que sai em cada marmita. Entra sozinho no preço de cada uma.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Marmitas por mês" dica={doSistema.vendidasMes > 0 ? `Em branco: ${doSistema.vendidasMes} vendidas no mês passado.` : "Quantas você espera vender."}><CampoNumero valor={cfg.rateio.marmitas_mes} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, marmitas_mes: v } })} placeholder="não configurado" /></Campo>
          <Campo rotulo="Equipe por mês" dica={doSistema.cmoMes > 0 ? `Em branco: ${brl(doSistema.cmoMes)} do RH (Funcionários).` : "Em branco: vem do RH, de quem está em Funcionários."}><CampoNumero prefixo="R$" valor={cfg.rateio.cmo_mes} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, cmo_mes: v } })} placeholder={doSistema.cmoMes > 0 ? vazio(doSistema.cmoMes) : "não configurado"} /></Campo>
        </div>
        <p className="mb-1 mt-4 text-sm font-bold text-hf-text">Custos fixos do mês</p>
        <p className="mb-2 text-xs text-hf-muted">{doSistema.fixosContasMes > 0 ? `Sem nada aqui, valem ${brl(doSistema.fixosContasMes)} das contas do mês passado.` : "Coloque o valor de cada conta. Entra sozinho no preço de cada marmita."} O seu pró-labore entra aqui, na conta "Pró-labore", e aparece separado na precificação.</p>
        <ul className="space-y-2">
          {cfg.rateio.custos_fixos.map((c, i) => (
            <li key={i} className="grid grid-cols-[1fr_120px_44px] items-center gap-2">
              <input className={inputCls} value={c.nome} aria-label="Nome da conta" onChange={(e) => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: cfg.rateio.custos_fixos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) } })} />
              <CampoNumero prefixo="R$" valor={c.valor} placeholder="0,00" aria-label={`Valor de ${c.nome || "conta"}`} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: cfg.rateio.custos_fixos.map((x, j) => (j === i ? { ...x, valor: v } : x)) } })} />
              <button type="button" aria-label={`Tirar ${c.nome || "conta"}`} onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: cfg.rateio.custos_fixos.filter((_, j) => j !== i) } })} className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGESTOES_FIXAS.filter((n) => !cfg.rateio.custos_fixos.some((c) => c.nome === n)).map((n) => <button key={n} type="button" onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: [...cfg.rateio.custos_fixos, { nome: n, valor: "" }] } })} className="min-h-[40px] rounded-full border border-hf-border px-3 text-sm font-semibold text-hf-text-2"><Plus size={13} className="mr-1 inline" />{n}</button>)}
          <button type="button" onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: [...cfg.rateio.custos_fixos, { nome: "", valor: "" }] } })} className="min-h-[40px] rounded-full border border-dashed border-hf-border-strong px-3 text-sm font-semibold text-hf-accent">Outra conta</button>
        </div>
        <p className="mb-1 mt-5 text-sm font-bold text-hf-text">Custos variáveis por marmita</p>
        <p className="mb-2 text-xs text-hf-muted">O que sai a cada marmita vendida e não está na ficha técnica (a embalagem já está lá). Valor por marmita.</p>
        <ul className="space-y-2">
          {cfg.rateio.custos_variaveis.map((c, i) => (
            <li key={i} className="grid grid-cols-[1fr_120px_44px] items-center gap-2">
              <input className={inputCls} value={c.nome} aria-label="Nome do custo variável" onChange={(e) => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_variaveis: cfg.rateio.custos_variaveis.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) } })} />
              <CampoNumero prefixo="R$" valor={c.valor} placeholder="0,00" aria-label={`Valor por marmita de ${c.nome || "custo"}`} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_variaveis: cfg.rateio.custos_variaveis.map((x, j) => (j === i ? { ...x, valor: v } : x)) } })} />
              <button type="button" aria-label={`Tirar ${c.nome || "custo"}`} onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_variaveis: cfg.rateio.custos_variaveis.filter((_, j) => j !== i) } })} className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGESTOES_VARIAVEIS.filter((n) => !cfg.rateio.custos_variaveis.some((c) => c.nome === n)).map((n) => <button key={n} type="button" onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_variaveis: [...cfg.rateio.custos_variaveis, { nome: n, valor: "" }] } })} className="min-h-[40px] rounded-full border border-hf-border px-3 text-sm font-semibold text-hf-text-2"><Plus size={13} className="mr-1 inline" />{n}</button>)}
          <button type="button" onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_variaveis: [...cfg.rateio.custos_variaveis, { nome: "", valor: "" }] } })} className="min-h-[40px] rounded-full border border-dashed border-hf-border-strong px-3 text-sm font-semibold text-hf-accent">Outro custo</button>
        </div>
        <p className="mt-3 text-sm text-hf-text-2">
          {previa?.completo ? <>Cada marmita carrega <b className="tabular-nums">{brl(previa.cmoPorMarmita)}</b> de equipe, <b className="tabular-nums">{brl(previa.fixosPorMarmita)}</b> de custos fixos{previa.proLaborePorMarmita > 0 && <> (dos quais <b className="tabular-nums">{brl(previa.proLaborePorMarmita)}</b> são o seu pró-labore)</>}{previa.variaveisPorMarmita > 0 && <> e <b className="tabular-nums">{brl(previa.variaveisPorMarmita)}</b> de custos variáveis</>}: <b className="tabular-nums">{brl(previa.totalPorMarmita)}</b> além da ficha técnica. <span className="text-xs text-hf-muted">(equipe e fixos: ESTIMATIVA pelo volume do mês)</span></>
            : <>DADOS INSUFICIENTES: falta {previa?.faltando.join(", ")}.</>}
        </p>
      </Secao>

      <Secao titulo="Imposto e meta">
        <label className="mb-3 flex min-h-[44px] items-center gap-2 text-sm font-semibold text-hf-text">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={cfg.regime === "mei"} onChange={(e) => setCfg({ ...cfg, regime: e.target.checked ? "mei" : "" })} />
          Sou MEI: sem imposto sobre as vendas
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {cfg.regime !== "mei" && (
            <Campo rotulo="Imposto sobre as vendas" dica={base?.config?.doResultado?.tributos_pct ? `Em branco: ${base.config.tributos_pct}% (impostos do Resultado do mês).` : "Ex.: a alíquota efetiva do Simples. Confirme com o contador."}><CampoNumero sufixo="%" valor={cfg.tributos_pct} onChange={(v) => setCfg({ ...cfg, tributos_pct: v })} placeholder={base?.config?.doResultado?.tributos_pct ? `${base.config.tributos_pct} (Resultado do mês)` : "não configurado"} /></Campo>
          )}
          <Campo rotulo="Meta de lucro" dica={base?.config?.doResultado?.margem_alvo_pct ? `Em branco: ${base.config.margem_alvo_pct}% (meta do Resultado do mês). Usada para sugerir preços.` : "Usada para sugerir preços no Cardápio."}><CampoNumero sufixo="%" valor={cfg.margem_alvo_pct} onChange={(v) => setCfg({ ...cfg, margem_alvo_pct: v })} placeholder={base?.config?.doResultado?.margem_alvo_pct ? `${base.config.margem_alvo_pct} (Resultado do mês)` : "não configurado"} /></Campo>
          <Campo rotulo="Meta de lucro (R$ por marmita)" dica="Se preencher, vale no lugar da porcentagem: o preço sugerido garante esse valor no bolso."><CampoNumero prefixo="R$" valor={cfg.rateio.meta_lucro_reais} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, meta_lucro_reais: v } })} placeholder="ex.: 10" /></Campo>
          <Campo rotulo="Meta de lucro até (R$ por marmita)" dica="Opcional: o topo da faixa da meta (ex.: de R$ 10 a R$ 12). A Precificação mostra o preço das duas."><CampoNumero prefixo="R$" valor={cfg.rateio.meta_lucro_ate} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, meta_lucro_ate: v } })} placeholder="ex.: 12" /></Campo>
          <Campo rotulo="Meta de faturamento do mês" dica="Usada em Faturamento, na aba Metas."><CampoNumero prefixo="R$" valor={cfg.rateio.meta_faturamento_mes} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, meta_faturamento_mes: v } })} placeholder="ex.: 150000" /></Campo>
          <Campo rotulo="Dias de operação no mês" dica="Divide os custos por dia e define o ponto de equilíbrio."><CampoNumero sufixo="dias" valor={cfg.rateio.dias_operacao_mes} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, dias_operacao_mes: v } })} placeholder="ex.: 26" /></Campo>
          <Campo rotulo="Horas de operação por dia" dica="Mostra o custo operacional por hora e por minuto no Dashboard gerencial."><CampoNumero sufixo="horas" valor={cfg.rateio.horas_operacao_dia} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, horas_operacao_dia: v } })} placeholder="ex.: 9" /></Campo>
        </div>
      </Secao>

      <Secao titulo="Encargos e provisões (CMO)" subtitulo="Somados ao salário do cadastro do RH para estimar o custo de quem trabalha na marmitaria.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="FGTS" dica={`Legal: ${ENCARGOS_LEGAIS.fgts_pct}%`}><CampoNumero sufixo="%" valor={cfg.encargos.fgts_pct ?? ""} onChange={(v) => setCfg({ ...cfg, encargos: { ...cfg.encargos, fgts_pct: v } })} placeholder={String(ENCARGOS_LEGAIS.fgts_pct)} /></Campo>
          <Campo rotulo="INSS patronal + RAT + terceiros" dica={`Atual: ${enc.inss_patronal_pct}% — ${enc.origemInss}`}><CampoNumero sufixo="%" valor={cfg.encargos.inss_patronal_pct ?? ""} onChange={(v) => setCfg({ ...cfg, encargos: { ...cfg.encargos, inss_patronal_pct: v } })} placeholder={String(enc.inss_patronal_pct)} /></Campo>
          <Campo rotulo="Critério de divisão do compartilhado">
            <select className={inputCls} value={cfg.encargos.criterio || "percentual"} onChange={(e) => setCfg({ ...cfg, encargos: { ...cfg.encargos, criterio: e.target.value } })}>
              <option value="percentual">% do tempo informado</option><option value="horas">Horas por semana ÷ 44 h</option>
            </select>
          </Campo>
          <Campo rotulo="Provisão de 13º" dica="1/12 do salário"><CampoNumero sufixo="%" valor={cfg.encargos.provisao_13_pct ?? ""} onChange={(v) => setCfg({ ...cfg, encargos: { ...cfg.encargos, provisao_13_pct: v } })} placeholder={String(ENCARGOS_LEGAIS.provisao_13_pct).replace(".", ",")} /></Campo>
          <Campo rotulo="Provisão de férias + 1/3" dica="1/12 × 4/3 do salário"><CampoNumero sufixo="%" valor={cfg.encargos.provisao_ferias_pct ?? ""} onChange={(v) => setCfg({ ...cfg, encargos: { ...cfg.encargos, provisao_ferias_pct: v } })} placeholder={String(ENCARGOS_LEGAIS.provisao_ferias_pct).replace(".", ",")} /></Campo>
        </div>
      </Secao>

      </>)}

      {mostraApps && (
        <Secao titulo="iFood" subtitulo="Conexão com a sua loja no iFood. As taxas ficam em Apps e taxas.">
          <IfoodConexao unidadeId={unidadeId} />
          <IfoodSincronizacao unidadeId={unidadeId} marmitas={base.marmitas} />
        </Secao>
      )}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-hf-border bg-hf-surface/95 p-2 backdrop-blur">
        <Botao onClick={salvar} disabled={salvando} className="min-w-[180px]">{salvando ? "Salvando…" : parte === "custos" ? "Salvar custos" : parte === "apps" ? "Salvar apps e taxas" : "Salvar configurações"}</Botao>
      </div>
    </div>
  );
}
