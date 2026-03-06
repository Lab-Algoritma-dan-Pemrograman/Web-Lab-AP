-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('praktikan', 'asisten', 'koordinator');

-- Create enum for shift status
CREATE TYPE public.shift_status AS ENUM ('pending', 'approved', 'rejected');

-- Create enum for attendance status
CREATE TYPE public.attendance_status AS ENUM ('hadir', 'izin', 'alpha');

-- Create enum for swap request status
CREATE TYPE public.swap_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles table for user information
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    npm TEXT, -- Student ID number for praktikan
    division TEXT, -- For assistants
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Courses/Subjects table
CREATE TABLE public.courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    semester TEXT,
    academic_year TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Modules table
CREATE TABLE public.modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT,
    module_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Schedules table
CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Student enrollments
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, schedule_id)
);

-- Shift assignments for assistants
CREATE TABLE public.shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assistant_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
    shift_date DATE NOT NULL,
    status shift_status NOT NULL DEFAULT 'approved',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Shift swap requests
CREATE TABLE public.swap_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    original_shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE NOT NULL,
    target_shift_id UUID REFERENCES public.shifts(id) ON DELETE CASCADE NOT NULL,
    status swap_status NOT NULL DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Attendance records
CREATE TABLE public.attendances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE NOT NULL,
    attendance_date DATE NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE,
    status attendance_status NOT NULL DEFAULT 'alpha',
    validated_by UUID REFERENCES auth.users(id),
    qr_token TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Assignment submissions
CREATE TABLE public.submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    grade DECIMAL(5,2),
    graded_by UUID REFERENCES auth.users(id),
    graded_at TIMESTAMP WITH TIME ZONE,
    feedback TEXT
);

-- Inventory items
CREATE TABLE public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    total_quantity INTEGER NOT NULL DEFAULT 0,
    available_quantity INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Equipment rentals
CREATE TABLE public.rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    rental_date DATE NOT NULL,
    return_date DATE,
    actual_return_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Koordinator can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'koordinator'));

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Koordinator can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Courses policies (all authenticated can view)
CREATE POLICY "Authenticated users can view courses" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Koordinator can manage courses" ON public.courses FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Modules policies
CREATE POLICY "Authenticated users can view modules" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Koordinator can manage modules" ON public.modules FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Schedules policies
CREATE POLICY "Authenticated users can view schedules" ON public.schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Koordinator can manage schedules" ON public.schedules FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Enrollments policies
CREATE POLICY "Users can view own enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Koordinator can manage enrollments" ON public.enrollments FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Shifts policies
CREATE POLICY "Assistants can view own shifts" ON public.shifts FOR SELECT USING (auth.uid() = assistant_id);
CREATE POLICY "Koordinator can manage shifts" ON public.shifts FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Swap requests policies
CREATE POLICY "Users can view own swap requests" ON public.swap_requests FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = target_id);
CREATE POLICY "Assistants can create swap requests" ON public.swap_requests FOR INSERT WITH CHECK (auth.uid() = requester_id AND public.has_role(auth.uid(), 'asisten'));
CREATE POLICY "Koordinator can manage swap requests" ON public.swap_requests FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Attendances policies
CREATE POLICY "Users can view own attendance" ON public.attendances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Assistants can validate attendance" ON public.attendances FOR UPDATE USING (public.has_role(auth.uid(), 'asisten'));
CREATE POLICY "Koordinator can manage attendance" ON public.attendances FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Submissions policies
CREATE POLICY "Users can view own submissions" ON public.submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Praktikan can insert submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'praktikan'));
CREATE POLICY "Assistants can grade submissions" ON public.submissions FOR UPDATE USING (public.has_role(auth.uid(), 'asisten'));
CREATE POLICY "Koordinator can manage submissions" ON public.submissions FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Inventory policies
CREATE POLICY "Authenticated users can view inventory" ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Koordinator can manage inventory" ON public.inventory_items FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Rentals policies
CREATE POLICY "Users can view own rentals" ON public.rentals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create rentals" ON public.rentals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Koordinator can manage rentals" ON public.rentals FOR ALL USING (public.has_role(auth.uid(), 'koordinator'));

-- Create trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_swap_requests_updated_at BEFORE UPDATE ON public.swap_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();