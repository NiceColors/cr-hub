## CR Tracker

Aplicação web **local** para centralizar e acompanhar Pull Requests **abertos** no Bitbucket Cloud, por usuários e repositórios monitorados.

## Início rápido

Com o [Node.js](https://nodejs.org) LTS instalado (20.9 ou mais novo):

```bash
git clone git@github.com:NiceColors/cr-hub.git
cd cr-hub
npm run setup
npm run dev
```

O `npm run setup` instala as dependências, cria o `.env.local`, cria o banco SQLite em `.data/` e aplica as migrations. No fim, ele pergunta se você quer informar o token do Bitbucket na hora (e valida antes de salvar). Se preferir, pule e configure depois em **Configuração → Integrações**, em `http://localhost:43123`. Esse é o único passo manual.

Pode rodar de novo quando quiser (por exemplo, depois de um `git pull`): ele não apaga o `.env.local` nem o banco, só instala o que faltar e aplica migrations novas. Para não ter perguntas: `npm run setup -- --yes`.

## Pré-requisitos

- Node.js 20.9 ou mais novo (recomendado: a versão LTS)
- Conta no Bitbucket Cloud com acesso ao workspace

## Criar o API token (App password) no Bitbucket

No Bitbucket Cloud, crie um **App password**:

- Menu do perfil → **Personal settings** → **App passwords** → **Create app password**
- Permissões recomendadas (somente leitura):
  - **Account**: Read
  - **Workspace membership**: Read
  - **Repositories**: Read
  - **Pull requests**: Read (e **Write**, se quiser usar "Me adicionar como revisor")

## Configurar credenciais

O jeito mais simples é pela interface: abra **Configuração → Integrações** em `http://localhost:43123` e preencha workspace, e-mail e API token. O app valida as credenciais no Bitbucket antes de salvar, guarda no SQLite local (`.data/`) e nunca devolve o token ao navegador. Essa tela só aceita alterações quando o app é acessado pelo próprio computador (`localhost`/`127.0.0.1`); por isso os scripts `dev` e `start` escutam apenas em `127.0.0.1`.

As credenciais salvas pela interface têm prioridade. Sem elas, valem as variáveis de ambiente abaixo.

### Variáveis de ambiente (alternativa)

Crie um `.env.local` a partir de `.env.example`:

```bash
cp .env.example .env.local
```

Preencha:

- `BITBUCKET_WORKSPACE`: slug do workspace
- `BITBUCKET_EMAIL`: seu e-mail (HTTP Basic)
- `BITBUCKET_API_TOKEN`: App password
- `DATABASE_URL`: SQLite local (padrão `file:./.data/cr-tracker.db`)

Nota:

- O **token nunca vai para o browser**. Todas as chamadas ao Bitbucket passam por Route Handlers (`src/app/api/*`).

## Banco (SQLite + Drizzle)

O `npm run setup` já faz isso. Para aplicar migrations novas manualmente:

```bash
npm run db:migrate
```

O comando lê o `DATABASE_URL` dos mesmos arquivos `.env*` que o Next, então migrations e app sempre usam o mesmo banco.

## Rodar o app

Dev server (porta fixa `43123`):

```bash
npm run dev
```

Abra `http://localhost:43123`.

## Scripts

- `npm run setup`: configuração inicial (dependências, `.env.local`, banco e migrations)
- `npm run dev`: dev server
- `npm run build`: build
- `npm run start`: produção local
- `npm test`: unit tests (Vitest)
- `npm run db:migrate`: migrations (Drizzle)

## Como usar

1. Vá em **/config**:
   - Clique em **Sincronizar lista** em *Repositórios* e marque quais serão **monitorados**
   - Defina o **mínimo de aprovações** por repositório
   - Clique em **Sincronizar lista** em *Membros* e marque quais usuários serão **monitorados**
     - Se o endpoint retornar **403**, cadastre manualmente por UUID/nickname
   - Crie **Times** (nome, membros e filtro opcional de repositórios; vazio = todos os repos monitorados)
   - Ajuste o **intervalo de atualização** (30/60/120s)
2. Vá em **/**:
   - Veja PRs abertos
   - Filtre por **time** e por filtros avançados (ReUI Filters)
   - Use **Atualizar agora** (força refresh, limitado a 1 vez/10s por combinação de filtros)

## Rate limit

- O servidor mantém **cache em memória** com TTL igual ao intervalo de polling (para evitar multiplicar chamadas com várias abas).
- Em `429`, o app lê `Retry-After` quando existir e exibe aviso na UI.
- A tela **/config** mostra um contador simples de requests feitas na última hora (contagem local do processo).

## Estrutura

`src/app/api/*` contém os Route Handlers; `src/services/*` contém orquestração; `src/lib/*` contém Bitbucket client/cache/DB; e regras puras ficam em `src/domain/*` com testes unitários em Vitest.
