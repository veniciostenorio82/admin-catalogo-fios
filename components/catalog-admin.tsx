"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  PRODUCT_CATEGORIES,
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
  type Product,
  type ProductCategory,
} from "@/lib/catalog-api";
import Link from "next/link";

type ImageDraft = {
  key: string;
  name: string;
  previewUrl: string;
  source: { id: string; url: string };
};

type FormValues = {
  name: string;
  price: string;
  description: string;
  category: ProductCategory | "";
};

const initialForm: FormValues = {
  name: "",
  price: "",
  description: "",
  category: "",
};

function Icon({
  name,
  size = 18,
}: {
  name: "plus" | "search" | "edit" | "trash" | "close" | "image" | "arrow";
  size?: number;
}) {
  const paths = {
    plus: <path d="M12 5v14m-7-7h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    edit: (
      <>
        <path d="m16 4 4 4L9 19l-5 1 1-5L16 4Z" />
        <path d="m14 6 4 4" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6" />
      </>
    ),
    close: <path d="m18 6-12 12M6 6l12 12" />,
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </>
    ),
    arrow: <path d="M7 17 17 7M7 7h10v10" />,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function CatalogAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [values, setValues] = useState<FormValues>(initialForm);
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setProducts(await listProducts());
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as peças.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadCatalog);
  }, [loadCatalog]);

  useEffect(() => {
    if (editorOpen) nameInputRef.current?.focus();
  }, [editorOpen]);

  function openEditor(product?: Product) {
    setEditingProduct(product ?? null);
    setValues(
      product
        ? {
            name: product.name,
            price: String(product.price).replace(".", ","),
            description: product.description,
            category: product.category,
          }
        : initialForm,
    );
    setImageDrafts(
      product?.images.map((image) => ({
        key: image.id,
        name: "Imagem cadastrada",
        previewUrl: image.url,
        source: image,
      })) ?? [],
    );
    setFormError("");
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingProduct(null);
    setValues(initialForm);
    setImageDrafts([]);
    setImageUrl("");
    setFormError("");
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }

  function addImageUrl() {
    const url = imageUrl.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/(?!\/))/.test(url)) {
      setFormError("Informe uma URL HTTP(S) ou um caminho local iniciado por /.");
      return;
    }
    if (imageDrafts.length >= 1) {
      setFormError("O banco atual aceita uma imagem por peça.");
      return;
    }
    setImageDrafts([
      {
        key: crypto.randomUUID(),
        name: "Imagem da peça",
        previewUrl: url,
        source: { id: crypto.randomUUID(), url },
      },
    ]);
    setImageUrl("");
    setFormError("");
  }

  function removeImage(key: string) {
    const removedImage = imageDrafts.find((image) => image.key === key);
    if (removedImage?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(removedImage.previewUrl);
    }
    setImageDrafts((current) => {
      return current.filter((image) => image.key !== key);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const priceValue = Number(values.price.replace(",", "."));
    if (!values.name.trim()) {
      setFormError("Informe o nome da peça.");
      return;
    }
    if (!values.price.trim() || !Number.isFinite(priceValue) || priceValue < 0) {
      setFormError("Informe um preço válido, igual ou maior que zero.");
      return;
    }
    if (!values.category) {
      setFormError("Selecione uma categoria.");
      return;
    }
    if (imageDrafts.length > 1) {
      setFormError("O banco atual aceita uma imagem por peça.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        price: priceValue,
        description: values.description.trim(),
        category: values.category,
        images: imageDrafts.map((image) => image.source),
      };
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload, adminToken);
      } else {
        await createProduct(payload, adminToken);
      }
      closeEditor();
      setNotice(editingProduct ? "Peça atualizada." : "Peça adicionada.");
      await loadCatalog();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Não foi possível salvar a peça.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Tem certeza que deseja excluir "${product.name}"?`)) {
      return;
    }
    setNotice("");
    try {
      await deleteProduct(product.id, adminToken);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice("Peça excluída.");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Não foi possível excluir.",
      );
    }
  }

  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.category}`
      .toLocaleLowerCase("pt-BR")
      .includes(query.toLocaleLowerCase("pt-BR")),
  );

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Ateliê — início">
          <span className="brand-mark" aria-hidden="true">
            f.
          </span>
          <span className="brand-name">
            fios <span>na areia</span>
          </span>
        </Link>
        <div className="sidebar-label">ESPAÇO DE TRABALHO</div>
        <a className="nav-item nav-item-active" href="#catalogo" aria-current="page">
          <span className="nav-dot" />
          Catálogo
          <span className="nav-count">{products.length}</span>
        </a>
        <div className="sidebar-bottom">
          <span className="avatar">FA</span>
          <span className="account-copy">
            <strong>Ateliê Fios na Areia</strong>
            <span>Painel administrativo</span>
          </span>
          <span className="account-menu" aria-hidden="true">
            ···
          </span>
        </div>
      </aside>

      <section className="workspace" id="catalogo">
        <header className="topbar">
          <span className="breadcrumb">Loja <span>/</span> Catálogo</span>
          <span className="connection-status">
            <span className="status-dot" />
            Escrita protegida
          </span>
          <label className="admin-token-field">
            <span className="sr-only">Token administrativo</span>
            <input
              type="password"
              autoComplete="off"
              aria-label="Token administrativo"
              placeholder="Token para editar"
              value={adminToken}
              onChange={(event) => setAdminToken(event.target.value)}
            />
          </label>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SEU ACERVO, EM UM SÓ LUGAR</p>
              <h1>Peças</h1>
              <p className="page-subtitle">
                Organize e acompanhe tudo o que faz parte da sua coleção.
              </p>
            </div>
            <button
              ref={addButtonRef}
              className="button button-primary"
              onClick={() => openEditor()}
            >
              <Icon name="plus" size={17} />
              Adicionar peça
            </button>
          </div>

          <section className="catalog-panel" aria-label="Lista de peças">
            <div className="catalog-toolbar">
              <div>
                <h2>Todos os produtos</h2>
                <span className="results-count">
                  {products.length} {products.length === 1 ? "peça" : "peças"}
                </span>
              </div>
              <label className="search-field">
                <Icon name="search" size={17} />
                <span className="sr-only">Buscar peça</span>
                <input
                  type="search"
                  placeholder="Buscar peça..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <kbd>/</kbd>
              </label>
            </div>

            {notice && (
              <div className="notice-success" role="status">
                {notice}
                <button onClick={() => setNotice("")} aria-label="Dispensar aviso">
                  <Icon name="close" size={15} />
                </button>
              </div>
            )}

            {loadError && (
              <div className="error-banner" role="alert">
                <div>
                  <strong>Não foi possível acessar o catálogo</strong>
                  <p>{loadError}</p>
                </div>
                <button className="button button-secondary" onClick={() => void loadCatalog()}>
                  Tentar novamente
                </button>
              </div>
            )}

            <div className="table-scroll">
              <table className="product-table">
                <thead>
                  <tr>
                    <th scope="col">PRODUTO</th>
                    <th scope="col">CATEGORIA</th>
                    <th scope="col">PREÇO</th>
                    <th scope="col">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                {!loading && visibleProducts.length > 0 && (
                  <tbody>
                    {visibleProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="product-cell">
                            {product.images[0]?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                className="product-thumbnail"
                                src={product.images[0].url}
                                alt=""
                              />
                            ) : (
                              <span className="product-thumbnail thumbnail-placeholder">
                                <Icon name="image" size={20} />
                              </span>
                            )}
                            <span className="product-name">{product.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="category-pill">{product.category}</span>
                        </td>
                        <td className="price-cell">{formatPrice(product.price)}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`Editar ${product.name}`}
                              onClick={() => openEditor(product)}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className="icon-button icon-button-danger"
                              aria-label={`Excluir ${product.name}`}
                              onClick={() => void handleDelete(product)}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>

            {loading ? (
              <div className="empty-state" aria-live="polite">
                <span className="loading-spinner" />
                <h3>Carregando catálogo</h3>
                <p>Estamos buscando as peças da sua loja.</p>
              </div>
            ) : !loadError && visibleProducts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">
                  <Icon name={query ? "search" : "image"} size={25} />
                </span>
                <h3>{query ? "Nenhuma peça encontrada" : "Seu catálogo começa aqui"}</h3>
                <p>
                  {query
                    ? "Experimente buscar por outro nome ou categoria."
                    : "Adicione sua primeira peça para começar a organizar a coleção."}
                </p>
                {!query && (
                  <button
                    className="button button-secondary"
                    onClick={() => openEditor()}
                  >
                    <Icon name="plus" size={16} />
                    Adicionar primeira peça
                  </button>
                )}
              </div>
            ) : null}
          </section>

          <p className="page-footnote">
            <span className="footnote-sparkle">✳</span> Feito com cuidado, peça por peça.
          </p>
        </div>
      </section>

      {editorOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) closeEditor();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !saving) closeEditor();
          }}
        >
          <section
            className="editor-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
              );
              const first = focusable.item(0);
              const last = focusable.item(focusable.length - 1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }}
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">CATÁLOGO</p>
                <h2 id="editor-title">
                  {editingProduct ? "Editar peça" : "Adicionar peça"}
                </h2>
              </div>
              <button
                className="icon-button"
                onClick={closeEditor}
                disabled={saving}
                aria-label="Fechar formulário"
              >
                <Icon name="close" />
              </button>
            </header>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="form-error" role="alert">
                    {formError}
                  </div>
                )}
                <div className="form-grid">
                  <label className="field field-full">
                    <span>Nome da peça <span className="required">*</span></span>
                    <input
                      ref={nameInputRef}
                      required
                      maxLength={120}
                      value={values.name}
                      onChange={(event) =>
                        setValues({ ...values, name: event.target.value })
                      }
                      placeholder="Ex.: Bolsa de crochê Aurora"
                    />
                  </label>
                  <label className="field">
                    <span>Preço <span className="required">*</span></span>
                    <span className="price-input">
                      <span>R$</span>
                      <input
                        required
                        inputMode="decimal"
                        value={values.price}
                        onChange={(event) =>
                          setValues({ ...values, price: event.target.value })
                        }
                        placeholder="0,00"
                        aria-label="Preço em reais"
                      />
                    </span>
                  </label>
                  <label className="field">
                    <span>Categoria <span className="required">*</span></span>
                    <select
                      required
                      value={values.category}
                      onChange={(event) =>
                        setValues({
                          ...values,
                          category: event.target.value as ProductCategory | "",
                        })
                      }
                    >
                      <option value="" disabled>
                        Selecione
                      </option>
                      {[...new Set([
                        ...PRODUCT_CATEGORIES,
                        ...products.map((product) => product.category),
                      ])].map((category) => (
                        <option value={category} key={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field-full">
                    <span>Descrição</span>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={values.description}
                      onChange={(event) =>
                        setValues({ ...values, description: event.target.value })
                      }
                      placeholder="Conte um pouco sobre os detalhes e materiais da peça..."
                    />
                  </label>
                  <div className="field field-full">
                    <span className="field-label">
                      Imagens                       <span className="field-hint">({imageDrafts.length}/1)</span>
                    </span>
                    <div className="image-grid">
                      {imageDrafts.map((image) => (
                        <div className="image-preview" key={image.key}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.previewUrl} alt={`Prévia: ${image.name}`} />
                          <button
                            type="button"
                            onClick={() => removeImage(image.key)}
                            aria-label={`Remover imagem ${image.name}`}
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {imageDrafts.length === 0 && (
                      <div className="image-url-row">
                        <input
                          type="text"
                          inputMode="url"
                          aria-label="URL da imagem"
                          placeholder="https://... ou /images/peca.jpg"
                          value={imageUrl}
                          onChange={(event) => setImageUrl(event.target.value)}
                        />
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={addImageUrl}
                        >
                          <Icon name="plus" size={16} />
                          Usar imagem
                        </button>
                      </div>
                    )}
                    <span className="upload-hint">
                      A coluna `images` do banco atual armazena uma URL. Upload de arquivos e múltiplas imagens precisam de armazenamento e esquema adicionais.
                    </span>
                  </div>
                </div>
              </div>
              <footer className="modal-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={closeEditor}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="button button-primary" disabled={saving}>
                  {saving
                    ? "Salvando..."
                    : editingProduct
                      ? "Salvar alterações"
                      : "Adicionar peça"}
                  {!saving && <Icon name="arrow" size={16} />}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
