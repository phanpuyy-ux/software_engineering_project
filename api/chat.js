import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
    project: process.env.OPENAI_PROJECT_ID,
});

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        let { userText } = req.body;

        // 如果用户输入一个 URL，就从 /api/read 抓取网页内容
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

        const completion = await client.chat.completions.create({
            model: "gpt-4.1",
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: "user", content: userText },
            ],
        });

        const reply = completion.choices?.[0]?.message?.content || "(empty reply)";
        res.status(200).json({ reply });

    } catch (err) {
        console.error("OpenAI error:", err);
        res.status(500).json({ error: "OpenAI error", detail: err.message || String(err) });
    }
}
