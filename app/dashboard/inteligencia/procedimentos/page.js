"use client";

// INTELIGÊNCIA > PROCEDIMENTOS DA CASA (pedido do dono, 08/11/2026 e 14/11/2026):
// o jeito do Seldeestrela de resolver uma situação, abrir e fechar a casa,
// limpar a chapa, o fogão e o piso, e usar cada equipamento (voltagem, onde
// fica, como higienizar), com fotos e vídeos em cada passo. O Nico ensina por
// aqui. Sem procedimento, ele dá a orientação padrão, marcada como sugestão.
// Os modelos prontos são rascunhos: só valem depois que alguém ajusta e salva.
// Gravação na Operação Inteligente (op_processos, categoria "procedimento"), com RLS por unidade.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, ChevronRight, Archive, ArrowUp, ArrowDown, Trash2, Camera, Link2, X, Zap, MapPin, PlayCircle } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import { canAccessRoute, hasPermission } from "../../../lib/permissions-catalog.mjs";
import { AREAS, MODELOS, TIPOS_PROCEDIMENTO, VOLTAGENS, modeloPorNome, validarProcedimento, limparEtapas } from "../../../lib/procedimentos.mjs";
import { listarProcedimentos, salvarProcedimento, arquivarProcedimento, enviarMidiaProcedimento } from "../../../lib/procedimentos-dados";

const PILULA = "inline-flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-[14px] font-semibold";
const BOTAO = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-hf-menu px-4 text-[15px] font-semibold text-white disabled:opacity-50";
const BOTAO_2 = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-4 text-[15px] font-semibold text-hf-text";
const BOTAO_P = "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-hf-border bg-hf-surface px-3 text-[14px] font-semibold text-hf-text";
const CAMPO = "mt-1 w-full rounded-xl border border-hf-border bg-hf-surface px-3 py-2.5 text-[16px] text-hf-text outline-none focus:ring-2 focus:ring-hf-accent";
const ROTULO = "text-[13px] font-medium text-hf-muted";

const tipoDoModelo = (m) => m.tipo || "resolver";
const vazio = (tipo = "resolver") => ({ nome: "", quando: "", tipo, area: tipo === "limpeza" || tipo === "equipamento" ? "cozinha" : "salao", passos: [{ texto: "" }], gerente: "", equipamento: {}, midias: [], apelidos: "" });
const paraForm = (p) => ({
  ...p,
  tipo: tipoDoModelo(p),
  passos: limparEtapas(p.etapas || p.passos || []).length ? limparEtapas(p.etapas || p.passos) : [{ texto: "" }],
  gerente: (p.gerente || []).join("\n"),
  equipamento: { ...(p.equipamento || {}) },
  midias: [...(p.midias || [])],
  apelidos: (p.apelidos || []).join(", "),
});

function Midias({ lista = [], onMudar, unidadeId, podeEditar, rotulo = "Foto ou vídeo" }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [link, setLink] = useState(null);
  async function escolher(e) {
    const arq = e.target.files?.[0];
    e.target.value = "";
    if (!arq) return;
    setEnviando(true); setErro("");
    const r = await enviarMidiaProcedimento(unidadeId, arq);
    setEnviando(false);
    if (r.error) setErro(r.error); else onMudar([...lista, r.midia]);
  }
  function colar() {
    const u = String(link || "").trim();
    if (!/^https:\/\//i.test(u)) { setErro("Cole um link que comece com https://"); return; }
    onMudar([...lista, { tipo: /\.(jpe?g|png|webp)(\?|$)/i.test(u) ? "foto" : "link", url: u }]);
    setLink(null); setErro("");
  }
  return (
    <div>
      {lista.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {lista.map((m, i) => (
            <div key={`${m.url}-${i}`} className="relative h-20 w-24 overflow-hidden rounded-xl border border-hf-border bg-hf-elevated">
              {m.tipo === "foto" ? <img src={m.url} alt="" className="h-full w-full object-cover" />
                : m.tipo === "video" ? <video src={m.url} preload="metadata" muted className="h-full w-full object-cover" />
                : <span className="flex h-full items-center justify-center p-1 text-center text-[11px] text-hf-text-2"><Link2 size={14} /> link</span>}
              {m.tipo === "video" && <PlayCircle size={22} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />}
              {podeEditar && (
                <button type="button" aria-label="Tirar" onClick={() => onMudar(lista.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"><X size={14} /></button>
              )}
            </div>
          ))}
        </div>
      )}
      {podeEditar && (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={`${BOTAO_P} cursor-pointer ${enviando ? "pointer-events-none opacity-50" : ""}`}>
            {enviando ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {enviando ? "Enviando…" : rotulo}
            <input type="file" accept="image/*,video/*" hidden onChange={escolher} />
          </label>
          {link === null
            ? <button type="button" className={BOTAO_P} onClick={() => setLink("")}><Link2 size={15} /> Colar link</button>
            : <span className="flex w-full gap-2"><input className={CAMPO + " !mt-0"} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" /><button type="button" className={BOTAO_P} onClick={colar}>Pôr</button></span>}
        </div>
      )}
      {erro && <p className="mt-1 text-[13px] text-hf-danger">{erro}</p>}
    </div>
  );
}

function Passo({ etapa, i, total, outros, unidadeId, podeEditar, onMudar, onMover, onTirar }) {
  const [aberto, setAberto] = useState(Boolean(etapa.detalhe || etapa.produto || etapa.quantidade || etapa.midias?.length || etapa.abreNome));
  const set = (k, v) => onMudar({ ...etapa, [k]: v });
  return (
    <li className="rounded-2xl border border-hf-border bg-hf-surface p-3">
      <div className="flex items-start gap-2">
        <span className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-hf-menu text-[13px] font-semibold text-white">{i + 1}</span>
        <textarea className={`${CAMPO} !mt-0 min-h-[52px]`} value={etapa.texto} onChange={(e) => set("texto", e.target.value)} disabled={!podeEditar}
          placeholder="Ex.: Tirar as grelhas e as bocas do fogão" aria-label={`Passo ${i + 1}`} />
      </div>
      {podeEditar && (
        <div className="mt-2 flex flex-wrap gap-2 pl-9">
          <button type="button" className={BOTAO_P} onClick={() => setAberto(!aberto)}>{aberto ? "Menos" : "Produto, quantidade, foto, vídeo"}</button>
          <button type="button" className={BOTAO_P} aria-label="Subir" disabled={i === 0} onClick={() => onMover(-1)}><ArrowUp size={15} /></button>
          <button type="button" className={BOTAO_P} aria-label="Descer" disabled={i === total - 1} onClick={() => onMover(1)}><ArrowDown size={15} /></button>
          <button type="button" className={`${BOTAO_P} text-hf-danger`} aria-label="Tirar passo" onClick={onTirar}><Trash2 size={15} /></button>
        </div>
      )}
      {aberto && (
        <div className="mt-3 space-y-3 pl-9">
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className={ROTULO}>Produto</span>
              <input className={CAMPO} value={etapa.produto || ""} onChange={(e) => set("produto", e.target.value)} disabled={!podeEditar} placeholder="Ex.: Desengordurante" /></label>
            <label className="block"><span className={ROTULO}>Quanto</span>
              <input className={CAMPO} value={etapa.quantidade || ""} onChange={(e) => set("quantidade", e.target.value)} disabled={!podeEditar} placeholder="Ex.: 50 ml em 1 L de água" /></label>
          </div>
          <label className="block"><span className={ROTULO}>Como fazer (detalhe)</span>
            <textarea className={`${CAMPO} min-h-[60px]`} value={etapa.detalhe || ""} onChange={(e) => set("detalhe", e.target.value)} disabled={!podeEditar} /></label>
          {outros.length > 0 && (
            <label className="block"><span className={ROTULO}>Este passo tem passo a passo próprio?</span>
              <select className={CAMPO} value={etapa.abreNome || ""} onChange={(e) => onMudar({ ...etapa, abreNome: e.target.value, abreId: outros.find((o) => o.nome === e.target.value)?.id || undefined })} disabled={!podeEditar}>
                <option value="">Não</option>
                {outros.map((o) => <option key={o.id || o.nome} value={o.nome}>Abrir: {o.nome}</option>)}
              </select></label>
          )}
          <Midias lista={etapa.midias || []} onMudar={(m) => set("midias", m)} unidadeId={unidadeId} podeEditar={podeEditar} />
        </div>
      )}
    </li>
  );
}

function Editor({ inicial, outros, unidadeId, podeEditar, salvando, erro, onSalvar, onCancelar, onArquivar }) {
  const [f, setF] = useState(inicial);
  const [erros, setErros] = useState({});
  const mudar = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const setPassos = (fn) => setF((x) => ({ ...x, passos: fn(x.passos) }));
  const salvar = () => {
    const e = validarProcedimento(f);
    setErros(e);
    if (!Object.keys(e).length) onSalvar(f);
  };
  const outrosSemEste = outros.filter((o) => o.nome !== f.nome);
  return (
    <section className="space-y-4 rounded-2xl border border-hf-border bg-hf-surface p-4" aria-label="Editar procedimento">
      <div>
        <span className={ROTULO}>Tipo</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {TIPOS_PROCEDIMENTO.map((t) => (
            <button key={t.id} type="button" disabled={!podeEditar} onClick={() => setF((x) => ({ ...x, tipo: t.id }))}
              className={`${PILULA} ${f.tipo === t.id ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text"}`}>{t.rotulo}</button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className={ROTULO}>Nome</span>
        <input className={CAMPO} value={f.nome} onChange={mudar("nome")} disabled={!podeEditar} placeholder={f.tipo === "equipamento" ? "Ex.: Liquidificador" : f.tipo === "limpeza" ? "Ex.: Limpeza da chapa" : f.tipo === "rotina" ? "Ex.: Fechamento do restaurante" : "Ex.: Montar a mesa"} maxLength={120} />
        {erros.nome && <span className="mt-1 block text-[13px] text-hf-danger">{erros.nome}</span>}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={ROTULO}>Quando usar</span>
          <input className={CAMPO} value={f.quando} onChange={mudar("quando")} disabled={!podeEditar} placeholder="Ex.: No fechamento" maxLength={500} />
        </label>
        <label className="block">
          <span className={ROTULO}>Área</span>
          <select className={CAMPO} value={f.area} onChange={mudar("area")} disabled={!podeEditar}>
            {AREAS.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
          </select>
        </label>
      </div>

      {f.tipo === "equipamento" && (
        <div className="space-y-3 rounded-2xl bg-hf-elevated p-3">
          <div>
            <span className={`${ROTULO} inline-flex items-center gap-1`}><Zap size={14} /> Voltagem</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {VOLTAGENS.map((v) => (
                <button key={v} type="button" disabled={!podeEditar} onClick={() => setF((x) => ({ ...x, equipamento: { ...x.equipamento, voltagem: v } }))}
                  className={`${PILULA} ${f.equipamento?.voltagem === v ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text"}`}>{v}</button>
              ))}
            </div>
          </div>
          <label className="block"><span className={`${ROTULO} inline-flex items-center gap-1`}><MapPin size={14} /> Onde fica guardado</span>
            <input className={CAMPO} value={f.equipamento?.local || ""} onChange={(e) => setF((x) => ({ ...x, equipamento: { ...x.equipamento, local: e.target.value } }))} disabled={!podeEditar} placeholder="Ex.: Prateleira de cima, ao lado da pia" /></label>
          <label className="block"><span className={ROTULO}>Cuidados</span>
            <input className={CAMPO} value={f.equipamento?.cuidados || ""} onChange={(e) => setF((x) => ({ ...x, equipamento: { ...x.equipamento, cuidados: e.target.value } }))} disabled={!podeEditar} /></label>
        </div>
      )}

      <div>
        <span className={ROTULO}>Foto ou vídeo geral (opcional)</span>
        <Midias lista={f.midias} onMudar={(m) => setF((x) => ({ ...x, midias: m }))} unidadeId={unidadeId} podeEditar={podeEditar} rotulo="Filmar ou escolher" />
      </div>

      <div>
        <span className={ROTULO}>Passo a passo, na ordem</span>
        {erros.passos && <span className="mt-1 block text-[13px] text-hf-danger">{erros.passos}</span>}
        <ol className="mt-2 space-y-2">
          {f.passos.map((etapa, i) => (
            <Passo key={i} etapa={etapa} i={i} total={f.passos.length} outros={outrosSemEste} unidadeId={unidadeId} podeEditar={podeEditar}
              onMudar={(e) => setPassos((ps) => ps.map((p, j) => (j === i ? e : p)))}
              onMover={(d) => setPassos((ps) => { const n = [...ps]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); return n; })}
              onTirar={() => setPassos((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : [{ texto: "" }]))} />
          ))}
        </ol>
        {podeEditar && <button type="button" className={`${BOTAO_2} mt-2 w-full`} onClick={() => setPassos((ps) => [...ps, { texto: "" }])}><Plus size={16} /> Mais um passo</button>}
      </div>

      <label className="block">
        <span className={ROTULO}>Chame o gerente quando (opcional, um por linha)</span>
        <textarea className={`${CAMPO} min-h-[80px]`} value={f.gerente} onChange={mudar("gerente")} disabled={!podeEditar} />
      </label>
      <label className="block">
        <span className={ROTULO}>Como a equipe chama isso (opcional, separado por vírgula)</span>
        <input className={CAMPO} value={f.apelidos} onChange={mudar("apelidos")} disabled={!podeEditar} placeholder="Ex.: fechar, fechamento, ir embora" />
      </label>
      {erro && <p className="rounded-xl bg-hf-danger/10 px-3 py-2 text-[14px] text-hf-danger">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        {podeEditar && <button type="button" className={BOTAO} disabled={salvando} onClick={salvar}>{salvando ? <Loader2 size={16} className="animate-spin" /> : null} Salvar</button>}
        <button type="button" className={BOTAO_2} onClick={onCancelar}>{podeEditar ? "Cancelar" : "Fechar"}</button>
        {podeEditar && f.id && <button type="button" className={`${BOTAO_2} ml-auto text-hf-danger`} onClick={() => onArquivar(f.id)}><Archive size={16} /> Arquivar</button>}
      </div>
    </section>
  );
}

function Conteudo() {
  const { unidadeAtiva, sessao } = useERP() || {};
  const params = useSearchParams();
  const semUnidade = !unidadeAtiva || unidadeAtiva === "todas";
  const podeEditar = !sessao?.gerenciado || hasPermission(sessao, "dashboard.intelligence.settings") || canAccessRoute(sessao, "/dashboard/operacao/inteligente");
  const [tipo, setTipo] = useState("resolver");
  const [lista, setLista] = useState(null);
  const [comConteudo, setComConteudo] = useState(true);
  const [erro, setErro] = useState(null);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async () => {
    if (semUnidade) return;
    const r = await listarProcedimentos(unidadeAtiva);
    setErro(r.error || null);
    setLista(r.data || []);
    if (r.comConteudo === false) setComConteudo(false);
  }, [unidadeAtiva, semUnidade]);
  useEffect(() => { setLista(null); carregar(); }, [carregar]);

  // vindo do Assistente: "Cadastrar o jeito da casa" já abre com o nome (e o modelo, se houver)
  useEffect(() => {
    const novo = params?.get("novo");
    if (!novo || !lista) return;
    const ja = lista.find((p) => p.nome.toLowerCase() === novo.toLowerCase());
    const modelo = modeloPorNome(novo);
    setEditando(ja ? paraForm(ja) : modelo ? paraForm(modelo) : { ...vazio(), nome: novo.slice(0, 120) });
    setTipo(tipoDoModelo(ja || modelo || {}));
  }, [params, lista]);

  const doTipo = useMemo(() => (lista || []).filter((p) => (p.tipo || "resolver") === tipo), [lista, tipo]);
  const modelosLivres = useMemo(() => MODELOS.filter((m) => tipoDoModelo(m) === tipo && !(lista || []).some((p) => p.nome.toLowerCase() === m.nome.toLowerCase())), [lista, tipo]);
  // Um passo pode abrir outro procedimento: os da casa e os modelos ainda não salvos (pelo nome).
  const outros = useMemo(() => [...(lista || []), ...MODELOS.filter((m) => !(lista || []).some((p) => p.nome.toLowerCase() === m.nome.toLowerCase()))]
    .map((p) => ({ id: p.id, nome: p.nome })), [lista]);

  const salvar = async (f) => {
    setSalvando(true); setErro(null);
    const r = await salvarProcedimento(unidadeAtiva, f);
    setSalvando(false);
    if (r.error) { setErro(`Não consegui salvar: ${r.error}`); return; }
    setEditando(null); setAviso(`"${f.nome}" salvo. O Nico já ensina desse jeito.`);
    carregar();
  };
  const arquivar = async (id) => {
    const r = await arquivarProcedimento(id);
    if (r.error) { setErro(`Não consegui arquivar: ${r.error}`); return; }
    setEditando(null); setAviso("Procedimento arquivado."); carregar();
  };

  if (semUnidade) return <p className="mx-auto max-w-md px-4 py-10 text-[15px] text-hf-text-2">Selecione uma unidade para ver os procedimentos.</p>;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:px-6">
      <CabecalhoTela embutido voltar="historico" titulo="Procedimentos da casa" subtitulo="O Nico ensina a equipe do jeito da casa, com fotos e vídeos. Sem procedimento, ele dá a orientação padrão, marcada como sugestão." />

      <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Tipos">
        {TIPOS_PROCEDIMENTO.map((t) => (
          <button key={t.id} type="button" onClick={() => { setTipo(t.id); setEditando(null); }}
            className={`${PILULA} ${tipo === t.id ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text"}`}>{t.plural}</button>
        ))}
      </nav>

      {!comConteudo && <p className="mt-4 rounded-xl bg-hf-warning/10 px-3 py-2 text-[14px] text-hf-warning">Este banco ainda não guarda fotos, vídeos e tipo de procedimento (migração OP-CONTEUDO-1). Os procedimentos só com texto continuam funcionando.</p>}
      {aviso && <p className="mt-4 rounded-xl bg-hf-success/10 px-3 py-2 text-[14px] text-hf-success" role="status">{aviso}</p>}
      {erro && !editando && <p className="mt-4 rounded-xl bg-hf-danger/10 px-3 py-2 text-[14px] text-hf-danger">{erro}</p>}

      <div className="mt-4 space-y-4">
        {editando ? (
          <Editor key={editando.id || editando.nome || "novo"} inicial={editando} outros={outros} unidadeId={unidadeAtiva} podeEditar={podeEditar} salvando={salvando} erro={erro}
            onSalvar={salvar} onCancelar={() => { setEditando(null); setErro(null); }} onArquivar={arquivar} />
        ) : (
          <>
            {podeEditar && (
              <button type="button" className={`${BOTAO} w-full sm:w-auto`} onClick={() => { setAviso(null); setEditando(vazio(tipo)); }}>
                <Plus size={18} /> Novo: {TIPOS_PROCEDIMENTO.find((t) => t.id === tipo)?.rotulo.toLowerCase()}
              </button>
            )}
            <section>
              <h2 className="text-[13px] font-medium text-hf-muted">Do jeito da casa ({lista ? doTipo.length : "…"})</h2>
              {!lista ? <p className="mt-2 flex items-center gap-2 text-[14px] text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando…</p> : null}
              {lista && !doTipo.length ? <p className="mt-2 text-[14px] text-hf-muted">Nada cadastrado aqui ainda.</p> : null}
              <ul className="mt-2 space-y-2">
                {doTipo.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setAviso(null); setEditando(paraForm(p)); }}
                      className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-hf-border bg-hf-surface px-4 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-semibold text-hf-text">{p.nome}</span>
                        <span className="block truncate text-[13px] text-hf-muted">
                          {p.passos.length} passo{p.passos.length === 1 ? "" : "s"}
                          {p.equipamento?.voltagem ? ` · ${p.equipamento.voltagem}` : ""}
                          {(p.etapas || []).some((e) => e.midias?.length) || p.midias?.length ? " · com fotos ou vídeos" : ""}
                          {p.quando ? ` · ${p.quando}` : ""}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-hf-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
            {podeEditar && modelosLivres.length ? (
              <section>
                <h2 className="text-[13px] font-medium text-hf-muted">Modelos prontos para ajustar</h2>
                <p className="mt-1 text-[13px] text-hf-muted">Rascunhos com o padrão de mercado. Ponha o produto e a quantidade que a casa usa, filme cada passo e salve. Até lá, o Nico responde com a orientação padrão.</p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {modelosLivres.map((m) => (
                    <li key={m.nome}>
                      <button type="button" onClick={() => { setAviso(null); setEditando(paraForm(m)); }}
                        className="flex min-h-[52px] w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-hf-border bg-hf-elevated px-4 py-3 text-left text-[15px] font-semibold text-hf-text">
                        {m.nome} <span className="shrink-0 text-[13px] font-medium text-hf-muted">Usar como base</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export default function ProcedimentosDaCasa() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-hf-muted" /></div>}>
      <Conteudo />
    </Suspense>
  );
}
