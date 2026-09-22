import User from '@/models/user';

export async function validateCollegeIds(value: unknown): Promise<{ valid: true; ids?: string[] } | { valid: false; error: string }> {
  if (value === undefined || value === null) return { valid: true };
  if (!Array.isArray(value) || value.some((id) => typeof id !== 'string')) {
    return { valid: false, error: 'collegeIds must be an array of college ID strings.' };
  }

  const ids = [...new Set(value.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return { valid: true };

  const existingIds = await User.distinct('collegeId', {
    role: { $in: ['student', 'mentor'] },
    collegeId: { $in: ids },
  });
  const missing = ids.filter((id) => !existingIds.includes(id));
  if (missing.length > 0) return { valid: false, error: 'One or more selected colleges do not exist.' };
  return { valid: true, ids };
}
