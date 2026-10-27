-- Give reports one SELECT policy while keeping all writes admin only.
DROP POLICY "admin view reports" ON public.reports;
DROP POLICY "admin manage reports" ON public.reports;
DROP POLICY "approved operators view shared reports" ON public.reports;

CREATE POLICY "view reports by role and sharing"
  ON public.reports FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      published_at IS NOT NULL
      AND report_data IS NOT NULL
      AND public.has_role((SELECT auth.uid()), 'operator'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles AS profile
        WHERE profile.id = (SELECT auth.uid()) AND profile.approved
      )
      AND EXISTS (
        SELECT 1 FROM public.report_recipients AS recipient
        WHERE recipient.report_id = reports.id
          AND recipient.user_id = (SELECT auth.uid())
      )
    )
  );
CREATE POLICY "admins insert reports"
  ON public.reports FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY "admins update reports"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY "admins delete reports"
  ON public.reports FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY "admins manage report recipients" ON public.report_recipients;
DROP POLICY "operators view own report recipients" ON public.report_recipients;

CREATE POLICY "view report recipients by role"
  ON public.report_recipients FOR SELECT TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR (
      user_id = (SELECT auth.uid())
      AND public.has_role((SELECT auth.uid()), 'operator'::public.app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles AS profile
        WHERE profile.id = (SELECT auth.uid()) AND profile.approved
      )
    )
  );
CREATE POLICY "admins insert report recipients"
  ON public.report_recipients FOR INSERT TO authenticated
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY "admins delete report recipients"
  ON public.report_recipients FOR DELETE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
