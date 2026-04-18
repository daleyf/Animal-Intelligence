import { useQuery } from "@tanstack/react-query";
import { fetchConversations, fetchConversation } from "@/api/conversations";

export function useConversations(search?: string) {
  return useQuery({
    queryKey: ["conversations", search],
    queryFn: () => fetchConversations(search),
    staleTime: 10_000,
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: () => fetchConversation(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}
