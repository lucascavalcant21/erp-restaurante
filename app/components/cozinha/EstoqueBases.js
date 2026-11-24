"use client";

// ESTOQUE DAS BASES (dono, 23/11/2026): quanto tem pronto de cada base, com
// "Produzi" (entrada) e "Usei / Perdi / Venceu" (retirada). Lê o estoque
// espelho das bases (pre-preparos-cozinha / -bar) e movimenta pelo motor do
// ERP (estoque_movimentar, via registrarMovimentoMulti). Regras em
// app/lib/estoque-bases.mjs.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Minus, Plus, Search, X } from "lucide-react";
import CabecalhoTela from "../ui/CabecalhoTela";
import { useERP } from "../../context/ERPContext";
import { usePermission } from "../access-control/PermissionGate";
import { supabase, isSupabaseReady } from "../../lib/supabase";
import { registrarMovimentoMulti } from "../../lib/estoques-multiplos";
import { novaChave } from "../../lib/contas-pagar.mjs";
import { MOTIVOS_BASE, SLUGS_BASES, filtrarBases, lerQuantidade, montarEstoqueBases, paraUnidadeDoSaldo, textoSaldo, unidadesDeDigitar } from "../../lib/estoque-bases.mjs";

const pill = (ativo) => `min-h-[44px] shrink-0 rounded-full px-4 text-sm font-bold ${ativo ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2"}`;

function Movimentar({ base, onFechar, onFeito, nomeUsuario }) {
  const [tipo, setTipo] = useState("entrada");
  const [motivo, setMotivo] = useState("producao");
  const unidades = unidadesDeDigitar(base.unidade);
  const [un, setUn] = useState(unidades[0].id);
  const [qtdTxt, setQtdTxt] = useState("");
  const [validade, setValidade] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [chave] = useState(() => novaChave());
  const qtd = lerQuantidade(qtdTxt);
  const fator = unidades.find((u) => u.id === un)?.fator || 1;
  const noSaldo = qtd ? paraUnidadeDoSaldo(qtd, fator) : null;

  async function confirmar() {
    if (!noSaldo) { setErro("Digite a quantidade (ex.: 1,8)."); return; }
    setEnviando(true); setErro("");
    const r = await registrarMovimentoMulti({
      unidadeId: base.unidadeId, estoqueId: base.estoqueId, insumoId: base.insumoId, tipo: tipo === "entrada" ? "entrada" : "saida",
      quantidade: noSaldo, motivo, chave, validade: tipo === "entrada" ? validade || null : null,
      quantidadeInformada: qtd, unidadeInformada: un, usuarioNome: nomeUsuario || "", origem: "movimentacao",
    });
    setEnviando(false);
    if (r?.error) { setErro(r.error); return; }
    onFeito(r.data?.novo_saldo);
  }

  return (
    <div className="space-y-3 rounded-3xl border border-hf-border bg-hf-surface p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1"><p className="text-[17px] font-black text-hf-text">{base.nome}</p><p className="text-[13px] text-hf-muted">Tem agora: <b>{textoSaldo(base.saldo, base.unidade)}</b></p></div>
        <button type="button" aria-label="Fechar" onClick={onFechar} className="grid h-11 w-11 place-items-center rounded-full border border-hf-border"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-hf-elevated p-1">
        {[["entrada", "Entrou", Plus], ["saida", "Saiu", Minus]].map(([id, rot, I]) => (
          <button key={id} type="button" aria-pressed={tipo === id} onClick={() => { setTipo(id); setMotivo(MOTIVOS_BASE[id][0].codigo); }}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-sm font-black ${tipo === id ? "bg-hf-menu text-white" : "text-hf-text-2"}`}><I size={15} /> {rot}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">{MOTIVOS_BASE[tipo].map((m) => <button key={m.codigo} type="button" aria-pressed={motivo === m.codigo} onClick={() => setMotivo(m.codigo)} className={pill(motivo === m.codigo)}>{m.rotulo}</button>)}</div>
      <div className="flex items-center gap-2">
        <input autoFocus inputMode="decimal" value={qtdTxt} onChange={(e) => setQtdTxt(e.target.value.replace(/[^\d,.]/g, ""))} placeholder="ex.: 1,8" aria-label="Quantidade"
          className="h-12 min-w-0 flex-1 rounded-full border border-hf-border bg-hf-surface px-4 text-center text-[20px] font-extrabold tabular-nums outline-none focus:border-hf-accent" />
        {unidades.map((u) => <button key={u.id} type="button" aria-pressed={un === u.id} onClick={() => setUn(u.id)} className={pill(un === u.id)}>{u.id}</button>)}
      </div>
      {tipo === "entrada" && (
        <label className="block"><span className="text-[13px] font-medium text-hf-muted">Validade (opcional)</span>
          <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className="mt-1 h-12 w-full rounded-full border border-hf-border bg-hf-surface px-4 text-[16px] font-semibold outline-none" />
        </label>
      )}
      {noSaldo && fator !== 1 && <p className="text-[13px] text-hf-muted">= {textoSaldo(noSaldo, base.unidade)} no estoque</p>}
      {erro && <p role="alert" className="text-[14px] font-semibold text-hf-danger">{erro}</p>}
      <button type="button" onClick={confirmar} disabled={enviando || !noSaldo} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-menu text-[15px] font-black text-white disabled:opacity-50">
        {enviando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Confirmar
      </button>
    </div>
  );
}

export default function EstoqueBases() {
  const { unidadeAtiva, sessao } = useERP();
  const podeMexer = usePermission("cozinha.base_stock.create");
  const [estoques, setEstoques] = useState([]);
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [setor, setSetor] = useState("todos");
  // Cozinha é só cozinha e bar só bar (dono, 24/11/2026): vindo da área
  // (?dept=cozinha ou ?dept=bar), a tela fica travada no setor, sem as pílulas.
  const [setorTravado, setSetorTravado] = useState(null);
  useEffect(() => {
    try {
      const d = new URLSearchParams(window.location.search).get("dept");
      if (d === "cozinha" || d === "bar") { setSetorTravado(d); setSetor(d); }
    } catch { /* segue */ }
  }, []);
  const [busca, setBusca] = useState("");
  const [abertoId, setAbertoId] = useState(null);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    if (!isSupabaseReady() || !unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    const { data: est, error: e1 } = await supabase.from("estoques").select("id, slug, nome").eq("unidade_id", unidadeAtiva).in("slug", SLUGS_BASES);
    if (e1) { setErro(e1.message); setCarregando(false); return; }
    const ids = (est || []).map((e) => e.id);
    const { data: its, error: e2 } = ids.length
      ? await supabase.from("estoque_itens").select("id, estoque_id, insumo_id, ficha_tecnica_id, quantidade_atual, local_interno, insumos(nome, unidade_medida)").in("estoque_id", ids)
      : { data: [], error: null };
    setErro(e2?.message || "");
    setEstoques(est || []);
    setLinhas(its || []);
    setCarregando(false);
  }, [unidadeAtiva]);
  useEffect(() => { setCarregando(true); carregar(); }, [carregar]);

  const lista = useMemo(() => montarEstoqueBases(linhas, estoques).map((b) => ({ ...b, unidadeId: unidadeAtiva })), [linhas, estoques, unidadeAtiva]);
  const visiveis = filtrarBases(lista, { setor, busca });
  const temBar = lista.some((b) => b.setor === "bar");
  const doSetor = setorTravado ? lista.filter((b) => (b.setor === "bar" ? "bar" : "cozinha") === setorTravado) : lista;
  const comSaldo = doSetor.filter((b) => b.saldo > 0).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6">
      <CabecalhoTela titulo="Estoque de bases" subtitulo="Quanto tem pronto de cada base" />
      {aviso && <p role="status" className="rounded-full bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-text">{aviso}</p>}
      {erro && <p role="alert" className="rounded-2xl bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-danger">Não consegui carregar: {erro}</p>}
      {!carregando && !erro && doSetor.length > 0 && <p className="text-[14px] text-hf-text-2">{comSaldo} de {doSetor.length} bases com saldo. Toque numa base para lançar o que entrou ou saiu.</p>}
      {!setorTravado && <div className="flex flex-wrap gap-2 pb-1">
        {[["todos", "Todas"], ["cozinha", "Cozinha"], ...(temBar ? [["bar", "Bar"]] : [])].map(([id, rot]) => <button key={id} type="button" onClick={() => setSetor(id)} className={pill(setor === id)}>{rot}</button>)}
      </div>}
      {lista.length > 6 && (
        <label className="flex h-12 items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4"><Search size={16} className="text-hf-muted" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar base" aria-label="Procurar base" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
        </label>
      )}
      {carregando ? (
        <p className="py-8 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando…</p>
      ) : !lista.length ? (
        <div className="rounded-3xl border border-dashed border-hf-border px-4 py-8 text-center">
          <p className="font-black text-hf-text">Nenhuma base no estoque ainda.</p>
          <p className="mt-1 text-sm text-hf-muted">Toda base da Cozinha e do Bar aparece aqui sozinha depois de criada em Bases.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visiveis.map((b) => abertoId === b.id ? (
            <li key={b.id}><Movimentar base={b} nomeUsuario={sessao?.nome || sessao?.email || ""} onFechar={() => setAbertoId(null)}
              onFeito={() => { setAbertoId(null); setAviso(`${b.nome}: lançado.`); setTimeout(() => setAviso(""), 3000); carregar(); }} /></li>
          ) : (
            <li key={b.id}>
              <button type="button" disabled={!podeMexer} onClick={() => setAbertoId(b.id)} className="flex min-h-[60px] w-full items-center gap-3 rounded-3xl border border-hf-border bg-hf-surface px-4 py-3 text-left disabled:cursor-default">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-black text-hf-text">{b.nome}</p>
                  <p className="text-[13px] text-hf-muted">{setorTravado ? (b.local || (b.setor === "bar" ? "Bar" : "Cozinha")) : `${b.setor === "bar" ? "Bar" : "Cozinha"}${b.local ? ` · ${b.local}` : ""}`}</p>
                </div>
                <span className={`shrink-0 text-right text-[18px] font-black tabular-nums ${b.negativo ? "text-hf-danger" : b.saldo > 0 ? "text-hf-text" : "text-hf-muted"}`}>{textoSaldo(b.saldo, b.unidade)}</span>
              </button>
            </li>
          ))}
          {!visiveis.length && <li className="py-6 text-center text-sm font-semibold text-hf-muted">Nenhuma base com esse nome.</li>}
        </ul>
      )}
    </div>
  );
}
