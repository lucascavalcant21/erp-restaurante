"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Bluetooth, CheckCircle2, ChefHat, FolderOpen, GlassWater, Maximize2, Mic, Minus, Plus, Printer, RefreshCw, Save, Search, Tag, Trash2, UserRound, X, XCircle } from "lucide-react";
import { useERP } from "../context/ERPContext";
import { fetchEstoque } from "../lib/estoque";
import { fetchProdutos } from "../lib/vendas";
import { fetchColaboradores } from "../lib/rh";
import { CONSERVACAO, criarEtiqueta, excluirListaEtiquetas, fetchListasEtiquetas, gerarCodigo, salvarListaEtiquetas } from "../lib/etiquetas";
import { fetchValidadesEtiqueta } from "../lib/parametros";
import { imprimirHtml } from "../lib/imprimir";
import { criarEscuta, vozDisponivel } from "../lib/hefisto-voz";
import { equipeDaArea } from "../lib/equipe-area.mjs";
import { registrarAuditoria } from "../lib/hefisto-acoes";
import { conectarImpressoraBluetooth, imprimirEtiquetasBluetooth } from "../lib/impressaoTermica";

const UNIDADES = ["UN", "UNIDADE", "GARRAFA", "LATA", "KG", "G", "L", "ML", "CX", "PCT", "BANDEJA"];
const TAMANHOS = {
  "80x40": { w: 80, h: 40, pad: 2, titulo: 4.1, texto: 2.75, pequeno: 2.15, qr: 41 },
  "60x40": { w: 60, h: 40, pad: 1.7, titulo: 3.5, texto: 2.35, pequeno: 1.85, qr: 35 },
  "60x60": { w: 60, h: 60, pad: 2.5, titulo: 4.3, texto: 2.8, pequeno: 2.25, qr: 55 },
};

const numero = valor => Number(valor) || 0;
const validadeDe = (momento, dias) => new Date(momento.getTime() + Math.max(0, numero(dias)) * 86400000);
const dataHora = data => data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const dataCurta = data => data.toLocaleDateString("pt-BR");
const chaveListasLocais = (unidadeId, setor) => `hefisto_listas_etiquetas_${unidadeId || "sem-unidade"}_${setor || "todos"}`;

function lerListasLocais(unidadeId, setor) {
  try { return JSON.parse(localStorage.getItem(chaveListasLocais(unidadeId, setor)) || "[]"); } catch { return []; }
}

function gravarListasLocais(unidadeId, setor, listas) {
  try { localStorage.setItem(chaveListasLocais(unidadeId, setor), JSON.stringify(listas)); } catch {}
}

const normalizarVoz = valor => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const UNIDADES_VOZ = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9 };
const NUMEROS_VOZ = { ...UNIDADES_VOZ, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezassete: 17, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100 };

function converterNumerosDaVoz(texto) {
  let convertido = normalizarVoz(texto);
  const dezenas = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
  convertido = convertido.replace(/\b(vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa) e (um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)\b/g, (_, dezena, unidade) => String(dezenas[dezena] + UNIDADES_VOZ[unidade]));
  return convertido.replace(/\b(zero|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezassete|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem)\b/g, palavra => String(NUMEROS_VOZ[palavra]));
}

function nomeBonitoVoz(nome) {
  return String(nome || "").trim().replace(/\b\w/g, letra => letra.toUpperCase());
}

function Aviso({ aviso, fechar }) {
  useEffect(() => {
    const timer = setTimeout(fechar, 5200);
    return () => clearTimeout(timer);
  }, [aviso, fechar]);
  return <div className={`etq-toast ${aviso.tipo}`}>
    {aviso.tipo === "ok" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
    <span>{aviso.texto}</span><button onClick={fechar}><X size={17} /></button>
  </div>;
}

// Prévia da etiqueta de nome no tamanho real, reduzida só para caber na tela.
function PreviaNome({ item, tamanho }) {
  const dim = TAMANHOS[tamanho] || TAMANHOS["80x40"];
  const larguraPx = dim.w * 3.7795;                 // mm -> px
  const escalaTela = Math.min(1, 268 / larguraPx);
  return (
    <div className="etq-previa" style={{ height: `${dim.h * 3.7795 * escalaTela + 2}px` }}>
      <div style={{ transform: `scale(${escalaTela})`, transformOrigin: "top center" }}>
        <EtiquetaPapel item={{ ...item, modeloEtiqueta: "nome" }} tamanho={tamanho} />
      </div>
    </div>
  );
}

function EtiquetaPapel({ item, responsavel, unidadeInfo, momento, tamanho, tipoEtiqueta }) {
  const dim = TAMANHOS[tamanho] || TAMANHOS["80x40"];
  if (item.modeloEtiqueta === "nome") {
    // Até dois nomes na mesma etiqueta, um embaixo do outro. Com dois, a letra
    // diminui para os dois caberem sem cortar.
    const nomes = [item.nome, item.nome2].map(n => String(n || "").trim()).filter(Boolean);
    const maior = nomes.reduce((m, n) => Math.max(m, n.length), 0);
    const base = maior > 32 ? dim.titulo * 1.45 : maior > 20 ? dim.titulo * 1.7 : dim.titulo * 2.15;
    // O tamanho automático serve na maioria dos casos; a escala é o ajuste fino
    // de quem está olhando a etiqueta na tela.
    const escala = Math.min(2, Math.max(0.5, Number(item.escalaNome) || 1));
    const tamanhoNome = (nomes.length > 1 ? base * 0.62 : base) * escala;
    return <div className="etiqueta-rapida-papel etiqueta-somente-nome" style={{ width: `${dim.w}mm`, height: `${dim.h}mm`, padding: `${dim.pad + 1}mm`, background: "#fff", color: "#000", fontFamily: "Arial,Helvetica,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: nomes.length > 1 ? "1.2mm" : 0 }}>
        {nomes.map((nome, i) => (
          <div key={i} style={{ fontSize: `${tamanhoNome}mm`, lineHeight: 1.05, fontWeight: 950, textAlign: "center", textTransform: "uppercase", overflowWrap: "anywhere" }}>{nome}</div>
        ))}
      </div>
    </div>;
  }
  const validade = validadeDe(momento, item.dias);
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const local = [unidadeInfo?.cidade, unidadeInfo?.uf].filter(Boolean).join("/");
  return <div className="etiqueta-rapida-papel" style={{ width: `${dim.w}mm`, height: `${dim.h}mm`, padding: `${dim.pad}mm`, background: "#fff", color: "#000", fontFamily: "'Courier New',monospace", display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <div style={{ fontSize: `${dim.titulo}mm`, lineHeight: 1, fontWeight: 900, textTransform: "uppercase", borderBottom: ".45mm solid #000", paddingBottom: ".5mm" }}>{item.nome}</div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: "2mm", fontSize: `${dim.texto}mm`, lineHeight: 1.15, fontWeight: 900, padding: ".6mm 0", borderBottom: ".35mm solid #000" }}>
      <span>{item.conservacao.toUpperCase()}</span>{numero(item.quantidade) > 0 && <span>{item.quantidade} {item.unidade}</span>}
    </div>
    <div style={{ fontSize: `${dim.texto}mm`, lineHeight: 1.2, fontWeight: 850, padding: ".55mm 0", borderBottom: ".35mm solid #000" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>{tipoEtiqueta === "aberto" ? "MANIPULADO:" : "ETIQUETADO:"}</span><span>{tipoEtiqueta === "aberto" ? dataHora(momento) : dataCurta(momento)}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: ".35mm", fontWeight: 950 }}><span>VALIDADE:</span><span>{tipoEtiqueta === "aberto" ? dataHora(validade) : dataCurta(validade)}</span></div>
    </div>
    <div style={{ fontSize: `${dim.texto}mm`, fontWeight: 850, marginTop: ".45mm" }}>RESP.: {String(responsavel?.nome || "SEM RESPONSÁVEL").toUpperCase()}</div>
    <div style={{ flex: 1 }} />
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1mm", borderTop: ".4mm solid #000", paddingTop: ".4mm", fontSize: `${dim.pequeno}mm`, lineHeight: 1.12, fontWeight: 800 }}>
      <div><div>{(unidadeInfo?.nome_fantasia || unidadeInfo?.nome || "UNIDADE").toUpperCase()}</div>{local && <div>{local.toUpperCase()}</div>}<div>#{item.codigo}</div></div>
      <QRCodeSVG data-qr-codigo={item.codigo} value={`${origem}/rastreio/${item.codigo}`} size={dim.qr} level="M" />
    </div>
  </div>;
}

export default function EtiquetasRapidas() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  const [setor, setSetor] = useState("");
  const [funcionarios, setFuncionarios] = useState([]);
  const [responsavelId, setResponsavelId] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [item, setItem] = useState(null);
  const [fila, setFila] = useState([]);
  const [nomeLivre, setNomeLivre] = useState("");
  const [criandoLivre, setCriandoLivre] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [tipoEtiqueta, setTipoEtiqueta] = useState("aberto");
  const [modeloEtiqueta, setModeloEtiqueta] = useState("validade");
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [vozAberta, setVozAberta] = useState(false);
  const [ouvindoVoz, setOuvindoVoz] = useState(false);
  const [textoVoz, setTextoVoz] = useState("");
  const [respostaVoz, setRespostaVoz] = useState("Fale todos os produtos e quantidades em uma unica frase.");
  const escutaVozRef = useRef(null);
  const [listasSalvas, setListasSalvas] = useState([]);
  const [salvandoLista, setSalvandoLista] = useState(false);
  const [modalSalvarLista, setModalSalvarLista] = useState(false);
  const [nomeNovaLista, setNomeNovaLista] = useState("");
  const [listaParaExcluir, setListaParaExcluir] = useState(null);
  const [bluetoothNome, setBluetoothNome] = useState("");
  const [conectandoBluetooth, setConectandoBluetooth] = useState(false);
  const [tamanho] = useState(() => { try { return localStorage.getItem("hefisto_etq_tamanho") || "80x40"; } catch { return "80x40"; } });
  const [momento, setMomento] = useState(() => new Date());

  const responsavel = funcionarios.find(pessoa => String(pessoa.id) === String(responsavelId));
  const totalEtiquetas = fila.reduce((total, produto) => total + Math.max(1, Math.floor(numero(produto.copias))), 0);

  const carregarBase = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    const [colaboradores, validades] = await Promise.all([fetchColaboradores(unidadeAtiva), fetchValidadesEtiqueta(unidadeAtiva)]);
    setFuncionarios(equipeDaArea(colaboradores.data || [], setor));
    setCategorias(validades.data || []);
  }, [unidadeAtiva]);

  useEffect(() => { carregarBase(); }, [carregarBase]);

  const carregarListas = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas" || !setor) return setListasSalvas([]);
    const remotas = await fetchListasEtiquetas(unidadeAtiva, setor, 30);
    const locais = lerListasLocais(unidadeAtiva, setor);
    const mapa = new Map([...(remotas.data || []), ...locais].map(lista => [String(lista.id), lista]));
    setListasSalvas([...mapa.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
  }, [setor, unidadeAtiva]);

  useEffect(() => { carregarListas(); }, [carregarListas]);

  useEffect(() => {
    if (!setor || !unidadeAtiva || unidadeAtiva === "todas") return;
    let ativo = true;
    setCarregando(true);
    Promise.all([fetchEstoque(unidadeAtiva, setor), fetchProdutos(unidadeAtiva, setor)]).then(([estoque, cardapio]) => {
      if (!ativo) return;
      const mapa = new Map();
      (estoque.data || []).forEach(produto => {
        if (!produto.nome) return;
        mapa.set(produto.nome.toLocaleLowerCase("pt-BR"), {
          id: `estoque:${produto.id || produto.insumo_id || produto.nome}`,
          nome: produto.nome,
          unidade: String(produto.unidade_comercial || produto.unidade_medida || produto.unidade || "UN").toUpperCase(),
          custo: numero(produto.custo_unitario || produto.preco_unit), origem: "Estoque",
        });
      });
      (cardapio.data || []).forEach(produto => {
        const nome = produto.nome_produto;
        if (!nome || mapa.has(nome.toLocaleLowerCase("pt-BR"))) return;
        mapa.set(nome.toLocaleLowerCase("pt-BR"), { id: `produto:${produto.id || nome}`, nome, unidade: "UN", custo: 0, origem: "Cardápio" });
      });
      setProdutos([...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [setor, unidadeAtiva]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return produtos.filter(produto => !termo || produto.nome.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, produtos]);

  function abrirProduto(produto) {
    setItem({ ...produto, quantidade: "", informarQuantidade: false, copias: 1, dias: 3, conservacao: "Resfriado", codigo: gerarCodigo() });
    setCategoriaId("");
    setModeloEtiqueta("validade");
    setMostrarDetalhes(false);
    setMomento(new Date());
  }

  function alterar(campo, valor) { setItem(atual => ({ ...atual, [campo]: valor })); }

  function voltar() {
    if (item) return setItem(null);
    if (responsavelId) { setResponsavelId(""); setFila([]); return; }
    if (setor) { setSetor(""); setBusca(""); return; }
    router.back();
  }

  async function telaCheia() {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); } catch {}
  }

  function adicionarFila() {
    if (!item || numero(item.copias) < 1 || (modeloEtiqueta === "validade" && numero(item.dias) < 0)) return setAviso({ tipo: "erro", texto: "Revise a quantidade de cópias e a validade." });
    setFila(atual => [...atual, { ...item, modeloEtiqueta, tipoEtiqueta, codigo: item.codigo || gerarCodigo() }]);
    setItem(null);
    setCriandoLivre(false);
    setNomeLivre("");
    setAviso({ tipo: "ok", texto: `${item.nome} adicionado à fila.` });
  }

  function abrirNomeLivre() {
    const nome = nomeLivre.trim();
    if (!nome) return setAviso({ tipo: "erro", texto: "Digite o nome da etiqueta avulsa." });
    abrirProduto({ id: `livre:${Date.now()}`, nome, unidade: "UN", custo: 0, origem: "Nome livre" });
  }

  // O app instalado bloqueia window.prompt: o nome da lista é pedido numa
  // caixa da própria tela, senão o botão "Salvar lista" não fazia nada.
  function salvarFilaComoLista() {
    if (!fila.length || salvandoLista) return;
    const padrao = `Lista ${new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
    setNomeNovaLista(padrao);
    setModalSalvarLista(true);
  }

  async function confirmarSalvarLista() {
    if (!fila.length || salvandoLista) return;
    const padrao = `Lista ${new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
    const nome = nomeNovaLista;
    setModalSalvarLista(false);
    setSalvandoLista(true);
    const itens = fila.map(({ codigo: _codigo, ...produto }) => produto);
    const dados = {
      nome: nome.trim() || padrao,
      setor,
      responsavelId: responsavel?.id,
      responsavelNome: responsavel?.nome,
      itens,
      totalEtiquetas,
      criadoPor: sessao?.nome || sessao?.user?.email || responsavel?.nome || null,
    };
    const resposta = await salvarListaEtiquetas(dados, unidadeAtiva);
    if (resposta.error) {
      const locais = lerListasLocais(unidadeAtiva, setor);
      const local = { id: `local:${Date.now()}`, unidade_id: unidadeAtiva, ...dados, responsavel_nome: dados.responsavelNome, total_etiquetas: totalEtiquetas, created_at: new Date().toISOString() };
      gravarListasLocais(unidadeAtiva, setor, [local, ...locais]);
      setAviso({ tipo: "ok", texto: "Lista salva neste aparelho. Ative a tabela de listas para compartilhar com outros aparelhos." });
    } else {
      setAviso({ tipo: "ok", texto: `Lista “${dados.nome}” salva para usar depois.` });
    }
    registrarAuditoria({
      unidadeId: unidadeAtiva,
      usuarioId: sessao?.user?.id || sessao?.id || responsavel?.id || null,
      usuarioNome: responsavel?.nome || sessao?.nome || sessao?.user?.email || "",
      comando: "Salvar lista de etiquetas",
      intencao: { nome: dados.nome, itens: itens.map(item => ({ produto: item.nome, copias: item.copias, modelo: item.modeloEtiqueta })) },
      acao: "labels.save_list",
      modulo: "labels",
      valorNovo: totalEtiquetas,
      resultado: resposta.error ? "local" : "sucesso",
      exigiuConfirmacao: true,
    }).catch(() => {});
    setSalvandoLista(false);
    await carregarListas();
  }

  function carregarListaSalva(lista) {
    const itens = Array.isArray(lista.itens) ? lista.itens : [];
    const total = itens.reduce((soma, item) => soma + Math.max(1, Math.floor(numero(item.copias))), 0);
    if (!itens.length) return setAviso({ tipo: "erro", texto: "Esta lista não possui itens." });
    if (total > 1000) return setAviso({ tipo: "erro", texto: "A lista ultrapassa o limite de 1000 etiquetas." });
    setFila(itens.map((itemLista, indice) => ({ ...itemLista, id: itemLista.id || `lista:${lista.id}:${indice}`, codigo: gerarCodigo() })));
    setMomento(new Date());
    setAviso({ tipo: "ok", texto: `Lista “${lista.nome}” carregada. Confira antes de imprimir.` });
  }

  // Confirmação em dois toques, na própria tela: window.confirm também é
  // bloqueado no app instalado.
  async function removerListaSalva(lista) {
    if (String(listaParaExcluir) !== String(lista.id)) { setListaParaExcluir(lista.id); return; }
    setListaParaExcluir(null);
    if (String(lista.id).startsWith("local:")) {
      const restantes = lerListasLocais(unidadeAtiva, setor).filter(itemLista => String(itemLista.id) !== String(lista.id));
      gravarListasLocais(unidadeAtiva, setor, restantes);
    } else {
      const resposta = await excluirListaEtiquetas(lista.id);
      if (resposta.error) return setAviso({ tipo: "erro", texto: "Não consegui excluir esta lista." });
    }
    await carregarListas();
  }

  async function conectarTomatoBluetooth() {
    if (conectandoBluetooth) return;
    setConectandoBluetooth(true);
    try {
      const conexao = await conectarImpressoraBluetooth();
      setBluetoothNome(conexao.nome);
      setAviso({ tipo: "ok", texto: `${conexao.nome} conectada diretamente. O AirPrint não será usado.` });
    } catch (erro) {
      setBluetoothNome("");
      setAviso({ tipo: "erro", texto: erro?.message || "Não consegui conectar à impressora Bluetooth." });
    } finally {
      setConectandoBluetooth(false);
    }
  }

  function localizarProdutoPorVoz(nomeFalado) {
    const procurado = normalizarVoz(nomeFalado);
    if (!procurado) return null;
    const exato = produtos.find(produto => normalizarVoz(produto.nome) === procurado);
    if (exato) return exato;
    const candidatos = produtos.filter(produto => {
      const nome = normalizarVoz(produto.nome);
      return nome.includes(procurado) || procurado.includes(nome);
    });
    return candidatos.sort((a, b) => Math.abs(normalizarVoz(a.nome).length - procurado.length) - Math.abs(normalizarVoz(b.nome).length - procurado.length))[0] || null;
  }

  const semAcentoVoz = (v) => {
    const d = String(v || "").normalize("NFD");
    let out = "";
    for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
    return out.toLowerCase().trim();
  };

  // Monta os itens da fila a partir de uma lista já interpretada.
  function adicionarItensNaFila(itens, textoOriginal) {
    const nomesLivres = [];
    const novosItens = itens.map((item, indice) => {
      const encontrado = localizarProdutoPorVoz(item.produto);
      const produto = encontrado || { id: `voz-livre:${Date.now()}:${indice}`, nome: nomeBonitoVoz(item.produto), unidade: "UN", custo: 0, origem: "Comando de voz" };
      if (!encontrado) nomesLivres.push(produto.nome);
      return {
        ...produto,
        quantidade: "",
        informarQuantidade: false,
        copias: Math.max(1, Math.floor(Number(item.copias) || 1)),
        dias: Number.isFinite(Number(item.dias)) && Number(item.dias) >= 0 ? Number(item.dias) : 3,
        conservacao: "Resfriado",
        codigo: gerarCodigo(),
        modeloEtiqueta: item.somente_nome ? "nome" : "validade",
        tipoEtiqueta: "aberto",
      };
    });
    if (!novosItens.length) {
      setRespostaVoz("Nao consegui separar os itens. Comece cada produto pela quantidade, por exemplo: 3 etiquetas de arroz, 2 de feijao.");
      return;
    }
    const novasEtiquetas = novosItens.reduce((total, item) => total + item.copias, 0);
    if (totalEtiquetas + novasEtiquetas > 1000) {
      setRespostaVoz(`O comando tem ${novasEtiquetas} etiquetas e ultrapassa o limite de 1000. Fale quantidades menores.`);
      return;
    }
    // Ditar o mesmo produto duas vezes soma as cópias em vez de criar duas
    // linhas iguais na fila (só junta quando validade e modelo batem).
    setFila(atual => {
      const resultado = [...atual];
      novosItens.forEach(novo => {
        const igual = resultado.findIndex(x =>
          semAcentoVoz(x.nome) === semAcentoVoz(novo.nome)
          && Number(x.dias) === Number(novo.dias)
          && x.modeloEtiqueta === novo.modeloEtiqueta);
        if (igual >= 0) resultado[igual] = { ...resultado[igual], copias: resultado[igual].copias + novo.copias };
        else resultado.push(novo);
      });
      return resultado;
    });
    setMomento(new Date());
    setRespostaVoz(`${novosItens.length} produto(s) e ${novasEtiquetas} etiqueta(s) adicionados a fila.${nomesLivres.length ? ` Nao estavam no cadastro e entraram pelo nome falado: ${nomesLivres.join(", ")}.` : ""}`);
    registrarAuditoria({
      unidadeId: unidadeAtiva,
      usuarioId: sessao?.user?.id || sessao?.id || responsavel?.id || null,
      usuarioNome: responsavel?.nome || sessao?.nome || sessao?.user?.email || "",
      comando: textoOriginal,
      intencao: { itens: novosItens.map(item => ({ produto: item.nome, copias: item.copias, validade_dias: item.dias, modelo: item.modeloEtiqueta })) },
      acao: "labels.voice_batch",
      modulo: "labels",
      valorAnterior: totalEtiquetas,
      valorNovo: totalEtiquetas + novasEtiquetas,
      resultado: "sucesso",
      exigiuConfirmacao: true,
    }).catch(() => {});
  }

  // A IA separa a lista ditada: a transcrição vem sem vírgulas e com erros de
  // audição, e regex não dá conta. Se a IA falhar, cai no separador local.
  async function processarComandoVozIA(texto) {
    setRespostaVoz("Entendendo o que você falou...");
    try {
      const resposta = await fetch("/api/hefisto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto, contexto: { modulo: "labels", pagina: "etiquetas" } }),
      });
      const dados = await resposta.json();
      const itens = dados?.intencao?.etiquetas || [];
      if (!resposta.ok || !itens.length) { processarComandoVoz(texto); return; }
      adicionarItensNaFila(itens, texto);
    } catch {
      processarComandoVoz(texto); // sem internet: separador local
    }
  }

  function processarComandoVoz(texto) {
    const comando = converterNumerosDaVoz(texto);
    setTextoVoz(texto);
    const confirmouImpressao = /\b(?:confirmar|confirme|confirmo)\b.*\b(?:impressao|etiquetas?|fila)\b|\b(?:pode imprimir|imprimir agora)\b/.test(comando);
    if (confirmouImpressao) {
      if (!fila.length) {
        setRespostaVoz("A fila está vazia. Primeiro diga os produtos e as quantidades.");
        return;
      }
      if (!responsavel) {
        setRespostaVoz("Escolha na tela quem está etiquetando antes de confirmar por voz.");
        return;
      }
      setRespostaVoz("Confirmação por voz recebida. Abrindo a impressão.");
      fecharVoz();
      imprimirFila(texto);
      return;
    }
    const partes = comando.split(/[,;]|\s+e\s+(?=\d+\b)/).map(parte => parte.trim()).filter(Boolean);
    const novosItens = [];
    const nomesLivres = [];

    partes.forEach((parte, indice) => {
      const quantidadeEncontrada = parte.match(/^\s*(\d+)\s*(?:(?:etiquetas?|copias?|unidades?)\s*)?(?:(?:de|do|da|para)\s+)?/);
      if (!quantidadeEncontrada) return;
      const copias = Math.max(1, Math.floor(Number(quantidadeEncontrada[1]) || 1));
      let restante = parte.slice(quantidadeEncontrada[0].length).trim();
      const somenteNome = /\b(?:somente|so|apenas)(?:\s+com)?\s+(?:o\s+)?nome\b/.test(restante);
      const fechado = /\b(?:produto\s+)?fechado\b/.test(restante);
      const validadeEncontrada = restante.match(/\b(?:com\s+)?validade(?:\s+de|\s+por)?\s*(\d+)\s*dias?\b/);
      const dias = validadeEncontrada ? Math.max(0, Number(validadeEncontrada[1]) || 0) : 3;
      restante = restante
        .replace(/\b(?:com\s+)?validade(?:\s+de|\s+por)?\s*\d+\s*dias?\b/g, " ")
        .replace(/\b(?:somente|so|apenas)(?:\s+com)?\s+(?:o\s+)?nome\b/g, " ")
        .replace(/\b(?:produto\s+)?fechado\b/g, " ")
        .replace(/^\s*(?:de|do|da)\s+/, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!restante) return;

      const produtoEncontrado = localizarProdutoPorVoz(restante);
      const produto = produtoEncontrado || { id: `voz-livre:${Date.now()}:${indice}`, nome: nomeBonitoVoz(restante), unidade: "UN", custo: 0, origem: "Comando de voz" };
      if (!produtoEncontrado) nomesLivres.push(produto.nome);
      novosItens.push({
        ...produto,
        quantidade: "",
        informarQuantidade: false,
        copias,
        dias,
        conservacao: "Resfriado",
        codigo: gerarCodigo(),
        modeloEtiqueta: somenteNome ? "nome" : "validade",
        tipoEtiqueta: fechado ? "fechado" : "aberto",
      });
    });

    if (!novosItens.length) {
      setRespostaVoz("Nao consegui separar os itens. Comece cada produto pela quantidade, por exemplo: 3 etiquetas de arroz, 2 de feijao.");
      return;
    }
    const novasEtiquetas = novosItens.reduce((total, item) => total + item.copias, 0);
    if (totalEtiquetas + novasEtiquetas > 1000) {
      setRespostaVoz(`O comando tem ${novasEtiquetas} etiquetas e ultrapassa o limite de 1000. Fale quantidades menores.`);
      return;
    }
    setFila(atual => [...atual, ...novosItens]);
    setMomento(new Date());
    setRespostaVoz(`${novosItens.length} produto(s) e ${novasEtiquetas} etiqueta(s) adicionados a fila.${nomesLivres.length ? ` Nao encontrei no cadastro e usei como nome livre: ${nomesLivres.join(", ")}.` : ""}`);
    registrarAuditoria({
      unidadeId: unidadeAtiva,
      usuarioId: sessao?.user?.id || sessao?.id || responsavel?.id || null,
      usuarioNome: responsavel?.nome || sessao?.nome || sessao?.user?.email || "",
      comando: texto,
      intencao: { itens: novosItens.map(item => ({ produto: item.nome, copias: item.copias, validade_dias: item.dias, modelo: item.modeloEtiqueta })) },
      acao: "labels.voice_batch",
      modulo: "labels",
      valorAnterior: totalEtiquetas,
      valorNovo: totalEtiquetas + novasEtiquetas,
      resultado: "sucesso",
      exigiuConfirmacao: true,
    }).catch(() => {});
  }

  function iniciarEscutaVoz() {
    setVozAberta(true);
    if (!vozDisponivel()) {
      setRespostaVoz("Este navegador nao reconhece voz. Use o Chrome no Android ou o Safari no iPhone e autorize o microfone.");
      return;
    }
    escutaVozRef.current?.parar?.();
    setTextoVoz("");
    setRespostaVoz("Ouvindo. Fale agora todos os produtos e quantidades.");
    setOuvindoVoz(true);
    const sessao = criarEscuta({
      // Lista longa de produtos: continua ouvindo mesmo com pausas entre um
      // item e outro; só encerra depois de 4s de silêncio ou no botão Parar.
      continuo: true,
      silencioMs: 4000,
      onParcial: parcial => setTextoVoz(parcial),
      onFinal: final => processarComandoVozIA(final),
      onErro: erro => { setOuvindoVoz(false); setRespostaVoz(erro); },
      onFim: () => setOuvindoVoz(false),
    });
    escutaVozRef.current = sessao;
    if (!sessao) {
      setOuvindoVoz(false);
      setRespostaVoz("Nao consegui acessar o microfone neste aparelho.");
      return;
    }
    sessao.iniciar();
  }

  function fecharVoz() {
    escutaVozRef.current?.parar?.();
    setOuvindoVoz(false);
    setVozAberta(false);
  }

  useEffect(() => () => escutaVozRef.current?.parar?.(), []);

  async function imprimirFila(comandoVoz = "") {
    if (!responsavel) return setAviso({ tipo: "erro", texto: "Escolha quem está etiquetando." });
    if (!fila.length) return setAviso({ tipo: "erro", texto: "Adicione pelo menos uma etiqueta à fila." });
    if (totalEtiquetas > 100) return setAviso({ tipo: "erro", texto: "A fila pode ter no máximo 100 etiquetas." });
    setSalvando(true);
    const etiquetasValidade = fila.filter(produto => produto.modeloEtiqueta !== "nome");
    const resultados = await Promise.all(etiquetasValidade.map(produto => criarEtiqueta({
      codigo: produto.codigo, produto: produto.nome, conservacao: produto.conservacao,
      quantidade: produto.informarQuantidade ? numero(produto.quantidade) : 0, unidade: produto.unidade,
      validade_dias: numero(produto.dias), manipulacao_em: momento.toISOString(),
      validade_em: validadeDe(momento, produto.dias).toISOString(), lote: setor === "bar" ? "BAR" : "COZINHA",
      responsavel: responsavel.nome, custo_unit: produto.custo || 0, status: "ativa",
      copias: Math.max(1, Math.floor(numero(produto.copias))), tipo_etiqueta: produto.tipoEtiqueta || "aberto",
    }, unidadeAtiva, { departamento: setor, usuario: responsavel })));

    const fonte = document.getElementById("etiquetas-rapidas-print");
    const dim = TAMANHOS[tamanho] || TAMANHOS["80x40"];
    try {
      if (bluetoothNome) {
        for (const produto of fila) {
          await imprimirEtiquetasBluetooth({
            tamanho,
            copias: Math.max(1, Math.floor(numero(produto.copias))),
            larguraImpressora: "58mm",
            dados: {
              codigo: produto.codigo,
              produto: produto.nome,
              produto2: produto.nome2 || "",
              escalaNome: Number(produto.escalaNome) || 1,
              conservacao: produto.conservacao,
              quantidade: produto.informarQuantidade ? produto.quantidade : "",
              unidade: produto.unidade,
              tipoEtiqueta: produto.tipoEtiqueta || "aberto",
              modeloEtiqueta: produto.modeloEtiqueta,
              momento,
              validade: validadeDe(momento, produto.dias),
              responsavel: responsavel.nome,
              unidadeNome: unidadeInfo?.nome_fantasia || unidadeInfo?.nome,
              cnpj: unidadeInfo?.cnpj,
              endereco: [unidadeInfo?.endereco, unidadeInfo?.numero].filter(Boolean).join(", "),
              localizacao: [unidadeInfo?.cidade, unidadeInfo?.uf].filter(Boolean).join("/"),
            },
          });
        }
      } else if (fonte) {
        imprimirHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>@page{size:${dim.w}mm ${dim.h}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}#etiquetas-rapidas-print{position:static!important;left:auto!important;display:block!important;width:${dim.w}mm!important}.etiqueta-rapida-papel{break-after:page;page-break-after:always;break-inside:avoid;margin:0!important}.etiqueta-rapida-papel:last-child{break-after:auto;page-break-after:auto}</style></head><body>${fonte.outerHTML}</body></html>`, { aoFalhar: () => setAviso({ tipo: "erro", texto: "A janela de impressão não abriu." }) });
      }
    } catch (erro) {
      setSalvando(false);
      setAviso({ tipo: "erro", texto: erro?.message || "A Tomato desconectou durante a impressão." });
      return;
    }
    setSalvando(false);
    const falhas = resultados.filter(resultado => resultado?.error).length;
    registrarAuditoria({
      unidadeId: unidadeAtiva,
      usuarioId: sessao?.user?.id || sessao?.id || responsavel?.id || null,
      usuarioNome: responsavel?.nome || sessao?.nome || sessao?.user?.email || "",
      comando: comandoVoz || "Confirmação pelo botão de impressão",
      intencao: { itens: fila.map(produto => ({ produto: produto.nome, copias: produto.copias, validade_dias: produto.dias, modelo: produto.modeloEtiqueta })) },
      acao: "labels.print_batch",
      modulo: "labels",
      valorAnterior: totalEtiquetas,
      valorNovo: totalEtiquetas,
      resultado: falhas ? "parcial" : "sucesso",
      erro: falhas ? `${falhas} item(ns) não foram registrados.` : null,
      exigiuConfirmacao: true,
    }).catch(() => {});
    setAviso(falhas
      ? { tipo: "erro", texto: `A impressão abriu, mas ${falhas} item(ns) não foram registrados.` }
      : { tipo: "ok", texto: bluetoothNome ? `${totalEtiquetas} etiqueta(s) enviadas diretamente para ${bluetoothNome}.` : `${totalEtiquetas} etiqueta(s) preparadas para impressão.` });
    setFila([]);
    setBusca("");
  }

  if (!unidadeAtiva || unidadeAtiva === "todas") return <div className="etq-vazio"><Tag size={56} /><h1>Escolha uma unidade</h1><p>Selecione uma loja antes de abrir Etiquetas.</p><button onClick={() => router.back()}><ArrowLeft size={18} /> Voltar</button><style>{ESTILOS}</style></div>;

  if (!setor) return <div className="etq-inicio"><style>{ESTILOS}</style><div className="etq-topo"><button onClick={voltar}><ArrowLeft size={19} /> Voltar</button><button onClick={telaCheia}><Maximize2 size={18} /> Tela cheia</button></div><main><div className="etq-inicio-voz"><Mic size={28}/><div><strong>Etiquetas por voz</strong><span>Escolha a área e depois seu nome para liberar o microfone.</span></div></div><Tag size={52} /><h1>Etiquetas</h1><p>Escolha a área para começar.</p><div className="etq-setores"><button className="cozinha" onClick={() => setSetor("cozinha")}><ChefHat /> Cozinha <span>Voz ou manual · produtos e pré-preparos</span></button><button className="bar" onClick={() => setSetor("bar")}><GlassWater /> Bar <span>Voz ou manual · bebidas e pré-preparos</span></button></div></main></div>;

  if (!responsavel) return <div className="etq-pessoas" style={{ "--cor": setor === "bar" ? "#2563eb" : "#059669" }}><style>{ESTILOS}</style><div className="etq-pessoas-topo"><button onClick={voltar}><ArrowLeft size={19}/> Voltar</button><button onClick={telaCheia}><Maximize2 size={18}/> Tela cheia</button></div><main><div className="etq-pessoas-icone"><UserRound size={34}/></div><h1>Quem está etiquetando?</h1><p>{setor === "bar" ? "Bar" : "Cozinha"} · escolha seu nome uma vez para montar toda a fila.</p><div className="etq-pessoas-voz"><Mic size={19}/><span>Depois de escolher seu nome, o botão roxo <b>Adicionar várias por voz</b> aparecerá no topo.</span></div>{carregando ? <div className="etq-sem"><RefreshCw className="animate-spin"/> Carregando equipe...</div> : <div className="etq-pessoas-grid">{funcionarios.map(funcionario => <button key={funcionario.id} onClick={() => setResponsavelId(String(funcionario.id))}><span><UserRound size={24}/></span><div><strong>{funcionario.nome}</strong><small>{funcionario.cargo || "Funcionário"}</small></div></button>)}</div>}</main></div>;

  return <div className="etq-app" style={{ "--cor": setor === "bar" ? "#2563eb" : "#059669", "--suave": setor === "bar" ? "#eff6ff" : "#ecfdf5" }}>
    <style>{ESTILOS}</style>
    <header><button onClick={voltar}><ArrowLeft size={20} /></button><Tag size={27} color="var(--cor)" /><div><strong>Etiquetas · {setor === "bar" ? "Bar" : "Cozinha"}</strong><span>{responsavel.nome} · {totalEtiquetas} etiqueta(s) na fila</span></div><button onClick={telaCheia}><Maximize2 size={19} /></button></header>
    <main className="etq-conteudo">
      {fila.length > 0 && <section className="etq-fila"><div className="etq-fila-topo"><div><strong>Fila de etiquetas</strong><span>{fila.length} tipo(s) · {totalEtiquetas} etiqueta(s)</span></div><div className="etq-fila-acoes"><button className="salvar" onClick={iniciarEscutaVoz} disabled={salvando} style={{ background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" }}><Mic size={19}/> Falar mais</button><button className="salvar" onClick={salvarFilaComoLista} disabled={salvandoLista || salvando}>{salvandoLista ? <RefreshCw className="animate-spin" size={18}/> : <Save size={19}/>} {salvandoLista ? "Salvando..." : "Salvar lista"}</button><button className="imprimir" onClick={() => imprimirFila()} disabled={salvando}>{salvando ? <RefreshCw className="animate-spin" size={19}/> : <Printer size={20}/>} {salvando ? "Preparando..." : "Imprimir"}</button></div></div><div className="etq-fila-lista">{fila.map((produto, indice) => {
        const mudar = (campo, valor) => setFila(atual => atual.map((x, i) => i === indice ? { ...x, [campo]: valor } : x));
        return (
        <article key={`${produto.codigo}-${indice}`} style={{ display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* O nome vem da voz e às vezes sai errado: dá para corrigir aqui,
                sem tirar da fila e adicionar de novo. */}
            <input value={produto.nome} onChange={e => mudar("nome", e.target.value)}
              aria-label={`Nome da etiqueta ${indice + 1}`}
              style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 11, border: "1px solid #cbd5e1", padding: "0 12px", fontWeight: 900, fontSize: 16, color: "#0f172a", background: "#fff" }} />
            <button onClick={() => setFila(atual => atual.filter((_, posicao) => posicao !== indice))} aria-label={`Remover ${produto.nome}`}><Trash2 size={17}/></button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", marginTop: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <small style={{ fontWeight: 800, color: "#64748b" }}>Cópias</small>
              <button onClick={() => mudar("copias", Math.max(1, produto.copias - 1))} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900, fontSize: 18 }}>−</button>
              <input type="number" min="1" max="1000" value={produto.copias}
                onChange={e => mudar("copias", Math.max(1, Math.min(1000, Math.floor(Number(e.target.value) || 1))))}
                style={{ width: 66, height: 38, borderRadius: 10, border: "1px solid #cbd5e1", textAlign: "center", fontWeight: 900 }} />
              <button onClick={() => mudar("copias", Math.min(1000, produto.copias + 1))} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900, fontSize: 18 }}>+</button>
            </span>
            {produto.modeloEtiqueta !== "nome" && (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <small style={{ fontWeight: 800, color: "#64748b" }}>Validade</small>
                <input type="number" min="0" max="3650" value={produto.dias}
                  onChange={e => mudar("dias", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  style={{ width: 66, height: 38, borderRadius: 10, border: "1px solid #cbd5e1", textAlign: "center", fontWeight: 900 }} />
                <small style={{ fontWeight: 800, color: "#64748b" }}>dia(s)</small>
              </span>
            )}
            {produto.modeloEtiqueta === "nome" && (<>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <small style={{ fontWeight: 800, color: "#64748b" }}>2º nome</small>
                <input value={produto.nome2 || ""} onChange={e => mudar("nome2", e.target.value)}
                  placeholder="opcional"
                  style={{ width: 150, height: 38, borderRadius: 10, border: "1px solid #cbd5e1", padding: "0 10px", fontWeight: 800 }} />
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <small style={{ fontWeight: 800, color: "#64748b" }}>Letra</small>
                <button onClick={() => mudar("escalaNome", Math.max(0.5, Math.round(((Number(produto.escalaNome) || 1) - 0.1) * 10) / 10))}
                  style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900, fontSize: 18 }}>−</button>
                <span style={{ minWidth: 46, textAlign: "center", fontWeight: 900, color: "#334155" }}>{Math.round((Number(produto.escalaNome) || 1) * 100)}%</span>
                <button onClick={() => mudar("escalaNome", Math.min(2, Math.round(((Number(produto.escalaNome) || 1) + 0.1) * 10) / 10))}
                  style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontWeight: 900, fontSize: 18 }}>+</button>
              </span>
              <PreviaNome item={produto} tamanho={tamanho} />
            </>)}
            <button onClick={() => mudar("modeloEtiqueta", produto.modeloEtiqueta === "nome" ? "validade" : "nome")}
              style={{ height: 38, padding: "0 14px", borderRadius: 10, fontWeight: 800, border: "1px solid " + (produto.modeloEtiqueta === "nome" ? "#059669" : "#cbd5e1"), background: produto.modeloEtiqueta === "nome" ? "#059669" : "#fff", color: produto.modeloEtiqueta === "nome" ? "#fff" : "#334155" }}>
              Só o nome
            </button>
          </div>
        </article>);
      })}</div></section>}
      <div className="etq-titulo"><h2>{fila.length ? "Adicionar outro produto" : "1. Escolha o produto"}</h2><span>{visiveis.length} disponível(is)</span></div>
      <button className="etq-voz-abrir" onClick={iniciarEscutaVoz}><span><Mic size={23}/></span><div><strong>Adicionar várias por voz</strong><small>Diga produtos, quantidades, validade ou somente nome</small></div></button>
      <button className={`etq-bluetooth ${bluetoothNome ? "conectada" : ""}`} onClick={conectarTomatoBluetooth} disabled={conectandoBluetooth}><Bluetooth size={22}/><div><strong>{bluetoothNome ? `Tomato conectada: ${bluetoothNome}` : "Conectar Tomato Bluetooth"}</strong><small>{bluetoothNome ? "A impressão será direta, sem AirPrint" : "Para Android com Chrome · escolha a impressora dentro do sistema"}</small></div>{conectandoBluetooth && <RefreshCw className="animate-spin" size={19}/>}</button>
      <section className="etq-listas-salvas"><div className="etq-listas-titulo"><FolderOpen size={19}/><div><strong>Listas salvas</strong><span>{listasSalvas.length ? "Carregue uma lista e imprima novamente" : "Monte uma fila e toque em “Salvar lista” para guardar aqui"}</span></div></div>
        {listasSalvas.length === 0
          ? <p className="etq-listas-vazio">Nenhuma lista salva ainda neste setor.</p>
          : <div className="etq-listas-grid">{listasSalvas.map(lista => <article key={lista.id}><button className="abrir" onClick={() => carregarListaSalva(lista)}><strong>{lista.nome}</strong><small>{lista.total_etiquetas || (lista.itens || []).reduce((soma, itemLista) => soma + numero(itemLista.copias), 0)} etiqueta(s) · {lista.responsavel_nome || "Equipe"}</small></button><button className={`excluir ${String(listaParaExcluir) === String(lista.id) ? "confirmar" : ""}`} onClick={() => removerListaSalva(lista)} aria-label={`Excluir ${lista.nome}`}>{String(listaParaExcluir) === String(lista.id) ? "Confirmar" : <Trash2 size={16}/>}</button></article>)}</div>}
      </section>
      <div className="etq-livre"><button onClick={() => setCriandoLivre(valor => !valor)}><Plus size={18}/> Etiqueta com nome livre</button>{criandoLivre && <div><input autoFocus value={nomeLivre} onChange={e => setNomeLivre(e.target.value)} onKeyDown={e => e.key === "Enter" && abrirNomeLivre()} placeholder="Digite qualquer nome..."/><button onClick={abrirNomeLivre}>Continuar</button></div>}</div>
      <div className="etq-busca"><Search size={20} /><input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar produto..." />{busca && <button onClick={() => setBusca("")}><X size={17} /></button>}</div>{carregando ? <div className="etq-sem"><RefreshCw className="animate-spin" /> Carregando...</div> : visiveis.length ? <div className="etq-grid">{visiveis.map(produto => <button key={produto.id} onClick={() => abrirProduto(produto)}><span><Tag size={17} /></span><strong>{produto.nome}</strong><small>{produto.origem} · adicionar à fila</small></button>)}</div> : <div className="etq-sem">Nenhum produto encontrado.</div>}
    </main>

    {modalSalvarLista && <div className="etq-modal" onClick={() => setModalSalvarLista(false)}>
      <div className="etq-card" onClick={evento => evento.stopPropagation()}>
        <button className="fechar" onClick={() => setModalSalvarLista(false)}><X size={20} /></button>
        <div className="etq-icone"><Save size={27} /></div>
        <p>Guardar para usar depois</p><h2>Nome da lista</h2>
        <div className="etq-segundo-nome">
          <input autoFocus value={nomeNovaLista} onChange={e => setNomeNovaLista(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmarSalvarLista()} placeholder="Ex.: Pré-preparos da segunda" />
          <small>{fila.length} tipo(s) · {totalEtiquetas} etiqueta(s) nesta lista.</small>
        </div>
        <button className="etq-imprimir" onClick={confirmarSalvarLista} disabled={salvandoLista}>
          <Save size={20} /> {salvandoLista ? "Salvando..." : "Salvar lista"}
        </button>
      </div>
    </div>}

    {item && <div className="etq-modal" onClick={() => setItem(null)}><div className="etq-card" onClick={evento => evento.stopPropagation()}><button className="fechar" onClick={() => setItem(null)}><X size={20} /></button><div className="etq-icone"><Tag size={27} /></div><p>Configure e imprima</p><h2>{item.nome}</h2>
      <h3>2. Quantas cópias?</h3><div className="etq-copias"><button onClick={() => alterar("copias", Math.max(1, numero(item.copias) - 1))}><Minus size={26} /></button><label><input type="number" inputMode="numeric" min="1" max="1000" value={item.copias} onChange={e => alterar("copias", Math.max(1, Math.min(1000, Math.floor(numero(e.target.value) || 1))))} /><span>etiquetas</span></label><button onClick={() => alterar("copias", Math.min(1000, numero(item.copias) + 1))}><Plus size={26} /></button></div>
      <h3>3. Tipo de etiqueta</h3><div className="etq-modelos"><button className={modeloEtiqueta === "validade" ? "ativo" : ""} onClick={() => setModeloEtiqueta("validade")}><strong>Com validade</strong><span>Dados completos e QR</span></button><button className={modeloEtiqueta === "nome" ? "ativo" : ""} onClick={() => setModeloEtiqueta("nome")}><strong>Somente nome</strong><span>Nome grande e centralizado</span></button></div>
      {modeloEtiqueta === "nome" && <div className="etq-segundo-nome">
        <label>Primeiro nome</label>
        <input value={item.nome || ""} onChange={e => alterar("nome", e.target.value)} placeholder="Nome que sai em cima" />
        <label style={{ marginTop: 12 }}>Segundo nome (opcional)</label>
        <input value={item.nome2 || ""} onChange={e => alterar("nome2", e.target.value)} placeholder="Sai embaixo do primeiro" />

        <label style={{ marginTop: 14 }}>Como vai sair</label>
        <PreviaNome item={item} tamanho={tamanho} />

        <div className="etq-ajuste">
          <button onClick={() => alterar("escalaNome", Math.max(0.5, Math.round(((Number(item.escalaNome) || 1) - 0.1) * 10) / 10))} aria-label="Diminuir letra"><Minus size={20} /></button>
          <span>Letra {Math.round((Number(item.escalaNome) || 1) * 100)}%</span>
          <button onClick={() => alterar("escalaNome", Math.min(2, Math.round(((Number(item.escalaNome) || 1) + 0.1) * 10) / 10))} aria-label="Aumentar letra"><Plus size={20} /></button>
        </div>
        {(Number(item.escalaNome) || 1) !== 1 && (
          <button type="button" className="etq-ajuste-limpar" onClick={() => alterar("escalaNome", 1)}>Voltar ao tamanho automático</button>
        )}
      </div>}
      {modeloEtiqueta === "validade" && <><h3>4. Validade</h3><div className="etq-validade"><select value={categoriaId} onChange={e => { setCategoriaId(e.target.value); const cat = categorias.find(c => c.id === e.target.value); if (cat) alterar("dias", cat.dias); }}><option value="">Prazo manual</option>{categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.nome} · {cat.dias} dia(s)</option>)}</select><label><input type="number" inputMode="numeric" min="0" value={item.dias} onChange={e => { setCategoriaId(""); alterar("dias", e.target.value); }} /><span>dias</span></label></div>
      <button type="button" className="etq-detalhes-btn" onClick={() => setMostrarDetalhes(valor => !valor)}>{mostrarDetalhes ? "Ocultar opções" : "+ Peso, conservação e tipo de produto (opcional)"}</button>
      {mostrarDetalhes && <div className="etq-detalhes"><div className="etq-opcoes">{CONSERVACAO.map(opcao => <button key={opcao.id} className={item.conservacao === opcao.id ? "ativo" : ""} onClick={() => alterar("conservacao", opcao.id)}>{opcao.id}</button>)}</div><div className="etq-opcoes"><button className={tipoEtiqueta === "aberto" ? "ativo" : ""} onClick={() => setTipoEtiqueta("aberto")}>Manipulado/aberto</button><button className={tipoEtiqueta === "fechado" ? "ativo" : ""} onClick={() => setTipoEtiqueta("fechado")}>Produto fechado</button></div><h3>Informar peso ou quantidade?</h3><div className="etq-opcoes"><button className={!item.informarQuantidade ? "ativo" : ""} onClick={() => setItem(atual => ({ ...atual, informarQuantidade: false, quantidade: "" }))}>Não</button><button className={item.informarQuantidade ? "ativo" : ""} onClick={() => alterar("informarQuantidade", true)}>Sim</button></div>{item.informarQuantidade && <div className="etq-quantidade"><input type="number" min="0" step="0.01" inputMode="decimal" value={item.quantidade} placeholder="Quantidade" onChange={e => alterar("quantidade", e.target.value)} /><select value={item.unidade} onChange={e => alterar("unidade", e.target.value)}>{(UNIDADES.includes(item.unidade) ? UNIDADES : [item.unidade, ...UNIDADES]).map(unidade => <option key={unidade}>{unidade}</option>)}</select></div>}</div>}</>}
      <button className="etq-imprimir" onClick={adicionarFila}><Plus size={20} /> Adicionar {Math.max(1, Math.floor(numero(item.copias)))} à fila</button>
    </div></div>}
    {vozAberta && <div className="etq-voz-modal" role="dialog" aria-modal="true" aria-label="Adicionar etiquetas por voz"><div className="etq-voz-card"><button className="etq-voz-fechar" onClick={fecharVoz} aria-label="Fechar comando de voz"><X size={20}/></button><div className="etq-voz-topo"><span><Mic size={29}/></span><div><h2>Várias etiquetas por voz</h2><p>Fale tudo de uma vez. As etiquetas entram na fila para você conferir.</p></div></div><div className={`etq-voz-transcricao ${ouvindoVoz ? "ouvindo" : ""}`}>{textoVoz ? `“${textoVoz}”` : ouvindoVoz ? "Ouvindo..." : "Nenhum comando falado ainda."}</div><div className="etq-voz-resposta">{respostaVoz}</div><div className="etq-voz-exemplos"><strong>Exemplos de comando</strong><p>“3 etiquetas de arroz validade 5 dias, 2 de feijão validade 3 dias”</p><p>“4 somente nome de molho da casa e 2 produto fechado de água tônica validade 30 dias”</p><p>Depois de conferir: “confirmar impressão”.</p></div><button className={`etq-voz-ouvir ${ouvindoVoz ? "ouvindo" : ""}`} onClick={ouvindoVoz ? () => escutaVozRef.current?.parar?.() : iniciarEscutaVoz}>{ouvindoVoz ? <><X size={21}/> Parar de ouvir</> : <><Mic size={22}/> Falar novo comando</>}</button><button className="etq-voz-concluir" onClick={fecharVoz}>Conferir fila</button></div></div>}
    <div id="etiquetas-rapidas-print" aria-hidden="true">{responsavel && fila.flatMap(produto => Array.from({ length: Math.max(1, Math.floor(numero(produto.copias))) }, (_, indice) => <EtiquetaPapel key={`${produto.codigo}-${indice}`} item={produto} responsavel={responsavel} unidadeInfo={unidadeInfo} momento={momento} tamanho={tamanho} tipoEtiqueta={produto.tipoEtiqueta || "aberto"} />))}</div>
    {aviso && <Aviso aviso={aviso} fechar={() => setAviso(null)} />}
  </div>;
}

const ESTILOS = `
  .etq-app,.etq-app *,.etq-inicio,.etq-inicio *,.etq-vazio,.etq-vazio *{box-sizing:border-box}.etq-inicio{position:fixed;inset:0;z-index:80;overflow:auto;background:linear-gradient(145deg,#07111f,#102a43);color:#fff;padding:clamp(18px,4vw,44px);padding-top:calc(clamp(18px,4vw,44px) + env(safe-area-inset-top,0px));display:flex;flex-direction:column}.etq-topo{display:flex;justify-content:space-between}.etq-topo button{height:46px;border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:0 15px;background:rgba(255,255,255,.08);color:#fff;display:flex;align-items:center;gap:8px;font-weight:850}.etq-inicio main{width:min(950px,100%);margin:auto;text-align:center}.etq-inicio-voz{width:min(560px,100%);margin:0 auto 17px;border:2px solid #a78bfa;border-radius:20px;background:linear-gradient(135deg,#7c3aed,#a21caf);padding:14px 17px;display:flex;align-items:center;justify-content:center;gap:13px;text-align:left;box-shadow:0 14px 35px rgba(124,58,237,.3)}.etq-inicio-voz strong,.etq-inicio-voz span{display:block}.etq-inicio-voz strong{font-size:18px}.etq-inicio-voz span{margin-top:3px;color:#f3e8ff;font-size:12px;font-weight:750}.etq-inicio h1{font-size:clamp(34px,5vw,58px);margin:15px 0 8px;font-weight:950}.etq-inicio main>p{color:#cbd5e1;font-size:18px;margin:0 0 32px}.etq-setores{display:grid;grid-template-columns:1fr 1fr;gap:22px}.etq-setores button{min-height:235px;border:2px solid rgba(255,255,255,.16);border-radius:30px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;font-size:28px;font-weight:950;box-shadow:0 22px 55px rgba(0,0,0,.25)}.etq-setores button svg{width:62px;height:62px}.etq-setores .cozinha{background:linear-gradient(145deg,#047857,#10b981)}.etq-setores .bar{background:linear-gradient(145deg,#1d4ed8,#3b82f6)}.etq-setores span{font-size:14px;opacity:.9}.etq-vazio{min-height:100vh;background:#f8fafc;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;color:#64748b}.etq-vazio h1{color:#0f172a}.etq-vazio button{height:48px;border:0;border-radius:13px;background:#0f172a;color:#fff;padding:0 18px;display:flex;align-items:center;gap:8px;font-weight:850}
  .etq-app{min-height:100vh;min-height:100%;background:#f3f6fa;color:#0f172a}.etq-app>header{position:sticky;top:0;z-index:30;min-height:76px;background:#fff;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:14px;padding:12px max(18px,calc((100vw - 1240px)/2));box-shadow:0 3px 14px rgba(15,23,42,.06)}.etq-app>header>button{width:46px;height:46px;border:1px solid #e2e8f0;border-radius:14px;background:#fff;color:#64748b;display:grid;place-items:center}.etq-app>header>div{flex:1}.etq-app>header strong{display:block;font-size:19px}.etq-app>header span{display:block;color:#64748b;font-size:12px;margin-top:3px}.etq-conteudo{max-width:1240px;margin:auto;padding:22px 18px 40px}.etq-titulo{display:flex;align-items:center;justify-content:space-between;gap:12px}.etq-titulo h2{font-size:22px;margin:0}.etq-titulo span{color:#64748b;font-weight:800;font-size:13px}.etq-busca{position:relative;margin:16px 0}.etq-busca>svg{position:absolute;left:17px;top:17px;color:#94a3b8}.etq-busca input{width:100%;height:56px;border:2px solid #e2e8f0;border-radius:17px;background:#fff;padding:0 50px;font-size:17px;outline:0}.etq-busca input:focus{border-color:var(--cor)}.etq-busca button{position:absolute;right:11px;top:11px;width:34px;height:34px;border:0;border-radius:10px;background:#f1f5f9;color:#64748b;display:grid;place-items:center}.etq-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.etq-grid>button{min-height:118px;border:2px solid #e2e8f0;border-radius:19px;background:#fff;padding:16px;text-align:left;position:relative}.etq-grid>button>span{position:absolute;right:13px;top:13px;width:31px;height:31px;border-radius:10px;background:var(--suave);color:var(--cor);display:grid;place-items:center}.etq-grid strong{display:block;padding-right:40px;font-size:16px;line-height:1.25}.etq-grid small{display:block;color:#64748b;margin-top:20px;font-weight:700}.etq-grid>button:hover{border-color:var(--cor);transform:translateY(-1px)}.etq-sem{min-height:150px;border:2px dashed #cbd5e1;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;gap:8px;color:#64748b;font-weight:850}
  .etq-pessoas{position:fixed;inset:0;z-index:80;overflow:auto;background:#f3f6fa;color:#0f172a;padding:clamp(16px,3vw,34px);padding-top:calc(clamp(16px,3vw,34px) + env(safe-area-inset-top,0px))}
  /* .etq-pessoas e .etq-inicio saem do fluxo (position:fixed), então a área
     segura precisa vir deles mesmos — o respiro do wrapper não os alcança. */.etq-pessoas-topo{display:flex;justify-content:space-between}.etq-pessoas-topo button{height:46px;border:1px solid #dbe3ec;border-radius:14px;padding:0 15px;background:#fff;color:#475569;display:flex;align-items:center;gap:8px;font-weight:850}.etq-pessoas main{width:min(960px,100%);margin:clamp(32px,8vh,90px) auto 30px;text-align:center}.etq-pessoas-icone{width:72px;height:72px;margin:auto;border-radius:23px;background:var(--cor);color:#fff;display:grid;place-items:center;box-shadow:0 14px 30px color-mix(in srgb,var(--cor) 25%,transparent)}.etq-pessoas h1{font-size:clamp(28px,4vw,44px);margin:17px 0 7px}.etq-pessoas main>p{color:#64748b;margin:0 0 14px}.etq-pessoas-voz{width:min(650px,100%);margin:0 auto 22px;border:1px solid #c4b5fd;border-radius:14px;background:#f5f3ff;color:#6d28d9;padding:11px 14px;display:flex;align-items:center;justify-content:center;gap:9px;font-size:12px;font-weight:750}.etq-pessoas-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.etq-pessoas-grid>button{min-height:92px;border:2px solid #e2e8f0;border-radius:19px;background:#fff;padding:14px;display:flex;align-items:center;gap:13px;text-align:left}.etq-pessoas-grid>button:hover{border-color:var(--cor)}.etq-pessoas-grid>button>span{width:50px;height:50px;flex:0 0 auto;border-radius:15px;background:color-mix(in srgb,var(--cor) 10%,white);color:var(--cor);display:grid;place-items:center}.etq-pessoas-grid strong,.etq-pessoas-grid small{display:block}.etq-pessoas-grid strong{font-size:16px}.etq-pessoas-grid small{margin-top:4px;color:#64748b}
  .etq-fila{margin-bottom:20px;border:2px solid color-mix(in srgb,var(--cor) 28%,white);border-radius:21px;background:#fff;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.06)}.etq-fila-topo{padding:15px 16px;background:var(--suave);display:flex;align-items:center;justify-content:space-between;gap:14px}.etq-fila-topo strong,.etq-fila-topo span{display:block}.etq-fila-topo strong{font-size:18px}.etq-fila-topo span{color:#64748b;font-size:12px;margin-top:3px;font-weight:750}.etq-fila-acoes{display:flex;gap:8px}.etq-fila-acoes button{min-height:48px;border:0;border-radius:14px;padding:0 15px;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:900}.etq-fila-acoes .salvar{border:2px solid var(--cor);background:#fff;color:var(--cor)}.etq-fila-acoes .imprimir{background:var(--cor);color:#fff}.etq-fila-lista{padding:6px 14px}.etq-fila-lista article{min-height:59px;border-bottom:1px solid #edf2f7;display:flex;align-items:center;gap:12px}.etq-fila-lista article:last-child{border-bottom:0}.etq-fila-lista article>div{flex:1}.etq-fila-lista strong,.etq-fila-lista small{display:block}.etq-fila-lista small{color:#64748b;margin-top:3px}.etq-fila-lista article>button{width:40px;height:40px;border:0;border-radius:12px;background:#fff1f2;color:#e11d48;display:grid;place-items:center}.etq-livre{margin-top:13px}.etq-livre>button{min-height:46px;border:1px dashed var(--cor);border-radius:14px;background:var(--suave);color:var(--cor);padding:0 15px;display:flex;align-items:center;gap:7px;font-weight:900}.etq-livre>div{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:9px}.etq-livre input{height:50px;min-width:0;border:2px solid #e2e8f0;border-radius:14px;background:#fff;padding:0 14px;font-size:16px;outline:0}.etq-livre input:focus{border-color:var(--cor)}.etq-livre>div button{border:0;border-radius:14px;background:var(--cor);color:#fff;padding:0 18px;font-weight:900}
  .etq-previa{width:100%;margin-top:8px;padding:6px 0;border:2px dashed #cbd5e1;border-radius:14px;background:#f8fafc;display:flex;justify-content:center;overflow:hidden}.etq-previa .etiqueta-rapida-papel{border:1px solid #cbd5e1;box-shadow:0 6px 16px rgba(15,23,42,.12)}
  .etq-ajuste{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:10px}.etq-ajuste button{width:48px;height:48px;border:2px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:var(--cor);display:grid;place-items:center}.etq-ajuste span{min-width:104px;text-align:center;font-weight:900;color:#334155}
  .etq-ajuste-limpar{margin-top:8px;border:0;background:transparent;color:var(--cor);font-weight:900;font-size:13px}
  .etq-segundo-nome{margin-top:13px;text-align:left}.etq-segundo-nome label{display:block;font-weight:900;font-size:13px;color:#334155;margin-bottom:6px}.etq-segundo-nome input{width:100%;height:50px;border:2px solid #e2e8f0;border-radius:14px;background:#fff;padding:0 14px;font-size:16px;font-weight:800;outline:0}.etq-segundo-nome input:focus{border-color:var(--cor)}.etq-segundo-nome small{display:block;margin-top:6px;color:#64748b;font-weight:700;font-size:12px}
  .etq-modal{position:fixed;inset:0;z-index:100;background:rgba(15,23,42,.68);padding:14px;display:grid;place-items:center;backdrop-filter:blur(5px);overflow:auto}.etq-card{position:relative;width:min(580px,100%);max-height:calc(100vh - 28px);overflow:auto;background:#fff;border-radius:28px;padding:25px;text-align:center;box-shadow:0 30px 80px rgba(15,23,42,.4)}.etq-card .fechar{position:absolute;right:14px;top:14px;width:42px;height:42px;border:0;border-radius:13px;background:#f1f5f9;color:#64748b;display:grid;place-items:center}.etq-icone{width:58px;height:58px;border-radius:19px;background:var(--suave);color:var(--cor);display:grid;place-items:center;margin:0 auto 10px}.etq-card>p{margin:0;color:#64748b;font-size:13px;font-weight:850}.etq-card>h2{margin:5px 42px 18px;font-size:24px;line-height:1.15}.etq-card h3{text-align:left;margin:17px 0 8px;font-size:13px;color:#475569}.etq-copias{display:grid;grid-template-columns:64px 1fr 64px;gap:10px}.etq-copias>button{min-height:68px;border:0;border-radius:18px;background:var(--suave);color:var(--cor);display:grid;place-items:center}.etq-copias label{border:2px solid var(--cor);border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center}.etq-copias input{width:100%;border:0;outline:0;text-align:center;font-size:30px;font-weight:950;background:transparent}.etq-copias span{font-size:10px;color:#64748b;font-weight:850;text-transform:uppercase}.etq-validade{display:grid;grid-template-columns:1fr 115px;gap:9px}.etq-validade select,.etq-validade label,.etq-responsavel,.etq-quantidade input,.etq-quantidade select{height:50px;border:2px solid #e2e8f0;border-radius:14px;background:#f8fafc;padding:0 12px;font-size:14px;font-weight:800}.etq-validade label{display:flex;align-items:center}.etq-validade input{width:60px;border:0;background:transparent;outline:0;font-size:18px;font-weight:950}.etq-validade span{font-size:12px;color:#64748b;font-weight:850}.etq-opcoes{display:flex;gap:7px;margin-top:8px}.etq-opcoes button{flex:1;min-height:46px;border:2px solid #e2e8f0;border-radius:13px;background:#f8fafc;color:#64748b;font-weight:850}.etq-opcoes button.ativo{border-color:var(--cor);background:var(--suave);color:var(--cor)}.etq-quantidade{display:grid;grid-template-columns:1fr 140px;gap:8px;margin-top:8px}.etq-responsavel{width:100%;text-align:left}.etq-imprimir{width:100%;min-height:56px;border:0;border-radius:16px;background:var(--cor);color:#fff;margin-top:18px;font-size:16px;font-weight:950;display:flex;align-items:center;justify-content:center;gap:9px}.etq-imprimir:disabled{opacity:.45}.etq-toast{position:fixed;z-index:120;left:50%;bottom:24px;transform:translateX(-50%);width:min(620px,calc(100vw - 28px));padding:14px 16px;border-radius:14px;color:#fff;display:flex;align-items:center;gap:9px;font-weight:850;box-shadow:0 14px 34px rgba(15,23,42,.25)}.etq-toast.ok{background:#059669}.etq-toast.erro{background:#e11d48}.etq-toast span{flex:1}.etq-toast button{border:0;background:transparent;color:#fff;display:grid;place-items:center}#etiquetas-rapidas-print{position:fixed;left:-20000px;top:0;width:80mm;background:#fff}
  .etq-modelos{display:grid;grid-template-columns:1fr 1fr;gap:9px}.etq-modelos button{min-height:72px;border:2px solid #e2e8f0;border-radius:15px;background:#f8fafc;padding:10px;color:#475569}.etq-modelos button.ativo{border-color:var(--cor);background:var(--suave);color:var(--cor)}.etq-modelos strong,.etq-modelos span{display:block}.etq-modelos strong{font-size:14px}.etq-modelos span{margin-top:5px;font-size:11px;font-weight:750;text-transform:none;color:#64748b}
  .etq-voz-abrir{width:100%;min-height:76px;margin-top:14px;border:2px solid #7c3aed;border-radius:18px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;padding:13px 16px;display:flex;align-items:center;gap:13px;text-align:left;box-shadow:0 10px 25px rgba(124,58,237,.22)}.etq-voz-abrir>span{width:46px;height:46px;flex:0 0 auto;border-radius:14px;background:rgba(255,255,255,.16);display:grid;place-items:center}.etq-voz-abrir strong,.etq-voz-abrir small{display:block}.etq-voz-abrir strong{font-size:17px}.etq-voz-abrir small{margin-top:4px;color:#ede9fe;font-weight:750}.etq-bluetooth{width:100%;min-height:66px;margin-top:10px;border:2px solid #2563eb;border-radius:17px;background:#eff6ff;color:#1d4ed8;padding:11px 15px;display:flex;align-items:center;gap:12px;text-align:left}.etq-bluetooth>div{flex:1}.etq-bluetooth strong,.etq-bluetooth small{display:block}.etq-bluetooth small{margin-top:3px;color:#64748b;font-weight:700}.etq-bluetooth.conectada{border-color:#059669;background:#ecfdf5;color:#047857}.etq-listas-salvas{margin-top:14px;border:1px solid #dbe3ec;border-radius:18px;background:#fff;padding:13px}.etq-listas-vazio{margin:10px 0 2px;color:#64748b;font-weight:750;font-size:13px}.etq-listas-grid .excluir.confirmar{width:auto!important;padding:0 12px;background:#e11d48!important;color:#fff!important;font-weight:900;font-size:12px}.etq-listas-titulo{display:flex;align-items:center;gap:9px;color:#475569}.etq-listas-titulo strong,.etq-listas-titulo span{display:block}.etq-listas-titulo span{margin-top:2px;font-size:11px;color:#94a3b8}.etq-listas-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.etq-listas-grid article{min-width:0;border:1px solid #e2e8f0;border-radius:13px;display:flex;overflow:hidden}.etq-listas-grid .abrir{min-width:0;flex:1;border:0;background:#fff;padding:10px;text-align:left}.etq-listas-grid strong,.etq-listas-grid small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.etq-listas-grid small{margin-top:3px;color:#64748b}.etq-listas-grid .excluir{width:42px;border:0;background:#fff1f2;color:#e11d48;display:grid;place-items:center}.etq-voz-modal{position:fixed;inset:0;z-index:160;background:rgba(15,23,42,.7);padding:14px;display:grid;place-items:center;backdrop-filter:blur(5px)}.etq-voz-card{position:relative;width:min(620px,100%);max-height:calc(100vh - 28px);overflow:auto;border-radius:26px;background:#fff;padding:24px;box-shadow:0 30px 80px rgba(15,23,42,.45)}.etq-voz-fechar{position:absolute;right:14px;top:14px;width:42px;height:42px;border:0;border-radius:13px;background:#f1f5f9;color:#64748b;display:grid;place-items:center}.etq-voz-topo{display:flex;align-items:center;gap:13px;padding-right:45px}.etq-voz-topo>span{width:58px;height:58px;flex:0 0 auto;border-radius:18px;background:#ede9fe;color:#7c3aed;display:grid;place-items:center}.etq-voz-topo h2{margin:0;font-size:24px}.etq-voz-topo p{margin:5px 0 0;color:#64748b;font-size:13px;font-weight:700}.etq-voz-transcricao{min-height:58px;margin-top:17px;border:2px solid #ddd6fe;border-radius:15px;background:#faf5ff;padding:13px;color:#5b21b6;font-weight:850}.etq-voz-transcricao.ouvindo{animation:etqPulso 1.1s infinite}.etq-voz-resposta{margin-top:10px;border-radius:15px;background:#f1f5f9;padding:13px;color:#334155;font-size:14px;font-weight:750;line-height:1.45}.etq-voz-exemplos{margin-top:15px}.etq-voz-exemplos strong{display:block;margin-bottom:7px;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b}.etq-voz-exemplos p{margin:6px 0;border:1px solid #e2e8f0;border-radius:11px;background:#fff;padding:9px 11px;color:#475569;font-size:12px;font-weight:750}.etq-voz-ouvir,.etq-voz-concluir{width:100%;min-height:54px;margin-top:12px;border:0;border-radius:15px;font-size:15px;font-weight:950;display:flex;align-items:center;justify-content:center;gap:9px}.etq-voz-ouvir{background:#7c3aed;color:#fff}.etq-voz-ouvir.ouvindo{background:#e11d48}.etq-voz-concluir{background:#e2e8f0;color:#334155}@keyframes etqPulso{50%{transform:scale(.99);opacity:.82}}
  @media(max-width:900px){.etq-grid,.etq-pessoas-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:680px){.etq-setores{grid-template-columns:1fr}.etq-setores button{min-height:175px}.etq-inicio main{margin:28px auto}.etq-app>header{padding:9px 11px}.etq-conteudo{padding:16px 11px 35px}.etq-grid,.etq-pessoas-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.etq-card{padding:20px 14px;border-radius:21px}.etq-card>h2{font-size:20px}.etq-opcoes{flex-wrap:wrap}.etq-opcoes button{flex:1 1 30%}.etq-fila-topo{align-items:stretch;flex-direction:column}.etq-fila-acoes{width:100%}.etq-fila-acoes button{flex:1}.etq-listas-grid{grid-template-columns:1fr}}@media(max-width:420px){.etq-grid,.etq-pessoas-grid{grid-template-columns:1fr}.etq-grid>button{min-height:94px}.etq-validade{grid-template-columns:1fr 105px}.etq-copias{grid-template-columns:58px 1fr 58px}.etq-quantidade{grid-template-columns:1fr 115px}.etq-livre>div{grid-template-columns:1fr}.etq-livre>div button{height:48px}.etq-fila-acoes{flex-direction:column}}
  .etq-detalhes-btn{width:100%;min-height:46px;margin-top:12px;border:1px dashed #94a3b8;border-radius:13px;background:#f8fafc;color:#475569;font-weight:850}.etq-detalhes{margin-top:8px;border-radius:16px;background:#f8fafc;padding:10px}.etq-detalhes h3{margin-top:12px}
`;
