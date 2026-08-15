# LabIA V4 Profissional

Plataforma mobile + API para assistência em Análises Clínicas.

## Módulos
- Login e perfis (admin, professor, profissional, estudante)
- Dashboard
- Chat com IA
- Leitura de pedidos médicos por imagem
- Interpretação educacional de resultados
- Biblioteca de exames
- Base de conhecimento/RAG preparada para POPs, PDFs, artigos e manuais
- Histórico de atendimentos
- Painel administrativo
- Cadastro de documentos da base de conhecimento
- Auditoria de eventos
- Configuração de laboratório e valores de referência
- Estrutura preparada para PostgreSQL
- JWT e hash de senha
- Proteções básicas de segurança e limites de requisição
- LGPD-by-design: minimização, pseudonimização e trilha de auditoria

## Stack
- Mobile: Expo + React Native + TypeScript
- API: Node.js + Express
- Banco: PostgreSQL
- IA: OpenAI Responses API
- Busca de conhecimento: camada RAG preparada para vector store/embeddings
- Autenticação: JWT + bcrypt

## Importante
Este repositório é uma base profissional de desenvolvimento, não uma certificação de conformidade.
Dados de saúde são dados pessoais sensíveis pela LGPD. Antes de produção, faça revisão jurídica,
de segurança, privacidade e validação clínica. Não envie dados reais de pacientes durante testes.

## Configuração rápida

### API
```bash
cd server
npm install
cp .env.example .env
# preencha OPENAI_API_KEY e DATABASE_URL
npm run dev
```

### Mobile
```bash
cd mobile
npm install
npx expo start
```

Em `mobile/src/config.ts`, coloque o endereço da API.

## Banco
```bash
createdb labia
psql "$DATABASE_URL" -f server/sql/schema.sql
```

O servidor também consegue criar as tabelas com:
```bash
npm run db:init
```

## Usuário inicial
O script `db:seed` cria:
- e-mail: admin@labia.local
- senha: TroqueEstaSenha123!

Troque imediatamente a senha em ambiente real.

## RAG
A V4 separa:
1. documento original
2. metadados
3. indexação
4. recuperação de trechos
5. resposta com citações

Não coloque um PDF inteiro dentro do prompt sem necessidade. Em produção, indexe os documentos
e recupere apenas os trechos relevantes.

## LGPD
O projeto foi desenhado para minimizar dados e registrar auditoria. Dados de saúde são sensíveis
e exigem salvaguardas reforçadas. A implementação final deve ser validada conforme a finalidade,
base legal, retenção, acesso, segurança e responsabilidades do controlador/operador.

## Próxima fase
- OCR dedicado
- Integração LIS/HIS
- FHIR
- notificações
- relatórios PDF assináveis
- gestão avançada de referências por método
- avaliação automática da qualidade da IA
- testes de segurança e pentest
