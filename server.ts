import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import net from "net";
import { Client } from "ssh2";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Real Payload Injection Test (Raw TCP)
  app.post("/api/test-payload", (req, res) => {
    const { host, port, payload, method } = req.body;

    if (!host || !port || !payload) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const formattedPayload = payload
      .replace(/\[crlf\]/g, "\r\n")
      .replace(/\[lf\]/g, "\n")
      .replace(/\[cr\]/g, "\r")
      .replace(/\[host\]/g, host)
      .replace(/\[port\]/g, port.toString())
      .replace(/\[method\]/g, method || "CONNECT")
      .replace(/\[ua\]/g, "Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/110.0 Firefox/110.0")
      .replace(/\[random\]/g, Math.floor(Math.random() * 9000 + 1000).toString())
      .replace(/\[split\]/g, "\r\n\r\n");

    const client = new net.Socket();
    let responseData = "";

    client.setTimeout(5000);

    client.connect(port, host, () => {
      client.write(formattedPayload);
    });

    client.on("data", (data) => {
      responseData += data.toString();
      // Close after first chunk for simple test
      client.destroy();
    });

    client.on("timeout", () => {
      client.destroy();
      res.status(408).json({ error: "Connection timed out" });
    });

    client.on("error", (err) => {
      res.status(500).json({ error: err.message });
    });

    client.on("close", () => {
      if (!res.headersSent) {
        res.json({ response: responseData });
      }
    });
  });

  // API: Real SSH Connection Test
  app.post("/api/test-ssh", (req, res) => {
    const { host, port, user, pass } = req.body;

    if (!host || !port || !user || !pass) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const conn = new Client();
    conn.on("ready", () => {
      conn.end();
      res.json({ success: true, message: "SSH Handshake successful!" });
    })
    .on("error", (err) => {
      res.status(500).json({ success: false, error: err.message });
    })
    .connect({
      host,
      port: parseInt(port),
      username: user,
      password: pass,
      readyTimeout: 10000
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
