import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Navigate } from "react-router-dom";

const ADMIN_EMAIL = "thomaslopezpagat@gmail.com"; // ← mets ton email ici

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) setStatus("ok");
      else setStatus("denied");
    });
  }, []);

  if (status === "loading") return (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      Chargement…
    </div>
  );

  if (status === "denied") return <Navigate to="/admin/login" replace />;

  return <>{children}</>;
}