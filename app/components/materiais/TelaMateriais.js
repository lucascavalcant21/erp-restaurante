"use client";
// Tela de um grupo de materiais da casa: limpeza, produtos da máquina de lavar
// (cozinha e bar) ou embalagens. Cada grupo tem a sua tela, o seu menu e a sua
// permissão (pedido do dono, 27/10/2026: "quero cada uma separada").
// Cadastro em insumos; saldo e movimentação no estoque unificado.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Droplets, Package, Plus, Minus, ArrowDownToLine, AlertTriangle, Archive, Boxes } from "lucide-react";
import { PageHeader, PageBody, Card, SearchBar, EmptyState, Modal, Field, TextInput, NumberInput, Btn, Toast } from "../ui";
import { useERP } from "../../context/ERPContext";
import { grupoMaterial, resumoDosMateriais } from "../../lib/materiais.mjs";
import { adicionarAoEstoque, cadastrarMaterial, carregarMateriais, movimentarMaterial } from "../../lib/materiais";
import { casaBusca } from "../../lib/busca.mjs";

const ICONE = { limpeza: Sparkles, maquina: Droplets, embalagens: Package };
const COR_ESTADO = { zerado: "#B42318", baixo: "#B45309", ok: "#047857", sem_estoque: "var(--dim)" };
const ROTULO_ESTADO = { zerado: "Acabou", baixo: "Abaixo do mínimo", ok: "Em dia", sem_estoque: "Fora do estoque" };
const fmt = (n) => (Math.round(Number(n) * 1000) / 1000).toLocaleString("pt-BR");

function FormCadastro({ grupo, onSalvar, onCancelar, salvando, erros }) {
  const [f, setF] = useState({ nome: "", categoria: grupo.categorias[0], unidade: grupo.unidades[0], local: grupo.locais[0].slug, minimo: "", custo: "" });
  const campo = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const sel = "w-full h-11 rounded-xl px-3 font-semibold";
  const estiloSel = { background: "var(--bg)", border: "1px solid var(--line)", color: "var(--fg)" };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSalvar(f); }} className="space-y-3">
      <Field label="Nome do produto"><TextInput value={f.nome} onChange={campo("nome")} placeholder={grupo.id === "maquina" ? "Ex.: Secante Suma Rinse" : grupo.id === "embalagens" ? "Ex.: Pote 500 ml com tampa" : "Ex.: Detergente neutro 5 L"} autoFocus />{erros?.nome ? <p className="text-xs font-bold mt-1" style={{ color: "#B42318" }}>{erros.nome}</p> : null}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria">
          <select className={sel} style={estiloSel} value={f.categoria} onChange={campo("categoria")}>{grupo.categorias.map((c) => <option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Unidade">
          <select className={sel} style={estiloSel} value={f.unidade} onChange={campo("unidade")}>{grupo.unidades.map((u) => <option key={u}>{u}</option>)}</select>
        </Field>
      </div>
      <Field label={grupo.locais.length > 1 ? "Fica no estoque" : "Estoque"}>
        <div className="flex flex-wrap gap-2">
          {grupo.locais.map((l) => (
            <button key={l.slug} type="button" onClick={() => campo("local")(l.slug)} aria-pressed={f.local === l.slug}
              className="px-3 h-10 rounded-xl text-sm font-bold" style={{ border: `2px solid ${f.local === l.slug ? "var(--accent)" : "var(--line)"}`, background: f.local === l.slug ? "var(--accent-soft, var(--elevated))" : "var(--bg)", color: "var(--fg)" }}>
              {l.rotulo}
            </button>
          ))}
        </div>
      {erros?.local ? <p className="text-xs font-bold mt-1" style={{ color: "#B42318" }}>{erros.local}</p> : null}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estoque mínimo"><NumberInput value={f.minimo} onChange={campo("minimo")} placeholder="0" />{erros?.minimo ? <p className="text-xs font-bold mt-1" style={{ color: "#B42318" }}>{erros.minimo}</p> : null}</Field>
        <Field label="Custo por unidade (R$)"><NumberInput value={f.custo} onChange={campo("custo")} placeholder="0,00" />{erros?.custo ? <p className="text-xs font-bold mt-1" style={{ color: "#B42318" }}>{erros.custo}</p> : null}</Field>
      </div>
      <p className="text-xs" style={{ color: "var(--dim)" }}>O produto entra com saldo zero. A quantidade entra pela “Entrada”, que fica registrada no histórico do estoque.</p>
      <div className="flex gap-3 pt-1">
        <Btn variant="ghost" className="flex-1" type="button" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" type="submit" disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar"}</Btn>
      </div>
    </form>
  );
}

function FormMovimento({ produto, local, tipo, onConfirmar, onCancelar, salvando }) {
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const n = Number(String(qtd).replace(",", ".")) || 0;
  const invalido = n <= 0 || (tipo === "saida" && n > local.saldo);
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-xl" style={{ background: "var(--elevated)", border: "1px solid var(--line)" }}>
        <p className="text-xs font-bold uppercase" style={{ color: "var(--dim)" }}>{local.rotulo}</p>
        <p className="font-bold" style={{ color: "var(--fg)" }}>{produto.nome}</p>
        <p className="text-sm" style={{ color: "var(--dim)" }}>Saldo agora: <strong style={{ color: "var(--fg)" }}>{fmt(local.saldo)} {produto.unidade_medida || ""}</strong></p>
      </div>
      <Field label={tipo === "entrada" ? "Quantidade que chegou" : "Quantidade usada"}>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Menos" onClick={() => setQtd(String(Math.max(0, n - 1)))} className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: "var(--elevated)" }}><Minus size={18} /></button>
          <NumberInput value={qtd} onChange={(v) => setQtd(v?.target ? v.target.value : v)} placeholder="0" />
          <button type="button" aria-label="Mais" onClick={() => setQtd(String(n + 1))} className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: "var(--elevated)" }}><Plus size={18} /></button>
        </div>
      </Field>
      {tipo === "saida" && n > local.saldo ? <p className="text-xs font-bold" style={{ color: "#B42318" }}>Mais do que tem no estoque.</p> : null}
      <Field label="Observação (opcional)"><TextInput value={obs} onChange={(v) => setObs(v?.target ? v.target.value : v)} placeholder={tipo === "entrada" ? "Nota, fornecedor…" : "Para quê"} /></Field>
      <div className="flex gap-3">
        <Btn variant="ghost" className="flex-1" onClick={onCancelar}>Cancelar</Btn>
        <Btn variant="primary" className="flex-1" disabled={invalido || salvando} onClick={() => onConfirmar(n, obs)}>{salvando ? "Salvando…" : tipo === "entrada" ? "Registrar entrada" : "Registrar saída"}</Btn>
      </div>
    </div>
  );
}

export default function TelaMateriais({ grupoId }) {
  const { sessao, unidadeAtiva, unidadeInfo } = useERP();
  const aba = grupoId;
  const [lista, setLista] = useState([]);
  const [estoques, setEstoques] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [cadastro, setCadastro] = useState(false);
  const [errosCadastro, setErrosCadastro] = useState({});
  const [mov, setMov] = useState(null); // { produto, local, tipo }
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");
  const grupo = grupoMaterial(aba);

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setLista([]); setCarregando(false); return; }
    setCarregando(true);
    const r = await carregarMateriais(unidadeAtiva, aba);
    setLista(r.data || []);
    setEstoques(r.estoques || []);
    setErro(r.error || "");
    setCarregando(false);
  }, [unidadeAtiva, aba]);
  useEffect(() => { carregar(); }, [carregar]);

  const avisar = (t) => { setToast(t); setTimeout(() => setToast(""), 3000); };
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? lista.filter((p) => casaBusca(`${p.nome} ${p.categoria || ""}`, q)) : lista;
  }, [lista, busca]);
  const resumo = resumoDosMateriais(lista);
  const idDoEstoque = (slug) => estoques.find((e) => e.slug === slug)?.id;

  async function salvarCadastro(f) {
    setSalvando(true);
    const r = await cadastrarMaterial(unidadeAtiva, aba, f);
    setSalvando(false);
    if (r.erros) { setErrosCadastro(r.erros); return; }
    if (r.erro) { avisar(r.erro); return; }
    setCadastro(false); setErrosCadastro({});
    avisar("Produto cadastrado. Agora registre a entrada da quantidade.");
    carregar();
  }

  async function confirmarMov(qtd, obs) {
    setSalvando(true);
    const r = await movimentarMaterial({ unidadeId: unidadeAtiva, estoqueId: idDoEstoque(mov.local.slug), insumoId: mov.produto.id, tipo: mov.tipo, quantidade: qtd, usuarioNome: sessao?.nome || "", observacao: obs });
    setSalvando(false);
    if (r.error) { avisar(r.error); return; }
    avisar(mov.tipo === "entrada" ? "Entrada registrada." : "Saída registrada.");
    setMov(null);
    carregar();
  }

  async function porNoEstoque(produto, slug) {
    const r = await adicionarAoEstoque(unidadeAtiva, produto.id, slug);
    if (r.erro) avisar(r.erro); else { avisar("Produto incluído neste estoque."); carregar(); }
  }

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return (
      <div className="min-h-screen">
        <PageHeader title={grupo.titulo} subtitle="Cadastro e estoque" icon={ICONE[aba]} />
        <PageBody><EmptyState icon={Archive} title="Escolha uma unidade" hint="Cada unidade tem o seu estoque." /></PageBody>
      </div>
    );
  }

  const Icone = ICONE[aba];
  return (
    <div className="min-h-screen">
      <PageHeader title={grupo.titulo} subtitle={`Cadastro e estoque · ${unidadeInfo?.nome || ""}`} icon={Icone}
        onAction={() => { setErrosCadastro({}); setCadastro(true); }} actionLabel="Novo produto" />
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <p className="text-sm" style={{ color: "var(--dim)" }}>{grupo.descricao} Estoques: {grupo.locais.map((l) => l.rotulo).join(", ")}.</p>

        <div className="grid grid-cols-3 gap-2">
          {[["Produtos", resumo.total, "var(--fg)"], ["Acabou", resumo.zerados, resumo.zerados ? COR_ESTADO.zerado : COR_ESTADO.ok], ["Abaixo do mínimo", resumo.baixos, resumo.baixos ? COR_ESTADO.baixo : COR_ESTADO.ok]].map(([r, v, c]) => (
            <div key={r} className="rounded-2xl px-3 py-2.5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
              <p className="text-2xl font-black leading-none" style={{ color: c }}>{v}</p>
              <p className="text-xs font-bold mt-1" style={{ color: "var(--dim)" }}>{r}</p>
            </div>
          ))}
        </div>

        <SearchBar value={busca} onChange={setBusca} placeholder={`Buscar em ${grupo.rotulo.toLowerCase()}…`} />

        {erro ? <EmptyState icon={AlertTriangle} title="Não deu para ler o estoque" hint={erro} /> : carregando ? (
          <EmptyState icon={Icone} title="Carregando…" />
        ) : filtrados.length === 0 ? (
          <EmptyState icon={Icone} title={busca ? "Nada encontrado" : `Nenhum produto de ${grupo.rotulo.toLowerCase()} ainda`} hint={busca ? "Tente outro nome." : "Toque em “Novo produto” para cadastrar o primeiro."} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtrados.map((p) => {
              const fora = grupo.locais.filter((l) => !p.locais.some((x) => x.slug === l.slug));
              return (
                <Card key={p.id} className="!p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-3xs font-bold uppercase" style={{ color: "var(--dim)" }}>{p.categoria || grupo.rotulo}</p>
                      <p className="font-bold leading-tight" style={{ color: "var(--fg)" }}>{p.nome}</p>
                    </div>
                    <span className="shrink-0 text-3xs font-black uppercase px-2 py-1 rounded-lg" style={{ color: COR_ESTADO[p.estado], background: "var(--elevated)" }}>{ROTULO_ESTADO[p.estado]}</span>
                  </div>
                  {p.locais.map((l) => (
                    <div key={l.slug} className="rounded-xl p-3" style={{ background: "var(--elevated)", border: "1px solid var(--line)" }}>
                      <div className="flex items-end justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold" style={{ color: "var(--dim)" }}>{l.rotulo}</p>
                          <p className="text-2xl font-black leading-none" style={{ color: COR_ESTADO[l.estado] }}>{fmt(l.saldo)} <span className="text-sm font-bold" style={{ color: "var(--dim)" }}>{p.unidade_medida || ""}</span></p>
                          {l.minimo > 0 ? <p className="text-xs" style={{ color: "var(--dim)" }}>Mínimo: {fmt(l.minimo)}</p> : null}
                        </div>
                        <div className="flex gap-2">
                          <Btn variant="ghost" onClick={() => setMov({ produto: p, local: l, tipo: "saida" })} disabled={l.saldo <= 0} aria-label={`Saída de ${p.nome} em ${l.rotulo}`}><Minus size={16} /></Btn>
                          <Btn variant="primary" onClick={() => setMov({ produto: p, local: l, tipo: "entrada" })} aria-label={`Entrada de ${p.nome} em ${l.rotulo}`}><ArrowDownToLine size={16} /> Entrada</Btn>
                        </div>
                      </div>
                    </div>
                  ))}
                  {fora.length ? (
                    <div className="flex flex-wrap gap-2">
                      {fora.map((l) => <button key={l.slug} onClick={() => porNoEstoque(p, l.slug)} className="text-xs font-bold underline" style={{ color: "var(--accent-strong, var(--fg))" }}>+ usar também em {l.rotulo}</button>)}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </PageBody>

      <Modal open={cadastro} onClose={() => setCadastro(false)} title={`Novo produto · ${grupo.rotulo}`}>
        {cadastro ? <FormCadastro key={aba} grupo={grupo} onSalvar={salvarCadastro} onCancelar={() => setCadastro(false)} salvando={salvando} erros={errosCadastro} /> : null}
      </Modal>
      <Modal open={!!mov} onClose={() => setMov(null)} title={mov?.tipo === "entrada" ? "Entrada no estoque" : "Saída do estoque"}>
        {mov ? <FormMovimento produto={mov.produto} local={mov.local} tipo={mov.tipo} onConfirmar={confirmarMov} onCancelar={() => setMov(null)} salvando={salvando} /> : null}
      </Modal>
    </div>
  );
}
