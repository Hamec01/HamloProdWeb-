import { revalidatePath } from "next/cache";

export function revalidateDiary() {
  for (const path of ["/ru/vst", "/en/vst", "/ru/vst/hpdg", "/en/vst/hpdg", "/admin/posts"]) revalidatePath(path);
}
