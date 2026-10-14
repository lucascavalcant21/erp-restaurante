"use client";

// Os números que só o dono sabe: taxas do contrato de cada canal, alíquota,
// margem-alvo, encargos e se a unidade é só da marmitaria (negócio separado)
// ou compartilhada com o restaurante (aí entra o critério de rateio).
// Nenhum vem preenchido com "valor de mercado": campo vazio = não configurado.

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, inputCls, lerNumero } from "../../../components/marmitaria/ui";
import { salvarConfig, carregarEquipe } from "../../../lib/marmitaria/dados";
import IfoodConexao from "../../../components/integracoes/IfoodConexao";
import IfoodSincronizacao from "../../../components/integracoes/IfoodSincronizacao";
import { MODELOS_CANAL, normalizarCanal, validarCanal, encargosDaConfig, ENCARGOS_LEGAIS, UNIDADE_EXCLUSIVA } from "../../../lib/marmitaria/nucleo.mjs";

const RATEAVEIS = [
  ["ocupacao_aluguel", "Aluguel"], ["ocupacao_condominio", "Condomínio"], ["utilidades_energia", "Energia"], ["utilidades_agua", "Água"],
  ["utilidades_gas", "Gás"], ["utilidades_internet", "Internet e telefone"], ["adm_sistemas", "Sistemas"], ["adm_contabilidade", "Contabilidade"],
  ["marketing", "Marketing"], ["manutencao", "Manutenção"], ["limpeza", "Limpeza"],
];
const vazio = (v) => v === null || v === undefined ? "" : String(v).replace(".", ",");

export default function ConfiguracoesPage() {
  const { base, unidadeId, recarregar } = useMarmitaria();
  const [cfg, setCfg] = useState(null);
  const [rhConfig, setRhConfig] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!base) return;
    const c = base.config;
    setCfg({
      canais: c.canais.map((x) => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "number" && !["itens_por_pedido"].includes(k) ? vazio(v) : v]))),
      tributos_pct: vazio(c.tributos_pct), margem_alvo_pct: vazio(c.margem_alvo_pct),
      encargos: { ...c.encargos }, rateio: { padrao_pct: vazio(c.rateio?.padrao_pct), por_categoria: { ...(c.rateio?.por_categoria || {}) } },
      centros_diretos: c.centros_diretos,
    });
  }, [base]);
  useEffect(() => { if (unidadeId) carregarEquipe(unidadeId).then((r) => setRhConfig(r.rhConfig || null)); }, [unidadeId]);

  if (!base || !cfg) return null;
  const usados = new Set(cfg.canais.map((c) => c.id));
  const exclusiva = cfg.centros_diretos.includes(UNIDADE_EXCLUSIVA);
  const mudarCanal = (i, campo, valor) => setCfg({ ...cfg, canais: cfg.canais.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)) });
  const enc = encargosDaConfig(Object.fromEntries(Object.entries(cfg.encargos).map(([k, v]) => [k, typeof v === "string" ? lerNumero(v) : v])), rhConfig);

  async function salvar() {
    if (salvando) return;
    setMsg(null);
    const canais = cfg.canais.map((c) => normalizarCanal({ ...c, ...Object.fromEntries(["comissao_pct", "taxa_pagamento_pct", "promocao_pct", "taxa_fixa_pedido", "entrega_subsidiada_pedido", "itens_por_pedido"].map((k) => [k, lerNumero(c[k])])) }));
    const erros = canais.flatMap((c) => validarCanal(c).map((e) => `${c.nome || "Canal"}: ${e}`));
    if (new Set(canais.map((c) => c.id)).size !== canais.length) erros.push("Há dois canais com o mesmo identificador.");
    const t = lerNumero(cfg.tributos_pct); const m = lerNumero(cfg.margem_alvo_pct);
    if (t !== "" && (t < 0 || t >= 100)) erros.push("Alíquota de tributos precisa ficar entre 0 e 100%.");
    if (m !== "" && (m < 0 || m >= 100)) erros.push("Margem-alvo precisa ficar entre 0 e 100%.");
    if (erros.length) return setMsg({ tipo: "alerta", texto: erros.join(" ") });
    const encargos = Object.fromEntries(Object.entries(cfg.encargos).map(([k, v]) => [k, k === "criterio" ? v : lerNumero(v)]).filter(([, v]) => v !== ""));
    const porCat = Object.fromEntries(Object.entries(cfg.rateio.por_categoria).map(([k, v]) => [k, lerNumero(v)]).filter(([, v]) => v !== ""));
    setSalvando(true);
    try {
      const r = await salvarConfig(unidadeId, {
        canais, tributos_pct: t, margem_alvo_pct: m, encargos,
        rateio: { padrao_pct: lerNumero(cfg.rateio.padrao_pct), por_categoria: porCat }, centros_diretos: cfg.centros_diretos,
      });
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      else { setMsg({ tipo: "info", texto: "Configurações salvas." }); await recarregar(); }
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <Secao titulo="iFood" subtitulo="Conexão com a sua loja no iFood. As taxas do iFood ficam no canal abaixo.">
        <IfoodConexao unidadeId={unidadeId} />
        <IfoodSincronizacao unidadeId={unidadeId} marmitas={base.marmitas} />
      </Secao>
      <Secao titulo="Canais de venda e taxas" subtitulo="Preencha com o que está no SEU contrato (plano do iFood, maquininha). Campo vazio = não configurado.">
        <div className="space-y-4">
          {cfg.canais.map((c, i) => (
            <div key={i} className="rounded-xl border border-hf-border p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input className={`${inputCls} max-w-[200px] font-bold`} value={c.nome} onChange={(e) => mudarCanal(i, "nome", e.target.value)} aria-label="Nome do canal" />
                <input className={`${inputCls} max-w-[240px]`} value={c.modalidade || ""} onChange={(e) => mudarCanal(i, "modalidade", e.target.value)} placeholder="Modalidade (ex.: Plano Básico, entrega própria)" aria-label="Modalidade" />
                <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={c.ativo !== false} onChange={(e) => mudarCanal(i, "ativo", e.target.checked)} />Ativo</label>
                <button type="button" aria-label="Remover canal" onClick={() => setCfg({ ...cfg, canais: cfg.canais.filter((_, j) => j !== i) })} className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Campo rotulo="Comissão (%)"><CampoNumero valor={c.comissao_pct} onChange={(v) => mudarCanal(i, "comissao_pct", v)} placeholder="não configurado" /></Campo>
                <Campo rotulo="Comissão calculada sobre">
                  <select className={inputCls} value={c.comissao_base} onChange={(e) => mudarCanal(i, "comissao_base", e.target.value)}>
                    <option value="receita">Preço com desconto</option><option value="bruto">Preço cheio</option>
                  </select>
                </Campo>
                <Campo rotulo="Taxa de pagamento (%)"><CampoNumero valor={c.taxa_pagamento_pct} onChange={(v) => mudarCanal(i, "taxa_pagamento_pct", v)} placeholder="não configurado" disabled={c.pagamento_na_comissao} /></Campo>
                <label className="flex min-h-[44px] items-end gap-2 pb-2 text-sm text-hf-text-2"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={!!c.pagamento_na_comissao} onChange={(e) => mudarCanal(i, "pagamento_na_comissao", e.target.checked)} />Pagamento já incluso na comissão</label>
                <Campo rotulo="Taxa fixa por pedido (R$)"><CampoNumero valor={c.taxa_fixa_pedido} onChange={(v) => mudarCanal(i, "taxa_fixa_pedido", v)} placeholder="0,00" /></Campo>
                <Campo rotulo="Entrega paga pela empresa por pedido (R$)"><CampoNumero valor={c.entrega_subsidiada_pedido} onChange={(v) => mudarCanal(i, "entrega_subsidiada_pedido", v)} placeholder="0,00" /></Campo>
                <Campo rotulo="Promoção custeada (% do preço)"><CampoNumero valor={c.promocao_pct} onChange={(v) => mudarCanal(i, "promocao_pct", v)} placeholder="0" /></Campo>
                <Campo rotulo="Marmitas por pedido (média)" dica="Divide as taxas por pedido."><CampoNumero valor={c.itens_por_pedido} onChange={(v) => mudarCanal(i, "itens_por_pedido", v)} placeholder="1" /></Campo>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MODELOS_CANAL.filter((m) => !usados.has(m.id)).map((m) => (
            <Botao key={m.id} variante="secundario" type="button" onClick={() => setCfg({ ...cfg, canais: [...cfg.canais, { ...normalizarCanal(m), comissao_pct: "", taxa_pagamento_pct: "", taxa_fixa_pedido: "", entrega_subsidiada_pedido: "", promocao_pct: "", itens_por_pedido: 1 }] })}><Plus size={15} /> {m.nome}</Botao>
          ))}
          <Botao variante="texto" type="button" onClick={() => {
            let n = cfg.canais.length + 1;
            while (usados.has(`canal_${n}`)) n++;
            setCfg({ ...cfg, canais: [...cfg.canais, { ...normalizarCanal({ id: `canal_${n}`, nome: "Outro canal" }), comissao_pct: "", taxa_pagamento_pct: "", itens_por_pedido: 1 }] });
          }}><Plus size={15} /> Outro canal</Botao>
        </div>
      </Secao>

      <Secao titulo="Tributos e meta">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Alíquota sobre as vendas da marmitaria (%)" dica="Ex.: a alíquota efetiva do Simples. Confirme com o contador."><CampoNumero valor={cfg.tributos_pct} onChange={(v) => setCfg({ ...cfg, tributos_pct: v })} placeholder="não configurado" /></Campo>
          <Campo rotulo="Margem de contribuição-alvo (%)" dica="Usada para sugerir preços."><CampoNumero valor={cfg.margem_alvo_pct} onChange={(v) => setCfg({ ...cfg, margem_alvo_pct: v })} placeholder="não configurado" /></Campo>
        </div>
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

      <Secao titulo="Negócio e despesas" subtitulo="A marmitaria é um negócio separado do restaurante e de Eventos? Então ela tem unidade própria e todas as contas, estoques e funcionários desta unidade são dela.">
        <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${exclusiva ? "border-hf-accent bg-hf-accent/5" : "border-hf-border"}`}>
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={exclusiva}
            onChange={(e) => setCfg({ ...cfg, centros_diretos: e.target.checked ? [UNIDADE_EXCLUSIVA] : ["marmitaria"] })} />
          <span>
            <span className="block text-sm font-semibold text-hf-text">Esta unidade é só da marmitaria</span>
            <span className="block text-xs text-hf-muted">Toda conta a pagar desta unidade entra 100% no DRE da marmitaria, sem rateio e sem consolidar com o restaurante. Para criar a unidade: Configurações → Unidades → nova unidade “Marmitaria”.</span>
          </span>
        </label>
        {!exclusiva && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-hf-muted">Unidade compartilhada com o restaurante: contas com centro de custo Geral/Administrativo (ou sem centro) entram pelo % abaixo. Conta com centro Marmitaria entra 100%; de Cozinha, Bar, Salão ou Eventos não entra.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="% padrão para a marmitaria" dica="Vale para a categoria sem % próprio. Vazio = 0% e aviso no DRE."><CampoNumero valor={cfg.rateio.padrao_pct} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, padrao_pct: v } })} placeholder="não configurado" /></Campo>
              {RATEAVEIS.map(([cod, rot]) => (
                <Campo key={cod} rotulo={`${rot} (%)`}><CampoNumero valor={cfg.rateio.por_categoria[cod] ?? ""} onChange={(v) => setCfg({ ...cfg, rateio: { ...cfg.rateio, por_categoria: { ...cfg.rateio.por_categoria, [cod]: v } } })} placeholder="usa o padrão" /></Campo>
              ))}
            </div>
            <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-hf-text-2">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={cfg.centros_diretos.includes("delivery")}
                onChange={(e) => setCfg({ ...cfg, centros_diretos: e.target.checked ? [...new Set([...cfg.centros_diretos, "delivery"])] : cfg.centros_diretos.filter((x) => x !== "delivery") })} />
              Contas com centro de custo “Delivery” também são da marmitaria (100%)
            </label>
          </div>
        )}
      </Secao>

      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      <div className="sticky bottom-3 z-10 flex justify-end rounded-2xl border border-hf-border bg-hf-surface/95 p-2 backdrop-blur">
        <Botao onClick={salvar} disabled={salvando} className="min-w-[180px]">{salvando ? "Salvando…" : "Salvar configurações"}</Botao>
      </div>
    </div>
  );
}
