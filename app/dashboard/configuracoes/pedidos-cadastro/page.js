"use client";

// Pedidos de cadastro que chegam pela página inicial (21/11/2026).
// Só o administrador da plataforma Héfisto lê (regra no banco,
// hefisto_eh_admin_plataforma); para os outros, a lista vem vazia.
// A conta continua sendo criada em Usuários e acessos.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircle, RefreshCw } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import IconeModulo from "../../../components/ui/IconeModulo";
import { supabase } from "../../../lib/supabase";
import { STATUS_PEDIDO, areaPorId, linkResposta, mascaraWhatsApp } from "../../../lib/publico/areas.mjs";
import { PLANOS } from "../../../lib/planos.mjs";

const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function PedidosDeCadastro() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("abertos");
  const [salvando, setSalvando] = useState("");

  async function carregar() {
    setErro("");
    const { data, error } = await supabase.from("hefisto_pedidos_cadastro")
      .select("id, area, plano, nome, whatsapp, email, negocio, cidade, mensagem, status, observacao, criado_em")
      .order("criado_em", { ascending: false }).limit(300);
    if (error) { setErro("Não foi possível carregar os pedidos."); setLista([]); return; }
    setLista(data || []);
  }
  useEffect(() => { carregar(); }, []);

  async function mudarStatus(p, status) {
    setSalvando(p.id);
    const { error } = await supabase.from("hefisto_pedidos_cadastro").update({ status }).eq("id", p.id);
    setSalvando("");
    if (error) { setErro("Não foi possível mudar o status."); return; }
    setLista((l) => l.map((x) => (x.id === p.id ? { ...x, status } : x)));
  }

  const visiveis = (lista || []).filter((p) => (filtro === "abertos" ? ["novo", "em_contato"].includes(p.status) : true));

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <CabecalhoTela titulo="Pedidos de cadastro" subtitulo="Quem pediu acesso pela página inicial">
        <button type="button" onClick={carregar} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold hover:bg-hf-elevated">
          <RefreshCw size={16} aria-hidden="true" /> Atualizar
        </button>
      </CabecalhoTela>

      <div className="mb-4 flex gap-2">
        {[["abertos", "Em aberto"], ["todos", "Todos"]].map(([id, nome]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} className={`min-h-[40px] rounded-full px-4 text-sm font-semibold ${filtro === id ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2"}`}>{nome}</button>
        ))}
      </div>

      {erro && <p role="alert" className="mb-4 rounded-xl border border-hf-danger/30 bg-hf-danger/5 px-4 py-3 text-sm text-hf-danger">{erro}</p>}
      {lista === null ? (
        <div className="flex justify-center py-16 text-hf-muted"><Loader2 className="animate-spin" aria-label="Carregando" /></div>
      ) : visiveis.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-hf-border bg-hf-surface p-8 text-center text-sm text-hf-muted">
          Nenhum pedido {filtro === "abertos" ? "em aberto" : "ainda"}. Os pedidos feitos em <Link href="/cadastro" className="font-semibold text-hf-text underline">/cadastro</Link> aparecem aqui.
        </p>
      ) : (
        <ul className="space-y-3">
          {visiveis.map((p) => {
            const area = areaPorId(p.area);
            const wa = linkResposta(p);
            return (
              <li key={p.id} className="rounded-[22px] border border-hf-border bg-hf-surface p-4 shadow-xs sm:p-5">
                <div className="flex items-start gap-3">
                  {area && <IconeModulo item={area} tamanho="sm" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">{p.nome}</p>
                    <p className="text-sm text-hf-muted">{area?.nome || p.area} · Plano {PLANOS[p.plano]?.nome || p.plano} · {quando(p.criado_em)}</p>
                    <p className="mt-1 break-words text-sm">{mascaraWhatsApp(p.whatsapp)} · {p.email}</p>
                    {(p.negocio || p.cidade) && <p className="text-sm text-hf-text-2">{[p.negocio, p.cidade].filter(Boolean).join(" · ")}</p>}
                    {p.mensagem && <p className="mt-2 whitespace-pre-line rounded-xl bg-hf-elevated px-3 py-2 text-sm text-hf-text-2">{p.mensagem}</p>}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-hf-menu px-4 text-sm font-semibold text-white">
                      <MessageCircle size={16} aria-hidden="true" /> Responder
                    </a>
                  )}
                  <label className="sr-only" htmlFor={`st-${p.id}`}>Situação</label>
                  <select id={`st-${p.id}`} value={p.status} disabled={salvando === p.id} onChange={(e) => mudarStatus(p, e.target.value)} className="min-h-[44px] rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-semibold">
                    {STATUS_PEDIDO.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  {p.status === "em_contato" && (
                    <Link href="/dashboard/configuracoes/usuarios" className="inline-flex min-h-[44px] items-center rounded-full border border-hf-border px-4 text-sm font-semibold hover:bg-hf-elevated">Criar a conta</Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
