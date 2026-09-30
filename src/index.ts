import { FlowAutomation } from "./flow-automation.js";

function parseGenerateArgs(args: string[]) {
  const prompt = args.find((arg) => !arg.startsWith("--"));

  if (!prompt) {
    throw new Error(
      'Uso: npm run generate -- "seu prompt" [--model="Nano Banana Pro"] [--aspect=16:9] [--quantity=1]'
    );
  }

  const readOption = (name: string): string | undefined => {
    const inline = args.find((arg) => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);

    const index = args.findIndex((arg) => arg === name);
    if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) {
      return args[index + 1];
    }

    return undefined;
  };

  const modelArg = readOption("--model");
  const aspectArg = readOption("--aspect");
  const quantityArg = readOption("--quantity");

  const models = ["Nano Banana 2", "Nano Banana Pro"] as const;
  const aspects = ["16:9", "4:3", "1:1", "3:4", "9:16"] as const;
  const quantities = [1, 2, 3, 4] as const;

  const model = modelArg
    ? models.find((value) => value === modelArg)
    : undefined;
  const aspectRatio = aspectArg
    ? aspects.find((value) => value === aspectArg)
    : undefined;
  const quantity = quantityArg
    ? quantities.find((value) => value === Number(quantityArg))
    : undefined;

  if (modelArg && !model) {
    throw new Error(`Modelo inválido: ${modelArg}`);
  }

  if (aspectArg && !aspectRatio) {
    throw new Error(`Proporção inválida: ${aspectArg}`);
  }

  if (quantityArg && !quantity) {
    throw new Error(`Quantidade inválida: ${quantityArg}`);
  }

  return { prompt, model, aspectRatio, quantity };
}

async function main() {
  const command = process.argv[2] ?? "inspect";
  const flow = new FlowAutomation();

  try {
    await flow.start();

    const testProject =
      process.env.FLOW_TEST_PROJECT ??
      "https://flow.google.com/project/ea257c6f-662b-4af0-8963-18963ae15afd";

    if (command === "inspect-settings" || command === "generate") {
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
      const options = parseGenerateArgs(process.argv.slice(3));
      const result = await flow.generateImage(options);
      console.log("Geração iniciada:");
      console.log(JSON.stringify(result, null, 2));
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
