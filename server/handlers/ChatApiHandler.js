// server/handlers/ChatApiHandler.js
import { BaseApiHandler } from "../core/BaseApiHandler.js";
import { OpenAIChatEngine } from "../chat/OpenAIChatEngine.js";
import { MockChatEngine } from "../chat/MockChatEngine.js";

function createEngine() {
    if (process.env.USE_MOCK_CHAT === "true") return new MockChatEngine();
    return new OpenAIChatEngine();
}

export class ChatApiHandler extends BaseApiHandler {
    constructor() {
        super({ allowedMethods: ["POST"] });
        this.engine = createEngine();
    }

    async handle(req, res) {
        const { userText } = req.body || {};
        if (!userText || typeof userText !== "string") {
            return this.fail(res, 400, "userText is required");
        }

        const result = await this.engine.reply(req.body);
        return this.ok(res, result);
    }
}
