import { NextResponse } from "next/server";
import { fetchTranscript } from "youtube-transcript-plus";

export const runtime = "nodejs";

function videoIdFrom(value: string) {
  const trimmed = value.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (
      !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
        url.hostname,
      )
    )
      return null;
    if (url.hostname === "youtu.be")
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const parts = url.pathname.split("/").filter(Boolean);
    if (["shorts", "live", "embed"].includes(parts[0])) return parts[1] ?? null;
  } catch {
    return null;
  }
  return null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const input = String(body.url ?? body.videoId ?? "");
  const videoId = videoIdFrom(input);
  if (!videoId)
    return NextResponse.json(
      { error: "A valid public YouTube URL or video ID is required." },
      { status: 400 },
    );

  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const metadataResponse = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
    { next: { revalidate: 86400 } },
  ).catch(() => null);
  const metadata = metadataResponse?.ok ? await metadataResponse.json() : {};
  const baseSource = {
    id: videoId,
    videoId,
    url: watchUrl,
    title: metadata.title ?? `YouTube video ${videoId}`,
    creator: metadata.author_name ?? "YouTube creator",
    thumbnailUrl:
      metadata.thumbnail_url ??
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    platform: "YouTube",
  };

  try {
    const transcript = await fetchTranscript(videoId, {
      retries: 2,
      retryDelay: 400,
      videoDetails: true,
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/149.0.0.0 Safari/537.36",
    });
    const segments = transcript.segments.map((segment, index) => ({
      id: `${videoId}-${index}`,
      text: segment.text,
      seconds: Math.max(0, Number(segment.offset)),
      durationSeconds: Math.max(0, Number(segment.duration)),
      timestamp: formatTimestamp(Number(segment.offset)),
    }));
    return NextResponse.json(
      {
        source: {
          ...baseSource,
          title: transcript.videoDetails.title ?? baseSource.title,
          creator: transcript.videoDetails.author ?? baseSource.creator,
        },
        transcript: {
          available: segments.length > 0,
          segmentCount: segments.length,
          source: "youtube_captions",
          segments,
        },
      },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    return NextResponse.json({
      source: baseSource,
      transcript: {
        available: false,
        segmentCount: 0,
        source: "none",
        segments: [],
      },
      warning:
        "Public metadata was imported, but server-side captions were unavailable.",
      detail: String(error instanceof Error ? error.message : error),
      fallback:
        "Open the video with the LiveSignal browser adapter, expose its transcript, then import browser evidence into the workspace.",
    });
  }
}

function formatTimestamp(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
