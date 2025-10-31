import { useEffect } from "react";

export default function GmailCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const token = localStorage.getItem("token"); // matches Login.jsx

    // ✅ Run once
    if (code && token) {
      fetch(`https://backend.dhairyalalwani.workers.dev/auth/callback?code=${code}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("✅ Gmail connection result:", data);
        })
        .catch((err) => {
          console.error("⚠️ Gmail connection error:", err);
        });
    } else {
      console.warn("Missing authorization code or token");
    }
  }, []);

  return (
    <div
      style={{
        color: "white",
        textAlign: "center",
        fontFamily: "monospace",
        paddingTop: "40vh",
      }}
    >
      Gmail connection complete. You may close this tab.
    </div>
  );
}
