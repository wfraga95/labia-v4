import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";

/*
|--------------------------------------------------------------------------
| LABIA V4.1 — CONFIGURAÇÃO SIMPLIFICADA
|--------------------------------------------------------------------------
*/

const MODEL_NAME = "gemini-2.5-flash";

if (!process.env.GEMINI_API_KEY) {
  console.warn("ATENÇÃO: GEMINI_API_KEY não encontrada no arquivo .env.");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
|--------------------------------------------------------------------------
| COMPRESSÃO DE IMAGEM
|--------------------------------------------------------------------------
*/

async function compressBase64Image(base64Str) {
  try {
    if (!base64Str) throw new Error("Imagem não fornecida.");

    const cleanBase64 = base64Str
      .replace(/^data:image\/[\w.+-]+;base64,/, "")
      .trim();

    const imageBuffer = Buffer.from(cleanBase64, "base64");

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
    console.warn("Falha na compressão com Sharp. Usando original:", error.message);
    return base64Str.replace(/^data:image\/[\w.+-]+;base64,/, "").trim();
  }
}

/*
|--------------------------------------------------------------------------
| FUNÇÃO PRINCIPAL DA IA (TEXTO)
|--------------------------------------------------------------------------
*/

export async function askAI(input, context = "") {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  const promptTexto = typeof input === "string" ? input : JSON.stringify(input, null, 2);
  const promptCompleto = `CONHECIMENTO: ${context || "Nenhum"}\n\nPERGUNTA: ${promptTexto}`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: promptCompleto,
    });

    return response.text || "A IA processou a solicitação, mas não retornou texto.";
  } catch (error) {
    console.error("[LabIA] Erro em askAI:", error.message);
    throw new Error("Não foi possível processar a solicitação pela IA neste momento.");
  }
}

/*
|--------------------------------------------------------------------------
| LEITURA DE PEDIDO MÉDICO (IMAGEM + TEXTO)
|--------------------------------------------------------------------------
*/

export async function readOrder(base64, mimeType) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  if (!base64) {
    throw new Error("Nenhuma imagem foi enviada.");
  }

  const lightBase64 = await compressBase64Image(base64);

  const prompt = `
Leia cuidadosamente o pedido médico apresentado na imagem.
Identifique os exames solicitados e organize-os por setor.

RETORNE EXATAMENTE NESTA ESTRUTURA:

EXAMES IDENTIFICADOS
1. Nome do exame — Setor
2. Nome do exame — Setor

ITENS ILEGÍVEIS
- Liste informações ilegíveis ou "Nenhum".

PREPARO ESCRITO NO DOCUMENTO
- Liste orientações ou "Nenhuma orientação de preparo identificada."

OBSERVAÇÕES
- Informe dados relevantes visíveis, sem diagnósticos definitivos.
`;

  try {
    // Chamada direta e limpa suportada pelo SDK @google/genai
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        prompt,
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: lightBase64,
          },
        },
      ],
    });

    return response.text || "Não foi possível identificar os exames na imagem.";
  } catch (error) {
    console.error("[LabIA] Erro na leitura do pedido:", error.message);
    throw new Error("Não foi possível realizar a leitura da imagem neste momento.");
  }
}

/*
|--------------------------------------------------------------------------
| TESTE E CONFIGURAÇÃO
|--------------------------------------------------------------------------
*/

export async function testAI() {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurada.");

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: "Responda apenas: LabIA V4 conectada com sucesso.",
  });

  return response.text || "IA conectada, mas não retornou texto.";
}

export function getAIConfig() {
  return {
    provider: "Google Gemini",
    model: MODEL_NAME,
    configured: Boolean(process.env.GEMINI_API_KEY),
  };
}