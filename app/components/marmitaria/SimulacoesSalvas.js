"use client";

// Simulações salvas (dono, 17/11/2026: "posso deixar as simulações salvas"):
// salvar com nome, abrir de qualquer aparelho, atualizar e apagar. Usado no
// Simulador de vendas e no Comparar apps. Grava em marmitaria_simulacoes
// (RLS por unidade). É simulação: nada vira venda.

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Save, Trash2 } from "lucide-react";
import { Aviso, Botao, inputCls } from "./ui";
import { apagarSimulacao, fetchSimulacoesDeVendas, salvarSimulacaoDeVendas } from "../../lib/marmitaria/dados";

const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "");

/**
 * @param {object} p
 * @param {"vendas"|"apps"} p.tipo
 * @param {() => {dias, quantidades, mix?, resultado?}} p.atual   o que está na tela agora
 * @param {(sim) => void} p.aoAbrir   recebe { dias, quantidades, mix }
 */
export default function SimulacoesSalvas({ unidadeId, tipo, atual, aoAbrir }) {
  const [lista, setLista] = useState([]);
  const [nome, setNome] = useState("");
  const [aberta, setAberta] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    if (!unidadeId) return;
    const r = await fetchSimulacoesDeVendas(unidadeId, tipo);
    setLista(r.data || []);
    if (r.error) setMsg({ tipo: "alerta", texto: r.error });
  }, [unidadeId, tipo]);
  useEffect(() => { recarregar(); }, [recarregar]);

  async function salvar(e) {
    e.preventDefault();
    const n = nome.trim();
    if (n.length < 2) return setMsg({ tipo: "alerta", texto: "Dê um nome à simulação (ex.: \"Novembro só iFood\")." });
    setOcupado(true);
    const mesma = lista.find((s) => s.nome.trim().toLowerCase() === n.toLowerCase());
    const r = await salvarSimulacaoDeVendas(unidadeId, { id: mesma?.id || null, nome: n, tipo, ...atual() });
    setOcupado(false);
    if (r.error) return setMsg({ tipo: "alerta", texto: r.error });
    setMsg({ tipo: "sucesso", texto: mesma ? `"${n}" atualizada.` : `"${n}" salva.` });
    setAberta(r.data?.id || mesma?.id || null);
    recarregar();
  }

  function abrir(s) {
    aoAbrir({ dias: String(s.dias_operacao_mes ?? 25), quantidades: s.itens?.quantidades || {}, mix: s.itens?.mix || null });
    setAberta(s.id);
    setNome(s.nome);
    setMsg({ tipo: "info", texto: `"${s.nome}" aberta. Mude e salve com o mesmo nome para atualizar.` });
  }

  async function apagar(s) {
    if (!window.confirm(`Apagar a simulação "${s.nome}"?`)) return;
    const r = await apagarSimulacao(unidadeId, s.id);
    if (r.error) return setMsg({ tipo: "alerta", texto: r.error });
    if (aberta === s.id) setAberta(null);
    recarregar();
  }

  return (
    <div className="space-y-2">
      <form onSubmit={salvar} className="flex flex-wrap items-center gap-2">
        <input className={`${inputCls} min-w-0 flex-1`} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Nome da simulação (ex.: Novembro só iFood)" aria-label="Nome da simulação" />
        <Botao type="submit" disabled={ocupado}><Save size={16} /> {ocupado ? "Salvando…" : "Salvar"}</Botao>
      </form>
      {lista.length > 0 && (
        <ul className="divide-y divide-hf-border rounded-xl border border-hf-border">
          {lista.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 px-3 py-1.5 ${aberta === s.id ? "bg-hf-elevated" : ""}`}>
              <button type="button" onClick={() => abrir(s)} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2 text-left">
                <FolderOpen size={16} className="shrink-0 text-hf-muted" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-hf-text">{s.nome}</span>
                  <span className="block text-[12px] text-hf-muted">{dataBR(s.criado_em)} · {s.dias_operacao_mes} dias{s.resultado_consolidado?.resumo ? ` · ${s.resultado_consolidado.resumo}` : ""}</span>
                </span>
              </button>
              <button type="button" onClick={() => apagar(s)} aria-label={`Apagar ${s.nome}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-hf-muted hover:bg-hf-elevated"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
    </div>
  );
}
