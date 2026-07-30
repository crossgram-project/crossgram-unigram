import path from "node:path";
import process from "node:process";

import { patchUnigram } from "./patch.js";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "patch") {
    throw new Error("Usage: yarn patch:source --source <Unigram checkout>");
  }
  const sourceIndex = args.indexOf("--source");
  if (sourceIndex < 0 || !args[sourceIndex + 1]) {
    throw new Error("--source <Unigram checkout> is required");
  }
  const result = await patchUnigram(path.resolve(args[sourceIndex + 1]));
  for (const file of result.changedFiles) process.stdout.write(`patched ${file}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
