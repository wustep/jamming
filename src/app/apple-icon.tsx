import { appIcon } from "./share-card";

// A phone's home screen ("Add to Home Screen"), which otherwise shows a screenshot of the page.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}
