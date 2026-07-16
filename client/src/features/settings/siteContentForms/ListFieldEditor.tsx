import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { BilingualTextField } from "./BilingualTextField";
import { ICON_OPTIONS, type ListFieldSchema } from "./listFieldSchemas";

// Bilingual item: fr/en hold the same field shape (per schema); _enEdited
// tracks whether an admin has ever hand-edited an English field on this
// item, so a future "translate all" pass never silently overwrites a
// deliberate correction. Shared fields (icon, a link, a metric figure) live
// identically in both fr and en — writing one writes both.
type BilingualItem = {
  _id: string;
  fr: Record<string, unknown>;
  en: Record<string, unknown>;
  _enEdited: boolean;
};

function StringListInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={v}
            onChange={(e) => onChange(value.map((x, idx) => (idx === i ? e.target.value : x)))}
            className="text-sm"
          />
          <Button variant="ghost" size="icon" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onChange([...value, ""])}>
        <Plus className="h-3.5 w-3.5" />
        Ajouter
      </Button>
    </div>
  );
}

function ItemCard({
  item,
  schema,
  onChange,
  onDelete,
}: {
  item: BilingualItem;
  schema: ListFieldSchema;
  onChange: (item: BilingualItem) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  function setSharedField(key: string, value: unknown) {
    onChange({ ...item, fr: { ...item.fr, [key]: value }, en: { ...item.en, [key]: value } });
  }

  function setFrField(key: string, value: unknown) {
    onChange({ ...item, fr: { ...item.fr, [key]: value } });
  }

  function setEnField(key: string, value: unknown, markEdited: boolean) {
    onChange({ ...item, en: { ...item.en, [key]: value }, _enEdited: markEdited ? true : item._enEdited });
  }

  return (
    <Card ref={setNodeRef} style={style}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-ink flex items-center gap-1.5 text-xs font-medium"
          >
            <GripVertical className="h-4 w-4" />
            Glisser pour réordonner
          </button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {schema.fields.map((field) => {
          if (field.kind === "icon") {
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{field.label}</Label>
                <Select
                  value={(item.fr[field.key] as string) ?? "sparkles"}
                  onValueChange={(v) => setSharedField(field.key, v)}
                >
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field.kind === "string-list") {
            // Needs/tags are language-specific text, but a fixed structural
            // shortcut here: edit the French list; English list length is
            // kept in sync (empty strings appended/removed) so per-need
            // translation stays simple without a nested bilingual editor.
            const frList = (item.fr[field.key] as string[]) ?? [];
            const enList = (item.en[field.key] as string[]) ?? [];
            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{field.label} (Français)</Label>
                <StringListInput
                  value={frList}
                  onChange={(v) => {
                    setFrField(field.key, v);
                    const syncedEn = v.map((_, i) => enList[i] ?? "");
                    setEnField(field.key, syncedEn, item._enEdited);
                  }}
                />
                <Label className="text-xs font-semibold text-muted-foreground">{field.label} (Anglais)</Label>
                <StringListInput
                  value={enList}
                  onChange={(v) => setEnField(field.key, v, true)}
                />
              </div>
            );
          }

          // text field
          if (field.shared) {
            return (
              <div key={field.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground">{field.label}</Label>
                  <span className="text-[10px] text-muted-foreground/70">Identique dans les 2 langues</span>
                </div>
                {field.multiline ? (
                  <Textarea
                    rows={3}
                    value={(item.fr[field.key] as string) ?? ""}
                    onChange={(e) => setSharedField(field.key, e.target.value)}
                    className="text-sm"
                  />
                ) : (
                  <Input
                    value={(item.fr[field.key] as string) ?? ""}
                    onChange={(e) => setSharedField(field.key, e.target.value)}
                    className="text-sm"
                  />
                )}
              </div>
            );
          }

          return (
            <BilingualTextField
              key={field.key}
              label={field.label}
              multiline={field.multiline}
              frValue={(item.fr[field.key] as string) ?? ""}
              enValue={(item.en[field.key] as string) ?? ""}
              enEdited={item._enEdited}
              onFrChange={(v) => setFrField(field.key, v)}
              onEnChange={(v, markEdited) => setEnField(field.key, v, markEdited)}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ListFieldEditor({
  label,
  schema,
  items,
  onChange,
}: {
  label: string;
  schema: ListFieldSchema;
  items: BilingualItem[];
  onChange: (items: BilingualItem[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i._id === active.id);
    const newIndex = items.findIndex((i) => i._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  }

  function addItem() {
    onChange([
      ...items,
      {
        _id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        fr: { ...schema.emptyItem },
        en: { ...schema.emptyItem },
        _enEdited: false,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>

      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i._id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((item, i) => (
                <ItemCard
                  key={item._id}
                  item={item}
                  schema={schema}
                  onChange={(next) => onChange(items.map((it, idx) => (idx === i ? next : it)))}
                  onDelete={() => onChange(items.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Button variant="outline" size="sm" className="gap-1.5 w-full justify-center border-dashed" onClick={addItem}>
        <Plus className="h-3.5 w-3.5" />
        {schema.addLabel}
      </Button>
    </div>
  );
}
