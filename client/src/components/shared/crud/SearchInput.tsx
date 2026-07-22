import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { type ChangeEvent } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        // A placeholder alone is not a reliable accessible name (some screen readers skip it,
        // and it disappears once the field has a value) — fall back to it here so every
        // consumer of this shared component gets a real aria-label without having to pass one
        // explicitly on top of the placeholder they already provide.
        aria-label={placeholder}
        value={value}
        onChange={handleChange}
        className="pl-10"
      />
    </div>
  );
}
