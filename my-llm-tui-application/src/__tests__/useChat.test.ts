import { describe, it, expect, beforeEach } from "vitest";
import { ChatStore } from "../hooks/useChat.ts";

describe("ChatStore", () => {
  let store: ChatStore;

  beforeEach(() => {
    store = new ChatStore();
  });

  describe("初期状態", () => {
    it("メッセージが空であること", () => {
      expect(store.getMessages()).toEqual([]);
    });

    it("ローディング状態がfalseであること", () => {
      expect(store.isLoading()).toBe(false);
    });
  });

  describe("addUserMessage", () => {
    it("ユーザーメッセージを追加できること", () => {
      store.addUserMessage("こんにちは");

      const messages = store.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]!.role).toBe("user");
      expect(messages[0]!.content).toBe("こんにちは");
    });

    it("複数のメッセージを追加できること", () => {
      store.addUserMessage("メッセージ1");
      store.addUserMessage("メッセージ2");

      const messages = store.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0]!.content).toBe("メッセージ1");
      expect(messages[1]!.content).toBe("メッセージ2");
    });

    it("メッセージにユニークなIDが付与されること", () => {
      store.addUserMessage("メッセージ1");
      store.addUserMessage("メッセージ2");

      const messages = store.getMessages();
      expect(messages[0]!.id).not.toBe(messages[1]!.id);
    });
  });

  describe("addAssistantMessage", () => {
    it("アシスタントメッセージを追加できること", () => {
      store.addAssistantMessage("応答です");

      const messages = store.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]!.role).toBe("assistant");
      expect(messages[0]!.content).toBe("応答です");
    });
  });

  describe("updateLastAssistantMessage", () => {
    it("最後のアシスタントメッセージを更新できること", () => {
      store.addAssistantMessage("部分的な");
      store.updateLastAssistantMessage("部分的な応答");

      const messages = store.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]!.content).toBe("部分的な応答");
    });

    it("アシスタントメッセージがない場合は何もしないこと", () => {
      store.addUserMessage("テスト");
      store.updateLastAssistantMessage("更新");

      const messages = store.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0]!.content).toBe("テスト");
    });
  });

  describe("setLoading", () => {
    it("ローディング状態を変更できること", () => {
      store.setLoading(true);
      expect(store.isLoading()).toBe(true);

      store.setLoading(false);
      expect(store.isLoading()).toBe(false);
    });
  });

  describe("getMessagesForApi", () => {
    it("API送信用のメッセージ形式に変換できること", () => {
      store.addUserMessage("こんにちは");
      store.addAssistantMessage("こんにちは！");
      store.addUserMessage("元気ですか？");

      const apiMessages = store.getMessagesForApi();
      expect(apiMessages).toEqual([
        { role: "user", content: "こんにちは" },
        { role: "assistant", content: "こんにちは！" },
        { role: "user", content: "元気ですか？" },
      ]);
    });
  });
});
