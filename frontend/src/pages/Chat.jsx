import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [mcpMessage, setMcpMessage] = useState("");
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const API_BASE = "https://backend.dhairyalalwani.workers.dev";

  useEffect(() => {
    if (!token) navigate("/");
  }, [token, navigate]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_BASE}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(res.data.messages || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchMessages();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const res = await axios.post(
        `${API_BASE}/chat`,
        { message: input },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const botMessage = { role: "bot", content: res.data.reply };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConnectMCP = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${API_BASE}/connect-mcp`,
        { server_url: serverUrl, api_key: apiKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMcpMessage(res.data.message || "MCP connected!");
    } catch (err) {
      setMcpMessage(err.response?.data?.error || "Error connecting MCP");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div style={styles.container}>
      <h2>Chatbot 🤖</h2>
      <div style={styles.chatBox}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              backgroundColor:
                msg.role === "user" ? "#007bff" : "#e5e5ea",
              color: msg.role === "user" ? "white" : "black",
            }}
          >
            {msg.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} style={styles.form}>
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Send</button>
      </form>

      <div style={styles.mcpSection}>
        <h4>🔌 Connect MCP Server</h4>
        <form onSubmit={handleConnectMCP} style={styles.mcpForm}>
          <input
            type="text"
            placeholder="Server URL"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            style={styles.input}
          />
          <input
            type="text"
            placeholder="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>Connect</button>
        </form>
        {mcpMessage && <p>{mcpMessage}</p>}
      </div>

      <button onClick={handleLogout} style={styles.logout}>Logout</button>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    fontFamily: "Arial",
  },
  chatBox: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: "500px",
    height: "400px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    padding: "10px",
    overflowY: "auto",
    marginBottom: "15px",
    backgroundColor: "#f9f9f9",
  },
  message: {
    margin: "4px 0",
    padding: "8px 12px",
    borderRadius: "16px",
    maxWidth: "80%",
    wordWrap: "break-word",
  },
  form: {
    display: "flex",
    gap: "8px",
    width: "100%",
    maxWidth: "500px",
  },
  input: {
    flex: 1,
    padding: "8px",
    borderRadius: "5px",
    border: "1px solid #ccc",
  },
  button: {
    padding: "8px 12px",
    borderRadius: "5px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    cursor: "pointer",
  },
  mcpSection: {
    marginTop: "30px",
    textAlign: "center",
  },
  mcpForm: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    alignItems: "center",
  },
  logout: {
    marginTop: "20px",
    backgroundColor: "red",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: "5px",
    cursor: "pointer",
  },
};

export default Chat;
