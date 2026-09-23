import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPath";

/**
 * State and fetching for advanced job search.
 *
 * The URL is the single source of truth. Every filter lives in the query
 * string, which makes a search shareable, bookmarkable, and survivable across a
 * refresh or a back button — and means this hook holds no filter state of its
 * own that could drift from what the address bar says.
 *
 * Ranking, parsing and filtering all happen on the server, so a change here is
 * a request, not a re-filter of a page of rows the client happens to be
 * holding. That is the difference between searching the job board and searching
 * the first hundred jobs of it.
 */

/** Filters that hold several values at once. */
const LIST_PARAMS = ["workModel", "type", "experienceLevel", "industry", "companyStage", "skills", "exclude"];

// `exclude` is in that list so a shared link carrying one still works — the
// server subtracts it from its own reading of the query — but nothing in the
// UI sets it any more: the reading is not shown, so there is nothing to dismiss.

/** Filters that hold exactly one. */
const SINGLE_PARAMS = ["q", "location", "education", "datePosted", "salaryMin", "salaryMax", "sort", "company", "companyName"];

const EMPTY_RESULT = {
    jobs: [],
    total: 0,
    page: 1,
    pages: 1,
    interpreted: [],
    facets: {},
    relaxations: [],
    didYouMean: null,
    corrections: [],
    expandedWith: [],
    terms: [],
    aiApplied: [],
};

/** How long to wait after the last keystroke before searching. */
const DEBOUNCE_MS = 350;

/**
 * Flatten multi-value filters into comma-separated strings.
 *
 * Left as arrays, axios sends them as `workModel[]=remote`, and this Express
 * version's query parser keeps the brackets in the key — so the filter arrives
 * under a name nothing reads and is silently ignored. One comma-separated value
 * per filter is unambiguous on both sides.
 */
const toParams = (values) => {
    const params = {};
    for (const [key, value] of Object.entries(values)) {
        if (Array.isArray(value)) {
            if (value.length) params[key] = value.join(",");
        } else if (value !== undefined && value !== null && value !== "") {
            params[key] = value;
        }
    }
    return params;
};

const readList = (params, key) => {
    const raw = params.get(key);
    return raw ? raw.split(",").filter(Boolean) : [];
};

/**
 * A text input bound to a URL parameter, without a request per keystroke.
 *
 * The draft runs ahead of the URL so typing stays instant, and is written back
 * on a delay. When the parameter changes from somewhere else — a trending tag,
 * a reset, the back button — the draft is adjusted during render rather than in
 * an effect, so the input never paints the stale value for a frame.
 */
const useDebouncedParam = (searchParams, commit, key) => {
    const committed = searchParams.get(key) || "";
    const [draft, setDraft] = useState(committed);
    const [synced, setSynced] = useState(committed);

    if (committed !== synced) {
        setSynced(committed);
        setDraft(committed);
    }

    useEffect(() => {
        if (draft === committed) return undefined;
        const timer = setTimeout(() => commit({ [key]: draft }), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [draft, committed, commit, key]);

    return [draft, setDraft];
};

export const useJobSearch = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [results, setResults] = useState(EMPTY_RESULT);
    const [isLoading, setIsLoading] = useState(true);
    //   Distinguished from `isLoading` so the results can stay on screen,
    //   dimmed, while the next page loads — a list that blanks on every
    //   keystroke is harder to use than one that lags slightly.
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const requestId = useRef(0);
    //   Whether the last search returned anything, read when the next one
    //   starts to choose between the full spinner and the dimmed list. A ref
    //   rather than a dependency: it decides how a search is shown, never
    //   whether one runs, so it must not retrigger the effect.
    const hasResultsRef = useRef(false);

    //   Derived straight from the URL, so a link someone pastes produces
    //   exactly the search it described.
    const filters = useMemo(() => {
        const next = {};
        for (const key of SINGLE_PARAMS) {
            const value = searchParams.get(key);
            if (value) next[key] = value;
        }
        for (const key of LIST_PARAMS) {
            const values = readList(searchParams, key);
            if (values.length) next[key] = values;
        }
        if (searchParams.get("verified") === "true") next.verified = "true";
        return next;
    }, [searchParams]);

    const page = Number(searchParams.get("page")) || 1;
    const query = searchParams.get("q") || "";
    const sort = searchParams.get("sort") || "relevance";

    //   The address bar is rewritten rather than pushed for filter changes, so
    //   the back button leaves the search rather than stepping through every
    //   checkbox that was ticked on the way in.
    const commit = useCallback(
        (changes, { resetPage = true, replace = true } = {}) => {
            setSearchParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    for (const [key, value] of Object.entries(changes)) {
                        const empty =
                            value === null ||
                            value === undefined ||
                            value === "" ||
                            value === false ||
                            (Array.isArray(value) && value.length === 0);

                        if (empty) next.delete(key);
                        else next.set(key, Array.isArray(value) ? value.join(",") : String(value));
                    }
                    if (resetPage && !("page" in changes)) next.delete("page");
                    return next;
                },
                { replace }
            );
        },
        [setSearchParams]
    );

    /** Add or remove one value of a multi-select filter. */
    const toggleListValue = useCallback(
        (key, value) => {
            const current = readList(searchParams, key);
            const next = current.includes(value)
                ? current.filter((entry) => entry !== value)
                : [...current, value];
            commit({ [key]: next });
        },
        [searchParams, commit]
    );

    //   Clearing the URL is enough: both drafts re-sync from it on the next
    //   render, so there is only ever one place the search state lives.
    const clearAll = useCallback(() => {
        setSearchParams(new URLSearchParams(), { replace: true });
    }, [setSearchParams]);

    //   The two free-text inputs. Both write to the URL on a delay so a search
    //   is not fired for every character typed.
    const [draft, setDraft] = useDebouncedParam(searchParams, commit, "q");
    const [locationDraft, setLocationDraft] = useDebouncedParam(searchParams, commit, "location");

    useEffect(() => {
        const id = ++requestId.current;

        //   The request is the external system this effect synchronises with,
        //   so everything — including marking the search in flight — happens
        //   inside the task rather than in the effect body.
        const run = async () => {
            //   Keeping the current results on screen, dimmed, while the next
            //   page loads reads far better than blanking the list on every
            //   keystroke — so only a cold search shows the full spinner.
            if (hasResultsRef.current) setIsRefreshing(true);
            else setIsLoading(true);

            try {
                const response = await axiosInstance.get(API_PATHS.JOBS.SEARCH, {
                    params: toParams({ ...filters, page, limit: 12 }),
                });
                //   A slow earlier request must not overwrite a newer answer.
                if (id !== requestId.current) return;
                const next = { ...EMPTY_RESULT, ...response.data };
                hasResultsRef.current = next.jobs.length > 0;
                setResults(next);
                setError(null);
            } catch (err) {
                if (id !== requestId.current) return;
                hasResultsRef.current = false;
                setResults(EMPTY_RESULT);
                setError(err.response?.data?.message || "Search is unavailable right now.");
            } finally {
                if (id === requestId.current) {
                    setIsLoading(false);
                    setIsRefreshing(false);
                }
            }
        };

        run();
    }, [filters, page, sort]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        for (const key of LIST_PARAMS) {
            if (key === "exclude") continue;
            count += readList(searchParams, key).length;
        }
        for (const key of ["location", "education", "datePosted", "salaryMin", "salaryMax", "company"]) {
            if (searchParams.get(key)) count += 1;
        }
        if (searchParams.get("verified") === "true") count += 1;
        return count;
    }, [searchParams]);

    return {
        // state
        draft,
        setDraft,
        locationDraft,
        setLocationDraft,
        query,
        sort,
        page,
        filters,
        searchParams,
        results,
        isLoading,
        isRefreshing,
        error,
        activeFilterCount,
        // actions
        commit,
        toggleListValue,
        clearAll,
        readList: (key) => readList(searchParams, key),
    };
};

export default useJobSearch;
