import { useCallback, useEffect, useState } from "react";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPath";
import { useAuth } from "../context/AuthContext";

/**
 * This account's subscription to updates about newly posted roles.
 *
 * `decided` is the important one: it is false only for someone who has neither
 * agreed nor declined, and it is what the opt-in prompt watches. Declining
 * writes a record too, so the prompt appears once and never again.
 *
 * Signed-out visitors get `decided: true` and no subscription — there is
 * nothing to ask them about here. The footer form handles that case.
 */
export const useJobAlerts = () => {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState({ loading: true, decided: true, subscription: null });
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setState({ loading: false, decided: true, subscription: null });
      return;
    }

    try {
      const res = await axiosInstance.get(API_PATHS.JOB_ALERTS.ME);
      setState({
        loading: false,
        decided: Boolean(res.data?.decided),
        subscription: res.data?.subscription || null,
      });
    } catch {
      // Treat an unreadable answer as "already decided". Being unable to load
      // the setting is no reason to push a prompt at someone who may have
      // already said no.
      setState({ loading: false, decided: true, subscription: null });
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // A tick later, so the fetch never writes state inside the effect's
    // synchronous path.
    const timer = setTimeout(() => { load().catch(() => {}); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  /** Subscribe, or change cadence and filters. Returns the server's message. */
  const save = useCallback(async (changes) => {
    setIsSaving(true);
    try {
      const res = await axiosInstance.put(API_PATHS.JOB_ALERTS.ME, changes);
      setState({
        loading: false,
        decided: true,
        subscription: res.data?.subscription || null,
      });
      return res.data;
    } finally {
      setIsSaving(false);
    }
  }, []);

  /** "No thanks" — recorded, so the prompt stops appearing. */
  const decline = useCallback(async () => {
    setIsSaving(true);
    try {
      const res = await axiosInstance.post(API_PATHS.JOB_ALERTS.DECLINE);
      setState({
        loading: false,
        decided: true,
        subscription: res.data?.subscription || null,
      });
      return res.data;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const subscription = state.subscription;

  return {
    isLoading: state.loading,
    decided: state.decided,
    subscription,
    isSubscribed: Boolean(subscription?.subscribed),
    isSaving,
    save,
    decline,
    reload: load,
  };
};
