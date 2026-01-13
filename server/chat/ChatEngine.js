// server/chat/ChatEngine.js

/**
 * Abstraction:
 * Defines WHAT a chat engine should do,
 * without specifying HOW it does it.
 */
export class ChatEngine {
    /**
     * @param {Object} params
     * @param {string} params.userText
     * @param {Array}  params.history
     * @param {string|null} params.userEmail
     */
    async reply(params) {
        throw new Error("ChatEngine.reply() must be implemented");
    }
}
