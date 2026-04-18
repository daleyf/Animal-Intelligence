export interface ModelInfo {
  name: string;
  description: string;
  size_gb: number;
  min_ram_gb: number;
  is_installed: boolean;
  is_active: boolean;
}

export interface ModelsResponse {
  installed: ModelInfo[];
  available: ModelInfo[];
  active_model: string;
}

export interface DownloadProgress {
  status: string;
  completed: number | null;
  total: number | null;
}
