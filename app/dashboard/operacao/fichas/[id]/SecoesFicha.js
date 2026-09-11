"use client";

// Seções editáveis da ficha técnica: etapas do preparo, equipamentos,
// alergênicos, armazenamento e montagem.
//
// Ficam separadas da página para ela não virar um arquivo de milhares de
// linhas. Cada componente recebe o valor e devolve o valor inteiro alterado —
// quem guarda o estado e grava é a página.

import {
  ArrowDown, ArrowUp, Check, GripVertical, Plus, Trash2, X,
} from "lucide-react";
import { Field, TextInput, NumberInput, Select } from "../../../../components/ui";
import { ALERGENICOS, EQUIPAMENTOS_SUGERIDOS } from "../../../../lib/ficha-tecnica";

let contador = 0;
export const novaChave = () => `e${Date.now().toString(36)}${(contador += 1)}`;

export const ETAPA_VAZIA = () => ({
  chave: novaChave(), titulo: "", instrucao: "", tempo_min: "",
  temperatura: "", equipamento: "", observacao: "",
});

// Move um item da lista para cima ou para baixo.
function mover(lista, indice, direcao) {
  const destino = indice + direcao;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

// ─── Etapas do modo de preparo ──────────────────────────────────────────────

export function EtapasPreparo({ etapas, onChange, modoPreparoLegado }) {
  const alterar = (chave, campo, valor) =>
    onChange(etapas.map(e => (e.chave === chave ? { ...e, [campo]: valor } : e)));

  const importarDoTextoAntigo = () => {
    // Uma linha do texto livre vira uma etapa. Aceita "1. Fazer isso" e
    // "Fazer isso", e separa "Título: instrução" quando houver.
    const linhas = String(modoPreparoLegado || "")
      .split(/\r?\n/).map(l => l.replace(/^\s*\d+[).\-]?\s*/, "").trim()).filter(Boolean);
    if (!linhas.length) return;
    onChange(linhas.map(linha => {
      const corte = linha.indexOf(":");
      const temTitulo = corte > 0 && corte <= 40;
      return {
        ...ETAPA_VAZIA(),
        titulo: temTitulo ? linha.slice(0, corte).trim() : "",
        instrucao: temTitulo ? linha.slice(corte + 1).trim() : linha,
      };
    }));
  };

  return (
    <div className="space-y-3">
      {etapas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center">
          <p className="text-sm text-slate-400">Nenhuma etapa cadastrada.</p>
          {modoPreparoLegado ? (
            <>
              <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
                Esta receita já tem um modo de preparo escrito como texto corrido.
                Dá para transformá-lo em etapas numeradas — o texto original continua guardado.
              </p>
              <button onClick={importarDoTextoAntigo}
                className="mt-3 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Transformar o texto em etapas
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {etapas.map((etapa, i) => (
        <div key={etapa.chave} className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              {i + 1}
            </span>
            <input
              value={etapa.titulo || ""}
              onChange={e => alterar(etapa.chave, "titulo", e.target.value)}
              placeholder="Título da etapa (ex.: Grelhar)"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-bold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300"
            />
            <div className="flex shrink-0 items-center gap-0.5">
              <button onClick={() => onChange(mover(etapas, i, -1))} disabled={i === 0}
                title="Subir"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ArrowUp size={14} />
              </button>
              <button onClick={() => onChange(mover(etapas, i, 1))} disabled={i === etapas.length - 1}
                title="Descer"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">
                <ArrowDown size={14} />
              </button>
              <button onClick={() => onChange(etapas.filter(e => e.chave !== etapa.chave))}
                title="Remover etapa"
                className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <textarea
            value={etapa.instrucao || ""}
            onChange={e => alterar(etapa.chave, "instrucao", e.target.value)}
            placeholder="O que fazer nesta etapa."
            className="erp-input mt-2 min-h-[56px] text-sm"
          />

          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <Field label="Tempo (min)">
              <NumberInput value={etapa.tempo_min ?? ""} min="0" step="1"
                onChange={e => alterar(etapa.chave, "tempo_min", e.target.value)} />
            </Field>
            <Field label="Temperatura">
              <TextInput value={etapa.temperatura || ""} placeholder="180 °C"
                onChange={e => alterar(etapa.chave, "temperatura", e.target.value)} />
            </Field>
            <Field label="Equipamento">
              <TextInput value={etapa.equipamento || ""} placeholder="Chapa"
                onChange={e => alterar(etapa.chave, "equipamento", e.target.value)} />
            </Field>
            <Field label="Observação">
              <TextInput value={etapa.observacao || ""}
                onChange={e => alterar(etapa.chave, "observacao", e.target.value)} />
            </Field>
          </div>
        </div>
      ))}

      <button onClick={() => onChange([...etapas, ETAPA_VAZIA()])}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
        <Plus size={15} /> Adicionar etapa
      </button>
    </div>
  );
}

// ─── Equipamentos e utensílios ──────────────────────────────────────────────

export function Equipamentos({ selecionados, onChange }) {
  const marcados = new Set(selecionados.map(s => s.toLowerCase()));

  const alternar = (nome) => {
    if (marcados.has(nome.toLowerCase())) {
      onChange(selecionados.filter(s => s.toLowerCase() !== nome.toLowerCase()));
    } else {
      onChange([...selecionados, nome]);
    }
  };

  // Equipamentos digitados pelo usuário que não estão na lista sugerida.
  const personalizados = selecionados.filter(
    s => !EQUIPAMENTOS_SUGERIDOS.some(e => e.toLowerCase() === s.toLowerCase())
  );

  const adicionar = (e) => {
    e.preventDefault();
    const campo = e.target.elements.novo;
    const nome = campo.value.trim();
    if (!nome) return;
    if (!marcados.has(nome.toLowerCase())) onChange([...selecionados, nome]);
    campo.value = "";
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {EQUIPAMENTOS_SUGERIDOS.map(nome => {
          const ativo = marcados.has(nome.toLowerCase());
          return (
            <button key={nome} onClick={() => alternar(nome)}
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-medium transition ${
                ativo ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {ativo ? <Check size={13} /> : null} {nome}
            </button>
          );
        })}
      </div>

      {personalizados.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {personalizados.map(nome => (
            <span key={nome} className="flex items-center gap-1 rounded-xl bg-sky-100 px-2.5 py-1.5 text-sm font-medium text-sky-800">
              {nome}
              <button onClick={() => alternar(nome)} className="text-sky-500 hover:text-sky-700" title="Remover">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <form onSubmit={adicionar} className="mt-3 flex gap-2">
        <input name="novo" placeholder="Outro equipamento" className="erp-input flex-1" />
        <button type="submit" className="rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Adicionar
        </button>
      </form>
    </div>
  );
}

// ─── Alergênicos ────────────────────────────────────────────────────────────

export function Alergenicos({ selecionados, podeConter, onChange, onPodeConterChange }) {
  const marcados = new Set(selecionados.map(s => s.toLowerCase()));
  const alternar = (nome) => {
    if (marcados.has(nome.toLowerCase())) onChange(selecionados.filter(s => s.toLowerCase() !== nome.toLowerCase()));
    else onChange([...selecionados, nome]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {ALERGENICOS.map(nome => {
          const ativo = marcados.has(nome.toLowerCase());
          return (
            <button key={nome} onClick={() => alternar(nome)}
              className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-sm font-medium transition ${
                ativo ? "bg-amber-500 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {ativo ? <Check size={13} /> : null} {nome}
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <Field label="Pode conter (traços)">
          <TextInput value={podeConter || ""} placeholder="ex.: soja, ovos"
            onChange={e => onPodeConterChange(e.target.value)} />
        </Field>
      </div>
      {selecionados.length ? (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <b>Contém:</b> {selecionados.join(", ")}
          {podeConter ? <> · <b>Pode conter:</b> {podeConter}</> : null}
        </p>
      ) : null}
    </div>
  );
}

// ─── Armazenamento e validade ───────────────────────────────────────────────

const FORMAS = ["", "Refrigerado", "Congelado", "Temperatura ambiente", "Seco", "A vácuo"];

export function Armazenamento({ dados, onChange }) {
  const alterar = (campo, valor) => onChange({ ...dados, [campo]: valor });

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Forma de armazenamento">
        <Select value={dados.forma || ""} onChange={e => alterar("forma", e.target.value)}>
          {FORMAS.map(f => <option key={f || "vazio"} value={f}>{f || "—"}</option>)}
        </Select>
      </Field>
      <Field label="Recipiente">
        <TextInput value={dados.recipiente || ""} placeholder="ex.: GN 1/6 com tampa"
          onChange={e => alterar("recipiente", e.target.value)} />
      </Field>
      <Field label="Local">
        <TextInput value={dados.local_armazenamento || ""} placeholder="ex.: Geladeira 2"
          onChange={e => alterar("local_armazenamento", e.target.value)} />
      </Field>

      <Field label="Temperatura mínima (°C)">
        <NumberInput value={dados.temperatura_min ?? ""} step="any"
          onChange={e => alterar("temperatura_min", e.target.value)} />
      </Field>
      <Field label="Temperatura máxima (°C)">
        <NumberInput value={dados.temperatura_max ?? ""} step="any"
          onChange={e => alterar("temperatura_max", e.target.value)} />
      </Field>
      <Field label="Validade refrigerado (dias)">
        <NumberInput value={dados.validade_refrigerado_dias ?? ""} min="0" step="1"
          onChange={e => alterar("validade_refrigerado_dias", e.target.value)} />
      </Field>

      <Field label="Validade congelado (dias)">
        <NumberInput value={dados.validade_congelado_dias ?? ""} min="0" step="1"
          onChange={e => alterar("validade_congelado_dias", e.target.value)} />
      </Field>
      <Field label="Validade após aberto (dias)">
        <NumberInput value={dados.validade_apos_aberto_dias ?? ""} min="0" step="1"
          onChange={e => alterar("validade_apos_aberto_dias", e.target.value)} />
      </Field>
      <Field label="Validade após preparo (horas)">
        <NumberInput value={dados.validade_apos_preparo_horas ?? ""} min="0" step="1"
          onChange={e => alterar("validade_apos_preparo_horas", e.target.value)} />
      </Field>

      <div className="sm:col-span-3">
        <Field label="Observações">
          <textarea className="erp-input min-h-[56px]" value={dados.observacoes || ""}
            onChange={e => alterar("observacoes", e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

// ─── Montagem padrão ────────────────────────────────────────────────────────

export function MontagemPassos({ passos, onChange }) {
  return (
    <div className="space-y-2">
      {passos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-5 text-center text-sm text-slate-400">
          Nenhum passo de montagem. A ordem aqui é a ordem em que o prato é montado.
        </p>
      ) : null}

      {passos.map((passo, i) => (
        <div key={passo.chave} className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
            {i + 1}
          </span>
          <input
            value={passo.descricao || ""}
            onChange={e => onChange(passos.map(p => (p.chave === passo.chave ? { ...p, descricao: e.target.value } : p)))}
            placeholder="ex.: base do pão"
            className="erp-input min-w-0 flex-1"
          />
          <div className="flex shrink-0 items-center gap-0.5">
            <button onClick={() => onChange(mover(passos, i, -1))} disabled={i === 0}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Subir">
              <ArrowUp size={14} />
            </button>
            <button onClick={() => onChange(mover(passos, i, 1))} disabled={i === passos.length - 1}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30" title="Descer">
              <ArrowDown size={14} />
            </button>
            <button onClick={() => onChange(passos.filter(p => p.chave !== passo.chave))}
              className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50" title="Remover">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}

      <button onClick={() => onChange([...passos, { chave: novaChave(), descricao: "" }])}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
        <Plus size={15} /> Adicionar passo
      </button>
    </div>
  );
}
