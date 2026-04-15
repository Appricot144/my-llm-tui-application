import { useState, useCallback } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent } from "@opentui/core";
import { isPrintableCharacter } from "../utils/inputHelper.ts";
import type { PendingConfirm } from "../index.tsx";

interface ChatInputProps {
  onSubmit: (value: string) => void;
  onModeChange: () => void;
  disabled: boolean;
  pendingConfirm?: PendingConfirm | null;
  onConfirm?: (confirmed: boolean) => void;
}

export function ChatInput({
  onSubmit,
  onModeChange,
  disabled,
  pendingConfirm,
  onConfirm,
}: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleKey = useCallback((key: KeyEvent) => {
    // 承認モード: Y/Enter で承認、N で拒否
    if (pendingConfirm && onConfirm) {
      if (key.name === "return" || key.sequence?.toLowerCase() === "y") {
        onConfirm(true);
      } else if (key.sequence?.toLowerCase() === "n") {
        onConfirm(false);
      }
      return;
    }

    if (disabled) return;

    // Shift+Tab: モード切替
    if (key.name === "tab" && key.shift) {
      onModeChange();
      return;
    }

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
  }, [disabled, value, onSubmit, onModeChange, pendingConfirm, onConfirm]);

  useKeyboard(handleKey);

  // 承認モードの表示
  if (pendingConfirm) {
    const inputPreview = JSON.stringify(pendingConfirm.input).slice(0, 60);
    return (
      <box
        flexDirection="column"
        borderStyle="rounded"
        border={true}
        borderColor="#f4a261"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg="#f4a261" attributes={1}>
          {`[承認待ち] ${pendingConfirm.toolName}(${inputPreview})`}
        </text>
        <box flexDirection="row">
          <text fg="#f4a261" attributes={1}>{"?"} </text>
          <text fg="#ffffff">実行しますか？ </text>
          <text fg="#4fc3f7">[Y]es </text>
          <text fg="#888888">[n]o</text>
        </box>
      </box>
    );
  }

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
