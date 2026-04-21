export function splitUserMessageLines(content: string): string[] {
  return content.split("\n");
}

export function isStreamingMessage(loading: boolean, idx: number, total: number): boolean {
  return loading && idx === total - 1;
}
