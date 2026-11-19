# Young-Link · Espaço de trabalho

Projetos, tarefas e documentos da Young-Link, ao estilo Notion. Next.js + SQLite + editor BlockNote.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Importar do Notion

O ficheiro exportado fica em `data/notion-seed.json`. Para (re)importar:

```bash
npm run import
```

A importação atualiza as páginas com o mesmo ID e não apaga o que foi criado na app.

## Contas e login

Cada pessoa entra com o seu email e palavra-passe. Os administradores gerem as contas na página **Administração** da app (`/admin`): criar contas, editar nome e email, gerar palavras-passe, dar acesso de admin, terminar sessões e apagar contas.

Ao criar uma conta, a pessoa recebe por email um **convite** com um link pessoal (válido 7 dias, uso único) para escolher a palavra-passe. Se o email não estiver configurado, o painel mostra o link para copiar e enviar.

### Configurar o envio de emails

Usa a mesma conta SMTP da app Young-Link. Cria o ficheiro `.env.local` nesta pasta com:

```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=notificacoes@younglink.net
EMAIL_PASS=palavra-passe-de-aplicação
EMAIL_FROM=notificacoes@younglink.net
APP_URL=http://endereço-do-mac-mini:3100
```

`APP_URL` é o endereço que aparece nos links dos convites. Tem de ser um endereço a que as pessoas consigam chegar. Depois de alterar o ficheiro, reinicia a app.

O primeiro administrador nomeia-se no terminal:

```bash
npm run users -- admin maurosimoes@younglink.net
```

Também é possível gerir tudo no terminal:

```bash
npm run users
```

```bash
npm run users -- password maurosimoes@younglink.net
```

```bash
npm run users -- add nome@younglink.net Nome Apelido
```

```bash
npm run users -- email "Ana Neto" ananeto@younglink.net
```

Depois de entrar, cada pessoa pode mudar a palavra-passe no menu da conta. As sessões duram 30 dias. Ao fim de 8 tentativas falhadas, a conta fica bloqueada durante 15 minutos.

## Correr no Mac Mini

```bash
npm install
npm run build
npm run start -- -p 3100
```

A base de dados fica em `data/younglink.db` (um só ficheiro: basta copiá-lo para fazer backup). Para a guardar noutro sítio, define `DATA_DIR=/caminho/para/pasta`.
