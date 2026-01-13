// server/chat/OpenAIChatEngine.js
import { ChatEngine } from "./ChatEngine.js";
import { Agent, Runner, fileSearchTool } from "@openai/agents";
import OpenAI from "openai";
import { z } from "zod";
import { supabaseAdmin } from "../../api/lib/supabaseServer.js";

const VECTOR_STORE_ID = "vs_692231d5414c8191bc1dbb7b121ff065";
const fileSearch = fileSearchTool([VECTOR_STORE_ID]);

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
    )
});

export class OpenAIChatEngine extends ChatEngine {
    constructor() {
        super();

        this.agent = new Agent({
            name: "SchoolPolicyAgent",
            model: "gpt-4.1",
            instructions:
                "You are a school policy assistant. Use policy files only.",
            tools: [fileSearch],
            outputType: Schema
        });

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            organization: process.env.OPENAI_ORG_ID,
            project: process.env.OPENAI_PROJECT_ID
        });
    }

    async reply({ userText, history = [], userEmail = null }) {
        const historyText = history
            .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        const fullInput =
            (historyText ? historyText + "\n\n" : "") + "User: " + userText;

        const runner = new Runner();
        const result = await runner.run(this.agent, [
            { role: "user", content: [{ type: "input_text", text: fullInput }] }
        ]);

        const out = result.finalOutput || {};
        const replyText =
            (out.conclusion ? out.conclusion + "\n\n" : "") +
            (out.analysis || "");

        // Your original embedding / similarity / supabase insert
        // Can be dropped in as-is (I can help trim it later)

        return {
            reply: replyText || "(empty reply)",
            structured: out,
            sources: out.related_policies || []
        };
    }
}
