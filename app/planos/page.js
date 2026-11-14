// PÁGINA PÚBLICA DE VENDAS E PLANOS — /planos
//
// Pedido do dono (14/11/2026): "vamos tornar o Héfisto um app vendável" e
// plano Grátis e Completo (R$ 89,90 por mês, semestral −20%, anual −40%). A raiz "/" continua indo ao
// login (é o start_url do app instalado no celular); esta é a página que se
// manda para quem ainda não é cliente.
//
// Sem depoimento, número de clientes ou métrica inventada: só o que o Héfisto
// faz. "Começar" abre o WhatsApp comercial (NEXT_PUBLIC_HEFISTO_WHATSAPP_COMERCIAL);
// sem número configurado, a página leva aos planos e avisa que o cadastro
// online está em preparação.

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import LogoHefisto from "../components/layout/LogoHefisto";
import SecaoPlanos from "./SecaoPlanos";
import IconeModulo from "../components/ui/IconeModulo";
import { PLANOS, linkComercial, precoNoPeriodo, precoTexto, reais } from "../lib/planos.mjs";

export const metadata = {
  title: "Héfisto · Planos e preços",
  description: `Sistema de gestão para restaurantes: cozinha, bar, salão, estoque, fichas técnicas, equipe e financeiro. Plano Grátis e plano Completo por ${precoTexto(PLANOS.completo)} por mês, com desconto no semestral e no anual.`,
};

const WHATSAPP_COMERCIAL = process.env.NEXT_PUBLIC_HEFISTO_WHATSAPP_COMERCIAL || "";

const RECURSOS = [
  { icone: "ChefHat", cor: "laranja", titulo: "Cozinha, Bar e Salão", texto: "Cada equipe abre só o que usa: produção do dia, KDS, etiquetas, checklists e comandas." },
  { icone: "Package", titulo: "Estoque de verdade", texto: "Entrada, retirada, contagem e saldo em garrafas, caixas e quilos, do jeito que a equipe fala." },
  { icone: "BookOpen", titulo: "Fichas técnicas e custo", texto: "Receita, rendimento, foto e custo de cada prato e drink, ligados ao estoque e ao cardápio." },
  { icone: "Smartphone", titulo: "Cardápio digital", texto: "Cardápio com QR Code na mesa, totem de autoatendimento e cardápio nas TVs do restaurante." },
  { icone: "Wallet", titulo: "Financeiro e lucro", texto: "Contas a pagar e a receber, caixa, DRE e CMV real para saber quanto sobra no bolso." },
  { icone: "Users", cor: "ciano", titulo: "Equipe e ponto", texto: "Ponto por reconhecimento facial, escala, folha, banco de horas e treinamento por função." },
  { icone: "Sparkles", titulo: "Assistente Héfisto", texto: "Pergunte por texto ou áudio: ficha técnica, entrada no estoque, etiquetas e o ponto da equipe." },
  { icone: "PartyPopper", titulo: "Eventos e marmitaria", texto: "Orçamento de eventos em etapas e marmitaria com precificação e painel de margens." },
];

const PERGUNTAS = [
  { p: "Funciona no celular e no tablet?", r: "Sim. O Héfisto abre no navegador e pode ser instalado como aplicativo no celular, no tablet e no computador." },
  { p: "O plano Grátis precisa de cartão?", r: "Não. O plano Grátis não tem cobrança." },
  { p: "Como posso pagar o Completo?", r: "Cartão de crédito, cartão de débito ou Pix, no mensal, no semestral (20% de desconto) ou no anual (40% de desconto). Semestral e anual são pagos de uma vez." },
  { p: "Quantas pessoas podem usar?", r: `No Grátis, até ${PLANOS.gratis.limites.usuarios} usuários em ${PLANOS.gratis.limites.unidades} unidade. No Completo, usuários e unidades sem limite.` },
  { p: "Cada funcionário vê tudo?", r: "Não. Cada pessoa recebe um perfil de acesso e só vê as telas da função dela; valores e custos podem ficar escondidos." },
];

export default function PlanosPublicos() {
  const linkHero = linkComercial(WHATSAPP_COMERCIAL, { plano: PLANOS.gratis });
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-hf-bg text-hf-text">
      <header className="sticky top-0 z-20 border-b border-hf-menu-border bg-hf-menu text-hf-menu-text" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/planos" className="flex items-center gap-2">
            <LogoHefisto className="h-8 w-8" />
            <span className="text-xl font-black tracking-tight">Héfisto</span>
          </Link>
          <Link href="/login" className="inline-flex min-h-[44px] items-center rounded-full border border-hf-menu-border px-5 text-sm font-semibold text-hf-menu-text hover:bg-hf-menu-hover">
            Entrar
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:px-6 sm:pt-20">
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-hf-accent">Gestão para restaurantes</p>
          <h1 className="mt-3 max-w-3xl text-[36px] font-semibold leading-[1.08] tracking-tight sm:text-[56px]">
            O restaurante inteiro em um sistema só, do estoque ao lucro.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-hf-text-2 sm:text-lg">
            Cozinha, bar, salão, estoque, fichas técnicas, equipe e financeiro conversando entre si, no celular, no tablet e no computador.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {linkHero && (
              <a href={linkHero} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-hf-menu px-7 text-base font-semibold text-white transition hover:opacity-90">
                Começar grátis <ArrowRight size={18} aria-hidden="true" />
              </a>
            )}
            <a href="#planos" className="inline-flex min-h-[52px] items-center justify-center rounded-full border-2 border-hf-text px-7 text-base font-semibold text-hf-text transition hover:bg-hf-elevated">
              Ver planos e preços
            </a>
          </div>
        </section>

        <section aria-labelledby="recursos" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 id="recursos" className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-hf-muted">O que o Héfisto faz</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
            {RECURSOS.map((r) => (
              <article key={r.titulo} className="flex flex-col gap-4 rounded-[22px] border border-hf-border bg-hf-surface p-5 shadow-xs">
                <IconeModulo item={r} tamanho="sm" />
                <div>
                  <h3 className="text-base font-semibold leading-snug">{r.titulo}</h3>
                  <p className="mt-1 text-sm leading-snug text-hf-muted">{r.texto}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="planos" aria-labelledby="titulo-planos" className="scroll-mt-20 bg-hf-elevated py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 id="titulo-planos" className="text-center text-[30px] font-semibold tracking-tight sm:text-[40px]">Dois planos. Sem letra miúda.</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-base text-hf-text-2">
              Comece grátis. Quando quiser tudo, o Completo custa {precoTexto(PLANOS.completo)} por mês, ou {reais(precoNoPeriodo(PLANOS.completo, "anual").porMesCentavos)} por mês no plano anual.
            </p>
            <div className="mt-8">
              <SecaoPlanos />
            </div>
          </div>
        </section>

        <section aria-labelledby="perguntas" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 id="perguntas" className="text-[26px] font-semibold tracking-tight">Perguntas frequentes</h2>
          <div className="mt-5 divide-y divide-hf-border overflow-hidden rounded-[22px] border border-hf-border bg-hf-surface shadow-xs">
            {PERGUNTAS.map((q) => (
              <details key={q.p} className="group px-5 py-4">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-base font-semibold">
                  {q.p}
                  <span aria-hidden="true" className="text-xl text-hf-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="pb-1 text-sm leading-relaxed text-hf-text-2">{q.r}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-hf-border bg-hf-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-hf-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2"><LogoHefisto className="h-6 w-6" /> Héfisto · Gestão para restaurantes</span>
          <span className="flex gap-5">
            <Link href="/privacidade" className="hover:text-hf-text">Privacidade</Link>
            <Link href="/login" className="hover:text-hf-text">Entrar</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
