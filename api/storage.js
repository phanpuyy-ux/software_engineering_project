import { StorageApiHandler } from "../server/handlers/StorageApiHandler.js";

const handler = new StorageApiHandler();
export default function (req, res) {
    return handler.run(req, res);
}
