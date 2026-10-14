"use client";

// Simulador de vendas e lucro: uma tela só. Tudo aqui é SIMULAÇÃO — nada
// entra no resultado apurado. Mix, preços e custos vêm das marmitas
// cadastradas (editáveis); CMO pode vir da alocação atual.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Secao, SemDados, Selo, brl, inputCls, lerNumero, pctTxt } from "./ui";
import { carregarEquipe, salvarSimulacao } from "../../lib/marmitaria/dados";
import { CENARIOS_PADRAO, cmoMarmitaria, encargosDaConfig, simular } from "../../lib/marmitaria/nucleo.mjs";

const txt = (n) => (n === null || n === undefined ? "" : String(Math.round(n * 100) / 100).replace(".", ","));

export default function Simulador() {
  const { base, unidadeId, custos } = useMarmitaria();
  const canais = base.config.canais.filter((c) => c.ativo);
  const [cmoAtual, setCmoAtual] = useState(null);
  const [cenarios, setCenarios] = useState(CENARIOS_PADRAO.map(String));
  const [dias, setDias] = useState("26");
  const [cmo, setCmo] = useState("");
  const [despesas, setDespesas] = useState("");
  const [meta, setMeta] = useState("");
  const [mix, setMix] = useState(() => {
    const ms = base.marmitas.filter((m) => m.ativo !== false).slice(0, 3);
    return ms.map((m, i) => {
      const canal = canais[0]?.id || "";
      return { key: m.id, ficha_id: m.id, nome: m.nome_receita, participacao: ms.length ? txt(i === 0 ? 100 - Math.floor(100 / ms.length) * (ms.length - 1) : Math.floor(100 / ms.length)) : "100",
        canal, preco: txt(m.precos[canal] ?? Number(m.preco_venda)), custo: txt(custos.get(m.id)?.total ?? null) };
    });
  });
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!unidadeId) return;
    carregarEquipe(unidadeId).then((e) => {
      const r = cmoMarmitaria({ alocacoes: e.alocacoes || [], colaboradores: e.colaboradores || [], recibos: [], encargos: encargosDaConfig(base.config.encargos, e.rhConfig), mes: "" });
      setCmoAtual(r.linhas.length ? r.total : null);
    });
  }, [unidadeId, base]);

  const res = useMemo(() => simular({
    cenarios: cenarios.map(lerNumero).filter((n) => n > 0), diasMes: lerNumero(dias), tributosPct: base.config.tributos_pct,
    mix: mix.map((m) => ({ nome: m.nome, participacao: lerNumero(m.participacao), preco: lerNumero(m.preco), custo: lerNumero(m.custo), canal: m.canal })),
    canais: new Map(base.config.canais.map((c) => [c.id, c])), cmoMes: lerNumero(cmo) || 0, despesasMes: lerNumero(despesas) || 0,
    margemDesejadaPct: meta === "" ? null : lerNumero(meta),
  }), [cenarios, dias, mix, cmo, despesas, meta, base]);

  if (!base.marmitas.length) return <SemDados titulo="Cadastre marmitas para simular" href="/dashboard/marmitaria/marmitas" acao="Cadastrar marmita" />;
  const mudar = (key, campos) => setMix(mix.map((m) => (m.key === key ? { ...m, ...campos } : m)));

  async function guardar() {
    if (!res.valido) return;
    const r = await salvarSimulacao(unidadeId, { nome: `Simulação ${new Date().toLocaleDateString("pt-BR")}`, diasMes: lerNumero(dias), entradas: { cenarios, mix, cmo, despesas, meta }, resultado: res });
    setMsg(r.error ? { tipo: "alerta", texto: r.error } : { tipo: "info", texto: "Simulação guardada." });
  }

  return (
    <div className="space-y-4">
      <Aviso>Simulação: os números abaixo não são resultado apurado. O que aconteceu de verdade está na aba Resultado.</Aviso>
      <Secao titulo="Mix de marmitas" subtitulo="Participação de cada uma nas vendas (soma 100%), canal, preço e custo técnico (vem da ficha; dá para mudar aqui).">
        <ul className="space-y-2">
          {mix.map((m) => (
            <li key={m.key} className="grid grid-cols-2 gap-2 rounded-xl border border-hf-border p-2 sm:grid-cols-[1.5fr_90px_1fr_110px_110px_44px] sm:items-end">
              <Campo rotulo="Marmita" className="col-span-2 sm:col-span-1">
                <select className={inputCls} value={m.ficha_id} onChange={(e) => { const mm = base.marmitas.find((x) => x.id === e.target.value); mudar(m.key, { ficha_id: mm.id, nome: mm.nome_receita, preco: txt(mm.precos[m.canal] ?? Number(mm.preco_venda)), custo: txt(custos.get(mm.id)?.total ?? null) }); }}>
                  {base.marmitas.map((x) => <option key={x.id} value={x.id}>{x.nome_receita}</option>)}
                </select>
              </Campo>
              <Campo rotulo="% do mix"><CampoNumero valor={m.participacao} onChange={(v) => mudar(m.key, { participacao: v })} /></Campo>
              <Campo rotulo="Canal"><select className={inputCls} value={m.canal} onChange={(e) => mudar(m.key, { canal: e.target.value })}>{canais.length ? canais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>) : <option value="">Sem canais</option>}</select></Campo>
              <Campo rotulo="Preço (R$)"><CampoNumero valor={m.preco} onChange={(v) => mudar(m.key, { preco: v })} /></Campo>
              <Campo rotulo="Custo (R$)"><CampoNumero valor={m.custo} onChange={(v) => mudar(m.key, { custo: v })} /></Campo>
              <button type="button" aria-label="Remover" onClick={() => setMix(mix.filter((x) => x.key !== m.key))} className="flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        <Botao variante="texto" className="mt-2" onClick={() => { const mm = base.marmitas[0]; setMix([...mix, { key: `${mm.id}-${Date.now()}`, ficha_id: mm.id, nome: mm.nome_receita, participacao: "", canal: canais[0]?.id || "", preco: txt(Number(mm.preco_venda)), custo: txt(custos.get(mm.id)?.total ?? null) }]); }}><Plus size={15} /> Adicionar ao mix</Botao>
      </Secao>

      <Secao titulo="Custos do mês e meta">
        <div className="grid gap-3 sm:grid-cols-4">
          <Campo rotulo="Dias trabalhados no mês"><CampoNumero valor={dias} onChange={setDias} /></Campo>
          <Campo rotulo="Funcionários (CMO/mês, R$)" dica={cmoAtual !== null ? <button type="button" className="font-semibold text-hf-accent" onClick={() => setCmo(txt(cmoAtual))}>Usar o atual: {brl(cmoAtual)}</button> : "Sem alocação em Funcionários."}><CampoNumero valor={cmo} onChange={setCmo} /></Campo>
          <Campo rotulo="Despesas operacionais/mês (R$)" dica="Aluguel alocado, energia, gás, sistemas, marketing…"><CampoNumero valor={despesas} onChange={setDespesas} /></Campo>
          <Campo rotulo="Margem de lucro desejada (%)"><CampoNumero valor={meta} onChange={setMeta} /></Campo>
        </div>
        <p className="mb-1 mt-4 text-xs font-semibold text-hf-text-2">Cenários (marmitas por dia)</p>
        <div className="flex flex-wrap gap-2">{cenarios.map((c, i) => <CampoNumero key={i} valor={c} onChange={(v) => setCenarios(cenarios.map((x, j) => (j === i ? v : x)))} className="w-[90px]" aria-label={`Cenário ${i + 1}`} />)}</div>
      </Secao>

      {!res.valido ? <Aviso tipo="alerta">{res.motivo}</Aviso> : (
        <>
          {res.avisos.map((a) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}
          <div className="grid gap-3 sm:grid-cols-3">
            <Cartao><p className="text-xs text-hf-muted">Margem de contribuição por marmita <Selo natureza="simulacao" /></p><p className="text-2xl font-black tabular-nums">{brl(res.unitario.margemContribuicao)}</p><p className="text-xs text-hf-muted">{pctTxt(res.unitario.margemContribuicaoPct)} da receita · preço médio {brl(res.unitario.preco)}</p></Cartao>
            <Cartao><p className="text-xs text-hf-muted">Ponto de equilíbrio</p><p className="text-2xl font-black tabular-nums">{res.pontoEquilibrio ? `${res.pontoEquilibrio.marmitasDia}/dia` : "—"}</p><p className="text-xs text-hf-muted">{res.pontoEquilibrio ? `${res.pontoEquilibrio.marmitasMes} no mês · ${brl(res.pontoEquilibrio.faturamentoMes)}` : res.motivoPontoEquilibrio}</p></Cartao>
            <Cartao><p className="text-xs text-hf-muted">Para {meta ? pctTxt(lerNumero(meta), 0) : "a meta"} de margem líquida</p><p className="text-2xl font-black tabular-nums">{res.meta ? `${res.meta.marmitasDia}/dia` : "—"}</p><p className="text-xs text-hf-muted">{res.meta ? `${res.meta.marmitasMes} marmitas no mês` : res.motivoMeta}</p></Cartao>
          </div>
          <Secao titulo="Cenários" direita={<Botao variante="secundario" onClick={guardar}>Guardar simulação</Botao>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-hf-muted">
                  {["Marmitas/dia", "No mês", "Faturamento/dia", "Faturamento/mês", "CMV", "Tributos", "Taxas e entrega", "CMO", "Despesas", "Lucro", "Margem líquida"].map((c, i) => <th key={c} className={`py-2 pr-2 ${i ? "text-right" : ""}`}>{c}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-hf-border">
                  {res.cenarios.map((c) => (
                    <tr key={c.porDia}>
                      <td className="py-2 pr-2 font-bold">{c.porDia}</td>
                      {[c.total, c.faturamentoDia, c.faturamento, c.cmv, c.tributos, c.taxas, c.cmo, c.despesas].map((v, i) => <td key={i} className="py-2 pr-2 text-right tabular-nums">{i === 0 ? v.toLocaleString("pt-BR") : brl(v)}</td>)}
                      <td className={`py-2 pr-2 text-right font-bold tabular-nums ${c.lucro < 0 ? "text-hf-danger" : ""}`}>{brl(c.lucro)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{pctTxt(c.margemLiquidaPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {msg && <Aviso tipo={msg.tipo} className="mt-2">{msg.texto}</Aviso>}
          </Secao>
        </>
      )}
    </div>
  );
}
