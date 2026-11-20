import { timingSafeEqual } from "node:crypto";
import { errorResponse } from "@/lib/server/catalog-db";

export function authorizeAdmin(request: Request) {
  const expectedToken = process.env.ADMIN_API_TOKEN;
  if (!expectedToken) {
    return errorResponse(
      "A configuração server-side ADMIN_API_TOKEN é necessária para operações de escrita.",
      503,
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const providedToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  const authorized =
    provided.length === expected.length &&
    timingSafeEqual(provided, expected);

  return authorized
    ? null
    : errorResponse("Token administrativo inválido ou ausente.", 401);
}
