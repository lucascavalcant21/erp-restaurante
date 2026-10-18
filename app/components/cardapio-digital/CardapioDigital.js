"use client";

// Cardápio digital do cliente. Recebe o cardápio já montado no servidor
// (preço do minuto, pratos ligados à ficha técnica, vitrine do dono) e cuida
// da experiência: abertura com fotos e vídeos, nome do cliente, seções na
// lateral, busca e filtros, promoções, conversa, pedido.
//
// Celular em pé: seções numa gaveta. Celular deitado e tablet em pé: seções
// na lateral. Tablet deitado e computador: seções na lateral e o pedido à
// direita. Girar o aparelho só troca o layout (CSS): carrinho, conversa e o
// que já foi digitado continuam.
//
// `previa`: o editor do painel usa este mesmo componente para a prévia ao
// vivo — sem buscar nada, sem gravar no aparelho e sem enviar pedido.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ALargeSmall, Menu, MessageCircle, Minus, Plus, Search, Share2, ShoppingBag, WifiOff, X, RotateCcw } from "lucide-react";
import {
  aplicarNome, conferirCarrinho, filtrarProdutos, formatarPreco, primeiroNome, saudacao, totalDoCarrinho,
} from "../../lib/cardapio-digital.mjs";
import { Abertura, Aviso, Folha, Foto, ItemCartao, ItemLista, Miniatura, Preco, Selos } from "./partes";
import Conversa from "./Conversa";
import Pedido from "./Pedido";
import s from "./cardapio.module.css";

const ATUALIZAR_MS = 2 * 60 * 1000;
const chave = (u, k) => `hefisto-cardapio:${u}:${k}`;
function ler(k, padrao) {
  try { const v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; }
}
function gravar(k, v) {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* aba anônima */ }
}

function useMidia(consulta) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const mudou = () => setOk(m.matches);
    mudou();
    m.addEventListener?.("change", mudou);
    return () => m.removeEventListener?.("change", mudou);
  }, [consulta]);
  return ok;
}

const LATERAL = "(min-width: 768px), (orientation: landscape) and (min-width: 640px)";
const LARGO = "(min-width: 1024px)";

export default function CardapioDigital({ unidadeId, inicial = null, carregadoEm = null, mesa = "", pratoInicial = "", previa = false }) {
  const [cardapio, setCardapio] = useState(inicial);
  const [estado, setEstado] = useState(inicial ? "ok" : "carregando");
  const [cacheEm, setCacheEm] = useState(carregadoEm);
  const [montado, setMontado] = useState(false);

  const [nome, setNome] = useState("");
  const [rascunhoNome, setRascunhoNome] = useState("");
  const [pedirNome, setPedirNome] = useState(false);
  const [voltou, setVoltou] = useState(false);
  const [escala, setEscala] = useState(1);
  const [ultimo, setUltimo] = useState(null);

  const [carrinho, setCarrinho] = useState([]);
  const [etapa, setEtapa] = useState("carrinho");
  const [form, setForm] = useState({ nome: "", telefone: "", endereco: "", troco: "" });
  const [erros, setErros] = useState({});
  const [erroEnvio, setErroEnvio] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [selos, setSelos] = useState([]);
  const [promoAberta, setPromoAberta] = useState("");
  const [secaoAtiva, setSecaoAtiva] = useState("");

  const [prato, setPrato] = useState(null);
  const [qtdPrato, setQtdPrato] = useState(1);
  const [obsPrato, setObsPrato] = useState("");
  const [gaveta, setGaveta] = useState(false);
  const [pedidoAberto, setPedidoAberto] = useState(false);
  const [conversaAberta, setConversaAberta] = useState(false);
  const [consultaConversa, setConsultaConversa] = useState("");
  const [mensagens, setMensagens] = useState([]);
  const [aviso, setAviso] = useState(null);

  const fecharAviso = useCallback(() => setAviso(null), []);
  const pratoInicialAberto = useRef(false);
  const lateral = useMidia(LATERAL);
  const largo = useMidia(LARGO);
  const podePedir = !previa;
  const tipoPedido = mesa ? "qrcode" : "delivery";
  const chaveCarrinho = chave(unidadeId, `carrinho:${mesa || "delivery"}`);

  // A prévia do editor muda a cada toque do dono.
  useEffect(() => { if (previa) setCardapio(inicial); }, [previa, inicial]);

  // ── carga e atualização ──────────────────────────────────────────────────
  const buscar = useCallback(async () => {
    if (previa) return null;
    try {
      const r = await fetch(`/api/public/cardapio/${encodeURIComponent(unidadeId)}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.cardapio) {
        setCardapio(j.cardapio);
        setEstado("ok");
        setCacheEm(Date.now());
        gravar(chave(unidadeId, "cache"), { em: Date.now(), cardapio: j.cardapio });
        return j.cardapio;
      }
      if (r.status === 404) { setEstado("nao_encontrado"); return null; }
      throw new Error("indisponivel");
    } catch {
      const c = ler(chave(unidadeId, "cache"), null);
      setCardapio((atual) => {
        if (atual) return atual;
        if (c?.cardapio) { setCacheEm(c.em); return c.cardapio; }
        return null;
      });
      setEstado((e) => (c?.cardapio || e === "ok" || e === "offline" ? "offline" : "erro"));
      return null;
    }
  }, [previa, unidadeId]);

  useEffect(() => {
    setMontado(true);
    if (previa) return;
    if (!inicial) buscar();
    else gravar(chave(unidadeId, "cache"), { em: Date.now(), cardapio: inicial });
    const t = setInterval(buscar, ATUALIZAR_MS);
    const visivel = () => { if (!document.hidden) buscar(); };
    document.addEventListener("visibilitychange", visivel);
    window.addEventListener("online", buscar);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", visivel); window.removeEventListener("online", buscar); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── o que fica guardado no aparelho do cliente ───────────────────────────
  useEffect(() => {
    if (previa) { setNome("Lucas"); return; }
    const n = ler(chave(unidadeId, "nome"), "");
    // "Voltou" = já tinha vindo antes desta aba abrir. Guardado na sessão, a
    // resposta não muda se a página recarregar ou o efeito rodar de novo.
    let sessao = null;
    try { sessao = JSON.parse(sessionStorage.getItem(chave(unidadeId, "sessao")) || "null"); } catch { sessao = null; }
    if (!sessao) {
      sessao = { voltou: Number(ler(chave(unidadeId, "ultima-visita"), 0)) > 0 };
      try { sessionStorage.setItem(chave(unidadeId, "sessao"), JSON.stringify(sessao)); } catch { /* sem sessão */ }
    }
    gravar(chave(unidadeId, "ultima-visita"), Date.now());
    setNome(typeof n === "string" ? n : "");
    setForm((f) => ({ ...f, nome: typeof n === "string" ? n : "", telefone: ler(chave(unidadeId, "telefone"), "") || "", endereco: mesa ? "" : ler(chave(unidadeId, "endereco"), "") || "" }));
    setPedirNome(!n && !ler(chave(unidadeId, "pular-nome"), false));
    setVoltou(Boolean(sessao.voltou));
    setEscala(Number(ler(chave(unidadeId, "escala"), 1)) === 1.15 ? 1.15 : 1);
    setUltimo(ler(chave(unidadeId, "ultimo"), null));
    const c = ler(chaveCarrinho, []);
    if (Array.isArray(c)) setCarrinho(c.filter((i) => i && typeof i.id === "string" && Number.isInteger(i.quantidade)).slice(0, 50));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (montado && !previa) gravar(chaveCarrinho, carrinho); }, [carrinho, montado, previa, chaveCarrinho]);

  // Prato que saiu do cardápio sai do pedido (e o cliente fica sabendo).
  useEffect(() => {
    if (!cardapio || !carrinho.length) return;
    const { validos, removidos } = conferirCarrinho(carrinho, cardapio);
    if (removidos.length) {
      setCarrinho(validos.map(({ id, quantidade, observacao }) => ({ id, quantidade, observacao })));
      setAviso({ texto: removidos.length === 1 ? "Um item saiu do cardápio e foi tirado do seu pedido." : `${removidos.length} itens saíram do cardápio e foram tirados do seu pedido.` });
    }
  }, [cardapio]); // eslint-disable-line react-hooks/exhaustive-deps

  // Girou para o tablet deitado com o pedido aberto: ele já está à direita.
  useEffect(() => { if (largo) setPedidoAberto(false); }, [largo]);
  useEffect(() => { if (lateral) setGaveta(false); }, [lateral]);

  // ── derivados ────────────────────────────────────────────────────────────
  const porId = useMemo(() => new Map((cardapio?.produtos || []).map((p) => [p.id, p])), [cardapio]);
  const promoPorId = useMemo(() => new Map((cardapio?.promocoes || []).map((p) => [p.id, p])), [cardapio]);
  const qtdNoCarrinho = useMemo(() => new Map(carrinho.map((i) => [i.id, i.quantidade])), [carrinho]);
  const destaques = useMemo(() => (cardapio?.produtos || []).filter((p) => p.destaque).slice(0, 12), [cardapio]);
  const slides = useMemo(() => {
    if (!cardapio) return [];
    if (cardapio.banner?.length) return cardapio.banner;
    return cardapio.tema.capa_url ? [{ id: "capa", tipo: "imagem", url: cardapio.tema.capa_url, titulo: "", texto: "", acao: null }] : [];
  }, [cardapio]);
  const filtrando = Boolean(busca.trim() || selos.length || promoAberta);
  const resultados = useMemo(() => {
    if (!cardapio || !filtrando) return [];
    let lista = filtrarProdutos(cardapio.produtos, { selos, busca });
    if (promoAberta) {
      const ids = new Set(promoPorId.get(promoAberta)?.produto_ids || []);
      lista = lista.filter((p) => ids.has(p.id));
    }
    return lista;
  }, [cardapio, filtrando, selos, busca, promoAberta, promoPorId]);
  const totalCarrinho = cardapio ? totalDoCarrinho(carrinho, cardapio, { tipo: tipoPedido }) : { total: 0 };
  const qtdTotal = carrinho.reduce((n, i) => n + i.quantidade, 0);

  const secoesMenu = useMemo(() => {
    if (!cardapio) return [];
    const l = [];
    if (cardapio.promocoes.length) l.push({ id: "promocoes", nome: "Promoções", total: cardapio.promocoes.length });
    if (destaques.length) l.push({ id: "destaques", nome: "A casa indica", total: destaques.length });
    for (const c of cardapio.categorias) l.push({ id: c.id, nome: c.nome, total: c.produto_ids.length });
    return l;
  }, [cardapio, destaques]);

  // Seção que está na tela (a lateral acompanha a rolagem).
  useEffect(() => {
    if (!cardapio || filtrando) return;
    const els = [...document.querySelectorAll("[data-secao]")];
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver((entradas) => {
      const visiveis = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visiveis[0]) setSecaoAtiva(visiveis[0].target.getAttribute("data-secao"));
    }, { rootMargin: "-25% 0px -65% 0px" });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [cardapio, filtrando]);

  // ── ações ────────────────────────────────────────────────────────────────
  const irParaSecao = useCallback((id) => {
    setGaveta(false);
    setBusca(""); setSelos([]); setPromoAberta(""); setBuscaAberta(false);
    setTimeout(() => {
      const el = document.getElementById(`secao-${id}`);
      if (!el) return;
      const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
      setSecaoAtiva(id);
    }, 30);
  }, []);

  const abrirPrato = useCallback((id) => {
    if (!porId.has(id)) return;
    const noCarrinho = carrinho.find((i) => i.id === id);
    setPrato(id);
    setQtdPrato(1);
    setObsPrato(noCarrinho?.observacao || "");
  }, [porId, carrinho]);

  // Link de um prato (?prato=): abre o prato uma vez, quando o cardápio chega.
  useEffect(() => {
    if (pratoInicialAberto.current || !pratoInicial || !porId.has(pratoInicial)) return;
    pratoInicialAberto.current = true;
    abrirPrato(pratoInicial);
  }, [porId, pratoInicial, abrirPrato]);

  const adicionar = useCallback((id, quantidade = 1, observacao) => {
    const p = porId.get(id);
    if (!p || previa) return;
    setCarrinho((c) => {
      const i = c.findIndex((x) => x.id === id);
      if (i < 0) return [...c, { id, quantidade: Math.min(50, quantidade), observacao: observacao || "" }].slice(0, 50);
      const novo = [...c];
      novo[i] = { ...novo[i], quantidade: Math.min(50, novo[i].quantidade + quantidade), observacao: observacao ?? novo[i].observacao };
      return novo;
    });
    if (etapa === "enviado") setEtapa("carrinho");
    setAviso({ texto: `${p.nome} no pedido`, acao: largo ? null : { rotulo: "Ver pedido", fazer: () => setPedidoAberto(true) } });
  }, [porId, previa, etapa, largo]);

  const alterarQtd = (id, delta) => setCarrinho((c) => c.map((i) => (i.id === id ? { ...i, quantidade: Math.max(1, Math.min(50, i.quantidade + delta)) } : i)));
  const definirObs = (id, observacao) => setCarrinho((c) => c.map((i) => (i.id === id ? { ...i, observacao: observacao.slice(0, 200) } : i)));
  const remover = (id) => {
    const antes = carrinho;
    setCarrinho((c) => c.filter((i) => i.id !== id));
    setAviso({ texto: "Item tirado do pedido", acao: { rotulo: "Desfazer", fazer: () => setCarrinho(antes) } });
  };

  const salvarNome = (e) => {
    e?.preventDefault();
    const n = primeiroNome(rascunhoNome) ? rascunhoNome.trim().slice(0, 60) : "";
    if (!n) return;
    setNome(n);
    setForm((f) => ({ ...f, nome: f.nome || n }));
    setPedirNome(false);
    if (!previa) gravar(chave(unidadeId, "nome"), n);
  };
  const pularNome = () => { setPedirNome(false); if (!previa) gravar(chave(unidadeId, "pular-nome"), true); };
  const trocarNome = () => { setRascunhoNome(nome); setPedirNome(true); };

  const pedirDeNovo = () => {
    if (!ultimo?.itens?.length || !cardapio) return;
    const { validos, removidos } = conferirCarrinho(ultimo.itens, cardapio);
    validos.forEach((i) => adicionar(i.id, i.quantidade));
    setAviso({ texto: removidos.length ? `${validos.length} de volta ao pedido; ${removidos.length} não está mais no cardápio.` : "Seu último pedido está de volta.", acao: largo ? null : { rotulo: "Ver pedido", fazer: () => setPedidoAberto(true) } });
  };

  const compartilhar = async (p) => {
    const url = `${window.location.origin}/cardapio/${encodeURIComponent(unidadeId)}?prato=${encodeURIComponent(p.id)}${mesa ? `&mesa=${encodeURIComponent(mesa)}` : ""}`;
    try {
      if (navigator.share) { await navigator.share({ title: p.nome, text: `${p.nome} — ${cardapio.unidade.nome}`, url }); return; }
      await navigator.clipboard.writeText(url);
      setAviso({ texto: "Link do prato copiado" });
    } catch { /* cliente cancelou */ }
  };

  const enviar = async () => {
    const e = {};
    const tel = form.telefone.replace(/\D/g, "");
    if (form.nome.trim().length < 2) e.nome = "Digite seu nome.";
    if (!mesa || tel.length) { if (tel.length < 10 || tel.length > 13) e.telefone = "WhatsApp com DDD, só números."; }
    if (!mesa && !form.endereco.trim()) e.endereco = "Digite o endereço de entrega.";
    setErros(e);
    setErroEnvio("");
    if (Object.keys(e).length) return;
    setEnviando(true);
    const mostrado = totalCarrinho.total;
    try {
      const r = await fetch("/api/public/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unidade: unidadeId,
          cliente: { tipo: tipoPedido, nome: form.nome.trim(), telefone: form.telefone.trim() || null, endereco: mesa ? null : form.endereco.trim(), troco: mesa ? null : form.troco.trim() || null, mesa: mesa || null },
          itens: carrinho.map((i) => ({ id: i.id, quantidade: i.quantidade, observacao: i.observacao || "" })),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErroEnvio(j.erro || "Não foi possível enviar agora. Tente de novo.");
        if (j.codigo === "item_indisponivel") buscar();
        return;
      }
      setResultado({ total: j.total, taxa: j.taxa || 0, itens: j.itens || [], mostrado });
      const ult = { em: Date.now(), itens: carrinho.map(({ id, quantidade }) => ({ id, quantidade })) };
      setUltimo(ult);
      gravar(chave(unidadeId, "ultimo"), ult);
      gravar(chave(unidadeId, "telefone"), form.telefone.trim());
      if (!mesa) gravar(chave(unidadeId, "endereco"), form.endereco.trim());
      if (!nome && form.nome.trim()) { setNome(form.nome.trim()); gravar(chave(unidadeId, "nome"), form.nome.trim()); }
      setCarrinho([]);
      setEtapa("enviado");
      if (!largo) setPedidoAberto(true);
    } catch {
      setErroEnvio("Sem conexão. Confira a internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const mudarEscala = () => { const n = escala === 1 ? 1.15 : 1; setEscala(n); if (!previa) gravar(chave(unidadeId, "escala"), n); };
  const abrirConversa = (consulta = "") => { setConsultaConversa(consulta); setConversaAberta(true); };
  const acaoBanner = (a) => {
    if (a.tipo === "categoria") irParaSecao(a.id);
    else if (a.tipo === "produto") abrirPrato(a.id);
    else if (a.tipo === "promocao") { setPromoAberta(a.id); setTimeout(() => document.getElementById("resultado")?.scrollIntoView({ block: "start" }), 30); }
  };

  // ── estados sem cardápio ─────────────────────────────────────────────────
  if (!cardapio) {
    const cores = { "--c-fundo": "#f6f1e8", "--c-texto": "#221c16", "--c-suave": "#6b6259", "--c-primaria": "#9a3412", "--c-sobre": "#fff", "--c-cartao": "#fffdf8", "--c-linha": "#e4ddd2", "--c-destaque": "#9a3412", "--c-primaria-suave": "#f3e7dd" };
    return (
      <div className={s.raiz} style={cores}>
        <div className={s.vazio} style={{ paddingTop: 120 }}>
          {estado === "carregando" ? <strong>Abrindo o cardápio…</strong> : estado === "nao_encontrado" ? (
            <><strong>Cardápio não encontrado</strong><span>Confira o link ou o QR Code com a equipe.</span></>
          ) : (
            <><strong>Não conseguimos abrir o cardápio agora</strong><span>Pode ser a internet. Tente de novo em instantes.</span>
              <button type="button" className={s.primario} onClick={() => { setEstado("carregando"); buscar(); }}><RotateCcw size={18} aria-hidden="true" /> Tentar de novo</button></>
          )}
        </div>
      </div>
    );
  }

  const { cores, tema, textos, unidade } = cardapio;
  const estilo = {
    "--c-primaria": cores.primaria, "--c-sobre": cores.sobre_primaria, "--c-fundo": cores.fundo, "--c-texto": cores.texto,
    "--c-suave": cores.texto_suave, "--c-cartao": cores.cartao, "--c-linha": cores.linha, "--c-destaque": cores.destaque,
    "--c-primaria-suave": cores.suave_primaria, "--escala": escala,
  };
  const Item = tema.estilo_lista === "cartoes" ? ItemCartao : ItemLista;
  const listaClasse = tema.estilo_lista === "cartoes" ? s.grade : s.lista;
  const pAberto = prato ? porId.get(prato) : null;
  const n = primeiroNome(nome);
  const textoSaudacao = voltou && n
    ? `${saudacao()}, ${n}! Que bom te ver de novo.`
    : aplicarNome(textos.boas_vindas, { nome, saudacao: saudacao() });
  const ultimoValido = ultimo?.itens?.length ? conferirCarrinho(ultimo.itens, cardapio).validos.length : 0;
  const conversaLigada = cardapio.conversa.ativa;
  const secaoAtual = secoesMenu.find((x) => x.id === secaoAtiva);

  const listaSecoes = (
    <ul className={s.secoes}>
      {secoesMenu.map((x) => (
        <li key={x.id}>
          <button type="button" className={s.secaoBotao} aria-current={!filtrando && secaoAtiva === x.id ? "true" : undefined} onClick={() => irParaSecao(x.id)}>
            <span>{x.nome}</span><span className={s.secaoConta}>{x.total}</span>
          </button>
        </li>
      ))}
    </ul>
  );
  const marcas = (
    <span className={s.marcas}>
      {mesa ? <span className={s.marca}>Mesa {mesa}</span> : unidade.delivery_aberto ? <span className={s.marca}>Delivery aberto</span> : <span className={`${s.marca} ${s.marcaFechado}`}>Delivery fechado agora</span>}
      {!mesa && unidade.delivery_aberto && unidade.taxa_entrega > 0 ? <span className={s.marca}>Entrega {formatarPreco(unidade.taxa_entrega)}</span> : null}
    </span>
  );

  return (
    <div className={s.raiz} style={estilo} data-fonte={tema.fonte}>
      {tema.fundo_imagem_url ? <div className={s.fundoImagem} style={{ backgroundImage: `url("${tema.fundo_imagem_url}")`, opacity: tema.fundo_opacidade }} aria-hidden="true" /> : null}
      <div className={s.casca}>
        {/* lateral: celular deitado, tablet e computador */}
        <aside className={s.lateral} aria-label="Seções do cardápio">
          <div className={s.lateralTopo}>
            <Foto src={tema.logo_url} className={s.lateralLogo} />
            <p className={s.lateralNome}>{unidade.nome}</p>
            <p className={s.lateralSub}>{mesa ? `Mesa ${mesa}` : unidade.delivery_aberto ? "Delivery aberto" : "Delivery fechado agora"}</p>
          </div>
          {listaSecoes}
          {conversaLigada ? (
            <div className={s.lateralRodape}>
              <button type="button" className={`${s.secundario} ${s.largo}`} onClick={() => abrirConversa()}><MessageCircle size={18} aria-hidden="true" /> Me ajuda a escolher</button>
            </div>
          ) : null}
        </aside>

        <main className={s.conteudo}>
          <div className={s.barra}>
            {buscaAberta || lateral ? (
              <div className={s.buscaBarra}>
                <input className={s.campoBusca} type="search" value={busca} onChange={(e) => setBusca(e.target.value.slice(0, 60))} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" autoFocus={buscaAberta && !lateral} enterKeyHint="search" />
                {!lateral || busca ? <button type="button" className={s.icone} onClick={() => { setBusca(""); setBuscaAberta(false); }} aria-label="Fechar busca"><X size={20} aria-hidden="true" /></button> : null}
              </div>
            ) : (
              <>
                <button type="button" className={s.botaoSecoes} onClick={() => setGaveta(true)} aria-haspopup="dialog" aria-label="Abrir seções do cardápio">
                  <Menu size={18} aria-hidden="true" /><span>{filtrando ? "Seções" : secaoAtual?.nome || "Seções"}</span>
                </button>
                <button type="button" className={s.icone} onClick={() => setBuscaAberta(true)} aria-label="Buscar no cardápio"><Search size={20} aria-hidden="true" /></button>
              </>
            )}
            {conversaLigada ? <button type="button" className={s.icone} onClick={() => abrirConversa()} aria-label="Conversar com a casa"><MessageCircle size={20} aria-hidden="true" /></button> : null}
            <button type="button" className={s.icone} aria-pressed={escala !== 1} onClick={mudarEscala} aria-label="Letra maior"><ALargeSmall size={20} aria-hidden="true" /></button>
          </div>

          {estado === "offline" ? (
            <div className={s.aviso} role="status"><WifiOff size={18} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
              <span>Sem internet. Mostrando o cardápio de {cacheEm ? new Date(cacheEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "antes"}; os preços são conferidos no envio.</span>
            </div>
          ) : null}

          <Abertura slides={slides} onAcao={acaoBanner} previa={previa} />

          <header className={s.cabecalho}>
            {!slides.length ? <Foto src={tema.logo_url} className={s.cabecalhoLogo} /> : null}
            <h1 className={s.nomeLoja}>{unidade.nome}</h1>
            {textos.apresentacao ? <p className={s.apresentacao}>{textos.apresentacao}</p> : null}
            {marcas}
          </header>

          {montado ? (
            <section className={s.boasVindas} aria-label="Boas-vindas">
              {pedirNome ? (
                <form onSubmit={salvarNome}>
                  <p className={s.saudacao}>{textos.pedir_nome}</p>
                  <div className={s.formNome}>
                    <input value={rascunhoNome} onChange={(e) => setRascunhoNome(e.target.value.slice(0, 60))} placeholder="Seu primeiro nome" aria-label="Seu nome" autoComplete="given-name" enterKeyHint="done" />
                    <button type="submit" className={s.primario} disabled={!primeiroNome(rascunhoNome)}>Pronto</button>
                  </div>
                  <button type="button" className={s.link} onClick={pularNome}>Agora não</button>
                </form>
              ) : (
                <>
                  <p className={s.saudacao}>{textoSaudacao}</p>
                  <div className={s.boasVindasAcoes}>
                    {conversaLigada ? <button type="button" className={s.secundario} onClick={() => abrirConversa()}><MessageCircle size={17} aria-hidden="true" /> Me ajuda a escolher</button> : null}
                    {ultimoValido && podePedir ? <button type="button" className={s.secundario} onClick={pedirDeNovo}><RotateCcw size={17} aria-hidden="true" /> Pedir de novo</button> : null}
                    <button type="button" className={s.link} onClick={trocarNome}>{n ? `Não é ${n}?` : "Dizer meu nome"}</button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {cardapio.filtros.length ? (
            <div className={s.filtros} role="group" aria-label="Filtrar pratos">
              {cardapio.filtros.map((f) => {
                const ativo = selos.includes(f.id);
                return (
                  <button key={f.id} type="button" className={s.secundario} aria-pressed={ativo}
                    onClick={() => setSelos((l) => (ativo ? l.filter((x) => x !== f.id) : [...l, f.id]))}>{f.rotulo}</button>
                );
              })}
            </div>
          ) : null}

          {filtrando ? (
            <section id="resultado">
              <div className={s.voltarFiltro}>
                <h2>{promoAberta ? promoPorId.get(promoAberta)?.titulo || "Promoção" : busca.trim() ? `“${busca.trim()}”` : "Filtrados"}</h2>
                <button type="button" className={s.secundario} onClick={() => { setBusca(""); setSelos([]); setPromoAberta(""); setBuscaAberta(false); }}><X size={16} aria-hidden="true" /> Limpar</button>
              </div>
              {promoAberta && promoPorId.get(promoAberta) ? (
                <p className={s.secaoDescricao} style={{ margin: "6px 28px 0 18px" }}>{[promoPorId.get(promoAberta).rotulo, promoPorId.get(promoAberta).quando, promoPorId.get(promoAberta).texto].filter(Boolean).join(" · ")}</p>
              ) : null}
              <div className={s.secao} style={{ paddingTop: 8 }}>
                {resultados.length ? (
                  <ul className={listaClasse}>
                    {resultados.map((p) => <Item key={p.id} produto={p} promocao={p.promocao_id ? promoPorId.get(p.promocao_id) : null} qtd={qtdNoCarrinho.get(p.id)} onAbrir={abrirPrato} onAdicionar={adicionar} podePedir={podePedir} />)}
                  </ul>
                ) : (
                  <div className={s.vazio}>
                    <strong>Nada encontrado</strong>
                    <span>{busca.trim() ? `Não achamos “${busca.trim()}” no cardápio.` : "Nenhum prato com esses filtros."}</span>
                    {conversaLigada && busca.trim() ? <button type="button" className={s.secundario} onClick={() => abrirConversa(busca.trim())}><MessageCircle size={17} aria-hidden="true" /> Perguntar para a casa</button> : null}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <>
              {cardapio.promocoes.length ? (
                <section className={s.faixa} id="secao-promocoes" data-secao="promocoes" style={{ scrollMarginTop: 68 }}>
                  <h2 className={s.faixaTitulo}>Promoções</h2>
                  <div className={s.trilho}>
                    {cardapio.promocoes.map((p) => (
                      <button key={p.id} type="button" className={s.promo} onClick={() => (p.produto_ids.length ? acaoBanner({ tipo: "promocao", id: p.id }) : null)} disabled={!p.produto_ids.length} style={!p.produto_ids.length ? { cursor: "default" } : undefined}>
                        <Foto src={p.imagem_url} loading="lazy" />
                        <span className={s.promoCorpo}>
                          {p.rotulo ? <span className={s.promoRotulo}>{p.rotulo}</span> : null}
                          <span className={s.promoTitulo}>{p.titulo}</span>
                          {p.quando ? <span className={s.promoQuando}>{p.quando}</span> : null}
                          {p.texto ? <span className={s.promoTexto}>{p.texto}</span> : null}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {destaques.length ? (
                <section className={s.faixa} id="secao-destaques" data-secao="destaques" style={{ scrollMarginTop: 68 }}>
                  <h2 className={s.faixaTitulo}>A casa indica</h2>
                  <div className={s.trilho}>{destaques.map((p) => <Miniatura key={p.id} produto={p} onAbrir={abrirPrato} />)}</div>
                </section>
              ) : null}

              {cardapio.categorias.length ? cardapio.categorias.map((c) => (
                <section key={c.id} id={`secao-${c.id}`} data-secao={c.id} className={s.secao} aria-labelledby={`titulo-${c.id}`}>
                  <Foto src={c.imagem_url} className={s.secaoCapa} loading="lazy" />
                  <h2 className={s.secaoTitulo} id={`titulo-${c.id}`}>{c.nome}</h2>
                  {c.descricao ? <p className={s.secaoDescricao}>{c.descricao}</p> : null}
                  <ul className={listaClasse}>
                    {c.produto_ids.map((id) => {
                      const p = porId.get(id);
                      return p ? <Item key={id} produto={p} promocao={p.promocao_id ? promoPorId.get(p.promocao_id) : null} qtd={qtdNoCarrinho.get(id)} onAbrir={abrirPrato} onAdicionar={adicionar} podePedir={podePedir} /> : null;
                    })}
                  </ul>
                </section>
              )) : (
                <div className={s.vazio}><strong>O cardápio está sendo montado</strong><span>A equipe te mostra as opções de hoje.</span></div>
              )}
            </>
          )}

          <footer className={s.rodape}>
            {textos.rodape ? <p style={{ whiteSpace: "pre-line" }}>{textos.rodape}</p> : null}
            <p>Preços conferidos pelo restaurante no envio do pedido.</p>
          </footer>
        </main>

        <aside className={s.painelPedido} aria-label="Seu pedido">
          {largo ? (
            <Pedido cardapio={cardapio} carrinho={carrinho} etapa={etapa} setEtapa={setEtapa} mesa={mesa} form={form} setForm={setForm}
              erros={erros} erroEnvio={erroEnvio} enviando={enviando} onEnviar={enviar} resultado={resultado} nome={nome}
              alterarQtd={alterarQtd} definirObs={definirObs} remover={remover} adicionar={adicionar} onAbrirPrato={abrirPrato} modo="painel" previa={previa} />
          ) : null}
        </aside>
      </div>

      {!largo && podePedir && (qtdTotal > 0 || etapa === "enviado") && !pedidoAberto ? (
        <button type="button" className={s.barraPedido} onClick={() => setPedidoAberto(true)}>
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {qtdTotal ? <span className={s.barraPedidoQtd}>{qtdTotal}</span> : <ShoppingBag size={20} aria-hidden="true" />}
            {qtdTotal ? "Ver pedido" : "Pedido enviado"}
          </span>
          {qtdTotal ? <span>{formatarPreco(totalCarrinho.total)}</span> : null}
        </button>
      ) : null}

      {pedidoAberto && !largo ? (
        <Pedido cardapio={cardapio} carrinho={carrinho} etapa={etapa} setEtapa={setEtapa} mesa={mesa} form={form} setForm={setForm}
          erros={erros} erroEnvio={erroEnvio} enviando={enviando} onEnviar={enviar} resultado={resultado} nome={nome}
          alterarQtd={alterarQtd} definirObs={definirObs} remover={remover} adicionar={adicionar} onAbrirPrato={(id) => { setPedidoAberto(false); abrirPrato(id); }}
          modo="folha" onFechar={() => { setPedidoAberto(false); if (etapa === "enviado") setEtapa("carrinho"); }} previa={previa} />
      ) : null}

      {gaveta && !lateral ? (
        <Folha titulo="Seções" onFechar={() => setGaveta(false)} classe={s.gaveta}>
          {listaSecoes}
          <div className={s.lateralRodape}>
            <button type="button" className={`${s.secundario} ${s.largo}`} onClick={() => { setGaveta(false); setBuscaAberta(true); }}><Search size={18} aria-hidden="true" /> Buscar no cardápio</button>
          </div>
        </Folha>
      ) : null}

      {conversaAberta ? (
        <Conversa cardapio={cardapio} nome={nome} mensagens={mensagens} setMensagens={setMensagens} podePedir={podePedir}
          onFechar={() => { setConversaAberta(false); setConsultaConversa(""); }} onAbrirPrato={abrirPrato} onAdicionar={adicionar}
          onIrParaSecao={irParaSecao} consultaInicial={consultaConversa} />
      ) : null}

      {pAberto ? (
        <Folha rotulo={pAberto.nome} onFechar={() => setPrato(null)} semCabeca
          pe={podePedir ? (
            <div className={s.linhaAcoes}>
              <span className={s.contador}>
                <button type="button" onClick={() => setQtdPrato((q) => Math.max(1, q - 1))} aria-label="Menos um" disabled={qtdPrato <= 1}><Minus size={18} aria-hidden="true" /></button>
                <output aria-live="polite">{qtdPrato}</output>
                <button type="button" onClick={() => setQtdPrato((q) => Math.min(50, q + 1))} aria-label="Mais um"><Plus size={18} aria-hidden="true" /></button>
              </span>
              <button type="button" className={s.primario} onClick={() => { adicionar(pAberto.id, qtdPrato, obsPrato.trim()); setPrato(null); }}>
                Adicionar · {formatarPreco(pAberto.preco * qtdPrato)}
              </button>
            </div>
          ) : null}>
          <div className={s.folhaCorpo}>
            <Foto src={pAberto.imagem_url} className={s.detalheFoto} alt={pAberto.nome} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <h2 className={s.detalheNome}>{pAberto.nome}</h2>
              <span style={{ display: "flex", gap: 6, flex: "none" }}>
                {!previa ? <button type="button" className={s.fechar} onClick={() => compartilhar(pAberto)} aria-label="Compartilhar este prato"><Share2 size={18} aria-hidden="true" /></button> : null}
                <button type="button" className={s.fechar} onClick={() => setPrato(null)} aria-label="Fechar"><X size={20} aria-hidden="true" /></button>
              </span>
            </div>
            <div className={s.itemRodape} style={{ marginTop: 8 }}><Preco produto={pAberto} /><Selos produto={pAberto} promocao={pAberto.promocao_id ? promoPorId.get(pAberto.promocao_id) : null} /></div>
            {pAberto.descricao ? <p className={s.detalheDescricao}>{pAberto.descricao}</p> : null}
            {pAberto.promocao_id && promoPorId.get(pAberto.promocao_id)?.quando ? (
              <div className={s.detalheBloco}><strong>PROMOÇÃO</strong><span>{promoPorId.get(pAberto.promocao_id).titulo} · {promoPorId.get(pAberto.promocao_id).quando}</span></div>
            ) : null}
            {pAberto.harmoniza ? <div className={s.detalheBloco}><strong>VAI BEM COM</strong><span>{pAberto.harmoniza}</span></div> : null}
            {pAberto.alergenicos.length || pAberto.pode_conter ? (
              <div className={s.detalheBloco}>
                <strong>ALERGÊNICOS (DA FICHA DA COZINHA)</strong>
                {pAberto.alergenicos.length ? <span>Contém: {pAberto.alergenicos.join(", ")}.</span> : null}
                {pAberto.pode_conter ? <span>Pode conter: {pAberto.pode_conter}.</span> : null}
                <span style={{ color: "var(--c-suave)" }}>Tem alergia? Confirme com a equipe antes de pedir.</span>
              </div>
            ) : null}
            {podePedir ? (
              <label className={s.detalheBloco} style={{ display: "grid" }}>
                <strong>OBSERVAÇÃO</strong>
                <textarea className={s.observacao} value={obsPrato} onChange={(e) => setObsPrato(e.target.value.slice(0, 200))} placeholder="Ex.: sem cebola, molho à parte" />
              </label>
            ) : null}
          </div>
        </Folha>
      ) : null}

      <Aviso aviso={aviso} onFechar={fecharAviso} />
    </div>
  );
}
