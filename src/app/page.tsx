import { Memo } from "@/types";
import MemoList from "@/components/MemoList";

async function getMemos(): Promise<Memo[]> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/memos`, {
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Failed to fetch memos:", res.status);
      return [];
    }

    const json = await res.json();
    return json.data || [];
  } catch (error) {
    console.error("Error fetching memos:", error);
    return [];
  }
}

export default async function Home() {
  const memos = await getMemos();
  return <MemoList memos={memos} />;
}
