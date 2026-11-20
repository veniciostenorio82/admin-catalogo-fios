import {
  databaseErrorResponse,
  getCatalogSql,
  toProduct,
  type ProductRow,
} from "@/lib/server/catalog-db";
import { authorizeAdmin } from "@/lib/server/authorize-admin";

type ProductBody = {
  name?: unknown;
  price?: unknown;
  description?: unknown;
  category?: unknown;
  images?: unknown;
};

function validateProductBody(body: ProductBody, partial = false) {
  const errors: string[] = [];
  const required = (key: keyof ProductBody) =>
    !partial || Object.hasOwn(body, key);

  if (
    required("name") &&
    (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120)
  ) {
    errors.push("Nome obrigatório com até 120 caracteres.");
  }
  if (
    required("price") &&
    (typeof body.price !== "number" ||
      !Number.isFinite(body.price) ||
      body.price < 0)
  ) {
    errors.push("Preço deve ser um número não negativo.");
  }
  if (
    required("description") &&
    (typeof body.description !== "string" || body.description.length > 1000)
  ) {
    errors.push("Descrição deve ter até 1000 caracteres.");
  }
  if (
    required("category") &&
    (typeof body.category !== "string" ||
      !body.category.trim() ||
      body.category.length > 80)
  ) {
    errors.push("Categoria obrigatória com até 80 caracteres.");
  }
  if (required("images")) {
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

async function readJson(request: Request): Promise<ProductBody | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as ProductBody)
      : null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const sql = getCatalogSql();
    const result = await sql`
      SELECT id, "productName" AS name, price::text AS price,
             description, images, category
      FROM products
      ORDER BY id
    `;
    const rows = result as unknown as ProductRow[];
    return Response.json(rows.map(toProduct));
  } catch {
    return databaseErrorResponse();
  }
}

export async function POST(request: Request) {
  const authorizationError = authorizeAdmin(request);
  if (authorizationError) return authorizationError;

  const body = await readJson(request);
  if (!body) return Response.json({ error: "Corpo JSON inválido." }, { status: 400 });
  const errors = validateProductBody(body);
  if (errors.length) return Response.json({ error: errors.join(" ") }, { status: 400 });

  const imageUrl =
    Array.isArray(body.images) && body.images.length === 1
      ? (body.images[0] as { url: string }).url
      : null;
  try {
    const sql = getCatalogSql();
    const result = await sql`
      INSERT INTO products ("productName", price, description, images, category)
      VALUES (${(body.name as string).trim()}, ${body.price as number},
              ${(body.description as string).trim()}, ${imageUrl},
              ${(body.category as string).trim()})
      RETURNING id, "productName" AS name, price::text AS price,
                description, images, category
    `;
    const rows = result as unknown as ProductRow[];
    return Response.json(toProduct(rows[0]), { status: 201 });
  } catch {
    return databaseErrorResponse();
  }
}
