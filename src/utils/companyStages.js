export const COMPANY_STAGES = [
  { value: "Idea / Pre-seed", label: "Idea / Pre-seed" },
  { value: "Seed", label: "Seed" },
  { value: "Series A", label: "Series A" },
  { value: "Series B", label: "Series B" },
  { value: "Series C+", label: "Series C+" },
  { value: "Growth / Scale-up", label: "Growth / Scale-up" },
  { value: "Bootstrapped", label: "Bootstrapped" },
  { value: "SME", label: "SME" },
  { value: "Enterprise", label: "Enterprise" },
  { value: "Public / Listed", label: "Public / Listed" },
  { value: "Government", label: "Government" },
  { value: "Nonprofit / NGO", label: "Nonprofit / NGO" },
];

export const isCompanyStage = (value) =>
  COMPANY_STAGES.some((stage) => stage.value === value);
