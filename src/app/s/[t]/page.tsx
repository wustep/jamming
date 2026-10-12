import type { Metadata } from "next";
import { Home } from "@/components/Home";
import { shareCardFor } from "@/state/card";

// A shared jam's own address (/s/2.…, or an older /s/1.…): the app, which plays the take it carries (see
// openSharedLink in the store), with a title, description and card for the link's preview.

export async function generateMetadata({ params }: PageProps<"/s/[t]">): Promise<Metadata> {
  const card = shareCardFor((await params).t);
  if (!card) return {};
  const title = `${card.headline} · Jamming`;
  return {
    title,
    description: card.description,
    openGraph: { title, description: card.description, siteName: "Jamming", type: "website" },
    twitter: { card: "summary_large_image", title, description: card.description },
  };
}

export default function SharedTakePage() {
  return <Home />;
}
