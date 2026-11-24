"use client";

// Funções da equipe. "Supervisão" é um interruptor (antes um botão "Marcar
// supervisor" repetido em cada linha, que cortava o nome da função).

import { useEffect, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchCargos, inserirCargo, atualizarCargo, removerCargo } from "../../../lib/rh";
import { Plus, Trash2 } from "lucide-react";
import { Painel, Bloco, SemUnidade, inputCls } from "./ui";

function Interruptor({ ligado, onChange, rotulo }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${ligado ? "bg-hf-menu" : "bg-hf-border"}`}>
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${ligado ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

export default function Cargos({ onVoltar }) {
  const { unidadeAtiva } = useERP();
  const real = unidadeAtiva && unidadeAtiva !== "todas";
  const [lista, setLista] = useState(null);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [apagar, setApagar] = useState(null);

  const carregar = () => real && fetchCargos(unidadeAtiva).then((r) => setLista(r.data || []));
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [unidadeAtiva]);

  const criar = async () => {
    setErro("");
    if (!nome.trim()) return;
    const { error } = await inserirCargo({ nome: nome.trim(), eh_supervisor: false }, unidadeAtiva);
    if (error) return setErro(`Não criou: ${error}`);
    setNome(""); carregar();
  };
  const alternar = async (c) => {
    setLista((l) => l.map((x) => (x.id === c.id ? { ...x, eh_supervisor: !c.eh_supervisor } : x)));
    const { error } = await atualizarCargo(c.id, { eh_supervisor: !c.eh_supervisor });
    if (error) { setErro(`Não mudou: ${error}`); carregar(); }
  };
  const excluir = async (c) => {
    const { error } = await removerCargo(c.id);
    if (error) return setErro(`Não excluiu: ${error}`);
    setApagar(null); setLista((l) => l.filter((x) => x.id !== c.id));
  };

  if (!real) return <Painel titulo="Funções" onVoltar={onVoltar}><SemUnidade /></Painel>;

  return (
    <Painel titulo="Funções" descricao="Ligue “Supervisão” nas funções de chefia: elas aparecem como chefe no organograma." onVoltar={onVoltar}>
      <div className="overflow-hidden rounded-2xl border border-hf-border bg-hf-surface divide-y divide-hf-border">
        {lista == null && <p className="p-4 text-[14px] text-hf-muted">Carregando…</p>}
        {lista?.length === 0 && <p className="p-4 text-[14px] text-hf-muted">Nenhuma função ainda.</p>}
        {lista?.map((c) => (
          <div key={c.id} className="flex min-h-[60px] items-center gap-3 px-4 py-2">
            <span className="min-w-0 flex-1 text-[15px] font-medium text-hf-text">{c.nome}</span>
            {apagar === c.id ? (
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => setApagar(null)} className="h-10 rounded-lg px-3 text-[13px] font-medium text-hf-muted">Não</button>
                <button type="button" onClick={() => excluir(c)} className="hf-manter-dourado h-10 rounded-lg bg-hf-danger px-3 text-[13px] font-semibold text-white">Excluir</button>
              </span>
            ) : (
              <>
                <span className="text-[12px] text-hf-muted">Supervisão</span>
                <Interruptor ligado={!!c.eh_supervisor} onChange={() => alternar(c)} rotulo={`Supervisão: ${c.nome}`} />
                <button type="button" onClick={() => setApagar(c.id)} aria-label={`Excluir ${c.nome}`} className="flex h-10 w-10 items-center justify-center rounded-lg text-hf-muted hover:text-hf-danger"><Trash2 size={17} /></button>
              </>
            )}
          </div>
        ))}
      </div>
      <Bloco titulo="Nova função">
        <div className="flex gap-2">
          <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Chefe de fila" onKeyDown={(e) => e.key === "Enter" && criar()} />
          <button type="button" onClick={criar} disabled={!nome.trim()} className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-hf-menu px-4 text-[15px] font-semibold text-white disabled:opacity-40"><Plus size={18} /> Criar</button>
        </div>
      </Bloco>
      {erro && <p className="text-[14px] font-medium text-hf-danger">{erro}</p>}
    </Painel>
  );
}
