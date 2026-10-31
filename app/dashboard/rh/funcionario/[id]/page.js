"use client";

// PRONTUÁRIO DO COLABORADOR (HDEV-RH-001, Fase 2).
//
// Antes esta página lia a tabela LEGADA `funcionarios` (2 linhas) e abria vazia
// para qualquer colaborador real. Agora lê `colaboradores` e organiza a vida do
// colaborador em 10 abas. Regras e pendências: lib/prontuario-colaborador.mjs.
// Editar e Desligar abrem os fluxos únicos do RH (?editar= / ?desligar=), para
// não existir um segundo formulário. Tudo respeita a RLS do banco; os botões
// só aparecem para quem tem a permissão, e o banco recusa o resto.

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Bell, ClipboardList, DollarSign, GraduationCap, Trash2, Upload, Download, User, Users, Clock, Edit3, Printer, FileText, UserX, AlertTriangle, Eye, EyeOff,
} from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL, fmtData,
} from "../../../../components/ui";
import { useERP } from "../../../../context/ERPContext";
import { supabase } from "../../../../lib/supabase";
import { lerSessao } from "../../../../lib/auth";
import { hasPermission } from "../../../../lib/permissions-catalog.mjs";
import {
  fetchAvisos, inserirAviso, removerAviso,
  fetchProducoes, inserirProducao, removerProducao,
  fetchHolerites, inserirHolerite, removerHolerite,
  fetchCursos, inserirCurso, removerCurso,
  fetchBonificacoes, inserirBonificacao, removerBonificacao, fetchTiposBonificacao,
  fetchAtas, inserirAta, removerAta,
  fetchHistorico, inserirHistorico,
} from "../../../../lib/pessoas";
import {
  fetchColaboradores, fetchDocumentos, fetchAtestados, fetchAdvertenciasColab, fetchBancoHorasColaborador, somaMinutosBanco,
  fetchFolgasEsporadicas, calcularAdicionaisMes, jornadaContratadaMin, opcoesDaCasa, fetchFeriados,
} from "../../../../lib/rh";
import { fetchPontosMes } from "../../../../lib/ponto";
import { enviarArquivoRH, abrirArquivoRH } from "../../../../lib/rh-arquivos";
import { imprimirReciboExtra } from "../../../../lib/recibo-extra";
import { useContextoInteligencia } from "../../../../components/intelligence/useContextoInteligencia";
import { fetchConvencaoAtiva } from "../../../../lib/trabalhista/convencoes-dados";
import { regrasDaCompetencia } from "../../../../lib/trabalhista/regras-competencia.mjs";
import VinculosAba from "./VinculosAba";
import SimulacaoMes from "./SimulacaoMes";
import { aniversario } from "../../../../lib/contrato-experiencia.mjs";
import { fetchVinculos } from "../../../../lib/vinculos-dados";
import { avosFerias } from "../../../../lib/trabalhista/regras-cct.mjs";
import {
  ABAS_PRONTUARIO, statusDoColaborador, vinculoAtual, supervisoresDe, pendenciasDoColaborador, tempoDeCasa, mascararCpf,
} from "../../../../lib/prontuario-colaborador.mjs";

// SEC-RH-1.3A: holerite, curso e ata são arquivos de RH — bucket privado, URL assinada curta.
const FONTE_DO_ARQUIVO = { holerites: "holerite", cursos: "curso", atas: "ata_funcionario" };

// Listas com cadastro (tabelas ligadas a colaboradores pela RH-2)
const LISTAS = {
  avisos: { label: "Avisos", icon: Bell, fetch: fetchAvisos, insert: inserirAviso, remove: removerAviso,
    campos: [{ k: "titulo", label: "Título" }, { k: "corpo", label: "Mensagem" }, { k: "tipo", label: "Tipo", select: ["info", "reuniao", "alerta"] }],
    titulo: (x) => x.titulo, sub: (x) => x.corpo },
  producoes: { label: "Tarefas e produções", icon: ClipboardList, fetch: fetchProducoes, insert: inserirProducao, remove: removerProducao,
    campos: [{ k: "titulo", label: "Tarefa" }, { k: "descricao", label: "Descrição" }, { k: "periodo", label: "Período", select: ["dia", "semana"] }],
    titulo: (x) => x.titulo, sub: (x) => `${x.periodo === "semana" ? "Semanal" : "Diária"} · ${x.status || "pendente"}` },
  // Holerite nasce do Fechar folha (um por pessoa e mês). Lançar à mão aqui criava
  // outro para o mesmo mês: a lista fica só de consulta.
  holerites: { label: "Holerites", icon: DollarSign, fetch: fetchHolerites, insert: inserirHolerite, remove: null, somenteLeitura: true, upload: true,
    campos: [{ k: "mes", label: "Mês (1-12)", num: true }, { k: "ano", label: "Ano", num: true }, { k: "bruto", label: "Bruto (R$)", num: true }, { k: "liquido", label: "Líquido (R$)", num: true }],
    titulo: (x) => `${String(x.mes).padStart(2, "0")}/${x.ano}`, sub: (x) => `Líquido ${fmtBRL(x.liquido)}` },
  cursos: { label: "Cursos e treinamentos", icon: GraduationCap, fetch: fetchCursos, insert: inserirCurso, remove: removerCurso, upload: true,
    campos: [{ k: "titulo", label: "Título" }, { k: "descricao", label: "Descrição" }, { k: "origem", label: "Origem", select: ["empresa", "colaborador"] }, { k: "tipo_arquivo", label: "Tipo", select: ["pdf", "video", "link"] }],
    titulo: (x) => x.titulo, sub: (x) => `${x.origem} · ${x.tipo_arquivo}` },
  bonificacoes: { label: "Bônus", icon: DollarSign, fetch: fetchBonificacoes, insert: inserirBonificacao, remove: removerBonificacao,
    campos: [{ k: "tipo_id", label: "Tipo de bônus", selectDynamic: true }, { k: "valor", label: "Valor (R$)", num: true }, { k: "data", label: "Data" }, { k: "obs", label: "Observações" }],
    titulo: (x) => x.rh_tipos_bonificacao?.nome || "Bônus", sub: (x) => `Valor: ${fmtBRL(x.valor)}` },
  atas: { label: "Atas", icon: Users, fetch: fetchAtas, insert: inserirAta, remove: removerAta, upload: true,
    campos: [{ k: "data", label: "Data" }, { k: "assunto", label: "Assunto da reunião" }, { k: "descricao", label: "Resumo / decisões" }],
    titulo: (x) => x.assunto, sub: (x) => x.descricao || "Sem resumo" },
  // histórico: só inclusão (o banco não deixa alterar nem apagar — RH-2)
  historico: { label: "Histórico de mudanças", icon: Clock, fetch: fetchHistorico, insert: inserirHistorico, remove: null,
    campos: [{ k: "data", label: "Data da mudança" }, { k: "tipo_evento", label: "Tipo", select: ["contrato", "cargo", "salario", "unidade"] }, { k: "valor_antigo", label: "Valor antigo" }, { k: "valor_novo", label: "Valor novo" }, { k: "observacao", label: "Motivo / obs." }],
    titulo: (x) => `Mudou ${x.tipo_evento}`, sub: (x) => `${x.valor_antigo || "—"} → ${x.valor_novo}${x.observacao ? ` · ${x.observacao}` : ""}` },
};

function FormLista({ lista, chave, func, onSalvar, onCancelar, opcoesDinamicas = {} }) {
  const [f, setF] = useState({});
  const [file, setFile] = useState(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  async function salvar() {
    const primeiro = lista.campos[0];
    const valores = { ...f };
    if (primeiro.selectDynamic && !valores[primeiro.k]) valores[primeiro.k] = opcoesDinamicas[primeiro.k]?.[0]?.value;
    if (!valores[primeiro.k]) return setErro(`Preencha "${primeiro.label}".`);
    setEnviando(true);
    let arquivo_url = null;
    if (lista.upload && file) {
      const up = await enviarArquivoRH({ fonte: FONTE_DO_ARQUIVO[chave], donoId: func.id, arquivo: file });
      if (up.error) { setErro("Falha no envio do arquivo: " + up.error); setEnviando(false); return; }
      arquivo_url = up.ref;
    }
    const obj = { ...valores, func_id: func.id };
    lista.campos.forEach((c) => { if (c.num) obj[c.k] = Number(valores[c.k]) || 0; });
    if (lista.upload) obj.arquivo_url = arquivo_url;
    const erroSalvar = await onSalvar(obj);
    setEnviando(false);
    if (erroSalvar) setErro(erroSalvar);
  }

  return (
    <>
      {lista.campos.map((c) => (
        <Field key={c.k} label={c.label}>
          {c.select ? (
            <Select value={f[c.k] || c.select[0]} onChange={(e) => set(c.k, e.target.value)}>{c.select.map((o) => <option key={o}>{o}</option>)}</Select>
          ) : c.selectDynamic ? (
            <Select value={f[c.k] || ""} onChange={(e) => set(c.k, e.target.value)}>
              {(opcoesDinamicas[c.k] || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : c.num ? (
            <NumberInput value={f[c.k] || ""} onChange={(e) => set(c.k, e.target.value)} />
          ) : (
            <TextInput type={c.k === "data" ? "date" : "text"} value={f[c.k] || ""} onChange={(e) => set(c.k, e.target.value)} />
          )}
        </Field>
      ))}
      {lista.upload && (
        <Field label="Arquivo (opcional)">
          <label className="erp-btn erp-btn-ghost w-full cursor-pointer">
            <Upload size={15} /> {file ? file.name.slice(0, 24) : "Escolher arquivo"}
            <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>
      )}
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3" role="alert">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={enviando} onClick={salvar}>{enviando ? "Salvando..." : "Adicionar"}</Btn>
      </div>
    </>
  );
}

/** Uma lista com cadastro (holerites, cursos, bônus...). */
function ListaDoProntuario({ chave, func, podeEditar, opcoesDinamicas, onAviso }) {
  const lista = LISTAS[chave];
  const [itens, setItens] = useState(null);
  const [modal, setModal] = useState(false);
  const carregar = useCallback(async () => { setItens(await lista.fetch(func.id)); }, [lista, func.id]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar(obj) {
    const r = await lista.insert(obj, func.unidade_id);
    if (r?.error) return `Não foi possível salvar: ${r.error}`;
    setModal(false); onAviso(`${lista.label}: adicionado.`); carregar();
    return null;
  }
  async function remover(it) {
    if (!confirm("Remover este item?")) return;
    await lista.remove(it.id);
    carregar();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionLabel>{lista.label}</SectionLabel>
        {podeEditar && !lista.somenteLeitura && <Btn variant="primary" className="!h-8 text-2xs no-print" onClick={() => setModal(true)}>+ Novo</Btn>}
      </div>
      {itens === null ? <EmptyState icon={lista.icon} title="Carregando..." /> : itens.length === 0 ? (
        <EmptyState icon={lista.icon} title={`Nenhum registro em ${lista.label.toLowerCase()}`} />
      ) : itens.map((it) => (
        <Card key={it.id} className="!p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate text-hf-text">{lista.titulo(it)}</p>
            <p className="text-2xs truncate text-hf-text-2">{lista.sub(it)} · {fmtData(it.data || it.created_at)}</p>
          </div>
          {it.arquivo_url && FONTE_DO_ARQUIVO[chave] && (
            <button type="button" aria-label="Abrir arquivo" onClick={() => abrirArquivoRH(FONTE_DO_ARQUIVO[chave], it.id)} className="w-9 h-9 rounded-lg flex items-center justify-center bg-hf-elevated no-print"><Download size={14} /></button>
          )}
          {podeEditar && lista.remove && (
            <button type="button" aria-label="Remover" onClick={() => remover(it)} className="w-9 h-9 rounded-lg flex items-center justify-center erp-badge-danger no-print"><Trash2 size={14} /></button>
          )}
        </Card>
      ))}
      <Modal open={modal} onClose={() => setModal(false)} title={`Novo · ${lista.label}`}>
        <FormLista lista={lista} chave={chave} func={func} onSalvar={salvar} onCancelar={() => setModal(false)} opcoesDinamicas={opcoesDinamicas} />
      </Modal>
    </div>
  );
}

const Linha = ({ rotulo, valor, destaque }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-hf-border last:border-0">
    <span className="text-xs font-semibold text-hf-text-2">{rotulo}</span>
    <span className={`text-sm text-right ${destaque ? "font-black text-hf-text" : "font-semibold text-hf-text"}`}>{valor ?? "—"}</span>
  </div>
);
const vazio = (v) => (String(v ?? "").trim() ? v : <span className="text-hf-muted font-medium">não informado</span>);
const dataBR = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : null);
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ProntuarioColaboradorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { unidadeInfo } = useERP();
  const [func, setFunc] = useState(null);
  const [erro, setErro] = useState("");
  const [lista, setLista] = useState([]);
  const [convencao, setConvencao] = useState(null);
  const [vinculoReg, setVinculoReg] = useState(null); // vínculo aberto em rh_vinculos (RH-4)
  const [versaoVinculo, setVersaoVinculo] = useState(0);
  const [sessao, setSessao] = useState(null);
  // ?aba=contratos (e as outras) abre direto na aba: o Quadro e o cadastro
  // mandam prorrogar/efetivar para cá.
  const abaDaUrl = useSearchParams().get("aba");
  const [aba, setAba] = useState(() => (ABAS_PRONTUARIO.some((a) => a.id === abaDaUrl) ? abaDaUrl : "resumo"));
  const [extras, setExtras] = useState({}); // dados carregados por aba
  const [tiposB, setTiposB] = useState([]);
  const [mostrarCpf, setMostrarCpf] = useState(false);
  const [aviso, setAviso] = useState("");
  useContextoInteligencia(func ? { modulo: "rh", tipo: "colaborador", id: func.id, nome: func.nome } : null);
  useEffect(() => { if (!aviso) return undefined; const t = setTimeout(() => setAviso(""), 2600); return () => clearTimeout(t); }, [aviso]);

  const recarregarColaborador = useCallback(() => {
    if (!supabase || !id) return;
    supabase.from("colaboradores").select("*").eq("id", id).maybeSingle().then(({ data, error }) => {
      if (error) setErro("Não foi possível abrir o prontuário: " + error.message);
      else if (!data) setErro("Colaborador não encontrado ou sem permissão para ver.");
      setFunc(data || null);
    });
  }, [id]);
  useEffect(() => { lerSessao().then(setSessao); recarregarColaborador(); }, [recarregarColaborador]);

  useEffect(() => {
    if (!func?.unidade_id) return;
    fetchColaboradores(func.unidade_id).then(({ data }) => setLista(data || []));
    fetchConvencaoAtiva(func.unidade_id).then(setConvencao);
    fetchTiposBonificacao(func.unidade_id).then(({ data }) => setTiposB(data || []));
  }, [func?.unidade_id]);

  useEffect(() => {
    if (!func?.id) return;
    fetchVinculos(func.id).then(({ data }) => setVinculoReg((data || []).find((v) => !v.fim) || null));
  }, [func?.id, versaoVinculo]);

  // Carrega o que cada aba precisa, uma vez
  useEffect(() => {
    if (!func) return;
    const mes = new Date().toISOString().slice(0, 7);
    const carregar = async (chave, fn) => { if (extras[chave] !== undefined) return; const v = await fn(); setExtras((e) => ({ ...e, [chave]: v })); };
    if (aba === "jornada" || aba === "resumo" || aba === "remuneracao") {
      carregar("ponto", async () => ({ pontos: (await fetchPontosMes(func.id, mes)).data || [], feriados: (await fetchFeriados(func.unidade_id, mes)).data || [], banco: (await fetchBancoHorasColaborador(func.id, mes)).data || [], folgas: (await fetchFolgasEsporadicas(func.id)).data || [] }));
    }
    if (aba === "ferias") carregar("atestados", async () => (await fetchAtestados(func.id))?.data || []);
    if (aba === "documentos") carregar("docs", async () => (await fetchDocumentos(func.id))?.data || []);
    if (aba === "avaliacao") carregar("advertencias", async () => (await fetchAdvertenciasColab(func.id))?.data || []);
    if (aba === "pagamentos") carregar("recibos", async () => (await supabase.from("rh_recibos_prestacao").select("*").eq("colaborador_id", func.id).order("created_at", { ascending: false })).data || []);
  }, [aba, func]); // eslint-disable-line react-hooks/exhaustive-deps

  const gerenciado = !!sessao?.gerenciado;
  const podeEditar = !gerenciado || hasPermission(sessao, "rh.employees.edit");
  const podeDesligar = !gerenciado || hasPermission(sessao, "dp.desligamentos.solicitar") || hasPermission(sessao, "dp.desligamentos.aprovar");
  const podeVerValores = !gerenciado || hasPermission(sessao, "rh.payroll.view") || hasPermission(sessao, "rh.employees.view_values");
  const podeAprovarContrato = !gerenciado || hasPermission(sessao, "dp.contratos.aprovar");
  const podeSolicitarContrato = podeAprovarContrato || hasPermission(sessao, "dp.contratos.solicitar");

  const hoje = useMemo(() => new Date(), []);
  const status = func ? statusDoColaborador(func, hoje) : null;
  const vinculo = func ? vinculoAtual(func, hoje, vinculoReg) : null;
  const supervisores = func ? supervisoresDe(func, lista) : [];
  const pendencias = func ? pendenciasDoColaborador(func, { hoje, cct: convencao?.cct || null }) : [];
  const desligado = status?.id === "desligado";
  const opcoesDinamicas = { tipo_id: tiposB.map((t) => ({ value: t.id, label: t.nome })) };
  const tomStatus = { ok: "bg-emerald-50 text-emerald-800 border-emerald-200", aviso: "bg-amber-50 text-amber-900 border-amber-300", neutro: "bg-zinc-100 text-zinc-700 border-zinc-300" };

  const adicionais = useMemo(() => {
    if (!func || !extras.ponto || func.tipo_contrato === "Freelancer") return null;
    const rg = regrasDaCompetencia(new Date().toISOString().slice(0, 7), { convencao }).regras;
    return { rg, ad: calcularAdicionaisMes(extras.ponto.pontos, func.salario, extras.ponto.feriados, opcoesDaCasa(func, { folgas: extras.ponto.folgas, regras: rg })) };
  }, [func, extras.ponto, convencao]);

  if (erro) return <div className="min-h-screen"><PageHeader title="Prontuário" icon={User} /><PageBody><EmptyState icon={AlertTriangle} title={erro} /></PageBody></div>;
  if (!func) return <div className="min-h-screen"><PageHeader title="Prontuário" icon={User} /><PageBody><EmptyState icon={User} title="Carregando prontuário..." /></PageBody></div>;

  const extra = func.tipo_contrato === "Freelancer";

  return (
    <div className="min-h-screen pb-16">
      <style>{`@media print { .no-print, nav, header { display: none !important; } }`}</style>
      <PageHeader title="Prontuário do colaborador" subtitle={`Recursos humanos · ${unidadeInfo?.nome || ""}`} icon={User} />
      <PageBody>
        <Toast show={!!aviso}>{aviso}</Toast>

        {/* Cabeçalho do prontuário */}
        <Card className="!p-4 sm:!p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-hf-elevated flex items-center justify-center text-2xl font-black text-hf-text-2">
              {func.foto ? <img src={`data:image/jpeg;base64,${func.foto}`} alt={func.nome} className="w-full h-full object-cover" /> : func.nome?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-hf-text truncate">{func.nome}</h2>
                <span className={`text-2xs font-bold px-2 py-1 rounded-full border ${tomStatus[status.tom]}`}>{status.rotulo}</span>
              </div>
              <p className="text-sm font-semibold text-hf-text-2 mt-0.5">{func.cargo || "Função não informada"}{func.area_escala ? ` · ${func.area_escala}` : ""} · {unidadeInfo?.nome}</p>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                <p><span className="text-hf-muted">Vínculo: </span><b className="text-hf-text">{vinculo.categoria}</b> · {vinculo.fase}{vinculo.fonte === "deduzido" && <span className="text-hf-muted" title="Sem vínculo registrado: deduzido do cadastro antigo"> (do cadastro)</span>}{vinculo.alerta && <span className="text-amber-700" title={vinculo.alerta}> (atenção)</span>}</p>
                <p><span className="text-hf-muted">Supervisão: </span><b className="text-hf-text">{supervisores.length ? supervisores.join(", ") : "não definida"}</b></p>
                <p><span className="text-hf-muted">Na casa: </span><b className="text-hf-text">{tempoDeCasa(func, hoje) || "início não informado"}</b></p>
                {(() => { const a = aniversario(func, hoje); return (
                  <p><span className="text-hf-muted">Idade: </span>{a ? <><b className="text-hf-text">{a.idade} anos</b> · {a.ehHoje ? <b className="text-accent">aniversário hoje</b> : a.faltam <= 31 ? <span className="text-accent font-semibold">aniversário {a.diaMes}, faz {a.idade + 1} em {a.faltam} dia(s)</span> : <span className="text-hf-muted">aniversário {a.diaMes}</span>}</> : <span className="text-hf-muted">data de nascimento não informada</span>}</p>
                ); })()}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 no-print">
            {podeEditar && <Btn variant="primary" onClick={() => router.push(`/dashboard/rh?aba=quadro&editar=${func.id}`)}><Edit3 size={15} /> Editar</Btn>}
            <Btn variant="ghost" onClick={() => router.push(`/dashboard/rh/extra/${func.id}/recibo`)}><FileText size={15} /> Recibo</Btn>
            <Btn variant="ghost" onClick={() => window.print()}><Printer size={15} /> Imprimir</Btn>
            {!extra && <Btn variant="ghost" onClick={() => router.push(`/dashboard/rh/contrato/${func.id}`)}><FileText size={15} /> Contrato</Btn>}
            {podeDesligar && !desligado && <Btn variant="ghost" className="!text-red-700" onClick={() => router.push(`/dashboard/rh?aba=quadro&desligar=${func.id}`)}><UserX size={15} /> Desligar</Btn>}
          </div>
        </Card>

        <div className="no-print">
          <Chips options={ABAS_PRONTUARIO.map((a) => ({ value: a.id, label: a.rotulo }))} value={aba} onChange={setAba} />
        </div>

        {aba === "resumo" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <SectionLabel>Pendências</SectionLabel>
              {pendencias.length === 0 ? <p className="text-sm text-emerald-800 font-semibold">Nenhuma pendência no cadastro.</p> : (
                <ul className="space-y-2">
                  {pendencias.map((p, i) => (
                    <li key={i} className={`text-sm rounded-xl border p-2.5 ${p.nivel === "alto" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                      {p.texto}{p.fonte ? <span className="block text-2xs mt-0.5 opacity-80">{p.fonte}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <SectionLabel>Visão rápida</SectionLabel>
              <Linha rotulo="Início do vínculo" valor={dataBR(func.data_admissao) || vazio("")} />
              <Linha rotulo="Situação do contrato" valor={vinculo.detalhe || vinculo.fase} />
              {podeVerValores && !extra && <Linha rotulo="Salário base" valor={fmtBRL(func.salario)} destaque />}
              <Linha rotulo="Avaliação" valor={func.avaliacao_estrelas ? `${func.avaliacao_estrelas} de 5` : "sem avaliação"} />
              {convencao && <Linha rotulo="Convenção aplicada" valor="CCT Foz 2026/2027" />}
            </Card>
          </div>
        )}

        {aba === "pessoais" && (
          <Card>
            <SectionLabel>Identificação e contato</SectionLabel>
            <Linha rotulo="Nome completo" valor={func.nome} />
            <Linha rotulo="CPF" valor={
              <span className="inline-flex items-center gap-2">{mostrarCpf ? vazio(func.cpf) : mascararCpf(func.cpf)}
                {podeEditar && func.cpf && <button type="button" className="no-print text-hf-muted" aria-label={mostrarCpf ? "Ocultar CPF" : "Mostrar CPF"} onClick={() => setMostrarCpf((v) => !v)}>{mostrarCpf ? <EyeOff size={14} /> : <Eye size={14} />}</button>}
              </span>} />
            <Linha rotulo="RG" valor={vazio(func.rg)} />
            <Linha rotulo="Nascimento" valor={dataBR(func.data_nascimento) || vazio("")} />
            <Linha rotulo="Telefone" valor={vazio(func.telefone)} />
            <Linha rotulo="E-mail" valor={vazio(func.email)} />
            <Linha rotulo="Endereço" valor={vazio([func.rua_av, func.numero_casa, func.bairro, func.cidade_uf, func.cep].filter(Boolean).join(", "))} />
            <Linha rotulo="Estado civil" valor={vazio(func.estado_civil)} />
            <Linha rotulo="Escolaridade" valor={vazio(func.escolaridade)} />
            <Linha rotulo="Filhos" valor={Array.isArray(func.filhos) && func.filhos.length ? func.filhos.map((f) => f.nome).filter(Boolean).join(", ") : "nenhum informado"} />
          </Card>
        )}

        {aba === "contratos" && (
          <div className="space-y-4">
            <VinculosAba colaborador={func} podeSolicitar={podeSolicitarContrato} podeAprovar={podeAprovarContrato} podeVerValores={podeVerValores}
              onAviso={setAviso} onMudou={() => { recarregarColaborador(); setVersaoVinculo((n) => n + 1); }} />
            {func.data_desligamento && (
              <Card>
                <SectionLabel>Desligamento</SectionLabel>
                <Linha rotulo="Data" valor={`${dataBR(func.data_desligamento)}${func.tipo_desligamento ? ` · ${func.tipo_desligamento}` : ""}`} />
                {func.motivo_desligamento && <Linha rotulo="Motivo" valor={func.motivo_desligamento} />}
              </Card>
            )}
            {/* O histórico de mudanças fica só na aba Histórico (antes aparecia aqui também). */}
          </div>
        )}

        {aba === "jornada" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <SectionLabel>Jornada contratada</SectionLabel>
              {func.horario_por_dia && func.horarios_dia ? Object.entries(func.horarios_dia).filter(([, h]) => h?.e && h?.s).map(([d, h]) => (
                <Linha key={d} rotulo={DIAS[Number(d)] || d} valor={`${h.e} às ${h.s}`} />
              )) : <Linha rotulo="Horário" valor={func.horario_entrada && func.horario_saida ? `${func.horario_entrada} às ${func.horario_saida}` : vazio("")} />}
              {(func.horario_dom_entrada || func.horario_dom_saida) && <Linha rotulo="Domingo" valor={`${func.horario_dom_entrada || "?"} às ${func.horario_dom_saida || "?"}`} />}
              <Linha rotulo="Intervalo" valor={func.intervalo_inicio && func.intervalo_fim ? `${func.intervalo_inicio} às ${func.intervalo_fim}` : `${func.tempo_intervalo || 60} min`} />
              <Linha rotulo="Dias de trabalho" valor={(func.dias_trabalho || "").split(",").filter(Boolean).map((d) => DIAS[Number(d)]).join(", ") || vazio("")} />
            </Card>
            <Card>
              <SectionLabel>Ponto do mês</SectionLabel>
              {!extras.ponto ? <p className="text-sm text-hf-muted">Carregando...</p> : (
                <>
                  <Linha rotulo="Dias com batida" valor={extras.ponto.pontos.filter((p) => p.hora_entrada).length} />
                  <Linha rotulo="Banco de horas no mês" valor={`${Math.round(somaMinutosBanco(extras.ponto.banco) / 6) / 10} h`} />
                  <div className="mt-3 flex flex-wrap gap-2 no-print">
                    <Btn variant="ghost" onClick={() => router.push(`/dashboard/rh/espelho/${func.id}?mes=${new Date().toISOString().slice(0, 7)}`)}><Clock size={15} /> Abrir espelho de ponto</Btn>
                    <Btn variant="ghost" onClick={() => router.push(`/dashboard/rh/ponto/corrigir?colab=${func.id}&data=${new Date().toISOString().slice(0, 10)}`)}><Clock size={15} /> Ajustar / Corrigir ponto</Btn>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}

        {aba === "remuneracao" && (
          <div className="space-y-4">
            {podeVerValores ? (
              <Card>
                <SectionLabel>Remuneração</SectionLabel>
                {extra ? <Linha rotulo="Forma" valor="Diárias por serviço prestado (ver Pagamentos e recibos)" /> : (
                  <>
                    <Linha rotulo="Salário base" valor={fmtBRL(func.salario)} destaque />
                    <Linha rotulo="Vale-alimentação" valor={fmtBRL(func.vale_alimentacao)} />
                    <Linha rotulo="Vale-transporte" valor={func.usa_vale_transporte ? (func.vale_transporte_val ? fmtBRL(func.vale_transporte_val) : "sim (valor não informado)") : "não usa"} />
                    <Linha rotulo="Taxa de serviço" valor={func.pontos_taxa != null ? `${func.pontos_taxa} ponto(s)` : "sem pontos definidos"} />
                    {adicionais && (
                      <>
                        <Linha rotulo={`Adicional noturno do mês (${adicionais.rg.noturnoPct}%)`} valor={fmtBRL(adicionais.ad.valorNoturno)} />
                        <Linha rotulo={`Horas extras do mês (+${adicionais.rg.extraPct}%)`} valor={fmtBRL(adicionais.ad.valorExtra)} />
                        <p className="text-2xs text-hf-muted mt-2">Prévia do mês pelo ponto. Regra: {adicionais.rg.id === "clt" ? "CLT" : "CCT Foz 2026/2027 (cl. 10 e 13)"}.</p>
                      </>
                    )}
                  </>
                )}
              </Card>
            ) : <EmptyState icon={DollarSign} title="Sem permissão para ver valores de remuneração." />}
            {podeVerValores && !extra && <SimulacaoMes colaborador={func} competencia={new Date().toISOString().slice(0, 7)} ponto={extras.ponto} adicionais={adicionais} podeRegistrar={!gerenciado || hasPermission(sessao, "rh.payroll.manage")} podeValidar={!gerenciado || hasPermission(sessao, "dp.calculos.validar")} onAviso={setAviso} />}
            {podeVerValores && <ListaDoProntuario chave="bonificacoes" func={func} podeEditar={podeEditar} opcoesDinamicas={opcoesDinamicas} onAviso={setAviso} />}
          </div>
        )}

        {aba === "pagamentos" && (
          <div className="space-y-4">
            {podeVerValores ? <ListaDoProntuario chave="holerites" func={func} podeEditar={podeEditar} opcoesDinamicas={opcoesDinamicas} onAviso={setAviso} /> : <EmptyState icon={DollarSign} title="Sem permissão para ver pagamentos." />}
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <SectionLabel className="!mb-0">Recibos de pagamento (2 vias A4)</SectionLabel>
                <div className="no-print">
                  <Btn variant="primary" onClick={() => router.push(`/dashboard/rh/extra/${func.id}/recibo`)}>
                    <FileText size={15} /> + Emitir Recibo (2 vias)
                  </Btn>
                </div>
              </div>
              {!extras.recibos ? (
                <p className="text-sm text-hf-muted">Carregando...</p>
              ) : extras.recibos.length === 0 ? (
                <p className="text-sm text-hf-muted">Nenhum recibo emitido.</p>
              ) : (
                <div className="space-y-2.5">
                  {extras.recibos.map((r) => {
                    const diasDet = Array.isArray(r.dados?.dias_detalhados) ? r.dados.dias_detalhados.filter((d) => d && (d.data || Number(d.valor) > 0)) : [];
                    const descItens = Array.isArray(r.dados?.descontos_itens) ? r.dados.descontos_itens.filter((d) => d && (d.descricao || Number(d.valor) > 0)) : [];
                    const vDin = Number(r.dados?.valor_dinheiro) || 0;
                    const vPix = Number(r.dados?.valor_pix) || 0;
                    return (
                      <div key={r.id} className="rounded-xl border border-hf-border bg-hf-surface p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-black text-hf-text">
                              Nº {r.numero || "—"} · {dataBR(r.data_trabalho) || ""} · {r.dias_contratados || diasDet.length || 1} dia(s)
                            </p>
                            <p className="mt-0.5 font-semibold text-hf-text-2">
                              {podeVerValores ? <b className="text-emerald-700">{fmtBRL(r.valor_total)}</b> : "—"} ·{" "}
                              {r.pagamento_realizado ? `Pago em ${dataBR(r.data_pagamento) || ""}` : "Pagamento pendente"}
                              {podeVerValores && (vDin > 0 || vPix > 0) && (
                                <span className="ml-1 text-hf-muted">
                                  ({vDin > 0 && vPix > 0
                                    ? `${fmtBRL(vDin)} Dinheiro + ${fmtBRL(vPix)} Pix`
                                    : vDin > 0
                                    ? `${fmtBRL(vDin)} Dinheiro`
                                    : `${fmtBRL(vPix)} Pix`})
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="no-print">
                            <Btn
                              variant="ghost"
                              onClick={() => imprimirReciboExtra({ extra: func, recibo: r, unidade: unidadeInfo, unidadeNome: unidadeInfo?.nome, textos: {} })}
                            >
                              <Printer size={14} /> Imprimir (2 vias)
                            </Btn>
                          </div>
                        </div>
                        {podeVerValores && diasDet.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {diasDet.map((d, idx) => (
                              <span key={idx} className="rounded-md border border-hf-border bg-hf-elevated px-2 py-0.5 text-2xs font-bold text-hf-text-2">
                                {d.dia_semana ? `${d.dia_semana} ` : ""}{dataBR(d.data)}: {fmtBRL(d.valor)}
                              </span>
                            ))}
                          </div>
                        )}
                        {podeVerValores && descItens.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {descItens.map((d, idx) => (
                              <span key={idx} className="rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-2xs font-bold text-rose-700">
                                - {d.descricao || "Item"}: {fmtBRL(d.valor)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {aba === "ferias" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <SectionLabel>Férias</SectionLabel>
              {extra || !func.data_admissao ? <p className="text-sm text-hf-muted">{extra ? "Trabalho eventual: sem período aquisitivo." : "Informe a data de início para calcular."}</p> : (() => {
                const av = avosFerias({ inicioPeriodo: func.data_admissao, fim: new Date().toISOString().slice(0, 10) });
                return (<>
                  <Linha rotulo="Avos no período (SIMULAÇÃO)" valor={`${av.avos}/12 + 1/3`} />
                  <p className="text-2xs text-hf-muted mt-2">Ainda não há registro de férias gozadas no Héfisto: o número considera o vínculo desde o início. Base: {av.fundamentos.join("; ")}.</p>
                </>);
              })()}
            </Card>
            <Card>
              <SectionLabel>Atestados e afastamentos</SectionLabel>
              {!extras.atestados ? <p className="text-sm text-hf-muted">Carregando...</p> : extras.atestados.length === 0 ? <p className="text-sm text-hf-muted">Nenhum atestado.</p> : extras.atestados.map((a) => (
                <Linha key={a.id} rotulo={`${dataBR(a.data_inicio)}${a.data_fim && a.data_fim !== a.data_inicio ? ` a ${dataBR(a.data_fim)}` : ""}`} valor={a.parcial ? "parcial" : "dia inteiro"} />
              ))}
            </Card>
          </div>
        )}

        {aba === "documentos" && (
          <div className="space-y-4">
            <Card>
              <SectionLabel>Documentos</SectionLabel>
              {!extras.docs ? <p className="text-sm text-hf-muted">Carregando...</p> : extras.docs.length === 0 ? <p className="text-sm text-hf-muted">Nenhum documento anexado.</p> : extras.docs.map((d) => (
                <Linha key={d.id} rotulo={d.tipo || "Documento"} valor={d.nome_arquivo || dataBR(d.created_at)} />
              ))}
            </Card>
            <ListaDoProntuario chave="cursos" func={func} podeEditar={podeEditar} opcoesDinamicas={opcoesDinamicas} onAviso={setAviso} />
          </div>
        )}

        {aba === "avaliacao" && (
          <div className="space-y-4">
            <Card>
              <SectionLabel>Avaliação</SectionLabel>
              <Linha rotulo="Nota" valor={func.avaliacao_estrelas ? `${func.avaliacao_estrelas} de 5` : "sem avaliação"} destaque />
              <SectionLabel>Advertências</SectionLabel>
              {!extras.advertencias ? <p className="text-sm text-hf-muted">Carregando...</p> : extras.advertencias.length === 0 ? <p className="text-sm text-hf-muted">Nenhuma advertência.</p> : extras.advertencias.map((a) => (
                <Linha key={a.id} rotulo={`${dataBR(a.data)} · ${a.gravidade || ""}`} valor={a.motivo} />
              ))}
            </Card>
            <ListaDoProntuario chave="producoes" func={func} podeEditar={podeEditar} opcoesDinamicas={opcoesDinamicas} onAviso={setAviso} />
          </div>
        )}

        {aba === "historico" && (
          <div className="space-y-4">
            <ListaDoProntuario chave="historico" func={func} podeEditar={podeEditar} opcoesDinamicas={opcoesDinamicas} onAviso={setAviso} />
            <ListaDoProntuario chave="atas" func={func} podeEditar={podeEditar} opcoesDinamicas={opcoesDinamicas} onAviso={setAviso} />
            <ListaDoProntuario chave="avisos" func={func} podeEditar={podeEditar} opcoesDinamicas={opcoesDinamicas} onAviso={setAviso} />
          </div>
        )}
      </PageBody>
    </div>
  );
}
