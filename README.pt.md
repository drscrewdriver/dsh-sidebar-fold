# dsh-sidebar-fold

[![npm version](https://img.shields.io/npm/v/dsh-sidebar-fold?color=4d6bfe)](https://www.npmjs.com/package/dsh-sidebar-fold)
[![license](https://img.shields.io/npm/l/dsh-sidebar-fold)](https://github.com/drscrewdriver/dsh-sidebar-fold/blob/main/LICENSE)

Recolhe as entradas adicionadas à barra lateral na linha **“Mais”** que já vem no host.

A lista *Painéis globais* da coluna esquerda cresce a cada plugin instalado: tarefas
agendadas, equipes de agentes, o mercado de plugins, páginas de contexto, … O
`dsh-sidebar-fold` coloca um **comutador de seta quadrada de 28×28** na extremidade direita
da linha “Mais” do host. Um clique recolhe essas linhas adicionadas, deixando apenas a linha
“Mais”; a seta inverte de ▲ (pode recolher) para ▼ (pode expandir) e um segundo clique traz as
linhas de volta.

- **Não invasivo** — um plugin de cliente que apenas acrescenta DOM. O bundle do host nunca é
  modificado, nada em `app.asar` é tocado e desinstalar restaura a barra lateral exatamente como
  veio de fábrica (a própria tag `<style>` e as marcas `data-dshsf-*` são removidas).
- **Detecção estrutural do cabeçalho** — a linha de cabeçalho é o `panelRow` que carrega
  `aria-haspopup="menu"` dentro da navegação “Global panels”, o que independe do idioma e da
  ordem de registro dos plugins.
- **Estado por janela** — a escolha entre recolhida e aberta persiste em `localStorage`, de modo
  que um recarregamento a mantém.
- **Chave de alinhamento** — as linhas gerenciadas (incluída a linha “Mais”) podem pôr seu par
  ícone + rótulo **à esquerda / centralizado / à direita**. Em `right` o comutador se espelha para a
  extremidade esquerda da linha, para nunca cobrir o texto; a sobrescrita é um único
  `justify-content` por extenso e não mexe em `display`/`gap`/altura da linha.
- **Três estados por linha (host 0.2.2 em diante)** — cada linha do cartão de configurações elege
  um entre **Mostrar** (sempre visível), **Recolher** (pode ser recolhida) ou **Ocultar em «Mais»**
  (entregar a linha à própria lista “Mais” do host, isto é, à ação de desafixação dele). Uma linha
  oculta sai da coluna e aparece no menu “Mais”, de onde o controle de fixação do próprio host a
  traz de volta; o plugin reconcilia os dois lados na inicialização, a cada escrita de configuração
  e a cada repintura da barra lateral — inclusive depois de um recarregamento, em que a tabela de
  fixações em memória do host volta vazia.
- **Configurável** — o estado padrão, os controles de linha em três estados e o alinhamento das
  linhas vivem no cartão de configurações do plugin (`Config` do host, `.volatile()`, aplicado sem
  reiniciar).
- **Seguro no rail** — quando a barra lateral é recolhida ao rail de ícones de 36 px, o comutador é
  removido e todas as linhas voltam a ser mostradas: sem espremer, sem estado meio oculto.
- **Degradação silenciosa** — se a DOM do host divergir e os âncoras não forem encontrados, o
  plugin fica de fora em vez de quebrar a barra lateral (`dsh-sidebar-fold:
  fold installed { mounted: false }` no console conta o que aconteceu).

## Capturas de tela

Expandida, linhas centralizadas — o comutador fica na linha Mais e as linhas adicionadas são listadas:

![expandida e centralizada](assets/middle.png)

Recolhida — apenas a linha do plugin e a linha Mais permanecem:

![recolhida](assets/fold.png)

## Instalação

```sh
# canal npm (após o lançamento)
dsh plugin --profile <profile> add dsh-sidebar-fold

# compilação local
npm run build && npm run verify
npm pack --pack-destination .
dsh plugin --profile <profile> add ./dsh-sidebar-fold-0.1.2.tgz
```

Depois adicione `dsh-sidebar-fold` à lista `dsh.profile.bundles` do perfil (ou ative o
bundle no app) e reinicie. No perfil desktop, encerre o app Electron antes de editar o
`package.json` dele — o app em execução reescreve esse arquivo e desfaz edições externas.

## Configurações

Abra **Plugins → dsh-sidebar-fold** (o cartão é registrado no assento
`plugins.bundle.config`, chaveado pelo nome do pacote), ou clique em
**“Configurações de recolhimento da barra lateral” no rodapé do menu “Mais” da barra
lateral**: essa linha fica no assento `sidebar.panellist.actions` e salta com o
`pluginNavigation.openBundle(package)` do próprio host, compartilhando assim a caminhada de
teclado e o caminho de dispensa do menu; um host sem esse serviço cai na seleção do painel Plugins.

| Campo | Significado | Padrão |
|---|---|---|
| Recolhido por padrão | Estado em que uma janela inicia quando não tem registro local | desligado |
| Alinhamento das linhas | Controle segmentado em três vias (esquerda / centro / direita) para as linhas gerenciadas; a linha “Mais” segue a mesma configuração | esquerda |
| Entradas (uma por linha) | **Mostrar** = sempre visível; **Recolher** = pode ser recolhida (padrão); **Ocultar em «Mais»** = movê-la para o menu “Mais” do host | Recolher |

A lista de linhas é lida da DOM no momento da abertura, então um painel instalado depois
aparece sem editar nada. Quando toda linha está em Mostrar, o comutador se esmaece e
reporta `aria-disabled="true"` em vez de girar uma seta sobre uma lista inalterada.

“Ocultar em «Mais»” exige a estrutura de linha da 0.2.2 (`div._panelEntry` mais o controle de
fixação dentro da linha): na linha 0.2.1 esse único segmento fica desabilitado no cartão enquanto
os outros dois continuam funcionando. A tabela de fixações do host existe **apenas em memória**
(um recarregamento começa vazia), então o plugin reconcilia a cada varredura: uma linha que deveria
estar oculta mas ainda está na coluna tem seu controle de desafixação clicado, e um rótulo oculto
cuja linha voltou é removido da lista de ocultação.

## Desenvolvimento

```sh
npm run build        # scripts/build-client.mjs -> lib/client.js (bundle do module-loader)
npm run verify       # gate: loader id === nome do pacote, dois manifestos na mesma string,
                     #       nenhuma requisição de módulo, nenhum primitive de host,
                     #       10 locales, nenhum caminho absoluto de máquina
npm test             # node --test nas costuras puras (divisão do cabeçalho, cadeia de
                     #       fallback da navegação)
npm run hosts:check  # drift de enumeração vs scripts/hosts.mjs (--write para reparar)
```

`prepack` roda build + verify, então um `lib/client.js` obsoleto não pode ser publicado.

## Hosts suportados

**Hosts DSH `>=0.2.1-rc.3 <0.3.0`** (a linha "Mais" surge pela primeira vez em 0.2.1-rc.3; os rc 0.2.x
mais recentes continuam instaláveis sem um novo lançamento). Fonte única de verdade: `scripts/hosts.mjs`
— `engines.dsh` carrega esse intervalo limitado, `peerDependencies` mantêm a enumeração por rc (a
resolução do npm nunca assume `includePrerelease`) e `dsh.plugin.json` espelha o intervalo; tudo gerado,
nunca editado à mão.

Por que o piso é 0.2.1-rc.3: a montagem precisa da lista de painéis da barra lateral **e** da linha
"Mais" que vem no host. Medido em todo `dsh-client-ui-sidebar` rc publicado:

| linha do host | lista de painéis | linha "Mais" | wrapper de linha / controle de fixação na linha |
|---|---|---|---|
| 0.1.0-rc.8 / 0.1.1-rc.2 / 0.1.2-rc.1 | não | não | — |
| 0.1.5-rc.3 / 0.1.7-rc.2 / 0.2.0-rc.2 | sim | não | — |
| 0.2.1-rc.1 / 0.2.1-rc.2 | sim | não | — |
| 0.2.1-rc.3 | sim | sim | não |
| 0.2.2-rc.3 (DOM verificado em 2026-11-14) | sim | sim | **sim** (`div._panelEntry` + `button._panelUnpin`, `button._pinButton` dentro do menu) |

Numa linha sem a linha Mais o plugin degrada silenciosamente — não injeta nada e deixa a barra
lateral como veio. Declarar um host assim só faria o usuário instalar um plugin que não faz nada.

**Duas diferenças medidas na linha 0.2.2** (ambas verificadas em 0.2.2-rc.3):

1. Uma linha é envolvida por `div._panelEntry` e carrega o próprio controle de desafixação do host.
   A marca de recolhimento, portanto, tem de cair no **wrapper**: ocultar apenas o
   `button._panelRow` interno deixava um slot vazio de 32 px (mais um alfinete que aparece no hover)
   para trás — a regressão real que a v0.1.6 mostrou em hosts mais novos.
2. A ação de desafixar do host *é* “ocultar em Mais”: uma linha desafixada é filtrada da navegação e
   renderizada por `sidebar.panellist.actions` no menu “Mais” (cada linha com um controle de
   fixar de volta). Essa tabela de fixações fica em memória e nunca é persistida, então o plugin
   mantém duas listas de rótulos (`keepLabels` / `hideLabels`) como fonte de verdade e reconcilia.

Depois de uma atualização de host, rode de novo o teste de fumaça no navegador antes de alargar esta
lista: os hashes do CSS-module driftam a cada build (rc.2 emitia `wtg9ga_`, os runtimes
0.2.1/0.2.2 rc.3 emitem `hHd-Xa_`), então apenas os seletores por fragmento (`_panelList`, `_panelRow`,
`_moreAnchor`, `_collapsed`, `_panelEntry`, `_panelUnpin`, `_pinButton`) são estáveis.

## Guarda de atualização

Os hashes do CSS-module do host driftam a cada build (`wtg9ga_` na rc.2 → `hHd-Xa_` nos runtimes
0.2.1/0.2.2 rc.3), por isso todo seletor casa um *fragmento* (`_panelList`, `_panelRow`,
`_moreAnchor`, `_collapsed`, `_panelEntry`, `_panelUnpin`, `_pinButton`). **Depois de qualquer troca de
versão do host, rode o smoke no navegador** antes de assumir que os três caminhos continuam de pé: a
montagem do recolhimento, a escrita em três estados e ocultar/refixar. O plugin degrada
silenciosamente (ou desabilita um segmento) por design, então uma regressão aparece como “não
aconteceu nada”, não como erro.

## Estrutura

```
src/index.js              metade host: schema Config + apply no-op (sem etapa de build)
src/client/constants.ts   âncoras medidas, marcas de atributo, folha de estilo injetada
src/client/locales.ts     10 dicionários de runtime (o conjunto de chaves zh é a fonte de verdade)
src/client/fold.ts        localização da navegação, divisão cabeçalho/grupo, montagem do comutador, estado
src/client/settings-card.ts o cartão de configuração da página do bundle (DOM puro)
src/client/index.ts       apply: primeiro o recolhimento, depois as cinturas de configuração guardadas
scripts/                  build-client / verify / sync-hosts / hosts / gen-locale-meta
```

## Licença

MIT
