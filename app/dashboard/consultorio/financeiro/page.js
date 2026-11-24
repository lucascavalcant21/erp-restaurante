"use client";

// Preço e lucro da consulta (dono, 21/11/2026: "controle de gastos e lucro,
// para saber quanto vai cobrar na consulta para dar lucro"). Mesma conta da
// marmita: custos do mês ÷ consultas, ponto de equilíbrio, preço para a meta,
// convênio por convênio e o resultado do mês pela agenda.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useConsultorio } from "../../../components/consultorio/contexto";
import { hojeLocal } from "../../../components/consultorio/partes";
import { Aviso, Botao, Campo, CampoNumero, Secao, brl, inputCls } from "../../../components/marmitaria/ui";
import { SUGESTOES_FIXOS, SUGESTOES_VARIAVEIS, analiseDoConvenio, cascataDaConsulta, consultasParaEquilibrio, contaDaConsulta, normalizarConfig, resultadoDoMes } from "../../../lib/consultorio/precificacao.mjs";
import { fetchConsultas, salvarConfig } from "../../../lib/consultorio/dados";

function ListaDeCustos({ titulo, dica, itens, sugestoes, onChange, sufixo }) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold text-hf-text">{titulo}</p>
      <p className="mb-2 text-xs text-hf-muted">{dica}</p>
      <ul className="space-y-2">
        {itens.map((c, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_130px_44px] items-center gap-2">
            <input className={inputCls} value={c.nome} aria-label="Nome do custo" onChange={(e) => onChange(itens.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
            <CampoNumero prefixo="R$" sufixo={sufixo} valor={c.valor} placeholder="0,00" aria-label={`Valor de ${c.nome || "custo"}`} onChange={(v) => onChange(itens.map((x, j) => (j === i ? { ...x, valor: v } : x)))} />
            <button type="button" aria-label={`Tirar ${c.nome || "custo"}`} onClick={() => onChange(itens.filter((_, j) => j !== i))} className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        {sugestoes.filter((n) => !itens.some((c) => c.nome === n)).map((n) => <button key={n} type="button" onClick={() => onChange([...itens, { nome: n, valor: "" }])} className="min-h-[40px] rounded-full border border-hf-border px-3 text-sm font-semibold text-hf-text-2"><Plus size={13} className="mr-1 inline" />{n}</button>)}
        <button type="button" onClick={() => onChange([...itens, { nome: "", valor: "" }])} className="min-h-[40px] rounded-full border border-dashed border-hf-border-strong px-3 text-sm font-semibold text-hf-accent">Outro</button>
      </div>
    </div>
  );
}

const Linha = ({ r, v, forte, tom = "" }) => (
  <div className={`flex items-baseline justify-between gap-3 py-1.5 text-sm ${forte ? "font-bold text-hf-text" : "text-hf-text-2"}`}><span>{r}</span><span className={`tabular-nums ${tom}`}>{v}</span></div>
);

export default function PrecoELucroConsultorio() {
  const { config, tiposAtivos, conveniosAtivos, recarregar } = useConsultorio();
  const [cfg, setCfg] = useState(() => normalizarConfig(config || {}));
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [doMes, setDoMes] = useState([]);
  const mes = hojeLocal().slice(0, 7);
  useEffect(() => { const [a, m] = mes.split("-").map(Number); fetchConsultas(new Date(a, m - 1, 1).toISOString(), new Date(a, m, 1).toISOString()).then((r) => setDoMes(r.data)); }, [mes]);
  const conta = useMemo(() => contaDaConsulta(cfg), [cfg]);
  const resultado = useMemo(() => resultadoDoMes({ consultas: doMes, conta, mes, hojeIso: hojeLocal() }), [doMes, conta, mes]);
  const mudar = (m) => { setMsg(null); setCfg((c) => ({ ...c, ...m })); };

  async function salvar() {
    setSalvando(true);
    const r = await salvarConfig({ ...(config || {}), ...cfg });
    setSalvando(false);
    setMsg(r.error ? { tipo: "alerta", texto: r.error } : { tipo: "info", texto: "Custos salvos." });
    if (!r.error) recarregar();
  }

  return (
    <div className="space-y-4">
      <Secao titulo="Quanto custa manter o consultório" subtitulo="Valores do mês. Daqui sai o custo de cada consulta e o preço mínimo para não ter prejuízo.">
        <div className="space-y-5">
          <ListaDeCustos titulo="Custos fixos do mês" dica="O que você paga todo mês, atendendo ou não." itens={cfg.custos_fixos} sugestoes={SUGESTOES_FIXOS} onChange={(l) => mudar({ custos_fixos: l })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Seu pró-labore no mês" dica="Quanto você quer tirar para você."><CampoNumero prefixo="R$" valor={cfg.pro_labore} onChange={(v) => mudar({ pro_labore: v })} placeholder="0,00" /></Campo>
            <Campo rotulo="Consultas por mês" dica="Quantas você faz (ou quer fazer)."><CampoNumero valor={cfg.consultas_mes} onChange={(v) => mudar({ consultas_mes: v })} sufixo="consultas" /></Campo>
            <Campo rotulo="Meta de lucro por consulta" dica="Além do pró-labore. Opcional."><CampoNumero prefixo="R$" valor={cfg.meta_lucro} onChange={(v) => mudar({ meta_lucro: v })} placeholder="0,00" /></Campo>
            <Campo rotulo="Imposto sobre o que recebe" dica="Pessoa física ou CNPJ: o seu percentual."><CampoNumero valor={cfg.imposto_pct} onChange={(v) => mudar({ imposto_pct: v })} sufixo="%" /></Campo>
            <Campo rotulo="Taxa da maquininha" dica="Só no particular pago no cartão."><CampoNumero valor={cfg.taxa_cartao_pct} onChange={(v) => mudar({ taxa_cartao_pct: v })} sufixo="%" /></Campo>
          </div>
          <ListaDeCustos titulo="Custos de cada consulta" dica="Material que sai a cada atendimento (valor por consulta)." itens={cfg.custos_variaveis} sugestoes={SUGESTOES_VARIAVEIS} onChange={(l) => mudar({ custos_variaveis: l })} />
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
          <Botao onClick={salvar} disabled={salvando} className="min-h-[48px]">{salvando ? "Salvando…" : "Salvar custos"}</Botao>
        </div>
      </Secao>

      <Secao titulo="Quanto cobrar" subtitulo="ESTIMATIVA pelos custos cadastrados.">
        {!conta.ok ? <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: {conta.motivos.join(" ")}</p> : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[["Custo de cada consulta", brl(conta.custo), `${brl(conta.fixosPorConsulta)} de fixos e pró-labore + ${brl(conta.variaveis)} de material`],
                ["Ponto de equilíbrio", brl(conta.pontoEquilibrio), "Lucro zero. Abaixo disso, prejuízo."],
                ["Para a sua meta", conta.precoMeta ? brl(conta.precoMeta) : "—", conta.precoMeta ? `Deixa ${brl(conta.meta)} de lucro por consulta` : "Defina a meta de lucro por consulta"]].map(([r, v, d]) => (
                <div key={r} className="rounded-2xl border border-hf-border bg-hf-surface p-4"><p className="text-[13px] font-medium text-hf-muted">{r}</p><p className="text-2xl font-bold tabular-nums text-hf-text">{v}</p><p className="mt-1 text-xs text-hf-text-2">{d}</p></div>
              ))}
            </div>
            {tiposAtivos.filter((t) => Number(t.valor_particular) > 0).map((t) => {
              const k = cascataDaConsulta(t.valor_particular, conta);
              const pe = consultasParaEquilibrio(t.valor_particular, conta);
              return (
                <div key={t.id} className="mt-4 rounded-2xl border border-hf-border p-4">
                  <p className="text-sm font-bold text-hf-text">{t.nome} particular · {brl(t.valor_particular)}</p>
                  {k.linhas.map((l) => <Linha key={l.id} r={l.rotulo} v={brl(l.valor)} forte={l.id === "preco" || l.id === "lucro"} tom={l.id === "lucro" ? (l.valor < 0 ? "text-hf-danger" : "text-hf-success") : ""} />)}
                  <p className={`mt-1 text-xs font-semibold ${k.abaixoDoEquilibrio ? "text-hf-danger" : "text-hf-text-2"}`}>{k.abaixoDoEquilibrio ? `Abaixo do ponto de equilíbrio (${brl(conta.pontoEquilibrio)}): cada consulta dá prejuízo.` : pe ? `Com esse preço, ${pe} consultas no mês pagam todos os custos.` : ""}</p>
                </div>
              );
            })}
            {!tiposAtivos.some((t) => Number(t.valor_particular) > 0) && <p className="mt-3 text-sm text-hf-text-2">Cadastre o valor particular dos tipos de consulta para ver o lucro de cada um.</p>}
          </>
        )}
      </Secao>

      {conta.ok && conveniosAtivos.length > 0 && (
        <Secao titulo="Convênios: dá lucro?" subtitulo="Depois da glosa, do imposto, do material e da parte dos custos fixos.">
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="text-left text-[12px] text-hf-muted"><th className="px-2 py-2">Convênio · tipo</th><th className="px-2 py-2 text-right">Paga</th><th className="px-2 py-2 text-right">Sobra</th><th className="px-2 py-2 text-right">Lucro</th></tr></thead>
              <tbody className="divide-y divide-hf-border">
                {conveniosAtivos.flatMap((c) => tiposAtivos.map((t) => {
                  const a = analiseDoConvenio({ valor: c.valores?.[t.id], glosaPct: c.valores?.glosa_pct, conta });
                  if (!a) return null;
                  return (
                    <tr key={`${c.id}-${t.id}`}><td className="px-2 py-2">{c.nome} · {t.nome}{c.prazo_dias ? <span className="text-xs text-hf-muted"> · paga em {c.prazo_dias} dias</span> : null}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{brl(a.valor)}</td><td className="px-2 py-2 text-right tabular-nums">{brl(a.liquido)}</td>
                      <td className={`px-2 py-2 text-right font-bold tabular-nums ${a.cobreCusto ? "text-hf-success" : "text-hf-danger"}`}>{brl(a.lucro)}</td></tr>
                  );
                }).filter(Boolean))}
              </tbody>
            </table>
          </div>
        </Secao>
      )}

      <Secao titulo="Resultado do mês" subtitulo="Pelas consultas atendidas na agenda. Custos pelo cadastro (ESTIMATIVA).">
        {!resultado.ok ? <p className="text-sm text-hf-text-2">DADOS INSUFICIENTES: {(resultado.motivos || []).join(" ") || "cadastre os custos."} Atendidas no mês: {resultado.atendidas}.</p> : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Linha r={`Consultas atendidas (${resultado.atendidas})`} v={brl(resultado.receita)} forte />
              <Linha r="Recebido" v={brl(resultado.recebido)} />
              <Linha r="A receber" v={brl(resultado.aReceber)} />
              <Linha r="Imposto e taxa" v={`−${brl(resultado.impostos)}`} />
              <Linha r="Material" v={`−${brl(resultado.variaveis)}`} />
              <Linha r="Custos fixos e pró-labore" v={`−${brl(resultado.fixos)}`} />
              <Linha r="Lucro do mês" v={brl(resultado.lucro)} forte tom={resultado.lucro < 0 ? "text-hf-danger" : "text-hf-success"} />
            </div>
            <div className="space-y-2 text-sm text-hf-text-2">
              {resultado.ticketMedio !== null && <p>Valor médio por consulta: <b className="text-hf-text">{brl(resultado.ticketMedio)}</b></p>}
              {resultado.faltas > 0 && <p>{resultado.faltas} falta(s) no mês.</p>}
              {resultado.projecao && <p className="rounded-xl bg-hf-elevated p-3">No ritmo de hoje, o mês fecha com <b className="text-hf-text">{resultado.projecao.atendidas} consultas</b> e <b className={resultado.projecao.lucro < 0 ? "text-hf-danger" : "text-hf-text"}>{brl(resultado.projecao.lucro)}</b> de lucro (PROJEÇÃO).</p>}
              {resultado.metaMes !== null && <p>Meta de lucro do mês: {brl(resultado.metaMes)}.</p>}
            </div>
          </div>
        )}
      </Secao>
    </div>
  );
}
