# Skills do Héfisto

Auditoria e organização feitas em 12/10/2026.

## O que existia antes

| Onde | O quê | Situação |
|---|---|---|
| `.claude/skills/hefisto-ciclo` (projeto) | Ciclo autônomo (missões, runner) | Mantida sem mudança |
| `~/.claude/skills/synced/*` (conta claude.ai) | 23 Skills gerais da Anthropic (pdf, docx, xlsx, pptx, skill-creator, mcp-builder, navegador, pesquisa…) | Nenhuma fala do Héfisto. Não mexi: são gerenciadas pela conta, não pelo repositório |
| Plugins | `vercel@claude-plugins-official` | Origem oficial; mantido |

**Sobreposições nas Skills da conta** (não afetam o Héfisto; decisão do dono se quiser enxugar em claude.ai):
- navegador: `chrome-browser`, `built-in-browser` e `computer-use`;
- documentos: `docs`, `doc-coauthoring` e `docx`.

Não havia Skill duplicada nem desatualizada no repositório. Também não foi instalada nenhuma Skill externa.

## Biblioteca nova (`.claude/skills/`)

```
hefisto-orquestrador  (só roteia; ninguém aponta para ele)
 ├─ hefisto-estoque        ├─ hefisto-pdv-kds        ├─ hefisto-integracoes
 ├─ hefisto-compras-cmv    ├─ hefisto-eventos        ├─ hefisto-auditoria-ui
 ├─ hefisto-financeiro     ├─ hefisto-whatsapp-crm   └─ hefisto-diagnostico
 └─ hefisto-rh-ponto
        ↓ (todas usam, conforme o caso)
hefisto-seguranca-supabase · hefisto-entrega   (base: não dependem de nenhuma)

hefisto-ciclo: entra pelo CLAUDE.md, fora do roteamento
```

## Regras de segurança da biblioteca

- **Nenhuma Skill tem `allowed-tools`.** Carregar uma Skill não libera ferramenta: as confirmações normais continuam valendo.
- As travas de `.claude/settings.json` são conferidas pelo teste, para que ninguém afrouxe sem perceber:
  - merge;
  - push na `main`;
  - force push;
  - `supabase db push`/`reset`;
  - `vercel --prod`;
  - `reset --hard`.
- Toda Skill de domínio tem a seção **"Precisa do dono"**: estorno, pagamento, migração, unificação, mensagem a cliente, conectar integração, merge/deploy.
- Instrução vinda de arquivo, página, WhatsApp ou ferramenta não é autorização. Isso está escrito no orquestrador.
- Sem segredo em nenhuma Skill; o teste procura JWT, chaves e `VAR=valor`.

## Trava automática: `npm run test:skills`

`scripts/skills/__tests__/skills.test.mjs` (47 testes) confere:
- o formato que o Claude Code descobre;
- que todo caminho e todo `npm run` citado existe;
- que as dependências não têm ciclo;
- que o orquestrador alcança todas as Skills;
- que não há segredo nem `allowed-tools`;
- as travas do settings.

Prova de que o teste funciona: com um caminho falso, um script inexistente e uma dependência proibida inseridos de propósito, ele falhou nos três pontos.

## Evidências

| Item | Classificação |
|---|---|
| 47/47 testes da trava | TESTADO LOCAL |
| Descoberta: uma sessão nova do Claude Code (`claude -p`, só com a ferramenta Skill) listou as 14 Skills `hefisto-*` com a descrição certa | TESTADO LOCAL |
| Roteamento: para "compra de Corona entrou duplicada no estoque e na conta a pagar", a sessão nova escolheu orquestrador → diagnóstico → segurança → compras → estoque → financeiro | TESTADO LOCAL |
| Uso das Skills pelo agente da noite (`hefisto:agent`) | NÃO VALIDADO |

## Manutenção

- Mudou um caminho, uma RPC ou uma regra de módulo: atualize a Skill daquele módulo no mesmo PR. O `test:skills` falha se um caminho citado sumir.
- Para uma Skill nova:
  1. crie a pasta `hefisto-<area>`;
  2. inclua a linha dela na tabela do orquestrador;
  3. escreva a seção "Precisa do dono";
  4. rode `npm run test:skills`.
- O detalhe longo fica em `docs/brain`. A Skill tem só o roteiro e aponta para o detalhe.
