import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { createTaskSchema, updateTaskSchema, type CreateTaskForm, type UpdateTaskForm } from "@/schemas/task.schema";
import type { Task } from "@/types/task";
import type { Project } from "@/types/project";
import type { User } from "@/types/auth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface TaskFormProps {
  task?: Task | null;
  projects: Project[];
  users: User[];
  onSubmit: (data: CreateTaskForm | UpdateTaskForm) => void;
  isSubmitting: boolean;
}

export function TaskForm({ task, projects, users, onSubmit, isSubmitting }: TaskFormProps) {
  const { t } = useTranslation();
  const isEdit = !!task;
  const schema = isEdit ? updateTaskSchema : createTaskSchema;

  const form = useForm<CreateTaskForm | UpdateTaskForm>({
    resolver: zodResolver(schema),
    defaultValues: task ? {
      ...task,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
    } : {
      title: "",
      description: "",
      status: "TODO",
      projectId: "",
      dueDate: "",
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.title")}</FormLabel>
              <FormControl>
                <Input placeholder={t("tasksPage.title")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.description")}</FormLabel>
              <FormControl>
                <Textarea placeholder={t("tasksPage.description")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.status")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("tasksPage.selectStatus")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="TODO">{t("tasksPage.statuses.todo")}</SelectItem>
                  <SelectItem value="IN_PROGRESS">{t("tasksPage.statuses.inProgress")}</SelectItem>
                  <SelectItem value="REVIEW">{t("tasksPage.statuses.review")}</SelectItem>
                  <SelectItem value="DONE">{t("tasksPage.statuses.done")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.project")}</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("tasksPage.selectProject")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="assigneeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assigné à</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("common.selectUser")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 text-xs">
                          <span>{getInitials(user.name)}</span>
                        </Avatar>
                        {user.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dueDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.dueDate")}</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEdit ? t("common.save") : t("common.create")}
        </Button>
      </form>
    </Form>
  );
}
