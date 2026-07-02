// src/pages/MyAccount.tsx
"use client"

import * as React from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Shield, UploadCloud, CheckCircle2, UserRound } from "lucide-react"

// <-- use the auth.ts API you shared
import auth from "@/api/auth"

/* ------------------------------- Schémas ------------------------------- */
const profileSchema = z.object({
  firstName: z.string().min(1, "Requis"),
  lastName: z.string().min(1, "Requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(5, "Numéro invalide").optional().or(z.literal("")),
  role: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
})

const prefsSchema = z.object({
  language: z.string().min(1, "Requis"),
  timezone: z.string().min(1, "Requis"),
  currency: z.string().min(1, "Requis"),
  dateFormat: z.string().min(1, "Requis"),
})

const notifSchema = z.object({
  emailBooking: z.boolean(),
  emailPayment: z.boolean(),
  emailCancellation: z.boolean(),
  smsBooking: z.boolean(),
  smsPayment: z.boolean(),
  smsCancellation: z.boolean(),
})

const securitySchema = z.object({
  currentPassword: z.string().optional().or(z.literal("")),
  newPassword: z.string().optional().or(z.literal("")),
  confirmPassword: z.string().optional().or(z.literal("")),
  twoFA: z.boolean(),
})

type MeShape = {
  id?: string
  name?: string
  email?: string
  phone?: string
  role?: string
  two_fa_enabled?: boolean
  // Legacy fields
  firstName?: string
  lastName?: string
  avatarUrl?: string
}

/* ------------------------------ Component ----------------------------- */
export default function MyAccount() {
  const [loading, setLoading] = React.useState(true)
  const [savingProfile, setSavingProfile] = React.useState(false)
  const [savingSecurity, setSavingSecurity] = React.useState(false)
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "Admin",
      avatarUrl: "",
    },
  })

  const prefsForm = useForm<z.infer<typeof prefsSchema>>({
    resolver: zodResolver(prefsSchema),
    defaultValues: {
      language: "fr",
      timezone: "Africa/Brazzaville",
      currency: "XAF",
      dateFormat: "dd/MM/yyyy",
    },
  })

  const notifForm = useForm<z.infer<typeof notifSchema>>({
    resolver: zodResolver(notifSchema),
    defaultValues: {
      emailBooking: true,
      emailPayment: true,
      emailCancellation: true,
      smsBooking: true,
      smsPayment: false,
      smsCancellation: false,
    },
  })

  const securityForm = useForm<z.infer<typeof securitySchema>>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      twoFA: false,
    },
  })

  /* ------------------------------ Load me ------------------------------ */
  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const user = await auth.fetchUser<MeShape>("/auth/me") // or "/user" if that's your endpoint
        if (!alive) return

        // Derive first/last name if your API gives a single "name"
        let firstName = user?.firstName ?? ""
        let lastName = user?.lastName ?? ""

        if (!firstName && !lastName && user?.name) {
          const parts = String(user.name).trim().split(/\s+/)
          firstName = parts[0] ?? ""
          lastName = parts.slice(1).join(" ")
        }

        profileForm.reset({
          firstName,
          lastName,
          email: user?.email ?? "",
          phone: user?.phone ?? "",
          role: user?.role ?? "Admin",
          avatarUrl: user?.avatarUrl ?? "",
        })
        if (user?.avatarUrl) setAvatarPreview(user.avatarUrl)

        // If your /auth/me returns prefs / notifications / twoFA, hydrate them:
        if (user?.prefs) {
          prefsForm.reset({
            language: user.prefs.language ?? "fr",
            timezone: user.prefs.timezone ?? "Africa/Brazzaville",
            currency: user.prefs.currency ?? "XAF",
            dateFormat: user.prefs.dateFormat ?? "dd/MM/yyyy",
          })
        }
        if (user?.notifications) {
          notifForm.reset({
            emailBooking: !!user.notifications.emailBooking,
            emailPayment: !!user.notifications.emailPayment,
            emailCancellation: !!user.notifications.emailCancellation,
            smsBooking: !!user.notifications.smsBooking,
            smsPayment: !!user.notifications.smsPayment,
            smsCancellation: !!user.notifications.smsCancellation,
          })
        }
        if (typeof user?.two_fa_enabled === "boolean") {
          securityForm.setValue("twoFA", user.two_fa_enabled)
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Impossible de charger votre compte.")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ------------------------------ Handlers ------------------------------ */
  const onSaveProfile = async (v: z.infer<typeof profileSchema>) => {
    try {
      setSavingProfile(true)
      const name = [v.firstName, v.lastName].filter(Boolean).join(" ").trim()
      await auth.updateProfile({ name, email: v.email, phone: v.phone || null }, "/auth/me")
      toast.success("Profil mis à jour")
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de la mise à jour du profil.")
    } finally {
      setSavingProfile(false)
    }
  }

  const onSavePrefs = async (v: z.infer<typeof prefsSchema>) => {
    try {
      await auth.updatePrefs(v)
      toast.success("Préférences enregistrées")
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de l’enregistrement des préférences.")
    }
  }

  const onSaveNotif = async (v: z.infer<typeof notifSchema>) => {
    try {
      await auth.updateNotifications(v)
      toast.success("Préférences de notifications enregistrées")
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de l’enregistrement des notifications.")
    }
  }

  const onChangePassword = async (v: z.infer<typeof securitySchema>) => {
    if (!v.newPassword) return toast.error("Saisissez un nouveau mot de passe.")
    if (v.newPassword !== v.confirmPassword) return toast.error("La confirmation ne correspond pas.")
    try {
      setSavingSecurity(true)
      await auth.changePassword(
        { currentPassword: v.currentPassword ?? "", newPassword: v.newPassword },
        "/auth/change-password"
      )
      toast.success("Mot de passe mis à jour")
      securityForm.reset({ ...securityForm.getValues(), currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (e: any) {
      toast.error(e?.message ?? "Échec de la mise à jour.")
    } finally {
      setSavingSecurity(false)
    }
  }

  const onToggleTwoFA = async (enabled: boolean) => {
    securityForm.setValue("twoFA", enabled)
    try {
      await auth.setTwoFA({ enabled }, "/auth/toggle-2fa")
      toast.success(enabled ? "2FA activée" : "2FA désactivée")
    } catch (e: any) {
      securityForm.setValue("twoFA", !enabled)
      toast.error(e?.message ?? "Échec de la mise à jour 2FA.")
    }
  }

  const onUploadAvatar = async (file?: File | null) => {
    if (!file) return
    try {
      const fd = new FormData()
      fd.append("avatar", file)
      const res = await auth.uploadAvatar(fd) // -> { url?: string }
      const url = res.data?.url as string | undefined
      if (url) {
        setAvatarPreview(url)
        profileForm.setValue("avatarUrl", url, { shouldDirty: true })
        toast.success("Avatar mis à jour")
      } else {
        // Fallback to local preview if API doesn’t return URL
        const local = URL.createObjectURL(file)
        setAvatarPreview(local)
        toast.success("Avatar chargé (prévisualisation)")
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Échec du chargement de l’avatar.")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Mon compte</h1>
        <p className="text-sm text-muted-foreground">
          Gérez votre profil, vos préférences, vos notifications et la sécurité de votre compte.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile" className="gap-2">
            <UserRound className="h-4 w-4" /> Profil
          </TabsTrigger>
          {/* Re-enable when ready */}
          {/* <TabsTrigger value="prefs" className="gap-2"><Globe className="h-4 w-4" /> Préférences</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger> */}
          <TabsTrigger value="security" className="gap-2">
            <Shield className="h-4 w-4" /> Sécurité
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ Profil ------------------------------ */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profil</CardTitle>
              <CardDescription>Vos informations visibles par l’équipe et sur les documents.</CardDescription>
            </CardHeader>

            <CardContent className="grid gap-6 md:grid-cols-3">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-24 w-24 overflow-hidden rounded-full ring-1 ring-border">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                      Aucun avatar
                    </div>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <UploadCloud className="h-4 w-4" />
                  <span>Télécharger</span>
                  <Input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => onUploadAvatar(e.target.files?.[0] ?? null)}
                  />
                </label>

                {avatarPreview && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Prévisualisation
                  </span>
                )}
              </div>

              {/* Infos */}
              <div className="space-y-3 md:col-span-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Prénom</Label>
                    <Input disabled={loading} {...profileForm.register("firstName")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input disabled={loading} {...profileForm.register("lastName")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input disabled={loading} type="email" {...profileForm.register("email")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone</Label>
                    <Input disabled={loading} placeholder="+242..." {...profileForm.register("phone")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Input
                      readOnly
                      disabled
                      value={profileForm.watch("role") || "—"}
                      className="capitalize bg-muted/50"
                    />
                  </div>
                  {/* Hidden but kept in form so avatar url is persisted */}
                  <input type="hidden" {...profileForm.register("avatarUrl")} />
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-end">
              <Button disabled={loading || savingProfile} onClick={profileForm.handleSubmit(onSaveProfile)}>
                {savingProfile ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* --------------------------- Préférences (optional UI) ---------------------------
        <TabsContent value="prefs">
          <Card>
            <CardHeader>
              <CardTitle>Préférences</CardTitle>
              <CardDescription>Langue, fuseau horaire, devise et format de date.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Langue</Label>
                <Select
                  defaultValue={prefsForm.getValues("language")}
                  onValueChange={(v) => prefsForm.setValue("language", v, { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir la langue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="sw">Kiswahili</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fuseau horaire</Label>
                <Select
                  defaultValue={prefsForm.getValues("timezone")}
                  onValueChange={(v) => prefsForm.setValue("timezone", v, { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner un fuseau" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Africa/Brazzaville">Africa/Brazzaville</SelectItem>
                    <SelectItem value="Africa/Douala">Africa/Douala</SelectItem>
                    <SelectItem value="Africa/Kinshasa">Africa/Kinshasa</SelectItem>
                    <SelectItem value="Africa/Nairobi">Africa/Nairobi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Devise</Label>
                <Select
                  defaultValue={prefsForm.getValues("currency")}
                  onValueChange={(v) => prefsForm.setValue("currency", v, { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner une devise" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF — Franc CFA (BEAC)</SelectItem>
                    <SelectItem value="XOF">XOF — Franc CFA (UEMOA)</SelectItem>
                    <SelectItem value="CDF">CDF — Franc congolais</SelectItem>
                    <SelectItem value="KES">KES — Shilling kényan</SelectItem>
                    <SelectItem value="USD">USD — Dollar US</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Format de date</Label>
                <Select
                  defaultValue={prefsForm.getValues("dateFormat")}
                  onValueChange={(v) => prefsForm.setValue("dateFormat", v, { shouldDirty: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Sélectionner un format" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd/MM/yyyy">JJ/MM/AAAA</SelectItem>
                    <SelectItem value="MM/dd/yyyy">MM/JJ/AAAA</SelectItem>
                    <SelectItem value="yyyy-MM-dd">AAAA-MM-JJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={prefsForm.handleSubmit(onSavePrefs)}>Enregistrer</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        --------------------------------------------------------------------- */}

        {/* --------------------------- Notifications (optional UI) ---------------------------
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choisissez comment vous voulez être alerté.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Réservations</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <Switch
                      checked={notifForm.watch("emailBooking")}
                      onCheckedChange={(v) => notifForm.setValue("emailBooking", v)}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">SMS</span>
                    <Switch
                      checked={notifForm.watch("smsBooking")}
                      onCheckedChange={(v) => notifForm.setValue("smsBooking", v)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Paiements</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <Switch
                      checked={notifForm.watch("emailPayment")}
                      onCheckedChange={(v) => notifForm.setValue("emailPayment", v)}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">SMS</span>
                    <Switch
                      checked={notifForm.watch("smsPayment")}
                      onCheckedChange={(v) => notifForm.setValue("smsPayment", v)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-sm font-medium">Annulations</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <Switch
                      checked={notifForm.watch("emailCancellation")}
                      onCheckedChange={(v) => notifForm.setValue("emailCancellation", v)}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">SMS</span>
                    <Switch
                      checked={notifForm.watch("smsCancellation")}
                      onCheckedChange={(v) => notifForm.setValue("smsCancellation", v)}
                    />
                  </div>
                </div>
              </div>

              <Alert>
                <AlertTitle>Astuce</AlertTitle>
                <AlertDescription>
                  Les SMS nécessitent un fournisseur actif (voir <span className="font-medium">Paramètres &gt; Notifications</span>).
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="justify-end">
              <Button onClick={notifForm.handleSubmit(onSaveNotif)}>Enregistrer</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        --------------------------------------------------------------------- */}

        {/* ------------------------------ Sécurité ------------------------------ */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Sécurité</CardTitle>
              <CardDescription>Protégez votre compte et gérez les options sensibles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Mot de passe */}
              <section className="grid gap-4 rounded-lg border p-4">
                <p className="text-sm font-medium">Mot de passe</p>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Mot de passe actuel</Label>
                    <Input type="password" placeholder="••••••••" {...securityForm.register("currentPassword")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nouveau mot de passe</Label>
                    <Input type="password" placeholder="••••••••" {...securityForm.register("newPassword")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmation</Label>
                    <Input type="password" placeholder="••••••••" {...securityForm.register("confirmPassword")} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    disabled={savingSecurity}
                    onClick={securityForm.handleSubmit(onChangePassword)}
                  >
                    {savingSecurity ? "Mise à jour…" : "Mettre à jour le mot de passe"}
                  </Button>
                </div>
              </section>

              {/* 2FA */}
              <section className="grid gap-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Double authentification (2FA)</p>
                    <p className="text-xs text-muted-foreground">
                      Renforcez la sécurité via application d’authentification ou SMS.
                    </p>
                  </div>
                  <Switch
                    checked={securityForm.watch("twoFA")}
                    onCheckedChange={onToggleTwoFA}
                  />
                </div>
                <Alert>
                  <AlertTitle>Conseil</AlertTitle>
                  <AlertDescription>
                    Nous recommandons d’utiliser une app (ex. Authy, Google Authenticator) plutôt que le SMS.
                  </AlertDescription>
                </Alert>
              </section>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
