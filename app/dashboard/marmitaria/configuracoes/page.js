"use client";

// Os números que só o dono sabe: taxas de cada plataforma, regime de imposto,
// o que entra no custo de cada marmita, meta, encargos e rateio. O Cardápio lê
// tudo daqui. Nenhum vem preenchido com "valor de mercado": campo vazio = não
// configurado. Regime e custos mensais ficam dentro de `rateio` (jsonb).

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, brl, inputCls, lerNumero } from "../../../components/marmitaria/ui";
import { useBaseDosCustos } from "../../../components/marmitaria/useCustosEmbutidos";
import { salvarConfig, carregarEquipe } from "../../../lib/marmitaria/dados";
import IfoodConexao from "../../../components/integracoes/IfoodConexao";
import IfoodSincronizacao from "../../../components/integracoes/IfoodSincronizacao";
import { MODELOS_CANAL, PLATAFORMAS_PADRAO, normalizarCanal, validarCanal, encargosDaConfig, ENCARGOS_LEGAIS } from "../../../lib/marmitaria/nucleo.mjs";
import { custosEmbutidos } from "../../../lib/marmitaria/cardapio.mjs";

const SUGESTOES_FIXAS = ["Aluguel", "Luz", "Água", "Gás", "Telefone", "Internet", "Pró-labore", "Materiais de limpeza", "Contador", "Sistemas"];
const vazio = (v) => v === null || v === undefined ? "" : String(v).replace(".", ",");
// Taxa em branco é "não configurado"; só a comissão do balcão nasce zerada.
const canalEmBranco = (m) => {
  const c = normalizarCanal(m);
  return { ...c, comissao_pct: vazio(m.comissao_pct), taxa_pagamento_pct: "", taxa_fixa_pedido: "", entrega_subsidiada_pedido: "", promocao_pct: "", itens_por_pedido: 1 };
};

export default function ConfiguracoesPage() {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [cfg, setCfg] = useState(null);
  const [rhConfig, setRhConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const doSistema = useBaseDosCustos();
  const previa = useMemo(() => (cfg ? custosEmbutidos({ ...doSistema, config: { rateio: { ...cfg.rateio, custos_fixos: cfg.rateio.custos_fixos.map((x) => ({ ...x, valor: lerNumero(x.valor) })) } } }) : null), [cfg, doSistema]);

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
      encargos: { ...c.encargos }, rateio: { meta_lucro_reais: vazio(c.rateio?.meta_lucro_reais), meta_faturamento_mes: vazio(c.rateio?.meta_faturamento_mes), dias_operacao_mes: vazio(c.rateio?.dias_operacao_mes), padrao_pct: vazio(c.rateio?.padrao_pct), por_categoria: { ...(c.rateio?.por_categoria || {}), }, marmitas_mes: vazio(c.rateio?.marmitas_mes), cmo_mes: vazio(c.rateio?.cmo_mes), custos_fixos: (c.rateio?.custos_fixos || []).map((x) => ({ nome: x.nome, valor: vazio(x.valor) })) },
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
    const canais = cfg.canais.map((c) => normalizarCanal({ ...c, ...Object.fromEntries(["comissao_pct", "taxa_pagamento_pct", "promocao_pct", "taxa_fixa_pedido", "entrega_subsidiada_pedido", "itens_por_pedido"].map((k) => [k, lerNumero(c[k])])) }));
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
        rateio: { padrao_pct: lerNumero(cfg.rateio.padrao_pct), por_categoria: porCat, regime: mei ? "mei" : "", meta_lucro_reais: lerNumero(cfg.rateio.meta_lucro_reais), meta_faturamento_mes: lerNumero(cfg.rateio.meta_faturamento_mes), dias_operacao_mes: lerNumero(cfg.rateio.dias_operacao_mes),
          marmitas_mes: lerNumero(cfg.rateio.marmitas_mes), cmo_mes: lerNumero(cfg.rateio.cmo_mes),
          custos_fixos: cfg.rateio.custos_fixos.map((x) => ({ nome: String(x.nome || "").trim(), valor: lerNumero(x.valor) })).filter((x) => x.nome) },
        centros_diretos: cfg.centros_diretos,
      });
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      else { setMsg({ tipo: "info", texto: "Configurações salvas." }); await recarregar(); }
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Plataformas e taxas" subtitulo="Preencha com o que está no seu contrato. Campo vazio = não configurado, e o Cardápio não calcula o lucro dessa plataforma.">
        <div className="space-y-4">
          {cfg.canais.map((c, i) => (
            <div key={i} className="rounded-xl border border-hf-border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input className={`${inputCls} max-w-[200px] font-bold`} value={c.nome} onChange={(e) => mudarCanal(i, "nome", e.target.value)} aria-label="Nome do canal" />
                                <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={c.ativo !== false} onChange={(e) => mudarCanal(i, "ativo", e.target.checked)} />Ativo</label>
                <button type="button" aria-label="Remover canal" onClick={() => setCfg({ ...cfg, canais: cfg.canais.filter((_, j) => j !== i) })} className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Campo rotulo="Comissão da plataforma (%)"><CampoNumero valor={c.comissao_pct} onChange={(v) => mudarCanal(i, "comissao_pct", v)} placeholder="não configurado" /></Campo>
                <Campo rotulo="Taxa da maquininha / pagamento (%)"><CampoNumero valor={c.taxa_pagamento_pct} onChange={(v) => mudarCanal(i, "taxa_pagamento_pct", v)} placeholder="não configurado" disabled={c.pagamento_na_comissao} /></Campo>
                <Campo rotulo="Valor da entrega por pedido (R$)" dica="O que sai do seu bolso em cada entrega."><CampoNumero valor={c.entrega_subsidiada_pedido} onChange={(v) => mudarCanal(i, "entrega_subsidiada_pedido", v)} placeholder="0,00" /></Campo>
                <Campo rotulo="Taxa fixa por pedido (R$)"><CampoNumero valor={c.taxa_fixa_pedido} onChange={(v) => mudarCanal(i, "taxa_fixa_pedido", v)} placeholder="0,00" /></Campo>
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
                  <Campo rotulo="Promoção custeada (% do preço)"><CampoNumero valor={c.promocao_pct} onChange={(v) => mudarCanal(i, "promocao_pct", v)} placeholder="0" /></Campo>
                  <Campo rotulo="Marmitas por pedido (média)" dica="Divide as taxas por pedido."><CampoNumero valor={c.itens_por_pedido} onChange={(v) => mudarCanal(i, "itens_por_pedido", v)} placeholder="1" /></Campo>
                </div>
              </details>
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

      <Secao titulo="Imposto e meta">
        <label className="mb-3 flex min-h-[44px] items-center gap-2 text-sm font-semibold text-hf-text">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={cfg.regime === "mei"} onChange={(e) => setCfg({ ...cfg, regime: e.target.checked ? "mei" : "" })} />
          Sou MEI: sem imposto sobre as vendas
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {cfg.regime !== "mei" && (
            <Campo rotulo="Imposto sobre as vendas (%)" dica={base?.config?.doResultado?.tributos_pct ? `Em branco: ${base.config.tributos_pct}% (impostos do Resultado do mês).` : "Ex.: a alíquota efetiva do Simples. Confirme com o contador."}><CampoNumero valor={cfg.tributos_pct} onChange={(v) => setCfg({ ...cfg, tributos_pct: v })} placeholder={base?.config?.doResultado?.tributos_pct ? `${base.config.tributos_pct} (Resultado do mês)` : "não configurado"} /></Campo>
          )}
          <Campo rotulo="Meta de lucro (%)" dica={base?.config?.doResultado?.margem_alvo_pct ? `Em branco: ${base.config.margem_alvo_pct}% (meta do Resultado do mês). Usada para sugerir preços.` : "Usada para sugerir preços no Cardápio."}><CampoNumero valor={cfg.margem_alvo_pct} onChange={(v) => setCfg({ ...cfg, margem_alvo_pct: v })} placeholder={base?.config?.doResultado?.margem_alvo_pct ? `${base.config.margem_alvo_pct} (Resultado do mês)` : "não configurado"} /></Campo>
          <Campo rotulo="Meta de lucro (R$ por marmita)" dica="Se preencher, vale no lugar da porcentagem: o preço sugerido garante esse valor no bolso."><CampoNumero valor={cfg.rateio.meta_lucro_reais} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, meta_lucro_reais: v } })} placeholder="ex.: 10" /></Campo>
          <Campo rotulo="Meta de faturamento do mês (R$)" dica="Usada em Faturamento, na aba Metas."><CampoNumero valor={cfg.rateio.meta_faturamento_mes} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, meta_faturamento_mes: v } })} placeholder="ex.: 150000" /></Campo>
          <Campo rotulo="Dias de operação no mês" dica="Divide os custos por dia e define o ponto de equilíbrio."><CampoNumero valor={cfg.rateio.dias_operacao_mes} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, dias_operacao_mes: v } })} placeholder="ex.: 26" /></Campo>
        </div>
      </Secao>

      <Secao titulo="Equipe e custos dentro de cada marmita" subtitulo="O Cardápio divide o custo do mês pelas marmitas do mês e desconta do lucro. É uma estimativa.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Marmitas por mês" dica={doSistema.vendidasMes > 0 ? `Em branco: ${doSistema.vendidasMes} vendidas no mês passado.` : "Quantas você espera vender."}><CampoNumero valor={cfg.rateio.marmitas_mes} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, marmitas_mes: v } })} placeholder="não configurado" /></Campo>
          <Campo rotulo="Equipe por mês (R$)" dica={doSistema.cmoMes > 0 ? `Em branco: ${brl(doSistema.cmoMes)} do RH (Funcionários).` : "Em branco: vem do RH, de quem está em Funcionários."}><CampoNumero valor={cfg.rateio.cmo_mes} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, cmo_mes: v } })} placeholder={doSistema.cmoMes > 0 ? vazio(doSistema.cmoMes) : "não configurado"} /></Campo>
        </div>
        <p className="mb-1 mt-4 text-sm font-bold text-hf-text">Custos fixos do mês</p>
        <p className="mb-2 text-xs text-hf-muted">{doSistema.fixosContasMes > 0 ? `Sem nada aqui, valem ${brl(doSistema.fixosContasMes)} das contas do mês passado.` : "Coloque o valor de cada conta. Entra sozinho no preço de cada marmita."}</p>
        <ul className="space-y-2">
          {cfg.rateio.custos_fixos.map((c, i) => (
            <li key={i} className="grid grid-cols-[1fr_120px_44px] items-center gap-2">
              <input className={inputCls} value={c.nome} aria-label="Nome da conta" onChange={(e) => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: cfg.rateio.custos_fixos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) } })} />
              <CampoNumero valor={c.valor} placeholder="0,00" aria-label={`Valor de ${c.nome || "conta"}`} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: cfg.rateio.custos_fixos.map((x, j) => (j === i ? { ...x, valor: v } : x)) } })} />
              <button type="button" aria-label={`Tirar ${c.nome || "conta"}`} onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: cfg.rateio.custos_fixos.filter((_, j) => j !== i) } })} className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGESTOES_FIXAS.filter((n) => !cfg.rateio.custos_fixos.some((c) => c.nome === n)).map((n) => <button key={n} type="button" onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: [...cfg.rateio.custos_fixos, { nome: n, valor: "" }] } })} className="min-h-[40px] rounded-full border border-hf-border px-3 text-sm font-semibold text-hf-text-2"><Plus size={13} className="mr-1 inline" />{n}</button>)}
          <button type="button" onClick={() => setCfg({ ...cfg, rateio: { ...cfg.rateio, custos_fixos: [...cfg.rateio.custos_fixos, { nome: "", valor: "" }] } })} className="min-h-[40px] rounded-full border border-dashed border-hf-border-strong px-3 text-sm font-semibold text-hf-accent">Outra conta</button>
        </div>
        <p className="mt-3 text-sm text-hf-text-2">
          {previa?.completo ? <>Cada marmita carrega <b className="tabular-nums">{brl(previa.cmoPorMarmita)}</b> de equipe e <b className="tabular-nums">{brl(previa.fixosPorMarmita)}</b> de custos fixos.</>
            : <>DADOS INSUFICIENTES: falta {previa?.faltando.join(", ")}.</>}
        </p>
      </Secao>

      <Secao titulo="Encargos e provisões (CMO)" subtitulo="Somados ao salário do cadastro do RH para estimar o custo de quem trabalha na marmitaria.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="FGTS (%)" dica={`Legal: ${ENCARGOS_LEGAIS.fgts_pct}%`}><CampoNumero valor={cfg.encargos.fgts_pct ?? ""} onChange={(v) => setCfg({ ...cfg, encargos: { ...cfg.encargos, fgts_pct: v } })} placeholder={String(ENCARGOS_LEGAIS.fgts_pct)} /></Campo>
          <Campo rotulo="INSS patronal + RAT + terceiros (%)" dica={`Atual: ${enc.inss_patronal_pct}% — ${enc.origemInss}`}><CampoNumero valor={cfg.encargos.inss_patronal_pct ?? ""} onChange={(v) => setCfg({ ...cfg, encargos: { ...cfg.encargos, inss_patronal_pct: v } })} placeholder={String(enc.inss_patronal_pct)} /></Campo>
          <Campo rotulo="Critério de divisão do compartilhado">
            <select className={inputCls} value={cfg.encargos.criterio || "percentual"} onChange={(e) => setCfg({ ...cfg, encargos: { ...cfg.encargos, criterio: e.target.value } })}>
              <option value="percentual">% do tempo informado</option><option value="horas">Horas por semana ÷ 44 h</option>
            </select>
          </Campo>
          <Campo rotulo="Provisão de 13º (%)" dica="1/12 do salário"><CampoNumero valor={cfg.encargos.provisao_13_pct ?? ""} onChange={(v) => setCfg({ ...cfg, encargos: { ...cfg.encargos, provisao_13_pct: v } })} placeholder={String(ENCARGOS_LEGAIS.provisao_13_pct).replace(".", ",")} /></Campo>
          <Campo rotulo="Provisão de férias + 1/3 (%)" dica="1/12 × 4/3 do salário"><CampoNumero valor={cfg.encargos.provisao_ferias_pct ?? ""} onChange={(v) => setCfg({ ...cfg, encargos: { ...cfg.encargos, provisao_ferias_pct: v } })} placeholder={String(ENCARGOS_LEGAIS.provisao_ferias_pct).replace(".", ",")} /></Campo>
        </div>
      </Secao>

      <Secao titulo="iFood" subtitulo="Conexão com a sua loja no iFood. As taxas ficam em Plataformas e taxas.">
        <IfoodConexao unidadeId={unidadeId} />
        <IfoodSincronizacao unidadeId={unidadeId} marmitas={base.marmitas} />
      </Secao>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-hf-border bg-hf-surface/95 p-2 backdrop-blur">
        <Botao onClick={salvar} disabled={salvando} className="min-w-[180px]">{salvando ? "Salvando…" : "Salvar configurações"}</Botao>
      </div>
    </div>
  );
}
