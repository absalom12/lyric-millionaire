import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import { useNavigate } from "react-router-dom";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/admin");
    } catch {
      setError("Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 flex flex-col gap-4">
        <h1 className="text-white text-2xl font-bold text-center">🎵 Admin</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <input
          id="admin-email"
          name="email"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-400"
        />

        <input
          id="admin-password"
          name="password"
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          className="bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-yellow-400"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-yellow-400 text-black font-bold rounded-lg py-3 text-sm hover:bg-yellow-300 disabled:opacity-50 transition"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </div>
    </div>
  );
}