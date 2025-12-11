// /api/chat.js  ���� Agents + FileSearch + embeddings + Supabase Logging

import { Agent, Runner, fileSearchTool } from "@openai/agents";
import { z } from "zod";
import OpenAI from "openai";
import { supabaseAdmin } from "../supabaseServer.js";

// -----------------------------------
// 1) File Search Vector Store
// -----------------------------------
const VECTOR_STORE_ID = "vs_692231d5414c8191bc1dbb7b121ff065";
const fileSearch = fileSearchTool([VECTOR_STORE_ID]);

// -----------------------------------
// 2) Schema���������� agent.js һ����
// -----------------------------------
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

// -----------------------------------
// 3) Global Agent
// -----------------------------------
const agent = new Agent({
    name: "SchoolPolicyAgent",
    model: "gpt-4.1",
    instructions:
        "You are a school policy assistant. You MUST answer strictly using school policy files via File Search tool. " +
        "If the policy does not cover the question, say clearly that it is not specified. ",
    tools: [fileSearch],
    outputType: Schema
});

// -----------------------------------
// 4) OpenAI client for embeddings
// -----------------------------------
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
    project: process.env.OPENAI_PROJECT_ID
});

// -----------------------------------
// Define CosineSimilarity
// -----------------------------------

function cosineSimilarity(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// -----------------------------------
// 5) API Route Handler
// -----------------------------------
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        let { userText, history = [], userEmail = null } = req.body;

        if (!userText || typeof userText !== "string") {
            return res.status(400).json({ error: "userText is required" });
        }

        const rawQuestion = userText;

        // -------------------------
        // Combine history into one string
        // -------------------------
        const historyText = history
            .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
            .join("\n");

        const fullInput =
            (historyText ? historyText + "\n\n" : "") + "User: " + userText;

        // -------------------------
        // Run Agent
        // -------------------------
        const runner = new Runner();
        const result = await runner.run(agent, [
            {
                role: "user",
                content: [{ type: "input_text", text: fullInput }]
            }
        ]);

        const out = result.finalOutput || {};

        // Final answer = conclusion + analysis
        const replyText =
            (out.conclusion ? out.conclusion + "\n\n" : "") +
            (out.analysis || "");
        const finalReply = replyText || "(empty reply)";

        // -------------------------
        // Extract sources
        // -------------------------
        const sourcesArray = Array.isArray(out.related_policies)
            ? out.related_policies.map(p => ({
                file: p.file,
                snippet: p.snippet,
                reason: p.reason
            }))
            : [];

        const sourcesText = sourcesArray.map(s => s.snippet).join("\n\n");

        // -------------------------
        // Generate embeddings
        // -------------------------
        let questionEmbedding = null;
        let answerEmbedding = null;
        let sourcesEmbedding = null;

        let sim_answer_sources = null;

        try {
            const emb = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: [rawQuestion, finalReply, sourcesText]
            });

            const [e1, e2, e3] = emb.data.map(d => d.embedding);
            questionEmbedding = e1;
            answerEmbedding = e2;
            sourcesEmbedding = e3;

            // === Only Compare Answer & Sources ===
            sim_answer_sources = cosineSimilarity(e2, e3);

        } catch (err) {
            console.error("Embedding error:", err);
        }

        // -------------------------
        // Insert into Supabase
        // -------------------------
        try {
            const { error: dbErr } = await supabaseAdmin
                .from("policy_answers")   // <--- �����ı�����ͬ���������
                .insert({
                    question: rawQuestion,
                    answer: finalReply,
                    sources: sourcesArray,
                    user_email: userEmail || null

                    // vector columns:
                    , question_embedding: questionEmbedding
                    , answer_embedding: answerEmbedding
                    , sources_embedding: sourcesEmbedding

                    // save answer and question embeddings
                    , sim_answer_sources: sim_answer_sources
                });

            if (dbErr) console.error("Supabase insert error:", dbErr);

        } catch (e) {
            console.error("Supabase insert exception:", e);
        }

        // -------------------------
        // Return to frontend
        // -------------------------
        return res.status(200).json({
            reply: finalReply,
            structured: out,
            sources: sourcesArray
        });

    } catch (err) {
        console.error("Agent error:", err);
        return res.status(500).json({
            error: "Agent error",
            detail: err.message || String(err)
        });
    }
}
