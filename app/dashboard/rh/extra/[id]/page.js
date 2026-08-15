"use client";

// CADASTRO DE EXTRA (freelancer) — página própria, separada do funcionário fixo.
// O mesmo formulário serve para criar (id = "novo") e editar (id = uuid).
// Tudo que o Recibo de Trabalho Extra precisa fica aqui: ao gerar o recibo, os
// campos já vêm preenchidos.

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Camera, Trash2, ReceiptText } from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { supabase } from "../../../../lib/supabase";
import { inserirColaborador, atualizarColaborador } from "../../../../lib/rh";
import { ESTADOS_CIVIS, ESCOLARIDADES, GENEROS } from "../../../../lib/contrato-experiencia.mjs";

const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Transferência"];

const vazio = {
  foto: "", nome: "", cargo: "Extra", telefone: "", cpf: "", rg: "",
  rua_av: "", numero_casa: "", bairro: "", cidade_uf: "", cep: "",
  chave_pix: "", salario: "",
  data_nascimento: "", estado_civil: "", genero: "", escolaridade: "", tem_filhos: false, qtd_filhos: "",
  horario_entrada: "", horario_saida: "", tempo_intervalo: 60,
  topicos_funcao: "", itens_emprestados: "", forma_pagamento: "Pix",
  vale_transporte_val: "", setor_entrega: "", janta_ofertada: true,
  anotacoes_rh: "",
};

const soDigitos = (v) => String(v || "").replace(/\D/g, "");
const fmtCPF = (v) => soDigitos(v).slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const fmtTel = (v) => soDigitos(v).slice(0, 11)
  .replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");

export default function CadastroExtraPage() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const novo = id === "novo";

  const [form, setForm] = useState(vazio);
  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (novo) return;
    supabase.from("colaboradores").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setForm({
          ...vazio,
          ...Object.fromEntries(Object.keys(vazio).map(k => [k, data[k] ?? vazio[k]])),
          janta_ofertada: data.janta_ofertada !== false,
          tempo_intervalo: data.tempo_intervalo ?? 60,
        });
      }
      setCarregando(false);
    });
  }, [id, novo]);

  const set = (campo, valor) => setForm(a => ({ ...a, [campo]: valor }));

  const escolherFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 400;
      const escala = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      set("foto", canvas.toDataURL("image/jpeg", 0.7).split(",")[1] || "");
    };
    img.src = url;
  };

  const salvar = async (gerarRecibo = false) => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setErro("Selecione uma unidade específica antes de cadastrar o extra."); return; }
    if (!form.nome.trim()) { setErro("Informe o nome do extra."); return; }
    if (soDigitos(form.telefone).length < 10) { setErro("Informe o telefone com DDD."); return; }
    setErro("");
    setSalvando(true);
    const payload = {
      unidade_id: unidadeAtiva,
      tipo_contrato: "Freelancer",
      dias_trabalho: "",                       // extra não tem escala fixa
      foto: form.foto || null,
      nome: form.nome.trim(),
      cargo: form.cargo || "Extra",
      telefone: form.telefone || null,
      cpf: soDigitos(form.cpf) || null,
      rg: form.rg || null,
      rua_av: form.rua_av || null,
      numero_casa: form.numero_casa || null,
      bairro: form.bairro || null,
      cidade_uf: form.cidade_uf || null,
      cep: form.cep || null,
      data_nascimento: form.data_nascimento || null,
      estado_civil: form.estado_civil || null,
      genero: form.genero || null,
      escolaridade: form.escolaridade || null,
      tem_filhos: !!form.tem_filhos,
      qtd_filhos: form.tem_filhos ? (Number(form.qtd_filhos) || 0) : null,
      endereco: [form.rua_av, form.numero_casa, form.bairro, form.cidade_uf].filter(Boolean).join(", ") || null,
      chave_pix: form.chave_pix || null,
      salario: Number(form.salario) || 0,
      horario_entrada: form.horario_entrada || null,
      horario_saida: form.horario_saida || null,
      tempo_intervalo: Number(form.tempo_intervalo) || 0,
      topicos_funcao: form.topicos_funcao || null,
      itens_emprestados: form.itens_emprestados || null,
      forma_pagamento: form.forma_pagamento || null,
      vale_transporte_val: form.vale_transporte_val === "" ? null : Number(form.vale_transporte_val),
      setor_entrega: form.setor_entrega || null,
      janta_ofertada: form.janta_ofertada !== false,
      anotacoes_rh: form.anotacoes_rh || null,
    };
    const r = novo ? await inserirColaborador(payload) : await atualizarColaborador(id, payload);
    setSalvando(false);
    if (r.error) { setErro("Não consegui salvar: " + r.error); return; }
    const extraId = novo ? r.data?.id : id;
    if (gerarRecibo && extraId) router.push(`/dashboard/rh/extra/${extraId}/recibo`);
    else router.push("/dashboard/rh/extra");
  };

  if (carregando) {
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 size={28} className="animate-spin text-emerald-600" /></div>;
  }

  const rotulo = "text-xs font-black uppercase tracking-widest text-slate-500";
  const campo = "w-full p-4 mt-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500";

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Cabeçalho */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => router.back()}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-black text-slate-900 sm:text-xl">
              {novo ? "Novo extra" : "Editar extra"}
            </h1>
            <p className="text-xs font-bold text-slate-500">Freelancer / diarista · dados do recibo inclusos</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        {/* Identificação */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-700">Identificação</p>
          <div className="flex gap-4">
            <label className="relative h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-emerald-400">
              {form.foto ? (
                <img src={`data:image/jpeg;base64,${form.foto}`} alt="Foto" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-slate-400"><Camera size={24} /></span>
              )}
              <input type="file" accept="image/*" onChange={escolherFoto} className="hidden" />
            </label>
            <div className="min-w-0 flex-1 space-y-4">
              <label className="block">
                <span className={rotulo}>Nome completo *</span>
                <input value={form.nome} onChange={e => set("nome", e.target.value)} className={campo} placeholder="Nome do extra" />
              </label>
              {form.foto && (
                <button type="button" onClick={() => set("foto", "")} className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                  <Trash2 size={13} /> Remover foto
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={rotulo}>Telefone (WhatsApp) *</span>
              <input inputMode="tel" value={form.telefone} onChange={e => set("telefone", fmtTel(e.target.value))} className={campo} placeholder="(45) 99999-9999" />
            </label>
            <label className="block">
              <span className={rotulo}>Função</span>
              <input value={form.cargo} onChange={e => set("cargo", e.target.value)} className={campo} placeholder="Garçom, Copeiro, Chapeiro..." />
            </label>
            <label className="block">
              <span className={rotulo}>CPF</span>
              <input inputMode="numeric" value={form.cpf} onChange={e => set("cpf", fmtCPF(e.target.value))} className={campo} placeholder="000.000.000-00" />
            </label>
            <label className="block">
              <span className={rotulo}>RG</span>
              <input value={form.rg} onChange={e => set("rg", e.target.value)} className={campo} />
            </label>
          </div>
        </section>

        {/* Dados pessoais */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-700">Dados pessoais</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={rotulo}>Data de nascimento</span>
              <input type="date" value={form.data_nascimento} onChange={e => set("data_nascimento", e.target.value)} className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Estado civil</span>
              <select value={form.estado_civil} onChange={e => set("estado_civil", e.target.value)} className={campo}>
                <option value="">Selecione...</option>
                {ESTADOS_CIVIS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={rotulo}>Gênero</span>
              <select value={form.genero} onChange={e => set("genero", e.target.value)} className={campo}>
                <option value="">Selecione...</option>
                {GENEROS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={rotulo}>Escolaridade</span>
              <select value={form.escolaridade} onChange={e => set("escolaridade", e.target.value)} className={campo}>
                <option value="">Selecione...</option>
                {ESCOLARIDADES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2.5">
              <input type="checkbox" checked={!!form.tem_filhos} onChange={e => set("tem_filhos", e.target.checked)} className="h-5 w-5 accent-emerald-600" />
              <span className="text-sm font-bold text-slate-700">Tem filhos</span>
            </label>
            {form.tem_filhos && (
              <label className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600">Quantos?</span>
                <input type="number" min="0" value={form.qtd_filhos} onChange={e => set("qtd_filhos", e.target.value)}
                  className="h-11 w-20 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center font-black text-slate-800 outline-none focus:border-emerald-500" />
              </label>
            )}
          </div>
        </section>

        {/* Endereço */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-700">Endereço</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={rotulo}>Rua / Avenida</span>
              <input value={form.rua_av} onChange={e => set("rua_av", e.target.value)} className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Número</span>
              <input value={form.numero_casa} onChange={e => set("numero_casa", e.target.value)} className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Bairro</span>
              <input value={form.bairro} onChange={e => set("bairro", e.target.value)} className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Cidade / UF</span>
              <input value={form.cidade_uf} onChange={e => set("cidade_uf", e.target.value)} className={campo} placeholder="Foz do Iguaçu / PR" />
            </label>
            <label className="block">
              <span className={rotulo}>CEP</span>
              <input value={form.cep} onChange={e => set("cep", e.target.value)} className={campo} />
            </label>
          </div>
        </section>

        {/* Pagamento e jornada */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-700">Pagamento e jornada</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={rotulo}>Valor da diária (R$)</span>
              <input type="number" step="0.01" value={form.salario} onChange={e => set("salario", e.target.value)}
                className="w-full p-4 mt-1.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-700 outline-none focus:border-emerald-500" />
            </label>
            <label className="block">
              <span className={rotulo}>Chave PIX</span>
              <input value={form.chave_pix} onChange={e => set("chave_pix", e.target.value)} className={campo} placeholder="Chave para pagamento" />
            </label>
            <label className="block">
              <span className={rotulo}>Entrada</span>
              <input type="time" value={form.horario_entrada} onChange={e => set("horario_entrada", e.target.value)} className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Saída</span>
              <input type="time" value={form.horario_saida} onChange={e => set("horario_saida", e.target.value)} className={campo} />
            </label>
            <label className="block">
              <span className={rotulo}>Intervalo (minutos)</span>
              <input type="number" value={form.tempo_intervalo} onChange={e => set("tempo_intervalo", e.target.value)} className={campo} />
            </label>
          </div>
        </section>

        {/* Dados do recibo */}
        <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Dados do Recibo de Trabalho Extra</p>
          <p className="mb-4 mt-1 text-[13px] font-medium text-slate-500">
            Preenchido uma vez aqui, o recibo já sai pronto toda vez que esta pessoa trabalhar.
          </p>
          <label className="block">
            <span className={rotulo}>O que a função faz (sai impresso no recibo)</span>
            <textarea rows={3} value={form.topicos_funcao} onChange={e => set("topicos_funcao", e.target.value)}
              placeholder="Ex.: Atender mesas, levar pedidos, repor bebidas, apoiar a limpeza do salão."
              className="w-full p-3.5 mt-1.5 bg-white border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="mt-4 block">
            <span className={rotulo}>Itens emprestados (separe por vírgula)</span>
            <input value={form.itens_emprestados} onChange={e => set("itens_emprestados", e.target.value)}
              placeholder="Uniforme / Camisa, Avental, Cartão de Consumo"
              className="w-full p-4 mt-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={rotulo}>Forma de pagamento</span>
              <select value={form.forma_pagamento} onChange={e => set("forma_pagamento", e.target.value)}
                className="w-full p-4 mt-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500">
                {FORMAS_PAGAMENTO.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={rotulo}>Vale transporte (R$)</span>
              <input type="number" step="0.01" value={form.vale_transporte_val} onChange={e => set("vale_transporte_val", e.target.value)}
                placeholder="0,00" className="w-full p-4 mt-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500" />
            </label>
            <label className="block">
              <span className={rotulo}>Setor</span>
              <input value={form.setor_entrega} onChange={e => set("setor_entrega", e.target.value)}
                placeholder="Salão, Cozinha, Bar" className="w-full p-4 mt-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500" />
            </label>
          </div>
          <label className="mt-4 flex items-center gap-2.5">
            <input type="checkbox" checked={form.janta_ofertada !== false} onChange={e => set("janta_ofertada", e.target.checked)} className="h-5 w-5 accent-emerald-600" />
            <span className="text-sm font-bold text-slate-700">A casa oferece a janta</span>
          </label>
        </section>

        {/* Observações */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <label className="block">
            <span className={rotulo}>Observações internas do RH</span>
            <textarea rows={3} value={form.anotacoes_rh} onChange={e => set("anotacoes_rh", e.target.value)}
              className="w-full p-3.5 mt-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:border-emerald-500"
              placeholder="Só o RH vê. Ex.: pontual, já trabalhou em eventos grandes." />
          </label>
        </section>

        {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}
      </main>

      {/* Botão fixo: salvar sempre à mão */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:p-4"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto flex max-w-3xl gap-3">
          <button onClick={() => router.back()}
            className="rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={() => salvar(false)} disabled={salvando}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">
            {salvando ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar
          </button>
          <button onClick={() => salvar(true)} disabled={salvando}
            className="flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
            {salvando ? <Loader2 size={18} className="animate-spin" /> : <ReceiptText size={18} />} Salvar e gerar recibo
          </button>
        </div>
      </div>
    </div>
  );
}
