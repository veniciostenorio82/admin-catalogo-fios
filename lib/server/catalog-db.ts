import { neon } from "@neondatabase/serverless";

export type ProductRow = {
  id: number;
  name: string | null;
  price: string | null;
  description: string | null;
  images: string | null;
  category: string | null;
};

export type ProductRecord = {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  images: Array<{ id: string; url: string }>;
};

export function getCatalogSql() {
  const databaseUrl = process.env.DATABASE;
  if (!databaseUrl) {
    throw new Error("A variável de ambiente DATABASE não está configurada.");
  }
  return neon(databaseUrl);
}

export function toProduct(row: ProductRow): ProductRecord {
  const imageUrl = row.images?.trim() ?? "";
  const isImageUrl =
    /^https?:\/\//i.test(imageUrl) ||
    (imageUrl.startsWith("/") && !imageUrl.startsWith("//"));

  return {
    id: String(row.id),
    name: row.name?.trim() ?? "",
    price: Number(row.price ?? 0),
    description: row.description?.trim() ?? "",
    category: row.category?.trim() ?? "",
    images: isImageUrl
      ? [{ id: String(row.id), url: imageUrl }]
      : [],
  };
}

export function parseProductId(id: string) {
  if (!/^[1-9]\d*$/.test(id)) return null;
  const numericId = Number(id);
  return Number.isSafeInteger(numericId) ? numericId : null;
}

export function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function databaseErrorResponse() {
  if (!process.env.DATABASE) {
    return errorResponse(
      "A variável server-side DATABASE não está configurada.",
      503,
    );
  }
  return errorResponse("Não foi possível concluir a operação no catálogo.", 500);
}
