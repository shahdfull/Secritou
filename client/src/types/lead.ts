export interface LeadProposal {
  id: string;
  title: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  amount?: number | null;
  currency: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source?: "Site web" | "LinkedIn" | "Recommandation" | "Email" | "Appel entrant" | "Autre";
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST";
  notes?: string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
  convertedClient?: { id: string; name: string; email: string | null } | null;
  proposals?: LeadProposal[];
}

export interface CreateLeadInput {
  name: string;
  email?: string;
  phone?: string;
  source?: Lead["source"];
  status?: Lead["status"];
  notes?: string;
}

export interface UpdateLeadInput extends Partial<CreateLeadInput> {
  id: string;
}
