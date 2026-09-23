import { redirect } from "next/navigation";

// Old link: the journal lives at /journal, and Edit asks for the password there.
export default function JournalEditRedirect() {
  redirect("/journal");
}
