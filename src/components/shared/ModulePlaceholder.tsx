import Link from "next/link";

type ModulePlaceholderProps = {
  title: string;
  phase: string;
  description: string;
};

export default function ModulePlaceholder({
  title,
  phase,
  description,
}: ModulePlaceholderProps) {
  return (
    <main className="module-placeholder">
      <div className="module-placeholder-card">
        <span className="module-placeholder-phase">{phase}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <p className="module-placeholder-status">Este módulo todavía no está implementado.</p>
        <Link href="/admin/inventory">Ir al sistema de inventario</Link>
      </div>
    </main>
  );
}
