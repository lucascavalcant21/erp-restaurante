---
id: HDEV-011
titulo: Sistema de treinamento por função e área (Cozinha, Bar, Salão)
status: VALIDATING
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-11-05
---

# HDEV-011 — Sistema de treinamento por função e área (Cozinha, Bar, Salão)

## Objetivo

Formar cada funcionário novo por área e função, com conta própria, aulas com bonecos, prova, situações reais e aprovação prática do líder. O dono cria e edita tudo no Héfisto Estúdio, com falas sugeridas pela IA e aprovação antes de chegar à equipe.

Pedidos do dono (04/11/2026): cozinha com apresentação, pratos, montagem, cocção e liderança, ficha técnica; bar e salão do mesmo jeito; garçom com comportamento e situações inesperadas; montar mesas; servir vinho e outras bebidas; bonecos explicando e demonstrando.

## Critério de pronto

- [x] TREIN-1 e TREIN-2 aplicadas com a aprovação APR-017 (05/11/2026, TESTADO NO SUPABASE REAL).
- O dono revisou os rascunhos e preencheu as marcas [PREENCHER].
- Uma pessoa real concluiu uma trilha, e o líder aprovou.
- Fichas com modo de preparo e montagem escritos (0 de 97 pratos da cozinha e 0 de 30 itens do bar em 04/11/2026).



## Arquivos afetados

`db/treinamento/*`, `app/lib/treinamento*`, `app/components/treinamento/*`, `app/dashboard/treinamento/*`, `app/api/ia-treinamento-falas`, menu, catálogo de permissões e contas rápidas.



## Testes obrigatórios

`PGLITE=… node --test app/lib/trein-1.test.mjs app/lib/treinamento-conteudo.test.mjs app/lib/treinamento-regras.test.mjs`



## Resultado



## Evidências



## Histórico


