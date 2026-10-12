import { describe, expect, it } from "vitest";
import { takeFileName } from "./stage/clip";

describe("saving a take", () => {
  it("names the file after the take, in the format the browser recorded", () => {
    expect(takeFileName("Swing · improvised", "audio/webm;codecs=opus")).toBe("Swing · improvised · Jamming.webm");
    expect(takeFileName("Autumn Leaves · composed", "audio/mp4")).toBe("Autumn Leaves · composed · Jamming.m4a");
    expect(takeFileName('a/b: "c"?', "audio/ogg;codecs=opus")).toBe("a b c · Jamming.ogg");
    expect(takeFileName("  ", "audio/webm")).toBe("take · Jamming.webm");
  });

  it("gives a video clip a video extension", () => {
    expect(takeFileName("Bossa Nova", "video/mp4;codecs=avc1.42E01E,mp4a.40.2")).toBe("Bossa Nova · Jamming.mp4");
    expect(takeFileName("Bossa Nova", "video/webm;codecs=vp9,opus")).toBe("Bossa Nova · Jamming.webm");
  });
});
