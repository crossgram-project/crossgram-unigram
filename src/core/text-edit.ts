export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

function uniqueIndex(source: string, anchor: string, file: string): number {
  const first = source.indexOf(anchor);
  if (first < 0) throw new PatchError(`${file}: missing anchor ${JSON.stringify(anchor)}`);
  if (source.indexOf(anchor, first + anchor.length) >= 0) {
    throw new PatchError(`${file}: ambiguous anchor ${JSON.stringify(anchor)}`);
  }
  return first;
}

export function insertAfterOnce(
  source: string,
  anchor: string,
  insertion: string,
  marker: string,
  file: string,
): string {
  if (source.includes(marker)) return source;
  const index = uniqueIndex(source, anchor, file) + anchor.length;
  return source.slice(0, index) + insertion + source.slice(index);
}

export function insertBeforeOnce(
  source: string,
  anchor: string,
  insertion: string,
  marker: string,
  file: string,
): string {
  if (source.includes(marker)) return source;
  const index = uniqueIndex(source, anchor, file);
  return source.slice(0, index) + insertion + source.slice(index);
}

export function replaceOnce(
  source: string,
  anchor: string,
  replacement: string,
  marker: string,
  file: string,
): string {
  if (source.includes(marker)) return source;
  const index = uniqueIndex(source, anchor, file);
  return source.slice(0, index) + replacement + source.slice(index + anchor.length);
}
