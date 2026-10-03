// Testes de ENTRADA/RETIRADA, ESTORNO, AJUSTE DE INVENTÁRIO e PIN (EST-MOV-1).
// Puras + integração no Postgres em memória (PGlite) com o esquema de estoque
// de produção (auditoria de 02/10/2026), as funções REAIS do repo (lotes/FEFO,
// bebidas, permissões), a SEC-EST-1 e a proposta db/EST_MOV_1_...sql. Uso:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/estoque-movimento.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  quantidadeDoLancamento, unidadesDaFracao, paraUnidadeDoCadastro, embalagemDoProduto, rotuloMotivo, podeEstornar,
  registrarMovimento, estornarMovimento, ajustarInventario, lerSegurancaEstoque, salvarSegurancaEstoque, novaChave,
  corrigirItemContagem, MSG_BANCO_DESATUALIZADO, produtosParaLancar, saldoDepois,
} from "./estoque-movimento.mjs";
import { criarContagem, salvarItemContagem, fecharContagem, MSG_JA_CONTADO } from "./contagem-estoque.mjs";
import { criarBancoF21, clienteSupabase } from "./teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

// ── 1. puras: quantidade por embalagem + fração ──────────────────────────────
const arrozCad = { unidade_medida: "kg", tamanho_embalagem: 2, unidade_comercial: "pacote" };
const q1 = quantidadeDoLancamento({ insumo: arrozCad, embalagens: "2", fracao: "350", unidadeFracao: "g" });
conferir("exemplo do dono: 2 pacotes de 2 kg + 350 g = 4,35 kg", [q1.quantidade, q1.unidade, q1.texto], [4.35, "kg", "2 pacote(s) de 2 kg + 350 g = 4,35 kg"]);
conferir("detalhe guardado para a auditoria (o que foi digitado)", q1.detalhe, { embalagens: 2, tamanho_embalagem: 2, unidade_embalagem: "pacote", fracao: 350, unidade_fracao: "g" });
conferir("só embalagens: 3 pacotes = 6 kg; informado = 3 pacote", [quantidadeDoLancamento({ insumo: arrozCad, embalagens: "3" }).quantidade, quantidadeDoLancamento({ insumo: arrozCad, embalagens: "3" }).unidade_informada], [6, "pacote"]);
conferir("só fração em kg com vírgula: 1,250 kg", quantidadeDoLancamento({ insumo: arrozCad, fracao: "1,250" }).quantidade, 1.25);
conferir("fração em g de produto em kg: 750 g = 0,75 kg", quantidadeDoLancamento({ insumo: arrozCad, fracao: "750", unidadeFracao: "g" }).quantidade, 0.75);
const oleoCad = { unidade_medida: "L", tamanho_embalagem: 0.9, unidade_comercial: "garrafa" };
conferir("óleo: 4 garrafas de 0,9 L + 300 ml = 3,9 L", quantidadeDoLancamento({ insumo: oleoCad, embalagens: "4", fracao: "300", unidadeFracao: "ml" }).quantidade, 3.9);
const aguaCad = { unidade_medida: "garrafa", tamanho_embalagem: 12, unidade_comercial: "fardo" };
conferir("água: 2 fardos de 12 garrafas + 5 garrafas = 29 garrafas", quantidadeDoLancamento({ insumo: aguaCad, embalagens: "2", fracao: "5" }).quantidade, 29);
conferir("unidades da fração: kg→[kg,g], L→[L,ml], garrafa→[garrafa]", [unidadesDaFracao("kg"), unidadesDaFracao("l"), unidadesDaFracao("garrafa")], [["kg", "g"], ["L", "ml"], ["garrafa"]]);
conferir("conversões aceitas e recusadas", [paraUnidadeDoCadastro(500, "g", "kg"), paraUnidadeDoCadastro(2, "kg", "g"), paraUnidadeDoCadastro(1, "ml", "kg"), paraUnidadeDoCadastro(3, "un", "un")], [0.5, 2000, null, 3]);
const granel = { unidade_medida: "kg", tamanho_embalagem: 1, unidade_comercial: "kg", categoria: "Pre-preparos" };
conferir("pré-preparo a granel não tem embalagem", [embalagemDoProduto(granel), quantidadeDoLancamento({ insumo: granel, embalagens: "1" }).erro != null], [null, true]);
conferir("erros: vazio, negativo, embalagem quebrada, zero, unidade que não combina, precisão",
  [quantidadeDoLancamento({ insumo: arrozCad }).erro, quantidadeDoLancamento({ insumo: arrozCad, fracao: "-1" }).erro,
   quantidadeDoLancamento({ insumo: arrozCad, embalagens: "1,5" }).erro, quantidadeDoLancamento({ insumo: arrozCad, fracao: "0" }).erro,
   quantidadeDoLancamento({ insumo: arrozCad, fracao: "5", unidadeFracao: "ml" }).erro != null, quantidadeDoLancamento({ insumo: arrozCad, fracao: "0,5", unidadeFracao: "g" }).erro != null],
  ["Informe a quantidade.", "A quantidade não pode ser negativa.", "Embalagens: use número inteiro (o resto vai na fração).", "A quantidade deve ser maior que zero.", true, true]);
conferir("rótulos de motivo", [rotuloMotivo("transferencia_enviada"), rotuloMotivo("estorno"), rotuloMotivo("ajuste_inventario"), rotuloMotivo("x")], ["Transferência", "Estorno", "Ajuste de inventário", null]);
conferir("botão estornar: só entrada/retirada, não estorno, não estornado",
  [podeEstornar({ id: "a", tipo: "entrada" }), podeEstornar({ id: "a", tipo: "entrada" }, new Set(["a"])), podeEstornar({ id: "b", tipo: "saida", estorno_de_id: "a" }), podeEstornar({ id: "c", tipo: "transferencia_saida" })],
  [true, false, false, false]);

const cad = [
  { id: "a", nome: "Arroz", fornecedor: "Atacadão" }, { id: "b", nome: "Batata", codigo_interno: "B12" },
  { id: "c", nome: "Café", marca: "Pilão" }, { id: "d", nome: "Açúcar" },
];
const itensLocal = [{ estoque_id: "E1", insumo_id: "a", quantidade_atual: 0 }, { estoque_id: "E1", insumo_id: "b", quantidade_atual: 3 }, { estoque_id: "E2", insumo_id: "c", quantidade_atual: 9 }];
const nomes = (l) => l.map((p) => `${p.insumo.nome}${p.vinculado ? "" : "*"}=${p.saldo}`);
conferir("RETIRADA: só o que está no local, com saldo primeiro", nomes(produtosParaLancar({ insumos: cad, itens: itensLocal, estoqueId: "E1", tipo: "saida" })), ["Batata=3", "Arroz=0"]);
conferir("ENTRADA sem busca: os do local; com busca: cadastro inteiro (fora do local marcado)",
  [nomes(produtosParaLancar({ insumos: cad, itens: itensLocal, estoqueId: "E1", tipo: "entrada" })), nomes(produtosParaLancar({ insumos: cad, itens: itensLocal, estoqueId: "E1", tipo: "entrada", termo: "acu" }))],
  [["Arroz=0", "Batata=3"], ["Açúcar*=0"]]);
conferir("busca por fornecedor, código e marca (sem acento)",
  [nomes(produtosParaLancar({ insumos: cad, itens: itensLocal, estoqueId: "E1", tipo: "entrada", termo: "atacadao" })),
   nomes(produtosParaLancar({ insumos: cad, itens: itensLocal, estoqueId: "E1", tipo: "saida", termo: "b12" })),
   nomes(produtosParaLancar({ insumos: cad, itens: itensLocal, estoqueId: "E1", tipo: "entrada", termo: "pilao" }))],
  [["Arroz=0"], ["Batata=3"], ["Café*=0"]]);
conferir("saldo depois: entrada soma, retirada subtrai (3 casas)", [saldoDepois(3, "entrada", 1.35), saldoDepois(3, "saida", 3.5), saldoDepois(null, "entrada", 2)], [4.35, -0.5, 2]);

const vinhoCad = { unidade_medida: "garrafa", tamanho_embalagem: 750, unidade_conteudo: "ml", unidade_comercial: "garrafa", permite_fracionado: true };
const qv = quantidadeDoLancamento({ insumo: vinhoCad, embalagens: "2", fracao: "300" });
conferir("garrafa fracionada (cadastro em garrafa): 2 fechadas + 300 ml → saldo 1.800 ml (= 2,4 garrafas)",
  [qv.quantidadeSaldo, qv.unidadeSaldo, qv.quantidade, qv.texto, unidadesDaFracao(vinhoCad)], [1800, "ml", 2.4, "2 garrafa(s) fechadas + 300 ml = 1.800 ml", ["L", "ml"]]);
conferir("soma no campo (expositor + depósito): 6+4 garrafas de água = 10", quantidadeDoLancamento({ insumo: { unidade_medida: "garrafa" }, fracao: "6+4" }).quantidadeSaldo, 10);
conferir("produto comum: saldo na unidade do cadastro", [q1.quantidadeSaldo, q1.unidadeSaldo], [4.35, "kg"]);

// ── 2. banco: esquema de estoque como em produção ────────────────────────────
const FIXTURE = `
  alter table public.insumos add column unidade_medida text, add column custo_unitario numeric default 0,
    add column tamanho_embalagem numeric, add column categoria text, add column departamento text default 'cozinha';
  alter table public.estoques add column slug text, add column tipo text default 'alimentos', add column status text not null default 'ativo';
  create table public.estoque_itens (
    id uuid primary key default gen_random_uuid(), unidade_id text not null references public.unidades(id),
    estoque_id uuid not null references public.estoques(id), insumo_id uuid not null references public.insumos(id),
    quantidade_atual numeric not null default 0 check (quantidade_atual >= 0), estoque_minimo numeric, estoque_maximo numeric,
    local_interno text, validade date, custo_unitario numeric, permite_transferencia boolean not null default true,
    ultima_movimentacao_em timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
    unique (estoque_id, insumo_id));
  create table public.estoque_movimentacoes_multi (
    id uuid primary key default gen_random_uuid(), transferencia_id uuid,
    unidade_id text not null references public.unidades(id) on delete cascade,
    estoque_id uuid not null references public.estoques(id) on delete restrict,
    estoque_destino_id uuid references public.estoques(id) on delete restrict,
    insumo_id uuid not null references public.insumos(id) on delete restrict,
    tipo text not null check (tipo in ('entrada','saida','contagem','transferencia_saida','transferencia_entrada')),
    quantidade numeric not null, saldo_anterior numeric not null default 0, saldo_posterior numeric not null default 0,
    usuario_id uuid, usuario_nome text, observacao text, data_movimento timestamptz not null default now(),
    created_at timestamptz not null default now(), valor_unitario numeric, valor_total numeric);
  -- como estava em produção em 02/10/2026
  alter table public.estoque_itens enable row level security;
  create policy auth_all on public.estoque_itens for all to authenticated using (true) with check (true);
  create policy estoque_itens_auth_full on public.estoque_itens for all to authenticated using (true) with check (true);
  alter table public.estoque_movimentacoes_multi enable row level security;
  create policy auth_all on public.estoque_movimentacoes_multi for all to authenticated using (true) with check (true);
  create policy estoque_mov_multi_auth_full on public.estoque_movimentacoes_multi for all to authenticated using (true) with check (true);
  grant select, insert, update, delete on public.estoque_itens to authenticated;
  grant all on public.estoque_movimentacoes_multi to authenticated;
  grant references, trigger, truncate on public.estoque_movimentacoes_multi to anon;
  grant select, insert, update on public.insumos, public.estoques to authenticated;
  -- permissões (docs/controle-acesso-rbac.sql; corpo das funções = produção)
  create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, nome text not null,
    status text not null default 'ativo', tipo_acesso text not null default 'funcionario', perfil_id uuid,
    super_admin boolean not null default false, unidade_principal_id text, locked_until timestamptz, valid_from timestamptz,
    valid_until timestamptz, timezone text not null default 'America/Sao_Paulo', allowed_days smallint[] not null default '{0,1,2,3,4,5,6}',
    allowed_start_time time, allowed_end_time time);
  create table public.perfil_permissoes (perfil_id uuid not null, permission_key text not null, created_at timestamptz not null default now(), primary key (perfil_id, permission_key));
  create table public.usuario_permissoes (usuario_id uuid not null, permission_key text not null, effect text not null default 'allow', created_at timestamptz not null default now());
  create table public.usuario_escopos (usuario_id uuid, unidade_id text, data_scope text);
  create function public.hefisto_permission_match(granted text, wanted text) returns boolean language sql immutable as $$
    select granted = '*' or granted = wanted or granted = split_part(wanted,'.',1) || '.*'
        or granted = split_part(wanted,'.',1) || '.' || split_part(wanted,'.',2) || '.*' $$;
  create function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text) returns boolean
  language plpgsql stable security definer set search_path = public as $$
  declare v_user usuarios_erp%rowtype; v_local timestamp;
  begin
    select * into v_user from usuarios_erp where auth_user_id = p_auth_user_id;
    if not found or v_user.status <> 'ativo' then return false; end if;
    if v_user.locked_until is not null and v_user.locked_until > now() then return false; end if;
    if v_user.valid_from is not null and v_user.valid_from > now() then return false; end if;
    if v_user.valid_until is not null and v_user.valid_until < now() then return false; end if;
    v_local := now() at time zone coalesce(v_user.timezone,'America/Sao_Paulo');
    if not (extract(dow from v_local)::smallint = any(v_user.allowed_days)) then return false; end if;
    if v_user.allowed_start_time is not null and v_local::time < v_user.allowed_start_time then return false; end if;
    if v_user.allowed_end_time is not null and v_local::time > v_user.allowed_end_time then return false; end if;
    if v_user.super_admin then return true; end if;
    if exists (select 1 from usuario_permissoes up where up.usuario_id = v_user.id and up.effect='deny'
               and hefisto_permission_match(up.permission_key, p_permission)) then return false; end if;
    return exists (select 1 from usuario_permissoes up where up.usuario_id = v_user.id and up.effect='allow'
                   and hefisto_permission_match(up.permission_key, p_permission))
        or exists (select 1 from perfil_permissoes pp where pp.perfil_id = v_user.perfil_id
                   and hefisto_permission_match(pp.permission_key, p_permission));
  end $$;
  create function public.hefisto_user_in_unit(p_auth_user_id uuid, p_unidade_id text) returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (select 1 from usuarios_erp u where u.auth_user_id = p_auth_user_id and (u.super_admin or p_unidade_id is null
      or u.unidade_principal_id = p_unidade_id
      or exists (select 1 from usuario_escopos e where e.usuario_id = u.id and (e.data_scope in ('todos','empresa') or e.unidade_id = p_unidade_id)))) $$;
  create function public.hefisto_user_can(p_permission text, p_unidade_id text default null) returns boolean
  language sql stable security definer set search_path = public as $$
    select hefisto_user_has_permission(auth.uid(), p_permission) and hefisto_user_in_unit(auth.uid(), p_unidade_id) $$;
`;
const pg = await criarBancoF21(raiz, FIXTURE, { pgcrypto: true });
if (!pg) { console.log("\nPGLITE não informado: integração NÃO executada."); process.exit(falhas ? 1 : 2); }
for (const f of ["migracao_estoque_lotes.sql", "migracao_estoque_bebidas.sql", "security/SEC_EST_1_ESTOQUE_ITENS_LOTES_POR_UNIDADE.sql"]) {
  await pg.exec(fs.readFileSync(path.join(raiz, "db", f), "utf8"));
}

const U = "seldeestrela";
const one = async (sql, params = []) => (await pg.query(sql, params)).rows[0];
const id = async (sql, params = []) => (await one(sql, params)).id;
const UID = { func: "11111111-1111-1111-1111-111111111111", ger: "22222222-2222-2222-2222-222222222222", sem: "33333333-3333-3333-3333-333333333333", outra: "44444444-4444-4444-4444-444444444444" };
const P = { func: "a0000000-0000-0000-0000-000000000001", ger: "a0000000-0000-0000-0000-000000000002", sem: "a0000000-0000-0000-0000-000000000003" };
await pg.exec(`
  insert into public.perfil_permissoes (perfil_id, permission_key) values
    ('${P.func}', 'estoque.movements.create'), ('${P.ger}', 'estoque.*'), ('${P.sem}', 'estoque.overview.view');
  insert into public.usuarios_erp (auth_user_id, nome, perfil_id, unidade_principal_id, tipo_acesso) values
    ('${UID.func}', 'Ana (funcionária)', '${P.func}', '${U}', 'funcionario'),
    ('${UID.ger}', 'Gil (gerente)', '${P.ger}', '${U}', 'gerente'),
    ('${UID.sem}', 'Sol (só vê)', '${P.sem}', '${U}', 'funcionario'),
    ('${UID.outra}', 'Oto (outra loja)', '${P.func}', 'outra', 'funcionario');
`);
const func = clienteSupabase(pg, { uid: UID.func });
const ger = clienteSupabase(pg, { uid: UID.ger });
const sem = clienteSupabase(pg, { uid: UID.sem });
const outraLoja = clienteSupabase(pg, { uid: UID.outra, unidade: "outra" });
const anon = clienteSupabase(pg, { uid: null });

const estCozinha = await id(`insert into public.estoques (unidade_id, nome, slug) values ($1,'Cozinha','cozinha') returning id`, [U]);
const estBar = await id(`insert into public.estoques (unidade_id, nome, slug, tipo) values ($1,'Bar','bar','bebidas') returning id`, [U]);
const arroz = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, tamanho_embalagem, unidade_comercial, permite_fracionado) values ($1,'Arroz','kg',2,'pacote',false) returning id`, [U]);
const carne = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, tamanho_embalagem, unidade_comercial, permite_fracionado) values ($1,'Carne','kg',1,'kg',false) returning id`, [U]);
const gin = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, tamanho_embalagem, unidade_comercial) values ($1,'Gin','ml',1000,'garrafa') returning id`, [U]);
const legado = await id(`insert into public.insumos (unidade_id, nome, unidade_medida) values ($1,'Feijão','kg') returning id`, [U]);
await pg.exec(`insert into public.estoque_custos (unidade_id, insumo_id, custo_medio_base, saldo_referencia, origem_tipo) values ('${U}', '${arroz}', 0.006, 0, 'COMPRA')`);

// histórico ANTERIOR à migration (como os 345 de produção): entrada pela função antiga
await pg.query(`select public.registrar_movimento_estoque_multi($1,$2,$3,'entrada',10,null,'Antigo',null,now())`, [U, estCozinha, legado]);
const antes = await one(`select count(*)::int n, sum(quantidade)::float q, string_agg(id::text || tipo || quantidade::text || saldo_posterior::text, ',') assinatura from public.estoque_movimentacoes_multi`);

// ── 3. a migration ──────────────────────────────────────────────────────────
const SQL = fs.readFileSync(path.join(raiz, "db", "EST_MOV_1_HISTORICO_IMUTAVEL_E_MOVIMENTOS.sql"), "utf8");
await pg.exec(SQL);
conferir("migration não altera nenhum movimento antigo", await one(`select count(*)::int n, sum(quantidade)::float q, string_agg(id::text || tipo || quantidade::text || saldo_posterior::text, ',') assinatura from public.estoque_movimentacoes_multi`), antes);
let erroRepetir = null; try { await pg.exec(SQL); } catch (e) { erroRepetir = e.message; await pg.exec("rollback"); }
conferir("rodar a migration de novo não quebra", erroRepetir, null);
const pinRow = await one(`select pin_hash like '$2%' bcrypt, pin_hash <> '1234' nao_texto, pin_padrao, contagem_cega from public.estoque_seguranca where unidade_id = $1`, [U]);
conferir("PIN inicial 1234 guardado só como hash bcrypt; contagem cega ligada", pinRow, { bcrypt: true, nao_texto: true, pin_padrao: true, contagem_cega: true });

const saldo = async (estoque, insumo) => Number((await one(`select quantidade_atual from public.estoque_itens where estoque_id = $1 and insumo_id = $2`, [estoque, insumo]))?.quantidade_atual ?? 0);
const lotes = async (estoque, insumo) => (await pg.query(`select coalesce(validade::text,'-') v, quantidade::float q from public.estoque_lotes where estoque_id = $1 and insumo_id = $2 and quantidade > 0 order by validade nulls last`, [estoque, insumo])).rows.map((r) => `${r.v}=${r.q}`);
const mov = async (movId) => one(`select * from public.estoque_movimentacoes_multi where id = $1`, [movId]);

// ── 4. entrada / retirada pelo funcionário ──────────────────────────────────
const lanc = quantidadeDoLancamento({ insumo: { unidade_medida: "kg", tamanho_embalagem: 2, unidade_comercial: "pacote" }, embalagens: "2", fracao: "350", unidadeFracao: "g" });
const chave1 = novaChave();
const e1 = await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "entrada", motivo: "compra", lancamento: lanc, validade: "2026-10-20", chave: chave1, responsavel_nome: "Ana" });
conferir("funcionária lança ENTRADA 2 pacotes + 350 g → saldo 4,35 kg", [e1.error, e1.data?.saldo_anterior, e1.data?.saldo_posterior], [null, 0, 4.35]);
const m1 = await mov(e1.data.movimento_id);
conferir("histórico registra motivo, origem, quem (pelo banco), unidade, digitado, validade e custo",
  [m1.tipo, m1.motivo, m1.origem, m1.registrado_por, m1.usuario_nome, m1.responsavel_nome, m1.unidade_medida, Number(m1.quantidade), m1.detalhe_quantidade.embalagens, m1.detalhe_quantidade.fracao, m1.validade?.toISOString?.().slice(0, 10) ?? m1.validade, Number(m1.valor_unitario), Number(m1.valor_total), m1.custo_origem],
  ["entrada", "compra", "movimentacao", UID.func, "Ana (funcionária)", "Ana", "kg", 4.35, 2, 350, "2026-10-20", 6, 26.1, "custo_medio"]);
const e1b = await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "entrada", motivo: "compra", lancamento: lanc, validade: "2026-10-20", chave: chave1 });
conferir("toque duplo / reenvio com a mesma chave NÃO duplica", [e1b.data?.idempotente, e1b.data?.movimento_id === e1.data.movimento_id, await saldo(estCozinha, arroz)], [true, true, 4.35]);
await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "entrada", motivo: "recebimento", lancamento: quantidadeDoLancamento({ insumo: arrozCad, fracao: "3" }), validade: "2026-10-10", chave: novaChave() });
conferir("dois lotes por validade", await lotes(estCozinha, arroz), ["2026-10-10=3", "2026-10-20=4.35"]);
const s1 = await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "saida", motivo: "perda", lancamento: quantidadeDoLancamento({ insumo: arrozCad, fracao: "3500", unidadeFracao: "g" }), chave: novaChave() });
conferir("RETIRADA 3,5 kg por perda sai FEFO (vence antes, sai antes)", [s1.error, s1.data?.saldo_posterior, await lotes(estCozinha, arroz)], [null, 3.85, ["2026-10-20=3.85"]]);
conferir("o histórico guarda de quais validades saiu", (await mov(s1.data.movimento_id)).lotes, [{ validade: "2026-10-10", quantidade: 3 }, { validade: "2026-10-20", quantidade: 0.5 }]);
const s2 = await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "saida", motivo: "consumo", lancamento: quantidadeDoLancamento({ insumo: arrozCad, fracao: "10" }), chave: novaChave() });
conferir("retirada maior que o saldo é recusada e nada muda", [/Saldo insuficiente/.test(s2.error || ""), await saldo(estCozinha, arroz)], [true, 3.85]);
const s3 = await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "saida", motivo: "compra", lancamento: lanc, chave: novaChave() });
conferir("motivo de entrada numa retirada é recusado", s3.error, "Escolha o motivo da retirada.");
const rpcDireto = await func.rpc("estoque_movimentar", { p_unidade_id: U, p_estoque_id: estCozinha, p_insumo_id: arroz, p_tipo: "saida", p_motivo: "ajuste_autorizado", p_quantidade: 1, p_justificativa: "teste", p_pin: "1234" });
conferir("funcionária chamando a função direto com 'ajuste autorizado' + PIN certo → sem permissão", /Sem permissão/.test(rpcDireto.error?.message || ""), true);
const semPerm = await registrarMovimento(sem, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "saida", motivo: "consumo", lancamento: quantidadeDoLancamento({ insumo: arrozCad, fracao: "1" }), chave: novaChave() });
conferir("usuário que só VÊ o estoque não lança", /Sem permissão/.test(semPerm.error || ""), true);
const outra = await registrarMovimento(outraLoja, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "saida", motivo: "consumo", lancamento: quantidadeDoLancamento({ insumo: arrozCad, fracao: "1" }), chave: novaChave() });
conferir("funcionário de OUTRA unidade não lança nesta", /Sem permissão/.test(outra.error || ""), true);
const anonMov = await anon.rpc("estoque_movimentar", { p_unidade_id: U, p_estoque_id: estCozinha, p_insumo_id: arroz, p_tipo: "saida", p_motivo: "consumo", p_quantidade: 1 });
conferir("sem login (anon) não executa", /permission denied/.test(anonMov.error?.message || ""), true);

// ── 5. ninguém apaga nem edita o histórico ──────────────────────────────────
const del = await func.from("estoque_movimentacoes_multi").delete().eq("id", e1.data.movimento_id);
const upd = await ger.from("estoque_movimentacoes_multi").update({ quantidade: 999 }).eq("id", e1.data.movimento_id);
conferir("funcionária e gerente não apagam nem editam lançamento pela API", [/permission denied/.test(del.error?.message || ""), /permission denied/.test(upd.error?.message || ""), Number((await mov(e1.data.movimento_id)).quantidade)], [true, true, 4.35]);
const tentar = async (sql) => { try { await pg.exec(sql); return "passou"; } catch (e) { return /não pode ser alterado nem apagado/.test(e.message) ? "bloqueado" : e.message; } };
conferir("nem o dono do banco (service role/SQL) apaga, edita ou trunca o histórico",
  [await tentar(`delete from public.estoque_movimentacoes_multi where id = '${e1.data.movimento_id}'`),
   await tentar(`update public.estoque_movimentacoes_multi set observacao = 'x' where id = '${e1.data.movimento_id}'`),
   await tentar(`truncate public.estoque_movimentacoes_multi`)], ["bloqueado", "bloqueado", "bloqueado"]);
const forjado = await func.from("estoque_movimentacoes_multi").insert({ unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "entrada", quantidade: 5, motivo: "ajuste_autorizado", autorizado_por: UID.ger, justificativa: "forjado" });
const simples = await func.from("estoque_movimentacoes_multi").insert({ unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "entrada", quantidade: 0 });
const outraUn = await func.from("estoque_movimentacoes_multi").insert({ unidade_id: "outra", estoque_id: estCozinha, insumo_id: arroz, tipo: "entrada", quantidade: 1 });
conferir("inserção direta não consegue se dizer 'autorizada'; formato antigo continua (telas atuais); outra unidade não",
  [/row-level security/.test(forjado.error?.message || ""), simples.error, /row-level security/.test(outraUn.error?.message || "")], [true, null, true]);
const lerOutra = await outraLoja.from("estoque_movimentacoes_multi").select("id");
conferir("histórico só da própria unidade", lerOutra.data?.length, 0);
const pinTabela = await ger.from("estoque_seguranca").select("pin_hash");
conferir("nem o gerente lê a tabela do PIN", /permission denied/.test(pinTabela.error?.message || ""), true);

// ── 6. estorno: só administrador + PIN; original fica ────────────────────────
const estFunc = await estornarMovimento(func, { movimento_id: s1.data.movimento_id, justificativa: "lancei errado", pin: "1234" });
conferir("funcionária não estorna (mesmo sabendo o PIN)", /Sem permissão/.test(estFunc.error || ""), true);
const errado = await estornarMovimento(ger, { movimento_id: s1.data.movimento_id, justificativa: "lancei errado", pin: "9999" });
const tent = await one(`select tentativas_falhas from public.estoque_seguranca where unidade_id = $1`, [U]);
conferir("PIN errado: recusado, tentativa gravada, nada estornado", [errado.pin, errado.error, tent.tentativas_falhas, await saldo(estCozinha, arroz)], [true, "PIN incorreto. Restam 4 tentativa(s).", 1, 3.85]);
const chaveEst = novaChave();
const est = await estornarMovimento(ger, { movimento_id: s1.data.movimento_id, justificativa: "perda lançada em dobro", pin: "1234", chave: chaveEst });
const mEst = est.data ? await mov(est.data.movimento_id) : {};
conferir("gerente estorna a perda com PIN: volta 3,5 kg aos MESMOS lotes; original continua",
  [est.error, est.data?.saldo_posterior, await lotes(estCozinha, arroz), mEst.tipo, mEst.motivo, mEst.estorno_de_id === s1.data.movimento_id, mEst.autorizado_por_nome, mEst.justificativa, !!(await mov(s1.data.movimento_id))],
  [null, 7.35, ["2026-10-10=3", "2026-10-20=4.35"], "entrada", "estorno", true, "Gil (gerente)", "perda lançada em dobro", true]);
conferir("acerto do PIN zera as tentativas", (await one(`select tentativas_falhas from public.estoque_seguranca where unidade_id = $1`, [U])).tentativas_falhas, 0);
const estRepetido = await estornarMovimento(ger, { movimento_id: s1.data.movimento_id, justificativa: "de novo", pin: "1234", chave: chaveEst });
const estDuplo = await estornarMovimento(ger, { movimento_id: s1.data.movimento_id, justificativa: "de novo", pin: "1234", chave: novaChave() });
const estDoEst = await estornarMovimento(ger, { movimento_id: est.data.movimento_id, justificativa: "desfazer", pin: "1234" });
conferir("reenvio devolve o mesmo estorno; segundo estorno e estorno de estorno são recusados",
  [estRepetido.data?.idempotente, estDuplo.error, estDoEst.error, await saldo(estCozinha, arroz)],
  [true, "Esta movimentação já foi estornada.", "Isto já é um estorno. Para refazer, lance a movimentação correta.", 7.35]);
const consumir = await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "saida", motivo: "consumo", lancamento: quantidadeDoLancamento({ insumo: arrozCad, fracao: "5" }), chave: novaChave() });
const estEntradaConsumida = await estornarMovimento(ger, { movimento_id: e1.data.movimento_id, justificativa: "nota errada", pin: "1234" });
conferir("entrada já consumida não pode ser estornada inteira (saldo nunca fica negativo)", [consumir.error, /parte já saiu/.test(estEntradaConsumida.error || ""), await saldo(estCozinha, arroz)], [null, true, 2.35]);
const legadoMov = await one(`select id from public.estoque_movimentacoes_multi where insumo_id = $1`, [legado]);
const estLegado = await estornarMovimento(ger, { movimento_id: legadoMov.id, justificativa: "entrada antiga errada", pin: "1234" });
conferir("lançamento ANTIGO (antes da EST-MOV-1) também é estornável, sem apagar nada", [estLegado.error, await saldo(estCozinha, legado)], [null, 0]);
const ajusteSemPin = await registrarMovimento(ger, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "saida", motivo: "ajuste_autorizado", lancamento: quantidadeDoLancamento({ insumo: arrozCad, fracao: "0,35" }), chave: novaChave(), justificativa: "acerto" });
const ajuste = await registrarMovimento(ger, { unidade_id: U, estoque_id: estCozinha, insumo_id: arroz, tipo: "saida", motivo: "ajuste_autorizado", lancamento: quantidadeDoLancamento({ insumo: arrozCad, fracao: "0,35" }), chave: novaChave(), justificativa: "acerto de balança", pin: "1234" });
conferir("ajuste autorizado exige PIN; com PIN grava autorizado por e motivo", [ajusteSemPin.pin, ajuste.error, ajuste.data?.saldo_posterior, (await mov(ajuste.data.movimento_id)).autorizado_por_nome], [true, null, 2, "Gil (gerente)"]);

// ── 7. bloqueio do PIN ──────────────────────────────────────────────────────
for (let i = 0; i < 4; i++) await estornarMovimento(ger, { movimento_id: consumir.data.movimento_id, justificativa: "teste", pin: "0000" });
const quinto = await estornarMovimento(ger, { movimento_id: consumir.data.movimento_id, justificativa: "teste", pin: "0000" });
const bloqueadoCerto = await estornarMovimento(ger, { movimento_id: consumir.data.movimento_id, justificativa: "teste", pin: "1234" });
conferir("5 erros bloqueiam o PIN por 15 min (nem o PIN certo passa)", [quinto.error, /bloqueado/.test(bloqueadoCerto.error || ""), await saldo(estCozinha, arroz)], ["PIN incorreto. O PIN ficou bloqueado por 15 minutos.", true, 2]);
const log = await one(`select count(*) filter (where resultado = 'pin_incorreto')::int erradas, count(*) filter (where resultado = 'autorizado')::int certas from public.estoque_autorizacoes`);
conferir("cada tentativa de PIN fica registrada (reenvio com a mesma chave não usa PIN de novo)", log, { erradas: 7, certas: 3 });
await pg.exec(`update public.estoque_seguranca set bloqueado_ate = now() - interval '1 minute'`);
const depois = await estornarMovimento(ger, { movimento_id: consumir.data.movimento_id, justificativa: "consumo lançado no item errado", pin: "1234" });
conferir("passado o bloqueio, o PIN certo volta a funcionar", [depois.error, await saldo(estCozinha, arroz)], [null, 7]);

// ── 8. segurança da contagem: PIN e contagem cega ───────────────────────────
const stFunc = await lerSegurancaEstoque(func, U);
const stGer = await lerSegurancaEstoque(ger, U);
conferir("status: funcionária lança mas não autoriza e não vê se o PIN é o padrão; gerente vê",
  [stFunc.data?.contagem_cega, stFunc.data?.pode_entrada, stFunc.data?.pode_autorizar, stFunc.data?.pin_padrao, stGer.data?.pode_autorizar, stGer.data?.pode_configurar, stGer.data?.pin_padrao],
  [true, true, false, null, true, true, true]);
const trocaFunc = await salvarSegurancaEstoque(func, { unidade_id: U, pin_atual: "1234", pin_novo: "4321" });
const trocaErrada = await salvarSegurancaEstoque(ger, { unidade_id: U, pin_atual: "1111", pin_novo: "4321" });
const troca = await salvarSegurancaEstoque(ger, { unidade_id: U, pin_atual: "1234", pin_novo: "4321", pin_confirmacao: "4321", contagem_cega: false });
conferir("trocar PIN: funcionária não pode; PIN atual errado não troca; gerente troca e desliga a contagem cega",
  [/Sem permissão/.test(trocaFunc.error || ""), trocaErrada.pin, troca.error, troca.data?.pin_padrao, troca.data?.contagem_cega], [true, true, null, false, false]);
const antigo = await estornarMovimento(ger, { movimento_id: ajuste.data.movimento_id, justificativa: "teste", pin: "1234" });
conferir("PIN antigo (1234) deixa de valer", antigo.error, "PIN incorreto. Restam 4 tentativa(s).");
conferir("PIN novo guardado como hash, nunca como texto", (await one(`select pin_hash like '$2%' h, position('4321' in pin_hash) = 0 sem_texto from public.estoque_seguranca where unidade_id = $1`, [U])), { h: true, sem_texto: true });
await salvarSegurancaEstoque(ger, { unidade_id: U, pin_atual: "4321", contagem_cega: true });

// ── 9. ajuste pelo inventário fechado ───────────────────────────────────────
// carne: 10 kg no sistema; contagem acha 8 kg; depois da contagem sai 1 kg.
await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: carne, tipo: "entrada", motivo: "compra", lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "kg" }, fracao: "10" }), chave: novaChave() });
const contagem = await id(`insert into public.estoque_contagens (unidade_id, tipo, data_referencia) values ($1,'intermediaria',current_date) returning id`, [U]);
await new Promise((r) => setTimeout(r, 5));
const itemCarne = await id(`insert into public.estoque_contagens_itens (unidade_id, contagem_id, insumo_id, estoque_id, quantidade_contada, unidade_base, quantidade_sistema, custo_unitario)
  values ($1,$2,$3,$4,8000,'g',10000,0.04) returning id`, [U, contagem, carne, estCozinha]);
const itemArroz = await id(`insert into public.estoque_contagens_itens (unidade_id, contagem_id, insumo_id, estoque_id, quantidade_contada, unidade_base, quantidade_sistema, custo_unitario)
  values ($1,$2,$3,$4,7000,'g',7000,0.006) returning id`, [U, contagem, arroz, estCozinha]);
await new Promise((r) => setTimeout(r, 5));
await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: carne, tipo: "saida", motivo: "consumo", lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "kg" }, fracao: "1" }), chave: novaChave() });
const aberto = await ajustarInventario(ger, { contagem_id: contagem, justificativa: "inventário da semana", pin: "4321" });
conferir("inventário em contagem não ajusta estoque", aberto.error, "Feche o inventário antes de ajustar o estoque.");
await pg.exec(`update public.estoque_contagens set status = 'fechada', fechada_em = now() where id = '${contagem}'`);
const ajFunc = await ajustarInventario(func, { contagem_id: contagem, justificativa: "x", pin: "4321" });
conferir("funcionária não ajusta pelo inventário", /Sem permissão|motivo/.test(ajFunc.error || ""), true);
const aj = await ajustarInventario(ger, { contagem_id: contagem, justificativa: "inventário da semana", pin: "4321" });
const ajCarne = aj.data?.itens?.find((i) => i.item_id === itemCarne);
const ajArroz = aj.data?.itens?.find((i) => i.item_id === itemArroz);
conferir("carne: contado 8, sistema na contagem 10 → ajuste −2; a saída de 1 kg DEPOIS continua valendo → saldo 7",
  [aj.error, ajCarne?.status, ajCarne?.contado, ajCarne?.sistema_na_contagem, ajCarne?.ajuste, await saldo(estCozinha, carne)], [null, "ajustado", 8, 10, -2, 7]);
conferir("arroz: contado 7 = sistema 7 → sem diferença, nada lançado", [ajArroz?.status, await saldo(estCozinha, arroz)], ["sem_diferenca", 7]);
const mAj = await one(`select tipo, quantidade::float q, motivo, origem, inventario_item_id = $1 liga, valor_total::float v, custo_origem, autorizado_por_nome from public.estoque_movimentacoes_multi where inventario_item_id = $1`, [itemCarne]);
conferir("o ajuste vira RETIRADA de 2 kg, ligada ao item do inventário, valorizada pelo custo congelado (R$ 40/kg)", mAj,
  { tipo: "saida", q: 2, motivo: "ajuste_inventario", origem: "inventario", liga: true, v: 80, custo_origem: "inventario", autorizado_por_nome: "Gil (gerente)" });
const aj2 = await ajustarInventario(ger, { contagem_id: contagem, justificativa: "de novo", pin: "4321" });
conferir("ajustar de novo não ajusta duas vezes", [aj2.data?.itens?.find((i) => i.item_id === itemCarne)?.status, await saldo(estCozinha, carne)], ["ja_ajustado", 7]);

// ── 10. bebidas: fechado x aberto continuam coerentes ───────────────────────
const g1 = await registrarMovimento(func, { unidade_id: U, estoque_id: estBar, insumo_id: gin, tipo: "entrada", motivo: "compra",
  lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "ml", tamanho_embalagem: 1000, unidade_comercial: "garrafa" }, embalagens: "3" }), chave: novaChave() });
const g2 = await registrarMovimento(func, { unidade_id: U, estoque_id: estBar, insumo_id: gin, tipo: "saida", motivo: "consumo",
  lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "ml" }, fracao: "300" }), chave: novaChave() });
const bar = await one(`select quantidade_atual::float q, saldo_fechado::float f, saldo_aberto::float a from public.estoque_itens where estoque_id = $1 and insumo_id = $2`, [estBar, gin]);
conferir("gin: entra 3 garrafas fechadas; sai 300 ml → abre 1 (2 fechadas + 700 ml aberto = 2700 ml)", [g1.error, g2.error, bar], [null, null, { q: 2700, f: 2, a: 700 }]);

// ── 11. funções antigas fora do anon ────────────────────────────────────────
const anonBeb = await anon.rpc("bebida_zerar", { p_unidade_id: U, p_estoque_id: estBar, p_insumo_id: gin, p_motivo: "ataque" });
conferir("sem login (anon) já não zera bebida (era SECURITY DEFINER aberto)", [/permission denied/.test(anonBeb.error?.message || ""), (await one(`select quantidade_atual::float q from public.estoque_itens where estoque_id = $1 and insumo_id = $2`, [estBar, gin])).q], [true, 2700]);
const telaAntiga = await func.rpc("registrar_movimento_estoque_multi", { p_unidade_id: U, p_estoque_id: estCozinha, p_insumo_id: carne, p_tipo: "entrada", p_quantidade: 1 });
conferir("tela antiga (função antiga, logado) continua funcionando até a Fase 3", [telaAntiga.error, await saldo(estCozinha, carne)], [null, 8]);
const CONF = SQL.match(/\/\* ── CONFERÊNCIA \(só leitura\)[^\n]*\n([\s\S]*?)\n\s*─+ \*\//)[1];
const conf = Object.fromEntries((await pg.query(CONF)).rows.map((r) => [r.o_que, r.resultado]));
conferir("conferência pós-migration", [conf["policies"], conf["authenticated no histórico"], conf["anon executa bebida_zerar"], conf["PIN guardado como hash"]],
  ["estoque_mov_ler_unidade, estoque_mov_inserir_simples", "INSERT,SELECT", "false", "outra=true, seldeestrela=true"]);

// ── 12. EST-MOV-2: produto contado não muda sem o administrador ──────────────
const semMov2 = await corrigirItemContagem(ger, { item_id: itemCarne, quantidade: 1, justificativa: "teste", pin: "4321" });
conferir("antes da EST-MOV-2 a tela avisa que o banco não foi atualizado", [semMov2.error, semMov2.semBanco], [MSG_BANCO_DESATUALIZADO, true]);
const SQL2 = fs.readFileSync(path.join(raiz, "db", "EST_MOV_2_CONTAGEM_SEM_EDICAO.sql"), "utf8");
await pg.exec(SQL2);
let erro2 = null; try { await pg.exec(SQL2); } catch (e) { erro2 = e.message; await pg.exec("rollback"); }
conferir("EST-MOV-2 roda e pode rodar de novo", erro2, null);
const k2 = await criarContagem(func, { unidade_id: U, tipo: "intermediaria", data_referencia: "2026-09-30" });
const it2 = await salvarItemContagem(func, { contagem_id: k2.data.id, unidade_id: U, insumo_id: arroz, estoque_id: estCozinha, quantidade: "6,5", unidade_medida: "kg", quantidade_sistema: 7, detalhe: "3 pacote(s) de 2 kg + 500 g = 6,5 kg" });
const linha2 = async () => one(`select quantidade_contada::float q, observacao from public.estoque_contagens_itens where id = $1`, [it2.data.id]);
conferir("funcionária conta arroz 6,5 kg (com o detalhe do que digitou)", [it2.error, await linha2()], [null, { q: 6500, observacao: "3 pacote(s) de 2 kg + 500 g = 6,5 kg" }]);
const viaApi = await func.from("estoque_contagens_itens").update({ quantidade_contada: 9000 }).eq("id", it2.data.id);
const apagar = await func.from("estoque_contagens_itens").delete().eq("id", it2.data.id);
const gerApi = await ger.from("estoque_contagens_itens").update({ quantidade_contada: 9000 }).eq("id", it2.data.id);
conferir("pela API ninguém altera nem apaga o produto contado (nem o gerente, sem PIN)",
  [/já foi contado/.test(viaApi.error?.message || ""), /não pode ser apagado|permission denied/.test(apagar.error?.message || "") || !!(await linha2()), /já foi contado/.test(gerApi.error?.message || ""), (await linha2()).q],
  [true, true, true, 6500]);
const corrFunc = await corrigirItemContagem(func, { item_id: it2.data.id, quantidade: 6, justificativa: "errei", pin: "4321" });
const corrPin = await corrigirItemContagem(ger, { item_id: it2.data.id, quantidade: 6, justificativa: "recontado", pin: "1111" });
const corr = await corrigirItemContagem(ger, { item_id: it2.data.id, quantidade: 6, justificativa: "recontado na balança", pin: "4321" });
const depoisCorr = await linha2();
conferir("correção: funcionária não; PIN errado não; administrador com PIN corrige 6,5 → 6 kg e fica registrado na linha",
  [/Sem permissão/.test(corrFunc.error || ""), corrPin.pin, corr.error, corr.data?.quantidade_anterior, corr.data?.quantidade, depoisCorr.q, depoisCorr.observacao],
  [true, true, null, 6.5, 6, 6000, "3 pacote(s) de 2 kg + 500 g = 6,5 kg · Corrigido por Gil (gerente): 6,5 → 6 kg (recontado na balança)"]);
conferir("a correção também vai para o registro de autorizações",
  await one(`select resultado, detalhe from public.estoque_autorizacoes where acao = 'correcao_contagem' and resultado = 'autorizado'`),
  { resultado: "autorizado", detalhe: "de 6,5 para 6 kg: recontado na balança" });
const fech2 = await fecharContagem(func, { contagem_id: k2.data.id, itens: [{ id: it2.data.id, insumo_id: arroz, quantidade_contada: 6000 }], unidadesPorInsumo: { [arroz]: "kg" }, custos: { [it2.data.id]: { porUnidade: "6", origem: "custo médio" } }, confirmado: true });
conferir("fechar continua funcionando (grava o custo) e mantém o histórico da linha",
  [fech2.error, (await linha2()).observacao],
  [null, "3 pacote(s) de 2 kg + 500 g = 6,5 kg · Corrigido por Gil (gerente): 6,5 → 6 kg (recontado na balança) · custo: custo médio"]);
const corrFechado = await corrigirItemContagem(ger, { item_id: it2.data.id, quantidade: 5, justificativa: "depois", pin: "4321" });
conferir("inventário fechado não se corrige: vai pelo ajuste do estoque", corrFechado.error, "Inventário já fechado: a correção agora é pelo ajuste do estoque.");
conferir("salvar de novo um produto já contado avisa (não substitui)",
  (await salvarItemContagem(func, { contagem_id: k2.data.id, unidade_id: U, insumo_id: arroz, estoque_id: estCozinha, quantidade: "1", unidade_medida: "kg", item_id: it2.data.id })).error, MSG_JA_CONTADO);
conferir("anon não executa a correção",
  /permission denied/.test((await anon.rpc("estoque_contagem_corrigir_item", { p_item_id: it2.data.id, p_quantidade: 1, p_justificativa: "x", p_pin: "4321" })).error?.message || ""), true);

// ── 13. garrafa fracionada (saldo em ml) e inventário já aplicado pelo caminho antigo ──
const vinho = await id(`insert into public.insumos (unidade_id, nome, unidade_medida, tamanho_embalagem, unidade_comercial, unidade_conteudo, permite_fracionado)
  values ($1,'Vinho tinto','garrafa',750,'garrafa','ml',true) returning id`, [U]);
await pg.exec(`insert into public.estoque_custos (unidade_id, insumo_id, custo_medio_base, saldo_referencia, origem_tipo) values ('${U}', '${vinho}', 60, 0, 'COMPRA')`);
const insVinho = { id: vinho, unidade_medida: "garrafa", tamanho_embalagem: 750, unidade_conteudo: "ml", unidade_comercial: "garrafa", permite_fracionado: true };
const ev = await registrarMovimento(func, { unidade_id: U, estoque_id: estBar, insumo_id: vinho, tipo: "entrada", motivo: "compra",
  lancamento: quantidadeDoLancamento({ insumo: insVinho, embalagens: "2", fracao: "300" }), chave: novaChave() });
const mv = ev.data ? await mov(ev.data.movimento_id) : {};
const barV = await one(`select quantidade_atual::float q, saldo_fechado::float f, saldo_aberto::float a from public.estoque_itens where estoque_id = $1 and insumo_id = $2`, [estBar, vinho]);
conferir("vinho: entra 2 garrafas fechadas + 300 ml → saldo 1.800 ml (2 fechadas + 300 aberto), unidade ml, custo R$ 60/garrafa = R$ 0,08/ml",
  [ev.error, barV, mv.unidade_medida, Number(mv.valor_unitario), Number(mv.valor_total)], [null, { q: 1800, f: 2, a: 300 }, "ml", 0.08, 144]);
const k3 = await id(`insert into public.estoque_contagens (unidade_id, tipo, data_referencia) values ($1,'final','2026-09-30') returning id`, [U]);
await new Promise((r) => setTimeout(r, 5));
const itVinho = await id(`insert into public.estoque_contagens_itens (unidade_id, contagem_id, insumo_id, estoque_id, quantidade_contada, unidade_base, quantidade_sistema, custo_unitario)
  values ($1,$2,$3,$4,2,'un',2.4,60) returning id`, [U, k3, vinho, estBar]);
const itGin = await id(`insert into public.estoque_contagens_itens (unidade_id, contagem_id, insumo_id, estoque_id, quantidade_contada, unidade_base, quantidade_sistema, custo_unitario)
  values ($1,$2,$3,$4,2000,'ml',2700,0.1) returning id`, [U, k3, gin, estBar]);
// o caminho anterior (fechar → registrar_contagem_estoque_multi) já tinha aplicado o gin deste inventário
await pg.query(`select public.registrar_contagem_estoque_multi($1,$2,$3,2000,null,'Antigo','Inventário de 30/09/2026 (fechamento) [inventario:' || $4 || ']')`, [U, estBar, gin, k3]);
await pg.exec(`update public.estoque_contagens set status = 'fechada', fechada_em = now() where id = '${k3}'`);
const aj3 = await ajustarInventario(ger, { contagem_id: k3, justificativa: "fechamento de setembro", pin: "4321" });
const a3v = aj3.data?.itens?.find((i) => i.item_id === itVinho);
const a3g = aj3.data?.itens?.find((i) => i.item_id === itGin);
conferir("ajuste do vinho na unidade do saldo: contado 2 garrafas = 1.500 ml, sistema 1.800 ml → −300 ml; valor pelo custo congelado (R$ 24)",
  [aj3.error, a3v?.status, a3v?.contado, a3v?.sistema_na_contagem, a3v?.ajuste, a3v?.unidade_medida,
   (await one(`select quantidade_atual::float q from public.estoque_itens where estoque_id = $1 and insumo_id = $2`, [estBar, vinho])).q,
   Number((await one(`select valor_total from public.estoque_movimentacoes_multi where inventario_item_id = $1`, [itVinho])).valor_total)],
  [null, "ajustado", 1500, 1800, -300, "ml", 1500, 24]);
conferir("inventário que o caminho anterior já aplicou ao saldo não é ajustado de novo (sem duplicar)",
  [a3g?.status, (await one(`select quantidade_atual::float q from public.estoque_itens where estoque_id = $1 and insumo_id = $2`, [estBar, gin])).q], ["ja_ajustado", 2000]);

// ── 14. EST-MOV-3: transferência pelo banco e escrita direta fechada ─────────
const semMov3 = await func.rpc("estoque_transferir", { p_unidade_id: U, p_estoque_origem_id: estCozinha, p_estoque_destino_id: estBar, p_insumo_id: carne, p_quantidade: 1 });
conferir("antes da EST-MOV-3 a transferência nova ainda não existe", /estoque_transferir/.test(semMov3.error?.message || ""), true);
const SQL3 = fs.readFileSync(process.env.EST_MOV3_SQL || path.join(raiz, "db", "EST_MOV_3_FECHA_ESCRITA_DIRETA.sql"), "utf8");
await pg.exec(SQL3);
let erro3 = null; try { await pg.exec(SQL3); } catch (e) { erro3 = e.message; await pg.exec("rollback"); }
conferir("EST-MOV-3 roda e pode rodar de novo", erro3, null);
// estoque de bebidas compatível com alimentos (regra antiga mantida)
const estDeposito = await id(`insert into public.estoques (unidade_id, nome, slug, tipo) values ($1,'Depósito','deposito','alimentos') returning id`, [U]);
await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: carne, tipo: "entrada", motivo: "compra", validade: "2026-11-01",
  lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "kg" }, fracao: "2" }), chave: novaChave() });
const saldoCarne = await saldo(estCozinha, carne);
const chaveT = novaChave();
const tr = await func.rpc("estoque_transferir", { p_unidade_id: U, p_estoque_origem_id: estCozinha, p_estoque_destino_id: estDeposito, p_insumo_id: carne, p_quantidade: 3, p_observacao: "para o depósito", p_chave: chaveT });
const legs = (await pg.query(`select tipo, motivo, origem, quantidade::float q, estoque_id = $2 origem_ok, registrado_por from public.estoque_movimentacoes_multi where transferencia_id = $1 order by tipo desc`, [tr.data?.transferencia_id, estCozinha])).rows;
conferir("transferência: sai da cozinha, entra no depósito com as validades (FEFO), dois lançamentos ligados",
  [tr.error, tr.data?.ok, await saldo(estCozinha, carne), await saldo(estDeposito, carne), await lotes(estDeposito, carne), legs.map((l) => [l.tipo, l.motivo, l.origem, l.q])],
  [null, true, saldoCarne - 3, 3, ["2026-11-01=2", "-=1"], [["transferencia_saida", "transferencia_enviada", "transferencia", 3], ["transferencia_entrada", "transferencia_recebida", "transferencia", 3]]]);
const trDup = await func.rpc("estoque_transferir", { p_unidade_id: U, p_estoque_origem_id: estCozinha, p_estoque_destino_id: estDeposito, p_insumo_id: carne, p_quantidade: 3, p_chave: chaveT });
const trDemais = await func.rpc("estoque_transferir", { p_unidade_id: U, p_estoque_origem_id: estCozinha, p_estoque_destino_id: estDeposito, p_insumo_id: carne, p_quantidade: 999 });
const trSem = await sem.rpc("estoque_transferir", { p_unidade_id: U, p_estoque_origem_id: estCozinha, p_estoque_destino_id: estDeposito, p_insumo_id: carne, p_quantidade: 1 });
conferir("transferência: reenvio não duplica; mais que o saldo é recusado; sem permissão não transfere",
  [trDup.data?.idempotente, /Saldo insuficiente na origem/.test(trDemais.error?.message || ""), /Sem permissão/.test(trSem.error?.message || ""), await saldo(estDeposito, carne)],
  [true, true, true, 3]);
const estTr = await estornarMovimento(ger, { movimento_id: (await one(`select id from public.estoque_movimentacoes_multi where transferencia_id = $1 and tipo = 'transferencia_saida'`, [tr.data.transferencia_id])).id, justificativa: "teste", pin: "4321" });
conferir("transferência não se estorna: faz a transferência de volta", /transferência de volta/.test(estTr.error || ""), true);

const itemCarne2 = (await one(`select id from public.estoque_itens where estoque_id = $1 and insumo_id = $2`, [estCozinha, carne])).id;
const upSaldo = await func.from("estoque_itens").update({ quantidade_atual: 999 }).eq("id", itemCarne2);
const upMin = await func.from("estoque_itens").update({ estoque_minimo: 2, local_interno: "Freezer 2" }).eq("id", itemCarne2);
const insComSaldo = await func.from("estoque_itens").insert({ unidade_id: U, estoque_id: estDeposito, insumo_id: arroz, quantidade_atual: 50 });
const insSemSaldo = await func.from("estoque_itens").insert({ unidade_id: U, estoque_id: estDeposito, insumo_id: arroz });
const delComSaldo = await func.from("estoque_itens").delete().eq("id", itemCarne2);
conferir("pela API: saldo não muda, item com saldo não nasce nem sai; mínimo e local continuam editáveis; vincular sem saldo continua",
  [/só muda por entrada/.test(upSaldo.error?.message || ""), upMin.error, /só muda por entrada/.test(insComSaldo.error?.message || ""), insSemSaldo.error,
   /Produto com saldo/.test(delComSaldo.error?.message || ""), await saldo(estCozinha, carne)],
  [true, null, true, null, true, saldoCarne - 3]);
const lotePorFora = await func.from("estoque_lotes").update({ quantidade: 999 }).eq("estoque_id", estCozinha);
const movPorFora = await func.from("estoque_movimentacoes_multi").insert({ unidade_id: U, estoque_id: estCozinha, insumo_id: carne, tipo: "entrada", quantidade: 1 });
conferir("pela API: lotes e histórico não aceitam escrita direta", [/permission denied/.test(lotePorFora.error?.message || ""), /permission denied/.test(movPorFora.error?.message || "")], [true, true]);
const antigas = await Promise.all([
  func.rpc("registrar_movimento_estoque_multi", { p_unidade_id: U, p_estoque_id: estCozinha, p_insumo_id: carne, p_tipo: "entrada", p_quantidade: 1 }),
  func.rpc("registrar_contagem_estoque_multi", { p_unidade_id: U, p_estoque_id: estCozinha, p_insumo_id: carne, p_saldo_contado: 0 }),
  ger.rpc("bebida_zerar", { p_unidade_id: U, p_estoque_id: estBar, p_insumo_id: gin, p_motivo: "teste" }),
  func.rpc("transferir_item_entre_estoques", { p_unidade_id: U, p_estoque_origem_id: estCozinha, p_estoque_destino_id: estDeposito, p_insumo_id: carne, p_quantidade: 1 }),
]);
conferir("funções antigas (sobrescrever saldo, zerar bebida, transferir sem regra) fechadas para o app",
  antigas.map((r) => /permission denied/.test(r.error?.message || "")), [true, true, true, true]);
const depois3 = await registrarMovimento(func, { unidade_id: U, estoque_id: estCozinha, insumo_id: carne, tipo: "saida", motivo: "consumo", lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "kg" }, fracao: "1" }), chave: novaChave() });
const estDepois3 = await estornarMovimento(ger, { movimento_id: depois3.data?.movimento_id, justificativa: "lançado errado", pin: "4321" });
conferir("depois da trava, entrada/retirada, estorno e saldo seguem funcionando pelas funções",
  [depois3.error, estDepois3.error, await saldo(estCozinha, carne)], [null, null, saldoCarne - 3]);
const CONF3 = SQL3.match(/\/\* ── CONFERÊNCIA \(só leitura\)[^\n]*\n([\s\S]*?)\n\s*─+ \*\//)[1];
const conf3 = Object.fromEntries((await pg.query(CONF3)).rows.map((r) => [r.o_que, r.resultado]));
conferir("conferência pós EST-MOV-3", [conf3["authenticated no histórico"], conf3["authenticated nos lotes"], conf3["trigger do saldo"], conf3["app executa bebida_zerar"]],
  ["SELECT", "SELECT", "estoque_itens_saldo_travado", "false"]);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os testes passaram.");
process.exit(falhas ? 1 : 0);
