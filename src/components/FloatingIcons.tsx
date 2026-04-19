import { Terminal, Braces, Code, Cpu, Layers, ScanLine, Binary, Hash } from "lucide-react";

export const FloatingIcons = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Icon 1: Terminal */}
      <div className="absolute top-[15%] left-[10%] animate-float opacity-40 md:opacity-100">
         <div className="p-3 rounded-2xl bg-white/40 backdrop-blur-md border border-white/20 shadow-sm flex items-center gap-2 transform rotate-12 transition-transform hover:scale-110">
            <Terminal className="w-6 h-6 text-primary" />
            <span className="text-sm font-mono font-bold text-primary/80 hidden sm:inline">&gt;_</span>
         </div>
      </div>

      {/* Symbol 1: scanf */}
      <div className="absolute top-[25%] right-[15%] animate-float-delayed opacity-30 md:opacity-100">
         <div className="px-4 py-2 rounded-full bg-accent/30 backdrop-blur-md border border-accent/20 shadow-sm flex items-center gap-2 transform -rotate-6 transition-transform hover:scale-110">
            <ScanLine className="w-5 h-5 text-accent-foreground" />
            <span className="text-sm font-mono font-extrabold text-accent-foreground/70">scanf("%d")</span>
         </div>
      </div>

      {/* Icon 2: Braces - Hidden on mobile to reduce clutter */}
      <div className="absolute bottom-[20%] left-[15%] animate-float-delayed hidden sm:block opacity-40 md:opacity-100">
         <div className="p-4 rounded-xl bg-primary/5 backdrop-blur-sm border border-primary/20 shadow-sm transform -rotate-12 transition-transform hover:scale-110">
            <Braces className="w-8 h-8 text-primary/60" />
         </div>
      </div>

      {/* Symbol 2: & address of - Extra Low opacity on mobile */}
      <div className="absolute top-[40%] left-[25%] animate-float opacity-[0.05] sm:opacity-20 md:opacity-60">
         <div className="px-3 py-1 rounded-lg bg-secondary/50 backdrop-blur-sm border border-secondary/30 shadow-sm transform rotate-45">
            <span className="text-2xl font-mono font-black text-secondary-foreground/40">&</span>
         </div>
      </div>

      {/* Icon 3: Code */}
      <div className="absolute top-[10%] right-[30%] animate-float opacity-30 md:opacity-80">
         <div className="p-3 rounded-2xl bg-white/60 backdrop-blur-md border border-white/20 shadow-sm transform -rotate-3 transition-transform hover:scale-110">
            <Code className="w-10 h-10 text-slate-400/50" />
         </div>
      </div>

      {/* Symbol 3: printf */}
      <div className="absolute bottom-[35%] right-[10%] animate-float opacity-40 md:opacity-100">
         <div className="px-5 py-2 rounded-2xl bg-white/50 backdrop-blur-md border border-slate-200/50 shadow-sm flex items-center gap-2 transform rotate-2 transition-transform hover:scale-110">
            <span className="text-sm font-mono font-bold text-slate-600">printf("Hello World")</span>
         </div>
      </div>

      {/* Icon 4: Binary */}
      <div className="absolute bottom-[10%] right-[25%] animate-float-delayed opacity-20 md:opacity-50">
         <div className="p-3 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/10 shadow-sm transform rotate-12 transition-transform hover:scale-110">
            <Binary className="w-6 h-6 text-primary/40" />
         </div>
      </div>

      {/* Symbol 4: while(1) */}
      <div className="absolute top-[60%] right-[20%] animate-float-delayed opacity-20 md:opacity-70">
         <div className="px-4 py-2 rounded-xl bg-accent/20 backdrop-blur-md border border-accent/10 shadow-sm flex items-center gap-2 transform -rotate-12 transition-transform hover:scale-110">
            <Hash className="w-4 h-4 text-accent-foreground/50" />
            <span className="text-sm font-mono font-bold text-accent-foreground/60">while(true)</span>
         </div>
      </div>

      {/* Floating Blobs (Background) */}
      <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse-soft -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse-soft -z-10" />
    </div>
  );
};
