"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Eye, EyeOff, Copy, Pencil, Trash2, Mail } from "lucide-react";
import { addEnvVariable, getEnvVariables, deleteEnvVariable, updateEnvVariable } from "../actions";
import { supabase } from "@/lib/supabase-browser";
import { toast } from "sonner";
import type { EnvironmentVariable } from "@/lib/types/database";
import { GradientBar } from "@/components/ui/gradient-bar";

export default function EnvironmentPage() {
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"production" | "staging" | "development">("production");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});
  const [revealTimers, setRevealTimers] = useState<Record<string, NodeJS.Timeout>>({});
  const [selectedVariable, setSelectedVariable] = useState<EnvironmentVariable | null>(null);
  const [formData, setFormData] = useState({ key: "", value: "", environment: "production" as "development" | "staging" | "production" });
  const [otpCode, setOtpCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  

  useEffect(() => {
    fetchVariables();
    fetchUserEmail();
    return () => {
      Object.values(revealTimers).forEach(timer => clearTimeout(timer));
    };
  }, []);

  async function fetchUserEmail() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserEmail(user.email);
    }
  }

  async function fetchVariables() {
    setLoading(true);
    const result = await getEnvVariables();
    if (result.success) {
      setVariables(result.data || []);
    } else {
      toast.error(result.error || "Failed to fetch variables");
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!formData.key || !formData.value) {
      toast.error("Please fill all fields");
      return;
    }
    setSubmitting(true);
    const result = await addEnvVariable(formData);
    if (result.success) {
      toast.success("Variable added successfully");
      setAddModalOpen(false);
      setFormData({ key: "", value: "", environment: "production" });
      fetchVariables();
    } else {
      toast.error(result.error || "Failed to add variable");
    }
    setSubmitting(false);
  }

  async function handleEdit() {
    if (!selectedVariable || !formData.key || !formData.value) {
      toast.error("Please fill all fields");
      return;
    }
    setSubmitting(true);
    const result = await updateEnvVariable(selectedVariable.id, { key: formData.key, value: formData.value });
    if (result.success) {
      toast.success("Variable updated successfully");
      setEditModalOpen(false);
      setSelectedVariable(null);
      fetchVariables();
    } else {
      toast.error(result.error || "Failed to update variable");
    }
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!selectedVariable) return;
    setSubmitting(true);
    const result = await deleteEnvVariable(selectedVariable.id);
    if (result.success) {
      toast.success("Variable deleted successfully");
      setDeleteDialogOpen(false);
      setSelectedVariable(null);
      fetchVariables();
    } else {
      toast.error(result.error || "Failed to delete variable");
    }
    setSubmitting(false);
  }

  async function handleRequestOTP(variable: EnvironmentVariable) {
    if (!userEmail) {
      toast.error("User email not found");
      return;
    }

    setSelectedVariable(variable);
    setOtpCode("");
    setSubmitting(true);

    const { error } = await supabase.auth.signInWithOtp({
      email: userEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: undefined,
      }
    });

    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Failed to send OTP");
      return;
    }

    toast.success(`OTP sent to ${userEmail}`);
    setOtpDialogOpen(true);
  }

  async function handleVerifyOTP() {
    if (!selectedVariable || !otpCode || !userEmail) {
      toast.error("Please enter OTP");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.verifyOtp({
      email: userEmail,
      token: otpCode,
      type: "email"
    });

    setSubmitting(false);

    if (error) {
      toast.error("Invalid or expired OTP");
      return;
    }

    const newRevealed = { ...revealedValues, [selectedVariable.id]: selectedVariable.value };
    setRevealedValues(newRevealed);
    toast.success("Value revealed for 60 seconds");
    setOtpDialogOpen(false);
    setOtpCode("");

    const timer = setTimeout(() => {
      setRevealedValues(prev => {
        const updated = { ...prev };
        delete updated[selectedVariable.id];
        return updated;
      });
      toast.info("Secret value hidden");
    }, 60000);

    setRevealTimers(prev => ({ ...prev, [selectedVariable.id]: timer }));
    setSelectedVariable(null);
  }

  function copyToClipboard(text: string, type: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  }

  function openEditModal(variable: EnvironmentVariable) {
    setSelectedVariable(variable);
    setFormData({ key: variable.key, value: variable.value, environment: variable.environment });
    setEditModalOpen(true);
  }

  function openDeleteDialog(variable: EnvironmentVariable) {
    setSelectedVariable(variable);
    setDeleteDialogOpen(true);
  }

  const filteredVariables = variables.filter(v => v.environment === activeTab);

  return (
    <div className="space-y-6">
      <GradientBar />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Environment Variables</h1>
          <p className="text-muted-foreground mt-1">Manage environment-specific configuration values</p>
        </div>
        <Button onClick={() => { setFormData({ key: "", value: "", environment: activeTab }); setAddModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Variable
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="staging">Staging</TabsTrigger>
          <TabsTrigger value="development">Development</TabsTrigger>
        </TabsList>

        {["production", "staging", "development"].map((env) => (
          <TabsContent key={env} value={env} className="space-y-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : filteredVariables.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No variables in {env} environment</p>
                <Button variant="link" onClick={() => { setFormData({ key: "", value: "", environment: env as any }); setAddModalOpen(true); }}>
                  Add your first variable
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredVariables.map((variable) => (
                  <Card key={variable.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono font-semibold text-sm">{variable.key}</p>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(variable.key, "Key")}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="font-mono text-sm text-muted-foreground">
                            {revealedValues[variable.id] || "••••••••••••••••"}
                          </p>
                          {revealedValues[variable.id] && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(variable.value, "Value")}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (revealedValues[variable.id]) {
                              const newRevealed = { ...revealedValues };
                              delete newRevealed[variable.id];
                              setRevealedValues(newRevealed);
                            } else {
                              handleRequestOTP(variable);
                            }
                          }}
                        >
                          {revealedValues[variable.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(variable)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(variable)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Add Variable Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Environment Variable</DialogTitle>
            <DialogDescription>Create a new environment variable for {formData.environment}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="add-key">Key</Label>
              <Input id="add-key" placeholder="API_KEY" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-value">Value</Label>
              <Input id="add-value" type="password" placeholder="Enter value" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-env">Environment</Label>
              <Select value={formData.environment} onValueChange={(value: any) => setFormData({ ...formData, environment: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleAdd} disabled={submitting}>{submitting ? "Adding..." : "Add Variable"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Variable Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Environment Variable</DialogTitle>
            <DialogDescription>Update the variable key and value</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-key">Key</Label>
              <Input id="edit-key" placeholder="API_KEY" value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-value">Value</Label>
              <Input id="edit-value" type="password" placeholder="Enter value" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleEdit} disabled={submitting}>{submitting ? "Updating..." : "Update Variable"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the environment variable <span className="font-mono font-semibold">{selectedVariable?.key}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OTP Verification Dialog */}
      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Verification
            </DialogTitle>
            <DialogDescription>
              We sent a verification code to <span className="font-semibold">{userEmail}</span>. Enter it below to reveal <span className="font-mono font-semibold">{selectedVariable?.key}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                placeholder="Enter code"
                maxLength={8}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-2xl tracking-widest font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">Enter the code from your email (expires in 60 seconds)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOtpDialogOpen(false); setOtpCode(""); }} disabled={submitting}>Cancel</Button>
            <Button onClick={handleVerifyOTP} disabled={submitting || otpCode.length < 6}>
              {submitting ? "Verifying..." : "Verify & Reveal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

