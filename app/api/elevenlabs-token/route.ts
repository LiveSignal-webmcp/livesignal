export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedOrigin = (origin: string | null) => {
  if (!origin) return false;
  return origin.startsWith("chrome-extension://") ||
    origin === "https://livesignal-chi.vercel.app" ||
    origin === "http://localhost:3000";
};

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": allowedOrigin(origin) ? origin! : "null",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Vary": "Origin"
});

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: allowedOrigin(origin) ? 204 : 403,
    headers: corsHeaders(origin)
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!allowedOrigin(origin)) {
    return Response.json({ error: "Origin is not allowed." }, { status: 403, headers: corsHeaders(origin) });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Realtime transcription is not configured." }, { status: 503, headers: corsHeaders(origin) });
  }

  const response = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    cache: "no-store"
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": response.headers.get("content-type") || "application/json"
    }
  });
}
