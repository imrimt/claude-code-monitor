declare module 'qrcode-terminal' {
  interface QRCodeOptions {
    small?: boolean;
  }

  function generate(
    text: string,
    options?: QRCodeOptions,
    callback?: (qrcode: string) => void
  ): void;
  function generate(text: string, callback?: (qrcode: string) => void): void;

  export { generate };
}
