// PÁGINA INICIAL DO HÉFISTO — "/"
//
// Pedido do dono (21/11/2026): "página inicial do Héfisto, sua gestão pessoal e
// de negócios", com Entrar e Cadastre-se no topo, cards das áreas que levam ao
// cadastro, planos e benefícios, dúvidas, formas de pagamento e feedbacks.
//
// Regras: preço, desconto e limites saem de app/lib/planos.mjs; as áreas de
// app/lib/publico/areas.mjs; depoimento só real e autorizado
// (app/lib/publico/depoimentos.mjs). Nenhum número de clientes ou métrica
// inventada. O app instalado no celular abre direto no login (start_url).

import Link from "next/link";
import {
  ArrowRight, BadgeCheck, CalendarClock, CreditCard, Eye, Layers, LineChart, MessageSquareQuote, QrCode, ShieldCheck, Smartphone, Sparkles,
} from "lucide-react";
import LogoHefisto from "./components/layout/LogoHefisto";
import JaLogado from "./components/publico/JaLogado";
import IconeModulo from "./components/ui/IconeModulo";
import PlanosDoInicio from "./components/publico/PlanosDoInicio";
import { AREAS, areaPorId } from "./lib/publico/areas.mjs";
import { depoimentosPublicaveis } from "./lib/publico/depoimentos.mjs";
import { FORMAS_PAGAMENTO, PERIODOS, PLANOS, precoNoPeriodo, precoTexto, reais } from "./lib/planos.mjs";

export const metadata = {
  title: "Héfisto · Sua gestão pessoal e de negócios",
  description: `Restaurante, delivery, eventos e consultório no mesmo app, com custo, preço e lucro de cada negócio. Plano Grátis e plano Completo por ${precoTexto(PLANOS.completo)} por mês.`,
};

const BENEFICIOS = [
  { Icone: LineChart, titulo: "O lucro de cada negócio", texto: "Cada área tem o próprio resultado: o que entrou, o que saiu e quanto sobrou, sem misturar uma com a outra." },
  { Icone: BadgeCheck, titulo: "Preço que dá lucro", texto: "Prato, marmita, evento ou consulta: o preço sai de todos os custos, impostos e taxas, e você vê a margem antes de vender." },
  { Icone: Eye, titulo: "Nada de número chutado", texto: "Quando falta informação para uma conta, o Héfisto avisa o que falta em vez de mostrar um valor que não existe." },
  { Icone: ShieldCheck, titulo: "Cada pessoa vê o que precisa", texto: "Perfis de acesso por função. Valores, custos e dados de pacientes ficam só com quem pode ver." },
  { Icone: Smartphone, titulo: "No celular, no tablet e no computador", texto: "Abre no navegador e pode ser instalado como aplicativo. A tela se ajusta a cada aparelho." },
  { Icone: Sparkles, titulo: "Assistentes Jhon e Nico", texto: "No Completo, o Jhon responde ao dono sobre custo e CMV, e o Nico ajuda a equipe no dia a dia." },
];

const PERGUNTAS = [
  { p: "Como faço o cadastro?", r: "Escolha a área, deixe seu nome, WhatsApp e e-mail. A equipe do Héfisto entra em contato e cria o seu acesso com o perfil certo. Por segurança, ninguém cria conta sozinho." },
  { p: "O plano Grátis precisa de cartão?", r: "Não. O plano Grátis não tem cobrança." },
  { p: "Posso usar mais de um negócio na mesma conta?", r: `No Grátis, ${PLANOS.gratis.limites.negocios} negócio e ${PLANOS.gratis.limites.usuarios} usuário. No Completo, negócios, unidades e usuários sem limite.` },
  { p: "Como pago o plano Completo?", r: "Por Pix, no mensal, no semestral (20% de desconto) ou no anual (40% de desconto). Semestral e anual são pagos de uma vez. Cartão de crédito e débito: em breve." },
  { p: "Funciona no celular?", r: "Sim. O Héfisto abre no navegador e pode ser instalado como aplicativo no celular, no tablet e no computador." },
  { p: "Os meus dados ficam separados dos de outras empresas?", r: "Sim. Cada empresa só enxerga os próprios dados, e isso é conferido no banco de dados, não só na tela." },
  { p: "A teleconsulta do consultório é gravada?", r: "Não. O Héfisto guarda o aceite do termo pelo paciente e o registro do atendimento na ficha; o vídeo não é gravado." },
  { p: "O consultório e a gestão pessoal têm preço à parte?", r: "Não. Todas as áreas estão no mesmo plano: no Completo, você usa restaurante, delivery, eventos, consultório e, quando abrir, a gestão pessoal, sem custo a mais." },
  { p: "E a gestão pessoal?", r: "Está em preparação. Faça o pedido de cadastro na área Gestão pessoal para entrar na lista e ser avisado quando abrir." },
];

function BotaoTopo({ href, children, escuro = false }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent sm:px-5 ${escuro
        ? "bg-hf-menu text-white hover:opacity-90"
        : "border border-hf-border bg-hf-surface text-hf-text hover:bg-hf-elevated"}`}
    >
      {children}
    </Link>
  );
}

function CardDaArea({ area }) {
  return (
    <Link
      href={`/cadastro?area=${area.id}`}
      className="group flex h-full flex-col gap-4 rounded-[22px] border border-hf-border bg-hf-surface p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-hf-accent hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <IconeModulo item={area} tamanho="lg" />
        {!area.disponivel && <span className="rounded-full bg-hf-elevated px-3 py-1 text-xs font-semibold text-hf-muted">Em breve</span>}
      </div>
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{area.nome}</h3>
        <p className="mt-1 text-sm leading-snug text-hf-text-2">{area.chamada}</p>
      </div>
      <ul className="space-y-1.5 text-sm text-hf-muted">
        {area.pontos.map((p) => (
          <li key={p} className="flex gap-2"><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-hf-accent" />{p}</li>
        ))}
      </ul>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-hf-text">
        {area.disponivel ? "Cadastrar" : "Entrar na lista"}
        <ArrowRight size={16} aria-hidden="true" className="transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Titulo({ id, chamada, titulo, texto }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-hf-accent">{chamada}</p>
      <h2 id={id} className="mt-2 text-[28px] font-semibold leading-tight tracking-tight sm:text-[38px]">{titulo}</h2>
      {texto && <p className="mt-3 text-base leading-relaxed text-hf-text-2">{texto}</p>}
    </div>
  );
}

export default function PaginaInicial() {
  const depoimentos = depoimentosPublicaveis();
  const anual = precoNoPeriodo(PLANOS.completo, "anual");
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-hf-bg text-hf-text">
      <JaLogado />
      <header className="sticky top-0 z-30 border-b border-hf-border bg-hf-surface/90 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="Héfisto, página inicial">
            <LogoHefisto className="h-8 w-8 shrink-0" />
            <span className="text-xl font-black tracking-tight">Héfisto</span>
          </Link>
          <nav aria-label="Seções" className="hidden items-center gap-6 text-sm font-medium text-hf-text-2 lg:flex">
            <a href="#areas" className="hover:text-hf-text">Áreas</a>
            <a href="#planos" className="hover:text-hf-text">Planos</a>
            <a href="#pagamento" className="hover:text-hf-text">Pagamento</a>
            <a href="#duvidas" className="hover:text-hf-text">Dúvidas</a>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <BotaoTopo href="/login">Entrar</BotaoTopo>
            <BotaoTopo href="/cadastro" escuro>Cadastre-se</BotaoTopo>
          </div>
        </div>
      </header>

      <main>
        <section className="hf-login-fundo">
          <span className="hf-login-mancha hf-login-mancha-1" aria-hidden="true" />
          <span className="hf-login-mancha hf-login-mancha-2" aria-hidden="true" />
          <span className="hf-login-mancha hf-login-mancha-3" aria-hidden="true" />
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-24">
            <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-hf-accent">Gestão pessoal e de negócios</p>
            <h1 className="mt-3 max-w-3xl text-[38px] font-semibold leading-[1.05] tracking-tight sm:text-[60px]">
              Héfisto, sua gestão pessoal e de negócios.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-hf-text-2 sm:text-lg">
              Restaurante, delivery, eventos e consultório no mesmo app, com o custo, o preço e o lucro de cada negócio. Em breve, também as suas contas pessoais.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#areas" className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-hf-menu px-7 text-base font-semibold text-white transition hover:opacity-90">
                Escolher minha área <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a href="#planos" className="inline-flex min-h-[52px] items-center justify-center rounded-full border-2 border-hf-text bg-hf-surface/60 px-7 text-base font-semibold text-hf-text transition hover:bg-hf-elevated">
                Ver planos e preços
              </a>
            </div>
            <p className="mt-6 text-sm text-hf-muted">Plano Grátis sem cartão · Completo por {precoTexto(PLANOS.completo)} por mês ou {reais(anual.porMesCentavos)} por mês no anual.</p>
          </div>
        </section>

        <section id="areas" aria-labelledby="titulo-areas" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <Titulo id="titulo-areas" chamada="Áreas" titulo="Escolha por onde começar" texto="Cada área tem as telas, as contas e o resultado do seu tipo de negócio. Toque na sua para pedir o cadastro." />
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AREAS.map((a) => <CardDaArea key={a.id} area={a} />)}
          </div>
        </section>

        <section aria-labelledby="titulo-beneficios" className="bg-hf-elevated py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Titulo id="titulo-beneficios" chamada="Benefícios" titulo="Feito para você ter certeza do lucro" />
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFICIOS.map(({ Icone, titulo, texto }) => (
                <article key={titulo} className="rounded-[22px] border border-hf-border bg-hf-surface p-5 shadow-xs">
                  <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-hf-menu text-white"><Icone size={22} strokeWidth={1.9} /></span>
                  <h3 className="mt-4 text-base font-semibold leading-snug">{titulo}</h3>
                  <p className="mt-1 text-sm leading-snug text-hf-muted">{texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="planos" aria-labelledby="titulo-planos" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <Titulo id="titulo-planos" chamada="Planos" titulo="Dois planos. Sem letra miúda." texto={`Comece grátis. Quando quiser tudo, o Completo custa ${precoTexto(PLANOS.completo)} por mês, ou ${reais(anual.porMesCentavos)} por mês no plano anual.`} />
            <div className="mt-8"><PlanosDoInicio /></div>
          </div>
        </section>

        <section id="pagamento" aria-labelledby="titulo-pagamento" className="scroll-mt-20 bg-hf-elevated py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Titulo id="titulo-pagamento" chamada="Formas de pagamento" titulo="Pague do jeito que preferir" texto="O plano Completo pode ser pago por mês ou de uma vez, com desconto." />
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {PERIODOS.map((p) => {
                const preco = precoNoPeriodo(PLANOS.completo, p.id);
                return (
                  <article key={p.id} className="rounded-[22px] border border-hf-border bg-hf-surface p-5 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-base font-semibold"><CalendarClock size={18} aria-hidden="true" /> {p.nome}</h3>
                      {p.descontoPct > 0 && <span className="rounded-full bg-hf-menu px-2.5 py-0.5 text-xs font-semibold text-white">−{p.descontoPct}%</span>}
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight">{reais(preco.totalCentavos)}</p>
                    <p className="text-sm text-hf-muted">
                      {p.meses === 1 ? "por mês" : `pago de uma vez · equivale a ${reais(preco.porMesCentavos)} por mês`}
                    </p>
                    {preco.economiaCentavos > 0 && <p className="mt-2 text-sm font-semibold text-hf-success">Economia de {reais(preco.economiaCentavos)}</p>}
                  </article>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FORMAS_PAGAMENTO.map((f) => {
                const Icone = f.id === "pix" ? QrCode : CreditCard;
                return (
                  <div key={f.id} className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 ${f.disponivel ? "border-hf-text bg-hf-surface" : "border-hf-border bg-hf-surface/60 text-hf-muted"}`}>
                    <Icone size={20} aria-hidden="true" />
                    <span className="text-sm font-semibold">{f.nome}</span>
                    <span className="ml-auto text-xs font-semibold">{f.disponivel ? "Disponível" : "Em breve"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="duvidas" aria-labelledby="titulo-duvidas" className="scroll-mt-20 mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <Titulo id="titulo-duvidas" chamada="Dúvidas" titulo="Perguntas frequentes" />
          <div className="mt-8 divide-y divide-hf-border overflow-hidden rounded-[22px] border border-hf-border bg-hf-surface shadow-xs">
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

        <section id="feedbacks" aria-labelledby="titulo-feedbacks" className="scroll-mt-20 bg-hf-elevated py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <Titulo id="titulo-feedbacks" chamada="Feedbacks" titulo="Quem usa o Héfisto" />
            {depoimentos.length > 0 ? (
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                {depoimentos.map((d) => (
                  <figure key={`${d.nome}-${d.autorizadoEm}`} className="rounded-[22px] border border-hf-border bg-hf-surface p-6 shadow-xs">
                    <MessageSquareQuote size={22} aria-hidden="true" className="text-hf-accent" />
                    <blockquote className="mt-3 text-base leading-relaxed">{d.texto}</blockquote>
                    <figcaption className="mt-4 text-sm">
                      <span className="font-semibold">{d.nome}</span>
                      {(d.negocio || areaPorId(d.area)) && <span className="text-hf-muted"> · {d.negocio || areaPorId(d.area).nome}</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="mx-auto mt-8 max-w-xl rounded-[22px] border border-dashed border-hf-border bg-hf-surface p-6 text-center shadow-xs">
                <MessageSquareQuote size={26} aria-hidden="true" className="mx-auto text-hf-accent" />
                <p className="mt-3 text-base font-semibold">Os depoimentos chegam com os primeiros clientes.</p>
                <p className="mt-1 text-sm leading-relaxed text-hf-muted">Publicamos só depoimentos reais, com o nome e a autorização de quem escreveu.</p>
                <Link href="/cadastro" className="mt-5 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-hf-menu px-6 text-sm font-semibold text-white hover:opacity-90">
                  Quero usar o Héfisto <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="bg-hf-menu text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-14 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white/70"><Layers size={16} aria-hidden="true" /> Um app, vários negócios</p>
              <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]">Comece pela sua área. As outras entram quando você quiser.</h2>
            </div>
            <Link href="/cadastro" className="hf-manter-dourado inline-flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-hf-text hover:bg-white/90">
              Cadastre-se <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-hf-border bg-hf-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-hf-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2"><LogoHefisto className="h-6 w-6" /> Héfisto · Gestão pessoal e de negócios</span>
          <span className="flex flex-wrap gap-5">
            <a href="#planos" className="hover:text-hf-text">Planos</a>
            <Link href="/privacidade" className="hover:text-hf-text">Privacidade</Link>
            <Link href="/login" className="hover:text-hf-text">Entrar</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
