import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Landing page after Google redirects back to the frontend.
 * URL looks like: /oauth/callback?token=JWT_TOKEN
 *
 * Steps:
 * 1. Extract the JWT from the query string
 * 2. Persist it and fetch the user profile from the API
 * 3. Navigate to the dashboard
 */
export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error || !token) {
      navigate("/login?error=google_auth_failed", { replace: true });
      return;
    }

    loginWithToken(token)
      .then(() => navigate("/dashboard", { replace: true }))
      .catch(() => navigate("/login?error=google_auth_failed", { replace: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <p className="text-muted-foreground text-sm">Completing sign-in...</p>
    </div>
  );
}
