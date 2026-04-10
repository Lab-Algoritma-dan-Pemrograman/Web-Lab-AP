-- =====================================================
-- E-Learning Progress Table
-- Tracks student progress from the E-Learning platform
-- Synced via SSO integration
-- =====================================================

CREATE TABLE IF NOT EXISTS public.elearning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nim TEXT NOT NULL,
    student_name TEXT,
    
    -- Progress tracking
    completed_lessons INTEGER NOT NULL DEFAULT 0,
    total_lessons INTEGER NOT NULL DEFAULT 0,
    completion_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    
    -- Quiz tracking
    quiz_score NUMERIC(5,2) DEFAULT NULL,
    quiz_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- Lesson detail (JSONB for flexible per-lesson tracking)
    -- Format: [{ "lesson_id": "1", "title": "Intro Python", "completed": true, "completed_at": "..." }]
    lesson_details JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    is_completed BOOLEAN NOT NULL DEFAULT false,
    
    -- Timestamps
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Ensure one record per student
    UNIQUE(nim)
);

-- Enable RLS
ALTER TABLE public.elearning_progress ENABLE ROW LEVEL SECURITY;

-- Allow read access for all authenticated users (via anon key)
CREATE POLICY "Allow public read elearning_progress"
    ON public.elearning_progress FOR SELECT
    USING (true);

-- Allow insert/update for service role or anon (E-Learning app writes via API)
CREATE POLICY "Allow public insert elearning_progress"
    ON public.elearning_progress FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update elearning_progress"
    ON public.elearning_progress FOR UPDATE
    USING (true);

-- Auto-update timestamp trigger
CREATE TRIGGER update_elearning_progress_updated_at
    BEFORE UPDATE ON public.elearning_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.elearning_progress;
