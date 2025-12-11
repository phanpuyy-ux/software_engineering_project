// /api/chat.js  —— 用 Agents + fileSearch，和你朋友 CLI 一样的逻辑

import { Agent, Runner, fileSearchTool } from "@openai/agents";
import { z } from "zod";
import { supabaseAdmin } from "../supabaseServer.js";  // 路径：chat.js 在 /api 下

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
        let { userText, history = [], userEmail = null } = req.body;

        if (!userText || typeof userText !== "string") {
            return res.status(400).json({ error: "userText is required" });
        }

        const rawQuestion = userText;   // 原始问题，用来写入 question 列

        // ---- 拼 history 文本，给 Agent 当上下文 ----
        const historyText = history
            .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        const fullInput =
            (historyText ? historyText + "\n\n" : "") + "User: " + userText;

        const runner = new Runner();
        const result = await runner.run(agent, [
            {
                role: "user",
                content: [{ type: "input_text", text: fullInput }],
            },
        ]);

        const out = result.finalOutput || {};

        const replyText =
            (out.conclusion ? out.conclusion + "\n\n" : "") +
            (out.analysis || "");

        const finalReply = replyText || "(empty reply)";

        // ---- 整理 sources：把 related_policies 映射到数组 ----
        const sourcesArray = Array.isArray(out.related_policies)
            ? out.related_policies.map((p) => ({
                file: p.file,
                snippet: p.snippet,
                reason: p.reason,
            }))
            : [];

        // ---- 写入 Supabase 表 ----
        try {
            const { error: dbError } = await supabaseAdmin
                .from("policy_answers")   //  这里是表名，如果你取别的名字就改成你的
                .insert({
                    question: rawQuestion,       //  question
                    answer: finalReply,          //  answer
                    sources: sourcesArray,       //  sources (jsonb)
                    user_email: userEmail || null, //  user_email
                    // created_at 通常在表里设 default now()，这里可以不传
                });

            if (dbError) {
                console.error("Supabase insert error:", dbError);
            }
        } catch (dbErr) {
            console.error("Supabase insert throw:", dbErr);
        }

        // ---- 返回给前端 ----
        return res.status(200).json({
            reply: finalReply,
            structured: out,
            sources: sourcesArray, // 如果前端以后想用也方便
        });
    } catch (err) {
        console.error("Agent error:", err);
        return res
            .status(500)
            .json({ error: "Agent error", detail: err.message || String(err) });
    }
}

