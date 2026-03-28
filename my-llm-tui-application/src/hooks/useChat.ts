import { useState, useCallback } from "react";
import type { Message, Role } from "../types.ts";

let nextId = 0;
function generateId(): string {
  return `msg-${Date.now()}-${nextId++}`;
}

export class ChatStore {
  private messages: Message[] = [];
  private loading = false;

  getMessages(): Message[] {
    return [...this.messages];
  }

  isLoading(): boolean {
    return this.loading;
  }

  addUserMessage(content: string): void {
    this.messages.push({
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    });
  }

  addAssistantMessage(content: string): void {
    this.messages.push({
      id: generateId(),
      role: "assistant",
      content,
      timestamp: new Date(),
    });
  }

  updateLastAssistantMessage(content: string): void {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i]!.role === "assistant") {
        this.messages[i] = { ...this.messages[i]!, content };
        return;
      }
    }
  }

  setLoading(loading: boolean): void {
    this.loading = loading;
  }

  getMessagesForApi(): { role: Role; content: string }[] {
    return this.messages.map(({ role, content }) => ({ role, content }));
  }
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const store = new ChatStore();

  const addUserMessage = useCallback((content: string) => {
    const newMessage: Message = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  const addAssistantMessage = useCallback((content: string) => {
    const newMessage: Message = {
      id: generateId(),
      role: "assistant",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage;
  }, []);

  const updateLastAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i]!.role === "assistant") {
          updated[i] = { ...updated[i]!, content };
          break;
        }
      }
      return updated;
    });
  }, []);

  return {
    messages,
    loading,
    setLoading,
    addUserMessage,
    addAssistantMessage,
    updateLastAssistantMessage,
  };
}
