import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearAllMemories, deleteMemory, fetchMemories } from "@/api/memory";

export function useMemories(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["memories", limit, offset],
    queryFn: () => fetchMemories(limit, offset),
    staleTime: 30_000,
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMemory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memories"] }),
  });
}

export function useClearMemories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearAllMemories,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["memories"] }),
  });
}
