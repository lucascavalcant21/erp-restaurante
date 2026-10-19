"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarPlus, CheckCircle2, Clock, Clock3, Loader2, Pencil,
  Plus, Printer, Save, Scissors, Shirt, ShoppingBag, Sparkles, Trash2, Users, Utensils,
} from "lucide-react";
import { useERP } from "../../../../../context/ERPContext";
import { supabase } from "../../../../../lib/supabase";
import {
  atualizarPagamentoRecibo, excluirReciboPrestacao, fetchColaboradores,
  fetchConsumoFuncionario, fetchRecibosPrestacao, salvarReciboPrestacao,
} from "../../../../../lib/rh";
import {
  RECIBO_TEXTOS_PADRAO, fetchReciboTextos, imprimirReciboExtra,
} from "../../../../../lib/recibo-extra";
import CampoDecimal from "../../../../../components/CampoDecimal";

const hojeISO = () => new Date().toISOString().slice(0, 10);
const parseNum = (v) => Number(String(v ?? "").replace(",", ".")) || 0;
const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (valor) => valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const rotuloDiaSemana = (iso) => {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  const [ano, mes, dia] = String(iso).slice(0, 10).split("-");
  return `${DIAS_SEMANA_CURTO[d.getDay()]} · ${dia}/${mes}`;
};

export default function GerarPagamentoExtraPage() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [extra, setExtra] = useState(null);
  const [todosColabs, setTodosColabs] = useState([]);
  const [consumosPendentes, setConsumosPendentes] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [textos, setTextos] = useState(RECIBO_TEXTOS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Lista de dias trabalhados com data e valor individual (ex.: Terça 09/10 R$ 120 | Quinta 11/10 R$ 200)
  const [diasDetalhados, setDiasDetalhados] = useState([
    { data: hojeISO(), valor: "", obs: "" },
  ]);

  // Lista de descontos / produtos consumidos (ex.: Coca-Cola R$ 8,00)
  const [descontosItens, setDescontosItens] = useState([]);

  const [form, setForm] = useState({
    forma_pagamento: "Pix",
    valor_dinheiro: "",
    valor_pix: "",
    vale_transporte: "",
    adicional: "",
    hora_entrada: "",
    hora_saida: "",
    alimentacao: true,
    materiais: false,
    descricao_materiais: "",
    desmembrar: true,
    taxa_servico: "",
    inss: "",
    fgts: "",
  });

  const carregarHistorico = async () => {
    const resposta = await fetchRecibosPrestacao(id);
    setRecibos(resposta.data || []);
  };

  useEffect(() => {
    setCarregando(true);
    setErro("");
    Promise.all([
      supabase.from("colaboradores").select("*").eq("id", id).maybeSingle(),
      fetchRecibosPrestacao(id),
      fetchReciboTextos(unidadeAtiva),
      unidadeAtiva ? fetchColaboradores(unidadeAtiva) : Promise.resolve({ data: [] }),
      fetchConsumoFuncionario(id),
    ]).then(([cadastro, historico, configuracao, colabsResp, consumoResp]) => {
      if (!cadastro.data) {
        setErro("Colaborador não encontrado.");
      } else {
        const colab = cadastro.data;
        const ehFree = colab.tipo_contrato === "Freelancer";
        const valPadrao = ehFree && colab.salario ? Number(colab.salario) : 0;
        setExtra(colab);
        setDiasDetalhados([
          { data: hojeISO(), valor: valPadrao > 0 ? String(valPadrao) : "", obs: "" },
        ]);
        setDescontosItens([]);
        setForm((anterior) => ({
          ...anterior,
          forma_pagamento: colab.forma_pagamento || "Pix",
          valor_dinheiro: "",
          valor_pix: "",
          hora_entrada: colab.horario_entrada || "",
          hora_saida: colab.horario_saida || "",
          alimentacao: colab.janta_ofertada !== false,
          materiais: !!String(colab.itens_emprestados || "").trim(),
          descricao_materiais: colab.itens_emprestados || "",
          taxa_servico: valPadrao > 0 ? (valPadrao * 0.10).toFixed(2) : "",
          inss: valPadrao > 0 ? (valPadrao * 0.11).toFixed(2) : "",
          fgts: valPadrao > 0 ? (valPadrao * 0.08).toFixed(2) : "",
        }));
      }
      setRecibos(historico.data || []);
      if (configuracao.data) setTextos(configuracao.data);
      setTodosColabs((colabsResp?.data || []).filter((c) => (c.status || "ativo") !== "inativo"));
      setConsumosPendentes(
        (consumoResp?.data || []).filter((c) => String(c.status_pagamento || "").toLowerCase() !== "pago")
      );
      setCarregando(false);
    });
  }, [id, unidadeAtiva]);

  // Totais calculados automaticamente a partir dos dias e dos descontos por item
  const subtotalDias = useMemo(
    () => diasDetalhados.reduce((acc, d) => acc + parseNum(d.valor), 0),
    [diasDetalhados]
  );

  const totalDescontos = useMemo(
    () => descontosItens.reduce((acc, it) => acc + parseNum(it.valor), 0),
    [descontosItens]
  );

  const valorTransporte = parseNum(form.vale_transporte);
  const valorAdicional = parseNum(form.adicional);

  const valorLiquidoTotal = useMemo(
    () => Math.max(0, Math.round((subtotalDias + valorTransporte + valorAdicional - totalDescontos) * 100) / 100),
    [subtotalDias, valorTransporte, valorAdicional, totalDescontos]
  );

  // Recalcula encargos proporcionais quando o subtotal bruto muda
  useEffect(() => {
    if (!form.desmembrar) return;
    setForm((ant) => ({
      ...ant,
      taxa_servico: subtotalDias > 0 ? (subtotalDias * 0.10).toFixed(2) : "",
      inss: subtotalDias > 0 ? (subtotalDias * 0.11).toFixed(2) : "",
      fgts: subtotalDias > 0 ? (subtotalDias * 0.08).toFixed(2) : "",
    }));
  }, [subtotalDias, form.desmembrar]);

  // Ajusta o pagamento dividido quando o total líquido muda e o modo é Híbrido
  useEffect(() => {
    if (!form.forma_pagamento.includes("Híbrido")) return;
    const vDin = parseNum(form.valor_dinheiro);
    if (vDin > 0 && vDin <= valorLiquidoTotal) {
      const restPix = Math.max(0, Math.round((valorLiquidoTotal - vDin) * 100) / 100);
      setForm((ant) => ({ ...ant, valor_pix: String(restPix.toFixed(2)) }));
    }
  }, [valorLiquidoTotal, form.forma_pagamento]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (campo, valor) => {
    setForm((anterior) => {
      const novo = { ...anterior, [campo]: valor };
      // Auto-completar o outro campo no pagamento dividido (Dinheiro + Pix)
      if (campo === "valor_dinheiro" && anterior.forma_pagamento.includes("Híbrido")) {
        const vDin = parseNum(valor);
        const restPix = Math.max(0, Math.round((valorLiquidoTotal - vDin) * 100) / 100);
        novo.valor_pix = valorLiquidoTotal > 0 ? String(restPix.toFixed(2)) : "";
      } else if (campo === "valor_pix" && anterior.forma_pagamento.includes("Híbrido")) {
        const vPx = parseNum(valor);
        const restDin = Math.max(0, Math.round((valorLiquidoTotal - vPx) * 100) / 100);
        novo.valor_dinheiro = valorLiquidoTotal > 0 ? String(restDin.toFixed(2)) : "";
      } else if (campo === "forma_pagamento" && String(valor).includes("Híbrido")) {
        const metade = Math.round((valorLiquidoTotal / 2) * 100) / 100;
        const outraMetade = Math.max(0, Math.round((valorLiquidoTotal - metade) * 100) / 100);
        novo.valor_dinheiro = valorLiquidoTotal > 0 ? String(metade.toFixed(2)) : "";
        novo.valor_pix = valorLiquidoTotal > 0 ? String(outraMetade.toFixed(2)) : "";
      }
      return novo;
    });
  };

  // Gerenciamento de dias trabalhados
  const atualizarDia = (idx, campo, valor) => {
    setDiasDetalhados((lista) => lista.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)));
  };

  const adicionarDia = () => {
    setDiasDetalhados((lista) => {
      const ultimaData = lista[lista.length - 1]?.data || hojeISO();
      const dt = new Date(`${ultimaData}T12:00:00`);
      dt.setDate(dt.getDate() + 1);
      const proxData = Number.isNaN(dt.getTime()) ? hojeISO() : dt.toISOString().slice(0, 10);
      const ultimoValor = lista[lista.length - 1]?.valor || (extra?.tipo_contrato === "Freelancer" && extra?.salario ? String(extra.salario) : "");
      return [...lista, { data: proxData, valor: ultimoValor, obs: "" }];
    });
  };

  const removerDia = (idx) => {
    setDiasDetalhados((lista) => (lista.length <= 1 ? lista : lista.filter((_, i) => i !== idx)));
  };

  // Gerenciamento de descontos / produtos consumidos
  const adicionarDesconto = (descricaoInicial = "", valorInicial = "") => {
    setDescontosItens((lista) => [...lista, { descricao: descricaoInicial, valor: valorInicial }]);
  };

  const atualizarDesconto = (idx, campo, valor) => {
    setDescontosItens((lista) => lista.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item)));
  };

  const removerDesconto = (idx) => {
    setDescontosItens((lista) => lista.filter((_, i) => i !== idx));
  };

  const importarConsumoPendente = (consumo) => {
    const val = Number(consumo.valor_desconto ?? consumo.valor_original ?? 0);
    adicionarDesconto(consumo.descricao || "Consumo", val > 0 ? val.toFixed(2) : "");
  };

  const montarPagamento = (numero) => {
    const diasValidos = diasDetalhados
      .filter((d) => d.data && parseNum(d.valor) > 0)
      .map((d) => ({
        data: d.data,
        valor: parseNum(d.valor),
        obs: String(d.obs || "").trim(),
      }))
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));

    const datasContratadas = diasValidos.map((d) => d.data);
    const dataPrincipal = datasContratadas[0] || hojeISO();
    const qtdDias = Math.max(1, diasValidos.length);
    const diariaMedia = qtdDias > 0 ? subtotalDias / qtdDias : subtotalDias;

    const descontosValidos = descontosItens
      .filter((it) => String(it.descricao || "").trim() || parseNum(it.valor) > 0)
      .map((it) => ({
        descricao: String(it.descricao || "Produto / Consumo").trim(),
        valor: parseNum(it.valor),
      }));

    const valPix = parseNum(form.valor_pix);
    const valDinheiro = parseNum(form.valor_dinheiro);

    const valTaxaServico = parseNum(form.taxa_servico) || (form.desmembrar ? subtotalDias * 0.10 : 0);
    const valInss = parseNum(form.inss) || (form.desmembrar ? subtotalDias * 0.11 : 0);
    const valFgts = parseNum(form.fgts) || (form.desmembrar ? subtotalDias * 0.08 : 0);

    const itens = form.materiais
      ? String(form.descricao_materiais || "").split(",").map((item) => item.trim()).filter(Boolean)
      : [];

    return {
      unidade_id: unidadeAtiva,
      colaborador_id: extra.id,
      numero,
      data_trabalho: dataPrincipal,
      datas_contratadas: datasContratadas.length ? datasContratadas : [dataPrincipal],
      dias_contratados: qtdDias,
      valor_diaria: Math.round(diariaMedia * 100) / 100,
      valor_total: valorLiquidoTotal,
      pagamento_realizado: true,
      data_pagamento: hojeISO(),
      forma_pagamento: form.forma_pagamento,
      hora_entrada: form.hora_entrada || extra?.horario_entrada || null,
      hora_saida_intervalo: null,
      hora_retorno_intervalo: null,
      hora_saida: form.hora_saida || extra?.horario_saida || null,
      evento: null,
      funcao: extra?.cargo || (extra?.tipo_contrato === "Freelancer" ? "Extra" : "Colaborador Fixo"),
      janta_ofertada: !!form.alimentacao,
      itens,
      dados: {
        nome: extra?.nome || "",
        cpf: extra?.cpf || "",
        rg: extra?.rg || "",
        tipo_contrato: extra?.tipo_contrato || "Freelancer",
        telefone: extra?.telefone || "",
        chave_pix: extra?.chave_pix || "",
        endereco: extra?.endereco || extra?.rua_av || "",
        rua_av: extra?.rua_av || "",
        numero_casa: extra?.numero_casa || "",
        bairro: extra?.bairro || "",
        cidade_uf: extra?.cidade_uf || "",
        topicos_funcao: extra?.topicos_funcao || "",
        setor_entrega: extra?.setor_entrega || "",
        alimentacao_fornecida: !!form.alimentacao,
        materiais_fornecidos: !!form.materiais,
        dias_detalhados: diasValidos,
        subtotal_bruto: subtotalDias,
        vale_transporte: valorTransporte,
        adicional: valorAdicional,
        descontos_itens: descontosValidos,
        descontos: totalDescontos,
        forma_pagamento: form.forma_pagamento,
        valor_pix: form.forma_pagamento.includes("Híbrido")
          ? valPix
          : form.forma_pagamento === "Pix"
            ? valorLiquidoTotal
            : 0,
        valor_dinheiro: form.forma_pagamento.includes("Híbrido")
          ? valDinheiro
          : form.forma_pagamento === "Dinheiro"
            ? valorLiquidoTotal
            : 0,
        desmembrar: !!form.desmembrar,
        taxa_servico: form.desmembrar ? valTaxaServico : 0,
        inss: form.desmembrar ? valInss : 0,
        fgts: form.desmembrar ? valFgts : 0,
      },
    };
  };

  const salvar = async (imprimirDepois) => {
    const diasComValor = diasDetalhados.filter((d) => d.data && parseNum(d.valor) > 0);
    if (!diasComValor.length || subtotalDias <= 0) {
      return setErro("Informe pelo menos um dia trabalhado com data e valor maior que zero.");
    }
    if (form.materiais && !form.descricao_materiais.trim()) {
      return setErro("Informe quais materiais de trabalho foram entregues.");
    }
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      return setErro("Selecione uma unidade específica.");
    }

    if (form.forma_pagamento.includes("Híbrido")) {
      const vPix = parseNum(form.valor_pix);
      const vDinheiro = parseNum(form.valor_dinheiro);
      const diff = Math.abs((vPix + vDinheiro) - valorLiquidoTotal);
      if (diff > 0.05) {
        return setErro(`A soma do Dinheiro (${moeda(vDinheiro)}) com o Pix (${moeda(vPix)}) deve ser igual ao valor líquido a pagar (${moeda(valorLiquidoTotal)}).`);
      }
    }

    setErro("");
    setSalvando(true);
    const dataRef = diasComValor[0]?.data || hojeISO();
    const numero = `REC-${dataRef.replaceAll("-", "")}-${String(Date.now()).slice(-6)}`;
    const payload = montarPagamento(numero);
    const resposta = await salvarReciboPrestacao(payload);
    setSalvando(false);
    if (resposta.error) return setErro("Não consegui salvar o pagamento: " + resposta.error);
    const salvo = resposta.data || payload;
    setRecibos((lista) => [salvo, ...lista]);
    if (imprimirDepois) {
      imprimirReciboExtra({
        extra,
        recibo: salvo,
        unidade: unidadeInfo,
        unidadeNome: unidadeInfo?.nome,
        textos,
      });
    }
  };

  const alterarPagamento = async (recibo) => {
    const pago = !recibo.pagamento_realizado;
    const resposta = await atualizarPagamentoRecibo(recibo.id, pago, pago ? hojeISO() : null);
    if (resposta.error) return setErro("Não consegui atualizar: " + resposta.error);
    carregarHistorico();
  };

  const excluirRecibo = async (recibo) => {
    if (!window.confirm(`Tem certeza que deseja excluir o recibo de ${dataBR(recibo.data_trabalho)} (${moeda(recibo.valor_total)})?`)) return;
    const resposta = await excluirReciboPrestacao(recibo.id);
    if (resposta.error) return setErro("Não consegui excluir o recibo: " + resposta.error);
    carregarHistorico();
  };

  if (carregando) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-success" size={32} /></div>;
  if (!extra) return <div className="mx-auto max-w-xl p-8 text-center"><p className="font-bold text-red-700">{erro || "Colaborador não encontrado."}</p><button onClick={() => router.push("/dashboard/rh/extra")} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">Voltar</button></div>;

  const ehFixo = extra.tipo_contrato && extra.tipo_contrato !== "Freelancer";

  return (
    <div className="min-h-screen bg-slate-100/80 pb-16 text-fg">
      {/* HEADER COMPACTO COM TROCA RÁPIDA DE FUNCIONÁRIO (FIXO OU EXTRA) */}
      <header className="border-b border-line bg-card px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="grid h-9 w-9 place-items-center rounded-xl border border-line text-slate-900 hover:bg-white"><ArrowLeft size={18} /></button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-fg">Gerar Recibo de Pagamento</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-2xs font-black uppercase ${ehFixo ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>
                  {ehFixo ? "Fixo" : "Extra"}
                </span>
              </div>
              <p className="text-xs font-semibold text-fg">{extra.nome} ({extra.cargo || (ehFixo ? "Fixo" : "Extra")})</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {todosColabs.length > 1 && (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/70 px-2.5 py-1">
                <Users size={14} className="text-emerald-700 shrink-0" />
                <select
                  value={extra.id}
                  onChange={(e) => {
                    if (e.target.value && String(e.target.value) !== String(extra.id)) {
                      router.push(`/dashboard/rh/extra/${e.target.value}/recibo`);
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-slate-900 outline-none max-w-[220px]"
                  title="Escolher qualquer funcionário (Extra ou Fixo)"
                >
                  {todosColabs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.tipo_contrato === "Freelancer" ? "Extra" : "Fixo"})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => router.push(ehFixo ? `/dashboard/rh/funcionario/${extra.id}` : `/dashboard/rh/extra/${extra.id}`)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-line bg-card px-3 text-xs font-bold text-fg-soft hover:bg-white"
            >
              <Pencil size={14} /> {ehFixo ? "Prontuário" : "Editar cadastro"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        {/* AVISO DE 2 VIAS POR FOLHA A4 */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs font-bold text-emerald-900">
          <Scissors size={16} className="shrink-0 text-emerald-700" />
          <span>Na impressão saem <strong>2 recibos na mesma folha A4</strong> divididos por linha pontilhada (1ª Via Funcionário e 2ª Via Empresa) prontos para recortar.</span>
        </div>

        {/* FORMULÁRIO COMPLETO */}
        <section className="rounded-3xl border border-line bg-card p-4 shadow-sm sm:p-6 space-y-5">
          {/* BLOCO 1: DIAS TRABALHADOS E VALORES POR DIA/DATA */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <CalendarPlus size={16} className="text-emerald-700" />
                  1. Pagamentos por Dia e Data
                </h2>
                <p className="text-2xs font-semibold text-slate-600">
                  Adicione um ou vários dias com valores diferentes (ex.: Terça 09/10 R$ 120,00 · Quinta 11/10 R$ 200,00).
                </p>
              </div>
              <button
                type="button"
                onClick={adicionarDia}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-black text-white shadow-sm hover:bg-emerald-800 active:scale-95 transition-all"
              >
                <Plus size={15} /> Adicionar outro dia
              </button>
            </div>

            <div className="space-y-2">
              {diasDetalhados.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-emerald-200/80 bg-white p-2.5 shadow-2xs">
                  <div className="sm:col-span-4">
                    <label className="block">
                      <span className="text-3xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span>Data ({idx + 1}º dia)</span>
                        {item.data && <span className="text-emerald-700 font-black">{rotuloDiaSemana(item.data)}</span>}
                      </span>
                      <input
                        type="date"
                        value={item.data}
                        onChange={(e) => atualizarDia(idx, "data", e.target.value)}
                        className="mt-0.5 h-10 w-full rounded-lg border border-line bg-slate-50 px-2.5 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                      />
                    </label>
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block">
                      <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">Valor do dia (R$) *</span>
                      <div className="mt-0.5 flex h-10 items-center rounded-lg border-2 border-emerald-400 bg-emerald-50/60 px-2.5">
                        <span className="mr-1.5 text-xs font-black text-emerald-700">R$</span>
                        <CampoDecimal
                          value={item.valor}
                          onChange={(e) => atualizarDia(idx, "valor", e.target.value)}
                          placeholder="120,00"
                          className="w-full bg-transparent text-base font-black text-slate-900 outline-none"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block">
                      <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">Obs. do dia (opcional)</span>
                      <input
                        type="text"
                        value={item.obs}
                        onChange={(e) => atualizarDia(idx, "obs", e.target.value)}
                        placeholder="Ex.: Almoço, Jantar..."
                        className="mt-0.5 h-10 w-full rounded-lg border border-line bg-slate-50 px-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </label>
                  </div>

                  <div className="sm:col-span-1 flex justify-end sm:pt-4">
                    <button
                      type="button"
                      disabled={diasDetalhados.length <= 1}
                      onClick={() => removerDia(idx)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-30"
                      title="Remover este dia"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-bold text-emerald-950">
              <span>Quantidade de dias no recibo: <strong>{diasDetalhados.filter((d) => parseNum(d.valor) > 0).length || diasDetalhados.length} dia(s)</strong></span>
              <span className="text-sm font-black text-emerald-800">Subtotal Bruto dos Dias: {moeda(subtotalDias)}</span>
            </div>
          </div>

          {/* BLOCO 2: DESCONTOS / CONSUMO POR PRODUTO (EX.: COCA-COLA) */}
          <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <ShoppingBag size={16} className="text-rose-600" />
                  2. Descontos e Consumo de Produtos (Abate do Total)
                </h2>
                <p className="text-2xs font-semibold text-slate-600">
                  Ex.: pegou uma Coca-Cola, marmita ou adiantamento — informe o nome do produto e o valor para descontar automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => adicionarDesconto("", "")}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-black text-white shadow-sm hover:bg-rose-700 active:scale-95 transition-all"
              >
                <Plus size={15} /> Adicionar produto / desconto
              </button>
            </div>

            {/* Sugestão rápida se o funcionário tiver consumos pendentes lançados no RH */}
            {consumosPendentes.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-2.5">
                <p className="text-3xs font-black uppercase tracking-wider text-amber-900 mb-1.5">
                  Consumos pendentes deste funcionário (clique para adicionar ao desconto):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {consumosPendentes.map((c) => {
                    const v = Number(c.valor_desconto ?? c.valor_original ?? 0);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => importarConsumoPendente(c)}
                        className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-2xs font-bold text-amber-950 hover:bg-amber-100"
                      >
                        + {c.descricao} ({moeda(v)})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {descontosItens.length === 0 ? (
              <p className="rounded-xl border border-dashed border-rose-200 bg-white/70 p-2.5 text-center text-xs font-semibold text-slate-500">
                Nenhum desconto ou produto lançado neste recibo. Clique em <strong>+ Adicionar produto / desconto</strong> se houver.
              </p>
            ) : (
              <div className="space-y-2">
                {descontosItens.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-rose-200 bg-white p-2.5">
                    <div className="sm:col-span-7">
                      <label className="block">
                        <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">Nome do Produto / Desconto</span>
                        <input
                          type="text"
                          value={it.descricao}
                          onChange={(e) => atualizarDesconto(idx, "descricao", e.target.value)}
                          placeholder="Ex.: Coca-Cola, Lanche, Vale..."
                          className="mt-0.5 h-10 w-full rounded-lg border border-line bg-slate-50 px-3 text-xs font-bold text-slate-900 outline-none focus:border-rose-500"
                        />
                      </label>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="block">
                        <span className="text-3xs font-bold uppercase tracking-wider text-slate-500">Valor a Descontar (R$)</span>
                        <div className="mt-0.5 flex h-10 items-center rounded-lg border border-rose-300 bg-rose-50/50 px-2.5">
                          <span className="mr-1.5 text-xs font-black text-rose-700">− R$</span>
                          <CampoDecimal
                            value={it.valor}
                            onChange={(e) => atualizarDesconto(idx, "valor", e.target.value)}
                            placeholder="0,00"
                            className="w-full bg-transparent text-sm font-black text-rose-900 outline-none"
                          />
                        </div>
                      </label>
                    </div>
                    <div className="sm:col-span-1 flex justify-end sm:pt-4">
                      <button
                        type="button"
                        onClick={() => removerDesconto(idx)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Remover desconto"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalDescontos > 0 && (
              <div className="flex items-center justify-end text-xs font-black text-rose-800">
                Total de Descontos Abatidos: − {moeda(totalDescontos)}
              </div>
            )}
          </div>

          {/* BLOCO 3: RESUMO LÍQUIDO E FORMA DE PAGAMENTO (DINHEIRO / PIX / DIVIDIDO) */}
          <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 pb-3">
              <div>
                <span className="text-2xs font-black uppercase tracking-wider text-emerald-800 block">
                  3. Total Líquido Semanal / Período (Já com Descontos)
                </span>
                <p className="text-xs font-semibold text-slate-600">
                  Bruto {moeda(subtotalDias)}
                  {valorTransporte > 0 ? ` + VT ${moeda(valorTransporte)}` : ""}
                  {valorAdicional > 0 ? ` + Bônus ${moeda(valorAdicional)}` : ""}
                  {totalDescontos > 0 ? ` − Descontos ${moeda(totalDescontos)}` : ""}
                </p>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-800">
                {moeda(valorLiquidoTotal)}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="sm:col-span-1">
                <span className="text-2xs font-bold uppercase tracking-wider text-fg">Forma de Pagamento</span>
                <select
                  value={form.forma_pagamento}
                  onChange={(e) => set("forma_pagamento", e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-emerald-300 bg-white px-3 font-black outline-none text-sm text-slate-900"
                >
                  <option value="Pix">Tudo no Pix</option>
                  <option value="Dinheiro">Tudo em Dinheiro</option>
                  <option value="Híbrido (Pix + Dinheiro)">Dividido (Dinheiro + Pix)</option>
                  <option value="Transferência">Transferência Bancária</option>
                </select>
              </label>

              <label>
                <span className="text-2xs font-bold uppercase tracking-wider text-fg"> (+) Vale-transporte (opcional)</span>
                <CampoDecimal
                  value={form.vale_transporte}
                  onChange={(e) => set("vale_transporte", e.target.value)}
                  placeholder="0,00"
                  className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 font-bold text-slate-900 outline-none text-sm"
                />
              </label>

              <label>
                <span className="text-2xs font-bold uppercase tracking-wider text-fg">(+) Adicional / Bônus (opcional)</span>
                <CampoDecimal
                  value={form.adicional}
                  onChange={(e) => set("adicional", e.target.value)}
                  placeholder="0,00"
                  className="mt-1 h-11 w-full rounded-xl border border-line bg-white px-3 font-bold text-slate-900 outline-none text-sm"
                />
              </label>
            </div>

            {/* DIVISÃO DINHEIRO + PIX */}
            {form.forma_pagamento.includes("Híbrido") && (
              <div className="p-3.5 rounded-2xl bg-white border-2 border-emerald-300 grid gap-3 sm:grid-cols-2 animate-in fade-in">
                <label>
                  <span className="text-2xs font-black uppercase text-emerald-900">Quanto em DINHEIRO (R$)</span>
                  <div className="mt-1 flex h-11 items-center rounded-xl border border-emerald-300 bg-emerald-50/40 px-3">
                    <span className="mr-1.5 text-sm font-black text-emerald-700">R$</span>
                    <CampoDecimal
                      value={form.valor_dinheiro}
                      onChange={(e) => set("valor_dinheiro", e.target.value)}
                      placeholder="100,00"
                      className="w-full bg-transparent font-black text-slate-900 outline-none text-base"
                    />
                  </div>
                </label>
                <label>
                  <span className="text-2xs font-black uppercase text-emerald-900">Quanto no PIX (R$)</span>
                  <div className="mt-1 flex h-11 items-center rounded-xl border border-emerald-300 bg-emerald-50/40 px-3">
                    <span className="mr-1.5 text-sm font-black text-emerald-700">R$</span>
                    <CampoDecimal
                      value={form.valor_pix}
                      onChange={(e) => set("valor_pix", e.target.value)}
                      placeholder="100,00"
                      className="w-full bg-transparent font-black text-slate-900 outline-none text-base"
                    />
                  </div>
                </label>
                <p className="sm:col-span-2 text-2xs font-bold text-emerald-800">
                  Ao digitar o valor em Dinheiro, o sistema preenche o restante no Pix automaticamente para fechar {moeda(valorLiquidoTotal)}.
                </p>
              </div>
            )}
          </div>

          {/* LINHA 4: HORÁRIO PADRÃO DO TURNO */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-2xs font-bold uppercase tracking-wider text-fg flex items-center gap-1"><Clock size={13} /> Horário Início</span>
              <input type="time" value={form.hora_entrada} onChange={(e) => set("hora_entrada", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-white/80 px-3 font-bold outline-none text-sm" placeholder="15:40" />
            </label>
            <label>
              <span className="text-2xs font-bold uppercase tracking-wider text-fg flex items-center gap-1"><Clock size={13} /> Horário Término</span>
              <input type="time" value={form.hora_saida} onChange={(e) => set("hora_saida", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-white/80 px-3 font-bold outline-none text-sm" placeholder="23:40" />
            </label>
          </div>

          {/* DESMEMBRAMENTO AUTOMÁTICO DE TAXA DE SERVIÇO, INSS E FGTS */}
          <div className="pt-2 border-t border-line-soft">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-fg-soft flex items-center gap-1.5">
                <Sparkles size={15} className="text-success"/> Desmembramento no Recibo (Taxa 10% / INSS 11% / FGTS 8%)
              </span>
              <div className="flex gap-1 bg-card p-0.5 rounded-lg border border-line">
                <button type="button" onClick={() => set("desmembrar", true)} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${form.desmembrar ? "bg-accent text-accent-fg" : "text-slate-900"}`}>Ativado</button>
                <button type="button" onClick={() => set("desmembrar", false)} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${!form.desmembrar ? "bg-slate-800 text-white" : "text-slate-900"}`}>Desativado</button>
              </div>
            </div>

            {form.desmembrar && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-50/40 border border-emerald-200 grid gap-3 sm:grid-cols-3 animate-in fade-in">
                <label>
                  <span className="text-2xs font-bold text-fg-soft">Taxa de serviço (10%)</span>
                  <CampoDecimal value={form.taxa_servico} onChange={(e) => set("taxa_servico", e.target.value)} placeholder="0,00" className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-card px-3 font-bold text-fg outline-none text-sm" />
                </label>
                <label>
                  <span className="text-2xs font-bold text-fg-soft">INSS calculado (11%)</span>
                  <CampoDecimal value={form.inss} onChange={(e) => set("inss", e.target.value)} placeholder="0,00" className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-card px-3 font-bold text-fg outline-none text-sm" />
                </label>
                <label>
                  <span className="text-2xs font-bold text-fg-soft">FGTS calculado (8%)</span>
                  <CampoDecimal value={form.fgts} onChange={(e) => set("fgts", e.target.value)} placeholder="0,00" className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-card px-3 font-bold text-fg outline-none text-sm" />
                </label>
              </div>
            )}
          </div>

          {/* TOGGLES COMPACTOS (ALIMENTAÇÃO E MATERIAIS) */}
          <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-line-soft">
            <div className="flex items-center justify-between rounded-xl border border-line bg-white/60 px-3.5 py-2.5">
              <span className="text-xs font-bold text-fg-soft flex items-center gap-1.5"><Utensils size={15} className="text-success" /> Ofereceu Alimentação?</span>
              <div className="flex gap-1 bg-card p-0.5 rounded-lg border border-line">
                <button type="button" onClick={() => set("alimentacao", true)} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${form.alimentacao ? "bg-accent text-accent-fg" : "text-slate-900"}`}>Sim</button>
                <button type="button" onClick={() => set("alimentacao", false)} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${!form.alimentacao ? "bg-slate-800 text-white" : "text-slate-900"}`}>Não</button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-line bg-white/60 px-3.5 py-2.5">
              <span className="text-xs font-bold text-fg-soft flex items-center gap-1.5"><Shirt size={15} className="text-success" /> Entregou Material/Uniforme?</span>
              <div className="flex gap-1 bg-card p-0.5 rounded-lg border border-line">
                <button type="button" onClick={() => set("materiais", true)} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${form.materiais ? "bg-accent text-accent-fg" : "text-slate-900"}`}>Sim</button>
                <button type="button" onClick={() => set("materiais", false)} className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${!form.materiais ? "bg-slate-800 text-white" : "text-slate-900"}`}>Não</button>
              </div>
            </div>
          </div>

          {form.materiais && (
            <label className="block">
              <span className="text-2xs font-bold uppercase tracking-wider text-fg">Quais materiais foram entregues?</span>
              <input value={form.descricao_materiais} onChange={(e) => set("descricao_materiais", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-line bg-white/80 px-3 text-sm font-bold outline-none focus:border-emerald-500" placeholder="Ex.: avental, camisa da loja, rádio" />
            </label>
          )}

          {erro && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{erro}</p>}

          {/* BOTÕES DE AÇÃO */}
          <div className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-line-soft">
            <button onClick={() => salvar(false)} disabled={salvando} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-card text-sm font-black text-accent-strong hover:bg-accent-soft disabled:opacity-50">
              {salvando ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar sem imprimir
            </button>
            <button onClick={() => salvar(true)} disabled={salvando} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-black text-accent-fg shadow-md hover:bg-accent disabled:opacity-50">
              {salvando ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /><Printer size={18} /></>} Salvar e imprimir (2 vias A4)
            </button>
          </div>
        </section>

        {/* HISTÓRICO ANTERIOR */}
        <section className="rounded-3xl border border-line bg-card p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-fg">Recibos anteriores de {extra.nome.split(" ")[0]}</h2>
          {!recibos.length ? (
            <p className="mt-2 rounded-xl bg-white p-3 text-xs font-semibold text-fg">Nenhum pagamento gerado anteriormente.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recibos.map((recibo) => {
                const qtdDias = Array.isArray(recibo.dados?.dias_detalhados) && recibo.dados.dias_detalhados.length
                  ? recibo.dados.dias_detalhados.length
                  : (recibo.dias_contratados || 1);
                const descItens = Array.isArray(recibo.dados?.descontos_itens) ? recibo.dados.descontos_itens : [];
                return (
                  <article key={recibo.id} className="rounded-2xl border border-line p-3 flex items-center justify-between gap-3 bg-white/50">
                    <div className="min-w-0">
                      <p className="text-base font-black text-fg">{moeda(recibo.valor_total)}</p>
                      <p className="text-xs font-bold text-fg truncate">
                        {dataBR(recibo.data_trabalho)} ({qtdDias}d) · {recibo.forma_pagamento || "Pix"} ·{" "}
                        <span className={recibo.pagamento_realizado ? "text-emerald-700" : "text-amber-700"}>
                          {recibo.pagamento_realizado ? "Pago" : "Pendente"}
                        </span>
                      </p>
                      {descItens.length > 0 && (
                        <p className="text-3xs font-bold text-rose-700 truncate">
                          Descontos: {descItens.map((d) => `${d.descricao} (${moeda(d.valor)})`).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => imprimirReciboExtra({ extra, recibo, unidade: unidadeInfo, unidadeNome: unidadeInfo?.nome, textos })} className="flex h-9 items-center gap-1 rounded-xl bg-card border border-line px-3 text-xs font-bold text-fg-soft hover:bg-white">
                        <Printer size={14} /> Imprimir
                      </button>
                      <button onClick={() => alterarPagamento(recibo)} className="flex h-9 items-center gap-1 rounded-xl bg-accent-soft px-2.5 text-xs font-bold text-accent-strong hover:bg-emerald-100" title="Alternar status de pagamento">
                        {recibo.pagamento_realizado ? <Clock3 size={14} /> : <CheckCircle2 size={14} />}
                      </button>
                      <button onClick={() => excluirRecibo(recibo)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100" title="Excluir comprovante/recibo">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

