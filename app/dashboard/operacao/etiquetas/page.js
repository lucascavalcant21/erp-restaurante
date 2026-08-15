"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Tag, Printer, Save, Snowflake, Thermometer, Box, QrCode, MapPin, AlertTriangle, Settings, RefreshCw, CheckCircle2, WifiOff, Smartphone, Tablet, Trash2, X, Check, Mic } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Field, TextInput, NumberInput, Select, Btn, Toast, EmptyState
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { lerSessao } from "../../../lib/auth";
import { fetchEstoque } from "../../../lib/estoque";
import { fetchProdutos } from "../../../lib/vendas";
import { fetchColaboradores } from "../../../lib/rh";
import { CONSERVACAO, gerarCodigo, criarEtiqueta, fetchEtiquetas, gerarEtiquetaSalva, excluirEtiqueta } from "../../../lib/etiquetas";
import { fetchValidadesEtiqueta } from "../../../lib/parametros";
import { ControleValidade } from "../validade/page";
import { useRascunho } from "../../../lib/rascunho";
import {
  conectarAssistenteImpressao, observarAssistenteImpressao,
  imprimirEtiquetasTp20, PERFIS_TP20, gerarComandosEtiqueta,
} from "../../../lib/impressaoTermica";
import {
  bluetoothDisponivel, motivoBluetoothIndisponivel, conectarImpressoraBluetooth,
  impressoraBluetoothConectada, nomeImpressoraBluetooth, enviarBytesBluetooth,
} from "../../../lib/impressaoBluetooth";
import { baixarPdfDeHtml } from "../../../lib/pdf";
import { imprimirHtml } from "../../../lib/imprimir";
import { equipeDaArea } from "../../../lib/equipe-area.mjs";
import EtiquetasRapidas from "../../../components/EtiquetasRapidas";

const UNIDADES = ["UN", "KG", "G", "L", "ML", "CX", "PCT", "BANDEJA"];
const ICONE_CONS = { Resfriado: Thermometer, Congelado: Snowflake, Ambiente: Box };

function fmtDataHora(d) {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}H${p(d.getMinutes())}`;
}
function fmtData(d) {
  if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// ─── ETIQUETAS SALVAS ────────────────────────────────────────────────────────
// Lista das etiquetas que foram apenas SALVAS (ainda não geradas). Aqui é
// possível gerar (mandar para as "Etiquetas geradas"), excluir, deixar como
// está, e simular no telefone/tablet como o QR apareceria ao ser escaneado.
function EtiquetasSalvas({ unidadeAtiva }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sim, setSim] = useState(null);          // etiqueta em simulação
  const [aparelho, setAparelho] = useState("telefone"); // "telefone" | "tablet"

  const carregar = async () => {
    setLoading(true);
    setLista(await fetchEtiquetas(unidadeAtiva, 300, "salva"));
    setLoading(false);
  };
  useEffect(() => { if (unidadeAtiva) carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const gerar = async (e) => { await gerarEtiquetaSalva(e.id); setLista((p) => p.filter((x) => x.id !== e.id)); };
  const remover = async (e) => { if (!confirm(`Excluir a etiqueta salva de ${e.produto}?`)) return; await excluirEtiqueta(e.id); setLista((p) => p.filter((x) => x.id !== e.id)); };

  const fmtDH = (iso) => { if (!iso) return "—"; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const molduraTel = aparelho === "tablet" ? { w: 460, h: 620 } : { w: 300, h: 600 };

  return (
    <div>
      <p className="text-[12px] font-medium mb-4" style={{ color: "var(--dim)" }}>
        Etiquetas apenas <b>salvas</b> (ainda não geradas). Você pode gerar (envia para “Etiquetas geradas”), excluir, deixar aqui, ou simular no telefone como o QR apareceria ao ser lido.
      </p>
      {loading ? (
        <EmptyState icon={Tag} title="Carregando..." />
      ) : lista.length === 0 ? (
        <EmptyState icon={Save} title="Nenhuma etiqueta salva" hint="Ao clicar em Salvar na aba Gerar, a etiqueta aparece aqui." />
      ) : (
        <div className="space-y-2.5">
          {lista.map((e) => (
            <div key={e.id} className="rounded-2xl border p-3 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black truncate" style={{ color: "var(--fg)" }}>{e.produto}</p>
                <p className="text-[11px]" style={{ color: "var(--dim)" }}>
                  {e.quantidade} {e.unidade} · vence {fmtDH(e.validade_em)} · #{e.codigo}
                  {e.responsavel ? ` · ${e.responsavel}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setSim(e)} title="Simular no telefone" className="h-9 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5" style={{ background: "var(--panel)", color: "var(--accent-fg)", border: "1px solid var(--line)" }}>
                  <Smartphone size={14} /> Simular
                </button>
                <button onClick={() => gerar(e)} title="Gerar (enviar para Geradas)" className="h-9 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 text-white" style={{ background: "var(--accent-strong)" }}>
                  <Check size={14} /> Gerar
                </button>
                <button onClick={() => remover(e)} title="Excluir" className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: "var(--panel)", color: "#DC2626", border: "1px solid var(--line)" }}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SIMULAÇÃO NO TELEFONE / TABLET — como o QR (rastreio) aparece ao ser lido */}
      {sim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4" onClick={() => setSim(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 shadow-2xl" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-slate-800">Como aparece no {aparelho}</h3>
              <button onClick={() => setSim(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><X size={16} /></button>
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-slate-100 mb-4 w-max mx-auto">
              {[["telefone", "Telefone", Smartphone], ["tablet", "Tablet", Tablet]].map(([v, l, Ic]) => (
                <button key={v} onClick={() => setAparelho(v)} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  style={aparelho === v ? { background: "#fff", color: "#0f172a", boxShadow: "0 1px 2px rgba(0,0,0,.12)" } : { color: "#64748b" }}>
                  <Ic size={14} /> {l}
                </button>
              ))}
            </div>
            {/* Moldura do aparelho com a página de rastreio dentro */}
            <div className="mx-auto rounded-[34px] border-[10px] border-slate-900 bg-slate-900 shadow-xl overflow-hidden" style={{ width: molduraTel.w, maxWidth: "100%", height: molduraTel.h, maxHeight: "62vh" }}>
              <iframe title={`Simulação ${sim.codigo}`} src={`${origem}/rastreio/${sim.codigo}`} className="w-full h-full bg-white border-0" />
            </div>
            <p className="text-[11px] text-center text-slate-400 mt-3">É exatamente a página que abre quando alguém aponta a câmera para o QR desta etiqueta.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function EtiquetasRunner() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptUrl = searchParams.get("dept"); // 'cozinha' | 'bar' | null (todos)
  const [produtos, setProdutos] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [form, setForm] = useState({ 
    // Peso começa vazio: quem não pesa o produto não vê "PESO:" na etiqueta.
    produto: "", conservacao: "Congelado", quantidade: "", unidade: "UN",
    dias: 30, lote: "", responsavel: "" 
  });
  const [codigo, setCodigo] = useState(gerarCodigo());
  const [momentoEtiqueta, setMomentoEtiqueta] = useState(() => new Date());
  const [aba, setAba] = useState("gerar"); // "gerar" | "geradas" (Controle de Validade)
  const [tamanho, setTamanho] = useState(() => { try { return localStorage.getItem("hefisto_etq_tamanho") || "80x40"; } catch { return "80x40"; } });
  useEffect(() => { try { localStorage.setItem("hefisto_etq_tamanho", tamanho); } catch {} }, [tamanho]); // "80x40" (bobina) | "60x40" | "60x60"
  // "tira" = todas numa página contínua (uma colada na outra); "paginas" = uma
  // etiqueta por página (para drivers que rejeitam página de altura fora do padrão)
  const [modoTira, setModoTira] = useState(() => { try { return localStorage.getItem("hefisto_etq_modo") || "tira"; } catch { return "tira"; } });
  // Girar 90°: alguns drivers de etiquetadora esperam o papel "em pé"
  // (60×100) e giram o conteúdo sozinhos. Aqui o usuário compensa isso.
  // Modelo da etiqueta: "validade" (completa) ou "nome" (só o nome do produto,
  // para identificar potes e caixas sem poluir com datas).
  const [modelo, setModelo] = useState(() => { try { return localStorage.getItem("hefisto_etq_modelo") || "validade"; } catch { return "validade"; } });
  useEffect(() => { try { localStorage.setItem("hefisto_etq_modelo", modelo); } catch {} }, [modelo]);
  const [girar, setGirar] = useState(() => { try { return localStorage.getItem("hefisto_etq_girar") === "1"; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem("hefisto_etq_girar", girar ? "1" : "0"); } catch {} }, [girar]);
  useEffect(() => { try { localStorage.setItem("hefisto_etq_modo", modoTira); } catch {} }, [modoTira]);
  const [validadeModo, setValidadeModo] = useState("dias"); // "dias" | "data"
  // "aberto" = produto aberto/manipulado (mostra data e hora de manipulação);
  // "fechado" = produto lacrado sem validade visível (mostra etiquetagem + validade)
  const [tipoEtiqueta, setTipoEtiqueta] = useState("aberto");
  const [dataValidade, setDataValidade] = useState("");
  const [categoriasValidade, setCategoriasValidade] = useState([]);
  const [categoriaValidade, setCategoriaValidade] = useState("");
  const [salvou, setSalvou] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Impressão Bluetooth (tablet Android): sem PC, sem driver, sem AirPrint.
  const [btNome, setBtNome] = useState("");
  const [btErro, setBtErro] = useState("");
  const [btConectando, setBtConectando] = useState(false);
  const temBluetooth = typeof window !== "undefined" && bluetoothDisponivel();
  const conectarBluetooth = async () => {
    setBtErro("");
    setBtConectando(true);
    try {
      const r = await conectarImpressoraBluetooth();
      setBtNome(r.nome);
    } catch (e) {
      // Cancelar a janela de pareamento não é erro para o usuário.
      if (!/cancel|user/i.test(e?.message || "")) setBtErro(e?.message || "Não consegui conectar na impressora.");
    } finally {
      setBtConectando(false);
    }
  };
  const [codigoSalvo, setCodigoSalvo] = useState(null);
  const [assinaturaSalva, setAssinaturaSalva] = useState(null);
  const [copias, setCopias] = useState(1);
  // Fila de impressão: vários produtos, cada um com suas cópias, numa tirada só
  const [fila, setFila] = useState([]); // { codigo, produto, copias, html, alturaMm, larguraMm }
  const [impressoraStatus, setImpressoraStatus] = useState("desconectada");
  const [impressoraErro, setImpressoraErro] = useState("");
  const [impressoras, setImpressoras] = useState([]);
  const [impressoraNome, setImpressoraNome] = useState("");
  const [conectando, setConectando] = useState(false);
  const assinaturaConteudo = useMemo(() => JSON.stringify({
    unidadeAtiva, form, tipoEtiqueta, validadeModo, dataValidade, copias,
  }), [unidadeAtiva, form, tipoEtiqueta, validadeModo, dataValidade, copias]);
  const assinaturaAnterior = useRef(assinaturaConteudo);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Rascunho: se atualizar a página, o que foi digitado volta. Ao sair da
  // página e voltar, começa em branco.
  useRascunho(
    "rascunho_etiqueta",
    { form, tipoEtiqueta, validadeModo, dataValidade },
    (s) => {
      if (s.form) setForm((f) => ({ ...f, ...s.form }));
      if (s.tipoEtiqueta) setTipoEtiqueta(s.tipoEtiqueta);
      if (s.validadeModo) setValidadeModo(s.validadeModo);
      if (typeof s.dataValidade === "string") setDataValidade(s.dataValidade);
    }
  );

  // Dimensões/escala da etiqueta conforme o tamanho escolhido.
  // 80x40 = bobina adesiva com divisórias (die-cut) de 80mm × 40mm.
  const DIMENSOES = {
    "60x40": { w: "60mm", h: "40mm", paginaW: "60mm", paginaH: "40mm", pad: "1.6mm", titulo: "3.6mm", linha: "2.5mm", resp: "2mm", qr: 36, gap: "0.35mm", secPad: "0.4mm", footLh: 1.12, respMt: "0.4mm" },
    "80x40": { w: "80mm", h: "40mm", paginaW: "80mm", paginaH: "40mm", pad: "2mm", titulo: "4.2mm", linha: "2.9mm", resp: "2.3mm", qr: 42, gap: "0.4mm", secPad: "0.5mm", footLh: 1.15, respMt: "0.5mm" },
    "60x60": { w: "60mm", h: "60mm", paginaW: "60mm", paginaH: "60mm", pad: "2.8mm", titulo: "4.4mm", linha: "3mm", resp: "2.6mm", qr: 58, gap: "0.6mm", secPad: "0.7mm", footLh: 1.25, respMt: "0.7mm" },
    // Etiquetas em rolo (etiquetadora com driver do Windows)
    "80x60": { w: "80mm", h: "60mm", paginaW: "80mm", paginaH: "60mm", pad: "3mm", titulo: "5mm", linha: "3.2mm", resp: "2.8mm", qr: 64, gap: "0.6mm", secPad: "0.8mm", footLh: 1.25, respMt: "0.7mm" },
    "100x60": { w: "100mm", h: "60mm", paginaW: "100mm", paginaH: "60mm", pad: "3.4mm", titulo: "5.6mm", linha: "3.4mm", resp: "3mm", qr: 68, gap: "0.7mm", secPad: "0.9mm", footLh: 1.3, respMt: "0.8mm" },
  };
  const dim = DIMENSOES[tamanho] || DIMENSOES["60x40"];

  useEffect(() => {
    lerSessao().then((s) => s?.nome && setForm((f) => ({ ...f, responsavel: f.responsavel || s.nome })));
    try { setImpressoraNome(localStorage.getItem("erp_impressora_termica") || ""); } catch (_) {}
    observarAssistenteImpressao({
      aoFechar: () => setImpressoraStatus("desconectada"),
      aoErro: () => setImpressoraStatus("erro"),
    }).catch(() => {});
  }, []);
  const [custoMap, setCustoMap] = useState({});
  useEffect(() => {
    (async () => {
      setCategoriaValidade("");
      // Produtos do cardápio + insumos do estoque, filtrados pelo departamento
      // da URL (?dept=cozinha ou ?dept=bar) — cada área vê só o que é dela.
      const [e, pr, colab, validades] = await Promise.all([
        fetchEstoque(unidadeAtiva, deptUrl || undefined),
        fetchProdutos(unidadeAtiva, deptUrl || undefined),
        fetchColaboradores(unidadeAtiva),
        fetchValidadesEtiqueta(unidadeAtiva),
      ]);
      const nomes = [...new Set([
        ...(e.data || []).map((x) => x.nome),
        ...(pr.data || []).map((x) => x.nome_produto),
      ].filter(Boolean))].sort();
      setProdutos(nomes);
      const mapa = {};
      (e.data || []).forEach((x) => { mapa[x.nome] = Number(x.custo_unitario) || Number(x.preco_unit) || mapa[x.nome] || 0; });
      setCustoMap(mapa);
      // Só a equipe contratada do setor (liderança entra em todos), sem extras.
      setColaboradores(equipeDaArea(colab.data || [], deptUrl));
      setCategoriasValidade(validades.data || []);
    })();
  }, [unidadeAtiva, deptUrl]);

  // Se uma impressão falhar depois de salvar, o mesmo código pode ser tentado
  // novamente sem duplicar o registro. Se o conteúdo for alterado, invalida a
  // tentativa anterior e cria um novo código para impedir QR/dados divergentes.
  useEffect(() => {
    if (assinaturaAnterior.current !== assinaturaConteudo && codigoSalvo === codigo) {
      setCodigo(gerarCodigo());
      setCodigoSalvo(null);
      setAssinaturaSalva(null);
    }
    assinaturaAnterior.current = assinaturaConteudo;
  }, [assinaturaConteudo, codigoSalvo, codigo]);

  function escolherConservacao(id) {
    const c = CONSERVACAO.find((x) => x.id === id);
    set("conservacao", id);
    if (c) { set("dias", c.dias); setValidadeModo("dias"); setCategoriaValidade(""); }
  }
  function aplicarCategoria(id) {
    setCategoriaValidade(id);
    const categoria = categoriasValidade.find((item) => item.id === id);
    if (categoria) {
      set("dias", categoria.dias);
      setValidadeModo("dias");
    }
  }

  async function conectarImpressora() {
    if (conectando) return;
    setConectando(true);
    setImpressoraErro("");
    setImpressoraStatus("conectando");
    try {
      const resultado = await conectarAssistenteImpressao(impressoraNome);
      setImpressoras(resultado.impressoras);
      if (!resultado.nome) {
        setImpressoraStatus("selecionar");
        setImpressoraErro("O assistente conectou, mas não reconheceu uma térmica automaticamente. Selecione abaixo a fila correta.");
        return;
      }
      setImpressoraNome(resultado.nome);
      setImpressoraStatus("conectada");
      try { localStorage.setItem("erp_impressora_termica", resultado.nome); } catch (_) {}
    } catch (erro) {
      setImpressoraStatus("erro");
      setImpressoraErro("Não foi possível abrir o assistente. Confirme que o QZ Tray está instalado e aceite a autorização do navegador.");
    } finally {
      setConectando(false);
    }
  }

  function escolherImpressora(nome) {
    setImpressoraNome(nome);
    setImpressoraStatus(nome ? "conectada" : "selecionar");
    setImpressoraErro("");
    try { localStorage.setItem("erp_impressora_termica", nome); } catch (_) {}
  }

  const agora = momentoEtiqueta;
  const validadeEm = useMemo(() => {
    if (validadeModo === "data") return dataValidade ? new Date(`${dataValidade}T23:59:00`) : new Date(Number.NaN);
    return new Date(agora.getTime() + (Number(form.dias) || 0) * 86400000);
  }, [validadeModo, dataValidade, agora, form.dias]);
  const nomeProduto = (form.produto || "").trim();
  const quantidadeCopias = Math.max(1, Math.min(1000, Math.floor(Number(copias) || 1)));

  const rastreioUrl = typeof window !== "undefined" ? `${window.location.origin}/rastreio/${codigo}` : `/rastreio/${codigo}`;
  const cnpjUnidade = unidadeInfo?.cnpj || "";
  const enderecoUnidade = [
    [unidadeInfo?.endereco, unidadeInfo?.numero].filter(Boolean).join(", "),
    unidadeInfo?.bairro,
  ].filter(Boolean).join(" - ");
  const cidadeUfUnidade = [unidadeInfo?.cidade, unidadeInfo?.uf].filter(Boolean).join("/");
  const localizacaoUnidade = [unidadeInfo?.cep ? `CEP ${fmtCEP(unidadeInfo.cep)}` : "", cidadeUfUnidade].filter(Boolean).join(" - ");
  const cadastroUnidadeCompleto = Boolean(cnpjUnidade && unidadeInfo?.cep && enderecoUnidade && unidadeInfo?.cidade && unidadeInfo?.uf);

  // ── FILA: adiciona a etiqueta atual (produto × cópias) e limpa para o próximo ──
  // ── Fila ditada por voz ao Hefisto ────────────────────────────────────────
  // "5 etiquetas de alho, 3 de tomate e 10 de cebola" chega aqui como lista.
  // Cada item é preenchido, aguarda a prévia renderizar e entra na fila.
  const [filaVoz, setFilaVoz] = useState(null); // { itens: [], idx: 0 }

  useEffect(() => {
    if (searchParams.get("fila") !== "voz") return;
    try {
      const bruto = localStorage.getItem("hefisto_etq_fila_voz");
      localStorage.removeItem("hefisto_etq_fila_voz");
      const itens = JSON.parse(bruto || "[]").filter(i => i && i.produto);
      if (!itens.length) return;
      setFilaVoz({ itens, idx: 0 });
      set("produto", itens[0].produto);
      setCopias(String(itens[0].copias || 1));
    } catch { /* nada a fazer: a tela abre normal */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filaVoz) return;
    const t = setTimeout(async () => {
      await adicionarNaFila();
      const prox = filaVoz.idx + 1;
      if (prox >= filaVoz.itens.length) { setFilaVoz(null); return; }
      set("produto", filaVoz.itens[prox].produto);
      setCopias(String(filaVoz.itens[prox].copias || 1));
      setFilaVoz({ itens: filaVoz.itens, idx: prox });
    }, 800); // tempo da prévia desenhar a etiqueta do item atual
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filaVoz]);

  async function adicionarNaFila() {
    if (salvando) return;
    const momentoImpressao = new Date();
    const validadeImpressao = validadeModo === "data"
      ? (dataValidade ? new Date(`${dataValidade}T23:59:00`) : new Date(Number.NaN))
      : new Date(momentoImpressao.getTime() + (Number(form.dias) || 0) * 86400000);
    if (!nomeProduto) { setSalvou("Informe o produto"); setTimeout(() => setSalvou(""), 2000); return; }
    if (!form.responsavel.trim()) { setSalvou("Informe o responsável"); setTimeout(() => setSalvou(""), 2000); return; }
    // Peso é opcional: só recusa se a pessoa digitou um valor inválido.
    if (String(form.quantidade ?? "").trim() !== "" && Number(form.quantidade) <= 0) { setSalvou("O peso precisa ser maior que zero"); setTimeout(() => setSalvou(""), 2500); return; }
    if (!cadastroUnidadeCompleto) { setSalvou("Complete CNPJ, CEP, endereço, cidade e UF da unidade antes de imprimir"); setTimeout(() => setSalvou(""), 4000); return; }
    if (!Number.isFinite(validadeImpressao.getTime()) || validadeImpressao.getTime() < momentoImpressao.getTime()) {
      setSalvou("A validade não pode estar no passado"); setTimeout(() => setSalvou(""), 2500); return;
    }
    const area = document.getElementById("area-impressao");
    const primeira = area?.querySelector(".etiqueta-print");
    if (!primeira) { setSalvou("A pré-visualização ainda não está pronta"); setTimeout(() => setSalvou(""), 2500); return; }
    // Entra na fila NA HORA; o registro no banco roda em segundo plano e, se
    // falhar, o item sai da fila com aviso.
    const codigoItem = codigo;
    const nomeItem = nomeProduto;
    setFila((p) => [...p, {
      codigo: codigoItem, produto: nomeItem, copias: quantidadeCopias,
      html: primeira.outerHTML,
      alturaMm: parseFloat(dim.h) || 40,
      larguraMm: parseFloat(dim.paginaW) || 80,
    }]);
    setSalvou(`${nomeItem} × ${quantidadeCopias} na fila`);
    // Prepara o próximo produto: novo código, mantém responsável/conservação
    setCodigo(gerarCodigo());
    setCodigoSalvo(null);
    setAssinaturaSalva(null);
    setMomentoEtiqueta(new Date());
    set("produto", "");
    setCopias(1);
    setTimeout(() => setSalvou(""), 2500);
    criarEtiqueta({
      codigo: codigoItem, produto: nomeItem, conservacao: form.conservacao,
      quantidade: Number(form.quantidade), unidade: form.unidade,
      validade_dias: Math.max(0, Math.round((validadeImpressao.getTime() - momentoImpressao.getTime()) / 86400000)),
      manipulacao_em: momentoImpressao.toISOString(),
      validade_em: validadeImpressao.toISOString(),
      lote: form.lote || null, responsavel: form.responsavel.trim(),
      custo_unit: custoMap[nomeItem] || 0,
      status: "ativa",
      copias: quantidadeCopias,
      tipo_etiqueta: tipoEtiqueta,
    }, unidadeAtiva, { departamento: deptUrl }).then((resultado) => {
      if (resultado?.error) {
        setFila((p) => p.filter((x) => x.codigo !== codigoItem));
        setSalvou(`${nomeItem} saiu da fila — não foi possível registrar: ` + resultado.error);
        setTimeout(() => setSalvou(""), 6000);
        return;
      }
      // A etiqueta vale; o estoque é consequência. Só avisa quando não entrou.
      if (resultado?.estoque && !resultado.estoque.ok) {
        setSalvou(`${nomeItem} etiquetado, mas não entrou no estoque: ${resultado.estoque.motivo}`);
        setTimeout(() => setSalvou(""), 6000);
      }
    });
  }

  // Teste de impressão: manda uma etiqueta simples, no tamanho escolhido, sem
  // depender de produto/validade. Serve para separar problema do ERP de
  // problema do driver/papel da impressora.
  function imprimirTeste() {
    const largura = parseFloat(dim.paginaW) || 80;
    const altura = parseFloat(dim.paginaH) || 40;
    // Girado: o papel vai "em pé" e o conteúdo é rotacionado para caber nele.
    const pagW = girar ? altura : largura;
    const pagH = girar ? largura : altura;
    const giro = girar
      ? `position:absolute;top:0;left:0;transform:translateX(${altura}mm) rotate(90deg);transform-origin:top left;`
      : "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Teste de etiqueta</title>
      <style>
        @page { size: ${pagW}mm ${pagH}mm; margin: 0; }
        *{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff}
        .etq{${giro}width:${largura}mm;height:${altura}mm;padding:3mm;font-family:'Courier New',monospace;color:#000;
             display:flex;flex-direction:column;justify-content:space-between;border:0.4mm solid #000;overflow:hidden}
        .t{font-size:4.5mm;font-weight:900;text-transform:uppercase;line-height:1.1}
        .m{font-size:3mm;font-weight:700}
        .r{display:flex;justify-content:space-between;font-size:2.6mm;font-weight:700;border-top:0.3mm solid #000;padding-top:1mm}
      </style></head><body>
      <div class="etq">
        <div>
          <div class="t">Teste de impressao</div>
          <div class="m">${largura} x ${altura} mm</div>
        </div>
        <div class="m">Se as bordas aparecerem inteiras e a medida bater com a etiqueta, o tamanho esta correto.</div>
        <div class="r"><span>${(unidadeInfo?.nome || "Unidade").toUpperCase()}</span><span>${new Date().toLocaleString("pt-BR")}</span></div>
      </div>
      </body></html>`;
    // Imprime sem abrir aba: pop-up bloqueado era o motivo de "não acontecer nada".
    const ok = imprimirHtml(html, {
      aoFalhar: () => setSalvou("Não consegui abrir a impressão. Verifique se há impressora instalada no aparelho."),
    });
    if (ok) setSalvou(`Teste enviado (${largura}×${altura}mm). Escolha a impressora na janela do Windows.`);
    setTimeout(() => setSalvou(""), 8000);
  }

  function imprimirFila() {
    if (!fila.length) return;
    const totalMm = fila.reduce((s, f) => s + f.alturaMm * f.copias, 0);
    const alturaPagMm = modoTira === "tira" ? totalMm : Math.max(...fila.map(f => f.alturaMm));
    // A largura do papel é a da maior etiqueta da fila — nunca fixa em 80 mm,
    // senão etiquetas de 100 mm saem cortadas.
    const larguraPagMm = Math.max(...fila.map(f => Number(f.larguraMm) || 80));
    const corpo = fila.map(f => Array.from({ length: f.copias }).map(() => f.html).join("")).join("");
    const htmlFila = `<!doctype html><html><head><meta charset="utf-8"><title>Fila de Etiquetas</title>
      <style>
        @page { size: ${larguraPagMm}mm ${alturaPagMm}mm; margin: 0; }
        *{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff}
        #wrap{width:${larguraPagMm}mm;margin:0 auto;display:flex;flex-direction:column;gap:0}
        .etiqueta-print{page-break-after:${modoTira === "tira" ? "auto" : "always"};page-break-inside:avoid;overflow:hidden;box-shadow:none!important;border-radius:0!important;margin:0 auto!important}
        .etiqueta-print:last-child{page-break-after:auto}
      </style></head><body>
      <div id="wrap">${corpo}</div>
      </body></html>`;
    imprimirHtml(htmlFila, { aoFalhar: () => alert("Não consegui abrir a impressão da fila.") });
    setSalvou("Fila enviada para impressão.");
    setTimeout(() => setSalvou(""), 2500);
  }

  async function salvar(modoImpressao = "") {
    if (salvando) return;
    if (codigoSalvo === codigo && assinaturaSalva !== assinaturaConteudo) {
      setCodigo(gerarCodigo());
      setCodigoSalvo(null);
      setAssinaturaSalva(null);
      setSalvou("O conteúdo mudou. Um novo código foi preparado; confirme a impressão novamente.");
      setTimeout(() => setSalvou(""), 3500);
      return;
    }
    const etiquetaJaRegistrada = codigoSalvo === codigo;
    const momentoImpressao = etiquetaJaRegistrada ? momentoEtiqueta : new Date();
    const validadeImpressao = validadeModo === "data"
      ? (dataValidade ? new Date(`${dataValidade}T23:59:00`) : new Date(Number.NaN))
      : new Date(momentoImpressao.getTime() + (Number(form.dias) || 0) * 86400000);
    const diasImpressao = Math.max(0, Math.round((validadeImpressao.getTime() - momentoImpressao.getTime()) / 86400000));
    if (!nomeProduto) { setSalvou("Informe o produto"); setTimeout(() => setSalvou(""), 2000); return; }
    if (!form.responsavel.trim()) { setSalvou("Informe o responsável"); setTimeout(() => setSalvou(""), 2000); return; }
    // Peso é opcional: só recusa se a pessoa digitou um valor inválido.
    if (String(form.quantidade ?? "").trim() !== "" && Number(form.quantidade) <= 0) { setSalvou("O peso precisa ser maior que zero"); setTimeout(() => setSalvou(""), 2500); return; }
    if (!Number.isInteger(Number(copias))) { setSalvou("A quantidade de etiquetas deve ser um número inteiro"); setTimeout(() => setSalvou(""), 3000); return; }
    if (Number(copias) < 1) { setSalvou("Informe pelo menos uma etiqueta"); setTimeout(() => setSalvou(""), 2500); return; }
    if (Number(copias) > 100) { setSalvou("Imprima no máximo 100 etiquetas por lote"); setTimeout(() => setSalvou(""), 3000); return; }
    if (validadeModo === "data" && !dataValidade) { setSalvou("Informe a data de validade"); setTimeout(() => setSalvou(""), 3000); return; }
    if (modoImpressao && !cadastroUnidadeCompleto) {
      setSalvou("Complete CNPJ, CEP, endereço, cidade e UF da unidade antes de imprimir");
      setTimeout(() => setSalvou(""), 4000); return;
    }
    if (modoImpressao === "tp20" && impressoraStatus !== "conectada") {
      setSalvou("Conecte e autorize a TP20 antes de imprimir"); setTimeout(() => setSalvou(""), 3000); return;
    }
    if (!Number.isFinite(validadeImpressao.getTime()) || validadeImpressao.getTime() < momentoImpressao.getTime()) {
      setSalvou("A validade não pode estar no passado"); setTimeout(() => setSalvou(""), 2500); return;
    }

    setMomentoEtiqueta(momentoImpressao);
    setSalvando(true);
    let etiquetaRegistrada = etiquetaJaRegistrada;
    try {
      // O registro no banco roda EM PARALELO com a impressão: o papel sai na
      // hora e o resultado do registro é confirmado logo em seguida.
      let promessaRegistro = null;
      if (!etiquetaRegistrada) {
        promessaRegistro = criarEtiqueta({
          codigo, produto: nomeProduto, conservacao: form.conservacao,
          quantidade: Number(form.quantidade), unidade: form.unidade,
          validade_dias: diasImpressao,
          // O campo existente também registra a data de etiquetagem de produtos fechados.
          manipulacao_em: momentoImpressao.toISOString(),
          validade_em: validadeImpressao.toISOString(),
          lote: form.lote || null, responsavel: form.responsavel.trim(),
          custo_unit: custoMap[nomeProduto] || 0,
          // Só "Salvar" (sem imprimir) fica em SALVAS; imprimir já gera (ativa).
          status: modoImpressao ? "ativa" : "salva",
          copias: quantidadeCopias,
          tipo_etiqueta: tipoEtiqueta,
        }, unidadeAtiva, { departamento: deptUrl });
      }

      if (modoImpressao === "tp20") {
        await imprimirEtiquetasTp20({
          impressora: impressoraNome,
          tamanho,
          copias: quantidadeCopias,
          dados: {
            codigo,
            produto: nomeProduto,
            conservacao: form.conservacao,
            quantidade: form.quantidade,
            unidade: form.unidade,
            tipoEtiqueta,
            momento: momentoImpressao,
            validade: validadeImpressao,
            responsavel: form.responsavel.trim(),
            lote: form.lote,
            unidadeNome: unidadeInfo.nome_fantasia || unidadeInfo.nome,
            cnpj: fmtCNPJ(cnpjUnidade),
            endereco: enderecoUnidade,
            localizacao: localizacaoUnidade,
          },
        });
        setSalvou(`${quantidadeCopias} etiqueta${quantidadeCopias !== 1 ? "s" : ""} enviada${quantidadeCopias !== 1 ? "s" : ""} para ${impressoraNome}`);
      } else if (modoImpressao === "bluetooth") {
        // Tablet/celular Android falando direto com a impressora — sem PC.
        const bytes = await gerarComandosEtiqueta({
          tamanho, copias: quantidadeCopias,
          dados: {
            codigo, produto: nomeProduto, conservacao: form.conservacao,
            quantidade: form.quantidade, unidade: form.unidade, tipoEtiqueta,
            momento: momentoImpressao, validade: validadeImpressao,
            responsavel: form.responsavel.trim(), lote: form.lote,
            unidadeNome: unidadeInfo.nome_fantasia || unidadeInfo.nome,
            cnpj: fmtCNPJ(cnpjUnidade), endereco: enderecoUnidade, localizacao: localizacaoUnidade,
          },
        });
        await enviarBytesBluetooth(bytes);
        setSalvou(`${quantidadeCopias} etiqueta${quantidadeCopias !== 1 ? "s" : ""} enviada${quantidadeCopias !== 1 ? "s" : ""} por Bluetooth`);
      } else if (modoImpressao === "navegador") {
        // Impressão ISOLADA: abre uma janela só com as etiquetas (o resto da tela
        // fazia o navegador gerar várias folhas em branco).
        const area = document.getElementById("area-impressao");
        if (area) {
          // Largura SEMPRE 80mm (largura do papel da térmica — o driver rejeita
          // larguras fora do padrão com "Falha na impressão"). Modo tira: altura
          // = cópias × etiqueta, tudo numa página; modo páginas: uma por página.
          const alturaEtqMm = parseFloat(dim.h) || 40;
          const alturaTiraMm = modoTira === "tira" ? alturaEtqMm * quantidadeCopias : alturaEtqMm;
          // Página do TAMANHO EXATO da etiqueta: se usar largura maior que a
          // etiqueta física, o driver encolhe a folha e sai uma miniatura ruim.
          const larguraEtqMm = parseFloat(dim.paginaW) || 80;
          const pagW = girar ? alturaTiraMm : larguraEtqMm;
          const pagH = girar ? larguraEtqMm : alturaTiraMm;
          const giro = girar
            ? `position:absolute;top:0;left:0;transform:translateX(${alturaTiraMm}mm) rotate(90deg);transform-origin:top left;`
            : "margin:0 auto;";
          const htmlEtq = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title>
            <style>
              @page { size: ${pagW}mm ${pagH}mm; margin: 0; }
              *{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff}
              #wrap{${giro}width:${dim.paginaW};display:flex;flex-direction:column;gap:0}
              img,svg{image-rendering:crisp-edges}
              .etiqueta-print{page-break-after:${modoTira === "tira" ? "auto" : "always"};page-break-inside:avoid;overflow:hidden;box-shadow:none!important;border-radius:0!important;margin:0 auto!important}
              .etiqueta-print:last-child{page-break-after:auto}
            </style></head><body>
            <div id="wrap">${area.innerHTML}</div>
            </body></html>`;
          // Sem abrir aba: pop-up bloqueado fazia "não acontecer nada".
          imprimirHtml(htmlEtq, { aoFalhar: () => window.print() });
        } else {
          window.print();
        }
        setSalvou("Impressão enviada — escolha a impressora na janela do Windows.");
      } else if (modoImpressao === "pdf") {
        // PDF no TAMANHO EXATO da etiqueta: o arquivo carrega a geometria da
        // página, então ao imprimir a 100% (Tamanho real) não vira miniatura —
        // mesmo com o driver configurado em A4.
        const area = document.getElementById("area-impressao");
        if (area) {
          const larguraMm = parseFloat(dim.paginaW) || 80;
          const alturaEtqMm = parseFloat(dim.h) || 40;
          const alturaTiraMm = modoTira === "tira" ? alturaEtqMm * quantidadeCopias : alturaEtqMm;
          const htmlPdf = `<!doctype html><html><head><meta charset="utf-8"><style>
            *{box-sizing:border-box} html,body{margin:0;padding:0;background:#fff}
            #wrap{width:${dim.paginaW};margin:0 auto;display:flex;flex-direction:column;gap:0}
            .etiqueta-print{overflow:hidden;box-shadow:none!important;border-radius:0!important;margin:0 auto!important}
            </style></head><body><div id="wrap">${area.innerHTML}</div></body></html>`;
          baixarPdfDeHtml(htmlPdf, `etiqueta_${codigo}`, { formatoMm: [larguraMm, modoTira === "tira" ? alturaTiraMm : alturaEtqMm] });
          setSalvou('PDF gerado. Ao imprimir o PDF, escolha "Tamanho real / 100%".');
        }
      }

      // Confirma o registro que rodou em paralelo com a impressão
      if (promessaRegistro) {
        const resultado = await promessaRegistro;
        if (resultado.error) {
          setSalvou(modoImpressao
            ? "Atenção: a etiqueta foi impressa mas NÃO ficou registrada: " + resultado.error + ". Imprima novamente para registrar."
            : "Não foi possível salvar: " + resultado.error);
          setTimeout(() => setSalvou(""), 7000);
          return;
        }
        etiquetaRegistrada = true;
        setCodigoSalvo(codigo);
        setAssinaturaSalva(assinaturaConteudo);
        if (!modoImpressao) setSalvou("Etiqueta salva!");
        // Entrada no estoque é consequência da etiqueta; avisa quando não rolou.
        if (resultado.estoque && !resultado.estoque.ok) {
          setSalvou(`Etiqueta registrada, mas não entrou no estoque: ${resultado.estoque.motivo}`);
          setTimeout(() => setSalvou(""), 6000);
          return;
        }
        if (resultado.estoque?.ok) {
          setSalvou(`Etiqueta registrada · +${resultado.estoque.quantidade} em ${resultado.estoque.estoque}`);
        }
      }
      setTimeout(() => {
        setSalvou("");
        setCodigo(gerarCodigo());
        setCodigoSalvo(null);
        setAssinaturaSalva(null);
        setMomentoEtiqueta(new Date());
      }, 2500);
    } catch (erro) {
      setSalvou(etiquetaRegistrada
        ? `Etiqueta salva, mas a impressão não foi confirmada: ${erro?.message || "erro inesperado"}. Confira o papel antes de tentar novamente.`
        : "Falha ao salvar a etiqueta: " + (erro?.message || "erro inesperado"));
      setTimeout(() => setSalvou(""), 7000);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen">
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden !important; }
          #area-impressao, #area-impressao * { visibility: visible !important; }
          #area-impressao { position: absolute !important; left: 0; top: 0; margin: 0; padding: 0; background: #fff !important; color: #000 !important; width: ${dim.paginaW} !important; display: flex !important; flex-direction: column !important; gap: 0 !important; }
          .etiqueta-print { page-break-after: auto; page-break-inside: avoid; overflow: hidden; border-radius: 0 !important; box-shadow: none !important; border: none !important; margin: 0 auto !important; }
          @page { size: ${dim.paginaW} ${dim.paginaH}; margin: 0; }
        }
      `}} />
      <PageHeader title={`Etiquetas${deptUrl ? ` — ${deptUrl === 'bar' ? 'Bar' : 'Cozinha'}` : ''}`} subtitle={`QR Code + rastreio · ${unidadeInfo.nome}`} icon={Tag} />
      <PageBody>
        <button
          type="button"
          onClick={() => router.push("/dashboard/operacao/etiquetas")}
          className="mb-4 flex w-full items-center justify-between gap-4 rounded-2xl border border-violet-300 bg-gradient-to-r from-violet-700 to-fuchsia-600 p-4 text-left text-white shadow-lg shadow-violet-900/20 transition hover:brightness-105 sm:p-5"
        >
          <span className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15"><Mic size={25} /></span>
            <span><strong className="block text-lg font-black">Etiquetas por voz</strong><span className="mt-1 block text-sm font-semibold text-violet-50">Fale vários produtos e quantidades diferentes, confira e confirme a impressão por voz</span></span>
          </span>
          <span className="hidden rounded-xl bg-white px-4 py-2 text-sm font-black text-violet-700 sm:block">Abrir voz</span>
        </button>
        <Toast show={!!salvou}>{salvou}</Toast>

        {/* Abas em forma de botões: gerar, salvas (só salvas) e geradas.
            Cores fixas para garantir contraste sempre. */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[["gerar", "Gerar etiqueta"], ["salvas", "Etiquetas salvas"], ["geradas", "Etiquetas geradas"]].map(([v, l]) => (
            <button key={v} onClick={() => setAba(v)}
              className="px-5 py-2.5 font-bold text-sm rounded-xl transition-all"
              style={aba === v
                ? { background: "var(--accent-strong)", color: "#fff", boxShadow: "0 2px 8px rgba(16,185,129,0.28)" }
                : { background: "var(--panel)", color: "var(--fg)", border: "1px solid var(--line)" }}>
              {l}
            </button>
          ))}
        </div>

        {aba === "geradas" ? (
          <ControleValidade embutido />
        ) : aba === "salvas" ? (
          <EtiquetasSalvas unidadeAtiva={unidadeAtiva} />
        ) : (
        <>
        {/* Filtro por departamento: cada área imprime etiquetas só dos seus itens */}
        <div className="inline-flex gap-1 mb-4 rounded-xl p-1" style={{ background: "var(--elevated)" }}>
          {[["", "Todos"], ["cozinha", "Cozinha"], ["bar", "Bar"]].map(([d, l]) => (
            <button key={d} onClick={() => router.push(`/dashboard/operacao/etiquetas${d ? `?dept=${d}` : ""}`)}
              className="px-4 py-2 rounded-lg font-bold text-sm transition-all"
              style={(deptUrl || "") === d ? { background: "var(--card)", color: "var(--fg)", boxShadow: "0 1px 2px rgba(0,0,0,.15)" } : { color: "var(--muted)" }}>
              {l}
            </button>
          ))}
        </div>

        {(!unidadeAtiva || unidadeAtiva === "todas") ? (
          <EmptyState icon={Tag} title="Acesso Restrito às Unidades" hint="O Cérebro (Gestão Central) apenas visualiza o Controle de Validade. Para gerar novas etiquetas, selecione uma unidade no menu lateral." />
        ) : (
          <div className="grid lg:grid-cols-2 gap-4 items-start">
            {/* ── Formulário ── */}
            <div className="space-y-4">
            <Card>
              <Field label="Produto">
                <Select value={produtos.includes(form.produto) ? form.produto : ""} onChange={(e) => set("produto", e.target.value)}>
                  <option value="">Selecione um produto...</option>
                  {produtos.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </Field>
              <Field label="Ou digite o nome manualmente">
                <TextInput value={form.produto} onChange={(e) => set("produto", e.target.value)} placeholder="Nome do produto" />
              </Field>
            </Card>

            <Card>
              <SectionLabel>Conservação</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {CONSERVACAO.map((c) => {
                  const Icon = ICONE_CONS[c.id] || Box; const sel = form.conservacao === c.id;
                  return (
                    <button key={c.id} onClick={() => escolherConservacao(c.id)}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl transition-all"
                      style={{ border: `1.5px solid ${sel ? c.cor : "var(--line)"}`, background: sel ? c.cor + "22" : "var(--panel)" }}>
                      <Icon size={18} style={{ color: sel ? c.cor : "var(--muted)" }} />
                      <span className="text-[12px] font-bold" style={{ color: sel ? "var(--fg)" : "var(--muted)" }}>{c.id}</span>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Peso do Produto"><NumberInput value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} placeholder="0.00" /></Field>
                <Field label="Unidade"><Select value={form.unidade} onChange={(e) => set("unidade", e.target.value)}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</Select></Field>
                <Field label="Etiquetas p/ Imprimir"><NumberInput value={copias} onChange={(e) => setCopias(e.target.value)} min="1" max="1000" step="1" /></Field>
              </div>
              <div className="mb-2 flex gap-1.5">
                {[["dias", "Daqui a X dias"], ["data", "Escolher a data"]].map(([m, l]) => (
                  <button key={m} onClick={() => { setValidadeModo(m); if (m === "data") setCategoriaValidade(""); }} className="flex-1 py-2 rounded-lg text-[12px] font-bold transition-all"
                    style={validadeModo === m ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--panel)", color: "var(--muted)", border: "1px solid var(--line)" }}>{l}</button>
                ))}
              </div>
              {validadeModo === "dias" ? (
                <Field label="Vence em quantos dias?"><NumberInput value={form.dias} onChange={(e) => { set("dias", e.target.value); setCategoriaValidade(""); }} /></Field>
              ) : (
                <Field label="Data exata da validade"><TextInput type="date" min={dataLocalParaInput()} value={dataValidade} onChange={(e) => setDataValidade(e.target.value)} /></Field>
              )}
              <Field label="Categoria de validade definida nas configurações">
                <Select value={categoriaValidade} onChange={(e) => aplicarCategoria(e.target.value)}>
                  <option value="">Escolher manualmente...</option>
                  {categoriasValidade.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nome} · {categoria.dias} dia{categoria.dias !== 1 ? "s" : ""}</option>
                  ))}
                </Select>
              </Field>
              <button type="button" onClick={() => router.push("/dashboard/configuracoes")}
                className="text-[11px] font-bold flex items-center gap-1.5 mb-3" style={{ color: "var(--accent-fg)" }}>
                <Settings size={13} /> Gerenciar categorias e prazos nas Configurações
              </button>
              <Field label="Lote / SIF (opcional)"><TextInput value={form.lote} onChange={(e) => set("lote", e.target.value)} placeholder="SIF 1234" /></Field>
              <Field label="Responsável">
                <Select value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)}>
                  <option value="">Selecione um funcionário...</option>
                  {form.responsavel && !colaboradores.some((c) => c.nome === form.responsavel) && <option value={form.responsavel}>{form.responsavel}</option>}
                  {colaboradores.map((c) => <option key={c.id} value={c.nome}>{c.nome} ({c.cargo || "Equipe"})</option>)}
                </Select>
              </Field>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <MapPin size={18} className="mt-0.5" style={{ color: "var(--accent-fg)" }} />
                <div className="min-w-0 flex-1">
                  <SectionLabel>Dados automáticos da unidade</SectionLabel>
                  <p className="text-sm font-bold" style={{ color: "var(--fg)" }}>{unidadeInfo.nome}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>CNPJ: {cnpjUnidade ? fmtCNPJ(cnpjUnidade) : "não cadastrado"}</p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>{enderecoUnidade || "Endereço não cadastrado"}</p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>{localizacaoUnidade || "Cidade, UF e CEP não cadastrados"}</p>
                </div>
                <button type="button" onClick={() => router.push("/dashboard/configuracoes")}
                  className="text-[11px] font-bold px-3 py-2 rounded-lg" style={{ border: "1px solid var(--line)", color: "var(--muted)" }}>Editar</button>
              </div>
              {!cadastroUnidadeCompleto && (
                <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} /> Complete CNPJ, CEP, endereço, cidade e UF para a etiqueta sair completa.
                </div>
              )}
            </Card>

            <Card>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <SectionLabel>Impressora térmica direta</SectionLabel>
                  <div className="flex items-center gap-2 mt-1">
                    {impressoraStatus === "conectada"
                      ? <CheckCircle2 size={16} className="text-emerald-600" />
                      : <WifiOff size={16} className="text-slate-400" />}
                    <span className="text-sm font-bold" style={{ color: impressoraStatus === "conectada" ? "#059669" : "var(--muted)" }}>
                      {impressoraStatus === "conectada" ? `Conectada: ${impressoraNome}`
                        : impressoraStatus === "conectando" ? "Aguardando autorização..."
                          : impressoraStatus === "selecionar" ? "Selecione a fila térmica"
                          : "Assistente desconectado"}
                    </span>
                  </div>
                </div>
                <button type="button" onClick={conectarImpressora} disabled={conectando}
                  className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
                  <RefreshCw size={13} className={conectando ? "animate-spin" : ""} />
                  {impressoraStatus === "conectada" ? "Atualizar" : "Conectar e autorizar"}
                </button>
              </div>
              {impressoras.length > 0 && (
                <Field label="Fila de impressão do Windows">
                  <Select value={impressoraNome} onChange={(e) => escolherImpressora(e.target.value)}>
                    <option value="">Selecione a impressora térmica...</option>
                    {impressoras.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
                  </Select>
                </Field>
              )}
              {impressoraErro && <p className="text-[11px] font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-2">{impressoraErro}</p>}
              <p className="text-[10px] font-medium" style={{ color: "var(--dim)" }}>
                Perfil {PERFIS_TP20[tamanho]?.descricao || tamanho}. A guilhotina permanece desligada para proteger a bobina adesiva.
              </p>
              <a href="https://qz.io/download/" target="_blank" rel="noreferrer"
                className="inline-block text-[10px] font-bold mt-1.5" style={{ color: "var(--accent-fg)" }}>
                Instalar o assistente QZ Tray neste computador
              </a>
            </Card>

            {/* Impressora Bluetooth — caminho do tablet/celular Android */}
            <Card>
              <SectionLabel>Impressora Bluetooth (tablet)</SectionLabel>
              {temBluetooth ? (
                <>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {btNome
                        ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                        : <WifiOff size={16} className="text-slate-400 shrink-0" />}
                      <span className="text-sm font-bold truncate" style={{ color: btNome ? "#059669" : "var(--muted)" }}>
                        {btNome ? `Conectada: ${btNome}` : "Nenhuma impressora pareada"}
                      </span>
                    </div>
                    <button type="button" onClick={conectarBluetooth} disabled={btConectando}
                      className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                      style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
                      <RefreshCw size={13} className={btConectando ? "animate-spin" : ""} />
                      {btNome ? "Trocar" : "Conectar"}
                    </button>
                  </div>
                  {btErro && <p className="text-[11px] font-bold text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{btErro}</p>}
                  {btNome && (
                    <Btn variant="primary" className="w-full mt-3" disabled={salvando} onClick={() => salvar("bluetooth")}>
                      <Printer size={15} /> Imprimir por Bluetooth
                    </Btn>
                  )}
                  <p className="text-[10px] font-medium mt-2" style={{ color: "var(--dim)" }}>
                    Imprime direto do tablet, sem computador e sem driver. Ligue a impressora e toque em Conectar.
                  </p>
                </>
              ) : (
                <p className="text-[11px] font-medium mt-1" style={{ color: "var(--muted)" }}>
                  {motivoBluetoothIndisponivel()}
                </p>
              )}
            </Card>

          </div>

          {/* ── Preview / Etiqueta (coluna fixa) ── */}
          <div className="lg:sticky lg:top-4">
            {/* Modelo da etiqueta */}
            <div className="flex gap-1.5 mb-2">
              {[["validade", "Validade completa"], ["nome", "Só o nome"]].map(([v, l]) => (
                <button key={v} onClick={() => setModelo(v)}
                  className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                  style={modelo === v ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel>Pré-visualização</SectionLabel>
              <div className="flex gap-1.5">
                {["80x40", "60x40", "60x60", "80x60", "100x60"].map((t) => (
                  <button key={t} onClick={() => setTamanho(t)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={tamanho === t ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                    {t.replace("x", "×")}mm
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center overflow-auto p-4 bg-slate-100 rounded-2xl border border-slate-200">
              <div id="area-impressao" className="flex flex-col gap-4" style={{ width: dim.paginaW }}>
                {Array.from({ length: quantidadeCopias }).map((_, idx) => (
                  modelo === "nome" ? (
                  /* Etiqueta SÓ NOME: identifica o pote/caixa, sem datas */
                  <div key={idx} className="etiqueta-print shadow-sm" style={{ width: dim.w, height: dim.h, marginLeft: "auto", marginRight: "auto", background: "#fff", color: "#000", padding: dim.pad, fontFamily: "'Courier New', monospace", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ fontSize: `calc(${dim.titulo} * 1.7)`, fontWeight: 900, lineHeight: 1.05, textTransform: "uppercase", wordBreak: "break-word" }}>
                      {nomeProduto || "PRODUTO"}
                    </div>
                    {String(form.quantidade ?? "").trim() !== "" && Number(form.quantidade) > 0 && (
                      <div style={{ fontSize: dim.linha, fontWeight: 800, marginTop: dim.gap }}>
                        {form.quantidade}{form.unidade !== "UN" ? " " + form.unidade : ""}
                      </div>
                    )}
                  </div>
                  ) : (
                  <div key={idx} className="etiqueta-print shadow-sm" style={{ width: dim.w, height: dim.h, marginLeft: "auto", marginRight: "auto", background: "#fff", color: "#000", padding: dim.pad, fontFamily: "'Courier New', monospace", borderRadius: 8, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
                    {/* produto */}
                    <div style={{ fontSize: dim.titulo, fontWeight: 900, lineHeight: 1.0, textTransform: "uppercase", paddingBottom: dim.gap, borderBottom: "0.5mm solid #000" }}>
                      {nomeProduto || "PRODUTO"}
                    </div>
                    {/* conservação + qtd */}
                    <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 800, padding: `${dim.secPad} 0`, borderBottom: "0.4mm solid #000" }}>
                      <span>{form.conservacao.toUpperCase()}</span>
                      {/* Sem peso informado, some a linha inteira — nada de "PESO:" vazio */}
                      {String(form.quantidade ?? "").trim() !== "" && Number(form.quantidade) > 0 && (
                        <span>PESO: {form.quantidade}{form.unidade !== "UN" ? " " + form.unidade : ""}</span>
                      )}
                    </div>
                    {/* aberto: manipulação + validade com hora; fechado:
                        quando foi etiquetado + validade em destaque */}
                    <div style={{ padding: `${dim.secPad} 0`, borderBottom: "0.4mm solid #000" }}>
                      {tipoEtiqueta === "aberto" ? (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 800 }}><span>MANIPULACAO:</span><span>{fmtDataHora(agora)}</span></div>
                          <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 900, marginTop: "0.4mm" }}><span>VALIDADE:</span><span>{fmtDataHora(validadeEm)}</span></div>
                        </>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", whiteSpace: "nowrap", fontSize: dim.linha, fontWeight: 800 }}><span>ETIQUETADO:</span><span>{fmtData(agora)}</span></div>
                          <div style={{ background: "#000", color: "#fff", textAlign: "center", whiteSpace: "nowrap", fontSize: dim.titulo, fontWeight: 900, letterSpacing: "0.3mm", padding: "0.7mm 0", marginTop: "0.4mm", borderRadius: "0.8mm" }}>
                            VAL: {fmtData(validadeEm)}
                          </div>
                        </>
                      )}
                    </div>
                    {/* responsável */}
                    <div style={{ fontSize: dim.linha, fontWeight: 800, marginTop: dim.respMt }}>RESP.: {(form.responsavel || "—").toUpperCase()}</div>
                    {form.lote && <div style={{ fontSize: dim.resp, fontWeight: 800, marginTop: "0.4mm" }}>LOTE/SIF: {form.lote}</div>}
                    {/* espaço flexível empurra o rodapé pra baixo */}
                    <div style={{ flex: 1, minHeight: "0.5mm" }} />
                    {/* rodapé: empresa (esq) + QR encaixado (dir) */}
                    <div style={{ borderTop: "0.5mm solid #000", paddingTop: dim.gap, display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: dim.resp, fontWeight: 800, gap: "1.5mm", flexShrink: 0 }}>
                      <div style={{ minWidth: 0, lineHeight: dim.footLh }}>
                        <div>{(unidadeInfo.nome_fantasia || unidadeInfo.nome || "").toUpperCase()}</div>
                        {tamanho === "60x40" ? (
                          <>
                            {(cnpjUnidade || codigo) && <div>{cnpjUnidade ? `CNPJ: ${fmtCNPJ(cnpjUnidade)}` : ""}{cnpjUnidade && codigo ? "  " : ""}{codigo ? `#${codigo}` : ""}</div>}
                            {enderecoUnidade && <div>{enderecoUnidade.toUpperCase()}</div>}
                            {localizacaoUnidade && <div>{localizacaoUnidade.toUpperCase()}</div>}
                          </>
                        ) : (
                          <>
                            {cnpjUnidade && <div>CNPJ: {fmtCNPJ(cnpjUnidade)}</div>}
                            {enderecoUnidade && <div>{enderecoUnidade.toUpperCase()}</div>}
                            {localizacaoUnidade && <div>{localizacaoUnidade.toUpperCase()}</div>}
                            <div style={{ opacity: 0.7 }}>#{codigo}</div>
                          </>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, lineHeight: 0 }}>
                        <QRCodeSVG data-qr-etiqueta="true" value={rastreioUrl} size={dim.qr} level="M" />
                      </div>
                    </div>
                  </div>
                  )
                ))}
              </div>
            </div>
            <p className="text-[11px] text-center mt-3 flex items-center justify-center gap-1.5" style={{ color: "var(--dim)" }}>
              <QrCode size={13} /> {tamanho.replace("x", "×")}mm · código {codigo}
            </p>
            {/* Como o navegador manda para o driver: tira única ou 1 por página */}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold" style={{ color: "var(--dim)" }}>Impressão:</span>
              {[["tira", "Tira contínua"], ["paginas", "Uma por página"]].map(([v, l]) => (
                <button key={v} onClick={() => setModoTira(v)}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                  style={modoTira === v ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                  {l}
                </button>
              ))}
            </div>
            {/* Correção de orientação: use quando a etiqueta sair deitada */}
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold" style={{ color: "var(--dim)" }}>Orientação:</span>
              {[[false, "Normal"], [true, "Girar 90°"]].map(([v, l]) => (
                <button key={String(v)} onClick={() => setGirar(v)}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                  style={girar === v ? { background: "var(--accent-strong)", color: "#fff" } : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--line)" }}>
                  {l}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-center mt-1.5" style={{ color: "var(--dim)" }}>
              Saiu deitada ou passando para a próxima etiqueta? Alterne aqui e imprima o teste de novo.
            </p>

            {/* Resumo da impressão */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                ["Etiquetas", quantidadeCopias],
                ["Tamanho", tamanho.replace("x", "×") + "mm"],
                ["Saída", modoTira === "tira" ? "Tira" : "Página"],
              ].map(([rot, val]) => (
                <div key={rot} className="rounded-xl px-2 py-2 text-center" style={{ background: "var(--elevated)", border: "1px solid var(--line)" }}>
                  <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--dim)" }}>{rot}</p>
                  <p className="text-sm font-black" style={{ color: "var(--accent-strong)" }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Ações principais */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              <Btn variant="ghost" disabled={salvando} onClick={() => salvar("")}><Save size={16} /> {salvando ? "..." : "Salvar"}</Btn>
              {/* Um único botão Imprimir: usa a TP20 se estiver conectada; senão, impressão comum */}
              <Btn variant="primary" disabled={salvando} onClick={() => salvar(impressoraStatus === "conectada" ? "tp20" : "navegador")}>
                <Printer size={16} /> {salvando ? "..." : "Imprimir"}
              </Btn>
              <Btn variant="ghost" disabled={salvando} onClick={() => salvar("pdf")} title="Gera um PDF no tamanho exato da etiqueta — imprima o PDF em 'Tamanho real / 100%' para não sair miniatura">
                <Printer size={16} /> PDF exato
              </Btn>
            </div>
            <button type="button" onClick={imprimirTeste}
              className="mt-2 w-full rounded-xl border border-dashed py-2.5 text-[12px] font-bold"
              style={{ borderColor: "var(--line)", color: "var(--muted)" }}
              title="Imprime uma etiqueta de teste no tamanho escolhido, sem depender de produto">
              Imprimir etiqueta de teste ({tamanho.replace("x", "×")}mm)
            </button>
            {impressoraStatus !== "conectada" && (
              <p className="text-[11px] mt-2 px-3 py-2 rounded-xl" style={{ background: "rgba(245,158,11,0.12)", color: "#B45309" }}>
                Saindo <b>miniatura</b> ou borrado? O navegador imprime em ~96dpi e o driver costuma forçar A4. Para etiqueta nítida no tamanho certo: use o <b>PDF exato</b> (e imprima em "Tamanho real / 100%"), ou conecte a <b>impressora térmica</b> no botão acima (qualidade nativa 203dpi).
              </p>
            )}

            {/* FILA: vários produtos, cada um com suas cópias, numa impressão só */}
            <Card className="!p-4 mt-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <SectionLabel>Fila de impressão (vários produtos)</SectionLabel>
                {fila.length > 0 && <button onClick={() => setFila([])} className="text-[10px] font-bold" style={{ color: "#DC2626" }}>Limpar fila</button>}
              </div>
              <Btn variant="ghost" className="w-full" disabled={salvando} onClick={adicionarNaFila}>
                <Tag size={15} /> Adicionar à fila: {nomeProduto || "produto"} × {quantidadeCopias}
              </Btn>
              {fila.length > 0 && (
                <>
                  <div className="space-y-1.5 mt-3 max-h-40 overflow-y-auto pr-1">
                    {fila.map((f, idx) => (
                      <div key={f.codigo} className="flex items-center justify-between gap-2 text-xs p-2 rounded-lg" style={{ background: "var(--elevated)" }}>
                        <span className="font-bold truncate" style={{ color: "var(--fg-soft)" }}>{f.produto}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="font-black" style={{ color: "var(--accent-strong)" }}>× {f.copias}</span>
                          <button onClick={() => setFila((p) => p.filter((_, i) => i !== idx))} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: "var(--card)", color: "#DC2626" }}><X size={12} /></button>
                        </span>
                      </div>
                    ))}
                  </div>
                  <Btn variant="primary" className="w-full mt-3" onClick={imprimirFila}>
                    <Printer size={15} /> Imprimir fila ({fila.reduce((s, f) => s + f.copias, 0)} etiquetas)
                  </Btn>
                  <p className="text-[10px] font-medium mt-2" style={{ color: "var(--dim)" }}>Sai tudo numa tira contínua, uma etiqueta colada na outra, pela impressão do navegador. Cada produto já fica registrado no Controle de Validade ao entrar na fila.</p>
                </>
              )}
            </Card>
          </div>
        </div>
        )}
        </>
        )}
      </PageBody>
    </div>
  );
}

export default function EtiquetasPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold" style={{ color: "var(--muted)" }}>Carregando Etiquetas...</div>}>
       <EtiquetasUnificadas />
    </Suspense>
  );
}

function EtiquetasUnificadas() {
  const searchParams = useSearchParams();
  if (searchParams.get("gestao") === "1") return <EtiquetasRunner />;
  return <div className="fixed inset-0 z-[200] overflow-auto bg-slate-50"><EtiquetasRapidas /></div>;
}

function fmtCNPJ(s) {
  const d = (s || "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : s;
}

function fmtCEP(s) {
  const d = String(s || "").replace(/\D/g, "");
  return d.length === 8 ? d.replace(/^(\d{5})(\d{3})$/, "$1-$2") : s;
}

function dataLocalParaInput(data = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

function Linha({ k, v, top, fs = "3.6mm", forte }) {
  const base = { display: "flex", justifyContent: "space-between", gap: "2mm", fontSize: fs, fontWeight: 700, whiteSpace: "nowrap" };
  if (forte) {
    return (
      <div style={{ ...base, background: "#000", color: "#fff", padding: "0.9mm 1.2mm", borderRadius: "0.8mm", marginTop: "1mm" }}>
        <span>{k}</span><span>{v}</span>
      </div>
    );
  }
  return (
    <div style={{ ...base, marginTop: top ? "1.2mm" : "0.6mm", borderBottom: "0.3mm solid #000", paddingBottom: "0.6mm" }}>
      <span>{k}</span><span>{v}</span>
    </div>
  );
}
