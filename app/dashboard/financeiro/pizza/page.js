"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, PieChart, Search, Loader2, X, Save, AlertTriangle, Check, ChevronDown } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchFichas } from "../../../lib/operacao";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchColaboradores, fetchRecibosPrestacaoUnidade } from "../../../lib/rh";
import { fetchParams, salvarParams, PARAMS_PADRAO } from "../../../lib/parametros";
import { fetchPainelCaixa } from "../../../lib/financeiro";
import { calcularCMO } from "../../../lib/cmo.mjs";
import {
  contasPorDia, equipePorDia, equilibrioDoCardapio, mediaItensPorDia,
  simularCardapio, LIMITE_PRATOS, LIMITE_BEBIDAS,
} from "../../../lib/custo-diario.mjs";
import { dadosDoPrato, fatiasDoPrato, precoSugerido } from "../../../lib/pizza-do-prato.mjs";
import { lacunasDoCusto } from "../../../lib/lacunas-custo.mjs";
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
  ["meta_cmv", "Meta de CMV (%)"],
  // Quanto o dono quer que sobre. É o alvo do preço sugerido.
  ["margem_alvo_pct", "Margem que quero (%)"],
];
// Embalagem fica fora do grupo de percentuais: uma caixa custa o que custa,
// não uma fatia do preço. Na conta do equilíbrio ela vira percentual pelo
// preço médio do cardápio.
const CAMPOS_REAIS = [["embalagem_valor", "Embalagem (R$ por prato)"]];
const CAMPOS_VOLUME = [["dias_operacao_mes", "Dias que abre no mês"], ["pratos_por_dia", "Pratos por dia"]];

// Campo de número dos custos.
//
// Valor zero aparece VAZIO, com o zero no placeholder. Mostrar "0" de verdade
// cria dois problemas: a tela fica coberta de zeros que não são informação, e
// quem digita 54 num campo que já tem 0 acaba com "054" — o cursor entra
// depois do zero. Vazio e zero significam a mesma coisa aqui: sem custo.
function CampoNumero({ rotulo, valor, onChange, step = "0.01", destacado = false }) {
  // Enquanto se digita, o campo mostra o TEXTO digitado, não o número que o
  // pai guardou. Sem isso "0,5" é impossível: ao teclar o 0 o campo limparia
  // (zero aparece vazio) e o ponto seguinte viraria NaN. Ao sair do campo,
  // volta a mostrar o valor canônico.
  const [texto, setTexto] = useState(null);
  const mostrado = texto !== null ? texto : (Number(valor) ? String(valor) : "");
  return (
    <label className="min-w-0">
      <span className="block truncate text-3xs font-bold text-muted">{rotulo}</span>
      <input
        type="number" min="0" step={step} inputMode="decimal" placeholder="0"
        value={mostrado}
        onChange={(e) => { setTexto(e.target.value); onChange(e.target.value); }}
        onBlur={() => setTexto(null)}
        className={`mt-0.5 h-10 w-full min-w-0 rounded-lg border px-2 text-sm font-bold text-slate-800 outline-none placeholder:font-medium placeholder:text-dim focus:border-emerald-500 ${destacado ? "border-slate-400 bg-slate-50" : "border-line bg-card"}`}
      />
    </label>
  );
}

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
  // A visao pode vir pela URL: o aviso do painel manda ?ver=conferir para cair
  // direto no que esta faltando, em vez de largar a pessoa na aba de pratos e
  // esperar que ela ache a aba certa.
  const [visao, setVisao] = useState(() => {
    if (typeof window === "undefined") return "pratos";
    const ver = new URLSearchParams(window.location.search).get("ver");
    return ["pratos", "dia", "simulacao", "conferir"].includes(ver) ? ver : "pratos";
  }); // pratos | dia | simulacao | conferir
  // Cardápio montado: { fichaId: quantidade no mês }.
  const [montado, setMontado] = useState({});
  const [buscaMontar, setBuscaMontar] = useState("");
  // Média real de itens vendidos por dia, medida nas vendas dos últimos 30
  // dias. Existe para o dono não ter que adivinhar o número que mais pesa
  // na conta.
  const [medido, setMedido] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState("todos");
  const [escolhida, setEscolhida] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  // null = decide sozinho. Quem ainda não preencheu precisa ver os campos;
  // quem já preencheu não quer a configuração ocupando o topo das três abas
  // toda vez que abre a tela.
  const [painelAberto, setPainelAberto] = useState(null);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    setLoading(true);
    Promise.all([
      fetchFichas(unidadeAtiva), fetchProdutos(unidadeAtiva), fetchParams(unidadeAtiva),
      fetchColaboradores(unidadeAtiva), fetchRecibosPrestacaoUnidade(unidadeAtiva),
      (() => {
        const fim = new Date();
        const inicio = new Date(fim.getTime() - 30 * 86400000);
        return fetchPainelCaixa(unidadeAtiva, inicio.toISOString(), fim.toISOString());
      })(),
    ]).then(([resFichas, resProdutos, resParams, resEquipe, resRecibos, resCaixa]) => {
      if (!ativo) return;
      setFichas(resFichas.data || []);
      setProdutos(resProdutos.data || []);
      const carregados = { ...PARAMS_PADRAO, ...(resParams.data || {}) };
      setParams(carregados);
      // A decisão de abrir ou não é tomada UMA VEZ, com o que veio do banco.
      // Antes ela era recalculada a cada tecla: ao digitar o primeiro número
      // no Aluguel a condição "já configurado" virava verdadeira e o painel
      // fechava no meio da digitação, embaralhando o que estava sendo escrito.
      // Se as vendas dizem outra coisa, o painel abre: o divisor errado faz o
      // cardapio inteiro mentir, e fechado ninguem descobre isso.
      const medicao = mediaItensPorDia(resCaixa?.data?.vendas || []);
      const noBanco = Number(carregados.pratos_por_dia) || 0;
      const discorda = medicao.temDados && noBanco > 0
        && Math.abs(Math.round(medicao.media) - noBanco) / noBanco >= 0.1;
      setPainelAberto(discorda || !(
        Number(carregados.dias_operacao_mes) > 0
        && Number(carregados.pratos_por_dia) > 0
        && CAMPOS_FIXO.some(([chave]) => Number(carregados[chave]) > 0)
      ));
      // Usa o cálculo que o DRE já usa: folha dos contratados + diárias de
      // extras EFETIVAMENTE PAGAS (recibo). Duas contas de CMO no mesmo
      // sistema acabariam divergindo.
      setEquipe(resEquipe.data || []);
      setCmo(calcularCMO({ colaboradores: resEquipe.data || [], recibos: resRecibos.data || [] }));
      setMedido(medicao);
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
    // Texto intermediário ("." , "-", vazio) vira 0 em vez de NaN: um NaN aqui
    // contamina o custo inteiro e aparece como "R$ NaN" na tela.
    const n = Number(valor);
    setParams((p) => ({ ...p, [chave]: Number.isFinite(n) ? n : 0 }));
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
        // A abertura do CMO vem do RH: folha dos contratados e diárias de
        // extras, rateadas pelo mesmo volume que o resto da tela usa.
        const pratos = (Number(paramsComCmo.dias_operacao_mes) || 0) * (Number(paramsComCmo.pratos_por_dia) || 0);
        const partesCmo = cmo && pratos > 0
          ? [
              { rotulo: "Folha dos contratados", valor: cmo.folha / pratos },
              { rotulo: "Extras (diárias pagas)", valor: cmo.extras / pratos },
            ].filter((x) => x.valor > 0)
          : null;
        const conta = fatiasDoPrato({ ...entrada, partesCmo });
        // Os mesmos valores da pizza, prontos para as colunas da lista.
        const porFatia = (id) => conta.fatias.find((x) => x.id === id)?.valor || 0;
        return {
          ficha: f, entrada, conta, partesCmo,
          cmv: porFatia("cmv"), cmoUnit: porFatia("cmo"),
          fixoUnit: porFatia("fixo"), variavelUnit: porFatia("variavel"),
          sugerido: entrada.semCusto
            ? null
            : precoSugerido({ ...entrada, margemAlvoPct: paramsComCmo.margem_alvo_pct, params: paramsComCmo }),
        };
      })
      .filter((x) => x.conta.preco > 0)
      .sort((a, b) => {
        // Do que mais sobra para o que menos sobra. Quem dá prejuízo tem sobra
        // negativa e cai no fim sozinho, sem precisar de regra.
        const sobra = (x) => (x.conta.prejuizo > 0 ? -x.conta.prejuizo : x.conta.lucro) / x.conta.preco;
        return sobra(b) - sobra(a);
      });
  }, [fichas, produtos, paramsComCmo]);

  const daAba = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ranking.filter((x) => {
      if (aba !== "todos" && x.entrada.departamento !== aba) return false;
      return !q || String(x.ficha.nome_receita || "").toLowerCase().includes(q);
    });
  }, [ranking, busca, aba]);

  const filtrado = daAba;

  const atual = escolhida ? ranking.find((x) => x.ficha.id === escolhida) : filtrado[0];
  const contarAba = (id) => ranking.filter((x) => id === "todos" || x.entrada.departamento === id).length;
  const semVolume = !(Number(params.dias_operacao_mes) > 0 && Number(params.pratos_por_dia) > 0);
  // Enquanto não carregou, o painel fica aberto: melhor mostrar os campos do
  // que piscar fechado e abrir.
  const abrirPainel = painelAberto !== false;

  // O que as vendas dizem, arredondado para prato inteiro.
  const medidoDia = medido?.temDados ? Math.round(medido.media) : null;
  const usandoOutro = Number(params.pratos_por_dia) || 0;
  // "Diferente" com folga: brigar por um prato a mais ou a menos e barulho,
  // mas 10% de erro no divisor e 10% de erro no custo de TODO prato da casa.
  const medidoDiverge = medidoDia != null && usandoOutro > 0
    && Math.abs(medidoDia - usandoOutro) / usandoOutro >= 0.1;

  // O que impede os numeros desta tela de estarem certos. Sai de fichas e
  // produtos, que a tela ja carregou — nenhuma consulta a mais.
  const lacunas = useMemo(() => lacunasDoCusto({ fichas, produtos }), [fichas, produtos]);

  const dias = Number(params.dias_operacao_mes) || 0;
  const contasDia = useMemo(() => contasPorDia(params, dias), [params, dias]);
  const equipeDia = useMemo(() => equipePorDia(equipe, dias), [equipe, dias]);
  const cmoDia = dias > 0 && cmo ? cmo.total / dias : 0;
  // Preço médio do que se vende de verdade, para converter a embalagem em
  // reais num percentual sobre a venda.
  const precoMedio = useMemo(() => {
    const comPreco = ranking.filter((x) => x.conta.preco > 0);
    if (!comPreco.length) return 0;
    return comPreco.reduce((soma, x) => soma + x.conta.preco, 0) / comPreco.length;
  }, [ranking]);

  const equilibrio = useMemo(
    () => equilibrioDoCardapio({ params, cmoMes: cmo ? cmo.total : 0, precoMedio }),
    [params, cmo, precoMedio]);
  const custoDiaTotal = contasDia.totalDia + cmoDia;
  const pratosNoMes = (Number(params.dias_operacao_mes) || 0) * (Number(params.pratos_por_dia) || 0);
  const rateioPorPratoTotal = pratosNoMes > 0
    ? (contasDia.totalMes + (cmo ? cmo.total : 0)) / pratosNoMes : 0;

  // O cardápio montado, com os dados que cada prato já tem na lista.
  const itensMontados = useMemo(() => {
    return Object.entries(montado)
      .map(([id, quantidade]) => {
        const linha = ranking.find((x) => x.ficha.id === id);
        if (!linha) return null;
        return {
          id,
          nome: linha.ficha.nome_receita,
          departamento: linha.entrada.departamento,
          preco: linha.entrada.preco,
          custoCmvUnit: linha.entrada.custoIngredientes + linha.entrada.custoEmbalagem,
          impostoPct: linha.entrada.impostoPct,
          taxaMaquininhaPct: linha.entrada.taxaMaquininhaPct,
          quantidade,
        };
      })
      .filter(Boolean);
  }, [montado, ranking]);

  const cardapio = useMemo(
    () => simularCardapio({ itens: itensMontados, custoFixoMes: contasDia.totalMes, cmoMes: cmo ? cmo.total : 0 }),
    [itensMontados, contasDia.totalMes, cmo]);

  const qtdPratos = itensMontados.filter((x) => x.departamento !== "bar").length;
  const qtdBebidas = itensMontados.filter((x) => x.departamento === "bar").length;

  const podeAdicionar = (dep) => (dep === "bar" ? qtdBebidas < LIMITE_BEBIDAS : qtdPratos < LIMITE_PRATOS);

  const adicionar = (linha) => {
    if (montado[linha.ficha.id] !== undefined) return;
    if (!podeAdicionar(linha.entrada.departamento)) return;
    setMontado((m) => ({ ...m, [linha.ficha.id]: 100 }));
    setBuscaMontar("");
  };
  const mudarQtd = (id, v) => setMontado((m) => ({ ...m, [id]: Math.max(0, Number(v) || 0) }));
  const remover = (id) => setMontado((m) => { const p = { ...m }; delete p[id]; return p; });

  // Sugestões de quem ainda não está no cardápio.
  const sugestoes = useMemo(() => {
    const q = buscaMontar.trim().toLowerCase();
    if (!q) return [];
    return ranking
      .filter((x) => montado[x.ficha.id] === undefined
        && String(x.ficha.nome_receita || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [buscaMontar, ranking, montado]);


  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/modulo/financeiro")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-elevated text-slate-600 hover:bg-slate-200"
            aria-label="Voltar ao módulo Financeiro">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-fg">
              <PieChart className="text-emerald-600" size={24} /> Pizza do Lucro
            </h1>
            <p className="text-xs font-bold text-muted">Para onde vai cada real que você vende.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[["pratos", "Pizza dos pratos"], ["dia", "Custo por dia"], ["simulacao", "Simulação"], ["conferir", "O que falta"]].map(([id, rotulo]) => (
            <button key={id} onClick={() => setVisao(id)}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${visao === id ? "bg-emerald-600 text-white" : "border border-line bg-card text-muted hover:bg-slate-50"}`}>
              {rotulo}
            </button>
          ))}
        </div>

        {/* Custos do mês, editáveis aqui mesmo. */}
        <div className="mt-4 rounded-2xl border border-line bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button type="button" onClick={() => setPainelAberto(!abrirPainel)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-expanded={abrirPainel}>
              <ChevronDown size={16} className={`shrink-0 text-subtle transition-transform ${abrirPainel ? "" : "-rotate-90"}`} />
              <span className="min-w-0">
                <span className="block text-3xs font-bold uppercase tracking-widest text-subtle">Custos do mês</span>
                {/* Fechado, a linha precisa dizer o suficiente para ninguém
                    abrir só para conferir se está preenchido. */}
                {!abrirPainel && (
                  <span className="block truncate text-2xs font-bold text-muted">
                    {fmt(contasDia.totalMes)} de contas + {fmt(cmo ? cmo.total : 0)} de folha · {dias || 0} dias · toque para editar
                  </span>
                )}
              </span>
            </button>
            {abrirPainel && (
              <button onClick={salvar} disabled={salvando}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {salvando ? <Loader2 size={14} className="animate-spin" /> : salvo ? <Check size={14} /> : <Save size={14} />}
                {salvando ? "Salvando..." : salvo ? "Salvo" : "Salvar"}
              </button>
            )}
          </div>

          {/* FORA do painel de propósito. Fechado — que é como ele abre quando
              os campos já têm número —, este aviso ficava escondido justamente
              de quem mais precisa dele: o divisor errado não estraga uma linha
              da tela, estraga o custo de TODO prato da casa. */}
          {medidoDiverge && (
            <div className="mt-3 flex flex-wrap items-start gap-x-2 gap-y-1 rounded-xl bg-slate-50 px-3 py-2.5 text-2xs font-bold text-slate-600">
              <AlertTriangle size={13} className="mt-px shrink-0 text-subtle" />
              {/* `flex-1` prende o texto na MESMA linha do ícone. Sem isso, na
                  largura do celular o texto não cabia ao lado e descia inteiro,
                  deixando o ícone sozinho numa linha só dele. */}
              <span className="min-w-0 flex-1">
                A conta está dividindo o custo por <b className="text-slate-800">{usandoOutro} por dia</b>, mas
                suas vendas dos últimos 30 dias deram{" "}
                <b className="text-slate-800">{medidoDia} itens por dia</b>{" "}
                ({medido.totalItens.toLocaleString("pt-BR")} itens em {medido.diasComVenda} dias com movimento).
              </span>
              {/* Abre o painel junto: o botao Salvar so existe com ele aberto,
                  e adotar um numero que nao chega ao banco nao adianta nada. */}
              <button type="button"
                onClick={() => { editar("pratos_por_dia", medidoDia); setPainelAberto(true); }}
                className="font-black text-emerald-700 underline underline-offset-2">
                usar {medidoDia}
              </button>
            </div>
          )}
          {abrirPainel && (<>

          {/* CMO não tem campo: vem pronto do RH. */}
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5">
            <p className="text-3xs font-bold uppercase tracking-widest text-emerald-700">CMO — mão de obra</p>
            <p className="text-lg font-black text-emerald-800">{cmo ? fmt(cmo.total) : "—"}</p>
            <p className="text-3xs font-bold text-emerald-700/80">
              {cmo ? `${fmt(cmo.folha)} de folha + ${fmt(cmo.extras)} de extras (${cmo.recibos} recibo(s) pago(s))` : ""}
              {" · vem do RH e dos Extras, não precisa digitar"}
            </p>
            {cmo && cmo.extrasEmAberto > 0 && (
              <p className="mt-1 text-3xs font-bold text-slate-600">
                Faltam {fmt(cmo.extrasEmAberto)} em recibos de extra ainda não pagos. Enquanto não forem, não entram no CMO e o lucro abaixo aparece maior do que é.
              </p>
            )}
          </div>

          <p className="mt-3 text-3xs font-bold uppercase tracking-widest text-subtle">Custo fixo (por mês)</p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {CAMPOS_FIXO.map(([chave, rotulo]) => (
              <CampoNumero key={chave} rotulo={rotulo} valor={params[chave]} onChange={(v) => editar(chave, v)} />
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Custo variável (% da venda)</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {CAMPOS_VARIAVEL.map(([chave, rotulo]) => (
                  <CampoNumero key={chave} rotulo={rotulo} valor={params[chave]} onChange={(v) => editar(chave, v)} step="0.1" />
                ))}
                {CAMPOS_REAIS.map(([chave, rotulo]) => (
                  <CampoNumero key={chave} rotulo={rotulo} valor={params[chave]} onChange={(v) => editar(chave, v)} step="0.01" />
                ))}
                {/* Quem já tinha embalagem em % não pode ver a conta mudar em
                    silêncio: a tela converte o valor antigo e oferece. */}
                {Number(params.embalagem_pct) > 0 && !Number(params.embalagem_valor) && precoMedio > 0 && (
                  <p className="col-span-2 text-2xs font-bold text-muted">
                    Você tinha {Number(params.embalagem_pct)}% de embalagem aqui. No prato médio de {fmt(precoMedio)} isso dava{" "}
                    <button type="button" onClick={() => editar("embalagem_valor", (precoMedio * Number(params.embalagem_pct)) / 100)}
                      className="font-black text-emerald-700 underline underline-offset-2">
                      {fmt((precoMedio * Number(params.embalagem_pct)) / 100)} por prato
                    </button>
                    {" "}— toque para usar esse valor.
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Volume (divide o fixo e o CMO)</p>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {CAMPOS_VOLUME.map(([chave, rotulo]) => (
                  <CampoNumero key={chave} rotulo={rotulo} valor={params[chave]} onChange={(v) => editar(chave, v)} step="1" destacado={semVolume} />
                ))}
              </div>
              {/* Mostra o que o rateio PRODUZ, enquanto se digita. Estes dois
                  campos são silenciosos demais: trocar 100 por 1 multiplica o
                  custo de cada prato por cem e faz o cardápio inteiro virar
                  prejuízo, sem nada na tela dizendo o porquê. Vendo o valor
                  por prato, o erro salta. */}
              {!semVolume && (
                <p className="mt-1.5 text-2xs font-bold text-muted">
                  Cada prato carrega <b className="text-slate-800">{fmt(rateioPorPratoTotal)}</b> de custo fixo e folha
                  {" "}({(Number(params.dias_operacao_mes) || 0) * (Number(params.pratos_por_dia) || 0)} pratos no mês).
                </p>
              )}
              {/* Dentro do painel, ao lado do campo: aqui a medição é conferência
                  ("bate com o que estou usando?"). O convite para adotar fica na
                  faixa acima, que aparece mesmo com o painel fechado. */}
              {medido?.temDados && (
                <p className="mt-1 text-2xs font-bold text-muted">
                  Medido nas suas vendas:{" "}
                  <b className="text-slate-800">{medidoDia} itens por dia</b>{" "}
                  ({medido.totalItens.toLocaleString("pt-BR")} itens em {medido.diasComVenda} dias com movimento
                  nos últimos 30 dias).
                </p>
              )}
              {medido && !medido.temDados && (
                <p className="mt-1 text-2xs font-bold text-muted">
                  Sem vendas registradas nos últimos 30 dias, não dá para medir esse número aqui — ele fica por sua conta.
                </p>
              )}
            </div>
          </div>

          {semVolume && (
            <p className="mt-2 flex items-start gap-1.5 text-2xs font-bold text-slate-600">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              Sem dias de operação e pratos por dia não dá para dividir o fixo nem o CMO por prato — e o lucro aparece maior do que é.
            </p>
          )}
          </>)}
        </div>

        {loading ? (
          <div className="grid min-h-[40vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>
        ) : visao === "dia" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* Quanto sai do bolso antes de vender o primeiro prato. */}
            <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Custo de um dia aberto</p>
              <p className="mt-1 text-3xl font-black text-fg">{fmt(custoDiaTotal)}</p>
              <p className="text-2xs font-bold text-muted">
                {dias > 0 ? `${fmt(contasDia.totalMes + (cmo ? cmo.total : 0))} por mês ÷ ${dias} dias que a casa abre` : "Preencha os dias de operação acima"}
              </p>
              <div className="mt-3 space-y-1.5 border-t border-line-soft pt-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-black text-fg-soft">Gente (CMO)</span>
                  <span className="font-black text-fg">{fmt(cmoDia)}</span>
                  <span className="w-12 text-right font-bold text-subtle">{custoDiaTotal > 0 ? `${((cmoDia / custoDiaTotal) * 100).toFixed(0)}%` : "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex-1 font-black text-fg-soft">Contas da casa</span>
                  <span className="font-black text-fg">{fmt(contasDia.totalDia)}</span>
                  <span className="w-12 text-right font-bold text-subtle">{custoDiaTotal > 0 ? `${((contasDia.totalDia / custoDiaTotal) * 100).toFixed(0)}%` : "—"}</span>
                </div>
              </div>

              {/* Ponto de equilíbrio do cardápio inteiro. Veio da tela que
                  esta absorveu: responde em REAIS por dia, sem depender de
                  qual prato saiu. */}
              <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5">
                <p className="text-3xs font-bold uppercase tracking-widest text-emerald-700">Quanto faturar por dia para empatar</p>
                {equilibrio.faturamentoDia === null ? (
                  <p className="mt-0.5 text-2xs font-bold text-slate-600">
                    {!equilibrio.rateavel
                      ? "Preencha os dias de operação acima."
                      : `Com ${equilibrio.variavelPct.toFixed(1)}% de custo variável não sobra nada de cada venda — nenhum faturamento empata. Reveja a meta de CMV, o imposto, a maquininha e a embalagem.`}
                  </p>
                ) : (
                  <>
                    <p className="text-2xl font-black text-emerald-800">{fmt(equilibrio.faturamentoDia)}</p>
                    <p className="text-2xs font-bold text-emerald-700/80">
                      {fmt(equilibrio.faturamentoMes)} no mês · de cada real vendido sobram {equilibrio.margemPct.toFixed(1)}% para pagar o fixo. Acima disso é lucro.
                      {equilibrio.embalagemPct > 0 && ` Embalagem de ${fmt(params.embalagem_valor)} pesa ${equilibrio.embalagemPct.toFixed(1)}% num prato médio de ${fmt(precoMedio)}.`}
                    </p>
                  </>
                )}
              </div>

              <p className="mt-4 text-3xs font-bold uppercase tracking-widest text-subtle">Cada conta por dia</p>
              <ul className="mt-1.5 space-y-1">
                {contasDia.itens.map((i) => (
                  <li key={i.chave} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-bold text-slate-600">{i.rotulo}</span>
                    <span className="shrink-0 font-bold text-subtle">{fmt(i.mes)}/mês</span>
                    <span className="w-20 shrink-0 text-right font-black text-slate-800">{fmt(i.dia)}</span>
                  </li>
                ))}
                {!contasDia.itens.length && <li className="py-3 text-center text-xs font-bold text-subtle">Nenhuma conta preenchida.</li>}
              </ul>
            </div>

            {/* Quanto cada pessoa custa por dia. */}
            <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Quanto cada pessoa custa por dia</p>
              <p className="mt-1 text-2xs font-bold text-muted">
                Contratado: salário do mês ÷ {dias || "—"} dias. Extra: a diária inteira, no dia em que vem.
              </p>
              <ul className="mt-3 space-y-1">
                {equipeDia.fixos.map((pe) => (
                  <li key={pe.id} className="flex items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-bold text-fg-soft">{pe.nome}
                      {pe.cargo && <span className="font-bold text-subtle"> · {pe.cargo}</span>}</span>
                    <span className="shrink-0 font-bold text-subtle">{fmt(pe.mes)}/mês</span>
                    <span className="w-20 shrink-0 text-right font-black text-slate-800">{fmt(pe.dia)}</span>
                  </li>
                ))}
              </ul>
              {!!equipeDia.extras.length && (
                <>
                  <p className="mt-4 text-3xs font-bold uppercase tracking-widest text-subtle">Extras (só no dia que vêm)</p>
                  <ul className="mt-1.5 space-y-1">
                    {equipeDia.extras.map((pe) => (
                      <li key={pe.id} className="flex items-center gap-2 text-xs">
                        <span className="min-w-0 flex-1 truncate font-bold text-slate-600">{pe.nome}
                          {pe.cargo && <span className="font-bold text-subtle"> · {pe.cargo}</span>}</span>
                        <span className="w-20 shrink-0 text-right font-black text-slate-800">{fmt(pe.dia)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {!equipeDia.fixos.length && !equipeDia.extras.length && (
                <p className="py-6 text-center text-xs font-bold text-subtle">Nenhum colaborador ativo.</p>
              )}
            </div>
          </div>
        ) : visao === "simulacao" ? (
          <div className="mt-4 space-y-4">
            {/* Montar o cardápio: escolher os itens e dizer quanto vende de
                cada um. É a pergunta que o dono faz de verdade — "com este
                cardápio, o mês fecha?" — e que uma simulação de um prato só
                não responde. */}
            <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Monte o cardápio</p>
                <p className="text-2xs font-bold text-muted">
                  {qtdPratos}/{LIMITE_PRATOS} pratos · {qtdBebidas}/{LIMITE_BEBIDAS} bebidas
                </p>
              </div>

              <div className="relative mt-2">
                <label className="flex items-center gap-2 rounded-xl border border-line bg-card px-3">
                  <Search size={16} className="shrink-0 text-subtle" />
                  <input value={buscaMontar} onChange={(e) => setBuscaMontar(e.target.value)}
                    placeholder="Buscar para adicionar ao cardápio..."
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:font-medium placeholder:text-subtle" />
                  {buscaMontar && <button onClick={() => setBuscaMontar("")} className="text-subtle hover:text-fg-soft"><X size={15} /></button>}
                </label>
                {!!sugestoes.length && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-line bg-card shadow-lg">
                    {sugestoes.map((x) => {
                      const cabe = podeAdicionar(x.entrada.departamento);
                      return (
                        <li key={x.ficha.id}>
                          <button type="button" onClick={() => adicionar(x)} disabled={!cabe}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 disabled:opacity-40">
                            <span className="min-w-0 flex-1 truncate font-bold text-fg-soft">{x.ficha.nome_receita}</span>
                            <span className="shrink-0 font-bold text-subtle">{fmt(x.conta.preco)}</span>
                            {!cabe && <span className="shrink-0 text-3xs font-bold uppercase text-subtle">limite</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {!itensMontados.length ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs font-bold text-subtle">
                  Busque acima e adicione os itens. Cada um entra com 100 por mês — ajuste a quantidade depois.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-3xs font-bold uppercase tracking-widest text-subtle">
                        <th className="py-2 pr-2">Item</th>
                        <th className="whitespace-nowrap py-2 px-2 text-right">Preço</th>
                        <th className="whitespace-nowrap py-2 px-2 text-right">Qtd / mês</th>
                        <th className="whitespace-nowrap py-2 px-2 text-right">Fatura</th>
                        <th className="whitespace-nowrap py-2 px-2 text-right">Sobra dele</th>
                        <th className="whitespace-nowrap py-2 px-2 text-right">% da receita</th>
                        <th className="py-2 pl-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {cardapio.itens.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2 pr-2 font-bold text-fg-soft">
                            {it.nome}
                            <span className="ml-1.5 text-3xs font-bold uppercase text-subtle">{it.departamento === "bar" ? "bebida" : "prato"}</span>
                          </td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-bold text-muted">{fmt(it.preco)}</td>
                          <td className="whitespace-nowrap py-2 px-2 text-right">
                            <input type="number" min="0" step="10" value={it.quantidade}
                              onChange={(e) => mudarQtd(it.id, e.target.value)}
                              className="h-9 w-24 rounded-lg border border-line bg-card px-2 text-right text-sm font-black text-slate-800 outline-none focus:border-emerald-500" />
                          </td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-bold text-muted">{fmt(it.receita)}</td>
                          {/* A sobra DELE é o que esta linha deixa para pagar o
                              fixo — não é lucro: o fixo ainda não foi tirado. */}
                          <td className={`whitespace-nowrap py-2 px-2 text-right font-black ${it.contribuicaoTotal < 0 ? "text-muted" : "text-slate-800"}`}>
                            {fmt(it.contribuicaoTotal)}
                          </td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-bold text-subtle">{it.pctDaReceita.toFixed(0)}%</td>
                          <td className="py-2 pl-2 text-right">
                            <button type="button" onClick={() => remover(it.id)} aria-label={`Tirar ${it.nome}`}
                              className="text-dim hover:text-slate-600"><X size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {!!itensMontados.length && (
              <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Resultado do mês</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-3xs font-bold uppercase tracking-wider text-subtle">Fatura</p>
                    <p className="text-lg font-black text-slate-800">{fmt(cardapio.receita)}</p>
                    <p className="text-3xs font-bold text-subtle">{cardapio.quantidadeTotal.toLocaleString("pt-BR")} itens vendidos</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-3xs font-bold uppercase tracking-wider text-subtle">CMV + variável</p>
                    <p className="text-lg font-black text-slate-800">{fmt(cardapio.cmvTotal + cardapio.variavelTotal)}</p>
                    <p className="text-3xs font-bold text-subtle">{fmt(cardapio.cmvTotal)} de mercadoria</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <p className="text-3xs font-bold uppercase tracking-wider text-subtle">Fixo + folha</p>
                    <p className="text-lg font-black text-slate-800">{fmt(cardapio.fixoTotal)}</p>
                    <p className="text-3xs font-bold text-subtle">entra uma vez, não por item</p>
                  </div>
                  <div className={`rounded-xl px-3 py-2.5 ${cardapio.sobra >= 0 ? "bg-emerald-50" : "bg-slate-200"}`}>
                    <p className={`text-3xs font-bold uppercase tracking-wider ${cardapio.sobra >= 0 ? "text-emerald-700" : "text-slate-600"}`}>
                      {cardapio.sobra >= 0 ? "Sobra para você" : "Falta"}
                    </p>
                    <p className={`text-lg font-black ${cardapio.sobra >= 0 ? "text-emerald-700" : "text-slate-800"}`}>{fmt(Math.abs(cardapio.sobra))}</p>
                    <p className={`text-3xs font-bold ${cardapio.sobra >= 0 ? "text-emerald-700/70" : "text-muted"}`}>
                      margem média {cardapio.margemMediaPct.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <p className="mt-3 border-t border-line-soft pt-3 text-sm font-bold text-fg-soft">
                  {cardapio.faltaParaEmpatar > 0 ? (
                    <>Faltam <b className="text-fg">{fmt(cardapio.faltaParaEmpatar)}</b> de margem para o mês empatar. Vender mais, subir preço ou baixar custo — a coluna “Sobra dele” diz quais itens puxam para cima.</>
                  ) : (
                    <>Este cardápio paga tudo e ainda deixa <b className="text-emerald-700">{fmt(cardapio.sobra)}</b> no mês.</>
                  )}
                </p>
                <p className="mt-1 text-2xs font-bold text-subtle">
                  “Sobra dele” é o que cada item deixa depois do próprio custo e dos variáveis — o fixo e a folha são descontados uma vez, do total.
                </p>
              </div>
            )}
          </div>
        ) : !ranking.length ? (
          <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-card p-12 text-center text-sm font-bold text-subtle">
            Nenhum prato com preço de venda ainda. Defina o preço nas fichas para ver a pizza.
          </p>
        ) : visao === "conferir" ? (
          /* O QUE FALTA
           *
           * Todo numero desta tela depende de quatro coisas ligadas, e elas
           * moram em tres telas: o insumo precisa de preco, a ficha precisa de
           * ingredientes e rendimento, e o produto do cardapio precisa de preco
           * E de estar LIGADO a uma ficha.
           *
           * O quarto e o que ninguem adivinha. Sem a ligacao, o prato nao entra
           * na conta — sem erro, sem aviso. A media aparece bonita cobrindo um
           * terco da casa. Aqui o buraco fica visivel, com o caminho de onde se
           * resolve cada um. */
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-line bg-card p-4">
              <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Quanto do cardápio entra na conta</p>
              <p className="mt-1.5 text-4xl font-bold tracking-tight"
                style={{ fontVariantNumeric: "tabular-nums", color: lacunas.cobertura.pct >= 90 ? "var(--accent)" : "var(--danger-strong)" }}>
                {lacunas.cobertura.total ? `${Math.round(lacunas.cobertura.pct)}%` : "—"}
              </p>
              <p className="mt-1 text-2xs font-bold text-muted">
                {lacunas.cobertura.total
                  ? `${lacunas.cobertura.cobertos} de ${lacunas.cobertura.total} itens com preço estão ligados a uma ficha.`
                  : "Nenhum item do cardápio tem preço de venda ainda."}
              </p>
              {lacunas.pendencias === 0 && lacunas.cobertura.total > 0 && (
                <p className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-2xs font-bold" style={{ color: "var(--accent-strong)" }}>
                  Nada faltando. Os números desta tela cobrem o cardápio inteiro.
                </p>
              )}
            </div>

            {[
              ["Sem ficha ligada — ficam fora do CMV", lacunas.produtosSemFicha,
               "O produto tem preço mas não aponta para nenhuma ficha, então o custo dele não existe para o sistema.",
               "/dashboard/operacao/produtos", "Abrir Produtos", true],
              ["Apontam para uma ficha que não existe mais", lacunas.produtosComFichaQuebrada,
               "Pior que não ligado: parece configurado e custa zero.",
               "/dashboard/operacao/produtos", "Abrir Produtos", true],
              ["Ingredientes sem preço", lacunas.ingredientesSemPreco,
               "Entram na ficha valendo zero e derrubam o CMV de todo prato que os usa. O primeiro da lista é o que trava mais fichas.",
               `/dashboard/operacao/ingredientes?dept=${aba === "bar" ? "bar" : "cozinha"}`, "Abrir Ingredientes", true],
              ["Fichas sem rendimento", lacunas.fichasSemRendimento,
               "Sem saber quanto rende, não dá para dividir o custo por porção.",
               `/dashboard/operacao/fichas?dept=${aba === "bar" ? "bar" : "cozinha"}`, "Abrir Fichas", false],
              ["Fichas sem ingrediente", lacunas.fichasSemIngrediente,
               "A ficha existe e custa zero. Produto pronto não entra aqui — ele não precisa de receita.",
               `/dashboard/operacao/fichas?dept=${aba === "bar" ? "bar" : "cozinha"}`, "Abrir Fichas", false],
              ["Com ficha e sem preço de venda", lacunas.produtosSemPreco,
               "Dá para saber o custo, não dá para saber se o preço cobre.",
               "/dashboard/operacao/produtos", "Abrir Produtos", false],
            ].filter(([, lista]) => lista.length > 0).map(([titulo, lista, porque, href, acao, grave]) => (
              <div key={titulo} className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="w-1 self-stretch rounded-full" style={{ background: grave ? "var(--danger-strong)" : "var(--subtle)" }} />
                    <p className="text-sm font-bold text-fg">{titulo} <span className="text-muted">({lista.length})</span></p>
                  </div>
                  <button onClick={() => router.push(href)}
                    className="shrink-0 text-2xs font-bold text-accent underline underline-offset-2">{acao} →</button>
                </div>
                <p className="px-4 pb-2 text-2xs font-medium text-muted">{porque}</p>
                <ul className="border-t border-line-soft">
                  {lista.slice(0, 8).map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2 last:border-b-0">
                      <span className="min-w-0 flex-1 truncate text-2xs font-bold text-fg-soft">{item.nome}</span>
                      <span className="shrink-0 text-3xs font-bold text-muted">
                        {item.fichas ? `em ${item.fichas} ficha${item.fichas > 1 ? "s" : ""}` : item.preco ? fmt(item.preco) : item.departamento || ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {lista.length > 8 && (
                  <p className="px-4 py-2 text-3xs font-bold text-subtle">e mais {lista.length - 8}.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {ABAS.map((a) => (
                  <button key={a.id} onClick={() => { setAba(a.id); setEscolhida(null); }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${aba === a.id ? "bg-emerald-600 text-white" : "border border-line bg-card text-muted hover:bg-slate-50"}`}>
                    {a.rotulo}
                    <span className={`rounded-full px-1.5 text-3xs ${aba === a.id ? "bg-white/25" : "bg-elevated text-muted"}`}>{contarAba(a.id)}</span>
                  </button>
                ))}
              </div>

              <label className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-card px-3">
                <Search size={16} className="shrink-0 text-subtle" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prato..."
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none placeholder:font-medium placeholder:text-subtle" />
                {busca && <button onClick={() => setBusca("")} className="text-subtle hover:text-fg-soft"><X size={15} /></button>}
              </label>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-3xs font-bold uppercase tracking-widest text-subtle">
                      <th className="py-2 pr-2">Prato</th>
                      <th className="whitespace-nowrap py-2 px-2 text-right">CMV</th>
                      <th className="whitespace-nowrap py-2 px-2 text-right">CMO</th>
                      <th className="whitespace-nowrap py-2 px-2 text-right">Fixo</th>
                      <th className="whitespace-nowrap py-2 px-2 text-right">Variável</th>
                      <th className="whitespace-nowrap py-2 px-2 text-right">Venda</th>
                      <th className="whitespace-nowrap py-2 px-2 text-right">Sugerido</th>
                      <th className="whitespace-nowrap py-2 px-2 text-right">Sobra</th>
                      <th className="whitespace-nowrap py-2 pl-2 text-right">% da venda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtrado.map((x) => {
                      const ehAtual = atual && atual.ficha.id === x.ficha.id;
                      const duvidoso = x.entrada.semCusto;
                      const pct = x.conta.preco > 0 ? (x.conta.lucro / x.conta.preco) * 100 : 0;
                      return (
                        <Fragment key={x.ficha.id}>
                        <tr onClick={() => setEscolhida(escolhida === x.ficha.id ? null : x.ficha.id)}
                          className={`cursor-pointer transition-colors ${ehAtual ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                          <td className="py-2 pr-2 font-bold text-fg-soft">
                            <span className="mr-1.5">{x.ficha.nome_receita}</span>
                            {x.entrada.semCusto && (
                              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-elevated px-1.5 py-0.5 text-3xs font-bold uppercase text-muted">
                                <AlertTriangle size={9} /> sem custo
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-bold text-muted">{fmt(x.cmv)}</td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-bold text-muted">{fmt(x.cmoUnit)}</td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-bold text-muted">{fmt(x.fixoUnit)}</td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-bold text-muted">{fmt(x.variavelUnit)}</td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-bold text-muted">{fmt(x.conta.preco)}</td>
                          {/* Verde só quando o sugerido é MAIOR que o preço de
                              hoje: é o caso em que há dinheiro na mesa. */}
                          <td className={`whitespace-nowrap py-2 px-2 text-right font-black ${x.sugerido === null ? "text-dim" : x.sugerido > x.conta.preco ? "text-emerald-700" : "text-subtle"}`}
                            title={x.sugerido === null ? "Sem custo de ingrediente na ficha não dá para sugerir preço." : ""}>
                            {x.sugerido === null ? "—" : fmt(x.sugerido)}
                          </td>
                          <td className="whitespace-nowrap py-2 px-2 text-right font-black text-slate-800">
                            {x.conta.prejuizo > 0 ? `\u2212\u00A0${fmt(x.conta.prejuizo)}` : fmt(x.conta.lucro)}
                          </td>
                          <td className="whitespace-nowrap py-2 pl-2 text-right">
                            <span className={`inline-block whitespace-nowrap rounded-lg px-2 py-0.5 font-black ${x.conta.prejuizo > 0 ? "bg-slate-200 text-fg-soft" : duvidoso ? "bg-elevated text-muted" : "bg-emerald-100 text-emerald-800"}`}>
                              {x.conta.prejuizo > 0 ? "prejuízo" : `${pct.toFixed(0)}%`}
                            </span>
                          </td>
                        </tr>
                        {/* A pizza abre AQUI, colada na linha que foi clicada.
                            Num cartão separado embaixo da lista ela ficava a
                            cem linhas de distância do prato que explica. */}
                        {ehAtual && (
                          <tr>
                            <td colSpan={9} className="bg-slate-50 px-3 py-4">
                              {(x.entrada.semCusto || x.entrada.semRendimento) && (
                                <p className="mx-auto mb-3 flex max-w-xl items-start gap-1.5 rounded-lg bg-card px-2.5 py-2 text-3xs font-bold text-slate-600">
                                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                  {x.entrada.semCusto
                                    ? "Este item não tem custo de produto na ficha (revenda, por exemplo). O lucro está alto porque falta o custo, não porque ele é bom."
                                    : "A ficha não diz em quantas porções rende, então o rendimento inteiro está valendo como uma porção. Se ela rende mais de uma, defina o peso da porção na ficha."}
                                </p>
                              )}
                              <div className="mx-auto max-w-md">
                                <PizzaDoPrato {...x.entrada} partesCmo={x.partesCmo} />
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                {!filtrado.length && <p className="py-8 text-center text-xs font-bold text-subtle">Nenhum prato aqui.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
