import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Company from '@/models/company';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  let session;
  try {
    session = await requireAuth(['hiring_manager']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  if (!session.companyId) {
    return NextResponse.json({ success: true, hasCompany: false, company: null });
  }

  await connectToDatabase();
  const company = await Company.findOne({ companyId: session.companyId }).lean();

  return NextResponse.json({
    success: true,
    hasCompany: Boolean(company),
    company: company || null,
  });
}
