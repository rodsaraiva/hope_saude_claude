import { redirect } from 'next/navigation';

/** URL antiga: redireciona para o perfil público do médico. */
export default async function LegacyDoctorProfileRedirect({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  redirect(`/doctors/${userId}`);
}
