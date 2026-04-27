export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role | "diff";
  content: string;
  timestamp: Date;
  diffMeta?: {
    unifiedDiff: string;
    filePath: string;
    fileExtension: string;
  };
}
