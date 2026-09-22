import ClassMembership from '@/models/classMembership';

export async function getStudentProblemScope(studentId: string, collegeId?: string) {
  if (!collegeId) return { _id: { $exists: false } };

  const classIds = await ClassMembership.find({ studentId, status: 'approved' }).distinct('classId');
  return {
    $or: [
      {
        problemType: 'company',
        $or: [
          { collegeIds: { $exists: false } },
          { collegeIds: { $size: 0 } },
          { collegeIds: collegeId },
        ],
      },
      {
        problemType: 'class_assignment',
        collegeId,
        classId: { $in: classIds },
      },
    ],
  };
}
