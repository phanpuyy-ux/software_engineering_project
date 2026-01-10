// server/handlers/StorageApiHandler.js
import { BaseApiHandler } from "../core/BaseApiHandler.js";
import { KVStore } from "../repositories/KVStore.js";

const VALID_KEYS = ["ft_users", "ft_chats", "ft_messages"];

export class StorageApiHandler extends BaseApiHandler {
    constructor() {
        super({ allowedMethods: ["GET", "POST"] });
        this.store = new KVStore({
            validKeys: VALID_KEYS,
            serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT
        });
    }

    async handle(req, res) {
        if (req.method === "GET") {
            const { key } = req.query;
            const value = await this.store.get(key);
            return this.ok(res, { key, value: value ?? null });
        }

        // POST
        const { key, value } = req.body || {};
        await this.store.set(key, value);
        return this.ok(res, { ok: true });
    }
}
