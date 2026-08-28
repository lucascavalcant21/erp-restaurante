"use client";

// PÁGINA PÚBLICA DE VAGAS — sem login, sem conta.
// O candidato abre o link, vê as vagas abertas, preenche e envia. A candidatura
// cai direto no Banco de Talentos do RH, já com a nota do teste de perfil.

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Send, Briefcase, MapPin, Clock, Wallet, CalendarDays, ListChecks, CircleDollarSign } from "lucide-react";
import {
  fetchPortalVagasConfig,
  enviarCandidatura,
  PERGUNTAS_RECRUTAMENTO,
  PORTAL_VAGAS_PADRAO,
} from "../../lib/recrutamento";
import { fetchExtraParaVaga } from "../../lib/portal-extras";

const soDigitos = (v) => String(v || "").replace(/\D/g, "");
const fmtTel = (v) => soDigitos(v).slice(0, 11)
  .replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");

// Campo e classeCampo moram FORA do componente de propósito.
//
// Definidos dentro, viravam uma função nova a cada render — e render acontece a
// cada tecla digitada. Para o React, função nova é OUTRO tipo de componente:
// ele desmontava o <label> inteiro e montava outro no lugar. O <input> era
// destruído junto, o foco se perdia e o navegador jogava o cursor no próximo
// campo. Era isso o "digito e ele pula para outro lugar".
//
// Fora do componente a referência é estável, o React reconhece o mesmo tipo e o
// input continua vivo entre um caractere e outro.
const Campo = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-black uppercase tracking-wider text-slate-500">
      {label}<span className="text-emerald-600"> *</span>
    </span>
    <div className="mt-1.5">{children}</div>
  </label>
);

const classeCampo = "h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15";

export default function PaginaPublicaVagas() {
  const { unidade } = useParams();
  const parametros = useSearchParams();
  const extraId = parametros.get("extra"); // veio do cadastro de extras
  const [config, setConfig] = useState(PORTAL_VAGAS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    nome: "", telefone: "", nascimento: "",
    endereco: "", bairro: "", cidade: "",
    cargoPretendido: "", temFilhos: "", temTransporte: "",
    escolaridade: "", experiencia: "",
  });
  const [respostas, setRespostas] = useState({});

  // Quem se cadastrou como extra e marcou interesse em CLT chega com os dados
  // prontos: puxa do banco de extras e preenche o formulário.
  useEffect(() => {
    if (!extraId) return;
    fetchExtraParaVaga(extraId).then(({ data }) => {
      if (!data) return;
      setForm(a => ({
        ...a,
        nome: data.nome || a.nome,
        telefone: data.telefone || a.telefone,
        nascimento: data.data_nascimento || a.nascimento,
        endereco: data.endereco || a.endereco,
        bairro: data.bairro || a.bairro,
        cidade: data.cidade || a.cidade,
        escolaridade: data.escolaridade || a.escolaridade,
        temFilhos: data.tem_filhos === true ? "Sim" : data.tem_filhos === false ? "Não" : a.temFilhos,
        experiencia: data.experiencia || a.experiencia,
        cargoPretendido: data.funcao_principal || a.cargoPretendido,
      }));
    });
  }, [extraId]);

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
    if (!form.nascimento) return "Informe sua data de nascimento.";
    if (!form.cargoPretendido) return "Escolha uma área disponível.";
    if (!form.endereco.trim()) return "Informe seu endereço com rua e número.";
    if (!form.bairro.trim()) return "Informe seu bairro.";
    if (!form.cidade.trim()) return "Informe sua cidade.";
    if (!form.temFilhos) return "Informe se você tem filhos.";
    if (!form.temTransporte) return "Informe se você possui transporte próprio.";
    if (!form.escolaridade) return "Informe sua escolaridade.";
    if (!form.experiencia.trim()) return "Descreva sua experiência profissional. Se ainda não trabalhou, escreva que busca a primeira oportunidade.";
    for (const p of PERGUNTAS_RECRUTAMENTO) {
      if (!Object.prototype.hasOwnProperty.call(respostas, p.id) || !String(respostas[p.id]).trim()) return "Responda todas as perguntas do teste de perfil.";
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
      cpf: null,
      telefone: form.telefone.trim(),
      endereco: [form.endereco, form.bairro, form.cidade].filter(Boolean).join(", "),
      cargoPretendido: form.cargoPretendido,
      temFilhos: form.temFilhos,
      experiencia: form.experiencia.trim(),
      detalhesCadastro: {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        nascimento: form.nascimento,
        endereco: form.endereco.trim(),
        bairro: form.bairro.trim(),
        cidade: form.cidade.trim(),
        enderecoCompleto: [form.endereco, form.bairro, form.cidade].filter(Boolean).join(", "),
        cargoPretendido: form.cargoPretendido,
        temFilhos: form.temFilhos,
        temTransporte: form.temTransporte,
        escolaridade: form.escolaridade,
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
          <section className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-lg font-black text-white">1</span>
              <div>
                <h2 className="text-lg font-black text-slate-900">Escolha sua área de trabalho</h2>
                <p className="text-sm font-semibold text-slate-600">Toque na vaga que mais combina com você para continuar.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {vagasAtivas.map(vaga => (
                <button key={vaga.id} type="button" onClick={() => {
                  set("cargoPretendido", vaga.cargo);
                  setTimeout(() => document.getElementById("dados-candidato")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                }}
                  className={`relative w-full rounded-2xl border-2 bg-white p-4 text-left transition-all ${
                    form.cargoPretendido === vaga.cargo ? "border-emerald-600 shadow-md shadow-emerald-900/10 ring-4 ring-emerald-500/10" : "border-slate-200 hover:border-emerald-400 hover:shadow-sm"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-lg font-black text-slate-900">
                        <Briefcase size={19} className="shrink-0 text-emerald-600" /> {vaga.cargo}
                      </p>
                      <div className="mt-2 space-y-1 text-sm font-semibold text-slate-600">
                        {vaga.salario && <p className="flex items-center gap-1.5"><Wallet size={14} className="text-emerald-600" /> {vaga.salario}{vaga.alimentacao ? ` + ${vaga.alimentacao} alimentação` : ""}</p>}
                        {vaga.taxa && <p className="flex items-center gap-1.5"><CircleDollarSign size={14} className="text-emerald-600" /> Taxa de serviço (média): {vaga.taxa}</p>}
                        {vaga.horario_trabalho && <p className="flex items-center gap-1.5"><Clock size={14} className="text-emerald-600" /> Horário: {vaga.horario_trabalho}</p>}
                        {vaga.dias_trabalho && <p className="flex items-center gap-1.5"><CalendarDays size={14} className="text-emerald-600" /> {vaga.dias_trabalho}</p>}
                        {vaga.folga && <p className="pl-5">Folga: {vaga.folga}</p>}
                        {vaga.domingo_folga && <p className="pl-5">{vaga.domingo_folga}</p>}
                      </div>
                    </div>
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${form.cargoPretendido === vaga.cargo ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}><CheckCircle2 size={19} /></span>
                  </div>
                  {Array.isArray(vaga.requisitos) && vaga.requisitos.length > 0 && (
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-600">
                        <ListChecks size={15} className="text-emerald-600" /> Pré-requisitos
                      </p>
                      <ul className="mt-2 space-y-1 text-xs font-medium leading-relaxed text-slate-600">
                        {vaga.requisitos.map((requisito, indice) => <li key={`${vaga.id}-req-${indice}`}>• {requisito}</li>)}
                      </ul>
                    </div>
                  )}
                  <span className={`mt-3 flex min-h-10 w-full items-center justify-center rounded-xl text-sm font-black ${form.cargoPretendido === vaga.cargo ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {form.cargoPretendido === vaga.cargo ? "Área selecionada" : "Selecionar esta área"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Dados pessoais */}
        <section id="dados-candidato" className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-900 font-black text-white">2</span>
            <div><h2 className="text-base font-black text-slate-900">Preencha seus dados</h2><p className="text-xs font-bold text-slate-500">Todos os campos são obrigatórios.</p></div>
          </div>
          {form.cargoPretendido ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span><span className="block text-xs font-black uppercase tracking-wide text-emerald-700">Área escolhida</span><strong className="text-base text-slate-900">{form.cargoPretendido}</strong></span>
              <button type="button" onClick={() => { set("cargoPretendido", ""); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-lg bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm">Trocar área</button>
            </div>
          ) : <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">Escolha uma área de trabalho acima antes de enviar.</div>}
          <div className="space-y-4">
            <Campo label="Nome completo" obrigatorio>
              <input required value={form.nome} onChange={e => set("nome", e.target.value)} className={classeCampo} placeholder="Como está no seu documento" />
            </Campo>
            {/* CPF não é pedido na candidatura: só depois da contratação. */}
            <Campo label="Telefone (WhatsApp)" obrigatorio>
              <input required inputMode="tel" value={form.telefone} onChange={e => set("telefone", fmtTel(e.target.value))} className={classeCampo} placeholder="(45) 99999-9999" />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Data de nascimento">
                <input required type="date" value={form.nascimento} onChange={e => set("nascimento", e.target.value)} className={classeCampo} />
              </Campo>
            </div>
            <Campo label="Endereço (rua e número)">
              <input required value={form.endereco} onChange={e => set("endereco", e.target.value)} className={classeCampo} placeholder="Rua, número" />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Bairro">
                <input required value={form.bairro} onChange={e => set("bairro", e.target.value)} className={classeCampo} />
              </Campo>
              <Campo label="Cidade">
                <input required value={form.cidade} onChange={e => set("cidade", e.target.value)} className={classeCampo} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Tem filhos?">
                <select required value={form.temFilhos} onChange={e => set("temFilhos", e.target.value)} className={classeCampo}>
                  <option value="">Selecione...</option>
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </Campo>
              <Campo label="Transporte próprio?">
                <select required value={form.temTransporte} onChange={e => set("temTransporte", e.target.value)} className={classeCampo}>
                  <option value="">Selecione...</option>
                  <option value="Sim">Sim</option>
                  <option value="Não">Não, uso transporte público</option>
                </select>
              </Campo>
            </div>
            <Campo label="Escolaridade">
              <select required value={form.escolaridade} onChange={e => set("escolaridade", e.target.value)} className={classeCampo}>
                <option value="">Selecione...</option>
                {["Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Técnico", "Superior incompleto", "Superior completo"].map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </Campo>
            <Campo label="Experiência profissional">
              <textarea required value={form.experiencia} onChange={e => set("experiencia", e.target.value)} rows={4}
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
