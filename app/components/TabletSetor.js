"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Boxes, CalendarDays, Check, CheckCircle2, ChefHat, Clock, GlassWater, History, Layers3, Maximize2, Minus,
  Mic, MicOff, Package, PackageMinus, PackagePlus, Plus, RefreshCw, Search, ShoppingBasket,
  Settings2, Sparkles, Trash2, UserRound, X, XCircle,
  // Ícones dos produtos. A lista tem de bater com ICONES_USADOS de
  // icone-produto.mjs — nome fora da lista vira componente indefinido, e o
  // React renderiza indefinido como nada, sem erro nenhum.
  Banana, Bean, Beef, Beer, Candy, Carrot, Citrus, Coffee, Croissant, CupSoda,
  Drumstick, Egg, Fish, FlaskConical, Ham, IceCreamCone, Martini, Milk, Salad,
  Snowflake, Soup, Utensils, Wheat, Wine,
} from "lucide-react";
import {
  fetchEstoques, fetchItensEstoque, fetchMovimentosMulti, garantirEstoquesPadrao,
  garantirFichasExistentesNoEstoquePreparo, registrarLoteMovimentosMulti, vincularItemEstoque,
} from "../lib/estoques-multiplos";
import { fetchNomesDePratosEDrinks, salvarInsumo } from "../lib/operacao";
import { fetchEmbalagens } from "../lib/embalagens";
import { fetchColaboradores } from "../lib/rh";
import { equipeDaArea } from "../lib/equipe-area.mjs";
import { volumeDaEmbalagem } from "../lib/volume-embalagem.mjs";
import { iconeDoProduto } from "../lib/icone-produto.mjs";
import { useERP } from "../context/ERPContext";
import { criarEscuta, falar, vozDisponivel } from "../lib/hefisto-voz";
import { registrarAuditoria } from "../lib/hefisto-acoes";
import { atualizarControleLimpeza, fetchControleLimpeza, inserirControleLimpeza } from "../lib/controles_cozinha";

const cores = {
  entrada: { principal: "#10B981", suave: "rgba(16,185,129,.14)", borda: "rgba(16,185,129,.38)" },
  saida: { principal: "#F43F5E", suave: "rgba(244,63,94,.14)", borda: "rgba(244,63,94,.38)" },
  // Enquanto ninguém escolheu entre depositar e retirar.
  neutro: { principal: "#64748B", suave: "rgba(100,116,139,.12)", borda: "rgba(100,116,139,.32)" },
};

// Comparar sem acento e sem caixa: no tablet ninguém para para achar o ç, e
// "acucar" tem de encontrar "Açúcar".
const semAcento = (valor) => String(valor ?? "")
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLocaleLowerCase("pt-BR")
  .trim();

const ICONES_PRODUTO = {
  Banana, Bean, Beef, Beer, Candy, Carrot, Citrus, Coffee, Croissant, CupSoda,
  Drumstick, Egg, Fish, FlaskConical, GlassWater, Ham, IceCreamCone, Martini,
  Milk, Package, Salad, Snowflake, Soup, Utensils, Wheat, Wine,
};

const numero = valor => Number(valor) || 0;
const fmtQtd = valor => numero(valor).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const fmtData = iso => new Date(iso).toLocaleString("pt-BR", {
  day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});
const paraDataHoraLocal = iso => {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const deslocamento = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16);
};

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
  // Em que unidade a pessoa conta este item.
  //
  // A regra antiga adivinhava pelo SALDO: só contava por embalagem quando o
  // saldo já era maior que uma embalagem. Item recém-cadastrado tem saldo zero,
  // então caía no ml — era isso que fazia o creme de leite de 200ml pedir
  // mililitro em vez de unidade, justo na primeira contagem.
  //
  // Agora a ordem é: o que o cadastro DIZ vem primeiro; o palpite pelo saldo só
  // entra quando ninguém disse nada, e só para saldo já existente. Saldo zero
  // não é ambíguo — zero é zero em qualquer unidade, e quem vai contar vai
  // contar potes.
  const declarado = item.conta_por_embalagem ?? item.insumo?.conta_por_embalagem ?? null;
  const usaEmbalagem = embalagem > 1 && (
    declarado !== null
      ? declarado === true
      : saldoBase === 0 || saldoBase >= embalagem * (itemDoBar ? 1 : 1.5)
  );
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
    maximo: item.estoque_maximo == null ? null : numero(item.estoque_maximo) / fator,
    // Quanto cabe em cada garrafa/lata/pote. A regra tem exceção (fardo de 12
    // não é volume) e mora em volume-embalagem.mjs, com teste — a condição
    // solta que estava aqui escondia o Absolut de 1 L, porque 1 não é > 1.
    volumeEmbalagem: volumeDaEmbalagem(item),
    icone: iconeDoProduto(item, departamento),
    valorTotal: saldoBase * numero(item.custo_unitario || item.insumo?.custo_unitario),
    validade: item.validade || null,
    local: item.local_interno || "",
  };
}

function Toast({ toast, onClose }) {
  // onClose chega como função nova a cada render do pai. Com ela nas
  // dependências, o cronômetro reiniciava a cada renderização e o aviso ficava
  // muito além do tempo configurado — era esse o motivo de "demora a sair", e
  // não a duração em si. A ref mantém a última versão fora das dependências.
  const fecharRef = useRef(onClose);
  fecharRef.current = onClose;

  useEffect(() => {
    // Quem lança estoque encadeia item atrás de item, e o aviso ficava por cima
    // do próximo produto. Erro fica mais tempo, porque erro precisa ser lido.
    const timer = setTimeout(() => fecharRef.current(), toast.tipo === "ok" ? 1400 : 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const ok = toast.tipo === "ok";
  return (
    <div className="estoque-rapido-toast" style={{ background: ok ? "#059669" : "#E11D48" }}>
      {ok ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
      <span>{toast.msg}</span>
      <button onClick={onClose} aria-label="Fechar aviso"><X size={17} /></button>
    </div>
  );
}

// O passo é sempre 1, em qualquer unidade. Antes ele virava 0,5 assim que a
// quantidade chegava a 1, e a contagem de un/garrafa/lata saía fracionada sem
// ninguém ter pedido — meia lata não existe. Quem precisa de meio quilo digita.
// E no 1 o botão vira lixeira: o piso antigo de 0,1 prendia o item na lista.
// Limpeza e Embalagens não se dividem em produtos/pré-preparos: têm um estoque
// só e entram direto na lista. A escolha do tipo continua valendo para cozinha
// e bar, que guardam três coisas diferentes no mesmo setor.
const AREAS_DIRETAS = ["limpeza", "embalagens"];
const NOME_AREA = { bar: "Bar", cozinha: "Cozinha", limpeza: "Limpeza", embalagens: "Embalagens" };

function ControleQuantidade({ valor, unidade, modo = "inteiro", onChange, onRemover }) {
  const atual = numero(valor);
  const passo = modo === "fracionado" ? 0.1 : 1;
  const vaiRemover = atual <= passo;
  const ajustar = proximo => onChange(Math.round(Math.max(0, proximo) * 1000) / 1000);
  return (
    <div className="estoque-rapido-qtd" onClick={e => e.stopPropagation()}>
      <button type="button"
        onClick={() => (vaiRemover ? onRemover() : ajustar(atual - passo))}
        aria-label={vaiRemover ? "Tirar item da lista" : "Diminuir"}>
        {vaiRemover ? <Trash2 size={17} /> : <Minus size={18} />}
      </button>
      <label>
        {/* O texto digitado vai cru para o estado. Antes ele passava por
            Math.max(0, numero(...)), então apagar o campo virava 0 na hora e o
            campo nunca ficava vazio: digitar 5 em cima dava "05". Quem valida
            é a confirmação, que já barra quantidade zerada pelo nome do item. */}
        {/* Sem select() no foco: quem toca no número quer apagar um dígito,
            e a seleção do valor inteiro fazia a primeira tecla varrer tudo.
            O cursor fica onde o dedo tocou. */}
        <input
          type="number"
          min="0"
          step={modo === "fracionado" ? "0.001" : "1"}
          value={valor}
          onChange={e => onChange(modo === "inteiro" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value)}
        />
        <span>{rotuloUnidade(unidade, valor)}</span>
      </label>
      <button type="button" onClick={() => ajustar(atual + passo)} aria-label="Aumentar">
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
  const [tipoEstoque, setTipoEstoque] = useState(""); // produtos | preparos | embalagens

  const [aba, setAba] = useState("operacao");
  // Nada vem marcado: quem opera escolhe depositar ou retirar. Vir na retirada
  // fazia a pessoa dar baixa sem perceber.
  const [tipo, setTipo] = useState("");
  const [itens, setItens] = useState([]);
  const [estoquesAtuais, setEstoquesAtuais] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [selecionados, setSelecionados] = useState({});
  const [responsavelId, setResponsavelId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalCadastro, setModalCadastro] = useState(false);
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [novoItem, setNovoItem] = useState({ nome: "", unidade: "un", minimo: "", maximo: "" });
  const [ciclosLimpeza, setCiclosLimpeza] = useState([]);
  const [modalCiclo, setModalCiclo] = useState(false);
  const [salvandoCiclo, setSalvandoCiclo] = useState(false);
  const [cicloForm, setCicloForm] = useState({ id: "", produto: "", chegada: "", inicio_uso: "", fim_uso: "" });
  const [filtroHistorico, setFiltroHistorico] = useState("todos");
  const [auditoriaVozAberta, setAuditoriaVozAberta] = useState(false);
  const [ouvindoVoz, setOuvindoVoz] = useState(false);
  const [textoVoz, setTextoVoz] = useState("");
  const [respostaVoz, setRespostaVoz] = useState("Toque no microfone e fale o que deseja conferir ou movimentar.");
  const escutaVozRef = useRef(null);

  const carregar = useCallback(async (mostrarLoading = true) => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setItens([]);
      setEstoquesAtuais([]);
      setFuncionarios([]);
      setHistorico([]);
      setCarregando(false);
      return [];
    }
    if (mostrarLoading) setCarregando(true);
    const [resEstoques, resFuncionarios, resCiclos] = await Promise.all([
      fetchEstoques(unidadeAtiva),
      fetchColaboradores(unidadeAtiva),
      departamento === "limpeza" ? fetchControleLimpeza(unidadeAtiva) : Promise.resolve({ data: [] }),
    ]);
    setCiclosLimpeza(resCiclos.data || []);
    // Unidade criada antes de os estoques de embalagem existirem chega aqui sem
    // eles. Em vez de mostrar a tela vazia sem explicação, cria os padrões na
    // hora — a função é idempotente e só entra quando realmente falta algum.
    let listaEstoques = resEstoques.data || [];
    if (!listaEstoques.some(e => `${e.slug || ""} ${e.nome || ""}`.toLowerCase().includes("embalage"))) {
      await garantirEstoquesPadrao(unidadeAtiva);
      const recarregado = await fetchEstoques(unidadeAtiva);
      if (recarregado.data?.length) listaEstoques = recarregado.data;
    }
    const estoquesDoSetor = listaEstoques.filter(estoque => {
      if (!departamento) return false;
      const texto = `${estoque.slug || ""} ${estoque.nome || ""}`.toLowerCase();
      // Áreas próprias vêm antes: "Embalagens da Cozinha" contém "cozinha" e
      // seria capturada pelo setor errado se a ordem fosse outra.
      if (departamento === "limpeza") return texto.includes("limpeza") || estoque.tipo === "limpeza";
      if (departamento === "embalagens") return texto.includes("embalage") || estoque.tipo === "embalagens";
      // Embalagens e limpeza têm área própria na tela inicial. "Embalagens do
      // Bar" contém "bar" e entrava no bar de novo — o mesmo estoque aparecia
      // em dois lugares, e a contagem virava duas contagens do mesmo item.
      const ehDeOutraArea = texto.includes("embalage") || texto.includes("limpeza")
        || estoque.tipo === "embalagens" || estoque.tipo === "limpeza";
      if (departamento === "bar") return !ehDeOutraArea && (texto.includes("bar") || (estoque.tipo === "bebidas" && !texto.includes("cozinha")));
      if (departamento === "cozinha") return !ehDeOutraArea && (texto.includes("cozinha") || (estoque.tipo === "alimentos" && !texto.includes("bar")));
      return texto.includes(departamento);
    });
    // Três estoques por setor, cada um com saldo e histórico próprios. Embalagem
    // estava caindo dentro de "Produtos" e se misturava com insumo na contagem.
    const estoquesAlvo = estoquesDoSetor.filter(estoque => {
      if (tipoEstoque === "unico") return true;   // limpeza e embalagens: um estoque só
      const texto = `${estoque.slug || ""} ${estoque.nome || ""}`.toLowerCase();
      const ehPreparo = texto.includes("pre-preparo") || texto.includes("preparo");
      const ehEmbalagem = texto.includes("embalage") || estoque.tipo === "embalagens";
      if (tipoEstoque === "preparos") return ehPreparo && !ehEmbalagem;
      if (tipoEstoque === "embalagens") return ehEmbalagem;
      return !ehPreparo && !ehEmbalagem;
    });
    // Fichas antigas criadas antes do estoque de pré-preparos ainda não tinham
    // vínculo físico. Ao abrir Cozinha ou Bar, repara esses vínculos uma vez e
    // elas passam a aparecer com saldo zero, prontas para receber produção.
    if (tipoEstoque === "preparos" && ["cozinha", "bar"].includes(departamento)) {
      await garantirFichasExistentesNoEstoquePreparo(unidadeAtiva, departamento);
    }
    setEstoquesAtuais(estoquesAlvo);
    const nomesProntos = await fetchNomesDePratosEDrinks(
      unidadeAtiva, ["cozinha", "bar"].includes(departamento) ? departamento : "",
    );
    // Estoque de embalagem só mostra embalagem. Havia 93 produtos do bar
    // vinculados ali por engano, todos zerados, escondendo os potes e sacos de
    // verdade. Nada é apagado: o vínculo errado continua no banco, só sai da
    // contagem. A lista oficial é o cadastro de embalagens do restaurante.
    const ehEstoqueDeEmbalagem = estoquesAlvo.some(e =>
      /embalage/i.test(`${e.slug || ""} ${e.nome || ""}`) || e.tipo === "embalagens");
    const embalagensCadastradas = ehEstoqueDeEmbalagem
      ? await fetchEmbalagens(unidadeAtiva)
      : { data: [] };
    const nomesEmbalagem = new Set(
      (embalagensCadastradas.data || []).map(e => String(e.nome || "").trim().toLowerCase()).filter(Boolean));
    const idsEmbalagem = new Set(
      (embalagensCadastradas.data || []).map(e => e.insumo_id).filter(Boolean));
    const [respostasItens, respostasHistorico] = await Promise.all([
      Promise.all(estoquesAlvo.map(estoque => fetchItensEstoque(estoque.id, unidadeAtiva))),
      Promise.all(estoquesAlvo.map(estoque => fetchMovimentosMulti(unidadeAtiva, estoque.id, 120))),
    ]);
    // Prato e drink montados na hora não são estoque: quem tem saldo é o
    // ingrediente e o pré-preparo. Se um deles foi parar aqui como item, some
    // da contagem — ninguém conta "caipirinha" na geladeira. Cerveja e
    // refrigerante continuam, porque são comprados prontos.
    const prontos = new Set(nomesProntos.data || []);
    const itensCarregados = estoquesAlvo.flatMap((estoque, indice) =>
      (respostasItens[indice]?.data || []).map(item => normalizarItem(item, estoque, departamento))
    ).filter(item => {
      const nome = String(item.nome || "").trim().toLowerCase();
      if (prontos.has(nome)) return false;
      if (!ehEstoqueDeEmbalagem) return true;
      const dept = String(item.departamento || item.insumo?.departamento || "").toLowerCase();
      return dept.startsWith("embalage") || idsEmbalagem.has(item.insumo_id) || nomesEmbalagem.has(nome);
    });
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

  // Mesma regra do ponto: cada área mostra a sua equipe. Quem tem
  // acesso_todas_areas marcado no cadastro aparece em todas — é o caso de quem
  // cobre qualquer setor mas tem setor próprio no cargo.
  const equipeDoSetor = useMemo(
    () => equipeDaArea(funcionarios, departamento),
    [funcionarios, departamento],
  );

  const responsavel = funcionarios.find(f => String(f.id) === String(responsavelId));
  const listaSelecionados = Object.values(selecionados);
  // A cor da tela seguia o tipo global. Agora que cada item tem o seu, ela
  // segue o conjunto: verde se tudo é entrada, vermelho se tudo é saída, neutro
  // quando há os dois — porque pintar de vermelho uma tela que também repõe
  // passaria a mensagem errada para quem confirma.
  const tiposEscolhidos = new Set(listaSelecionados.map(item => item.tipo || tipo).filter(Boolean));
  const tipoDominante = tiposEscolhidos.size === 1 ? [...tiposEscolhidos][0] : "";
  const estiloTipo = cores[tipoDominante] || cores.neutro;
  const faltaEscolherTipo = listaSelecionados.some(item => !(item.tipo || tipo));
  const faltaEscolherModoQuantidade = listaSelecionados.some(item => !item.modoQuantidade);
  const tituloSetor = NOME_AREA[departamento] || titulo;
  const tituloAtual = tipoEstoque === "preparos" ? `Pré-preparos · ${tituloSetor}`
    : tipoEstoque === "embalagens" ? `Embalagens · ${tituloSetor}`
      : tituloSetor;

  const selecionarSetor = novoSetor => {
    setSetorEscolhido(novoSetor);
    // Área sem subdivisão pula a tela de escolha e já abre a lista.
    setTipoEstoque(AREAS_DIRETAS.includes(novoSetor) ? "unico" : "");
    setResponsavelId("");
    setSelecionados({});
    setBusca("");
    setAba("operacao");
  };

  const voltarEtapa = () => {
    if (responsavelId) {
      setResponsavelId("");
      setSelecionados({});
      setBusca("");
      return;
    }
    if (tipoEstoque) {
      setTipoEstoque("");
      setSelecionados({});
      setBusca("");
      // Área direta não tem tela de escolha para voltar: sai para as áreas.
      if (AREAS_DIRETAS.includes(departamento) && !setorFixo) setSetorEscolhido("");
      return;
    }
    if (departamento && !setorFixo) {
      setSetorEscolhido("");
      setSelecionados({});
      setBusca("");
      return;
    }
    router.push(voltarHref || "/dashboard");
  };

  const pedirTelaCheia = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    } catch { /* o navegador pode bloquear; o modo visual continua em tela inteira */ }
  };

  // Sem acento dos dois lados: no tablet ninguém para para achar o ç, e
  // "acucar" tem de encontrar "Açúcar". A ordenação também muda: quem começa
  // com o termo vem antes de quem só o contém no meio, senão buscar "leite"
  // devolve "Creme de leite" na frente de "Leite".
  const visiveis = useMemo(() => {
    const termo = semAcento(busca);
    // Sem busca, ordem alfabética: a lista vinha na ordem do banco, então o
    // mesmo item mudava de lugar entre uma contagem e outra.
    if (!termo) return [...itens].sort((a, b) => semAcento(a.nome).localeCompare(semAcento(b.nome)));
    const achados = itens.filter(item => semAcento(`${item.nome} ${item.marca || ""}`).includes(termo));
    return achados.sort((a, b) => {
      const ia = semAcento(a.nome).indexOf(termo);
      const ib = semAcento(b.nome).indexOf(termo);
      if (ia !== ib) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      return semAcento(a.nome).localeCompare(semAcento(b.nome));
    });
  }, [busca, itens]);

  // A lista é longa e a barra saía da tela junto com o topo: a pessoa digitava
  // e o resultado ficava acima do que estava sendo visto, parecendo que a busca
  // não achou nada. Ao pesquisar, a barra volta para o alto e o resultado nasce
  // logo abaixo dela.
  const refBusca = useRef(null);
  useEffect(() => {
    if (!busca.trim() || !refBusca.current) return;
    const topo = refBusca.current.getBoundingClientRect().top;
    // Só rola se estiver mesmo fora de posição — senão brigaria com o dedo a
    // cada tecla digitada.
    if (topo < 0 || topo > 140) refBusca.current.scrollIntoView({ block: "start" });
  }, [busca]);

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
        tipo: novoTipo,
        modoQuantidade: Number.isInteger(quantidade) ? "inteiro" : "fracionado",
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
    const proximas = itens.filter(item => {
      if (!item.validade) return false;
      const dias = (new Date(item.validade).getTime() - Date.now()) / 86400000;
      return dias >= 0 && dias <= 7;
    }).length;
    return [
      { rotulo: "Produtos", valor: itens.length, detalhe: "cadastrados no setor", cor: "#4F46E5", fundo: "#EEF2FF", icone: Boxes },
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
        // Sem tipo até a pessoa escolher. Antes o tipo era um botão só lá em
        // cima, valendo para a lista inteira: quem precisava repor uma coisa e
        // dar baixa em outra tinha que fazer duas rodadas.
        tipo: "",
        modoQuantidade: "",
      };
      return proximo;
    });
  }

  function definirTipoItem(id, novoTipo) {
    setSelecionados(atual => ({
      ...atual,
      [id]: {
        ...atual[id],
        tipo: atual[id]?.tipo === novoTipo ? "" : novoTipo,
        modoQuantidade: "",
        quantidade: 1,
      },
    }));
  }

  function definirModoQuantidade(id, modoQuantidade) {
    setSelecionados(atual => ({
      ...atual,
      [id]: {
        ...atual[id],
        modoQuantidade,
        quantidade: modoQuantidade === "fracionado" ? 0.5 : 1,
      },
    }));
  }

  // Guarda o que foi digitado, sem converter. Converter aqui impedia o campo de
  // ficar vazio enquanto a pessoa troca o número.
  function alterarQuantidade(id, quantidade) {
    setSelecionados(atual => ({
      ...atual,
      [id]: { ...atual[id], quantidade },
    }));
  }

  async function cadastrarItemDoEstoque(evento) {
    evento.preventDefault();
    const nome = novoItem.nome.trim();
    const estoqueAlvo = estoquesAtuais[0];
    if (!nome) return setToast({ tipo: "erro", msg: "Informe o nome do item." });
    if (!estoqueAlvo?.id) return setToast({ tipo: "erro", msg: "Não encontrei o estoque desta área." });
    const minimo = novoItem.minimo === "" ? null : numero(String(novoItem.minimo).replace(",", "."));
    const maximo = novoItem.maximo === "" ? null : numero(String(novoItem.maximo).replace(",", "."));
    if (minimo != null && maximo != null && maximo > 0 && maximo < minimo) {
      return setToast({ tipo: "erro", msg: "O estoque máximo não pode ser menor que o mínimo." });
    }

    setSalvandoCadastro(true);
    const unidade = novoItem.unidade || "un";
    const criado = await salvarInsumo({
      unidade_id: unidadeAtiva,
      departamento,
      nome,
      nome_original: nome,
      categoria: departamento === "embalagens" ? "Embalagens" : "Limpeza",
      unidade_medida: unidade,
      unidade_comercial: unidade === "un" ? "un" : unidade,
      tamanho_embalagem: 1,
      custo_unitario: 0,
      custo_compra: 0,
      ativo: true,
    }, { origem: `Cadastro rápido no estoque de ${tituloSetor}` });
    if (criado.error || !criado.id) {
      setSalvandoCadastro(false);
      return setToast({ tipo: "erro", msg: criado.error || "Não foi possível cadastrar o item." });
    }
    const vinculo = await vincularItemEstoque({
      unidadeId: unidadeAtiva,
      estoqueId: estoqueAlvo.id,
      insumoId: criado.id,
      minimo,
      maximo,
      custoUnitario: 0,
    });
    setSalvandoCadastro(false);
    if (vinculo.error) return setToast({ tipo: "erro", msg: vinculo.error });
    setNovoItem({ nome: "", unidade: "un", minimo: "", maximo: "" });
    setModalCadastro(false);
    await carregar(false);
    setToast({ tipo: "ok", msg: `${nome} cadastrado neste estoque.` });
  }

  function abrirNovoCiclo(produto = "") {
    setCicloForm({
      id: "",
      produto,
      chegada: paraDataHoraLocal(new Date().toISOString()),
      inicio_uso: "",
      fim_uso: "",
    });
    setModalCiclo(true);
  }

  function editarCiclo(ciclo) {
    setCicloForm({
      id: ciclo.id,
      produto: ciclo.produto || "",
      chegada: paraDataHoraLocal(ciclo.created_at),
      inicio_uso: paraDataHoraLocal(ciclo.inicio_uso),
      fim_uso: paraDataHoraLocal(ciclo.fim_uso),
    });
    setModalCiclo(true);
  }

  async function salvarCicloLimpeza(evento) {
    evento.preventDefault();
    if (!cicloForm.produto) return setToast({ tipo: "erro", msg: "Escolha o produto de limpeza." });
    if (!cicloForm.chegada) return setToast({ tipo: "erro", msg: "Informe quando o produto chegou." });
    const chegada = new Date(cicloForm.chegada).toISOString();
    const inicioUso = cicloForm.inicio_uso ? new Date(cicloForm.inicio_uso).toISOString() : null;
    const fimUso = cicloForm.fim_uso ? new Date(cicloForm.fim_uso).toISOString() : null;
    if (inicioUso && new Date(inicioUso) < new Date(chegada)) {
      return setToast({ tipo: "erro", msg: "O início do uso não pode ser anterior à chegada." });
    }
    if (fimUso && (!inicioUso || new Date(fimUso) < new Date(inicioUso))) {
      return setToast({ tipo: "erro", msg: "Informe um fim posterior ao início do uso." });
    }

    setSalvandoCiclo(true);
    const item = itens.find(produto => produto.nome === cicloForm.produto);
    const payload = {
      produto: cicloForm.produto,
      volume: item ? `${fmtQtd(item.quantidade)} ${rotuloUnidade(item.unidade, item.quantidade)}` : "",
      created_at: chegada,
      inicio_uso: inicioUso,
      fim_uso: fimUso,
    };
    const resultado = cicloForm.id
      ? await atualizarControleLimpeza(cicloForm.id, payload)
      : await inserirControleLimpeza({ unidade_id: unidadeAtiva, ...payload, diluicao: "", fornecedor_nome: "", fornecedor_cnpj: "", preco: 0 });
    setSalvandoCiclo(false);
    if (resultado.error) return setToast({ tipo: "erro", msg: `Não foi possível salvar: ${resultado.error}` });
    setModalCiclo(false);
    await carregar(false);
    setToast({ tipo: "ok", msg: `Controle de ${cicloForm.produto} salvo.` });
  }

  function removerSelecionado(id) {
    setSelecionados(atual => {
      const proximo = { ...atual };
      delete proximo[id];
      return proximo;
    });
  }

  async function confirmarLote(comandoConfirmacao = "") {
    if (!listaSelecionados.length) {
      setToast({ tipo: "erro", msg: "Escolha pelo menos um item." });
      return;
    }
    if (!responsavel) {
      setToast({ tipo: "erro", msg: "Escolha quem está fazendo a movimentação." });
      return;
    }
    // Cada item leva o próprio tipo. O tipo global só entra como reserva, para
    // o comando de voz continuar funcionando como antes.
    const comTipo = listaSelecionados.map(item => ({ ...item, tipo: item.tipo || tipo }));
    const semTipo = comTipo.find(item => !item.tipo);
    if (semTipo) {
      setToast({ tipo: "erro", msg: `Escolha depositar ou retirar em ${semTipo.nome}.` });
      return;
    }
    const semModoQuantidade = comTipo.find(item => !item.modoQuantidade);
    if (semModoQuantidade) {
      setToast({ tipo: "erro", msg: `Escolha quantidade inteira ou fracionada em ${semModoQuantidade.nome}.` });
      return;
    }
    // Zero digitado à mão: movimento de nada não vale a pena gravar, e o item
    // continua na lista para a pessoa corrigir ou tirar.
    const zerado = comTipo.find(item => numero(item.quantidade) <= 0);
    if (zerado) {
      setToast({ tipo: "erro", msg: `Informe a quantidade de ${zerado.nome} ou tire ele da lista.` });
      return;
    }
    const integralInvalido = comTipo.find(item => item.modoQuantidade === "inteiro" && !Number.isInteger(numero(item.quantidade)));
    if (integralInvalido) {
      setToast({ tipo: "erro", msg: `${integralInvalido.nome} está como quantidade inteira. Use um número completo.` });
      return;
    }
    const semSaldo = comTipo.find(item => item.tipo === "saida" && numero(item.quantidade) > numero(item.disponivel));
    if (semSaldo) {
      setToast({ tipo: "erro", msg: `${semSaldo.nome} tem apenas ${fmtQtd(semSaldo.disponivel)} ${rotuloUnidade(semSaldo.unidade, semSaldo.disponivel)} disponíveis.` });
      return;
    }

    setSalvando(true);
    // Uma chamada por tipo: o motor de estoque grava um lote de cada vez.
    const resultado = { concluidos: [], erros: [] };
    for (const grupo of ["entrada", "saida"]) {
      const doGrupo = comTipo.filter(item => item.tipo === grupo);
      if (!doGrupo.length) continue;
      const parcial = await registrarLoteMovimentosMulti({
        unidadeId: unidadeAtiva,
        tipo: grupo,
        itens: doGrupo.map(item => ({ ...item, quantidade: numero(item.quantidade) * (numero(item.fator) || 1) })),
        observacao: motivo.trim() || (grupo === "entrada" ? "Reposição rápida" : "Retirada rápida"),
        usuarioNome: responsavel.nome,
      });
      resultado.concluidos.push(...(parcial.concluidos || []));
      resultado.erros.push(...(parcial.erros || []));
    }

    await registrarAuditoria({
      unidadeId: unidadeAtiva,
      usuarioId: sessao?.user?.id || sessao?.id || null,
      usuarioNome: responsavel.nome,
      comando: comandoConfirmacao
        ? `${motivo.startsWith("Comando de voz:") ? motivo.replace(/^Comando de voz:\s*/, "") : motivo || "Movimentação preparada na tela"}; Confirmação por voz: ${comandoConfirmacao}`
        : motivo.startsWith("Comando de voz:") ? motivo.replace(/^Comando de voz:\s*/, "") : motivo,
      // A auditoria guarda o tipo item a item: numa confirmação mista, dizer só
      // "entrada" ou só "saída" esconderia metade do que aconteceu.
      intencao: { setor: departamento, itens: comTipo.map(item => ({ nome: item.nome, tipo: item.tipo, modo_quantidade: item.modoQuantidade, quantidade: item.quantidade, unidade: item.unidade })) },
      acao: tiposEscolhidos.size > 1 ? "inventory.create_mixed_batch"
        : tipoDominante === "entrada" ? "inventory.create_entry_batch" : "inventory.create_withdrawal_batch",
      modulo: "inventory",
      resultado: resultado.erros.length ? (resultado.concluidos.length ? "parcial" : "erro") : "sucesso",
      erro: resultado.erros.length ? resultado.erros.map(item => `${item.nome}: ${item.error}`).join("; ") : null,
      exigiuConfirmacao: true,
    });

    const idsConcluidos = new Set(resultado.concluidos.map(item => String(item.id)));
    setSelecionados(atual => Object.fromEntries(
      Object.entries(atual).filter(([id]) => !idsConcluidos.has(String(id)))
    ));
    await carregar(false);
    setSalvando(false);

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
      msg: `${resultado.concluidos.length} item(ns) registrado(s) para ${responsavel.nome}.`,
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
          .estoque-inicio-setores{display:grid;grid-template-columns:1fr 1fr;gap:clamp(14px,3vw,26px)}.estoque-inicio-setor{min-height:240px;border:2px solid rgba(255,255,255,.16);border-radius:30px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;font-size:28px;font-weight:950;box-shadow:0 22px 55px rgba(0,0,0,.25);transition:.15s}.estoque-inicio-setor svg{width:62px;height:62px}.estoque-inicio-setor.cozinha{background:linear-gradient(145deg,#047857,#10b981)}.estoque-inicio-setor.bar{background:linear-gradient(145deg,#1d4ed8,#3b82f6)}.estoque-inicio-setor.limpeza{background:linear-gradient(145deg,#0369a1,#0ea5e9)}.estoque-inicio-setor.embalagens{background:linear-gradient(145deg,#334155,#64748b)}.estoque-inicio-setor:active{transform:scale(.98)}.estoque-inicio-setor span{font-size:14px;font-weight:700;opacity:.88}
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
            <button className="estoque-inicio-setor limpeza" onClick={() => selecionarSetor("limpeza")}>
              <Sparkles /> Limpeza <span>Produtos de limpeza da casa</span>
            </button>
            <button className="estoque-inicio-setor embalagens" onClick={() => selecionarSetor("embalagens")}>
              <Package /> Embalagens <span>Potes, sacos e descartáveis</span>
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
          .estoque-inicio{position:fixed;inset:0;z-index:80;overflow:auto;background:linear-gradient(145deg,#07111f,#0f2841);color:#fff;padding:clamp(18px,4vw,44px);display:flex;flex-direction:column}.estoque-inicio-topo{display:flex;align-items:center;justify-content:space-between}.estoque-inicio-topo button{height:46px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.08);color:#fff;padding:0 15px;display:flex;align-items:center;gap:8px;font-weight:800}.estoque-inicio-centro{width:min(950px,100%);margin:auto;text-align:center}.estoque-inicio-centro h1{font-size:clamp(30px,5vw,54px);margin:18px 0 10px;font-weight:950}.estoque-inicio-centro p{color:#cbd5e1;font-size:clamp(15px,2vw,19px);margin:0 auto 32px}.estoque-inicio-setores{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:clamp(14px,3vw,26px)}.estoque-inicio-setor{min-height:230px;border:2px solid rgba(255,255,255,.16);border-radius:30px;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;font-size:26px;font-weight:950;box-shadow:0 22px 55px rgba(0,0,0,.25)}.estoque-inicio-setor svg{width:58px;height:58px}.estoque-inicio-setor.produtos{background:linear-gradient(145deg,#047857,#10b981)}.estoque-inicio-setor.preparos{background:linear-gradient(145deg,#b45309,#f59e0b)}.estoque-inicio-setor.embalagens{background:linear-gradient(145deg,#334155,#64748b)}.estoque-inicio-setor span{font-size:14px;font-weight:700;opacity:.9}@media(max-width:620px){.estoque-inicio-setores{grid-template-columns:1fr}.estoque-inicio-setor{min-height:170px}.estoque-inicio-centro{margin:30px auto}}
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
          {carregando ? <div className="estoque-funcionario-vazio"><RefreshCw className="animate-spin" /> Carregando equipe...</div> : equipeDoSetor.length === 0 ? (
            <div className="estoque-funcionario-vazio">Ninguém cadastrado nesta área. Ajuste o cargo em RH.</div>
          ) : (
            <div className="estoque-funcionario-grid">
              {equipeDoSetor.map(func => (
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
    <div className="estoque-rapido erp-safe-top erp-sem-selecao" style={{ "--setor": departamento === "bar" ? "#3B82F6" : "#10B981", "--acao": estiloTipo.principal, "--acao-suave": estiloTipo.suave, "--acao-borda": estiloTipo.borda }}>
      <style>{`
        .estoque-rapido{min-height:100vh;background:#DCE3EC;color:#0F172A;padding-bottom:32px}.estoque-rapido *{box-sizing:border-box}
        .estoque-rapido-topo{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #E2E8F0;box-shadow:0 3px 14px rgba(15,23,42,.06)}
        .estoque-rapido-topo-interno{max-width:1240px;margin:auto;min-height:76px;padding:12px 18px;display:flex;align-items:center;gap:14px}
        .estoque-rapido-voltar,.estoque-rapido-atualizar{width:44px;height:44px;border:1px solid #E2E8F0;border-radius:13px;background:#fff;color:#64748B;display:grid;place-items:center;cursor:pointer;flex:none}
        .estoque-rapido-titulo{flex:1;min-width:0}.estoque-rapido-titulo strong{display:block;font-size:18px}.estoque-rapido-titulo span{display:block;color:#64748B;font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .estoque-rapido-abas{display:flex;background:#F1F5F9;padding:4px;border-radius:14px;gap:4px}.estoque-rapido-abas button{height:40px;padding:0 15px;border:0;border-radius:10px;background:transparent;color:#64748B;font-weight:800;display:flex;align-items:center;gap:7px;cursor:pointer}.estoque-rapido-abas button.ativo{background:#fff;color:#0F172A;box-shadow:0 2px 8px rgba(15,23,42,.08)}
        .estoque-rapido-voz{height:44px;padding:0 14px;border:0;border-radius:13px;background:#7C3AED;color:#fff;font-weight:900;display:flex;align-items:center;gap:7px;cursor:pointer;box-shadow:0 7px 18px rgba(124,58,237,.25);white-space:nowrap}
        .estoque-rapido-conteudo{max-width:1240px;margin:auto;padding:20px 18px}.estoque-rapido-passos{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
        .estoque-rapido-kanban{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}.estoque-rapido-kpi{background:#fff;border:1px solid #E2E8F0;border-radius:18px;padding:14px;display:flex;align-items:center;gap:11px;box-shadow:0 6px 18px rgba(15,23,42,.04);min-width:0}.estoque-rapido-kpi-icone{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;flex:none}.estoque-rapido-kpi strong{display:block;font-size:20px;line-height:1.1;overflow:hidden;text-overflow:ellipsis}.estoque-rapido-kpi b{display:block;font-size:11px;color:#475569;margin-top:3px}.estoque-rapido-kpi small{display:block;font-size:10px;color:#94A3B8;margin-top:2px}
        .estoque-rapido-painel{background:#fff;border:1px solid #E2E8F0;border-radius:20px;padding:17px;box-shadow:0 8px 24px rgba(15,23,42,.04)}.estoque-rapido-painel h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#64748B;margin:0 0 12px;display:flex;align-items:center;gap:7px}
        .estoque-rapido-painel select,.estoque-rapido-painel input[type=text]{width:100%;height:52px;border:2px solid #E2E8F0;border-radius:14px;background:#F8FAFC;padding:0 14px;color:#0F172A;font-size:16px;font-weight:750;outline:none}.estoque-rapido-painel select:focus,.estoque-rapido-painel input[type=text]:focus{border-color:var(--acao)}
        .estoque-rapido-tipos{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.estoque-rapido-tipos button{height:42px;font-size:13px;border:2px solid #E2E8F0;border-radius:14px;background:#F8FAFC;font-size:15px;font-weight:900;color:#64748B;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.estoque-rapido-tipos button.entrada.ativo{border-color:#047857;background:#059669;color:#fff;box-shadow:0 4px 14px rgba(5,150,105,.35)}.estoque-rapido-tipos button.saida.ativo{border-color:#9F1239;background:#E11D48;color:#fff;box-shadow:0 4px 14px rgba(225,29,72,.35)}
        .estoque-rapido-modo-qtd{margin-top:10px;padding:10px;border:1px solid #CBD5E1;border-radius:14px;background:rgba(255,255,255,.78)}.estoque-rapido-modo-qtd p{margin:0 0 8px;color:#475569;font-size:12px;font-weight:900}.estoque-rapido-modo-opcoes{display:grid;grid-template-columns:1fr 1fr;gap:7px}.estoque-rapido-modo-opcoes button{min-height:42px;border:2px solid #CBD5E1;border-radius:11px;background:#fff;color:#475569;font-size:12px;font-weight:900}.estoque-rapido-modo-opcoes button.ativo{border-color:var(--acao);background:var(--acao);color:#fff}
        /* Lançar de onde a escolha foi feita: quem marcou o tipo e a quantidade
           no produto não deveria ter de caçar o botão no rodapé da lista. */
        .estoque-rapido-lancar{margin-top:10px;width:100%;height:52px;border:none;border-radius:14px;font-size:16px;font-weight:900;color:#fff;display:flex;align-items:center;justify-content:center;gap:9px;cursor:pointer}
        .estoque-rapido-lancar.entrada{background:#059669;box-shadow:0 6px 18px rgba(5,150,105,.32)}
        .estoque-rapido-lancar.saida{background:#E11D48;box-shadow:0 6px 18px rgba(225,29,72,.32)}
        .estoque-rapido-lancar:disabled{opacity:.5;cursor:default;box-shadow:none}
        .estoque-rapido-busca{position:sticky;top:0;z-index:30;margin:18px 0 14px;padding:8px 0;background:#DCE3EC}.estoque-rapido-busca svg{position:absolute;left:16px;top:17px;color:#64748B}.estoque-rapido-busca input{width:100%;height:54px;padding:0 50px;border:2px solid #CBD5E1;border-radius:16px;background:#EEF2F7;font-size:16px;outline:none}.estoque-rapido-busca input:focus{border-color:var(--acao);background:#fff}.estoque-rapido-busca button{position:absolute;right:12px;top:11px;width:32px;height:32px;border:0;background:#E2E8F0;color:#64748B;border-radius:9px;display:grid;place-items:center}
        .estoque-rapido-contador{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.estoque-rapido-contador h2{font-size:18px;margin:0}.estoque-rapido-contador span{font-size:13px;font-weight:800;color:#64748B}
        .estoque-rapido-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.estoque-rapido-item{min-height:148px;background:#fff;border:2px solid #E2E8F0;border-radius:18px;padding:15px;text-align:left;cursor:pointer;transition:.15s;position:relative}.estoque-rapido-item:hover{border-color:#CBD5E1;transform:translateY(-1px)}.estoque-rapido-item.selecionado{border-color:var(--acao);background:var(--acao-suave);box-shadow:0 0 0 3px var(--acao-borda)}
        .estoque-rapido-item-topo{display:flex;gap:10px;justify-content:space-between}.estoque-rapido-item-nome{font-size:16px;font-weight:900;line-height:1.25}.estoque-rapido-check{width:26px;height:26px;border:2px solid #CBD5E1;border-radius:8px;display:grid;place-items:center;color:transparent;flex:none}.selecionado .estoque-rapido-check{background:var(--acao);border-color:var(--acao);color:#fff}.estoque-rapido-saldo{margin:14px 0 0;color:#64748B;font-size:12px;font-weight:700}.estoque-rapido-saldo strong{display:block;color:#0F172A;font-size:22px;margin-top:2px}.estoque-rapido-item-icone{width:34px;height:34px;border-radius:11px;background:var(--acao-suave,#F1F5F9);color:var(--acao,#475569);display:grid;place-items:center;flex:none;margin-right:9px}.estoque-rapido-volume{font-size:12px;font-weight:800;color:#64748B;margin-top:2px}.estoque-rapido-minimo{font-size:11px;color:#94A3B8;margin-top:4px}
        .estoque-rapido-qtd{display:grid;grid-template-columns:42px 1fr 42px;gap:7px;margin-top:13px}.estoque-rapido-qtd button{height:42px;border:0;border-radius:11px;background:#fff;color:var(--acao);display:grid;place-items:center;cursor:pointer;box-shadow:0 1px 5px rgba(15,23,42,.12)}.estoque-rapido-qtd label{height:42px;background:#fff;border-radius:11px;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 6px}.estoque-rapido-qtd input{width:55px;border:0;outline:0;text-align:right;font-size:17px;font-weight:900;background:transparent}.estoque-rapido-qtd span{font-size:11px;color:#64748B;font-weight:800;white-space:nowrap}
        .estoque-rapido-loading,.estoque-rapido-sem-itens{padding:70px 20px;text-align:center;color:#64748B;font-weight:800}.estoque-rapido-historico{display:flex;flex-direction:column;gap:9px}.estoque-rapido-hist-item{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:14px 16px;display:grid;grid-template-columns:46px 1fr auto;gap:12px;align-items:center}.estoque-rapido-hist-icone{width:46px;height:46px;border-radius:13px;display:grid;place-items:center}.estoque-rapido-hist-item strong{display:block}.estoque-rapido-hist-item p{margin:4px 0 0;color:#64748B;font-size:12px}.estoque-rapido-hist-item time{font-size:12px;color:#64748B;text-align:right}.estoque-rapido-filtros{display:flex;gap:8px;margin-bottom:15px}.estoque-rapido-filtros button{height:38px;padding:0 14px;border:1px solid #CBD5E1;border-radius:11px;background:#fff;color:#64748B;font-weight:800}.estoque-rapido-filtros button.ativo{background:#0F172A;color:#fff;border-color:#0F172A}
        .estoque-ciclos-topo{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.estoque-ciclos-topo h2{margin:0;font-size:20px}.estoque-ciclos-topo p{margin:3px 0 0;color:#64748B;font-size:12px}.estoque-ciclos-novo{height:44px;padding:0 15px;border:0;border-radius:13px;background:#0284C7;color:#fff;font-weight:900;display:flex;align-items:center;gap:7px}.estoque-ciclos-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.estoque-ciclo-card{background:#fff;border:1px solid #CBD5E1;border-radius:18px;padding:16px;box-shadow:0 6px 18px rgba(15,23,42,.05)}.estoque-ciclo-card-topo{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.estoque-ciclo-card h3{margin:0;font-size:17px}.estoque-ciclo-status{border-radius:999px;padding:5px 9px;font-size:10px;font-weight:950;text-transform:uppercase;white-space:nowrap}.estoque-ciclo-status.chegou{background:#E0F2FE;color:#0369A1}.estoque-ciclo-status.uso{background:#DCFCE7;color:#047857}.estoque-ciclo-status.final{background:#E2E8F0;color:#475569}.estoque-ciclo-datas{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.estoque-ciclo-data{background:#F1F5F9;border-radius:12px;padding:9px}.estoque-ciclo-data span{display:block;color:#64748B;font-size:10px;font-weight:850;text-transform:uppercase}.estoque-ciclo-data strong{display:block;margin-top:4px;font-size:12px}.estoque-ciclo-editar{width:100%;height:40px;margin-top:12px;border:1px solid #CBD5E1;border-radius:11px;background:#fff;color:#334155;font-weight:900}.estoque-ciclo-form-datas{display:grid;grid-template-columns:1fr;gap:12px}.estoque-ciclo-form-datas input,.estoque-ciclo-form-datas select{width:100%;height:48px;border:2px solid #E2E8F0;border-radius:13px;background:#F8FAFC;padding:0 12px;font-size:14px;color:#0F172A}.estoque-ciclo-form-datas label{display:flex;flex-direction:column;gap:6px;color:#475569;font-size:12px;font-weight:900}
        .estoque-rapido-toast{position:fixed;z-index:100;left:50%;bottom:100px;transform:translateX(-50%);max-width:min(620px,calc(100vw - 28px));padding:14px 15px;border-radius:14px;color:#fff;display:flex;align-items:center;gap:9px;box-shadow:0 14px 34px rgba(15,23,42,.25);font-weight:800}.estoque-rapido-toast span{flex:1}.estoque-rapido-toast button{border:0;background:transparent;color:#fff;display:grid;place-items:center}
        .estoque-voz-modal{position:fixed;inset:0;z-index:280;background:rgba(15,23,42,.66);padding:16px;display:grid;place-items:center;backdrop-filter:blur(5px)}.estoque-voz-card{position:relative;width:min(590px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:26px;padding:24px;box-shadow:0 30px 80px rgba(15,23,42,.4)}.estoque-voz-fechar{position:absolute;right:14px;top:14px;width:42px;height:42px;border:0;border-radius:13px;background:#F1F5F9;color:#64748B;display:grid;place-items:center}.estoque-voz-topo{padding-right:46px}.estoque-voz-topo span{width:58px;height:58px;border-radius:18px;background:#EDE9FE;color:#7C3AED;display:grid;place-items:center;margin-bottom:12px}.estoque-voz-topo h2{margin:0;font-size:24px}.estoque-voz-topo p{margin:6px 0 0;color:#64748B;font-size:14px;font-weight:700}.estoque-voz-transcricao{min-height:55px;margin-top:17px;border:2px solid #DDD6FE;border-radius:15px;background:#FAF5FF;padding:13px;color:#5B21B6;font-weight:850}.estoque-voz-resposta{margin-top:10px;border-radius:15px;background:#F1F5F9;padding:13px;color:#334155;font-size:14px;font-weight:750;line-height:1.45}.estoque-voz-exemplos{margin-top:15px}.estoque-voz-exemplos strong{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#64748B;margin-bottom:7px}.estoque-voz-exemplos button{width:100%;min-height:40px;margin-top:6px;border:1px solid #E2E8F0;border-radius:11px;background:#fff;padding:8px 11px;text-align:left;color:#475569;font-weight:750}.estoque-voz-ouvir{width:100%;min-height:56px;margin-top:17px;border:0;border-radius:16px;background:#7C3AED;color:#fff;font-size:16px;font-weight:950;display:flex;align-items:center;justify-content:center;gap:9px}.estoque-voz-ouvir.ouvindo{background:#E11D48;animation:estoquePulso 1.1s infinite}@keyframes estoquePulso{50%{transform:scale(.985);opacity:.88}}
        .estoque-cadastro-form{display:grid;gap:13px;margin-top:18px}.estoque-cadastro-form label{display:grid;gap:6px;color:#475569;font-size:12px;font-weight:900}.estoque-cadastro-form input,.estoque-cadastro-form select{width:100%;height:48px;border:2px solid #E2E8F0;border-radius:13px;background:#fff;padding:0 13px;color:#0F172A;font-size:16px;font-weight:750;outline:none}.estoque-cadastro-form input:focus,.estoque-cadastro-form select:focus{border-color:var(--setor)}.estoque-cadastro-limites{display:grid;grid-template-columns:1fr 1fr;gap:10px}.estoque-cadastro-salvar{height:52px;border:0;border-radius:14px;background:var(--setor);color:#fff;font-size:15px;font-weight:950;display:flex;align-items:center;justify-content:center;gap:8px}.estoque-cadastro-salvar:disabled{opacity:.55}.estoque-cadastro-vazio{margin-top:18px;height:48px;padding:0 18px;border:0;border-radius:13px;background:#0F172A;color:#fff;font-weight:900;display:inline-flex;align-items:center;gap:8px}
        .estoque-rapido-vazio{min-height:100vh;background:#F8FAFC;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;color:#64748B}.estoque-rapido-vazio h1{color:#0F172A;margin:15px 0 6px}.estoque-rapido-vazio p{margin:0 0 20px}.estoque-rapido-vazio button{height:48px;padding:0 18px;border:0;border-radius:13px;background:#0F172A;color:#fff;font-weight:800;display:flex;align-items:center;gap:8px}
        @media(max-width:1000px){.estoque-rapido-kanban{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:850px){.estoque-rapido-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:620px){
          .estoque-rapido{padding-bottom:84px}
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
          .estoque-rapido-hist-item{grid-template-columns:42px 1fr}.estoque-rapido-hist-item time{grid-column:2;text-align:left}.estoque-rapido-toast{bottom:84px}.estoque-ciclos-grid{grid-template-columns:1fr}.estoque-ciclo-datas{grid-template-columns:1fr}.estoque-ciclos-topo{align-items:flex-start}.estoque-ciclos-novo{flex:none;font-size:0;padding:0;width:44px;justify-content:center}
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
            {tipoEstoque === "preparos" && <button onClick={() => router.push(`/dashboard/operacao/producao?dept=${departamento}`)} aria-label="Abrir produção de pré-preparos" title="Produção"><ChefHat size={17} /> <span className="estoque-rapido-abas-label">Produção</span></button>}
            {departamento === "limpeza" && <button className={aba === "ciclos" ? "ativo" : ""} onClick={() => setAba("ciclos")} aria-label="Controlar uso dos produtos" title="Chegada, início e fim"><CalendarDays size={17} /> <span className="estoque-rapido-abas-label">Uso dos produtos</span></button>}
            {AREAS_DIRETAS.includes(departamento) && <button onClick={() => setModalCadastro(true)} aria-label="Cadastrar item neste estoque" title="Cadastrar item"><Plus size={17} /> <span className="estoque-rapido-abas-label">Cadastrar</span></button>}
            <button onClick={() => router.push(`/dashboard/operacao/estoque?gestao=1&dept=${departamento}`)} aria-label="Configurar estoque mínimo e máximo" title="Mínimo e máximo"><Settings2 size={17} /> <span className="estoque-rapido-abas-label">Mín. e máx.</span></button>
          </nav>
          <button className="estoque-rapido-atualizar" onClick={() => carregar()} aria-label="Atualizar"><RefreshCw size={18} /></button>
        </div>
      </header>

      {aba === "operacao" ? (
        <main className="estoque-rapido-conteudo">
          {tipoEstoque === "preparos" && (
            <section className="mb-4 rounded-[20px] border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="m-0 text-[11px] font-black uppercase tracking-widest text-amber-700">Central de produção</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">Produzir, planejar e consultar o que já foi feito</h2>
                  <p className="mt-1 text-sm font-bold text-slate-600">A produção registrada entra automaticamente neste estoque de pré-preparos.</p>
                </div>
                <button type="button" onClick={() => router.push(`/dashboard/operacao/producao?dept=${departamento}`)} className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 font-black text-white shadow-lg shadow-amber-600/20">
                  <ChefHat size={19} /> Abrir produção
                </button>
              </div>
            </section>
          )}
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

          <div className="estoque-rapido-busca" ref={refBusca}>
            <Search size={20} />
            {/* Sem autoFocus: no tablet ele abria o teclado por cima da lista
                assim que a tela carregava, e quem entra para conferir saldo
                tinha de fechar o teclado antes de ver qualquer item. */}
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder={`Buscar item do ${tituloAtual.toLowerCase()}...`} />
            {busca && <button onClick={() => setBusca("")}><X size={17} /></button>}
          </div>

          <div className="estoque-rapido-contador">
            <h2>{tipoEstoque === "preparos" ? "Pré-preparos produzidos e disponíveis" : "Escolha um ou vários itens"}</h2>
            <span>{listaSelecionados.length} selecionado(s)</span>
          </div>

          {carregando ? <div className="estoque-rapido-loading">Carregando itens...</div> : visiveis.length === 0 ? (
            <div className="estoque-rapido-sem-itens">Nenhum item encontrado neste estoque.{AREAS_DIRETAS.includes(departamento) && <><br/><button type="button" className="estoque-cadastro-vazio" onClick={() => setModalCadastro(true)}><Plus size={18}/> Cadastrar primeiro item</button></>}</div>
          ) : (
            <div className="estoque-rapido-grid">
              {visiveis.map(item => {
                const selecionado = selecionados[item.id];
                return (
                  <article key={item.id} className={`estoque-rapido-item ${selecionado ? "selecionado" : ""}`} onClick={() => alternarItem(item)}>
                    <div className="estoque-rapido-item-topo">
                      {/* Ícone do produto: numa grade de trinta itens de nome
                          parecido, a forma é o que a pessoa acha primeiro —
                          "a garrafa" antes de ler "Cachaça de jambu G". */}
                      {(() => {
                        const Icone = ICONES_PRODUTO[item.icone] || Package;
                        return <span className="estoque-rapido-item-icone"><Icone size={19} /></span>;
                      })()}
                      <div className="estoque-rapido-item-nome">{item.nome}</div>
                      <div className="estoque-rapido-check"><Check size={17} /></div>
                    </div>
                    {item.volumeEmbalagem && <div className="estoque-rapido-volume">{rotuloUnidade(item.unidade, 1)} de {item.volumeEmbalagem}</div>}
                    <div className="estoque-rapido-saldo">Disponível<strong>{fmtQtd(item.quantidade)} {rotuloUnidade(item.unidade, item.quantidade)}</strong></div>
                    {item.local && <div className="estoque-rapido-minimo">Local: {item.local}</div>}
                    {(item.minimo != null || item.maximo != null) && <div className="estoque-rapido-minimo">
                      Mín.: {item.minimo == null ? "—" : `${fmtQtd(item.minimo)} ${rotuloUnidade(item.unidade, item.minimo)}`} · Máx.: {item.maximo == null ? "—" : `${fmtQtd(item.maximo)} ${rotuloUnidade(item.unidade, item.maximo)}`}
                    </div>}
                    {selecionado && (
                      <>
                        {/* Depositar ou retirar por item: a escolha vive junto
                            do produto, então dá para repor um e dar baixa em
                            outro na mesma confirmação. */}
                        <div className="estoque-rapido-tipos" onClick={e => e.stopPropagation()}>
                          <button type="button" className={`entrada ${selecionado.tipo === "entrada" ? "ativo" : ""}`}
                            onClick={() => definirTipoItem(item.id, "entrada")}>
                            <PackagePlus size={17} /> {tipoEstoque === "preparos" ? "Lançar produção" : "Depositar"}
                          </button>
                          <button type="button" className={`saida ${selecionado.tipo === "saida" ? "ativo" : ""}`}
                            onClick={() => definirTipoItem(item.id, "saida")}>
                            <PackageMinus size={17} /> Retirar
                          </button>
                        </div>
                        {selecionado.tipo && (
                          <div className="estoque-rapido-modo-qtd" onClick={e => e.stopPropagation()}>
                            <p>A quantidade será:</p>
                            <div className="estoque-rapido-modo-opcoes">
                              <button type="button" className={selecionado.modoQuantidade === "inteiro" ? "ativo" : ""} onClick={() => definirModoQuantidade(item.id, "inteiro")}>Quantidade inteira</button>
                              <button type="button" className={selecionado.modoQuantidade === "fracionado" ? "ativo" : ""} onClick={() => definirModoQuantidade(item.id, "fracionado")}>Fracionado</button>
                            </div>
                          </div>
                        )}
                        {selecionado.tipo && selecionado.modoQuantidade && (
                          <>
                            <ControleQuantidade valor={selecionado.quantidade} unidade={item.unidade} modo={selecionado.modoQuantidade}
                              onChange={valor => alterarQuantidade(item.id, valor)}
                              onRemover={() => removerSelecionado(item.id)} />
                            <button type="button"
                              className={`estoque-rapido-lancar ${selecionado.tipo}`}
                              onClick={e => { e.stopPropagation(); confirmarLote(); }}
                              disabled={salvando || faltaEscolherTipo || faltaEscolherModoQuantidade}>
                              {salvando ? <RefreshCw className="animate-spin" size={19} /> : <Check size={19} />}
                              {salvando ? "Registrando..." : `Fazer lançamento${listaSelecionados.length > 1 ? ` (${listaSelecionados.length} itens)` : ""}`}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </main>
      ) : aba === "historico" ? (
        <main className="estoque-rapido-conteudo">
          <div className="estoque-rapido-filtros">
            {[{ id: "todos", label: "Todos" }, { id: "entrada", label: tipoEstoque === "preparos" ? "Produzidos" : "Entradas" }, { id: "saida", label: tipoEstoque === "preparos" ? "Consumidos" : "Retiradas" }].map(filtro => (
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
      ) : (
        <main className="estoque-rapido-conteudo">
          <div className="estoque-ciclos-topo">
            <div><h2>Controle dos produtos de limpeza</h2><p>Registre quando chegou, quando começou a ser usado e quando terminou.</p></div>
            <button type="button" className="estoque-ciclos-novo" onClick={() => abrirNovoCiclo()}><Plus size={18}/> Registrar chegada</button>
          </div>
          {ciclosLimpeza.length === 0 ? (
            <div className="estoque-rapido-sem-itens">Nenhum ciclo registrado.<br/>Toque em <b>Registrar chegada</b> para começar.</div>
          ) : (
            <div className="estoque-ciclos-grid">
              {ciclosLimpeza.map(ciclo => {
                const status = ciclo.fim_uso ? "final" : ciclo.inicio_uso ? "uso" : "chegou";
                return (
                  <article className="estoque-ciclo-card" key={ciclo.id}>
                    <div className="estoque-ciclo-card-topo">
                      <div><h3>{ciclo.produto}</h3>{ciclo.volume && <div className="estoque-rapido-minimo">{ciclo.volume}</div>}</div>
                      <span className={`estoque-ciclo-status ${status}`}>{status === "final" ? "Finalizado" : status === "uso" ? "Em uso" : "Aguardando uso"}</span>
                    </div>
                    <div className="estoque-ciclo-datas">
                      <div className="estoque-ciclo-data"><span>Chegada</span><strong>{ciclo.created_at ? fmtData(ciclo.created_at) : "—"}</strong></div>
                      <div className="estoque-ciclo-data"><span>Início do uso</span><strong>{ciclo.inicio_uso ? fmtData(ciclo.inicio_uso) : "Não iniciado"}</strong></div>
                      <div className="estoque-ciclo-data"><span>Fim do uso</span><strong>{ciclo.fim_uso ? fmtData(ciclo.fim_uso) : "Em aberto"}</strong></div>
                    </div>
                    <button type="button" className="estoque-ciclo-editar" onClick={() => editarCiclo(ciclo)}>{ciclo.fim_uso ? "Ver ou corrigir datas" : ciclo.inicio_uso ? "Registrar fim do uso" : "Registrar início do uso"}</button>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {modalCiclo && departamento === "limpeza" && (
        <div className="estoque-voz-modal" role="dialog" aria-modal="true" aria-label="Controle de uso do produto de limpeza" onClick={() => setModalCiclo(false)}>
          <div className="estoque-voz-card" onClick={evento => evento.stopPropagation()}>
            <button className="estoque-voz-fechar" onClick={() => setModalCiclo(false)} aria-label="Fechar controle"><X size={20}/></button>
            <div className="estoque-voz-topo">
              <span><CalendarDays size={28}/></span>
              <h2>{cicloForm.id ? "Atualizar ciclo" : "Registrar chegada"}</h2>
              <p>Preencha agora o que já aconteceu. O início e o fim podem ser completados depois.</p>
            </div>
            <form className="estoque-cadastro-form" onSubmit={salvarCicloLimpeza}>
              <div className="estoque-ciclo-form-datas">
                <label>Produto de limpeza
                  <select required value={cicloForm.produto} onChange={e => setCicloForm(atual => ({ ...atual, produto: e.target.value }))} disabled={!!cicloForm.id}>
                    <option value="">Escolha o produto</option>
                    {itens.map(item => <option key={item.id} value={item.nome}>{item.nome}</option>)}
                  </select>
                </label>
                <label>Chegada do produto
                  <input required type="datetime-local" value={cicloForm.chegada} onChange={e => setCicloForm(atual => ({ ...atual, chegada: e.target.value }))}/>
                </label>
                <label>Início do uso
                  <input type="datetime-local" value={cicloForm.inicio_uso} onChange={e => setCicloForm(atual => ({ ...atual, inicio_uso: e.target.value, fim_uso: e.target.value ? atual.fim_uso : "" }))}/>
                </label>
                <label>Fim do uso
                  <input type="datetime-local" value={cicloForm.fim_uso} disabled={!cicloForm.inicio_uso} onChange={e => setCicloForm(atual => ({ ...atual, fim_uso: e.target.value }))}/>
                </label>
              </div>
              <button className="estoque-cadastro-salvar" disabled={salvandoCiclo || !cicloForm.produto || !cicloForm.chegada}>
                {salvandoCiclo ? <RefreshCw className="animate-spin" size={18}/> : <Check size={18}/>} {salvandoCiclo ? "Salvando..." : "Salvar controle"}
              </button>
            </form>
          </div>
        </div>
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

      {modalCadastro && (
        <div className="estoque-voz-modal" role="dialog" aria-modal="true" aria-label={`Cadastrar item de ${tituloSetor}`} onClick={() => setModalCadastro(false)}>
          <div className="estoque-voz-card" onClick={evento => evento.stopPropagation()}>
            <button className="estoque-voz-fechar" onClick={() => setModalCadastro(false)} aria-label="Fechar cadastro"><X size={20}/></button>
            <div className="estoque-voz-topo">
              <span><PackagePlus size={28}/></span>
              <h2>Cadastrar item</h2>
              <p>O item entrará diretamente no estoque de {tituloSetor}.</p>
            </div>
            <form className="estoque-cadastro-form" onSubmit={cadastrarItemDoEstoque}>
              <label>Nome do item<input autoFocus required value={novoItem.nome} onChange={e => setNovoItem(atual => ({ ...atual, nome: e.target.value }))} placeholder={departamento === "embalagens" ? "Ex.: Pote de 500 ml" : "Ex.: Detergente"}/></label>
              <label>Unidade de controle<select value={novoItem.unidade} onChange={e => setNovoItem(atual => ({ ...atual, unidade: e.target.value }))}>{["un", "pct", "caixa", "L", "ml", "kg", "g"].map(unidade => <option key={unidade} value={unidade}>{unidade}</option>)}</select></label>
              <div className="estoque-cadastro-limites">
                <label>Estoque mínimo<input type="number" inputMode="decimal" min="0" step="any" value={novoItem.minimo} onChange={e => setNovoItem(atual => ({ ...atual, minimo: e.target.value }))} placeholder="Opcional"/></label>
                <label>Estoque máximo<input type="number" inputMode="decimal" min="0" step="any" value={novoItem.maximo} onChange={e => setNovoItem(atual => ({ ...atual, maximo: e.target.value }))} placeholder="Opcional"/></label>
              </div>
              <button className="estoque-cadastro-salvar" disabled={salvandoCadastro || !novoItem.nome.trim()}>{salvandoCadastro ? <RefreshCw className="animate-spin" size={18}/> : <Plus size={18}/>} {salvandoCadastro ? "Cadastrando..." : "Cadastrar no estoque"}</button>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
