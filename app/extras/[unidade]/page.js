"use client";

// PORTAL PÚBLICO DE CADASTRO DE EXTRAS — sem login, sem conta.
// O extra se cadastra pelo link, escolhe até duas funções (a principal define a
// categoria no banco), marca os dias disponíveis e diz se quer só diárias ou
// também uma vaga CLT. Quem quer CLT segue direto para o portal de vagas com os
// dados já preenchidos.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send, MapPin, Briefcase, CalendarDays } from "lucide-react";
import {
  DIAS_SEMANA, PORTAL_EXTRAS_PADRAO,
  enviarCadastroExtra, fetchUnidadePublica, fetchPortalExtrasConfig,
} from "../../lib/portal-extras";
import { ESTADOS_CIVIS, ESCOLARIDADES, GENEROS } from "../../lib/contrato-experiencia.mjs";

const soDigitos = (v) => String(v || "").replace(/\D/g, "");
const fmtTel = (v) => soDigitos(v).slice(0, 11)
  .replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");

export default function PortalExtras() {
  const { unidade } = useParams();
  const router = useRouter();
  const [restaurante, setRestaurante] = useState(null);
  // Textos, funções e perguntas vêm do que o restaurante editou no ERP.
  const [config, setConfig] = useState(PORTAL_EXTRAS_PADRAO);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(null); // { id, interesse }
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    nome: "", telefone: "", data_nascimento: "",
    estado_civil: "", genero: "", escolaridade: "", tem_filhos: false, qtd_filhos: "",
    endereco: "", bairro: "", cidade: "",
    funcao_principal: "", funcao_secundaria: "",
    dias_disponiveis: [], periodo_disponivel: "",
    experiencia: "", valor_diaria_pretendido: "", chave_pix: "",
    interesse: "extra", observacoes: "",
  });
  const [respostas, setRespostas] = useState({});

  useEffect(() => {
    fetchUnidadePublica(unidade).then(r => setRestaurante(r.data));
    fetchPortalExtrasConfig(unidade).then(r => { if (r.data) setConfig(r.data); });
  }, [unidade]);

  const set = (campo, valor) => setForm(a => ({ ...a, [campo]: valor }));
  const alternarDia = (dia) => setForm(a => ({
    ...a,
    dias_disponiveis: a.dias_disponiveis.includes(dia)
      ? a.dias_disponiveis.filter(d => d !== dia)
      : [...a.dias_disponiveis, dia],
  }));

  const faltando = () => {
    if (!form.nome.trim()) return "Informe seu nome completo.";
    if (soDigitos(form.telefone).length < 10) return "Informe um telefone com DDD.";
    if (!form.funcao_principal) return "Escolha sua função principal.";
    if (!form.dias_disponiveis.length) return "Marque pelo menos um dia disponível.";
    for (const p of config.perguntas) if (!respostas[p.id]) return "Responda todas as perguntas.";
    return "";
  };

  const enviar = async () => {
    const falta = faltando();
    if (falta) { setErro(falta); return; }
    setErro(""); setEnviando(true);
    const { id, error } = await enviarCadastroExtra(unidade, form, respostas);
    setEnviando(false);
    if (error) { setErro("Não consegui enviar seu cadastro. Tente de novo em instantes."); return; }
    setEnviado({ id, interesse: form.interesse });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const endereco = restaurante
    ? [[restaurante.endereco, restaurante.numero].filter(Boolean).join(", "), restaurante.bairro, [restaurante.cidade, restaurante.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")
    : "";

  if (enviado) {
    const querVaga = enviado.interesse === "clt" || enviado.interesse === "ambos";
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <div className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 size={34} /></div>
          <h1 className="text-xl font-black text-slate-900">Cadastro enviado</h1>
          <p className="mt-3 whitespace-pre-line text-sm font-medium leading-relaxed text-slate-600">
            {config.mensagem_sucesso}
          </p>
          <p className="mt-2 text-sm font-bold text-slate-700">Função: {form.funcao_principal}</p>
          {querVaga && (
            <>
              <p className="mt-5 text-sm font-bold text-slate-700">Você marcou interesse em ser contratado.</p>
              <button onClick={() => router.push(`/vagas/${unidade}?extra=${enviado.id}`)}
                className="mt-3 w-full rounded-2xl bg-emerald-600 py-4 text-base font-black text-white hover:bg-emerald-700">
                Ver as vagas abertas
              </button>
              <p className="mt-2 text-xs font-medium text-slate-400">Seus dados já vão preenchidos — é só escolher a vaga.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const rotulo = "text-xs font-black uppercase tracking-wider text-slate-500";
  const campo = "h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base font-semibold text-slate-800 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15";

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-emerald-700 px-5 py-8 text-white sm:py-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-black leading-tight sm:text-3xl">{config.titulo}</h1>
          <p className="mt-2 whitespace-pre-line text-sm font-medium leading-relaxed text-emerald-50">
            {config.subtitulo}
          </p>
          {restaurante && config.mostrar_endereco !== false && (
            <div className="mt-4 rounded-2xl bg-emerald-800/50 p-3.5">
              <p className="text-sm font-black">{restaurante.nome}</p>
              {endereco && <p className="mt-0.5 flex items-start gap-1.5 text-[13px] font-medium text-emerald-50"><MapPin size={14} className="mt-0.5 shrink-0" /> {endereco}</p>}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-5">
        {/* Funções */}
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700"><Briefcase size={15} /> O que você faz</p>
          <p className="mb-4 mt-1 text-sm font-semibold text-slate-600">Escolha sua função principal e, se quiser, uma segunda.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={rotulo}>Função principal *</span>
              <select value={form.funcao_principal} onChange={e => set("funcao_principal", e.target.value)} className={`${campo} mt-1.5`}>
                <option value="">Selecione...</option>
                {config.funcoes.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={rotulo}>Segunda função (opcional)</span>
              <select value={form.funcao_secundaria} onChange={e => set("funcao_secundaria", e.target.value)} className={`${campo} mt-1.5`}>
                <option value="">Nenhuma</option>
                {config.funcoes.filter(f => f !== form.funcao_principal).map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
          </div>
        </section>

        {/* Disponibilidade */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-700"><CalendarDays size={15} /> Sua disponibilidade</p>
          <p className="mb-3 mt-1 text-sm font-semibold text-slate-600">Marque os dias em que você pode trabalhar.</p>
          <div className="flex flex-wrap gap-2">
            {DIAS_SEMANA.map(d => {
              const marcado = form.dias_disponiveis.includes(d.valor);
              return (
                <button key={d.valor} type="button" onClick={() => alternarDia(d.valor)}
                  className={`h-12 min-w-[62px] rounded-xl border-2 px-3 text-sm font-black transition-all ${
                    marcado ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"}`}>
                  {d.rotulo}
                </button>
              );
            })}
          </div>
          <label className="mt-4 block">
            <span className={rotulo}>Período</span>
            <select value={form.periodo_disponivel} onChange={e => set("periodo_disponivel", e.target.value)} className={`${campo} mt-1.5`}>
              <option value="">Selecione...</option>
              <option value="almoco">Almoço</option>
              <option value="jantar">Jantar</option>
              <option value="ambos">Almoço e jantar</option>
              <option value="madrugada">Madrugada / eventos</option>
            </select>
          </label>
        </section>

        {/* Dados pessoais */}
        <section id="dados" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-700">Seus dados</p>
          <div className="space-y-4">
            <label className="block">
              <span className={rotulo}>Nome completo *</span>
              <input value={form.nome} onChange={e => set("nome", e.target.value)} className={`${campo} mt-1.5`} placeholder="Como está no seu documento" />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={rotulo}>Telefone (WhatsApp) *</span>
                <input inputMode="tel" value={form.telefone} onChange={e => set("telefone", fmtTel(e.target.value))} className={`${campo} mt-1.5`} placeholder="(45) 99999-9999" />
              </label>
              <label className="block">
                <span className={rotulo}>Data de nascimento</span>
                <input type="date" value={form.data_nascimento} onChange={e => set("data_nascimento", e.target.value)} className={`${campo} mt-1.5`} />
              </label>
              <label className="block">
                <span className={rotulo}>Estado civil</span>
                <select value={form.estado_civil} onChange={e => set("estado_civil", e.target.value)} className={`${campo} mt-1.5`}>
                  <option value="">Selecione...</option>
                  {ESTADOS_CIVIS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={rotulo}>Gênero</span>
                <select value={form.genero} onChange={e => set("genero", e.target.value)} className={`${campo} mt-1.5`}>
                  <option value="">Selecione...</option>
                  {GENEROS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={rotulo}>Escolaridade</span>
                <select value={form.escolaridade} onChange={e => set("escolaridade", e.target.value)} className={`${campo} mt-1.5`}>
                  <option value="">Selecione...</option>
                  {ESCOLARIDADES.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              {config.pedir_pix !== false && (
                <label className="block">
                  <span className={rotulo}>Chave PIX (para pagamento)</span>
                  <input value={form.chave_pix} onChange={e => set("chave_pix", e.target.value)} className={`${campo} mt-1.5`} />
                </label>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked={form.tem_filhos} onChange={e => set("tem_filhos", e.target.checked)} className="h-5 w-5 accent-emerald-600" />
                <span className="text-sm font-bold text-slate-700">Tenho filhos</span>
              </label>
              {form.tem_filhos && (
                <label className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-600">Quantos?</span>
                  <input type="number" min="0" value={form.qtd_filhos} onChange={e => set("qtd_filhos", e.target.value)} className="h-11 w-20 rounded-xl border border-slate-300 px-3 text-center font-black" />
                </label>
              )}
            </div>
            <label className="block">
              <span className={rotulo}>Endereço (rua e número)</span>
              <input value={form.endereco} onChange={e => set("endereco", e.target.value)} className={`${campo} mt-1.5`} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={rotulo}>Bairro</span>
                <input value={form.bairro} onChange={e => set("bairro", e.target.value)} className={`${campo} mt-1.5`} />
              </label>
              <label className="block">
                <span className={rotulo}>Cidade</span>
                <input value={form.cidade} onChange={e => set("cidade", e.target.value)} className={`${campo} mt-1.5`} />
              </label>
            </div>
            <label className="block">
              <span className={rotulo}>Experiência</span>
              <textarea rows={3} value={form.experiencia} onChange={e => set("experiencia", e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-base font-medium outline-none focus:border-emerald-600"
                placeholder="Onde já trabalhou e o que fazia." />
            </label>
            {config.pedir_diaria !== false && (
              <label className="block">
                <span className={rotulo}>Valor da diária que você cobra (R$)</span>
                <input type="number" step="0.01" value={form.valor_diaria_pretendido} onChange={e => set("valor_diaria_pretendido", e.target.value)} className={`${campo} mt-1.5`} placeholder="0,00" />
              </label>
            )}
          </div>
        </section>

        {/* Perguntas */}
        {config.perguntas.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Algumas perguntas</p>
          <p className="mb-4 mt-1 text-sm font-medium text-slate-500">Não existe resposta certa ou errada.</p>
          <div className="space-y-5">
            {config.perguntas.map((p, i) => (
              <div key={p.id}>
                <p className="text-sm font-black text-slate-800">{i + 1}. {p.pergunta}<span className="text-emerald-600"> *</span></p>
                <div className="mt-2 space-y-2">
                  {p.opcoes.map((op, idx) => {
                    const marcada = respostas[p.id] === op;
                    return (
                      <button key={idx} type="button" onClick={() => setRespostas(r => ({ ...r, [p.id]: op }))}
                        className={`flex w-full items-start gap-2.5 rounded-xl border-2 p-3 text-left transition-all ${
                          marcada ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                        <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${marcada ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                          {marcada && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                        <span className="text-sm font-semibold text-slate-700">{op}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
        )}

        {/* Interesse */}
        <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700">O que você procura</p>
          <div className="mt-3 space-y-2">
            {[
              { v: "extra", t: "Só quero fazer extras (diárias)", d: "Trabalho por diária quando vocês chamarem." },
              { v: "clt", t: "Quero ser contratado (CLT)", d: "Tenho interesse numa vaga fixa com carteira assinada." },
              { v: "ambos", t: "Os dois", d: "Faço extras e também quero concorrer a uma vaga fixa." },
            ].map(op => {
              const marcada = form.interesse === op.v;
              return (
                <button key={op.v} type="button" onClick={() => set("interesse", op.v)}
                  className={`flex w-full items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                    marcada ? "border-emerald-600 bg-white" : "border-slate-200 bg-white hover:border-emerald-300"}`}>
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${marcada ? "border-emerald-600 bg-emerald-600" : "border-slate-300"}`}>
                    {marcada && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-[15px] font-black text-slate-800">{op.t}</span>
                    <span className="block text-[13px] font-medium text-slate-500">{op.d}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}

        <button onClick={enviar} disabled={enviando}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-60">
          {enviando ? <><Loader2 size={19} className="animate-spin" /> Enviando...</> : <><Send size={19} /> Enviar meu cadastro</>}
        </button>
        <p className="text-center text-xs font-medium text-slate-400">
          Seus dados são usados apenas para contato sobre trabalho neste restaurante.
        </p>
      </main>
    </div>
  );
}
