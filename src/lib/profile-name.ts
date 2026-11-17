type NamedProfile = {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
};

export const profileDisplayName = (profile: NamedProfile) => {
  if (profile.first_name?.trim() && profile.last_name?.trim()) {
    return [profile.first_name, profile.middle_name, profile.last_name]
      .map(part => part?.trim()).filter(Boolean).join(" ");
  }
  return profile.full_name?.trim() || profile.email?.trim() || "Unnamed";
};
