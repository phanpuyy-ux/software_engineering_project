// server/chat/MockChatEngine.js
import { ChatEngine } from "./ChatEngine.js";

export class MockChatEngine extends ChatEngine {
    async reply({ userText }) {
        return {
            reply: `Mock reply (no LLM): ${userText.toUpperCase()}`,
            structured: null,
            sources: []
        };
    }
}
