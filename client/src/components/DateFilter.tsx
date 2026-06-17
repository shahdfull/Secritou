import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

interface DateFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const presetOptions = [
  { label: "7 derniers jours", value: "7d" },
  { label: "30 derniers jours", value: "30d" },
  { label: "90 derniers jours", value: "90d" },
  { label: "Cette année", value: "year" },
  { label: "Personnalisé", value: "custom" },
];

export function DateFilter({ value, onChange }: DateFilterProps) {
  const [preset, setPreset] = useState<string>("30d");
  const [open, setOpen] = useState(false);

  const handlePresetChange = (newPreset: string) => {
    setPreset(newPreset);
    const today = new Date();
    let from: Date | undefined;
    let to = new Date(today);

    switch (newPreset) {
      case "7d":
        from = new Date(today);
        from.setDate(today.getDate() - 7);
        break;
      case "30d":
        from = new Date(today);
        from.setDate(today.getDate() - 30);
        break;
      case "90d":
        from = new Date(today);
        from.setDate(today.getDate() - 90);
        break;
      case "year":
        from = new Date(today.getFullYear(), 0, 1);
        break;
      case "custom":
        setOpen(true);
        return;
      default:
        break;
    }

    onChange({ from, to });
  };

  const handleDateSelect = (selected: { from?: Date; to?: Date } | undefined) => {
    if (selected) {
      onChange({ from: selected.from, to: selected.to });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Période" />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !value.from && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value.from ? (
              value.to ? (
                <>
                  {format(value.from, "dd/MM/yyyy", { locale: fr })} -{" "}
                  {format(value.to, "dd/MM/yyyy", { locale: fr })}
                </>
              ) : (
                format(value.from, "dd/MM/yyyy", { locale: fr })
              )
            ) : (
              <span>Sélectionner une période</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={value.from}
            selected={value}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            locale={fr}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
