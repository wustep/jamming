import { appIcon } from "./share-card";

// The tab icon, and the sizes an installed app asks for (see manifest.ts).
export function generateImageMetadata() {
  return [
    { id: "32", size: { width: 32, height: 32 }, contentType: "image/png" },
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
    { id: "maskable", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const which = await id;
  return which === "maskable" ? appIcon(512, 0.62) : appIcon(Number(which) || 32, Number(which) <= 32 ? 1 : 0.82);
}
