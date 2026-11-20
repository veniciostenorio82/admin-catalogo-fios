import {
  databaseErrorResponse,
  errorResponse,
  getCatalogSql,
  parseProductId,
  toProduct,
  type ProductRow,
} from "@/lib/server/catalog-db";
import { authorizeAdmin } from "@/lib/server/authorize-admin";

type ProductPatch = {
  name?: unknown;
  price?: unknown;
  description?: unknown;
  category?: unknown;
  images?: unknown;
};

async function readPatch(request: Request): Promise<ProductPatch | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as ProductPatch)
      : null;
  } catch {
    return null;
  }
}

function validatePatch(body: ProductPatch) {
  const errors: string[] = [];
  if (Object.keys(body).length === 0) errors.push("Informe ao menos um campo.");
  if (
    Object.hasOwn(body, "name") &&
    (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120)
  ) {
    errors.push("Nome obrigatório com até 120 caracteres.");
  }
  if (
    Object.hasOwn(body, "price") &&
    (typeof body.price !== "number" ||
      !Number.isFinite(body.price) ||
      body.price < 0)
  ) {
    errors.push("Preço deve ser um número não negativo.");
  }
  if (
    Object.hasOwn(body, "description") &&
    (typeof body.description !== "string" || body.description.length > 1000)
  ) {
    errors.push("Descrição deve ter até 1000 caracteres.");
  }
  if (
    Object.hasOwn(body, "category") &&
    (typeof body.category !== "string" ||
      !body.category.trim() ||
      body.category.length > 80)
  ) {
    errors.push("Categoria obrigatória com até 80 caracteres.");
  }
  if (Object.hasOwn(body, "images")) {
    if (!Array.isArray(body.images) || body.images.length > 1) {
      errors.push("O banco atual aceita no máximo uma imagem por peça.");
    } else if (
      body.images.length === 1 &&
      (!body.images[0] ||
        typeof body.images[0] !== "object" ||
        !("url" in body.images[0]) ||
        typeof body.images[0].url !== "string" ||
        !/^(https?:\/\/|\/(?!\/))/.test(body.images[0].url))
    ) {
      errors.push("A imagem deve ser uma URL HTTP(S) ou um caminho local.");
    }
  }
  return errors;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorizationError = authorizeAdmin(request);
  if (authorizationError) return authorizationError;
  const { id } = await params;
  const numericId = parseProductId(id);
  if (!numericId) return errorResponse("Identificador de peça inválido.", 400);

  const body = await readPatch(request);
  if (!body) return errorResponse("Corpo JSON inválido.", 400);
  const errors = validatePatch(body);
  if (errors.length) return errorResponse(errors.join(" "), 400);

  const fields = {
    name: Object.hasOwn(body, "name"),
    price: Object.hasOwn(body, "price"),
    description: Object.hasOwn(body, "description"),
    category: Object.hasOwn(body, "category"),
    images: Object.hasOwn(body, "images"),
  };
  const imageUrl =
    fields.images && Array.isArray(body.images) && body.images.length === 1
      ? (body.images[0] as { url: string }).url
      : null;

  try {
    const sql = getCatalogSql();
    const result = await sql`
      UPDATE products
      SET "productName" = CASE WHEN ${fields.name} THEN ${(body.name as string | undefined)?.trim() ?? null} ELSE "productName" END,
          price = CASE WHEN ${fields.price} THEN ${body.price as number | undefined} ELSE price END,
          description = CASE WHEN ${fields.description} THEN ${(body.description as string | undefined)?.trim() ?? null} ELSE description END,
          category = CASE WHEN ${fields.category} THEN ${(body.category as string | undefined)?.trim() ?? null} ELSE category END,
          images = CASE WHEN ${fields.images} THEN ${imageUrl} ELSE images END
      WHERE id = ${numericId}
      RETURNING id, "productName" AS name, price::text AS price,
                description, images, category
    `;
    const rows = result as unknown as ProductRow[];
    if (!rows[0]) return errorResponse("Peça não encontrada.", 404);
    return Response.json(toProduct(rows[0]));
  } catch {
    return databaseErrorResponse();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorizationError = authorizeAdmin(request);
  if (authorizationError) return authorizationError;
  const { id } = await params;
  const numericId = parseProductId(id);
  if (!numericId) return errorResponse("Identificador de peça inválido.", 400);

  try {
    const sql = getCatalogSql();
    const rows = await sql`
      DELETE FROM products WHERE id = ${numericId} RETURNING id
    `;
    if (!rows[0]) return errorResponse("Peça não encontrada.", 404);
    return new Response(null, { status: 204 });
  } catch {
    return databaseErrorResponse();
  }
}
