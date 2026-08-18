"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, BadgeDollarSign, CalendarDays, CheckCircle2, Clock3,
  FileClock, Loader2, Pencil, Printer, ReceiptText, Save, Utensils,
} from "lucide-react";
import { useERP } from "../../../../../context/ERPContext";
import { supabase } from "../../../../../lib/supabase";
import {
  atualizarPagamentoRecibo, fetchRecibosPrestacao, salvarReciboPrestacao,
} from "../../../../../lib/rh";
import {
  RECIBO_TEXTOS_PADRAO, fetchReciboTextos, imprimirReciboExtra,
  montarHtmlRecibo, salvarReciboTextos,
} from "../../../../../lib/recibo-extra";

const hojeISO = () => {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
};

const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const numero = (valor) => Number(String(valor || "").replace(",", ".")) || 0;
const dataBR = (valor) => valor ? new Date(`${String(valor).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

function formularioDoExtra(extra) {
  return {
    data_trabalho: hojeISO(), dias: "1", evento: "", funcao: extra?.cargo || "Extra",
    entrada: extra?.horario_entrada || "", saida_final: extra?.horario_saida || "",
    intervalo: extra?.tempo_intervalo ? `${extra.tempo_intervalo} min` : "",
    diaria: extra?.salario ? String(extra.salario) : "", vale_transporte: extra?.vale_transporte_val != null ? String(extra.vale_transporte_val) : "",
    adicional: "", descontos: "", forma_pagamento: extra?.forma_pagamento || "Pix",
    pagamento_realizado: true, data_pagamento: hojeISO(), janta_ofertada: extra?.janta_ofertada !== false,
    itens: extra?.itens_emprestados || "", observacoes: "",
  };
}

export default function ReciboExtraPage() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [extra, setExtra] = useState(null);
  const [form, setForm] = useState(null);
  const [recibos, setRecibos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  // Título e subtítulo do papel: vêm das configurações da unidade e valem para
  // todo recibo impresso daqui, inclusive os reimpressos pelo histórico.
  const [textos, setTextos] = useState(RECIBO_TEXTOS_PADRAO);
  const [textosSalvando, setTextosSalvando] = useState(false);
  const [textosAviso, setTextosAviso] = useState("");

  const carregarHistorico = useCallback(async () => {
    const resposta = await fetchRecibosPrestacao(id);
    setRecibos(resposta.data || []);
    return resposta;
  }, [id]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([
      supabase.from("colaboradores").select("*").eq("id", id).maybeSingle(),
      fetchRecibosPrestacao(id),
    ]).then(([cadastro, historico]) => {
      if (!ativo) return;
      if (!cadastro.data || cadastro.data.tipo_contrato !== "Freelancer") {
        setErro("Este cadastro de extra não foi encontrado.");
      } else {
        setExtra(cadastro.data);
        setForm(formularioDoExtra(cadastro.data));
      }
      setRecibos(historico.data || []);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [id]);

  useEffect(() => {
    let ativo = true;
    fetchReciboTextos(unidadeAtiva).then((resposta) => {
      if (ativo && resposta.data) setTextos(resposta.data);
    });
    return () => { ativo = false; };
  }, [unidadeAtiva]);

  const salvarTextos = async () => {
    setTextosSalvando(true);
    setTextosAviso("");
    const resposta = await salvarReciboTextos(unidadeAtiva, textos);
    setTextosSalvando(false);
    if (resposta.error) return setTextosAviso(`Não consegui salvar: ${resposta.error}`);
    if (resposta.data) setTextos(resposta.data);
    setTextosAviso("Textos salvos para esta unidade.");
  };

  const set = (campo, valor) => setForm((anterior) => ({ ...anterior, [campo]: valor }));
  const total = useMemo(() => {
    if (!form) return 0;
    return Math.max(0, (numero(form.diaria) * Math.max(1, Number(form.dias) || 1)) + numero(form.vale_transporte) + numero(form.adicional) - numero(form.descontos));
  }, [form]);

  const montarRecibo = (numeroRecibo) => {
    const dias = Math.max(1, Number(form.dias) || 1);
    const inicio = new Date(`${form.data_trabalho}T12:00:00`);
    const datasContratadas = Array.from({ length: dias }, (_, indice) => {
      const data = new Date(inicio);
      data.setDate(data.getDate() + indice);
      return data.toISOString().slice(0, 10);
    });
    const itens = String(form.itens || "").split(",").map((item) => item.trim()).filter(Boolean);
    const dados = {
      ...form,
      nome: extra.nome || "", cpf: extra.cpf || "", rg: extra.rg || "", telefone: extra.telefone || "",
      chave_pix: extra.chave_pix || "", endereco: extra.endereco || "", rua_av: extra.rua_av || "",
      numero_casa: extra.numero_casa || "", bairro: extra.bairro || "", cidade_uf: extra.cidade_uf || "",
      topicos_funcao: extra.topicos_funcao || "", setor_entrega: extra.setor_entrega || "",
    };
    return {
      unidade_id: unidadeAtiva,
      colaborador_id: extra.id,
      numero: numeroRecibo,
      data_trabalho: form.data_trabalho,
      datas_contratadas: datasContratadas,
      dias_contratados: dias,
      valor_diaria: numero(form.diaria),
      valor_total: total,
      pagamento_realizado: !!form.pagamento_realizado,
      data_pagamento: form.pagamento_realizado ? (form.data_pagamento || hojeISO()) : null,
      forma_pagamento: form.forma_pagamento,
      hora_entrada: form.entrada || null,
      hora_saida_intervalo: null,
      hora_retorno_intervalo: null,
      hora_saida: form.saida_final || null,
      evento: form.evento || null,
      funcao: form.funcao || null,
      janta_ofertada: !!form.janta_ofertada,
      itens,
      dados,
    };
  };

  // O recibo da prévia é montado com o que está no formulário AGORA.
  const htmlPrevia = useMemo(() => {
    if (!extra) return "";
    try {
      return montarHtmlRecibo({ extra, recibo: montarRecibo("PRÉVIA"), unidadeNome: unidadeInfo?.nome, textos });
    } catch { return ""; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra, form, total, unidadeInfo, textos]);

  const salvarRecibo = async (imprimirDepois) => {
    if (!form.data_trabalho) return setErro("Informe a data do trabalho.");
    if (numero(form.diaria) <= 0) return setErro("Informe o valor da diária.");
    if (!unidadeAtiva || unidadeAtiva === "todas") return setErro("Selecione uma unidade específica.");
    setErro("");
    setSalvando(true);
    const numeroRecibo = `EXT-${form.data_trabalho.replaceAll("-", "")}-${String(Date.now()).slice(-6)}`;
    const payload = montarRecibo(numeroRecibo);
    const resposta = await salvarReciboPrestacao(payload);
    setSalvando(false);
    if (resposta.error) {
      setErro(`Não consegui salvar o recibo: ${resposta.error}`);
      return;
    }
    const salvo = resposta.data || payload;
    setRecibos((lista) => [salvo, ...lista]);
    if (imprimirDepois) imprimirReciboExtra({ extra, recibo: salvo, unidadeNome: unidadeInfo?.nome, textos });
    setForm((anterior) => ({ ...formularioDoExtra(extra), data_trabalho: anterior.data_trabalho }));
  };

  const alterarPagamento = async (recibo) => {
    const pago = !recibo.pagamento_realizado;
    const resposta = await atualizarPagamentoRecibo(recibo.id, pago, pago ? hojeISO() : null);
    if (resposta.error) return setErro(`Não consegui atualizar o pagamento: ${resposta.error}`);
    await carregarHistorico();
  };

  if (carregando) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={30} /></div>;
  if (!extra || !form) return <div className="mx-auto max-w-xl p-8 text-center"><p className="font-bold text-red-700">{erro || "Extra não encontrado."}</p><button onClick={() => router.push("/dashboard/rh/extra")} className="mt-4 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">Voltar para Extras</button></div>;

  const campo = "mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-500";
  const rotulo = "text-[11px] font-black uppercase tracking-wider text-slate-500";

  return (
    <div className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <button onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Voltar à tela anterior"><ArrowLeft size={20} /></button>
          <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-black sm:text-2xl">Recibos de {extra.nome}</h1><p className="text-sm font-semibold text-slate-500">Cadastro, pagamento e recibo trabalhando juntos</p></div>
          <button onClick={() => router.push(`/dashboard/rh/extra/${extra.id}`)} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><Pencil size={16} /> Editar cadastro</button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:px-7 lg:grid-cols-[1.35fr_.85fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><ReceiptText size={22} /></span><div><h2 className="text-lg font-black">Novo recibo</h2><p className="text-sm font-medium text-slate-500">Os dados pessoais e bancários vêm do cadastro automaticamente.</p></div></div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label><span className={rotulo}>Data do trabalho *</span><input type="date" value={form.data_trabalho} onChange={(e) => set("data_trabalho", e.target.value)} className={campo} /></label>
              <label><span className={rotulo}>Quantidade de dias</span><input type="number" min="1" max="31" value={form.dias} onChange={(e) => set("dias", e.target.value)} className={campo} /></label>
              <label><span className={rotulo}>Função</span><input value={form.funcao} onChange={(e) => set("funcao", e.target.value)} className={campo} /></label>
              <label className="sm:col-span-2 lg:col-span-3"><span className={rotulo}>Evento ou motivo</span><input value={form.evento} onChange={(e) => set("evento", e.target.value)} placeholder="Ex.: casamento, reforço de salão, evento empresarial" className={campo} /></label>
              <label><span className={rotulo}>Entrada</span><input type="time" value={form.entrada} onChange={(e) => set("entrada", e.target.value)} className={campo} /></label>
              <label><span className={rotulo}>Saída</span><input type="time" value={form.saida_final} onChange={(e) => set("saida_final", e.target.value)} className={campo} /></label>
              <label><span className={rotulo}>Intervalo</span><input value={form.intervalo} onChange={(e) => set("intervalo", e.target.value)} placeholder="60 min" className={campo} /></label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2"><BadgeDollarSign className="text-emerald-600" size={22} /><h2 className="text-lg font-black">Acerto financeiro</h2></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label><span className={rotulo}>Diária (R$) *</span><input type="number" min="0" step="0.01" value={form.diaria} onChange={(e) => set("diaria", e.target.value)} className={campo} /></label>
              <label><span className={rotulo}>Vale-transporte</span><input type="number" min="0" step="0.01" value={form.vale_transporte} onChange={(e) => set("vale_transporte", e.target.value)} className={campo} /></label>
              <label><span className={rotulo}>Adicional / bônus</span><input type="number" min="0" step="0.01" value={form.adicional} onChange={(e) => set("adicional", e.target.value)} className={campo} /></label>
              <label><span className={rotulo}>Descontos</span><input type="number" min="0" step="0.01" value={form.descontos} onChange={(e) => set("descontos", e.target.value)} className={campo} /></label>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-950 p-4 text-white"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-300">Total do recibo</p><p className="mt-1 text-3xl font-black">{moeda(total)}</p></div><p className="text-sm font-semibold text-emerald-100">{Math.max(1, Number(form.dias) || 1)} dia(s) × {moeda(numero(form.diaria))}</p></div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center gap-2"><Utensils className="text-emerald-600" size={20} /><h2 className="text-lg font-black">Pagamento e apoio</h2></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className={rotulo}>Forma de pagamento</span><select value={form.forma_pagamento} onChange={(e) => set("forma_pagamento", e.target.value)} className={campo}><option>Pix</option><option>Dinheiro</option><option>Transferência</option></select></label>
              <label><span className={rotulo}>Data do pagamento</span><input type="date" disabled={!form.pagamento_realizado} value={form.data_pagamento} onChange={(e) => set("data_pagamento", e.target.value)} className={`${campo} disabled:bg-slate-100`} /></label>
              <label className="sm:col-span-2"><span className={rotulo}>Itens emprestados (separe por vírgula)</span><input value={form.itens} onChange={(e) => set("itens", e.target.value)} placeholder="Avental, camisa, rádio" className={campo} /></label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-4"><input type="checkbox" checked={form.pagamento_realizado} onChange={(e) => set("pagamento_realizado", e.target.checked)} className="h-5 w-5 accent-emerald-600" /><span className="font-bold text-slate-700">Pagamento já realizado</span></label>
              <label className="flex min-h-12 items-center gap-3 rounded-xl bg-slate-50 px-4"><input type="checkbox" checked={form.janta_ofertada} onChange={(e) => set("janta_ofertada", e.target.checked)} className="h-5 w-5 accent-emerald-600" /><span className="font-bold text-slate-700">Janta oferecida</span></label>
            </div>
          </section>

          {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => salvarRecibo(false)} disabled={salvando} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-white px-6 text-base font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">{salvando ? <Loader2 className="animate-spin" size={20} /> : <Save size={19} />} Somente salvar</button>
            <button onClick={() => salvarRecibo(true)} disabled={salvando} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-base font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-60">{salvando ? <Loader2 className="animate-spin" size={20} /> : <><Save size={19} /><Printer size={19} /></>} Salvar e imprimir</button>
          </div>
        </div>

        <aside className="space-y-5">
          {/* Pré-visualização ao vivo: acompanha cada tecla do formulário */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Como vai sair</p>
              <span className="text-[11px] font-bold text-slate-400">atualiza enquanto você digita</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ height: 460 }}>
              <iframe title="Pré-visualização do recibo" srcDoc={htmlPrevia} className="origin-top-left border-0"
                style={{ width: "210mm", height: "297mm", transform: "scale(.52)", pointerEvents: "none" }} />
            </div>
          </section>

          {/* Cabeçalho do papel: cada casa dá um nome ao documento. Fica salvo
              na unidade, então vale para todos os recibos, não só para este. */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><Pencil className="text-emerald-600" size={18} /><h2 className="text-lg font-black">Textos do recibo</h2></div>
            <p className="mt-1 text-xs font-semibold text-slate-500">Valem para todos os recibos desta unidade.</p>
            <div className="mt-4 space-y-3">
              <label className="block"><span className={rotulo}>Título</span><input value={textos.titulo} onChange={(e) => setTextos((anterior) => ({ ...anterior, titulo: e.target.value }))} placeholder={RECIBO_TEXTOS_PADRAO.titulo} className={campo} /></label>
              <label className="block"><span className={rotulo}>Subtítulo</span><input value={textos.subtitulo} onChange={(e) => setTextos((anterior) => ({ ...anterior, subtitulo: e.target.value }))} placeholder="Deixe em branco para não imprimir" className={campo} /></label>
            </div>
            {textosAviso && <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${textosAviso.startsWith("Não") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{textosAviso}</p>}
            <button onClick={salvarTextos} disabled={textosSalvando} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 bg-white text-sm font-black text-emerald-700 hover:bg-emerald-50 disabled:opacity-60">{textosSalvando ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />} Salvar textos</button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-widest text-emerald-700">Dados vinculados</p><h2 className="mt-2 text-xl font-black">{extra.nome}</h2><p className="mt-1 font-bold text-slate-500">{extra.cargo || "Extra"}</p><div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-600"><p>CPF: {extra.cpf || "não informado"}</p><p>PIX: {extra.chave_pix || "não informado"}</p><p>Diária padrão: {moeda(extra.salario)}</p></div></section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><FileClock className="text-emerald-600" size={20} /><h2 className="text-lg font-black">Histórico de recibos</h2></div>
            {recibos.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">O primeiro recibo desta pessoa aparecerá aqui.</p> : <div className="mt-4 space-y-3">{recibos.map((recibo) => <article key={recibo.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-black text-slate-800">{moeda(recibo.valor_total)}</p><p className="mt-0.5 text-xs font-bold text-slate-500">{dataBR(recibo.data_trabalho)} · {recibo.dias_contratados || 1} dia(s)</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${recibo.pagamento_realizado ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{recibo.pagamento_realizado ? "Pago" : "Pendente"}</span></div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => imprimirReciboExtra({ extra, recibo, unidadeNome: unidadeInfo?.nome, textos })} className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-100 text-xs font-black text-slate-700"><Printer size={14} /> Imprimir</button><button onClick={() => alterarPagamento(recibo)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-xs font-black text-emerald-700">{recibo.pagamento_realizado ? <Clock3 size={14} /> : <CheckCircle2 size={14} />} {recibo.pagamento_realizado ? "Tornar pendente" : "Marcar pago"}</button></div></article>)}</div>}
          </section>
        </aside>
      </main>
    </div>
  );
}
