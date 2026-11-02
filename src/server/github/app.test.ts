import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAppJwt } from "./app";

describe("createAppJwt", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
  const now = Date.UTC(2026, 10, 2, 12, 0, 0);
  const jwt = createAppJwt({ appId: "123456", privateKey: pem }, now);
  const [header, payload, signature] = jwt.split(".");

  it("is an RS256 JWT", () => {
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
  });

  it("issues for the app with GitHub's allowed lifetime and clock-drift margin", () => {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.iss).toBe("123456");
    expect(claims.iat).toBe(now / 1000 - 60);
    expect(claims.exp - claims.iat).toBe(600); // GitHub allows at most 10 minutes
  });

  it("is signed with the private key", () => {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(publicKey, signature, "base64url")).toBe(true);
  });
});
