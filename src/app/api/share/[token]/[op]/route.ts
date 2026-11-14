import { fail } from "@/lib/api";
const disabled = () => fail("Public approval links are disabled during the pilot.", 403, { code: "SHARING_DISABLED" });
export const GET = disabled;
export const POST = disabled;
export const DELETE = disabled;
