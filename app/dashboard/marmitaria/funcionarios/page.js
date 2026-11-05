"use client";

// Equipe da marmitaria: o funcionário é criado aqui, na unidade da marmitaria,
// sem depender do RH do restaurante. Com o custo de cada um sai o CMO.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMarmitaria } from "../../../components/marmitaria/contexto";
import { Aviso, Botao, Campo, CampoNumero, Cartao, Indicador, Secao, SemDados, brl, inputCls, pctTxt, lerNumero } from "../../../components/marmitaria/ui";
import { carregarEquipe, criarFuncionario, salvarAlocacao, fetchVendas } from "../../../lib/marmitaria/dados";
import { cmoMarmitaria, encargosDaConfig, resumoVendas, periodo } from "../../../lib/marmitaria/nucleo.mjs";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const VAZIO = () => ({ nome: "", cargo: "", salario: "", vale_alimentacao: "", vale_transporte: "", data_admissao: hoje(), turno: "" });

export default function FuncionariosPage() {
  const { base, unidadeId } = useMarmitaria();
  const [equipe, setEquipe] = useState(null);
  const [vendasMes, setVendasMes] = useState([]);
  const [novo, setNovo] = useState(VAZIO);
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const mes = hoje().slice(0, 7);

  const carregar = useCallback(async () => {
    if (!unidadeId) return;
    const p = periodo("mes", hoje());
    const [e, v] = await Promise.all([carregarEquipe(unidadeId), fetchVendas(unidadeId, p.de, p.ate)]);
    setEquipe(e); setVendasMes(v.data || []);
  }, [unidadeId]);
  useEffect(() => { carregar(); }, [carregar]);

  const enc = useMemo(() => encargosDaConfig(base?.config?.encargos || {}, equipe?.rhConfig), [base, equipe]);
  const rv = resumoVendas(vendasMes);
  const cmo = useMemo(() => equipe ? cmoMarmitaria({ alocacoes: equipe.alocacoes, colaboradores: equipe.colaboradores, recibos: equipe.recibos, encargos: enc, mes, marmitasVendidas: rv.quantidade }) : null,
    [equipe, enc, mes, rv.quantidade]);

  if (!base || !equipe) return <Cartao><p className="text-sm text-hf-muted">Carregando equipe…</p></Cartao>;
  const alocados = new Set(equipe.alocacoes.filter((a) => a.ativo !== false).map((a) => a.colaborador_id));
  const disponiveis = equipe.colaboradores.filter((c) => (c.status || "ativo") !== "inativo" && !c.data_desligamento && !alocados.has(c.id));

  async function cadastrar() {
    if (salvando) return;
    setMsg(null);
    setSalvando(true);
    try {
      const r = await criarFuncionario(unidadeId, { ...novo, salario: lerNumero(novo.salario), vale_alimentacao: lerNumero(novo.vale_alimentacao), vale_transporte: lerNumero(novo.vale_transporte) });
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      if (r.id) { setNovo(VAZIO()); await carregar(); }
    } finally { setSalvando(false); }
  }

  async function gravar(a) {
    if (salvando) return;
    setMsg(null);
    if (a.tipo_alocacao !== "exclusivo") {
      const p = lerNumero(a.percentual_tempo); const h = lerNumero(a.horas_por_semana);
      if (enc.criterio === "horas" ? !(h > 0) : !(p > 0 && p <= 100)) return setMsg({ tipo: "alerta", texto: enc.criterio === "horas" ? "Informe as horas por semana na marmitaria." : "Informe o % do tempo na marmitaria (1 a 100)." });
    }
    setSalvando(true);
    try {
      const r = await salvarAlocacao(unidadeId, { ...a, percentual_tempo: lerNumero(a.percentual_tempo), horas_por_semana: lerNumero(a.horas_por_semana) });
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      else await carregar();
    } finally { setSalvando(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador rotulo="CMO do mês" valor={cmo?.linhas.length ? cmo.total : null} natureza="estimativa" nota="salário + encargos + provisões + benefícios + diárias pagas" destaque />
        <Indicador rotulo="% do faturamento" valor={cmo?.linhas.length && rv.receita > 0 ? (cmo.total / rv.receita) * 100 : null} formato="pct" natureza="estimativa" nota={rv.receita > 0 ? `sobre ${brl(rv.receita)} vendidos no mês` : "sem vendas lançadas no mês"} />
        <Indicador rotulo="CMO por marmita" valor={cmo?.linhas.length ? cmo.porMarmita : null} natureza="estimativa" nota={cmo?.porMarmita === null ? cmo?.motivoPorMarmita : `${rv.quantidade} marmitas vendidas no mês`} />
      </div>

      <Secao titulo="Quem trabalha na marmitaria" subtitulo={`Encargos: FGTS ${pctTxt(enc.fgts_pct, 0)} · INSS patronal ${pctTxt(enc.inss_patronal_pct, 0)} (${enc.origemInss}) · provisões ${pctTxt(enc.provisao_13_pct + enc.provisao_ferias_pct)}. Ajuste em Configurações.`}>
        {cmo?.linhas.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-hf-muted">
                <th className="py-2 pr-2">Funcionário</th><th className="py-2 pr-2">Alocação</th><th className="py-2 pr-2 text-right">Salário</th><th className="py-2 pr-2 text-right">Encargos + provisões</th>
                <th className="py-2 pr-2 text-right">Benefícios + diárias</th><th className="py-2 pr-2 text-right">Marmitaria</th><th className="py-2 pr-2 text-right">Restaurante</th><th className="py-2" />
              </tr></thead>
              <tbody className="divide-y divide-hf-border">
                {cmo.linhas.map((l) => {
                  const a = equipe.alocacoes.find((x) => x.colaborador_id === l.colaborador_id);
                  return (
                    <tr key={l.colaborador_id}>
                      <td className="py-2 pr-2"><p className="font-semibold">{l.nome}</p><p className="text-xs text-hf-muted">{l.cargo}</p></td>
                      <td className="py-2 pr-2">{l.tipo === "exclusivo" ? "Exclusivo" : `Compartilhado · ${pctTxt(l.fracaoPct, 0)}`}{a?.turno ? <p className="text-xs text-hf-muted">{a.turno}</p> : null}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{brl(l.salario)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{brl(l.encargos + l.provisoes)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{brl(l.beneficios + l.extras)}</td>
                      <td className="py-2 pr-2 text-right font-bold tabular-nums">{brl(l.marmitaria)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums text-hf-muted">{brl(l.restaurante)}</td>
                      <td className="py-2 text-right"><Botao variante="texto" onClick={() => gravar({ ...a, ativo: false })}>Tirar</Botao></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <SemDados titulo="Nenhum funcionário alocado" motivo="Cadastre abaixo quem trabalha na marmitaria." />}
        {cmo?.avisos.map((a) => <Aviso key={a} tipo="alerta" className="mt-2">{a}</Aviso>)}
      </Secao>

      <Secao titulo="Novo funcionário" subtitulo="Fica na equipe da marmitaria, com 100% do custo aqui.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome"><input className={inputCls} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Campo>
          <Campo rotulo="Função"><input className={inputCls} value={novo.cargo} onChange={(e) => setNovo({ ...novo, cargo: e.target.value })} placeholder="Ex.: Cozinheira" /></Campo>
          <Campo rotulo="Salário do mês (R$)"><CampoNumero valor={novo.salario} onChange={(v) => setNovo({ ...novo, salario: v })} placeholder="0,00" /></Campo>
          <Campo rotulo="Data de admissão"><input type="date" className={`${inputCls} min-w-0 max-w-full appearance-none`} value={novo.data_admissao} onChange={(e) => setNovo({ ...novo, data_admissao: e.target.value })} /></Campo>
          <Campo rotulo="Vale-alimentação do mês (R$)"><CampoNumero valor={novo.vale_alimentacao} onChange={(v) => setNovo({ ...novo, vale_alimentacao: v })} placeholder="0,00" /></Campo>
          <Campo rotulo="Vale-transporte do mês (R$)"><CampoNumero valor={novo.vale_transporte} onChange={(v) => setNovo({ ...novo, vale_transporte: v })} placeholder="0,00" /></Campo>
          <Campo rotulo="Turno / escala" className="sm:col-span-2"><input className={inputCls} value={novo.turno} onChange={(e) => setNovo({ ...novo, turno: e.target.value })} placeholder="Ex.: seg a sex, 7h–15h" /></Campo>
        </div>
        <Botao className="mt-3" type="button" onClick={cadastrar} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar funcionário"}</Botao>
        {disponiveis.length > 0 && (
          <div className="mt-4 border-t border-hf-border pt-3">
            <p className="text-xs font-semibold text-hf-text-2">Fora da equipe</p>
            <ul className="divide-y divide-hf-border">
              {disponiveis.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><span className="font-semibold text-hf-text">{c.nome}</span>{c.cargo ? <span className="text-hf-muted"> · {c.cargo}</span> : null}</span>
                  <Botao variante="texto" type="button" onClick={() => gravar({ colaborador_id: c.id, tipo_alocacao: "exclusivo", ativo: true, turno: equipe.alocacoes.find((x) => x.colaborador_id === c.id)?.turno })}>Voltar</Botao>
                </li>
              ))}
            </ul>
          </div>
        )}
        {msg && <Aviso tipo={msg.tipo} className="mt-3">{msg.texto}</Aviso>}
        <p className="mt-3 text-xs text-hf-muted">Horas extras e diárias: lançadas em <Link href="/dashboard/rh/extra" className="font-semibold text-hf-accent">Gestão de Extras</Link>. Diárias pagas no mês entram aqui pela fração alocada.</p>
      </Secao>
    </div>
  );
}
