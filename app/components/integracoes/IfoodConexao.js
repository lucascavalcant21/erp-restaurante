"use client";

// Onde o dono cadastra o iFood da unidade. O Client Secret vai direto para o
// servidor, que cifra e guarda; a tela nunca recebe o segredo de volta.
// "Conectado" só aparece depois de um teste real no iFood.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Circle, Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabase";

const ESTADOS = {
  CONNECTED: { rotulo: "Conectado", cls: "bg-hf-accent/10 text-hf-accent", Icone: CheckCircle2 },
  CONFIGURED_UNVERIFIED: { rotulo: "Cadastrado, falta testar", cls: "bg-hf-warning/10 text-hf-warning", Icone: AlertTriangle },
  ERROR: { rotulo: "Erro no último teste", cls: "bg-hf-danger/10 text-hf-danger", Icone: AlertTriangle },
  AUTH_EXPIRED: { rotulo: "Credenciais recusadas", cls: "bg-hf-danger/10 text-hf-danger", Icone: AlertTriangle },
  DISABLED: { rotulo: "Desconectado", cls: "bg-hf-elevated text-hf-text-2", Icone: Circle },
  NOT_CONFIGURED: { rotulo: "Não cadastrado", cls: "bg-hf-elevated text-hf-text-2", Icone: Circle },
};
const input = "w-full min-h-[44px] rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none focus:border-hf-accent focus:ring-2 focus:ring-hf-accent/15";

async function chamar(metodo, corpo, unidadeId) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return { ok: false, erro: "Sessão expirada: entre de novo." };
  const url = metodo === "GET" ? `/api/ifood/conexao?unidadeId=${encodeURIComponent(unidadeId)}` : "/api/ifood/conexao";
  try {
    const res = await fetch(url, {
      method: metodo, headers: { Authorization: `Bearer ${token}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
      body: corpo ? JSON.stringify({ ...corpo, unidadeId }) : undefined,
    });
    const d = await res.json().catch(() => ({}));
    return res.ok ? d : { ok: false, ...d, erro: d.erro || `Erro ${res.status}` };
  } catch {
    return { ok: false, erro: "Sem conexão com o servidor." };
  }
}

export default function IfoodConexao({ unidadeId }) {
  const [info, setInfo] = useState(null);
  const [f, setF] = useState({ merchantId: "", clientId: "", clientSecret: "" });
  const [ver, setVer] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const [msg, setMsg] = useState(null);

  const carregar = useCallback(async () => {
    if (!unidadeId) return;
    const r = await chamar("GET", null, unidadeId);
    setInfo(r);
    if (r.ok) setF((x) => ({ ...x, merchantId: r.merchantId || x.merchantId }));
  }, [unidadeId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function acao(nome, corpo = {}) {
    if (ocupado) return;
    setOcupado(nome); setMsg(null);
    try {
      const r = await chamar("POST", { acao: nome, ...corpo }, unidadeId);
      if (nome === "salvar" && r.ok) { setF((x) => ({ ...x, clientId: "", clientSecret: "" })); setMsg({ ok: true, texto: "Cadastro salvo. Agora toque em Testar conexão." }); }
      else if (nome === "testar") setMsg({ ok: !!r.ok, texto: r.mensagem || r.erro });
      else if (nome === "desconectar" && r.ok) setMsg({ ok: true, texto: "iFood desconectado e credencial apagada." });
      else if (!r.ok) setMsg({ ok: false, texto: r.erro });
      await carregar();
    } finally { setOcupado(null); }
  }

  if (!unidadeId) return <p className="text-sm text-hf-muted">Selecione uma unidade.</p>;
  if (!info) return <p className="text-sm text-hf-muted">Carregando…</p>;
  if (!info.ok && !info.semTabelas) return <p className="rounded-xl bg-hf-danger/5 p-3 text-sm text-hf-danger">{info.erro}</p>;

  const est = ESTADOS[info.status] || ESTADOS.NOT_CONFIGURED;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${est.cls}`}><est.Icone size={14} /> {est.rotulo}</span>
        {info.lojaNome && info.status === "CONNECTED" && <span className="text-sm text-hf-text-2">Loja: <b>{info.lojaNome}</b></span>}
        {info.ultimoTeste && <span className="text-xs text-hf-muted">Último teste: {new Date(info.ultimoTeste).toLocaleString("pt-BR")}</span>}
      </div>
      {info.semTabelas && <p className="rounded-xl bg-hf-warning/10 p-3 text-sm text-hf-text">{info.erro}</p>}
      {!info.semTabelas && !info.cofreConfigurado && (
        <p className="rounded-xl bg-hf-warning/10 p-3 text-sm text-hf-text">O servidor ainda não tem a chave do cofre (variável <code>INTEGRATION_MASTER_KEY</code> na Vercel). Sem ela o Client Secret não é guardado.</p>
      )}
      {info.ultimoErro && info.status !== "CONNECTED" && <p className="rounded-xl bg-hf-danger/5 p-3 text-sm text-hf-danger">{info.ultimoErro}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-hf-text-2">Merchant ID (ID da loja)</span>
          <input className={`${input} font-mono`} value={f.merchantId} onChange={(e) => setF({ ...f, merchantId: e.target.value })} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autoComplete="off" spellCheck={false} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-hf-text-2">Client ID</span>
          <input className={`${input} font-mono`} value={f.clientId} onChange={(e) => setF({ ...f, clientId: e.target.value })} placeholder={info.temClientId ? `salvo: ${info.clientIdMascarado}` : "do aplicativo no iFood"} autoComplete="off" spellCheck={false} /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-hf-text-2">Client Secret</span>
          <div className="relative">
            <input type={ver ? "text" : "password"} className={`${input} pr-11 font-mono`} value={f.clientSecret} onChange={(e) => setF({ ...f, clientSecret: e.target.value })}
              placeholder={info.temSegredo ? "guardado — em branco mantém" : "do aplicativo no iFood"} autoComplete="new-password" spellCheck={false} />
            <button type="button" onClick={() => setVer(!ver)} aria-label={ver ? "Ocultar" : "Mostrar"} className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-hf-muted">{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div></label>
      </div>

      {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-hf-accent/10 text-hf-text" : "bg-hf-danger/5 text-hf-danger"}`}>{msg.texto}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!ocupado || info.semTabelas} onClick={() => acao("salvar", f)} className="inline-flex min-h-[44px] items-center rounded-xl bg-hf-accent px-4 text-sm font-bold text-hf-accent-fg disabled:opacity-50">{ocupado === "salvar" ? "Salvando…" : "Salvar"}</button>
        <button type="button" disabled={!!ocupado || !info.temSegredo} onClick={() => acao("testar")} className="inline-flex min-h-[44px] items-center rounded-xl border border-hf-border bg-hf-surface px-4 text-sm font-bold text-hf-text disabled:opacity-50">{ocupado === "testar" ? "Testando no iFood…" : "Testar conexão"}</button>
        {(info.temSegredo || info.status === "CONNECTED") && (
          <button type="button" disabled={!!ocupado} onClick={() => acao("desconectar")} className="inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-bold text-hf-danger hover:bg-hf-danger/5 disabled:opacity-50">{ocupado === "desconectar" ? "Desconectando…" : "Desconectar"}</button>
        )}
      </div>

      <details className="rounded-xl border border-hf-border bg-hf-surface p-3 text-sm text-hf-text-2">
        <summary className="cursor-pointer font-semibold text-hf-text">Onde encontrar esses dados</summary>
        <ol className="ml-5 mt-2 list-decimal space-y-1">
          <li>Entre no <b>Portal do Desenvolvedor do iFood</b> (developer.ifood.com.br) com a conta da empresa e crie um aplicativo do tipo <b>centralizado</b> com acesso ao módulo <b>Merchant</b> (e Order/Financial para pedidos e repasses).</li>
          <li>Nas credenciais do aplicativo estão o <b>Client ID</b> e o <b>Client Secret</b>.</li>
          <li>No <b>Portal do Parceiro</b> (portal.ifood.com.br), o <b>Merchant ID</b> é o ID da loja. Autorize o aplicativo a acessar essa loja.</li>
          <li>Cole aqui, salve e toque em <b>Testar conexão</b>. Só fica “Conectado” se o iFood confirmar a loja.</li>
        </ol>
      </details>
    </div>
  );
}
