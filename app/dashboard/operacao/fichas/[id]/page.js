"use client";

// FICHA TÉCNICA — página completa de uma receita.
//
// Abre a MESMA ficha de `fichas_tecnicas` que a listagem e o modal de edição já
// usam. Aqui moram os campos de ficha técnica profissional (código, versão,
// pesos, perdas, precificação) que não cabiam no modal.
//
// Os ingredientes continuam sendo editados na listagem: esta tela só os mostra,
// com o mesmo custo, para não existirem dois lugares gravando a mesma lista.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, Calculator, ChefHat, ChevronRight, Clock, FileDown, GitBranch,
  History, Info, Layers, ListOrdered, Loader2, Package, Percent, Printer, Save, Scale,
  Snowflake, Tag, TrendingUp, UtensilsCrossed, Wrench, X,
} from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { fetchFichas } from "../../../../lib/operacao";
import {
  fetchFichaCompleta, salvarCamposFicha, garantirCodigoFicha, salvarComplementosFicha,
  criarVersaoFicha, fetchVersoes, compararVersoes, STATUS_FICHA,
} from "../../../../lib/ficha-tecnica";
import { baixarPdfDeHtml } from "../../../../lib/pdf";
import { montarHtmlFichaTecnica } from "./imprimirFicha";
import ModoCozinha from "./ModoCozinha";
import {
  EtapasPreparo, Equipamentos, Alergenicos, Armazenamento, MontagemPassos, novaChave,
} from "./SecoesFicha";
import {
  custoDeProduzirFicha, custoTotalReceita, custoPorPorcao, parseNumero,
  perdaPeso, perdaPercentual, pesoPorPorcao, tempoTotal,
  cmvPercentual, margemBruta, margemBrutaPercentual, markup, precoSugerido,
  validarFicha,
} from "../../../../lib/ficha-calculos.mjs";
import { fmtBRL, fmtPct, fmtData, Card, Field, TextInput, NumberInput, Select, Btn } from "../../../../components/ui";

const CMV_ATALHOS = [25, 30, 35, 40];

// Campos que esta tela edita. Tudo o mais na ficha fica intocado.
const CAMPOS_EDITAVEIS = [
  "nome_receita", "nome_interno", "nome_comercial", "categoria", "subcategoria",
  "responsavel", "status", "descricao", "observacoes",
  "rendimento_porcoes", "rendimento_unidade", "peso_porcao_g",
  "peso_bruto_g", "peso_final_g",
  "tempo_preparo", "tempo_coccao_min", "temperatura_preparo", "temperatura_servico",
  "preco_venda", "cmv_meta", "custo_indireto_tipo", "custo_indireto_valor",
];

function Secao({ icone: Icone, titulo, descricao, children }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
        {Icone ? <Icone size={18} className="mt-0.5 shrink-0 text-slate-400" /> : null}
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-800">{titulo}</h2>
          {descricao ? <p className="mt-0.5 text-xs text-slate-500">{descricao}</p> : null}
        </div>
      </div>
      <div className="pt-4">{children}</div>
    </Card>
  );
}

function Indicador({ icone: Icone, rotulo, valor, nota, tom = "neutro" }) {
  const cores = {
    neutro: "text-slate-800",
    bom: "text-emerald-600",
    atencao: "text-amber-600",
    ruim: "text-rose-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {Icone ? <Icone size={13} /> : null}
        <span className="truncate">{rotulo}</span>
      </div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${cores[tom] || cores.neutro}`}>{valor}</div>
      {nota ? <div className="mt-0.5 text-[11px] text-slate-400">{nota}</div> : null}
    </div>
  );
}

export default function FichaTecnicaPage() {
  const router = useRouter();
  const params = useParams();
  const fichaId = params?.id;
  const { unidadeAtiva } = useERP();

  const [ficha, setFicha] = useState(null);
  const [todasFichas, setTodasFichas] = useState([]);
  const [form, setForm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [sujo, setSujo] = useState(false);
  const [cmvSimulado, setCmvSimulado] = useState("");

  // Seções que moram nas tabelas filhas (etapas, equipamentos, etc.)
  const [etapas, setEtapas] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [alergenicos, setAlergenicos] = useState([]);
  const [podeConter, setPodeConter] = useState("");
  const [armazenamento, setArmazenamento] = useState({});
  const [montagem, setMontagem] = useState([]);

  // Toda seção nova mexe no mesmo botão SALVAR.
  const alterarSecao = (setter) => (valor) => { setter(valor); setSujo(true); };

  const [modoCozinha, setModoCozinha] = useState(false);
  const [modalVersoes, setModalVersoes] = useState(false);
  const [versoes, setVersoes] = useState([]);
  const [comparando, setComparando] = useState(null); // { a, b }
  const [criandoVersao, setCriandoVersao] = useState(false);

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

    // As demais fichas resolvem o custo das subreceitas em cascata.
    const { data: lista } = await fetchFichas(data.unidade_id || unidadeAtiva, data.departamento);
    setTodasFichas(lista || []);

    // Código FT: se ainda não tem, gera agora e mostra já preenchido.
    let codigo = data.codigo;
    if (!codigo) {
      const r = await garantirCodigoFicha(data.unidade_id || unidadeAtiva, data.id, data.codigo);
      if (r.codigo) codigo = r.codigo;
    }

    const completa = { ...data, codigo };
    setFicha(completa);
    setForm(Object.fromEntries(CAMPOS_EDITAVEIS.map(c => [c, completa[c] ?? ""])));

    // As listas ganham uma `chave` estável para o React não embaralhar as
    // linhas quando o usuário reordena ou remove uma no meio.
    setEtapas((completa.etapas || []).map(e => ({ ...e, chave: e.id || novaChave() })));
    setEquipamentos((completa.equipamentos || []).map(e => e.nome).filter(Boolean));
    setAlergenicos((completa.alergenicos || []).map(a => a.alergenico).filter(Boolean));
    setPodeConter(completa.alergenicos_pode_conter || "");
    setArmazenamento(completa.armazenamento || {});
    setMontagem((completa.montagem_passos || []).map(p => ({ ...p, chave: p.id || novaChave() })));

    setSujo(false);
    if (migracaoPendente) {
      setAviso("Alguns campos novos ainda não existem no banco. Rode db/migracao_ficha_tecnica_completa.sql no Supabase para gravá-los.");
    }
    setCarregando(false);
  }, [fichaId, unidadeAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  // Avisa antes de sair com alteração não salva (seção 30 da especificação).
  useEffect(() => {
    if (!sujo) return undefined;
    const aoSair = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, [sujo]);

  const mudar = (campo, valor) => {
    setForm(f => ({ ...f, [campo]: valor }));
    setSujo(true);
  };

  const voltar = () => {
    if (sujo && !window.confirm("Existem alterações não salvas. Sair mesmo assim?")) return;
    router.push(`/dashboard/operacao/fichas?dept=${ficha?.departamento || "cozinha"}`);
  };

  // ── Números da ficha ─────────────────────────────────────────────────────
  const calc = useMemo(() => {
    if (!ficha || !form) return null;

    // Estado em edição por cima da ficha, para os indicadores reagirem na hora.
    const atual = { ...ficha, ...form };

    // Ingredientes e subreceitas separados, com a mesma conta da tela antiga.
    let custoIngredientes = 0;
    let custoSubreceitas = 0;
    for (const fi of ficha.fichas_ingredientes || []) {
      const parcial = custoDeProduzirFicha(
        { id: `${ficha.id}::parcial`, fichas_ingredientes: [fi] },
        todasFichas
      );
      if (fi.subficha_id) custoSubreceitas += parcial;
      else custoIngredientes += parcial;
    }

    const custos = custoTotalReceita({
      custoIngredientes,
      custoSubreceitas,
      custoEmbalagem: parseNumero(ficha.custo_embalagens_total),
      indiretos: {
        tipo: atual.custo_indireto_tipo || "percentual",
        valor: parseNumero(atual.custo_indireto_valor),
      },
    });

    const porcoes = parseNumero(atual.rendimento_porcoes);
    const porcao = custoPorPorcao(custos.custoTotal, porcoes);
    const preco = parseNumero(atual.preco_venda);

    const pb = parseNumero(atual.peso_bruto_g);
    const pf = parseNumero(atual.peso_final_g);

    return {
      ...custos,
      porcoes,
      custoPorcao: porcao,
      preco,
      cmv: cmvPercentual(porcao, preco),
      margem: margemBruta(porcao, preco),
      margemPct: margemBrutaPercentual(porcao, preco),
      markup: markup(porcao, preco),
      perda: perdaPeso(pb, pf),
      perdaPct: perdaPercentual(pb, pf),
      pesoPorcao: pesoPorPorcao(pf, porcoes) || parseNumero(atual.peso_porcao_g),
      tempoTotal: tempoTotal(atual.tempo_preparo, atual.tempo_coccao_min),
    };
  }, [ficha, form, todasFichas]);

  const metaCmv = parseNumero(form?.cmv_meta) || 30;
  const tomCmv = !calc?.cmv ? "neutro" : calc.cmv <= metaCmv ? "bom" : calc.cmv <= metaCmv + 5 ? "atencao" : "ruim";

  const precoAlvo = useMemo(() => {
    const alvo = parseNumero(cmvSimulado);
    if (!calc || alvo <= 0) return 0;
    return precoSugerido(calc.custoPorcao, alvo);
  }, [cmvSimulado, calc]);

  // Ingredientes num formato simples, usado pela impressão e pelo modo cozinha.
  const ingredientesSimples = useMemo(() => {
    if (!ficha) return [];
    return (ficha.fichas_ingredientes || []).map(fi => {
      const sub = fi.subficha_id ? todasFichas.find(f => f.id === fi.subficha_id) : null;
      return {
        nome: fi.insumos?.nome || sub?.nome_receita || "Item removido",
        unidade: fi.insumos?.unidade_medida || sub?.rendimento_unidade || "",
        quantidade: parseNumero(fi.quantidade),
        subreceita: Boolean(sub),
        observacao: parseNumero(fi.fator_correcao) ? `correção +${parseNumero(fi.fator_correcao)}%` : "",
      };
    });
  }, [ficha, todasFichas]);

  // ── Impressão e PDF ──────────────────────────────────────────────────────
  const montarDocumento = (mostrarCustos = true) => montarHtmlFichaTecnica({
    ficha: { ...ficha, ...form },
    etapas, equipamentos, alergenicos, podeConter,
    armazenamento, montagem, ingredientes: ingredientesSimples,
    custos: calc, mostrarCustos,
  });

  const imprimir = () => {
    const janela = window.open("", "_blank");
    if (!janela) { setErro("O navegador bloqueou a janela de impressão. Libere os pop-ups para este site."); return; }
    janela.document.write(montarDocumento(true));
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 400);
  };

  const gerarPdf = () => {
    const nome = `Ficha ${ficha.codigo || ""} ${ficha.nome_receita || ""}`.trim();
    baixarPdfDeHtml(montarDocumento(true), `${nome}.pdf`);
  };

  // ── Versões ──────────────────────────────────────────────────────────────
  const abrirVersoes = async () => {
    setModalVersoes(true);
    setComparando(null);
    const { data } = await fetchVersoes(ficha.id);
    setVersoes(data || []);
  };

  // O retrato guarda o que a ficha era neste momento, para dar para comparar
  // depois. Fica fora da ficha, em fichas_versoes: nada é sobrescrito.
  const montarSnapshot = () => ({
    ...Object.fromEntries(CAMPOS_EDITAVEIS.map(c => [c, (form?.[c] ?? "") || null])),
    alergenicos_pode_conter: podeConter || null,
    custo_total: +Number(calc?.custoTotal || 0).toFixed(4),
    custo_porcao: +Number(calc?.custoPorcao || 0).toFixed(4),
    ingredientes: ingredientesSimples.map(i => `${i.quantidade} ${i.unidade} ${i.nome}`.trim()),
    etapas: etapas.map(e => [e.titulo, e.instrucao].filter(Boolean).join(": ")),
    equipamentos: [...equipamentos],
    alergenicos: [...alergenicos],
    montagem: montagem.map(m => m.descricao).filter(Boolean),
  });

  const novaVersao = async () => {
    if (sujo) { setErro("Salve as alterações antes de criar uma versão."); return; }
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

    if (error === "sem_tabela") {
      setErro("O versionamento precisa da migração. Rode db/migracao_ficha_tecnica_completa.sql no Supabase.");
      return;
    }
    if (error) { setErro(error); return; }
    setAviso(`Versão ${versao} criada.`);
    carregar();
  };

  // ── Gravação ─────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!ficha || !form) return;
    setErro("");
    setAviso("");

    const problemas = validarFicha({ ...ficha, ...form }, []);
    if (problemas.length) { setErro(problemas.join(" · ")); return; }

    setSalvando(true);
    // Campos numéricos vazios viram null para não gravar 0 sem querer.
    const numericos = new Set([
      "peso_bruto_g", "peso_final_g", "peso_porcao_g", "tempo_coccao_min",
      "preco_venda", "cmv_meta", "custo_indireto_valor", "rendimento_porcoes",
    ]);
    const payload = {};
    for (const campo of CAMPOS_EDITAVEIS) {
      const valor = form[campo];
      if (numericos.has(campo)) payload[campo] = valor === "" || valor === null ? null : parseNumero(valor);
      else payload[campo] = valor === "" ? null : valor;
    }
    payload.alergenicos_pode_conter = podeConter || null;
    payload.atualizado_em = new Date().toISOString();

    const { error, colunasIgnoradas } = await salvarCamposFicha(ficha.id, payload);
    if (error) { setSalvando(false); setErro(error); return; }

    // Seções que moram nas tabelas filhas.
    const complementos = await salvarComplementosFicha(ficha.id, ficha.unidade_id || unidadeAtiva, {
      etapas, equipamentos, alergenicos, montagem_passos: montagem, armazenamento,
    });
    setSalvando(false);

    if (complementos.error) { setErro(complementos.error); return; }

    setSujo(false);
    const faltando = [...new Set([...(colunasIgnoradas || []), ...(complementos.pendentes || [])])];
    if (faltando.length) {
      setAviso(`Salvo o que o banco aceita. Ainda faltam no banco: ${faltando.join(", ")}. Rode db/migracao_ficha_tecnica_completa.sql no Supabase para gravar essas partes.`);
    } else {
      setAviso("Ficha salva.");
    }
    carregar();
  };

  // ── Telas de carga e erro ────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Carregando ficha…
      </div>
    );
  }
  if (erro && !ficha) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <AlertTriangle size={28} className="mx-auto text-amber-500" />
        <p className="mt-3 text-sm font-medium text-slate-700">{erro}</p>
        <Btn className="mt-4" onClick={() => router.push("/dashboard/operacao/fichas")}>
          Voltar para as fichas
        </Btn>
      </div>
    );
  }

  // Modo cozinha ocupa a tela inteira: é para ser lido de longe, na bancada.
  if (modoCozinha) {
    return (
      <ModoCozinha
        ficha={{ ...ficha, ...form }}
        etapas={etapas} equipamentos={equipamentos}
        alergenicos={alergenicos} podeConter={podeConter}
        montagem={montagem} ingredientes={ingredientesSimples}
        onSair={() => setModoCozinha(false)}
      />
    );
  }

  const foto = ficha?.imagem
    ? (String(ficha.imagem).startsWith("data:") ? ficha.imagem : `data:image/jpeg;base64,${ficha.imagem}`)
    : "";

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 pb-28 sm:p-4">
      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={voltar} className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          <ArrowLeft size={16} /> Fichas
        </button>
        <div className="flex items-center gap-2">
          {sujo ? <span className="hidden text-xs font-medium text-amber-600 sm:inline">Alterações não salvas</span> : null}
          <Btn onClick={salvar} disabled={salvando || !sujo}>
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span className="ml-1.5">Salvar</span>
          </Btn>
        </div>
      </div>

      {/* ── Ações da ficha ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <AcaoBtn icone={ChefHat} onClick={() => setModoCozinha(true)} destaque>Modo cozinha</AcaoBtn>
        <AcaoBtn icone={Printer} onClick={imprimir}>Imprimir</AcaoBtn>
        <AcaoBtn icone={FileDown} onClick={gerarPdf}>PDF</AcaoBtn>
        <AcaoBtn icone={GitBranch} onClick={novaVersao} carregando={criandoVersao}>Nova versão</AcaoBtn>
        <AcaoBtn icone={History} onClick={abrirVersoes}>Histórico</AcaoBtn>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
          <div className="h-32 w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:h-28 sm:w-40">
            {foto
              ? <img src={foto} alt={ficha.nome_receita} className="h-full w-full object-cover" />
              : <div className="flex h-full items-center justify-center text-slate-300"><UtensilsCrossed size={26} /></div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {ficha.codigo ? (
                <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">{ficha.codigo}</span>
              ) : null}
              <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">v{ficha.versao || "1.0"}</span>
              <span className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                (form.status || "ativa") === "ativa" ? "bg-emerald-50 text-emerald-700"
                  : (form.status || "") === "rascunho" ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-500"}`}>
                {STATUS_FICHA.find(s => s.valor === (form.status || "ativa"))?.rotulo || "Ativa"}
              </span>
              {ficha.eh_base ? (
                <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700">Pré-preparo</span>
              ) : null}
            </div>
            <h1 className="mt-1.5 truncate text-xl font-extrabold text-slate-900">{ficha.nome_receita}</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {[ficha.categoria, ficha.subcategoria, ficha.departamento].filter(Boolean).join(" · ") || "Sem categoria"}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-400">
              {ficha.responsavel ? `Responsável: ${ficha.responsavel} · ` : ""}
              Criada em {fmtData(ficha.created_at)}
              {ficha.atualizado_em ? ` · Atualizada em ${fmtData(ficha.atualizado_em)}` : ""}
            </p>
          </div>
        </div>
      </Card>

      {aviso ? (
        <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
          <Info size={15} className="mt-0.5 shrink-0" /> <span>{aviso}</span>
        </div>
      ) : null}
      {erro ? (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{erro}</span>
        </div>
      ) : null}

      {/* ── Indicadores ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Indicador icone={Package} rotulo="Rendimento"
          valor={`${calc.porcoes || 0} ${ficha.rendimento_unidade || ""}`.trim()} />
        <Indicador icone={Scale} rotulo="Peso final"
          valor={calc.pesoPorcao ? `${Math.round(parseNumero(form.peso_final_g)) || 0} g` : "—"}
          nota={calc.pesoPorcao ? `${Math.round(calc.pesoPorcao)} g por porção` : null} />
        <Indicador icone={Calculator} rotulo="Custo total" valor={fmtBRL(calc.custoTotal)}
          nota={calc.custoIndireto ? `inclui ${fmtBRL(calc.custoIndireto)} indireto` : null} />
        <Indicador icone={Calculator} rotulo="Custo por porção" valor={fmtBRL(calc.custoPorcao)} />
        <Indicador icone={Tag} rotulo="Preço de venda" valor={calc.preco ? fmtBRL(calc.preco) : "—"} />
        <Indicador icone={Percent} rotulo="CMV" tom={tomCmv}
          valor={calc.cmv ? fmtPct(calc.cmv) : "—"} nota={`meta ${fmtPct(metaCmv, 0)}`} />
        <Indicador icone={TrendingUp} rotulo="Margem bruta"
          tom={calc.margem > 0 ? "bom" : calc.preco ? "ruim" : "neutro"}
          valor={calc.preco ? fmtBRL(calc.margem) : "—"}
          nota={calc.preco ? fmtPct(calc.margemPct) : null} />
        <Indicador icone={Percent} rotulo="Perda"
          tom={calc.perdaPct > 30 ? "ruim" : calc.perdaPct > 15 ? "atencao" : "neutro"}
          valor={calc.perdaPct ? fmtPct(calc.perdaPct) : "—"}
          nota={calc.perda ? `${Math.round(calc.perda)} g` : null} />
      </div>

      {/* ── Identificação ─────────────────────────────────────────────────── */}
      <Secao icone={Tag} titulo="Identificação"
        descricao="Como a receita é chamada na cozinha, no cardápio e nos relatórios.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da receita">
            <TextInput value={form.nome_receita || ""} onChange={e => mudar("nome_receita", e.target.value)} />
          </Field>
          <Field label="Código">
            <TextInput value={ficha.codigo || "—"} readOnly className="bg-slate-50 font-mono text-slate-500" />
          </Field>
          <Field label="Nome interno (cozinha)">
            <TextInput value={form.nome_interno || ""} onChange={e => mudar("nome_interno", e.target.value)}
              placeholder={ficha.nome_receita} />
          </Field>
          <Field label="Nome comercial (cardápio)">
            <TextInput value={form.nome_comercial || ""} onChange={e => mudar("nome_comercial", e.target.value)}
              placeholder={ficha.nome_receita} />
          </Field>
          <Field label="Categoria">
            <TextInput value={form.categoria || ""} onChange={e => mudar("categoria", e.target.value)} />
          </Field>
          <Field label="Subcategoria">
            <TextInput value={form.subcategoria || ""} onChange={e => mudar("subcategoria", e.target.value)} />
          </Field>
          <Field label="Responsável">
            <TextInput value={form.responsavel || ""} onChange={e => mudar("responsavel", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={form.status || "ativa"} onChange={e => mudar("status", e.target.value)}>
              {STATUS_FICHA.map(s => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Descrição">
              <textarea className="erp-input min-h-[64px]" value={form.descricao || ""}
                onChange={e => mudar("descricao", e.target.value)}
                placeholder="Para que serve, quando é usada, o que a diferencia." />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Observações">
              <textarea className="erp-input min-h-[64px]" value={form.observacoes || ""}
                onChange={e => mudar("observacoes", e.target.value)} />
            </Field>
          </div>
        </div>
      </Secao>

      {/* ── Rendimento e produção ─────────────────────────────────────────── */}
      <Secao icone={Scale} titulo="Rendimento e produção"
        descricao="A perda é calculada sozinha a partir do peso bruto e do peso final.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Rendimento">
            <NumberInput value={form.rendimento_porcoes ?? ""} min="0" step="any"
              onChange={e => mudar("rendimento_porcoes", e.target.value)} />
          </Field>
          <Field label="Unidade do rendimento">
            <Select value={form.rendimento_unidade || ""} onChange={e => mudar("rendimento_unidade", e.target.value)}>
              {["", "g", "kg", "ml", "l", "un", "porções"].map(u => (
                <option key={u || "vazio"} value={u}>{u || "—"}</option>
              ))}
            </Select>
          </Field>
          <Field label="Peso por porção (g)">
            <NumberInput value={form.peso_porcao_g ?? ""} min="0" step="any"
              onChange={e => mudar("peso_porcao_g", e.target.value)}
              placeholder={calc.pesoPorcao ? String(Math.round(calc.pesoPorcao)) : ""} />
          </Field>

          <Field label="Peso bruto inicial (g)">
            <NumberInput value={form.peso_bruto_g ?? ""} min="0" step="any"
              onChange={e => mudar("peso_bruto_g", e.target.value)} />
          </Field>
          <Field label="Peso final produzido (g)">
            <NumberInput value={form.peso_final_g ?? ""} min="0" step="any"
              onChange={e => mudar("peso_final_g", e.target.value)} />
          </Field>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Perda calculada</div>
            <div className="mt-1 text-lg font-bold tabular-nums text-slate-800">
              {calc.perda ? `${Math.round(calc.perda)} g` : "—"}
              {calc.perdaPct ? <span className="ml-1.5 text-sm font-semibold text-slate-500">{fmtPct(calc.perdaPct)}</span> : null}
            </div>
          </div>

          <Field label="Tempo de preparo (min)">
            <TextInput value={form.tempo_preparo ?? ""} onChange={e => mudar("tempo_preparo", e.target.value)} />
          </Field>
          <Field label="Tempo de cocção (min)">
            <NumberInput value={form.tempo_coccao_min ?? ""} min="0" step="1"
              onChange={e => mudar("tempo_coccao_min", e.target.value)} />
          </Field>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <Clock size={12} /> Tempo total
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-slate-800">
              {calc.tempoTotal ? `${calc.tempoTotal} min` : "—"}
            </div>
          </div>

          <Field label="Temperatura de preparo">
            <TextInput value={form.temperatura_preparo || ""} placeholder="ex.: 180 °C"
              onChange={e => mudar("temperatura_preparo", e.target.value)} />
          </Field>
          <Field label="Temperatura de serviço">
            <TextInput value={form.temperatura_servico || ""} placeholder="ex.: 65 °C"
              onChange={e => mudar("temperatura_servico", e.target.value)} />
          </Field>
        </div>
      </Secao>

      {/* ── Ingredientes (somente leitura) ────────────────────────────────── */}
      <Secao icone={UtensilsCrossed} titulo="Ingredientes"
        descricao="Editados na tela de fichas, para não existirem dois lugares gravando a mesma lista.">
        {(ficha.fichas_ingredientes || []).length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Esta ficha ainda não tem ingredientes.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-1 pb-2 font-medium">Item</th>
                  <th className="px-1 pb-2 text-right font-medium">Qtd.</th>
                  <th className="px-1 pb-2 text-right font-medium">Correção</th>
                  <th className="px-1 pb-2 text-right font-medium">Custo</th>
                </tr>
              </thead>
              <tbody>
                {(ficha.fichas_ingredientes || []).map((fi, i) => {
                  const sub = fi.subficha_id ? todasFichas.find(f => f.id === fi.subficha_id) : null;
                  const nome = fi.insumos?.nome || sub?.nome_receita || "Item removido";
                  const unidade = fi.insumos?.unidade_medida || sub?.rendimento_unidade || "";
                  const custo = custoDeProduzirFicha(
                    { id: `linha-${i}`, fichas_ingredientes: [fi] }, todasFichas
                  );
                  return (
                    <tr key={fi.id || i} className="border-b border-slate-50 last:border-0">
                      <td className="px-1 py-2">
                        <span className="font-medium text-slate-700">{nome}</span>
                        {sub ? <span className="ml-1.5 rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">subreceita</span> : null}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-slate-600">
                        {parseNumero(fi.quantidade)} {unidade}
                      </td>
                      <td className="px-1 py-2 text-right tabular-nums text-slate-500">
                        {parseNumero(fi.fator_correcao) ? `+${parseNumero(fi.fator_correcao)}%` : "—"}
                      </td>
                      <td className="px-1 py-2 text-right font-semibold tabular-nums text-slate-800">{fmtBRL(custo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <button
          onClick={() => router.push(`/dashboard/operacao/fichas?dept=${ficha.departamento || "cozinha"}&q=${encodeURIComponent(ficha.nome_receita || "")}`)}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Editar ingredientes na tela de fichas <ChevronRight size={16} />
        </button>
      </Secao>

      {/* ── Modo de preparo ───────────────────────────────────────────────── */}
      <Secao icone={ListOrdered} titulo="Modo de preparo"
        descricao="Cada etapa com o seu tempo, temperatura e equipamento.">
        <EtapasPreparo etapas={etapas} onChange={alterarSecao(setEtapas)}
          modoPreparoLegado={ficha.modo_preparo} />
        {ficha.modo_preparo && etapas.length > 0 ? (
          <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-600">
              Texto original do modo de preparo
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{ficha.modo_preparo}</p>
          </details>
        ) : null}
      </Secao>

      {/* ── Equipamentos ──────────────────────────────────────────────────── */}
      <Secao icone={Wrench} titulo="Equipamentos e utensílios"
        descricao="O que precisa estar à mão antes de começar.">
        <Equipamentos selecionados={equipamentos} onChange={alterarSecao(setEquipamentos)} />
      </Secao>

      {/* ── Montagem ──────────────────────────────────────────────────────── */}
      <Secao icone={Layers} titulo="Montagem e finalização"
        descricao="A ordem exata em que o prato é montado.">
        <MontagemPassos passos={montagem} onChange={alterarSecao(setMontagem)} />
      </Secao>

      {/* ── Armazenamento ─────────────────────────────────────────────────── */}
      <Secao icone={Snowflake} titulo="Armazenamento e validade"
        descricao="Como guardar e por quanto tempo.">
        <Armazenamento dados={armazenamento} onChange={alterarSecao(setArmazenamento)} />
      </Secao>

      {/* ── Alergênicos ───────────────────────────────────────────────────── */}
      <Secao icone={AlertTriangle} titulo="Alergênicos"
        descricao="Declaração obrigatória (RDC 727/2022).">
        <Alergenicos
          selecionados={alergenicos} podeConter={podeConter}
          onChange={alterarSecao(setAlergenicos)}
          onPodeConterChange={(v) => { setPodeConter(v); setSujo(true); }}
        />
      </Secao>

      {/* ── Custos e precificação ─────────────────────────────────────────── */}
      <Secao icone={Calculator} titulo="Custo e precificação"
        descricao="Os custos indiretos entram sobre o custo direto da receita.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <Linha rotulo="Ingredientes" valor={fmtBRL(calc.custoIngredientes)} />
            <Linha rotulo="Subreceitas" valor={fmtBRL(calc.custoSubreceitas)} />
            <Linha rotulo="Embalagem" valor={fmtBRL(calc.custoEmbalagem)} />
            <Linha rotulo="Custos indiretos" valor={fmtBRL(calc.custoIndireto)} />
            <div className="mt-2 border-t border-slate-200 pt-2">
              <Linha rotulo="Custo total" valor={fmtBRL(calc.custoTotal)} forte />
              <Linha rotulo="Custo por porção" valor={fmtBRL(calc.custoPorcao)} forte />
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Custos indiretos">
                <Select value={form.custo_indireto_tipo || "percentual"}
                  onChange={e => mudar("custo_indireto_tipo", e.target.value)}>
                  <option value="percentual">Percentual (%)</option>
                  <option value="fixo">Valor fixo (R$)</option>
                </Select>
              </Field>
              <Field label={form.custo_indireto_tipo === "fixo" ? "Valor (R$)" : "Percentual (%)"}>
                <NumberInput value={form.custo_indireto_valor ?? ""} min="0" step="any"
                  onChange={e => mudar("custo_indireto_valor", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço de venda (R$)">
                <NumberInput value={form.preco_venda ?? ""} min="0" step="any"
                  onChange={e => mudar("preco_venda", e.target.value)} />
              </Field>
              <Field label="Meta de CMV (%)">
                <NumberInput value={form.cmv_meta ?? ""} min="0" max="100" step="any"
                  onChange={e => mudar("cmv_meta", e.target.value)} />
              </Field>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
              <Linha rotulo="CMV" valor={calc.cmv ? fmtPct(calc.cmv) : "—"} />
              <Linha rotulo="Margem bruta" valor={calc.preco ? fmtBRL(calc.margem) : "—"} />
              <Linha rotulo="Margem bruta %" valor={calc.preco ? fmtPct(calc.margemPct) : "—"} />
              <Linha rotulo="Markup" valor={calc.markup ? `${calc.markup.toFixed(2)}×` : "—"} />
            </div>
          </div>
        </div>

        {/* Simulador de CMV */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Percent size={14} /> Simulador de CMV
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">Com que preço a receita fecha no CMV desejado.</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {CMV_ATALHOS.map(v => (
              <button key={v} onClick={() => setCmvSimulado(String(v))}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                  String(v) === String(cmvSimulado)
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}>
                {v}%
              </button>
            ))}
            <div className="w-28">
              <NumberInput value={cmvSimulado} min="0" max="99" step="any" placeholder="outro %"
                onChange={e => setCmvSimulado(e.target.value)} />
            </div>
            {precoAlvo > 0 ? (
              <div className="ml-auto text-right">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Preço sugerido</div>
                <div className="text-lg font-bold tabular-nums text-emerald-600">{fmtBRL(precoAlvo)}</div>
              </div>
            ) : null}
          </div>
          {precoAlvo > 0 ? (
            <button onClick={() => mudar("preco_venda", precoAlvo.toFixed(2))}
              className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              Usar {fmtBRL(precoAlvo)} como preço de venda
            </button>
          ) : null}
        </div>
      </Secao>

      {/* ── Histórico de versões ──────────────────────────────────────────── */}
      {modalVersoes ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
          onClick={() => setModalVersoes(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-4 sm:rounded-3xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Histórico de versões</h2>
              <button onClick={() => setModalVersoes(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {versoes.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Nenhuma versão registrada ainda. Use “Nova versão” para congelar o estado atual da ficha.
              </p>
            ) : comparando ? (
              <ComparacaoVersoes par={comparando} onVoltar={() => setComparando(null)} />
            ) : (
              <ul className="mt-3 space-y-2">
                {versoes.map((v, i) => {
                  const anterior = versoes[i + 1];
                  return (
                    <li key={v.id} className="rounded-2xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">v{v.versao}</span>
                        <span className="text-xs text-slate-500">{fmtData(v.created_at)}</span>
                        {v.usuario_nome ? <span className="text-xs text-slate-400">· {v.usuario_nome}</span> : null}
                        {anterior ? (
                          <button onClick={() => setComparando({ a: anterior, b: v })}
                            className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
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

      {/* Barra fixa de salvar no celular */}
      {sujo ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden">
          <Btn onClick={salvar} disabled={salvando} className="w-full justify-center">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span className="ml-1.5">Salvar alterações</span>
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

function AcaoBtn({ icone: Icone, children, onClick, destaque = false, carregando = false }) {
  return (
    <button onClick={onClick} disabled={carregando}
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
        destaque
          ? "bg-slate-900 text-white hover:bg-slate-700"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
      {carregando ? <Loader2 size={15} className="animate-spin" /> : <Icone size={15} />}
      {children}
    </button>
  );
}

// Nomes de campo em português, para a comparação não mostrar `peso_bruto_g`.
const ROTULO_CAMPO = {
  nome_receita: "Nome", nome_interno: "Nome interno", nome_comercial: "Nome comercial",
  categoria: "Categoria", subcategoria: "Subcategoria", responsavel: "Responsável",
  status: "Status", descricao: "Descrição", observacoes: "Observações",
  rendimento_porcoes: "Rendimento", rendimento_unidade: "Unidade do rendimento",
  peso_porcao_g: "Peso por porção (g)", peso_bruto_g: "Peso bruto (g)", peso_final_g: "Peso final (g)",
  tempo_preparo: "Tempo de preparo", tempo_coccao_min: "Tempo de cocção (min)",
  temperatura_preparo: "Temperatura de preparo", temperatura_servico: "Temperatura de serviço",
  preco_venda: "Preço de venda", cmv_meta: "Meta de CMV", custo_indireto_tipo: "Tipo de custo indireto",
  custo_indireto_valor: "Custo indireto", custo_total: "Custo total", custo_porcao: "Custo por porção",
  alergenicos_pode_conter: "Pode conter", ingredientes: "Ingredientes", etapas: "Etapas",
  equipamentos: "Equipamentos", alergenicos: "Alergênicos", montagem: "Montagem",
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
      <button onClick={onVoltar} className="mb-3 flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Voltar ao histórico
      </button>
      <p className="text-sm font-semibold text-slate-700">
        v{par.a.versao} <span className="text-slate-400">→</span> v{par.b.versao}
      </p>
      {diferencas.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Nada mudou entre estas duas versões.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {diferencas.map(d => (
            <li key={d.campo} className="rounded-xl border border-slate-200 p-2.5 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {ROTULO_CAMPO[d.campo] || d.campo}
              </div>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <div className="rounded-lg bg-rose-50 px-2 py-1 text-rose-800">
                  <span className="text-[10px] font-bold uppercase text-rose-400">antes</span>
                  <div className="break-words">{mostrarValor(d.antes)}</div>
                </div>
                <div className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-800">
                  <span className="text-[10px] font-bold uppercase text-emerald-500">depois</span>
                  <div className="break-words">{mostrarValor(d.depois)}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Linha({ rotulo, valor, forte = false }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={forte ? "font-semibold text-slate-700" : "text-slate-500"}>{rotulo}</span>
      <span className={`tabular-nums ${forte ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{valor}</span>
    </div>
  );
}
