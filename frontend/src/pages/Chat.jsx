import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { marked } from "marked";


function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [mcpMessage, setMcpMessage] = useState("");
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const API_BASE = "https://backend.dhairyalalwani.workers.dev";

  // 🔹 Composio Configs
  const COMPOSIO_WORKSPACE_ID = "pr_wrEqsNVqvCZA"; // replace with your actual workspace ID
  const COMPOSIO_AUTH_CONFIG_ID = "ac_FFJUOYasTHf4"; // from Gmail Auth Config
  const COMPOSIO_REDIRECT = `${API_BASE}/connect/composio/callback`;

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

  useEffect(() => {
    // only auto-scroll once, on initial load
    const chatBox = document.querySelector("#chat-box");
    if (chatBox && messages.length > 0) {
      chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: "smooth", // smooth scroll down
      });
    }
  }, [messages.length]); // runs once when messages first load


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

  // 🔹 Gmail Connect
  const handleConnectGmail = async () => {
    try {
      // open Gmail OAuth flow in a new tab
      window.open(
        "https://backend.dhairyalalwani.workers.dev/auth/login",
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      console.error("Failed to start Gmail OAuth:", err);
      alert("Couldn't start Gmail connection");
    }
  };




  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div style={styles.container}>
  <h2>Chatbot 🤖</h2>

  <div style={styles.mainContent}>
    {/* Left Sidebar */}
    <div style={styles.sidebar}>
      <div style={styles.mcpSection}>
        <h4>🔌 Connect MCP</h4>
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

      <div style={styles.mcpSection}>
        <h4>📧 Gmail</h4>
        <button onClick={handleConnectGmail} style={styles.button}>Connect Gmail</button>
      </div>

      <button onClick={handleLogout} style={styles.logout}>Logout</button>
    </div>

    {/* Chat Area */}
    <div style={styles.chatContainer}>
      <div id="chat-box" style={styles.chatBox}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              backgroundColor: msg.role === "user" ? "#007bff" : "#e5e5ea",
              color: msg.role === "user" ? "white" : "black",
            }}
            dangerouslySetInnerHTML={{
              __html: marked.parse(msg.content || ""),
            }}
          />
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
    </div>
  </div>
</div>

  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "0px 40px",
    alignItems: "center",
    minHeight: "100vh",          // full page height
    width: "100vw",              // full page width
    backgroundColor: "#1e1e1e",  // nice dark backdrop
    color: "white",
    //padding: "0px 20px",
    boxSizing: "border-box",
    overflowY: "auto",           // allows scrolling
  },
  chatBox: {
    display: "flex",
    flexDirection: "column",
    width: "90%",
    maxWidth: "1000px",
    height: "80vh",
    border: "1px solid #333",
    borderRadius: "8px",
    padding: "10px",
    overflowY: "auto",
    marginBottom: "20px",
    backgroundColor: "#2a2a2a",  // matches dark theme
  },
  message: {
    margin: "6px 0",
    padding: "1px 10px",
    borderRadius: "16px",
    maxWidth: "80%",
    wordWrap: "break-word",
  },
  form: {
    display: "flex",
    gap: "8px",
    width: "100%",
    maxWidth: "600px",
    marginBottom: "30px",
  },
  input: {
    flex: 1,
    padding: "10px",
    borderRadius: "5px",
    border: "1px solid #555",
    backgroundColor: "#121212",
    color: "white",
  },
  button: {
    padding: "10px 16px",
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
    padding: "10px 16px",
    borderRadius: "5px",
    cursor: "pointer",
  },
  mainContent: {
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: "20px",
  width: "100%",
  maxWidth: "1200px",
  marginLeft: "100px",
},

sidebar: {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  width: "250px",
  backgroundColor: "#2a2a2a",
  padding: "1px",
  borderRadius: "8px",
  height: "80vh",
  overflowY: "auto",
},

chatContainer: {
  display: "flex",
  flexDirection: "column",
  flex: 1,
  alignItems: "center",
},

};


export default Chat;
