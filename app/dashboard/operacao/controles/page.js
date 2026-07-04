"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Flame, Droplets, Plus, Clock, CheckCircle2, Trash2, CalendarClock, Wind, CalendarCheck } from "lucide-react";
import { PageHeader, PageBody, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";

function formatarDataHora(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}
import {
  fetchControleLimpeza, inserirControleLimpeza, finalizarControleLimpeza, excluirControleLimpeza,
  fetchControleGas, inserirControleGas, finalizarControleGas, excluirControleGas,
  fetchControleOleo, inserirControleOleo, finalizarControleOleo, registrarFiltragemOleo, excluirControleOleo,
  fetchManutencoes, inserirManutencao, registrarExecucaoManutencao, excluirManutencao,
  calcularProximaData, PRESETS_MANUTENCAO
} from "../../../lib/controles_cozinha";

// Situação de uma limpeza programada a partir da próxima data prevista.
function statusManutencao(proxima) {
  if (!proxima) return { label: "Sem agenda", cor: "bg-slate-100 text-slate-500", dias: null };
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(proxima + "T00:00:00");
  const dias = Math.round((alvo - hoje) / 86400000);
  if (dias < 0) return { label: `Atrasada ${Math.abs(dias)}d`, cor: "bg-rose-100 text-rose-700", dias };
  if (dias === 0) return { label: "Vence hoje", cor: "bg-orange-100 text-orange-700", dias };
  if (dias <= 3) return { label: `Vence em ${dias}d`, cor: "bg-amber-100 text-amber-700", dias };
  return { label: `Em dia (${dias}d)`, cor: "bg-emerald-100 text-emerald-700", dias };
}

function formatarData(iso) {
  if (!iso) return "—";
  const s = iso.length <= 10 ? iso + "T00:00:00" : iso;
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function calcularDuracao(inicio, fim) {
  if (!inicio) return "N/A";
  const d1 = new Date(inicio);
  const d2 = fim ? new Date(fim) : new Date();
  const diffHoras = Math.abs(d2 - d1) / 36e5;
  if (diffHoras < 24) return `${Math.floor(diffHoras)} horas`;
  return `${Math.floor(diffHoras / 24)} dias`;
}

export default function ControlesCozinha() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [abaAtiva, setAbaAtiva] = useState("limpeza"); // limpeza, gas, oleo
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState([]);
  const [toast, setToast] = useState("");

  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState({});
  // Modal de "registrar execução" de uma limpeza programada
  const [execAlvo, setExecAlvo] = useState(null);
  const [execForm, setExecForm] = useState({});

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") {
      setDados([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let res = { data: [] };
    if (abaAtiva === "limpeza") res = await fetchControleLimpeza(unidadeAtiva);
    if (abaAtiva === "gas") res = await fetchControleGas(unidadeAtiva);
    if (abaAtiva === "oleo") res = await fetchControleOleo(unidadeAtiva);
    if (abaAtiva === "agenda") res = await fetchManutencoes(unidadeAtiva);

    setDados(res.data || []);
    setLoading(false);
  }, [unidadeAtiva, abaAtiva]);

  useEffect(() => { carregar(); }, [carregar]);

  const notificar = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  async function salvarNovo(e) {
    e.preventDefault();
    let res;
    if (abaAtiva === "limpeza") {
      res = await inserirControleLimpeza({
        unidade_id: unidadeAtiva,
        produto: form.produto,
        volume: form.volume,
        diluicao: form.diluicao || "",
        fornecedor_nome: form.fornecedor_nome || "",
        fornecedor_cnpj: form.fornecedor_cnpj || "",
        preco: Number(form.preco) || 0,
        inicio_uso: form.inicio_uso || new Date().toISOString()
      });
    } else if (abaAtiva === "gas") {
      res = await inserirControleGas({
        unidade_id: unidadeAtiva,
        identificacao: form.identificacao,
        peso_inicial: Number(form.peso_inicial) || 0,
        inicio_uso: form.inicio_uso || new Date().toISOString()
      });
    } else if (abaAtiva === "oleo") {
      res = await inserirControleOleo({
        unidade_id: unidadeAtiva,
        identificacao: form.identificacao,
        volume_litros: Number(form.volume_litros) || 0,
        inicio_uso: form.inicio_uso || new Date().toISOString()
      });
    } else if (abaAtiva === "agenda") {
      if (!form.nome) { alert("Informe o nome da limpeza."); return; }
      const freq = Number(form.frequencia_dias) || 30;
      res = await inserirManutencao({
        unidade_id: unidadeAtiva,
        nome: form.nome,
        categoria: form.categoria || "outro",
        frequencia_dias: freq,
        responsavel: form.responsavel || "",
        observacao: form.observacao || "",
        ultima_execucao: form.ultima_execucao ? new Date(form.ultima_execucao).toISOString() : null,
        proxima_prevista: form.proxima_prevista || calcularProximaData(form.ultima_execucao ? new Date(form.ultima_execucao).toISOString() : null, freq),
      });
    }

    if (res?.error) { alert("Erro: " + res.error); return; }
    notificar(abaAtiva === "agenda" ? "Limpeza agendada!" : "Registro iniciado com sucesso!");
    setModalNovo(false);
    setForm({});
    carregar();
  }

  // Registrar que uma limpeza programada foi feita (recalcula a próxima)
  async function confirmarExecucao(e) {
    e.preventDefault();
    const r = await registrarExecucaoManutencao(execAlvo, {
      data: execForm.data ? new Date(execForm.data).toISOString() : new Date().toISOString(),
      responsavel: execForm.responsavel || "",
      observacao: execForm.observacao || "",
    });
    if (r?.error) { alert("Erro: " + r.error); return; }
    notificar("Limpeza registrada. Próxima data reagendada!");
    setExecAlvo(null);
    setExecForm({});
    carregar();
  }

  async function marcarFim(id) {
    if (!confirm("Deseja finalizar (dar baixa) neste item agora?")) return;
    if (abaAtiva === "limpeza") await finalizarControleLimpeza(id);
    if (abaAtiva === "gas") await finalizarControleGas(id);
    if (abaAtiva === "oleo") await finalizarControleOleo(id);
    notificar("Ciclo finalizado!");
    carregar();
  }

  async function excluir(id) {
    if (!confirm("Excluir este registro permanentemente?")) return;
    if (abaAtiva === "limpeza") await excluirControleLimpeza(id);
    if (abaAtiva === "gas") await excluirControleGas(id);
    if (abaAtiva === "oleo") await excluirControleOleo(id);
    if (abaAtiva === "agenda") await excluirManutencao(id);
    notificar("Registro excluído.");
    carregar();
  }

  async function adicionarFiltragem(id, arrayAtual) {
    await registrarFiltragemOleo(id, arrayAtual, new Date().toISOString());
    notificar("Filtragem registrada com sucesso!");
    carregar();
  }

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="min-h-screen">
        <PageHeader title="Controles Operacionais" subtitle="Limpeza, Gás e Óleo" icon={CalendarClock} />
        <PageBody>
          <EmptyState icon={CalendarClock} title="Selecione uma unidade" hint="Para acessar os controles, selecione a unidade no menu lateral." />
        </PageBody>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <PageHeader 
        title={`Controles da Cozinha: ${unidadeInfo?.nome}`} 
        subtitle="Monitore o uso e ciclo de vida de insumos de limpeza, gás e óleo." 
        icon={CalendarClock} 
      />
      
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        {/* Abas */}
        <div className="flex gap-4 mb-6 border-b border-slate-200">
          <button onClick={() => setAbaAtiva("limpeza")} className={`pb-3 font-bold text-sm tracking-wide transition-colors flex items-center gap-2 border-b-2 ${abaAtiva === "limpeza" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            <Sparkles size={16} /> Limpeza
          </button>
          <button onClick={() => setAbaAtiva("gas")} className={`pb-3 font-bold text-sm tracking-wide transition-colors flex items-center gap-2 border-b-2 ${abaAtiva === "gas" ? "border-orange-500 text-orange-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            <Flame size={16} /> Gás
          </button>
          <button onClick={() => setAbaAtiva("oleo")} className={`pb-3 font-bold text-sm tracking-wide transition-colors flex items-center gap-2 border-b-2 ${abaAtiva === "oleo" ? "border-amber-500 text-amber-600" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            <Droplets size={16} /> Óleo de Fritura
          </button>
          <button onClick={() => setAbaAtiva("agenda")} className={`pb-3 font-bold text-sm tracking-wide transition-colors flex items-center gap-2 border-b-2 ${abaAtiva === "agenda" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}>
            <CalendarCheck size={16} /> Agenda de Limpezas
          </button>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-slate-800">
            {abaAtiva === "limpeza" && "Histórico de Produtos de Limpeza"}
            {abaAtiva === "gas" && "Trocas de Botijão de Gás"}
            {abaAtiva === "oleo" && "Ciclos do Óleo da Fritadeira"}
            {abaAtiva === "agenda" && "Limpezas Programadas"}
          </h2>
          <Btn variant="primary" onClick={() => setModalNovo(true)}>
            <Plus size={18} /> {abaAtiva === "agenda" ? "Agendar Limpeza" : "Iniciar Novo Uso"}
          </Btn>
        </div>

        {loading ? (
          <EmptyState icon={Clock} title="Carregando..." />
        ) : dados.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Nenhum registro" hint="Inicie o uso de um novo item para começar a rastrear." />
        ) : abaAtiva === "agenda" ? (
          <div className="space-y-4">
            {dados.map(item => {
              const st = statusManutencao(item.proxima_prevista);
              const atrasada = st.dias !== null && st.dias <= 0;
              return (
                <div key={item.id} className={`p-5 rounded-2xl border bg-white shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${atrasada ? 'border-rose-300' : 'border-slate-200'}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${st.cor}`}>{st.label}</span>
                      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        {item.categoria === "ar_condicionado" ? <Wind size={18} className="text-sky-500" /> : <Sparkles size={18} className="text-emerald-500" />}
                        {item.nome}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-1"><CalendarClock size={14} className="text-slate-400" /> Próxima: <b className="text-slate-800">{formatarData(item.proxima_prevista)}</b></div>
                      <div className="flex items-center gap-1"><CheckCircle2 size={14} className="text-slate-400" /> Última: <b>{formatarData(item.ultima_execucao)}</b></div>
                      <div className="flex items-center gap-1">A cada <b>{item.frequencia_dias} dias</b></div>
                      {item.responsavel && <div className="flex items-center gap-1">Responsável: <b>{item.responsavel}</b></div>}
                    </div>
                    {item.observacao && <p className="mt-2 text-xs text-slate-500">{item.observacao}</p>}
                    {item.historico?.length > 0 && (
                      <div className="mt-3 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block">
                        <span className="font-bold text-slate-600">Histórico ({item.historico.length}):</span>
                        <div className="flex gap-2 flex-wrap mt-1">
                          {item.historico.slice(0, 6).map((h, i) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-medium" title={h.responsavel || ""}>{formatarData(h.data)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                    <button onClick={() => { setExecAlvo(item); setExecForm({}); }} className="w-full md:w-auto px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-sm rounded-lg transition-colors">
                      Registrar Limpeza Feita
                    </button>
                    <button onClick={() => excluir(item.id)} className="w-full md:w-auto p-2 text-slate-400 hover:text-red-500 flex justify-center rounded-lg transition-colors" title="Excluir agendamento">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {dados.map(item => (
              <div key={item.id} className={`p-5 rounded-2xl border bg-white shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center ${item.fim_uso ? 'opacity-70 border-slate-200' : 'border-slate-300'}`}>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded-md ${item.fim_uso ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                      {item.fim_uso ? "Finalizado" : "Em Uso"}
                    </span>
                    <h3 className="font-bold text-lg text-slate-800">
                      {abaAtiva === "limpeza" && item.produto}
                      {abaAtiva === "gas" && item.identificacao}
                      {abaAtiva === "oleo" && item.identificacao}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-1"><Clock size={14} className="text-slate-400" /> Início: <b>{formatarDataHora(item.inicio_uso)}</b></div>
                    {item.fim_uso && <div className="flex items-center gap-1"><CheckCircle2 size={14} className="text-slate-400" /> Fim: <b>{formatarDataHora(item.fim_uso)}</b></div>}
                    
                    <div className="flex items-center gap-1">
                      Duração: <b className="text-slate-800">{calcularDuracao(item.inicio_uso, item.fim_uso)}</b>
                      {!item.fim_uso && " (até agora)"}
                    </div>
                  </div>

                  {/* Informações Específicas por Aba */}
                  {abaAtiva === "limpeza" && (
                    <div className="mt-3 text-xs flex flex-wrap gap-4 text-slate-500">
                      <span>Volume: <b>{item.volume}</b></span>
                      {item.diluicao && <span>Diluição: <b>{item.diluicao}</b></span>}
                      <span>Custo: <b>R$ {Number(item.preco).toFixed(2)}</b></span>
                      {item.fornecedor_nome && <span>Fornecedor: <b>{item.fornecedor_nome} {item.fornecedor_cnpj && `(${item.fornecedor_cnpj})`}</b></span>}
                    </div>
                  )}

                  {abaAtiva === "gas" && item.peso_inicial > 0 && (
                    <div className="mt-3 text-xs text-slate-500">
                      <span>Peso: <b>{item.peso_inicial} kg</b></span>
                    </div>
                  )}

                  {abaAtiva === "oleo" && (
                    <div className="mt-3 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block">
                      <span className="block mb-1">Volume: <b>{item.volume_litros} L</b></span>
                      <span className="block mb-1">Filtragens realizadas: <b>{item.filtragens?.length || 0}</b></span>
                      {item.filtragens?.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-1">
                          {item.filtragens.map((f, i) => (
                            <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">{formatarDataHora(f)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                  {!item.fim_uso && abaAtiva === "oleo" && (
                    <button onClick={() => adicionarFiltragem(item.id, item.filtragens)} className="w-full md:w-auto px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold text-sm rounded-lg transition-colors">
                      Registrar Filtragem
                    </button>
                  )}
                  {!item.fim_uso && (
                    <button onClick={() => marcarFim(item.id)} className="w-full md:w-auto px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 font-bold text-sm rounded-lg transition-colors">
                      Finalizar / Descartar
                    </button>
                  )}
                  <button onClick={() => excluir(item.id)} className="w-full md:w-auto p-2 text-slate-400 hover:text-red-500 flex justify-center rounded-lg transition-colors" title="Excluir Registro">
                    <Trash2 size={16} />
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </PageBody>

      <Modal open={modalNovo} onClose={() => setModalNovo(false)} title={
        abaAtiva === "limpeza" ? "Novo Produto em Uso" :
        abaAtiva === "gas" ? "Novo Botijão Instalado" :
        abaAtiva === "agenda" ? "Agendar Limpeza Periódica" :
        "Óleo Novo Abastecido"
      }>
        <form onSubmit={salvarNovo}>

          {abaAtiva === "agenda" && (
            <>
              <Field label="Modelos rápidos">
                <div className="flex flex-wrap gap-2">
                  {PRESETS_MANUTENCAO.map((p) => (
                    <button type="button" key={p.nome}
                      onClick={() => setForm({ ...form, nome: p.nome, categoria: p.categoria, frequencia_dias: p.frequencia_dias })}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors">
                      {p.nome}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Nome da limpeza">
                <TextInput value={form.nome || ""} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Limpeza da Coifa" required />
              </Field>
              <div className="flex gap-4">
                <Field label="Tipo">
                  <Select value={form.categoria || "outro"} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    <option value="coifa">Coifa</option>
                    <option value="ar_condicionado">Ar-condicionado</option>
                    <option value="outro">Outro</option>
                  </Select>
                </Field>
                <Field label="Repetir a cada (dias)">
                  <NumberInput value={form.frequencia_dias || ""} onChange={e => setForm({ ...form, frequencia_dias: e.target.value })} placeholder="30" required />
                </Field>
              </div>
              <div className="flex gap-4">
                <Field label="Última vez feita (opcional)">
                  <input type="date" value={form.ultima_execucao || ""} onChange={e => setForm({ ...form, ultima_execucao: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-slate-400" />
                </Field>
                <Field label="Próxima (deixe vazio p/ calcular)">
                  <input type="date" value={form.proxima_prevista || ""} onChange={e => setForm({ ...form, proxima_prevista: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-slate-400" />
                </Field>
              </div>
              <Field label="Responsável (opcional)">
                <TextInput value={form.responsavel || ""} onChange={e => setForm({ ...form, responsavel: e.target.value })} placeholder="Ex: Empresa X / João" />
              </Field>
              <Field label="Observações (opcional)">
                <TextInput value={form.observacao || ""} onChange={e => setForm({ ...form, observacao: e.target.value })} placeholder="Ex: contato do técnico, detalhes..." />
              </Field>
            </>
          )}
          
          {abaAtiva === "limpeza" && (
            <>
              <Field label="Nome do Produto">
                <TextInput value={form.produto || ""} onChange={e => setForm({...form, produto: e.target.value})} placeholder="Ex: Detergente Neutro, Desengordurante..." required />
              </Field>
              <div className="flex gap-4">
                <Field label="Volume / Qtd">
                  <TextInput value={form.volume || ""} onChange={e => setForm({...form, volume: e.target.value})} placeholder="Ex: 5 Litros" required />
                </Field>
                <Field label="Custo (R$)">
                  <NumberInput value={form.preco || ""} onChange={e => setForm({...form, preco: e.target.value})} placeholder="0.00" />
                </Field>
              </div>
              <div className="flex gap-4">
                <Field label="Fornecedor / Loja">
                  <TextInput value={form.fornecedor_nome || ""} onChange={e => setForm({...form, fornecedor_nome: e.target.value})} placeholder="Ex: Atacadão..." />
                </Field>
                <Field label="CNPJ (opcional)">
                  <TextInput value={form.fornecedor_cnpj || ""} onChange={e => setForm({...form, fornecedor_cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                </Field>
              </div>
              <Field label="Diluição (se houver)">
                <TextInput value={form.diluicao || ""} onChange={e => setForm({...form, diluicao: e.target.value})} placeholder="Ex: 1 parte p/ 50" />
              </Field>
            </>
          )}

          {abaAtiva === "gas" && (
            <>
              <Field label="Identificação do Botijão">
                <TextInput value={form.identificacao || ""} onChange={e => setForm({...form, identificacao: e.target.value})} placeholder="Ex: P13 - Fogão Principal" required />
              </Field>
              <Field label="Peso Inicial (kg) Opcional">
                <NumberInput value={form.peso_inicial || ""} onChange={e => setForm({...form, peso_inicial: e.target.value})} placeholder="Ex: 13" />
              </Field>
            </>
          )}

          {abaAtiva === "oleo" && (
            <>
              <Field label="Fritadeira / Equipamento">
                <TextInput value={form.identificacao || ""} onChange={e => setForm({...form, identificacao: e.target.value})} placeholder="Ex: Fritadeira 1, Tacho..." required />
              </Field>
              <Field label="Volume Abastecido (Litros)">
                <NumberInput value={form.volume_litros || ""} onChange={e => setForm({...form, volume_litros: e.target.value})} placeholder="Ex: 18" required />
              </Field>
            </>
          )}

          {abaAtiva !== "agenda" && (
            <Field label="Data/Hora de Início (opcional, padrão: agora)">
              <input type="datetime-local" value={form.inicio_uso || ""} onChange={e => setForm({...form, inicio_uso: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-slate-400" />
            </Field>
          )}

          <div className="mt-6 flex gap-3">
            <Btn type="button" variant="ghost" className="flex-1" onClick={() => setModalNovo(false)}>Cancelar</Btn>
            <Btn type="submit" variant="primary" className="flex-1">{abaAtiva === "agenda" ? "Agendar" : "Salvar e Iniciar"}</Btn>
          </div>
        </form>
      </Modal>

      {/* Registrar que uma limpeza programada foi executada */}
      <Modal open={!!execAlvo} onClose={() => setExecAlvo(null)} title={execAlvo ? `Registrar: ${execAlvo.nome}` : ""}>
        <form onSubmit={confirmarExecucao}>
          <p className="text-sm text-slate-500 mb-4">Ao registrar, a próxima limpeza será reagendada automaticamente para daqui a <b>{execAlvo?.frequencia_dias} dias</b>.</p>
          <Field label="Data em que foi feita">
            <input type="date" value={execForm.data || ""} onChange={e => setExecForm({ ...execForm, data: e.target.value })} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-slate-400" />
            <span className="text-[11px] text-slate-400 mt-1 block">Deixe vazio para usar hoje.</span>
          </Field>
          <Field label="Responsável (opcional)">
            <TextInput value={execForm.responsavel || ""} onChange={e => setExecForm({ ...execForm, responsavel: e.target.value })} placeholder="Quem fez / empresa" />
          </Field>
          <Field label="Observações (opcional)">
            <TextInput value={execForm.observacao || ""} onChange={e => setExecForm({ ...execForm, observacao: e.target.value })} placeholder="Ex: troca de filtro, nota fiscal..." />
          </Field>
          <div className="mt-6 flex gap-3">
            <Btn type="button" variant="ghost" className="flex-1" onClick={() => setExecAlvo(null)}>Cancelar</Btn>
            <Btn type="submit" variant="primary" className="flex-1">Confirmar</Btn>
          </div>
        </form>
      </Modal>

    </div>
  );
}
