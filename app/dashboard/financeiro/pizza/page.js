"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PieChart, Search, Loader2, X, Save, AlertTriangle, Check } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { fetchParams, salvarParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { calcularCMO } from "../../../lib/cmo.mjs";
import { contasPorDia, equipePorDia, simularMes, unidadesParaSobrar, equilibrioDoCardapio } from "../../../lib/custo-diario.mjs";
import { dadosDoPrato, fatiasDoPrato } from "../../../lib/pizza-do-prato.mjs";
import PizzaDoPrato from "../../operacao/fichas/PizzaDoPrato";

const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Os custos do mês que o dono preenche aqui mesmo, sem ir a outra tela.
const CAMPOS_FIXO = [
  ["custo_aluguel_mes", "Aluguel"], ["custo_luz_mes", "Luz"], ["custo_gas_mes", "Gás"],
  ["custo_agua_mes", "Água"], ["custo_limpeza_mes", "Limpeza"], ["custo_outros_mes", "Outros"],
];
const CAMPOS_VARIAVEL = [
  ["imposto_pct", "Imposto (%)"], ["taxa_cartao_pct", "Maquininha (%)"],
  // Estes dois vieram da tela Ponto de Equilíbrio, absorvida por esta. São
  // estimativas do cardápio inteiro: a pizza de cada prato usa o CMV e a
  // embalagem REAIS da ficha, não estes.
  ["meta_cmv", "Meta de CMV (%)"], ["embalagem_pct", "Embalagem (%)"],
];
const CAMPOS_VOLUME = [["dias_operacao_mes", "Dias que abre no mês"], ["pratos_por_dia", "Pratos por dia"]];

const ABAS = [
  { id: "todos", rotulo: "Tudo" },
  { id: "cozinha", rotulo: "Cozinha" },
  { id: "bar", rotulo: "Bar" },
];

export default function PizzaDoLucroPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [fichas, setFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [params, setParams] = useState(PARAMS_PADRAO);
  const [cmo, setCmo] = useState(null);
  const [equipe, setEquipe] = useState([]);
  const [visao, setVisao] = useState("pratos"); // pratos | dia | simulacao
  const [simUnidades, setSimUnidades] = useState(1000);
  const [simAlvo, setSimAlvo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("todos");
  const [escolhida, setEscolhida] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    setLoading(true);
    Promise.all([
      fetchFichas(unidadeAtiva), fetchProdutos(unidadeAtiva), fetchParams(unidadeAtiva),
      fetchColaboradores(unidadeAtiva), fetchRecibosPrestacaoUnidade(unidadeAtiva),
    ]).then(([resFichas, resProdutos, resParams, resEquipe, resRecibos]) => {
      if (!ativo) return;
      setFichas(resFichas.data || []);
      setProdutos(resProdutos.data || []);
      setParams({ ...PARAMS_PADRAO, ...(resParams.data || {}) });
      // Usa o cálculo que o DRE já usa: folha dos contratados + diárias de
      // extras EFETIVAMENTE PAGAS (recibo). Duas contas de CMO no mesmo
      // sistema acabariam divergindo.
      setEquipe(resEquipe.data || []);
      setCmo(calcularCMO({ colaboradores: resEquipe.data || [], recibos: resRecibos.data || [] }));
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  // O CMO NÃO é digitado: sai do RH (folha dos contratados) mais as diárias de
  // extras com recibo pago. Digitar de novo um número que o sistema já sabe é
  // pedir para os dois ficarem diferentes.
  const paramsComCmo = useMemo(
    () => ({ ...params, custo_cmo_mes: cmo ? cmo.total : 0 }), [params, cmo]);

  const editar = (chave, valor) => {
    setSalvo(false);
    setParams((p) => ({ ...p, [chave]: valor === "" ? 0 : Number(valor) }));
  };

  const salvar = async () => {
    setSalvando(true);
    // Grava o CMO calculado, não zero. Esta tela recalcula ao vivo a cada
    // abertura, mas o parâmetro custo_cmo_mes é lido por outras contas do
    // sistema: gravar zero derrubaria o custo fixo delas pelo valor inteiro da
    // folha, sem ninguém perceber. O valor gravado é o retrato para quem lê.
    const resposta = await salvarParams(unidadeAtiva, { ...params, custo_cmo_mes: cmo ? cmo.total : 0 });
    setSalvando(false);
    if (!resposta?.error) { setSalvo(true); setTimeout(() => setSalvo(false), 2500); }
  };

  const ranking = useMemo(() => {
    return fichas
      .filter((f) => !f.eh_base)
      .map((f) => {
        const entrada = dadosDoPrato(f, { fichas, produtos, params: paramsComCmo });
        return { ficha: f, entrada, conta: fatiasDoPrato(entrada) };
      })
      .filter((x) => x.conta.preco > 0)
      .sort((a, b) => {
        // Ordem de quem precisa de decisão: prejuízo, depois o que não dá para
        // confiar, e só então o ranking de lucro de verdade.
        const problema = (x) => (x.conta.prejuizo > 0 ? 0 : (x.entrada.semRendimento || x.entrada.semCusto) ? 1 : 2);
        if (problema(a) !== problema(b)) return problema(a) - problema(b);
        if (a.conta.prejuizo > 0 && b.conta.prejuizo > 0) return b.conta.prejuizo - a.conta.prejuizo;
        return (b.conta.lucro / b.conta.preco) - (a.conta.lucro / a.conta.preco);
      });
  }, [fichas, produtos, paramsComCmo]);

  const filtrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ranking.filter((x) => {
      if (aba !== "todos" && x.entrada.departamento !== aba) return false;
      return !q || String(x.ficha.nome_receita || "").toLowerCase().includes(q);
    });
  }, [ranking, busca, aba]);

  const atual = escolhida ? ranking.find((x) => x.ficha.id === escolhida) : filtrado[0];
  const contarAba = (id) => (id === "todos" ? ranking.length : ranking.filter((x) => x.entrada.departamento === id).length);
  const semVolume = !(Number(params.dias_operacao_mes) > 0 && Number(params.pratos_por_dia) > 0);

  const dias = Number(params.dias_operacao_mes) || 0;
  const contasDia = useMemo(() => contasPorDia(params, dias), [params, dias]);
  const equipeDia = useMemo(() => equipePorDia(equipe, dias), [equipe, dias]);
  const cmoDia = dias > 0 && cmo ? cmo.total / dias : 0;
  const equilibrio = useMemo(
    () => equilibrioDoCardapio({ params, cmoMes: cmo ? cmo.total : 0 }), [params, cmo]);
  const custoDiaTotal = contasDia.totalDia + cmoDia;

  // A simulação usa o prato que está selecionado na lista: o dono pensa em um
  // item concreto ("se eu vender mil moquecas"), não numa margem abstrata.
  const sim = useMemo(() => {
    if (!atual) return null;
    return simularMes({
      preco: atual.entrada.preco,
      custoCmvUnit: atual.entrada.custoIngredientes + atual.entrada.custoEmbalagem,
      impostoPct: atual.entrada.impostoPct,
      taxaMaquininhaPct: atual.entrada.taxaMaquininhaPct,
      custoFixoMes: contasDia.totalMes,
      cmoMes: cmo ? cmo.total : 0,
      unidadesMes: simUnidades,
    });
  }, [atual, contasDia.totalMes, cmo, simUnidades]);

  const paraAlvo = sim && simAlvo > 0
    ? unidadesParaSobrar({ alvo: simAlvo, contribuicaoUnit: sim.contribuicaoUnit, fixoTotal: sim.fixoTotal })
    : null;

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/modulo/financeiro")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
            aria-label="Voltar ao módulo Financeiro">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
              <PieChart className="text-emerald-600" size={24} /> Pizza do Lucro
            </h1>
            <p className="text-xs font-bold text-slate-500">Para onde vai cada real que você vende.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[["pratos", "Pizza dos pratos"], ["dia", "Custo por dia"], ["simulacao", "Simulação"]].map(([id, rotulo]) => (
            <button key={id} onClick={() => setVisao(id)}
              className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${visao === id ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
              {rotulo}
            </button>
          ))}
        </div>

        {/* Custos do mês, editáveis aqui mesmo. */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custos do mês</p>
            <button onClick={salvar} disabled={salvando}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Check size={14} /> : <Save size={14} />}
              {salvando ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
            </button>
          </div>

          {/* CMO não tem campo: vem pronto do RH. */}
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">CMO — mão de obra</p>
            <p className="text-lg font-black text-emerald-800">{cmo ? fmt(cmo.total) : "—"}</p>
            <p className="text-[10px] font-bold text-emerald-700/80">
              {cmo ? `${fmt(cmo.folha)} de folha + ${fmt(cmo.extras)} de extras (${cmo.recibos} recibo(s) pago(s))` : ""}
              {" · vem do RH e dos Extras, não precisa digitar"}
            </p>
            {cmo && cmo.extrasEmAberto > 0 && (
              <p className="mt-1 text-[10px] font-bold text-slate-600">
                Faltam {fmt(cmo.extrasEmAberto)} em recibos de extra ainda não pagos. Enquanto não forem, não entram no CMO e o lucro abaixo aparece maior do que é.
              </p>
            )}
          </div>

          <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Custo fixo (por mês)</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {CAMPOS_FIXO.map(([chave, rotulo]) => (
              <label key={chave} className="min-w-0">
                <span className="block truncate text-[10px] font-bold text-slate-500">{rotulo}</span>
                <input type="number" min="0" step="0.01" value={params[chave] ?? 0} onChange={(e) => editar(chave, e.target.value)}
                  className="mt-0.5 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500" />
              </label>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo variável (% da venda)</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {CAMPOS_VARIAVEL.map(([chave, rotulo]) => (
                  <label key={chave} className="min-w-0">
                    <span className="block truncate text-[10px] font-bold text-slate-500">{rotulo}</span>
                    <input type="number" min="0" step="0.1" value={params[chave] ?? 0} onChange={(e) => editar(chave, e.target.value)}
                      className="mt-0.5 h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500" />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Volume (divide o fixo e o CMO)</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {CAMPOS_VOLUME.map(([chave, rotulo]) => (
                  <label key={chave} className="min-w-0">
                    <span className="block truncate text-[10px] font-bold text-slate-500">{rotulo}</span>
                    <input type="number" min="0" step="1" value={params[chave] ?? 0} onChange={(e) => editar(chave, e.target.value)}
                      className={`mt-0.5 h-10 w-full min-w-0 rounded-lg border px-2 text-sm font-bold outline-none focus:border-emerald-500 ${semVolume ? "border-slate-400 bg-slate-50 text-slate-800" : "border-slate-200 bg-white text-slate-800"}`} />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {semVolume && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] font-bold text-slate-600">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Sem dias de operação e pratos por dia não dá para dividir o fixo nem o CMO por prato — e o lucro aparece maior do que é.
            </p>
          )}
        </div>

        {loading ? (
          <div className="grid min-h-[40vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>
        ) : visao === "dia" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Quanto sai do bolso antes de vender o primeiro prato. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custo de um dia aberto</p>
              <p className="mt-1 text-3xl font-black text-slate-900">{fmt(custoDiaTotal)}</p>
              <p className="text-[11px] font-bold text-slate-500">
                {dias > 0 ? `${fmt(contasDia.totalMes + (cmo ? cmo.total : 0))} por mês ÷ ${dias} dias que a casa abre` : "Preencha os dias de operação acima"}
              </p>
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-black text-slate-700">Gente (CMO)</span>
                  <span className="font-black text-slate-900">{fmt(cmoDia)}</span>
                  <span className="w-12 text-right font-bold text-slate-400">{custoDiaTotal > 0 ? `${((cmoDia / custoDiaTotal) * 100).toFixed(0)}%` : "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-black text-slate-700">Contas da casa</span>
                  <span className="font-black text-slate-900">{fmt(contasDia.totalDia)}</span>
                  <span className="w-12 text-right font-bold text-slate-400">{custoDiaTotal > 0 ? `${((contasDia.totalDia / custoDiaTotal) * 100).toFixed(0)}%` : "—"}</span>
                </div>
              </div>

              {/* Ponto de equilíbrio do cardápio inteiro. Veio da tela que
                  esta absorveu: responde em REAIS por dia, sem depender de
                  qual prato saiu. */}
              <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Quanto faturar por dia para empatar</p>
                {equilibrio.faturamentoDia === null ? (
                  <p className="mt-0.5 text-[11px] font-bold text-slate-600">
                    {!equilibrio.rateavel
                      ? "Preencha os dias de operação acima."
                      : `Com ${equilibrio.variavelPct.toFixed(1)}% de custo variável não sobra nada de cada venda — nenhum faturamento empata. Reveja a meta de CMV, o imposto, a maquininha e a embalagem.`}
                  </p>
                ) : (
                  <>
                    <p className="text-2xl font-black text-emerald-800">{fmt(equilibrio.faturamentoDia)}</p>
                    <p className="text-[11px] font-bold text-emerald-700/80">
                      {fmt(equilibrio.faturamentoMes)} no mês · de cada real vendido sobram {equilibrio.margemPct.toFixed(1)}% para pagar o fixo. Acima disso é lucro.
                    </p>
                  </>
                )}
              </div>

              <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cada conta por dia</p>
              <ul className="mt-1.5 space-y-1">
                {contasDia.itens.map((i) => (
                  <li key={i.chave} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-bold text-slate-600">{i.rotulo}</span>
                    <span className="shrink-0 font-bold text-slate-400">{fmt(i.mes)}/mês</span>
                    <span className="w-20 shrink-0 text-right font-black text-slate-800">{fmt(i.dia)}</span>
                  </li>
                ))}
                {!contasDia.itens.length && <li className="py-3 text-center text-xs font-bold text-slate-400">Nenhuma conta preenchida.</li>}
              </ul>
            </div>

            {/* Quanto cada pessoa custa por dia. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quanto cada pessoa custa por dia</p>
              <p className="mt-1 text-[11px] font-bold text-slate-500">
                Contratado: salário do mês ÷ {dias || "—"} dias. Extra: a diária inteira, no dia em que vem.
              </p>
              <ul className="mt-3 space-y-1">
                {equipeDia.fixos.map((pe) => (
                  <li key={pe.id} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-bold text-slate-700">{pe.nome}
                      {pe.cargo && <span className="font-bold text-slate-400"> · {pe.cargo}</span>}</span>
                    <span className="shrink-0 font-bold text-slate-400">{fmt(pe.mes)}/mês</span>
                    <span className="w-20 shrink-0 text-right font-black text-slate-800">{fmt(pe.dia)}</span>
                  </li>
                ))}
              </ul>
              {!!equipeDia.extras.length && (
                <>
                  <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Extras (só no dia que vêm)</p>
                  <ul className="mt-1.5 space-y-1">
                    {equipeDia.extras.map((pe) => (
                      <li key={pe.id} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate font-bold text-slate-600">{pe.nome}
                          {pe.cargo && <span className="font-bold text-slate-400"> · {pe.cargo}</span>}</span>
                        <span className="w-20 shrink-0 text-right font-black text-slate-800">{fmt(pe.dia)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!equipeDia.fixos.length && !equipeDia.extras.length && (
                <p className="py-6 text-center text-xs font-bold text-slate-400">Nenhum colaborador ativo.</p>
              )}
            </div>
          </div>
        ) : visao === "simulacao" ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {!atual ? (
              <p className="py-10 text-center text-xs font-bold text-slate-400">Escolha um prato na aba "Pizza dos pratos" para simular.</p>
            ) : (
              <>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Simulando</p>
                <p className="text-lg font-black text-slate-900">{atual.ficha.nome_receita}</p>
                <p className="text-[11px] font-bold text-slate-500">
                  Venda {fmt(sim.precoUnit)} · de cada venda sobram {fmt(sim.contribuicaoUnit)} ({sim.contribuicaoPct.toFixed(1)}%) para pagar o fixo e a folha.
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label>
                    <span className="block text-[10px] font-bold text-slate-500">Quantos vou vender no mês</span>
                    <input type="number" min="0" step="10" value={simUnidades} onChange={(e) => setSimUnidades(Number(e.target.value) || 0)}
                      className="mt-0.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-emerald-500" />
                  </label>
                  <label>
                    <span className="block text-[10px] font-bold text-slate-500">Quero que sobre (opcional)</span>
                    <input type="number" min="0" step="100" value={simAlvo} onChange={(e) => setSimAlvo(Number(e.target.value) || 0)}
                      className="mt-0.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 outline-none focus:border-emerald-500" />
                  </label>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fatura</p>
                    <p className="text-lg font-black text-slate-800">{fmt(sim.receita)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Fixo + folha do mês</p>
                    <p className="text-lg font-black text-slate-800">{fmt(sim.fixoTotal)}</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2.5 ${sim.sobra >= 0 ? "bg-emerald-50" : "bg-slate-200"}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${sim.sobra >= 0 ? "text-emerald-700" : "text-slate-600"}`}>
                      {sim.sobra >= 0 ? "Sobra para você" : "Falta"}
                    </p>
                    <p className={`text-lg font-black ${sim.sobra >= 0 ? "text-emerald-700" : "text-slate-800"}`}>{fmt(Math.abs(sim.sobra))}</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm font-bold text-slate-700">
                  {sim.unidadesParaEmpatar === null ? (
                    <p className="flex items-start gap-1.5 text-slate-600">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      Este prato não cobre nem o próprio custo: cada venda aumenta o buraco. Não existe quantidade que empate — o preço ou o custo precisam mudar.
                    </p>
                  ) : (
                    <p>
                      Para empatar o mês você precisa vender <b className="text-slate-900">{sim.unidadesParaEmpatar.toLocaleString("pt-BR")}</b> deste prato
                      ({fmt(sim.receitaParaEmpatar)}), ou <b className="text-slate-900">{Math.ceil(sim.unidadesParaEmpatar / (dias || 1)).toLocaleString("pt-BR")}</b> por dia.
                    </p>
                  )}
                  {paraAlvo !== null && (
                    <p>
                      Para sobrar <b className="text-slate-900">{fmt(simAlvo)}</b> no fim do mês: <b className="text-slate-900">{paraAlvo.toLocaleString("pt-BR")}</b> pratos
                      ({Math.ceil(paraAlvo / (dias || 1)).toLocaleString("pt-BR")} por dia).
                    </p>
                  )}
                  <p className="text-[11px] font-bold text-slate-400">
                    A conta supõe que o mês inteiro é vendido deste item. Serve para dimensionar, não como previsão do cardápio inteiro.
                  </p>
                </div>
              </>
            )}
          </div>
        ) : !ranking.length ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm font-bold text-slate-400">
            Nenhum prato com preço de venda ainda. Defina o preço nas fichas para ver a pizza.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {ABAS.map((a) => (
                  <button key={a.id} onClick={() => { setAba(a.id); setEscolhida(null); }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors ${aba === a.id ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                    {a.rotulo}
                    <span className={`rounded-full px-1.5 text-[10px] ${aba === a.id ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>{contarAba(a.id)}</span>
                  </button>
                ))}
              </div>

              <label className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato..."
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400" />
                {busca && <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-700"><X size={15} /></button>}
              </label>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="py-2 pr-2">Prato</th>
                      <th className="py-2 px-2 text-right">Venda</th>
                      <th className="py-2 px-2 text-right">Sobra</th>
                      <th className="py-2 pl-2 text-right">% da venda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrado.map((x) => {
                      const ehAtual = atual && atual.ficha.id === x.ficha.id;
                      const duvidoso = x.entrada.semRendimento || x.entrada.semCusto;
                      const pct = x.conta.preco > 0 ? (x.conta.lucro / x.conta.preco) * 100 : 0;
                      return (
                        <tr key={x.ficha.id} onClick={() => setEscolhida(x.ficha.id)}
                          className={`cursor-pointer transition-colors ${ehAtual ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                          <td className="py-2 pr-2 font-bold text-slate-700">
                            {x.ficha.nome_receita}
                            {duvidoso && (
                              <span className="ml-1.5 inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-500">
                                <AlertTriangle size={9} /> {x.entrada.semCusto ? "sem custo" : "sem rendimento"}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-slate-500">{fmt(x.conta.preco)}</td>
                          <td className="py-2 px-2 text-right font-black text-slate-800">
                            {x.conta.prejuizo > 0 ? `− ${fmt(x.conta.prejuizo)}` : fmt(x.conta.lucro)}
                          </td>
                          <td className="py-2 pl-2 text-right">
                            <span className={`rounded-lg px-2 py-0.5 font-black ${x.conta.prejuizo > 0 ? "bg-slate-200 text-slate-700" : duvidoso ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-800"}`}>
                              {x.conta.prejuizo > 0 ? "prejuízo" : `${pct.toFixed(0)}%`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!filtrado.length && <p className="py-8 text-center text-xs font-bold text-slate-400">Nenhum prato aqui.</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
              {atual ? (
                <>
                  <p className="mb-1 truncate text-sm font-black text-slate-800">{atual.ficha.nome_receita}</p>
                  {(atual.entrada.semCusto || atual.entrada.semRendimento) && (
                    <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-slate-100 px-2.5 py-2 text-[10px] font-bold text-slate-600">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      {atual.entrada.semCusto
                        ? "Este item não tem custo de produto na ficha (revenda, por exemplo). O lucro abaixo está alto porque falta o custo, não porque ele é bom."
                        : "A ficha não diz em quantas porções rende, então não dá para saber o custo de uma porção. Defina o peso da porção na ficha."}
                    </p>
                  )}
                  <PizzaDoPrato {...atual.entrada} />
                </>
              ) : (
                <p className="py-10 text-center text-xs font-bold text-slate-400">Escolha um prato na lista.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
