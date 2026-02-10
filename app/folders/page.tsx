import { redirect } from "next/navigation";

export default function FoldersPage() {
  redirect("/documents?view=tree");
}
