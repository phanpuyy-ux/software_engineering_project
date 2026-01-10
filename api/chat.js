import { ChatApiHandler } from "../server/handlers/ChatApiHandler.js";

const handler = new ChatApiHandler();
export default function (req, res) {
    return handler.run(req, res);
}
import { ChatApiHandler } from "../server/handlers/ChatApiHandler.js";

const handler = new ChatApiHandler();
export default function (req, res) {
    return handler.run(req, res);
}
