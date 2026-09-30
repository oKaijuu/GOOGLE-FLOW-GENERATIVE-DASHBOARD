import { FlowAutomation } from "./flow-automation.js";

async function main() {
  const command = process.argv[2] ?? "inspect";
  const flow = new FlowAutomation();

  try {
    await flow.start();
    await flow.open();

    if (command === "open") {
      console.log("Google Flow aberto.");
      console.log("Faça login manualmente se necessário.");
      console.log("A sessão será persistida em .flow-profile.");
      await new Promise(() => {});
    }

    if (command === "inspect") {
      const result = await flow.inspect();
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "generate") {
      console.error(
        "Geração ainda não foi automatizada: o JSON fornecido não registra de forma confiável a ação final de geração."
      );
      console.error(
        "Use 'npm run inspect' para capturar o estado atual do DOM antes de definir o gatilho."
      );
      process.exitCode = 2;
      return;
    }

    console.error(`Comando desconhecido: ${command}`);
    console.error("Use: npm run open | npm run inspect | npm run generate");
    process.exitCode = 1;
  } finally {
    if (command !== "open") await flow.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
