export const PRODUCT_CATEGORIES = [
  "Vestidos", 
  "Tops", 
  "Saias", 
  "Shorts", 
  "Bolsas",
] as const;

export type ProductCategory = string;

export type Product = {
  id: string;
  name: string;
  price: number;
  description: string;
  category: ProductCategory;
  images: Array<{ id: string; url: string }>;
};

export type ProductInput = Omit<Product, "id">;

export class CatalogApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogApiError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const result = (await response.json()) as { error?: unknown };
    throw new CatalogApiError(
      typeof result.error === "string" && result.error
        ? result.error
        : "A operação do catálogo falhou.",
    );
  }
  return (await response.json()) as T;
}

function serializedImages(images: ProductInput["images"]) {
  if (images.length > 1) {
    throw new CatalogApiError(
      "O banco atual aceita uma imagem por peça. Remova as imagens extras antes de salvar.",
    );
  }
  return images;
}

export async function listProducts(): Promise<Product[]> {
  return request<Product[]>("/api/products");
}

export async function createProduct(
  product: ProductInput,
  token: string,
): Promise<Product> {
  const images = serializedImages(product.images);
  return request<Product>("/api/products", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...product, images }),
  });
}

export async function updateProduct(
  id: string,
  product: Partial<ProductInput>,
  token: string,
): Promise<Product> {
  const body =
    product.images === undefined
      ? product
      : { ...product, images: serializedImages(product.images) };
  return request<Product>(`/api/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export async function deleteProduct(id: string, token: string): Promise<void> {
  await request<void>(`/api/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
