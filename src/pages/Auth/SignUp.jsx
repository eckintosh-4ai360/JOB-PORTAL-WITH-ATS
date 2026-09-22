import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  User,
  Mail, 
  Lock,
  Eye,
  EyeOff,
  Upload,
  Briefcase,
  Building2,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronRight
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "react-hot-toast"
import axiosInstance from "../../utils/axiosInstance"
import { API_PATHS } from "../../utils/apiPath"
import { useAuth } from "../../context/AuthContext"
import uploadImage from "../../utils/uploadingImage"
import GoogleSignInButton from "../../components/GoogleSignInButton"

const SignUp = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const fileInputRef = useRef(null)

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "jobseeker", // 'jobseeker' or 'employer'
    avatar: null
  })

  const [avatarPreview, setAvatarPreview] = useState(null)

  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    showPassword: false,
    success: false,
  })

  // Focus states for input fields to animate borders/icons nicely
  const [activeField, setActiveField] = useState(null)

  // Validation functions
  const validateName = (name) => {
    if (!name.trim()) return "Full name is required"
    if (name.trim().length < 3) return "Name must be at least 3 characters long"
    return ""
  }

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
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))

    // Real-time validation clearance/check
    if (formState.errors[name]) {
      let error = ""
      if (name === "fullName") error = validateName(value)
      if (name === "email") error = validateEmail(value)
      if (name === "password") error = validatePassword(value)
      
      setFormState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [name]: error
        }
      }))
    }
  }

  // Handle Role Selection — maps UI label to backend enum value
  const handleRoleSelect = (role) => {
    // role passed in is already "jobseeker" or "employer"
    setFormData(prev => ({
      ...prev,
      role
    }))
  }

  // Handle File Input
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit")
      return
    }

    // Must be image
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (PNG, JPG)")
      return
    }

    setFormData(prev => ({
      ...prev,
      avatar: file
    }))

    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result)
    }
    reader.readAsDataURL(file)
    toast.success("Profile photo uploaded successfully!")
  }

  const triggerFileInput = () => {
    fileInputRef.current.click()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const nameErr = validateName(formData.fullName)
    const emailErr = validateEmail(formData.email)
    const passwordErr = validatePassword(formData.password)

    if (nameErr || emailErr || passwordErr) {
      setFormState(prev => ({
        ...prev,
        errors: {
          fullName: nameErr,
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

    // Call backend register API
    try {
      let avatarUrl = "";
      if (formData.avatar) {
        const uploadRes = await uploadImage(formData.avatar);
        avatarUrl = uploadRes.imageUrl;
      }

      const response = await axiosInstance.post(API_PATHS.AUTH.REGISTER, {
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        avatar: avatarUrl
      })

      const { token, user } = response.data

      // Persist token + user in context & localStorage
      login(user, token)

      setFormState(prev => ({
        ...prev,
        loading: false,
        success: true
      }))
      toast.success("Account created successfully!")

      // Navigate based on role
      setTimeout(() => {
        if (user.role === "employer" && user.employerOnboardingComplete === false) {
          toast.success("Finish your company setup to start hiring.")
          navigate("/company-setup")
        } else if (user.role === "employer") {
          navigate("/employer-dashboard")
        } else {
          navigate("/find-jobs")
        }
      }, 1200)
    } catch (error) {
      const message =
        error.response?.data?.message || "Registration failed. Please try again."

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
              Start your career<br />
              journey with <span className="text-[#f97316]">Us</span><br />
              today.
            </h1>
            <p className="auth-showcase-description text-sm 2xl:text-lg text-gray-400 leading-relaxed max-w-md">
              Create your profile to explore curated opportunities, engage directly with premium hiring managers, and apply seamlessly with one click.
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

      {/* RIGHT SIDE: Interactive SignUp Form Container */}
      <div className="auth-form-panel relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-white p-3 sm:p-4 xl:p-6 2xl:p-10 lg:w-1/2 dark:bg-gray-950">
        
        {/* Subtle decorative lights for mobile */}
        <div className="lg:hidden absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="auth-form-content auth-signup-content w-full max-w-md space-y-2.5 sm:space-y-3"
        >
          {/* Form Header */}
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-secondary tracking-tight dark:text-gray-100">
              Create Account
            </h2>
            <p className="text-gray-500 font-medium text-sm dark:text-gray-400">
              Join thousands of professionals finding their dream jobs
            </p>
          </div>

          {/* Social Logins */}
          <GoogleSignInButton role={formData.role} label="Sign up with Google" />

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-800"></div>
            </div>
            <span className="relative px-4 bg-white text-xs font-semibold text-gray-400 uppercase tracking-wider dark:bg-gray-950 dark:text-gray-500">
              Or fill details
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-signup-form space-y-2.5 sm:space-y-3">
            
            {/* Full Name */}
            <div className="space-y-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                Full Name *
              </label>
              <div 
                className={`relative border rounded-xl transition-all flex items-center ${
                  formState.errors.fullName 
                    ? "border-red-500 bg-red-50/10 focus-within:ring-2 focus-within:ring-red-500/20" 
                    : activeField === "fullName"
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                }`}
              >
                <div className="pl-3.5 flex items-center pointer-events-none">
                  <User className={`w-5 h-5 transition-colors ${
                    formState.errors.fullName 
                      ? "text-red-400" 
                      : activeField === "fullName" 
                        ? "text-primary" 
                        : "text-gray-400 dark:text-gray-500"
                  }`} />
                </div>
                <input 
                  type="text" 
                  name="fullName"
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  onFocus={() => setActiveField("fullName")}
                  onBlur={() => setActiveField(null)}
                  className="w-full pl-3 pr-4 py-2.5 bg-transparent text-secondary placeholder-gray-400 outline-none text-[15px] font-medium"
                />
              </div>
              <AnimatePresence>
                {formState.errors.fullName && (
                  <motion.p 
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="text-red-500 text-xs font-semibold mt-1 flex items-center space-x-1"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>{formState.errors.fullName}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                Email Address *
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
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onFocus={() => setActiveField("email")}
                  onBlur={() => setActiveField(null)}
                  className="w-full pl-3 pr-4 py-2.5 bg-transparent text-secondary placeholder-gray-400 outline-none text-[15px] font-medium"
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
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                Password *
              </label>
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
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onFocus={() => setActiveField("password")}
                  onBlur={() => setActiveField(null)}
                  className="w-full pl-3 pr-11 py-2.5 bg-transparent text-secondary placeholder-gray-400 outline-none text-[15px] font-medium"
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

            {/* Profile Picture Upload (Optional) */}
            <div className="auth-short-screen-optional space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                Profile Picture (Optional)
              </label>
              <div className="flex items-center space-x-3 rounded-xl border border-gray-100 bg-gray-50/50 p-1 dark:border-gray-800 dark:bg-gray-900/50">
                {/* Photo Preview */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-300 bg-gray-200 dark:border-gray-700 dark:bg-gray-800">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-gray-400" />
                  )}
                </div>

                <div className="space-y-1">
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="flex items-center space-x-2 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 py-1.5 px-4 rounded-lg text-xs font-bold text-gray-700 transition-all cursor-pointer shadow-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                  </button>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">JPG or PNG, up to 5MB</p>
                </div>
              </div>
            </div>

            {/* Role selection */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                I am a *
              </label>
              <div className="grid grid-cols-2 gap-2">
                
                {/* Job Seeker Option */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect("jobseeker")}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all cursor-pointer ${
                    formData.role === "jobseeker"
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                      : "border-gray-200 hover:border-gray-300 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <User className={`mb-1 h-5 w-5 transition-colors ${
                    formData.role === "jobseeker" ? "text-primary" : "text-gray-400 dark:text-gray-500"
                  }`} />
                  <span className="text-[13px] font-bold block">Job Seeker</span>
                  <span className="auth-short-role-detail mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">Looking for opportunities</span>
                </button>

                {/* Employer Option */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect("employer")}
                  className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all cursor-pointer ${
                    formData.role === "employer"
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                      : "border-gray-200 hover:border-gray-300 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <Building2 className={`mb-1 h-5 w-5 transition-colors ${
                    formData.role === "employer" ? "text-primary" : "text-gray-400 dark:text-gray-500"
                  }`} />
                  <span className="text-[13px] font-bold block">Employer</span>
                  <span className="auth-short-role-detail mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">Hiring talent</span>
                </button>

              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={formState.loading || formState.success}
              className={`w-full py-2.5 rounded-xl font-bold text-[15px] text-white transition-all transform active:scale-[0.98] shadow-md shadow-primary/20 flex items-center justify-center space-x-2 cursor-pointer ${
                formState.success
                  ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                  : "bg-primary hover:bg-orange-600"
              }`}
            >
              {formState.loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : formState.success ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span>Success! Redirecting...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ChevronRight className="w-4.5 h-4.5" />
                </>
              )}
            </button>

            {/* Link to Login */}
            <div className="pt-1 text-center text-sm text-gray-500 font-semibold dark:text-gray-400">
              Already have an account?{" "}
              <Link 
                to="/login" 
                className="text-primary hover:text-orange-600 transition-colors font-bold underline decoration-wavy decoration-orange-200 hover:decoration-primary"
              >
                Sign in here
              </Link>
            </div>

          </form>

          {/* Footer Text */}
          <div className="auth-short-screen-optional pt-1 text-center text-[11px] font-semibold text-gray-400">
            JobPortal. Spagad Technologies Limited
          </div>
        </motion.div>
      </div>

    </div>
  )
}

export default SignUp
