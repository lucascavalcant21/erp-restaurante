// Política de privacidade pública (exigida pela Meta para publicar o app do WhatsApp).
// Texto aprovado pelo dono antes de ir ao ar. Mudou o tratamento de dados? Atualize aqui e a data.
export const metadata = {
  title: "Política de Privacidade — Héfisto",
  description: "Como o Héfisto ERP trata dados pessoais (LGPD).",
};

const ATUALIZADA_EM = "9 de outubro de 2026";
const CONTATO = "lucascavalcant21@gmail.com";

const s = {
  main: { maxWidth: 760, margin: "0 auto", padding: "40px 20px 64px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", lineHeight: 1.6, color: "#1f2328", background: "#fff" },
  h1: { fontSize: 28, margin: "0 0 4px" },
  h2: { fontSize: 19, margin: "32px 0 8px" },
  muted: { color: "#57606a", fontSize: 14 },
};

export default function Privacidade() {
  return (
    <main style={s.main}>
      <h1 style={s.h1}>Política de Privacidade</h1>
      <p style={s.muted}>Héfisto ERP · atualizada em {ATUALIZADA_EM}</p>

      <p>
        Esta política explica como o <strong>Héfisto</strong> (app.hefisto.com.br), sistema de gestão para restaurantes,
        trata dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).
      </p>

      <h2 style={s.h2}>1. Quem somos</h2>
      <p>
        O Héfisto é operado por Lucas Cavalcante. Para qualquer assunto sobre privacidade ou para exercer seus direitos,
        escreva para <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
      </p>
      <p>
        Para os dados que cada restaurante cadastra no sistema (equipe, clientes, fornecedores, vendas), o restaurante é o
        controlador e o Héfisto atua como operador, tratando esses dados apenas para prestar o serviço contratado.
      </p>

      <h2 style={s.h2}>2. Dados que tratamos</h2>
      <ul>
        <li><strong>Conta de acesso:</strong> nome, e-mail, telefone, perfil de acesso, unidade e registros de acesso (data, hora, IP).</li>
        <li><strong>Dados operacionais do restaurante:</strong> estoque, compras, vendas, financeiro, fichas técnicas, reservas e eventos.</li>
        <li><strong>Dados da equipe do restaurante</strong> (cadastrados pelo próprio restaurante): nome, cargo, horários, ponto e escala e, quando o restaurante registra, documentos e dados trabalhistas (como CPF e salário), visíveis apenas para quem tem permissão de RH.</li>
        <li><strong>Canal de WhatsApp:</strong> número de telefone de quem envia, conteúdo da mensagem de texto, data e hora. O canal atende apenas números previamente autorizados; mensagens de outros números são descartadas sem resposta.</li>
      </ul>

      <h2 style={s.h2}>3. Para que usamos</h2>
      <ul>
        <li>Prestar o serviço do ERP e da Central de Inteligência (consultas, resumos e alertas sobre a operação).</li>
        <li>Responder comandos e perguntas enviados pelo WhatsApp por usuários autorizados.</li>
        <li>Segurança: controle de acesso, isolamento entre empresas e unidades, auditoria e prevenção de abuso.</li>
        <li>Cumprir obrigações legais (por exemplo, fiscais e trabalhistas do restaurante).</li>
      </ul>
      <p>
        Bases legais (art. 7º da LGPD): execução de contrato, cumprimento de obrigação legal ou regulatória e legítimo
        interesse em manter o serviço seguro. Não vendemos dados pessoais e não os usamos para publicidade.
      </p>

      <h2 style={s.h2}>4. Com quem compartilhamos</h2>
      <p>Apenas com fornecedores necessários para o serviço funcionar, que tratam os dados em nosso nome:</p>
      <ul>
        <li><strong>Supabase</strong>: banco de dados e autenticação.</li>
        <li><strong>Vercel</strong>: hospedagem da aplicação.</li>
        <li><strong>Meta (WhatsApp Business Platform)</strong>: envio e recebimento das mensagens do canal de WhatsApp.</li>
        <li><strong>Anthropic</strong>: interpretação do texto das perguntas feitas à Central de Inteligência. Números e cálculos vêm do banco de dados do restaurante, não do modelo de IA.</li>
      </ul>
      <p>Esses fornecedores podem armazenar dados fora do Brasil, com as salvaguardas previstas na LGPD.</p>

      <h2 style={s.h2}>5. Por quanto tempo guardamos</h2>
      <p>
        Enquanto a conta do restaurante estiver ativa e pelo prazo exigido por lei depois disso. Registros de auditoria e
        de mensagens do canal de WhatsApp são mantidos pelo tempo necessário para segurança e suporte, e então apagados
        ou anonimizados.
      </p>

      <h2 style={s.h2}>6. Segurança</h2>
      <p>
        Acesso por usuário e perfil, isolamento dos dados por empresa e unidade no próprio banco de dados, conexões
        criptografadas, credenciais guardadas apenas no servidor e registro de auditoria das ações da Central de Inteligência.
      </p>

      <h2 style={s.h2}>7. Seus direitos</h2>
      <p>
        Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação, informação
        sobre compartilhamento e revogação de consentimento (art. 18 da LGPD). Se os dados foram cadastrados por um
        restaurante, encaminharemos o pedido a ele. Contato: <a href={`mailto:${CONTATO}`}>{CONTATO}</a>.
      </p>

      <h2 style={s.h2}>8. Exclusão de dados</h2>
      <p>
        Para pedir a exclusão dos seus dados, inclusive dos dados do canal de WhatsApp, envie um e-mail para{" "}
        <a href={`mailto:${CONTATO}`}>{CONTATO}</a> com o assunto “Exclusão de dados”. Respondemos em até 15 dias.
      </p>

      <h2 style={s.h2}>9. Mudanças nesta política</h2>
      <p>Quando esta política mudar, a data no topo será atualizada.</p>
    </main>
  );
}
