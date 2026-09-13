"use client";

import { useEffect, useMemo, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchTreinamentos, inserirTreinamento, removerTreinamento, uploadMidiaTreinamento } from "../../../lib/treinamentos";
import {
  ArrowLeft, BookOpen, ChefHat, Clock3, ExternalLink, FileImage, GlassWater, Layers3,
  PlaySquare, Plus, Search, Share2, ShieldCheck, Trash2, Upload, UsersRound, Video, X
} from "lucide-react";

const SETORES = [
  { id: "cozinha", label: "Cozinha", Icon: ChefHat, cor: "#f97316", clara: "#fff7ed" },
  { id: "bar", label: "Bar", Icon: GlassWater, cor: "#7c3aed", clara: "#f5f3ff" },
  { id: "salao", label: "Salão", Icon: UsersRound, cor: "#0284c7", clara: "#f0f9ff" },
];

const FORM_INICIAL = {
  departamento: "cozinha",
  modulo: "Integração",
  titulo: "",
  descricao: "",
  conteudo_texto: "",
  link_video: "",
  duracao_minutos: 5,
  obrigatorio: true,
  arquivo_foto: null,
  arquivo_video: null,
  preview_foto: "",
};

function youtubeId(url = "") {
  try {
    if (url.includes("youtube.com")) return new URL(url).searchParams.get("v");
    if (url.includes("youtu.be")) return url.split("youtu.be/")[1]?.split(/[?&]/)[0];
  } catch {}
  return null;
}

export default function TreinamentoPage() {
  const { abrirMenu, unidadeAtiva, unidadeInfo } = useERP();
  const [treinamentos, setTreinamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [setor, setSetor] = useState("cozinha");
  const [modalNovo, setModalNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [busca, setBusca] = useState("");

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchTreinamentos(unidadeAtiva);
    setTreinamentos(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const dept = new URLSearchParams(window.location.search).get("dept");
    if (SETORES.some(item => item.id === dept)) setSetor(dept);
  }, []);

  useEffect(() => {
    if (unidadeAtiva) carregar();
  }, [unidadeAtiva]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return treinamentos.filter(item => {
      if ((item.departamento || "salao") !== setor) return false;
      if (!termo) return true;
      return [item.titulo, item.modulo, item.descricao, item.conteudo_texto].some(valor => String(valor || "").toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [treinamentos, setor, busca]);

  const grupos = useMemo(() => {
    const mapa = new Map();
    filtrados.forEach(item => {
      const nome = item.modulo?.trim() || "Geral";
      if (!mapa.has(nome)) mapa.set(nome, []);
      mapa.get(nome).push(item);
    });
    return [...mapa.entries()];
  }, [filtrados]);

  const abrirNovo = () => {
    setForm({ ...FORM_INICIAL, departamento: setor });
    setModalNovo(true);
  };

  const handleSalvar = async () => {
    if (!form.titulo.trim() || (!form.conteudo_texto.trim() && !form.link_video.trim() && !form.arquivo_video)) return;
    setSalvando(true);
    let linkVideo = form.link_video.trim();
    let capaUrl = null;
    const id = youtubeId(linkVideo);
    if (id) capaUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    if (form.arquivo_foto) {
      const envioFoto = await uploadMidiaTreinamento({ unidadeId: unidadeAtiva, arquivo: form.arquivo_foto, tipo: "capas" });
      if (envioFoto.error) { setSalvando(false); return alert(`Não foi possível enviar a foto: ${envioFoto.error}`); }
      capaUrl = envioFoto.data;
    }
    if (form.arquivo_video) {
      const envioVideo = await uploadMidiaTreinamento({ unidadeId: unidadeAtiva, arquivo: form.arquivo_video, tipo: "videos" });
      if (envioVideo.error) { setSalvando(false); return alert(`Não foi possível enviar o vídeo: ${envioVideo.error}`); }
      linkVideo = envioVideo.data;
    }
    const { error } = await inserirTreinamento({
      unidade_id: unidadeAtiva,
      titulo: form.titulo.trim(),
      departamento: form.departamento,
      modulo: form.modulo.trim() || "Geral",
      descricao: form.descricao.trim(),
      conteudo_texto: form.conteudo_texto.trim(),
      link_video: linkVideo,
      duracao_minutos: Math.max(1, Number(form.duracao_minutos) || 5),
      obrigatorio: Boolean(form.obrigatorio),
      capa_url: capaUrl,
    });
    setSalvando(false);
    if (error) return alert(`Não foi possível salvar: ${error}`);
    setModalNovo(false);
    setForm(FORM_INICIAL);
    carregar();
  };

  const handleRemover = async id => {
    if (!confirm("Excluir este treinamento?")) return;
    await removerTreinamento(id);
    carregar();
  };

  const compartilhar = async item => {
    const url = `${window.location.origin}/treinamento/${item.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.titulo, text: `Treinamento: ${item.titulo}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copiado. Agora você pode enviar ao funcionário.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") alert("Não foi possível compartilhar o link.");
    }
  };

  const setorInfo = SETORES.find(item => item.id === setor) || SETORES[0];
  const SetorIcon = setorInfo.Icon;
  const duracaoTotal = filtrados.reduce((total, item) => total + (Number(item.duracao_minutos) || 5), 0);
  const obrigatorios = filtrados.filter(item => item.obrigatorio).length;

  return (
    <div className="min-h-screen bg-elevated pb-24 text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <button onClick={abrirMenu} className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-card text-slate-600">
            <ArrowLeft size={20} />
          </button>
          <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: setorInfo.cor }}>
            <SetorIcon size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black sm:text-2xl">Treinamentos {setor === "cozinha" ? "da Cozinha" : setor === "bar" ? "do Bar" : "do Salão"}</h1>
            <p className="truncate text-xs font-semibold text-muted">Educação da equipe · {unidadeInfo?.nome}</p>
          </div>
          <button onClick={abrirNovo} className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-black text-white shadow-lg" style={{ background: setorInfo.cor }}>
            <Plus size={18} /> Novo conteúdo
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="col-span-2 flex items-center gap-4 rounded-2xl p-4 text-white lg:col-span-1" style={{ background: setorInfo.cor }}>
            <SetorIcon size={30}/>
            <div><p className="text-3xs font-bold uppercase tracking-widest text-white/70">Trilha</p><p className="text-xl font-black">{setorInfo.label}</p></div>
          </div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-slate-200">
            <p className="text-xs font-bold uppercase tracking-widest text-subtle">Módulos</p>
            <p className="mt-1 text-2xl font-black">{grupos.length}</p>
          </div>
          <div className="rounded-2xl bg-card p-4 ring-1 ring-slate-200">
            <p className="text-xs font-bold uppercase tracking-widest text-subtle">Tempo total</p>
            <p className="mt-1 flex items-center gap-1.5 text-2xl font-black"><Clock3 size={19} style={{ color: setorInfo.cor }}/>{duracaoTotal} min</p>
          </div>
          <div className="col-span-2 rounded-2xl bg-card p-4 ring-1 ring-slate-200 lg:col-span-1">
            <p className="text-xs font-bold uppercase tracking-widest text-subtle">Obrigatórios</p>
            <p className="mt-1 flex items-center gap-1.5 text-2xl font-black"><ShieldCheck size={19} style={{ color: setorInfo.cor }}/>{obrigatorios}</p>
          </div>
        </section>

        <div className="sticky top-[77px] z-10 mb-6 flex items-center gap-3 rounded-2xl border border-line bg-white/95 px-4 shadow-sm backdrop-blur">
          <Search size={20} className="shrink-0 text-subtle"/>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar módulo, aula ou assunto..." className="min-h-14 min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-subtle"/>
          {busca && <button onClick={() => setBusca("")} className="grid h-9 w-9 place-items-center rounded-lg bg-elevated"><X size={16}/></button>}
        </div>

        {loading ? (
          <div className="py-16 text-center font-bold text-muted">Carregando treinamentos...</div>
        ) : grupos.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-card px-6 py-14 text-center">
            <BookOpen size={42} className="mx-auto mb-3 text-dim" />
            <h2 className="text-xl font-black">Nenhum treinamento nesta trilha</h2>
            <p className="mt-1 text-sm font-medium text-muted">Crie módulos com textos, explicações e vídeos para preparar a equipe.</p>
            <button onClick={abrirNovo} className="mt-5 rounded-xl bg-accent px-5 py-3 font-black text-accent-fg">Criar primeiro conteúdo</button>
          </div>
        ) : (
          <div className="space-y-7">
            {grupos.map(([nome, itens], indice) => (
              <section key={nome} className="rounded-3xl bg-card p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl text-sm font-black text-white" style={{ background: setorInfo.cor }}>{indice + 1}</span>
                  <div>
                    <p className="text-3xs font-bold uppercase tracking-widest text-subtle">Módulo {indice + 1}</p>
                    <h2 className="text-lg font-black">{nome}</h2>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {itens.map((item, aulaIndice) => (
                    <article key={item.id} className="overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200 transition hover:shadow-md">
                      <div className="relative">
                        {item.capa_url ? <img src={item.capa_url} alt="" className="h-32 w-full object-cover" /> : <div className="flex h-24 items-center justify-center" style={{ background: setorInfo.clara }}><BookOpen size={34} style={{ color: setorInfo.cor }}/></div>}
                        <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-slate-950 text-xs font-bold text-white">{aulaIndice + 1}</span>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-lg font-black leading-tight">{item.titulo}</h3>
                          <button onClick={() => handleRemover(item.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-500" aria-label="Excluir"><Trash2 size={16} /></button>
                        </div>
                        {item.descricao && <p className="mt-2 text-sm font-semibold text-muted">{item.descricao}</p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-3xs font-bold text-slate-600 ring-1 ring-slate-200"><Clock3 size={12}/>{Number(item.duracao_minutos) || 5} min</span>
                          <span className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-3xs font-bold text-slate-600 ring-1 ring-slate-200">{item.link_video ? <><PlaySquare size={12}/>Vídeo</> : <><BookOpen size={12}/>Leitura</>}</span>
                          {item.obrigatorio && <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-3xs font-bold" style={{ background: setorInfo.clara, color: setorInfo.cor }}><ShieldCheck size={12}/>Obrigatório</span>}
                        </div>
                        {item.conteudo_texto && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-fg-soft">{item.conteudo_texto}</p>}
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {item.link_video ? (
                            <a href={item.link_video} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-black text-white"><PlaySquare size={17} /> Assistir</a>
                          ) : <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-elevated text-sm font-bold text-muted"><BookOpen size={16} /> Leitura</span>}
                          <button onClick={() => compartilhar(item)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent-soft px-3 text-sm font-black text-accent-strong"><Share2 size={17} /> Compartilhar</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {modalNovo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-3 backdrop-blur-sm">
          <div className="max-h-[96dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-card p-5 shadow-2xl sm:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Layers3 size={22} /></div>
              <div className="flex-1"><h2 className="text-xl font-black">Novo treinamento</h2><p className="text-sm font-medium text-muted">Organize o conteúdo em uma trilha e um módulo.</p></div>
              <button onClick={() => setModalNovo(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-elevated"><X size={19} /></button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Trilha
                <div className="mt-1.5 flex min-h-12 items-center rounded-xl border border-line bg-elevated px-3 text-sm font-black text-fg">{SETORES.find(item => item.id === form.departamento)?.label}</div>
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Nome do módulo
                <input value={form.modulo} onChange={e => setForm({ ...form, modulo: e.target.value })} placeholder="Ex.: Integração" className="mt-1.5 w-full rounded-xl border border-line bg-slate-50 p-3 text-sm font-bold text-fg" />
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-muted">Duração estimada
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3"><Clock3 size={17} className="text-subtle"/><input type="number" min="1" max="600" value={form.duracao_minutos} onChange={e => setForm({ ...form, duracao_minutos: e.target.value })} className="min-w-0 flex-1 bg-transparent py-3 text-sm font-black text-fg outline-none"/><span className="text-xs font-bold text-subtle">min</span></div>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-wider text-slate-600">Conteúdo obrigatório
                <button type="button" onClick={() => setForm({ ...form, obrigatorio: !form.obrigatorio })} className={`relative h-7 w-12 rounded-full transition ${form.obrigatorio ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-card transition ${form.obrigatorio ? "left-6" : "left-1"}`}/></button>
              </label>
              <label className="sm:col-span-2 text-xs font-bold uppercase tracking-wider text-muted">Título
                <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Organização da praça antes da abertura" className="mt-1.5 w-full rounded-xl border border-line bg-slate-50 p-3 text-sm font-bold normal-case tracking-normal text-fg" />
              </label>
              <label className="sm:col-span-2 text-xs font-bold uppercase tracking-wider text-muted">Resumo
                <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Uma frase curta sobre este conteúdo" className="mt-1.5 w-full rounded-xl border border-line bg-slate-50 p-3 text-sm font-semibold normal-case tracking-normal text-fg" />
              </label>
              <label className="sm:col-span-2 text-xs font-bold uppercase tracking-wider text-muted">Explicação / conteúdo
                <textarea value={form.conteudo_texto} onChange={e => setForm({ ...form, conteudo_texto: e.target.value })} rows={6} placeholder="Escreva as orientações, o passo a passo e os padrões esperados..." className="mt-1.5 w-full resize-none rounded-xl border border-line bg-slate-50 p-3 text-sm font-medium normal-case tracking-normal text-fg" />
              </label>
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
                <label className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-emerald-400">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600"><FileImage size={18}/>Foto de capa</span>
                  {form.preview_foto ? <img src={form.preview_foto} alt="Prévia" className="mt-3 h-28 w-full rounded-xl object-cover"/> : <span className="mt-3 flex min-h-20 items-center justify-center gap-2 rounded-xl bg-card text-sm font-bold text-subtle"><Upload size={18}/>Celular ou computador</span>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const arquivo = e.target.files?.[0] || null; setForm({ ...form, arquivo_foto: arquivo, preview_foto: arquivo ? URL.createObjectURL(arquivo) : "" }); }}/>
                </label>
                <label className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-emerald-400">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600"><Video size={18}/>Enviar vídeo</span>
                  <span className="mt-3 flex min-h-20 items-center justify-center gap-2 rounded-xl bg-card px-3 text-center text-sm font-bold text-subtle"><Upload size={18}/>{form.arquivo_video?.name || "Galeria, câmera ou computador"}</span>
                  <input type="file" accept="video/*" className="hidden" onChange={e => setForm({ ...form, arquivo_video: e.target.files?.[0] || null })}/>
                </label>
              </div>
              <label className="sm:col-span-2 text-xs font-bold uppercase tracking-wider text-muted">Link do vídeo (opcional)
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-line bg-slate-50 px-3"><Video size={18} className="text-subtle" /><input type="url" value={form.link_video} onChange={e => setForm({ ...form, link_video: e.target.value })} placeholder="Use somente se preferir colar YouTube ou outro link" className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold normal-case tracking-normal text-fg outline-none" /><ExternalLink size={16} className="text-dim" /></div>
              </label>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setModalNovo(false)} className="min-h-12 rounded-xl bg-elevated font-black text-slate-600">Cancelar</button>
              <button onClick={handleSalvar} disabled={salvando || !form.titulo.trim() || (!form.conteudo_texto.trim() && !form.link_video.trim() && !form.arquivo_video)} className="min-h-12 rounded-xl bg-accent font-black text-accent-fg disabled:bg-slate-300">{salvando ? "Enviando..." : "Publicar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
