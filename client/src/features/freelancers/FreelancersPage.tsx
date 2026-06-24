import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Search,
  Plus,
  Edit,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useFreelancers,
  useCreateMyFreelancerProfile,
  useUpdateMyFreelancerProfile,
} from "@/hooks/useFreelancers";
import type { FreelancerProfile } from "@/types/freelancer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/auth.store";
import { useListParams } from "@/hooks/useListParams";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const createProfileSchema = z.object({
  bio: z.string().optional(),
  hourlyRate: z.coerce.number().positive().optional(),
  skills: z.string().optional(),
});

const updateProfileSchema = z.object({
  bio: z.string().optional(),
  hourlyRate: z.coerce.number().positive().optional(),
  availability: z.boolean().optional(),
  skills: z.string().optional(),
});

type CreateProfileForm = z.infer<typeof createProfileSchema>;
type UpdateProfileForm = z.infer<typeof updateProfileSchema>;


export function FreelancersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingFreelancer, setEditingFreelancer] = useState<FreelancerProfile | null>(null);

  const { page, pageSize, orderBy, orderDir, params, setPage, updateParams } = useListParams(12);
  const { data: freelancersResult, isLoading } = useFreelancers(params);
  const freelancers = freelancersResult?.data ?? [];
  const total = freelancersResult?.total ?? 0;
  const { mutate: createProfile, isPending: isCreating } = useCreateMyFreelancerProfile();
  const { mutate: updateProfile, isPending: isUpdating } = useUpdateMyFreelancerProfile();
  const { user } = useAuthStore();

  const isFreelancer = user?.role === "FREELANCER";
  const myProfile = useMemo(() => freelancers.find((f) => f.userId === user?.id), [freelancers, user?.id]);
  const hasProfile = !!myProfile;

  const filteredFreelancers = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) return freelancers;
    return freelancers.filter((freelancer) => {
      const matchesName = freelancer.user.name.toLowerCase().includes(q);
      const matchesSkill = freelancer.skills.some((skill) => skill.name.toLowerCase().includes(q));
      return matchesName || matchesSkill;
    });
  }, [deferredSearchQuery, freelancers]);

  const createForm = useForm<CreateProfileForm>({
    resolver: zodResolver(createProfileSchema) as any,
    defaultValues: {
      bio: "",
      hourlyRate: undefined,
      skills: "",
    },
  });

  const editForm = useForm<UpdateProfileForm>({
    resolver: zodResolver(updateProfileSchema) as any,
    defaultValues: {
      bio: "",
      hourlyRate: undefined,
      availability: true,
      skills: "",
    },
  });

  const handleCreate = useCallback(async (data: CreateProfileForm) => {
    const skillNames = data.skills
      ? data.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    createProfile(
      {
        bio: data.bio,
        hourlyRate: data.hourlyRate,
        skillNames: skillNames,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          createForm.reset();
        },
      }
    );
  }, [createForm, createProfile]);

  const handleEdit = useCallback((freelancer: FreelancerProfile) => {
    setEditingFreelancer(freelancer);
    editForm.reset({
      bio: freelancer.bio || "",
      hourlyRate: freelancer.hourlyRate,
      availability: freelancer.availability,
      skills: freelancer.skills.map((s) => s.name).join(", "),
    });
    setEditDialogOpen(true);
  }, [editForm]);

  const handleUpdate = useCallback(async (data: UpdateProfileForm) => {
    const skillNames = data.skills
      ? data.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    updateProfile(
      {
        bio: data.bio,
        hourlyRate: data.hourlyRate,
        availability: data.availability,
        skillNames: skillNames,
      },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setEditingFreelancer(null);
          editForm.reset();
        },
      }
    );
  }, [editForm, updateProfile]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Équipe</h1>
          <p className="text-muted-foreground">Trouvez et collaborez avec les membres de l'équipe</p>
        </div>
        {isFreelancer && !hasProfile && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Postuler comme freelancer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer un profil freelancer</DialogTitle>
                <DialogDescription>
                  Ajoutez vos compétences et votre taux horaire pour commencer
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bio</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Parlez-nous de vos compétences et expérience..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="hourlyRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Taux horaire (TND)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="skills"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Compétences (séparées par des virgules)</FormLabel>
                        <FormControl>
                          <Input placeholder="React, Node.js, TypeScript" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Créer
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher par nom ou compétence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={`${orderBy ?? "createdAt"}-${orderDir}`}
          onValueChange={(v) => {
            const [col, dir] = v.split("-") as [string, "asc" | "desc"];
            updateParams({ orderBy: col, orderDir: dir, page: 1 });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Trier par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Nom (A-Z)</SelectItem>
            <SelectItem value="name-desc">Nom (Z-A)</SelectItem>
            <SelectItem value="createdAt-desc">Plus récents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Freelancers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFreelancers.map((freelancer) => (
          <Card key={freelancer.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <Link to={`/app/freelancers/${freelancer.id}`} className="hover:underline">
                  <CardTitle className="text-lg">{freelancer.user.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{freelancer.user.email}</p>
                </Link>
                {freelancer.userId === user?.id && (
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(freelancer)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {freelancer.bio
                  ? `${freelancer.bio.slice(0, 80)}${freelancer.bio.length > 80 ? "..." : ""}`
                  : "Aucune bio"}
              </p>
              {freelancer.hourlyRate && (
                <div className="text-sm font-medium">{freelancer.hourlyRate} TND/h</div>
              )}
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    freelancer.availability
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {freelancer.availability ? "Disponible" : "Occupé"}
                </span>
                {freelancer.skills.map((skill) => (
                  <span
                    key={skill.id}
                    className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2.5 py-0.5 text-xs font-medium"
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      {/* Edit Dialog */}
      {editingFreelancer && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier le profil freelancer</DialogTitle>
              <DialogDescription>
                Mettez à jour vos informations
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Parlez-nous de vos compétences et expérience..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taux horaire (TND)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between">
                      <FormLabel>Disponible</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compétences (séparées par des virgules)</FormLabel>
                      <FormControl>
                        <Input placeholder="React, Node.js, TypeScript" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
