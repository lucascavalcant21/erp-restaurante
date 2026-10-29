"use client";

// Cardápio digital do cliente. Recebe o cardápio já montado no servidor
// (preço do minuto, pratos ligados à ficha técnica, vitrine do dono) e cuida
// da experiência, em dois jeitos:
//   - MESA (QR da mesa, tablet na mesa): barra com a mesa, idioma, meus
//     pedidos e sacola; seções em blocos na lateral; pratos em cartão com
//     foto à esquerda e "Adicionar";
//   - DELIVERY (link do delivery): capa com logo redondo, cidade e se está
//     aberto; cartão de entrega (taxa, tempo, mínimo, grátis acima);
//     barra inferior no celular.
// Nos dois: oito idiomas (um botão, uma lista), nome do cliente, conversa,
// busca e filtros, promoções, meus pedidos com o andamento real.
//
// Celular em pé: seções numa gaveta e barra inferior. Celular deitado e
// tablet em pé: seções na lateral. Tablet deitado e computador: seções na
// lateral e o pedido à direita. Girar o aparelho só troca o layout (CSS):
// carrinho, conversa e o que já foi digitado continuam.
//
// `previa`: o editor do painel mostra este mesmo componente com o rascunho —
// sem gravar no aparelho e sem enviar pedido.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALargeSmall, Clock, Globe, Home, MessageCircle, Menu, Minus, Plus, Receipt, RotateCcw, Search, Share2,
  ShoppingBag, Tag, Truck, WifiOff, X, Check, Phone, MapPin, Gift, BellRing, Megaphone,
} from "lucide-react";
import {
  aplicarNome, cardapioDoCanal, canalDoPedido, conferirCarrinho, filtrarProdutos, formatarPreco, localizarCardapio, primeiroNome, saudacao, totalDoCarrinho,
} from "../../lib/cardapio-digital.mjs";
import { IDIOMAS, TEXTOS_PADRAO, detectarIdioma, infoIdioma, t } from "../../lib/cardapio-idiomas.mjs";
import { Abertura, Aviso, Folha, Foto, ItemCartao, ItemLista, Miniatura, Preco, Selos } from "./partes";
import DeliveryInicio from "./delivery/DeliveryInicio";
import DeliverySacola from "./delivery/DeliverySacola";
import DeliveryCheckout from "./delivery/DeliveryCheckout";
import DeliveryFidelidade from "./delivery/DeliveryFidelidade";
import ClienteArea from "./delivery/ClienteArea";
import TabletInicio from "./tablet/TabletInicio";
import { TemaCardapio } from "./ui";
import { caminhoDoCadastro } from "../../lib/cardapio-link.mjs";
import Conversa from "./Conversa";
import Pedido from "./Pedido";
import { CartaoFidelidade, DetalheFidelidade, cartoesDoPrato } from "./Fidelidade";
import { BotoesAtendimento } from "./Atendimento";
import { CapaViva, IconeTema, TrilhoSecoes, useVooParaSacola } from "./Vitrine";
import { iniciais, temaDoIcone, temaDoPrato } from "../../lib/cardapio-icones.mjs";
import { cashbackUsavel, descontoDoCadastro } from "../../lib/fidelidade.mjs";
import s from "./cardapio.module.css";

const ATUALIZAR_MS = 2 * 60 * 1000;
const PEDIDOS_MS = 20 * 1000;
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
const CELULAR = "(max-width: 767px)";
const ERROS_POR_CODIGO = {
  limite: "erro_limite", item_indisponivel: "erro_item", loja_fechada: "erro_fechado", pedido_minimo: "erro_minimo",
  cashback_telefone: "erro_cashback_tel", cashback_mudou: "erro_cashback", cashback_sem_saldo: "erro_cashback",
};
const UM_ANO = 365 * 86400000;

export default function CardapioDigital({ unidadeId, inicial = null, carregadoEm = null, mesa = "", pratoInicial = "", previa = false }) {
  const [base, setBase] = useState(inicial);
  const [estado, setEstado] = useState(inicial ? "ok" : "carregando");
  const [cacheEm, setCacheEm] = useState(carregadoEm);
  const [montado, setMontado] = useState(false);
  const [idioma, setIdioma] = useState("pt");

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
  const [meusPedidos, setMeusPedidos] = useState([]);
  const [andamento, setAndamento] = useState({ carregando: false, pedidos: [] });
  // Fidelidade: ids dos pedidos feitos neste aparelho (a prova para o servidor achar o telefone) e o saldo.
  const [fidPedidos, setFidPedidos] = useState([]);
  const [fidStatus, setFidStatus] = useState(null);
  const [usarCashback, setUsarCashback] = useState(false);
  const [cadastroLocal, setCadastroLocal] = useState(null); // { final, pct, aplica, usado } — cadastro pelo QR feito neste aparelho

  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [selos, setSelos] = useState([]);
  const [promoAberta, setPromoAberta] = useState("");
  const [secaoAtiva, setSecaoAtiva] = useState("");

  const [prato, setPrato] = useState(null);
  const [qtdPrato, setQtdPrato] = useState(1);
  const [obsPrato, setObsPrato] = useState("");
  const [folha, setFolha] = useState(""); // "", "secoes", "pedido", "idiomas", "pedidos", "info", "fidelidade", "atendimento"
  const [chamados, setChamados] = useState({}); // tipo → { estado: "enviando" | "ok", ate }
  const voarParaSacola = useVooParaSacola();
  const [conversaAberta, setConversaAberta] = useState(false);
  const [consultaConversa, setConsultaConversa] = useState("");
  const [mensagens, setMensagens] = useState([]);
  const [aviso, setAviso] = useState(null);

  const fecharAviso = useCallback(() => setAviso(null), []);
  const pratoInicialAberto = useRef(false);
  const lateral = useMidia(LATERAL);
  const largoTela = useMidia(LARGO);
  const celular = useMidia(CELULAR);
  const podePedir = !previa;
  const modo = mesa ? "mesa" : "delivery";
  // Tablet da mesa (tela larga): a tela nova do protótipo Main. O pedido abre
  // como folha (o "pedido ao lado" antigo saiu); no celular a mesa segue no layout antigo.
  const tabletNovo = largoTela && modo === "mesa";
  const largo = false;
  // Delivery: o cliente escolhe Entrega ou Retirada no checkout (se a loja aceita retirada).
  const [tipoEntrega, setTipoEntrega] = useState("delivery");
  const [pagamento, setPagamento] = useState("");
  const tipoPedido = mesa ? "qrcode" : tipoEntrega;
  const chaveCarrinho = chave(unidadeId, `carrinho:${mesa || "delivery"}`);

  // O cardápio no idioma do cliente (conteúdo traduzido pelo dono; o resto, fixo).
  // Só os pratos ligados no canal desta tela (QR da mesa ou delivery).
  const cardapio = useMemo(() => localizarCardapio(cardapioDoCanal(base, canalDoPedido(tipoPedido)), idioma), [base, idioma, tipoPedido]);
  const lingua = cardapio?.idioma || "pt";
  const T = useCallback((k, v) => t(lingua, k, v), [lingua]);

  // Prévia do editor: o painel (mesma origem, janela-mãe) manda o rascunho do
  // dono já montado, a cada mudança. Nada é gravado nem enviado na prévia.
  useEffect(() => {
    if (!previa) return;
    const aoReceber = (e) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return;
      if (e.data?.tipo === "hefisto-cardapio-previa" && e.data.cardapio?.produtos) { setBase(e.data.cardapio); setEstado("ok"); }
      if (e.data?.tipo === "hefisto-cardapio-previa-idioma" && typeof e.data.idioma === "string") setIdioma(e.data.idioma);
    };
    window.addEventListener("message", aoReceber);
    if (window.parent !== window) window.parent.postMessage({ tipo: "hefisto-cardapio-previa-pronta" }, window.location.origin);
    return () => window.removeEventListener("message", aoReceber);
  }, [previa]);

  // ── carga e atualização ──────────────────────────────────────────────────
  const buscar = useCallback(async () => {
    if (previa) return null;
    try {
      const r = await fetch(`/api/public/cardapio/${encodeURIComponent(unidadeId)}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.cardapio) {
        setBase(j.cardapio);
        setEstado("ok");
        setCacheEm(Date.now());
        gravar(chave(unidadeId, "cache"), { em: Date.now(), cardapio: j.cardapio });
        return j.cardapio;
      }
      if (r.status === 404) { setEstado("nao_encontrado"); return null; }
      throw new Error("indisponivel");
    } catch {
      const c = ler(chave(unidadeId, "cache"), null);
      setBase((atual) => {
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
    const tm = setInterval(buscar, ATUALIZAR_MS);
    const visivel = () => { if (!document.hidden) buscar(); };
    document.addEventListener("visibilitychange", visivel);
    window.addEventListener("online", buscar);
    return () => { clearInterval(tm); document.removeEventListener("visibilitychange", visivel); window.removeEventListener("online", buscar); };
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
    const salvo = ler(chave(unidadeId, "idioma"), "");
    setIdioma(salvo || detectarIdioma(typeof navigator !== "undefined" ? navigator.languages || [navigator.language] : []));
    const doisDias = Date.now() - 2 * 86400000;
    setMeusPedidos((ler(chave(unidadeId, "pedidos"), []) || []).filter((p) => p && typeof p.id === "string" && p.em > doisDias).slice(0, 10));
    const umAno = Date.now() - UM_ANO;
    setFidPedidos((ler(chave(unidadeId, "fid-pedidos"), []) || []).filter((p) => p && typeof p.id === "string" && p.em > umAno).slice(0, 10));
    const cad = ler(chave(unidadeId, "cadastro"), null);
    if (cad && /^\d{4}$/.test(String(cad.final || ""))) setCadastroLocal(cad);
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
      setAviso({ texto: removidos.length === 1 ? T("saiu_um") : T("saiu_varios", { n: removidos.length }) });
    }
  }, [base]); // eslint-disable-line react-hooks/exhaustive-deps

  // Girou para o tablet deitado com o pedido aberto: ele já está à direita.
  useEffect(() => { if (largo && folha === "pedido") setFolha(""); }, [largo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (lateral && folha === "secoes") setFolha(""); }, [lateral]); // eslint-disable-line react-hooks/exhaustive-deps
  // Abriu uma folha: o aviso de antes ("no pedido · ver pedido") já não serve e cobriria o conteúdo.
  useEffect(() => { if (folha) setAviso(null); }, [folha]);

  // Atendimento da mesa: o chamado vai para o Salão. "Avisado" fica 1 minuto
  // no botão; o servidor também não abre dois chamados iguais da mesma mesa.
  const chamar = useCallback(async (tipo) => {
    if (!mesa) return;
    if (previa) { setAviso({ texto: T("chamado_previa") }); return; }
    setChamados((c) => ({ ...c, [tipo]: { estado: "enviando" } }));
    try {
      const r = await fetch(`/api/public/experience/${encodeURIComponent(unidadeId)}/chamado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mesa, tipo, solicitanteNome: form.nome.trim() || null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.codigo || "falhou");
      setChamados((c) => ({ ...c, [tipo]: { estado: "ok", ate: Date.now() + 60000 } }));
      setAviso({ texto: j.jaAberto ? T("chamado_ja") : T(tipo === "conta" ? "chamado_conta_ok" : "chamado_ok", { mesa }) });
    } catch {
      setChamados((c) => { const n = { ...c }; delete n[tipo]; return n; });
      setAviso({ texto: T("chamado_erro") });
    }
  }, [mesa, previa, unidadeId, form.nome, T]);
  useEffect(() => {
    const ates = Object.values(chamados).map((c) => c.ate).filter(Boolean);
    if (!ates.length) return undefined;
    const espera = Math.max(0, Math.min(...ates) - Date.now());
    const id = setTimeout(() => setChamados((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => !v.ate || v.ate > Date.now()))), espera + 50);
    return () => clearTimeout(id);
  }, [chamados]);

  // Andamento dos pedidos deste aparelho, enquanto a lista está aberta.
  const atualizarPedidos = useCallback(async () => {
    if (previa || !meusPedidos.length) { setAndamento({ carregando: false, pedidos: [] }); return; }
    setAndamento((a) => ({ ...a, carregando: true }));
    try {
      const r = await fetch(`/api/public/pedidos/status?unidade=${encodeURIComponent(unidadeId)}&ids=${meusPedidos.map((p) => p.id).join(",")}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      setAndamento({ carregando: false, lido: r.ok, pedidos: r.ok ? j.pedidos || [] : [], erro: !r.ok });
    } catch {
      setAndamento((a) => ({ ...a, carregando: false, lido: false, erro: true }));
    }
  }, [previa, meusPedidos, unidadeId]);
  useEffect(() => {
    // No tablet o andamento fica na tela (o cartão "Pedido · Mesa"): acompanha sempre que há pedido.
    if (folha !== "pedidos" && !(tabletNovo && meusPedidos.length)) return;
    atualizarPedidos();
    const tm = setInterval(atualizarPedidos, PEDIDOS_MS);
    return () => clearInterval(tm);
  }, [folha, atualizarPedidos, tabletNovo, meusPedidos.length]);

  // Saldo de fidelidade deste aparelho. O servidor acha o telefone num pedido
  // concluído entre os que o aparelho fez; sem isso, só as regras aparecem.
  const temFidelidade = Boolean(base?.fidelidade);
  const carregarFidelidade = useCallback(async () => {
    if (previa || !temFidelidade) return;
    try {
      const ids = fidPedidos.map((p) => p.id).join(",");
      const r = await fetch(`/api/public/fidelidade?unidade=${encodeURIComponent(unidadeId)}&pedidos=${ids}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j) setFidStatus(j);
    } catch { /* sem conexão: fica o que já havia */ }
  }, [previa, temFidelidade, fidPedidos, unidadeId]);
  useEffect(() => { carregarFidelidade(); }, [carregarFidelidade]);
  useEffect(() => { if (folha === "fidelidade" || folha === "area" || folha === "pedidos") carregarFidelidade(); }, [folha]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Desconto do cadastro (estimativa: quem confirma é o servidor, no envio).
  const telFinal = form.telefone.replace(/\D/g, "").slice(-4);
  const descontoEstimado = cardapio?.fidelidade?.cadastro && cadastroLocal && telFinal === cadastroLocal.final
    && (cardapio.fidelidade.cadastro.aplica === "sempre" || !cadastroLocal.usado)
    ? descontoDoCadastro(totalCarrinho.base_cadastro || 0, cardapio.fidelidade.cadastro.desconto_pct) : 0;
  // Cashback: só com saldo conhecido e o mesmo WhatsApp (o servidor confere de novo).
  const saldoCashback = fidStatus?.identificado && fidStatus?.disponivel ? Number(fidStatus.cashback?.saldo) || 0 : 0;
  const cashbackPossivel = cardapio?.fidelidade?.cashback && saldoCashback > 0 && fidStatus?.final
    && telFinal === fidStatus.final
    ? cashbackUsavel(saldoCashback, (totalCarrinho.total || 0) - descontoEstimado, { ativo: true, cashback: { ...cardapio.fidelidade.cashback, ativo: true } }) : 0;
  const cashbackAplicado = usarCashback ? cashbackPossivel : 0;
  const infoCashback = {
    possivel: cashbackPossivel, usar: usarCashback, setUsar: setUsarCashback, final: fidStatus?.final || "", aplicado: cashbackAplicado,
    desconto: descontoEstimado, pctCadastro: cardapio?.fidelidade?.cadastro?.desconto_pct || 0,
  };
  const qtdTotal = carrinho.reduce((n, i) => n + i.quantidade, 0);

  const secoesMenu = useMemo(() => {
    if (!cardapio) return [];
    const l = [];
    if (cardapio.promocoes.length) l.push({ id: "promocoes", nome: T("promocoes"), total: cardapio.promocoes.length });
    if (destaques.length) l.push({ id: "destaques", nome: T("casa_indica"), total: destaques.length });
    for (const c of cardapio.categorias) l.push({ id: c.id, nome: c.nome, total: c.produto_ids.length, tema: temaDoIcone(c.nome, c.papel) });
    return l;
  }, [cardapio, destaques, T]);

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
    setFolha("");
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
    setAviso({ texto: T("no_pedido", { prato: p.nome }), acao: largo ? null : { rotulo: T("ver_pedido"), fazer: () => setFolha("pedido") } });
  }, [porId, previa, etapa, largo, T]);

  const alterarQtd = (id, delta) => setCarrinho((c) => c.map((i) => (i.id === id ? { ...i, quantidade: Math.max(1, Math.min(50, i.quantidade + delta)) } : i)));
  const definirObs = (id, observacao) => setCarrinho((c) => c.map((i) => (i.id === id ? { ...i, observacao: observacao.slice(0, 200) } : i)));
  const remover = (id) => {
    const antes = carrinho;
    setCarrinho((c) => c.filter((i) => i.id !== id));
    setAviso({ texto: T("item_tirado"), acao: { rotulo: T("desfazer"), fazer: () => setCarrinho(antes) } });
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
    setAviso({ texto: removidos.length ? T("de_volta_parcial", { n: validos.length, m: removidos.length }) : T("de_volta"), acao: largo ? null : { rotulo: T("ver_pedido"), fazer: () => setFolha("pedido") } });
  };

  const escolherIdioma = (id) => {
    setIdioma(id);
    if (!previa) gravar(chave(unidadeId, "idioma"), id);
    setMensagens([]); // a conversa recomeça no idioma novo
    setFolha("");
  };

  const compartilhar = async (p) => {
    const url = `${window.location.origin}/cardapio/${encodeURIComponent(unidadeId)}?prato=${encodeURIComponent(p.id)}${mesa ? `&mesa=${encodeURIComponent(mesa)}` : ""}`;
    try {
      if (navigator.share) { await navigator.share({ title: p.nome, text: `${p.nome} — ${cardapio.unidade.nome}`, url }); return; }
      await navigator.clipboard.writeText(url);
      setAviso({ texto: T("link_copiado") });
    } catch { /* cliente cancelou */ }
  };

  const enviar = async () => {
    const e = {};
    const tel = form.telefone.replace(/\D/g, "");
    if (form.nome.trim().length < 2) e.nome = T("erro_nome");
    if (!mesa || tel.length) { if (tel.length < 10 || tel.length > 13) e.telefone = T("erro_tel"); }
    if (tipoPedido === "delivery" && !form.endereco.trim()) e.endereco = T("erro_endereco");
    setErros(e);
    setErroEnvio("");
    if (Object.keys(e).length) return;
    setEnviando(true);
    const mostrado = Math.round((totalCarrinho.total - descontoEstimado - cashbackAplicado) * 100) / 100;
    try {
      const r = await fetch("/api/public/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unidade: unidadeId,
          cliente: { tipo: tipoPedido, nome: form.nome.trim(), telefone: form.telefone.trim() || null, endereco: tipoPedido === "delivery" ? form.endereco.trim() : null, troco: mesa || (pagamento && pagamento !== "dinheiro") ? null : form.troco.trim() || null, ...(mesa || !pagamento ? {} : { pagamento }), mesa: mesa || null },
          itens: carrinho.map((i) => ({ id: i.id, quantidade: i.quantidade, observacao: i.observacao || "" })),
          ...(cashbackAplicado > 0 ? { cashback: { usar: true, prova: fidPedidos.map((p) => p.id) } } : {}),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const k = ERROS_POR_CODIGO[j.codigo];
        setErroEnvio(k ? T(k, { valor: formatarPreco(cardapio.entrega?.pedido_minimo || 0, lingua) }) : lingua === "pt" && j.erro ? j.erro : T("erro_envio"));
        if (j.codigo === "item_indisponivel") buscar();
        if (String(j.codigo || "").startsWith("cashback")) { setUsarCashback(false); carregarFidelidade(); }
        return;
      }
      setResultado({ total: j.total, taxa: j.taxa || 0, cashback: j.cashback || 0, desconto: j.desconto || 0, itens: j.itens || [], mostrado });
      if (j.desconto > 0 && cadastroLocal && cardapio.fidelidade?.cadastro?.aplica !== "sempre") {
        const usado = { ...cadastroLocal, usado: true };
        setCadastroLocal(usado);
        gravar(chave(unidadeId, "cadastro"), usado);
      }
      const ult = { em: Date.now(), itens: carrinho.map(({ id, quantidade }) => ({ id, quantidade })) };
      setUltimo(ult);
      gravar(chave(unidadeId, "ultimo"), ult);
      if (j.id) {
        const lista = [{ id: j.id, em: Date.now() }, ...meusPedidos].slice(0, 10);
        setMeusPedidos(lista);
        gravar(chave(unidadeId, "pedidos"), lista);
        const fid = [{ id: j.id, em: Date.now() }, ...fidPedidos.filter((p) => p.id !== j.id)].slice(0, 10);
        setFidPedidos(fid);
        gravar(chave(unidadeId, "fid-pedidos"), fid);
      }
      setUsarCashback(false);
      gravar(chave(unidadeId, "telefone"), form.telefone.trim());
      if (!mesa) gravar(chave(unidadeId, "endereco"), form.endereco.trim());
      if (!nome && form.nome.trim()) { setNome(form.nome.trim()); gravar(chave(unidadeId, "nome"), form.nome.trim()); }
      setCarrinho([]);
      setEtapa("enviado");
      if (!largo) setFolha("pedido");
    } catch {
      setErroEnvio(T("sem_conexao"));
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
    const cores = { "--c-fundo": "#f4f4f4", "--c-texto": "#1a1a1a", "--c-suave": "#5c5c5c", "--c-primaria": "#14532d", "--c-sobre": "#fff", "--c-cartao": "#ffffff", "--c-linha": "#e3e3e3", "--c-destaque": "#14532d", "--c-primaria-suave": "#eaf4ee" };
    const T0 = (k) => t(idioma, k);
    return (
      <div className={s.raiz} style={cores}>
        <div className={s.vazio} style={{ paddingTop: 120 }}>
          {estado === "carregando" ? <strong>{T0("abrindo")}</strong> : estado === "nao_encontrado" ? (
            <><strong>{T0("nao_encontrado")}</strong><span>{T0("nao_encontrado_sub")}</span></>
          ) : (
            <><strong>{T0("erro_abrir")}</strong><span>{T0("erro_abrir_sub")}</span>
              <button type="button" className={s.primario} onClick={() => { setEstado("carregando"); buscar(); }}><RotateCcw size={18} aria-hidden="true" /> {T0("tentar_de_novo")}</button></>
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
  const textoSaudacao = aplicarNome(voltou && n ? TEXTOS_PADRAO[lingua].voltou : textos.boas_vindas, { nome, saudacao: saudacao(new Date(), undefined, lingua) });
  const ultimoValido = ultimo?.itens?.length ? conferirCarrinho(ultimo.itens, cardapio).validos.length : 0;
  const conversaLigada = cardapio.conversa.ativa;
  const secaoAtual = secoesMenu.find((x) => x.id === secaoAtiva);
  const idiomasOferecidos = IDIOMAS.filter((i) => (cardapio.idiomas || ["pt"]).includes(i.id));
  const cidade = [unidade.cidade, unidade.uf].filter(Boolean).join(" - ");
  const temInfo = Boolean(cidade || unidade.horario || unidade.endereco || unidade.telefone);
  const ent = cardapio.entrega || {};
  const hora = (iso) => new Date(iso).toLocaleTimeString(infoIdioma(lingua).locale, { hour: "2-digit", minute: "2-digit" });

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
  const botaoIdioma = idiomasOferecidos.length > 1 ? (
    <button type="button" className={s.idiomaBotao} onClick={() => setFolha("idiomas")} aria-label={`${T("idioma")}: ${infoIdioma(lingua).nome}`}>
      <Globe size={18} aria-hidden="true" /> {lingua.toUpperCase()}
    </button>
  ) : null;
  const catPorId = new Map(cardapio.categorias.map((c) => [c.id, c]));
  const adicionarComVoo = (id) => { adicionar(id); voarParaSacola(); };
  const linhaItem = (p) => (
    <Item key={p.id} produto={p} promocao={p.promocao_id ? promoPorId.get(p.promocao_id) : null} qtd={qtdNoCarrinho.get(p.id)}
      onAbrir={abrirPrato} onAdicionar={adicionarComVoo} podePedir={podePedir} idioma={lingua} comTexto={modo === "mesa"} cartoes={cartoesDoPrato(cardapio, p.id)} />
  );
  const rotuloEtapa = (p) => (p.etapa === "recebido" ? T("st_recebido") : p.etapa === "preparo" ? T("st_preparo")
    : p.etapa === "pronto" ? T(p.tipo === "mesa" ? "st_pronto_mesa" : "st_pronto_delivery") : p.etapa === "saiu" ? T("st_saiu")
      : p.etapa === "entregue" ? T("st_entregue") : p.etapa === "cancelado" ? T("st_cancelado") : T("st_andamento"));
  // Cartão "Pedido · Mesa" do tablet: o pedido mais recente que ainda não saiu da mesa.
  const emCurso = (andamento.pedidos || []).filter((p) => p.etapa !== "entregue" && p.etapa !== "cancelado")
    .sort((a, b) => String(b.criado_em || "").localeCompare(String(a.criado_em || "")))[0];
  const acompanhamento = tabletNovo && emCurso ? {
    etapa: rotuloEtapa(emCurso), pronto: emCurso.etapa === "pronto", hora: emCurso.criado_em ? hora(emCurso.criado_em) : "",
    itens: (emCurso.itens || []).map((i) => porId.get(i.produto_id)?.nome).filter(Boolean).join(", "),
  } : null;

  return (
    <div className={`${s.raiz} ${modo === "mesa" ? s.modoMesa : s.modoDelivery} ${celular && modo === "mesa" ? s.comNav : ""}`} style={estilo} data-fonte={tema.fonte} lang={infoIdioma(lingua).lang} data-cardapio="">
      {modo === "delivery" ? (
        <TemaCardapio cor={tema.cor_primaria} loja={tema}>
          <DeliveryInicio
            cardapio={cardapio} idioma={lingua} carrinho={carrinho} totalSacola={totalCarrinho.total || 0}
            offline={estado === "offline" ? T("sem_internet", { hora: cacheEm ? hora(cacheEm) : "—" }) : ""}
            secaoAtiva={secaoAtiva} busca={busca} buscaAberta={buscaAberta} onBusca={setBusca}
            onAbrirBusca={() => setBuscaAberta(true)} onFecharBusca={() => { setBusca(""); setBuscaAberta(false); }}
            resultados={resultados} filtrando={filtrando} onAbrirPrato={abrirPrato} onIrSecao={irParaSecao}
            onAbrirSacola={() => setFolha("pedido")} onAbrirIdiomas={() => setFolha("idiomas")} temIdiomas={idiomasOferecidos.length > 1}
            onAbrirInfo={() => setFolha("info")} temInfo={temInfo} onAjuda={() => abrirConversa()} temAjuda={conversaLigada}
            onAbrirPedidos={() => setFolha("pedidos")} qtdPedidos={meusPedidos.length}
            onAbrirDescontos={() => setFolha("fidelidade")} temDescontos={Boolean(cardapio.fidelidade)}
            linkCadastro={caminhoDoCadastro(unidadeId)} visitante={!cadastroLocal && !fidStatus?.identificado} podePedir={podePedir}
            banners={slides.length ? <div className={s.capa} style={{ height: "100%" }}><Abertura slides={slides} onAcao={acaoBanner} previa={previa} idioma={lingua} segundos={cardapio.carrossel?.segundos} porVez={cardapio.carrossel?.por_vez} /></div> : null}
          />
        </TemaCardapio>
      ) : tabletNovo ? (
        <TemaCardapio cor={tema.cor_primaria} loja={tema}>
          <TabletInicio
            cardapio={cardapio} idioma={lingua} mesa={mesa} carrinho={carrinho} totalSacola={totalCarrinho.total || 0}
            offline={estado === "offline" ? T("sem_internet", { hora: cacheEm ? hora(cacheEm) : "—" }) : ""}
            secaoAtiva={secaoAtiva} busca={busca} onBusca={setBusca} resultados={resultados} filtrando={filtrando}
            selos={selos} onSelos={setSelos} onAbrirPrato={abrirPrato} onAdicionar={adicionar} onIrSecao={irParaSecao}
            onAbrirSacola={() => setFolha("pedido")} onAbrirIdiomas={() => setFolha("idiomas")} temIdiomas={idiomasOferecidos.length > 1}
            onChamar={() => setFolha("atendimento")} onRecomendar={() => abrirConversa()} temRecomendar={conversaLigada}
            acompanhamento={acompanhamento} onAbrirPedidos={() => setFolha("pedidos")}
            linkCadastro={caminhoDoCadastro(unidadeId)} visitante={!cadastroLocal && !fidStatus?.identificado} podePedir={podePedir}
            banners={slides.length ? <div className={s.capa} style={{ height: "100%" }}><Abertura slides={slides} onAcao={acaoBanner} previa={previa} idioma={lingua} segundos={cardapio.carrossel?.segundos} porVez={cardapio.carrossel?.por_vez} /></div> : null}
          />
        </TemaCardapio>
      ) : (<>
      {tema.fundo_imagem_url ? <div className={s.fundoImagem} style={{ backgroundImage: `url("${tema.fundo_imagem_url}")`, opacity: tema.fundo_opacidade }} aria-hidden="true" /> : null}
      <div className={s.casca}>
        {/* lateral: celular deitado, tablet e computador */}
        <aside className={s.lateral} aria-label={T("secoes")}>
          <div className={s.lateralTopo}>
            <Foto src={tema.logo_url} className={s.lateralLogo} />
            <p className={s.lateralNome}>{unidade.nome}</p>
            <p className={s.lateralSub}>{mesa ? T("mesa", { mesa }) : unidade.delivery_aberto ? T("delivery_aberto") : T("delivery_fechado")}</p>
          </div>
          {listaSecoes}
          {conversaLigada ? (
            <div className={s.lateralRodape}>
              <button type="button" className={`${s.secundario} ${s.largo}`} onClick={() => abrirConversa()}><MessageCircle size={18} aria-hidden="true" /> {T("me_ajuda")}</button>
            </div>
          ) : null}
        </aside>

        <main className={s.conteudo}>
          <div className={s.barra}>
            {buscaAberta || lateral ? (
              <div className={s.buscaBarra}>
                <input className={s.campoBusca} type="search" value={busca} onChange={(ev) => setBusca(ev.target.value.slice(0, 60))} placeholder={T("buscar")} aria-label={T("buscar")} autoFocus={buscaAberta && !lateral} enterKeyHint="search" />
                {!lateral || busca ? <button type="button" className={s.icone} onClick={() => { setBusca(""); setBuscaAberta(false); }} aria-label={T("fechar_busca")}><X size={20} aria-hidden="true" /></button> : null}
              </div>
            ) : (
              <>
                <button type="button" className={s.botaoSecoes} onClick={() => setFolha("secoes")} aria-haspopup="dialog" aria-label={T("abrir_secoes")}>
                  <Menu size={18} aria-hidden="true" /><span>{filtrando ? T("secoes") : secaoAtual?.nome || T("secoes")}</span>
                </button>
                <button type="button" className={s.icone} onClick={() => setBuscaAberta(true)} aria-label={T("buscar")}><Search size={20} aria-hidden="true" /></button>
              </>
            )}
            {mesa && lateral ? <span className={s.chipMesa}>{T("mesa", { mesa })}</span> : null}
            {mesa ? <button type="button" className={s.icone} onClick={() => setFolha("atendimento")} aria-haspopup="dialog" aria-label={T("atendimento")}><BellRing size={20} aria-hidden="true" /></button> : null}
            {botaoIdioma}
            {conversaLigada && lateral ? <button type="button" className={s.icone} onClick={() => abrirConversa()} aria-label={T("conversar")}><MessageCircle size={20} aria-hidden="true" /></button> : null}
            {meusPedidos.length ? (
              <button type="button" className={s.acaoTopo} onClick={() => setFolha("pedidos")}><Receipt size={18} aria-hidden="true" /> {T("meus_pedidos")}</button>
            ) : null}
            {podePedir ? (
              <button type="button" className={`${s.acaoTopo} ${s.acaoSacola}`} onClick={() => setFolha("pedido")} data-sacola="">
                <ShoppingBag size={18} aria-hidden="true" /> {T("sacola")} {qtdTotal ? <span className={s.contagem}>{qtdTotal}</span> : null}
              </button>
            ) : null}
            <button type="button" className={s.icone} aria-pressed={escala !== 1} onClick={mudarEscala} aria-label={T("letra_maior")}><ALargeSmall size={20} aria-hidden="true" /></button>
          </div>

          {estado === "offline" ? (
            <div className={s.aviso} role="status"><WifiOff size={18} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
              <span>{T("sem_internet", { hora: cacheEm ? hora(cacheEm) : "—" })}</span>
            </div>
          ) : null}

          {modo === "delivery" ? (
            <>
              <div className={s.capa}>
                {slides.length ? <Abertura slides={slides} onAcao={acaoBanner} previa={previa} idioma={lingua} segundos={cardapio.carrossel?.segundos} porVez={cardapio.carrossel?.por_vez} /> : <CapaViva temas={secoesMenu.map((x) => x.tema).filter(Boolean)} />}
              </div>
              <section className={s.loja} aria-label={unidade.nome}>
                <Foto src={tema.logo_url} className={s.lojaLogo} alt="" fallback={<span className={s.lojaMonograma} aria-hidden="true">{iniciais(unidade.nome)}</span>} />
                <h1 className={s.lojaNome}>{unidade.nome}</h1>
                <p className={`${s.status} ${unidade.delivery_aberto ? s.statusAberto : s.statusFechado}`}>
                  <span className={s.statusPonto} aria-hidden="true" />
                  {unidade.delivery_aberto ? T("delivery_aberto") : T("delivery_fechado")}
                  {unidade.horario ? <span className={s.statusHorario}> · {unidade.horario}</span> : null}
                </p>
                {textos.apresentacao ? <p className={s.apresentacao} style={{ margin: "6px 0 0" }}>{textos.apresentacao}</p> : null}
                <ul className={s.infoChips}>
                  <li className={s.infoChip}><Truck size={16} aria-hidden="true" />{unidade.taxa_entrega > 0 ? T("entrega_valor", { valor: formatarPreco(unidade.taxa_entrega, lingua) }) : <strong>{T("entrega_gratis")}</strong>}</li>
                  {ent.tempo_min && ent.tempo_max ? <li className={s.infoChip}><Clock size={16} aria-hidden="true" />{T("tempo_entrega", { min: ent.tempo_min, max: ent.tempo_max })}</li> : null}
                  {ent.pedido_minimo > 0 ? <li className={s.infoChip}><Receipt size={16} aria-hidden="true" />{T("pedido_minimo", { valor: formatarPreco(ent.pedido_minimo, lingua) })}</li> : null}
                  {ent.gratis_acima > 0 && unidade.taxa_entrega > 0 ? <li className={`${s.infoChip} ${s.infoChipForte}`}><Tag size={16} aria-hidden="true" />{T("gratis_acima", { valor: formatarPreco(ent.gratis_acima, lingua) })}</li> : null}
                  {cidade ? <li className={s.infoChip}><MapPin size={16} aria-hidden="true" />{cidade}</li> : null}
                  {temInfo ? <li><button type="button" className={`${s.infoChip} ${s.infoChipBotao}`} onClick={() => setFolha("info")}>{T("mais_info")}</button></li> : null}
                </ul>
              </section>
              <CartaoFidelidade cardapio={cardapio} status={fidStatus} onAbrir={() => setFolha("fidelidade")} unidadeId={unidadeId} cadastroLocal={cadastroLocal} />
            </>
          ) : (
            <>
              <Abertura slides={slides} onAcao={acaoBanner} previa={previa} idioma={lingua} segundos={cardapio.carrossel?.segundos} porVez={cardapio.carrossel?.por_vez} />
              <header className={s.cabecalho}>
                {!slides.length ? <Foto src={tema.logo_url} className={s.cabecalhoLogo} /> : null}
                <h1 className={s.nomeLoja}>{unidade.nome}</h1>
                {textos.apresentacao ? <p className={s.apresentacao}>{textos.apresentacao}</p> : null}
                <span className={s.marcas}><span className={s.chipMesa}>{T("mesa", { mesa })}</span></span>
                <BotoesAtendimento T={T} chamados={chamados} onChamar={chamar} />
              </header>
              <CartaoFidelidade cardapio={cardapio} status={fidStatus} onAbrir={() => setFolha("fidelidade")} unidadeId={unidadeId} cadastroLocal={cadastroLocal} />
            </>
          )}

          {montado ? (
            <section className={s.boasVindas} aria-label={textoSaudacao}>
              {pedirNome ? (
                <form onSubmit={salvarNome}>
                  <p className={s.saudacao}>{textos.pedir_nome}</p>
                  <div className={s.formNome}>
                    <input value={rascunhoNome} onChange={(ev) => setRascunhoNome(ev.target.value.slice(0, 60))} placeholder={T("seu_primeiro_nome")} aria-label={T("seu_nome")} autoComplete="given-name" enterKeyHint="done" />
                    <button type="submit" className={s.primario} disabled={!primeiroNome(rascunhoNome)}>{T("pronto")}</button>
                  </div>
                  <button type="button" className={s.link} onClick={pularNome}>{T("agora_nao")}</button>
                </form>
              ) : (
                <>
                  <p className={s.saudacao}>{textoSaudacao}</p>
                  <div className={s.boasVindasAcoes}>
                    {conversaLigada ? <button type="button" className={s.secundario} onClick={() => abrirConversa()}><MessageCircle size={17} aria-hidden="true" /> {T("me_ajuda")}</button> : null}
                    {ultimoValido && podePedir ? <button type="button" className={s.secundario} onClick={pedirDeNovo}><RotateCcw size={17} aria-hidden="true" /> {T("pedir_de_novo")}</button> : null}
                    <button type="button" className={s.link} onClick={trocarNome}>{n ? T("nao_e", { nome: n }) : T("dizer_nome")}</button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {cardapio.filtros.length ? (
            <div className={s.filtros} role="group" aria-label={T("filtrar")}>
              {cardapio.filtros.map((f) => {
                const ativo = selos.includes(f.id);
                return (
                  <button key={f.id} type="button" className={s.secundario} aria-pressed={ativo}
                    onClick={() => setSelos((l) => (ativo ? l.filter((x) => x !== f.id) : [...l, f.id]))}>{f.rotulo}</button>
                );
              })}
            </div>
          ) : null}

          {modo === "delivery" && !lateral && !filtrando ? (
            <TrilhoSecoes secoes={secoesMenu} ativa={secaoAtiva} onIr={irParaSecao} rotulo={T("secoes")} />
          ) : null}

          {filtrando ? (
            <section id="resultado">
              <div className={s.voltarFiltro}>
                <h2>{promoAberta ? promoPorId.get(promoAberta)?.titulo || T("promocoes") : busca.trim() ? `“${busca.trim()}”` : T("filtrados")}</h2>
                <button type="button" className={s.secundario} onClick={() => { setBusca(""); setSelos([]); setPromoAberta(""); setBuscaAberta(false); }}><X size={16} aria-hidden="true" /> {T("limpar")}</button>
              </div>
              {promoAberta && promoPorId.get(promoAberta) ? (
                <p className={s.secaoDescricao} style={{ margin: "6px 18px 0" }}>{[promoPorId.get(promoAberta).rotulo, promoPorId.get(promoAberta).quando, promoPorId.get(promoAberta).texto].filter(Boolean).join(" · ")}</p>
              ) : null}
              <div className={s.secao} style={{ paddingTop: 8 }}>
                {resultados.length ? (
                  <ul className={listaClasse}>{resultados.map(linhaItem)}</ul>
                ) : (
                  <div className={s.vazio}>
                    <strong>{T("nada_encontrado")}</strong>
                    <span>{busca.trim() ? T("nao_achamos", { busca: busca.trim() }) : T("nenhum_filtro")}</span>
                    {conversaLigada && busca.trim() ? <button type="button" className={s.secundario} onClick={() => abrirConversa(busca.trim())}><MessageCircle size={17} aria-hidden="true" /> {T("perguntar_casa")}</button> : null}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <>
              {cardapio.promocoes.length ? (
                <section className={s.faixa} id="secao-promocoes" data-secao="promocoes" style={{ scrollMarginTop: 68 }}>
                  <h2 className={s.faixaTitulo}>{T("promocoes")}</h2>
                  <div className={s.trilho}>
                    {cardapio.promocoes.map((p) => (
                      <button key={p.id} type="button" className={s.promo} onClick={() => (p.produto_ids.length ? acaoBanner({ tipo: "promocao", id: p.id }) : null)} disabled={!p.produto_ids.length} style={!p.produto_ids.length ? { cursor: "default" } : undefined}>
                        <Foto src={p.imagem_url} loading="lazy" fallback={
                          <span className={`${s.promoArte} ${p.tipo === "aviso" ? s.promoArteAviso : ""}`} aria-hidden="true">
                            {p.tipo === "aviso" ? <Megaphone size={30} /> : <Tag size={26} />}
                            {p.rotulo ? <strong>{p.rotulo}</strong> : null}
                          </span>
                        } />
                        <span className={s.promoCorpo}>
                          {p.rotulo && p.imagem_url ? <span className={s.promoRotulo}>{p.rotulo}</span> : null}
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
                  <h2 className={s.faixaTitulo}>{T("casa_indica")}</h2>
                  <div className={s.trilho}>{destaques.map((p) => <Miniatura key={p.id} produto={p} onAbrir={abrirPrato} idioma={lingua} icone={<IconeTema tema={temaDoPrato(p, catPorId.get(p.categoria_id))} size={30} />} />)}</div>
                </section>
              ) : null}

              {cardapio.categorias.length ? cardapio.categorias.map((c) => (
                <section key={c.id} id={`secao-${c.id}`} data-secao={c.id} className={s.secao} aria-labelledby={`titulo-${c.id}`}>
                  {c.imagem_url && modo === "mesa" ? (
                    <div className={s.secaoCabeca}>
                      <Foto src={c.imagem_url} className={s.secaoCapa} loading="lazy" />
                      <div className={s.secaoTexto}>
                        <h2 className={s.secaoTitulo} id={`titulo-${c.id}`}>{c.nome}</h2>
                        {c.descricao ? <p className={s.secaoDescricao}>{c.descricao}</p> : null}
                      </div>
                    </div>
                  ) : (
                    <>
                      <Foto src={c.imagem_url} className={s.secaoCapa} loading="lazy" />
                      <div className={s.secaoTopo}>
                        {modo === "delivery" ? <span className={s.secaoIcone} aria-hidden="true"><IconeTema tema={temaDoIcone(c.nome, c.papel)} size={22} /></span> : null}
                        <div>
                          <h2 className={s.secaoTitulo} id={`titulo-${c.id}`}>{c.nome}</h2>
                          {c.descricao ? <p className={s.secaoDescricao}>{c.descricao}</p> : null}
                        </div>
                      </div>
                    </>
                  )}
                  <ul className={listaClasse}>{c.produto_ids.map((id) => (porId.get(id) ? linhaItem(porId.get(id)) : null))}</ul>
                </section>
              )) : (
                <div className={s.vazio}><strong>{T("montando")}</strong><span>{T("montando_sub")}</span></div>
              )}
            </>
          )}

          <footer className={s.rodape}>
            {textos.rodape ? <p style={{ whiteSpace: "pre-line" }}>{textos.rodape}</p> : null}
            <p>{T("precos_conferidos")}</p>
          </footer>
        </main>

        <aside className={s.painelPedido} aria-label={T("seu_pedido")} data-sacola="">
          {largo ? (
            <Pedido cardapio={cardapio} carrinho={carrinho} etapa={etapa} setEtapa={setEtapa} mesa={mesa} form={form} setForm={setForm}
              erros={erros} erroEnvio={erroEnvio} enviando={enviando} onEnviar={enviar} resultado={resultado} nome={nome}
              alterarQtd={alterarQtd} definirObs={definirObs} remover={remover} adicionar={adicionar} cashback={infoCashback} onAbrirPrato={abrirPrato} modo="painel" previa={previa} />
          ) : null}
        </aside>
      </div>

      {!largo && podePedir && qtdTotal > 0 && folha !== "pedido" ? (
        <button type="button" className={s.barraPedido} onClick={() => setFolha("pedido")} data-sacola="">
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span key={qtdTotal} className={s.barraPedidoQtd}>{qtdTotal}</span>{T("ver_pedido")}</span>
          <span>{formatarPreco(totalCarrinho.total, lingua)}</span>
        </button>
      ) : null}

      {celular ? (
        <nav className={s.navInferior} aria-label={T("cardapio")}>
          <button type="button" className={s.navBotao} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Home size={22} aria-hidden="true" />{T("inicio")}</button>
          <button type="button" className={s.navBotao} onClick={() => irParaSecao("promocoes")} disabled={!cardapio.promocoes.length} style={!cardapio.promocoes.length ? { opacity: 0.4 } : undefined}><Tag size={22} aria-hidden="true" />{T("promocoes")}</button>
          <button type="button" className={s.navBotao} onClick={() => abrirConversa()} disabled={!conversaLigada} style={!conversaLigada ? { opacity: 0.4 } : undefined}><MessageCircle size={22} aria-hidden="true" />{T("conversa")}</button>
          <button type="button" className={s.navBotao} onClick={() => setFolha("pedidos")}><Receipt size={22} aria-hidden="true" />{T("meus_pedidos")}{meusPedidos.length ? <span className={s.contagem}>{meusPedidos.length}</span> : null}</button>
          <button type="button" className={s.navBotao} onClick={() => setFolha("pedido")} disabled={!podePedir} data-sacola=""><ShoppingBag size={22} aria-hidden="true" />{T("sacola")}{qtdTotal ? <span key={qtdTotal} className={`${s.contagem} ${s.contagemPula}`}>{qtdTotal}</span> : null}</button>
        </nav>
      ) : null}
      </>)}

      {folha === "pedido" && modo === "delivery" && etapa === "carrinho" ? (
        <TemaCardapio cor={tema.cor_primaria} loja={tema}>
          <DeliverySacola cardapio={cardapio} idioma={lingua} carrinho={carrinho} onVoltar={() => setFolha("")}
            onContinuar={() => setEtapa("dados")} alterarQtd={alterarQtd} remover={remover} adicionar={adicionar}
            onAbrirPrato={(id) => { setFolha(""); abrirPrato(id); }} />
        </TemaCardapio>
      ) : folha === "pedido" && modo === "delivery" && etapa === "dados" ? (
        <TemaCardapio cor={tema.cor_primaria} loja={tema}>
          <DeliveryCheckout cardapio={cardapio} idioma={lingua} carrinho={carrinho} form={form} setForm={setForm}
            tipo={tipoEntrega} setTipo={setTipoEntrega} pagamento={pagamento} setPagamento={setPagamento}
            cashback={infoCashback} erroEnvio={erroEnvio} enviando={enviando} onEnviar={enviar} onVoltar={() => setEtapa("carrinho")} />
        </TemaCardapio>
      ) : folha === "pedido" && !largo ? (
        <Pedido cardapio={cardapio} carrinho={carrinho} etapa={etapa} setEtapa={setEtapa} mesa={mesa} form={form} setForm={setForm}
          erros={erros} erroEnvio={erroEnvio} enviando={enviando} onEnviar={enviar} resultado={resultado} nome={nome}
          alterarQtd={alterarQtd} definirObs={definirObs} remover={remover} adicionar={adicionar} cashback={infoCashback} onAbrirPrato={(id) => { setFolha(""); abrirPrato(id); }}
          modo="folha" onFechar={() => { setFolha(""); if (etapa === "enviado") setEtapa("carrinho"); }} previa={previa} />
      ) : null}

      {folha === "secoes" && !lateral ? (
        <Folha titulo={T("secoes")} onFechar={() => setFolha("")} classe={s.gaveta} idioma={lingua}>
          {listaSecoes}
          <div className={s.lateralRodape}>
            <button type="button" className={`${s.secundario} ${s.largo}`} onClick={() => { setFolha(""); setBuscaAberta(true); }}><Search size={18} aria-hidden="true" /> {T("buscar")}</button>
          </div>
        </Folha>
      ) : null}

      {folha === "idiomas" ? (
        <Folha titulo={T("idioma")} onFechar={() => setFolha("")} idioma={lingua}>
          <ul className={s.idiomaLista}>
            {idiomasOferecidos.map((i) => (
              <li key={i.id}>
                <button type="button" className={s.idiomaOpcao} aria-current={i.id === lingua ? "true" : undefined} onClick={() => escolherIdioma(i.id)} lang={i.lang}>
                  <span>{i.nome}</span>{i.id === lingua ? <Check size={20} aria-hidden="true" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </Folha>
      ) : null}

      {folha === "pedidos" ? (
        <Folha titulo={T("meus_pedidos")} onFechar={() => setFolha("")} idioma={lingua}
          pe={meusPedidos.length ? <button type="button" className={`${s.secundario} ${s.largo}`} style={{ justifyContent: "center" }} onClick={atualizarPedidos} disabled={andamento.carregando}><RotateCcw size={16} aria-hidden="true" /> {T("atualizar")}</button> : null}>
          <div className={s.folhaCorpo}>
            {!meusPedidos.length ? <p className={s.pedidoObs}>{T("meus_pedidos_vazio")}</p> : null}
            {andamento.pedidos.map((p) => (
              <div key={p.id} className={s.pedidoCard}>
                <span className={s.etapa} data-etapa={p.etapa}>{rotuloEtapa(p)}</span>
                <span className={s.pedidoObs}>{T("pedido_das", { hora: p.criado_em ? hora(p.criado_em) : "—" })}</span>
                {p.itens.map((i) => <span key={i.produto_id} style={{ fontSize: "0.92rem" }}>{i.quantidade} × {porId.get(i.produto_id)?.nome || "—"}</span>)}
                <span className={s.total} style={{ display: "flex", justifyContent: "space-between" }}><span>{T("total")}</span><span>{formatarPreco(p.total, lingua)}</span></span>
              </div>
            ))}
            {meusPedidos.length && !andamento.pedidos.length && andamento.carregando ? <p className={s.pedidoObs}>…</p> : null}
            {meusPedidos.length && !andamento.carregando && andamento.erro ? <p className={s.erro} role="alert">{T("pedidos_erro")}</p> : null}
            {meusPedidos.length && !andamento.carregando && andamento.lido && !andamento.pedidos.length ? <p className={s.pedidoObs}>{T("pedidos_nao_achados")}</p> : null}
          </div>
        </Folha>
      ) : null}

      {folha === "fidelidade" && cardapio.fidelidade && modo === "delivery" ? (
        <TemaCardapio cor={tema.cor_primaria} loja={tema}>
          <DeliveryFidelidade cardapio={cardapio} status={fidStatus} idioma={lingua} onVoltar={() => setFolha("")}
            onUsarCashback={() => { setUsarCashback(true); setEtapa("carrinho"); setFolha("pedido"); }}
            onAdicionar={(id, n) => { adicionar(id, n); setEtapa("carrinho"); setFolha("pedido"); }}
            onArea={() => setFolha("area")} />
        </TemaCardapio>
      ) : folha === "area" && cardapio.fidelidade && modo === "delivery" ? (
        <TemaCardapio cor={tema.cor_primaria} loja={tema}>
          <ClienteArea cardapio={cardapio} status={fidStatus} idioma={lingua} onVoltar={() => setFolha("fidelidade")} onPedir={() => setFolha("")}
            onAdicionar={(id, n) => { adicionar(id, n); setEtapa("carrinho"); setFolha("pedido"); }}
            onPedirDeNovo={(itens) => { for (const i of itens) adicionar(i.id, i.quantidade); setEtapa("carrinho"); setFolha("pedido"); }} />
        </TemaCardapio>
      ) : folha === "fidelidade" && cardapio.fidelidade ? (
        <Folha titulo={T("fid_titulo")} onFechar={() => setFolha("")} idioma={lingua}>
          <div className={s.folhaCorpo}>
            <DetalheFidelidade cardapio={cardapio} status={fidStatus} onAbrirPrato={(id) => { setFolha(""); abrirPrato(id); }} unidadeId={unidadeId} cadastroLocal={cadastroLocal} />
          </div>
        </Folha>
      ) : null}

      {folha === "atendimento" ? (
        <Folha titulo={T("atendimento")} onFechar={() => setFolha("")} idioma={lingua}>
          <div className={s.folhaCorpo}>
            <p className={s.apresentacao} style={{ margin: "0 0 12px" }}>{T("mesa", { mesa })}</p>
            <BotoesAtendimento T={T} chamados={chamados} grade tipos={["garcom", "conta", "agua", "talheres"]} onChamar={(tipo) => { setFolha(""); chamar(tipo); }} />
          </div>
        </Folha>
      ) : null}

      {folha === "info" ? (
        <Folha titulo={unidade.nome} onFechar={() => setFolha("")} idioma={lingua}>
          <div className={s.folhaCorpo}>
            {cidade ? <div className={s.infoLinha}><strong><MapPin size={14} aria-hidden="true" /> {T("endereco_loja")}</strong><span>{[unidade.endereco, cidade].filter(Boolean).join(" · ")}</span></div> : null}
            {unidade.horario ? <div className={s.infoLinha}><strong><Clock size={14} aria-hidden="true" /> {T("horario")}</strong><span>{unidade.horario}</span></div> : null}
            {unidade.telefone ? <div className={s.infoLinha}><strong><Phone size={14} aria-hidden="true" /> {T("telefone_loja")}</strong><a href={`tel:${unidade.telefone.replace(/[^\d+]/g, "")}`}>{unidade.telefone}</a></div> : null}
            <div className={s.infoLinha}><strong><Truck size={14} aria-hidden="true" /> {T("entrega_titulo")}</strong>
              <span>{unidade.delivery_aberto ? T("delivery_aberto") : T("delivery_fechado")} · {unidade.taxa_entrega > 0 ? T("entrega_valor", { valor: formatarPreco(unidade.taxa_entrega, lingua) }) : T("entrega_gratis")}</span>
            </div>
          </div>
        </Folha>
      ) : null}

      {conversaAberta ? (
        <Conversa cardapio={cardapio} nome={nome} mensagens={mensagens} setMensagens={setMensagens} podePedir={podePedir}
          onFechar={() => { setConversaAberta(false); setConsultaConversa(""); }} onAbrirPrato={abrirPrato} onAdicionar={adicionar}
          onIrParaSecao={irParaSecao} consultaInicial={consultaConversa} />
      ) : null}

      {pAberto ? (
        <Folha rotulo={pAberto.nome} onFechar={() => setPrato(null)} semCabeca idioma={lingua}
          pe={podePedir ? (
            <div className={s.linhaAcoes}>
              <span className={s.contador}>
                <button type="button" onClick={() => setQtdPrato((q) => Math.max(1, q - 1))} aria-label={T("menos_um")} disabled={qtdPrato <= 1}><Minus size={18} aria-hidden="true" /></button>
                <output aria-live="polite">{qtdPrato}</output>
                <button type="button" onClick={() => setQtdPrato((q) => Math.min(50, q + 1))} aria-label={T("mais_um")}><Plus size={18} aria-hidden="true" /></button>
              </span>
              <button type="button" className={s.primario} onClick={() => { adicionar(pAberto.id, qtdPrato, obsPrato.trim()); setPrato(null); }}>
                {T("adicionar_valor", { valor: formatarPreco(pAberto.preco * qtdPrato, lingua) })}
              </button>
            </div>
          ) : null}>
          <div className={s.folhaCorpo}>
            <Foto src={pAberto.imagem_url} className={s.detalheFoto} alt={pAberto.nome} />
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <h2 className={s.detalheNome}>{pAberto.nome}</h2>
                {pAberto.nome_original ? <p className={s.nomeOriginal} lang="pt-BR" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>{pAberto.nome_original}</p> : null}
              </div>
              <span style={{ display: "flex", gap: 6, flex: "none" }}>
                {!previa ? <button type="button" className={s.fechar} onClick={() => compartilhar(pAberto)} aria-label={T("compartilhar")}><Share2 size={18} aria-hidden="true" /></button> : null}
                <button type="button" className={s.fechar} onClick={() => setPrato(null)} aria-label={T("fechar")}><X size={20} aria-hidden="true" /></button>
              </span>
            </div>
            <div className={s.itemRodape} style={{ marginTop: 8 }}><Preco produto={pAberto} idioma={lingua} /><Selos produto={pAberto} promocao={pAberto.promocao_id ? promoPorId.get(pAberto.promocao_id) : null} idioma={lingua} cartoes={cartoesDoPrato(cardapio, pAberto.id)} /></div>
            {pAberto.descricao ? <p className={s.detalheDescricao}>{pAberto.descricao}</p> : null}
            {pAberto.promocao_id && promoPorId.get(pAberto.promocao_id)?.quando ? (
              <div className={s.detalheBloco}><strong>{T("promocao_bloco")}</strong><span>{promoPorId.get(pAberto.promocao_id).titulo} · {promoPorId.get(pAberto.promocao_id).quando}</span></div>
            ) : null}
            {pAberto.harmoniza ? <div className={s.detalheBloco}><strong>{T("vai_bem")}</strong><span>{pAberto.harmoniza}</span></div> : null}
            {cartoesDoPrato(cardapio, pAberto.id).map((c) => (
              <button key={c.id} type="button" className={`${s.detalheBloco} ${s.fidNoPrato}`} onClick={() => { setPrato(null); setFolha("fidelidade"); }}>
                <strong><Gift size={14} aria-hidden="true" /> {T("fid_titulo")}</strong>
                <span>{T("fid_selo_prato", { cartao: c.nome })} · {T("fid_cartao", { n: c.selos, premio: c.recompensa })}</span>
              </button>
            ))}
            {pAberto.alergenicos.length || pAberto.pode_conter ? (
              <div className={s.detalheBloco}>
                <strong>{T("alergenicos_titulo")}</strong>
                {pAberto.alergenicos.length ? <span>{T("contem", { lista: pAberto.alergenicos.join(", ") })}</span> : null}
                {pAberto.pode_conter ? <span>{T("pode_conter", { lista: pAberto.pode_conter })}</span> : null}
                <span style={{ color: "var(--c-suave)" }}>{T("alergia_confirme")}</span>
              </div>
            ) : null}
            {podePedir ? (
              <label className={s.detalheBloco} style={{ display: "grid" }}>
                <strong>{T("observacao")}</strong>
                <textarea className={s.observacao} value={obsPrato} onChange={(ev) => setObsPrato(ev.target.value.slice(0, 200))} placeholder={T("obs_placeholder")} />
              </label>
            ) : null}
          </div>
        </Folha>
      ) : null}

      <Aviso aviso={aviso} onFechar={fecharAviso} />
    </div>
  );
}
