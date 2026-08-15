"use client";

// EDITAR O PORTAL DE CADASTRO DE EXTRAS
// Muda os textos, as funções oferecidas e as perguntas que o candidato responde.
// O que for salvo aqui aparece na hora no link público.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Copy, ExternalLink, Loader2, Plus, Save, Trash2, X,
} from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import {
  fetchPortalExtrasConfig, salvarPortalExtrasConfig, PORTAL_EXTRAS_PADRAO,
} from "../../../../lib/portal-extras";

export default function EditarPortalExtras() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [config, setConfig] = useState(PORTAL_EXTRAS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [erro, setErro] = useState("");
  const [novaFuncao, setNovaFuncao] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    fetchPortalExtrasConfig(unidadeAtiva).then(r => { setConfig(r.data); setCarregando(false); });
  }, [unidadeAtiva]);

  const set = (campo, valor) => setConfig(c => ({ ...c, [campo]: valor }));

  const salvar = async () => {
    setSalvando(true); setErro(""); setAviso("");
    const r = await salvarPortalExtrasConfig(unidadeAtiva, config);
    setSalvando(false);
    if (r.error) { setErro(r.error); return; }
    setConfig(r.data);
    setAviso("Portal atualizado. Quem abrir o link já vê as mudanças.");
    setTimeout(() => setAviso(""), 4000);
  };

  // ── Funções oferecidas ──
  const addFuncao = () => {
    const nome = novaFuncao.trim();
    if (!nome) return;
    if (config.funcoes.some(f => f.toLowerCase() === nome.toLowerCase())) { setErro("Essa função já está na lista."); return; }
    set("funcoes", [...config.funcoes, nome]);
    setNovaFuncao(""); setErro("");
  };
  const removerFuncao = (nome) => set("funcoes", config.funcoes.filter(f => f !== nome));

  // ── Perguntas ──
  const addPergunta = () => set("perguntas", [
    ...config.perguntas,
    { id: `p${Date.now()}`, pergunta: "", opcoes: ["", ""] },
  ]);
  const mudarPergunta = (i, campo, valor) =>
    set("perguntas", config.perguntas.map((p, j) => j === i ? { ...p, [campo]: valor } : p));
  const mudarOpcao = (i, j, valor) =>
    set("perguntas", config.perguntas.map((p, pi) => pi === i
      ? { ...p, opcoes: p.opcoes.map((o, oi) => oi === j ? valor : o) } : p));
  const addOpcao = (i) =>
    set("perguntas", config.perguntas.map((p, j) => j === i ? { ...p, opcoes: [...p.opcoes, ""] } : p));
  const removerOpcao = (i, j) =>
    set("perguntas", config.perguntas.map((p, pi) => pi === i
      ? { ...p, opcoes: p.opcoes.filter((_, oi) => oi !== j) } : p));
  const removerPergunta = (i) => set("perguntas", config.perguntas.filter((_, j) => j !== i));

  const copiarLink = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/extras/${unidadeAtiva}`);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  const rotulo = "text-xs font-black uppercase tracking-widest text-slate-500";
  const campo = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white p-3.5 text-base font-semibold text-slate-800 outline-none focus:border-emerald-600";

  if (carregando) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-emerald-600" size={30} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/rh/extra")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Editar portal de prestadores</h1>
            <p className="text-xs font-bold text-slate-500">Textos, funções e perguntas do link público</p>
          </div>
          <button onClick={copiarLink} className="flex h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50">
            {linkCopiado ? <><Check size={17} /> Copiado</> : <><Copy size={17} /> Copiar link</>}
          </button>
          <a href={`/extras/${unidadeAtiva}`} target="_blank" rel="noreferrer"
            className="flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-black text-white hover:bg-emerald-700">
            <ExternalLink size={17} /> Abrir portal
          </a>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        {!unidadeAtiva || unidadeAtiva === "todas" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica.</div>
        ) : (
          <>
            {/* Textos */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="mb-4 text-xs font-black uppercase tracking-widest text-emerald-700">Textos da página</p>
              <label className="block">
                <span className={rotulo}>Título</span>
                <input value={config.titulo} onChange={e => set("titulo", e.target.value)} className={campo} />
              </label>
              <label className="mt-4 block">
                <span className={rotulo}>Texto de apresentação</span>
                <textarea rows={3} value={config.subtitulo} onChange={e => set("subtitulo", e.target.value)} className={campo} />
              </label>
              <label className="mt-4 block">
                <span className={rotulo}>Mensagem depois de enviar</span>
                <textarea rows={2} value={config.mensagem_sucesso} onChange={e => set("mensagem_sucesso", e.target.value)} className={campo} />
              </label>
              <label className="mt-4 flex items-center gap-2.5">
                <input type="checkbox" checked={config.mostrar_endereco !== false}
                  onChange={e => set("mostrar_endereco", e.target.checked)} className="h-5 w-5 accent-emerald-600" />
                <span className="text-sm font-bold text-slate-700">Mostrar o endereço do restaurante</span>
              </label>
            </section>

            {/* Funções */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Funções oferecidas</p>
              <p className="mb-3 mt-1 text-sm font-medium text-slate-500">
                O candidato escolhe uma principal e, se quiser, uma segunda. A principal vira a categoria no seu banco.
              </p>
              <div className="flex flex-wrap gap-2">
                {config.funcoes.map(f => (
                  <span key={f} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                    {f}
                    <button onClick={() => removerFuncao(f)} className="text-emerald-700 hover:text-red-600" aria-label={`Remover ${f}`}><X size={14} /></button>
                  </span>
                ))}
                {config.funcoes.length === 0 && <p className="text-sm font-bold text-red-600">Adicione pelo menos uma função.</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <input value={novaFuncao} onChange={e => setNovaFuncao(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFuncao(); } }}
                  placeholder="Ex.: Chapeiro" className="h-12 flex-1 rounded-xl border border-slate-300 px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                <button onClick={addFuncao} className="flex h-12 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 font-black text-white hover:bg-emerald-700">
                  <Plus size={17} /> Adicionar
                </button>
              </div>
            </section>

            {/* Perguntas */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Perguntas do cadastro</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">Cada pergunta precisa de pelo menos duas opções.</p>
                </div>
                <button onClick={addPergunta} className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border-2 border-emerald-200 bg-white px-3.5 font-black text-emerald-700 hover:bg-emerald-50">
                  <Plus size={17} /> Pergunta
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {config.perguntas.map((p, i) => (
                  <div key={p.id || i} className="rounded-2xl border border-slate-200 p-3.5">
                    <div className="flex items-start gap-2">
                      <input value={p.pergunta} onChange={e => mudarPergunta(i, "pergunta", e.target.value)}
                        placeholder="Escreva a pergunta"
                        className="h-12 flex-1 rounded-xl border border-slate-300 px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                      <button onClick={() => removerPergunta(i)} title="Remover pergunta"
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50"><Trash2 size={17} /></button>
                    </div>
                    <div className="mt-2.5 space-y-2">
                      {p.opcoes.map((o, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-slate-300" />
                          <input value={o} onChange={e => mudarOpcao(i, j, e.target.value)}
                            placeholder={`Opção ${j + 1}`}
                            className="h-11 flex-1 rounded-xl border border-slate-200 px-3 font-semibold text-slate-700 outline-none focus:border-emerald-600" />
                          {p.opcoes.length > 2 && (
                            <button onClick={() => removerOpcao(i, j)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-red-600"><X size={16} /></button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addOpcao(i)} className="text-[13px] font-black text-emerald-700">+ Adicionar opção</button>
                    </div>
                  </div>
                ))}
                {config.perguntas.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Sem perguntas: o cadastro fica só com os dados básicos.</p>
                )}
              </div>
            </section>

            {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}
            {aviso && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{aviso}</p>}
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:p-4"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="mx-auto flex max-w-3xl gap-3">
          <button onClick={() => router.push("/dashboard/rh/extra")} className="rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600 hover:bg-slate-50">Voltar</button>
          <button onClick={salvar} disabled={salvando || !config.funcoes.length}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
            {salvando ? <><Loader2 size={18} className="animate-spin" /> Salvando...</> : <><Save size={18} /> Salvar portal</>}
          </button>
        </div>
      </div>
    </div>
  );
}
