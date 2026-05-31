import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

/** Redirect vechi → detaliu vehicul (accordion Remindere). */
export default async function VehicleRemindersRedirectPage({ params }: Props) {
  const { id } = await params;
  redirect(`/fleet/vehicles/${id}#reminders`);
}
