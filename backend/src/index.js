import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    // 🛡️ CORS setup
    const allowedOrigin = request.headers.get("Origin");
    const CORS_ORIGIN =
      allowedOrigin === "https://cloudflare-chatbot-six.vercel.app" ||
      allowedOrigin?.includes("localhost")
        ? allowedOrigin
        : "https://cloudflare-chatbot-six.vercel.app";

    const send = (status, body) =>
      new Response(JSON.stringify(body), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": CORS_ORIGIN,
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": CORS_ORIGIN,
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
    }

    // 🔐 JWT verification helper
    const verifyAuth = (req) => {
      const auth = req.headers.get("Authorization");
      if (!auth) return null;
      const token = auth.split(" ")[1];
      try {
        return jwt.verify(token, env.JWT_SECRET);
      } catch {
        return null;
      }
    };

    // 🧪 Debug Route — test Groq connectivity
    if (url.pathname === "/test-groq" && method === "GET") {
      try {
        const llmRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [{ role: "user", content: "Hello from test-groq!" }],
          }),
        });

        const data = await llmRes.json();
        return send(200, { message: "Groq connection successful ✅", data });
      } catch (err) {
        return send(500, { error: "Failed to reach Groq", details: err.message });
      }
    }

    // 👤 Register user
    if (url.pathname === "/register" && method === "POST") {
      const { username, password } = await request.json();
      if (!username || !password) return send(400, { error: "Missing fields" });

      const hash = await bcrypt.hash(password, 10);
      const { error } = await supabase.from("users").insert({ username, password_hash: hash });
      if (error) return send(400, { error: error.message });
      return send(200, { message: "User registered successfully" });
    }

    // 🔑 Login
    if (url.pathname === "/login" && method === "POST") {
      const { username, password } = await request.json();
      if (!username || !password) return send(400, { error: "Missing fields" });

      const { data: users, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", username)
        .limit(1);

      if (error || !users?.length) return send(401, { error: "Invalid username or password" });

      const valid = await bcrypt.compare(password, users[0].password_hash);
      if (!valid) return send(401, { error: "Invalid username or password" });

      const token = jwt.sign({ user_id: users[0].id }, env.JWT_SECRET, { expiresIn: "1d" });
      return send(200, { token });
    }

    // 💬 Chat endpoint
    if (url.pathname === "/chat" && method === "POST") {
      const auth = verifyAuth(request);
      if (!auth) return send(401, { error: "Unauthorized" });

      const { message } = await request.json();
      if (!message) return send(400, { error: "Missing message" });

      await supabase.from("messages").insert({
        user_id: auth.user_id,
        role: "user",
        content: message,
      });

      let reply = "";
      let usedMCP = false;

      // 🔌 Try MCP (internal binding first, fallback to public URL)
      const { data: connections } = await supabase
        .from("mcp_connections")
        .select("*")
        .eq("user_id", auth.user_id)
        .limit(1);

      if (connections?.length) {
        const { server_url, api_key } = connections[0];
        const mcpPayload = { query: message };

        try {
          let mcpRes;
          if (env.MCP_SERVICE) {
            // ✅ internal service binding call (preferred)
            mcpRes = await env.MCP_SERVICE.fetch("https://internal/invoke", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${api_key}`,
              },
              body: JSON.stringify(mcpPayload),
            });
          } else {
            // 🌐 fallback to HTTPS
            mcpRes = await fetch(`${server_url}/invoke`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${api_key}`,
              },
              body: JSON.stringify(mcpPayload),
            });
          }

          if (mcpRes.ok) {
            const mcpData = await mcpRes.json();
            reply = `🔧 MCP (${mcpData.tool}) says: ${mcpData.output}`;
            usedMCP = true;
          } else {
            console.error("MCP request failed:", await mcpRes.text());
          }
        } catch (err) {
          console.error("MCP failed:", err);
        }
      }

      // 🧠 Fallback to Groq LLM
      if (!usedMCP) {
        try {
          const llmRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: "llama-3.1-8b-instant",
              messages: [{ role: "user", content: message }],
            }),
          });

          const data = await llmRes.json();
          reply = data?.choices?.[0]?.message?.content || "🤖 No response from LLM.";
        } catch (err) {
          reply = "⚠️ Error connecting to LLM.";
        }
      }

      await supabase.from("messages").insert({
        user_id: auth.user_id,
        role: "bot",
        content: reply,
      });

      return send(200, { reply });
    }

    // 📜 Fetch messages
    if (url.pathname === "/messages" && method === "GET") {
      const auth = verifyAuth(request);
      if (!auth) return send(401, { error: "Unauthorized" });

      const { data, error } = await supabase
        .from("messages")
        .select("role, content, created_at")
        .eq("user_id", auth.user_id)
        .order("created_at", { ascending: true });

      if (error) return send(400, { error: error.message });
      return send(200, { messages: data });
    }

    // 🌐 Connect MCP
    if (url.pathname === "/connect-mcp" && method === "POST") {
      const auth = verifyAuth(request);
      if (!auth) return send(401, { error: "Unauthorized" });

      const { server_url, api_key } = await request.json();
      if (!server_url || !api_key) return send(400, { error: "Missing fields" });

      const { error } = await supabase
        .from("mcp_connections")
        .insert({ user_id: auth.user_id, server_url, api_key });

      if (error) return send(400, { error: error.message });
      return send(200, { message: "MCP connected successfully" });
    }

    // ❌ Default 404
    return send(404, { error: "Route not found" });
  },
};
