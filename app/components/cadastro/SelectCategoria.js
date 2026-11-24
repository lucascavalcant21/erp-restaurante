"use client";

// Escolher categoria sem "Outros" (dono, 24/11/2026: "não tem que estar outros,
// tem que estar um + para adicionar novas categorias"). As já usadas aparecem
// junto; "+ Nova categoria" abre o campo para digitar.

import { useState } from "react";
import { Check, X } from "lucide-react";

export function opcoesSemOutros(padrao = [], usadas = [], atual = "") {
  const vistos = new Set();
  const lista = [];
  for (const c of [...padrao, ...usadas, atual]) {
    const nome = String(c || "").trim();
    const chave = nome.toLowerCase();
    if (!nome || vistos.has(chave)) continue;
    // "Outros" antigo só aparece se é o valor atual do item
    if (/^outros?$/i.test(nome) && nome !== atual) continue;
    vistos.add(chave); lista.push(nome);
  }
  return lista;
}

export default function SelectCategoria({ value, onChange, opcoes = [], className = "", semCategoria = "Sem categoria" }) {
  const [criando, setCriando] = useState(false);
  const [nova, setNova] = useState("");
  const lista = opcoesSemOutros(opcoes, [], value);
  if (criando) {
    const ok = () => { const n = nova.trim().replace(/\s+/g, " "); if (n) onChange(n.charAt(0).toUpperCase() + n.slice(1)); setCriando(false); setNova(""); };
    return (
      <span className="flex gap-1.5">
        <input autoFocus value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } }}
          placeholder="Nome da categoria" aria-label="Nova categoria" className={`${className} min-w-0 flex-1`} />
        <button type="button" onClick={ok} aria-label="Criar categoria" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-hf-menu text-white"><Check size={16} /></button>
        <button type="button" onClick={() => { setCriando(false); setNova(""); }} aria-label="Cancelar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hf-border text-hf-text-2"><X size={16} /></button>
      </span>
    );
  }
  return (
    <select value={value || ""} onChange={(e) => (e.target.value === "__nova" ? setCriando(true) : onChange(e.target.value))} className={className}>
      <option value="">{semCategoria}</option>
      {lista.map((c) => <option key={c} value={c}>{c}</option>)}
      <option value="__nova">+ Nova categoria…</option>
    </select>
  );
}
