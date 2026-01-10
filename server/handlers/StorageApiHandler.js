import { BaseApiHandler } from "../core/BaseApiHandler.js";
import { KVStore } from "../repositories/KVStore.js";

const VALID_KEYS = ["ft_users", "ft_chats", "ft_messages"];

export class StorageApiHandler extends BaseApiHandler {
    constructor() {
        super({ allowedMethods: ["GET", "POST"] });
    }

    #makeStore() {
        return new KVStore({
            validKeys: VALID_KEYS,
            serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT
        });
    }

    async handle(req, res) {
        const store = this.#makeStore();

        if (req.method === "GET") {
            const { key } = req.query;
            const value = await store.get(key);
            return this.ok(res, { key, value: value ?? null });
        }

        const { key, value } = req.body || {};
        await store.set(key, value);
        return this.ok(res, { ok: true });
    }
}
