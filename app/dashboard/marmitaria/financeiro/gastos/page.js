"use client";

// Gastos e rendimento da marmitaria (pedido do dono, 17/11/2026): quanto foi
// gasto no dia, na semana e no mês, por categoria e para quem; o que saiu do
// estoque; quanto cada produção rendeu (18 kg de frango → 1000 empanados =
// 18 g e R$ X cada); o estoque de agora. Planilha para baixar. Fica sob
// /financeiro para herdar a permissão do Financeiro da marmitaria.
// Tudo REAL (compras, contas, estoque e produções gravados); sem custo médio,
// o valor aparece como "sem custo", nunca zero.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Plus, X } from "lucide-react";
import { useMarmitaria } from "../../../../components/marmitaria/contexto";
import { Abas, Aviso, Botao, Campo, Cartao, Secao, Selo, brl, inputCls, lerNumero } from "../../../../components/marmitaria/ui";
import { carregarGastos, registrarGasto } from "../../../../lib/marmitaria/gastos-dados";
import { TIPOS_GASTO, estoqueValorizado, planilhaDeGastos, quantidadeTexto, resumoDeGastos } from "../../../../lib/marmitaria/gastos.mjs";
import { SLUGS_MARMITARIA } from "../../../../lib/marmitaria/cozinha.mjs";
import { hojeLocal, intervaloPeriodo, novaChave } from "../../../../lib/contas-pagar.mjs";

const PERIODOS = [{ id: "hoje", rotulo: "Dia" }, { id: "semana", rotulo: "Semana" }, { id: "mes", rotulo: "Mês" }];
const ABAS = [{ id: "gastos", rotulo: "Gastos" }, { id: "rendimento", rotulo: "Rendimento" }, { id: "uso", rotulo: "Uso do estoque" }, { id: "estoque", rotulo: "Estoque agora" }];
const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
const dataLonga = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
const MOTIVO = { producao: "produção", perda: "perda", retirada: "retirada", consumo: "consumo", ajuste: "ajuste" };
const chip = (ativo) => `min-h-[44px] rounded-full px-4 text-sm font-medium ${ativo ? "bg-hf-menu text-white" : "bg-hf-elevated text-hf-text"}`;

function Linha({ rotulo, detalhe, valor, forte = false }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2">
      <span className="min-w-0">
        <span className={`block text-sm ${forte ? "font-semibold" : ""} text-hf-text`}>{rotulo}</span>
        {detalhe && <span className="block text-[13px] text-hf-muted">{detalhe}</span>}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-hf-text">{valor}</span>
    </li>
  );
}

function NovoGasto({ unidadeId, colaboradores, aoSalvar, aoFechar }) {
  const [f, setF] = useState({ data: hojeLocal(), tipo: "utensilios", item: "", quantidade: "1", valor: "", destino: "geral", colaboradorId: "", observacao: "", naFicha: true });
  const [chave] = useState(() => novaChave());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const mudar = (x) => setF((v) => ({ ...v, ...x }));
  const tipo = TIPOS_GASTO.find((t) => t.id === f.tipo);

  async function salvar(e) {
    e.preventDefault();
    const valor = lerNumero(f.valor);
    if (!(valor > 0)) return setErro("Informe quanto custou.");
    if (f.destino === "colaborador" && !f.colaboradorId) return setErro("Escolha o funcionário.");
    setSalvando(true); setErro(null);
    const r = await registrarGasto({
      unidadeId, data: f.data, tipo: f.tipo, item: f.item, quantidade: lerNumero(f.quantidade) || null, valor,
      destino: f.destino, colaboradorId: f.colaboradorId || null, observacao: f.observacao.trim() || null, chave, naFicha: f.naFicha,
    });
    setSalvando(false);
    if (r.error) return setErro(r.error);
    aoSalvar(r.aviso);
  }

  return (
    <Cartao>
      <form onSubmit={salvar} className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-hf-text">Lançar gasto</h3>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-full text-hf-muted hover:bg-hf-elevated"><X size={18} /></button>
        </div>
        <p className="text-[13px] text-hf-muted">Para o que não entra no estoque: utensílios, uniformes, limpeza, manutenção. Ingrediente e embalagem se lançam em Compras.</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Categoria">
          {TIPOS_GASTO.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={f.tipo === t.id} onClick={() => mudar({ tipo: t.id })} className={chip(f.tipo === t.id)}>{t.rotulo}</button>
          ))}
        </div>
        <Campo rotulo="O que foi comprado">
          <input className={inputCls} value={f.item} onChange={(e) => mudar({ item: e.target.value })} maxLength={160} placeholder={tipo?.exemplos ? `Ex.: ${tipo.exemplos}` : ""} required />
        </Campo>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Campo rotulo="Quantidade"><input className={inputCls} inputMode="decimal" value={f.quantidade} onChange={(e) => mudar({ quantidade: e.target.value })} /></Campo>
          <Campo rotulo="Valor total (R$)"><input className={inputCls} inputMode="decimal" value={f.valor} onChange={(e) => mudar({ valor: e.target.value })} placeholder="0,00" required /></Campo>
          <Campo rotulo="Data" className="col-span-2 sm:col-span-1"><input type="date" className={`${inputCls} min-w-0 appearance-none`} value={f.data} max={hojeLocal()} onChange={(e) => mudar({ data: e.target.value })} required /></Campo>
        </div>
        <div>
          <p className="mb-1 text-[13px] font-medium text-hf-muted">Para quem</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => mudar({ destino: "geral", colaboradorId: "" })} className={chip(f.destino === "geral")}>Uso geral</button>
            <button type="button" onClick={() => mudar({ destino: "colaborador" })} className={chip(f.destino === "colaborador")}>Um funcionário</button>
          </div>
          {f.destino === "colaborador" && (
            <select className={`${inputCls} mt-2`} value={f.colaboradorId} onChange={(e) => mudar({ colaboradorId: e.target.value })} aria-label="Funcionário">
              <option value="">Escolha o funcionário</option>
              {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          {f.destino === "colaborador" && f.tipo === "uniformes_epi" && (
            <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm text-hf-text">
              <input type="checkbox" checked={f.naFicha} onChange={(e) => mudar({ naFicha: e.target.checked })} className="h-5 w-5" />
              Registrar também na ficha do funcionário (uniforme entregue)
            </label>
          )}
        </div>
        <Campo rotulo="Observação (opcional)"><input className={inputCls} value={f.observacao} onChange={(e) => mudar({ observacao: e.target.value })} maxLength={500} /></Campo>
        {erro && <Aviso tipo="alerta">{erro}</Aviso>}
        <div className="flex justify-end">
          <Botao type="submit" disabled={salvando}>{salvando ? "Lançando…" : "Lançar gasto"}</Botao>
        </div>
        <p className="text-[12px] text-hf-muted">Entra no Financeiro como conta paga nesta data (centro de custo Marmitaria).</p>
      </form>
    </Cartao>
  );
}

export default function GastosPage() {
  const { base, unidadeId } = useMarmitaria();
  const [tipo, setTipo] = useState("semana");
  const [ref, setRef] = useState(hojeLocal());
  const [aba, setAba] = useState("gastos");
  const [dados, setDados] = useState(null);
  const [novo, setNovo] = useState(false);
  const [aviso, setAviso] = useState(null);
  const periodo = useMemo(() => intervaloPeriodo(tipo, ref), [tipo, ref]);

  const recarregar = useCallback(async () => {
    if (!unidadeId || !periodo) return;
    setDados(null);
    setDados(await carregarGastos(unidadeId, periodo));
  }, [unidadeId, periodo]);
  useEffect(() => { recarregar(); }, [recarregar]);

  const resumo = useMemo(() => {
    if (!dados || dados.error || !base) return null;
    return resumoDeGastos({
      periodo, compras: dados.compras, itensCompra: dados.itensCompra, contas: dados.contas, detalhes: dados.detalhes,
      movimentos: dados.movimentos, lotes: dados.lotes, insumos: base.insumos, fichas: [...base.fichas, ...base.marmitas],
      estoques: base.estoques, colaboradores: dados.colaboradoresTodos,
    });
  }, [dados, base, periodo]);
  const estoque = useMemo(() => (base && dados && !dados.error
    ? estoqueValorizado({ itensEstoque: base.itensEstoque, estoques: base.estoques, insumos: base.insumos, custos: dados.custos, slugs: SLUGS_MARMITARIA })
    : null), [base, dados]);

  function baixar() {
    if (!resumo) return;
    const csv = planilhaDeGastos(resumo, { estoque, titulo: "Gastos da marmitaria" });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos-marmitaria-${periodo.de}-a-${periodo.ate}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const rotuloPeriodo = periodo ? (periodo.de === periodo.ate ? dataLonga(periodo.de) : `${dataLonga(periodo.de)} a ${dataLonga(periodo.ate)}`) : "";
  const porDia = resumo ? resumo.gastos.reduce((m, g) => m.set(g.data, [...(m.get(g.data) || []), g]), new Map()) : new Map();

  return (
    <div className="space-y-4">
      <Secao titulo="Gastos e rendimento" subtitulo="Tudo o que foi gasto, para quê e para quem; o que saiu do estoque e quanto cada produção rendeu."
        direita={<div className="flex flex-wrap gap-2">
          <Botao type="button" onClick={() => { setNovo(true); setAviso(null); }}><Plus size={16} /> Lançar gasto</Botao>
          <Botao type="button" variante="secundario" onClick={baixar} disabled={!resumo}><Download size={16} /> Baixar planilha</Botao>
        </div>}>
        <div className="flex flex-wrap items-center gap-2">
          {PERIODOS.map((p) => <button key={p.id} type="button" onClick={() => setTipo(p.id)} className={chip(tipo === p.id)}>{p.rotulo}</button>)}
          <input type="date" value={ref} onChange={(e) => e.target.value && setRef(e.target.value)} aria-label="Data de referência"
            className="min-h-[44px] min-w-0 appearance-none rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text" />
          <span className="text-[13px] text-hf-muted">{rotuloPeriodo}</span>
        </div>
      </Secao>

      {novo && <NovoGasto unidadeId={unidadeId} colaboradores={dados?.colaboradores || []} aoFechar={() => setNovo(false)}
        aoSalvar={(a) => { setNovo(false); setAviso(a || null); recarregar(); }} />}
      {aviso && <Aviso tipo="alerta">{aviso}</Aviso>}
      {dados?.semGastos1 && <Aviso tipo="alerta">O banco ainda não tem o detalhe dos gastos (migração GASTOS-1). Os gastos aparecem pela conta a pagar, sem o item e sem para quem.</Aviso>}

      {!dados || !base ? <Cartao><p className="text-sm text-hf-muted">Carregando…</p></Cartao>
        : dados.error ? <Aviso tipo="alerta">Não foi possível carregar: {dados.error}</Aviso>
          : resumo && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Cartao><p className="text-[13px] font-medium text-hf-muted">Gasto no período</p><p className="mt-1 text-xl font-semibold tabular-nums text-hf-text">{brl(resumo.totalGastos)}</p><Selo natureza="real" /></Cartao>
                <Cartao><p className="text-[13px] font-medium text-hf-muted">Saiu do estoque</p><p className="mt-1 text-xl font-semibold tabular-nums text-hf-text">{brl(resumo.totalUso)}</p>{resumo.usoSemValor > 0 ? <p className="text-[12px] text-hf-warning">{resumo.usoSemValor} saída(s) sem custo</p> : <Selo natureza="real" />}</Cartao>
                <Cartao><p className="text-[13px] font-medium text-hf-muted">Produções</p><p className="mt-1 text-xl font-semibold tabular-nums text-hf-text">{resumo.rendimento.length}</p></Cartao>
                <Cartao><p className="text-[13px] font-medium text-hf-muted">Estoque agora</p><p className="mt-1 text-xl font-semibold tabular-nums text-hf-text">{estoque ? brl(estoque.total) : "—"}</p>{estoque?.semCusto > 0 && <p className="text-[12px] text-hf-warning">{estoque.semCusto} item(ns) sem custo</p>}</Cartao>
              </div>

              <Abas abas={ABAS} valor={aba} onChange={setAba} />

              {aba === "gastos" && (!resumo.gastos.length
                ? <Cartao><p className="text-sm text-hf-text">DADOS INSUFICIENTES: nenhum gasto registrado neste período.</p><p className="mt-1 text-sm text-hf-muted">Compras confirmadas e contas do Financeiro aparecem aqui sozinhas. Para utensílio, uniforme ou limpeza, use &quot;Lançar gasto&quot;.</p></Cartao>
                : (
                  <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                    <div className="space-y-4">
                      <Cartao>
                        <p className="mb-1 text-[13px] font-medium text-hf-muted">Por categoria</p>
                        <ul className="divide-y divide-hf-border">
                          {resumo.porCategoria.map((c) => (
                            <li key={c.categoria} className="py-2">
                              <div className="flex items-baseline justify-between gap-3 text-sm"><span className="text-hf-text">{c.categoria}</span><span className="font-semibold tabular-nums text-hf-text">{brl(c.valor)}</span></div>
                              {c.pct != null && c.pct > 0 && <div className="mt-1 h-1.5 rounded-full bg-hf-elevated"><div className="h-1.5 rounded-full bg-hf-menu" style={{ width: `${Math.min(100, c.pct)}%` }} /></div>}
                            </li>
                          ))}
                        </ul>
                      </Cartao>
                      {resumo.porPessoa.length > 0 && (
                        <Cartao>
                          <p className="mb-1 text-[13px] font-medium text-hf-muted">Para funcionários</p>
                          <ul className="divide-y divide-hf-border">{resumo.porPessoa.map((p) => <Linha key={p.nome} rotulo={p.nome} valor={brl(p.valor)} />)}</ul>
                        </Cartao>
                      )}
                    </div>
                    <Cartao>
                      <p className="mb-1 text-[13px] font-medium text-hf-muted">O que foi comprado</p>
                      {[...porDia.entries()].reverse().map(([d, lista]) => (
                        <div key={d} className="mb-2">
                          <p className="pt-2 text-[12px] font-semibold uppercase tracking-wide text-hf-muted">{dataBR(d)} · {brl(lista.reduce((t, g) => t + g.valor, 0))}</p>
                          <ul className="divide-y divide-hf-border">
                            {lista.map((g, k) => (
                              <Linha key={k} rotulo={g.item}
                                detalhe={[g.categoria, g.quantidade ? quantidadeTexto(g.quantidade, g.unidade) : null, g.destino && g.destino !== "Geral" ? `para ${g.destino}` : g.destino === "Geral" ? "uso geral" : null, g.fornecedor].filter(Boolean).join(" · ")}
                                valor={brl(g.valor)} />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </Cartao>
                  </div>
                ))}

              {aba === "rendimento" && (!resumo.rendimento.length
                ? <Cartao><p className="text-sm text-hf-text">DADOS INSUFICIENTES: nenhuma produção registrada neste período.</p><p className="mt-1 text-sm text-hf-muted">Registre em Produção do dia o que entrou e quanto rendeu (ex.: 18 kg de frango → 1000 empanados).</p></Cartao>
                : <div className="space-y-3">{resumo.rendimento.map((r) => (
                  <Cartao key={r.loteId}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-semibold text-hf-text">{r.nome}</p>
                      <p className="text-[13px] text-hf-muted">{dataLonga(r.data)}</p>
                    </div>
                    <p className="mt-1 text-sm text-hf-text">Rendeu <b>{quantidadeTexto(r.produzido, r.unidade)}</b>
                      {r.custo != null ? <> · custou {brl(r.custo)} · <b>{brl(r.custoPorUnidade)} por {r.unidade === "marmitas" ? "marmita" : "unidade"}</b></> : <span className="text-hf-warning"> · custo: DADOS INSUFICIENTES (alguma baixa sem custo médio)</span>}</p>
                    <ul className="mt-2 divide-y divide-hf-border">
                      {r.entradas.map((e, k) => <Linha key={k} rotulo={e.item} detalhe={`${quantidadeTexto(e.quantidade, e.unidade)}${e.porUnidade ? ` · ${e.porUnidade} em cada` : ""}`} valor={e.valor != null ? brl(e.valor) : "sem custo"} />)}
                    </ul>
                  </Cartao>
                ))}</div>)}

              {aba === "uso" && (!resumo.uso.length
                ? <Cartao><p className="text-sm text-hf-text">DADOS INSUFICIENTES: nada saiu do estoque neste período.</p></Cartao>
                : <Cartao><ul className="divide-y divide-hf-border">{resumo.uso.map((u) => (
                  <Linha key={`${u.insumoId}${u.unidade}`} rotulo={u.item} detalhe={`${quantidadeTexto(u.quantidade, u.unidade)} · ${u.motivos.map((m) => MOTIVO[m] || m).join(", ")}`} valor={u.valor != null ? brl(u.valor) : "sem custo"} />
                ))}</ul></Cartao>)}

              {aba === "estoque" && (!estoque?.linhas.length
                ? <Cartao><p className="text-sm text-hf-text">DADOS INSUFICIENTES: o estoque da marmitaria está vazio.</p></Cartao>
                : <Cartao><ul className="divide-y divide-hf-border">{estoque.linhas.map((e) => (
                  <Linha key={e.insumoId} rotulo={e.item} detalhe={quantidadeTexto(e.quantidade, e.unidade)} valor={e.valor != null ? brl(e.valor) : "sem custo"} />
                ))}<Linha rotulo="Total" valor={brl(estoque.total)} forte /></ul></Cartao>)}
            </>
          )}
    </div>
  );
}
