import { useEffect, useRef, useState } from "react";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";

/**
 * The search input.
 *
 * It takes a sentence, not keywords — "Senior nurse in Kumasi, full time" is a
 * valid search — so the placeholder says so and the suggestions complete the
 * word being typed rather than replacing the whole query. Completing only the
 * last word is what lets someone build a long query without the box fighting
 * them for control of it.
 */

const SUGGEST_DEBOUNCE_MS = 180;

const SearchBox = ({ value, onChange, onSubmit }) => {
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const containerRef = useRef(null);
    const inputRef = useRef(null);
    const requestId = useRef(0);

    //   The word still being typed. Derived rather than stored, so a query that
    //   is too short to complete simply has nothing to show — no state to clear.
    const fragment = value.trim().split(/\s+/).pop() || "";
    const canSuggest = fragment.length >= 2;

    useEffect(() => {
        if (!canSuggest) return undefined;

        const id = ++requestId.current;
        const timer = setTimeout(() => {
            axiosInstance
                .get(API_PATHS.JOBS.SEARCH_SUGGEST, { params: { q: value } })
                .then((response) => {
                    if (id !== requestId.current) return;
                    setSuggestions(response.data?.suggestions || []);
                    setHighlighted(-1);
                })
                .catch(() => {
                    // Autocomplete is a convenience; losing it changes nothing.
                    if (id === requestId.current) setSuggestions([]);
                });
        }, SUGGEST_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [value, canSuggest]);

    //   Clicking anywhere else closes the list.
    useEffect(() => {
        const onPointerDown = (event) => {
            if (!containerRef.current?.contains(event.target)) setIsOpen(false);
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, []);

    const visibleSuggestions = canSuggest ? suggestions : [];

    /** Swap the word being typed for the suggestion, keeping the rest intact. */
    const applySuggestion = (suggestion) => {
        const words = value.trim().split(/\s+/);
        words[words.length - 1] = suggestion;
        const next = `${words.join(" ")} `;
        onChange(next);
        setIsOpen(false);
        setHighlighted(-1);
        inputRef.current?.focus();
    };

    const handleKeyDown = (event) => {
        if (!isOpen || visibleSuggestions.length === 0) {
            if (event.key === "Enter") onSubmit?.();
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setHighlighted((index) => (index + 1) % visibleSuggestions.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlighted((index) => (index <= 0 ? visibleSuggestions.length - 1 : index - 1));
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (highlighted >= 0) applySuggestion(visibleSuggestions[highlighted]);
            else {
                setIsOpen(false);
                onSubmit?.();
            }
        } else if (event.key === "Escape") {
            setIsOpen(false);
        }
    };

    const showList = isOpen && visibleSuggestions.length > 0;

    return (
        <div ref={containerRef} className="relative flex-1">
            <div className="flex items-center gap-space-sm rounded-xl bg-white px-space-md py-3 shadow-sm ring-1 ring-white/40 transition focus-within:ring-2 focus-within:ring-[#efe1ff]">
                <span className="material-symbols-outlined text-primary text-[22px]">search</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(event) => {
                        onChange(event.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Try: Senior nurse in Kumasi, full time"
                    aria-label="Search jobs"
                    aria-autocomplete="list"
                    aria-expanded={showList}
                    role="combobox"
                    aria-controls="job-search-suggestions"
                    className="w-full bg-transparent font-body-md text-on-surface placeholder:text-text-muted focus:outline-none dark:text-slate-900 dark:placeholder:text-slate-500"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => {
                            onChange("");
                            inputRef.current?.focus();
                        }}
                        aria-label="Clear search"
                        className="shrink-0 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                )}
            </div>

            {showList && (
                <ul
                    id="job-search-suggestions"
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-border-default bg-surface-card py-1.5 shadow-lg"
                >
                    {visibleSuggestions.map((suggestion, index) => (
                        <li key={suggestion} role="option" aria-selected={index === highlighted}>
                            <button
                                type="button"
                                onMouseEnter={() => setHighlighted(index)}
                                onClick={() => applySuggestion(suggestion)}
                                className={`flex w-full items-center gap-2 px-4 py-2 text-left font-body-md capitalize transition-colors cursor-pointer ${
                                    index === highlighted
                                        ? "bg-brand-indigo-light text-primary"
                                        : "text-on-surface hover:bg-surface-container"
                                }`}
                            >
                                <span className="material-symbols-outlined text-[16px] text-text-muted">search</span>
                                {suggestion}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SearchBox;
