"use client";

// Peças comuns do consultório: datas locais, selo de status e busca de paciente.

import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { STATUS, cpfValido, soDigitos } from "../../lib/consultorio/agenda.mjs";
import { buscarPacientes, salvarPaciente } from "../../lib/consultorio/dados";
import { Aviso, Botao, Campo, inputCls } from "../marmitaria/ui";

export const hojeLocal = () => new Date().toLocaleDateString("sv-SE");
export const somarDiasLocal = (dia, n) => { const [a, m, d] = dia.split("-").map(Number); return new Date(a, m - 1, d + n).toLocaleDateString("sv-SE"); };
export const inicioDoDiaIso = (dia) => { const [a, m, d] = dia.split("-").map(Number); return new Date(a, m - 1, d).toISOString(); };
export const hora = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const dataBR = (iso) => (iso ? new Date(String(iso).length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "—");
export const mascaraCpf = (v) => soDigitos(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
export const mascaraFone = (v) => { const d = soDigitos(v).slice(0, 11); return d.length <= 10 ? d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").replace(/-$/, "") : d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3"); };

const TOM = { ok: "bg-hf-success/10 text-hf-success", destaque: "bg-hf-accent/15 text-hf-text", alerta: "bg-hf-danger/10 text-hf-danger", neutro: "bg-hf-elevated text-hf-text-2" };
export function SeloStatus({ status }) {
  const s = STATUS[status] || STATUS.agendada;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${TOM[s.tom]}`}>{s.rotulo}</span>;
}

/** Busca o paciente pelo nome, CPF ou telefone; ou cadastra um novo na hora. */
export function EscolherPaciente({ onEscolher, convenios = [] }) {
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState([]);
  const [novo, setNovo] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (termo.trim().length < 2) { setLista([]); return; }
    const id = setTimeout(() => buscarPacientes(termo, 8).then((r) => setLista(r.data)), 250);
    return () => clearTimeout(id);
  }, [termo]);

  async function cadastrar() {
    setErro(null);
    if (novo.nome.trim().length < 2) return setErro("Informe o nome do paciente.");
    if (novo.cpf && !cpfValido(novo.cpf)) return setErro("CPF inválido.");
    setSalvando(true);
    const r = await salvarPaciente({ nome: novo.nome.trim(), cpf: soDigitos(novo.cpf) || null, telefone: soDigitos(novo.telefone) || null, convenio_id: novo.convenio_id || null, aceita_whatsapp: !!novo.aceita_whatsapp });
    setSalvando(false);
    if (r.error) return setErro(/cpf_unico|duplicate/i.test(r.error) ? "Já existe paciente com esse CPF." : r.error);
    onEscolher(r.data);
  }

  if (novo) return (
    <div className="space-y-3 rounded-xl border border-hf-border p-3">
      <p className="text-sm font-bold text-hf-text">Novo paciente</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome completo" className="sm:col-span-2"><input className={inputCls} value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoComplete="off" /></Campo>
        <Campo rotulo="Telefone (WhatsApp)"><input className={inputCls} inputMode="tel" value={mascaraFone(novo.telefone)} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} placeholder="(81) 99999-9999" /></Campo>
        <Campo rotulo="CPF (opcional)"><input className={inputCls} inputMode="numeric" value={mascaraCpf(novo.cpf)} onChange={(e) => setNovo({ ...novo, cpf: e.target.value })} /></Campo>
        {convenios.length > 0 && (
          <Campo rotulo="Convênio">
            <select className={inputCls} value={novo.convenio_id || ""} onChange={(e) => setNovo({ ...novo, convenio_id: e.target.value })}>
              <option value="">Particular</option>{convenios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
        )}
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-hf-text"><input type="checkbox" checked={!!novo.aceita_whatsapp} onChange={(e) => setNovo({ ...novo, aceita_whatsapp: e.target.checked })} /> Aceita lembretes pelo WhatsApp</label>
      </div>
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <div className="flex gap-2"><Botao onClick={cadastrar} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar e usar"}</Botao><Botao variante="secundario" onClick={() => setNovo(null)}>Voltar</Botao></div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
        <input className={`${inputCls} pl-9`} value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Nome, CPF ou telefone do paciente" autoComplete="off" aria-label="Buscar paciente" />
      </div>
      {lista.length > 0 && (
        <ul className="divide-y divide-hf-border rounded-xl border border-hf-border">
          {lista.map((p) => (
            <li key={p.id}><button type="button" onClick={() => onEscolher(p)} className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left hover:bg-hf-elevated">
              <span className="text-sm font-semibold text-hf-text">{p.nome}</span>
              <span className="text-xs text-hf-muted">{p.telefone ? mascaraFone(p.telefone) : ""}{p.cpf ? ` · ${mascaraCpf(p.cpf)}` : ""}</span>
            </button></li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setNovo({ nome: termo.replace(/[\d.()-]/g, "").trim(), cpf: "", telefone: /\d{8,}/.test(soDigitos(termo)) ? soDigitos(termo) : "", convenio_id: "", aceita_whatsapp: true })}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-hf-accent"><UserPlus size={16} /> Cadastrar paciente novo</button>
    </div>
  );
}
