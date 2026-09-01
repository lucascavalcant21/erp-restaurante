"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, BadgeDollarSign, CheckCircle2, Clock3, Loader2, Pencil,
  Printer, Save, Shirt, Utensils,
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
    alimentacao: true, materiais: false, descricao_materiais: "",
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
        setExtra(cadastro.data);
        setForm(anterior => ({
          ...anterior,
          valor: cadastro.data.salario ? String(cadastro.data.salario) : "",
          forma_pagamento: cadastro.data.forma_pagamento || "Pix",
          alimentacao: cadastro.data.janta_ofertada !== false,
          materiais: !!String(cadastro.data.itens_emprestados || "").trim(),
          descricao_materiais: cadastro.data.itens_emprestados || "",
        }));
      }
      setRecibos(historico.data || []);
      if (configuracao.data) setTextos(configuracao.data);
      setCarregando(false);
    });
  }, [id, unidadeAtiva]);

  const set = (campo, valor) => setForm(anterior => ({ ...anterior, [campo]: valor }));

  const montarPagamento = numero => {
    const valor = Number(String(form.valor || "").replace(",", ".")) || 0;
    const itens = form.materiais
      ? String(form.descricao_materiais || "").split(",").map(item => item.trim()).filter(Boolean)
      : [];
    return {
      unidade_id: unidadeAtiva,
      colaborador_id: extra.id,
      numero,
      data_trabalho: form.data_trabalho,
      datas_contratadas: [form.data_trabalho],
      dias_contratados: 1,
      valor_diaria: valor,
      valor_total: valor,
      pagamento_realizado: true,
      data_pagamento: hojeISO(),
      forma_pagamento: form.forma_pagamento,
      hora_entrada: extra.horario_entrada || null,
      hora_saida_intervalo: null,
      hora_retorno_intervalo: null,
      hora_saida: extra.horario_saida || null,
      evento: null,
      funcao: extra.cargo || "Extra",
      janta_ofertada: !!form.alimentacao,
      itens,
      dados: {
        nome: extra.nome || "", cpf: extra.cpf || "", rg: extra.rg || "",
        telefone: extra.telefone || "", chave_pix: extra.chave_pix || "",
        endereco: extra.endereco || "", rua_av: extra.rua_av || "",
        numero_casa: extra.numero_casa || "", bairro: extra.bairro || "",
        cidade_uf: extra.cidade_uf || "", topicos_funcao: extra.topicos_funcao || "",
        setor_entrega: extra.setor_entrega || "", alimentacao_fornecida: !!form.alimentacao,
        materiais_fornecidos: !!form.materiais,
      },
    };
  };

  const salvar = async imprimirDepois => {
    const valor = Number(String(form.valor || "").replace(",", ".")) || 0;
    if (valor <= 0) return setErro("Informe o valor do pagamento.");
    if (!form.data_trabalho) return setErro("Informe a data do trabalho.");
    if (form.materiais && !form.descricao_materiais.trim()) return setErro("Informe quais materiais de trabalho foram entregues.");
    if (!unidadeAtiva || unidadeAtiva === "todas") return setErro("Selecione uma unidade específica.");
    setErro("");
    setSalvando(true);
    const numero = `EXT-${form.data_trabalho.replaceAll("-", "")}-${String(Date.now()).slice(-6)}`;
    const payload = montarPagamento(numero);
    const resposta = await salvarReciboPrestacao(payload);
    setSalvando(false);
    if (resposta.error) return setErro("Não consegui salvar o pagamento: " + resposta.error);
    const salvo = resposta.data || payload;
    setRecibos(lista => [salvo, ...lista]);
    if (imprimirDepois) imprimirReciboExtra({ extra, recibo: salvo, unidadeNome: unidadeInfo?.nome, textos });
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
    <div className="min-h-screen bg-slate-100/80 pb-20">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-7">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <button onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600"><ArrowLeft size={20} /></button>
          <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Extras</p><h1 className="truncate text-xl font-black text-slate-900 sm:text-2xl">Gerar pagamento</h1><p className="text-sm font-semibold text-slate-500">{extra.nome}</p></div>
          <button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}`)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"><Pencil size={16} /> Editar cadastro</button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><BadgeDollarSign size={24} /></span><div><h2 className="text-xl font-black text-slate-900">Pagamento do extra</h2><p className="text-sm font-semibold text-slate-500">Os demais dados já vêm de Editar cadastro.</p></div></div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="sm:col-span-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Valor a pagar *</span><div className="mt-1.5 flex min-h-16 items-center rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4"><span className="mr-2 text-xl font-black text-emerald-700">R$</span><input autoFocus type="number" min="0.01" step="0.01" value={form.valor} onChange={e => set("valor", e.target.value)} className="w-full bg-transparent text-3xl font-black text-slate-900 outline-none" placeholder="0,00" /></div></label>
            <label><span className="text-xs font-black uppercase tracking-wider text-slate-500">Data do trabalho</span><input type="date" value={form.data_trabalho} onChange={e => set("data_trabalho", e.target.value)} className="mt-1.5 min-h-16 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-black text-slate-800 outline-none" /></label>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2"><Utensils className="text-emerald-600" /><h3 className="font-black text-slate-900">Foi oferecida alimentação?</h3></div>
              <div className="grid grid-cols-2 gap-2"><button onClick={() => set("alimentacao", true)} className={`min-h-12 rounded-xl font-black ${form.alimentacao ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>Sim</button><button onClick={() => set("alimentacao", false)} className={`min-h-12 rounded-xl font-black ${!form.alimentacao ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}>Não</button></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2"><Shirt className="text-emerald-600" /><h3 className="font-black text-slate-900">Recebeu material de trabalho?</h3></div>
              <div className="grid grid-cols-2 gap-2"><button onClick={() => set("materiais", true)} className={`min-h-12 rounded-xl font-black ${form.materiais ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}>Sim</button><button onClick={() => set("materiais", false)} className={`min-h-12 rounded-xl font-black ${!form.materiais ? "bg-slate-800 text-white" : "bg-white text-slate-600"}`}>Não</button></div>
            </div>
          </div>

          {form.materiais && <label className="mt-4 block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Quais materiais?</span><input value={form.descricao_materiais} onChange={e => set("descricao_materiais", e.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none focus:border-emerald-500" placeholder="Ex.: avental, camisa, rádio" /></label>}
          <label className="mt-4 block"><span className="text-xs font-black uppercase tracking-wider text-slate-500">Forma de pagamento</span><select value={form.forma_pagamento} onChange={e => set("forma_pagamento", e.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold outline-none"><option>Pix</option><option>Dinheiro</option><option>Transferência</option></select></label>

          {erro && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2"><button onClick={() => salvar(false)} disabled={salvando} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-white font-black text-emerald-700 disabled:opacity-50">{salvando ? <Loader2 className="animate-spin" /> : <Save />} Salvar</button><button onClick={() => salvar(true)} disabled={salvando} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 font-black text-white shadow-lg disabled:opacity-50">{salvando ? <Loader2 className="animate-spin" /> : <><Save /><Printer /></>} Salvar e imprimir</button></div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-black text-slate-900">Pagamentos anteriores</h2>
          {!recibos.length ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">Nenhum pagamento gerado.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{recibos.map(recibo => <article key={recibo.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xl font-black text-slate-900">{moeda(recibo.valor_total)}</p><p className="text-xs font-bold text-slate-500">{dataBR(recibo.data_trabalho)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${recibo.pagamento_realizado ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{recibo.pagamento_realizado ? "Pago" : "Pendente"}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => imprimirReciboExtra({ extra, recibo, unidadeNome: unidadeInfo?.nome, textos })} className="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-slate-100 text-xs font-black text-slate-700"><Printer size={15} /> Imprimir</button><button onClick={() => alterarPagamento(recibo)} className="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-emerald-50 text-xs font-black text-emerald-700">{recibo.pagamento_realizado ? <Clock3 size={15} /> : <CheckCircle2 size={15} />}{recibo.pagamento_realizado ? "Pendente" : "Marcar pago"}</button></div></article>)}</div>}
        </section>
      </main>
    </div>
  );
}
