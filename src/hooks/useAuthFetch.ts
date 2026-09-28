import { useCallback } from "react";
import { fetchWithAuth } from "../api/api";

export const useAuthFetch = () => {
  return useCallback(async (input: string, init: RequestInit = {}) => {
    return fetchWithAuth(input, init);
  }, []);
};