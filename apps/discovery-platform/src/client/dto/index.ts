export type CreateClient = {
  id: string;
  labels?: string[];
  payment: "premium" | "trial";
};

export type QueryClient = {
  id: string;
  labels?: string[];
  payment: "premium" | "trial";
  created_at: string;
  updated_at: string;
};
