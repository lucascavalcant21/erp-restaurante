"use client";

// PÁGINA PÚBLICA DE VAGAS — sem login, sem conta.
// O candidato abre o link, vê as vagas abertas, preenche e envia. A candidatura
// cai direto no Banco de Talentos do RH, já com a nota do teste de perfil.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, Send, Briefcase, MapPin, Clock, Wallet } from "lucide-react";
import {
  fetchPortalVagasConfig,
  enviarCandidatura,
  PERGUNTAS_RECRUTAMENTO,
  PORTAL_VAGAS_PADRAO,
} from "../../lib/recrutamento";

const soDigitos = (v) => String(v || "").replace(/\D/g, "");
const fmtCPF = (v) => soDigitos(v).slice(0, 11)
  .replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
const fmtTel = (v) => soDigitos(v).slice(0, 11)
  .replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");

export default function PaginaPublicaVagas() {
  const { unidade } = useParams();
  const [config, setConfig] = useState(PORTAL_VAGAS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    nome: "", cpf: "", telefone: "", nascimento: "",
    endereco: "", bairro: "", cidade: "",
    cargoPretendido: "", temFilhos: "", temTransporte: "",
    escolaridade: "", experiencia: "",
  });
  const [respostas, setRespostas] = useState({});

  useEffect(() => {
    fetchPortalVagasConfig(unidade)
      .then(r => setConfig(r.data || PORTAL_VAGAS_PADRAO))
      .catch(() => setConfig(PORTAL_VAGAS_PADRAO))
      .finally(() => setCarregando(false));
  }, [unidade]);

  const set = (campo, valor) => setForm(a => ({ ...a, [campo]: valor }));
  const vagasAtivas = (config.vagas || []).filter(v => v.ativa !== false);

  const faltando = () => {
    if (!form.nome.trim()) return "Informe seu nome completo.";
    if (soDigitos(form.telefone).length < 10) return "Informe um telefone com DDD.";
    if (!form.cargoPretendido) return "Escolha a vaga desejada.";
    for (const p of PERGUNTAS_RECRUTAMENTO) {
      if (!respostas[p.id]) return "Responda todas as perguntas do teste de perfil.";
    }
    return "";
  };

  const enviar = async () => {
    const falta = faltando();
    if (falta) { setErro(falta); return; }
    setErro("");
    setEnviando(true);
    const dadosPessoais = {
      nome: form.nome.trim(),
      cpf: soDigitos(form.cpf) || null,
      telefone: form.telefone.trim(),
      endereco: [form.endereco, form.bairro, form.cidade].filter(Boolean).join(", "),
      cargoPretendido: form.cargoPretendido,
      temFilhos: form.temFilhos || "Não informado",
      experiencia: form.experiencia.trim(),
      detalhesCadastro: {
        nome: form.nome.trim(),
        cpf: soDigitos(form.cpf) || null,
        telefone: form.telefone.trim(),
        nascimento: form.nascimento || null,
        enderecoCompleto: [form.endereco, form.bairro, form.cidade].filter(Boolean).join(", "),
        cargoPretendido: form.cargoPretendido,
        temFilhos: form.temFilhos || "Não informado",
        temTransporte: form.temTransporte || "Não informado",
        escolaridade: form.escolaridade || "Não informado",
        experiencia: form.experiencia.trim(),
        origem: "Portal público de vagas",
      },
    };
    const { error } = await enviarCandidatura(unidade, dadosPessoais, respostas, null);
    setEnviando(false);
    if (error) { setErro("Não consegui enviar sua inscrição. Tente de novo em instantes."); return; }
    setEnviado(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (carregando) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Loader2 size={30} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (enviado) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={34} />
          </div>
          <h1 className="text-xl font-black text-slate-900">Inscrição enviada</h1>
          <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">{config.mensagem_sucesso}</p>
          <p className="mt-5 text-xs font-bold text-slate-400">Você já pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  const Campo = ({ label, children, obrigatorio }) => (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}{obrigatorio && <span className="text-emerald-600"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
  const classeCampo = "h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15";

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Cabeçalho */}
      <header className="bg-emerald-700 px-5 py-8 text-white sm:py-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-black leading-tight sm:text-3xl">{config.titulo}</h1>
          <p className="mt-2 text-sm font-medium leading-relaxed text-emerald-50">{config.subtitulo}</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-5">
        {/* Vagas abertas */}
        {vagasAtivas.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-xs font-black uppercase tracking-widest text-emerald-700">Vagas abertas</h2>
            <div className="space-y-2.5">
              {vagasAtivas.map(vaga => (
                <button key={vaga.id} type="button" onClick={() => set("cargoPretendido", vaga.cargo)}
                  className={`w-full rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                    form.cargoPretendido === vaga.cargo ? "border-emerald-600 shadow-sm" : "border-slate-200 hover:border-emerald-300"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-base font-black text-slate-900">
                        <Briefcase size={17} className="shrink-0 text-emerald-600" /> {vaga.cargo}
                      </p>
                      <div className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
                        {vaga.salario && <p className="flex items-center gap-1.5"><Wallet size={14} className="text-emerald-600" /> {vaga.salario}{vaga.alimentacao ? ` + ${vaga.alimentacao} alimentação` : ""}</p>}
                        {vaga.jornada && <p className="flex items-center gap-1.5"><Clock size={14} className="text-emerald-600" /> {vaga.jornada}</p>}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
                      form.cargoPretendido === vaga.cargo ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                      {form.cargoPretendido === vaga.cargo ? "Escolhida" : "Quero esta"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Dados pessoais */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-700">Seus dados</h2>
          <div className="space-y-4">
            <Campo label="Nome completo" obrigatorio>
              <input value={form.nome} onChange={e => set("nome", e.target.value)} className={classeCampo} placeholder="Como está no seu documento" />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Telefone (WhatsApp)" obrigatorio>
                <input inputMode="tel" value={form.telefone} onChange={e => set("telefone", fmtTel(e.target.value))} className={classeCampo} placeholder="(45) 99999-9999" />
              </Campo>
              <Campo label="CPF">
                <input inputMode="numeric" value={form.cpf} onChange={e => set("cpf", fmtCPF(e.target.value))} className={classeCampo} placeholder="000.000.000-00" />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Data de nascimento">
                <input type="date" value={form.nascimento} onChange={e => set("nascimento", e.target.value)} className={classeCampo} />
              </Campo>
              <Campo label="Vaga desejada" obrigatorio>
                <select value={form.cargoPretendido} onChange={e => set("cargoPretendido", e.target.value)} className={classeCampo}>
                  <option value="">Selecione...</option>
                  {vagasAtivas.map(v => <option key={v.id} value={v.cargo}>{v.cargo}</option>)}
                  <option value="Outro">Outro cargo</option>
                </select>
              </Campo>
            </div>
            <Campo label="Endereço (rua e número)">
              <input value={form.endereco} onChange={e => set("endereco", e.target.value)} className={classeCampo} placeholder="Rua, número" />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Bairro">
                <input value={form.bairro} onChange={e => set("bairro", e.target.value)} className={classeCampo} />
              </Campo>
              <Campo label="Cidade">
                <input value={form.cidade} onChange={e => set("cidade", e.target.value)} className={classeCampo} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Tem filhos?">
                <select value={form.temFilhos} onChange={e => set("temFilhos", e.target.value)} className={classeCampo}>
                  <option value="">Prefiro não informar</option>
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </Campo>
              <Campo label="Transporte próprio?">
                <select value={form.temTransporte} onChange={e => set("temTransporte", e.target.value)} className={classeCampo}>
                  <option value="">Não informar</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não, uso transporte público</option>
                </select>
              </Campo>
            </div>
            <Campo label="Escolaridade">
              <select value={form.escolaridade} onChange={e => set("escolaridade", e.target.value)} className={classeCampo}>
                <option value="">Selecione...</option>
                {["Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Técnico", "Superior incompleto", "Superior completo"].map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Campo>
            <Campo label="Experiência profissional">
              <textarea value={form.experiencia} onChange={e => set("experiencia", e.target.value)} rows={4}
                className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-base font-medium text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15"
                placeholder="Onde já trabalhou, por quanto tempo e o que fazia." />
            </Campo>
          </div>
        </section>

        {/* Teste de perfil */}
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-xs font-black uppercase tracking-widest text-emerald-700">Teste de perfil</h2>
          <p className="mb-4 mt-1 text-sm font-medium text-slate-500">Não existe resposta certa ou errada. Escolha a opção mais parecida com você.</p>
          <div className="space-y-5">
            {PERGUNTAS_RECRUTAMENTO.map((p, i) => (
              <div key={p.id}>
                <p className="text-sm font-black text-slate-800">{i + 1}. {p.pergunta}<span className="text-emerald-600"> *</span></p>
                <div className="mt-2 space-y-2">
                  {p.opcoes.map((op, idx) => {
                    const marcada = respostas[p.id] === op.texto;
                    return (
                      <button key={idx} type="button" onClick={() => setRespostas(r => ({ ...r, [p.id]: op.texto }))}
                        className={`flex w-full items-start gap-2.5 rounded-xl border-2 p-3 text-left transition-all ${
                          marcada ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                          marcada ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                          {marcada && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                        <span className="text-sm font-semibold text-slate-700">{op.texto}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {erro && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>
        )}

        <button onClick={enviar} disabled={enviando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-60">
          {enviando ? <><Loader2 size={19} className="animate-spin" /> Enviando...</> : <><Send size={19} /> Enviar minha inscrição</>}
        </button>
        <p className="mt-3 text-center text-xs font-medium text-slate-400">
          Seus dados são usados apenas para o processo seletivo desta empresa.
        </p>
      </main>
    </div>
  );
}
