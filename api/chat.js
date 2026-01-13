// api/chat.js
import { ChatApiHandler } from "../server/handlers/ChatApiHandler.js";
export default function (req, res) {
    const handler = new ChatApiHandler();
    return handler.run(req, res);
}
