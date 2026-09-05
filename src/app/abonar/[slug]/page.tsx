import { notFound } from "next/navigation";
import AbonarForm from "@/components/abonar/AbonarForm";
import { getPlanPaymentData } from "@/lib/db/api";

export default async function AbonarPage(props: PageProps<"/abonar/[slug]">) {
  const { slug } = await props.params;

  const data = await getPlanPaymentData(slug);
  if (!data) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AbonarForm
        tenantName={data.tenantName}
        tenantSlug={data.tenantSlug}
        plan={data.plan}
        subscriptionStatus={data.subscriptionStatus}
        currentPeriodEnd={data.currentPeriodEnd}
        amount={data.amount}
        bank={data.bank}
      />
    </div>
  );
}
