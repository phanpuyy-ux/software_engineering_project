export default async function handler(req, res) {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: "Missing url" });

        const html = await fetch(url).then(r => r.text());

        res.status(200).json({ content: html });
    } catch (err) {
        res.status(500).json({ error: "Fetch failed", detail: err.toString() });
    }
}
