import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ageLabel } from "@/lib/student-details";

export type RegistrationFields = { motherName: string; address: string; contactNumber: string };

/** Student contact is deliberately independent of parent account credentials. */
export function StudentRegistrationFields({
  values,
  dateOfBirth,
  onChange,
  required = false,
}: {
  values: RegistrationFields;
  dateOfBirth: string;
  onChange: (key: keyof RegistrationFields, value: string) => void;
  required?: boolean;
}) {
  const id = useId();
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-age`}>Age as of today</Label>
        <Input id={`${id}-age`} value={ageLabel(dateOfBirth)} readOnly />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-mother`}>Mother’s name{required ? " *" : ""}</Label>
        <Input
          id={`${id}-mother`}
          maxLength={120}
          required={required}
          value={values.motherName}
          onChange={(e) => onChange("motherName", e.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${id}-address`}>Address{required ? " *" : ""}</Label>
        <Textarea
          id={`${id}-address`}
          maxLength={500}
          required={required}
          value={values.address}
          onChange={(e) => onChange("address", e.target.value)}
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${id}-contact`}>Contact number{required ? " *" : ""}</Label>
        <Input
          id={`${id}-contact`}
          type="tel"
          autoComplete="tel"
          required={required}
          value={values.contactNumber}
          onChange={(e) => onChange("contactNumber", e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          School contact only. The parent login number is managed separately below.
        </p>
      </div>
    </>
  );
}
