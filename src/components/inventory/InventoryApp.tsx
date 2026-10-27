"use client";

import Image from "next/image";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  ImagePlus,
  LayoutDashboard,
  LoaderCircle,
  Package,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Warehouse,
  X,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/client";

type Category = Database["public"]["Tables"]["categories"]["Row"];
type Product = Database["public"]["Tables"]["products"]["Row"];
type Variant = Database["public"]["Tables"]["product_variants"]["Row"];
type InventoryLog = Database["public"]["Tables"]["inventory_logs"]["Row"];
type ExchangeRate = Database["public"]["Tables"]["exchange_rates"]["Row"];

type Section = "dashboard" | "products" | "variants" | "activity";

type VariantDraft = {
  sku: string;
  size: string;
  color: string;
  stock: string;
  min_stock_alert: string;
};

type ProductDraft = {
  name: string;
  category_id: string;
  description: string;
  base_price_usd: string;
  promotional_price_3_11_usd: string;
  wholesale_price_usd: string;
};

const emptyProduct: ProductDraft = {
  name: "",
  category_id: "",
  description: "",
  base_price_usd: "",
  promotional_price_3_11_usd: "",
  wholesale_price_usd: "",
};

const emptyVariant: VariantDraft = {
  sku: "",
  size: "",
  color: "",
  stock: "0",
  min_stock_alert: "3",
};

const numberFormat = new Intl.NumberFormat("es-VE", {
  maximumFractionDigits: 0,
});
const currencyFormat = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const vesFormat = new Intl.NumberFormat("es-VE", {
  style: "currency",
  currency: "VES",
  maximumFractionDigits: 2,
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Ocurrió un error inesperado.";
}

function isMissingTierPriceColumn(error: unknown) {
  const message = getErrorMessage(error).toLocaleLowerCase();
  return (
    (message.includes("wholesale_price_usd") ||
      message.includes("promotional_price_3_11_usd")) &&
    (message.includes("schema cache") || message.includes("column"))
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function InventoryApp({
  initialSection = "dashboard",
  initialFormOpen = false,
  initialProductId,
}: {
  initialSection?: Section;
  initialFormOpen?: boolean;
  initialProductId?: string;
}) {
  const [section, setSection] = useState<Section>(initialSection);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const initialProductHandled = useRef(false);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [todayLogCount, setTodayLogCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dataReady, setDataReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [productSaveAlert, setProductSaveAlert] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(initialFormOpen);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProduct);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState("");
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([
    { ...emptyVariant },
  ]);
  const [newCategory, setNewCategory] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [adjustingVariant, setAdjustingVariant] = useState<Variant | null>(null);
  const [adjustmentDraft, setAdjustmentDraft] = useState({
    stock: "",
    notes: "",
  });

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const today = new Date();
      const startOfToday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).toISOString();
      const [
        categoryResult,
        productResult,
        variantResult,
        logResult,
        todayLogResult,
        exchangeRateResult,
      ] =
        await Promise.all([
          supabase.from("categories").select("*").order("name"),
          supabase.from("products").select("*").order("created_at", {
            ascending: false,
          }),
          supabase.from("product_variants").select("*").order("sku"),
          supabase
            .from("inventory_logs")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(8),
          supabase
            .from("inventory_logs")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startOfToday),
          supabase
            .from("exchange_rates")
            .select("*")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      const loadErrors: string[] = [];
      let requestedProductMissing = false;

      if (categoryResult.error) {
        loadErrors.push(`categorías: ${getErrorMessage(categoryResult.error)}`);
      } else {
        setCategories(categoryResult.data ?? []);
      }

      if (productResult.error) {
        loadErrors.push(`productos: ${getErrorMessage(productResult.error)}`);
      } else {
        const loadedProducts = productResult.data ?? [];
        setProducts(loadedProducts);
        if (initialProductId && !initialProductHandled.current) {
          initialProductHandled.current = true;
          const product = loadedProducts.find(
            (item) => item.id === initialProductId,
          );
          if (!product) {
            requestedProductMissing = true;
          } else {
            setEditingProduct(product);
            setProductDraft({
              name: product.name,
              category_id: product.category_id ?? "",
              description: product.description ?? "",
              base_price_usd: String(product.base_price_usd),
              promotional_price_3_11_usd:
                product.promotional_price_3_11_usd === null ||
                typeof product.promotional_price_3_11_usd === "undefined"
                  ? ""
                  : String(product.promotional_price_3_11_usd),
              wholesale_price_usd:
                product.wholesale_price_usd === null ||
                typeof product.wholesale_price_usd === "undefined"
                  ? ""
                  : String(product.wholesale_price_usd),
            });
            setVariantDrafts([]);
            setIsFormOpen(true);
          }
        }
      }

      if (variantResult.error) {
        loadErrors.push(`variantes: ${getErrorMessage(variantResult.error)}`);
      } else {
        setVariants(variantResult.data ?? []);
      }

      if (logResult.error) {
        loadErrors.push(`movimientos: ${getErrorMessage(logResult.error)}`);
      } else {
        setLogs(logResult.data ?? []);
      }

      if (todayLogResult.error) {
        loadErrors.push(
          `movimientos de hoy: ${getErrorMessage(todayLogResult.error)}`,
        );
      } else {
        setTodayLogCount(todayLogResult.count ?? 0);
      }

      if (exchangeRateResult.error) {
        loadErrors.push(`tasa de cambio: ${getErrorMessage(exchangeRateResult.error)}`);
      } else {
        setExchangeRate(exchangeRateResult.data);
      }

      setDataReady(loadErrors.length === 0 && !requestedProductMissing);
      if (requestedProductMissing) {
        setError("No se encontró el producto solicitado.");
      } else if (loadErrors.length > 0) {
        setError(`No se pudieron cargar ${loadErrors.join("; ")}.`);
      }
    } catch (loadError) {
      setError(
        `${getErrorMessage(loadError)} Revisa la estructura de las tablas y las políticas RLS de Supabase.`,
      );
    } finally {
      setLoading(false);
    }
  }, [initialProductId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInventory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadInventory]);

  const activeProducts = useMemo(
    () => products.filter((product) => product.is_active),
    [products],
  );
  const activeProductIds = useMemo(
    () => new Set(activeProducts.map((product) => product.id)),
    [activeProducts],
  );
  const activeVariants = useMemo(
    () =>
      variants.filter(
        (variant) =>
          variant.product_id !== null && activeProductIds.has(variant.product_id),
      ),
    [activeProductIds, variants],
  );
  const lowStockVariants = useMemo(
    () =>
      activeVariants.filter(
        (variant) => variant.stock_quantity <= variant.min_stock_alert,
      ),
    [activeVariants],
  );
  const inventoryValue = useMemo(
    () =>
      activeVariants.reduce((total, variant) => {
        const product = activeProducts.find(
          (item) => item.id === variant.product_id,
        );
        return total + Number(product?.base_price_usd ?? 0) * variant.stock_quantity;
      }, 0),
    [activeProducts, activeVariants],
  );
  const categoryStock = useMemo(
    () =>
      categories
        .map((category) => {
          const categoryProducts = activeProducts.filter(
            (product) => product.category_id === category.id,
          );
          const productIds = new Set(categoryProducts.map((product) => product.id));
          const stock = activeVariants
            .filter(
              (variant) =>
                variant.product_id !== null && productIds.has(variant.product_id),
            )
            .reduce((total, variant) => total + variant.stock_quantity, 0);
          return { ...category, stock };
        })
        .sort((left, right) => right.stock - left.stock),
    [activeProducts, activeVariants, categories],
  );
  const totalStock = activeVariants.reduce(
    (total, variant) => total + variant.stock_quantity,
    0,
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const productNameById = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return products;

    return products.filter((product) => {
      const categoryName = categoryNameById.get(product.category_id ?? "") ?? "";
      return `${product.name} ${product.description ?? ""} ${categoryName}`
        .toLocaleLowerCase()
        .includes(query);
    });
  }, [categoryNameById, products, search]);

  function openNewProductForm() {
    setEditingProduct(null);
    setProductImageFile(null);
    setProductImagePreview("");
    setProductDraft({
      ...emptyProduct,
      category_id: categories[0]?.id ?? "",
    });
    setVariantDrafts([{ ...emptyVariant }]);
    setNewCategory("");
    setShowNewCategory(false);
    setCategoryError("");
    setError("");
    setProductSaveAlert("");
    setNotice("");
    setIsFormOpen(true);
  }

  function openEditProductForm(product: Product) {
    setEditingProduct(product);
    setProductImageFile(null);
    setProductImagePreview("");
    setVariantDrafts([]);
    setProductSaveAlert("");
    setProductDraft({
      name: product.name,
      category_id: product.category_id ?? "",
      description: product.description ?? "",
      base_price_usd: String(product.base_price_usd),
      promotional_price_3_11_usd:
        product.promotional_price_3_11_usd === null ||
        typeof product.promotional_price_3_11_usd === "undefined"
          ? ""
          : String(product.promotional_price_3_11_usd),
      wholesale_price_usd:
        product.wholesale_price_usd === null ||
        typeof product.wholesale_price_usd === "undefined"
          ? ""
          : String(product.wholesale_price_usd),
    });
    setError("");
    setNotice("");
    setIsFormOpen(true);
  }

  async function handleCreateCategory() {
    const name = newCategory.trim();
    if (!name) {
      setCategoryError("Escribe un nombre para la categoría.");
      return;
    }

    setCreatingCategory(true);
    setCategoryError("");
    try {
      const supabase = createClient();
      const slug = toSlug(name);
      if (!slug) {
        throw new Error("El nombre debe incluir letras o números para crear el slug.");
      }
      const { data, error: insertError } = await supabase
        .from("categories")
        .insert({ name, slug })
        .select("*")
        .single();

      if (insertError) throw insertError;
      setCategories((current) =>
        [...current, data].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
      setProductDraft((current) => ({ ...current, category_id: data.id }));
      setNewCategory("");
      setShowNewCategory(false);
      setNotice(`Categoría «${data.name}» creada y seleccionada.`);
    } catch (categoryError) {
      setCategoryError(getErrorMessage(categoryError));
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setProductSaveAlert("");
    setNotice("");
    let tierPriceColumnsUnavailable = false;
    let uploadedImagePath: string | null = null;
    let uploadedImageAttached = false;

    try {
      const supabase = createClient();
      const baseProductValues = {
        name: productDraft.name.trim(),
        category_id: productDraft.category_id || null,
        description: productDraft.description.trim() || null,
        base_price_usd: Number(productDraft.base_price_usd),
      };
      const promotionalPrice = productDraft.promotional_price_3_11_usd
        ? Number(productDraft.promotional_price_3_11_usd)
        : null;
      const wholesalePrice = productDraft.wholesale_price_usd
        ? Number(productDraft.wholesale_price_usd)
        : null;

      if (
        !Number.isFinite(baseProductValues.base_price_usd) ||
        baseProductValues.base_price_usd < 0
      ) {
        throw new Error("El precio unitario debe ser un monto igual o mayor que cero.");
      }

      if (
        promotionalPrice !== null &&
        (!Number.isFinite(promotionalPrice) || promotionalPrice < 0)
      ) {
        throw new Error("El precio de promoción debe ser un monto igual o mayor que cero.");
      }

      if (
        wholesalePrice !== null &&
        (!Number.isFinite(wholesalePrice) || wholesalePrice < 0)
      ) {
        throw new Error("El precio al mayor debe ser un monto igual o mayor que cero.");
      }

      const productValues = {
        ...baseProductValues,
        promotional_price_3_11_usd: promotionalPrice,
        wholesale_price_usd: wholesalePrice,
      };
      const uploadProductImage = async () => {
        if (!productImageFile) return null;

        const allowedTypes: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };
        const extension = allowedTypes[productImageFile.type];
        if (!extension) {
          throw new Error("La imagen debe estar en formato JPG, PNG o WebP.");
        }
        if (productImageFile.size > 5 * 1024 * 1024) {
          throw new Error("La imagen no puede superar los 5 MB.");
        }

        const path = `${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("products")
          .upload(path, productImageFile, {
            cacheControl: "3600",
            contentType: productImageFile.type,
            upsert: false,
          });
        if (uploadError) throw uploadError;

        uploadedImagePath = path;
        const { data } = supabase.storage.from("products").getPublicUrl(path);
        return data.publicUrl;
      };

      const validVariants = variantDrafts.map((variant) => ({
        sku: variant.sku.trim(),
        size: variant.size.trim(),
        color: variant.color.trim(),
        stock_quantity: Number(variant.stock),
        min_stock_alert: Number(variant.min_stock_alert),
      }));

      if (
        (!editingProduct && validVariants.length === 0) ||
        validVariants.some(
          (variant) =>
            !variant.sku ||
            !variant.size ||
            !variant.color ||
            !Number.isInteger(variant.stock_quantity) ||
            variant.stock_quantity < 0 ||
            !Number.isInteger(variant.min_stock_alert) ||
            variant.min_stock_alert < 0,
        )
      ) {
        throw new Error(
          "Completa el SKU, la talla, el color y un stock/umbral entero igual o mayor que cero en cada variante.",
        );
      }

      const existingSkus = new Set(
        variants.map((variant) => variant.sku.trim().toLocaleLowerCase()),
      );
      const newSkus = new Set<string>();
      for (const variant of validVariants) {
        const normalizedSku = variant.sku.toLocaleLowerCase();
        if (existingSkus.has(normalizedSku) || newSkus.has(normalizedSku)) {
          throw new Error(`El SKU «${variant.sku}» ya está registrado.`);
        }
        newSkus.add(normalizedSku);
      }

      if (editingProduct) {
        const imageUrl = await uploadProductImage();
        const productUpdateValues = imageUrl
          ? { ...productValues, image_url: imageUrl }
          : productValues;
        let { error: updateError } = await supabase
          .from("products")
          .update(productUpdateValues)
          .eq("id", editingProduct.id);

        if (
          updateError &&
          promotionalPrice === null &&
          wholesalePrice === null &&
          isMissingTierPriceColumn(updateError)
        ) {
          const fallbackResult = await supabase
            .from("products")
            .update(
              imageUrl
                ? { ...baseProductValues, image_url: imageUrl }
                : baseProductValues,
            )
            .eq("id", editingProduct.id);
          updateError = fallbackResult.error;
          tierPriceColumnsUnavailable = !updateError;
        }

        if (updateError) throw updateError;
        uploadedImageAttached = Boolean(imageUrl);

        if (validVariants.length > 0) {
          const { data: insertedVariants, error: insertVariantsError } =
            await supabase
              .from("product_variants")
              .insert(
                validVariants.map((variant) => ({
                  ...variant,
                  product_id: editingProduct.id,
                })),
              )
              .select("*");

          if (insertVariantsError) {
            throw new Error(
              `Los datos del producto se actualizaron, pero no se agregaron las variantes: ${insertVariantsError.message}`,
            );
          }

          const initialStockLogs = insertedVariants
            .filter((variant) => variant.stock_quantity > 0)
            .map((variant) => ({
              variant_id: variant.id,
              type: "ADDITION" as const,
              quantity_changed: variant.stock_quantity,
              previous_stock: 0,
              new_stock: variant.stock_quantity,
              notes: "Stock inicial de variante agregada",
            }));

          if (initialStockLogs.length > 0) {
            const { error: logError } = await supabase
              .from("inventory_logs")
              .insert(initialStockLogs);

            if (logError) {
              const { error: rollbackError } = await supabase
                .from("product_variants")
                .delete()
                .in(
                  "id",
                  insertedVariants.map((variant) => variant.id),
                );

              if (rollbackError) {
                setIsFormOpen(false);
                await loadInventory();
                const message = `El producto se actualizó, pero no se pudo registrar el stock inicial de las variantes nuevas: ${logError.message}. Tampoco se pudieron revertir las variantes: ${rollbackError.message}.`;
                setError(message);
                setProductSaveAlert(message);
                return;
              }

              throw new Error(
                `Los datos del producto se actualizaron, pero no se pudo registrar el stock inicial; las variantes nuevas se revirtieron: ${logError.message}`,
              );
            }
          }
        }

        setNotice(
          validVariants.length > 0
            ? `Producto actualizado y ${validVariants.length} variante${validVariants.length === 1 ? "" : "s"} agregada${validVariants.length === 1 ? "" : "s"} correctamente.${tierPriceColumnsUnavailable ? " Aplica la migración para habilitar los precios por cantidad." : ""}`
            : tierPriceColumnsUnavailable
              ? "Producto actualizado. Aplica la migración para habilitar los precios por cantidad."
              : "Los datos del producto se actualizaron correctamente.",
        );
      } else {
        const imageUrl = await uploadProductImage();
        const productInsertValues = imageUrl
          ? { ...productValues, image_url: imageUrl }
          : productValues;
        let { data: product, error: insertProductError } = await supabase
          .from("products")
          .insert(productInsertValues)
          .select("*")
          .single();

        if (
          insertProductError &&
          promotionalPrice === null &&
          wholesalePrice === null &&
          isMissingTierPriceColumn(insertProductError)
        ) {
          const fallbackInsertValues: Database["public"]["Tables"]["products"]["Insert"] =
            imageUrl
              ? { ...baseProductValues, image_url: imageUrl }
              : baseProductValues;
          const fallbackResult = await supabase
            .from("products")
            .insert(fallbackInsertValues)
            .select("*")
            .single();
          product = fallbackResult.data;
          insertProductError = fallbackResult.error;
          tierPriceColumnsUnavailable = !insertProductError;
        }

        if (insertProductError) throw insertProductError;
        if (!product) {
          throw new Error("Supabase no devolvió el producto recién creado.");
        }
        uploadedImageAttached = Boolean(imageUrl);

        const { data: insertedVariants, error: insertVariantsError } = await supabase
          .from("product_variants")
          .insert(
            validVariants.map((variant) => ({
              ...variant,
              product_id: product.id,
            })),
          )
          .select("*");

        if (insertVariantsError) {
          const { error: rollbackError } = await supabase
            .from("products")
            .delete()
            .eq("id", product.id);

          if (rollbackError) {
            setIsFormOpen(false);
            await loadInventory();
            const message = `El producto quedó creado sin variantes: ${insertVariantsError.message}. Tampoco se pudo eliminar: ${rollbackError.message}. Comprueba las políticas RLS de products y product_variants.`;
            setError(message);
            setProductSaveAlert(message);
            return;
          }

          uploadedImageAttached = false;
          throw new Error(
            `No se guardaron las variantes y el producto incompleto se revirtió: ${insertVariantsError.message}`,
          );
        }

        const initialStockLogs = insertedVariants
          .filter((variant) => variant.stock_quantity > 0)
          .map((variant) => ({
            variant_id: variant.id,
            type: "ADDITION" as const,
            quantity_changed: variant.stock_quantity,
            previous_stock: 0,
            new_stock: variant.stock_quantity,
            notes: "Stock inicial",
          }));

        if (initialStockLogs.length > 0) {
          const { error: logError } = await supabase
            .from("inventory_logs")
            .insert(initialStockLogs);
          if (logError) {
            const { error: rollbackError } = await supabase
              .from("products")
              .delete()
              .eq("id", product.id);

            if (rollbackError) {
              setIsFormOpen(false);
              await loadInventory();
              const message = `Producto y variantes guardados, pero falló el registro inicial: ${logError.message}. No se pudo revertir el producto: ${rollbackError.message}. Comprueba las políticas RLS de products e inventory_logs.`;
              setError(message);
              setProductSaveAlert(message);
              return;
            }

            uploadedImageAttached = false;
            throw new Error(
              `No se pudo registrar el stock inicial y el producto incompleto se revirtió: ${logError.message}`,
            );
          }
        }
        setNotice(
          tierPriceColumnsUnavailable
            ? "Producto y variantes guardados. Aplica la migración para habilitar los precios por cantidad."
            : "Producto y variantes guardados correctamente.",
        );
      }

      setIsFormOpen(false);
      await loadInventory();
    } catch (saveError) {
      let message = getErrorMessage(saveError);
      if (isMissingTierPriceColumn(saveError)) {
        message = "Supabase aún no tiene las columnas de precios por cantidad. Ejecuta supabase/migrations/20261027131500_add_promotional_and_wholesale_price_tiers.sql en el editor SQL de Supabase y vuelve a intentar.";
      } else if (
        productImageFile &&
        message.toLocaleLowerCase().includes("image_url") &&
        (message.toLocaleLowerCase().includes("schema cache") ||
          message.toLocaleLowerCase().includes("column"))
      ) {
        message = "Falta la columna image_url en products. Ejecuta supabase/migrations/20261026221800_add_product_image_url.sql en Supabase y vuelve a intentar.";
      } else if (
        productImageFile &&
        message.toLocaleLowerCase().includes("bucket not found")
      ) {
        message = "No se encontró el bucket «products». Comprueba su nombre en Supabase Storage.";
      } else if (
        productImageFile &&
        /row-level security|permission denied|not allowed/i.test(message)
      ) {
        message = `Supabase Storage no permitió subir la imagen. Revisa las políticas de Storage para el bucket «products»: ${message}`;
      }
      if (uploadedImagePath && !uploadedImageAttached) {
        const { error: cleanupError } = await createClient()
          .storage.from("products").remove([uploadedImagePath]);
        if (cleanupError) {
          message += ` No se pudo limpiar la imagen subida: ${cleanupError.message}.`;
        }
      }
      setError(message);
      setProductSaveAlert(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleProduct(product: Product) {
    const nextActiveState = !product.is_active;
    const confirmation = nextActiveState
      ? `¿Activar "${product.name}"?`
      : `¿Desactivar "${product.name}"? El producto seguirá disponible en el historial.`;
    if (!window.confirm(confirmation)) return;

    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("products")
        .update({ is_active: nextActiveState })
        .eq("id", product.id);

      if (updateError) throw updateError;
      setNotice(
        nextActiveState ? "Producto activado." : "Producto desactivado.",
      );
      await loadInventory();
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    }
  }

  async function handleSaveStockAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustingVariant) return;
    const nextStock = Number(adjustmentDraft.stock);
    if (!Number.isInteger(nextStock) || nextStock < 0) {
      setError("Las existencias deben ser un número entero igual o mayor que cero.");
      return;
    }

    const previousStock = adjustingVariant.stock_quantity;
    const quantityChanged = nextStock - previousStock;
    if (quantityChanged === 0) {
      setAdjustingVariant(null);
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const supabase = createClient();
      const { data: updatedVariant, error: updateError } = await supabase
        .from("product_variants")
        .update({
          stock_quantity: nextStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adjustingVariant.id)
        .eq("stock_quantity", previousStock)
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedVariant) {
        throw new Error(
          "Las existencias cambiaron en otro proceso. Recarga el inventario e inténtalo de nuevo.",
        );
      }

      const { error: logError } = await supabase.from("inventory_logs").insert({
        variant_id: adjustingVariant.id,
        type: "ADJUSTMENT",
        quantity_changed: quantityChanged,
        previous_stock: previousStock,
        new_stock: nextStock,
        notes: adjustmentDraft.notes.trim(),
      });

      setAdjustingVariant(null);
      await loadInventory();
      if (logError) {
        setError(
          `El stock se actualizó, pero no se pudo registrar el movimiento: ${logError.message}. Comprueba las políticas RLS de inventory_logs.`,
        );
        return;
      }
      setNotice("Existencias y auditoría actualizadas correctamente.");
    } catch (adjustmentError) {
      setError(getErrorMessage(adjustmentError));
    } finally {
      setSaving(false);
    }
  }

  const navigation: {
    id: Section;
    label: string;
    icon: typeof LayoutDashboard;
  }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "products", label: "Productos", icon: Package },
    { id: "variants", label: "Variantes y stock", icon: Boxes },
    { id: "activity", label: "Movimientos", icon: ClipboardList },
  ];

  const sectionTitle: Record<Section, string> = {
    dashboard: "Resumen de inventario",
    products: "Catálogo de productos",
    variants: "Variantes y existencias",
    activity: "Movimientos de inventario",
  };
  const editingVariants = editingProduct
    ? variants.filter((variant) => variant.product_id === editingProduct.id)
    : [];

  return (
    <main className="app-shell">
      {productSaveAlert && (
        <div className="feedback feedback-error save-error-toast" role="alert">
          <AlertTriangle aria-hidden="true" size={19} />
          <span>
            <strong>No se pudo completar el registro del producto.</strong>
            <br />
            {productSaveAlert}
          </span>
          <button
            aria-label="Cerrar alerta de error al guardar producto"
            onClick={() => setProductSaveAlert("")}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <aside className="sidebar">
        <a
          className="brand"
          href="#inicio"
          onClick={() => setSection("dashboard")}
          aria-label="Chicas Íntima, inicio"
        >
          <span className="brand-mark">
            <Warehouse size={21} strokeWidth={2.2} />
          </span>
          <span className="brand-copy">
            <strong>Boutique Chicas Íntima</strong>
            <span>Gestión de inventario</span>
          </span>
        </a>

        <div className="sidebar-label">GESTIÓN</div>
        <nav className="side-nav" aria-label="Navegación principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              className={`nav-link${section === id ? " is-active" : ""}`}
              key={id}
              onClick={() => setSection(id)}
              type="button"
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "variants" && lowStockVariants.length > 0 && (
                <span className="nav-count">{lowStockVariants.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className={`connection-dot${error ? " connection-dot-error" : ""}`} />
          <span>
            <strong>Base de datos</strong>
            <small>{loading ? "Conectando..." : error ? "Revisar conexión" : "Supabase"}</small>
          </span>
          <ShieldCheck size={18} />
        </div>
      </aside>

      <section className="main-column">
        <header className="topbar">
          <div className="topbar-search">
            <Search size={18} />
            <input
              aria-label="Buscar productos"
              onChange={(event) => {
                setSearch(event.target.value);
                if (section !== "products") setSection("products");
              }}
              placeholder="Buscar producto, categoría o SKU..."
              value={search}
            />
            <kbd>⌘ K</kbd>
          </div>
          <div className="topbar-location">
            <span className="location-icon"><Warehouse size={17} /></span>
            <span><strong>Inventario</strong><small>Panel principal</small></span>
            <ChevronDown size={16} />
          </div>
          <button
            aria-label="Nuevo producto"
            className="button button-primary topbar-add"
            onClick={openNewProductForm}
            type="button"
          >
            <Plus size={18} />
            <span>Nuevo producto</span>
          </button>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> INVENTARIO</div>
              <h1>{sectionTitle[section]}</h1>
              <p>Administra productos, variantes y existencias desde un solo lugar.</p>
            </div>
            <div className="heading-actions">
              <span className={`sync-status${error ? " sync-status-error" : ""}`}><span />{loading ? "Sincronizando..." : error ? "Revisa la conexión" : "Datos sincronizados"}</span>
              <button
                className="button button-primary"
                onClick={openNewProductForm}
                type="button"
              >
                <Plus size={18} />
                Nuevo producto
              </button>
            </div>
          </div>

          {error && (
            <div className="feedback feedback-error" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
              {!dataReady && (
                <button
                  aria-label="Reintentar conexión con Supabase"
                  className="retry-button"
                  disabled={loading}
                  onClick={() => void loadInventory()}
                  type="button"
                >
                  {loading ? "Conectando..." : "Reintentar"}
                </button>
              )}
              <button aria-label="Cerrar mensaje" onClick={() => setError("")} type="button">
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="feedback feedback-success" role="status">
              <Check size={18} />
              <span>{notice}</span>
              <button aria-label="Cerrar mensaje" onClick={() => setNotice("")} type="button">
                <X size={16} />
              </button>
            </div>
          )}

          {section === "dashboard" && (
            <DashboardSection
              activeProducts={activeProducts.length}
              categoryStock={categoryStock}
              dataReady={dataReady}
              inventoryValue={inventoryValue}
              exchangeRate={exchangeRate?.rate_ves ?? null}
              loading={loading}
              lowStockVariants={lowStockVariants}
              logs={logs}
              productNameById={productNameById}
              todayLogCount={todayLogCount}
              totalStock={totalStock}
              variants={activeVariants.length}
              onShowActivity={() => setSection("activity")}
              onShowVariants={() => setSection("variants")}
            />
          )}

          {section === "products" && (
            <ProductsSection
              products={filteredProducts}
              categoryNameById={categoryNameById}
              loading={loading}
              dataReady={dataReady}
              onAdd={openNewProductForm}
              onEdit={openEditProductForm}
              onToggle={handleToggleProduct}
              exchangeRate={exchangeRate?.rate_ves ?? null}
            />
          )}

          {section === "variants" && (
            <VariantsSection
              variants={activeVariants}
              products={products}
              lowStockVariants={lowStockVariants}
              loading={loading}
              dataReady={dataReady}
              onAdd={openNewProductForm}
              onAdjust={(variant) => {
                setAdjustingVariant(variant);
                setAdjustmentDraft({
                  stock: String(variant.stock_quantity),
                  notes: "",
                });
                setError("");
              }}
            />
          )}

          {section === "activity" && (
            <ActivitySection
              logs={logs}
              productNameById={productNameById}
              variants={variants}
              loading={loading}
              dataReady={dataReady}
            />
          )}
        </div>
      </section>

      {isFormOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setIsFormOpen(false);
            }
          }}
        >
          <section
            aria-labelledby="product-form-title"
            aria-modal="true"
            className="product-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div className="modal-title-icon"><Package size={20} /></div>
              <div>
                <h2 id="product-form-title">
                  {editingProduct ? "Editar producto" : "Registrar producto"}
                </h2>
                <p>Completa la información para mantener tu inventario al día.</p>
              </div>
              <button
                aria-label="Cerrar formulario"
                className="icon-button modal-close"
                disabled={saving}
                onClick={() => setIsFormOpen(false)}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <form className="product-form" onSubmit={handleSaveProduct}>
              {error && (
                <div className="feedback feedback-error form-feedback" role="alert">
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}
              {categoryError && (
                <div className="feedback feedback-error form-feedback" role="alert">
                  <AlertTriangle size={18} />
                  <span>{categoryError}</span>
                  {/(row-level|permission|not allowed)/i.test(categoryError) && (
                    <small>
                      Revisa que la sesión tenga políticas RLS de lectura e inserción
                      para categorías.
                    </small>
                  )}
                  <button
                    aria-label="Cerrar error de categoría"
                    onClick={() => setCategoryError("")}
                    type="button"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {notice && (
                <div className="feedback feedback-success form-feedback" role="status">
                  <Check size={18} />
                  <span>{notice}</span>
                </div>
              )}
              <div className="form-section-title">
                <span>01</span> Información del producto
              </div>
              <div className="form-grid">
                <label className="field field-full">
                  <span>Nombre del producto <b>*</b></span>
                  <input
                    autoFocus
                    maxLength={120}
                    onChange={(event) =>
                      setProductDraft({ ...productDraft, name: event.target.value })
                    }
                    placeholder="Ej. Conjunto de encaje"
                    required
                    value={productDraft.name}
                  />
                </label>
                <div className="field field-full product-image-field">
                  <span>Imagen del producto</span>
                  <label className="product-image-picker">
                    {productImagePreview || editingProduct?.image_url ? (
                      <Image
                        alt="Vista previa del producto"
                        height={112}
                        src={productImagePreview || editingProduct?.image_url || ""}
                        unoptimized
                        width={112}
                      />
                    ) : (
                      <span className="product-image-placeholder">
                        <ImagePlus size={23} />
                        <span>Selecciona una imagen</span>
                      </span>
                    )}
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setProductImageFile(file);
                        setProductImagePreview("");
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          setError("La imagen no puede superar los 5 MB.");
                          event.target.value = "";
                          setProductImageFile(null);
                          return;
                        }
                        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                          setError("La imagen debe estar en formato JPG, PNG o WebP.");
                          event.target.value = "";
                          setProductImageFile(null);
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === "string") {
                            setProductImagePreview(reader.result);
                          }
                        };
                        reader.onerror = () => {
                          setError("No se pudo leer la imagen seleccionada.");
                        };
                        reader.readAsDataURL(file);
                      }}
                      type="file"
                    />
                  </label>
                  <small className="field-hint">
                    JPG, PNG o WebP, máximo 5 MB. Se guarda en el bucket products.
                  </small>
                  {productImageFile && (
                    <span className="product-image-file-name">
                      {productImageFile.name}
                    </span>
                  )}
                </div>
                <div className="field field-full category-field">
                  <span>Categoría</span>
                  <div className="category-select-row">
                    <select
                      onChange={(event) =>
                        setProductDraft({
                          ...productDraft,
                          category_id: event.target.value,
                        })
                      }
                      value={productDraft.category_id}
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                    <button
                      aria-label={showNewCategory ? "Cancelar categoría nueva" : "Agregar categoría"}
                      className="category-toggle"
                      onClick={() => {
                        setShowNewCategory((current) => !current);
                        setCategoryError("");
                      }}
                      type="button"
                    >
                      {showNewCategory ? <X size={17} /> : <Plus size={17} />}
                    </button>
                  </div>
                  {showNewCategory && (
                    <div className="category-create-row">
                      <input
                        aria-label="Nombre de la nueva categoría"
                        autoFocus
                        maxLength={60}
                        onChange={(event) => {
                          setNewCategory(event.target.value);
                          setCategoryError("");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateCategory();
                          }
                        }}
                        placeholder="Ej. Pijamas"
                        value={newCategory}
                      />
                      <button
                        className="button button-outline button-small"
                        disabled={!newCategory.trim() || creatingCategory}
                        onClick={() => void handleCreateCategory()}
                        type="button"
                      >
                        {creatingCategory ? (
                          <><LoaderCircle className="spin" size={15} /> Creando</>
                        ) : (
                          <><Check size={15} /> Crear</>
                        )}
                      </button>
                    </div>
                  )}
                  <small className="field-hint">
                    {categories.length === 0
                      ? "Crea una categoría con el botón + para asignarla al producto."
                      : "Opcional. Puedes crear una categoría nueva con +."}
                  </small>
                </div>
                <label className="field">
                  <span>Precio unitario (USD) <b>*</b></span>
                  <div className="input-prefix">
                    <span>$</span>
                    <input
                      min="0"
                      onChange={(event) =>
                        setProductDraft({
                          ...productDraft,
                          base_price_usd: event.target.value,
                        })
                      }
                      placeholder="0.00"
                      required
                      step="0.01"
                      type="number"
                      value={productDraft.base_price_usd}
                    />
                  </div>
                </label>
                <label className="field">
                  <span>Precio de promoción (3–11 piezas, USD)</span>
                  <div className="input-prefix">
                    <span>$</span>
                    <input
                      min="0"
                      onChange={(event) =>
                        setProductDraft({
                          ...productDraft,
                          promotional_price_3_11_usd: event.target.value,
                        })
                      }
                      placeholder="0"
                      step="0.01"
                      type="number"
                      value={productDraft.promotional_price_3_11_usd}
                    />
                  </div>
                  <small className="field-hint">
                    Precio por pieza para compras de 3 a 11 unidades del mismo producto.
                  </small>
                </label>
                <label className="field">
                  <span>Precio al mayor (12 piezas o más, USD)</span>
                  <div className="input-prefix">
                    <span>$</span>
                    <input
                      min="0"
                      onChange={(event) =>
                        setProductDraft({
                          ...productDraft,
                          wholesale_price_usd: event.target.value,
                        })
                      }
                      placeholder="0"
                      step="0.01"
                      type="number"
                      value={productDraft.wholesale_price_usd}
                    />
                  </div>
                  <small className="field-hint">
                    Precio por pieza para compras de 12 unidades o más del mismo producto.
                  </small>
                </label>
                <label className="field field-full">
                  <span>Descripción</span>
                  <textarea
                    maxLength={500}
                    onChange={(event) =>
                      setProductDraft({
                        ...productDraft,
                        description: event.target.value,
                      })
                    }
                    placeholder="Detalles útiles sobre el producto..."
                    rows={3}
                    value={productDraft.description}
                  />
                </label>
              </div>

              <div className="form-section-title variant-section-heading">
                <span>02</span>{" "}
                {editingProduct ? "Agregar variantes nuevas" : "Variantes y stock inicial"}
                <small>Talla, color, SKU, stock y alerta</small>
              </div>
              {editingProduct && (
                <div className="existing-variants">
                  <strong>Variantes actuales ({editingVariants.length})</strong>
                  {editingVariants.length === 0 ? (
                    <p>Este producto todavía no tiene variantes registradas.</p>
                  ) : (
                    <ul>
                      {editingVariants.map((variant) => (
                        <li key={variant.id}>
                          <span><b>{variant.sku}</b> · Talla {variant.size} · {variant.color}</span>
                          <span>{variant.stock_quantity} unidades</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <small>
                    Las variantes existentes no se modifican aquí. Para ajustar sus existencias, usa «Variantes y stock».
                  </small>
                </div>
              )}
              <div className="variant-draft-list">
                {variantDrafts.map((variant, index) => (
                  <div className="variant-draft" key={index}>
                    <div className="variant-draft-top">
                      <span>
                        {editingProduct ? "Nueva variante" : "Variante"}{" "}
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {(editingProduct || variantDrafts.length > 1) && (
                        <button
                          aria-label={`Eliminar variante nueva ${index + 1}`}
                          className="remove-variant"
                          onClick={() =>
                            setVariantDrafts((current) =>
                              current.filter((_, variantIndex) => variantIndex !== index),
                            )
                          }
                          type="button"
                        >
                          <X size={15} /> Quitar
                        </button>
                      )}
                    </div>
                    <div className="variant-fields">
                      <label className="field">
                        <span>SKU <b>*</b></span>
                        <input
                          onChange={(event) =>
                            setVariantDrafts((current) =>
                              current.map((item, variantIndex) =>
                                variantIndex === index
                                  ? { ...item, sku: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="CHI-001"
                          required
                          value={variant.sku}
                        />
                      </label>
                      <label className="field">
                        <span>Talla <b>*</b></span>
                        <input
                          onChange={(event) =>
                            setVariantDrafts((current) =>
                              current.map((item, variantIndex) =>
                                variantIndex === index
                                  ? { ...item, size: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="S, M, L..."
                          required
                          value={variant.size}
                        />
                      </label>
                      <label className="field">
                        <span>Color <b>*</b></span>
                        <input
                          onChange={(event) =>
                            setVariantDrafts((current) =>
                              current.map((item, variantIndex) =>
                                variantIndex === index
                                  ? { ...item, color: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Ej. Negro"
                          required
                          value={variant.color}
                        />
                      </label>
                      <label className="field">
                        <span>Unidades</span>
                        <input
                          min="0"
                          onChange={(event) =>
                            setVariantDrafts((current) =>
                              current.map((item, variantIndex) =>
                                variantIndex === index
                                  ? { ...item, stock: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          required
                          step="1"
                          type="number"
                          value={variant.stock}
                        />
                      </label>
                      <label className="field">
                        <span>Alerta bajo</span>
                        <input
                          min="0"
                          onChange={(event) =>
                            setVariantDrafts((current) =>
                              current.map((item, variantIndex) =>
                                variantIndex === index
                                  ? {
                                      ...item,
                                      min_stock_alert: event.target.value,
                                    }
                                  : item,
                              ),
                            )
                          }
                          required
                          step="1"
                          type="number"
                          value={variant.min_stock_alert}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="variant-form-actions">
                <button
                  className="button button-outline button-small"
                  onClick={() =>
                    setVariantDrafts((current) => [...current, { ...emptyVariant }])
                  }
                  type="button"
                >
                  <Plus size={16} /> Agregar variante
                </button>
              </div>

              <div className="modal-footer">
                <span className="required-note"><b>*</b> Campos obligatorios</span>
                <div>
                  <button
                    className="button button-ghost"
                    disabled={saving}
                    onClick={() => setIsFormOpen(false)}
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button className="button button-primary" disabled={saving} type="submit">
                    {saving ? (
                      <><LoaderCircle className="spin" size={17} /> Guardando...</>
                    ) : (
                      <><Check size={17} /> {editingProduct ? "Guardar cambios" : "Guardar producto"}</>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}

      {adjustingVariant && (
        <StockAdjustmentDialog
          error={error}
          notes={adjustmentDraft.notes}
          saving={saving}
          stock={adjustmentDraft.stock}
          variant={adjustingVariant}
          onClose={() => setAdjustingVariant(null)}
          onNotesChange={(notes) =>
            setAdjustmentDraft((current) => ({ ...current, notes }))
          }
          onStockChange={(stock) =>
            setAdjustmentDraft((current) => ({ ...current, stock }))
          }
          onSubmit={handleSaveStockAdjustment}
        />
      )}

    </main>
  );
}

function StockAdjustmentDialog({
  error,
  notes,
  saving,
  stock,
  variant,
  onClose,
  onNotesChange,
  onStockChange,
  onSubmit,
}: {
  error: string;
  notes: string;
  saving: boolean;
  stock: string;
  variant: Variant;
  onClose: () => void;
  onNotesChange: (notes: string) => void;
  onStockChange: (stock: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-labelledby="adjustment-title"
        aria-modal="true"
        className="product-modal adjustment-modal"
        role="dialog"
      >
        <div className="modal-header">
          <div className="modal-title-icon"><Boxes size={20} /></div>
          <div>
            <h2 id="adjustment-title">Ajustar existencias</h2>
            <p>{variant.sku} · {variant.size} · {variant.color}</p>
          </div>
          <button
            aria-label="Cerrar ajuste"
            className="icon-button modal-close"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <form className="product-form" onSubmit={onSubmit}>
          {error && (
            <div className="feedback feedback-error form-feedback" role="alert">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}
          <div className="adjustment-current">
            <span>Existencias actuales</span>
            <strong>{numberFormat.format(variant.stock_quantity)} uds.</strong>
          </div>
          <label className="field">
            <span>Nueva cantidad disponible <b>*</b></span>
            <input
              autoFocus
              min="0"
              onChange={(event) => onStockChange(event.target.value)}
              required
              step="1"
              type="number"
              value={stock}
            />
          </label>
          <label className="field adjustment-notes">
            <span>Motivo del ajuste <b>*</b></span>
            <textarea
              maxLength={300}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Ej. Conteo físico en almacén"
              required
              rows={3}
              value={notes}
            />
          </label>
          <div className="modal-footer adjustment-footer">
            <span className="required-note"><b>*</b> Se guardará en auditoría</span>
            <div>
              <button
                className="button button-ghost"
                disabled={saving}
                onClick={onClose}
                type="button"
              >
                Cancelar
              </button>
              <button className="button button-primary" disabled={saving} type="submit">
                {saving ? (
                  <><LoaderCircle className="spin" size={17} /> Guardando...</>
                ) : (
                  <><Check size={17} /> Guardar ajuste</>
                )}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}

function DashboardSection({
  activeProducts,
  categoryStock,
  dataReady,
  inventoryValue,
  exchangeRate,
  loading,
  lowStockVariants,
  logs,
  productNameById,
  todayLogCount,
  totalStock,
  variants,
  onShowActivity,
  onShowVariants,
}: {
  activeProducts: number;
  categoryStock: (Category & { stock: number })[];
  dataReady: boolean;
  inventoryValue: number;
  exchangeRate: number | null;
  loading: boolean;
  lowStockVariants: Variant[];
  logs: InventoryLog[];
  productNameById: Map<string, string>;
  todayLogCount: number;
  totalStock: number;
  variants: number;
  onShowActivity: () => void;
  onShowVariants: () => void;
}) {
  const metrics = [
    {
      label: "Valor a precio de venta",
      value: currencyFormat.format(inventoryValue),
      detail: exchangeRate
        ? vesFormat.format(inventoryValue * exchangeRate)
        : "Tasa VES activa pendiente",
      icon: ChartNoAxesColumnIncreasing,
      tone: "blue",
    },
    {
      label: "Productos activos",
      value: numberFormat.format(activeProducts),
      detail: `${numberFormat.format(variants)} variantes registradas`,
      icon: Package,
      tone: "violet",
    },
    {
      label: "Stock crítico",
      value: numberFormat.format(lowStockVariants.length),
      detail: "Variantes bajo su umbral configurado",
      icon: AlertTriangle,
      tone: "red",
    },
    {
      label: "Movimientos de hoy",
      value: numberFormat.format(todayLogCount),
      detail: "Registros de auditoría de hoy",
      icon: ArrowUpRight,
      tone: "green",
    },
  ];

  return (
    <>
      <section aria-label="Indicadores del inventario" className="metric-grid">
        {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
          <article className={`metric-card tone-${tone}`} key={label}>
            <div className="metric-card-top">
              <span>{label}</span>
              <span className="metric-icon"><Icon size={19} /></span>
            </div>
            <strong className="metric-value">{loading || !dataReady ? "—" : value}</strong>
            <span className="metric-detail">{dataReady ? detail : "Datos no disponibles"}</span>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="panel stock-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <span className="panel-icon panel-icon-blue"><ChartNoAxesColumnIncreasing size={19} /></span>
                <div><h2>Stock por categoría</h2><p>Unidades disponibles en tu inventario</p></div>
              </div>
              <span className="panel-caption">{dataReady ? numberFormat.format(totalStock) : "—"} unidades</span>
            </div>
            {loading ? (
              <LoadingState />
            ) : !dataReady ? (
              <EmptyState icon={CircleHelp} title="Datos no disponibles" description="Revisa la conexión con Supabase para cargar las categorías." />
            ) : categoryStock.length === 0 ? (
              <EmptyState
                icon={Tags}
                title="Aún no hay categorías"
                description="Crea tu primer producto y agrega una categoría para ver aquí la distribución del stock."
              />
            ) : (
              <div className="category-grid">
                {categoryStock.slice(0, 6).map((category, index) => {
                  const percentage =
                    totalStock > 0 ? Math.round((category.stock / totalStock) * 100) : 0;
                  return (
                    <div className="category-card" key={category.id}>
                      <div className="category-card-heading">
                        <span className={`category-dot category-dot-${index % 4}`} />
                        <strong>{category.name}</strong>
                        <span>{percentage}%</span>
                      </div>
                      <div className="progress-track">
                        <span
                          className={`progress-fill progress-fill-${index % 4}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="category-card-bottom">
                        <span>Participación del stock</span>
                        <strong>{numberFormat.format(category.stock)} uds.</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel low-stock-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <span className="panel-icon panel-icon-red"><AlertTriangle size={19} /></span>
                <div><h2>Atención: stock bajo</h2><p>Existencias iguales o inferiores al umbral</p></div>
              </div>
              <button className="text-button" onClick={onShowVariants} type="button">
                Ver inventario <ArrowUpRight size={15} />
              </button>
            </div>
            {loading ? (
              <LoadingState />
            ) : !dataReady ? (
              <EmptyState icon={CircleHelp} title="Datos no disponibles" description="No se pudo consultar el stock." compact />
            ) : lowStockVariants.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="Todo en orden"
                description="No hay variantes con existencias críticas."
                compact
              />
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>SKU</th><th>Producto</th><th>Talla / Color</th><th>Existencias</th></tr></thead>
                  <tbody>
                    {lowStockVariants.slice(0, 5).map((variant) => (
                      <tr key={variant.id}>
                        <td><span className="sku-text">{variant.sku}</span></td>
                        <td className="table-strong">{variant.product_id ? productNameById.get(variant.product_id) ?? "Producto" : "Producto"}</td>
                        <td>{[variant.size, variant.color].filter(Boolean).join(" · ") || "—"}</td>
                        <td><span className={`stock-pill${variant.stock_quantity === 0 ? " stock-pill-empty" : ""}`}>{variant.stock_quantity} uds.</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <span className="panel-icon panel-icon-green"><ClipboardList size={19} /></span>
              <div><h2>Actividad reciente</h2><p>Últimos movimientos registrados</p></div>
            </div>
            <button aria-label="Ver todo el historial" className="icon-button" onClick={onShowActivity} type="button">
              <ArrowUpRight size={18} />
            </button>
          </div>
          {loading ? (
            <LoadingState />
          ) : !dataReady ? (
            <EmptyState icon={CircleHelp} title="Datos no disponibles" description="No se pudo consultar la actividad." />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Sin movimientos aún"
              description="Los movimientos de inventario registrados aparecerán aquí."
            />
          ) : (
            <>
              <div className="activity-list">
                {logs.slice(0, 5).map((log) => {
                  const isEntry =
                    log.type === "ADDITION" ||
                    log.type === "RETURN" ||
                    (log.type === "ADJUSTMENT" && log.quantity_changed > 0);
                  return (
                    <article className="activity-item" key={log.id}>
                      <span className={`activity-icon${isEntry ? " activity-icon-entry" : ""}`}>
                        {isEntry ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}
                      </span>
                      <div className="activity-copy">
                        <strong>{log.type.replaceAll("_", " ")}</strong>
                        <span>{log.notes || "Movimiento de inventario"}</span>
                        <small>{formatDate(log.created_at)}</small>
                      </div>
                      <span className={`activity-quantity${isEntry ? " quantity-entry" : ""}`}>
                        {log.quantity_changed > 0 ? "+" : ""}{log.quantity_changed}
                      </span>
                    </article>
                  );
                })}
              </div>
              <button className="activity-link" onClick={onShowActivity} type="button">
                Ver historial completo <ArrowUpRight size={15} />
              </button>
            </>
          )}
        </section>
      </div>

      <div className="dashboard-footnote">
        <CircleHelp size={15} />
        <span>El stock crítico respeta el umbral configurado en cada variante.</span>
      </div>
    </>
  );
}

function ProductsSection({
  products,
  categoryNameById,
  loading,
  dataReady,
  exchangeRate,
  onAdd,
  onEdit,
  onToggle,
}: {
  products: Product[];
  categoryNameById: Map<string, string>;
  loading: boolean;
  dataReady: boolean;
  exchangeRate: number | null;
  onAdd: () => void;
  onEdit: (product: Product) => void;
  onToggle: (product: Product) => void;
}) {
  return (
    <section className="panel list-panel">
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-icon panel-icon-blue"><Package size={19} /></span>
          <div><h2>Todos los productos</h2><p>Gestiona la información y el estado de cada producto</p></div>
        </div>
        <span className="result-count">{products.length} productos</span>
      </div>
      {loading ? <LoadingState /> : !dataReady ? (
        <EmptyState icon={CircleHelp} title="Datos no disponibles" description="Revisa la conexión con Supabase para consultar tus productos." />
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No se encontraron productos"
          description="Registra tu primer producto para comenzar a administrar el inventario."
          action={<button className="button button-primary button-small" onClick={onAdd} type="button"><Plus size={16} /> Crear producto</button>}
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table products-table">
            <thead><tr><th>Producto</th><th>Categoría</th><th>Precio unitario</th><th>Precio 3–11 uds.</th><th>Precio mayorista (12+)</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-cell-icon">
                      {product.image_url ? (
                        <Image
                          alt=""
                          height={38}
                          src={product.image_url}
                          unoptimized
                          width={38}
                        />
                      ) : (
                        <Package size={17} />
                      )}
                      <span>{product.name}</span>
                    </div>
                  </td>
                  <td>{categoryNameById.get(product.category_id ?? "") ?? "Sin categoría"}</td>
                  <td><span className="table-strong">{currencyFormat.format(product.base_price_usd)}</span>{exchangeRate && <span className="table-subtext">{vesFormat.format(product.base_price_usd * exchangeRate)}</span>}</td>
                  <td>{product.promotional_price_3_11_usd === null || typeof product.promotional_price_3_11_usd === "undefined" ? <span>—</span> : <><span className="table-strong">{currencyFormat.format(product.promotional_price_3_11_usd)}</span>{exchangeRate && <span className="table-subtext">{vesFormat.format(product.promotional_price_3_11_usd * exchangeRate)}</span>}</>}</td>
                  <td>{product.wholesale_price_usd === null || typeof product.wholesale_price_usd === "undefined" ? <span>—</span> : <><span className="table-strong">{currencyFormat.format(product.wholesale_price_usd)}</span>{exchangeRate && <span className="table-subtext">{vesFormat.format(product.wholesale_price_usd * exchangeRate)}</span>}</>}</td>
                  <td><span className={`status-pill${product.is_active ? "" : " status-pill-off"}`}><span />{product.is_active ? "Activo" : "Inactivo"}</span></td>
                  <td>
                    <div className="row-actions">
                      <button className="table-action" onClick={() => onEdit(product)} type="button">Editar</button>
                      <button className="table-action table-action-muted" onClick={() => onToggle(product)} type="button">
                        {product.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function VariantsSection({
  variants,
  products,
  lowStockVariants,
  loading,
  dataReady,
  onAdd,
  onAdjust,
}: {
  variants: Variant[];
  products: Product[];
  lowStockVariants: Variant[];
  loading: boolean;
  dataReady: boolean;
  onAdd: () => void;
  onAdjust: (variant: Variant) => void;
}) {
  const productNames = new Map(products.map((product) => [product.id, product.name]));

  return (
    <section className="panel list-panel">
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-icon panel-icon-violet"><SlidersHorizontal size={19} /></span>
          <div><h2>Variantes registradas</h2><p>Consulta tallas, colores y existencias por SKU</p></div>
        </div>
        <span className={`stock-summary${lowStockVariants.length > 0 ? " stock-summary-alert" : ""}`}>
          {lowStockVariants.length} con stock bajo
        </span>
      </div>
      {loading ? <LoadingState /> : !dataReady ? (
        <EmptyState icon={CircleHelp} title="Datos no disponibles" description="Revisa la conexión con Supabase para consultar el stock." />
      ) : variants.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Aún no hay variantes"
          description="Las tallas y colores de tus productos aparecerán aquí."
          action={<button className="button button-primary button-small" onClick={onAdd} type="button"><Plus size={16} /> Registrar producto</button>}
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>SKU</th><th>Producto</th><th>Talla</th><th>Color</th><th>Existencias</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id}>
                  <td><span className="sku-text">{variant.sku}</span></td>
                  <td className="table-strong">{variant.product_id ? productNames.get(variant.product_id) ?? "Producto" : "Producto"}</td>
                  <td>{variant.size || "—"}</td>
                  <td>{variant.color || "—"}</td>
                  <td className="table-strong">{numberFormat.format(variant.stock_quantity)}</td>
                  <td><span className={`stock-pill${variant.stock_quantity === 0 ? " stock-pill-empty" : variant.stock_quantity <= variant.min_stock_alert ? "" : " stock-pill-ok"}`}>{variant.stock_quantity === 0 ? "Agotado" : variant.stock_quantity <= variant.min_stock_alert ? "Reabastecer" : "Disponible"}</span></td>
                  <td><button className="table-action" onClick={() => onAdjust(variant)} type="button">Ajustar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ActivitySection({
  logs,
  productNameById,
  variants,
  loading,
  dataReady,
}: {
  logs: InventoryLog[];
  productNameById: Map<string, string>;
  variants: Variant[];
  loading: boolean;
  dataReady: boolean;
}) {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return (
    <section className="panel list-panel">
      <div className="panel-heading">
        <div className="panel-title">
          <span className="panel-icon panel-icon-green"><ClipboardList size={19} /></span>
          <div><h2>Historial de movimientos</h2><p>Últimos registros de actividad de inventario</p></div>
        </div>
        <span className="result-count">Últimos {logs.length} registros</span>
      </div>
      {loading ? <LoadingState /> : !dataReady ? (
        <EmptyState icon={CircleHelp} title="Datos no disponibles" description="Revisa la conexión con Supabase para consultar los movimientos." />
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Todavía no hay movimientos"
          description="Cuando se registren ingresos o ajustes de stock, aparecerán aquí."
        />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Tipo</th><th>Producto / SKU</th><th>Detalle</th><th>Cantidad</th><th>Fecha</th></tr></thead>
            <tbody>
              {logs.map((log) => {
                const variant = log.variant_id
                  ? variantById.get(log.variant_id)
                  : undefined;
                return (
                  <tr key={log.id}>
                    <td><span className="log-action">{log.type.replaceAll("_", " ")}</span></td>
                    <td><div className="table-strong">{variant?.product_id ? productNameById.get(variant.product_id) ?? "Producto" : "Producto"}</div><span className="table-subtext">{variant?.sku ?? "—"}</span></td>
                    <td>{log.notes || "—"}</td>
                    <td><span className="quantity-badge">{log.quantity_changed > 0 ? "+" : ""}{log.quantity_changed}</span></td>
                    <td>{formatDate(log.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={21} />
      <span>Cargando datos del inventario...</span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: {
  icon: typeof Package;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state${compact ? " empty-state-compact" : ""}`}>
      <span className="empty-icon"><Icon size={20} /></span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}
