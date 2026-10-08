# Princípios de produto

1. **Prioridade absoluta:** SEGURANÇA > INTEGRIDADE DOS DADOS > FUNCIONAMENTO > NOVAS FEATURES.
2. **Dado real ou nada.**
   - Toda métrica tem natureza: REAL, ESTIMATIVA, PROJEÇÃO, SIMULAÇÃO, HIPÓTESE, META ou SUGESTÃO.
   - Sem base: DADOS INSUFICIENTES, com o motivo e o que falta.
3. **Determinístico onde importa.**
   - Dinheiro, estoque, CMV, CMO e saldo são calculados por código e SQL testados.
   - O modelo de linguagem só interpreta pedidos, explica, organiza e recomenda.
4. **Rastreável.** Toda resposta mostra fonte, período, unidade, consulta e horário. Toda ação deixa auditoria: pedido, proposta, confirmação e execução.
5. **Confirmação antes de mudar.** Ação = prévia → CONFIRMAR → função do domínio (a mesma da tela) → auditoria. Repetir o pedido não duplica (idempotência).
6. **Isolamento de empresa.** O servidor resolve empresa e unidade no banco; o corpo da requisição nunca define o tenant. Vazamento entre empresas é sempre CRÍTICO.
7. **Reusar o ERP.** A inteligência usa as funções e regras que o ERP já tem. Nunca existe uma lógica paralela de estoque, financeiro ou permissão.
8. **Menos é mais na tela.**
   - Três alertas em destaque, ordenados por criticidade × impacto × confiança.
   - Perguntas do Héfisto só quando só a equipe sabe a resposta.
9. **Celular primeiro.** Tudo que o dono precisa no dia deve funcionar no telefone.
10. **Permissão mínima.** Cada integração e cada pessoa vê e faz só o necessário.
