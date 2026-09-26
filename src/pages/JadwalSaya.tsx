import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Calendar, Clock, User, Users, MessageCircle, BookOpen, Filter, MapPin } from "lucide-react";
import { canonRole } from "@/lib/roles";
import { getGreeting, getHonorific, getWaLink, buildWaText } from "@/lib/wa";

export default function JadwalSaya() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedulesData, setSchedulesData] = useState<any[]>([]);
  const [waTemplates, setWaTemplates] = useState<any>(null);
  /** kelompok[schedule_id] = daftar praktikan pada jadwal itu */
  const [kelompok, setKelompok] = useState<Record<string, any[]>>({});
  // role sudah kanonik dari auth; 'mahasiswa' hanya jaring pengaman untuk data lama.
  const isPraktikan = canonRole(user?.role) === 'praktikan' || user?.role === 'mahasiswa';

  // --- STATE FILTER ---
  const [filterDay, setFilterDay] = useState("all");
  const [filterMajor, setFilterMajor] = useState("all");
  const [filterClass, setFilterClass] = useState("all");

  // --- ANGGOTA KELOMPOK (sumber: group_members lewat proxy RPC ber-JWT) ---
  // Jalur .from() memakai anon key dan RLS group_members memfilternya (hasil selalu kosong),
  // jadi wajib lewat RPC. get_group_members_secure tidak mengembalikan kolom
  // telepon sama sekali, jadi nomor HP teman sekelompok tidak pernah bisa tampil.
  const fetchKelompok = async (scheduleIds: number[]) => {
    const map: Record<string, any[]> = {};
    for (const sid of scheduleIds) {
      const { data, error } = await supabase.rpc('get_group_members_secure', {
        p_viewer_id: user!.id,
        p_schedule_id: sid
      });
      if (error) throw error;
      map[sid] = (data || []).map((m: any) => ({
        id: m.id,
        student_id: m.student_id,
        assistant_id: m.assistant_id,
        student: { id: m.student_id, full_name: m.student_name, username: m.student_nim,
                   shift: m.student_shift, class_code: m.student_class_code }
      }));
    }
    setKelompok(map);
  };

  // --- FUNGSI AUTO-SYNC KE TABEL AGREGAT (class_rosters) ---
  const syncToDatabase = async (combinedData: any[], role: string) => {
      try {
          const payload: any[] = [];

          if (role === 'asisten') {
              combinedData.forEach(item => {
                  if (item.students && item.students.length > 0) {
                      item.students.forEach((studentObj: any) => {
                          payload.push({
                              schedule_id: item.schedule_id,
                              assistant_id: item.assistant_id,
                              student_id: studentObj.student_id
                          });
                      });
                  }
              });
          }

          if (payload.length > 0) {
              const { error } = await supabase.rpc('sync_class_rosters_secure', {
                  p_caller_id: user?.id,
                  p_payload: payload
              });
              
              if (error) console.error("Sync Error:", error);
          }
      } catch (err) {
          console.error("Failed to sync to class_rosters:", err);
      }
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_personal_schedules_secure', { p_viewer_id: user.id });
      if (error) throw error;

      // Pengaturan lengkap (templates WA) hanya untuk staff — RPC-nya menolak praktikan
      // dengan 400 "Akses ditolak.", jadi jangan dipanggil dari sesi praktikan.
      if (!isPraktikan) {
        const { data: settingsData } = await supabase.rpc('get_system_settings_full_secure', { p_viewer_id: user.id });
        if (settingsData && settingsData.length > 0) setWaTemplates(settingsData[0].wa_templates);
      }

      if (isPraktikan) {
        // Satu baris per jadwal: student_id di baris ini selalu user sendiri.
        // Daftar anggota kelompok diambil lewat RPC per jadwal (lihat fetchKelompok).
        const transformed = (data || []).map((row: any) => ({
          ...row,
          schedule: {
            id: row.schedule_id,
            title: row.schedule_title,
            day_of_week: row.schedule_day,
            start_time: row.schedule_start,
            end_time: row.schedule_end,
            major: row.schedule_major,
            class_code: row.schedule_class
          },
          assistant: {
            id: row.assistant_id,
            full_name: row.assistant_name,
            phone_number: row.assistant_phone,
            assistant_code: row.assistant_code
          }
        }));
        setSchedulesData(transformed);
        await fetchKelompok(transformed.map((t: any) => t.schedule_id));
      } else {
        // Satu baris per praktikan bimbingan; dikelompokkan per kelas.
        const grouped = (data || []).reduce((acc: any[], current: any) => {
          let schedule = acc.find(a => a.schedule_id === current.schedule_id);
          if (!schedule) {
            schedule = {
              schedule_id: current.schedule_id,
              schedule: {
                id: current.schedule_id,
                title: current.schedule_title,
                day_of_week: current.schedule_day,
                start_time: current.schedule_start,
                end_time: current.schedule_end,
                major: current.schedule_major,
                class_code: current.schedule_class
              },
              students: []
            };
            acc.push(schedule);
          }
          if (current.student_id) {
            schedule.students.push({
              student_id: current.student_id,
              student: {
                id: current.student_id,
                full_name: current.student_name,
                username: current.student_nim,
                shift: current.student_shift
              }
            });
          }
          return acc;
        }, []);
        setSchedulesData(grouped);
        // ponytail: class_rosters hanya dipakai fitur koordinator; RPC-nya khusus
        // koordinator, jadi asisten tak perlu memanggilnya sama sekali.
        if (user.role === 'koordinator') syncToDatabase(grouped, 'asisten');
      }
    } catch (error: any) {
      toast.error("Gagal memuat jadwal: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const { uniqueDays, uniqueMajors, uniqueClasses } = useMemo(() => {
    const days = new Set<string>();
    const majors = new Set<string>();
    const classes = new Set<string>();

    schedulesData.forEach(item => {
      if (item.schedule?.day_of_week) days.add(item.schedule.day_of_week);
      if (item.schedule?.major) majors.add(item.schedule.major);
      if (item.schedule?.class_code) classes.add(item.schedule.class_code);
    });

    return {
      uniqueDays: Array.from(days).sort(),
      uniqueMajors: Array.from(majors).sort(),
      uniqueClasses: Array.from(classes).sort()
    };
  }, [schedulesData]);

  const filteredSchedules = useMemo(() => {
    return schedulesData.filter(item => {
      const matchDay = filterDay === "all" || item.schedule?.day_of_week === filterDay;
      const matchMajor = filterMajor === "all" || item.schedule?.major === filterMajor;
      const matchClass = filterClass === "all" || item.schedule?.class_code === filterClass;
      
      return matchDay && matchMajor && matchClass;
    });
  }, [schedulesData, filterDay, filterMajor, filterClass]);

  const renderPraktikanView = () => {
    if (schedulesData.length === 0) {
      return <Card className="bg-gray-50 border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Anda belum dimasukkan ke dalam kelompok praktikum mana pun.</CardContent></Card>;
    }
    if (filteredSchedules.length === 0) {
        return <Card className="bg-gray-50 border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Tidak ada jadwal yang sesuai dengan filter pencarian Anda.</CardContent></Card>;
    }

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredSchedules.map((item, idx) => {
          // Bila praktikan belum diplotting ke asisten mana pun (assistant_id NULL),
          // tampilkan seluruh anggota jadwalnya daripada daftar kosong.
          const anggota = kelompok[item.schedule_id] || [];
          const temanKelompok = item.assistant?.id
            ? anggota.filter((m: any) => m.assistant_id === item.assistant.id)
            : anggota;
          const greeting = getGreeting();
          const honorific = getHonorific(item.assistant?.assistant_code);
          const waText = buildWaText(waTemplates, {
            greeting,
            honorific: honorific || "Kak",
            assistant: item.assistant?.full_name || "Asisten",
            student: user?.full_name,
            nim: user?.username,
            major: item.schedule?.major,
            kelas: item.schedule?.class_code
          });

          return (
          <Card key={idx} className="border-l-4 border-l-blue-600 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Kelas {item.schedule?.class_code || "-"}
                </Badge>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant="secondary" className="truncate max-w-[160px]">{item.schedule?.major}</Badge>
                  {item.student_shift && <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Shift {item.student_shift}</Badge>}
                </div>
              </div>
              <CardTitle className="text-xl mt-2">{item.schedule?.title || "Praktikum"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-700">
                <span className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-muted-foreground" /><span className="font-medium">{item.schedule?.day_of_week}</span></span>
                <span className="flex items-center"><Clock className="w-4 h-4 mr-2 text-muted-foreground" />{item.schedule?.start_time?.slice(0,5)} - {item.schedule?.end_time?.slice(0,5)}</span>
                {item.schedule?.room && <span className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-muted-foreground" />{item.schedule.room}</span>}
              </div>

              {/* KONTAK ASISTEN PEMBIMBING */}
              <div className="pt-4 mt-2 border-t">
                <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Asisten Pembimbing:</div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <User className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{item.assistant?.full_name || "Belum ditentukan"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.assistant?.phone_number ? `+${getWaLink(item.assistant.phone_number).match(/wa\.me\/(\d+)/)?.[1] || ""}` : "Nomor WA belum tersedia"}
                      </p>
                    </div>
                  </div>
                  {item.assistant?.phone_number && (
                    <a href={getWaLink(item.assistant.phone_number, waText)} target="_blank" rel="noreferrer">
                      <Button size="sm" className="bg-[#25D366] hover:bg-[#1ebd5c] text-white shadow-sm">
                        <MessageCircle className="w-4 h-4 mr-2" /> Chat Asisten
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              {/* KELOMPOK SAYA */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" /> Kelompok Saya
                  </div>
                  <Badge variant="outline" className="bg-white">{temanKelompok.length} Mahasiswa</Badge>
                </div>
                {temanKelompok.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Data kelompok belum diplotting.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {temanKelompok.map((m: any, i: number) => (
                      <li key={m.id} className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm ${m.student_id === user?.id ? "bg-blue-50 border border-blue-200" : "bg-muted/50"}`}>
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                          <span className={`truncate ${m.student_id === user?.id ? "font-black text-blue-800" : "font-medium"}`}>
                            {m.student?.full_name}{m.student_id === user?.id && " (Saya)"}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs text-muted-foreground">{m.student?.username || "-"}</span>
                          {m.student?.shift && <Badge variant="outline" className="text-[9px] bg-orange-50 text-orange-700 border-orange-200">Shift {m.student.shift}</Badge>}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
    );
  };

  const renderAsistenView = () => {
    if (schedulesData.length === 0) {
      return <Card className="bg-gray-50 border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Anda belum ditugaskan sebagai pembimbing di kelas mana pun.</CardContent></Card>;
    }
    if (filteredSchedules.length === 0) {
        return <Card className="bg-gray-50 border-dashed"><CardContent className="py-12 text-center text-muted-foreground">Tidak ada jadwal yang sesuai dengan filter pencarian Anda.</CardContent></Card>;
    }

    return (
      <div className="space-y-6">
        {filteredSchedules.map((item, idx) => (
          <Card key={idx} className="shadow-sm border-l-4 border-l-green-500 overflow-hidden">
            <CardHeader className="bg-green-50/50 border-b border-green-100 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-none">Kelas {item.schedule?.class_code}</Badge>
                    <span className="text-sm font-medium text-green-700">{item.schedule?.major}</span>
                  </div>
                  <CardTitle className="text-xl">{item.schedule?.title || "Praktikum"}</CardTitle>
                </div>
                <div className="flex flex-col items-end text-sm font-medium text-gray-700 bg-white p-2 px-3 rounded border">
                  <div className="flex items-center"><Calendar className="w-4 h-4 mr-2 text-muted-foreground" /> {item.schedule?.day_of_week}</div>
                  <div className="flex items-center mt-1"><Clock className="w-4 h-4 mr-2 text-muted-foreground" /> {item.schedule?.start_time?.slice(0,5)} - {item.schedule?.end_time?.slice(0,5)}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 p-0 overflow-x-auto">
              <div className="px-6 py-3 bg-gray-50 flex items-center justify-between border-b">
                <span className="font-semibold flex items-center gap-2 text-gray-700"><Users className="w-4 h-4"/> Daftar Praktikan Bimbingan</span>
                <Badge variant="outline" className="bg-white">{item.students?.length || 0} Mahasiswa</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-white">
                    <TableHead className="w-[80px] text-center">No</TableHead>
                    <TableHead>Nama Mahasiswa</TableHead>
                    <TableHead>NIM & Shift</TableHead>
                    <TableHead className="text-right">No. WhatsApp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!item.students || item.students.length === 0) ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Belum ada praktikan yang dimasukkan ke kelompok Anda.</TableCell></TableRow>
                  ) : (
                    item.students.map((student: any, sIdx: number) => (
                      <TableRow key={student.id}>
                        <TableCell className="text-center font-medium text-gray-500">{sIdx + 1}</TableCell>
                        <TableCell className="font-bold">{student.student?.full_name || "Unknown"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className="font-mono w-fit">{student.student?.username || "-"}</Badge>
                            {student.student?.shift && <Badge variant="outline" className="w-fit text-[9px] bg-orange-50 text-orange-700 border-orange-200">Shift {student.student?.shift}</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                            {student.student?.phone_number ? (
                                <a 
                                    href={getWaLink(student.student.phone_number, `Halo ${student.student.full_name}, ini Asisten Praktikum kamu.`)} 
                                    target="_blank" 
                                    rel="noreferrer"
                                >
                                    <Button size="sm" variant="outline" className="h-8 text-green-600 border-green-200 bg-green-50 hover:bg-green-100">
                                        <MessageCircle className="w-4 h-4 mr-2" /> Hubungi
                                    </Button>
                                </a>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">-</span>
                            )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="text-primary" /> Jadwal Praktikum Saya
                </h1>
                <p className="text-muted-foreground">
                {isPraktikan ? "Jadwal praktikum Anda, kontak asisten pembimbing, dan daftar kelompok bimbingan Anda."
                    : "Berikut adalah daftar kelas dan praktikan yang Anda bimbing."}
                </p>
            </div>
        </div>

        {/* --- FILTER HANYA MUNCUL JIKA USER ADALAH ASISTEN ATAU KOORDINATOR --- */}
        {!loading && schedulesData.length > 0 && (user?.role === 'asisten' || user?.role === 'koordinator') && (
            <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-lg border shadow-sm">
                <div className="flex items-center text-muted-foreground font-medium text-sm ml-1 mr-2">
                    <Filter className="w-4 h-4 mr-2" /> Filter:
                </div>
                <Select value={filterDay} onValueChange={setFilterDay}>
                    <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Semua Hari" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua Hari</SelectItem>{uniqueDays.map(day => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterMajor} onValueChange={setFilterMajor}>
                    <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Semua Jurusan" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua Jurusan</SelectItem>{uniqueMajors.map(major => <SelectItem key={major} value={major}>{major}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filterClass} onValueChange={setFilterClass}>
                    <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Semua Kelas" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua Kelas</SelectItem>{uniqueClasses.map(cls => <SelectItem key={cls} value={cls}>Kelas {cls}</SelectItem>)}</SelectContent>
                </Select>
                {(filterDay !== "all" || filterMajor !== "all" || filterClass !== "all") && (
                    <Button variant="ghost" size="sm" onClick={() => { setFilterDay("all"); setFilterMajor("all"); setFilterClass("all"); }} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-9 px-3">
                        Reset Filter
                    </Button>
                )}
            </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          isPraktikan ? renderPraktikanView() : renderAsistenView()
        )}
      </div>
    </DashboardLayout>
  );
}