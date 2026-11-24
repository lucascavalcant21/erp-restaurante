"use client";

// Porções do produto no local (dono, 24/11/2026): o saldo dividido em pacotes
// ("5 pacotes de 20 un", "10 pacotes de 100 g"). Contas em estoque-porcoes.mjs.

import { useState } from "react";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";
import { conferirPorcoes, dividirIgual, normalizarPorcoes, tamanhoLegivel, textoPorcoes } from "../../lib/estoque-porcoes.mjs";
import { paraUnidadeDoCadastro } from "../../lib/estoque-movimento.mjs";

const num = (v) => { const x = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const fmt = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const campo = "h-11 min-w-0 rounded-full border border-hf-border bg-hf-surface px-3 text-center text-sm font-bold text-hf-text outline-none focus:border-hf-accent";

/**
 * registro: { linhas } | undefined; saldo e unidade (do saldo); unidades: as que dá para digitar (kg/g…)
 * onSalvar(registro|null) → Promise<{error}>; onUsarPorcao(tamanho) preenche a retirada (só em retirada)
 */
export default function PorcoesDoProduto({ registro, saldo, unidade, unidades = [], onSalvar, onUsarPorcao, retirando }) {
  const [editando, setEditando] = useState(false);
  const [linhas, setLinhas] = useState([]);
  const [unidadeEd, setUnidadeEd] = useState(unidade);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const reg = normalizarPorcoes(registro);
  const tem = reg.linhas.length > 0;
  const conf = tem ? conferirPorcoes(reg, saldo) : null;
  const opcoesUn = unidades.length ? unidades : [unidade];

  const paraEditor = (t) => fmt(paraUnidadeDoCadastro(t, unidade, unidadeEd) ?? t).replace(/\./g, "");
  const abrir = () => {
    setUnidadeEd(unidade);
    setLinhas(tem ? reg.linhas.map((l) => ({ ...l, tamanho: fmt(l.tamanho).replace(/\./g, "") })) : [{ id: "n1", qtd: "", tamanho: "" }]);
    setErro(""); setEditando(true);
  };
  const tamanhoNoSaldo = (t) => paraUnidadeDoCadastro(num(t), unidadeEd, unidade) ?? num(t);
  const rascunho = { linhas: linhas.map((l) => ({ ...l, qtd: num(l.qtd), tamanho: tamanhoNoSaldo(l.tamanho) })) };
  const confRasc = conferirPorcoes(rascunho, saldo);
  const iguais = () => {
    const t = tamanhoNoSaldo(linhas[0]?.tamanho);
    const d = dividirIgual(saldo, t);
    if (d.erro) { setErro(d.erro); return; }
    setLinhas(d.linhas.map((l) => ({ ...l, tamanho: paraEditor(l.tamanho) })));
  };
  const salvar = async (valor) => {
    setSalvando(true); setErro("");
    const r = await onSalvar(valor);
    setSalvando(false);
    if (r?.error) setErro(r.error); else setEditando(false);
  };

  return (
    <div className="rounded-2xl border border-hf-border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold text-hf-text-2"><Package size={14} /> Porcionado</p>
          {tem ? (
            <>
              <p className="mt-0.5 text-sm font-black text-hf-text">{textoPorcoes(reg, unidade)}</p>
              {conf.confere
                ? <p className="text-[12px] font-semibold text-hf-success">Confere com o saldo ({tamanhoLegivel(conf.saldo, unidade)}).</p>
                : <p className="text-[12px] font-semibold text-hf-warning">Não confere: pacotes somam {tamanhoLegivel(conf.total, unidade)} e o saldo é {tamanhoLegivel(conf.saldo, unidade)}. Refaça a divisão.</p>}
            </>
          ) : <p className="mt-0.5 text-[13px] text-hf-muted">Sem divisão. Dividiu em pacotes? Registre para saber como está guardado.</p>}
        </div>
        {!editando && <button type="button" onClick={abrir} className="min-h-[40px] shrink-0 rounded-full border border-hf-border px-3 text-xs font-bold text-hf-text">{tem ? "Refazer" : "Dividir em pacotes"}</button>}
      </div>

      {retirando && tem && onUsarPorcao && !editando && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {reg.linhas.map((l) => (
            <button key={l.id} type="button" onClick={() => onUsarPorcao(l.tamanho)}
              className="min-h-[44px] rounded-full bg-hf-menu px-4 text-sm font-bold text-white">
              Retirar 1 pacote de {tamanhoLegivel(l.tamanho, unidade)}
            </button>
          ))}
        </div>
      )}

      {editando && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-hf-text-2">
            Tamanho em
            {opcoesUn.map((u) => (
              <button key={u} type="button" aria-pressed={unidadeEd === u} onClick={() => setUnidadeEd(u)}
                className={`min-h-[36px] rounded-full px-3 text-xs font-bold ${unidadeEd === u ? "bg-hf-menu text-white" : "border border-hf-border text-hf-text-2"}`}>{u}</button>
            ))}
          </div>
          {linhas.map((l, k) => (
            <div key={l.id} className="flex items-center gap-2">
              <input inputMode="numeric" aria-label="Quantos pacotes" value={l.qtd} onChange={(e) => setLinhas(linhas.map((x, j) => (j === k ? { ...x, qtd: e.target.value.replace(/\D/g, "") } : x)))} placeholder="5" className={`${campo} w-20`} />
              <span className="text-sm font-bold text-hf-text-2">pacotes de</span>
              <input inputMode="decimal" aria-label="Tamanho de cada pacote" value={l.tamanho} onChange={(e) => setLinhas(linhas.map((x, j) => (j === k ? { ...x, tamanho: e.target.value } : x)))} placeholder="20" className={`${campo} w-24`} />
              <span className="text-sm font-bold text-hf-text-2">{unidadeEd}</span>
              <button type="button" aria-label="Tirar linha" onClick={() => setLinhas(linhas.filter((_, j) => j !== k))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-hf-muted hover:text-hf-danger"><Trash2 size={15} /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setLinhas([...linhas, { id: `n${Date.now()}`, qtd: "", tamanho: "" }])} className="inline-flex min-h-[40px] items-center gap-1 text-sm font-bold text-hf-accent"><Plus size={14} /> Outro tamanho</button>
            {linhas.length > 0 && num(linhas[0].tamanho) > 0 && (
              <button type="button" onClick={iguais} className="min-h-[40px] rounded-full border border-hf-border px-3 text-xs font-bold text-hf-text">Dividir todo o saldo em pacotes de {linhas[0].tamanho} {unidadeEd}</button>
            )}
          </div>
          <p className={`text-[13px] font-bold ${confRasc.confere ? "text-hf-success" : "text-hf-warning"}`}>
            Pacotes somam {tamanhoLegivel(confRasc.total, unidade)} · saldo {tamanhoLegivel(confRasc.saldo, unidade)}
            {confRasc.confere ? " · confere" : confRasc.diferenca > 0 ? ` · falta dividir ${tamanhoLegivel(confRasc.diferenca, unidade)}` : ` · passou ${tamanhoLegivel(-confRasc.diferenca, unidade)} do saldo`}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => (tem ? salvar(null) : setEditando(false))} className="min-h-[44px] rounded-full border border-hf-border text-sm font-bold text-hf-text-2">{tem ? "Tirar a divisão" : "Cancelar"}</button>
            <button type="button" disabled={salvando || !confRasc.total} onClick={() => salvar(rascunho)}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-hf-menu text-sm font-bold text-white disabled:opacity-50">
              {salvando && <Loader2 size={15} className="animate-spin" />} Salvar divisão
            </button>
          </div>
          {tem && <button type="button" onClick={() => setEditando(false)} className="w-full min-h-[40px] text-xs font-bold text-hf-text-2">Fechar sem mudar</button>}
        </div>
      )}
      {erro && <p className="mt-2 text-[13px] font-semibold text-hf-danger">{erro}</p>}
    </div>
  );
}
