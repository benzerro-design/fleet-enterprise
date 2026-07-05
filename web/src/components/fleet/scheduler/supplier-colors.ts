/** Tailwind class fragments for supplier category accent borders. */
export function supplierAccentClass(category: string | null | undefined): string {
  switch (category) {
    case "itp":
      return "border-l-emerald-500";
    case "tires":
      return "border-l-amber-500";
    case "insurance":
    case "broker":
      return "border-l-violet-500";
    case "roadside_assistance":
      return "border-l-rose-500";
    case "rent":
      return "border-l-cyan-500";
    case "parts":
      return "border-l-orange-500";
    case "service_auto":
    default:
      return "border-l-sky-500";
  }
}

export function supplierDotClass(category: string | null | undefined): string {
  switch (category) {
    case "itp":
      return "bg-emerald-500";
    case "tires":
      return "bg-amber-500";
    case "insurance":
    case "broker":
      return "bg-violet-500";
    case "roadside_assistance":
      return "bg-rose-500";
    case "rent":
      return "bg-cyan-500";
    case "parts":
      return "bg-orange-500";
    case "service_auto":
    default:
      return "bg-sky-500";
  }
}
