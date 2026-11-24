"use client";

// Dados da empresa: o que sai no cabeçalho das atas, orçamentos e impressos.
// Antes eram três cartões soltos com um "Salvar" escondido no meio da página.

import { useEffect, useMemo, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchUnidades, atualizarUnidade } from "../../../lib/unidades";
import { mascaraTelefone } from "../../../lib/mascaras.mjs";
import { cepCompleto, cnpjCompleto, mascaraCep } from "../../../lib/configuracoes-hub.mjs";
import { Painel, Bloco, Campo, BotaoSalvar, SemUnidade, inputCls, avisarSalvo } from "./ui";

const CAMPOS = ["nome", "telefone_contato", "horario_funcionamento", "email_unidade", "razao_social", "nome_fantasia", "cnpj", "regime_tributario", "inscricao_estadual", "inscricao_municipal", "cep", "endereco", "numero", "bairro", "cidade", "uf"];
const vazio = Object.fromEntries(CAMPOS.map((k) => [k, ""]));

const mascaraCNPJ = (v) => String(v || "").replace(/\D/g, "").slice(0, 14)
  .replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");

export default function Empresa({ onVoltar }) {
  const { unidadeAtiva, recarregarUnidades } = useERP();
  const [orig, setOrig] = useState(null);
  const [d, setD] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const real = unidadeAtiva && unidadeAtiva !== "todas";

  useEffect(() => {
    if (!real) return;
    fetchUnidades().then(({ data }) => {
      const u = data?.find((x) => x.id === unidadeAtiva) || {};
      const p = Object.fromEntries(CAMPOS.map((k) => [k, u[k] ?? ""]));
      p.cnpj = p.cnpj ? mascaraCNPJ(p.cnpj) : "";
      p.cep = p.cep ? mascaraCep(p.cep) : "";
      p.telefone_contato = p.telefone_contato ? mascaraTelefone(p.telefone_contato) : "";
      setOrig(p); setD(p);
    });
  }, [unidadeAtiva, real]);

  const mudou = useMemo(() => orig && CAMPOS.some((k) => String(d[k] ?? "") !== String(orig[k] ?? "")), [d, orig]);
  const set = (k) => (e) => {
    const v = e.target.value;
    setD((p) => ({ ...p, [k]: k === "cnpj" ? mascaraCNPJ(v) : k === "telefone_contato" ? mascaraTelefone(v) : k === "cep" ? mascaraCep(v) : k === "uf" ? v.toUpperCase().slice(0, 2) : v }));
  };

  const buscarCep = async () => {
    if (!cepCompleto(d.cep)) return;
    setBuscandoCep(true);
    try {
      const r = await (await fetch(`https://viacep.com.br/ws/${d.cep.replace(/\D/g, "")}/json/`)).json();
      if (!r.erro) setD((p) => ({ ...p, endereco: r.logradouro || p.endereco, bairro: r.bairro || p.bairro, cidade: r.localidade || p.cidade, uf: r.uf || p.uf }));
    } catch { /* sem internet: preenche à mão */ }
    setBuscandoCep(false);
  };

  const salvar = async () => {
    setErro("");
    if (!String(d.nome).trim()) return setErro("O nome da loja não pode ficar vazio.");
    setSalvando(true);
    const updates = Object.fromEntries(CAMPOS.map((k) => [k, String(d[k] ?? "").trim() === "" ? null : String(d[k]).trim()]));
    updates.nome = String(d.nome).trim();
    const { error } = await atualizarUnidade(unidadeAtiva, updates);
    setSalvando(false);
    if (error) return setErro(`Não salvou: ${error}`);
    setOrig(d);
    await recarregarUnidades();
    avisarSalvo(setOk);
  };

  if (!real) return <Painel titulo="Dados da empresa" onVoltar={onVoltar}><SemUnidade /></Painel>;

  return (
    <Painel titulo="Dados da empresa" descricao="Sai no cabeçalho das atas, orçamentos e impressos." onVoltar={onVoltar}
      rodape={<><BotaoSalvar onClick={salvar} salvando={salvando} ok={ok} desabilitado={!mudou} />{erro && <span className="text-[13px] font-medium text-hf-danger">{erro}</span>}</>}>
      {!orig ? <p className="text-[14px] text-hf-muted">Carregando…</p> : (
        <>
          <Bloco titulo="Contato">
            <Campo rotulo="Nome da loja"><input className={inputCls} value={d.nome} onChange={set("nome")} /></Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Telefone / WhatsApp"><input className={inputCls} inputMode="tel" value={d.telefone_contato} onChange={set("telefone_contato")} placeholder="(00) 00000-0000" /></Campo>
              <Campo rotulo="Horário"><input className={inputCls} value={d.horario_funcionamento} onChange={set("horario_funcionamento")} placeholder="Ex.: Ter a Dom, 18h às 23h" /></Campo>
            </div>
            <Campo rotulo="E-mail"><input className={inputCls} type="email" inputMode="email" value={d.email_unidade} onChange={set("email_unidade")} placeholder="contato@suaempresa.com.br" /></Campo>
          </Bloco>

          <Bloco titulo="Endereço">
            <Campo rotulo={buscandoCep ? "CEP (buscando…)" : "CEP"} dica="Com o CEP completo, rua, bairro e cidade se preenchem sozinhos."
              aviso={d.cep && !cepCompleto(d.cep) ? `CEP incompleto: tem ${d.cep.replace(/\D/g, "").length} de 8 números.` : null}>
              <input className={inputCls} inputMode="numeric" value={d.cep} onChange={set("cep")} onBlur={buscarCep} placeholder="00000-000" />
            </Campo>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <Campo rotulo="Rua / avenida"><input className={inputCls} value={d.endereco} onChange={set("endereco")} /></Campo>
              <Campo rotulo="Número"><input className={inputCls} value={d.numero} onChange={set("numero")} /></Campo>
            </div>
            <Campo rotulo="Bairro"><input className={inputCls} value={d.bairro} onChange={set("bairro")} /></Campo>
            <div className="grid grid-cols-[1fr_76px] gap-3">
              <Campo rotulo="Cidade"><input className={inputCls} value={d.cidade} onChange={set("cidade")} /></Campo>
              <Campo rotulo="UF"><input className={`${inputCls} uppercase`} value={d.uf} onChange={set("uf")} maxLength={2} /></Campo>
            </div>
          </Bloco>

          <Bloco titulo="Fiscal">
            <Campo rotulo="CNPJ" aviso={d.cnpj && !cnpjCompleto(d.cnpj) ? "CNPJ incompleto: são 14 números." : null}>
              <input className={inputCls} inputMode="numeric" value={d.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0000-00" />
            </Campo>
            <Campo rotulo="Razão social"><input className={inputCls} value={d.razao_social} onChange={set("razao_social")} /></Campo>
            <Campo rotulo="Nome fantasia"><input className={inputCls} value={d.nome_fantasia} onChange={set("nome_fantasia")} /></Campo>
            <Campo rotulo="Regime tributário">
              <select className={inputCls} value={d.regime_tributario || ""} onChange={set("regime_tributario")}>
                <option value="">Escolha…</option>
                {["MEI", "Simples Nacional", "Lucro Presumido", "Lucro Real"].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Inscrição estadual"><input className={inputCls} value={d.inscricao_estadual} onChange={set("inscricao_estadual")} placeholder="Isento ou número" /></Campo>
              <Campo rotulo="Inscrição municipal"><input className={inputCls} value={d.inscricao_municipal} onChange={set("inscricao_municipal")} placeholder="Se houver" /></Campo>
            </div>
          </Bloco>
        </>
      )}
    </Painel>
  );
}
