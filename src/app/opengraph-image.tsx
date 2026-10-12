import { CARD_SIZE, shareCardImage } from "./share-card";

export const alt = "Jamming: a band of doodled animals that improvise music together";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default function Image() {
  return shareCardImage(null);
}
