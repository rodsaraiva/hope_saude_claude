import { redirect } from 'next/navigation';

/** URL antiga: redireciona para o perfil público do médico. */
export default function LegacyDoctorProfileRedirect({
  params,
}: {
  params: { userId: string };
}) {
  redirect(`/doctors/${params.userId}`);
}
