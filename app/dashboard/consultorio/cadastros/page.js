"use client";

// Tipos de consulta (duração e valor particular), convênios (valor por tipo,
// glosa e prazo) e horário de atendimento. Tudo editável pelo médico.

import { useState } from "react";
import { useConsultorio } from "../../../components/consultorio/contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, inputCls, lerNumero } from "../../../components/marmitaria/ui";
import { salvarConfig, salvarConvenio, salvarTipo } from "../../../lib/consultorio/dados";

const n = (v) => { const x = lerNumero(v); return x === "" || x === null || x === undefined ? null : x; };

function Tipo({ t, onSalvo }) {
  const [f, setF] = useState({ nome: t?.nome || "", minutos: t?.minutos ?? 30, valor: t?.valor_particular ?? "", eh_retorno: !!t?.eh_retorno });
  const [erro, setErro] = useState(null);
  async function salvar() {
    if (!f.nome.trim()) return setErro("Dê um nome (ex.: Consulta, Retorno, Procedimento).");
    const r = await salvarTipo({ id: t?.id, nome: f.nome.trim(), minutos: Math.max(5, Math.round(n(f.minutos) || 30)), valor_particular: n(f.valor), eh_retorno: f.eh_retorno });
    if (r.error) setErro(r.error); else onSalvo();
  }
  return (
    <div className="grid gap-2 rounded-xl border border-hf-border p-3 sm:grid-cols-[minmax(0,1fr)_110px_140px_auto]">
      <Campo rotulo="Tipo"><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Consulta" /></Campo>
      <Campo rotulo="Duração"><CampoNumero valor={f.minutos} onChange={(v) => setF({ ...f, minutos: v })} sufixo="min" /></Campo>
      <Campo rotulo="Particular"><CampoNumero prefixo="R$" valor={f.valor} onChange={(v) => setF({ ...f, valor: v })} placeholder="0,00" /></Campo>
      <div className="flex items-end gap-2">
        <label className="flex min-h-[44px] items-center gap-1 text-xs text-hf-text"><input type="checkbox" checked={f.eh_retorno} onChange={(e) => setF({ ...f, eh_retorno: e.target.checked })} /> retorno</label>
        <Botao onClick={salvar}>Salvar</Botao>
        {t && <Botao variante="secundario" onClick={async () => { await salvarTipo({ id: t.id, ativo: !t.ativo }); onSalvo(); }}>{t.ativo ? "Desativar" : "Ativar"}</Botao>}
      </div>
      {erro && <Aviso tipo="alerta" className="sm:col-span-4">{erro}</Aviso>}
    </div>
  );
}

function Convenio({ c, tipos, onSalvo }) {
  const [f, setF] = useState({ nome: c?.nome || "", prazo: c?.prazo_dias ?? "", glosa: c?.valores?.glosa_pct ?? "", valores: { ...(c?.valores || {}) } });
  const [erro, setErro] = useState(null);
  async function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do convênio.");
    const valores = {};
    for (const t of tipos) { const v = n(f.valores[t.id]); if (v !== null && v >= 0) valores[t.id] = v; }
    const g = n(f.glosa); if (g !== null && g >= 0) valores.glosa_pct = g;
    const r = await salvarConvenio({ id: c?.id, nome: f.nome.trim(), prazo_dias: n(f.prazo) === null ? null : Math.round(n(f.prazo)), valores });
    if (r.error) setErro(r.error); else onSalvo();
  }
  return (
    <div className="space-y-2 rounded-xl border border-hf-border p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_130px]">
        <Campo rotulo="Convênio"><input className={inputCls} value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Unimed" /></Campo>
        <Campo rotulo="Paga em"><CampoNumero valor={f.prazo} onChange={(v) => setF({ ...f, prazo: v })} sufixo="dias" /></Campo>
        <Campo rotulo="Glosa média" dica="O que costuma não pagar."><CampoNumero valor={f.glosa} onChange={(v) => setF({ ...f, glosa: v })} sufixo="%" /></Campo>
      </div>
      {tipos.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-3">
          {tipos.map((t) => <Campo key={t.id} rotulo={`${t.nome} (paga)`}><CampoNumero prefixo="R$" valor={f.valores[t.id] ?? ""} onChange={(v) => setF({ ...f, valores: { ...f.valores, [t.id]: v } })} placeholder="0,00" /></Campo>)}
        </div>
      )}
      {erro && <Aviso tipo="alerta">{erro}</Aviso>}
      <div className="flex gap-2"><Botao onClick={salvar}>Salvar convênio</Botao>{c && <Botao variante="secundario" onClick={async () => { await salvarConvenio({ id: c.id, ativo: !c.ativo }); onSalvo(); }}>{c.ativo ? "Desativar" : "Ativar"}</Botao>}</div>
    </div>
  );
}

export default function CadastrosConsultorio() {
  const { tipos, convenios, tiposAtivos, config, recarregar } = useConsultorio();
  const [novoTipo, setNovoTipo] = useState(false);
  const [novoConv, setNovoConv] = useState(false);
  const [exp, setExp] = useState(config?.expediente || { inicio: "08:00", fim: "18:00" });
  const [msgExp, setMsgExp] = useState(null);
  return (
    <div className="space-y-4">
      <Secao titulo="Tipos de consulta" subtitulo="Duração e valor particular. A agenda usa a duração para marcar e o valor para cobrar."
        direita={!novoTipo && <Botao onClick={() => setNovoTipo(true)}>Novo tipo</Botao>}>
        <div className="space-y-2">
          {novoTipo && <Tipo onSalvo={() => { setNovoTipo(false); recarregar(); }} />}
          {tipos.map((t) => <div key={t.id} className={t.ativo ? "" : "opacity-60"}><Tipo t={t} onSalvo={recarregar} /></div>)}
          {!tipos.length && !novoTipo && <p className="text-sm text-hf-text-2">Nenhum tipo ainda. Ex.: Consulta (30 min), Retorno (20 min), Procedimento (45 min).</p>}
        </div>
      </Secao>
      <Secao titulo="Convênios" subtitulo="Quanto cada convênio paga por tipo de consulta, em quantos dias e a glosa média."
        direita={!novoConv && <Botao onClick={() => setNovoConv(true)}>Novo convênio</Botao>}>
        <div className="space-y-2">
          {novoConv && <Convenio tipos={tiposAtivos} onSalvo={() => { setNovoConv(false); recarregar(); }} />}
          {convenios.map((c) => <div key={c.id} className={c.ativo ? "" : "opacity-60"}><Convenio c={c} tipos={tiposAtivos} onSalvo={recarregar} /></div>)}
          {!convenios.length && !novoConv && <p className="text-sm text-hf-text-2">Nenhum convênio. Só particular por enquanto.</p>}
        </div>
      </Secao>
      <Secao titulo="Horário de atendimento" subtitulo="A agenda sugere os horários livres dentro dele.">
        <div className="flex flex-wrap items-end gap-3">
          <Campo rotulo="Começa"><input type="time" className={inputCls} value={exp.inicio} onChange={(e) => setExp({ ...exp, inicio: e.target.value })} /></Campo>
          <Campo rotulo="Termina"><input type="time" className={inputCls} value={exp.fim} onChange={(e) => setExp({ ...exp, fim: e.target.value })} /></Campo>
          <Botao onClick={async () => { const r = await salvarConfig({ ...(config || {}), expediente: exp }); setMsgExp(r.error ? r.error : "Horário salvo."); if (!r.error) recarregar(); }}>Salvar horário</Botao>
        </div>
        {msgExp && <p className="mt-2 text-sm text-hf-text-2">{msgExp}</p>}
      </Secao>
    </div>
  );
}
