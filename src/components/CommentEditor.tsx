"use client";

import { useState, useEffect, useRef } from "react";

const SUIT_SHORTCUTS: Record<string, string> = {
  "!S": "\u2660",
  "!H": "\u2665",
  "!D": "\u2666",
  "!C": "\u2663",
};

function replaceSuitShortcuts(text: string): string {
  let result = text;
  for (const [shortcut, symbol] of Object.entries(SUIT_SHORTCUTS)) {
    result = result.replaceAll(shortcut, symbol);
  }
  return result;
}

export default function CommentEditor({
  initialComment,
  onCommentChange,
}: {
  initialComment: string | null;
  onCommentChange: (comment: string) => void;
}) {
  const [comment, setComment] = useState(initialComment || "");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onCommentChange(comment);
    }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [comment, onCommentChange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    const pos = textarea.selectionStart;
    const val = textarea.value;

    // Check if we just typed a suit shortcut (e.g., "!S")
    for (const shortcut of Object.keys(SUIT_SHORTCUTS)) {
      if (val.substring(pos - shortcut.length, pos) === shortcut) {
        const replaced = val.substring(0, pos - shortcut.length) + SUIT_SHORTCUTS[shortcut] + val.substring(pos);
        setComment(replaced);
        // Adjust cursor position
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = pos - shortcut.length + 1;
        }, 0);
        return;
      }
    }

    setComment(val);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-600 mb-2">コメント・反省メモ</h3>
      <textarea
        ref={textareaRef}
        value={comment}
        onChange={handleChange}
        placeholder="このボードの反省点、次回に活かしたいことなどを記入..."
        className="w-full h-32 p-3 text-sm border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#1a5c2e] focus:border-transparent"
      />
      <div className="text-[10px] text-gray-400 mt-1">
        !S=♠ !H=♥ !D=♦ !C=♣
      </div>
    </div>
  );
}
