export type SupabaseReadConfig = {
  url?: string | undefined;
  publishableKey?: string | undefined;
};

export type SupabaseConnectionStatus = "connected" | "not configured" | "offline";

export function createReadOnlySupabaseClient(
  config: SupabaseReadConfig = {
    url: import.meta.env["VITE_SUPABASE_URL"],
    publishableKey: import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
  },
  request: typeof fetch = fetch,
) {
  const url = config.url?.trim().replace(/\/+$/, "");
  const publishableKey = config.publishableKey?.trim();

  const isConfigured = Boolean(url && publishableKey);

  return {
    isConfigured,
    async checkConnection(): Promise<SupabaseConnectionStatus> {
      if (!url || !publishableKey) return "not configured";
      try {
        const response = await request(new URL("/rest/v1/", url), {
          method: "GET",
          headers: {
            apikey: publishableKey,
            Authorization: `Bearer ${publishableKey}`,
          },
        });
        return response.ok ? "connected" : "offline";
      } catch {
        return "offline";
      }
    },
    async select<T>(table: string, columns = "*"): Promise<T[]> {
      if (!url || !publishableKey) throw new Error("Supabase is not configured.");
      if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error("Invalid Supabase table name.");
      const endpoint = new URL(`/rest/v1/${table}`, url);
      endpoint.searchParams.set("select", columns);
      const response = await request(endpoint, {
        method: "GET",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${publishableKey}`,
        },
      });
      if (!response.ok) throw new Error(`Supabase read failed with status ${response.status}.`);
      return (await response.json()) as T[];
    },
  };
}
