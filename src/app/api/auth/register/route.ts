import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma/client';
import { registerSchema } from '@/lib/validations/auth';
import { handleApiError, successResponse } from '@/lib/errors/handler';
import { ConflictError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const { fullName, email, password } = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('Această adresă de email este deja folosită');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        createdAt: true,
      },
    });

    // TODO: Send verification email

    return successResponse(
      { user, message: 'Cont creat cu succes. Verifică-ți emailul pentru activare.' },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
