import { useState } from "react";
import { useClerk, useSignIn } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

// GoogleSignInButton
const GoogleSignInButton = ({ role = null, label = "Continue with Google" }) => {
    const clerk = useClerk();
    const { signIn } = useSignIn();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        if (loading) return;

        try {
            const callbackUrl = new URL("/sso-callback", window.location.origin);
            if (role) callbackUrl.searchParams.set("role", role);
            const callbackHref = callbackUrl.toString();

            if (clerk.session) {
                setLoading(true);
                callbackUrl.searchParams.set("existing", "true");
                navigate(`${callbackUrl.pathname}${callbackUrl.search}`, { replace: true });
                return;
            }

            if (!signIn) {
                toast.error("Google sign-in is still loading. Please try again in a moment.");
                return;
            }

            setLoading(true);

            await signIn.authenticateWithRedirect({
                strategy: "oauth_google",
                redirectUrl: callbackHref,
                redirectUrlComplete: callbackHref,
            });
        } catch (err) {
            console.error("Google sign-in error:", err);
            toast.error(err?.longMessage || err?.message || "Google sign-in failed. Please try again.");
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            aria-busy={loading}
            className="w-full flex items-center justify-center space-x-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 py-2.5 rounded-xl transition-all font-semibold text-sm text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
            {loading ? (
                <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
            ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
            )}
            <span>{loading ? "Redirecting to Google..." : label}</span>
        </button>
    );
};

export default GoogleSignInButton;
