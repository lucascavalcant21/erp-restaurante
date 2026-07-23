"use client";

import { useState, useEffect } from "react";
import { 
  Award, Plus, Edit2, Trash2, Printer, Users, ChevronRight, Sparkles, 
  TrendingUp, CheckCircle, HelpCircle, DollarSign, ShieldCheck, UserCheck
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { comFecharImpressao } from "../../../lib/imprimir";
import { salvarCargo, removerCargo, atualizarColaborador } from "../../../lib/rh";

export default function PlanoCargos({ cargos = [], funcionarios = [], unidadeAtiva, unidadeInfo, onRecarregar }) {
  const [departamentoFiltro, setDepartamentoFiltro] = useState("Todos");
  const [modalEdit, setModalEdit] = useState(false);
  const [cargoEdit, setCargoEdit] = useState(null);
  const [modalAlocar, setModalAlocar] = useState(false);
  const [cargoAlocar, setCargoAlocar] = useState(null);
  const [funcSelecionadoId, setFuncSelecionadoId] = useState("");
  const [saving, setSaving] = useState(false);

  const formStatePadrao = {
    id: null,
    nome: "",
    departamento: "Cozinha",
    nivel: "Nível 1",
    salario_base: "",
    vale_alimentacao: "",
    taxa_servico: "",
    descricao: ""
  };
  const [form, setForm] = useState(formStatePadrao);

  const DEPARTAMENTOS = ["Todos", "Cozinha", "Bar", "Salão", "Administração", "Gestão", "Diretoria"];

  const cargosFiltrados = cargos.filter(c => {
    if (departamentoFiltro === "Todos") return true;
    return (c.departamento || "").toLowerCase() === departamentoFiltro.toLowerCase();
  });

  // Mapeia colaboradores por cargo (busca insensível a maiúsculas/minúsculas)
  const colabsPorCargo = (nomeCargo) => {
    if (!nomeCargo) return [];
    const n = nomeCargo.trim().toLowerCase();
    return funcionarios.filter(f => {
      const status = (f.status || "ativo").toLowerCase();
      if (status === "inativo") return false;
      return (f.cargo || "").trim().toLowerCase() === n;
    });
  };

  const abrirNovoCargo = () => {
    setForm({ ...formStatePadrao, departamento: departamentoFiltro !== "Todos" ? departamentoFiltro : "Cozinha" });
    setModalEdit(true);
  };

  const abrirEdicaoCargo = (c) => {
    setForm({
      id: c.id,
      nome: c.nome || "",
      departamento: c.departamento || "Cozinha",
      nivel: c.nivel || "Nível 1",
      salario_base: c.salario_base || "",
      vale_alimentacao: c.vale_alimentacao || "",
      taxa_servico: c.taxa_servico || "",
      descricao: c.descricao || ""
    });
    setModalEdit(true);
  };

  const handleSalvarCargoSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return alert("Informe o nome do cargo.");
    setSaving(true);
    const payload = {
      id: form.id,
      nome: form.nome.trim(),
      departamento: form.departamento,
      nivel: form.nivel,
      salario_base: parseFloat(form.salario_base) || 0,
      vale_alimentacao: parseFloat(form.vale_alimentacao) || 0,
      taxa_servico: parseFloat(form.taxa_servico) || 0,
      descricao: form.descricao
    };

    const { error } = await salvarCargo(payload, unidadeAtiva);
    setSaving(false);
    if (error) return alert("Erro ao salvar cargo: " + error);
    setModalEdit(false);
    if (onRecarregar) onRecarregar();
  };

  const handleExcluirCargo = async (id) => {
    if (!confirm("Tem certeza que deseja remover este cargo do plano de carreiras?")) return;
    const { error } = await removerCargo(id);
    if (error) return alert("Erro ao remover: " + error);
    if (onRecarregar) onRecarregar();
  };

  const abrirAlocacao = (c) => {
    setCargoAlocar(c);
    setFuncSelecionadoId("");
    setModalAlocar(true);
  };

  const handleAlocarFuncionarioSubmit = async (e) => {
    e.preventDefault();
    if (!funcSelecionadoId || !cargoAlocar) return alert("Selecione um funcionário.");
    setSaving(true);

    const f = funcionarios.find(x => x.id === funcSelecionadoId);
    const salarioBase = Number(cargoAlocar.salario_base) || Number(f?.salario) || 0;
    const va = Number(cargoAlocar.vale_alimentacao) || Number(f?.vale_alimentacao) || 0;
    const taxa = Number(cargoAlocar.taxa_servico) || Number(f?.taxa_servico_mes) || 0;

    const { error } = await atualizarColaborador(funcSelecionadoId, {
      cargo: cargoAlocar.nome,
      salario: salarioBase,
      vale_alimentacao: va,
      taxa_servico_mes: taxa
    });

    setSaving(false);
    if (error) return alert("Erro ao promover/alocar colaborador: " + error);
    alert(`🎉 Parabéns! ${f.nome} foi alocado(a) ao cargo de "${cargoAlocar.nome}"!`);
    setModalAlocar(false);
    if (onRecarregar) onRecarregar();
  };

  // ── IMPRESSÃO DO MURAL DE CARREIRAS (PARA O MURAL DA EMPRESA) ──────────────
  const imprimirMuralCarreiras = () => {
    const empNome = unidadeInfo?.nome_fantasia || unidadeInfo?.nome || "Mural da Empresa";
    const hoje = new Date().toLocaleDateString("pt-BR");

    const deptosDesejados = ["Cozinha", "Bar", "Salão", "Administração", "Gestão", "Diretoria"];
    
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Plano de Cargos e Carreiras - ${empNome}</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 10px; line-height: 1.4; font-size: 11px; background: #fff; }
        .header { text-align: center; border-bottom: 3px double #059669; padding-bottom: 12px; margin-bottom: 14px; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #064e3b; }
        .header h2 { margin: 4px 0 0; font-size: 13px; font-weight: 700; color: #047857; text-transform: uppercase; tracking: 2px; }
        .header p { margin: 6px 0 0; font-size: 10px; color: #475569; font-style: italic; max-width: 600px; margin-left: auto; margin-right: auto; }
        .depto-title { font-size: 13px; font-weight: 900; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 6px 12px; border-radius: 6px; margin: 16px 0 8px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f8fafc; font-size: 9.5px; text-transform: uppercase; font-weight: 900; color: #334155; }
        .badge-nivel { background: #e0e7ff; color: #3730a3; font-weight: 800; font-size: 9px; padding: 2px 6px; border-radius: 4px; display: inline-block; }
        .val-total { font-weight: 900; color: #047857; font-size: 11.5px; }
        .colabs-tag { background: #f1f5f9; border: 1px solid #e2e8f0; font-size: 9px; padding: 2px 5px; border-radius: 4px; color: #334155; margin-right: 3px; display: inline-block; margin-top: 2px; }
        .footer { margin-top: 20px; text-align: center; border-top: 1px solid #e2e8f0; pt: 10px; font-size: 9px; color: #94a3b8; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <h1>🏆 PLANO DE CARGOS, SALÁRIOS & EVOLUÇÃO PROFISSIONAL</h1>
        <h2>${empNome} — MURAL DE OPORTUNIDADES DA EQUIPE</h2>
        <p>"Invista no seu crescimento! Conheça os cargos, requisitos e remunerações da nossa empresa e converse com a gerência para planejar a sua próxima promoção."</p>
      </div>`;

    deptosDesejados.forEach(dep => {
      const listaDep = cargos.filter(c => (c.departamento || "").toLowerCase() === dep.toLowerCase());
      if (listaDep.length === 0) return;

      html += `<div class="depto-title">
        <span>📍 Setor: ${dep}</span>
        <span style="font-size:10px; font-weight:normal;">${listaDep.length} Nível(is) de Carreira</span>
      </div>`;

      html += `<table>
        <thead>
          <tr>
            <th style="width: 22%;">Cargo / Função</th>
            <th style="width: 14%;">Nível</th>
            <th style="width: 11%;">Salário Base</th>
            <th style="width: 10%;">Vale Alim.</th>
            <th style="width: 10%;">Taxa Serv.</th>
            <th style="width: 13%;">Remuneração Total</th>
            <th>Equipe Atual & Atribuições</th>
          </tr>
        </thead>
        <tbody>`;

      listaDep.forEach(c => {
        const fixo = Number(c.salario_base) || 0;
        const va = Number(c.vale_alimentacao) || 0;
        const taxa = Number(c.taxa_servico) || 0;
        const total = fixo + va + taxa;
        const contratados = colabsPorCargo(c.nome);

        html += `<tr>
          <td><strong>${c.nome}</strong></td>
          <td><span class="badge-nivel">${c.nivel || "Geral"}</span></td>
          <td>${fmtBRL(fixo)}</td>
          <td>${va > 0 ? fmtBRL(va) : "—"}</td>
          <td>${taxa > 0 ? fmtBRL(taxa) : "—"}</td>
          <td class="val-total">${fmtBRL(total)}</td>
          <td>
            ${c.descricao ? `<div style="color:#475569; font-size:9.5px; margin-bottom:4px;">${c.descricao}</div>` : ""}
            ${contratados.length > 0 
              ? `<div><strong style="font-size:9px; color:#0f172a;">Equipe Atual (${contratados.length}):</strong> ${contratados.map(f => `<span class="colabs-tag">👤 ${f.nome}</span>`).join("")}</div>`
              : `<span style="color:#94a3b8; font-size:9px; font-style:italic;">Cargo aberto / vaga disponível</span>`}
          </td>
        </tr>`;
      });

      html += `</tbody></table>`;
    });

    html += `<div class="footer">
      Documento do Mural de Carreiras gerado em ${hoje} · ${empNome} · Transparência e valorização profissional.
    </div></body></html>`;

    const win = window.open("", "_blank");
    if (!win) return alert("Habilite pop-ups para imprimir o Mural de Carreiras.");
    win.document.write(comFecharImpressao(html));
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div className="space-y-6">
      {/* BANNER DE INSPIRAÇÃO E TOPO DA PÁGINA */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-500/30">
              <Sparkles size={14} /> Plano de Cargos, Carreiras & Salários
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Inspire sua equipe a evoluir e subir de nível 🚀
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Defina os salários base, vales e taxa de serviço de cada função. Imprima o **Mural de Carreiras** para fixar na empresa e mostrar aos seus colaboradores o caminho para conquistar o próximo cargo!
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0 w-full md:w-auto">
            <button
              onClick={imprimirMuralCarreiras}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm px-5 py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
            >
              <Printer size={18} /> Imprimir Mural de Carreiras (PDF)
            </button>
            <button
              onClick={abrirNovoCargo}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-sm px-4 py-3.5 rounded-2xl border border-white/20 transition-all active:scale-95"
            >
              <Plus size={18} /> Criar Cargo / Função
            </button>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO DE FILTROS DE DEPARTAMENTO (SCROLLABLE NO MOBILE) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {DEPARTAMENTOS.map(dep => (
          <button
            key={dep}
            onClick={() => setDepartamentoFiltro(dep)}
            className={`px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shrink-0 ${
              departamentoFiltro === dep
                ? "bg-slate-900 text-white shadow-md shadow-slate-900/20"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {dep}
          </button>
        ))}
      </div>

      {/* LISTAGEM DE CARGOS POR DEPARTAMENTO */}
      {cargosFiltrados.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <Award size={32} />
          </div>
          <h3 className="font-black text-slate-800 text-lg">Nenhum cargo neste setor</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Clique no botão acima para adicionar cargos como Cozinheiro, Garçom, Barman ou Supervisor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {cargosFiltrados.map(c => {
            const fixo = Number(c.salario_base) || 0;
            const va = Number(c.vale_alimentacao) || 0;
            const taxa = Number(c.taxa_servico) || 0;
            const remTotal = fixo + va + taxa;
            const contratados = colabsPorCargo(c.nome);

            return (
              <div
                key={c.id}
                className="bg-white rounded-3xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-lg transition-all flex flex-col justify-between group space-y-4"
              >
                <div>
                  {/* TOPO: DEPARTAMENTO & NÍVEL */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100">
                      {c.departamento || "Geral"}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      {c.nivel || "Geral"}
                    </span>
                  </div>

                  {/* NOME DO CARGO */}
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-600 transition-colors">
                    {c.nome}
                  </h3>

                  {/* DESCRIÇÃO DA FUNÇÃO */}
                  {c.descricao && (
                    <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {c.descricao}
                    </p>
                  )}

                  {/* DESMEMBRAMENTO DE REMUNERAÇÃO */}
                  <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-1.5">
                    <div className="flex justify-between items-center text-xs text-slate-600 font-semibold">
                      <span>Salário Base:</span>
                      <span className="font-bold text-slate-800">{fmtBRL(fixo)}</span>
                    </div>
                    {va > 0 && (
                      <div className="flex justify-between items-center text-xs text-teal-700 font-semibold">
                        <span>+ Vale Alimentação:</span>
                        <span className="font-bold">{fmtBRL(va)}</span>
                      </div>
                    )}
                    {taxa > 0 && (
                      <div className="flex justify-between items-center text-xs text-indigo-700 font-semibold">
                        <span>+ Taxa de Serviço:</span>
                        <span className="font-bold">{fmtBRL(taxa)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700">Remuneração Total:</span>
                      <span className="text-base font-black text-emerald-600">{fmtBRL(remTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* COLABORADORES ATUAIS NO CARGO & AÇÕES */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      Contratados: <b className="text-slate-800">{contratados.length}</b>
                    </span>
                    <button
                      onClick={() => abrirAlocacao(c)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <UserCheck size={13} /> Promover / Alocar
                    </button>
                  </div>

                  {/* LISTINHA VISUAL DOS COLABORADORES */}
                  {contratados.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {contratados.map(f => (
                        <div
                          key={f.id}
                          className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200"
                        >
                          <div className="w-4 h-4 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-[9px] font-black">
                            {(f.nome || "?")[0].toUpperCase()}
                          </div>
                          <span className="truncate max-w-[110px]">{f.nome}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* BOTOES DE EDICAO/REMOCAO DO CARGO */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => abrirEdicaoCargo(c)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                      title="Editar Cargo"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!String(c.id).startsWith("cfg-") && (
                      <button
                        onClick={() => handleExcluirCargo(c.id)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Remover Cargo"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE CARGO */}
      {modalEdit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900">
                {form.id ? "Editar Cargo & Função" : "Criar Novo Cargo no Plano de Carreiras"}
              </h3>
              <button onClick={() => setModalEdit(false)} className="text-slate-400 hover:text-slate-600 font-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvarCargoSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Nome do Cargo / Função *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Cozinheiro 2, Bartender, Chef de Fila"
                  value={form.nome}
                  onChange={e => setForm({ ...form, nome: e.target.value })}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    Setor / Departamento
                  </label>
                  <select
                    value={form.departamento}
                    onChange={e => setForm({ ...form, departamento: e.target.value })}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500"
                  >
                    <option value="Cozinha">Cozinha</option>
                    <option value="Bar">Bar</option>
                    <option value="Salão">Salão</option>
                    <option value="Administração">Administração</option>
                    <option value="Gestão">Gestão</option>
                    <option value="Diretoria">Diretoria</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    Nível / Categoria
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Nível I, Pleno, Liderança"
                    value={form.nivel}
                    onChange={e => setForm({ ...form, nivel: e.target.value })}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    Salário Base (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 2200"
                    value={form.salario_base}
                    onChange={e => setForm({ ...form, salario_base: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-emerald-700 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    Vale Alim. (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 350"
                    value={form.vale_alimentacao}
                    onChange={e => setForm({ ...form, vale_alimentacao: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-teal-700 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                    Taxa Serv. (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 400"
                    value={form.taxa_servico}
                    onChange={e => setForm({ ...form, taxa_servico: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-indigo-700 outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Atribuições & Requisitos (opcional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Descreva o que é esperado do funcionário para alcançar este cargo..."
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none text-xs"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalEdit(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-colors shadow-lg shadow-emerald-600/20"
                >
                  {saving ? "Salvando..." : "Salvar Cargo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PROMOVER / ALOCAR FUNCIONÁRIO A UM CARGO */}
      {modalAlocar && cargoAlocar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Alocação / Promoção</span>
                <h3 className="text-lg font-black text-slate-900">Vincular a: {cargoAlocar.nome}</h3>
              </div>
              <button onClick={() => setModalAlocar(false)} className="text-slate-400 hover:text-slate-600 font-black">
                ✕
              </button>
            </div>

            <form onSubmit={handleAlocarFuncionarioSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Selecione o Funcionário da Equipe
                </label>
                <select
                  required
                  value={funcSelecionadoId}
                  onChange={e => setFuncSelecionadoId(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione um colaborador...</option>
                  {funcionarios
                    .filter(f => (f.status || "ativo").toLowerCase() !== "inativo")
                    .map(f => (
                      <option key={f.id} value={f.id}>
                        {f.nome} (Atual: {f.cargo || "Sem cargo"})
                      </option>
                    ))}
                </select>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-1 text-emerald-900">
                <p className="font-bold">✨ Ao promover/vincular:</p>
                <p>• O cargo do colaborador será atualizado para <b>{cargoAlocar.nome}</b>.</p>
                <p>• A remuneração base será ajustada para <b>{fmtBRL(cargoAlocar.salario_base)}</b>.</p>
                {cargoAlocar.vale_alimentacao > 0 && <p>• Vale Alimentação ajustado para <b>{fmtBRL(cargoAlocar.vale_alimentacao)}</b>.</p>}
                {cargoAlocar.taxa_servico > 0 && <p>• Taxa de Serviço estimada para <b>{fmtBRL(cargoAlocar.taxa_servico)}</b>.</p>}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalAlocar(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-colors shadow-lg shadow-emerald-600/20"
                >
                  {saving ? "Salvando..." : "Confirmar Promoção"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
