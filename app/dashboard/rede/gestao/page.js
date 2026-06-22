"use client";

import { useState, useEffect } from "react";
import { Building2, Plus, Edit2, Trash2, ShieldAlert } from "lucide-react";
import {
  PageHeader, PageBody, Card, Btn, Modal, Field, TextInput, Toast
} from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { inserirUnidade, atualizarUnidade, removerUnidade, fetchUnidades } from "../../../lib/unidades";
import { registrarUsuario, formatarParaEmailFantasma } from "../../../lib/auth";

export default function GestaoUnidadesPage() {
  const { isCentral } = useERP();
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ id: "", nome: "", curto: "", cor: "#3B82F6" });
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");
  const [credenciais, setCredenciais] = useState(null);

  const carregar = async () => {
    setLoading(true);
    const { data } = await fetchUnidades();
    setUnidades(data || []);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  if (!isCentral) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="mx-auto text-slate-600 mb-4" size={48} />
        <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
        <p className="text-slate-500">Apenas o Cérebro (Central) pode gerenciar unidades.</p>
      </div>
    );
  }

  const abrirModal = (u = null) => {
    setErro("");
    if (u) {
      setEditando(u);
      setForm({ id: u.id, nome: u.nome, curto: u.curto || "", cor: u.cor || "#3B82F6" });
    } else {
      setEditando(null);
      setForm({ id: "", nome: "", curto: "", cor: "#3B82F6" });
    }
    setModal(true);
  };

  const salvar = async () => {
    if (!form.id || !form.nome) return setErro("Preencha o ID e o Nome.");
    setSalvando(true);
    
    if (editando) {
      const { error } = await atualizarUnidade(editando.id, form);
      if (error) setErro("Erro ao atualizar: " + error);
      else {
        setToast("Unidade atualizada!");
        setModal(false);
        carregar();
      }
    } else {
      const { error } = await inserirUnidade(form);
      if (error) setErro("Erro ao criar (ID já existe?): " + error);
      else {
        // Criar login da unidade
        const emailFantasma = formatarParaEmailFantasma(form.id);
        const senhaPadrao = "cerebro123";
        await registrarUsuario({
          nome: form.nome,
          email: emailFantasma,
          senha: senhaPadrao,
          papel: "gerente",
          unidade: form.id
        });

        setToast("Unidade criada com sucesso!");
        setModal(false);
        setCredenciais({ login: form.id, senha: senhaPadrao });
        carregar();
      }
    }
    setSalvando(false);
  };

  const remover = async (id) => {
    if (!confirm("Tem certeza? Isso apagará TODO o estoque, cardápio e funcionários dessa unidade!")) return;
    const { error } = await removerUnidade(id);
    if (error) alert("Erro ao remover: " + error);
    else carregar();
  };

  return (
    <div className="min-h-screen">
      <PageHeader 
        title="Gestão de Unidades" 
        subtitle="Adicione ou remova restaurantes da sua holding" 
        icon={Building2} 
      />
      <PageBody>
        <Toast show={!!toast}>{toast}</Toast>

        <div className="flex justify-between items-center mb-4">
          <p className="erp-label">Lojas Cadastradas ({unidades.length})</p>
          <Btn variant="primary" className="!h-8 text-[11px]" onClick={() => abrirModal()}>
            <Plus size={14} /> Nova Loja
          </Btn>
        </div>

        {loading ? (
          <div className="text-center p-8 text-slate-500">Carregando lojas...</div>
        ) : (
          <div className="grid gap-3">
            {unidades.map(u => (
              <Card key={u.id} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0" style={{ background: u.cor || '#3B82F6' }}>
                  {u.curto || u.nome.substring(0, 3)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white text-sm">{u.nome}</h3>
                  <p className="text-xs text-slate-500">ID: {u.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => abrirModal(u)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-800 text-slate-500 hover:text-white">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => remover(u.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-slate-500 hover:bg-emerald-500/20">
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageBody>

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? "Editar Loja" : "Nova Loja"}>
        <div className="space-y-4">
          <Field label="ID no Sistema (Será o login da Loja)">
            <TextInput 
              value={form.id} 
              onChange={e => setForm({...form, id: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')})} 
              disabled={!!editando}
              placeholder="ex: matriz, filial1" 
            />
          </Field>
          <Field label="Nome Oficial do Restaurante">
            <TextInput 
              value={form.nome} 
              onChange={e => setForm({...form, nome: e.target.value})} 
              placeholder="Ex: Tico Tico Saladas" 
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome Curto (3 a 5 letras)">
              <TextInput 
                value={form.curto} 
                onChange={e => setForm({...form, curto: e.target.value})} 
                placeholder="Ex: Tico" 
              />
            </Field>
            <Field label="Cor da Marca">
              <input 
                type="color" 
                value={form.cor} 
                onChange={e => setForm({...form, cor: e.target.value})}
                className="w-full h-[42px] rounded-xl cursor-pointer bg-transparent border-none"
              />
            </Field>
          </div>

          {erro && <p className="text-slate-500 text-xs text-center">{erro}</p>}

          <div className="flex gap-3 pt-2">
            <Btn variant="ghost" className="flex-1" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn variant="primary" className="flex-1" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar Loja"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Modal de Sucesso com Credenciais */}
      <Modal open={!!credenciais} onClose={() => setCredenciais(null)} title="🎉 Loja Criada!">
        <div className="text-center py-4 space-y-4">
          <p className="text-slate-500 text-sm">O acesso do dono dessa unidade foi gerado com sucesso.</p>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-slate-500 text-xs uppercase font-bold">Usuário / Login</span>
              <span className="text-white font-mono text-lg font-bold">{credenciais?.login}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="text-slate-500 text-xs uppercase font-bold">Senha Padrão</span>
              <span className="text-emerald-400 font-mono text-lg font-bold">{credenciais?.senha}</span>
            </div>
          </div>
          <p className="text-slate-500 text-xs mt-2">Envie estes dados para o gerente acessar. Ele pode trocar a senha depois.</p>
          <Btn variant="primary" className="w-full mt-4" onClick={() => setCredenciais(null)}>Entendi</Btn>
        </div>
      </Modal>
    </div>
  );
}
