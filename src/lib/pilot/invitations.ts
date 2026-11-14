import { createHash, randomBytes } from "node:crypto";
export const invitationHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const invitationToken = () => randomBytes(32).toString("hex");
