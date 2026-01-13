// server/core/BaseApiHandler.js

export class BaseApiHandler {
    constructor({ allowedMethods = ["GET", "POST"] } = {}) {
        this.allowedMethods = new Set(allowedMethods);
    }

    // child class should implement this
    async handle(req, res) {
        throw new Error("BaseApiHandler.handle() must be implemented");
    }

    // common method check
    requireMethod(req, res) {
        if (!this.allowedMethods.has(req.method)) {
            res.status(405).json({ error: "method_not_allowed" });
            return false;
        }
        return true;
    }

    // consistent JSON success
    ok(res, data = {}) {
        return res.status(200).json(data);
    }

    // consistent JSON error
    fail(res, status, error, detail) {
        const payload = { error };
        if (detail) payload.detail = detail;
        return res.status(status).json(payload);
    }

    // wrapper:ͳһ try/catch
    async run(req, res) {
        if (!this.requireMethod(req, res)) return;

        try {
            return await this.handle(req, res);
        } catch (err) {
            const status = err.status || 500;
            console.error("API error:", err);
            return this.fail(res, status, err.message || "server_error");
        }
    }
}
