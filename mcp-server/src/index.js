export default {
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;

    // 🌐 Basic CORS setup
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    // 🧠 Core invoke logic
    if (url.pathname === "/invoke" && method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
      }

      const { query } = body || {};
      if (!query) {
        return new Response(JSON.stringify({ error: "Missing query" }), { status: 400, headers });
      }

      const lower = query.toLowerCase();
      let tool = "";
      let output = "";

      // ☀️ Weather
      if (lower.includes("weather")) {
        tool = "weather";
        output = "It’s sunny and 72°F ☀️";
      }

      // 🕒 Time
      else if (lower.includes("time")) {
        tool = "clock";
        output = `The time is ${new Date().toLocaleTimeString()}`;
      }

      // ➗ Math
      else if (query.match(/(\d+ *[+\-*/] *\d+)/)) {
        try {
          const expr = query.match(/(\d+ *[+\-*/] *\d+)/)[0];
          const safeExpr = expr.replace(/[^0-9+\-*/(). ]/g, "");
          output = `Answer: ${eval(safeExpr)}`;
          tool = "calculator";
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid math expression" }),
            { status: 400, headers }
          );
        }
      }

      // ❌ Unknown query → tell backend to fall back to Groq
      else {
        return new Response(
          JSON.stringify({ error: "No matching tool — fallback to Groq" }),
          { status: 400, headers }
        );
      }

      // ✅ Valid tool response
      return new Response(JSON.stringify({ tool, output }), { status: 200, headers });
    }

    // Default root route
    return new Response("MCP Worker running ✅", { status: 200, headers });
  },
};
