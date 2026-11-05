"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Search, TriangleAlert } from "lucide-react";
import { concluirAula, corrigirProva, fetchMeuTreinamento, fetchPratos, fetchQuestoes } from "../../../../lib/treinamento";
import { cenasDoPrato, cenasParaTocar, faltasDoPrato, fichasDaEtapa, guiaDaFicha, mensagemDeErro } from "../../../../lib/treinamento-regras.mjs";
import PalcoDoBoneco from "../../../../components/treinamento/PalcoDoBoneco";

function Prova({ modulo, matricula, aoAprovar }) {
  const [questoes, setQuestoes] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { fetchQuestoes(modulo.id).then((r) => { setQuestoes(r.data); if (r.error) setErro(mensagemDeErro(r.error)); }); }, [modulo.id]);
  if (!questoes) return <div className="h-40 animate-pulse rounded-2xl bg-hf-elevated" aria-hidden />;
  const falta = questoes.filter((q) => respostas[q.id] === undefined).length;

  const enviar = async () => {
    setEnviando(true); setErro("");
    const r = await corrigirProva(matricula, modulo.id, respostas);
    setEnviando(false);
    if (r.error) return setErro(mensagemDeErro(r.error));
    setResultado(r.data);
    if (r.data.aprovada) aoAprovar();
    else setRespostas({});
    window.scrollTo?.({ top: 0 });
  };
  const correcao = Object.fromEntries((resultado?.correcao || []).map((c) => [c.questao_id, c]));

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-black text-hf-text">Prova: {modulo.titulo}</h2>
      {resultado && (
        <div role="status" className={`rounded-xl border p-4 text-sm font-semibold ${resultado.aprovada ? "border-hf-success/40 bg-hf-success/10 text-hf-text" : "border-hf-warning/40 bg-hf-warning/10 text-hf-text"}`}>
          {resultado.aprovada ? `Aprovado: ${resultado.acertos} de ${resultado.total} acertos.` : `Você acertou ${resultado.acertos} de ${resultado.total}. Precisa de pelo menos 80%.`}
          {!resultado.aprovada && resultado.rever?.length > 0 && <p className="mt-1 font-medium">Reveja: {resultado.rever.join(", ")}.</p>}
        </div>
      )}
      {questoes.map((q, i) => {
        const c = correcao[q.id];
        return (
          <fieldset key={q.id} className="rounded-2xl border border-hf-border bg-hf-surface p-4">
            <legend className="px-1 text-xs font-bold text-hf-accent">{q.tipo === "situacao" ? "Situação" : `Questão ${i + 1}`}</legend>
            <p className="text-base font-bold leading-snug text-hf-text">{q.enunciado}</p>
            <div className="mt-3 space-y-2">
              {q.opcoes.map((o, n) => {
                const marcada = respostas[q.id] === n;
                const certa = c && c.correta === n;
                return (
                  <label key={o} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold text-hf-text ${certa ? "border-hf-success bg-hf-success/10" : marcada ? "border-hf-accent bg-hf-accent/10" : "border-hf-border"}`}>
                    <input type="radio" name={q.id} checked={marcada} disabled={!!resultado?.aprovada} onChange={() => setRespostas({ ...respostas, [q.id]: n })} className="h-5 w-5 accent-hf-accent" />
                    {o}
                  </label>
                );
              })}
            </div>
            {c?.explicacao && <p className="mt-2 text-sm font-medium text-hf-text-2">{c.explicacao}</p>}
          </fieldset>
        );
      })}
      {erro && <p role="alert" className="text-sm font-semibold text-hf-danger">{erro}</p>}
      {resultado?.aprovada && <Link href="/dashboard/treinamento" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-hf-accent px-5 font-black text-hf-accent-fg">Voltar para a minha trilha</Link>}
      {!resultado?.aprovada && (
        <button onClick={enviar} disabled={falta > 0 || enviando} className="min-h-12 w-full rounded-xl bg-hf-accent px-5 font-black text-hf-accent-fg disabled:opacity-50">
          {enviando ? "Corrigindo..." : falta > 0 ? `Faltam ${falta} resposta(s)` : "Enviar respostas"}
        </button>
      )}
    </section>
  );
}

function ModuloDeAulas({ modulo, matricula, aulas, concluidas, aprovado, atualizar }) {
  const proxima = aulas.find((a) => !concluidas.has(a.id));
  const [aulaId, setAulaId] = useState(proxima?.id || aulas[0]?.id);
  const [provaAberta, setProvaAberta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const aula = aulas.find((a) => a.id === aulaId);
  const cenas = useMemo(() => cenasParaTocar(aula), [aula]);
  const tudoVisto = aulas.length > 0 && aulas.every((a) => concluidas.has(a.id));

  const concluir = async () => {
    setSalvando(true); setErro("");
    const r = await concluirAula(matricula, aula.id);
    setSalvando(false);
    if (r.error) return setErro(mensagemDeErro(r.error));
    await atualizar();
    const seguinte = aulas.find((a) => a.id !== aula.id && !concluidas.has(a.id));
    if (seguinte) setAulaId(seguinte.id);
    else setProvaAberta(true);
  };

  // Continua aberta depois de aprovar, para a pessoa ler a correção.
  if (provaAberta && tudoVisto) return <Prova modulo={modulo} matricula={matricula} aoAprovar={atualizar} />;

  return (
    <div className="space-y-4">
      <nav aria-label="Aulas do módulo" className="flex gap-2 overflow-x-auto pb-1">
        {aulas.map((a, i) => (
          <button key={a.id} onClick={() => setAulaId(a.id)} aria-current={a.id === aulaId ? "true" : undefined} className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-bold ${a.id === aulaId ? "border-hf-accent bg-hf-accent/10 text-hf-text" : "border-hf-border text-hf-text-2"}`}>
            {concluidas.has(a.id) ? <CheckCircle2 size={16} className="text-hf-success" aria-hidden /> : <Circle size={16} aria-hidden />} {i + 1}. {a.titulo}
          </button>
        ))}
      </nav>
      {aula && (
        <>
          <PalcoDoBoneco key={aula.id} cenas={cenas} area={modulo.area} titulo={aula.titulo} videoUrl={aula.video_url} />
          {aula.fontes && <p className="text-xs font-medium text-hf-text-2">Fonte: {aula.fontes}</p>}
          {erro && <p role="alert" className="text-sm font-semibold text-hf-danger">{erro}</p>}
          {!concluidas.has(aula.id) ? (
            <button onClick={concluir} disabled={salvando} className="min-h-12 w-full rounded-xl bg-hf-accent px-5 font-black text-hf-accent-fg disabled:opacity-60">{salvando ? "Salvando..." : "Concluí esta aula"}</button>
          ) : tudoVisto && !aprovado ? (
            <button onClick={() => setProvaAberta(true)} className="min-h-12 w-full rounded-xl bg-hf-accent px-5 font-black text-hf-accent-fg">Fazer a prova</button>
          ) : null}
          {aprovado && <p className="flex items-center gap-2 text-sm font-bold text-hf-success"><CheckCircle2 size={18} aria-hidden /> Prova aprovada. Você pode rever as aulas quando quiser.</p>}
        </>
      )}
    </div>
  );
}

function ModuloDePratos({ modulo, validados }) {
  const [dados, setDados] = useState(null);
  const [busca, setBusca] = useState("");
  const [fichaId, setFichaId] = useState(null);
  useEffect(() => { fetchPratos(modulo.unidade_id, modulo.departamento).then(setDados); }, [modulo.unidade_id, modulo.departamento]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return fichasDaEtapa(dados?.fichas, modulo.departamento, modulo.etapa).filter((f) => !termo || String(f.nome_receita).toLocaleLowerCase("pt-BR").includes(termo));
  }, [dados, busca, modulo]);
  const ficha = lista.find((f) => f.id === fichaId);
  const guia = ficha ? guiaDaFicha(ficha, dados?.guias) : null;
  const cenas = useMemo(() => (ficha ? cenasDoPrato(ficha, guia, modulo.etapa) : []), [ficha, guia, modulo.etapa]);
  const foto = guia?.foto_url || ficha?.montagem_foto || ficha?.imagem;

  if (!dados) return <div className="h-40 animate-pulse rounded-2xl bg-hf-elevated" aria-hidden />;
  if (dados.error) return <p role="alert" className="text-sm font-semibold text-hf-danger">{mensagemDeErro(dados.error)}</p>;

  if (ficha) {
    const faltas = faltasDoPrato(ficha, guia, modulo.etapa);
    return (
      <div className="space-y-3">
        <button onClick={() => setFichaId(null)} className="flex min-h-11 items-center gap-2 text-sm font-bold text-hf-text"><ArrowLeft size={18} /> Todos os itens</button>
        <h2 className="text-xl font-black text-hf-text">{ficha.nome_comercial || ficha.nome_receita}</h2>
        {foto && <img src={foto} alt={`Foto de ${ficha.nome_receita}`} className="max-h-72 w-full rounded-2xl object-cover" />}
        {faltas.length > 0 && <p className="flex items-start gap-2 rounded-xl border border-hf-warning/40 bg-hf-warning/10 p-3 text-sm font-semibold text-hf-text"><TriangleAlert size={18} className="mt-0.5 shrink-0 text-hf-warning" aria-hidden /> Falta na ficha: {faltas.join(", ")}. O líder precisa completar.</p>}
        <PalcoDoBoneco key={ficha.id} cenas={cenas} area={modulo.departamento} titulo={ficha.nome_receita} />
      </div>
    );
  }

  const feitos = validados.filter((v) => v.etapa === modulo.etapa).length;
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-hf-text-2">{feitos} de {lista.length} confirmados pelo líder</p>
      <label className="flex min-h-12 items-center gap-2 rounded-xl border border-hf-border px-3">
        <Search size={18} className="text-hf-text-2" aria-hidden />
        <span className="sr-only">Buscar</span>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-hf-text outline-none" />
      </label>
      {lista.length === 0 && <p className="rounded-xl border border-dashed border-hf-border p-6 text-center text-sm font-medium text-hf-text-2">Nenhum item encontrado.</p>}
      <ul className="grid gap-2 sm:grid-cols-2">
        {lista.map((f) => {
          const faltas = faltasDoPrato(f, guiaDaFicha(f, dados.guias), modulo.etapa);
          const ok = validados.some((v) => v.ficha_id === f.id && v.etapa === modulo.etapa);
          return (
            <li key={f.id}>
              <button onClick={() => setFichaId(f.id)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-hf-border bg-hf-surface p-3 text-left hover:border-hf-accent">
                {ok ? <CheckCircle2 size={20} className="shrink-0 text-hf-success" aria-label="Confirmado pelo líder" /> : <Circle size={20} className="shrink-0 text-hf-text-2" aria-hidden />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-hf-text">{f.nome_comercial || f.nome_receita}</span>{faltas.length > 0 && <span className="block truncate text-xs font-semibold text-hf-warning">Falta: {faltas.join(", ")}</span>}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Conteudo() {
  const { id } = useParams();
  const matriculaId = useSearchParams().get("m");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const carregar = async () => { const r = await fetchMeuTreinamento(); if (r.error) setErro(mensagemDeErro(r.error)); setDados(r); };
  useEffect(() => { carregar(); }, []);

  const matricula = dados?.matriculas?.find((m) => m.id === matriculaId);
  const modulo = dados?.modulos?.find((m) => m.id === id);
  const ligado = matricula && dados.ligacoes.some((l) => l.trilha_id === matricula.trilha_id && l.modulo_id === id);
  const aulas = useMemo(() => (dados?.aulas || []).filter((a) => a.modulo_id === id), [dados, id]);
  const concluidas = useMemo(() => new Set((dados?.concluidas || []).filter((c) => c.matricula_id === matriculaId).map((c) => c.aula_id)), [dados, matriculaId]);
  const aprovado = (dados?.tentativas || []).some((t) => t.matricula_id === matriculaId && t.modulo_id === id && t.aprovada);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-5 sm:px-6 sm:py-8">
      <Link href="/dashboard/treinamento" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-hf-text"><ArrowLeft size={18} /> Meu treinamento</Link>
      {erro && <p role="alert" className="text-sm font-semibold text-hf-danger">{erro}</p>}
      {!dados && !erro && <div className="h-64 animate-pulse rounded-2xl bg-hf-elevated" aria-hidden />}
      {dados && !erro && (!modulo || !ligado) && <p className="rounded-xl border border-hf-border p-4 text-sm font-semibold text-hf-text">Este módulo não faz parte da sua trilha.</p>}
      {modulo && ligado && (
        <>
          <header>
            <h1 className="text-2xl font-black tracking-tight text-hf-text">{modulo.titulo}</h1>
            {modulo.descricao && <p className="mt-1 text-sm font-medium text-hf-text-2">{modulo.descricao}</p>}
          </header>
          {modulo.tipo === "pratos"
            ? <ModuloDePratos modulo={modulo} validados={dados.pratos.filter((p) => p.matricula_id === matriculaId)} />
            : <ModuloDeAulas modulo={modulo} matricula={matriculaId} aulas={aulas} concluidas={concluidas} aprovado={aprovado} atualizar={carregar} />}
        </>
      )}
    </div>
  );
}

export default function ModuloPage() {
  return <Suspense fallback={null}><Conteudo /></Suspense>;
}
