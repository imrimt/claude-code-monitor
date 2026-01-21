/**
 * Read all data from stdin and parse as JSON.
 * @throws {SyntaxError} If the input is not valid JSON
 */
export async function readJsonFromStdin<T>(): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const input = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(input) as T;
}
