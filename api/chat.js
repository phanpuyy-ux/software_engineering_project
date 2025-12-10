// /api/chat.js  —— 用 Agents + fileSearch，和你朋友 CLI 一样的逻辑

import { Agent, Runner, fileSearchTool } from "@openai/agents";
import { z } from "zod";

// 1) 你的 vector store（和 agent.js 一样）
const VECTOR_STORE_ID = "vs_692231d5414c8191bc1dbb7b121ff065";
const fileSearch = fileSearchTool([VECTOR_STORE_ID]);

// 2) 输出 schema（直接搬你朋友的）
const Schema = z.object({
    grade: z.string(),
    major: z.string(),
    conclusion: z.string(),
    analysis: z.string(),
    related_policies: z.array(
        z.object({
            file: z.string(),
            snippet: z.string(),
            reason: z.string(),
        })
    ),
});

// 3) 建一个全局 Agent（函数外面只建一次就行）
const agent = new Agent({
    name: "SchoolPolicyAgent",
    model: "gpt-4.1",
    instructions:
        "You are a school policy assistant. You MUST answer strictly using school policy files via File Search tool. " +
        "If the policy does not cover the question, say clearly that it is not specified. " +
        "Prefer Chinese in your final explanation.",
    tools: [fileSearch],
    outputType: Schema,
});

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        let { userText, history = [] } = req.body;

        if (!userText || typeof userText !== "string") {
            return res.status(400).json({ error: "userText is required" });
        }

        // --- 简单拼一下 history，给 Agent 作为上下文
        const historyText = history
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        const fullInput =
            (historyText ? historyText + "\n\n" : "") + "User: " + userText;

        // 4) 跑 Agent（跟 CLI 一样，只是我们不再需要 readline）
        const runner = new Runner();
        const result = await runner.run(agent, [
            {
                role: "user",
                content: [{ type: "input_text", text: fullInput }],
            },
        ]);

        // result.finalOutput 就是 Schema 结构，我们挑你想展示的部分返回
        const out = result.finalOutput;

        const reply =
            (out.conclusion ? out.conclusion + "\n\n" : "") +
            (out.analysis || "");

        return res.status(200).json({
            reply: reply || "(empty reply)",
            structured: out, // 如果你以后想在前端单独展示 related_policies，这里已经有了
        });
    } catch (err) {
        console.error("Agent error:", err);
        return res
            .status(500)
            .json({ error: "Agent error", detail: err.message || String(err) });
    }
}
