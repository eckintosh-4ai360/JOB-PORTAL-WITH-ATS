import React, { useEffect, useRef, useState } from "react";
import { useClerk } from "@clerk/react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

// SSOCallback

const getPostLoginPath = (user) => {
    if (user.role === "admin") return "/admin-email-templates";
    if (user.role === "employer") {
        return user.employerOnboardingComplete === false
            ? "/company-setup"
            : "/employer-dashboard";
    }
    return "/profile";
};

const SSOCallback = () => {
    const { handleRedirectCallback, session } = useClerk();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const selectedRole = searchParams.get("role");
    const isExistingSession = searchParams.get("existing") === "true";
    const [step, setStep] = useState("loading"); // "loading" | "pick-role" | "done" | "error"
    const [pendingToken, setPendingToken] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [callbackReady, setCallbackReady] = useState(isExistingSession);
    const callbackHandledRef = useRef(false);
    const exchangeStartedRef = useRef(false);

    // Step 1 — complete Clerk OAuth redirect
    useEffect(() => {
        if (callbackHandledRef.current) return;
        callbackHandledRef.current = true;

        if (isExistingSession) {
            setCallbackReady(true);
            return;
        }

        const complete = async () => {
            try {
                await handleRedirectCallback(
                    {
                        signInUrl: "/login",
                        signUpUrl: "/signup",
                        signInForceRedirectUrl: "/sso-callback",
                        signUpForceRedirectUrl: "/sso-callback",
                    },
                    async () => {}
                );
                setCallbackReady(true);
            } catch (err) {
                console.error("Clerk redirect callback error:", err);
                setErrorMsg("Google sign-in failed. Please try again.");
                setStep("error");
            }
        };
        complete();
    }, [handleRedirectCallback, isExistingSession]);

    // Step 2 — once Clerk session is ready, exchange for JWT
    useEffect(() => {
        if (!callbackReady || !session || exchangeStartedRef.current) return;
        exchangeStartedRef.current = true;

        const exchangeToken = async () => {
            try {
                const clerkToken = await session.getToken();
                const payload = { clerkToken };

                if (selectedRole) {
                    payload.role = selectedRole;
                }

                const response = await axiosInstance.post(API_PATHS.AUTH.CLERK_AUTH, payload);
                const { token, user } = response.data;
                login(user, token);
                toast.success(`Welcome, ${user.name}!`);

                navigate(getPostLoginPath(user), { replace: true });
            } catch (err) {
                const data = err.response?.data;

                if (data?.requiresRole) {
                    // Brand-new user — store token and ask for role
                    const clerkToken = await session.getToken();
                    setPendingToken(clerkToken);
                    setStep("pick-role");
                } else {
                    console.error("Backend auth error:", err);
                    setErrorMsg(data?.message || "Authentication failed. Please try again.");
                    setStep("error");
                }
            }
        };

        exchangeToken();
    }, [callbackReady, session, selectedRole, login, navigate]);

    // Step 3 — user picks role (first-time Google sign-in only)
    const handleRoleSelect = async (role) => {
        try {
            setStep("loading");
            const response = await axiosInstance.post(API_PATHS.AUTH.CLERK_AUTH, {
                clerkToken: pendingToken,
                role,
            });

            const { token, user } = response.data;
            login(user, token);
            toast.success(`Welcome to SPG JobPortal, ${user.name}!`);

            navigate(getPostLoginPath(user), { replace: true });
        } catch (err) {
            console.error("Role selection error:", err);
            setErrorMsg(err.response?.data?.message || "Something went wrong.");
            setStep("error");
        }
    };

    if (step === "loading") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <svg className="w-10 h-10 animate-spin text-orange-500 mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                <p className="text-gray-500 font-medium text-sm">Signing you in with Google...</p>
            </div>
        );
    }

    if (step === "pick-role") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
                <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm space-y-6 text-center">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900">One last step</h2>
                        <p className="text-gray-500 text-sm mt-1">How will you be using SPG JobPortal?</p>
                    </div>
                    <div className="space-y-3">
                        <button
                            onClick={() => handleRoleSelect("jobseeker")}
                            className="w-full border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 py-4 rounded-xl transition-all font-semibold text-gray-700 flex flex-col items-center gap-1 cursor-pointer"
                        >
                            <span className="text-2xl">🔍</span>
                            <span>I'm looking for a job</span>
                            <span className="text-xs text-gray-400 font-normal">Browse and apply for positions</span>
                        </button>
                        <button
                            onClick={() => handleRoleSelect("employer")}
                            className="w-full border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 py-4 rounded-xl transition-all font-semibold text-gray-700 flex flex-col items-center gap-1 cursor-pointer"
                        >
                            <span className="text-2xl">🏢</span>
                            <span>I'm hiring</span>
                            <span className="text-xs text-gray-400 font-normal">Post jobs and find candidates</span>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (step === "error") {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                <div className="text-5xl mb-4">😕</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Sign-in failed</h2>
                <p className="text-gray-500 text-sm mb-6">{errorMsg}</p>
                <button
                    onClick={() => navigate("/login")}
                    className="px-6 py-2.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors"
                >
                    Back to Login
                </button>
            </div>
        );
    }

    return null;
};

export default SSOCallback;
