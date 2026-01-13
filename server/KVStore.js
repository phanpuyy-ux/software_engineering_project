// server/repositories/KVStore.js
import admin from "firebase-admin";

/**
 * Encapsulation:
 * - Firestore init + read/write details are hidden inside this class
 * - Outside only calls get/set
 */
export class KVStore {
    #db;           // private state (Firestore instance)
    #validKeys;    // private state (allowed keys)

    constructor({ validKeys, serviceAccountJson }) {
        this.#validKeys = new Set(validKeys);

        if (!admin.apps.length) {
            if (!serviceAccountJson) {
                throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
            }

            let creds;
            try {
                creds = JSON.parse(serviceAccountJson);
            } catch {
                throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
            }

            admin.initializeApp({ credential: admin.credential.cert(creds) });
        }

        this.#db = admin.firestore();
    }

    #assertKey(key) {
        if (!this.#validKeys.has(key)) {
            const err = new Error("invalid_key");
            err.status = 400;
            throw err;
        }
    }

    async get(key) {
        this.#assertKey(key);
        const snap = await this.#db.collection("kv").doc(key).get();
        if (!snap.exists) return null;
        const data = snap.data() || {};
        return Object.prototype.hasOwnProperty.call(data, "value") ? data.value : null;
    }

    async set(key, value) {
        this.#assertKey(key);
        await this.#db.collection("kv").doc(key).set({ value }, { merge: false });
    }
}
