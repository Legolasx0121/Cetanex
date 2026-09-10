import {
  loadModel,
  completion,
  unloadModel,
  QWEN3_1_7B_INST_Q4
} from "@qvac/sdk";

let modelId;

try {
  console.log("Cetanex está preparando el modelo local...");

  modelId = await loadModel({
    modelSrc: QWEN3_1_7B_INST_Q4,
    modelConfig: {
      ctx_size: 4096
    },
    onProgress: (progress) => {
      const downloaded = (progress.downloaded / 1e6).toFixed(1);
      const total = (progress.total / 1e6).toFixed(1);

      process.stdout.write(
        `\rDescargando: ${progress.percentage.toFixed(0)}% (${downloaded}/${total} MB)`
      );
    }
  });

  console.log("\nModelo cargado correctamente.");
  console.log("Respuesta de Cetanex:\n");

  const run = completion({
    modelId,
    history: [
      {
        role: "system",
        content: "Responde en español de manera clara y breve."
      },
      {
        role: "user",
        content: "¿Qué significa que una inteligencia artificial funcione localmente?"
      }
    ],
    stream: true
  });

  for await (const event of run.events) {
    if (event.type === "contentDelta") {
      process.stdout.write(event.text);
    }
  }

  await run.final;
  console.log("\n");
} catch (error) {
  console.error("\nError durante la prueba:");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (modelId) {
    await unloadModel({ modelId });
    console.log("Modelo descargado de la memoria.");
  }
}
