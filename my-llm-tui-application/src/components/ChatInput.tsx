import { useRef, useCallback, useState } from "react";
import { useKeyboard } from "@opentui/react";
import type { KeyEvent, InputRenderable } from "@opentui/core";
import type { PendingConfirm } from "../index.tsx";
import { isCommandInput, parseCommand } from "../utils/commandParser.ts";

interface ChatInputProps {
  onSubmit: (value: string) => void;
  onCommand: (name: string, args: string) => void;
  onModeChange: () => void;
  disabled: boolean;
  pendingConfirm?: PendingConfirm | null;
  onConfirm?: (confirmed: boolean) => void;
}

export function ChatInput({
  onSubmit,
  onCommand,
  onModeChange,
  disabled,
  pendingConfirm,
  onConfirm,
}: ChatInputProps) {
  const inputRef = useRef<InputRenderable>(null);
  const [isCommandMode, setIsCommandMode] = useState(false);

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

    // Shift+Tab: モード切替
    if (key.name === "tab" && key.shift) {
      onModeChange();
      return;
    }

    // キー入力後に入力値を確認してコマンドモードを更新
    setTimeout(() => {
      const value = inputRef.current?.value ?? "";
      setIsCommandMode(isCommandInput(value));
    }, 0);
  }, [pendingConfirm, onConfirm, onModeChange]);

  useKeyboard(handleKey);

  const handleSubmit = useCallback(() => {
    const text = inputRef.current?.value ?? "";
    const trimmed = text.trim();
    if (trimmed.length === 0) return;

    const parsed = parseCommand(trimmed);
    if (parsed) {
      onCommand(parsed.commandName, parsed.args);
    } else {
      onSubmit(trimmed);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
    setIsCommandMode(false);
  }, [onSubmit, onCommand]);

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
        flexShrink={0}
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

  const borderColor = isCommandMode ? "#81c784" : (disabled ? "#555555" : "#4fc3f7");
  const promptColor = isCommandMode ? "#81c784" : "#4fc3f7";

  return (
    <box
      flexDirection="column"
      borderStyle="rounded"
      border={true}
      borderColor={borderColor}
      paddingLeft={1}
      paddingRight={1}
      flexShrink={0}
    >
      <box flexDirection="row" titleAlignment="right" title="branch">
        <text fg={promptColor} attributes={1}>{">"} </text>
        <input
          ref={inputRef}
          focused={!disabled}
          placeholder={disabled ? "応答待ち..." : "メッセージを入力... (/ でコマンドモード)"}
          placeholderColor="#666666"
          textColor="#ffffff"
          // ライブラリの型定義が TextareaOptions と InputProps で onSubmit の型が競合するためキャスト
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onSubmit={handleSubmit as any}
          keyBindings={[
            { name: "return", action: "submit" },
            { name: "linefeed", action: "submit" },
            { name: "u", ctrl: true, action: "delete-line" },
          ]}
          flexGrow={1}
        />
      </box>
      {isCommandMode && (
        <text fg="#81c784">{"  commands mode ..."}</text>
      )}
    </box>
  );
}
