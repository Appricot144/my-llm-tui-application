import { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { isPrintableCharacter } from "../utils/inputHelper.ts";

interface ChatInputProps {
  onSubmit: (value: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleKey = useCallback((key: KeyEvent) => {
    if (disabled) return;

    if (key.name === "return") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        onSubmit(trimmed);
        setValue("");
      }
      return;
    }

    if (key.name === "backspace") {
      setValue((prev) => {
        if (prev.length === 0) return prev;
        // サロゲートペアを考慮して末尾の1文字を削除
        const chars = [...prev];
        chars.pop();
        return chars.join("");
      });
      return;
    }

    // Ctrl+U: 行をクリア
    if (key.name === "u" && key.ctrl) {
      setValue("");
      return;
    }

    // 印字可能な文字を入力に追加
    const char = key.sequence;
    if (char && isPrintableCharacter(char)) {
      setValue((prev) => prev + char);
    }
  }, [disabled, value, onSubmit]);

  useKeyboard(handleKey);

  const displayValue = value || (disabled ? "応答待ち..." : "メッセージを入力...");
  const isPlaceholder = value.length === 0;

  return (
    <box
      flexDirection="row"
      borderStyle="rounded"
      border={true}
      borderColor={disabled ? "#555555" : "#4fc3f7"}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg="#4fc3f7" attributes={1}>{">"} </text>
      <text fg={isPlaceholder ? "#666666" : "#ffffff"}>
        {displayValue}{!disabled && !isPlaceholder ? "█" : ""}
      </text>
    </box>
  );
}
