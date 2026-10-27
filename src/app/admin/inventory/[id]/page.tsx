import InventoryApp from "@/components/inventory/InventoryApp";
import { Suspense } from "react";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

async function EditProduct({ params }: EditProductPageProps) {
  const { id } = await params;
  return <InventoryApp initialProductId={id} />;
}

export default function EditProductPage(props: EditProductPageProps) {
  return (
    <Suspense fallback={<main className="module-placeholder">Cargando producto...</main>}>
      <EditProduct {...props} />
    </Suspense>
  );
}
