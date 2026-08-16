"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Boxes, Check, CheckCircle2, ChefHat, CircleDollarSign, Clock, GlassWater, History, Layers3, Maximize2, Minus,
  Mic, MicOff, PackageMinus, PackagePlus, Plus, RefreshCw, Search, ShoppingBasket,
  Settings2, UserRound, X, XCircle, MessageSquareText,
} from "lucide-react";
import {
  fetchEstoques, fetchItensEstoque, fetchMovimentosMulti, registrarLoteMovimentosMulti,
} from "../lib/estoques-multiplos";
import { fetchColaboradores } from "../lib/rh";
import { useERP } from "../context/ERPContext";
import { criarEscuta, falar, vozDisponivel } from "../lib/hefisto-voz";
import { registrarAuditoria } from "../lib/hefisto-acoes";

const cores = {
  entrada: { principal: "#10B981", suave: "rgba(16,185,129,.14)", borda: "rgba(16,185,129,.38)" },
  saida: { principal: "#F43F5E", suave: "rgba(244,63,94,.14)", borda: "rgba(244,63,94,.38)" },
  // Enquanto ninguém escolheu entre depositar e retirar.
  neutro: { principal: "#64748B", suave: "rgba(100,116,139,.12)", borda: "rgba(100,116,139,.32)" },
};

const numero = valor => Number(valor) || 0;
const fmtQtd = valor => numero(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtData = iso => new Date(iso).toLocaleString("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});

const normalizarVoz = texto => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const NUMEROS_VOZ = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20 };

function quantidadeDaVoz(texto) {
  const normalizado = normalizarVoz(texto);
  const numeroFalado = normalizado.match(/\b\d+(?:[.,]\d+)?\b/);
  if (numeroFalado) return Number(numeroFalado[0].replace(",", "."));
  const palavra = Object.keys(NUMEROS_VOZ).find(item => new RegExp(`\\b${item}\\b`).test(normalizado));
  return palavra ? NUMEROS_VOZ[palavra] : null;
}

function unidadeComercialDoBar(item) {
  const comercial = String(item.unidade_comercial || "").trim().toLowerCase();
  const unidadesDeMedida = ["ml", "l", "litro", "litros", "g", "kg"];
  if (["un", "un.", "unidade"].includes(comercial)) return "unidades";
  if (comercial && !unidadesDeMedida.includes(comercial)) return comercial;
  const descricao = `${item.nome || ""} ${item.categoria || ""}`.toLowerCase();
  if (/\blata|latinha/.test(descricao)) return "lata";
  if (/garraf|long neck|vinho|espumante|whisky|u[ií]sque|vodka|gin|licor/.test(descricao)) return "garrafa";
  return "unidades";
}

function rotuloUnidade(unidade, quantidade) {
  const texto = String(unidade || "unidades");
  if (["l", "litro", "litros"].includes(texto.toLowerCase())) return "L";
  if (numero(quantidade) === 1) {
    if (texto === "unidades") return "unidade";
    return texto;
  }
  const plurais = { garrafa: "garrafas", lata: "latas", unidade: "unidades", barril: "barris", caixa: "caixas", pacote: "pacotes", fardo: "fardos" };
  return plurais[texto.toLowerCase()] || texto;
}

function normalizarItem(item, estoque, departamento = "") {
  const embalagem = numero(item.tamanho_embalagem) || 1;
  const saldoBase = numero(item.quantidade_atual);
  const textoEstoque = `${estoque?.slug || ""} ${estoque?.nome || ""}`.toLowerCase();
  const itemDoBar = departamento === "bar" || estoque?.tipo === "bebidas" || textoEstoque.includes("bar");
  // HÃ¡ cadastros antigos em que o saldo do bar foi salvo em ml e outros em
  // unidades comerciais. Quando o valor alcanÃ§a ao menos uma embalagem,
  // convertemos para garrafas/latas; saldos pequenos continuam como unidades.
  const usaEmbalagem = embalagem > 1 && saldoBase >= embalagem * (itemDoBar ? 1 : 1.5);
  const fator = usaEmbalagem ? embalagem : 1;
  const unidade = itemDoBar
    ? unidadeComercialDoBar(item)
    : fator > 1
      ? (item.unidade_comercial || "un.")
      : (item.unidade_comercial || item.unidade_medida || "un.");
  return {
    ...item,
    id: `${estoque.id}:${item.insumo_id || item.id}`,
    estoqueId: estoque.id,
    estoqueNome: estoque.nome,
    insumoId: item.insumo_id || item.id,
    unidade,
    quantidade: saldoBase / fator,
    fator,
    minimo: item.estoque_minimo == null ? null : numero(item.estoque_minimo) / fator,
    valorTotal: saldoBase * numero(item.custo_unitario || item.insumo?.custo_unitario),
    validade: item.validade || null,
    local: item.local_interno || "",
  };
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4200);
    return () => clearTimeout(timer);
  }, [onClose, toast]);

  const ok = toast.tipo === "ok";
  return (
    <div className="estoque-rapido-toast" style={{ background: ok ? "#059669" : "#E11D48" }}>
      {ok ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
      <span>{toast.msg}</span>
      <button onClick={onClose} aria-label="Fechar aviso"><X size={17} /></button>
    </div>
  );
}

function ControleQuantidade({ valor, unidade, onChange }) {
  const passo = numero(valor) > 1 ? 1 : 0.5;
  return (
    <div className="estoque-rapido-qtd" onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => onChange(Math.max(0.1, numero(valor) - passo))} aria-label="Diminuir">
        <Minus size={18} />
      </button>
      <label>
        <input
          type="number"
          min="0.1"
          step="0.5"
          value={valor}
          onChange={e => onChange(Math.max(0.1, numero(e.target.value)))}
        />
        <span>{rotuloUnidade(unidade, valor)}</span>
      </label>
      <button type="button" onClick={() => onChange(numero(valor) + 1)} aria-label="Aumentar">
        <Plus size={18} />
      </button>
    </div>
  );
}

export default function TabletSetor({ setor = "", titulo = "Estoque", emoji = "📦", cor = "#10B981", voltarHref = "/dashboard/operacao/estoque" }) {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();
  const setorFixo = String(setor || "").trim().toLowerCase();
  const [setorEscolhido, setSetorEscolhido] = useState(setorFixo);
  const departamento = setorEscolhido || setorFixo;
  const [tipoEstoque, setTipoEstoque] = useState(""); // produtos | preparos

  const [aba, setAba] = useState("operacao");
  // Nada vem marcado: quem opera escolhe depositar ou retirar. Vir na retirada
  // fazia a pessoa dar baixa sem perceber.
  const [tipo, setTipo] = useState("");
  const [itens, setItens] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [selecionados, setSelecionados] = useState({});
  const [responsavelId, setResponsavelId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mostrarMotivo, setMostrarMotivo] = useState(false);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);
  const [ultimoResultado, setUltimoResultado] = useState([]);
  const [filtroHistorico, setFiltroHistorico] = useState("todos");
  const [auditoriaVozAberta, setAuditoriaVozAberta] = useState(false);
  const [ouvindoVoz, setOuvindoVoz] = useState(false);
  const [textoVoz, setTextoVoz] = useState("");
  const [respostaVoz, setRespostaVoz] = useState("Toque no microfone e fale o que deseja conferir ou movimentar.");
  const escutaVozRef = useRef(null);

  const carregar = useCallback(async (mostrarLoading = true) => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setItens([]);
      setFuncionarios([]);
      setHistorico([]);
      setCarregando(false);
      return [];
    }
    if (mostrarLoading) setCarregando(true);
    const [resEstoques, resFuncionarios] = await Promise.all([
      fetchEstoques(unidadeAtiva),
      fetchColaboradores(unidadeAtiva),
    ]);
    const estoquesDoSetor = (resEstoques.data || []).filter(estoque => {
      if (!departamento) return false;
      const texto = `${estoque.slug || ""} ${estoque.nome || ""}`.toLowerCase();
      if (departamento === "bar") return texto.includes("bar") || (estoque.tipo === "bebidas" && !texto.includes("cozinha"));
      if (departamento === "cozinha") return texto.includes("cozinha") || (estoque.tipo === "alimentos" && !texto.includes("bar"));
      return texto.includes(departamento);
    });
    const estoquesAlvo = estoquesDoSetor.filter(estoque => {
      const texto = `${estoque.slug || ""} ${estoque.nome || ""}`.toLowerCase();
      const ehPreparo = texto.includes("pre-preparo") || texto.includes("preparo");
      return tipoEstoque === "preparos" ? ehPreparo : !ehPreparo;
    });
    const [respostasItens, respostasHistorico] = await Promise.all([
      Promise.all(estoquesAlvo.map(estoque => fetchItensEstoque(estoque.id, unidadeAtiva))),
      Promise.all(estoquesAlvo.map(estoque => fetchMovimentosMulti(unidadeAtiva, estoque.id, 120))),
    ]);
    const itensCarregados = estoquesAlvo.flatMap((estoque, indice) =>
      (respostasItens[indice]?.data || []).map(item => normalizarItem(item, estoque, departamento))
    );
    setItens(itensCarregados);
    setFuncionarios((resFuncionarios.data || []).filter(f =>
      f.ativo !== false && f.status !== "inativo" && f.tipo_contrato !== "Freelancer"
    ));
    setHistorico(estoquesAlvo.flatMap((estoque, indice) =>
      (respostasHistorico[indice]?.data || [])
        .filter(mov => ["entrada", "saida"].includes(mov.tipo))
        .map(mov => {
          const embalagem = numero(mov.insumo?.tamanho_embalagem) || 1;
          const qtdBase = numero(mov.quantidade);
          const itemDoBar = departamento === "bar" || estoque.tipo === "bebidas";
          const fator = embalagem > 1 && qtdBase >= embalagem ? embalagem : 1;
          return {
            id: mov.id,
            tipo: mov.tipo,
            quantidade: qtdBase / fator,
            responsavel: mov.usuario_nome || "",
            motivo: mov.observacao || "",
            created_at: mov.data_movimento || mov.created_at,
            estoque: {
              nome: mov.insumo?.nome || "Item",
              unidade: itemDoBar
                ? unidadeComercialDoBar(mov.insumo || {})
                : fator > 1
                  ? (mov.insumo?.unidade_comercial || "un.")
                  : (mov.insumo?.unidade_comercial || mov.insumo?.unidade_medida || "un."),
              setor: estoque.nome,
            },
          };
        })
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200));
    const erroItens = respostasItens.find(resposta => resposta?.error)?.error;
    if (resEstoques.error || erroItens) setToast({ tipo: "erro", msg: `Não foi possível carregar o estoque: ${resEstoques.error || erroItens}` });
    setCarregando(false);
    return itensCarregados;
  }, [departamento, tipoEstoque, unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  const responsavel = funcionarios.find(f => String(f.id) === String(responsavelId));
  const listaSelecionados = Object.values(selecionados);
  const estiloTipo = cores[tipo] || cores.neutro;
  const tituloSetor = departamento === "bar" ? "Bar" : departamento === "cozinha" ? "Cozinha" : titulo;
  const tituloAtual = tipoEstoque === "preparos" ? `Pré-preparos · ${tituloSetor}` : tituloSetor;

  const selecionarSetor = novoSetor => {
    setSetorEscolhido(novoSetor);
    setTipoEstoque("");
    setResponsavelId("");
    setSelecionados({});
    setBusca("");
    setUltimoResultado([]);
    setAba("operacao");
  };

  const voltarEtapa = () => {
    if (responsavelId) {
      setResponsavelId("");
      setSelecionados({});
      setBusca("");
      setUltimoResultado([]);
      return;
    }
    if (tipoEstoque) {
      setTipoEstoque("");
      setSelecionados({});
      setBusca("");
      setUltimoResultado([]);
      return;
    }
    if (departamento && !setorFixo) {
      setSetorEscolhido("");
      setSelecionados({});
      setBusca("");
      setUltimoResultado([]);
      return;
    }
    router.push(voltarHref || "/dashboard");
  };

  const pedirTelaCheia = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    } catch { /* o navegador pode bloquear; o modo visual continua em tela inteira */ }
  };

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return itens.filter(item => !termo || `${item.nome} ${item.marca || ""}`.toLocaleLowerCase("pt-BR").includes(termo));
  }, [busca, itens]);

  const historicoVisivel = useMemo(() => historico.filter(item =>
    filtroHistorico === "todos" || item.tipo === filtroHistorico
  ), [filtroHistorico, historico]);

  const localizarItemPorVoz = useCallback(texto => {
    const comando = normalizarVoz(texto);
    const ordenados = [...itens].sort((a, b) => String(b.nome || "").length - String(a.nome || "").length);
    return ordenados.find(item => comando.includes(normalizarVoz(item.nome)))
      || ordenados.find(item => {
        const palavras = normalizarVoz(item.nome).split(/\s+/).filter(palavra => palavra.length > 2);
        return palavras.length > 0 && palavras.every(palavra => comando.includes(palavra));
      });
  }, [itens]);

  const responderAuditoriaVoz = useCallback(mensagem => {
    setRespostaVoz(mensagem);
    falar(mensagem, { velocidade: 1.02 });
  }, []);

  const processarComandoVoz = useCallback(texto => {
    const comando = normalizarVoz(texto);
    setTextoVoz(texto);
    setOuvindoVoz(false);

    const confirmouMovimentacao = /\b(?:confirmar|confirme|confirmo)\b.*\b(?:entrada|retirada|saida|movimentacao|deposito)\b|\b(?:pode confirmar|confirmar agora)\b/.test(comando);
    if (confirmouMovimentacao) {
      if (!listaSelecionados.length) {
        responderAuditoriaVoz("Não há nenhuma movimentação preparada para confirmar.");
        return;
      }
      if (!responsavel) {
        responderAuditoriaVoz("Escolha na tela quem é o responsável antes de confirmar por voz.");
        return;
      }
      if (salvando) {
        responderAuditoriaVoz("A movimentação já está sendo registrada.");
        return;
      }
      setMotivo(atual => atual.startsWith("Comando de voz:") ? atual : `Comando de voz: ${texto}`);
      responderAuditoriaVoz("Confirmação por voz recebida. Registrando a movimentação.");
      fecharAuditoriaVoz();
      confirmarLote(texto);
      return;
    }

    const querHistorico = /\b(mostrar|mostre|ver|veja|auditar|auditoria|consultar|historico|movimentacoes)\b/.test(comando);
    const mencionaEntrada = /\b(entrada|entradas|deposito|depositos|adicionado|adicionados)\b/.test(comando);
    const mencionaSaida = /\b(saida|saidas|retirada|retiradas|baixa|baixas)\b/.test(comando);

    if (querHistorico && (mencionaEntrada || mencionaSaida || comando.includes("historico"))) {
      const filtro = mencionaSaida ? "saida" : mencionaEntrada ? "entrada" : "todos";
      const quantidade = historico.filter(item => filtro === "todos" || item.tipo === filtro).length;
      setFiltroHistorico(filtro);
      setAba("historico");
      responderAuditoriaVoz(`Abri ${filtro === "entrada" ? "as entradas" : filtro === "saida" ? "as saídas" : "todo o histórico"}. Encontrei ${quantidade} movimentações recentes.`);
      return;
    }

    const item = localizarItemPorVoz(texto);
    if (/\b(quanto|quantos|quantas|saldo|tem|tenho|disponivel)\b/.test(comando)) {
      if (!item) {
        responderAuditoriaVoz("Não identifiquei o produto. Fale, por exemplo: quanto tem de Corona?");
        return;
      }
      responderAuditoriaVoz(`${item.nome} tem ${fmtQtd(item.quantidade)} ${rotuloUnidade(item.unidade, item.quantidade)} no estoque do ${tituloAtual}.`);
      return;
    }

    const ehSaida = /\b(retirar|retire|remover|remova|saida|dar baixa|baixar)\b/.test(comando);
    const ehEntrada = /\b(adicionar|adicione|depositar|deposite|entrada|repor|colocar|coloque)\b/.test(comando);
    if (!ehEntrada && !ehSaida) {
      responderAuditoriaVoz("Não entendi o comando. Diga mostrar entradas, mostrar saídas, consultar o saldo ou retirar uma quantidade de um produto.");
      return;
    }
    const quantidade = quantidadeDaVoz(texto);
    if (!quantidade || quantidade <= 0) {
      responderAuditoriaVoz("Não identifiquei a quantidade. Diga, por exemplo: retirar 3 garrafas de Corona.");
      return;
    }
    if (!item) {
      responderAuditoriaVoz("Não encontrei esse produto neste estoque. Fale novamente usando o nome que aparece no card.");
      return;
    }
    if (ehSaida && quantidade > numero(item.quantidade)) {
      responderAuditoriaVoz(`${item.nome} possui somente ${fmtQtd(item.quantidade)} ${rotuloUnidade(item.unidade, item.quantidade)} disponíveis. A retirada não foi preparada.`);
      return;
    }

    const novoTipo = ehSaida ? "saida" : "entrada";
    setTipo(novoTipo);
    setAba("operacao");
    setSelecionados({
      [item.id]: {
        id: item.id, nome: item.nome, unidade: item.unidade, quantidade,
        disponivel: item.quantidade, fator: item.fator, estoqueId: item.estoqueId, insumoId: item.insumoId,
      },
    });
    setMotivo(`Comando de voz: ${texto}`);
    responderAuditoriaVoz(`Preparei a ${novoTipo === "entrada" ? "entrada" : "retirada"} de ${fmtQtd(quantidade)} ${rotuloUnidade(item.unidade, quantidade)} de ${item.nome}. Confira na tela e toque em confirmar.`);
  }, [historico, listaSelecionados, localizarItemPorVoz, responsavel, responderAuditoriaVoz, salvando, tituloAtual]);

  function iniciarEscutaAuditoria() {
    if (!vozDisponivel()) {
      setAuditoriaVozAberta(true);
      setRespostaVoz("Este navegador não oferece reconhecimento de voz. Use o Chrome no Android ou Safari no iPhone e autorize o microfone.");
      return;
    }
    escutaVozRef.current?.parar?.();
    setAuditoriaVozAberta(true);
    setTextoVoz("");
    setRespostaVoz("Estou ouvindo. Fale agora.");
    setOuvindoVoz(true);
    const sessao = criarEscuta({
      onParcial: parcial => setTextoVoz(parcial),
      onFinal: final => processarComandoVoz(final),
      onErro: erro => { setOuvindoVoz(false); setRespostaVoz(erro); },
      onFim: () => setOuvindoVoz(false),
    });
    escutaVozRef.current = sessao;
    if (!sessao) {
      setOuvindoVoz(false);
      setRespostaVoz("Não consegui acessar o microfone neste aparelho.");
      return;
    }
    sessao.iniciar();
  }

  function fecharAuditoriaVoz() {
    escutaVozRef.current?.parar?.();
    setOuvindoVoz(false);
    setAuditoriaVozAberta(false);
  }

  useEffect(() => () => escutaVozRef.current?.parar?.(), []);

  const kanbans = useMemo(() => {
    const abaixo = itens.filter(item => item.minimo != null && numero(item.quantidade) <= numero(item.minimo)).length;
    const semSaldo = itens.filter(item => numero(item.quantidade) <= 0).length;
    const valor = itens.reduce((soma, item) => soma + numero(item.valorTotal), 0);
    const proximas = itens.filter(item => {
      if (!item.validade) return false;
      const dias = (new Date(item.validade).getTime() - Date.now()) / 86400000;
      return dias >= 0 && dias <= 7;
    }).length;
    return [
      { rotulo: "Produtos", valor: itens.length, detalhe: "cadastrados no setor", cor: "#4F46E5", fundo: "#EEF2FF", icone: Boxes },
      { rotulo: "Valor no estoque", valor: valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), detalhe: "saldo financeiro atual", cor: "#047857", fundo: "#ECFDF5", icone: CircleDollarSign },
      { rotulo: "Abaixo do mínimo", valor: abaixo, detalhe: "precisam de reposição", cor: "#BE123C", fundo: "#FFF1F2", icone: AlertTriangle },
      { rotulo: "Sem saldo", valor: semSaldo, detalhe: "produtos zerados", cor: "#C2410C", fundo: "#FFF7ED", icone: PackageMinus },
      { rotulo: "Validade próxima", valor: proximas, detalhe: "próximos 7 dias", cor: "#A16207", fundo: "#FEFCE8", icone: Clock },
    ];
  }, [itens]);

  function alternarItem(item) {
    setSelecionados(atual => {
      const proximo = { ...atual };
      if (proximo[item.id]) delete proximo[item.id];
      else proximo[item.id] = {
        id: item.id, nome: item.nome, unidade: item.unidade, quantidade: 1,
        disponivel: item.quantidade, fator: item.fator, estoqueId: item.estoqueId, insumoId: item.insumoId,
      };
      return proximo;
    });
  }

  function alterarQuantidade(id, quantidade) {
    setSelecionados(atual => ({
      ...atual,
      [id]: { ...atual[id], quantidade: Math.max(0.1, numero(quantidade)) },
    }));
  }

  async function confirmarLote(comandoConfirmacao = "") {
    if (!tipo) {
      setToast({ tipo: "erro", msg: "Escolha se é entrada ou retirada." });
      return;
    }
    if (!listaSelecionados.length) {
      setToast({ tipo: "erro", msg: "Escolha pelo menos um item." });
      return;
    }
    if (!responsavel) {
      setToast({ tipo: "erro", msg: "Escolha quem está fazendo a movimentação." });
      return;
    }
    const semSaldo = tipo === "saida" && listaSelecionados.find(item => numero(item.quantidade) > numero(item.disponivel));
    if (semSaldo) {
      setToast({ tipo: "erro", msg: `${semSaldo.nome} tem apenas ${fmtQtd(semSaldo.disponivel)} ${rotuloUnidade(semSaldo.unidade, semSaldo.disponivel)} disponíveis.` });
      return;
    }

    setSalvando(true);
    const resultado = await registrarLoteMovimentosMulti({
      unidadeId: unidadeAtiva,
      tipo,
      itens: listaSelecionados.map(item => ({ ...item, quantidade: numero(item.quantidade) * (numero(item.fator) || 1) })),
      observacao: motivo.trim() || (tipo === "entrada" ? "Reposição rápida" : "Retirada rápida"),
      usuarioNome: responsavel.nome,
    });

    await registrarAuditoria({
      unidadeId: unidadeAtiva,
      usuarioId: sessao?.user?.id || sessao?.id || null,
      usuarioNome: responsavel.nome,
      comando: comandoConfirmacao
        ? `${motivo.startsWith("Comando de voz:") ? motivo.replace(/^Comando de voz:\s*/, "") : motivo || "Movimentação preparada na tela"}; Confirmação por voz: ${comandoConfirmacao}`
        : motivo.startsWith("Comando de voz:") ? motivo.replace(/^Comando de voz:\s*/, "") : motivo,
      intencao: { tipo, setor: departamento, itens: listaSelecionados.map(item => ({ nome: item.nome, quantidade: item.quantidade, unidade: item.unidade })) },
      acao: tipo === "entrada" ? "inventory.create_entry_batch" : "inventory.create_withdrawal_batch",
      modulo: "inventory",
      resultado: resultado.erros.length ? (resultado.concluidos.length ? "parcial" : "erro") : "sucesso",
      erro: resultado.erros.length ? resultado.erros.map(item => `${item.nome}: ${item.error}`).join("; ") : null,
      exigiuConfirmacao: true,
    });

    const idsConcluidos = new Set(resultado.concluidos.map(item => String(item.id)));
    setSelecionados(atual => Object.fromEntries(
      Object.entries(atual).filter(([id]) => !idsConcluidos.has(String(id)))
    ));
    const itensAtualizados = await carregar(false);
    setSalvando(false);

    const movimentados = listaSelecionados
      .filter(item => idsConcluidos.has(String(item.id)))
      .map(item => {
        const atualizado = itensAtualizados.find(candidato => String(candidato.id) === String(item.id));
        const saldoNovo = atualizado
          ? numero(atualizado.quantidade)
          : tipo === "entrada"
            ? numero(item.disponivel) + numero(item.quantidade)
            : Math.max(0, numero(item.disponivel) - numero(item.quantidade));
        return {
          id: item.id,
          nome: item.nome,
          unidade: item.unidade,
          quantidadeMovida: numero(item.quantidade),
          saldoAnterior: numero(item.disponivel),
          saldoNovo,
          tipo,
        };
      });
    setUltimoResultado(movimentados);

    if (resultado.erros.length) {
      setToast({
        tipo: "erro",
        msg: `${resultado.concluidos.length} item(ns) concluído(s). Falhou: ${resultado.erros.map(item => item.nome).join(", ")}.`,
      });
      return;
    }

    setMotivo("");
    setMostrarMotivo(false);
    setBusca("");
    setSelecionados({});
    setToast({
      tipo: "ok",
      msg: `${tipo === "entrada" ? "Entrada" : "Retirada"} de ${resultado.concluidos.length} item(ns) registrada para ${responsavel.nome}.`,
    });
  }

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="estoque-rapido-vazio">
        <Layers3 size={52} />
        <h1>Escolha uma unidade</h1>
        <p>Selecione uma loja no ERP antes de abrir o estoque rápido.</p>
        <button onClick={() => router.push(voltarHref)}><ArrowLeft size={18} /> Voltar</button>
      </div>
    );
  }

  if (!departamento) {
    return (
      <div className="estoque-inicio">
        <style>{`
          .estoque-inicio{position:fixed;inset:0;z-index:80;overflow:auto;background:linear-gradient(145deg,#07111f,#0f2841);color:#fff;padding:clamp(18px,4vw,44px);display:flex;flex-direction:column}
          .estoque-inicio-topo{display:flex;align-items:center;justify-content:space-between;gap:12px}.estoque-inicio-topo button{height:46px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.08);color:#fff;padding:0 15px;display:flex;align-items:center;gap:8px;font-weight:800}
          .estoque-inicio-centro{width:min(950px,100%);margin:auto;text-align:center}.estoque-inicio-centro h1{font-size:clamp(30px,5vw,58px);line-height:1;margin:18px 0 10px;font-weight:950}.estoque-inicio-centro p{color:#cbd5e1;font-size:clamp(15px,2vw,20px);margin:0 auto 34px}
          .estoque-inicio-setores{display:grid;grid-template-columns:1fr 1fr;gap:clamp(14px,3vw,26px)}.estoque-inicio-setor{min-height:240px;border:2px solid rgba(255,255,255,.16);border-radius:30px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;font-size:28px;font-weight:950;box-shadow:0 22px 55px rgba(0,0,0,.25);transition:.15s}.estoque-inicio-setor svg{width:62px;height:62px}.estoque-inicio-setor.cozinha{background:linear-gradient(145deg,#047857,#10b981)}.estoque-inicio-setor.bar{background:linear-gradient(145deg,#1d4ed8,#3b82f6)}.estoque-inicio-setor:active{transform:scale(.98)}.estoque-inicio-setor span{font-size:14px;font-weight:700;opacity:.88}
          @media(max-width:620px){.estoque-inicio-setores{grid-template-columns:1fr}.estoque-inicio-setor{min-height:175px}.estoque-inicio-centro{margin:30px auto}}
        `}</style>
        <div className="estoque-inicio-topo">
          <button onClick={() => router.push(voltarHref)}><ArrowLeft size={19} /> Voltar</button>
          <button onClick={pedirTelaCheia}><Maximize2 size={18} /> Tela cheia</button>
        </div>
        <main className="estoque-inicio-centro">
          <ShoppingBasket size={48} />
          <h1>Estoque</h1>
          <p>Primeiro, escolha onde o produto será depositado ou retirado.</p>
          <div className="estoque-inicio-setores">
            <button className="estoque-inicio-setor cozinha" onClick={() => selecionarSetor("cozinha")}>
              <ChefHat /> Cozinha <span>Alimentos e insumos da cozinha</span>
            </button>
            <button className="estoque-inicio-setor bar" onClick={() => selecionarSetor("bar")}>
              <GlassWater /> Bar <span>Bebidas e insumos do bar</span>
            </button>
          </div>
        </main>
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  if (!tipoEstoque) {
    return (
      <div className="estoque-inicio">
        <style>{`
          .estoque-inicio{position:fixed;inset:0;z-index:80;overflow:auto;background:linear-gradient(145deg,#07111f,#0f2841);color:#fff;padding:clamp(18px,4vw,44px);display:flex;flex-direction:column}.estoque-inicio-topo{display:flex;align-items:center;justify-content:space-between}.estoque-inicio-topo button{height:46px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.08);color:#fff;padding:0 15px;display:flex;align-items:center;gap:8px;font-weight:800}.estoque-inicio-centro{width:min(950px,100%);margin:auto;text-align:center}.estoque-inicio-centro h1{font-size:clamp(30px,5vw,54px);margin:18px 0 10px;font-weight:950}.estoque-inicio-centro p{color:#cbd5e1;font-size:clamp(15px,2vw,19px);margin:0 auto 32px}.estoque-inicio-setores{display:grid;grid-template-columns:1fr 1fr;gap:clamp(14px,3vw,26px)}.estoque-inicio-setor{min-height:230px;border:2px solid rgba(255,255,255,.16);border-radius:30px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;font-size:26px;font-weight:950;box-shadow:0 22px 55px rgba(0,0,0,.25)}.estoque-inicio-setor svg{width:58px;height:58px}.estoque-inicio-setor.produtos{background:linear-gradient(145deg,#047857,#10b981)}.estoque-inicio-setor.preparos{background:linear-gradient(145deg,#b45309,#f59e0b)}.estoque-inicio-setor span{font-size:14px;font-weight:700;opacity:.9}@media(max-width:620px){.estoque-inicio-setores{grid-template-columns:1fr}.estoque-inicio-setor{min-height:170px}.estoque-inicio-centro{margin:30px auto}}
        `}</style>
        <div className="estoque-inicio-topo"><button onClick={voltarEtapa}><ArrowLeft size={18} /> Voltar</button><button onClick={pedirTelaCheia}><Maximize2 size={18} /> Tela cheia</button></div>
        <main className="estoque-inicio-centro"><Layers3 size={58} /><h1>Estoque do {tituloSetor}</h1><p>Escolha qual estoque deseja movimentar. Os saldos e históricos ficam separados.</p><div className="estoque-inicio-setores">
          <button className="estoque-inicio-setor produtos" onClick={() => setTipoEstoque("produtos")}><Boxes /> Produtos <span>insumos, bebidas e mercadorias</span></button>
          <button className="estoque-inicio-setor preparos" onClick={() => setTipoEstoque("preparos")}><ChefHat /> Pré-preparos <span>bases e produções já preparadas</span></button>
        </div></main>
      </div>
    );
  }

  if (!responsavel) {
    return (
      <div className="estoque-funcionario">
        <style>{`
          .estoque-funcionario{position:fixed;inset:0;z-index:80;overflow:auto;background:#f1f5f9;color:#0f172a;padding:20px}.estoque-funcionario-topo{max-width:1100px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:12px}.estoque-funcionario-topo button{height:46px;border:1px solid #cbd5e1;border-radius:14px;background:#fff;padding:0 15px;display:flex;align-items:center;gap:8px;font-weight:850;color:#475569}.estoque-funcionario-main{max-width:1100px;margin:clamp(30px,7vh,85px) auto;text-align:center}.estoque-funcionario-main h1{font-size:clamp(28px,4vw,46px);line-height:1.05;margin:0}.estoque-funcionario-main>p{color:#64748b;margin:10px 0 28px;font-size:17px}.estoque-funcionario-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.estoque-funcionario-card{min-height:128px;border:2px solid #e2e8f0;border-radius:22px;background:#fff;padding:17px;text-align:left;display:flex;align-items:center;gap:14px;box-shadow:0 7px 22px rgba(15,23,42,.05)}.estoque-funcionario-card:active{transform:scale(.98);border-color:${cor}}.estoque-funcionario-icone{width:52px;height:52px;border-radius:17px;background:${cor}18;color:${cor};display:grid;place-items:center;flex:none}.estoque-funcionario-card strong{font-size:17px;display:block}.estoque-funcionario-card span{color:#64748b;font-size:12px;font-weight:700;display:block;margin-top:4px}.estoque-funcionario-vazio{padding:50px;border:2px dashed #cbd5e1;border-radius:24px;color:#64748b;font-weight:800;background:#fff}
          @media(max-width:800px){.estoque-funcionario-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.estoque-funcionario{padding:13px}.estoque-funcionario-grid{grid-template-columns:1fr}.estoque-funcionario-card{min-height:92px}.estoque-funcionario-main{margin:28px auto}}
        `}</style>
        <div className="estoque-funcionario-topo">
          <button onClick={voltarEtapa}><ArrowLeft size={19} /> Trocar setor</button>
          <button onClick={pedirTelaCheia}><Maximize2 size={18} /> Tela cheia</button>
        </div>
        <main className="estoque-funcionario-main">
          <h1>Quem está movimentando?</h1>
          <p>Estoque do {tituloAtual} · toque no seu nome para continuar.</p>
          {carregando ? <div className="estoque-funcionario-vazio"><RefreshCw className="animate-spin" /> Carregando equipe...</div> : funcionarios.length === 0 ? (
            <div className="estoque-funcionario-vazio">Nenhum funcionário ativo encontrado nesta unidade.</div>
          ) : (
            <div className="estoque-funcionario-grid">
              {funcionarios.map(func => (
                <button key={func.id} className="estoque-funcionario-card" onClick={() => setResponsavelId(String(func.id))}>
                  <span className="estoque-funcionario-icone"><UserRound size={25} /></span>
                  <span><strong>{func.nome}</strong><span>{func.cargo || "Funcionário"}</span></span>
                </button>
              ))}
            </div>
          )}
        </main>
        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      </div>
    );
  }

  return (
    <div className="estoque-rapido" style={{ "--setor": departamento === "bar" ? "#3B82F6" : "#10B981", "--acao": estiloTipo.principal, "--acao-suave": estiloTipo.suave, "--acao-borda": estiloTipo.borda }}>
      <style>{`
        .estoque-rapido{min-height:100vh;background:#F3F6FA;color:#0F172A;padding-bottom:118px}.estoque-rapido *{box-sizing:border-box}
        .estoque-rapido-topo{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #E2E8F0;box-shadow:0 3px 14px rgba(15,23,42,.06)}
        .estoque-rapido-topo-interno{max-width:1240px;margin:auto;min-height:76px;padding:12px 18px;display:flex;align-items:center;gap:14px}
        .estoque-rapido-voltar,.estoque-rapido-atualizar{width:44px;height:44px;border:1px solid #E2E8F0;border-radius:13px;background:#fff;color:#64748B;display:grid;place-items:center;cursor:pointer;flex:none}
        .estoque-rapido-titulo{flex:1;min-width:0}.estoque-rapido-titulo strong{display:block;font-size:18px}.estoque-rapido-titulo span{display:block;color:#64748B;font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .estoque-rapido-abas{display:flex;background:#F1F5F9;padding:4px;border-radius:14px;gap:4px}.estoque-rapido-abas button{height:40px;padding:0 15px;border:0;border-radius:10px;background:transparent;color:#64748B;font-weight:800;display:flex;align-items:center;gap:7px;cursor:pointer}.estoque-rapido-abas button.ativo{background:#fff;color:#0F172A;box-shadow:0 2px 8px rgba(15,23,42,.08)}
        .estoque-rapido-voz{height:44px;padding:0 14px;border:0;border-radius:13px;background:#7C3AED;color:#fff;font-weight:900;display:flex;align-items:center;gap:7px;cursor:pointer;box-shadow:0 7px 18px rgba(124,58,237,.25);white-space:nowrap}
        .estoque-rapido-conteudo{max-width:1240px;margin:auto;padding:20px 18px}.estoque-rapido-passos{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
        .estoque-rapido-kanban{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:14px}.estoque-rapido-kpi{background:#fff;border:1px solid #E2E8F0;border-radius:18px;padding:14px;display:flex;align-items:center;gap:11px;box-shadow:0 6px 18px rgba(15,23,42,.04);min-width:0}.estoque-rapido-kpi-icone{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex:none}.estoque-rapido-kpi strong{display:block;font-size:20px;line-height:1.1;overflow:hidden;text-overflow:ellipsis}.estoque-rapido-kpi b{display:block;font-size:11px;color:#475569;margin-top:3px}.estoque-rapido-kpi small{display:block;font-size:10px;color:#94A3B8;margin-top:2px}
        .estoque-rapido-resultado{position:fixed;inset:0;z-index:95;margin:0;background:rgba(15,23,42,.58);padding:18px;display:grid;place-items:center;backdrop-filter:blur(4px)}.estoque-rapido-resultado-painel{width:min(720px,100%);max-height:min(720px,calc(100vh - 36px));overflow:auto;background:#ECFDF5;border:1px solid #A7F3D0;border-radius:24px;padding:20px;box-shadow:0 28px 70px rgba(15,23,42,.32)}.estoque-rapido-resultado-topo{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px;color:#047857}.estoque-rapido-resultado-topo strong{display:flex;align-items:center;gap:9px;font-size:19px}.estoque-rapido-resultado-topo span{display:block;margin-top:4px;color:#475569;font-size:13px;font-weight:700}.estoque-rapido-resultado-topo button{width:40px;height:40px;border:0;border-radius:12px;background:#D1FAE5;color:#047857;display:grid;place-items:center;flex:none}.estoque-rapido-resultado-lista{display:grid;gap:9px}.estoque-rapido-resultado-item{display:grid;grid-template-columns:minmax(160px,1fr) auto;align-items:center;gap:8px 12px;background:#fff;border:1px solid #D1FAE5;border-radius:15px;padding:13px 15px}.estoque-rapido-resultado-item strong{font-size:15px}.estoque-rapido-resultado-mov{font-weight:950;color:#047857}.estoque-rapido-resultado-item.saida .estoque-rapido-resultado-mov{color:#BE123C}.estoque-rapido-resultado-saldo{grid-column:1/-1;font-size:13px;font-weight:800;color:#475569}.estoque-rapido-resultado-saldo b{color:#0F172A;font-size:20px}.estoque-rapido-resultado-continuar{width:100%;height:50px;margin-top:14px;border:0;border-radius:14px;background:#059669;color:#fff;font-size:15px;font-weight:950;cursor:pointer}
        .estoque-rapido-painel{background:#fff;border:1px solid #E2E8F0;border-radius:20px;padding:17px;box-shadow:0 8px 24px rgba(15,23,42,.04)}.estoque-rapido-painel h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;margin:0 0 12px;display:flex;align-items:center;gap:7px}
        .estoque-rapido-painel select,.estoque-rapido-painel input[type=text]{width:100%;height:52px;border:2px solid #E2E8F0;border-radius:14px;background:#F8FAFC;padding:0 14px;color:#0F172A;font-size:16px;font-weight:750;outline:none}.estoque-rapido-painel select:focus,.estoque-rapido-painel input[type=text]:focus{border-color:var(--acao)}
        .estoque-rapido-tipos{display:grid;grid-template-columns:1fr 1fr;gap:10px}.estoque-rapido-tipos button{height:52px;border:2px solid #E2E8F0;border-radius:14px;background:#F8FAFC;font-size:15px;font-weight:900;color:#64748B;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.estoque-rapido-tipos button.entrada.ativo{border-color:#10B981;background:rgba(16,185,129,.11);color:#047857}.estoque-rapido-tipos button.saida.ativo{border-color:#F43F5E;background:rgba(244,63,94,.10);color:#BE123C}
        .estoque-rapido-busca{position:relative;margin:18px 0 14px}.estoque-rapido-busca svg{position:absolute;left:16px;top:17px;color:#94A3B8}.estoque-rapido-busca input{width:100%;height:54px;padding:0 50px;border:2px solid #E2E8F0;border-radius:16px;background:#fff;font-size:16px;outline:none}.estoque-rapido-busca input:focus{border-color:var(--acao)}.estoque-rapido-busca button{position:absolute;right:12px;top:11px;width:32px;height:32px;border:0;background:#F1F5F9;color:#64748B;border-radius:9px;display:grid;place-items:center}
        .estoque-rapido-contador{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.estoque-rapido-contador h2{font-size:18px;margin:0}.estoque-rapido-contador span{font-size:13px;font-weight:800;color:#64748B}
        .estoque-rapido-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.estoque-rapido-item{min-height:148px;background:#fff;border:2px solid #E2E8F0;border-radius:18px;padding:15px;text-align:left;cursor:pointer;transition:.15s;position:relative}.estoque-rapido-item:hover{border-color:#CBD5E1;transform:translateY(-1px)}.estoque-rapido-item.selecionado{border-color:var(--acao);background:var(--acao-suave);box-shadow:0 0 0 3px var(--acao-borda)}
        .estoque-rapido-item-topo{display:flex;gap:10px;justify-content:space-between}.estoque-rapido-item-nome{font-size:16px;font-weight:900;line-height:1.25}.estoque-rapido-check{width:26px;height:26px;border:2px solid #CBD5E1;border-radius:8px;display:grid;place-items:center;color:transparent;flex:none}.selecionado .estoque-rapido-check{background:var(--acao);border-color:var(--acao);color:#fff}.estoque-rapido-saldo{margin:14px 0 0;color:#64748B;font-size:12px;font-weight:700}.estoque-rapido-saldo strong{display:block;color:#0F172A;font-size:22px;margin-top:2px}.estoque-rapido-minimo{font-size:11px;color:#94A3B8;margin-top:4px}
        .estoque-rapido-qtd{display:grid;grid-template-columns:42px 1fr 42px;gap:7px;margin-top:13px}.estoque-rapido-qtd button{height:42px;border:0;border-radius:11px;background:#fff;color:var(--acao);display:grid;place-items:center;cursor:pointer;box-shadow:0 1px 5px rgba(15,23,42,.12)}.estoque-rapido-qtd label{height:42px;background:#fff;border-radius:11px;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 6px}.estoque-rapido-qtd input{width:55px;border:0;outline:0;text-align:right;font-size:17px;font-weight:900;background:transparent}.estoque-rapido-qtd span{font-size:11px;color:#64748B;font-weight:800;white-space:nowrap}
        .estoque-rapido-barra{position:fixed;z-index:50;left:0;right:0;bottom:0;background:rgba(255,255,255,.96);border-top:1px solid #CBD5E1;backdrop-filter:blur(12px);padding:12px 18px calc(12px + env(safe-area-inset-bottom))}.estoque-rapido-barra-interna{max-width:1240px;margin:auto;display:grid;grid-template-columns:minmax(200px,1fr) minmax(260px,1.2fr) auto;gap:12px;align-items:center}.estoque-rapido-resumo strong{display:block;font-size:17px}.estoque-rapido-resumo span{display:block;color:#64748B;font-size:12px;margin-top:2px}.estoque-rapido-barra input{height:50px;border:2px solid #E2E8F0;border-radius:14px;padding:0 14px;font-size:15px;outline:none}.estoque-rapido-motivo-btn{display:none;height:44px;border:1px solid #CBD5E1;border-radius:12px;background:#fff;color:#475569;font-weight:850;align-items:center;justify-content:center;gap:7px}.estoque-rapido-confirmar{height:52px;padding:0 22px;border:0;border-radius:15px;background:var(--acao);color:#fff;font-size:15px;font-weight:950;display:flex;align-items:center;gap:9px;cursor:pointer;box-shadow:0 8px 20px var(--acao-borda)}.estoque-rapido-confirmar:disabled{opacity:.55;cursor:wait}
        .estoque-rapido-loading,.estoque-rapido-sem-itens{padding:70px 20px;text-align:center;color:#64748B;font-weight:800}.estoque-rapido-historico{display:flex;flex-direction:column;gap:9px}.estoque-rapido-hist-item{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:14px 16px;display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:center}.estoque-rapido-hist-icone{width:46px;height:46px;border-radius:13px;display:grid;place-items:center}.estoque-rapido-hist-item strong{display:block}.estoque-rapido-hist-item p{margin:4px 0 0;color:#64748B;font-size:12px}.estoque-rapido-hist-item time{font-size:12px;color:#64748B;text-align:right}.estoque-rapido-filtros{display:flex;gap:8px;margin-bottom:15px}.estoque-rapido-filtros button{height:38px;padding:0 14px;border:1px solid #CBD5E1;border-radius:11px;background:#fff;color:#64748B;font-weight:800}.estoque-rapido-filtros button.ativo{background:#0F172A;color:#fff;border-color:#0F172A}
        .estoque-rapido-toast{position:fixed;z-index:100;left:50%;bottom:100px;transform:translateX(-50%);max-width:min(620px,calc(100vw - 28px));padding:14px 15px;border-radius:14px;color:#fff;display:flex;align-items:center;gap:9px;box-shadow:0 14px 34px rgba(15,23,42,.25);font-weight:800}.estoque-rapido-toast span{flex:1}.estoque-rapido-toast button{border:0;background:transparent;color:#fff;display:grid;place-items:center}
        .estoque-voz-modal{position:fixed;inset:0;z-index:280;background:rgba(15,23,42,.66);padding:16px;display:grid;place-items:center;backdrop-filter:blur(5px)}.estoque-voz-card{position:relative;width:min(590px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:26px;padding:24px;box-shadow:0 30px 80px rgba(15,23,42,.4)}.estoque-voz-fechar{position:absolute;right:14px;top:14px;width:42px;height:42px;border:0;border-radius:13px;background:#F1F5F9;color:#64748B;display:grid;place-items:center}.estoque-voz-topo{padding-right:46px}.estoque-voz-topo span{width:58px;height:58px;border-radius:18px;background:#EDE9FE;color:#7C3AED;display:grid;place-items:center;margin-bottom:12px}.estoque-voz-topo h2{margin:0;font-size:24px}.estoque-voz-topo p{margin:6px 0 0;color:#64748B;font-size:14px;font-weight:700}.estoque-voz-transcricao{min-height:55px;margin-top:17px;border:2px solid #DDD6FE;border-radius:15px;background:#FAF5FF;padding:13px;color:#5B21B6;font-weight:850}.estoque-voz-resposta{margin-top:10px;border-radius:15px;background:#F1F5F9;padding:13px;color:#334155;font-size:14px;font-weight:750;line-height:1.45}.estoque-voz-exemplos{margin-top:15px}.estoque-voz-exemplos strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:7px}.estoque-voz-exemplos button{width:100%;min-height:40px;margin-top:6px;border:1px solid #E2E8F0;border-radius:11px;background:#fff;padding:8px 11px;text-align:left;color:#475569;font-weight:750}.estoque-voz-ouvir{width:100%;min-height:56px;margin-top:17px;border:0;border-radius:16px;background:#7C3AED;color:#fff;font-size:16px;font-weight:950;display:flex;align-items:center;justify-content:center;gap:9px}.estoque-voz-ouvir.ouvindo{background:#E11D48;animation:estoquePulso 1.1s infinite}@keyframes estoquePulso{50%{transform:scale(.985);opacity:.88}}
        .estoque-rapido-vazio{min-height:100vh;background:#F8FAFC;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;color:#64748B}.estoque-rapido-vazio h1{color:#0F172A;margin:15px 0 6px}.estoque-rapido-vazio p{margin:0 0 20px}.estoque-rapido-vazio button{height:48px;padding:0 18px;border:0;border-radius:13px;background:#0F172A;color:#fff;font-weight:800;display:flex;align-items:center;gap:8px}
        @media(max-width:1000px){.estoque-rapido-kanban{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:850px){.estoque-rapido-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.estoque-rapido-barra-interna{grid-template-columns:1fr 1fr}.estoque-rapido-resumo{grid-column:1/-1}.estoque-rapido-confirmar{justify-content:center}}
        @media(max-width:620px){
          .estoque-rapido{padding-bottom:150px}
          .estoque-rapido-topo-interno{min-height:58px;padding:7px 9px;gap:6px;flex-wrap:nowrap}
          .estoque-rapido-voltar{width:40px;height:40px;border-radius:11px}
          .estoque-rapido-emoji,.estoque-rapido-atualizar{display:none}
          .estoque-rapido-titulo{flex:1}.estoque-rapido-titulo strong{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.estoque-rapido-titulo span{display:none}
          .estoque-rapido-abas{width:auto;margin-left:auto;padding:2px;border-radius:11px;gap:2px;flex:none}
          .estoque-rapido-abas button{width:40px;height:40px;padding:0;justify-content:center;border-radius:9px}
          .estoque-rapido-abas-label{display:none}
          .estoque-rapido-voz{width:40px;height:40px;padding:0;justify-content:center;border-radius:11px}.estoque-rapido-voz span{display:none}
          .estoque-rapido-conteudo{padding:10px 10px}
          .estoque-rapido-kanban{display:flex;grid-template-columns:none;gap:8px;margin:0 -10px 10px;padding:0 10px 3px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none}.estoque-rapido-kanban::-webkit-scrollbar{display:none}
          .estoque-rapido-kpi{flex:0 0 148px;scroll-snap-align:start;padding:9px;gap:8px;border-radius:14px}.estoque-rapido-kpi-icone{width:34px;height:34px;border-radius:10px}.estoque-rapido-kpi strong{font-size:16px}.estoque-rapido-kpi b{font-size:10px}.estoque-rapido-kpi small{display:none}
          .estoque-rapido-passos{grid-template-columns:1fr;margin-bottom:10px}.estoque-rapido-painel{padding:10px;border-radius:14px}.estoque-rapido-painel h2{font-size:10px;margin-bottom:8px}.estoque-rapido-tipos{gap:7px}.estoque-rapido-tipos button{height:46px;border-radius:11px;font-size:14px}
          .estoque-rapido-busca{margin:10px 0}.estoque-rapido-busca input{height:48px;border-radius:13px;padding-left:45px}.estoque-rapido-busca svg{left:14px;top:14px}.estoque-rapido-busca button{top:8px}
          .estoque-rapido-contador{margin-bottom:8px}.estoque-rapido-contador h2{font-size:16px}
          .estoque-rapido-grid{grid-template-columns:1fr}.estoque-rapido-item{min-height:0;padding:13px;border-radius:15px}.estoque-rapido-saldo{margin-top:9px}.estoque-rapido-saldo strong{font-size:20px}
          .estoque-rapido-resultado{padding:10px}.estoque-rapido-resultado-painel{max-height:calc(100vh - 20px);padding:15px;border-radius:18px}.estoque-rapido-resultado-topo strong{font-size:16px}.estoque-rapido-resultado-item{grid-template-columns:1fr auto;gap:6px}.estoque-rapido-resultado-saldo{grid-column:1/-1}.estoque-rapido-resultado-saldo b{font-size:18px}
          .estoque-rapido-barra{padding:8px 10px calc(8px + env(safe-area-inset-bottom))}.estoque-rapido-barra-interna{grid-template-columns:1fr auto;gap:7px}.estoque-rapido-resumo{display:none}.estoque-rapido-motivo-btn{display:flex;width:48px;padding:0;font-size:0}.estoque-rapido-barra input{display:none;grid-column:1/-1;height:42px;border-radius:11px}.estoque-rapido-barra input.visivel{display:block}.estoque-rapido-confirmar{height:48px;border-radius:12px;justify-content:center}.estoque-rapido-motivo-btn{grid-column:2}.estoque-rapido-confirmar{grid-column:1;grid-row:1}
          .estoque-rapido-hist-item{grid-template-columns:42px 1fr}.estoque-rapido-hist-item time{grid-column:2;text-align:left}.estoque-rapido-toast{bottom:140px}
          .estoque-voz-modal{padding:9px}.estoque-voz-card{max-height:calc(100vh - 18px);border-radius:20px;padding:18px 14px}.estoque-voz-topo h2{font-size:20px}
        }
      `}</style>

      <header className="estoque-rapido-topo">
        <div className="estoque-rapido-topo-interno">
          <button className="estoque-rapido-voltar" onClick={voltarEtapa} aria-label="Trocar funcionário ou setor"><ArrowLeft size={20} /></button>
          <span className="estoque-rapido-emoji" style={{ fontSize: 27 }}>{emoji}</span>
          <div className="estoque-rapido-titulo">
            <strong>Estoque · {tituloAtual}</strong>
            <span>{responsavel.nome} · {unidadeInfo?.nome || "Unidade selecionada"}</span>
          </div>
          <nav className="estoque-rapido-abas">
            <button className={aba === "operacao" ? "ativo" : ""} onClick={() => setAba("operacao")} aria-label="Movimentar estoque" title="Movimentar"><ShoppingBasket size={17} /> <span className="estoque-rapido-abas-label">Movimentar</span></button>
            <button className={aba === "historico" ? "ativo" : ""} onClick={() => setAba("historico")} aria-label="Ver histórico" title="Histórico"><History size={17} /> <span className="estoque-rapido-abas-label">Histórico</span></button>
            <button onClick={() => router.push("/dashboard/operacao/estoque?gestao=1")} aria-label="Abrir gestão completa" title="Gestão completa"><Settings2 size={17} /> <span className="estoque-rapido-abas-label">Gestão completa</span></button>
          </nav>
          <button className="estoque-rapido-atualizar" onClick={() => carregar()} aria-label="Atualizar"><RefreshCw size={18} /></button>
        </div>
      </header>

      {aba === "operacao" ? (
        <main className="estoque-rapido-conteudo">
          <section className="estoque-rapido-kanban" aria-label="Indicadores do estoque">
            {kanbans.map(card => {
              const Icone = card.icone;
              return (
                <article className="estoque-rapido-kpi" key={card.rotulo}>
                  <span className="estoque-rapido-kpi-icone" style={{ color: card.cor, background: card.fundo }}><Icone size={21} /></span>
                  <span><strong style={{ color: card.cor }}>{card.valor}</strong><b>{card.rotulo}</b><small>{card.detalhe}</small></span>
                </article>
              );
            })}
          </section>

          {ultimoResultado.length > 0 && (
            <section className="estoque-rapido-resultado" role="dialog" aria-modal="true" aria-label="Saldo atualizado do estoque">
              <div className="estoque-rapido-resultado-painel">
                <div className="estoque-rapido-resultado-topo">
                  <div>
                    <strong><CheckCircle2 size={23} /> Saldo atualizado do estoque</strong>
                    <span>{tipo === "entrada" ? "Produtos adicionados com sucesso." : "Produtos retirados com sucesso."}</span>
                  </div>
                  <button onClick={() => setUltimoResultado([])} aria-label="Fechar resultado"><X size={19} /></button>
                </div>
                <div className="estoque-rapido-resultado-lista">
                  {ultimoResultado.map(item => (
                    <div className={`estoque-rapido-resultado-item ${item.tipo}`} key={item.id}>
                      <strong>{item.nome}</strong>
                      <span className="estoque-rapido-resultado-mov">{item.tipo === "entrada" ? "+" : "−"}{fmtQtd(item.quantidadeMovida)} {rotuloUnidade(item.unidade, item.quantidadeMovida)}</span>
                      <span className="estoque-rapido-resultado-saldo">Agora tem no estoque: <b>{fmtQtd(item.saldoNovo)} {rotuloUnidade(item.unidade, item.saldoNovo)}</b></span>
                    </div>
                  ))}
                </div>
                <button className="estoque-rapido-resultado-continuar" onClick={() => setUltimoResultado([])}>Fechar e continuar</button>
              </div>
            </section>
          )}
          <section className="estoque-rapido-passos" style={{ gridTemplateColumns: "1fr" }}>
            <div className="estoque-rapido-painel">
              <h2><Layers3 size={16} /> O que será feito?</h2>
              <div className="estoque-rapido-tipos">
                <button className={`entrada ${tipo === "entrada" ? "ativo" : ""}`} onClick={() => setTipo("entrada")}><PackagePlus size={20} /> Depositar</button>
                <button className={`saida ${tipo === "saida" ? "ativo" : ""}`} onClick={() => setTipo("saida")}><PackageMinus size={20} /> Retirar</button>
              </div>
            </div>
          </section>

          <div className="estoque-rapido-busca">
            <Search size={20} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Buscar item do ${tituloAtual.toLowerCase()}...`} autoFocus />
            {busca && <button onClick={() => setBusca("")}><X size={17} /></button>}
          </div>

          <div className="estoque-rapido-contador">
            <h2>Escolha um ou vários itens</h2>
            <span>{listaSelecionados.length} selecionado(s)</span>
          </div>

          {carregando ? <div className="estoque-rapido-loading">Carregando itens...</div> : visiveis.length === 0 ? (
            <div className="estoque-rapido-sem-itens">Nenhum item encontrado neste estoque.</div>
          ) : (
            <div className="estoque-rapido-grid">
              {visiveis.map(item => {
                const selecionado = selecionados[item.id];
                return (
                  <article key={item.id} className={`estoque-rapido-item ${selecionado ? "selecionado" : ""}`} onClick={() => alternarItem(item)}>
                    <div className="estoque-rapido-item-topo">
                      <div className="estoque-rapido-item-nome">{item.nome}</div>
                      <div className="estoque-rapido-check"><Check size={17} /></div>
                    </div>
                    <div className="estoque-rapido-saldo">Disponível<strong>{fmtQtd(item.quantidade)} {rotuloUnidade(item.unidade, item.quantidade)}</strong></div>
                    {item.local && <div className="estoque-rapido-minimo">Local: {item.local}</div>}
                    {item.minimo != null && <div className="estoque-rapido-minimo">Mínimo: {fmtQtd(item.minimo)} {rotuloUnidade(item.unidade, item.minimo)}</div>}
                    {selecionado && <ControleQuantidade valor={selecionado.quantidade} unidade={item.unidade} onChange={valor => alterarQuantidade(item.id, valor)} />}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      ) : (
        <main className="estoque-rapido-conteudo">
          <div className="estoque-rapido-filtros">
            {[{ id: "todos", label: "Todos" }, { id: "entrada", label: "Entradas" }, { id: "saida", label: "Retiradas" }].map(filtro => (
              <button key={filtro.id} className={filtroHistorico === filtro.id ? "ativo" : ""} onClick={() => setFiltroHistorico(filtro.id)}>{filtro.label}</button>
            ))}
          </div>
          {historicoVisivel.length === 0 ? <div className="estoque-rapido-sem-itens">Nenhuma movimentação encontrada.</div> : (
            <div className="estoque-rapido-historico">
              {historicoVisivel.map(item => {
                const entrada = item.tipo === "entrada";
                return (
                  <div className="estoque-rapido-hist-item" key={item.id}>
                    <div className="estoque-rapido-hist-icone" style={{ color: entrada ? "#059669" : "#E11D48", background: entrada ? "#D1FAE5" : "#FFE4E6" }}>
                      {entrada ? <PackagePlus size={21} /> : <PackageMinus size={21} />}
                    </div>
                    <div>
                      <strong>{item.estoque?.nome || "Item"} · {entrada ? "+" : "−"}{fmtQtd(item.quantidade)} {rotuloUnidade(item.estoque?.unidade, item.quantidade)}</strong>
                      <p>{item.responsavel || "Sem responsável"}{item.motivo ? ` · ${item.motivo}` : ""}</p>
                    </div>
                    <time>{fmtData(item.created_at)}</time>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {auditoriaVozAberta && (
        <div className="estoque-voz-modal" role="dialog" aria-modal="true" aria-label="Auditoria de estoque por voz">
          <div className="estoque-voz-card">
            <button className="estoque-voz-fechar" onClick={fecharAuditoriaVoz} aria-label="Fechar auditoria por voz"><X size={20} /></button>
            <div className="estoque-voz-topo">
              <span>{ouvindoVoz ? <MicOff size={28} /> : <Mic size={28} />}</span>
              <h2>Auditoria por voz</h2>
              <p>Consulte entradas, saídas e saldos ou prepare uma movimentação para confirmar.</p>
            </div>
            <div className="estoque-voz-transcricao">{textoVoz ? `“${textoVoz}”` : ouvindoVoz ? "Ouvindo..." : "Nenhum comando falado ainda."}</div>
            <div className="estoque-voz-resposta">{respostaVoz}</div>
            <div className="estoque-voz-exemplos">
              <strong>Exemplos de comandos</strong>
              <button type="button" onClick={() => processarComandoVoz("Mostrar entradas")}>“Mostrar entradas”</button>
              <button type="button" onClick={() => processarComandoVoz("Mostrar saídas")}>“Mostrar saídas”</button>
              {itens[0] && <button type="button" onClick={() => processarComandoVoz(`Quanto tem de ${itens[0].nome}`)}>“Quanto tem de {itens[0].nome}?”</button>}
              {itens[0] && <button type="button" onClick={() => processarComandoVoz(`Retirar 1 unidade de ${itens[0].nome}`)}>“Retirar 1 unidade de {itens[0].nome}”</button>}
              {listaSelecionados.length > 0 && <button type="button" onClick={() => processarComandoVoz(`Confirmar ${tipo === "entrada" ? "entrada" : "retirada"}`)}>“Confirmar {tipo === "entrada" ? "entrada" : "retirada"}”</button>}
            </div>
            <button className={`estoque-voz-ouvir ${ouvindoVoz ? "ouvindo" : ""}`} onClick={ouvindoVoz ? () => escutaVozRef.current?.parar?.() : iniciarEscutaAuditoria}>
              {ouvindoVoz ? <MicOff size={22} /> : <Mic size={22} />}{ouvindoVoz ? "Parar de ouvir" : "Falar outro comando"}
            </button>
          </div>
        </div>
      )}

      {aba === "operacao" && (
        <footer className="estoque-rapido-barra">
          <div className="estoque-rapido-barra-interna">
            <div className="estoque-rapido-resumo">
              <strong>{listaSelecionados.length} item(ns) · {tipo === "entrada" ? "Entrada" : tipo === "saida" ? "Retirada" : "Escolha entrada ou retirada"}</strong>
              <span>{responsavel ? `Responsável: ${responsavel.nome}` : "Escolha o responsável acima"}</span>
            </div>
            <input className={mostrarMotivo || motivo ? "visivel" : ""} type="text" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo ou observação (opcional)" />
            <button type="button" className="estoque-rapido-motivo-btn" onClick={() => setMostrarMotivo(valor => !valor)} aria-label="Adicionar observação"><MessageSquareText size={19} /> Observação</button>
            <button className="estoque-rapido-confirmar" onClick={() => confirmarLote()} disabled={salvando || !listaSelecionados.length || !tipo}>
              {salvando ? <RefreshCw className="animate-spin" size={19} /> : tipo === "saida" ? <PackageMinus size={19} /> : <PackagePlus size={19} />}
              {salvando ? "Registrando..." : tipo ? `Confirmar ${tipo === "entrada" ? "entrada" : "retirada"}` : "Escolha entrada ou retirada"}
            </button>
          </div>
        </footer>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
