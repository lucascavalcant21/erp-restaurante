"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, BadgeDollarSign, CheckCircle2, Clock, Clock3, Loader2, Pencil,
  Printer, Save, Shirt, Utensils, Sliders, Sparkles,
} from "lucide-react";
import { useERP } from "../../../../../context/ERPContext";
import { supabase } from "../../../../../lib/supabase";
import {
  atualizarPagamentoRecibo, fetchRecibosPrestacao, salvarReciboPrestacao,
} from "../../../../../lib/rh";
import {
  RECIBO_TEXTOS_PADRAO, fetchReciboTextos, imprimirReciboExtra,
} from "../../../../../lib/recibo-extra";

const hojeISO = () => new Date().toISOString().slice(0, 10);
const moeda = valor => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = valor => valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

export default function GerarPagamentoExtraPage() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [extra, setExtra] = useState(null);
  const [recibos, setRecibos] = useState([]);
  const [textos, setTextos] = useState(RECIBO_TEXTOS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    valor: "", data_trabalho: hojeISO(), forma_pagamento: "Pix",
    valor_pix: "", valor_dinheiro: "",
    dias_contratados: "1",
    hora_entrada: "", hora_saida: "",
    alimentacao: true, materiais: false, descricao_materiais: "",
    desmembrar: true, // Desmembramento automático ativado por padrão
    taxa_servico: "", inss: "", fgts: "",
  });

  const carregarHistorico = async () => {
    const resposta = await fetchRecibosPrestacao(id);
    setRecibos(resposta.data || []);
  };

  useEffect(() => {
    Promise.all([
      supabase.from("colaboradores").select("*").eq("id", id).maybeSingle(),
      fetchRecibosPrestacao(id),
      fetchReciboTextos(unidadeAtiva),
    ]).then(([cadastro, historico, configuracao]) => {
      if (!cadastro.data || cadastro.data.tipo_contrato !== "Freelancer") {
        setErro("Este cadastro de extra não foi encontrado.");
      } else {
        const valSalario = cadastro.data.salario ? Number(cadastro.data.salario) : 0;
        setExtra(cadastro.data);
        setForm(anterior => ({
          ...anterior,
          valor: valSalario ? String(valSalario) : "",
          forma_pagamento: cadastro.data.forma_pagamento || "Pix",
          hora_entrada: cadastro.data.horario_entrada || "",
          hora_saida: cadastro.data.horario_saida || "",
          alimentacao: cadastro.data.janta_ofertada !== false,
          materiais: !!String(cadastro.data.itens_emprestados || "").trim(),
          descricao_materiais: cadastro.data.itens_emprestados || "",
          taxa_servico: valSalario > 0 ? (valSalario * 0.10).toFixed(2) : "",
          inss: valSalario > 0 ? (valSalario * 0.11).toFixed(2) : "",
          fgts: valSalario > 0 ? (valSalario * 0.08).toFixed(2) : "",
        }));
      }
      setRecibos(historico.data || []);
      if (configuracao.data) setTextos(configuracao.data);
      setCarregando(false);
    });
  }, [id, unidadeAtiva]);

  // Função auxiliar de atualização com cálculo automático de desmembramento (Taxa 10%, INSS 11% e FGTS 8%)
  const set = (campo, valor) => {
    setForm(anterior => {
      const novo = { ...anterior, [campo]: valor };
      if (campo === "valor" || campo === "desmembrar") {
        const v = Number(String(campo === "valor" ? valor : anterior.valor).replace(",", ".")) || 0;
        const ativo = campo === "desmembrar" ? valor : anterior.desmembrar;
        if (v > 0 && ativo) {
          novo.taxa_servico = (v * 0.10).toFixed(2);
          novo.inss = (v * 0.11).toFixed(2);
          novo.fgts = (v * 0.08).toFixed(2);
        }
      }
      return novo;
    });
  };

  const montarPagamento = numero => {
    const valor = Number(String(form.valor || "").replace(",", ".")) || 0;
    const valPix = Number(String(form.valor_pix || "").replace(",", ".")) || 0;
    const valDinheiro = Number(String(form.valor_dinheiro || "").replace(",", ".")) || 0;
    const dias = Number(String(form.dias_contratados || "1").replace(",", ".")) || 1;

    const valTaxaServico = Number(String(form.taxa_servico || "").replace(",", ".")) || (form.desmembrar ? valor * 0.10 : 0);
    const valInss = Number(String(form.inss || "").replace(",", ".")) || (form.desmembrar ? valor * 0.11 : 0);
    const valFgts = Number(String(form.fgts || "").replace(",", ".")) || (form.desmembrar ? valor * 0.08 : 0);

    const itens = form.materiais
      ? String(form.descricao_materiais || "").split(",").map(item => item.trim()).filter(Boolean)
      : [];
    return {
      unidade_id: unidadeAtiva,
      colaborador_id: extra.id,
      numero,
      data_trabalho: form.data_trabalho,
      datas_contratadas: [form.data_trabalho],
      dias_contratados: dias,
      valor_diaria: valor,
      valor_total: valor,
      pagamento_realizado: true,
      data_pagamento: hojeISO(),
      forma_pagamento: form.forma_pagamento,
      hora_entrada: form.hora_entrada || extra?.horario_entrada || null,
      hora_saida_intervalo: null,
      hora_retorno_intervalo: null,
      hora_saida: form.hora_saida || extra?.horario_saida || null,
      evento: null,
      funcao: extra?.cargo || "Extra",
      janta_ofertada: !!form.alimentacao,
      itens,
      taxa_servico: form.desmembrar ? valTaxaServico : 0,
      inss: form.desmembrar ? valInss : 0,
      fgts: form.desmembrar ? valFgts : 0,
      dados: {
        nome: extra?.nome || "", cpf: extra?.cpf || "", rg: extra?.rg || "",
        telefone: extra?.telefone || "", chave_pix: extra?.chave_pix || "",
        endereco: extra?.endereco || extra?.rua_av || "", rua_av: extra?.rua_av || "",
        numero_casa: extra?.numero_casa || "", bairro: extra?.bairro || "",
        cidade_uf: extra?.cidade_uf || "", topicos_funcao: extra?.topicos_funcao || "",
        setor_entrega: extra?.setor_entrega || "", alimentacao_fornecida: !!form.alimentacao,
        materiais_fornecidos: !!form.materiais,
        valor_pix: form.forma_pagamento.includes("Híbrido") ? valPix : (form.forma_pagamento === "Pix" ? valor : 0),
        valor_dinheiro: form.forma_pagamento.includes("Híbrido") ? valDinheiro : (form.forma_pagamento === "Dinheiro" ? valor : 0),
        taxa_servico: form.desmembrar ? valTaxaServico : 0,
        inss: form.desmembrar ? valInss : 0,
        fgts: form.desmembrar ? valFgts : 0,
      },
    };
  };

  const salvar = async imprimirDepois => {
    const valor = Number(String(form.valor || "").replace(",", ".")) || 0;
    if (valor <= 0) return setErro("Informe o valor do pagamento.");
    if (!form.data_trabalho) return setErro("Informe a data do trabalho.");
    if (form.materiais && !form.descricao_materiais.trim()) return setErro("Informe quais materiais de trabalho foram entregues.");
    if (!unidadeAtiva || unidadeAtiva === "todas") return setErro("Selecione uma unidade específica.");

    if (form.forma_pagamento.includes("Híbrido")) {
      const vPix = Number(String(form.valor_pix || "").replace(",", ".")) || 0;
      const vDinheiro = Number(String(form.valor_dinheiro || "").replace(",", ".")) || 0;
      if (vPix + vDinheiro !== valor) {
        return setErro(`A soma do Pix (${moeda(vPix)}) com Dinheiro (${moeda(vDinheiro)}) deve ser igual ao valor total (${moeda(valor)}).`);
      }
    }

    setErro("");
    setSalvando(true);
    const numero = `EXT-${form.data_trabalho.replaceAll("-", "")}-${String(Date.now()).slice(-6)}`;
    const payload = montarPagamento(numero);
    const resposta = await salvarReciboPrestacao(payload);
    setSalvando(false);
    if (resposta.error) return setErro("Não consegui salvar o pagamento: " + resposta.error);
    const salvo = resposta.data || payload;
    setRecibos(lista => [salvo, ...lista]);
    if (imprimirDepois) {
      imprimirReciboExtra({
        extra, recibo: salvo,
        unidade: unidadeInfo, unidadeNome: unidadeInfo?.nome, textos
      });
    }
    setForm(anterior => ({ ...anterior, valor: extra.salario ? String(extra.salario) : "" }));
  };

  const alterarPagamento = async recibo => {
    const pago = !recibo.pagamento_realizado;
    const resposta = await atualizarPagamentoRecibo(recibo.id, pago, pago ? hojeISO() : null);
    if (resposta.error) return setErro("Não consegui atualizar: " + resposta.error);
    carregarHistorico();
  };

  if (carregando) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={32} /></div>;
  if (!extra) return <div className="mx-auto max-w-xl p-8 text-center"><p className="font-bold text-red-700">{erro || "Extra não encontrado."}</p><button onClick={() => router.push("/dashboard/rh/extra")} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">Voltar</button></div>;

  return (
    <div className="min-h-screen bg-slate-100/80 pb-16 text-slate-900">
      {/* HEADER COMPACTO */}
      <header className="border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"><ArrowLeft size={18} /></button>
            <div>
              <h1 className="text-xl font-black text-slate-900">Gerar Recibo Extra</h1>
              <p className="text-xs font-semibold text-slate-500">{extra.nome} ({extra.cargo || "Extra"})</p>
            </div>
          </div>
          <button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}`)} className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><Pencil size={14} /> Editar cadastro</button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        {/* FORMULÁRIO ENXUTO E PRÁTICO */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 space-y-4">
          {/* LINHA 1: VALORES E DATA */}
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="sm:col-span-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Valor Total a Pagar *</span>
              <div className="mt-1 flex h-12 items-center rounded-xl border-2 border-emerald-400 bg-emerald-50/70 px-3">
                <span className="mr-1.5 text-lg font-black text-emerald-700">R$</span>
                <input autoFocus type="number" min="0.01" step="0.01" value={form.valor} onChange={e => set("valor", e.target.value)} className="w-full bg-transparent text-xl font-black text-slate-900 outline-none" placeholder="0,00" />
              </div>
            </label>
            <label>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Diárias</span>
              <input type="number" step="0.1" min="0.1" value={form.dias_contratados} onChange={e => set("dias_contratados", e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 font-black text-slate-800 outline-none" placeholder="1" />
            </label>
            <label>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Data do Trabalho</span>
              <input type="date" value={form.data_trabalho} onChange={e => set("data_trabalho", e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 font-bold text-slate-800 outline-none" />
            </label>
          </div>

          {/* LINHA 2: HORÁRIO E PAGAMENTO */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1"><Clock size={13} /> Horário Início</span>
              <input type="time" value={form.hora_entrada} onChange={e => set("hora_entrada", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 font-bold outline-none text-sm" placeholder="15:40" />
            </label>
            <label>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1"><Clock size={13} /> Horário Término</span>
              <input type="time" value={form.hora_saida} onChange={e => set("hora_saida", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 font-bold outline-none text-sm" placeholder="23:40" />
            </label>
            <label>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Forma de Pagamento</span>
              <select value={form.forma_pagamento} onChange={e => set("forma_pagamento", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 font-bold outline-none text-sm">
                <option>Pix</option>
                <option>Dinheiro</option>
                <option>Transferência</option>
                <option>Híbrido (Pix + Dinheiro)</option>
              </select>
            </label>
          </div>

          {/* DETALHAMENTO HÍBRIDO (SE SELECIONADO) */}
          {form.forma_pagamento.includes("Híbrido") && (
            <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 grid gap-3 sm:grid-cols-2 animate-in fade-in">
              <label>
                <span className="text-[11px] font-black text-emerald-800">Valor no PIX (R$)</span>
                <input type="number" min="0" step="0.01" value={form.valor_pix} onChange={e => set("valor_pix", e.target.value)} placeholder="0,00" className="mt-1 h-10 w-full rounded-xl border border-emerald-300 bg-white px-3 font-black text-slate-900 outline-none text-sm" />
              </label>
              <label>
                <span className="text-[11px] font-black text-emerald-800">Valor em DINHEIRO (R$)</span>
                <input type="number" min="0" step="0.01" value={form.valor_dinheiro} onChange={e => set("valor_dinheiro", e.target.value)} placeholder="0,00" className="mt-1 h-10 w-full rounded-xl border border-emerald-300 bg-white px-3 font-black text-slate-900 outline-none text-sm" />
              </label>
            </div>
          )}

          {/* DESMEMBRAMENTO AUTOMÁTICO DE TAXA DE SERVIÇO, INSS E FGTS */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles size={15} className="text-emerald-600"/> Desmembramento Automático (Taxa 10% / INSS 11% / FGTS 8%)
              </span>
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button type="button" onClick={() => set("desmembrar", true)} className={`px-3 py-1 rounded-md text-xs font-black transition-colors ${form.desmembrar ? "bg-emerald-600 text-white" : "text-slate-600"}`}>Ativado</button>
                <button type="button" onClick={() => set("desmembrar", false)} className={`px-3 py-1 rounded-md text-xs font-black transition-colors ${!form.desmembrar ? "bg-slate-800 text-white" : "text-slate-600"}`}>Desativado</button>
              </div>
            </div>

            {form.desmembrar && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-50/40 border border-emerald-200 grid gap-3 sm:grid-cols-3 animate-in fade-in">
                <label>
                  <span className="text-[11px] font-black text-slate-700">Taxa de serviço (10%)</span>
                  <input type="number" min="0" step="0.01" value={form.taxa_servico} onChange={e => set("taxa_servico", e.target.value)} placeholder="0,00" className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-bold text-slate-900 outline-none text-sm" />
                </label>
                <label>
                  <span className="text-[11px] font-black text-slate-700">INSS calculado (11%)</span>
                  <input type="number" min="0" step="0.01" value={form.inss} onChange={e => set("inss", e.target.value)} placeholder="0,00" className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-bold text-slate-900 outline-none text-sm" />
                </label>
                <label>
                  <span className="text-[11px] font-black text-slate-700">FGTS calculado (8%)</span>
                  <input type="number" min="0" step="0.01" value={form.fgts} onChange={e => set("fgts", e.target.value)} placeholder="0,00" className="mt-1 h-10 w-full rounded-xl border border-slate-300 bg-white px-3 font-bold text-slate-900 outline-none text-sm" />
                </label>
              </div>
            )}
          </div>

          {/* LINHA 3: TOGGLES COMPACTOS (ALIMENTAÇÃO E MATERIAIS) */}
          <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Utensils size={15} className="text-emerald-600" /> Ofereceu Alimentação?</span>
              <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                <button type="button" onClick={() => set("alimentacao", true)} className={`px-3 py-1 rounded-md text-xs font-black transition-colors ${form.alimentacao ? "bg-emerald-600 text-white" : "text-slate-600"}`}>Sim</button>
                <button type="button" onClick={() => set("alimentacao", false)} className={`px-3 py-1 rounded-md text-xs font-black transition-colors ${!form.alimentacao ? "bg-slate-800 text-white" : "text-slate-600"}`}>Não</button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Shirt size={15} className="text-emerald-600" /> Entregou Material/Uniforme?</span>
              <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                <button type="button" onClick={() => set("materiais", true)} className={`px-3 py-1 rounded-md text-xs font-black transition-colors ${form.materiais ? "bg-emerald-600 text-white" : "text-slate-600"}`}>Sim</button>
                <button type="button" onClick={() => set("materiais", false)} className={`px-3 py-1 rounded-md text-xs font-black transition-colors ${!form.materiais ? "bg-slate-800 text-white" : "text-slate-600"}`}>Não</button>
              </div>
            </div>
          </div>

          {form.materiais && (
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Quais materiais foram entregues?</span>
              <input value={form.descricao_materiais} onChange={e => set("descricao_materiais", e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-sm font-bold outline-none focus:border-emerald-500" placeholder="Ex.: avental, camisa da loja, rádio" />
            </label>
          )}

          {erro && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{erro}</p>}

          {/* BOTÕES DE AÇÃO */}
          <div className="grid gap-2.5 sm:grid-cols-2 pt-2 border-t border-slate-100">
            <button onClick={() => salvar(false)} disabled={salvando} className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-white text-sm font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
              {salvando ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvar sem imprimir
            </button>
            <button onClick={() => salvar(true)} disabled={salvando} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-black text-white shadow-md hover:bg-emerald-700 disabled:opacity-50">
              {salvando ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /><Printer size={18} /></>} Salvar e imprimir recibo
            </button>
          </div>
        </section>

        {/* HISTÓRICO ANTERIOR */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-slate-900">Recibos anteriores deste extra</h2>
          {!recibos.length ? (
            <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">Nenhum pagamento gerado anteriormente.</p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recibos.map(recibo => (
                <article key={recibo.id} className="rounded-2xl border border-slate-200 p-3 flex items-center justify-between gap-3 bg-slate-50/50">
                  <div>
                    <p className="text-base font-black text-slate-900">{moeda(recibo.valor_total)}</p>
                    <p className="text-xs font-bold text-slate-500">{dataBR(recibo.data_trabalho)} · <span className={recibo.pagamento_realizado ? "text-emerald-700" : "text-amber-700"}>{recibo.pagamento_realizado ? "Pago" : "Pendente"}</span></p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => imprimirReciboExtra({ extra, recibo, unidade: unidadeInfo, unidadeNome: unidadeInfo?.nome, textos })} className="flex h-9 items-center gap-1 rounded-xl bg-white border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
                      <Printer size={14} /> Imprimir
                    </button>
                    <button onClick={() => alterarPagamento(recibo)} className="flex h-9 items-center gap-1 rounded-xl bg-emerald-50 px-2.5 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                      {recibo.pagamento_realizado ? <Clock3 size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
