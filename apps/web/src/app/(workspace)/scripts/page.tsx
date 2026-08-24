import { ScriptStudio } from "@/components/script-studio";
import { requireUser } from "@/lib/auth";
import { getScriptStudioData } from "@/lib/script-studio-data";

export default async function ScriptsPage() {
  const [user, data] = await Promise.all([requireUser(), getScriptStudioData()]);
  return <ScriptStudio initialData={data} canManage={user.role === "admin" || user.role === "ugc_manager"} />;
}
