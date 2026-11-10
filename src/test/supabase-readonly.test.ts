import { describe, expect, it, vi } from "vitest";
import { createReadOnlySupabaseClient } from "@/lib/supabase-readonly";

describe("read-only Supabase client", () => {
  it("reports not configured unless both public settings are present", async () => {
    const request = vi.fn();
    const client = createReadOnlySupabaseClient({}, request);
    await expect(client.checkConnection()).resolves.toBe("not configured");
    expect(request).not.toHaveBeenCalled();
  });

  it("checks connectivity and reads rows using GET with the publishable key", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }));
    const client = createReadOnlySupabaseClient(
      { url: "https://example.supabase.co", publishableKey: "public-test-key" },
      request,
    );

    await expect(client.checkConnection()).resolves.toBe("connected");
    await expect(client.select<{ id: number }>("items", "id")).resolves.toEqual([{ id: 1 }]);

    for (const [url, init] of request.mock.calls) {
      expect(url).toBeInstanceOf(URL);
      expect(init?.method).toBe("GET");
      expect(init?.headers).toEqual({
        apikey: "public-test-key",
        Authorization: "Bearer public-test-key",
      });
    }
    expect(Object.keys(client)).toEqual(["isConfigured", "checkConnection", "select"]);
  });

  it("rejects invalid table names and failed reads", async () => {
    const client = createReadOnlySupabaseClient(
      { url: "https://example.supabase.co", publishableKey: "public-test-key" },
      vi.fn().mockResolvedValue(new Response("", { status: 403 })),
    );

    await expect(client.select("items;delete")).rejects.toThrow("Invalid Supabase table name.");
    await expect(client.select("items")).rejects.toThrow("Supabase read failed with status 403.");
  });
});
