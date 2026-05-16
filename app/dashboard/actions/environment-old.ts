"use server";

import { createClient } from "@/lib/supabase-server";
import { z } from "zod";
import { createActivityLog } from "./activity";

const envVariableSchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Value is required"),
  environment: z.enum(["development", "staging", "production"]),
  project_id: z.string().uuid("Invalid project ID").optional(),
});

export async function addEnvVariable(formData: {
  key: string;
  value: string;
  environment: "development" | "staging" | "production";
  project_id?: string;
}) {
  try {
    const validated = envVariableSchema.parse(formData);
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("environment_variables")
      .insert({
        key: validated.key,
        value: validated.value,
        environment: validated.environment,
        project_id: validated.project_id,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "env_variable_added",
      user_id: user.id,
      description: `Added environment variable: ${validated.key}`,
      project_id: validated.project_id,
      metadata: { key: validated.key, environment: validated.environment },
    });

    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    return { success: false, error: "Failed to add environment variable" };
  }
}

export async function getEnvVariables(projectId?: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    let query = supabase
      .from("environment_variables")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to fetch environment variables" };
  }
}

export async function updateEnvVariable(id: string, formData: { key: string; value: string }) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("environment_variables")
      .update({
        key: formData.key,
        value: formData.value,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "env_variable_updated",
      user_id: user.id,
      description: `Updated environment variable: ${formData.key}`,
      metadata: { key: formData.key, id },
    });

    return { success: true, data };
  } catch (error) {
    return { success: false, error: "Failed to update environment variable" };
  }
}

export async function deleteEnvVariable(id: string) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: envVar } = await supabase
      .from("environment_variables")
      .select("key")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    const { error } = await supabase
      .from("environment_variables")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    await createActivityLog({
      event: "env_variable_deleted",
      user_id: user.id,
      description: `Deleted environment variable: ${envVar?.key || id}`,
      metadata: { id, key: envVar?.key },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete environment variable" };
  }
}
