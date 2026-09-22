import ClassMembership from '@/models/classMembership';

export async function getStudentProblemScope(studentId: string, collegeId?: string) {
  const classIds = await ClassMembership.find({ studentId, status: 'approved' }).distinct('classId');
  const scopes: Record<string, unknown>[] = [
    {
      problemType: 'company',
      $or: [
        { collegeIds: { $exists: false } },
        { collegeIds: { $size: 0 } },
        ...(collegeId ? [{ collegeIds: collegeId }] : []),
      ],
    },
  ];

  if (collegeId) {
    scopes.push({
      problemType: 'class_assignment',
      collegeId,
      classId: { $in: classIds },
    });
  }

  return {
    $or: scopes,
  };
}
