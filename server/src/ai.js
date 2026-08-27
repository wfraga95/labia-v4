import "dotenv/config";
import sharp from "sharp";

/*
|--------------------------------------------------------------------------
| LABIA V4.1 — CONFIGURAÇÃO DIRETA VIA REST (GEMINI 3.6 FLASH)
|--------------------------------------------------------------------------
*/

const MODEL_NAME = "gemini-3.6-flash";

if (!process.env.GEMINI_API_KEY) {
  console.warn("ATENÇÃO: GEMINI_API_KEY não encontrada nas variáveis de ambiente.");
}

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

async function callGeminiAPI(contents) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contents }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[LabIA API Error]:", JSON.stringify(data));
    throw new Error(data.error?.message || `Erro HTTP ${response.status}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("A IA respondeu, mas não retornou texto válido.");
  }

  return text;
}

export async function askAI(input, context = "") {
  const promptTexto = typeof input === "string" ? input : JSON.stringify(input, null, 2);
  const promptCompleto = `CONHECIMENTO: ${context || "Nenhum"}\n\nPERGUNTA: ${promptTexto}`;

  const contents = [
    {
      parts: [{ text: promptCompleto }],
    },
  ];

  return await callGeminiAPI(contents);
}

export async function readOrder(base64, mimeType) {
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

  const contents = [
    {
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: "image/jpeg",
            data: lightBase64,
          },
        },
      ],
    },
  ];

  try {
    return await callGeminiAPI(contents);
  } catch (error) {
    console.error("[LabIA] Erro na leitura do pedido:", error.message);
    throw new Error(`Erro API Gemini: ${error.message}`);
  }
}

export async function testAI() {
  const contents = [{ parts: [{ text: "Responda apenas: LabIA V4 conectada com sucesso." }] }];
  return await callGeminiAPI(contents);
}

export function getAIConfig() {
  return {
    provider: "Google Gemini (REST Direct)",
    model: MODEL_NAME,
    configured: Boolean(process.env.GEMINI_API_KEY),
  };
}