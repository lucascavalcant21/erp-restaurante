"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, FileText, Save } from "lucide-react";
import { useERP } from "../../../../../context/ERPContext";
import { supabase } from "../../../../../lib/supabase";
import { imprimirReciboFuncionario } from "../../../../../lib/recibo-funcionario";
import CampoDecimal from "../../../../../components/CampoDecimal";

export default function GerarPagamentoFixoPage() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeInfo } = useERP();
  
  const [func, setFunc] = useState(null);
  const [recibos, setRecibos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  
  const mesAtual = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const [form, setForm] = useState({
    valor: "",
    tipo: "Adiantamento Salarial",
    referencia: mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1),
    formaPagamento: "Pix",
    observacao: ""
  });

  useEffect(() => {
    async function carregar() {
      const [rFunc, rRecibos] = await Promise.all([
        supabase.from("colaboradores").select("*").eq("id", id).maybeSingle(),
        supabase.from("rh_recibos_prestacao").select("*").eq("colaborador_id", id).order("created_at", { ascending: false })
      ]);
      setFunc(rFunc.data);
      setRecibos(rRecibos.data || []);
      setCarregando(false);
    }
    carregar();
  }, [id]);

  const salvar = async (imprimirDepois) => {
    const valorNum = Number(String(form.valor).replace(",", "."));
    if (!valorNum || valorNum <= 0) return alert("Informe um valor válido.");
    
    setSalvando(true);
    // Salva no banco de dados para o histórico do RH
    const novoRecibo = {
      unidade_id: func.unidade_id,
      colaborador_id: func.id,
      numero: `REC-${Date.now()}`,
      data_trabalho: new Date().toISOString(),
      datas_contratadas: [new Date().toISOString()],
      dias_contratados: 1,
      valor_diaria: valorNum,
      valor_total: valorNum,
      pagamento_realizado: true,
      data_pagamento: new Date().toISOString(),
      forma_pagamento: form.formaPagamento,
      funcao: func.cargo || "Fixo",
      dados: {
        tipo: form.tipo,
        referencia: form.referencia,
        observacao: form.observacao,
        nome: func.nome || "", cpf: func.cpf || "", rg: func.rg || "",
        telefone: func.telefone || "", chave_pix: func.chave_pix || "",
        endereco: func.endereco || ""
      }
    };
    
    const { data, error } = await salvarReciboPrestacao(novoRecibo);
    setSalvando(false);
    if (error && error !== "Offline") {
      return alert("Erro ao salvar o recibo no histórico: " + error);
    }
    const salvo = data || novoRecibo;
    setRecibos(l => [salvo, ...l]);
    setForm(f => ({ ...f, valor: "" }));
    
    if (imprimirDepois) {
      imprimirReciboFuncionario({
        valor: valorNum,
        tipo: form.tipo,
        referencia: form.referencia,
        formaPagamento: form.formaPagamento,
        observacao: form.observacao
      }, unidadeInfo, func);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  if (carregando) return <div className="p-8 text-center text-slate-500 font-bold">Carregando dados do funcionário...</div>;
  if (!func) return <div className="p-8 text-center text-red-500 font-bold">Funcionário não encontrado.</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button onClick={() => router.back()} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">Gerar Recibo</h1>
            <p className="text-xs font-bold text-slate-500">{func.nome} · {func.cargo || "Fixo"}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl p-4 mt-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-slate-900 p-6 text-white text-center">
            <FileText size={32} className="mx-auto mb-2 text-slate-300" />
            <h2 className="text-xl font-black">Emissão de Recibo</h2>
            <p className="text-sm font-semibold text-slate-400 mt-1">Gere um documento para impressão e assinatura</p>
          </div>

          <div className="p-6 space-y-5">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Valor do Pagamento (R$)</span>
              <div className="mt-1 flex h-14 w-full items-center rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 focus-within:ring-2 focus-within:ring-emerald-500/20">
                <span className="text-xl font-black text-emerald-700 mr-2">R$</span>
                <CampoDecimal autoFocus value={form.valor} onChange={e => set("valor", e.target.value)} className="w-full bg-transparent text-2xl font-black text-emerald-900 outline-none" placeholder="0,00" />
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tipo do Recibo</span>
                <select value={form.tipo} onChange={e => set("tipo", e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-800 outline-none focus:border-slate-400">
                  <option>Adiantamento Salarial</option>
                  <option>Pagamento de Salário</option>
                  <option>Pagamento de Férias</option>
                  <option>Pagamento de 13º Salário</option>
                  <option>Premiação / Bônus</option>
                  <option>Comissões / Gorjetas</option>
                  <option>Acerto Rescisório</option>
                  <option>Outros</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Mês / Período de Ref.</span>
                <input type="text" value={form.referencia} onChange={e => set("referencia", e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-800 outline-none focus:border-slate-400" placeholder="Ex: Novembro/2026" />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Forma de Pagamento</span>
              <select value={form.formaPagamento} onChange={e => set("formaPagamento", e.target.value)} className="mt-1 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-bold text-slate-800 outline-none focus:border-slate-400">
                <option>Pix</option>
                <option>Transferência Bancária</option>
                <option>Dinheiro em Espécie</option>
                <option>Cheque</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Observações (Opcional)</span>
              <textarea value={form.observacao} onChange={e => set("observacao", e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-semibold text-slate-800 outline-none focus:border-slate-400 resize-y" placeholder="Adicione algum detalhe ou ressalva para sair impresso no recibo..."></textarea>
            </label>

          </div>

          <div className="bg-slate-50 p-6 border-t border-slate-200">
            <div className="grid gap-3 sm:grid-cols-2">
              <button disabled={salvando} onClick={() => salvar(false)} className="flex w-full h-14 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm">
                <Save size={20} /> {salvando ? "Salvando..." : "Salvar no Histórico"}
              </button>
              <button disabled={salvando} onClick={() => salvar(true)} className="flex w-full h-14 items-center justify-center gap-2 rounded-xl bg-slate-900 font-black text-white hover:bg-slate-800 disabled:opacity-50 active:scale-[0.98] transition-all shadow-md">
                <Printer size={20} /> {salvando ? "Salvando..." : "Salvar e Imprimir"}
              </button>
            </div>
            <p className="text-center text-xs text-slate-400 font-bold mt-4">Recibos salvos ficarão disponíveis abaixo para impressão futura.</p>
          </div>
        </div>

        {recibos.length > 0 && (
          <div className="mt-8 bg-white border border-slate-200 shadow-sm rounded-3xl overflow-hidden">
            <div className="bg-slate-50 p-4 sm:p-5 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-slate-400" />
                Histórico de Recibos
              </h2>
              <p className="text-xs font-bold text-slate-500 mt-1">Recibos gerados anteriormente para este funcionário.</p>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              {recibos.map(r => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div>
                    <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                      {r.dados?.tipo || "Recibo"} 
                      <span className="text-2xs font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{r.dados?.referencia || "Geral"}</span>
                    </p>
                    <p className="text-xs font-bold text-slate-500 mt-1">
                      {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-black text-emerald-700">R$ {Number(r.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    <button onClick={() => imprimirReciboFuncionario(r.dados, unidadeInfo, func)} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:shadow-sm transition-all shadow-sm">
                      <Printer size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
