// api/chat.js
import { OpenAIChatEngine } from "../server/chat/OpenAIChatEngine.js";
import { MockChatEngine } from "../server/chat/MockChatEngine.js";

function createEngine() {
    if (process.env.USE_MOCK_CHAT === "true") {
        return new MockChatEngine();
    }
    return new OpenAIChatEngine();
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const engine = createEngine();
        const result = await engine.reply(req.body);
        return res.status(200).json(result);
    } catch (err) {
        console.error("chat error:", err);
        return res.status(500).json({ error: "Backend error" });
    }
}
