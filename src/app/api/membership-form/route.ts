import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const membershipSchema = z.object({
  name: z.string().trim().min(2, "Name is required."),
  email: z.string().trim().email("A valid email is required."),
  departmentCode: z.string().trim().min(2, "Department is required."),
  batchLabel: z.string().trim().min(1, "Batch is required."),
  studentId: z.string().trim().min(1, "Student ID is required."),
  photoUrl: z.string().trim().url("Photo URL must be valid.").optional().or(z.literal("")),
  facebookUrl: z.string().trim().url("Facebook URL must be valid.").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  linkedinUrl: z.string().trim().url("LinkedIn URL must be valid.").optional().or(z.literal("")),
  website: z.string().trim().max(0).optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = membershipSchema.safeParse(body);

  if (!parsed.success) {
    const message =
      parsed.error.flatten().formErrors[0] || "Invalid membership application data.";
    return NextResponse.json({ message }, { status: 400 });
  }

  if (parsed.data.website && parsed.data.website.length > 0) {
    return NextResponse.json(
      { message: "Application submitted successfully. Current status: pending." },
      { status: 201 }
    );
  }

  const admin = createAdminClient();
  const payload = {
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    department_code: parsed.data.departmentCode,
    batch_label: parsed.data.batchLabel,
    student_id: parsed.data.studentId,
    phone: parsed.data.phone || null,
    facebook_url: parsed.data.facebookUrl || null,
    linkedin_url: parsed.data.linkedinUrl || null,
    photo_url: parsed.data.photoUrl || null,
    status: "pending" as const,
  };

  const { data, error } = await admin
    .from("membership_applications")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { message: "Unable to submit membership application right now." },
      { status: 500 }
    );
  }

  await admin.from("audit_events").insert({
    actor_user_id: null,
    action: "membership.application_submitted",
    entity_type: "membership_application",
    entity_id: data.id,
    metadata: {
      email: payload.email,
      departmentCode: payload.department_code,
    },
  });

  return NextResponse.json(
    {
      message: "Application submitted successfully. Current status: pending.",
      id: data.id,
      status: "pending",
    },
    { status: 201 }
  );
}
