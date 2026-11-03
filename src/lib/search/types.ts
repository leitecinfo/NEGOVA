export type SearchResultCategory = "module" | "product" | "customer" | "order";

export interface WorkspaceSearchResultItem {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle?: string | null;
  href: string;
  iconName?: string;
  badge?: string;
  meta?: Record<string, any>;
}

export interface WorkspaceGlobalSearchResult {
  query: string;
  modules: WorkspaceSearchResultItem[];
  products: WorkspaceSearchResultItem[];
  customers: WorkspaceSearchResultItem[];
  orders: WorkspaceSearchResultItem[];
  totalResults: number;
  durationMs: number;
}

