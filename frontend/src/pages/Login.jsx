import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        "https://backend.dhairyalalwani.workers.dev/login",
        { username, password }
      );

      const token = res.data.token;
      if (token) {
        localStorage.setItem("token", token);
        navigate("/chat");
      } else {
        setMessage("Invalid credentials");
      }
    } catch (err) {
      setMessage(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={styles.title}>ChatBot</h2>
        <p style={styles.subtitle}>Log in to continue chatting</p>

        <form onSubmit={handleLogin} style={styles.form}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            Login
          </button>
        </form>

        {message && <p style={styles.message}>{message}</p>}

        <p style={styles.footer}>
          Don’t have an account?{" "}
          <Link to="/register" style={styles.link}>
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    backgroundColor: "#1e1e1e",
    position: "fixed",       // ⬅️ add this
  top: 0,                  // ⬅️ add this
  left: 0,                 // ⬅️ add this
  width: "100vw",          // ensure full screen width
    fontFamily: "Inter, sans-serif",
    color: "white",
  },
  card: {
    backgroundColor: "#2a2a2a",
    padding: "40px 50px",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
    width: "320px",
    textAlign: "center",
  },
  title: {
    marginBottom: "8px",
    fontSize: "24px",
    fontWeight: "bold",
  },
  subtitle: {
    marginBottom: "20px",
    color: "#aaa",
    fontSize: "14px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  input: {
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #444",
    backgroundColor: "#121212",
    color: "white",
    fontSize: "14px",
    outline: "none",
  },
  button: {
    padding: "10px",
    borderRadius: "6px",
    backgroundColor: "#007bff",
    color: "white",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "background-color 0.3s ease",
  },
  message: {
    color: "tomato",
    marginTop: "10px",
    fontSize: "13px",
  },
  footer: {
    marginTop: "20px",
    fontSize: "13px",
    color: "#aaa",
  },
  link: {
    color: "#007bff",
    textDecoration: "none",
    fontWeight: "bold",
  },
};

export default Login;
