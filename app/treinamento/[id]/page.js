"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { fetchTreinamento } from "../../lib/treinamentos";
import { BookOpen, ChefHat, CheckCircle2, Clock3, ExternalLink, GlassWater, PlaySquare, ShieldCheck, UsersRound } from "lucide-react";

const SETORES = {
  cozinha: { label: "Cozinha", Icon: ChefHat },
  bar: { label: "Bar", Icon: GlassWater },
  salao: { label: "Salão", Icon: UsersRound },
};

function youtubeEmbed(url = "") {
  try {
    const id = url.includes("youtu.be/")
      ? url.split("youtu.be/")[1]?.split(/[?&]/)[0]
      : new URL(url).searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : "";
  } catch { return ""; }
}

export default function TreinamentoPublico() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    fetchTreinamento(id).then(({ data }) => {
      setItem(data);
      try { setConcluido(localStorage.getItem(`hefisto_treinamento_${id}`) === "concluido"); } catch {}
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-slate-100 font-bold text-slate-500">Abrindo treinamento...</div>;
  if (!item) return <div className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center"><div><BookOpen size={48} className="mx-auto text-slate-300"/><h1 className="mt-3 text-2xl font-black">Treinamento não encontrado</h1></div></div>;

  const setor = SETORES[item.departamento] || SETORES.salao;
  const SetorIcon = setor.Icon;
  const embed = youtubeEmbed(item.link_video);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:py-10">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
        <header className="bg-slate-950 p-6 text-white sm:p-9">
          <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-widest">
            <span className="flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-2 text-emerald-300"><SetorIcon size={15}/>{setor.label}</span>
            <span className="rounded-full bg-white/10 px-3 py-2">{item.modulo || "Geral"}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2"><Clock3 size={14}/>{Number(item.duracao_minutos) || 5} min</span>
            {item.obrigatorio && <span className="flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-2 text-amber-200"><ShieldCheck size={14}/>Obrigatório</span>}
          </div>
          <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{item.titulo}</h1>
          {item.descricao && <p className="mt-3 text-base font-medium text-slate-300 sm:text-lg">{item.descricao}</p>}
        </header>

        <div className="p-5 sm:p-9">
          {item.conteudo_texto && (
            <section className="mb-7">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><BookOpen size={20} className="text-emerald-600"/>Conteúdo</h2>
              <div className="whitespace-pre-line rounded-2xl bg-slate-50 p-5 text-base leading-8 text-slate-700 ring-1 ring-slate-200">{item.conteudo_texto}</div>
            </section>
          )}

          {embed ? (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><PlaySquare size={20} className="text-emerald-600"/>Vídeo</h2>
              <div className="aspect-video overflow-hidden rounded-2xl bg-black"><iframe src={embed} title={item.titulo} className="h-full w-full" allowFullScreen /></div>
            </section>
          ) : item.link_video ? (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black"><PlaySquare size={20} className="text-emerald-600"/>Vídeo</h2>
              <video src={item.link_video} controls playsInline preload="metadata" className="max-h-[70dvh] w-full rounded-2xl bg-black">Seu navegador não conseguiu abrir este vídeo.</video>
              <a href={item.link_video} target="_blank" rel="noreferrer" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 px-5 text-sm font-black text-slate-700">Abrir vídeo em outra tela<ExternalLink size={16}/></a>
            </section>
          ) : null}

          <button onClick={() => { const novo = !concluido; setConcluido(novo); try { localStorage.setItem(`hefisto_treinamento_${id}`, novo ? "concluido" : ""); } catch {} }} className={`mt-7 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 font-black transition ${concluido ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300" : "bg-emerald-600 text-white"}`}>
            <CheckCircle2 size={21}/>{concluido ? "Treinamento concluído" : "Marcar como concluído"}
          </button>
        </div>
      </article>
    </main>
  );
}
