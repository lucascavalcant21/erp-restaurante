"use client";

// Editor do cardápio digital. Tudo o que o cliente vê é editável aqui:
// cores, fundo, logo, abertura (fotos e vídeos), seções, pratos (nome
// comercial, descrição, foto, selos, destaque), promoções, conversa, textos
// e QR Codes. A prévia ao lado é o cardápio de verdade com o rascunho, em
// celular e tablet, em pé ou deitado.
//
// Antes esta tela só gerava QR Codes (por um site de fora) e apontava as
// mesas para o "Experience", que mostrava pratos de demonstração (B-028).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, Loader2, Save, UtensilsCrossed, X, ExternalLink } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { PageBody, PageHeader } from "../../../components/ui";
import {
  categoriasEfetivas, juntarProdutosEFichas, montarCardapioPublico, normalizarConfigCardapio,
} from "../../../lib/cardapio-digital.mjs";
import { carregarEditorCardapio, criarProdutoDaFicha, salvarEditorCardapio } from "../../../lib/cardapio-editor";
import { normalizarFidelidade } from "../../../lib/fidelidade.mjs";
import { caminhoDoCardapio } from "../../../lib/cardapio-link.mjs";
import { Aviso, Botao } from "../../../components/cardapio-digital/editor/ui";
import Aparencia from "../../../components/cardapio-digital/editor/Aparencia";
import Abertura from "../../../components/cardapio-digital/editor/Abertura";
import Secoes from "../../../components/cardapio-digital/editor/Secoes";
import Pratos from "../../../components/cardapio-digital/editor/Pratos";
import Promocoes from "../../../components/cardapio-digital/editor/Promocoes";
import Combos from "../../../components/cardapio-digital/editor/Combos";
import Textos from "../../../components/cardapio-digital/editor/Textos";
import QrCodes from "../../../components/cardapio-digital/editor/QrCodes";
import Idiomas from "../../../components/cardapio-digital/editor/Idiomas";
import Entrega from "../../../components/cardapio-digital/editor/Entrega";
import Fidelidade from "../../../components/cardapio-digital/editor/Fidelidade";
import Previa from "../../../components/cardapio-digital/editor/Previa";

// O que vende primeiro (pedido do dono, 27/10/2026: "um painel chamado
// Cardápio onde ponho combos, promoções e descontos, posição dos produtos e
// descrição"); a aparência e o resto depois.
const ABAS = [
  { id: "pratos", rotulo: "Produtos e posição" },
  { id: "combos", rotulo: "Combos" },
  { id: "promocoes", rotulo: "Promoções e descontos" },
  { id: "secoes", rotulo: "Seções" },
  { id: "aparencia", rotulo: "Aparência" },
  { id: "abertura", rotulo: "Abertura" },
  { id: "textos", rotulo: "Conversa e textos" },
  { id: "idiomas", rotulo: "Idiomas" },
  { id: "entrega", rotulo: "Entrega" },
  { id: "fidelidade", rotulo: "Fidelidade" },
  { id: "qr", rotulo: "Link e QR Code" },
];
const VAZIO = { fichas: {}, produtos: {}, unidade: {} };
const fichaAtiva = (f) => f.ativo !== false && (!f.status || ["ativa", "ativo"].includes(String(f.status).toLowerCase()));

export default function CardapioEditorPage() {
  const { unidadeAtiva } = useERP();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [config, setConfig] = useState(null);
  const [salvo, setSalvo] = useState("");
  const [pendentes, setPendentes] = useState(VAZIO);
  const [aba, setAba] = useState("pratos");
  // O painel novo (Cardápio → Produtos) abre o editor já na aba certa: ?aba=promocoes.
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get("aba");
    if (pedida && ABAS.some((a) => a.id === pedida)) setAba(pedida);
  }, []);
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [previaAberta, setPreviaAberta] = useState(false);
  const [idiomaPrevia, setIdiomaPrevia] = useState("pt");
  const [fidelidade, setFidelidade] = useState(null);
  const [fidelidadeSalva, setFidelidadeSalva] = useState("");

  const carregar = useCallback(async ({ manterRascunho = false } = {}) => {
    if (!unidadeAtiva) return;
    setErro("");
    const r = await carregarEditorCardapio(unidadeAtiva);
    if (r.erro) { setErro(r.erro); setDados(null); return; }
    setDados(r);
    if (!manterRascunho) {
      const c = normalizarConfigCardapio(r.config);
      setConfig(c);
      setSalvo(JSON.stringify(c));
      setPendentes(VAZIO);
      const f = normalizarFidelidade(r.fidelidade);
      setFidelidade(f);
      setFidelidadeSalva(JSON.stringify(f));
    }
  }, [unidadeAtiva]);

  useEffect(() => { setDados(null); setConfig(null); carregar(); }, [carregar]);

  const mudar = useCallback((fn) => { setConfig((c) => fn(c)); setResultado(null); }, []);
  const mudarPendentes = useCallback((fn) => { setPendentes(fn); setResultado(null); }, []);
  const temPendente = Object.keys(pendentes.fichas).length + Object.keys(pendentes.produtos).length + Object.keys(pendentes.unidade).length > 0;
  const setUnidade = useCallback((campos) => mudarPendentes((p) => ({ ...p, unidade: { ...p.unidade, ...campos } })), [mudarPendentes]);
  const mudarFidelidade = useCallback((fn) => { setFidelidade((f) => fn(f)); setResultado(null); }, []);
  const fidelidadeMudou = Boolean(fidelidade) && JSON.stringify(normalizarFidelidade(fidelidade)) !== JSON.stringify(normalizarFidelidade(JSON.parse(fidelidadeSalva || "{}")));
  const mudou = Boolean(config) && (temPendente || fidelidadeMudou || JSON.stringify(normalizarConfigCardapio(config)) !== JSON.stringify(normalizarConfigCardapio(JSON.parse(salvo || "{}"))));

  useEffect(() => {
    if (!mudou) return;
    const aviso = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [mudou]);

  // O que a prévia e as listas usam: banco + o que foi mexido e ainda não salvo.
  const juntos = useMemo(() => {
    if (!dados) return [];
    const produtos = dados.produtos.map((p) => (pendentes.produtos[p.id] ? { ...p, ...pendentes.produtos[p.id] } : p));
    const fichas = dados.fichas.map((f) => (pendentes.fichas[f.id] ? { ...f, ...pendentes.fichas[f.id] } : f));
    return juntarProdutosEFichas(produtos, fichas, dados.alergenicos, {
      fichasComFoto: dados.fichasComFoto,
      fotoDaFicha: (id) => `/api/public/cardapio/${encodeURIComponent(unidadeAtiva)}/foto/${encodeURIComponent(id)}`,
    });
  }, [dados, pendentes, unidadeAtiva]);

  const cardapio = useMemo(() => (dados && config
    ? montarCardapioPublico({ unidade: { ...dados.unidade, ...pendentes.unidade }, produtos: juntos, config, fidelidade })
    : null), [dados, config, juntos, pendentes.unidade, fidelidade]);

  const categorias = useMemo(() => {
    if (!config) return [];
    const base = categoriasEfetivas(normalizarConfigCardapio(config), juntos);
    return cardapio?.categorias.some((c) => c.id === "outros") && !base.some((c) => c.id === "outros")
      ? [...base, { id: "outros", nome: "Outros", descricao: "", imagem_url: "", visivel: true, papel: "outro" }] : base;
  }, [config, juntos, cardapio]);

  const fichasSemProduto = useMemo(() => {
    if (!dados) return [];
    const ligadas = new Set(dados.produtos.map((p) => String(p.ficha_id || "")));
    return dados.fichas.filter((f) => !f.eh_base && fichaAtiva(f) && !ligadas.has(String(f.id)))
      .sort((a, b) => String(a.nome_receita).localeCompare(String(b.nome_receita), "pt-BR"));
  }, [dados]);

  const salvar = async () => {
    setSalvando(true);
    setResultado(null);
    const r = await salvarEditorCardapio(unidadeAtiva, { config, fichas: pendentes.fichas, produtos: pendentes.produtos, unidade: pendentes.unidade, fidelidade });
    setSalvando(false);
    if (r.erros.length) { setResultado({ ok: false, texto: r.erros.join(" ") }); return; }
    setResultado({ ok: true, texto: "Salvo. O cardápio dos clientes já está assim." });
    setPendentes(VAZIO);
    await carregar();
  };

  const criarProduto = async (ficha, preco) => {
    const r = await criarProdutoDaFicha(unidadeAtiva, ficha, preco);
    if (!r.erro) await carregar({ manterRascunho: true });
    return r;
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <>
        <PageHeader title="Cardápio digital" icon={UtensilsCrossed} back={false} />
        <PageBody><Aviso>Escolha uma unidade no topo para editar o cardápio dela.</Aviso></PageBody>
      </>
    );
  }

  const opcoesBanner = {
    categorias: (cardapio?.categorias || []).map((c) => ({ id: c.id, nome: c.nome })),
    promocoes: (config?.promocoes || []).map((p) => ({ id: p.id, nome: p.titulo || "Sem nome" })),
    produtos: (cardapio?.produtos || []).map((p) => ({ id: p.id, nome: p.nome })),
  };

  return (
    <>
      <PageHeader title="Cardápio" subtitle="Cardápio da mesa (QR Code) e do delivery." icon={UtensilsCrossed} back={false}>
        <a href={caminhoDoCardapio(unidadeAtiva)} target="_blank" rel="noreferrer"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-4 text-sm font-bold text-hf-text hover:bg-hf-elevated md:flex-none">
          <ExternalLink size={16} /> Abrir cardápio
        </a>
        {/* Salvo: botão claro e legível (o verde apagado deixava o texto branco sumido). */}
        <Botao onClick={salvar} disabled={!mudou || salvando || !config} variante={mudou || salvando ? "primario" : "secundario"}
          className={`flex-1 md:flex-none ${mudou || salvando ? "" : "disabled:opacity-100"}`}>
          {salvando ? <Loader2 size={16} className="animate-spin" /> : mudou ? <Save size={16} /> : <Check size={16} className="text-hf-accent" />} {salvando ? "Salvando…" : mudou ? "Salvar" : "Tudo salvo"}
        </Botao>
      </PageHeader>
      <PageBody>
        {erro ? <Aviso tipo="alerta">{erro} <button type="button" className="font-semibold text-hf-accent underline" onClick={() => carregar()}>Tentar de novo</button></Aviso> : null}
        {resultado ? <Aviso tipo={resultado.ok ? "info" : "alerta"}>{resultado.texto}</Aviso> : null}
        {!dados || !config ? (
          !erro ? <p className="flex items-center gap-2 text-sm text-hf-muted"><Loader2 size={16} className="animate-spin" /> Carregando o cardápio…</p> : null
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0 space-y-4">
              {/* No celular as abas correm numa linha só (arrasta para o lado); a aba escolhida vem para a vista. */}
              <div role="tablist" aria-label="Partes do cardápio"
                className="-mx-3 flex snap-x gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:rounded-xl sm:bg-hf-elevated sm:p-1 [&::-webkit-scrollbar]:hidden">
                {ABAS.map((a) => (
                  <button key={a.id} type="button" role="tab" aria-selected={aba === a.id}
                    onClick={(e) => { setAba(a.id); e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" }); }}
                    className={`min-h-[40px] flex-none snap-start whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition sm:flex-auto sm:rounded-lg sm:border-0 sm:px-3 ${aba === a.id ? "border-hf-accent bg-hf-accent text-hf-accent-fg sm:bg-hf-surface sm:text-hf-text sm:shadow-sm" : "border-hf-border bg-hf-surface text-hf-text-2 hover:text-hf-text sm:bg-transparent"}`}>
                    {a.rotulo}
                  </button>
                ))}
              </div>
              {aba === "aparencia" ? <Aparencia config={config} mudar={mudar} unidadeId={unidadeAtiva} /> : null}
              {aba === "abertura" ? <Abertura config={config} mudar={mudar} unidadeId={unidadeAtiva} opcoes={opcoesBanner} /> : null}
              {aba === "secoes" ? <Secoes config={config} mudar={mudar} unidadeId={unidadeAtiva} produtos={juntos} /> : null}
              {aba === "pratos" ? (
                <Pratos config={config} mudar={mudar} unidadeId={unidadeAtiva} juntos={juntos} categorias={categorias}
                  pendentes={pendentes} setPendentes={mudarPendentes} fichasSemProduto={fichasSemProduto} onCriarProduto={criarProduto} />
              ) : null}
              {aba === "combos" ? <Combos config={config} mudar={mudar} unidadeId={unidadeAtiva} produtos={juntos} /> : null}
              {aba === "promocoes" ? <Promocoes config={config} mudar={mudar} unidadeId={unidadeAtiva} produtos={juntos} /> : null}
              {aba === "textos" ? <Textos config={config} mudar={mudar} /> : null}
              {aba === "idiomas" ? (
                <Idiomas config={config} mudar={mudar} produtos={cardapio?.produtos || []} categorias={categorias}
                  idiomaPrevia={idiomaPrevia} setIdiomaPrevia={setIdiomaPrevia} />
              ) : null}
              {aba === "entrega" ? <Entrega config={config} mudar={mudar} unidade={dados.unidade} pendenteUnidade={pendentes.unidade} setUnidade={setUnidade} /> : null}
              {aba === "fidelidade" && fidelidade ? (
                <Fidelidade fidelidade={fidelidade} setFidelidade={mudarFidelidade} produtos={cardapio?.produtos || []}
                  livroFidelidade={dados.livroFidelidade} unidadeId={unidadeAtiva} nomeLoja={dados.unidade.nome} />
              ) : null}
              {aba === "qr" ? <QrCodes unidadeId={unidadeAtiva} nomeLoja={dados.unidade.nome} mesasDoBanco={dados.mesas} config={config} mudar={mudar} /> : null}
            </div>
            <aside className="hidden xl:block">
              <div className="sticky top-24">
                <Previa unidadeId={unidadeAtiva} cardapio={cardapio} alturaMax={620} idioma={idiomaPrevia} onIdioma={setIdiomaPrevia} />
              </div>
            </aside>
          </div>
        )}
      </PageBody>

      {dados && config ? (
        <div className="fixed inset-x-3 bottom-3 z-30 flex gap-2 xl:hidden print:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <Botao variante="secundario" className="flex-1 shadow-lg" onClick={() => setPreviaAberta(true)}><Eye size={16} /> Ver prévia</Botao>
          {mudou ? <Botao className="flex-1 shadow-lg" onClick={salvar} disabled={salvando}>{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar</Botao> : null}
        </div>
      ) : null}

      {previaAberta && cardapio ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-hf-bg p-3" role="dialog" aria-modal="true" aria-label="Prévia do cardápio">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-bold text-hf-text">Prévia</p>
            <Botao variante="secundario" onClick={() => setPreviaAberta(false)} aria-label="Fechar prévia"><X size={16} /> Fechar</Botao>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Previa unidadeId={unidadeAtiva} cardapio={cardapio} alturaMax={typeof window !== "undefined" ? window.innerHeight - 260 : 600} idioma={idiomaPrevia} onIdioma={setIdiomaPrevia} />
          </div>
        </div>
      ) : null}
      <div className="h-20 xl:hidden" aria-hidden="true" />
    </>
  );
}
