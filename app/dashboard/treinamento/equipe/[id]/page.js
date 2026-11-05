"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { avaliarPratica, cancelarMatricula, concluirTrilha, fetchDetalheMatricula, fetchPratos, validarPrato } from "../../../../lib/treinamento";
import { STATUS_MATRICULA, fichasDaEtapa, mensagemDeErro } from "../../../../lib/treinamento-regras.mjs";

export default function DetalheMatriculaPage() {
  const { id } = useParams();
  const [d, setD] = useState(null);
  const [fichas, setFichas] = useState([]);
  const [moduloPratos, setModuloPratos] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetchDetalheMatricula(id);
    if (r.error) setErro(mensagemDeErro(r.error));
    setD(r);
    if (r.matricula) fetchPratos(r.matricula.unidade_id).then((p) => setFichas(p.fichas));
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const modulos = useMemo(() => (d?.ligacoes || []).map((l) => d.modulos.find((m) => m.id === l.modulo_id)).filter(Boolean), [d]);
  const provas = modulos.filter((m) => m.tipo !== "pratos");
  const pratos = modulos.filter((m) => m.tipo === "pratos");
  const selecionado = pratos.find((m) => m.id === moduloPratos) || pratos[0];
  const listaPratos = selecionado ? fichasDaEtapa(fichas, selecionado.departamento, selecionado.etapa) : [];

  const agir = async (fn) => {
    setOcupado(true); setErro("");
    const r = await fn();
    setOcupado(false);
    if (r.error) return setErro(mensagemDeErro(r.error));
    carregar();
  };

  if (!d) return <div className="mx-auto mt-8 h-64 max-w-4xl animate-pulse rounded-2xl bg-hf-elevated" aria-hidden />;
  const ativa = ["em_andamento", "aguardando_lider"].includes(d.matricula?.status);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:px-6 sm:py-8">
      <Link href="/dashboard/treinamento/equipe" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-hf-text"><ArrowLeft size={18} /> Equipe</Link>
      <header>
        <h1 className="text-2xl font-black text-hf-text">{d.trilha?.nome}</h1>
        <p className="text-sm font-semibold text-hf-text-2">{STATUS_MATRICULA[d.matricula?.status]}</p>
      </header>
      {erro && <p role="alert" className="rounded-xl border border-hf-border bg-hf-elevated p-3 text-sm font-semibold text-hf-text">{erro}</p>}

      <section>
        <h2 className="mb-2 text-base font-black text-hf-text">Provas</h2>
        <ul className="divide-y divide-hf-border rounded-xl border border-hf-border bg-hf-surface">
          {provas.map((m) => {
            const t = d.tentativas.filter((x) => x.modulo_id === m.id);
            const ok = t.find((x) => x.aprovada);
            return <li key={m.id} className="flex min-h-12 items-center gap-3 p-3 text-sm font-semibold text-hf-text">{ok ? <CheckCircle2 size={18} className="shrink-0 text-hf-success" aria-hidden /> : <Circle size={18} className="shrink-0 text-hf-text-2" aria-hidden />}<span className="min-w-0 flex-1">{m.titulo}</span><span className="text-xs text-hf-text-2">{ok ? `${ok.acertos}/${ok.total}` : t.length ? `${t.length} tentativa(s)` : m.status === "aprovado" ? "Pendente" : "Em rascunho"}</span></li>;
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-base font-black text-hf-text">Avaliação prática</h2>
        <p className="mb-2 text-sm font-medium text-hf-text-2">Marque só o que você viu a pessoa fazer sozinha e com qualidade.</p>
        <ul className="divide-y divide-hf-border rounded-xl border border-hf-border bg-hf-surface">
          {d.itens.map((i) => {
            const ok = d.avaliacoes.some((a) => a.item_id === i.id && a.aprovado);
            return (
              <li key={i.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 p-3 text-sm font-semibold text-hf-text">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-hf-accent" checked={ok} disabled={!ativa || ocupado} onChange={(e) => agir(() => avaliarPratica(id, i.id, e.target.checked))} />
                  {i.texto}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {pratos.length > 0 && (
        <section>
          <h2 className="mb-2 text-base font-black text-hf-text">Pratos e drinks</h2>
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {pratos.map((m) => <button key={m.id} onClick={() => setModuloPratos(m.id)} aria-pressed={selecionado?.id === m.id} className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm font-bold ${selecionado?.id === m.id ? "border-hf-accent bg-hf-accent/10 text-hf-text" : "border-hf-border text-hf-text-2"}`}>{m.titulo}</button>)}
          </div>
          <p className="mb-2 text-sm font-medium text-hf-text-2">{d.pratos.filter((p) => p.etapa === selecionado?.etapa).length} de {listaPratos.length} confirmados</p>
          <ul className="grid max-h-96 gap-1 overflow-y-auto rounded-xl border border-hf-border bg-hf-surface p-2 sm:grid-cols-2">
            {listaPratos.map((f) => (
              <li key={f.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg p-2 text-sm font-semibold text-hf-text hover:bg-hf-elevated">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-hf-accent" disabled={!ativa || ocupado} checked={d.pratos.some((p) => p.ficha_id === f.id && p.etapa === selecionado.etapa)} onChange={(e) => agir(() => validarPrato(id, f.id, selecionado.etapa, e.target.checked))} />
                  <span className="truncate">{f.nome_receita}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ativa && (
        <div className="flex flex-wrap gap-2">
          <button disabled={ocupado} onClick={() => agir(() => concluirTrilha(id))} className="min-h-12 flex-1 rounded-xl bg-hf-accent px-5 font-black text-hf-accent-fg disabled:opacity-60">Aprovar a trilha</button>
          <button disabled={ocupado} onClick={() => { if (window.confirm("Tirar esta pessoa da trilha? O histórico fica guardado.")) agir(() => cancelarMatricula(id)); }} className="min-h-12 rounded-xl border border-hf-border px-4 text-sm font-bold text-hf-text">Tirar da trilha</button>
        </div>
      )}
    </div>
  );
}
