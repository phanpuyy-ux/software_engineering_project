import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
    project: process.env.OPENAI_PROJECT_ID,
});

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        let { userText, history = [] } = req.body;

        // --- URL 解析部分（你原来的）
        if (userText.startsWith("http://") || userText.startsWith("https://")) {
            try {
                const readRes = await fetch(`${req.headers.host.startsWith("localhost") ? "http" : "https"}://${req.headers.host}/api/read`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: userText })
                });

                const json = await readRes.json();
                if (json.content) {
                    userText = `Please analyze the following webpage content:\n\n${json.content}`;
                }

            } catch (err) {
                console.error("URL fetch failed:", err);
            }
        }

        // --- 消息组装（开启记忆）
        const messages = [
            { role: "system", content: "You are a helpful assistant. Use the provided knowledge base first." },
            ...history,
            { role: "user", content: userText }
        ];


        // --- 启用 File Search（使用项目知识库）
        const VECTOR_STORE_ID = "vs_692231d5414c8191bc1dbb7b121ff065";

        const completion = await client.chat.completions.create({
            model: "gpt-4.1",
            messages,
            tools: [
                {
                    type: "file_search",
                    file_search: {
                        vector_store_ids: [VECTOR_STORE_ID]
                    }
                }
            ]
        });


        const reply = completion.choices?.[0]?.message?.content || "(empty reply)";
        return res.status(200).json({ reply });

    } catch (err) {
        console.error("OpenAI error:", err);
        return res.status(500).json({ error: "OpenAI error", detail: err.message });
    }
}
