"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  Award, Plus, Edit2, Trash2, Printer, Users, ChevronRight, Sparkles, 
  TrendingUp, CheckCircle, HelpCircle, DollarSign, ShieldCheck, UserCheck,
  FileCheck, PieChart, FileText, Calendar, CheckSquare
} from "lucide-react";
import { fmtBRL } from "../../../components/ui";
import { comFecharImpressao } from "../../../lib/imprimir";
import { salvarCargo, removerCargo, atualizarColaborador, registrarPromocaoColaborador } from "../../../lib/rh";

// ── CERTIFICADO OFICIAL DE PROMOÇÃO (PDF LANDSCAPE) ──────────────────────────
export const imprimirCertificadoPromocao = (colaboradorNome, cargoAnterior, cargoNovo, remuneralTotal, unidadeInfo) => {
  const empNome = unidadeInfo?.nome_fantasia || unidadeInfo?.nome || "Nossa Empresa";
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Certificado de Promoção - ${colaboradorNome}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Georgia', 'Times New Roman', serif; background: #fafaf9; color: #1c1917; padding: 15px; text-align: center; }
      .cert-border { border: 10px double #b45309; padding: 30px; background: #fff; border-radius: 12px; min-height: 510px; display: flex; flex-direction: column; justify-content: space-between; position: relative; box-shadow: inset 0 0 25px rgba(180,83,9,0.08); }
      .header-title { font-size: 13px; font-weight: bold; letter-spacing: 4px; text-transform: uppercase; color: #b45309; margin-bottom: 5px; }
      .main-title { font-size: 30px; font-weight: bold; text-transform: uppercase; color: #78350f; margin: 5px 0 15px; letter-spacing: 2px; }
      .cert-text { font-size: 16px; color: #44403c; line-height: 1.8; max-width: 780px; margin: 0 auto 15px; }
      .colab-name { font-size: 28px; font-weight: bold; color: #065f46; text-decoration: underline; display: block; margin: 8px 0; font-style: italic; }
      .cargo-box { background: #fef3c7; border: 2px dashed #f59e0b; padding: 14px 28px; border-radius: 14px; display: inline-block; margin: 12px auto; }
      .cargo-title { font-size: 22px; font-weight: bold; color: #92400e; text-transform: uppercase; }
      .cargo-sub { font-size: 13px; color: #78350f; font-weight: bold; margin-bottom: 4px; }
      .footer-signatures { display: flex; justify-content: space-around; margin-top: 35px; border-top: 1px solid #e7e5e4; padding-top: 18px; }
      .sig-line { width: 220px; border-top: 1px solid #44403c; padding-top: 5px; font-size: 11px; font-weight: bold; color: #292524; }
      @media print { body { padding: 0; background: #fff; } }
    </style></head><body>
    <div class="cert-border">
      <div>
        <div class="header-title">🏆 RECONHECIMENTO & EVOLUÇÃO PROFISSIONAL</div>
        <div class="main-title">${empNome}</div>
        <div class="cert-text">
          Conferimos com orgulho o presente <strong>Certificado de Promoção de Nível</strong> ao colaborador(a):
          <span class="colab-name">${colaboradorNome}</span>
          pelo seu excelente desempenho, assiduidade e dedicação ao cumprimento do nosso Plano de Carreiras.
        </div>
        <div class="cargo-box">
          <div class="cargo-sub">Promovido(a) de <b>${cargoAnterior || "Nível Inicial"}</b> para o cargo de:</div>
          <div class="cargo-title">🌟 ${cargoNovo}</div>
        </div>
      </div>
      <div>
        <p style="font-size: 12px; color: #78350f; font-style: italic; margin-bottom: 20px;">
          "O sucesso é o resultado da constância de propósitos. Parabéns por conquistar este novo degrau!"
        </p>
        <div class="footer-signatures">
          <div class="sig-line">Gestão & Direção de RH</div>
          <div class="sig-line">Data: ${hoje}</div>
          <div class="sig-line">Assinatura do Colaborador</div>
        </div>
      </div>
    </div>
    </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return alert("Habilite pop-ups para imprimir o Certificado de Promoção.");
  win.document.write(comFecharImpressao(html));
  win.document.close();
  setTimeout(() => win.print(), 400);
};

// ── DESCRITIVO OFICIAL DE CARGO E FUNÇÃO (PDF A4) ────────────────────────────
export const imprimirDescritivoFuncao = (cargoObj, unidadeInfo) => {
  const empNome = unidadeInfo?.nome_fantasia || unidadeInfo?.nome || "Nossa Empresa";
  const reqs = Array.isArray(cargoObj.requisitos) ? cargoObj.requisitos : [];
  const funcoesStr = cargoObj.funcoes_padrao || cargoObj.descricao || "Executar as atividades diárias do setor conforme orientações do supervisor.";
  const fixo = Number(cargoObj.salario_base) || 0;
  const va = Number(cargoObj.vale_alimentacao) || 0;
  const taxa = Number(cargoObj.taxa_servico) || 0;
  const remTotal = fixo + va + taxa;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Descritivo de Função - ${cargoObj.nome}</title>
    <style>
      @page { size: A4 portrait; margin: 15mm; }
      * { box-sizing: border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; padding: 10px; line-height: 1.5; font-size: 12px; }
      .header { border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 20px; text-align: center; }
      .header h1 { margin: 0; font-size: 20px; font-weight: 900; color: #0f766e; text-transform: uppercase; }
      .header p { margin: 4px 0 0; font-size: 11px; color: #64748b; font-weight: bold; }
      .card-info { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .section-title { font-size: 13px; font-weight: 900; color: #0f766e; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 18px; margin-bottom: 8px; }
      ul { padding-left: 20px; margin-top: 6px; }
      li { margin-bottom: 4px; }
      .signatures { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; }
      .sig-line { width: 220px; border-top: 1px solid #334155; padding-top: 4px; font-size: 11px; font-weight: bold; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <div class="header">
        <h1>DESCRITIVO DE CARGO E FUNÇÃO OFICIAL</h1>
        <p>${empNome} · Módulo de Recursos Humanos</p>
      </div>

      <div class="card-info">
        <div><b>Cargo / Função:</b> ${cargoObj.nome}</div>
        <div><b>Departamento:</b> ${cargoObj.departamento || "Operacional"}</div>
        <div><b>Nível Hierárquico:</b> ${cargoObj.nivel || "Padrão"}</div>
        <div><b>Remuneração Total:</b> ${fmtBRL(remTotal)} (Base: ${fmtBRL(fixo)})</div>
      </div>

      <div class="section-title">📋 1. Atribuições & Responsabilidades Diárias</div>
      <p style="white-space: pre-wrap; font-size: 12px; color: #334155;">${funcoesStr}</p>

      ${reqs.length > 0 ? `
        <div class="section-title">🎯 2. Requisitos & Competências Necessárias</div>
        <ul>
          ${reqs.map(r => `<li>${r}</li>`).join("")}
        </ul>
      ` : ''}

      <div class="section-title">⚖️ 3. Termo de Ciência e Compromisso</div>
      <p style="font-size: 11px; color: #475569; text-align: justify;">
        Declaro ter tomado ciência integral das funções, atribuições e responsabilidades inerentes ao meu cargo acima descrito, comprometendo-me a desempenhá-las com zelo, assiduidade e ética profissional.
      </p>

      <div class="signatures">
        <div class="sig-line">Assinatura do Colaborador<br/><span style="font-size:9px; font-weight:normal;">Data: ___/___/______</span></div>
        <div class="sig-line">Gestão de RH / Empregador<br/><span style="font-size:9px; font-weight:normal;">${empNome}</span></div>
      </div>
    </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return alert("Habilite pop-ups para imprimir o Descritivo de Função.");
  win.document.write(comFecharImpressao(html));
  win.document.close();
  setTimeout(() => win.print(), 400);
};


export default function PlanoCargos({ cargos = [], funcionarios = [], unidadeAtiva, unidadeInfo, onRecarregar }) {
  const [departamentoFiltro, setDepartamentoFiltro] = useState("Todos");
  const [modalEdit, setModalEdit] = useState(false);
  const [cargoEdit, setCargoEdit] = useState(null);
  const [modalAlocar, setModalAlocar] = useState(false);
  const [cargoAlocar, setCargoAlocar] = useState(null);
  const [funcSelecionadoId, setFuncSelecionadoId] = useState("");
  const [motivoPromocao, setMotivoPromocao] = useState("Promoção por Desempenho e Assiduidade");
  const [saving, setSaving] = useState(false);

  const formStatePadrao = {
    id: null,
    nome: "",
    departamento: "Cozinha",
    nivel: "Nível 1",
    salario_base: "",
    vale_alimentacao: "",
    taxa_servico: "",
    descricao: "",
    requisitos: ""
  };
  const [form, setForm] = useState(formStatePadrao);

  const DEPARTAMENTOS = ["Todos", "Cozinha", "Bar", "Salão", "Administração", "Gestão", "Diretoria"];

  const cargosFiltrados = cargos.filter(c => {
    if (departamentoFiltro === "Todos") return true;
    return (c.departamento || "").toLowerCase() === departamentoFiltro.toLowerCase();
  });

  // Mapeia colaboradores por cargo
  const colabsPorCargo = (nomeCargo) => {
    if (!nomeCargo) return [];
    const n = nomeCargo.trim().toLowerCase();
    return funcionarios.filter(f => {
      const status = (f.status || "ativo").toLowerCase();
      if (status === "inativo") return false;
      return (f.cargo || "").trim().toLowerCase() === n;
    });
  };

  // ── PAINEL DE CUSTO FINANCEIRO DE FOLHA POR SETOR (ITEM 5) ──────────────────
  const resumoFinanceiroFolha = useMemo(() => {
    const ativos = funcionarios.filter(f => (f.status || "ativo").toLowerCase() !== "inativo");
    let totalSalarioBase = 0;
    let totalVA = 0;
    let totalTaxa = 0;

    const porDepto = {
      Cozinha: { base: 0, va: 0, taxa: 0, total: 0, qtd: 0 },
      Bar: { base: 0, va: 0, taxa: 0, total: 0, qtd: 0 },
      Salão: { base: 0, va: 0, taxa: 0, total: 0, qtd: 0 },
      Outros: { base: 0, va: 0, taxa: 0, total: 0, qtd: 0 },
    };

    ativos.forEach(f => {
      const base = Number(f.salario) || 0;
      const va = Number(f.vale_alimentacao) || 0;
      const taxa = Number(f.taxa_servico_mes) || 0;
      const tot = base + va + taxa;

      totalSalarioBase += base;
      totalVA += va;
      totalTaxa += taxa;

      // Identifica depto do cargo
      const cargoObj = cargos.find(c => (c.nome || "").toLowerCase().trim() === (f.cargo || "").toLowerCase().trim());
      const dep = cargoObj?.departamento || "Outros";
      const depKey = porDepto[dep] ? dep : "Outros";

      porDepto[depKey].base += base;
      porDepto[depKey].va += va;
      porDepto[depKey].taxa += taxa;
      porDepto[depKey].total += tot;
      porDepto[depKey].qtd += 1;
    });

    const totalGeral = totalSalarioBase + totalVA + totalTaxa;
    const mediaPorPessoa = ativos.length > 0 ? totalGeral / ativos.length : 0;

    return {
      ativosCount: ativos.length,
      totalSalarioBase,
      totalVA,
      totalTaxa,
      totalGeral,
      mediaPorPessoa,
      porDepto
    };
  }, [funcionarios, cargos]);

  const abrirNovoCargo = () => {
    setForm({ ...formStatePadrao, departamento: departamentoFiltro !== "Todos" ? departamentoFiltro : "Cozinha" });
    setModalEdit(true);
  };

  const abrirEdicaoCargo = (c) => {
    const reqsStr = Array.isArray(c.requisitos) ? c.requisitos.join("\n") : (c.requisitos || "");
    setForm({
      id: c.id,
      nome: c.nome || "",
      departamento: c.departamento || "Cozinha",
      nivel: c.nivel || "Nível 1",
      salario_base: c.salario_base || "",
      vale_alimentacao: c.vale_alimentacao || "",
      taxa_servico: c.taxa_servico || "",
      descricao: c.descricao || "",
      requisitos: reqsStr
    });
    setModalEdit(true);
  };

  const handleSalvarCargoSubmit = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return alert("Informe o nome do cargo.");
    setSaving(true);

    const reqList = form.requisitos
      ? form.requisitos.split("\n").map(r => r.trim()).filter(Boolean)
      : [];

    const payload = {
      id: form.id,
      nome: form.nome.trim(),
      departamento: form.departamento,
      nivel: form.nivel,
      salario_base: parseFloat(form.salario_base) || 0,
      vale_alimentacao: parseFloat(form.vale_alimentacao) || 0,
      taxa_servico: parseFloat(form.taxa_servico) || 0,
      descricao: form.descricao,
      requisitos: reqList
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
    setMotivoPromocao("Promoção por Desempenho e Assiduidade");
    setModalAlocar(true);
  };

  const handleAlocarFuncionarioSubmit = async (e) => {
    e.preventDefault();
    if (!funcSelecionadoId || !cargoAlocar) return alert("Selecione um funcionário.");
    setSaving(true);

    const f = funcionarios.find(x => x.id === funcSelecionadoId);
    const cargoAnterior = f?.cargo || "Sem cargo";
    const salarioAnterior = Number(f?.salario) || 0;

    const salarioBase = Number(cargoAlocar.salario_base) || salarioAnterior || 0;
    const va = Number(cargoAlocar.vale_alimentacao) || Number(f?.vale_alimentacao) || 0;
    const taxa = Number(cargoAlocar.taxa_servico) || Number(f?.taxa_servico_mes) || 0;
    const remTotal = salarioBase + va + taxa;

    // 1. Atualizar cadastro do colaborador
    const { error } = await atualizarColaborador(funcSelecionadoId, {
      cargo: cargoAlocar.nome,
      salario: salarioBase,
      vale_alimentacao: va,
      taxa_servico_mes: taxa
    });

    if (error) {
      setSaving(false);
      return alert("Erro ao promover/alocar colaborador: " + error);
    }

    // 2. Registrar no Histórico de Promoções (Item 3)
    await registrarPromocaoColaborador({
      colaborador_id: f.id,
      colaborador_nome: f.nome,
      cargo_anterior: cargoAnterior,
      cargo_novo: cargoAlocar.nome,
      salario_anterior: salarioAnterior,
      salario_novo: salarioBase,
      vale_alimentacao: va,
      taxa_servico: taxa,
      motivo: motivoPromocao,
      responsavel: "Gestão"
    });

    setSaving(false);
    setModalAlocar(false);

    // 3. Perguntar se deseja imprimir Certificado de Promoção (Item 2)
    const querCertificado = confirm(`🎉 Parabéns! ${f.nome} foi promovido(a) ao cargo de "${cargoAlocar.nome}"!\n\nDeseja IMPRIMIR O CERTIFICADO OFICIAL DE PROMOÇÃO em PDF para entregar ao colaborador?`);
    
    if (querCertificado) {
      imprimirCertificadoPromocao(f.nome, cargoAnterior, cargoAlocar.nome, remTotal, unidadeInfo);
    }

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
        .header h2 { margin: 4px 0 0; font-size: 13px; font-weight: 700; color: #047857; text-transform: uppercase; }
        .header p { margin: 6px 0 0; font-size: 10px; color: #475569; font-style: italic; max-width: 600px; margin-left: auto; margin-right: auto; }
        .depto-title { font-size: 13px; font-weight: 900; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 6px 12px; border-radius: 6px; margin: 16px 0 8px; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; page-break-inside: avoid; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f8fafc; font-size: 9.5px; text-transform: uppercase; font-weight: 900; color: #334155; }
        .badge-nivel { background: #e0e7ff; color: #3730a3; font-weight: 800; font-size: 9px; padding: 2px 6px; border-radius: 4px; display: inline-block; }
        .val-total { font-weight: 900; color: #047857; font-size: 11.5px; }
        .colabs-tag { background: #f1f5f9; border: 1px solid #e2e8f0; font-size: 9px; padding: 2px 5px; border-radius: 4px; color: #334155; margin-right: 3px; display: inline-block; margin-top: 2px; }
        .req-list { margin: 4px 0 0; padding-left: 12px; font-size: 9px; color: #475569; }
        .footer { margin-top: 20px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #94a3b8; }
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
            <th style="width: 20%;">Cargo / Função</th>
            <th style="width: 12%;">Nível</th>
            <th style="width: 11%;">Salário Base</th>
            <th style="width: 10%;">Vale Alim.</th>
            <th style="width: 10%;">Taxa Serv.</th>
            <th style="width: 12%;">Remuneração</th>
            <th>Equipe & Requisitos para Promoção</th>
          </tr>
        </thead>
        <tbody>`;

      listaDep.forEach(c => {
        const fixo = Number(c.salario_base) || 0;
        const va = Number(c.vale_alimentacao) || 0;
        const taxa = Number(c.taxa_servico) || 0;
        const total = fixo + va + taxa;
        const contratados = colabsPorCargo(c.nome);
        const reqs = Array.isArray(c.requisitos) ? c.requisitos : [];

        html += `<tr>
          <td><strong>${c.nome}</strong></td>
          <td><span class="badge-nivel">${c.nivel || "Geral"}</span></td>
          <td>${fmtBRL(fixo)}</td>
          <td>${va > 0 ? fmtBRL(va) : "—"}</td>
          <td>${taxa > 0 ? fmtBRL(taxa) : "—"}</td>
          <td class="val-total">${fmtBRL(total)}</td>
          <td>
            ${c.descricao ? `<div style="color:#0f172a; font-size:9.5px; font-weight:600; margin-bottom:2px;">${c.descricao}</div>` : ""}
            ${reqs.length > 0 ? `<ul class="req-list">${reqs.map(r => `<li><b>•</b> ${r}</li>`).join("")}</ul>` : ""}
            <div style="margin-top:5px;">
              ${contratados.length > 0 
                ? `<div><strong style="font-size:9px; color:#0f172a;">Equipe Atual (${contratados.length}):</strong> ${contratados.map(f => `<span class="colabs-tag">👤 ${f.nome}</span>`).join("")}</div>`
                : `<span style="color:#059669; font-size:9px; font-weight:bold; font-style:italic;">✨ Cargo aberto / Vaga disponível para promoção</span>`}
            </div>
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
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-5 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold uppercase tracking-widest border border-emerald-500/30">
              <Sparkles size={14} /> Plano de Cargos, Carreiras & Salários
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Inspire sua equipe a evoluir e subir de nível 🚀
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Defina salários base, vales, taxa de serviço e **requisitos de promoção**. Imprima o **Mural de Carreiras** para afixar na empresa e entregar certificados aos promovidos!
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
            <button
              onClick={imprimirMuralCarreiras}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm px-5 py-3.5 rounded-2xl transition-all shadow-lg shadow-emerald-500/25 active:scale-95"
            >
              <Printer size={18} /> Imprimir Mural (PDF)
            </button>
            <button
              onClick={abrirNovoCargo}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm px-4 py-3.5 rounded-2xl border border-white/20 transition-all active:scale-95"
            >
              <Plus size={18} /> Criar Cargo
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL FINANCEIRO DE CUSTO DE FOLHA POR SETOR (ITEM 5) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <PieChart size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base sm:text-lg">Custo da Folha por Setor & Remuneração</h3>
              <p className="text-xs text-slate-500 font-medium">Impacto financeiro mensal de salários, vales e taxa de serviço da equipe ativa</p>
            </div>
          </div>
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
            👥 {resumoFinanceiroFolha.ativosCount} Colaboradores Ativos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Folha Total Mensal</span>
            <p className="text-xl font-black text-slate-900">{fmtBRL(resumoFinanceiroFolha.totalGeral)}</p>
            <p className="text-[11px] font-bold text-slate-500">Média: {fmtBRL(resumoFinanceiroFolha.mediaPorPessoa)} / colab</p>
          </div>

          <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-100 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">🍳 Cozinha</span>
              <span className="text-xs font-bold text-amber-700">{resumoFinanceiroFolha.porDepto.Cozinha.qtd} colabs</span>
            </div>
            <p className="text-lg font-black text-amber-900">{fmtBRL(resumoFinanceiroFolha.porDepto.Cozinha.total)}</p>
            <p className="text-[11px] font-medium text-amber-700">Base: {fmtBRL(resumoFinanceiroFolha.porDepto.Cozinha.base)}</p>
          </div>

          <div className="bg-purple-50/60 rounded-2xl p-4 border border-purple-100 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest">🍸 Bar</span>
              <span className="text-xs font-bold text-purple-700">{resumoFinanceiroFolha.porDepto.Bar.qtd} colabs</span>
            </div>
            <p className="text-lg font-black text-purple-900">{fmtBRL(resumoFinanceiroFolha.porDepto.Bar.total)}</p>
            <p className="text-[11px] font-medium text-purple-700">Base: {fmtBRL(resumoFinanceiroFolha.porDepto.Bar.base)}</p>
          </div>

          <div className="bg-sky-50/60 rounded-2xl p-4 border border-sky-100 space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-sky-800 uppercase tracking-widest">🍽️ Salão</span>
              <span className="text-xs font-bold text-sky-700">{resumoFinanceiroFolha.porDepto.Salão.qtd} colabs</span>
            </div>
            <p className="text-lg font-black text-sky-900">{fmtBRL(resumoFinanceiroFolha.porDepto.Salão.total)}</p>
            <p className="text-[11px] font-medium text-sky-700">Base: {fmtBRL(resumoFinanceiroFolha.porDepto.Salão.base)}</p>
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
            const reqs = Array.isArray(c.requisitos) ? c.requisitos : [];

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

                  {/* REQUISITOS DE PROMOÇÃO (ITEM 1) */}
                  {reqs.length > 0 && (
                    <div className="mt-3 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-1">
                      <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1">
                        <CheckSquare size={12} /> Requisitos para subir de nível:
                      </span>
                      <ul className="text-[11px] font-medium text-slate-700 space-y-0.5 pt-1">
                        {reqs.map((r, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
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
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 mt-2">
                    <button
                      onClick={() => imprimirDescritivoFuncao(c, unidadeInfo)}
                      className="px-2.5 py-1.5 text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
                      title="Imprimir Termo/Descritivo de Função em PDF"
                    >
                      <FileText size={14} /> Descritivo PDF
                    </button>
                    <div className="flex items-center gap-1">
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
                {form.id ? "Editar Cargo & Requisitos" : "Criar Novo Cargo no Plano de Carreiras"}
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
                  Requisitos para Promoção (1 por linha)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: 6 meses como Auxiliar I&#10;Domínio de cortes e fichas técnicas&#10;90%+ de assiduidade nos checklists"
                  value={form.requisitos}
                  onChange={e => setForm({ ...form, requisitos: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none focus:border-emerald-500 resize-none text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Atribuições & Descrição Geral
                </label>
                <textarea
                  rows={2}
                  placeholder="Descreva o que é esperado do funcionário neste cargo..."
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

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1">
                  Motivo da Promoção / Observação
                </label>
                <input
                  type="text"
                  value={motivoPromocao}
                  onChange={e => setMotivoPromocao(e.target.value)}
                  placeholder="Ex: Excelente assiduidade e alcance de metas"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-1 text-emerald-900">
                <p className="font-bold">✨ Ao confirmar a promoção:</p>
                <p>• Cargo atualizado para <b>{cargoAlocar.nome}</b>.</p>
                <p>• Salário base ajustado para <b>{fmtBRL(cargoAlocar.salario_base)}</b>.</p>
                {cargoAlocar.vale_alimentacao > 0 && <p>• Vale Alimentação: <b>{fmtBRL(cargoAlocar.vale_alimentacao)}</b>.</p>}
                {cargoAlocar.taxa_servico > 0 && <p>• Taxa de Serviço estimada: <b>{fmtBRL(cargoAlocar.taxa_servico)}</b>.</p>}
                <p className="pt-1 text-[11px] text-emerald-700 font-bold">• 📜 O Certificado Oficial em PDF poderá ser impresso em seguida.</p>
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
