"use client";

// PÁGINA DA FICHA — uma receita, com o que não cabe no cartão da listagem:
// versões, histórico de custos, modo cozinha, duplicar, etiqueta e inativar.
//
// A ficha em si é a MESMA da listagem: a tela desenha com FichaDocumento, o PDF
// sai de montarDocumentoFichas e a edição abre o EditorFicha — os três
// decididos pelo tipo (prato ou pré-preparo) em lib/ficha-modelo.mjs. Esta
// página não tem formulário próprio, para não existirem dois lugares gravando
// a mesma ficha de jeitos diferentes.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, ChefHat, Copy, Edit3, FileDown, GitBranch, History, Info, Loader2,
  Percent, Power, Printer, QrCode, Sparkles, X,
} from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { fetchFichas, fetchInsumos } from "../../../../lib/operacao";
import { fetchProdutos, salvarProduto } from "../../../../lib/vendas";
import { fetchEmbalagens } from "../../../../lib/embalagens";
import { fetchCategoriasFichas, fetchParams, PARAMS_PADRAO } from "../../../../lib/parametros";
import {
  fetchFichaCompleta, salvarCamposFicha, garantirCodigoFicha, criarVersaoFicha, fetchVersoes,
  compararVersoes, duplicarFicha,
} from "../../../../lib/ficha-tecnica";
import { fetchHistoricoCustoFicha, registrarCustoFicha } from "../../../../lib/ficha-custos";
import { baixarPdfDeHtml } from "../../../../lib/pdf";
import { logoSeldeestrelaSVG } from "../../../../lib/marca";
import {
  TIPOS_FICHA, tipoFichaDe, estiloDoTipo, dadosDaFicha, podeVerCustosFicha, categoriasDoTipo,
  comCustoDeEmbalagens, custoPorPorcaoDaFicha, textoDeInstrucoes, ingredientesDaFicha, linhasDeArmazenamento, textoRendimento,
  textoRendimentoPrato,
  validadePrincipal, STATUS_FICHA,
} from "../../../../lib/ficha-modelo.mjs";
import { montarDocumentoFichas, nomeDoArquivo } from "../../../../lib/ficha-documento.mjs";
import { fichasQueUsam, precoSugerido, parseNumero } from "../../../../lib/ficha-calculos.mjs";
import { fmtBRL, fmtData } from "../../../../components/ui";
import EditorFicha, { ICONE_DO_TIPO } from "../componentes/EditorFicha";
import { FichaDocumento } from "../componentes/VisualizacaoFicha";
import PainelCustosInternos from "../componentes/PainelCustosInternos";
import ModoCozinha from "./ModoCozinha";
import AssistenteReceita from "./AssistenteReceita";

const CMV_ATALHOS = [25, 30, 35, 40];
const MARGEM_PDF_MM = 12;

export default function FichaTecnicaPage() {
  const router = useRouter();
  const params = useParams();
  const fichaId = params?.id;
  const { unidadeAtiva, unidadeInfo, sessao } = useERP();

  const [ficha, setFicha] = useState(null);
  const [complementos, setComplementos] = useState(null);
  const [todasFichas, setTodasFichas] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [embalagens, setEmbalagens] = useState([]);
  const [categoriasConfig, setCategoriasConfig] = useState({});
  const [paramsSistema, setParamsSistema] = useState(PARAMS_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [editorAberto, setEditorAberto] = useState(false);
  const [modoCozinha, setModoCozinha] = useState(false);
  const [modalVersoes, setModalVersoes] = useState(false);
  const [versoes, setVersoes] = useState([]);
  const [comparando, setComparando] = useState(null); // { a, b }
  const [criandoVersao, setCriandoVersao] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [histSemTabela, setHistSemTabela] = useState(false);
  const [registrandoCusto, setRegistrandoCusto] = useState(false);
  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  const [cmvSimulado, setCmvSimulado] = useState("");

  // ── Carga ────────────────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!fichaId) return;
    setCarregando(true);
    setErro("");

    const { data, error, migracaoPendente } = await fetchFichaCompleta(fichaId);
    if (error || !data) {
      setErro(error || "Ficha não encontrada.");
      setCarregando(false);
      return;
    }
    const unidade = data.unidade_id || unidadeAtiva;
    const dept = data.departamento;

    // As demais fichas resolvem o custo dos pré-preparos em cascata; insumos,
    // embalagens e categorias servem ao editor.
    const [lista, resProdutos, resEmbalagensEstoque, resInsumos, resEmbalagens, resCategorias, resParams] = await Promise.all([
      fetchFichas(unidade, dept),
      fetchProdutos(unidade),
      fetchEmbalagens(unidade, dept),
      fetchInsumos(unidade, dept, { excluirPrePreparos: true }),
      fetchInsumos(unidade, "embalagens"),
      fetchCategoriasFichas(unidade),
      fetchParams(unidade),
    ]);
    const produtosCarregados = resProdutos.data || [];
    // Mesma conta da listagem: o custo da embalagem do cardápio entra no CMV.
    const fichasComCusto = comCustoDeEmbalagens(lista.data || [], produtosCarregados, resEmbalagensEstoque.data || []);
    setTodasFichas(fichasComCusto);
    setProdutos(produtosCarregados);
    setInsumos(resInsumos.data || []);
    setEmbalagens(resEmbalagens.data || []);
    setCategoriasConfig(resCategorias.data || {});
    setParamsSistema({ ...PARAMS_PADRAO, ...(resParams.data || {}) });

    // Código FT: se ainda não tem, gera agora.
    let codigo = data.codigo;
    if (!codigo) {
      const r = await garantirCodigoFicha(unidade, data.id, data.codigo);
      if (r.codigo) codigo = r.codigo;
    }
    const daLista = fichasComCusto.find(f => f.id === data.id);
    setFicha({ ...data, codigo, custo_embalagens_total: daLista?.custo_embalagens_total || 0 });
    setComplementos({
      etapas: data.etapas || [], equipamentos: data.equipamentos || [], alergenicos: data.alergenicos || [],
      armazenamento: data.armazenamento || null, montagem: data.montagem_passos || [],
    });

    const hist = await fetchHistoricoCustoFicha(unidade, data.id);
    setHistorico(hist.data || []);
    setHistSemTabela(hist.error === "sem_tabela");

    if (migracaoPendente && tipoFichaDe(data) === "pre_preparo") {
      setAviso("Armazenamento, equipamentos e alergênicos só aparecem depois da migração db/migracao_ficha_tecnica_completa.sql no Supabase.");
    }
    setCarregando(false);
  }, [fichaId, unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  const tipo = tipoFichaDe(ficha) === "pre_preparo" ? "pre_preparo" : "prato";
  const cfg = TIPOS_FICHA[tipo];
  const IconeTipo = ICONE_DO_TIPO[tipo];
  const podeVerCustos = podeVerCustosFicha(sessao, ficha?.departamento);

  const dados = useMemo(
    () => (ficha ? dadosDaFicha(ficha, { todasFichas, complementos, mostrarCustos: podeVerCustos }) : null),
    [ficha, todasFichas, complementos, podeVerCustos],
  );
  const usadoPor = useMemo(() => (tipo === "pre_preparo" && ficha ? fichasQueUsam(ficha.id, todasFichas) : []), [tipo, ficha, todasFichas]);

  // Números internos (CMV). A ficha de prato não mostra, mas o sistema calcula.
  const produto = useMemo(() => (ficha ? produtos.find(p => p.ficha_id === ficha.id)
    || produtos.find(p => String(p.nome_produto || "").trim().toLowerCase() === String(ficha.nome_receita || "").trim().toLowerCase()) : null), [ficha, produtos]);
  const preco = Number(produto?.preco_venda) > 0 ? Number(produto.preco_venda) : parseNumero(ficha?.preco_venda);
  const { custoTotal, custoPorcao } = useMemo(
    () => (ficha ? custoPorPorcaoDaFicha(ficha, todasFichas) : { custoTotal: 0, custoPorcao: 0 }),
    [ficha, todasFichas],
  );
  const precoAlvo = useMemo(() => {
    const alvo = parseNumero(cmvSimulado);
    return alvo > 0 ? precoSugerido(custoPorcao, alvo) : 0;
  }, [cmvSimulado, custoPorcao]);

  const voltarParaLista = () => {
    router.push(`/dashboard/operacao/fichas?dept=${ficha?.departamento === "bar" ? "bar" : "cozinha"}${tipo === "pre_preparo" ? "&tipo=pre_preparo" : ""}`);
  };

  // ── Impressão e PDF: o mesmo documento da listagem ──────────────────────
  const montarDocumento = () => montarDocumentoFichas([ficha], {
    todasFichas,
    complementos: { [ficha.id]: complementos || {} },
    mostrarCustos: podeVerCustos,
    logoHtml: logoSeldeestrelaSVG(34),
    nomeUnidade: unidadeInfo?.nome || "",
  });

  const imprimir = () => {
    const janela = window.open("", "_blank");
    if (!janela) { setErro("O navegador bloqueou a janela de impressão. Libere os pop-ups para este site."); return; }
    janela.document.write(montarDocumento());
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 400);
  };

  const gerarPdf = () => baixarPdfDeHtml(montarDocumento(), nomeDoArquivo([ficha]), { margemMm: MARGEM_PDF_MM });

  // ── Versões ──────────────────────────────────────────────────────────────
  const abrirVersoes = async () => {
    setModalVersoes(true);
    setComparando(null);
    const { data } = await fetchVersoes(ficha.id);
    setVersoes(data || []);
  };

  // O retrato guarda o que a ficha era neste momento, no modelo do tipo, para
  // dar para comparar depois. Fica em fichas_versoes: nada é sobrescrito.
  const montarSnapshot = () => ({
    tipo: cfg.rotulo,
    nome_receita: ficha.nome_receita || null,
    categoria: ficha.categoria || null,
    departamento: ficha.departamento || null,
    ...(tipo === "prato" ? { rendimento: textoRendimentoPrato(ficha) || null } : {}),
    ...(tipo === "pre_preparo" ? {
      responsavel: ficha.responsavel || null,
      rendimento: textoRendimento(ficha) || null,
      tempo_preparo: ficha.tempo_preparo ?? null,
      peso_final_g: ficha.peso_final_g ?? null,
      armazenamento: linhasDeArmazenamento(complementos?.armazenamento, ficha).map(l => `${l.rotulo}: ${l.valor}`),
      equipamentos: (complementos?.equipamentos || []).map(e => e.nome).filter(Boolean),
      alergenicos: (complementos?.alergenicos || []).map(a => a.alergenico).filter(Boolean),
      alergenicos_pode_conter: ficha.alergenicos_pode_conter || null,
    } : {}),
    instrucoes: textoDeInstrucoes(ficha, complementos || {}) || null,
    ingredientes: ingredientesDaFicha(ficha, todasFichas).map(i => `${i.quantidade} ${i.nome}`),
    custo_total: +Number(custoTotal || 0).toFixed(4),
    custo_porcao: +Number(custoPorcao || 0).toFixed(4),
  });

  const novaVersao = async () => {
    const alteracao = window.prompt("O que mudou nesta versão?", "");
    if (alteracao === null) return;
    setCriandoVersao(true);
    const { error, versao } = await criarVersaoFicha({
      fichaId: ficha.id,
      unidadeId: ficha.unidade_id || unidadeAtiva,
      versaoAtual: ficha.versao || "1.0",
      snapshot: montarSnapshot(),
      alteracao,
    });
    setCriandoVersao(false);
    if (error === "sem_tabela") { setErro("O versionamento precisa da migração. Rode db/migracao_ficha_tecnica_completa.sql no Supabase."); return; }
    if (error) { setErro(error); return; }
    setAviso(`Versão ${versao} criada.`);
    carregar();
  };

  // ── Histórico de custos ──────────────────────────────────────────────────
  const registrarCustoAtual = async () => {
    setRegistrandoCusto(true);
    const r = await registrarCustoFicha({
      unidadeId: ficha.unidade_id || unidadeAtiva, fichaId: ficha.id, custoTotal, custoPorcao, origem: "manual",
    });
    setRegistrandoCusto(false);
    if (r.error === "sem_tabela") { setHistSemTabela(true); return; }
    if (r.error) { setErro(r.error); return; }
    if (r.pulado) { setAviso("O custo não mudou desde o último registro."); return; }
    const hist = await fetchHistoricoCustoFicha(ficha.unidade_id || unidadeAtiva, ficha.id);
    setHistorico(hist.data || []);
    setAviso("Custo registrado no histórico.");
  };

  // ── Duplicar, etiqueta, inativar e preço ─────────────────────────────────
  const duplicar = async () => {
    setDuplicando(true);
    const { id, error } = await duplicarFicha(ficha.id);
    setDuplicando(false);
    if (error) { setErro(error); return; }
    router.push(`/dashboard/operacao/fichas/${id}`);
  };

  // Etiqueta de validade: é do pré-preparo, que é produzido e guardado.
  const gerarEtiqueta = () => {
    const dias = validadePrincipal(complementos?.armazenamento, ficha);
    const parametros = new URLSearchParams({
      dept: ficha.departamento || "cozinha",
      produto: ficha.nome_receita || "",
      unidade: String(ficha.rendimento_unidade || "UN").toUpperCase(),
    });
    if (dias) parametros.set("dias", String(dias));
    if (complementos?.armazenamento?.forma) parametros.set("conservacao", complementos.armazenamento.forma);
    router.push(`/dashboard/operacao/etiquetas?${parametros.toString()}`);
  };

  const alternarStatus = async () => {
    const indo = (ficha.status || "ativa") === "ativa" ? "inativa" : "ativa";
    const pergunta = indo === "inativa"
      ? "Inativar esta ficha? Ela sai das listagens, mas nada é apagado e dá para reativar depois."
      : "Reativar esta ficha?";
    if (!window.confirm(pergunta)) return;
    const { error } = await salvarCamposFicha(ficha.id, { status: indo, atualizado_em: new Date().toISOString() });
    if (error) { setErro(error); return; }
    setAviso(indo === "inativa" ? "Ficha inativada." : "Ficha reativada.");
    carregar();
  };

  // O preço de venda é do Cardápio. Uma proposta do assistente vai para o
  // produto vinculado à ficha; sem produto, fica na ficha (como antes).
  const aplicarProposta = async (proposta) => {
    if (proposta?.campo !== "preco_venda") return;
    const valor = Number(proposta.valor) || 0;
    const destino = produto ? `o produto "${produto.nome_produto}" do Cardápio` : "a ficha (não há produto do Cardápio vinculado)";
    if (!window.confirm(`Gravar ${fmtBRL(valor)} como preço de venda em ${destino}?`)) return;
    const r = produto
      ? await salvarProduto({ id: produto.id, preco_venda: valor })
      : await salvarCamposFicha(ficha.id, { preco_venda: valor });
    if (r?.error) { setErro(r.error); return; }
    setAviso(`Preço de venda gravado: ${fmtBRL(valor)}.`);
    carregar();
  };

  // ── Telas de carga e erro ────────────────────────────────────────────────
  if (carregando && !ficha) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted">
        <Loader2 size={18} className="animate-spin" /> Carregando ficha…
      </div>
    );
  }
  if (erro && !ficha) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <AlertTriangle size={28} className="mx-auto text-amber-500" />
        <p className="mt-3 text-sm font-medium text-fg-soft">{erro}</p>
        <button onClick={() => router.push("/dashboard/operacao/fichas")} className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-fg">
          Voltar para as fichas
        </button>
      </div>
    );
  }

  // Modo cozinha ocupa a tela inteira: é para ser lido de longe, na bancada.
  if (modoCozinha && dados) {
    return <ModoCozinha dados={dados} onSair={() => setModoCozinha(false)} />;
  }

  const status = ficha.status || "ativa";

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 pb-28 sm:p-4" style={estiloDoTipo(cfg)}>
      <div className="flex items-center justify-between gap-2">
        <button onClick={voltarParaLista} className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-elevated">
          <ArrowLeft size={16} /> {cfg.rotuloPlural}
        </button>
        <button onClick={() => setEditorAberto(true)} className="flex items-center gap-2 rounded-xl bg-[color:var(--tipo)] px-4 py-2 text-sm font-black text-[color:var(--tipo-fg)]">
          <Edit3 size={15} /> Editar {tipo === "prato" ? "prato" : "pré-preparo"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--tipo)] px-2 py-0.5 text-2xs font-bold uppercase tracking-wider text-[color:var(--tipo-fg)]">
          <IconeTipo size={12} /> {cfg.rotulo}
        </span>
        {ficha.codigo ? <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-2xs font-bold text-white">{ficha.codigo}</span> : null}
        <span className="rounded-lg bg-elevated px-2 py-0.5 text-2xs font-semibold text-slate-600">v{ficha.versao || "1.0"}</span>
        <span className={`rounded-lg px-2 py-0.5 text-2xs font-semibold ${status === "ativa" ? "bg-accent-soft text-accent-strong" : status === "rascunho" ? "bg-amber-50 text-amber-700" : "bg-elevated text-muted"}`}>
          {STATUS_FICHA.find(s => s.valor === status)?.rotulo || "Ativa"}
        </span>
        <span className="text-2xs text-subtle">
          Criada em {fmtData(ficha.created_at)}{ficha.atualizado_em ? ` · Atualizada em ${fmtData(ficha.atualizado_em)}` : ""}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <AcaoBtn icone={ChefHat} onClick={() => setModoCozinha(true)}>Modo cozinha</AcaoBtn>
        <AcaoBtn icone={Printer} onClick={imprimir}>Imprimir</AcaoBtn>
        <AcaoBtn icone={FileDown} onClick={gerarPdf}>PDF</AcaoBtn>
        <AcaoBtn icone={GitBranch} onClick={novaVersao} carregando={criandoVersao}>Nova versão</AcaoBtn>
        <AcaoBtn icone={History} onClick={abrirVersoes}>Versões</AcaoBtn>
        <AcaoBtn icone={Copy} onClick={duplicar} carregando={duplicando}>Duplicar</AcaoBtn>
        {tipo === "pre_preparo" ? <AcaoBtn icone={QrCode} onClick={gerarEtiqueta}>Etiqueta</AcaoBtn> : null}
        <AcaoBtn icone={Power} onClick={alternarStatus}>{status === "ativa" ? "Inativar" : "Reativar"}</AcaoBtn>
        {podeVerCustos ? <AcaoBtn icone={Sparkles} onClick={() => setAssistenteAberto(true)}>Assistente de custo</AcaoBtn> : null}
      </div>

      {aviso ? (
        <div className="flex items-start justify-between gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
          <span className="flex items-start gap-2"><Info size={15} className="mt-0.5 shrink-0" /> {aviso}</span>
          <button onClick={() => setAviso("")} aria-label="Fechar aviso"><X size={14} /></button>
        </div>
      ) : null}
      {erro ? (
        <div className="flex items-start justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <span className="flex items-start gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erro}</span>
          <button onClick={() => setErro("")} aria-label="Fechar erro"><X size={14} /></button>
        </div>
      ) : null}

      {/* A ficha: igual à do PDF, no modelo do tipo. */}
      {dados ? <FichaDocumento dados={dados} /> : null}

      {/* Pré-preparo sem permissão de custo ainda precisa saber onde é usado. */}
      {tipo === "pre_preparo" && !podeVerCustos ? (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-[color:var(--tipo)]">Onde este pré-preparo é usado</h2>
          {usadoPor.length ? (
            <ul className="flex flex-wrap gap-2">
              {usadoPor.map(f => (
                <li key={f.id}><button onClick={() => router.push(`/dashboard/operacao/fichas/${f.id}`)} className="rounded-lg border border-line px-2.5 py-1 text-sm font-semibold text-fg-soft hover:text-fg">{f.nome_receita}</button></li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Nenhuma receita usa este pré-preparo ainda.</p>}
        </section>
      ) : null}

      {podeVerCustos ? (
        <section className="rounded-2xl border border-line bg-slate-50 p-4">
          <h2 className="mb-3 text-sm font-black text-fg">Custos (uso interno)</h2>
          <PainelCustosInternos ficha={ficha} fichas={todasFichas} custoPorcao={custoPorcao} preco={preco}
            historico={historico} statusHistorico={histSemTabela ? "sem_tabela" : "ok"} registrando={registrandoCusto}
            onRegistrar={registrarCustoAtual} onAbrirFicha={f => router.push(`/dashboard/operacao/fichas/${f.id}`)} />

          {tipo === "prato" ? (
            <div className="mt-4 rounded-2xl border border-line bg-card p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-fg-soft"><Percent size={14} /> Simulador de CMV</div>
              <p className="mt-0.5 text-2xs text-muted">Com que preço o prato fecha no CMV desejado. O preço de venda é definido no Cardápio.</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {CMV_ATALHOS.map(v => (
                  <button key={v} onClick={() => setCmvSimulado(String(v))}
                    className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${String(v) === String(cmvSimulado) ? "bg-slate-900 text-white" : "border border-line bg-card text-slate-600 hover:bg-elevated"}`}>
                    {v}%
                  </button>
                ))}
                <input type="number" inputMode="decimal" min="0" max="99" step="any" value={cmvSimulado} placeholder="outro %" aria-label="CMV desejado"
                  onChange={e => setCmvSimulado(e.target.value)} className="erp-input w-28" />
                {precoAlvo > 0 ? (
                  <div className="ml-auto text-right">
                    <div className="text-2xs uppercase tracking-wide text-muted">Preço sugerido</div>
                    <div className="text-lg font-bold tabular-nums text-[color:var(--tipo)]">{fmtBRL(precoAlvo)}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {assistenteAberto ? (
        <AssistenteReceita
          ficha={{ ...ficha, preco_venda: preco }}
          todasFichas={todasFichas}
          custos={{ custoTotal, custoPorcao }}
          podeVerCustos={podeVerCustos}
          onAplicar={aplicarProposta}
          onFechar={() => setAssistenteAberto(false)}
        />
      ) : null}

      {editorAberto ? (
        <EditorFicha key={ficha.id} tipo={tipo} departamento={ficha.departamento} ficha={{ ...ficha, fichas_ingredientes: ficha.fichas_ingredientes || [] }}
          produto={produto} paramsSistema={paramsSistema}
          fichas={todasFichas} insumos={insumos} embalagens={embalagens}
          categoriasDe={(departamento, t) => categoriasDoTipo({ departamento, tipo: t, config: categoriasConfig, fichas: todasFichas })}
          unidadeId={ficha.unidade_id || unidadeAtiva} sessao={sessao} podeVerCustos={podeVerCustos}
          onFechar={() => setEditorAberto(false)}
          onSalvo={({ avisos = [] }) => { setEditorAberto(false); setAviso(avisos.length ? avisos.join(" ") : "Ficha salva."); carregar(); }} />
      ) : null}

      {/* ── Histórico de versões ──────────────────────────────────────────── */}
      {modalVersoes ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={() => setModalVersoes(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-card p-4 sm:rounded-3xl" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="versoes-titulo">
            <div className="flex items-center justify-between">
              <h2 id="versoes-titulo" className="text-base font-bold text-slate-800">Histórico de versões</h2>
              <button onClick={() => setModalVersoes(false)} aria-label="Fechar" className="rounded-lg p-1.5 text-subtle hover:bg-elevated"><X size={18} /></button>
            </div>
            {versoes.length === 0 ? (
              <p className="py-8 text-center text-sm text-subtle">Nenhuma versão registrada ainda. Use “Nova versão” para congelar o estado atual da ficha.</p>
            ) : comparando ? (
              <ComparacaoVersoes par={comparando} onVoltar={() => setComparando(null)} />
            ) : (
              <ul className="mt-3 space-y-2">
                {versoes.map((v, i) => {
                  const anterior = versoes[i + 1];
                  return (
                    <li key={v.id} className="rounded-2xl border border-line p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">v{v.versao}</span>
                        <span className="text-xs text-muted">{fmtData(v.created_at)}</span>
                        {v.usuario_nome ? <span className="text-xs text-subtle">· {v.usuario_nome}</span> : null}
                        {anterior ? (
                          <button onClick={() => setComparando({ a: anterior, b: v })} className="ml-auto rounded-lg border border-line px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                            Comparar com v{anterior.versao}
                          </button>
                        ) : null}
                      </div>
                      {v.alteracao ? <p className="mt-1.5 text-sm text-slate-600">{v.alteracao}</p> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AcaoBtn({ icone: Icone, children, onClick, carregando = false }) {
  return (
    <button onClick={onClick} disabled={carregando}
      className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
      {carregando ? <Loader2 size={15} className="animate-spin" /> : <Icone size={15} />}
      {children}
    </button>
  );
}

// Nomes de campo em português, para a comparação não mostrar `peso_final_g`.
// Inclui os campos dos retratos antigos, que continuam comparáveis.
const ROTULO_CAMPO = {
  tipo: "Tipo", nome_receita: "Nome", nome_interno: "Nome interno", nome_comercial: "Nome comercial",
  categoria: "Categoria", subcategoria: "Subcategoria", departamento: "Setor", responsavel: "Responsável",
  status: "Status", descricao: "Descrição", observacoes: "Observações", rendimento: "Rendimento",
  rendimento_porcoes: "Rendimento", rendimento_unidade: "Unidade do rendimento",
  peso_porcao_g: "Peso por porção (g)", peso_bruto_g: "Peso bruto (g)", peso_final_g: "Peso final (g)",
  tempo_preparo: "Tempo de preparo", tempo_coccao_min: "Tempo de cocção (min)",
  temperatura_preparo: "Temperatura de preparo", temperatura_servico: "Temperatura de serviço",
  preco_venda: "Preço de venda", cmv_meta: "Meta de CMV", custo_indireto_tipo: "Tipo de custo indireto",
  custo_indireto_valor: "Custo indireto", custo_total: "Custo total", custo_porcao: "Custo por porção",
  alergenicos_pode_conter: "Pode conter", ingredientes: "Ingredientes", etapas: "Etapas", instrucoes: "Montagem / modo de preparo",
  equipamentos: "Equipamentos", alergenicos: "Alergênicos", montagem: "Montagem", armazenamento: "Armazenamento",
};

const mostrarValor = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(" · ") : "—";
  return String(v);
};

function ComparacaoVersoes({ par, onVoltar }) {
  const diferencas = compararVersoes(par.a.snapshot, par.b.snapshot);
  return (
    <div className="mt-3">
      <button onClick={onVoltar} className="mb-3 flex items-center gap-1 text-sm font-medium text-muted hover:text-fg-soft">
        <ArrowLeft size={15} /> Voltar ao histórico
      </button>
      <p className="text-sm font-semibold text-fg-soft">v{par.a.versao} <span className="text-subtle">→</span> v{par.b.versao}</p>
      {diferencas.length === 0 ? (
        <p className="py-6 text-center text-sm text-subtle">Nada mudou entre estas duas versões.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {diferencas.map(d => (
            <li key={d.campo} className="rounded-xl border border-line p-2.5 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-subtle">{ROTULO_CAMPO[d.campo] || d.campo}</div>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <div className="rounded-lg bg-elevated px-2 py-1 text-fg-soft">
                  <span className="text-3xs font-bold uppercase text-muted">antes</span>
                  <div className="whitespace-pre-wrap break-words">{mostrarValor(d.antes)}</div>
                </div>
                <div className="rounded-lg bg-accent-soft px-2 py-1 text-accent-strong">
                  <span className="text-3xs font-bold uppercase text-emerald-600">depois</span>
                  <div className="whitespace-pre-wrap break-words">{mostrarValor(d.depois)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
