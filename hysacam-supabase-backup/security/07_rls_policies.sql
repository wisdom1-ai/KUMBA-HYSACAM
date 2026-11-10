CREATE POLICY "profiles_select_own" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_select_admin" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "profiles_update_own" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "dustbins_public_read" ON public.dustbins AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "dustbins_admin_insert" ON public.dustbins AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "dustbins_admin_update" ON public.dustbins AS PERMISSIVE FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "dustbins_admin_delete" ON public.dustbins AS PERMISSIVE FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "tasks_admin_all" ON public.collection_tasks AS PERMISSIVE FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "tasks_worker_select_own" ON public.collection_tasks AS PERMISSIVE FOR SELECT TO authenticated USING (assigned_worker_id = auth.uid() AND public.is_approved_worker());

CREATE POLICY "history_public_read" ON public.cleaning_history AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "reports_admin_select" ON public.community_reports AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "reports_owner_select" ON public.community_reports AS PERMISSIVE FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY "reports_worker_select" ON public.community_reports AS PERMISSIVE FOR SELECT TO authenticated USING (assigned_worker_id = auth.uid() AND public.is_approved_worker());
CREATE POLICY "reports_admin_update" ON public.community_reports AS PERMISSIVE FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "contacts_admin_select" ON public.report_contacts AS PERMISSIVE FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "contacts_owner_select" ON public.report_contacts AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_reports r WHERE r.id = report_contacts.report_id AND r.reporter_id = auth.uid()));

CREATE POLICY "report_history_select" ON public.report_history AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_reports r WHERE r.id = report_history.report_id));
