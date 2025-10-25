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
    <div style={styles.container}>
      <h2>Login</h2>
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
        <button type="submit" style={styles.button}>Login</button>
      </form>
      {message && <p>{message}</p>}
      <p>
        Don’t have an account?{" "}
        <Link to="/register" style={{ color: "#007bff" }}>Register</Link>
      </p>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    fontFamily: "Arial",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    width: "250px",
    gap: "10px",
  },
  input: {
    padding: "8px",
    borderRadius: "5px",
    border: "1px solid #ccc",
  },
  button: {
    padding: "8px",
    borderRadius: "5px",
    backgroundColor: "#28a745",
    color: "white",
    border: "none",
    cursor: "pointer",
  },
};

export default Login;
