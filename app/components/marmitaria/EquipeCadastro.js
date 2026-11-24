"use client";

// Cadastro da equipe do delivery (dono, 21/11/2026): fixo com cadastro
// completo (documentos, endereço, dias da semana por toque, entrada, saída,
// intervalo) e extras pagos por diária com recibo, histórico e impressão
// (o mesmo recibo do RH do restaurante).

import { useMemo, useState } from "react";
import { Plus, Printer, ReceiptText, Trash2, UserPlus } from "lucide-react";
import { Aviso, Botao, Campo, CampoNumero, Secao, brl, inputCls } from "./ui";
import { DIAS_SEMANA, ESTADOS_CIVIS, FORMAS_PAGAMENTO, ehExtra } from "../../lib/marmitaria/diarias.mjs";
import { criarExtra, pagarDiarias } from "../../lib/marmitaria/dados";
import { fetchReciboTextos, imprimirReciboExtra } from "../../lib/recibo-extra";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const dataBR = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const chip = (sel) => `min-h-[40px] rounded-full border px-3 text-sm font-semibold ${sel ? "border-hf-menu bg-hf-menu text-white" : "border-hf-border bg-hf-surface text-hf-text-2"}`;
const dataCls = `${inputCls} min-w-0 max-w-full appearance-none`;

export const FIXO_VAZIO = () => ({
  nome: "", cargo: "", salario: "", vale_alimentacao: "", vale_transporte: "", data_admissao: hoje(), turno: "",
  cpf: "", rg: "", telefone: "", data_nascimento: "", estado_civil: "", tem_filhos: false, qtd_filhos: "",
  rua_av: "", numero_casa: "", bairro: "", cidade_uf: "", cep: "",
  dias: [1, 2, 3, 4, 5], horario_entrada: "", horario_saida: "", tempo_intervalo: "60",
});

function Titulo({ children }) {
  return <p className="mb-2 mt-4 text-xs font-black uppercase tracking-wide text-hf-muted first:mt-0">{children}</p>;
}

/** Documentos, contato, estado civil, filhos e endereço (fixo e extra). */
export function DadosPessoais({ f, mudar }) {
  return (
    <>
      <Titulo>Dados pessoais</Titulo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome completo"><input className={inputCls} value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} /></Campo>
        <Campo rotulo="Telefone (com DDD)"><input className={inputCls} inputMode="tel" value={f.telefone} onChange={(e) => mudar({ telefone: e.target.value })} placeholder="(45) 99999-0000" /></Campo>
        <Campo rotulo="CPF"><input className={inputCls} inputMode="numeric" value={f.cpf} onChange={(e) => mudar({ cpf: e.target.value })} placeholder="000.000.000-00" /></Campo>
        <Campo rotulo="RG"><input className={inputCls} value={f.rg} onChange={(e) => mudar({ rg: e.target.value })} /></Campo>
        <Campo rotulo="Data de nascimento"><input type="date" className={dataCls} value={f.data_nascimento} onChange={(e) => mudar({ data_nascimento: e.target.value })} /></Campo>
      </div>
      <p className="mb-1 mt-3 text-[13px] font-medium text-hf-muted">Estado civil</p>
      <div className="flex flex-wrap gap-1.5">
        {ESTADOS_CIVIS.map((e) => <button key={e} type="button" aria-pressed={f.estado_civil === e} className={chip(f.estado_civil === e)} onClick={() => mudar({ estado_civil: f.estado_civil === e ? "" : e })}>{e}</button>)}
      </div>
      <p className="mb-1 mt-3 text-[13px] font-medium text-hf-muted">Tem filhos?</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" aria-pressed={!f.tem_filhos} className={chip(!f.tem_filhos)} onClick={() => mudar({ tem_filhos: false, qtd_filhos: "" })}>Não</button>
        <button type="button" aria-pressed={!!f.tem_filhos} className={chip(!!f.tem_filhos)} onClick={() => mudar({ tem_filhos: true })}>Sim</button>
        {f.tem_filhos && <div className="w-36"><CampoNumero valor={f.qtd_filhos} onChange={(v) => mudar({ qtd_filhos: v })} sufixo="filhos" placeholder="1" aria-label="Quantos filhos" /></div>}
      </div>
      <Titulo>Endereço</Titulo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Rua / avenida"><input className={inputCls} value={f.rua_av} onChange={(e) => mudar({ rua_av: e.target.value })} /></Campo>
        <Campo rotulo="Número"><input className={inputCls} value={f.numero_casa} onChange={(e) => mudar({ numero_casa: e.target.value })} /></Campo>
        <Campo rotulo="Bairro"><input className={inputCls} value={f.bairro} onChange={(e) => mudar({ bairro: e.target.value })} /></Campo>
        <Campo rotulo="Cidade / UF"><input className={inputCls} value={f.cidade_uf} onChange={(e) => mudar({ cidade_uf: e.target.value })} placeholder="Ex.: Cascavel/PR" /></Campo>
        <Campo rotulo="CEP"><input className={inputCls} inputMode="numeric" value={f.cep} onChange={(e) => mudar({ cep: e.target.value })} /></Campo>
      </div>
    </>
  );
}

/** Dias da semana por toque, entrada, saída e intervalo. */
export function Jornada({ f, mudar }) {
  const dias = f.dias || [];
  return (
    <>
      <Titulo>Jornada</Titulo>
      <p className="mb-1 text-[13px] font-medium text-hf-muted">Dias de trabalho</p>
      <div className="flex flex-wrap gap-1.5">
        {DIAS_SEMANA.map((d) => {
          const sel = dias.includes(d.id);
          return <button key={d.id} type="button" aria-pressed={sel} className={`${chip(sel)} min-w-[52px]`} onClick={() => mudar({ dias: sel ? dias.filter((x) => x !== d.id) : [...dias, d.id] })}>{d.curto}</button>;
        })}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Campo rotulo="Entrada"><input type="time" className={dataCls} value={f.horario_entrada} onChange={(e) => mudar({ horario_entrada: e.target.value })} /></Campo>
        <Campo rotulo="Saída"><input type="time" className={dataCls} value={f.horario_saida} onChange={(e) => mudar({ horario_saida: e.target.value })} /></Campo>
        <Campo rotulo="Intervalo"><CampoNumero valor={f.tempo_intervalo} onChange={(v) => mudar({ tempo_intervalo: v })} sufixo="min" placeholder="60" /></Campo>
      </div>
    </>
  );
}

const EXTRA_VAZIO = () => ({ nome: "", telefone: "", cpf: "", rg: "", data_nascimento: "", estado_civil: "", tem_filhos: false, qtd_filhos: "", rua_av: "", numero_casa: "", bairro: "", cidade_uf: "", cep: "", cargo: "", salario: "", chave_pix: "", horario_entrada: "", horario_saida: "" });

function PagarDiarias({ extra, unidadeId, unidadeInfo, aoPagar, aoFechar }) {
  const [dias, setDias] = useState([{ data: hoje(), valor: extra.salario ? String(extra.salario).replace(".", ",") : "" }]);
  const [forma, setForma] = useState("Pix");
  const [vt, setVt] = useState("");
  const [alimentacao, setAlimentacao] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const total = dias.reduce((s, d) => s + (Number(String(d.valor).replace(/\./g, "").replace(",", ".")) || 0), 0) + (Number(String(vt).replace(/\./g, "").replace(",", ".")) || 0);

  async function pagar(imprimir) {
    if (salvando) return;
    setSalvando(true); setErro(null);
    try {
      const r = await pagarDiarias(unidadeId, { extra, dias, forma, valeTransporte: vt, alimentacao });
      if (r.error) { setErro(r.error); return; }
      if (imprimir) {
        const textos = (await fetchReciboTextos(unidadeId)).data;
        imprimirReciboExtra({ extra, recibo: r.recibo, unidade: unidadeInfo, unidadeNome: unidadeInfo?.nome || "Delivery", textos });
      }
      aoPagar();
    } finally { setSalvando(false); }
  }

  return (
    <div className="mt-2 rounded-xl border border-hf-border bg-hf-elevated/40 p-3">
      <p className="text-sm font-bold text-hf-text">Pagar diária de {extra.nome}</p>
      <ul className="mt-2 space-y-2">
        {dias.map((d, i) => (
          <li key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-end gap-2">
            <Campo rotulo={i ? "" : "Dia trabalhado"}><input type="date" className={dataCls} value={d.data} onChange={(e) => setDias(dias.map((x, j) => (j === i ? { ...x, data: e.target.value } : x)))} /></Campo>
            <Campo rotulo={i ? "" : "Valor"}><CampoNumero prefixo="R$" valor={d.valor} onChange={(v) => setDias(dias.map((x, j) => (j === i ? { ...x, valor: v } : x)))} placeholder="0,00" /></Campo>
            <button type="button" aria-label="Tirar dia" disabled={dias.length === 1} onClick={() => setDias(dias.filter((_, j) => j !== i))} className="grid h-11 w-11 place-items-center rounded-lg text-hf-muted disabled:opacity-30"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setDias([...dias, { data: hoje(), valor: dias[dias.length - 1]?.valor || "" }])} className="mt-2 min-h-[40px] text-sm font-bold text-hf-accent"><Plus size={14} className="mr-1 inline" />Mais um dia</button>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Vale-transporte"><CampoNumero prefixo="R$" valor={vt} onChange={setVt} placeholder="0,00" /></Campo>
        <div>
          <p className="mb-1 text-[13px] font-medium text-hf-muted">Pagamento</p>
          <div className="flex flex-wrap gap-1.5">{FORMAS_PAGAMENTO.map((x) => <button key={x} type="button" aria-pressed={forma === x} className={chip(forma === x)} onClick={() => setForma(x)}>{x}</button>)}</div>
        </div>
      </div>
      <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={alimentacao} onChange={(e) => setAlimentacao(e.target.checked)} /> Alimentação oferecida</label>
      <p className="mt-1 text-sm text-hf-text-2">Total do recibo: <b className="tabular-nums text-hf-text">{brl(total)}</b></p>
      {erro && <Aviso tipo="alerta" className="mt-2">{erro}</Aviso>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Botao type="button" onClick={() => pagar(true)} disabled={salvando}><Printer size={16} /> {salvando ? "Salvando…" : "Pagar e imprimir recibo"}</Botao>
        <Botao type="button" variante="secundario" onClick={() => pagar(false)} disabled={salvando}>Só pagar</Botao>
        <Botao type="button" variante="texto" onClick={aoFechar}>Cancelar</Botao>
      </div>
    </div>
  );
}

/** Extras do delivery: cadastro, pagar diária (recibo), histórico e impressão. */
export function ExtrasDoDelivery({ unidadeId, unidadeInfo, colaboradores = [], recibos = [], aoMudar }) {
  const extras = useMemo(() => colaboradores.filter((c) => ehExtra(c) && (c.status || "ativo") !== "inativo").sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [colaboradores]);
  const [novo, setNovo] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [historico, setHistorico] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const mudar = (x) => setNovo((f) => ({ ...f, ...x }));
  const recibosDe = (id) => recibos.filter((r) => r.colaborador_id === id).sort((a, b) => String(b.data_trabalho || "").localeCompare(String(a.data_trabalho || "")));

  async function cadastrar() {
    if (salvando) return;
    setSalvando(true); setMsg(null);
    try {
      const r = await criarExtra(unidadeId, novo);
      if (r.error) { setMsg({ tipo: "alerta", texto: r.error }); return; }
      setNovo(null); setMsg({ tipo: "info", texto: "Extra cadastrado." }); aoMudar();
    } finally { setSalvando(false); }
  }

  async function imprimir(extra, recibo) {
    const textos = (await fetchReciboTextos(unidadeId)).data;
    imprimirReciboExtra({ extra, recibo, unidade: unidadeInfo, unidadeNome: unidadeInfo?.nome || "Delivery", textos });
  }

  return (
    <Secao titulo="Extras (diária)" subtitulo="Quem trabalha por dia. Cada pagamento gera o recibo e entra no custo da equipe do mês.">
      {!extras.length && !novo && <p className="text-sm text-hf-text-2">Nenhum extra cadastrado.</p>}
      <ul className="divide-y divide-hf-border">
        {extras.map((x) => {
          const lista = recibosDe(x.id);
          const ultimo = lista[0];
          return (
            <li key={x.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-hf-text">{x.nome}</p>
                  <p className="text-xs text-hf-muted">{x.cargo || "Extra"} · diária {Number(x.salario) > 0 ? brl(Number(x.salario)) : "sem valor"}{ultimo ? ` · último pagamento ${dataBR(ultimo.data_trabalho)}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Botao type="button" onClick={() => { setPagando(pagando === x.id ? null : x.id); setHistorico(null); }}><ReceiptText size={16} /> Pagar diária</Botao>
                  <Botao type="button" variante="secundario" onClick={() => { setHistorico(historico === x.id ? null : x.id); setPagando(null); }}>Recibos ({lista.length})</Botao>
                </div>
              </div>
              {pagando === x.id && <PagarDiarias extra={x} unidadeId={unidadeId} unidadeInfo={unidadeInfo} aoFechar={() => setPagando(null)} aoPagar={() => { setPagando(null); setMsg({ tipo: "info", texto: `Diária de ${x.nome} paga.` }); aoMudar(); }} />}
              {historico === x.id && (
                !lista.length ? <p className="mt-2 text-sm text-hf-text-2">Nenhum recibo ainda.</p> : (
                  <ul className="mt-2 divide-y divide-hf-border rounded-xl border border-hf-border">
                    {lista.map((r) => (
                      <li key={r.id || r.numero} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-semibold text-hf-text">{dataBR(r.data_trabalho)}{Number(r.dias_contratados) > 1 ? ` + ${Number(r.dias_contratados) - 1} dia(s)` : ""}</span>
                          <span className="block text-xs text-hf-muted">{r.numero} · {r.forma_pagamento || "—"}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <b className="tabular-nums">{brl(Number(r.valor_total) || 0)}</b>
                          <button type="button" aria-label="Imprimir recibo" onClick={() => imprimir(x, r)} className="grid h-11 w-11 place-items-center rounded-lg text-hf-text-2 hover:bg-hf-elevated"><Printer size={16} /></button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </li>
          );
        })}
      </ul>
      {novo ? (
        <div className="mt-3 rounded-xl border border-hf-border p-3">
          <DadosPessoais f={novo} mudar={mudar} />
          <Titulo>Trabalho e pagamento</Titulo>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Função"><input className={inputCls} value={novo.cargo} onChange={(e) => mudar({ cargo: e.target.value })} placeholder="Ex.: Ajudante de cozinha" /></Campo>
            <Campo rotulo="Valor da diária"><CampoNumero prefixo="R$" valor={novo.salario} onChange={(v) => mudar({ salario: v })} placeholder="0,00" /></Campo>
            <Campo rotulo="Chave Pix"><input className={inputCls} value={novo.chave_pix} onChange={(e) => mudar({ chave_pix: e.target.value })} /></Campo>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Entrada"><input type="time" className={dataCls} value={novo.horario_entrada} onChange={(e) => mudar({ horario_entrada: e.target.value })} /></Campo>
              <Campo rotulo="Saída"><input type="time" className={dataCls} value={novo.horario_saida} onChange={(e) => mudar({ horario_saida: e.target.value })} /></Campo>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Botao type="button" onClick={cadastrar} disabled={salvando}>{salvando ? "Salvando…" : "Cadastrar extra"}</Botao>
            <Botao type="button" variante="secundario" onClick={() => setNovo(null)}>Cancelar</Botao>
          </div>
        </div>
      ) : (
        <Botao className="mt-3" type="button" variante="secundario" onClick={() => setNovo(EXTRA_VAZIO())}><UserPlus size={16} /> Novo extra</Botao>
      )}
      {msg && <Aviso tipo={msg.tipo} className="mt-3">{msg.texto}</Aviso>}
    </Secao>
  );
}
