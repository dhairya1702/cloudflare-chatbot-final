import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Composio  from "composio-core";


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    //const composio = new Composio({ apiKey: env.COMPOSIO_API_KEY });

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

    if (method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": CORS_ORIGIN,
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });

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

    // 🧪 Test Groq
    if (url.pathname === "/test-groq" && method === "GET") {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: "Hello from test-groq!" }],
          }),
        });
        const data = await res.json();
        return send(200, { message: "Groq connection successful ✅", data });
      } catch (err) {
        return send(500, { error: "Groq test failed", details: err.message });
      }
    }

    // 👤 Register
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

    // 💬 Chat with gmail and mcps
	// 💬 Chat (enhanced with detailed logging)
	if (url.pathname === "/chat" && method === "POST") {
	  const auth = verifyAuth(request);
	  if (!auth) return send(401, { error: "Unauthorized" });

	  const { message } = await request.json();
	  if (!message) return send(400, { error: "Missing message" });

	  console.log("📩 [CHAT] Incoming message:", message);

	  // Save user message
	  await supabase.from("messages").insert({
		user_id: auth.user_id,
		role: "user",
		content: message,
	  });

	  // Load short history for context
	  const { data: history } = await supabase
		.from("messages")
		.select("role, content")
		.eq("user_id", auth.user_id)
		.order("created_at", { ascending: true })
		.limit(6);

	  console.log("📚 [CHAT] Loaded", history?.length || 0, "messages of history");

	  let reply = "";
	  let usedMCP = false;

	  // Fetch user's connected MCPs
	  let { data: mcps } = await supabase
		.from("mcp_connections")
		.select("id, server_url, api_key, name_hint")
		.eq("user_id", auth.user_id);
	  // Always push Gmail + Exa by default
		mcps = mcps || [];
		mcps.push(
		  {
			id: "internal-gmail",
			server_url: "internal://gmail",
			api_key: null,
			name_hint: "gmail",
		  },
		  {
			id: "internal-exa",
			server_url: "https://api.exa.ai",
			api_key: env.EXA_API_KEY,
			name_hint: "exa",
		  }
		);

	  console.log("🔌 [MCP] Found", mcps?.length || 0, "connected MCPs");

	  if (mcps?.length) {
		const routerPrompt = [
		  {
			role: "system",
			content: `
			You are a strict router. Choose which MCP server(s) should handle the user's query.

			RULES:
			- Reply ONLY with tool names from the list below, comma-separated if more than one applies.
			- If the message mentions Gmail, email, or inbox -> choose "gmail".
			- If the message asks to search the web -> choose "exa".
			- Otherwise reply "none".
			- Do not explain or add text.

			Available tools:
			${mcps.map(m => "- " + (m.name_hint || new URL(m.server_url).hostname)).join("\n")}
			`
		  },
		  ...((history || []).slice(-2).map(m => ({
			role: m.role === "bot" ? "assistant" : "user",
			content: m.content
		  }))),
		  { role: "user", content: message }
		];

		try {
		  console.log("🧭 [ROUTER] Sending router prompt to Groq...");
		  const routeRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
			method: "POST",
			headers: {
			  "Content-Type": "application/json",
			  Authorization: `Bearer ${env.GROQ_API_KEY}`,
			},
			body: JSON.stringify({
			  model: "llama-3.1-8b-instant",
			  messages: routerPrompt,
			}),
		  });

		  const routeData = await routeRes.json();
		  const rawChoice = routeData?.choices?.[0]?.message?.content?.trim()?.toLowerCase() || "";
		  const choices = rawChoice.split(",").map(c => c.trim()).filter(Boolean);

		  console.log("📥 [ROUTER] Raw router output:", rawChoice);
		  console.log("🧭 [ROUTER] Parsed MCP choices:", choices);

		  const selectedMCPs = mcps.filter(m =>
			choices.some(c =>
			  (m.name_hint || new URL(m.server_url).hostname)
				.toLowerCase()
				.includes(c)
			)
		  );
		  console.log("🔍 [MCP] Matched MCPs:", selectedMCPs.map(m => m.name_hint));

		  // 🧠 Handle Gmail internally if router picked it
		  if (choices.includes("gmail")) {
			usedMCP = true;
			console.log("📬 [GMAIL] Router selected Gmail MCP. Fetching emails...");
			try {
			  const { data: tokenData } = await supabase
				.from("gmail_tokens")
				.select("*")
				.eq("user_id", auth.user_id)
				.single();

			  if (!tokenData) {
				console.log("⚠️ [GMAIL] No Gmail token found for user:", auth.user_id);
				reply = "⚠️ Gmail not connected yet. Please connect your Gmail account first.";
			  } else {
				console.log("🔑 [GMAIL] Found token for:", tokenData.email);
				const res = await fetch(
				  "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5",
				  {
					headers: { Authorization: `Bearer ${tokenData.access_token}` },
				  }
				);
				const msgList = await res.json();
				console.log("📥 [GMAIL] Messages list response:", msgList);

				if (!msgList.messages) {
				  reply = "📭 No recent emails found.";
				} else {
				  let snippets = [];
				  for (const msg of msgList.messages) {
					const mRes = await fetch(
					  `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
					  { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
					);
					const m = await mRes.json();
					snippets.push(m.snippet);
				  }
				  console.log("📨 [GMAIL] Retrieved", snippets.length, "emails");
					// 🧠 Analyze the fetched Gmail snippets with Groq + user's question
					console.log("💬 [GMAIL] Sending user query with snippets to Groq:", message);

					try {
					  const llmRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
						method: "POST",
						headers: {
						  "Content-Type": "application/json",
						  Authorization: `Bearer ${env.GROQ_API_KEY}`,
						},
						body: JSON.stringify({
						  model: "llama-3.1-8b-instant",
						  messages: [
							{
							  role: "system",
							  content:
								"You are a helpful personal assistant with access to the user's recent Gmail messages. " +
								"Use these emails as context to answer their question. " +
								"If they ask about urgency, importance, sender, category, or any other attribute, infer it from the snippets. " +
								"If they ask something else, still respond based on the provided emails.",
							},
							{
							  role: "user",
							  content: `Recent emails:\n\n${snippets.join("\n\n")}`,
							},
							{ role: "user", content: message },
						  ],
						}),
					  });

					  const llmData = await llmRes.json();
					  console.log("📬 [GMAIL] LLM raw response:", llmData);

					  reply =
						llmData?.choices?.[0]?.message?.content ||
						"Couldn't analyze the emails or generate a meaningful response.";
					  console.log("🤖 [GMAIL] LLM processed reply:", reply);
					} catch (err) {
					  console.error("❌ [GMAIL] LLM analysis error:", err);
					  reply =
						"⚠️ Couldn't analyze your Gmail messages right now. Please try again later.";
					}
				}
			  }
			} catch (err) {
			  console.error("❌ [GMAIL] Error fetching emails:", err);
			  reply = "⚠️ Failed to fetch Gmail messages.";
			}
		  }
			// 🌐 Handle Exa web search
			else if (choices.includes("exa")) {
			  usedMCP = true;
			  console.log("🔎 [EXA] Router selected Exa MCP. Running Exa search...");

			  try {
				const EXA_API_KEY = env.EXA_API_KEY;

				const exaRes = await fetch("https://api.exa.ai/search", {
				  method: "POST",
				  headers: {
					"Content-Type": "application/json",
					"x-api-key": EXA_API_KEY,
				  },
				  body: JSON.stringify({
					query: message,
					numResults: 5,
					type: "keyword"
				  }),
				});

				const data = await exaRes.json();
				console.log("📦 [EXA] Raw search results:", data);

				if (!data?.results?.length) {
				  reply = "⚠️ No relevant results found via Exa.";
				} else {
				  const resultsText = data.results
					.map(
					  (r, i) =>
						`${i + 1}. ${r.title}\n${r.url}${
						  r.publishedDate ? ` (${r.publishedDate.split("T")[0]})` : ""
						}`
					)
					.join("\n\n");

				  // Pass results + user’s original query to Groq for natural response
				  const llmRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
					method: "POST",
					headers: {
					  "Content-Type": "application/json",
					  Authorization: `Bearer ${env.GROQ_API_KEY}`,
					},
					body: JSON.stringify({
					  model: "llama-3.1-8b-instant",
					  messages: [
						{
						  role: "system",
						  content:
							"You are a helpful assistant with access to search results. Answer the user's query using the below results. Include links when relevant.",
						},
						{
						  role: "user",
						  content: `These are the search results:\n${resultsText}, Now, answer the user's question using the above information:\\n"${message}"`,
						},
					  ],
					}),
				  });

				  const llmData = await llmRes.json();
				  reply =
					llmData?.choices?.[0]?.message?.content ||
					"⚠️ Couldn't generate a summary from Exa results.";

				  console.log("🤖 [EXA] LLM processed reply:", reply);
				}
			  } catch (err) {
				console.error("❌ [EXA] Error calling Exa:", err);
				reply = "⚠️ Failed to fetch from Exa.";
			  }
			}


		  // 🧠 Handle other selected MCPs (like Exa)
		  else if (selectedMCPs.length) {
			usedMCP = true;
			console.log("🌐 [MCP] Calling selected external MCP(s):", selectedMCPs.map(m => m.server_url));
			let outputs = [];
			for (const selected of selectedMCPs) {
			  try {
				console.log(`📤 [MCP:${selected.name_hint}] Sending message ->`, message);
				const res = await fetch(`${selected.server_url}`, {
				  method: "POST",
				  headers: {
					"Content-Type": "application/json",
					"Accept": "application/json, text/event-stream",
					Authorization: `Bearer ${selected.api_key}`,
				  },
				  body: JSON.stringify({ query: message }),
				});

				const json = await res.json();
				console.log(`📥 [MCP:${selected.name_hint}] Response:`, json);

				outputs.push({
				  name: selected.name_hint,
				  output: json.output || json.reply || json.message || JSON.stringify(json),
				});

				await supabase
				  .from("mcp_connections")
				  .update({ last_used: new Date().toISOString() })
				  .eq("id", selected.id);
			  } catch (err) {
				console.error(`❌ [MCP:${selected.name_hint}] Call failed:`, err);
			  }
			}

			reply =
			  outputs.length > 1
				? outputs.map(o => `🧩 ${o.name}:\n${o.output}`).join("\n\n")
				: outputs[0]?.output || "⚠️ No response from MCP.";

			console.log("📦 [MCP] Final combined MCP reply:", reply);
		  }

		} catch (err) {
		  console.error("❌ [ROUTER] Failed to route:", err);
		}
	  }

	  // 🧠 Fallback to Groq if no MCP used
	  if (!usedMCP) {
		console.log("🌀 [FALLBACK] No MCP used — using Groq chat");
		try {
		  const messages = [
			{
			  role: "system",
			  content:
				"You are a helpful, context-aware assistant. Continue conversations naturally using recent exchanges.",
			},
			...(history?.map((m) =>
			  m.role === "bot"
				? { role: "assistant", content: m.content }
				: { role: "user", content: m.content }
			) || []),
			{ role: "user", content: message },
		  ];

		  console.log("📤 [FALLBACK] Sending Groq chat request...");
		  const llmRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
			method: "POST",
			headers: {
			  "Content-Type": "application/json",
			  Authorization: `Bearer ${env.GROQ_API_KEY}`,
			},
			body: JSON.stringify({
			  model: "llama-3.1-8b-instant",
			  messages,
			}),
		  });
		  const data = await llmRes.json();
		  console.log("📥 [FALLBACK] Groq response:", data);

		  reply = data?.choices?.[0]?.message?.content || "🤖 No response from LLM.";
		} catch (err) {
		  console.error("❌ [FALLBACK] Groq fallback error:", err);
		  reply = "⚠️ Error connecting to LLM.";
		}
	  }

	  // Save bot reply
	  await supabase.from("messages").insert({
		user_id: auth.user_id,
		role: "bot",
		content: reply,
	  });

	  console.log("✅ [CHAT] Final reply:", reply);

	  return send(200, { reply });
	}

    // 🌐 Connect MCP
    if (url.pathname === "/connect-mcp" && method === "POST") {
      const auth = verifyAuth(request);
      if (!auth) return send(401, { error: "Unauthorized" });

      const { server_url, api_key } = await request.json();
      if (!server_url || !api_key) return send(400, { error: "Missing fields" });

      const hostname = new URL(server_url).hostname;
      const base = hostname.split(".")[0];
      const name_hint =
        base?.replace(/[^a-z0-9]/gi, "")?.toLowerCase() || "tool";

      const { error } = await supabase.from("mcp_connections").insert({
        user_id: auth.user_id,
        server_url,
        api_key,
        name_hint,
        last_used: new Date().toISOString(),
      });

      if (error) return send(400, { error: error.message });
      return send(200, { message: `MCP '${name_hint}' connected successfully` });
    }

    // 📜 Messages
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


	// 🌐 Gmail OAuth: Step 2 — redirect user to Google
    if (url.pathname === "/auth/login") {
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,

		redirect_uri: "https://cloudflare-chatbot-six.vercel.app/auth/callback",
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/userinfo.email",
        ].join(" "),
      });

      return Response.redirect(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        302
      );
    }

	// auth gmail
	if (url.pathname === "/auth/callback" && method === "POST") {
	  const code = url.searchParams.get("code");
	  if (!code) return send(400, { error: "Missing authorization code" });

	  const auth = verifyAuth(request);
	  if (!auth) return send(401, { error: "Unauthorized — missing or invalid JWT" });

	  try {
		// 1️⃣ Exchange code for tokens
		const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		  method: "POST",
		  headers: { "Content-Type": "application/x-www-form-urlencoded" },
		  body: new URLSearchParams({
			code,
			client_id: env.GOOGLE_CLIENT_ID,
			client_secret: env.GOOGLE_CLIENT_SECRET,
			redirect_uri: "https://cloudflare-chatbot-six.vercel.app/auth/callback", // 👈 for local testing
			grant_type: "authorization_code",
		  }),
		});

		const tokens = await tokenRes.json();
		if (!tokens.access_token)
		  return send(400, { error: "Failed to get access token", details: tokens });

		// 2️⃣ Get user's Gmail address
		const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
		  headers: { Authorization: `Bearer ${tokens.access_token}` },
		});
		const user = await userRes.json();

		console.log("auth.user_id type:", typeof auth.user_id, "value:", auth.user_id);

		// 3️⃣ Save Gmail token tied to this authenticated chatbot user
		const { data, error } = await supabase
		  .from("gmail_tokens")
		  .upsert({
			user_id: auth.user_id,
			email: user.email,
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expires_at: Date.now() + tokens.expires_in * 1000,
		  })
		  .select();

		console.log("🧩 Supabase upsert result:", { data, error });
		console.log("✅ Gmail connected for", user.email, "auth:", auth.user_id);

		if (error) return send(400, { error: error.message });

		return send(200, { message: `✅ Gmail connected for ${user.email}` });
	  } catch (err) {
		return send(500, { error: "OAuth callback failed", details: err.message });
	  }
	}



	// 📬 Gmail: Read last 5 emails
	if (url.pathname === "/gmail/read" && method === "GET") {
	  const email = url.searchParams.get("email");
	  if (!email) return send(400, { error: "Missing ?email parameter" });

	  const { data, error } = await supabase
		.from("gmail_tokens")
		.select("*")
		.eq("email", email)
		.single();

	  if (error || !data) return send(404, { error: "No Gmail token found for this user" });

	  try {
		const res = await fetch(
		  "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5",
		  {
			headers: { Authorization: `Bearer ${data.access_token}` },
		  }
		);

		const msgList = await res.json();
		if (!msgList.messages) return send(200, { emails: [] });

		let emails = [];
		for (const msg of msgList.messages) {
		  const mRes = await fetch(
			`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
			{ headers: { Authorization: `Bearer ${data.access_token}` } }
		  );
		  const m = await mRes.json();
		  emails.push({
			id: msg.id,
			snippet: m.snippet,
		  });
		}

		return send(200, { emails });
	  } catch (err) {
		return send(500, { error: "Failed to read emails", details: err.message });
	  }
	}


    return send(404, { error: "Route not found" });
  },
};


