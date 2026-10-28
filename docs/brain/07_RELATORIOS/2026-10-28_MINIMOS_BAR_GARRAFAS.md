# Mínimos do bar: de garrafas para ml (28/10/2026)

Pedido do dono: "resolva isso" (mínimos do bar digitados em garrafas, gravados como ml).

**Regra:** `estoque_itens` do bar com insumo em ml, `tamanho_embalagem > 1` e mínimo menor que uma embalagem
→ `estoque_minimo = estoque_minimo × tamanho_embalagem`. Nenhum tinha máximo. Itens em L com garrafa de 1 L não mudam (fator 1).

**Valores ANTES (para desfazer: `update estoque_itens set estoque_minimo = <antes> where id = '<id>'`):**

| id | produto | embalagem | mínimo antes | mínimo depois |
|---|---|---|---|---|
| a7282ae2-3459-4b99-90fc-2749e255ce03 | Água tônica - schweppes | lata 350 ml | 6 | 2100 |
| e0aa43a7-13c4-4c93-a800-305e6d757bf4 | Amstel | garrafa 600 ml | 15 | 9000 |
| 481a85cd-36c7-4d3d-8a4f-2b9a47b3e425 | Antarctica Original | garrafa 600 ml | 15 | 9000 |
| 2e203a15-c6ac-492f-a14a-b20b95e29d30 | Aperol | garrafa 750 ml | 3 | 2250 |
| f82bf106-38d9-49cd-a9b1-7440734883f9 | Cachaça de jambu | 275 ml | 3 | 825 |
| fa35db0c-3cec-442e-8e61-92cc50b4d399 | Coca cola | lata 350 ml | 3 | 1050 |
| 96de7d62-39b5-45eb-aff3-42cd91da6dfe | Coca cola zero | lata 350 ml | 3 | 1050 |
| 655687b3-1afc-49cd-b99c-7f89f940b0e7 | Corona | garrafa 330 ml | 6 | 1980 |
| d201d6cd-e493-41ae-ac4e-db6beb0a5cd8 | Corona zero | garrafa 330 ml | 1 | 330 |
| e724f518-59f3-4062-b97b-bbc082f7193a | Curaçau Blue | garrafa 720 ml | 1 | 720 |
| 2338ea7e-c223-41a7-8425-355f7d6f8c18 | Fanta laranja | lata 350 ml | 2 | 700 |
| b7b9e1b5-590f-4618-a443-1774bf9a421a | Gin | garrafa 900 ml | 3 | 2700 |
| cb5b005c-0987-427c-8db0-0027c67898b5 | Gin | garrafa 750 ml | 3 | 2250 |
| 66212cf3-81bd-4418-b89d-d464d412b2c1 | Gin jambu | garrafa 700 ml | 1 | 700 |
| d416b227-a894-46e8-9bbc-61dee0a2b8c1 | Guaraná antarctica | lata 350 ml | 1 | 350 |
| 24e53ea1-2f60-490b-ac56-baa70fd12430 | Guaraná antarctica zero | lata 350 ml | 1 | 350 |
| 11283eae-69d4-46ce-9a7f-61a4aeb72ab0 | Heineken Zero Long Neck | long neck 330 ml | 1 | 330 |
| 3a4124ca-9e85-4215-b7cd-11b0b1878557 | Licor 43 | garrafa 700 ml | 1 | 700 |
| 893f6aba-a6b1-42bd-a87f-f21f4ea1d304 | Sprite | lata 350 ml | 6 | 2100 |
| 0a518055-2686-4ebb-b02c-7f0ba8a2c00c | Vodka | garrafa 998 ml | 2 | 1996 |
| 57307b3d-b6b6-4b97-9124-1827dda4e2d0 | Xarope frutas vermelhas | garrafa 500 ml | 2 | 1000 |
| 6d386127-0640-4d06-9429-e4f0232911a5 | Xarope limão siciliano | garrafa 500 ml | 2 | 1000 |

Não mudam: Absolut (L, garrafa 1 L, mínimo 1), Cachaça de jambu (L, 1 L, mínimo 2).

Achado à parte: "Gin" de 750 ml tem saldo 1 ml (provável lançamento errado) — conferir no bar.
