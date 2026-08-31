import { generateImage } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RateEntry = { count: number; resetAt: number };

const rateStore = globalThis as typeof globalThis & {
  __liveSignalImageRate?: Map<string, RateEntry>;
};
const imageRate =
  rateStore.__liveSignalImageRate ??
  (rateStore.__liveSignalImageRate = new Map<string, RateEntry>());

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function withinRateLimit(request: Request) {
  const key =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const existing = imageRate.get(key);
  if (!existing || existing.resetAt <= now) {
    imageRate.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (existing.count >= 4) return false;
  existing.count += 1;
  return true;
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin is not allowed." }, { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  const gatewayToken =
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    request.headers.get("x-vercel-oidc-token");
  const hasGatewayAuth = Boolean(
    gatewayToken,
  );
  if (!apiKey && !hasGatewayAuth)
    return Response.json(
      { error: "Image generation is not configured." },
      { status: 503 },
    );
  if (!withinRateLimit(request))
    return Response.json(
      { error: "Image limit reached. Try again in a few minutes." },
      { status: 429 },
    );

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20_000)
    return Response.json({ error: "Image request is too large." }, { status: 413 });

  const body = await request.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim().slice(0, 1_200);
  const title = String(body.title ?? "Canvas card").trim().slice(0, 160);
  const cardBody = String(body.body ?? "").trim().slice(0, 900);
  const theme = ["notebook", "editorial", "field-notes"].includes(
    String(body.theme),
  )
    ? String(body.theme)
    : "notebook";
  if (!prompt)
    return Response.json(
      { error: "Describe the illustration to generate." },
      { status: 400 },
    );

  const composedPrompt = [
    "Create one polished editorial illustration for a shareable research card.",
    `Visual direction from the human: ${prompt}`,
    `Card title: ${title}`,
    cardBody ? `Card context: ${cardBody}` : "",
    `Canvas mood: ${theme.replace("-", " ")}.`,
    "Use a tactile magazine or sketchbook sensibility with a strong central subject and clean composition.",
    "Do not include lettering, captions, logos, watermarks, UI, or factual labels in the image.",
    "This is an AI-generated illustration, not documentary evidence.",
  ]
    .filter(Boolean)
    .join("\n");

  if (hasGatewayAuth) {
    const gatewayModel =
      process.env.AI_GATEWAY_IMAGE_MODEL || "prodia/flux-fast-schnell";
    try {
      const { image } = await generateImage({
        model: gatewayModel,
        prompt: composedPrompt,
        aspectRatio: "1:1",
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(50_000),
        headers: gatewayToken
          ? { Authorization: `Bearer ${gatewayToken}` }
          : undefined,
        providerOptions: {
          gateway: {
            tags: ["feature:canvas-illustration", "app:livesignal"],
          },
        },
      });
      return new Response(Buffer.from(image.uint8Array), {
        status: 200,
        headers: {
          "Content-Type": image.mediaType || "image/png",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "X-LiveSignal-Image-Model": gatewayModel,
        },
      });
    } catch (error) {
      if (!apiKey) {
        const statusCode = Number(
          (error as { statusCode?: unknown })?.statusCode ?? 502,
        );
        const status = [400, 401, 402, 403, 408, 429].includes(statusCode)
          ? statusCode
          : 502;
        const message =
          status === 402
            ? "Image generation credits are unavailable."
            : status === 429
              ? "The image service is busy. Try again shortly."
              : "The image service could not complete this illustration.";
        console.error("LiveSignal AI Gateway image error", error);
        return Response.json({ error: message }, { status });
      }
      console.error(
        "LiveSignal AI Gateway image error; trying OpenAI fallback",
        error,
      );
    }
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";

  const imageResponse = await fetch(
    "https://api.openai.com/v1/images/generations",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: composedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "low",
        output_format: "webp",
        output_compression: 82,
      }),
      cache: "no-store",
    },
  );

  const result = await imageResponse.json().catch(() => ({}));
  if (!imageResponse.ok) {
    const message = String(
      result?.error?.message ?? "The image provider rejected this request.",
    );
    return Response.json({ error: message }, { status: imageResponse.status });
  }

  const encoded = result?.data?.[0]?.b64_json;
  if (!encoded)
    return Response.json(
      { error: "The image provider returned no image." },
      { status: 502 },
    );

  return new Response(Buffer.from(encoded, "base64"), {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-LiveSignal-Image-Model": model,
    },
  });
}
