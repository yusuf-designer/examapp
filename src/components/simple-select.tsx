import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
export type Opt = { value: string; label: string };
export function SimpleSelect({ value, onValueChange, options, groups, placeholder, disabled, id, label, className }: {
  value: string; onValueChange: (v: string) => void; options?: Opt[]; groups?: { label: string; options: Opt[] }[];
  placeholder?: string; disabled?: boolean; id?: string; label?: string; className?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} className={className}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        {groups?.map((g) => (<SelectGroup key={g.label}><SelectLabel>{g.label}</SelectLabel>{g.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectGroup>))}
      </SelectContent>
    </Select>
  );
}
