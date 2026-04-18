export interface MemoryMetadata {
  conversation_id: string;
  user_message: string;
  assistant_response: string;
  timestamp: string;
}

export interface MemoryEntry {
  id: string;
  document: string;
  metadata: MemoryMetadata;
  relevance_score?: number;
}

export interface MemoryListResponse {
  memories: MemoryEntry[];
  total: number;
  available: boolean;
}

export interface MemorySearchResponse {
  results: MemoryEntry[];
}

export interface ReportStatus {
  weather: boolean;
  news: boolean;
  commute: boolean;
  web_search: boolean;
  calendar: boolean;
  calendar_configured: boolean;
}

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
  all_day: boolean;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  source: string;
  content: string;
}

export interface ResearchSSEEvent {
  type: "status" | "token" | "done" | "error";
  message?: string;
  content?: string;
  full_content?: string;
  sources?: ResearchSource[];
}
