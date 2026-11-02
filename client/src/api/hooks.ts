import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Analysis, Comment, Pagination } from '@social-pulse/shared';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  pagination?: Pagination;
}

// ─── Analyses ──────────────────────────────────────────────────────────────

export function useAnalysis(id: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ['analysis', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Analysis>>(`/analyses/${id}`);
      return res.data.data;
    },
    refetchInterval: options?.refetchInterval,
    enabled: !!id,
  });
}

export function useAnalyses(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['analyses', params],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Analysis[]>>('/analyses', { params });
      return res.data;
    },
  });
}

export interface CreateAnalysisPayload {
  platform?: 'youtube' | 'flipkart';
  url?: string;
  pastedText?: string;
  rawReviews?: unknown[];
  productMeta?: Record<string, unknown>;
  file?: File;
  options?: Record<string, unknown>;
}

export function useCreateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAnalysisPayload) => {
      if (payload.file) {
        const formData = new FormData();
        formData.append('file', payload.file);
        if (payload.platform) formData.append('platform', payload.platform);
        if (payload.url) formData.append('url', payload.url);
        if (payload.pastedText) formData.append('pastedText', payload.pastedText);
        if (payload.productMeta) formData.append('productMeta', JSON.stringify(payload.productMeta));
        if (payload.options) formData.append('options', JSON.stringify(payload.options));
        const res = await api.post<{ analysisId: string; demo: boolean }>('/analyses', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        return res.data;
      }
      const res = await api.post<{ analysisId: string; demo: boolean }>('/analyses', payload);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyses'] });
    },
  });
}

export function useDeleteAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/analyses/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyses'] });
    },
  });
}

export function useReanalyze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/analyses/${id}/reanalyze`);
      return res.data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['analysis', id] });
    },
  });
}

export function useCancelJob() {
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/analyses/${id}/job`);
    },
  });
}

// ─── Comments ──────────────────────────────────────────────────────────────

export function useComments(
  analysisId: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  return useQuery({
    queryKey: ['comments', analysisId, params],
    queryFn: async () => {
      const cleanParams: Record<string, string> = {};
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== '') cleanParams[k] = String(v);
        });
      }
      const res = await api.get<ApiResponse<Comment[]>>(`/analyses/${analysisId}/comments`, {
        params: cleanParams,
      });
      return res.data;
    },
    enabled: !!analysisId,
  });
}

export function useOverrideComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      analysisId,
      commentId,
      sentiment,
    }: {
      analysisId: string;
      commentId: string;
      sentiment: string;
    }) => {
      const res = await api.patch(`/analyses/${analysisId}/comments/${commentId}/override`, { sentiment });
      return res.data;
    },
    onSuccess: (_, { analysisId }) => {
      qc.invalidateQueries({ queryKey: ['comments', analysisId] });
    },
  });
}

// ─── Compare ───────────────────────────────────────────────────────────────

export function useCompare(a?: string, b?: string) {
  return useQuery({
    queryKey: ['compare', a, b],
    queryFn: async () => {
      const res = await api.get('/analyses/compare/run', { params: { a, b } });
      return res.data.data;
    },
    enabled: !!a && !!b,
  });
}

// ─── Health ────────────────────────────────────────────────────────────────

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.get('/health');
      return res.data;
    },
    refetchInterval: 60_000,
  });
}
