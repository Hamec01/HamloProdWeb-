import { AdminPostCrudManager } from "@/components/admin/admin-post-crud-manager";
import { requireAdminSession } from "@/lib/auth/session";
import { getAdminPosts } from "@/services/content";

export default async function AdminPostsPage() {
  await requireAdminSession();
  const posts = await getAdminPosts();

  return <AdminPostCrudManager posts={posts} hasSupabase={false} />;
}
