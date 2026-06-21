"use client";

import { useState, useEffect } from "react";
import { Printer, Save } from "lucide-react";
import { PageHeader, PageBody, Card, Field, TextInput, Select, Btn, Toast, Toggle } from "../../../components/ui";
import { useERP } from "../../../context/ERPContext";
import { fetchConfigImpressao, salvarConfigImpressao, imprimirHtml } from "../../../lib/impressoes";

export default function ImpressoesPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await fetchConfigImpressao(unidadeAtiva);
      if (data) setConfig(data);
      setLoading(false);
    }
    load();
  }, [unidadeAtiva]);

  async function handleSave() {
    setSalvando(true);
    const { error } = await salvarConfigImpressao(config, unidadeAtiva);
    setSalvando(false);
    if (error) {
      setToast("Erro ao salvar: " + error);
    } else {
      setToast("Configurações salvas!");
    }
    setTimeout(() => setToast(""), 3000);
  }

  function handleTestarCozinha() {
    const html = gerarHtmlCozinhaMock();
    imprimirHtml(html, config.tamanho_papel);
  }

  function handleTestarConta() {
    const html = gerarHtmlContaMock();
    imprimirHtml(html, config.tamanho_papel);
  }

  function gerarHtmlCozinhaMock() {
    return `
      <div class="center">
        <h2>${config.cabecalho || unidadeInfo.nome}</h2>
        <div class="divider"></div>
        <h3>PEDIDO #001 (PRODUÇÃO)</h3>
        <div class="divider"></div>
      </div>
      <p>CLIENTE: João</p>
      <p>MESA: 1</p>
      <p>HORA: ${new Date().toLocaleTimeString('pt-BR')}</p>
      <div class="divider"></div>
      <div class="flex-between bold">
        <span>QTD | DESCRICAO</span>
      </div>
      <div class="divider"></div>
      
      <div class="item-row">
        <div class="item-qtd">1 -</div>
        <div class="item-desc bold">HAMBÚRGUER ARTESANAL</div>
      </div>
      <div class="sub-item">+ Pão Brioche</div>
      <div class="sub-item">+ Ponto da Carne: Mal Passado</div>
      <div class="sub-item">+ Adicional de Bacon</div>
      
      <div class="item-row" style="margin-top: 5px;">
        <div class="item-qtd">2 -</div>
        <div class="item-desc bold">COCA-COLA LATA</div>
      </div>
      <div class="sub-item">+ Gelo e Limão</div>
      
      <div class="divider"></div>
      <div class="center">
        <p>${config.rodape || ''}</p>
      </div>
    `;
  }

  function gerarHtmlContaMock() {
    return `
      <div class="center">
        <h2>${config.cabecalho || unidadeInfo.nome}</h2>
        <div class="divider"></div>
        <h3>CONTA FINAL - MESA 1</h3>
        <div class="divider"></div>
      </div>
      <p>CLIENTE: João</p>
      <p>DATA: ${new Date().toLocaleString('pt-BR')}</p>
      <div class="divider"></div>
      <div class="flex-between bold">
        <span>QTD | DESCRICAO</span>
        <span>TOTAL</span>
      </div>
      <div class="divider"></div>
      
      <div class="item-row">
        <div class="item-qtd">1 -</div>
        <div class="item-desc">HAMBÚRGUER ART.</div>
        <div class="item-val">35,00</div>
      </div>
      
      <div class="item-row">
        <div class="item-qtd">2 -</div>
        <div class="item-desc">COCA-COLA LATA</div>
        <div class="item-val">10,00</div>
      </div>
      
      <div class="divider"></div>
      <div class="flex-between">
        <span>SUBTOTAL</span>
        <span>45,00</span>
      </div>
      <div class="flex-between">
        <span>TAXA (10%)</span>
        <span>4,50</span>
      </div>
      <div class="divider"></div>
      <div class="flex-between bold" style="font-size: 16px;">
        <span>TOTAL</span>
        <span>R$ 49,50</span>
      </div>
      <div class="divider"></div>
      <div class="center">
        <p>${config.rodape || ''}</p>
        <p style="font-size:10px; margin-top:5px;">*** NÃO É DOCUMENTO FISCAL ***</p>
      </div>
    `;
  }

  if (loading) return <div className="p-10 text-center">Carregando...</div>;
  if (!config) return null;

  return (
    <div className="min-h-screen pb-32">
      <PageHeader title="Tickets & Impressoras" subtitle="Configure a impressão térmica" icon={Printer} back />
      <PageBody>
        {toast && <Toast show>{toast}</Toast>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Configurações */}
          <div className="space-y-4">
            <Card>
              <h2 className="font-bold mb-4" style={{ color: 'var(--fg)' }}>Ajustes do Papel</h2>
              <Field label="Tamanho da Bobina">
                <Select value={config.tamanho_papel} onChange={e => setConfig({...config, tamanho_papel: e.target.value})}>
                  <option value="80mm">80mm (Padrão grande)</option>
                  <option value="58mm">58mm (Pequena maquininha)</option>
                </Select>
              </Field>
              <Field label="Cabeçalho Personalizado" className="mt-3">
                <TextInput value={config.cabecalho || ""} onChange={e => setConfig({...config, cabecalho: e.target.value})} placeholder="Nome Fantasia" />
              </Field>
              <Field label="Rodapé Personalizado" className="mt-3">
                <TextInput value={config.rodape || ""} onChange={e => setConfig({...config, rodape: e.target.value})} placeholder="Ex: Volte Sempre!" />
              </Field>
            </Card>

            <Card>
              <h2 className="font-bold mb-4" style={{ color: 'var(--fg)' }}>Gatilhos de Impressão Automática</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Imprimir Ticket de Produção ao lançar produto na mesa</span>
                  <Toggle active={config.imprimir_cozinha} onChange={() => setConfig({...config, imprimir_cozinha: !config.imprimir_cozinha})} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Imprimir Conta Final ao abrir fechamento de mesa</span>
                  <Toggle active={config.imprimir_conta} onChange={() => setConfig({...config, imprimir_conta: !config.imprimir_conta})} />
                </div>
              </div>
            </Card>

            <Btn onClick={handleSave} disabled={salvando} className="w-full h-12 shadow-lg !bg-indigo-600 hover:!bg-indigo-700 text-white border-none">
              <Save size={18} className="mr-2" /> Salvar Configurações
            </Btn>
          </div>

          {/* Preview Visual */}
          <div className="space-y-4">
            <Card>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold" style={{ color: 'var(--fg)' }}>Preview do Ticket</h2>
                <div className="flex gap-2">
                  <Btn variant="ghost" className="!h-8 !text-[11px]" onClick={handleTestarCozinha}>Testar Impressora (Cozinha)</Btn>
                  <Btn variant="primary" className="!h-8 !text-[11px]" onClick={handleTestarConta}>Testar Impressora (Conta)</Btn>
                </div>
              </div>

              <div className="flex justify-center p-4 rounded-lg overflow-x-auto" style={{ background: '#e5e7eb' }}>
                {/* Simulacro do papel térmico */}
                <div style={{
                  width: config.tamanho_papel === '80mm' ? '300px' : '210px',
                  background: 'white',
                  color: 'black',
                  padding: '15px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  minHeight: '200px'
                }}>
                  <div dangerouslySetInnerHTML={{ __html: gerarHtmlContaMock() }} />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </PageBody>
    </div>
  );
}
