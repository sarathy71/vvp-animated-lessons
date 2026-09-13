import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers":
    "content-type, x-game-token, apikey, authorization, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");

  let key =
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!key) {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        key = parsed.default || Object.values(parsed)[0];
      } catch {
        // Fall through to the missing-config error below.
      }
    }
  }

  if (!url || !key || typeof key !== "string") {
    throw new Error("Missing Supabase server configuration.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getPlayerId(req: Request, supabase: any) {
  const token = req.headers.get("x-game-token");

  if (!token || token.length < 20) {
    return null;
  }

  const tokenHash = await sha256Hex(token);

  const { data, error } = await supabase
    .from("player_sessions")
    .select("id, player_id")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  await supabase
    .from("player_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return data.player_id as string;
}

function validWeek(value: unknown) {
  const n = Number(value);

  if (!Number.isInteger(n) || n < 1 || n > 100) {
    return null;
  }

  return n;
}

function validSeries(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_-]{1,50}$/.test(value)
  ) {
    return null;
  }

  return value;
}

function validDate(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  return value;
}

function validEventId(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    value.length > 120
  ) {
    return null;
  }

  return value;
}

async function loadProgress(
  supabase: any,
  playerId: string,
  seriesKey: string,
  weekNumber: number,
) {
  const { data, error } = await supabase
    .from("progress")
    .select(
      "series_key, week_number, practice_count, current_scene, last_practice_date",
    )
    .eq("player_id", playerId)
    .eq("series_key", seriesKey)
    .eq("week_number", weekNumber)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (
    data || {
      series_key: seriesKey,
      week_number: weekNumber,
      practice_count: 0,
      current_scene: "start",
      last_practice_date: null,
    }
  );
}

async function loadDailyState(
  supabase: any,
  playerId: string,
  seriesKey: string,
  weekNumber: number,
  practiceDate: string,
) {
  const { count: recitalCount, error: recitalError } = await supabase
    .from("recital_events")
    .select("*", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("series_key", seriesKey)
    .eq("week_number", weekNumber)
    .eq("practice_date", practiceDate);

  if (recitalError) {
    throw recitalError;
  }

  const { data: practiceDone, error: practiceError } = await supabase
    .from("practice_events")
    .select("id")
    .eq("player_id", playerId)
    .eq("series_key", seriesKey)
    .eq("week_number", weekNumber)
    .eq("practice_date", practiceDate)
    .maybeSingle();

  if (practiceError) {
    throw practiceError;
  }

  const completed = Boolean(practiceDone);

  return {
    practiceDate,
    recitalCount: completed
      ? 5
      : Math.min(Number(recitalCount || 0), 5),
    goal: 5,
    completed,
  };
}

async function completePracticeDay(
  supabase: any,
  playerId: string,
  seriesKey: string,
  weekNumber: number,
  practiceDate: string,
) {
  const { error: practiceInsertError } = await supabase
    .from("practice_events")
    .insert({
      player_id: playerId,
      series_key: seriesKey,
      week_number: weekNumber,
      practice_date: practiceDate,
    });

  let advancedToday = false;

  if (practiceInsertError) {
    if (practiceInsertError.code !== "23505") {
      throw practiceInsertError;
    }
  } else {
    advancedToday = true;
  }

  const { count: completedDays, error: completedDaysError } = await supabase
    .from("practice_events")
    .select("*", { count: "exact", head: true })
    .eq("player_id", playerId)
    .eq("series_key", seriesKey)
    .eq("week_number", weekNumber);

  if (completedDaysError) {
    throw completedDaysError;
  }

  const practiceCount = Math.min(Number(completedDays || 0), 5);
  const currentScene =
    practiceCount >= 5 ? "complete" : `day_${practiceCount}`;

  const { data: progress, error: progressError } = await supabase
    .from("progress")
    .upsert(
      {
        player_id: playerId,
        series_key: seriesKey,
        week_number: weekNumber,
        practice_count: practiceCount,
        current_scene: currentScene,
        last_practice_date: practiceDate,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "player_id,series_key,week_number",
      },
    )
    .select(
      "series_key, week_number, practice_count, current_scene, last_practice_date",
    )
    .single();

  if (progressError) {
    throw progressError;
  }

  return {
    advancedToday,
    progress,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const supabase = getAdminClient();
    const playerId = await getPlayerId(req, supabase);

    if (!playerId) {
      return json(
        {
          error: "Game session is invalid.",
          code: "INVALID_SESSION",
        },
        401,
      );
    }

    if (req.method === "GET") {
      const url = new URL(req.url);

      const seriesKey = validSeries(
        url.searchParams.get("seriesKey"),
      );
      const weekNumber = validWeek(
        url.searchParams.get("weekNumber"),
      );
      const practiceDate = validDate(
        url.searchParams.get("practiceDate"),
      );

      if (
        !seriesKey ||
        weekNumber === null ||
        !practiceDate
      ) {
        return json(
          {
            error: "Invalid progress query.",
          },
          400,
        );
      }

      const progress = await loadProgress(
        supabase,
        playerId,
        seriesKey,
        weekNumber,
      );

      const daily = await loadDailyState(
        supabase,
        playerId,
        seriesKey,
        weekNumber,
        practiceDate,
      );

      return json({
        ok: true,
        progress,
        daily,
      });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      if (body.action !== "recital") {
        return json(
          {
            error: "Unsupported action.",
          },
          400,
        );
      }

      const seriesKey = validSeries(body.seriesKey);
      const weekNumber = validWeek(body.weekNumber);
      const practiceDate = validDate(body.practiceDate);
      const eventId = validEventId(body.eventId);

      if (
        !seriesKey ||
        weekNumber === null ||
        !practiceDate ||
        !eventId
      ) {
        return json(
          {
            error: "Invalid recital data.",
          },
          400,
        );
      }

      const before = await loadDailyState(
        supabase,
        playerId,
        seriesKey,
        weekNumber,
        practiceDate,
      );

      if (before.completed) {
        return json({
          ok: true,
          duplicate: false,
          advancedToday: false,
          progress: await loadProgress(
            supabase,
            playerId,
            seriesKey,
            weekNumber,
          ),
          daily: before,
        });
      }

      const { error: recitalInsertError } = await supabase
        .from("recital_events")
        .insert({
          player_id: playerId,
          series_key: seriesKey,
          week_number: weekNumber,
          practice_date: practiceDate,
          event_id: eventId,
        });

      const duplicate =
        recitalInsertError?.code === "23505";

      if (recitalInsertError && !duplicate) {
        throw recitalInsertError;
      }

      let daily = await loadDailyState(
        supabase,
        playerId,
        seriesKey,
        weekNumber,
        practiceDate,
      );

      if (daily.recitalCount < 5) {
        return json({
          ok: true,
          duplicate,
          advancedToday: false,
          progress: await loadProgress(
            supabase,
            playerId,
            seriesKey,
            weekNumber,
          ),
          daily,
        });
      }

      const completion = await completePracticeDay(
        supabase,
        playerId,
        seriesKey,
        weekNumber,
        practiceDate,
      );

      daily = await loadDailyState(
        supabase,
        playerId,
        seriesKey,
        weekNumber,
        practiceDate,
      );

      return json({
        ok: true,
        duplicate,
        advancedToday: completion.advancedToday,
        progress: completion.progress,
        daily,
      });
    }

    return json(
      {
        error: "Method not allowed",
      },
      405,
    );
  } catch (error) {
    console.error(error);

    return json(
      {
        error: "Unexpected server error.",
      },
      500,
    );
  }
});
