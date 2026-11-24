"use client";

// PEDIDO DE CADASTRO — /cadastro?area=…&plano=…
//
// Decisão do dono (21/11/2026): quem chega pela página inicial faz um PEDIDO
// de cadastro na área escolhida; a conta continua sendo criada pelo
// administrador, com o perfil certo (o auto cadastro antigo deixava escolher o
// próprio papel, inclusive Administrador). O pedido passa só pela função
// hefisto_pedir_cadastro (db/publico/PUB_1_PEDIDOS_CADASTRO.sql), que confere
// tudo de novo e segura repetição.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import LogoHefisto from "../components/layout/LogoHefisto";
import IconeModulo from "../components/ui/IconeModulo";
import { supabase, isSupabaseReady } from "../lib/supabase";
import { AREAS, areaPorId, conferirPedido, mascaraWhatsApp, mensagemDoPedido } from "../lib/publico/areas.mjs";
import { PLANOS, periodoPorId } from "../lib/planos.mjs";

const campo = "w-full min-h-[48px] rounded-xl border border-hf-border bg-hf-surface px-4 text-base text-hf-text placeholder:text-hf-muted focus:border-hf-accent focus:outline-none focus:ring-2 focus:ring-hf-accent/30";

function Rotulo({ htmlFor, children, opcional = false }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-hf-text-2">
      {children}{opcional && <span className="font-normal text-hf-muted"> (opcional)</span>}
    </label>
  );
}

function Erro({ texto }) {
  return texto ? <p className="mt-1 text-sm text-hf-danger">{texto}</p> : null;
}

function Formulario() {
  const params = useSearchParams();
  const planoInicial = PLANOS[params.get("plano")] ? params.get("plano") : "gratis";
  const periodo = periodoPorId(params.get("periodo"));
  const [f, setF] = useState({
    area: areaPorId(params.get("area"))?.id || "",
    plano: planoInicial,
    nome: "", whatsapp: "", email: "", negocio: "", cidade: "", mensagem: "", aceite: false,
  });
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [falha, setFalha] = useState("");
  const [enviado, setEnviado] = useState(false);
  const mudar = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.type === "checkbox" ? e.target.checked : k === "whatsapp" ? mascaraWhatsApp(e.target.value) : e.target.value }));
  const area = areaPorId(f.area);

  async function enviar(e) {
    e.preventDefault();
    setFalha("");
    const c = conferirPedido(f);
    setErros(c.erros);
    if (!c.ok) return;
    if (!isSupabaseReady) { setFalha("O cadastro está indisponível agora. Tente de novo em instantes."); return; }
    setEnviando(true);
    const mensagem = [f.mensagem.trim(), periodo && f.plano === "completo" ? `Período escolhido: ${periodo.nome}.` : ""].filter(Boolean).join("\n");
    const { data, error } = await supabase.rpc("hefisto_pedir_cadastro", {
      p_area: f.area, p_plano: f.plano, p_nome: f.nome, p_whatsapp: f.whatsapp, p_email: f.email,
      p_negocio: f.negocio, p_cidade: f.cidade, p_mensagem: mensagem, p_aceite: f.aceite,
    });
    setEnviando(false);
    if (error) { setFalha("Não foi possível enviar agora. Tente de novo em instantes."); return; }
    const msg = mensagemDoPedido(data);
    if (msg) { setFalha(msg); return; }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="rounded-[22px] border border-hf-border bg-hf-surface p-6 text-center shadow-xs sm:p-8">
        <CheckCircle2 size={44} className="mx-auto text-hf-success" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Pedido recebido</h1>
        <p className="mt-2 text-base leading-relaxed text-hf-text-2">
          {area?.disponivel === false
            ? `Você está na lista da área ${area.nome}. Avisamos pelo WhatsApp quando ela abrir.`
            : "A equipe do Héfisto vai falar com você pelo WhatsApp para criar o seu acesso."}
        </p>
        <Link href="/" className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-hf-menu px-6 text-sm font-semibold text-white hover:opacity-90">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">Cadastre-se no Héfisto</h1>
        <p className="mt-2 text-base text-hf-text-2">Escolha a área e deixe seu contato. A equipe do Héfisto cria o seu acesso e fala com você pelo WhatsApp.</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-hf-text-2">Área</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AREAS.map((a) => {
            const ativo = f.area === a.id;
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => setF((v) => ({ ...v, area: a.id }))}
                className={`flex min-h-[60px] items-center gap-3 rounded-2xl border px-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent ${ativo ? "border-hf-menu bg-hf-elevated ring-1 ring-hf-menu" : "border-hf-border bg-hf-surface hover:bg-hf-elevated"}`}
              >
                <IconeModulo item={a} tamanho="sm" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{a.nome}</span>
                  {!a.disponivel && <span className="block text-xs text-hf-muted">Em breve · lista de espera</span>}
                </span>
              </button>
            );
          })}
        </div>
        <Erro texto={erros.area} />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-hf-text-2">Plano</legend>
        <div className="flex gap-1 rounded-full border border-hf-border bg-hf-surface p-1">
          {Object.values(PLANOS).map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={f.plano === p.id}
              onClick={() => setF((v) => ({ ...v, plano: p.id }))}
              className={`min-h-[44px] flex-1 rounded-full text-sm font-semibold transition ${f.plano === p.id ? "bg-hf-menu text-white" : "text-hf-text-2 hover:bg-hf-elevated"}`}
            >
              {p.nome}{periodo && p.id === "completo" && f.plano === "completo" ? ` · ${periodo.nome}` : ""}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Rotulo htmlFor="nome">Nome completo</Rotulo>
          <input id="nome" autoComplete="name" className={campo} value={f.nome} onChange={mudar("nome")} placeholder="Nome e sobrenome" />
          <Erro texto={erros.nome} />
        </div>
        <div>
          <Rotulo htmlFor="whatsapp">WhatsApp</Rotulo>
          <input id="whatsapp" type="tel" inputMode="tel" autoComplete="tel-national" className={campo} value={f.whatsapp} onChange={mudar("whatsapp")} placeholder="(00) 00000-0000" />
          <Erro texto={erros.whatsapp} />
        </div>
        <div>
          <Rotulo htmlFor="email">E-mail</Rotulo>
          <input id="email" type="email" inputMode="email" autoComplete="email" className={campo} value={f.email} onChange={mudar("email")} placeholder="nome@empresa.com.br" />
          <Erro texto={erros.email} />
        </div>
        <div>
          <Rotulo htmlFor="negocio" opcional>{area?.id === "consultorio" ? "Consultório ou clínica" : area?.id === "pessoal" ? "Profissão" : "Nome do negócio"}</Rotulo>
          <input id="negocio" autoComplete="organization" className={campo} value={f.negocio} onChange={mudar("negocio")} maxLength={120} />
        </div>
        <div>
          <Rotulo htmlFor="cidade" opcional>Cidade</Rotulo>
          <input id="cidade" autoComplete="address-level2" className={campo} value={f.cidade} onChange={mudar("cidade")} maxLength={80} />
        </div>
        <div className="sm:col-span-2">
          <Rotulo htmlFor="mensagem" opcional>Conte o que você precisa</Rotulo>
          <textarea id="mensagem" rows={3} className={`${campo} py-3`} value={f.mensagem} onChange={mudar("mensagem")} maxLength={900} />
        </div>
      </div>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-hf-border bg-hf-surface p-4">
          <input type="checkbox" checked={f.aceite} onChange={mudar("aceite")} className="mt-0.5 h-5 w-5 shrink-0 accent-hf-menu" />
          <span className="text-sm leading-relaxed text-hf-text-2">
            Aceito que o Héfisto use meu nome, WhatsApp e e-mail para entrar em contato sobre este cadastro. Veja a <Link href="/privacidade" className="font-semibold text-hf-text underline">política de privacidade</Link>.
          </span>
        </label>
        <Erro texto={erros.aceite} />
      </div>

      {falha && <p role="alert" className="rounded-xl border border-hf-danger/30 bg-hf-danger/5 px-4 py-3 text-sm text-hf-danger">{falha}</p>}

      <button type="submit" disabled={enviando} className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-hf-menu px-6 text-base font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
        {enviando ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Enviando…</> : "Enviar pedido de cadastro"}
      </button>
      <p className="text-center text-sm text-hf-muted">Já tem acesso? <Link href="/login" className="font-semibold text-hf-text underline">Entrar</Link></p>
    </form>
  );
}

export default function CadastroPage() {
  return (
    <div className="min-h-[100dvh] bg-hf-bg text-hf-text">
      <header className="border-b border-hf-border bg-hf-surface" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Héfisto, página inicial">
            <LogoHefisto className="h-8 w-8" />
            <span className="text-xl font-black tracking-tight">Héfisto</span>
          </Link>
          <Link href="/login" className="inline-flex min-h-[44px] items-center rounded-full border border-hf-border px-5 text-sm font-semibold hover:bg-hf-elevated">Entrar</Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<div className="py-16 text-center text-hf-muted">Carregando…</div>}>
          <Formulario />
        </Suspense>
      </main>
    </div>
  );
}
