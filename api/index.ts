import app from "../backend/app.js";
// Remove Vercel's lazy body getter without reading it. Express must receive the
// original bytes, particularly for Meta's exact-body HMAC webhook signature.
export default function handler(req: any, res: any) {
  const descriptor = Object.getOwnPropertyDescriptor(req, "body");
  if (descriptor?.get && descriptor.configurable) {
    Object.defineProperty(req, "body", {
      value: undefined,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  return app(req, res);
}
