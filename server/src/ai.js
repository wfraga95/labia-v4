import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

/*
|--------------------------------------------------------------------------
| CONFIGURAÇÃO DA LABIA V4
|--------------------------------------------------------------------------
*/

const PRIMARY_MODEL = "gemini-3.7-flash";
const FALLBACK_MODEL = "gemini-3.5-flash";

const SYSTEM = `
Você é a LabIA V4, uma inteligência artificial profissional
especializada em Análises Clínicas.

Responda sempre em português do Brasil.

OBJETIVO:
Auxiliar estudantes, professores, biomédicos, técnicos e profissionais
de laboratório nas atividades relacionadas às análises clínicas.

PRINCÍPIOS:

1. FASES DO LABORATÓRIO
- Diferencie claramente:
  - fase pré-analítica;
  - fase analítica;
  - fase pós-analítica.

2. RESULTADOS LABORATORIAIS
- Não invente valores de referência.
- Valores de referência dependem do método, equipamento, população,
  faixa etária, sexo e laboratório.
- Quando um valor de referência não for fornecido, informe isso.
- Não transforme uma alteração laboratorial em diagnóstico definitivo.
- Apresente possibilidades e correlações laboratoriais.
- Informe quais dados adicionais seriam necessários.

3. MEDICAMENTOS
- Não prescreva medicamentos.
- Não altere doses.
- Não recomende suspensão ou início de medicamentos.
- Quando necessário, oriente que a decisão deve ser feita pelo profissional
  responsável pelo paciente.

4. PEDIDOS MÉDICOS
Ao analisar uma imagem de pedido médico:
- Identifique somente exames realmente visíveis.
- Não invente exames.
- Se alguma palavra estiver ilegível, escreva [ILEGÍVEL].
- Preserve o nome do exame da forma mais fiel possível.
- Organize os exames de maneira clara.
- Sempre que possível, classifique os exames por setor:
  Hematologia
  Bioquímica
  Imunologia
  Hormônios
  Microbiologia
  Parasitologia
  Urinálise
  Coagulação
  Líquidos corporais
  Outros

5. PREPARO
- Identifique somente instruções de preparo que estejam escritas
  no documento.
- Não invente jejum ou qualquer outra orientação.

6. CONHECIMENTO
- Quando houver conhecimento recuperado, utilize-o para complementar
  a resposta.
- Quando utilizar uma fonte fornecida pelo sistema, cite no formato:
  [Fonte: título]
- Se não houver fonte suficiente, informe:
  "Resposta baseada em conhecimento geral."

7. PRIVACIDADE
- Minimize dados pessoais.
- Não repita nome, CPF, endereço ou outros identificadores
  quando eles não forem necessários para a resposta.

8. SEGURANÇA
- Não forneça diagnóstico definitivo baseado somente em exames.
- Não substitua avaliação médica ou laboratorial.
- Seja técnico, claro e objetivo.

9. FORMATAÇÃO
- Use títulos quando necessário.
- Use listas para facilitar a leitura.
- Evite respostas excessivamente longas quando uma resposta objetiva
  for suficiente.
`;

/*
|--------------------------------------------------------------------------
| CONEXÃO COM GEMINI
|--------------------------------------------------------------------------
*/

if (!process.env.GEMINI_API_KEY) {
  console.warn("ATENÇÃO: GEMINI_API_KEY não encontrada no arquivo .env");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
|--------------------------------------------------------------------------
| FUNÇÃO PRINCIPAL DA IA
|--------------------------------------------------------------------------
*/

export async function askAI(input, context = "") {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada no arquivo .env.");
  }

  const promptTexto =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);

  const promptCompleto = `
${SYSTEM}

==================================================
CONHECIMENTO RECUPERADO
==================================================

${context || "Nenhum conhecimento recuperado."}

==================================================
PERGUNTA / AÇÃO
==================================================

${promptTexto}
`;

  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: promptCompleto,
        config: {
          temperature: 0.2,
          maxOutputTokens: 1000,
        },
      });

      if (response.text) {
        return response.text;
      }
    } catch (error) {
      console.warn(`Falha no modelo ${modelName}:`, error.message);
    }
  }

  throw new Error("Serviço temporariamente sobrecarregado. Tente novamente em instantes.");
}

/*
|--------------------------------------------------------------------------
| LEITURA DE PEDIDO MÉDICO COM FALLBACK, RETRY E OTIMIZAÇÃO DE VELOCIDADE
|--------------------------------------------------------------------------
*/

export async function readOrder(base64, mimeType) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada no arquivo .env.");
  }

  if (!base64) {
    throw new Error("Nenhuma imagem foi enviada para leitura.");
  }

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
- Se não houver, escreva "Nenhuma orientação de preparo identificada."

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

IMPORTANTE:
Transcreva apenas o que estiver visível na imagem.
`;

  const contents = [
    { text: `${SYSTEM}\n\n${prompt}` },
    {
      inlineData: {
        data: base64,
        mimeType: mimeType || "image/jpeg",
      },
    },
  ];

  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            temperature: 0.1,       // Reduz a variação e acelera a geração do OCR
            maxOutputTokens: 800,   // Limita a contagem de tokens para finalizar a resposta mais rápido
          },
        });

        if (response.text) {
          return response.text;
        }
      } catch (error) {
        console.warn(
          `Tentativa ${attempt} falhou no modelo ${modelName}:`,
          error.message
        );
        // Aguarda 1.5 segundos antes de tentar novamente no caso de erro 503
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  throw new Error("Instabilidade temporária nos servidores da IA. Por favor, tente enviar novamente.");
}

/*
|--------------------------------------------------------------------------
| FUNÇÃO PARA TESTAR A CONEXÃO COM O GEMINI
|--------------------------------------------------------------------------
*/

export async function testAI() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  try {
    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: "Responda apenas: LabIA V4 conectada com sucesso.",
    });

    return response.text || "IA conectada, mas não retornou texto.";
  } catch (error) {
    throw new Error(error?.message || "Não foi possível conectar ao Gemini.");
  }
}

/*
|--------------------------------------------------------------------------
| INFORMAÇÕES DA CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

export function getAIConfig() {
  return {
    provider: "Google Gemini",
    model: PRIMARY_MODEL,
    configured: Boolean(process.env.GEMINI_API_KEY),
  };
}