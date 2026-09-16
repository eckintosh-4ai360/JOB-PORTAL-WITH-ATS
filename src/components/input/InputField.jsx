
import { ChevronDown } from "lucide-react";

// shared label + error wrapper 
const FieldWrapper = ({ label, required, hint, error, children }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-500 dark:text-red-400">*</span>}
      </label>
    )}
    {children}
    {hint && !error && (
      <p className="text-xs text-gray-400 leading-relaxed dark:text-gray-500">{hint}</p>
    )}
    {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
  </div>
);

// shared ring classes
const base =
  "w-full rounded-xl border border-gray-200 bg-white text-sm text-gray-900 " +
  "dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 " +
  "placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-all duration-200 " +
  "focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

//InputField 
export const InputField = ({
  label,
  required,
  hint,
  error,
  icon: Icon,
  type = "text",
  placeholder,
  value,
  onChange,
  name,
  disabled,
  className = "",
  iconPadding = "pl-12",
  ...rest
}) => (
  <FieldWrapper label={label} required={required} hint={hint} error={error}>
    <div className="relative">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
          <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${base} py-3 ${Icon ? `${iconPadding} pr-4` : "px-4"} ${
          error ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""
        } ${disabled ? "cursor-not-allowed bg-gray-50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500" : ""} ${className}`}
        {...rest}
      />
    </div>
  </FieldWrapper>
);

// SelectField 
export const SelectField = ({
  label,
  required,
  hint,
  error,
  icon: Icon,
  placeholder = "Select an option",
  options = [],       // [{ value, label }]
  value,
  onChange,
  name,
  disabled,
  className = "",
}) => (
  <FieldWrapper label={label} required={required} hint={hint} error={error}>
    <div className="relative">
      {Icon && (
        <div className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center">
          <Icon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
        </div>
      )}
      <select
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`${base} py-3 appearance-none ${Icon ? "pl-10 pr-10" : "px-4 pr-10"} ${
          !value ? "text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-gray-100"
        } ${error ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""} ${
          disabled ? "cursor-not-allowed bg-gray-50 dark:bg-gray-800/50" : "cursor-pointer"
        } ${className}`}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {/* Custom chevron */}
      <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center">
        <ChevronDown className="h-4 w-4 text-gray-400 dark:text-gray-500" />
      </div>
    </div>
  </FieldWrapper>
);

//  TextAreaField 
export const TextAreaField = ({
  label,
  required,
  hint,
  error,
  placeholder,
  value,
  onChange,
  name,
  rows = 5,
  disabled,
  className = "",
}) => (
  <FieldWrapper label={label} required={required} hint={hint} error={error}>
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`${base} px-4 py-3 resize-y ${
        error ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""
      } ${disabled ? "cursor-not-allowed bg-gray-50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500" : ""} ${className}`}
    />
  </FieldWrapper>
);
