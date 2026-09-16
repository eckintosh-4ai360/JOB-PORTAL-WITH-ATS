import { ChevronDown } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext";



const ProfileDropdown = ({
    
    isOpen,
    onToggle,
    avatar,
    companyName,
    email,
    onLogout,
}) => {
    const navigate = useNavigate();
    const {user} = useAuth();
    const userRole = user?.role;
    return (
        <div className="relative">
            <button
            onClick={onToggle}
            className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-2000 "
            >
                {avatar ? (
                    <img
                    src={avatar}
                    alt="Avatar"
                    className="w-9 h-9 rounded-xl object-cover"
                    />
                ) : (
                    <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                            {companyName.charAt(0).toUpperCase()}
                        </span>
                    </div>
                ) }
                <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{companyName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {userRole === "jobseeker"
                          ? "Job Seeker"
                          : userRole === "employer"
                          ? "Employer"
                          : userRole === "admin"
                          ? "Administrator"
                          : ""}
                    </p>
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{companyName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{email}</p>
                    </div>

                    <a
                    onClick={()=> navigate(
                        userRole === "jobseeker"
                            ? "/profile"
                            : userRole === "admin"
                            ? "/admin-email-templates"
                            : "/company-profile"
                    )}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    >View Profile</a>

                    <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                        <a
                        href="#"
                        onClick={onLogout}
                        className="block px-4 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                        >Logout</a>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ProfileDropdown
