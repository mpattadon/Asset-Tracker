import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface HeaderProps {
  language?: string;
  onLanguageChange?: (language: string) => void;
}

export function Header({ language = "en", onLanguageChange }: HeaderProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal text-gray-900">Multi-market cockpit</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select value={language} onValueChange={onLanguageChange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="th">ไทย</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            Sign in with Google
          </Button>
        </div>
      </div>
    </div>
  );
}