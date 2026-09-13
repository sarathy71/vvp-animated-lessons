import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "content-type, x-game-token, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is missing");

  let secret =
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!secret) {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        secret = parsed.default || Object.values(parsed)[0];
      } catch (_) {}
    }
  }

  if (!secret || typeof secret !== "string") {
    throw new Error("Supabase server-side secret key is missing");
  }

  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function validEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));

    if (!validEmail(body.email)) {
      return json({ error: "Please enter a valid email address." }, 400);
    }

    const email = body.email.trim().toLowerCase();
    const mockMode =
      (Deno.env.get("ZENLER_MOCK_MODE") || "").toLowerCase() === "true";

    const supabase = getAdminClient();
    let user: any = null;

    if (mockMode) {
      // Multi-user test lookup from Supabase table.
      const { data: mockStudent, error: mockError } = await supabase
        .from("mock_students")
        .select("email, zenler_user_id, first_name, last_name, active")
        .eq("email", email)
        .eq("active", true)
        .maybeSingle();

      if (mockError) {
        console.error("Mock student lookup failed", mockError);
        return json({ error: "Could not look up the test student." }, 500);
      }

      if (!mockStudent) {
        return json(
          {
            error: "We could not find a test student with that email.",
            code: "STUDENT_NOT_FOUND",
          },
          404,
        );
      }

      user = {
        id: mockStudent.zenler_user_id,
        first_name: mockStudent.first_name,
        last_name: mockStudent.last_name || "",
        email: mockStudent.email,
      };
    } else {
      // Real Zenler lookup once API access is available.
      const zenlerApiKey = Deno.env.get("ZENLER_API_KEY");
      const zenlerAccount = Deno.env.get("ZENLER_ACCOUNT_NAME");

      if (!zenlerApiKey || !zenlerAccount) {
        return json({ error: "Zenler API is not configured yet." }, 500);
      }

      const url = new URL("https://api.newzenler.com/api/v1/users");
      url.searchParams.set("limit", "15");
      url.searchParams.set("page", "1");
      url.searchParams.set("search", email);
      url.searchParams.append("role[]", "4");

      const zr = await fetch(url, {
        headers: {
          "X-API-Key": zenlerApiKey,
          "X-Account-Name": zenlerAccount,
          "Accept": "application/json",
        },
      });

      if (!zr.ok) {
        console.error("Zenler lookup failed", zr.status, await zr.text());
        return json({ error: "Could not verify the student right now." }, 502);
      }

      const payload = await zr.json();
      const items = payload?.data?.items;

      if (!Array.isArray(items)) {
        return json({ error: "Unexpected response from Zenler." }, 502);
      }

      user = items.find(
        (u: any) =>
          typeof u?.email === "string" &&
          u.email.trim().toLowerCase() === email,
      );

      if (!user?.id) {
        return json(
          {
            error: "We could not find a student with that email.",
            code: "STUDENT_NOT_FOUND",
          },
          404,
        );
      }
    }

    // Create or refresh the player record.
    const { data: player, error: playerError } = await supabase
      .from("players")
      .upsert(
        {
          zenler_user_id: String(user.id),
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "zenler_user_id" },
      )
      .select("id, first_name")
      .single();

    if (playerError || !player) {
      console.error("Player upsert failed", playerError);
      return json({ error: "Could not create the game profile." }, 500);
    }

    // New opaque session token for this browser/device.
    const token = randomToken();
    const tokenHash = await sha256Hex(token);

    const { error: sessionError } = await supabase
      .from("player_sessions")
      .insert({
        player_id: player.id,
        token_hash: tokenHash,
      });

    if (sessionError) {
      console.error("Session insert failed", sessionError);
      return json({ error: "Could not start the game session." }, 500);
    }

    return json({
      ok: true,
      gameToken: token,
      player: {
        firstName: player.first_name || "Friend",
      },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Unexpected server error." }, 500);
  }
});
