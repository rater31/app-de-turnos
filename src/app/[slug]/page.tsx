import { notFound } from "next/navigation";
import BookingWizard from "@/components/booking/BookingWizard";
import { getPublicBookingData } from "@/lib/db/api";

export default async function SlugPage(props: PageProps<"/[slug]">) {
  const { slug } = await props.params;

  const data = await getPublicBookingData(slug);
  if (!data) {
    notFound();
  }

  return (
    <BookingWizard
      tenant={data.tenant}
      services={data.services}
      staff={data.staff}
      serviceStaff={data.serviceStaff}
      hours={data.hours}
    />
  );
}
