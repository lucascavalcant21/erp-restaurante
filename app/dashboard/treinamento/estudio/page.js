"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronDown, Clapperboard, Plus, Sparkles, Trash2, TriangleAlert, Upload } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { hasPermission } from "../../../lib/permissions-catalog.mjs";
import { uploadMidiaTreinamento } from "../../../lib/treinamentos";
import {
  aprovarModulo, criarAula, criarModulo, criarQuestao, fetchEstudio, fetchGabarito, fetchPratos, gerarFalasComIA,
  ligarModulo, removerAula, removerQuestao, salvarAula, salvarCenas, salvarModulo, salvarQuestao,
} from "../../../lib/treinamento";
import {
  AREAS_TREINAMENTO, DEMONSTRACOES_DISPONIVEIS, cenasParaTocar, demonstracaoDaCena, mensagemDeErro, pendenciasDeFichas, temPreencher,
} from "../../../lib/treinamento-regras.mjs";
import PalcoDoBoneco from "../../../components/treinamento/PalcoDoBoneco";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";

const CAMPO = "w-full rounded-xl border border-hf-border bg-hf-surface p-3 text-sm font-medium text-hf-text";
const BOTAO = "flex min-h-11 items-center justify-center gap-2 rounded-xl border border-hf-border px-3 text-sm font-bold text-hf-text disabled:opacity-50";
const PRINCIPAL = "flex min-h-11 items-center justify-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-black text-hf-accent-fg disabled:opacity-50";
const NOME_DEMO = { maos: "Lavar as mãos", fogo: "Fogo", faca: "Faca", termometro: "Temperatura", etiqueta: "Etiqueta", balanca: "Medida", vinho: "Vinho", coqueteleira: "Coqueteleira", mesa: "Montar mesa", empratar: "Empratar", bandeja: "Bandeja", panela: "Panela", alerta: "Atenção", conversa: "Conversa" };
const opcoesParaTexto = (o) => (o || []).join("\n");
const textoParaOpcoes = (t) => String(t).split("\n").map((l) => l.trim()).filter(Boolean);

function EditorDeFalas({ aula, podeEditar, aoMudar, avisar }) {
  const [cenas, setCenas] = useState(() => cenasParaTocar(aula).map((c) => ({ fala: c.fala, texto: c.fala, itens: [], demonstracao: c.demonstracao, gesto: c.gesto })));
  const [gerando, setGerando] = useState(false);
  const [estilo, setEstilo] = useState("");
  const [ver, setVer] = useState(false);

  const gerar = async () => {
    setGerando(true);
    const r = await gerarFalasComIA(aula.id, estilo);
    setGerando(false);
    if (r.error) return avisar(r.error);
    setCenas(r.data);
    avisar("Falas sugeridas pela IA. Revise e salve.");
  };
  const mudar = (i, campo, valor) => setCenas(cenas.map((c, n) => (n === i ? { ...c, [campo]: valor, ...(campo === "fala" ? { texto: valor, demonstracao: c.demonstracao } : {}) } : c)));
  const salvar = async () => {
    const r = await salvarCenas(aula.id, cenas.filter((c) => c.fala.trim()));
    if (r.error) return avisar(mensagemDeErro(r.error));
    avisar("Falas salvas.");
    aoMudar();
  };

  return (
    <div className="space-y-3 rounded-xl bg-hf-elevated p-3">
      <h4 className="flex items-center gap-2 text-sm font-black text-hf-text"><Clapperboard size={17} /> Falas do boneco</h4>
      {podeEditar && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={estilo} onChange={(e) => setEstilo(e.target.value)} aria-label="Estilo das falas" placeholder="Estilo (opcional): mais animado, mais curto..." className={`${CAMPO} min-h-11 flex-1 p-2`} />
          <button onClick={gerar} disabled={gerando} className={PRINCIPAL}><Sparkles size={17} /> {gerando ? "Gerando..." : "Gerar falas com IA"}</button>
        </div>
      )}
      <ol className="space-y-2">
        {cenas.map((c, i) => (
          <li key={i} className="rounded-xl border border-hf-border bg-hf-surface p-2">
            <label className="text-xs font-bold text-hf-text-2">Cena {i + 1}
              <textarea value={c.fala} disabled={!podeEditar} rows={2} onChange={(e) => mudar(i, "fala", e.target.value)} className={`${CAMPO} mt-1 resize-y p-2`} />
            </label>
            <div className="mt-1 flex gap-2">
              <select aria-label={`Demonstração da cena ${i + 1}`} disabled={!podeEditar} value={c.demonstracao || demonstracaoDaCena(c.fala)} onChange={(e) => mudar(i, "demonstracao", e.target.value)} className={`${CAMPO} min-h-11 flex-1 p-2`}>
                {DEMONSTRACOES_DISPONIVEIS.map((d) => <option key={d} value={d}>{NOME_DEMO[d]}</option>)}
              </select>
              {podeEditar && <button onClick={() => setCenas(cenas.filter((_, n) => n !== i))} aria-label={`Remover a cena ${i + 1}`} className={BOTAO}><Trash2 size={16} /></button>}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {podeEditar && <button onClick={() => setCenas([...cenas, { fala: "", texto: "", itens: [], demonstracao: "conversa", gesto: "explicar" }])} className={BOTAO}><Plus size={16} /> Nova cena</button>}
        {podeEditar && <button onClick={salvar} className={PRINCIPAL}>Salvar falas</button>}
        <button onClick={() => setVer((v) => !v)} className={BOTAO}>{ver ? "Fechar" : "Ver o boneco"}</button>
      </div>
      {ver && <PalcoDoBoneco cenas={cenas.filter((c) => c.fala.trim())} area={aula.__area} titulo={aula.titulo} videoUrl={aula.video_url} />}
    </div>
  );
}

function EditorDeQuestao({ questao, gabarito, podeEditar, rascunho, aoMudar, avisar }) {
  const [f, setF] = useState({ enunciado: questao.enunciado, opcoes: opcoesParaTexto(questao.opcoes), correta: gabarito?.correta ?? 0, explicacao: gabarito?.explicacao || "" });
  useEffect(() => { setF((x) => ({ ...x, correta: gabarito?.correta ?? x.correta, explicacao: gabarito?.explicacao ?? x.explicacao })); }, [gabarito]);
  const opcoes = textoParaOpcoes(f.opcoes);
  const salvar = async () => {
    const r = await salvarQuestao(questao.id, { ...f, opcoes });
    if (r.error) return avisar(mensagemDeErro(r.error));
    avisar("Questão salva."); aoMudar();
  };
  const remover = async () => {
    if (!window.confirm("Remover esta questão?")) return;
    const r = await removerQuestao(questao.id);
    if (r.error) return avisar(mensagemDeErro(r.error));
    aoMudar();
  };
  return (
    <li className="space-y-2 rounded-xl border border-hf-border bg-hf-surface p-3">
      <p className="text-xs font-bold text-hf-accent">{questao.tipo === "situacao" ? "Situação" : "Prova"}</p>
      <label className="block text-xs font-bold text-hf-text-2">Pergunta<textarea rows={2} disabled={!podeEditar} value={f.enunciado} onChange={(e) => setF({ ...f, enunciado: e.target.value })} className={`${CAMPO} mt-1 p-2`} /></label>
      <label className="block text-xs font-bold text-hf-text-2">Opções (uma por linha)<textarea rows={3} disabled={!podeEditar} value={f.opcoes} onChange={(e) => setF({ ...f, opcoes: e.target.value })} className={`${CAMPO} mt-1 p-2`} /></label>
      <label className="block text-xs font-bold text-hf-text-2">Resposta certa
        <select disabled={!podeEditar} value={f.correta} onChange={(e) => setF({ ...f, correta: Number(e.target.value) })} className={`${CAMPO} mt-1 min-h-11 p-2`}>
          {opcoes.map((o, i) => <option key={i} value={i}>{o}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-hf-text-2">Explicação<input disabled={!podeEditar} value={f.explicacao} onChange={(e) => setF({ ...f, explicacao: e.target.value })} className={`${CAMPO} mt-1 min-h-11 p-2`} /></label>
      {podeEditar && <div className="flex gap-2"><button onClick={salvar} className={BOTAO}>Salvar questão</button>{rascunho && <button onClick={remover} aria-label="Remover questão" className={BOTAO}><Trash2 size={16} /></button>}</div>}
    </li>
  );
}

function EditorDeAula({ aula, modulo, questoes, gabarito, podeEditar, aoMudar, avisar }) {
  const { unidadeAtiva } = useERP();
  const [f, setF] = useState({ titulo: aula.titulo, conteudo: aula.conteudo, video_url: aula.video_url || "", duracao_minutos: aula.duracao_minutos });
  const [enviando, setEnviando] = useState(false);
  const marcada = temPreencher(f.conteudo);
  const salvar = async () => {
    const r = await salvarAula(aula.id, f);
    if (r.error) return avisar(mensagemDeErro(r.error));
    avisar("Aula salva."); aoMudar();
  };
  const remover = async () => {
    if (!window.confirm("Remover esta aula e as questões dela?")) return;
    const r = await removerAula(aula.id);
    if (r.error) return avisar(mensagemDeErro(r.error));
    aoMudar();
  };
  const enviarVideo = async (arquivo) => {
    if (!arquivo) return;
    setEnviando(true);
    const r = await uploadMidiaTreinamento({ unidadeId: unidadeAtiva, arquivo, tipo: "videos" });
    setEnviando(false);
    if (r.error) return avisar(`Não foi possível enviar o vídeo: ${r.error}`);
    setF({ ...f, video_url: r.data });
    avisar("Vídeo enviado. Salve a aula para confirmar.");
  };
  const novaQuestao = async (tipo) => {
    const r = await criarQuestao(aula.id, tipo, { enunciado: tipo === "situacao" ? "Nova situação" : "Nova pergunta", opcoes: ["Opção certa", "Opção errada"], correta: 0, explicacao: "" });
    if (r.error) return avisar(mensagemDeErro(r.error));
    aoMudar();
  };
  return (
    <details className="group rounded-xl border border-hf-border bg-hf-surface">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 p-3 text-sm font-bold text-hf-text">
        <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden />
        <span className="min-w-0 flex-1">{aula.titulo}</span>
        {marcada && <span className="rounded-lg bg-hf-warning/10 px-2 py-1 text-xs font-bold text-hf-warning">Preencher</span>}
      </summary>
      <div className="space-y-3 border-t border-hf-border p-3">
        <label className="block text-xs font-bold text-hf-text-2">Título<input disabled={!podeEditar} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} className={`${CAMPO} mt-1 min-h-11 p-2`} /></label>
        <label className="block text-xs font-bold text-hf-text-2">Conteúdo da aula<textarea disabled={!podeEditar} rows={10} value={f.conteudo} onChange={(e) => setF({ ...f, conteudo: e.target.value })} className={`${CAMPO} mt-1 resize-y p-2`} /></label>
        {aula.cenas && f.conteudo !== aula.conteudo && <p className="text-xs font-semibold text-hf-warning">Ao salvar o texto novo, as falas salvas voltam para o padrão. Gere as falas de novo depois.</p>}
        {aula.fontes && <p className="text-xs font-medium text-hf-text-2">Fonte: {aula.fontes}</p>}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_120px]">
          <label className="block text-xs font-bold text-hf-text-2">Vídeo da casa (link https)<input disabled={!podeEditar} value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} className={`${CAMPO} mt-1 min-h-11 p-2`} /></label>
          {podeEditar && <label className={`${BOTAO} cursor-pointer self-end`}><Upload size={16} /> {enviando ? "Enviando..." : "Enviar vídeo"}<input type="file" accept="video/*" className="hidden" onChange={(e) => enviarVideo(e.target.files?.[0])} /></label>}
          <label className="block text-xs font-bold text-hf-text-2">Minutos<input type="number" min="1" max="240" disabled={!podeEditar} value={f.duracao_minutos} onChange={(e) => setF({ ...f, duracao_minutos: e.target.value })} className={`${CAMPO} mt-1 min-h-11 p-2`} /></label>
        </div>
        {podeEditar && <div className="flex gap-2"><button onClick={salvar} className={PRINCIPAL}>Salvar aula</button>{modulo.status === "rascunho" && <button onClick={remover} className={BOTAO}><Trash2 size={16} /> Remover</button>}</div>}

        <EditorDeFalas key={`${aula.id}-${aula.updated_at}`} aula={{ ...aula, __area: modulo.area }} podeEditar={podeEditar} aoMudar={aoMudar} avisar={avisar} />

        <h4 className="text-sm font-black text-hf-text">Prova e situações</h4>
        <ul className="space-y-2">{questoes.map((q) => <EditorDeQuestao key={q.id} questao={q} gabarito={gabarito[q.id]} podeEditar={podeEditar} rascunho={modulo.status === "rascunho"} aoMudar={aoMudar} avisar={avisar} />)}</ul>
        {podeEditar && <div className="flex gap-2"><button onClick={() => novaQuestao("prova")} className={BOTAO}><Plus size={16} /> Pergunta</button><button onClick={() => novaQuestao("situacao")} className={BOTAO}><Plus size={16} /> Situação</button></div>}
      </div>
    </details>
  );
}

export default function EstudioPage() {
  const { sessao, unidadeAtiva } = useERP();
  const [d, setD] = useState(null);
  const [fichas, setFichas] = useState(null);
  const [gabarito, setGabarito] = useState({});
  const [moduloId, setModuloId] = useState("");
  const [aviso, setAviso] = useState("");
  const [novo, setNovo] = useState({ area: "salao", titulo: "" });
  const [titulo, setTitulo] = useState({ titulo: "", descricao: "" });

  const livre = !sessao?.gerenciado && !sessao?.is_app;
  const podeEditar = !!sessao && (livre || hasPermission(sessao, "treinamento.content.edit"));
  const podeAprovar = !!sessao && (livre || hasPermission(sessao, "treinamento.content.approve"));

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    const r = await fetchEstudio(unidadeAtiva);
    if (r.error) setAviso(mensagemDeErro(r.error));
    setD(r);
  }, [unidadeAtiva]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (unidadeAtiva && unidadeAtiva !== "todas") fetchPratos(unidadeAtiva).then(setFichas); }, [unidadeAtiva]);

  const modulo = d?.modulos.find((m) => m.id === moduloId);
  useEffect(() => {
    if (!modulo) return;
    setTitulo({ titulo: modulo.titulo, descricao: modulo.descricao });
    if (modulo.tipo === "aulas") fetchGabarito(modulo.id).then((r) => setGabarito(Object.fromEntries((r.data || []).map((g) => [g.questao_id, g]))));
  }, [modulo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = useMemo(() => Object.entries(AREAS_TREINAMENTO).map(([area, rotulo]) => ({ area, rotulo, itens: (d?.modulos || []).filter((m) => m.area === area) })), [d]);
  const pendencias = useMemo(() => (fichas ? pendenciasDeFichas(fichas.fichas, fichas.guias) : null), [fichas]);
  const aulas = (d?.aulas || []).filter((a) => a.modulo_id === moduloId);

  const acao = async (fn, sucesso) => {
    const r = await fn();
    if (r.error) return setAviso(mensagemDeErro(r.error));
    if (sucesso) setAviso(sucesso);
    carregar();
  };
  const criar = async (ev) => {
    ev.preventDefault();
    const r = await criarModulo(unidadeAtiva, novo.area, novo.titulo, "");
    if (r.error) return setAviso(mensagemDeErro(r.error));
    setNovo({ ...novo, titulo: "" });
    await carregar();
    setModuloId(r.data);
  };
  const novaAula = async () => {
    const r = await criarAula(moduloId, "Nova aula", "Escreva aqui o que deve ser ensinado.");
    if (r.error) return setAviso(mensagemDeErro(r.error));
    carregar();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
      <CabecalhoTela embutido voltarPara="/dashboard/treinamento" titulo="Héfisto Estúdio" subtitulo="Crie e edite aulas, falas dos bonecos, provas e situações. A equipe só vê o que você aprovar." />
      {aviso && <p role="status" className="rounded-xl border border-hf-border bg-hf-elevated p-3 text-sm font-semibold text-hf-text">{aviso}</p>}
      {(!unidadeAtiva || unidadeAtiva === "todas") && <p className="text-sm font-semibold text-hf-text">Escolha uma unidade.</p>}

      {!modulo && (
        <>
          {pendencias && (
            <section className="rounded-2xl border border-hf-warning/40 bg-hf-warning/10 p-4">
              <h2 className="flex items-center gap-2 text-base font-black text-hf-text"><TriangleAlert size={18} className="text-hf-warning" aria-hidden /> O que falta nas fichas</h2>
              <p className="mt-1 text-sm font-medium text-hf-text">O boneco ensina o que está na ficha. Complete as fichas para ele ensinar o passo a passo.</p>
              <ul className="mt-2 grid gap-1 text-sm font-semibold text-hf-text sm:grid-cols-2">
                <li>Cozinha: {pendencias.cozinha.semPreparo.length} de {pendencias.cozinha.preparar} sem modo de preparo</li>
                <li>Cozinha: {pendencias.cozinha.semMontagem.length} de {pendencias.cozinha.montar} sem montagem completa</li>
                <li>Bar: {pendencias.bar.semPreparo.length} de {pendencias.bar.preparar} bases sem preparo</li>
                <li>Bar: {pendencias.bar.semMontagem.length} de {pendencias.bar.montar} drinks sem montagem completa</li>
              </ul>
            </section>
          )}
          {podeEditar && (
            <form onSubmit={criar} className="grid gap-2 rounded-2xl border border-hf-border bg-hf-surface p-4 sm:grid-cols-[160px_1fr_auto]">
              <label className="text-xs font-bold text-hf-text-2">Área
                <select value={novo.area} onChange={(e) => setNovo({ ...novo, area: e.target.value })} className={`${CAMPO} mt-1 min-h-11 p-2`}>
                  {Object.entries(AREAS_TREINAMENTO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-hf-text-2">Novo módulo<input required value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} placeholder="Ex.: Como montar o menu degustação" className={`${CAMPO} mt-1 min-h-11 p-2`} /></label>
              <button className={`${PRINCIPAL} self-end`}><Plus size={17} /> Criar</button>
            </form>
          )}
          {grupos.map(({ area, rotulo, itens }) => itens.length > 0 && (
            <section key={area}>
              <h2 className="mb-2 text-base font-black text-hf-text">{rotulo}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {itens.map((m) => {
                  const dele = d.aulas.filter((a) => a.modulo_id === m.id);
                  const preencher = dele.some((a) => temPreencher(a.conteudo));
                  return (
                    <li key={m.id}>
                      <button onClick={() => setModuloId(m.id)} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-hf-border bg-hf-surface p-3 text-left hover:border-hf-accent">
                        {m.status === "aprovado" ? <CheckCircle2 size={20} className="shrink-0 text-hf-success" aria-label="Aprovado" /> : <span className="h-5 w-5 shrink-0 rounded-full border-2 border-hf-border" aria-label="Rascunho" />}
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-hf-text">{m.titulo}</span><span className="block text-xs font-medium text-hf-text-2">{m.tipo === "pratos" ? "Vem das fichas técnicas" : `${dele.length} aulas · ${m.status === "aprovado" ? "Aprovado" : "Rascunho"}`}{preencher ? " · Falta preencher" : ""}</span></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {d && !d.modulos.length && !aviso && <p className="rounded-xl border border-dashed border-hf-border p-6 text-center text-sm font-medium text-hf-text-2">Nenhum conteúdo carregado.</p>}
        </>
      )}

      {modulo && (
        <section className="space-y-4">
          <button onClick={() => setModuloId("")} className="flex min-h-11 items-center gap-2 text-sm font-bold text-hf-text"><ArrowLeft size={18} /> Todos os módulos</button>
          <div className="grid gap-2 rounded-2xl border border-hf-border bg-hf-surface p-4">
            <label className="text-xs font-bold text-hf-text-2">Nome do módulo<input disabled={!podeEditar} value={titulo.titulo} onChange={(e) => setTitulo({ ...titulo, titulo: e.target.value })} className={`${CAMPO} mt-1 min-h-11 p-2`} /></label>
            <label className="text-xs font-bold text-hf-text-2">Descrição<input disabled={!podeEditar} value={titulo.descricao} onChange={(e) => setTitulo({ ...titulo, descricao: e.target.value })} className={`${CAMPO} mt-1 min-h-11 p-2`} /></label>
            <div className="flex flex-wrap gap-2">
              {podeEditar && <button onClick={() => acao(() => salvarModulo(modulo.id, titulo.titulo, titulo.descricao), "Módulo salvo.")} className={BOTAO}>Salvar</button>}
              {podeAprovar && modulo.tipo === "aulas" && (modulo.status === "rascunho"
                ? <button onClick={() => acao(() => aprovarModulo(modulo.id, true), "Módulo aprovado. A equipe já pode ver.")} className={PRINCIPAL}><CheckCircle2 size={17} /> Aprovar para a equipe</button>
                : <button onClick={() => acao(() => aprovarModulo(modulo.id, false), "Módulo voltou para rascunho.")} className={BOTAO}>Voltar para rascunho</button>)}
            </div>
          </div>
          <fieldset className="rounded-2xl border border-hf-border bg-hf-surface p-4">
            <legend className="px-1 text-sm font-black text-hf-text">Trilhas que usam este módulo</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {d.trilhas.map((t) => (
                <label key={t.id} className="flex min-h-11 items-center gap-2 text-sm font-semibold text-hf-text">
                  <input type="checkbox" disabled={!podeEditar} className="h-5 w-5 accent-hf-accent" checked={d.ligacoes.some((l) => l.trilha_id === t.id && l.modulo_id === modulo.id)} onChange={(e) => acao(() => ligarModulo(modulo.id, t.id, e.target.checked))} />
                  {t.nome}
                </label>
              ))}
            </div>
          </fieldset>
          {modulo.tipo === "pratos" ? (
            <p className="rounded-xl border border-hf-border bg-hf-elevated p-4 text-sm font-semibold text-hf-text">Este módulo mostra as fichas técnicas reais. Para mudar o conteúdo, edite a ficha do prato.</p>
          ) : (
            <>
              {aulas.map((a) => <EditorDeAula key={`${a.id}-${a.updated_at}`} aula={a} modulo={modulo} questoes={d.questoes.filter((q) => q.aula_id === a.id)} gabarito={gabarito} podeEditar={podeEditar} aoMudar={carregar} avisar={setAviso} />)}
              {podeEditar && <button onClick={novaAula} className={BOTAO}><Plus size={17} /> Nova aula</button>}
            </>
          )}
        </section>
      )}
    </div>
  );
}
