import { TranslationDictionary } from "../../i18n/translations";
import { cn } from "../../theme/styles";

export function getFunnyComment(money: number, status: string, t: TranslationDictionary): string {
  const comments = (t.result as any).funnyComments ?? (t as any).funnyComments;

  if (!comments) return "";
  if (status === "won") return comments.winner;
  if (money === 0) return comments.zero;
  if (money <= 100) return comments.tiny;
  if (money <= 1_000) return comments.small;
  if (money <= 10_000) return comments.medium;
  if (money <= 50_000) return comments.good;
  if (money <= 100_000) return comments.great;
  if (money <= 500_000) return comments.amazing;
  return comments.almostMillion;
}

type FunnyCommentProps = {
  comment: string;
  tone: "win" | "lost" | "neutral";
  isLight: boolean;
  className?: string;
};

export default function FunnyComment({ comment, tone, isLight, className }: FunnyCommentProps) {
  if (!comment) return null;

  return (
    <p
      className={cn(
        "mt-3 text-base font-black italic sm:text-lg",
        className ?? (tone === "win" ? (isLight ? "text-orange-600" : "text-yellow-300") : "text-red-300")
      )}
    >
      {comment}
    </p>
  );
}
