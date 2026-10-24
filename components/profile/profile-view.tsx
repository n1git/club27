import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageTop } from "@/components/personal/page-top";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { updateCoachProfile, updateOrganizationName, updateOwnProfile, updatePublicProfile } from "@/lib/actions/profile";
import { formatJakartaDate } from "@/lib/format";
import { formatRupiah, PERIOD_LABEL } from "@/lib/pricing";
import type { BillingPeriod } from "@/lib/pricing";
import type { OrganizationSection, ProfileData } from "@/lib/data/profile";
import type { SocialProfileSettings } from "@/lib/data/social";
import { SocialProfileForm } from "./social-profile-form";
import { STATUS_LABEL, type PlatformSubscriptionStatus } from "@/lib/platform-status";
import { DetailList } from "./detail-list";
import { AvatarEditor } from "./avatar-editor";
import { MaskedAmount } from "./masked-amount";
import { PublicProfileForm } from "./public-profile-form";
import { CoachProfileForm, OrganizationNameForm, ProfileForm } from "./profile-form";

function Block({
  flat,
  title,
  description,
  bodyClass,
  children,
}: {
  flat: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  bodyClass?: string;
  children: React.ReactNode;
}) {
  if (flat) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <div className={bodyClass}>{children}</div>
      </section>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={bodyClass}>{children}</CardContent>
    </Card>
  );
}

const BASE_ROLE_LABEL: Record<OrganizationSection["baseRole"], string> = {
  p_owner: "Pemilik utama",
  owner: "Pemilik",
  staff: "Staf",
};

function organizationItems(org: OrganizationSection) {
  const items: { label: string; value: React.ReactNode }[] = [
    { label: "Peran Anda", value: BASE_ROLE_LABEL[org.baseRole] },
    { label: "Jumlah klub", value: org.clubCount },
    { label: "Jumlah staf", value: org.staffCount },
    { label: "Jumlah anggota", value: org.memberCount },
  ];
  if (org.canEdit) {
    items.push(
      {
        label: "Paket",
        value: org.planName
          ? `${org.planName}${org.billingPeriod ? ` (${PERIOD_LABEL[org.billingPeriod as BillingPeriod] ?? org.billingPeriod})` : ""}`
          : "-",
      },
      { label: "Status langganan", value: org.status ? STATUS_LABEL[org.status as PlatformSubscriptionStatus] ?? org.status : "-" }
    );
    if (org.status === "trial" && org.trialEndsAt) items.push({ label: "Trial berakhir", value: formatJakartaDate(org.trialEndsAt) });
    if (org.periodEnd) items.push({ label: "Periode berakhir", value: formatJakartaDate(org.periodEnd) });
  }
  return items;
}

export function ProfileView({
  data,
  avatar,
  view = "all",
  socialSettings,
}: {
  data: ProfileData;
  avatar?: { url: string | null } | null;
  view?: "all" | "account";
  socialSettings?: SocialProfileSettings | null;
}) {
  const { account } = data;
  const flat = view === "account";
  const heading = flat ? "text-sm font-semibold" : "text-sm font-semibold uppercase tracking-wide text-muted-foreground";
  return (
    <div className={flat ? "flex max-w-2xl flex-col gap-6" : "flex flex-col gap-6"}>
      {view === "account" ? (
        <PageTop title="Akun" subtitle="Foto, bio, data akun, profil publik, dan kata sandi." mobileSubtitle="Pengaturan akun Anda." />
      ) : (
        <PageHeader title="Profil Saya" subtitle={account.fullName} breadcrumb={[{ label: "Profil Saya" }]} />
      )}

      <section aria-labelledby="profile-personal" className="flex flex-col gap-3">
        <h2 id="profile-personal" className={heading}>
          Info pribadi
        </h2>
        {avatar ? (
          <Block flat={flat} title={<>Foto profil</>} description={<>Terlihat oleh teman Anda. Lokasi dan data kamera dihapus dari foto.</>}>
              <AvatarEditor name={account.fullName} url={avatar.url} />
            </Block>
        ) : null}
        {socialSettings ? (
          <Block flat={flat} title={<>Profil sosial</>} description={<>Bio dan lencana yang tampil di profil Anda, terlihat oleh teman.</>}>
              <SocialProfileForm settings={socialSettings} />
            </Block>
        ) : null}
        <Block flat={flat} title={<>Data akun</>} description={<>Berlaku untuk semua klub dan organisasi Anda.</>}>
            <div className="max-w-md">
              <ProfileForm
                action={updateOwnProfile}
                email={account.email}
                username={account.username}
                fullName={account.fullName}
                phone={account.phone}
                address={account.address}
              />
            </div>
          </Block>
      </section>

      <section aria-labelledby="profile-public" className="flex flex-col gap-3">
        <h2 id="profile-public" className={heading}>
          Profil publik
        </h2>
        <Block flat={flat} title={<>Halaman profil Anda</>} description={<>Mati secara bawaan. Anda bisa mematikannya kapan saja.</>}>
            <div className="max-w-xl">
              <PublicProfileForm
                action={updatePublicProfile}
                username={account.username}
                publicProfile={account.publicProfile}
                publicSearchOk={account.publicSearchOk}
              />
            </div>
          </Block>
      </section>

      {data.organizations.length > 0 ? (
        <section aria-labelledby="profile-organization" className="flex flex-col gap-3">
          <h2 id="profile-organization" className={heading}>
            Organisasi
          </h2>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {data.organizations.map((org) => (
              <Block flat={flat} key={org.id} title={<>{org.name}</>} description={<>{org.canEdit ? "Anda bisa mengubah data organisasi." : "Hanya pemilik yang bisa mengubah data organisasi."}</>} bodyClass="flex flex-col gap-4">
                  <DetailList items={organizationItems(org)} />
                  {org.canEdit ? <OrganizationNameForm action={updateOrganizationName} organizationId={org.id} name={org.name} /> : null}
                </Block>
            ))}
          </div>
        </section>
      ) : null}

      {data.coaching.length > 0 ? (
        <section aria-labelledby="profile-coach" className="flex flex-col gap-3">
          <h2 id="profile-coach" className={heading}>
            Profil pelatih
          </h2>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {data.coaching.map((coach) => (
              <Block flat={flat} key={coach.profileId} title={<>{coach.clubName}</>} description={<>Tarif dan sertifikasi diubah oleh admin klub.</>} bodyClass="flex flex-col gap-4">
                  <DetailList
                    items={[
                      { label: "Peran", value: coach.roleName },
                      { label: "Jumlah anggota", value: coach.memberCount },
                      {
                        label: "Tarif per sesi",
                        value: coach.sessionRate === null ? "-" : <MaskedAmount value={formatRupiah(coach.sessionRate)} />,
                      },
                    ]}
                  />
                  <CoachProfileForm action={updateCoachProfile} profileId={coach.profileId} specialization={coach.specialization} />
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Sertifikasi</h3>
                    {coach.certifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada sertifikasi.</p>
                    ) : (
                      <ul className="flex flex-col gap-2 text-sm">
                        {coach.certifications.map((cert) => (
                          <li key={cert.id} className="flex flex-wrap justify-between gap-2">
                            <span>
                              {cert.name}
                              {cert.number ? <span className="text-muted-foreground"> · {cert.number}</span> : null}
                            </span>
                            <span className="text-muted-foreground">
                              {cert.validUntil ? `Berlaku s.d. ${formatJakartaDate(cert.validUntil)}` : "Tanpa masa berlaku"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Block>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="profile-other" className="flex flex-col gap-3">
        <h2 id="profile-other" className={heading}>
          Lainnya
        </h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {data.memberships.length > 0 ? (
            <Block flat={flat} title={<>Keanggotaan klub</>} description={<>Data anggota lainnya dikelola oleh klub.</>}>
                <DetailList
                  items={data.memberships.map((m) => ({ label: m.clubName, value: m.coachName ? `Pelatih: ${m.coachName}` : "Belum ada pelatih" }))}
                />
              </Block>
          ) : null}
          <Block flat={flat} title={<>Keamanan</>} description={<>Mengganti kata sandi mengeluarkan semua sesi lain.</>}>
              <div className="max-w-sm">
                <ChangePasswordForm requireCurrent />
              </div>
            </Block>
        </div>
      </section>
    </div>
  );
}
