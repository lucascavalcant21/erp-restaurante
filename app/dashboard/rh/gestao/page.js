"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Users, Wallet, UserCheck, Edit3, Trash2, Settings2, Upload, Image as ImageIcon, Smartphone } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL,
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchFuncionarios, inserirFuncionario, atualizarFuncionario, removerFuncionario, fetchCargos, fetchTurnos } from "../../../lib/rh";
import { podeEditarGlobal, getPapel, registrarUsuario, formatarParaEmailFantasma } from "../../../lib/auth";
import { uploadAnexo } from "../../../lib/pessoas"; // reaproveitando a func de upload

const VAZIO = { 
  nome: "", cargo: "", turno: "", salario: "", admissao: "", 
  telefone: "", email: "", ativo: true, supervisor_id: "",
  foto_url: "", funcoes_exercidas: "", tipo_contrato: "CLT Fixo", fim_experiencia: "", unidade_id: ""
};

const TIPOS_CONTRATO = ["CLT Fixo", "Experiência", "Estágio", "Temporário", "PJ / Prestador", "Outro"];

function FormFunc({ inicial, onSalvar, onCancelar, listaFuncionarios = [], cargos = [], turnos = [], isAdmin, unidades = [], unidadeAtiva }) {
  const [f, setF] = useState(inicial ? { ...inicial, salario: String(inicial.salario ?? ""), supervisor_id: inicial.supervisor_id || "", unidade_id: inicial.unidade_id || unidadeAtiva } : { ...VAZIO, unidade_id: unidadeAtiva === "todas" ? "" : unidadeAtiva });
  const [erro, setErro] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const set = (k, v) => { 
    setF((p) => {
      const next = { ...p, [k]: v };
      
      // Auto-preenchimento das funções padrão
      if (k === "cargo" && cargos.length > 0) {
        const cargoSelecionado = cargos.find(c => c.nome === v);
        if (cargoSelecionado?.funcoes_padrao) {
          next.funcoes_exercidas = cargoSelecionado.funcoes_padrao;
        }
      }
      
      return next;
    }); 
    setErro(""); 
  };

  async function handleFotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErro("");
    const res = await uploadAnexo(file, `fotos/${Date.now()}_${file.name}`);
    if (res.error) setErro("Erro ao fazer upload da foto.");
    else set("foto_url", res.url);
    setUploading(false);
  }

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome.");
    if (isAdmin && !f.unidade_id && unidadeAtiva === "todas") return setErro("Selecione a Unidade de Trabalho.");
    if (cargos.length === 0 && !f.cargo) f.cargo = "Outro"; // fallback
    if (turnos.length === 0 && !f.turno) f.turno = "Integral"; // fallback

    const sup_id = f.supervisor_id === "" ? null : f.supervisor_id;
    const unidadeFinal = f.unidade_id || unidadeAtiva;
    
    onSalvar({ 
      ...f, 
      nome: f.nome.trim(), 
      salario: Number(f.salario) || 0, 
      supervisor_id: sup_id,
      unidade_id: unidadeFinal,
      fim_experiencia: f.fim_experiencia || null
    });
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-2 pb-4 space-y-4">
      {/* Upload de Foto */}
      <div className="flex flex-col items-center gap-2 mb-2">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="w-20 h-20 rounded-full border-2 border-dashed border-[var(--line)] flex items-center justify-center cursor-pointer overflow-hidden group relative"
          style={{ background: "var(--elevated)" }}
        >
          {f.foto_url ? (
            <img src={f.foto_url} alt="Foto 3x4" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={24} style={{ color: "var(--muted)" }} />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Upload size={20} className="text-white" />
          </div>
        </div>
        <p className="text-[11px] font-medium" style={{ color: "var(--dim)" }}>
          {uploading ? "Enviando..." : "Foto 3x4 (Opcional)"}
        </p>
        <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFotoUpload} />
      </div>

      <Field label="Nome completo"><TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Ana Souza" /></Field>
      
      {isAdmin && unidadeAtiva === "todas" && (
        <Field label="Unidade de Trabalho">
          <Select value={f.unidade_id} onChange={e => set("unidade_id", e.target.value)}>
            <option value="">Selecione a loja...</option>
            {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </Select>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cargo">
          <Select value={f.cargo} onChange={(e) => set("cargo", e.target.value)}>
            <option value="">Selecione...</option>
            {cargos.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </Select>
        </Field>
        <Field label="Turno">
          <Select value={f.turno} onChange={(e) => set("turno", e.target.value)}>
            <option value="">Selecione...</option>
            {turnos.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Funções que irá exercer">
        <TextInput value={f.funcoes_exercidas || ""} onChange={e => set("funcoes_exercidas", e.target.value)} placeholder="Ex: Limpeza, Atendimento, etc." />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo de Contrato">
          <Select value={f.tipo_contrato || "CLT Fixo"} onChange={e => set("tipo_contrato", e.target.value)}>
            {TIPOS_CONTRATO.map(tc => <option key={tc} value={tc}>{tc}</option>)}
          </Select>
        </Field>
        {f.tipo_contrato === "Experiência" && (
          <Field label="Fim da Experiência">
            <TextInput type="date" value={f.fim_experiencia || ""} onChange={e => set("fim_experiencia", e.target.value)} />
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Salário (R$)"><NumberInput value={f.salario} onChange={(e) => set("salario", e.target.value)} placeholder="0,00" step="0.01" /></Field>
        <Field label="Admissão"><TextInput type="date" value={f.admissao} onChange={(e) => set("admissao", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone"><TextInput value={f.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 9..." /></Field>
        <Field label="Situação"><Select value={f.ativo ? "1" : "0"} onChange={(e) => set("ativo", e.target.value === "1")}><option value="1">Ativo</option><option value="0">Inativo</option></Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="E-mail"><TextInput value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="email@..." /></Field>
        <Field label="Supervisor (Opcional)">
          <Select value={f.supervisor_id} onChange={(e) => set("supervisor_id", e.target.value)}>
            <option value="">Nenhum</option>
            {listaFuncionarios.filter(lf => lf.id !== f.id).map(lf => (
              <option key={lf.id} value={lf.id}>{lf.nome}</option>
            ))}
          </Select>
        </Field>
      </div>
      
      {erro && <p className="erp-badge erp-badge-danger w-full justify-center">{erro}</p>}
      
      <div className="flex gap-3 pt-2 sticky bottom-0 bg-[var(--surface)] border-t border-[var(--line)] mt-2">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar} disabled={uploading}>{inicial ? "Salvar" : "Adicionar"}</Btn>
      </div>
    </div>
  );
}

export default function GestaoRhPage() {
  const router = useRouter();
  const { unidadeAtiva, unidadeInfo, sessao, unidades } = useERP();
  const podeEditar = sessao ? podeEditarGlobal(sessao.papel) : false;
  const isAdmin = sessao ? getPapel(sessao.papel).id === "admin" : false;
  
  const [lista, setLista] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [busca, setBusca] = useState("");
  const [cargoFiltro, setCargoFiltro] = useState("Todos");
  
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvou, setSalvou] = useState(false);

  // Estados para gerar acesso PDV
  const [modalAcesso, setModalAcesso] = useState(null);
  const [formAcesso, setFormAcesso] = useState({ usuario: "", senha: "123456" });
  const [acessoEnviando, setAcessoEnviando] = useState(false);
  const [acessoErro, setAcessoErro] = useState("");
  const [acessoGerado, setAcessoGerado] = useState(null);

  async function carregar() {
    setLoading(true);
    const [resFuncs, resCargos, resTurnos] = await Promise.all([
      fetchFuncionarios(unidadeAtiva),
      fetchCargos(unidadeAtiva),
      fetchTurnos(unidadeAtiva)
    ]);
    setLista(resFuncs.data || []);
    setCargos(resCargos.data || []);
    setTurnos(resTurnos.data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [unidadeAtiva]);

  const resumo = useMemo(() => {
    const ativos = lista.filter((f) => f.ativo !== false);
    return { total: lista.length, ativos: ativos.length, folha: ativos.reduce((a, f) => a + (Number(f.salario) || 0), 0) };
  }, [lista]);

  const filtrados = useMemo(() => lista.filter((f) => {
    const mb = f.nome?.toLowerCase().includes(busca.toLowerCase());
    const mc = cargoFiltro === "Todos" || f.cargo === cargoFiltro;
    return mb && mc;
  }), [lista, busca, cargoFiltro]);

  async function salvar(dados) {
    if (editar) await atualizarFuncionario(editar.id, dados);
    else await inserirFuncionario(dados, dados.unidade_id || unidadeAtiva);
    setModal(false); setEditar(null);
    setSalvou(true); setTimeout(() => setSalvou(false), 2200);
    carregar();
  }
  async function remover(id) {
    if(!confirm("Tem certeza que deseja apagar?")) return;
    await removerFuncionario(id);
    setLista((p) => p.filter((f) => f.id !== id));
  }

  const chipsOpcoes = useMemo(() => {
    const unicos = Array.from(new Set(lista.map(f => f.cargo).filter(Boolean)));
    return ["Todos", ...unicos];
  }, [lista]);

  async function gerarAcessoPDV() {
    if (!formAcesso.usuario) return setAcessoErro("Preencha o usuário.");
    setAcessoEnviando(true); setAcessoErro("");
    const res = await registrarUsuario({
      nome: modalAcesso.nome,
      email: formatarParaEmailFantasma(formAcesso.usuario),
      senha: formAcesso.senha,
      papel: "garcom",
      unidade: modalAcesso.unidade_id || unidadeAtiva
    });
    setAcessoEnviando(false);
    if (!res.ok) {
      setAcessoErro(res.erro);
    } else {
      setAcessoGerado({ login: formAcesso.usuario, senha: formAcesso.senha });
      setModalAcesso(null);
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="RH" subtitle={`Equipe · ${unidadeInfo.nome}`} icon={Users}
        onAction={podeEditar ? () => { setEditar(null); setModal(true); } : undefined} actionLabel={podeEditar ? "Novo" : undefined} />
      <PageBody>
        <Toast show={salvou}>Colaborador salvo!</Toast>

        <KpiGrid>
          <Kpi icon={Users} label="Colaboradores" value={resumo.total} tint="var(--accent-fg)" />
          <Kpi icon={UserCheck} label="Ativos" value={resumo.ativos} tint="#10B981" />
        </KpiGrid>
        <Card className="flex items-center justify-between">
          <span className="text-sm font-medium flex items-center gap-2" style={{ color: "var(--muted)" }}><Wallet size={16} /> Folha mensal</span>
          <span className="text-xl font-bold" style={{ color: "var(--fg)" }}>{fmtBRL(resumo.folha)}</span>
        </Card>

        <div className="space-y-3">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar colaborador..." />
          <Chips options={chipsOpcoes} value={cargoFiltro} onChange={setCargoFiltro} />
        </div>

        <div>
          <SectionLabel>{filtrados.length} colaborador{filtrados.length !== 1 ? "es" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={Users} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={Users} title={busca || cargoFiltro !== "Todos" ? "Nenhum colaborador encontrado" : "Nenhum colaborador cadastrado"}
              hint={busca || cargoFiltro !== "Todos" ? "Ajuste a busca ou o filtro" : "Toque em Novo para cadastrar a equipe"} />
          ) : (
            <div className="space-y-2">
              {filtrados.map((f) => (
                <Card key={f.id} className="!p-3">
                  <div className="flex items-center gap-3">
                    {f.foto_url ? (
                      <img src={f.foto_url} alt={f.nome} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ background: "var(--accent-soft)", color: "var(--accent-fg)" }}>
                        {f.nome?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold truncate" style={{ color: "var(--fg)" }}>{f.nome}</p>
                        {f.ativo === false && <span className="erp-badge" style={{ background: "var(--elevated)", color: "var(--subtle)" }}>Inativo</span>}
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--dim)" }}>{f.cargo || "Sem cargo"} · {f.turno || "Sem turno"}</p>
                      {isAdmin && unidadeAtiva === "todas" && <p className="text-[10px] text-[var(--accent-fg)] truncate mt-0.5">{unidades.find(u => u.id === f.unidade_id)?.nome}</p>}
                    </div>
                    
                    <button onClick={() => router.push(`/dashboard/rh/funcionario/${f.id}`)} title="Gerenciar (holerites, docs, avisos...)" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}><Settings2 size={14} style={{ color: "var(--accent-fg)" }} /></button>
                    {podeEditar && (
                      <>
                        <button onClick={() => {
                          const sugestaoUser = f.nome.split(" ")[0].toLowerCase() + "." + (unidades.find(u=>u.id===f.unidade_id)?.curto?.toLowerCase() || "");
                          setFormAcesso({ usuario: sugestaoUser, senha: "123456" });
                          setModalAcesso(f);
                        }} title="Gerar Acesso PDV" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}><Smartphone size={14} /></button>
                        <button onClick={() => { setEditar(f); setModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }}><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                        <button onClick={() => remover(f.id)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar colaborador" : "Novo colaborador"}>
        <FormFunc inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} 
          listaFuncionarios={lista} cargos={cargos} turnos={turnos} isAdmin={isAdmin} unidades={unidades} unidadeAtiva={unidadeAtiva} />
      </Modal>

      {/* Modal Criar Acesso Garçom */}
      <Modal open={!!modalAcesso} onClose={() => setModalAcesso(null)} title="Acesso ao PDV Celular">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Crie um login rápido para <b>{modalAcesso?.nome}</b> usar o PDV (Mesas) no celular.</p>
          <Field label="Nome de Usuário (Login)">
            <TextInput value={formAcesso.usuario} onChange={e => setFormAcesso({...formAcesso, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, '')})} placeholder="ex: joao.matriz" />
          </Field>
          <Field label="Senha (PIN)">
            <TextInput value={formAcesso.senha} onChange={e => setFormAcesso({...formAcesso, senha: e.target.value})} placeholder="123456" />
          </Field>
          {acessoErro && <p className="text-xs text-slate-600 text-center">{acessoErro}</p>}
          <Btn variant="primary" className="w-full" onClick={gerarAcessoPDV} disabled={acessoEnviando}>
            {acessoEnviando ? "Gerando..." : "Gerar Acesso"}
          </Btn>
        </div>
      </Modal>

      {/* Modal Sucesso Acesso Garçom */}
      <Modal open={!!acessoGerado} onClose={() => setAcessoGerado(null)} title="✅ Acesso Criado!">
        <div className="text-center py-4 space-y-4">
          <p className="text-slate-500 text-sm">O funcionário já pode entrar no sistema pelo celular usando as credenciais abaixo:</p>
          <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-slate-500 text-xs uppercase font-bold">Usuário</span>
              <span className="text-slate-800 dark:text-white font-mono text-lg font-bold">{acessoGerado?.login}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 text-xs uppercase font-bold">Senha (PIN)</span>
              <span className="text-emerald-500 font-mono text-lg font-bold">{acessoGerado?.senha}</span>
            </div>
          </div>
          <Btn variant="primary" className="w-full mt-4" onClick={() => setAcessoGerado(null)}>Concluir</Btn>
        </div>
      </Modal>
    </div>
  );
}
