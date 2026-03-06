import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  file: File;
  preview: string;
}

// Mock modules for demo - in production, fetch from database
const availableModules = [
  { id: "1", title: "Modul 1 - Pengenalan Algoritma", moduleNumber: 1 },
  { id: "2", title: "Modul 2 - Struktur Data Array", moduleNumber: 2 },
  { id: "3", title: "Modul 3 - Linked List", moduleNumber: 3 },
  { id: "4", title: "Modul 4 - Stack dan Queue", moduleNumber: 4 },
  { id: "5", title: "Modul 5 - Sorting Algorithm", moduleNumber: 5 },
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function UploadLaporan() {
  const { user } = useAuth();
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.type !== "application/pdf") {
      return "Hanya file PDF yang diperbolehkan.";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "Ukuran file maksimal 5MB.";
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error("File Tidak Valid", { description: error });
      return;
    }

    setUploadedFile({
      file,
      preview: URL.createObjectURL(file),
    });
    setUploadSuccess(false);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const removeFile = () => {
    if (uploadedFile?.preview) {
      URL.revokeObjectURL(uploadedFile.preview);
    }
    setUploadedFile(null);
    setUploadSuccess(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedModule) {
      toast.error("Modul Belum Dipilih", {
        description: "Silakan pilih modul yang akan dilaporkan.",
      });
      return;
    }

    if (!uploadedFile) {
      toast.error("File Belum Diunggah", {
        description: "Silakan unggah file laporan Anda.",
      });
      return;
    }

    if (!user) {
      toast.error("Sesi Berakhir", {
        description: "Silakan masuk kembali.",
      });
      return;
    }

    setIsUploading(true);

    try {
      // In production, upload to Azure Blob Storage via Edge Function
      // For now, we'll simulate the upload
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock file URL - in production, this would be the Azure Blob URL
      const mockFileUrl = `https://storage.example.com/reports/${user.id}/${selectedModule}/${uploadedFile.file.name}`;

      // Save submission record to database
      const { error } = await supabase.from("submissions").insert({
        user_id: user.id,
        module_id: selectedModule,
        file_url: mockFileUrl,
        file_name: uploadedFile.file.name,
        file_size: uploadedFile.file.size,
      });

      if (error) throw error;

      setUploadSuccess(true);
      toast.success("Laporan Berhasil Dikirim!", {
        description: "Laporan Anda telah diunggah dan akan segera diperiksa.",
      });

      // Reset form after success
      setTimeout(() => {
        setSelectedModule("");
        setNotes("");
        removeFile();
        setUploadSuccess(false);
      }, 3000);

    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Gagal Mengunggah", {
        description: "Terjadi kesalahan. Silakan coba lagi.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Upload Laporan</h1>
          <p className="text-muted-foreground mt-1">
            Unggah laporan praktikum Anda dalam format PDF (maksimal 5MB).
          </p>
        </div>

        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Formulir Pengumpulan Laporan
            </CardTitle>
            <CardDescription>
              Pastikan laporan sudah sesuai dengan format yang ditentukan sebelum mengunggah.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Module Selection */}
              <div className="space-y-2">
                <Label htmlFor="module">Pilih Modul</Label>
                <Select
                  value={selectedModule}
                  onValueChange={setSelectedModule}
                  disabled={isUploading}
                >
                  <SelectTrigger id="module">
                    <SelectValue placeholder="Pilih modul praktikum" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* File Upload Zone */}
              <div className="space-y-2">
                <Label>File Laporan (PDF)</Label>
                
                {!uploadedFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "upload-zone",
                      isDragging && "upload-zone-active"
                    )}
                  >
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleInputChange}
                      className="hidden"
                      id="file-upload"
                      disabled={isUploading}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                          <Upload className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            Tarik & Lepas file di sini
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            atau <span className="text-primary underline">pilih file</span> dari komputer
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <AlertCircle className="w-3 h-3" />
                          <span>Format: PDF • Maksimal 5MB</span>
                        </div>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className={cn(
                    "border rounded-lg p-4 transition-colors",
                    uploadSuccess ? "border-success bg-success/5" : "border-border"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        uploadSuccess ? "bg-success/10" : "bg-primary/10"
                      )}>
                        {uploadSuccess ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <FileText className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(uploadedFile.file.size)}
                        </p>
                        {uploadSuccess && (
                          <p className="text-sm text-success mt-1">
                            ✓ Berhasil diunggah
                          </p>
                        )}
                      </div>
                      {!isUploading && !uploadSuccess && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={removeFile}
                          className="flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notes (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="notes">Catatan (Opsional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Tambahkan catatan untuk asisten jika diperlukan..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  disabled={isUploading}
                  className="resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isUploading || !selectedModule || !uploadedFile}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengunggah...
                  </>
                ) : uploadSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Berhasil Dikirim
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Kirim Laporan
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-4 bg-info/5 border-info/20">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground">
                <p className="font-medium mb-1">Ketentuan Pengumpulan:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Laporan harus dalam format PDF</li>
                  <li>Ukuran file maksimal 5MB</li>
                  <li>Pastikan nama dan NPM tercantum di laporan</li>
                  <li>Pengumpulan ulang akan mengganti file sebelumnya</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
