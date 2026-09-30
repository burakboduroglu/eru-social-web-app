import { describe, expect, test } from "bun:test";
import { parseMediaUrl } from "../src/lib/media";

describe("parseMediaUrl", () => {
  test("recognizes supported YouTube URL forms", () => {
    for (const input of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?t=2",
    ]) expect(parseMediaUrl(input)).toEqual({ type: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });

  test("recognizes Spotify supported embed types", () => {
    for (const type of ["track", "album", "playlist", "episode"]) {
      const id = "0123456789012345678901";
      expect(parseMediaUrl(`https://open.spotify.com/${type}/${id}`)).toEqual({ type: "spotify", embedUrl: `https://open.spotify.com/embed/${type}/${id}` });
    }
  });

  test("recognizes hosted GIFs and public post media", () => {
    expect(parseMediaUrl("https://media.tenor.com/abc123/tenor.gif")).toEqual({ type: "gif", url: "https://media.tenor.com/abc123/tenor.gif" });
    expect(parseMediaUrl("https://media.giphy.com/media/abc123/giphy.gif")).toEqual({ type: "gif", url: "https://media.giphy.com/media/abc123/giphy.gif" });
    expect(parseMediaUrl("https://project.supabase.co/storage/v1/object/public/post-media/posts/one.gif")).toMatchObject({ type: "post-media", mediaType: "image" });
    expect(parseMediaUrl("https://project.supabase.co/storage/v1/object/public/post-media/posts/clip.mp4")).toMatchObject({ type: "post-media", mediaType: "video" });
  });

  test("rejects spoofed hosts, unsupported paths, malformed IDs, and unsafe schemes", () => {
    for (const input of [
      "javascript:alert(1)",
      "https://youtube.com.example.org/watch?v=dQw4w9WgXcQ",
      "https://youtu.be.evil.test/dQw4w9WgXcQ",
      "https://youtube.com/watch?v=short",
      "https://open.spotify.com/artist/0123456789012345678901",
      "https://open.spotify.com/track/short",
      "https://media.giphy.com.evil.test/a.gif",
      "https://project.supabase.co.evil.test/storage/v1/object/public/post-media/a.gif",
      "https://project.supabase.co/storage/v1/object/public/other-bucket/a.gif",
    ]) expect(parseMediaUrl(input)).toBeNull();
  });
});
