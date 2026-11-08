"use client";

// INTELIGÊNCIA > PROCEDIMENTOS DA CASA (pedido do dono, 08/11/2026): o jeito do
// Seldeestrela de montar a mesa, montar o jardim, resolver uma reclamação…
// O Assistente Héfisto ensina por aqui. Sem procedimento, ele dá a orientação
// padrão, marcada como sugestão. Os modelos prontos são rascunhos: só valem
// depois que alguém ajusta e salva.
// Gravação na Operação Inteligente (op_processos, categoria "procedimento"), com RLS por unidade.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plus, ChevronRight, Archive } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import { canAccessRoute, hasPermission } from "../../../lib/permissions-catalog.mjs";
import { AREAS, MODELOS, modeloPorNome, validarProcedimento } from "../../../lib/procedimentos.mjs";
import { listarProcedimentos, salvarProcedimento, arquivarProcedimento } from "../../../lib/procedimentos-dados";

const PILULA = "inline-flex min-h-[44px] shrink-0 items-center rounded-full px-4 text-[14px] font-semibold";
const BOTAO = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-hf-menu px-4 text-[15px] font-semibold text-white disabled:opacity-50";
const BOTAO_2 = "inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-4 text-[15px] font-semibold text-hf-text";
const CAMPO = "mt-1 w-full rounded-xl border border-hf-border bg-hf-surface px-3 py-2.5 text-[16px] text-hf-text outline-none focus:ring-2 focus:ring-hf-accent";
const vazio = (area = "salao") => ({ nome: "", quando: "", area, passos: "", gerente: "" });
const paraForm = (p) => ({ ...p, passos: (p.passos || []).join("\n"), gerente: (p.gerente || []).join("\n") });

function Editor({ inicial, podeEditar, salvando, erro, onSalvar, onCancelar, onArquivar }) {
  const [f, setF] = useState(inicial);
  const [erros, setErros] = useState({});
  const mudar = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const salvar = () => {
    const e = validarProcedimento(f);
    setErros(e);
    if (!Object.keys(e).length) onSalvar(f);
  };
  return (
    <section className="space-y-4 rounded-2xl border border-hf-border bg-hf-surface p-4" aria-label="Editar procedimento">
      <label className="block">
        <span className="text-[13px] font-medium text-hf-muted">Nome</span>
        <input className={CAMPO} value={f.nome} onChange={mudar("nome")} disabled={!podeEditar} placeholder="Ex.: Montar a mesa" maxLength={120} />
        {erros.nome && <span className="mt-1 block text-[13px] text-hf-danger">{erros.nome}</span>}
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-hf-muted">Quando usar</span>
        <input className={CAMPO} value={f.quando} onChange={mudar("quando")} disabled={!podeEditar} placeholder="Ex.: Antes de abrir e a cada mesa liberada" maxLength={500} />
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-hf-muted">Área</span>
        <select className={CAMPO} value={f.area} onChange={mudar("area")} disabled={!podeEditar}>
          {AREAS.map((a) => <option key={a.id} value={a.id}>{a.rotulo}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-hf-muted">Passo a passo (um por linha, na ordem)</span>
        <textarea className={`${CAMPO} min-h-[200px] leading-relaxed`} value={f.passos} onChange={mudar("passos")} disabled={!podeEditar} />
        {erros.passos && <span className="mt-1 block text-[13px] text-hf-danger">{erros.passos}</span>}
      </label>
      <label className="block">
        <span className="text-[13px] font-medium text-hf-muted">Chame o gerente quando (opcional, um por linha)</span>
        <textarea className={`${CAMPO} min-h-[90px]`} value={f.gerente} onChange={mudar("gerente")} disabled={!podeEditar} />
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
  const [area, setArea] = useState("salao");
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async () => {
    if (semUnidade) return;
    const r = await listarProcedimentos(unidadeAtiva);
    setErro(r.error || null);
    setLista(r.data || []);
  }, [unidadeAtiva, semUnidade]);
  useEffect(() => { setLista(null); carregar(); }, [carregar]);

  // vindo do Assistente: "Cadastrar o jeito da casa" já abre com o nome (e o modelo, se houver)
  useEffect(() => {
    const novo = params?.get("novo");
    if (!novo || !lista) return;
    const ja = lista.find((p) => p.nome.toLowerCase() === novo.toLowerCase());
    const modelo = modeloPorNome(novo);
    setEditando(ja ? paraForm(ja) : modelo ? paraForm(modelo) : { ...vazio(), nome: novo.slice(0, 120) });
    setArea((ja || modelo)?.area || "salao");
  }, [params, lista]);

  const daArea = useMemo(() => (lista || []).filter((p) => p.area === area), [lista, area]);
  const modelosLivres = useMemo(() => MODELOS.filter((m) => m.area === area && !(lista || []).some((p) => p.nome.toLowerCase() === m.nome.toLowerCase())), [lista, area]);

  const salvar = async (f) => {
    setSalvando(true); setErro(null);
    const r = await salvarProcedimento(unidadeAtiva, f);
    setSalvando(false);
    if (r.error) { setErro(`Não consegui salvar: ${r.error}`); return; }
    setEditando(null); setAviso(`"${f.nome}" salvo. O Assistente já ensina desse jeito.`);
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
      <CabecalhoTela embutido voltar="historico" titulo="Procedimentos da casa" subtitulo="O Assistente Héfisto ensina a equipe do jeito da casa. Sem procedimento, ele dá a orientação padrão, marcada como sugestão." />

      <nav className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label="Áreas">
        {AREAS.map((a) => (
          <button key={a.id} type="button" onClick={() => { setArea(a.id); setEditando(null); }}
            className={`${PILULA} ${area === a.id ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text"}`}>{a.rotulo}</button>
        ))}
      </nav>

      {aviso && <p className="mt-4 rounded-xl bg-hf-success/10 px-3 py-2 text-[14px] text-hf-success" role="status">{aviso}</p>}
      {erro && !editando && <p className="mt-4 rounded-xl bg-hf-danger/10 px-3 py-2 text-[14px] text-hf-danger">{erro}</p>}

      <div className="mt-4 space-y-4">
        {editando ? (
          <Editor key={editando.id || editando.nome || "novo"} inicial={editando} podeEditar={podeEditar} salvando={salvando} erro={erro}
            onSalvar={salvar} onCancelar={() => { setEditando(null); setErro(null); }} onArquivar={arquivar} />
        ) : (
          <>
            {podeEditar && (
              <button type="button" className={`${BOTAO} w-full sm:w-auto`} onClick={() => { setAviso(null); setEditando(vazio(area)); }}>
                <Plus size={18} /> Novo procedimento
              </button>
            )}
            <section>
              <h2 className="text-[13px] font-medium text-hf-muted">Do jeito da casa ({lista ? daArea.length : "…"})</h2>
              {!lista ? <p className="mt-2 flex items-center gap-2 text-[14px] text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando…</p> : null}
              {lista && !daArea.length ? <p className="mt-2 text-[14px] text-hf-muted">Nenhum procedimento cadastrado nesta área ainda.</p> : null}
              <ul className="mt-2 space-y-2">
                {daArea.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => { setAviso(null); setEditando(paraForm(p)); }}
                      className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-hf-border bg-hf-surface px-4 py-3 text-left">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-semibold text-hf-text">{p.nome}</span>
                        <span className="block truncate text-[13px] text-hf-muted">{p.passos.length} passo{p.passos.length === 1 ? "" : "s"}{p.quando ? ` · ${p.quando}` : ""}</span>
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
                <p className="mt-1 text-[13px] text-hf-muted">Rascunhos com o padrão de mercado. Ajuste ao jeito da casa e salve; até lá, o Assistente responde com a orientação padrão.</p>
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
