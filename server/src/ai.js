import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

/*
|--------------------------------------------------------------------------
| LABIA V4.1 — CONFIGURAÇÃO
|--------------------------------------------------------------------------
|
| Modelos atuais:
| - Principal: gemini-2.5-flash
| - Fallback: gemini-2.5-flash-lite
|
| IMPORTANTE:
| Não utilizar "models/" antes do nome do modelo.
|--------------------------------------------------------------------------
*/

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";

const MODELS_TO_TRY = [
  PRIMARY_MODEL,
  FALLBACK_MODEL,
];

/*
|--------------------------------------------------------------------------
| INSTRUÇÕES PRINCIPAIS DA LABIA
|--------------------------------------------------------------------------
*/

const SYSTEM = `
Você é a LabIA V4, uma inteligência artificial profissional
especializada em Análises Clínicas.

Responda sempre em português do Brasil.

OBJETIVO:
Auxiliar estudantes, professores, biomédicos, técnicos e profissionais
de laboratório nas atividades relacionadas às análises clínicas.

PRINCÍPIOS:

1. FASES DO LABORATÓRIO

Diferencie claramente:

- fase pré-analítica;
- fase analítica;
- fase pós-analítica.

Quando uma situação envolver erros laboratoriais, indique em qual fase
o problema provavelmente ocorreu.

2. RESULTADOS LABORATORIAIS

- Não invente valores de referência.
- Valores de referência dependem do método, equipamento, população,
  faixa etária, sexo e laboratório.
- Quando um valor de referência não for fornecido, informe isso.
- Não transforme uma alteração laboratorial em diagnóstico definitivo.
- Apresente possibilidades e correlações laboratoriais.
- Informe quais dados adicionais seriam necessários.
- Diferencie achado laboratorial de diagnóstico clínico.
- Quando apropriado, explique possíveis causas pré-analíticas,
  analíticas e pós-analíticas de alterações.

3. MEDICAMENTOS

- Não prescreva medicamentos.
- Não altere doses.
- Não recomende suspensão ou início de medicamentos.
- Não substitua orientação médica.
- Quando necessário, informe que a decisão deve ser tomada pelo
  profissional responsável pelo paciente.

4. PEDIDOS MÉDICOS

Ao analisar uma imagem de pedido médico:

- Identifique somente exames realmente visíveis.
- Não invente exames.
- Se alguma palavra estiver ilegível, escreva [ILEGÍVEL].
- Preserve o nome do exame da forma mais fiel possível.
- Organize os exames de maneira clara.
- Sempre que possível, classifique os exames por setor.

SETORES:

- Hematologia
- Bioquímica
- Imunologia
- Hormônios
- Microbiologia
- Parasitologia
- Urinálise
- Coagulação
- Líquidos corporais
- Genética
- Outros

5. PREPARO

- Identifique somente instruções de preparo que estejam escritas
  no documento.
- Não invente jejum.
- Não invente restrições alimentares.
- Não invente horários.
- Não invente orientações de coleta.

6. CONHECIMENTO

Quando houver conhecimento recuperado:

- utilize-o para complementar a resposta;
- priorize o conhecimento fornecido pelo sistema;
- não invente fontes;
- não atribua informações a uma fonte que não tenha sido fornecida.

Quando utilizar uma fonte fornecida pelo sistema, cite:

[Fonte: título]

Quando não houver fonte suficiente, informe:

"Resposta baseada em conhecimento geral."

7. PRIVACIDADE

- Minimize dados pessoais.
- Não repita nome, CPF, endereço ou outros identificadores
  quando não forem necessários.
- Não solicite dados pessoais desnecessários.

8. SEGURANÇA

- Não forneça diagnóstico definitivo baseado somente em exames.
- Não substitua avaliação médica ou laboratorial.
- Não prescreva tratamentos.
- Seja técnico, claro e objetivo.
- Quando houver risco clínico importante, recomende avaliação
  por profissional habilitado.

9. FORMATAÇÃO

- Use títulos quando necessário.
- Use listas para facilitar a leitura.
- Utilize tabelas somente quando realmente ajudarem.
- Evite respostas excessivamente longas quando uma resposta objetiva
  for suficiente.
- Explique termos técnicos quando estiver respondendo a estudantes.
- Não repita informações desnecessariamente.

10. ANÁLISES CLÍNICAS

Quando solicitado a interpretar resultados laboratoriais:

- apresente os resultados identificados;
- compare com os valores de referência somente quando fornecidos;
- destaque alterações;
- explique possíveis correlações;
- diferencie hipótese de diagnóstico;
- indique informações adicionais relevantes.

Nunca invente resultados que não estejam presentes.
`;

/*
|--------------------------------------------------------------------------
| VERIFICAÇÃO DA API KEY
|--------------------------------------------------------------------------
*/

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    "ATENÇÃO: GEMINI_API_KEY não encontrada no arquivo .env."
  );
}

/*
|--------------------------------------------------------------------------
| CONEXÃO COM GEMINI
|--------------------------------------------------------------------------
*/

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
|--------------------------------------------------------------------------
| CONFIGURAÇÕES DE RETRY
|--------------------------------------------------------------------------
*/

const MAX_RETRIES_PER_MODEL = 2;
const RETRY_DELAY_MS = 1500;

/*
|--------------------------------------------------------------------------
| FUNÇÃO DE ESPERA
|--------------------------------------------------------------------------
*/

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
|--------------------------------------------------------------------------
| IDENTIFICA ERROS QUE NÃO DEVEM SER REPETIDOS
|--------------------------------------------------------------------------
*/

function isPermanentModelError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("404") ||
    message.includes("not_found") ||
    message.includes("model is not found") ||
    message.includes("is not found for api version") ||
    message.includes("not supported for generatecontent")
  );
}

/*
|--------------------------------------------------------------------------
| IDENTIFICA ERROS TEMPORÁRIOS
|--------------------------------------------------------------------------
*/

function isTemporaryError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted") ||
    message.includes("500") ||
    message.includes("internal") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("timeout")
  );
}

/*
|--------------------------------------------------------------------------
| FORMATA ERRO
|--------------------------------------------------------------------------
*/

function getReadableError(error) {
  if (!error) {
    return "Erro desconhecido.";
  }

  return error?.message || String(error);
}

/*
|--------------------------------------------------------------------------
| COMPRESSÃO DE IMAGEM
|--------------------------------------------------------------------------
*/

async function compressBase64Image(base64Str) {
  try {
    if (!base64Str) {
      throw new Error("Imagem não fornecida.");
    }

    const cleanBase64 = base64Str
      .replace(/^data:image\/[\w.+-]+;base64,/, "")
      .trim();

    const imageBuffer = Buffer.from(cleanBase64, "base64");

    if (!imageBuffer.length) {
      throw new Error("Não foi possível converter a imagem.");
    }

    const compressedBuffer = await sharp(imageBuffer)
      .rotate()
      .resize({
        width: 1080,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 70,
        mozjpeg: true,
      })
      .toBuffer();

    return compressedBuffer.toString("base64");

  } catch (error) {
    console.warn(
      "Falha na compressão com Sharp. Usando imagem original:",
      getReadableError(error)
    );

    return base64Str
      .replace(/^data:image\/[\w.+-]+;base64,/, "")
      .trim();
  }
}

/*
|--------------------------------------------------------------------------
| EXECUTA GEMINI COM FALLBACK
|--------------------------------------------------------------------------
*/

async function generateWithFallback(contents, options = {}) {

  let lastError = null;

  for (const modelName of MODELS_TO_TRY) {

    console.log(
      `[LabIA] Tentando modelo: ${modelName}`
    );

    for (
      let attempt = 1;
      attempt <= MAX_RETRIES_PER_MODEL;
      attempt++
    ) {

      try {

        const request = {
          model: modelName,
          contents,
        };

        /*
        |--------------------------------------------------------------
        | SYSTEM INSTRUCTION
        |--------------------------------------------------------------
        */

        request.config = {
          systemInstruction: SYSTEM,
          ...(options.config || {}),
        };

        const response = await ai.models.generateContent(request);

        if (response?.text) {

          console.log(
            `[LabIA] Sucesso com o modelo: ${modelName}`
          );

          return response;
        }

        throw new Error(
          `O modelo ${modelName} não retornou texto.`
        );

      } catch (error) {

        lastError = error;

        console.warn(
          `[LabIA] Tentativa ${attempt}/${MAX_RETRIES_PER_MODEL} falhou no modelo ${modelName}:`,
          getReadableError(error)
        );

        /*
        |--------------------------------------------------------------
        | ERRO DEFINITIVO DE MODELO
        |--------------------------------------------------------------
        */

        if (isPermanentModelError(error)) {

          console.warn(
            `[LabIA] Modelo ${modelName} indisponível. Pulando para o próximo modelo.`
          );

          break;
        }

        /*
        |--------------------------------------------------------------
        | ERRO TEMPORÁRIO
        |--------------------------------------------------------------
        */

        if (isTemporaryError(error)) {

          if (attempt < MAX_RETRIES_PER_MODEL) {

            const delay =
              RETRY_DELAY_MS * attempt;

            console.log(
              `[LabIA] Aguardando ${delay}ms antes de tentar novamente...`
            );

            await sleep(delay);
          }

          continue;
        }

        /*
        |--------------------------------------------------------------
        | OUTROS ERROS
        |--------------------------------------------------------------
        */

        if (attempt < MAX_RETRIES_PER_MODEL) {
          await sleep(RETRY_DELAY_MS);
        }
      }
    }
  }

  throw lastError || new Error(
    "Nenhum modelo Gemini conseguiu processar a solicitação."
  );
}

/*
|--------------------------------------------------------------------------
| FUNÇÃO PRINCIPAL DA IA
|--------------------------------------------------------------------------
*/

export async function askAI(input, context = "") {

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY não configurada no arquivo .env."
    );
  }

  const promptTexto =
    typeof input === "string"
      ? input
      : JSON.stringify(input, null, 2);

  const promptCompleto = `
CONHECIMENTO RECUPERADO
==================================================

${context || "Nenhum conhecimento recuperado."}

==================================================

PERGUNTA / AÇÃO
==================================================

${promptTexto}
`;

  try {

    const response = await generateWithFallback(
      promptCompleto
    );

    return (
      response.text ||
      "A IA processou a solicitação, mas não retornou texto."
    );

  } catch (error) {

    console.error(
      "[LabIA] Erro final:",
      getReadableError(error)
    );

    throw new Error(
      "Não foi possível processar a solicitação pela IA neste momento."
    );
  }
}

/*
|--------------------------------------------------------------------------
| LEITURA DE PEDIDO MÉDICO
|--------------------------------------------------------------------------
*/

export async function readOrder(base64, mimeType) {

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY não configurada no arquivo .env."
    );
  }

  if (!base64) {
    throw new Error(
      "Nenhuma imagem foi enviada para leitura."
    );
  }

  /*
  |----------------------------------------------------------------------
  | COMPRESSÃO DA IMAGEM
  |----------------------------------------------------------------------
  */

  const lightBase64 =
    await compressBase64Image(base64);

  /*
  |----------------------------------------------------------------------
  | PROMPT ESPECÍFICO PARA PEDIDO MÉDICO
  |----------------------------------------------------------------------
  */

  const prompt = `
Leia cuidadosamente o pedido médico apresentado na imagem.

OBJETIVO:

Identificar os exames solicitados pelo médico.

RETORNE EXATAMENTE NESTA ESTRUTURA:

EXAMES IDENTIFICADOS

1. Nome do exame — Setor
2. Nome do exame — Setor
3. Nome do exame — Setor

ITENS ILEGÍVEIS

- Liste aqui qualquer informação que não possa ser identificada.
- Se não houver, escreva "Nenhum".

PREPARO ESCRITO NO DOCUMENTO

- Liste somente orientações que estejam realmente escritas na imagem.
- Se não houver, escreva:
  "Nenhuma orientação de preparo identificada."

OBSERVAÇÕES

- Informe informações relevantes visíveis no documento.
- Não faça diagnóstico.
- Não invente exames.
- Não interprete exames que não estejam presentes.
- Não invente valores.
- Se houver dúvida sobre uma palavra ou exame, escreva [ILEGÍVEL].

SETORES POSSÍVEIS:

- Hematologia
- Bioquímica
- Imunologia
- Hormônios
- Microbiologia
- Parasitologia
- Urinálise
- Coagulação
- Líquidos corporais
- Genética
- Outros

REGRAS IMPORTANTES:

1. Transcreva apenas o que estiver visível.
2. Não complete automaticamente palavras parcialmente visíveis.
3. Não suponha exames comuns que não estejam escritos.
4. Se houver dúvida, utilize [ILEGÍVEL].
5. Preserve a grafia do exame sempre que possível.
6. Não faça diagnóstico.
7. Não interprete resultados.
8. Não invente preparo.
`;

  /*
  |----------------------------------------------------------------------
  | FORMATO MULTIMODAL
  |----------------------------------------------------------------------
  */

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: prompt,
        },
        {
          inlineData: {
            data: lightBase64,
            mimeType: "image/jpeg",
          },
        },
      ],
    },
  ];

  /*
  |----------------------------------------------------------------------
  | ENVIA PARA GEMINI
  |----------------------------------------------------------------------
  */

  try {

    const response =
      await generateWithFallback(contents);

    return (
      response.text ||
      "Não foi possível identificar os exames na imagem."
    );

  } catch (error) {

    console.error(
      "[LabIA] Erro na leitura do pedido:",
      getReadableError(error)
    );

    throw new Error(
      "Não foi possível realizar a leitura da imagem neste momento."
    );
  }
}

/*
|--------------------------------------------------------------------------
| TESTE DA IA
|--------------------------------------------------------------------------
*/

export async function testAI() {

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY não configurada."
    );
  }

  try {

    const response =
      await generateWithFallback(
        "Responda apenas: LabIA V4 conectada com sucesso."
      );

    return (
      response.text ||
      "IA conectada, mas não retornou texto."
    );

  } catch (error) {

    console.error(
      "[LabIA] Falha no teste:",
      getReadableError(error)
    );

    throw new Error(
      getReadableError(error)
    );
  }
}

/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO DA IA
|--------------------------------------------------------------------------
*/

export function getAIConfig() {

  return {
    provider: "Google Gemini",

    model: PRIMARY_MODEL,

    fallbackModel: FALLBACK_MODEL,

    models: MODELS_TO_TRY,

    configured:
      Boolean(process.env.GEMINI_API_KEY),
  };
}