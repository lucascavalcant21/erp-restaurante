"use client";

// Unidades: trocar a que está em uso e criar novas. Excluir saiu da frente
// (era uma lixeira vermelha ao lado de cada loja): agora fica dentro da
// unidade, só para a que não está em uso, e pede para digitar o nome.

import { useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { inserirUnidade, removerUnidade } from "../../../lib/unidades";
import { Check, Plus } from "lucide-react";
import { Painel, Bloco, inputCls } from "./ui";

export default function Unidades({ onVoltar }) {
  const { unidades, unidadeAtiva, setUnidadeAtiva, recarregarUnidades } = useERP();
  const reais = (unidades || []).filter((u) => u.id !== "todas");
  const [nova, setNova] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  const [excluindo, setExcluindo] = useState(null);
  const [confirmaNome, setConfirmaNome] = useState("");

  const criar = async () => {
    setErro("");
    if (!nova.trim()) return;
    setCriando(true);
    const { data, error } = await inserirUnidade({ nome: nova.trim() });
    setCriando(false);
    if (error) return setErro(`Não criou: ${error}`);
    setNova("");
    await recarregarUnidades();
    if (data?.id) setUnidadeAtiva(data.id);
  };

  const excluir = async (u) => {
    const { error } = await removerUnidade(u.id);
    if (error) return setErro(`Não excluiu: ${error}`);
    setExcluindo(null); setConfirmaNome("");
    await recarregarUnidades();
  };

  return (
    <Painel titulo="Unidades" descricao="Toque numa unidade para trabalhar nela." onVoltar={onVoltar}>
      <div className="overflow-hidden rounded-2xl border border-hf-border bg-hf-surface divide-y divide-hf-border">
        {reais.map((u) => {
          const ativa = u.id === unidadeAtiva;
          return (
            <div key={u.id}>
              <div className="flex min-h-[60px] items-center gap-3 px-4">
                <button type="button" onClick={() => !ativa && setUnidadeAtiva(u.id)} className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${ativa ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border"}`}>{ativa && <Check size={14} />}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-hf-text">{u.nome}</span>
                    <span className="block text-[13px] text-hf-muted">{ativa ? "Em uso agora" : u.cidade || "Toque para usar"}</span>
                  </span>
                </button>
                {!ativa && excluindo !== u.id && (
                  <button type="button" onClick={() => { setExcluindo(u.id); setConfirmaNome(""); }} className="h-10 shrink-0 rounded-lg px-3 text-[13px] font-medium text-hf-muted hover:text-hf-danger">Excluir</button>
                )}
              </div>
              {excluindo === u.id && (
                <div className="space-y-3 bg-hf-danger/5 px-4 pb-4 pt-1">
                  <p className="text-[14px] text-hf-text">Os dados de <b>{u.nome}</b> deixam de aparecer e isso não tem volta. Para confirmar, digite o nome da unidade.</p>
                  <input className={inputCls} value={confirmaNome} onChange={(e) => setConfirmaNome(e.target.value)} placeholder={u.nome} autoFocus />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setExcluindo(null)} className="h-11 flex-1 rounded-xl border border-hf-border text-[14px] font-medium text-hf-text">Cancelar</button>
                    <button type="button" disabled={confirmaNome.trim().toLowerCase() !== String(u.nome).trim().toLowerCase()} onClick={() => excluir(u)}
                      className="hf-manter-dourado h-11 flex-1 rounded-xl bg-hf-danger text-[14px] font-semibold text-white disabled:opacity-40">Excluir de vez</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!reais.length && <p className="p-4 text-[14px] text-hf-muted">Nenhuma unidade ainda.</p>}
      </div>

      <Bloco titulo="Nova unidade">
        <div className="flex gap-2">
          <input className={inputCls} value={nova} onChange={(e) => setNova(e.target.value)} placeholder="Ex.: Filial Centro" onKeyDown={(e) => e.key === "Enter" && criar()} />
          <button type="button" onClick={criar} disabled={!nova.trim() || criando} className="flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-hf-menu px-4 text-[15px] font-semibold text-white disabled:opacity-40">
            <Plus size={18} /> {criando ? "Criando…" : "Criar"}
          </button>
        </div>
      </Bloco>
      {erro && <p className="text-[14px] font-medium text-hf-danger">{erro}</p>}
    </Painel>
  );
}
