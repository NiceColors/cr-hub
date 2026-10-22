"use client";

import { SearchIcon } from "lucide-react";
import { Input } from "@/components/motion/input";

export function TableSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      type="search"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      aria-label={placeholder}
      leftIcon={<SearchIcon />}
      className="w-full sm:w-64"
      classNames={{ field: "h-8", input: "text-sm" }}
    />
  );
}

export function matchesSearch(search: string, ...fields: (string | null | undefined)[]) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f?.toLowerCase().includes(needle));
}
