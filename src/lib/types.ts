// Content record as returned by the /api/content endpoint.
// Matches SheetRow + brand field.
export type ContentRecord = {
  contentId: string;
  seqNo: string;
  name: string;
  creator: string;
  contentType: string;
  typeCode: string;
  description: string;
  date: string;
  layer: string;
  angles: string; // comma-separated
  ranking: string; // A | B | C | D | NIL
  isLive: string; // "Yes" | "No" | ""
  fileName: string;
  fileUrl: string;
  createdAt: string;
  brand: string;
  // Meta Ads metrics
  amountSpent: string;   // Amount Spent (RM)
  impressions: string;   // Impressions
  cpm: string;           // CPM
  // Set on the client from synced Meta data (not stored in the sheet)
  currency?: string;     // ad account currency: MYR | SGD | MIXED
  rankNote?: string;     // why the rank was given, when not the layer rule
  messagingStarted: string; // Messaging Conversations Started
  purchases: string;     // Purchases
  purchaseRoas: string;  // Purchase ROAS
};

// Content Task — what needs to be produced and when
export type ContentTask = {
  taskId: string;
  brand: string;
  contentType: string; // Video | Picture | Carousel
  description: string;
  dueDate: string; // YYYY-MM-DD
  assignee: string; // creator name
  status: "To Do" | "In Progress" | "Pending Review" | "Complete";
  createdBy: string;
  createdAt: string;
};
