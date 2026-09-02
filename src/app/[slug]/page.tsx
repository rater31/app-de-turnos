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
    <main className="flex-1">
      <div
        className="border-b bg-white"
        style={{ borderColor: `${data.tenant.primary_color ?? "#0f172a"}22` }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-8 sm:px-6">
          {data.tenant.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.tenant.logo_url}
              alt={data.tenant.name}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <span
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white"
              style={{ backgroundColor: data.tenant.primary_color ?? "#0f172a" }}
            >
              {data.tenant.name.charAt(0)}
            </span>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{data.tenant.name}</h1>
            {data.tenant.description && (
              <p className="mt-1 text-sm text-slate-600">{data.tenant.description}</p>
            )}
            {(data.tenant.address || data.tenant.phone) && (
              <p className="mt-1 text-xs text-slate-500">
                {data.tenant.address} {data.tenant.phone && `· ${data.tenant.phone}`}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <BookingWizard
          tenant={data.tenant}
          services={data.services}
          staff={data.staff}
          serviceStaff={data.serviceStaff}
          hours={data.hours}
        />
      </div>
    </main>
  );
}