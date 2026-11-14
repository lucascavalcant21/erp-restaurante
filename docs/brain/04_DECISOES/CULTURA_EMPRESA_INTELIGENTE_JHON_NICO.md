# Cultura do Héfisto: a empresa inteligente (Jhon e Nico)

_Decisões do dono no chat, 14/11/2026 (01:17–01:23). Valem para o Héfisto vendável (sistema de teste, branch `hefisto-teste`); os tablets do restaurante não mudam._

## A ideia

O Héfisto é uma **empresa inteligente**: tem o controle de tudo (ar-condicionado ligado ou desligado, checklist feito ou não, o que a equipe produziu e o que não produziu, quem entrou e quem não entrou). O dono entra e diz: "Jhon e Nico, trabalhem enquanto eu estou de boa e cuidem de tudo. Não quero me preocupar com imposto, DRE, ficha técnica. Vocês cuidam e só me avisam, para eu aprovar ou não. Vão mostrando o que está acontecendo."

## Os dois assistentes (`app/lib/assistentes.mjs`)

| | Nico | Jhon |
|---|---|---|
| Para quem | A equipe (funcionário, tablet da loja) | O dono |
| Faz | Ficha técnica e "como faz", etiquetas, procedimentos do salão, treinamento, ponto (PIN de 4 números) | Tudo o que o Nico sabe + gestão: CMV, custo, produtos, DRE, imposto, contas, equipe |
| Jeito | Mais tocar do que digitar, rápido | Avisa, mostra o que está acontecendo e pede aprovação |
| Regra | **Ajuda e "dedura" para o Jhon**: o que a equipe não fez vira aviso para o Jhon. Nunca fala de dinheiro nem de gestão | **O Jhon pergunta ao Nico; o Nico não pergunta ao Jhon** |

Exemplos de aviso do Jhon ao dono: funcionário atrasado; ar-condicionado não desligado; checklist do bar não feito; produção do dia não feita; quem não bateu ponto.

## Como o acesso funciona

- **Área do Administrador** (só o dono): Salão, Cozinha, Bar, fichas técnicas, estoque, RH, financeiro e configurações, organizados e em destaque.
- **Tablets e funcionários**: o dono escolhe o que cada aparelho tem (só ponto · Nico + ponto · só Nico) e o sistema gera um login (e-mail e senha) que abre direto nessa tela. Base: "Apps e Terminais".
- **Planos**: Nico e Jhon só no Completo (R$ 89,90/mês). No Grátis, o cadeado leva ao checkout.

## Regras que não mudam

- Aviso e resumo do Jhon só com dado REAL do sistema (ponto, checklist, produção, sensores). Sem dado: DADOS INSUFICIENTES, nunca palpite.
- Nada que mexe em dinheiro, imposto ou cadastro é feito sem a aprovação do dono ("me avisando, para eu aprovar ou não").
- O ar-condicionado só entra quando houver um sensor ou tomada inteligente integrado; até lá, vira item de checklist de fechamento.

## Ordem de construção

1. **Feito (14/11):** nomes Nico e Jhon por quem está logado; o Nico não entra na gestão; plano Grátis com cadeados e checkout.
2. Área do Administrador reorganizada e montagem dos tablets (só ponto / Nico + ponto / só Nico) com login gerado.
3. Tela do Nico da equipe por botões, com ponto por PIN.
4. Avisos do Jhon ao dono: atraso, falta de ponto, checklist e produção não feitos (dados que o Héfisto já tem), com "aprovar / não aprovar".
5. **Início do dono ao vivo** (pedido do dono, 14/11/2026, 01:30): vendas do dia em tempo real e o dinheiro entrando a cada venda, meta do dia e do mês definida pelo dono, previsão de bater ou não a meta (PROJEÇÃO, com a conta mostrada), o que falta e estratégias do Jhon (SUGESTÃO), desconto dado, lucro e imposto. Tudo de dado REAL das vendas; sem dado, DADOS INSUFICIENTES. No visual da Home da Medway (faixa em degradê, barra de progresso, abas em pílula).
6. Integrações de sensores (ar-condicionado, temperatura) quando o dono escolher o equipamento.
