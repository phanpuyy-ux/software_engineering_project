// api/storage.js
import { StorageApiHandler } from "../server/handlers/StorageApiHandler.js";
export default function (req, res) {
    const handler = new StorageApiHandler();
    return handler.run(req, res);
}
