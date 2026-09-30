import { FlowAutomation } from "./flow-automation.js";

async function main() {
  const command = process.argv[2] ?? "inspect";
  const flow = new FlowAutomation();

  try {
    await flow.start();

    const testProject =
      process.env.FLOW_TEST_PROJECT ??
      "https://flow.google.com/project/ea257c6f-662b-4af0-8963-18963ae15afd";

    if (command === "inspect-settings") {
      await flow.openProject(testProject);
    } else {
      await flow.open();
    }

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

    if (command === "inspect-creator") {
      const result = await flow.inspectCreator();
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "inspect-settings") {
      const result = await flow.inspectSettings();
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (command === "generate") {
      console.error(
        "Geração ainda não foi automatizada: primeiro precisamos validar as opções reais do painel de configurações."
      );
      console.error(
        "Use 'npm run inspect-settings' para capturar o DOM das configurações."
      );
      process.exitCode = 2;
      return;
    }

    console.error(`Comando desconhecido: ${command}`);
    console.error(
      "Use: npm run open | npm run inspect | npm run inspect-creator | npm run inspect-settings | npm run generate"
    );
    process.exitCode = 1;
  } finally {
    if (command !== "open") await flow.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
