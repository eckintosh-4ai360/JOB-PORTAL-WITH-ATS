import React, { useState, useRef } from "react"
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
  ChevronRight,
  Sparkles
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
        if (user.role === "employer") {
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
    <div className="min-h-screen bg-gray-50 flex font-display text-secondary overflow-hidden">
      
      {/* LEFT SIDE: Brand Showcase (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-secondary overflow-hidden flex-col justify-between p-12">
        {/* Background Decorative Mesh Gradients */}
        <div className="absolute inset-0 bg-radial-to-br from-primary/20 via-transparent to-transparent opacity-60 pointer-events-none" />
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none animate-pulse duration-10000" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl pointer-events-none" />

        {/* Logo Header */}
        <div className="relative z-10 flex items-center space-x-3 cursor-pointer" onClick={() => navigate("/")}>
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-primary/40 shadow-lg shadow-primary/20">
            <img src="/spg-logo.png" alt="logo" className="w-full h-full object-cover rounded-full" />
          </div>
          <span className="text-2xl font-bold text-white tracking-wide">
            SPG <span className="text-primary">JobPortal</span>
          </span>
        </div>

        {/* Brand Core Value Section */}
        <div className="relative z-10 my-auto max-w-lg space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center space-x-2 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
              <span>Next-Gen Job Matching</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight">
              Start your career journey with <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-orange-400">Us</span> today.
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed">
              Create your profile to explore curated opportunities, engage directly with premium hiring managers, and apply seamlessly with one click.
            </p>
          </motion.div>

          {/* Stats Visual Cards */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-3 gap-4"
          >
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:border-primary/40 transition-colors group">
              <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-white">12k+</div>
              <div className="text-xs text-gray-400">Active Jobs</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:border-primary/40 transition-colors group">
              <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-white">500+</div>
              <div className="text-xs text-gray-400">Companies</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 hover:border-primary/40 transition-colors group">
              <div className="p-2 w-fit rounded-lg bg-primary/10 text-primary mb-2 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-2xl font-bold text-white">98%</div>
              <div className="text-xs text-gray-400">Match Rate</div>
            </div>
          </motion.div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-sm text-gray-500 flex justify-between items-center">
          <span>&copy; {new Date().getFullYear()} SPG JobPortal.</span>
          <div className="flex space-x-4">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Interactive SignUp Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative bg-white overflow-y-auto max-h-screen py-10">
        
        {/* Subtle decorative lights for mobile */}
        <div className="lg:hidden absolute top-0 right-0 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-6"
        >
          {/* Form Header */}
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-extrabold text-secondary tracking-tight">
              Create Account
            </h2>
            <p className="text-gray-500 font-medium text-sm">
              Join thousands of professionals finding their dream jobs
            </p>
          </div>

          {/* Social Logins */}
          <GoogleSignInButton role={formData.role} label="Sign up with Google" />

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <span className="relative px-4 bg-white text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Or fill details
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name */}
            <div className="space-y-1">
              <label className="block text-sm font-bold text-gray-700">
                Full Name *
              </label>
              <div 
                className={`relative border rounded-xl transition-all flex items-center ${
                  formState.errors.fullName 
                    ? "border-red-500 bg-red-50/10 focus-within:ring-2 focus-within:ring-red-500/20" 
                    : activeField === "fullName"
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="pl-3.5 flex items-center pointer-events-none">
                  <User className={`w-5 h-5 transition-colors ${
                    formState.errors.fullName 
                      ? "text-red-400" 
                      : activeField === "fullName" 
                        ? "text-primary" 
                        : "text-gray-400"
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
              <label className="block text-sm font-bold text-gray-700">
                Email Address *
              </label>
              <div 
                className={`relative border rounded-xl transition-all flex items-center ${
                  formState.errors.email 
                    ? "border-red-500 bg-red-50/10 focus-within:ring-2 focus-within:ring-red-500/20" 
                    : activeField === "email"
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="pl-3.5 flex items-center pointer-events-none">
                  <Mail className={`w-5 h-5 transition-colors ${
                    formState.errors.email 
                      ? "text-red-400" 
                      : activeField === "email" 
                        ? "text-primary" 
                        : "text-gray-400"
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
              <label className="block text-sm font-bold text-gray-700">
                Password *
              </label>
              <div 
                className={`relative border rounded-xl transition-all flex items-center ${
                  formState.errors.password 
                    ? "border-red-500 bg-red-50/10 focus-within:ring-2 focus-within:ring-red-500/20" 
                    : activeField === "password"
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="pl-3.5 flex items-center pointer-events-none">
                  <Lock className={`w-5 h-5 transition-colors ${
                    formState.errors.password 
                      ? "text-red-400" 
                      : activeField === "password" 
                        ? "text-primary" 
                        : "text-gray-400"
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
                  className="absolute right-3.5 text-gray-400 hover:text-gray-600 transition-colors p-1"
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
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700">
                Profile Picture (Optional)
              </label>
              <div className="flex items-center space-x-4 p-1.5 border border-gray-100 rounded-xl bg-gray-50/50">
                {/* Photo Preview */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200 border border-gray-300 flex items-center justify-center shrink-0">
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
                    className="flex items-center space-x-2 border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 py-1.5 px-4 rounded-lg text-xs font-bold text-gray-700 transition-all cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                  </button>
                  <p className="text-[10px] text-gray-400">JPG, PNG up to 5MB</p>
                </div>
              </div>
            </div>

            {/* Role selection */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700">
                I am a *
              </label>
              <div className="grid grid-cols-2 gap-4">
                
                {/* Job Seeker Option */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect("jobseeker")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    formData.role === "jobseeker"
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                      : "border-gray-200 hover:border-gray-300 bg-white text-gray-500"
                  }`}
                >
                  <User className={`w-6 h-6 mb-1 transition-colors ${
                    formData.role === "jobseeker" ? "text-primary" : "text-gray-400"
                  }`} />
                  <span className="text-[13px] font-bold block">Job Seeker</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">Looking for opportunities</span>
                </button>

                {/* Employer Option */}
                <button
                  type="button"
                  onClick={() => handleRoleSelect("employer")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    formData.role === "employer"
                      ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                      : "border-gray-200 hover:border-gray-300 bg-white text-gray-500"
                  }`}
                >
                  <Building2 className={`w-6 h-6 mb-1 transition-colors ${
                    formData.role === "employer" ? "text-primary" : "text-gray-400"
                  }`} />
                  <span className="text-[13px] font-bold block">Employer</span>
                  <span className="text-[10px] text-gray-400 mt-0.5">Hiring talent</span>
                </button>

              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={formState.loading || formState.success}
              className={`w-full py-3.5 rounded-xl font-bold text-[15px] text-white transition-all transform active:scale-[0.98] shadow-md shadow-primary/20 flex items-center justify-center space-x-2 cursor-pointer ${
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
            <div className="text-center pt-2 text-sm text-gray-500 font-semibold">
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
          <div className="text-center text-[11px] text-gray-400 font-semibold pt-1">
            JobPortal. Spagad Technologies Limited
          </div>
        </motion.div>
      </div>

    </div>
  )
}

export default SignUp