CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.dustbin_status AS ENUM ('available', 'full', 'damaged', 'awaiting_collection', 'collected');
CREATE TYPE public.report_status AS ENUM ('submitted', 'under_review', 'assigned', 'resolved', 'rejected');
CREATE TYPE public.report_type AS ENUM ('full_bin', 'missed_pickup', 'damaged_bin', 'other');
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.user_role AS ENUM ('admin', 'worker', 'resident');
