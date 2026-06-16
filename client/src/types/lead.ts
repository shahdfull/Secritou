export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source?: "Site web" | "LinkedIn" | "Recommandation" | "Email" | "Appel entrant" | "Autre";
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST";
  notes?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
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
