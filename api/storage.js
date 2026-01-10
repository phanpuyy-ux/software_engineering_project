// api/storage.js
import { KVStore } from "../server/repositories/KVStore.js";

const VALID_KEYS = ["ft_users", "ft_chats", "ft_messages"];

function makeStore() {
    return new KVStore({
        validKeys: VALID_KEYS,
        serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT
    });
}

export default async function handler(req, res) {
    try {
        const store = makeStore();

        if (req.method === "GET") {
            const { key } = req.query;
            const value = await store.get(key);
            return res.status(200).json({ key, value: value ?? null });
        }

        if (req.method === "POST") {
            const { key, value } = req.body || {};
            await store.set(key, value);
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: "method_not_allowed" });
    } catch (err) {
        const status = err.status || 500;
        console.error("/api/storage error", err);
        return res.status(status).json({ error: err.message || "server_error" });
    }
}
