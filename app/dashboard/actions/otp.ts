"use server";

import { createClient } from "@/lib/supabase-server";

export async function sendViewOTP(variableId: string) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const { error } = await supabase.from("password_view_otps").insert({
      user_id: user.id,
      variable_id: variableId,
      otp,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    console.log(`OTP for variable ${variableId}: ${otp}`);
    return { success: true, message: "OTP sent successfully" };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function verifyViewOTP(variableId: string, otp: string) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data, error } = await supabase
      .from("password_view_otps")
      .select("*")
      .eq("user_id", user.id)
      .eq("variable_id", variableId)
      .eq("otp", otp)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return { success: false, error: "Invalid or expired OTP" };
    }

    await supabase.from("password_view_otps").delete().eq("id", data.id);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
