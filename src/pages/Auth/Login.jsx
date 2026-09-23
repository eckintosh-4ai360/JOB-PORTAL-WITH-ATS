import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Mail, 
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Briefcase,
  Users,
  Building2,
  ChevronRight
} from "lucide-react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { toast } from "react-hot-toast"
import axiosInstance from "../../utils/axiosInstance"
import { API_PATHS } from "../../utils/apiPath"
import { useAuth } from "../../context/AuthContext"
import GoogleSignInButton from "../../components/GoogleSignInButton"

const Login = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false
  })

  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    showPassword: false,
    success: false,
  })

  // Focus states for input fields to animate borders/icons nicely
  const [activeField, setActiveField] = useState(null)

  // Validation functions
  const validateEmail = (email) => {
    if (!email) return "Email address is required"
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return "Please enter a valid email address"
    return ""
  }

  const validatePassword = (password) => {
    if (!password) return "Password is required"
    if (password.length < 6) return "Password must be at least 6 characters long"
    return ""
  }

  // Handle Input Changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const val = type === "checkbox" ? checked : value
    
    setFormData(prev => ({
      ...prev,
      [name]: val
    }))

    // Real-time validation clearance/check
    if (formState.errors[name]) {
      let error = ""
      if (name === "email") error = validateEmail(val)
      if (name === "password") error = validatePassword(val)
      
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [name]: error
        }
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const emailErr = validateEmail(formData.email)
    const passwordErr = validatePassword(formData.password)

    if (emailErr || passwordErr) {
      setFormState(prev => ({
        ...prev,
        errors: {
          email: emailErr,
          password: passwordErr
        }
      }))
      toast.error("Please correct the errors in the form")
      return
    }

    // Reset errors & start loading
    setFormState(prev => ({
      ...prev,
      errors: {},
      success: false,
      loading: true,
    }))

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email: formData.email,
        password: formData.password,
      })

      const { token, user } = response.data

      // Persist token + user in context & localStorage
      login(user, token)

      setFormState(prev => ({ ...prev, loading: false, success: true }))
      toast.success(`Welcome back, ${user.name || "User"}!`)

      // Navigate: go back to where the user came from, or default by role
      const from = location.state?.from?.pathname
      setTimeout(() => {
        if (user.role === "employer" && user.employerOnboardingComplete === false) {
          toast.success("Finish your company setup to access hiring tools.")
          navigate("/company-setup", { replace: true })
        } else if (from && from !== "/login") {
          navigate(from, { replace: true })
        } else if (user.role === "admin") {
          navigate("/admin-overview")
        } else if (user.role === "employer") {
          navigate("/employer-dashboard")
        } else {
          navigate("/find-jobs")
        }
      }, 1200)

    } catch (error) {
      const message =
        error.response?.data?.message || "Login failed. Please try again."

      setFormState(prev => ({
        ...prev,
        loading: false,
        success: false,
        errors: { api: message },
      }))
      toast.error(message)
    }
  }

  return (
    <div className="auth-viewport flex h-dvh min-h-0 bg-gray-50 font-display text-secondary overflow-hidden dark:bg-gray-950">
      
      {/* LEFT SIDE: Brand Showcase (Hidden on Mobile) */}
      <div className="auth-showcase relative hidden overflow-hidden bg-[#131211] p-6 select-none lg:flex lg:w-1/2 lg:flex-col lg:justify-between xl:p-8 2xl:p-16">
        {/* Ambient Warm Corner Glows */}
        <div className="absolute -bottom-36 -right-36 w-[580px] h-[580px] rounded-full bg-gradient-to-tl from-orange-600/20 via-orange-950/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-80 h-80 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

        {/* Logo Header */}
        <div className="relative z-10 flex items-center space-x-3.5 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-10 h-10 rounded-full border-2 border-white/80 flex items-center justify-center overflow-hidden shadow-sm">
            <img src="/spg-logo.png" alt="SPG Logo" className="w-full h-full object-cover" />
          </div>
          <span className="text-2xl xl:text-[26px] font-bold text-white tracking-tight">
            SPG <span className="text-[#f97316]">JobPortal</span>
          </span>
        </div>

        {/* Brand Core Value Section */}
        <div className="relative z-10 my-auto max-w-lg space-y-4 2xl:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="space-y-3 2xl:space-y-5"
          >
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#241a14] border border-[#f97316]/35 text-[#f97316] text-[11px] font-bold uppercase tracking-widest">
              <span>Next-Gen Job Matching</span>
            </div>
            <h1 className="text-3xl xl:text-4xl 2xl:text-[56px] font-extrabold text-white leading-[1.12] tracking-tight">
              Connect with<br />
              <span className="text-[#f97316]">Opportunities</span> built<br />
              for your skills.
            </h1>
            <p className="auth-showcase-description text-sm 2xl:text-lg text-gray-400 leading-relaxed max-w-md">
              Log in to access tailored recommendations, apply to top tier firms, and keep track of your career progression in real time.
            </p>
          </motion.div>

          {/* Stats Visual Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="grid grid-cols-3 gap-2 2xl:gap-4.5"
          >
            <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-white/5 bg-[#1c1b1a]/85 p-3 backdrop-blur-md transition-colors hover:border-[#f97316]/30 2xl:min-h-[145px] 2xl:p-6">
              <div className="w-10 h-10 rounded-xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="mt-3">
                <div className="text-2xl xl:text-[28px] font-bold text-white tracking-tight">12k+</div>
                <div className="text-xs text-gray-400 font-medium mt-0.5">Active Jobs</div>
              </div>
            </div>

            <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-white/5 bg-[#1c1b1a]/85 p-3 backdrop-blur-md transition-colors hover:border-[#f97316]/30 2xl:min-h-[145px] 2xl:p-6">
              <div className="w-10 h-10 rounded-xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="mt-3">
                <div className="text-2xl xl:text-[28px] font-bold text-white tracking-tight">500+</div>
                <div className="text-xs text-gray-400 font-medium mt-0.5">Companies</div>
              </div>
            </div>

            <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-white/5 bg-[#1c1b1a]/85 p-3 backdrop-blur-md transition-colors hover:border-[#f97316]/30 2xl:min-h-[145px] 2xl:p-6">
              <div className="w-10 h-10 rounded-xl bg-[#f97316]/10 text-[#f97316] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="mt-3">
                <div className="text-2xl xl:text-[28px] font-bold text-white tracking-tight">98%</div>
                <div className="text-xs text-gray-400 font-medium mt-0.5">Match Rate</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between pt-3 text-xs text-gray-500 2xl:pt-6 2xl:text-sm">
          <span>&copy; 2026 SPG JobPortal.</span>
          <div className="flex space-x-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Interactive Login Form Container */}
      <div className="auth-form-panel relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-white p-4 sm:p-6 xl:p-8 2xl:p-12 lg:w-1/2 dark:bg-gray-950">
        
        {/* Subtle decorative lights for mobile */}
        <div className="lg:hidden absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="auth-form-content auth-login-content w-full max-w-md space-y-4 sm:space-y-5 2xl:space-y-8"
        >
          {/* Form Header */}
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-secondary tracking-tight dark:text-gray-100">
              Welcome Back
            </h2>
            <p className="text-sm text-gray-500 font-medium dark:text-gray-400">
              Sign in to your account to continue your search
            </p>
          </div>

          {/* Google Sign-In */}
          <GoogleSignInButton label="Continue with Google" />

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            </div>
            <span className="relative px-4 bg-white text-xs font-semibold text-gray-400 uppercase tracking-wider dark:bg-gray-950 dark:text-gray-500">
              Or continue with
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            
            {/* Email Address */}
            <div className="space-y-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                Email Address
              </label>
              <div 
                className={`relative border rounded-xl transition-all flex items-center ${
                  formState.errors.email 
                    ? "border-red-500 bg-red-50/10 focus-within:ring-2 focus-within:ring-red-500/20" 
                    : activeField === "email"
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <div className="pl-3.5 flex items-center pointer-events-none">
                  <Mail className={`w-5 h-5 transition-colors ${
                    formState.errors.email 
                      ? "text-red-400" 
                      : activeField === "email" 
                        ? "text-primary" 
                        : "text-gray-400 dark:text-gray-500"
                  }`} />
                </div>
                <input 
                  type="email" 
                  name="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  onFocus={() => setActiveField("email")}
                  onBlur={() => setActiveField(null)}
                  className="w-full pl-3 pr-4 py-2.5 bg-transparent text-secondary placeholder-gray-400 outline-none text-[15px] font-medium dark:text-gray-100 dark:placeholder-gray-500"
                />
              </div>
              <AnimatePresence>
                {formState.errors.email && (
                  <motion.p 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="text-red-500 text-xs font-semibold mt-1 flex items-center space-x-1"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>{formState.errors.email}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                  Password
                </label>
                <Link 
                  to="/auth/forgot-password" 
                  className="text-xs font-bold text-primary hover:text-orange-600 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div 
                className={`relative border rounded-xl transition-all flex items-center ${
                  formState.errors.password 
                    ? "border-red-500 bg-red-50/10 focus-within:ring-2 focus-within:ring-red-500/20" 
                    : activeField === "password"
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <div className="pl-3.5 flex items-center pointer-events-none">
                  <Lock className={`w-5 h-5 transition-colors ${
                    formState.errors.password 
                      ? "text-red-400" 
                      : activeField === "password" 
                        ? "text-primary" 
                        : "text-gray-400 dark:text-gray-500"
                  }`} />
                </div>
                <input 
                  type={formState.showPassword ? "text" : "password"}
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  onFocus={() => setActiveField("password")}
                  onBlur={() => setActiveField(null)}
                  className="w-full pl-3 pr-11 py-2.5 bg-transparent text-secondary placeholder-gray-400 outline-none text-[15px] font-medium dark:text-gray-100 dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setFormState(prev => ({
                    ...prev,
                    showPassword: !prev.showPassword
                  }))}
                  className="absolute right-3.5 text-gray-400 hover:text-gray-600 transition-colors p-1 dark:hover:text-gray-300"
                >
                  {formState.showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {formState.errors.password && (
                  <motion.p 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="text-red-500 text-xs font-semibold mt-1 flex items-center space-x-1"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>{formState.errors.password}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Remember Me */}
            <div className="flex items-center">
              <label className="relative flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 border border-gray-200 peer-checked:border-primary peer-checked:bg-primary rounded-md flex items-center justify-center transition-all mr-2.5 bg-white shadow-xs dark:border-gray-700 dark:bg-gray-900">
                  <svg className="w-3.5 h-3.5 text-white scale-0 peer-checked:scale-100 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">Remember me for 30 days</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={formState.loading || formState.success}
              className={`w-full py-2.5 sm:py-3 rounded-xl font-bold text-[15px] text-white transition-all transform active:scale-[0.98] shadow-md shadow-primary/20 flex items-center justify-center space-x-2 cursor-pointer ${
                formState.success
                  ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                  : "bg-primary hover:bg-orange-600"
              }`}
            >
              {formState.loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : formState.success ? (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>Success! Redirecting...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ChevronRight className="h-4.5 w-4.5" />
                </>
              )}
            </button>

            {/* Link to Register */}
            <div className="pt-1 text-center text-sm text-gray-500 font-semibold dark:text-gray-400">
              New to SPG JobPortal?{" "}
              <Link 
                to="/signup" 
                className="text-primary hover:text-orange-600 transition-colors font-bold underline decoration-wavy decoration-orange-200 hover:decoration-primary"
              >
                Create an account
              </Link>
            </div>

          </form>
        </motion.div>
      </div>

    </div>
  )
}

export default Login
