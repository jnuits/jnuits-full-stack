import { z } from "zod";

const optionalUrl = z.union([z.string().trim().url().max(2048), z.literal("")]).optional();

/** Portal allowlist. Unknown identity/administrative fields fail rather than being stripped. */
export const directProfileSchema = z.object({
  phone: z.string().trim().max(40).optional(),
  facebookUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  websiteUrl: optionalUrl,
  currentOrganization: z.string().trim().max(180).optional(),
  designation: z.string().trim().max(160).optional(),
  workLocation: z.string().trim().max(160).optional(),
  professionalVisibility: z.enum(["public", "members-only", "private"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one profile field.");

export const identityProfileSchema = z.object({
  requestType: z.literal("profile_change").optional(),
  fullName: z.string().trim().min(2).max(160).optional(),
  departmentCode: z.string().trim().min(1).max(80).optional(),
  studentId: z.string().trim().min(1).max(80).optional(),
  batchNo: z.number().int().min(1).max(999).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional(),
}).strict().refine((value) => Object.keys(value).some((key) => key !== "requestType"), "Provide at least one identity field.");
