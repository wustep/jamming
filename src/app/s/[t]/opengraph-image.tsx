import { CARD_SIZE, shareCardImage } from "@/app/share-card";
import { shareCardFor } from "@/state/card";

export const alt = "A jam on Jamming: the band, the tune and its style";
export const size = CARD_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ t: string }> }) {
  return shareCardImage(shareCardFor((await params).t));
}
