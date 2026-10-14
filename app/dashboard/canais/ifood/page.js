"use client";

// Canal iFood da unidade. A tela antiga só marcava "Conectado" na unidade sem
// testar nada (e testava por /api/integrations, que nem chega ao Next em
// produção). Agora o cadastro é o mesmo da Marmitaria → Configurações: segredo
// cifrado no servidor e "Conectado" só depois de o iFood confirmar a loja.

import { useERP } from "../../../context/ERPContext";
import { PageHeader, PageBody, Card } from "../../../components/ui";
import IfoodConexao from "../../../components/integracoes/IfoodConexao";
import { Store } from "lucide-react";

export default function IFoodConfigPage() {
  const { unidadeAtiva } = useERP();
  const unidadeId = typeof unidadeAtiva === "object" ? unidadeAtiva?.id : unidadeAtiva;
  return (
    <>
      <PageHeader title="iFood" subtitle="Cadastro e teste da conexão com a sua loja no iFood" icon={Store} />
      <PageBody>
        <Card>
          <IfoodConexao unidadeId={unidadeId && unidadeId !== "todas" ? unidadeId : null} />
        </Card>
      </PageBody>
    </>
  );
}
