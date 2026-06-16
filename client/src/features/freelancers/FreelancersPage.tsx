import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MoreHorizontal,
  Search,
  Plus,
  Loader2,
  Badge,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useFreelancers,
  useCreateMyFreelancerProfile,
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

const createProfileSchema = z.object({
  bio: z.string().optional(),
  hourlyRate: z.coerce.number().positive().optional(),
  skills: z.string().optional(),
});

type CreateProfileForm = z.infer<typeof createProfileSchema>;

export function FreelancersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: freelancers, isLoading } = useFreelancers();
  const { mutate: createProfile, isPending: isCreating } =
    useCreateMyFreelancerProfile();
  const { user } = useAuthStore();

  const isFreelancer = user?.role === "FREELANCER";
  const hasProfile = freelancers?.some((f) => f.userId === user?.id);

  const filteredFreelancers =
    freelancers?.filter((freelancer) => {
      const matchesName = freelancer.user.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesSkill = freelancer.skills.some((skill) =>
        skill.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return matchesName || matchesSkill;
    }) || [];

  const createForm = useForm<CreateProfileForm>({
    resolver: zodResolver(createProfileSchema) as any,
    defaultValues: {
      bio: "",
      hourlyRate: undefined,
      skills: "",
    },
  });

  const handleCreate = async (data: CreateProfileForm) => {
    const skillIds = data.skills
      ? data.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    createProfile(
      {
        bio: data.bio,
        hourlyRate: data.hourlyRate,
        skillIds: skillIds,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          createForm.reset();
        },
      }
    );
  };

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
          <h1 className="font-display text-2xl font-bold text-ink">
            Freelancers
          </h1>
          <p className="text-muted-foreground">
            Find and collaborate with skilled freelancers
          </p>
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
                <form
                  onSubmit={createForm.handleSubmit(handleCreate)}
                  className="space-y-4"
                >
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
                          <Input
                            type="number"
                            placeholder="50"
                            {...field}
                          />
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
                          <Input
                            placeholder="React, Node.js, TypeScript"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={isCreating}>
                      {isCreating && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Créer
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher par nom ou compétence..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Freelancers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFreelancers.map((freelancer) => (
          <Card
            key={freelancer.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {freelancer.user.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {freelancer.user.email}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {freelancer.bio
                  ? `${freelancer.bio.slice(0, 80)}${
                      freelancer.bio.length > 80 ? "..." : ""
                    }`
                  : "Aucune bio"}
              </p>
              {freelancer.hourlyRate && (
                <div className="text-sm font-medium">
                  {freelancer.hourlyRate} TND/h
                </div>
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
    </div>
  );
}
