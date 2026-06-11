"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Trash2, Edit3, MapPin, Clock } from "lucide-react";
import {
  PageHeader, PageBody, Card, SectionLabel, KpiGrid, Kpi,
  SearchBar, Chips, EmptyState, Modal, Field, TextInput, NumberInput, Select, Btn, Toast, fmtBRL,
} from "../../components/ui";
import { useERP } from "../../context/ERPContext";
import { fetchEventos, inserirEvento, atualizarEvento, removerEvento } from "../../lib/eventos";

const VAZIO = {
  nome: "",
  subtitulo: "",
  tag: "",
  data_evento: "",
  charge_mode: "couple",
  capacidade: 12,
  preco_unit: 350,
  entradas_inc: 1,
  principais_inc: 2,
  sobremesas_inc: 1,
  drinks_inc: 2,
};

function FormEvento({ inicial, onSalvar, onCancelar }) {
  const [f, setF] = useState(
    inicial
      ? {
          ...inicial,
          capacidade: String(inicial.capacidade || ""),
          preco_unit: String(inicial.preco_unit || ""),
          entradas_inc: String(inicial.entradas_inc || ""),
          principais_inc: String(inicial.principais_inc || ""),
          sobremesas_inc: String(inicial.sobremesas_inc || ""),
          drinks_inc: String(inicial.drinks_inc || ""),
        }
      : VAZIO,
  );
  const [erro, setErro] = useState("");
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErro(""); };

  function salvar() {
    if (!f.nome.trim()) return setErro("Informe o nome do evento.");
    if (!f.data_evento) return setErro("Informe a data do evento.");
    onSalvar({
      nome: f.nome.trim(),
      subtitulo: f.subtitulo || null,
      tag: f.tag || null,
      data_evento: f.data_evento,
      charge_mode: f.charge_mode,
      capacidade: Number(f.capacidade) || 12,
      preco_unit: parseFloat(String(f.preco_unit).replace(",", ".")) || 0,
      entradas_inc: Number(f.entradas_inc) || 0,
      principais_inc: Number(f.principais_inc) || 0,
      sobremesas_inc: Number(f.sobremesas_inc) || 0,
      drinks_inc: Number(f.drinks_inc) || 0,
    });
  }

  return (
    <>
      <Field label="Nome do evento">
        <TextInput value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="ex: Dia dos Namorados 2026" />
      </Field>
      <Field label="Subtítulo">
        <TextInput value={f.subtitulo} onChange={(e) => set("subtitulo", e.target.value)} placeholder="uma noite inesquecível" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tag / Loja">
          <TextInput value={f.tag} onChange={(e) => set("tag", e.target.value)} placeholder="Seldeestrela" />
        </Field>
        <Field label="Data">
          <input
            type="date"
            value={f.data_evento}
            onChange={(e) => set("data_evento", e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: "var(--elevated)", color: "var(--fg)", border: "1px solid var(--line)", fontSize: 13 }}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cobrança por">
          <Select value={f.charge_mode} onChange={(e) => set("charge_mode", e.target.value)}>
            <option value="couple">Casal</option>
            <option value="person">Pessoa</option>
          </Select>
        </Field>
        <Field label="Capacidade (mesas)">
          <NumberInput value={f.capacidade} onChange={(e) => set("capacidade", e.target.value)} placeholder="12" step="1" />
        </Field>
      </div>

      <Field label={`Preço por ${f.charge_mode === "couple" ? "casal" : "pessoa"} (R$)`}>
        <NumberInput value={f.preco_unit} onChange={(e) => set("preco_unit", e.target.value)} placeholder="350,00" step="0.01" />
      </Field>

      <SectionLabel>Menu incluído</SectionLabel>
      <div className="grid grid-cols-4 gap-2">
        <Field label="Entradas">
          <NumberInput value={f.entradas_inc} onChange={(e) => set("entradas_inc", e.target.value)} placeholder="1" step="1" />
        </Field>
        <Field label="Principais">
          <NumberInput value={f.principais_inc} onChange={(e) => set("principais_inc", e.target.value)} placeholder="2" step="1" />
        </Field>
        <Field label="Sobremesas">
          <NumberInput value={f.sobremesas_inc} onChange={(e) => set("sobremesas_inc", e.target.value)} placeholder="1" step="1" />
        </Field>
        <Field label="Drinks">
          <NumberInput value={f.drinks_inc} onChange={(e) => set("drinks_inc", e.target.value)} placeholder="2" step="1" />
        </Field>
      </div>

      {erro && <p className="erp-badge erp-badge-danger w-full justify-center mb-3">{erro}</p>}
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" onClick={salvar}>{inicial ? "Salvar" : "Criar evento"}</Btn>
      </div>
    </>
  );
}

function diasAte(dataStr) {
  if (!dataStr) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const data = new Date(dataStr + "T00:00:00");
  const diff = Math.floor((data - hoje) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function EventosPage() {
  const { unidadeAtiva } = useERP();
  const router = useRouter();

  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("Todos");
  const [modal, setModal] = useState(false);
  const [editar, setEditar] = useState(null);
  const [salvou, setSalvou] = useState("");

  async function carregar() {
    setLoading(true);
    const { data } = await fetchEventos(unidadeAtiva);
    setLista(data || []);
    setLoading(false);
  }
  useEffect(() => { carregar(); }, [unidadeAtiva]);

  const filtrados = useMemo(() => lista.filter((e) => {
    const mb = e.nome?.toLowerCase().includes(busca.toLowerCase());
    const ms = status === "Todos" || e.status === status.toLowerCase();
    return mb && ms;
  }), [lista, busca, status]);

  const resumo = useMemo(() => {
    const ativos = lista.filter((e) => e.status === "ativo").length;
    const proximos = lista.filter((e) => {
      const d = diasAte(e.data_evento);
      return d !== null && d >= 0 && d <= 30 && e.status === "ativo";
    }).length;
    return { total: lista.length, ativos, proximos };
  }, [lista]);

  async function salvar(dados) {
    if (editar) {
      const { error } = await atualizarEvento(editar.id, dados);
      if (error) { alert("Erro ao salvar: " + error + "\n\nVerifique se rodou o SQL docs/eventos.sql no Supabase."); return; }
      setModal(false); setEditar(null); setSalvou("Evento salvo!");
      setTimeout(() => setSalvou(""), 2600);
      carregar();
      return;
    }
    const { data, error } = await inserirEvento(dados, unidadeAtiva);
    if (error) {
      alert("Erro ao criar evento: " + error + "\n\nVerifique se rodou o SQL docs/eventos.sql no Supabase para criar a tabela 'eventos'.");
      return;
    }
    if (data?.id) {
      setModal(false); setEditar(null);
      router.push(`/dashboard/eventos/${data.id}`);
      return;
    }
    alert("Algo deu errado: evento não retornou ID. Verifique o console e se o SQL foi executado.");
  }

  async function remover(id, nome) {
    if (!confirm(`Remover o evento "${nome}"? Essa ação não pode ser desfeita.`)) return;
    await removerEvento(id);
    setLista((p) => p.filter((e) => e.id !== id));
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="🎉 Eventos" subtitle="Planejamento financeiro de eventos gastronômicos" icon={CalendarDays} onAction={() => { setEditar(null); setModal(true); }} actionLabel="Novo evento" />
      <PageBody>
        <Toast show={!!salvou}>{salvou}</Toast>

        <KpiGrid>
          <Kpi icon={CalendarDays} label="Eventos cadastrados" value={resumo.total} tint="var(--accent-fg)" />
          <Kpi icon={Clock} label="Próximos 30 dias" value={resumo.proximos} tint="#F59E0B" />
        </KpiGrid>

        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar evento..." />
        <Chips options={["Todos", "Ativo", "Encerrado", "Cancelado"]} value={status} onChange={setStatus} />

        <div>
          <SectionLabel>{filtrados.length} evento{filtrados.length !== 1 ? "s" : ""}</SectionLabel>
          {loading ? (
            <EmptyState icon={CalendarDays} title="Carregando..." />
          ) : filtrados.length === 0 ? (
            <EmptyState icon={CalendarDays} title={busca ? "Nenhum evento encontrado" : "Sem eventos cadastrados"} hint={busca ? "Ajuste a busca" : "Clique em Novo evento para começar"} />
          ) : (
            <div className="space-y-2">
              {filtrados.map((e) => {
                const dias = diasAte(e.data_evento);
                const passou = dias !== null && dias < 0;
                const proximo = dias !== null && dias >= 0 && dias <= 30;
                return (
                  <Card key={e.id} className="!p-3 cursor-pointer hover:opacity-90 transition" onClick={() => router.push(`/dashboard/eventos/${e.id}`)}>
                    {e.banner_url && (
                      <img src={e.banner_url} alt={e.nome} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, marginBottom: 10 }} />
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {e.tag && <span className="erp-badge text-[10px]" style={{ background: "var(--elevated)", color: "var(--muted)" }}>{e.tag}</span>}
                          <p className="font-bold" style={{ color: "var(--fg)" }}>{e.nome}</p>
                          {e.status === "ativo" && <span className="erp-badge text-[10px]" style={{ background: "#10B98133", color: "#10B981" }}>ativo</span>}
                          {e.status === "encerrado" && <span className="erp-badge text-[10px]" style={{ background: "var(--elevated)", color: "var(--muted)" }}>encerrado</span>}
                          {e.status === "cancelado" && <span className="erp-badge text-[10px]" style={{ background: "#EF444433", color: "#EF4444" }}>cancelado</span>}
                        </div>
                        {e.subtitulo && <p className="text-[12px]" style={{ color: "var(--dim)" }}>{e.subtitulo}</p>}
                        <div className="flex items-center gap-3 mt-2 text-[11px] flex-wrap" style={{ color: "var(--muted)" }}>
                          <span><CalendarDays size={11} style={{ display: "inline", marginRight: 4 }} />{new Date(e.data_evento + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                          {dias !== null && !passou && (
                            <span style={{ color: proximo ? "#F59E0B" : "var(--accent-fg)", fontWeight: 600 }}>
                              {dias === 0 ? "hoje" : `em ${dias} dia${dias !== 1 ? "s" : ""}`}
                            </span>
                          )}
                          {passou && <span style={{ color: "var(--dim)" }}>passou há {Math.abs(dias)} dia{Math.abs(dias) !== 1 ? "s" : ""}</span>}
                          <span>· {e.capacidade} mesas</span>
                          <span>· {fmtBRL(e.preco_unit)} / {e.charge_mode === "couple" ? "casal" : "pessoa"}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0" onClick={(ev) => ev.stopPropagation()}>
                        <button onClick={() => { setEditar(e); setModal(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--elevated)" }} title="Editar"><Edit3 size={14} style={{ color: "var(--muted)" }} /></button>
                        <button onClick={() => remover(e.id, e.nome)} className="w-8 h-8 rounded-lg flex items-center justify-center erp-badge-danger" title="Remover"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </PageBody>

      <Modal open={modal} onClose={() => { setModal(false); setEditar(null); }} title={editar ? "Editar evento" : "Novo evento"}>
        <FormEvento inicial={editar} onSalvar={salvar} onCancelar={() => { setModal(false); setEditar(null); }} />
      </Modal>
    </div>
  );
}
