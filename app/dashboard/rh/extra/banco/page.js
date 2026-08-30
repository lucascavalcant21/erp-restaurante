"use client";

// BANCO DE EXTRAS — quem se cadastrou pelo link público.
// Busca por função (a principal é a categoria), vê a disponibilidade e as
// respostas, e aprova: aprovar cria o cadastro de extra de verdade, pronto
// para gerar recibo.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, Copy, ExternalLink, Loader2, MapPin, Pencil, Phone, Save, Search, UserPlus, X,
  UsersRound, Archive, CalendarDays, Briefcase,
} from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { inserirColaborador } from "../../../../lib/rh";
import {
  fetchBancoExtras, atualizarStatusExtraCadastro, atualizarCadastroExtra, FUNCOES_EXTRA, DIAS_SEMANA,
} from "../../../../lib/portal-extras";

const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const rotuloDia = (v) => DIAS_SEMANA.find(d => d.valor === v)?.rotulo || v;
// Faixa de horário informada no portal ("das 18:00 às 23:00").
const horario = (e) => {
  const hi = String(e?.hora_inicio || "").slice(0, 5);
  const hf = String(e?.hora_fim || "").slice(0, 5);
  if (hi && hf) return `das ${hi} às ${hf}`;
  if (hi) return `a partir das ${hi}`;
  if (hf) return `até as ${hf}`;
  return e?.periodo_disponivel || "";   // cadastros antigos
};

const semAcento = (v) => {
  const d = String(v || "").normalize("NFD");
  let out = "";
  for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
  return out.toLowerCase();
};

export default function BancoDeExtras() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [funcao, setFuncao] = useState("");
  const [status, setStatus] = useState("novo");
  const [aprovando, setAprovando] = useState(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [editando, setEditando] = useState(null); // cadastro em correção
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const carregar = async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    setCarregando(true);
    const { data } = await fetchBancoExtras(unidadeAtiva, { funcao, status });
    setLista(data || []);
    setCarregando(false);
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [unidadeAtiva, funcao, status]);

  const filtrados = useMemo(() => {
    const alvo = semAcento(busca.trim());
    if (!alvo) return lista;
    return lista.filter(e =>
      semAcento(e.nome).includes(alvo)
      || semAcento(e.funcao_principal).includes(alvo)
      || semAcento(e.funcao_secundaria).includes(alvo)
      || String(e.telefone || "").includes(busca.trim()));
  }, [lista, busca]);

  // Aprovar = criar o extra de verdade, com os dados que a pessoa preencheu.
  const aprovar = async (cadastro) => {
    if (!confirm(`Cadastrar ${cadastro.nome} como extra da unidade?`)) return;
    setAprovando(cadastro.id);
    const r = await inserirColaborador({
      unidade_id: unidadeAtiva,
      tipo_contrato: "Freelancer",
      dias_trabalho: "",
      nome: cadastro.nome,
      cargo: cadastro.funcao_principal,
      telefone: cadastro.telefone,
      data_nascimento: cadastro.data_nascimento || null,
      estado_civil: cadastro.estado_civil || null,
      genero: cadastro.genero || null,
      escolaridade: cadastro.escolaridade || null,
      tem_filhos: !!cadastro.tem_filhos,
      qtd_filhos: cadastro.qtd_filhos ?? null,
      rua_av: cadastro.endereco || null,
      bairro: cadastro.bairro || null,
      cidade_uf: cadastro.cidade || null,
      endereco: [cadastro.endereco, cadastro.bairro, cadastro.cidade].filter(Boolean).join(", ") || null,
      chave_pix: cadastro.chave_pix || null,
      salario: Number(cadastro.valor_diaria_pretendido) || 0,
      anotacoes_rh: [
        cadastro.funcao_secundaria ? `Também faz: ${cadastro.funcao_secundaria}` : "",
        cadastro.experiencia ? `Experiência: ${cadastro.experiencia}` : "",
        `Cadastro pelo portal em ${dataBR(cadastro.created_at)}`,
      ].filter(Boolean).join("\n"),
    });
    if (r.error) { setAprovando(null); setAviso(`Não consegui cadastrar: ${r.error}`); return; }
    await atualizarStatusExtraCadastro(cadastro.id, "aprovado", r.data?.id);
    setAprovando(null);
    setAviso(`${cadastro.nome} agora é extra da unidade.`);
    await carregar();
  };

  const arquivar = async (cadastro) => {
    if (!confirm(`Arquivar o cadastro de ${cadastro.nome}?`)) return;
    const { error } = await atualizarStatusExtraCadastro(cadastro.id, "arquivado");
    if (error) return alert(`Não consegui arquivar este cadastro: ${error}`);
    await carregar();
  };

  const copiarLink = () => {
    const link = `${window.location.origin}/extras/${unidadeAtiva}`;
    navigator.clipboard?.writeText(link);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2500);
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-20">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button onClick={() => router.push("/dashboard/rh/extra")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"><ArrowLeft size={19} /></button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Banco de extras</h1>
            <p className="text-xs font-bold text-slate-500">Quem se cadastrou pelo link público</p>
          </div>
          <button onClick={copiarLink} className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-emerald-200 bg-white px-4 font-black text-emerald-700 hover:bg-emerald-50">
            {linkCopiado ? <><Check size={18} /> Link copiado</> : <><Copy size={18} /> Copiar link</>}
          </button>
          <a href={`/extras/${unidadeAtiva}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 font-black text-white hover:bg-emerald-700"><ExternalLink size={18} /> Abrir portal</a>
        </div>
      </div>

      <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
        {/* Filtros */}
        <div className="erp-busca-fixa grid gap-3 sm:grid-cols-[1fr_200px_170px]">
          <label className="relative flex items-center">
            <Search className="absolute left-3.5 text-slate-400" size={18} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome, função ou telefone..."
              className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 font-bold text-slate-800 outline-none focus:border-emerald-600" />
          </label>
          <select value={funcao} onChange={e => setFuncao(e.target.value)} className="h-12 rounded-xl border border-slate-300 bg-white px-3 font-bold text-slate-700">
            <option value="">Todas as funções</option>
            {FUNCOES_EXTRA.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-12 rounded-xl border border-slate-300 bg-white px-3 font-bold text-slate-700">
            <option value="novo">Novos</option>
            <option value="aprovado">Aprovados</option>
            <option value="arquivado">Arquivados</option>
            <option value="">Todos</option>
          </select>
        </div>

        {aviso && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{aviso}</p>}

        {!unidadeAtiva || unidadeAtiva === "todas" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center font-bold text-slate-500">Selecione uma unidade específica.</div>
        ) : carregando ? (
          <div className="grid min-h-52 place-items-center"><Loader2 className="animate-spin text-emerald-600" size={30} /></div>
        ) : filtrados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <UsersRound className="mx-auto text-slate-300" size={42} />
            <p className="mt-3 font-black text-slate-700">Nenhum cadastro por aqui</p>
            <p className="mt-1 text-sm text-slate-500">Mande o link de cadastro no WhatsApp para começar a formar seu banco.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filtrados.map(e => (
              <article key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[16px] font-black text-slate-900 truncate">{e.nome}</p>
                    <p className="flex items-center gap-1.5 text-[13px] font-bold text-emerald-700">
                      <Briefcase size={14} /> {e.funcao_principal}{e.funcao_secundaria ? ` · ${e.funcao_secundaria}` : ""}
                    </p>
                  </div>
                  {e.interesse !== "extra" && (
                    <span className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase text-white">Quer CLT</span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5 text-[13px] font-semibold text-slate-600">
                  <p className="flex items-center gap-1.5"><Phone size={14} className="text-slate-400" /> {e.telefone}</p>
                  {(e.bairro || e.cidade) && <p className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {[e.bairro, e.cidade].filter(Boolean).join(" · ")}</p>}
                  {Array.isArray(e.dias_disponiveis) && e.dias_disponiveis.length > 0 && (
                    <p className="flex items-center gap-1.5"><CalendarDays size={14} className="text-slate-400" /> {e.dias_disponiveis.map(rotuloDia).join(", ")}{horario(e) ? ` · ${horario(e)}` : ""}</p>
                  )}
                  {e.nacionalidade && <p>Nacionalidade: <b className="text-slate-800">{e.nacionalidade}</b></p>}
                  {Number(e.valor_diaria_pretendido) > 0 && <p>Diária pretendida: <b className="text-slate-800">{moeda(e.valor_diaria_pretendido)}</b></p>}
                </div>

                {e.experiencia && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-[13px] font-medium text-slate-600 line-clamp-3">{e.experiencia}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={`https://wa.me/55${String(e.telefone).replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-50">
                    <Phone size={15} /> WhatsApp
                  </a>
                  <button onClick={() => setEditando({ ...e })} title="Corrigir dados"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><Pencil size={16} /></button>
                  {e.status === "novo" && (
                    <>
                      <button onClick={() => aprovar(e)} disabled={aprovando === e.id}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                        {aprovando === e.id ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Cadastrar
                      </button>
                      <button onClick={() => arquivar(e)} title="Arquivar"
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                        <Archive size={16} />
                      </button>
                    </>
                  )}
                  {e.status === "aprovado" && (
                    <span className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-sm font-black text-emerald-700">
                      <Check size={15} /> Já é extra
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] font-bold text-slate-400">Cadastrado em {dataBR(e.created_at)}</p>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Correção do cadastro antes de aprovar */}
      {editando && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => !salvandoEdicao && setEditando(null)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-3xl" onClick={ev => ev.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">Corrigir cadastro</h2>
                <p className="text-sm text-slate-500">Ajuste antes de cadastrar como extra.</p>
              </div>
              <button onClick={() => setEditando(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Nome</span>
                <input value={editando.nome || ""} onChange={ev => setEditando(v => ({ ...v, nome: ev.target.value }))}
                  className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-600" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Telefone</span>
                  <input value={editando.telefone || ""} onChange={ev => setEditando(v => ({ ...v, telefone: ev.target.value }))}
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Diária combinada (R$)</span>
                  <input type="number" step="0.01" value={editando.valor_diaria_pretendido ?? ""} onChange={ev => setEditando(v => ({ ...v, valor_diaria_pretendido: ev.target.value }))}
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3.5 font-black text-emerald-700 outline-none focus:border-emerald-600" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Função principal</span>
                  <select value={editando.funcao_principal || ""} onChange={ev => setEditando(v => ({ ...v, funcao_principal: ev.target.value }))}
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3 font-bold text-slate-700 outline-none focus:border-emerald-600">
                    {FUNCOES_EXTRA.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Segunda função</span>
                  <select value={editando.funcao_secundaria || ""} onChange={ev => setEditando(v => ({ ...v, funcao_secundaria: ev.target.value }))}
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3 font-bold text-slate-700 outline-none focus:border-emerald-600">
                    <option value="">Nenhuma</option>
                    {FUNCOES_EXTRA.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Bairro</span>
                  <input value={editando.bairro || ""} onChange={ev => setEditando(v => ({ ...v, bairro: ev.target.value }))}
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                </label>
                <label className="block">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Cidade</span>
                  <input value={editando.cidade || ""} onChange={ev => setEditando(v => ({ ...v, cidade: ev.target.value }))}
                    className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-600" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Chave PIX</span>
                <input value={editando.chave_pix || ""} onChange={ev => setEditando(v => ({ ...v, chave_pix: ev.target.value }))}
                  className="mt-1.5 h-12 w-full rounded-xl border border-slate-300 px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-600" />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Observações do RH</span>
                <textarea rows={3} value={editando.observacoes || ""} onChange={ev => setEditando(v => ({ ...v, observacoes: ev.target.value }))}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 p-3.5 font-medium text-slate-800 outline-none focus:border-emerald-600"
                  placeholder="Só o RH vê." />
              </label>
            </div>

            <button onClick={async () => {
                setSalvandoEdicao(true);
                const r = await atualizarCadastroExtra(editando.id, editando);
                setSalvandoEdicao(false);
                if (r.error) { setAviso("Não consegui salvar: " + r.error); return; }
                setEditando(null);
                await carregar();
              }} disabled={salvandoEdicao}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
              {salvandoEdicao ? <><Loader2 size={19} className="animate-spin" /> Salvando...</> : <><Save size={19} /> Salvar correção</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
