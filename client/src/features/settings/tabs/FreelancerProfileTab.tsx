import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SkillTagInput } from "@/components/ui/SkillTagInput";
import apiClient from "@/api/axios";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ExternalLink, Loader2 } from "lucide-react";

type Profile = {
  id: string;
  bio: string | null;
  hourlyRate: number | null;
  availability: boolean;
  skills: { id: string; name: string }[];
  portfolio: PortfolioItem[];
};

type PortfolioItem = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
};

type PortfolioForm = { title: string; description: string; url: string; imageUrl: string };

const emptyPortfolioForm: PortfolioForm = { title: "", description: "", url: "", imageUrl: "" };

export function FreelancerProfileTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["my-freelancer-profile"],
    queryFn: async () => {
      const res = await apiClient.get<{ data: Profile }>("/freelancers/me");
      return res.data.data;
    },
  });

  const [bio, setBio] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState<string | null>(null);
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [skills, setSkills] = useState<string[] | null>(null);

  const currentBio = bio ?? profile?.bio ?? "";
  const currentRate = hourlyRate ?? (profile?.hourlyRate != null ? String(profile.hourlyRate) : "");
  const currentAvailability = availability ?? profile?.availability ?? true;
  const currentSkills = skills ?? profile?.skills.map((s) => s.name) ?? [];

  const updateProfile = useMutation({
    mutationFn: async () => {
      await apiClient.put("/freelancers/me", {
        bio: currentBio || undefined,
        hourlyRate: currentRate ? Number(currentRate) : undefined,
        availability: currentAvailability,
        skillNames: currentSkills.length > 0 ? currentSkills : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-freelancer-profile"] });
      toast.success(t("settings.savedSuccess", "Profil mis à jour"));
      setBio(null); setHourlyRate(null); setAvailability(null); setSkills(null);
    },
    onError: () => toast.error(t("common.error")),
  });

  // Portfolio
  const [portfolioDialog, setPortfolioDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [form, setForm] = useState<PortfolioForm>(emptyPortfolioForm);

  const openAdd = useCallback(() => {
    setEditingItem(null);
    setForm(emptyPortfolioForm);
    setPortfolioDialog(true);
  }, []);

  const openEdit = useCallback((item: PortfolioItem) => {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description ?? "", url: item.url ?? "", imageUrl: item.imageUrl ?? "" });
    setPortfolioDialog(true);
  }, []);

  const savePortfolio = useMutation({
    mutationFn: async () => {
      const body = { ...form, url: form.url || undefined, imageUrl: form.imageUrl || undefined };
      if (editingItem) {
        await apiClient.put(`/portfolio/${editingItem.id}`, body);
      } else {
        await apiClient.post("/portfolio", body);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-freelancer-profile"] });
      setPortfolioDialog(false);
      toast.success(editingItem ? "Projet mis à jour" : "Projet ajouté");
    },
    onError: () => toast.error(t("common.error")),
  });

  const deletePortfolio = useMutation({
    mutationFn: async (id: string) => { await apiClient.delete(`/portfolio/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-freelancer-profile"] });
      toast.success("Projet supprimé");
    },
    onError: () => toast.error(t("common.error")),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Aucun profil freelance trouvé.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mon profil freelance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Availability toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
            <div>
              <p className="text-sm font-medium">Disponibilité</p>
              <p className="text-xs text-muted-foreground">Visible par les managers</p>
            </div>
            <Switch
              checked={currentAvailability}
              onCheckedChange={(v) => setAvailability(v)}
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea
              value={currentBio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Parlez de vous..."
              rows={3}
            />
          </div>

          {/* Hourly rate */}
          <div className="space-y-1.5">
            <Label>Taux horaire (TND/h)</Label>
            <Input
              type="number"
              min={0}
              value={currentRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="ex. 150"
            />
          </div>

          {/* Skills with autocomplete */}
          <div className="space-y-1.5">
            <Label>Compétences</Label>
            <SkillTagInput value={currentSkills} onChange={setSkills} />
          </div>

          <Button onClick={() => updateProfile.mutate()} disabled={updateProfile.isPending} className="w-full sm:w-auto">
            {updateProfile.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</> : "Enregistrer"}
          </Button>
        </CardContent>
      </Card>

      {/* Portfolio */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Portfolio</CardTitle>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Ajouter un projet
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile.portfolio.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun projet dans votre portfolio.
            </p>
          ) : (
            profile.portfolio.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{item.title}</p>
                  {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
                      <ExternalLink className="h-3 w-3" /> {item.url}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => deletePortfolio.mutate(item.id)}
                    disabled={deletePortfolio.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Portfolio dialog */}
      <Dialog open={portfolioDialog} onOpenChange={setPortfolioDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Modifier le projet" : "Ajouter un projet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Mon projet" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Ce que vous avez réalisé..." />
            </div>
            <div className="space-y-1.5">
              <Label>URL du projet</Label>
              <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <Label>URL de l'image</Label>
              <Input value={form.imageUrl} onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPortfolioDialog(false)}>Annuler</Button>
            <Button onClick={() => savePortfolio.mutate()} disabled={!form.title.trim() || savePortfolio.isPending}>
              {savePortfolio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
