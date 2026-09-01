"use client";

// CADASTRO DE EXTRA (freelancer) — página própria, separada do funcionário fixo.
// O mesmo formulário serve para criar (id = "novo") e editar (id = uuid).
// Tudo que o Recibo de Trabalho Extra precisa fica aqui: ao gerar o recibo, os
// campos já vêm preenchidos.

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Camera, Trash2, ReceiptText, FileDown, Printer } from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { supabase } from "../../../../lib/supabase";
import { inserirColaborador, atualizarColaborador, fetchRecibosPrestacao } from "../../../../lib/rh";
import { ESTADOS_CIVIS, ESCOLARIDADES, GENEROS } from "../../../../lib/contrato-experiencia.mjs";
import { baixarPdfDeHtml } from "../../../../lib/pdf";

const FORMAS_PAGAMENTO = ["Pix", "Dinheiro", "Transferência"];

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";

const vazio = {
  foto: "", nome: "", cargo: "Extra", telefone: "", cpf: "", rg: "",
  rua_av: "", numero_casa: "", bairro: "", cidade_uf: "", cep: "",
  chave_pix: "", salario: "",
  data_nascimento: "", estado_civil: "", genero: "", escolaridade: "", tem_filhos: false, qtd_filhos: "",
  horario_entrada: "", horario_saida: "", tempo_intervalo: 60,
  topicos_funcao: "", itens_emprestados: "", forma_pagamento: "Pix",
  vale_transporte_val: "", setor_entrega: "", janta_ofertada: true,
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
  const [recibos, setRecibos] = useState([]);
  // Quanto desta pessoa ainda não foi pago.
  const emAberto = recibos.filter(r => !r.pagamento_realizado).reduce((s, r) => s + (Number(r.valor_total) || 0), 0);

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

  // Histórico de recibos da própria pessoa: o que ela já recebeu e o que
  // ainda está em aberto, sem precisar caçar na lista geral do módulo.
  useEffect(() => {
    if (novo) return;
    fetchRecibosPrestacao(id).then(r => setRecibos(r.data || []));
  }, [id, novo]);

  const set = (campo, valor) => setForm(a => ({ ...a, [campo]: valor }));

  const htmlCadastroExtra = () => {
    const esc = (valor) => String(valor ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const mostrar = (valor) => esc(String(valor ?? "").trim() || "Não informado");
    const linha = (rotulo, valor) => `<div class="campo"><span>${esc(rotulo)}</span><b>${mostrar(valor)}</b></div>`;
    const endereco = [form.rua_av, form.numero_casa, form.bairro, form.cidade_uf, form.cep].filter(Boolean).join(", ");
    const foto = form.foto ? `<img src="data:image/jpeg;base64,${form.foto}" alt="Foto"/>` : `<div class="sem-foto">${esc((form.nome || "?")[0].toUpperCase())}</div>`;
    return `<!doctype html><html><head><meta charset="utf-8"/><title>Cadastro - ${esc(form.nome)}</title><style>
      @page{size:A4 portrait;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#172033;font-size:10px}.folha{width:100%}.cab{display:flex;align-items:center;gap:14px;padding:15px;border-radius:14px;background:linear-gradient(135deg,#064e3b,#059669);color:#fff}.cab img,.sem-foto{width:72px;height:72px;border-radius:15px;object-fit:cover;border:2px solid #fff}.sem-foto{display:grid;place-items:center;background:#d1fae5;color:#065f46;font-size:28px;font-weight:900}.cab h1{margin:0 0 4px;font-size:23px}.cab p{margin:2px 0;opacity:.92}.selo{margin-left:auto;text-align:right;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.grade-secoes{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}.secao{margin-top:10px;break-inside:avoid}.secao h2{margin:0 0 4px;padding:6px 8px;border-left:3px solid #10b981;border-radius:0 7px 7px 0;background:#ecfdf5;color:#065f46;font-size:9px;text-transform:uppercase;letter-spacing:.08em}.grade{display:grid;grid-template-columns:1fr 1fr;gap:3px 9px}.campo{min-height:37px;padding:5px 2px;border-bottom:1px solid #d8dee7}.campo span{display:block;color:#64748b;font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.campo b{display:block;margin-top:3px;font-size:10px;overflow-wrap:anywhere}.largo{grid-column:1/-1}.rodape{margin-top:12px;padding-top:6px;border-top:1px solid #cbd5e1;color:#64748b;text-align:center;font-size:8px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><main class="folha"><header class="cab">${foto}<div><h1>${mostrar(form.nome)}</h1><p>${mostrar(form.cargo || "Profissional extra")}</p><p>Freelancer / diarista</p></div><div class="selo"><b>Cadastro de profissional extra</b><br/>Emitido em ${new Date().toLocaleDateString("pt-BR")}</div></header>
      <div class="grade-secoes"><div>
        <section class="secao"><h2>Identificação</h2><div class="grade">${linha("Nome completo", form.nome)}${linha("Telefone", form.telefone)}${linha("CPF", fmtCPF(form.cpf))}${linha("RG", form.rg)}${linha("Nascimento", dataBR(form.data_nascimento))}${linha("Estado civil", form.estado_civil)}${linha("Gênero", form.genero)}${linha("Escolaridade", form.escolaridade)}${linha("Filhos", form.tem_filhos ? `${form.qtd_filhos || 0}` : "Não")}</div></section>
        <section class="secao"><h2>Endereço</h2><div class="grade">${linha("Endereço completo", endereco)}</div></section>
      </div><div>
        <section class="secao"><h2>Pagamento e jornada</h2><div class="grade">${linha("Função", form.cargo)}${linha("Valor da diária", moeda(form.salario))}${linha("Chave PIX", form.chave_pix)}${linha("Forma de pagamento", form.forma_pagamento)}${linha("Entrada", form.horario_entrada)}${linha("Saída", form.horario_saida)}${linha("Intervalo", `${form.tempo_intervalo || 0} minutos`)}${linha("Vale-transporte", moeda(form.vale_transporte_val))}${linha("Setor", form.setor_entrega)}${linha("Janta ofertada", form.janta_ofertada !== false ? "Sim" : "Não")}</div></section>
        <section class="secao"><h2>Função e materiais</h2><div class="grade">${linha("Atividades da função", form.topicos_funcao)}${linha("Itens emprestados", form.itens_emprestados)}</div></section>
      </div></div><div class="rodape">Documento interno e confidencial · Cadastro gerado pelo Hefisto</div></main></body></html>`;
  };

  const imprimirCadastro = () => {
    const win = window.open("", "_blank");
    if (!win) return setErro("Habilite os pop-ups para imprimir o cadastro.");
    win.document.write(htmlCadastroExtra().replace("</body>", `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},350)});<\/script></body>`));
    win.document.close();
  };

  const baixarCadastroPdf = () => baixarPdfDeHtml(htmlCadastroExtra(), `cadastro-extra-${form.nome || "profissional"}`);

  const htmlPreAdmissaoESocial = () => {
    const esc = (valor) => String(valor ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const valor = (v) => esc(String(v ?? "").trim() || "PENDENTE");
    const item = (r, v) => `<div class="item"><span>${esc(r)}</span><b class="${String(v ?? "").trim() ? "" : "pendente"}">${valor(v)}</b></div>`;
    const endereco = [form.rua_av, form.numero_casa, form.bairro, form.cidade_uf, form.cep].filter(Boolean).join(", ");
    const faltantes = [
      ["CPF", soDigitos(form.cpf).length === 11], ["data de nascimento", !!form.data_nascimento],
      ["endereço completo", !!(form.rua_av && form.numero_casa && form.cidade_uf)],
      ["cargo", !!form.cargo], ["salário", Number(form.salario) > 0],
      ["horário de entrada e saída", !!(form.horario_entrada && form.horario_saida)],
      ["data de admissão", false], ["matrícula do empregado", false], ["tipo de contrato", false],
    ].filter(([, ok]) => !ok).map(([nome]) => nome);
    return `<!doctype html><html><head><meta charset="utf-8"/><title>Pré-admissão eSocial - ${esc(form.nome)}</title><style>
      @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#172033;font-size:11px}.topo{padding:17px;border-radius:14px;background:#0f172a;color:#fff}.topo small{font-weight:800;text-transform:uppercase;letter-spacing:.13em;color:#86efac}.topo h1{margin:5px 0 2px;font-size:24px}.topo p{margin:0;color:#cbd5e1}.aviso{margin-top:12px;padding:10px 12px;border:1px solid #fbbf24;border-radius:10px;background:#fffbeb;color:#92400e;font-weight:700}.secao{margin-top:14px}.secao h2{margin:0 0 6px;padding:7px 9px;background:#ecfdf5;border-left:4px solid #10b981;color:#065f46;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.grade{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px}.item{min-height:39px;padding:5px 2px;border-bottom:1px solid #d8dee7}.item span{display:block;color:#64748b;font-size:8px;font-weight:800;text-transform:uppercase}.item b{display:block;margin-top:3px}.item b.pendente{color:#b45309}.faltantes{margin-top:8px;padding:11px 13px;border-radius:10px;background:#fff7ed;color:#9a3412}.faltantes b{display:block;margin-bottom:4px}.assinaturas{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:42px}.assinaturas div{padding-top:6px;border-top:1px solid #475569;text-align:center;color:#475569}.rodape{margin-top:20px;color:#64748b;font-size:8px;text-align:center}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
      </style></head><body><header class="topo"><small>Preparação para contratação</small><h1>Ficha de pré-admissão para eSocial</h1><p>Dados aproveitados do cadastro de profissional extra · ${new Date().toLocaleDateString("pt-BR")}</p></header>
      <div class="aviso">Documento preparatório. Não é protocolo nem comprovante de envio ao eSocial. A admissão oficial deve ser validada e transmitida pelo empregador ou pela contabilidade.</div>
      <section class="secao"><h2>Dados do trabalhador</h2><div class="grade">${item("Nome completo", form.nome)}${item("CPF", fmtCPF(form.cpf))}${item("Data de nascimento", dataBR(form.data_nascimento))}${item("Telefone", form.telefone)}${item("RG", form.rg)}${item("Gênero", form.genero)}${item("Estado civil", form.estado_civil)}${item("Escolaridade", form.escolaridade)}${item("Endereço", endereco)}</div></section>
      <section class="secao"><h2>Dados contratuais propostos</h2><div class="grade">${item("Cargo / função", form.cargo)}${item("Salário proposto", moeda(form.salario))}${item("Data de admissão", "")}${item("Matrícula", "")}${item("Tipo de contrato", "")}${item("Horário", form.horario_entrada && form.horario_saida ? `${form.horario_entrada} às ${form.horario_saida}` : "")}${item("Intervalo", `${form.tempo_intervalo || 0} minutos`)}${item("Setor", form.setor_entrega)}${item("Atividades", form.topicos_funcao)}</div></section>
      <div class="faltantes"><b>Antes do envio, completar/conferir:</b>${faltantes.length ? esc(faltantes.join("; ")) : "Dados básicos preenchidos; realizar a validação final da contabilidade."}</div>
      <div class="assinaturas"><div>Trabalhador</div><div>Responsável pela admissão</div></div><div class="rodape">Referência operacional: admissão de empregado S-2200; quando aplicável, registro preliminar S-2190. Validar sempre no leiaute vigente do eSocial.</div></body></html>`;
  };

  const baixarPreAdmissaoESocial = () => baixarPdfDeHtml(htmlPreAdmissaoESocial(), `pre-admissao-esocial-${form.nome || "profissional"}`);

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
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
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
          {!novo && <div className="flex gap-2">
            <button type="button" onClick={baixarPreAdmissaoESocial} className="flex h-11 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FileDown size={17}/> Pré-admissão eSocial</button>
            <button type="button" onClick={baixarCadastroPdf} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><FileDown size={17}/> PDF</button>
            <button type="button" onClick={imprimirCadastro} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><Printer size={17}/> Imprimir</button>
          </div>}
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

        {/* Histórico de recibos desta pessoa */}
        {!novo && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-emerald-700"><ReceiptText size={14} /> Recibos desta pessoa</p>
            <p className="text-sm font-black text-slate-700">{recibos.length} recibo(s) · {moeda(recibos.reduce((s, r) => s + (Number(r.valor_total) || 0), 0))}</p>
          </div>
          {emAberto > 0 && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-800">Em aberto: {moeda(emAberto)}</p>
          )}
          <div className="mt-3 space-y-2">
            {recibos.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Nenhum recibo emitido para esta pessoa ainda.</p>
            ) : recibos.map(r => (
              <div key={r.id}
                className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-black text-slate-900">{dataBR(r.data_trabalho)}</span>
                  <span className="block text-[12px] font-bold text-slate-500">
                    {r.funcao_exercida || form.cargo || "Extra"}
                    {r.pagamento_realizado ? ` · pago${r.data_pagamento ? ` em ${dataBR(r.data_pagamento)}` : ""}` : " · em aberto"}
                  </span>
                </span>
                <span className={`shrink-0 text-base font-black ${r.pagamento_realizado ? "text-emerald-700" : "text-amber-700"}`}>{moeda(r.valor_total)}</span>
              </div>
            ))}
          </div>
        </section>
        )}

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
