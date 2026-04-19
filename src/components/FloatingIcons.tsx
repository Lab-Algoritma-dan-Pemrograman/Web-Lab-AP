import { Terminal, Braces, Code, Cpu, Layers, ScanLine, Binary, Hash } from "lucide-react";

export const FloatingIcons = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* Icon 1: Terminal - Brighter */}
      <div className="absolute top-[10%] left-[8%] animate-float opacity-70 md:opacity-100">
         <div className="p-3 rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-md flex items-center gap-2 transform rotate-12 transition-transform hover:scale-110">
            <Terminal className="w-6 h-6 text-primary shadow-sm" />
            <span className="text-sm font-mono font-black text-primary hidden sm:inline">&gt;_</span>
         </div>
      </div>

      {/* Symbol 1: scanf - Brighter */}
      <div className="absolute top-[18%] right-[12%] animate-float-delayed opacity-70 md:opacity-100">
         <div className="px-4 py-2 rounded-full bg-accent/40 backdrop-blur-md border border-accent/30 shadow-md flex items-center gap-2 transform -rotate-6 transition-transform hover:scale-110">
            <ScanLine className="w-5 h-5 text-accent-foreground" />
            <span className="text-sm font-mono font-black text-accent-foreground">scanf("%d")</span>
         </div>
      </div>

      {/* Icon 2: Braces - Now visible on mobile and brighter */}
      <div className="absolute bottom-[25%] left-[10%] animate-float-delayed opacity-60 md:opacity-100">
         <div className="p-4 rounded-xl bg-primary/10 backdrop-blur-sm border border-primary/30 shadow-md transform -rotate-12 transition-transform hover:scale-110">
            <Braces className="w-8 h-8 text-primary font-bold" />
         </div>
      </div>

      {/* Symbol 2: & address of - Brighter */}
      <div className="absolute top-[35%] left-[22%] animate-float opacity-40 md:opacity-80">
         <div className="px-3 py-1 rounded-lg bg-secondary/60 backdrop-blur-sm border border-secondary/40 shadow-sm transform rotate-45">
            <span className="text-2xl font-mono font-black text-secondary-foreground">&</span>
         </div>
      </div>

      {/* NEW Symbol: for loop */}
      <div className="absolute top-[8%] right-[40%] animate-float opacity-50 md:opacity-90">
         <div className="px-4 py-1.5 rounded-lg bg-indigo-500/20 backdrop-blur-sm border border-indigo-500/30 shadow-sm transform -rotate-2">
            <span className="text-xs font-mono font-bold text-indigo-600 truncate">for(i=0; i&lt;n; i++)</span>
         </div>
      </div>

      {/* Icon 3: Code - Brighter */}
      <div className="absolute top-[5%] right-[25%] animate-float opacity-50 md:opacity-90">
         <div className="p-3 rounded-2xl bg-white/80 backdrop-blur-md border border-white/30 shadow-md transform -rotate-3 transition-transform hover:scale-110">
            <Code className="w-10 h-10 text-slate-500" />
         </div>
      </div>

      {/* NEW Icon: Cpu */}
      <div className="absolute bottom-[30%] left-[30%] animate-float opacity-40 md:opacity-70">
         <div className="p-3 rounded-xl bg-orange-500/10 backdrop-blur-sm border border-orange-500/20 shadow-sm transform rotate-12">
            <Cpu className="w-7 h-7 text-orange-600" />
         </div>
      </div>

      {/* Symbol 3: printf - Brighter */}
      <div className="absolute bottom-[30%] right-[8%] animate-float opacity-70 md:opacity-100">
         <div className="px-5 py-2 rounded-2xl bg-white/70 backdrop-blur-md border border-slate-300 shadow-md flex items-center gap-2 transform rotate-2 transition-transform hover:scale-110">
            <span className="text-sm font-mono font-black text-slate-800">printf("Lab AP")</span>
         </div>
      </div>

      {/* NEW Symbol: if condition */}
      <div className="absolute top-[55%] left-[12%] animate-float-delayed opacity-50 md:opacity-90">
         <div className="px-3 py-1 rounded-md bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/30 shadow-sm">
            <span className="text-xs font-mono font-bold text-emerald-700">if(isValid)</span>
         </div>
      </div>

      {/* Icon 4: Binary - Brighter */}
      <div className="absolute bottom-[8%] right-[22%] animate-float-delayed opacity-40 md:opacity-70">
         <div className="p-3 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/20 shadow-md transform rotate-12 transition-transform hover:scale-110">
            <Binary className="w-6 h-6 text-primary" />
         </div>
      </div>

      {/* NEW Icon: Layers */}
      <div className="absolute bottom-[10%] left-[25%] animate-float opacity-40 md:opacity-70">
         <div className="p-3 rounded-xl bg-blue-500/10 backdrop-blur-sm border border-blue-500/20 shadow-sm transform -rotate-12">
            <Layers className="w-6 h-6 text-blue-600" />
         </div>
      </div>

      {/* Symbol 4: while(1) - Brighter */}
      <div className="absolute top-[65%] right-[18%] animate-float-delayed opacity-50 md:opacity-80">
         <div className="px-4 py-2 rounded-xl bg-accent/30 backdrop-blur-md border border-accent/20 shadow-md flex items-center gap-2 transform -rotate-12 transition-transform hover:scale-110">
            <Hash className="w-4 h-4 text-accent-foreground" />
            <span className="text-sm font-mono font-black text-accent-foreground">while(1)</span>
         </div>
      </div>

      <div className="absolute top-1/4 left-1/3 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-soft -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse-soft -z-10" />
    </div>
  );
};
