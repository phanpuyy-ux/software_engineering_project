// agent.js
import { Agent, Runner, fileSearchTool } from "@openai/agents";
import { z } from "zod";
import readline from "node:readline";

// 1) File search tool
const fileSearch = fileSearchTool([
  "vs_692231d5414c8191bc1dbb7b121ff065"
]);

// 2) Agent output schema
const Schema = z.object({
  grade: z.string(),
  major: z.string(),
  conclusion: z.string(),
  analysis: z.string(),
  related_policies: z.array(
    z.object({
      file: z.string(),
      snippet: z.string(),
      reason: z.string()
    })
  )
});

// 3) Create simple Agent
const agent = new Agent({
  name: "SchoolPolicyAgent",
  model: "gpt-4.1",
  instructions: "You must answer strictly using school policy files via File Search tool.",
  tools: [fileSearch],
  outputType: Schema
});

// 4) Create CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("📘 School Policy Agent - user input（exit to quit）：");

async function main() {
  while (true) {
    const q = await new Promise((r) => rl.question("> ", r));
    if (q.toLowerCase() === "exit") break;

    console.log("⏳ Thinking...\n");

    const runner = new Runner();
    const result = await runner.run(agent, [
      { role: "user", content: [{ type: "input_text", text: q }] }
    ]);

    console.log(JSON.stringify(result.finalOutput, null, 2));
    console.log("\n———————\n");
  }

  rl.close();
}

main();
