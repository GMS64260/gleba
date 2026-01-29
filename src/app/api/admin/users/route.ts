/**
 * API Routes Admin - Utilisateurs
 * GET /api/admin/users - Liste des utilisateurs
 * POST /api/admin/users - Creer un utilisateur
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdminApi, hashPassword } from "@/lib/auth-utils"

// GET /api/admin/users
export async function GET() {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            cultures: true,
            planches: true,
            recoltes: true,
          },
        },
      },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error("GET /api/admin/users error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation des utilisateurs" },
      { status: 500 }
    )
  }
}

// POST /api/admin/users
export async function POST(request: NextRequest) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const body = await request.json()
    const { email, password, name, role, active } = body

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caracteres" },
        { status: 400 }
      )
    }

    // Verifier si l'email existe deja
    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe deja" },
        { status: 409 }
      )
    }

    // Hash du mot de passe
    const hashedPassword = await hashPassword(password)

    // Creation
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        role: role || "USER",
        active: active !== false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error("POST /api/admin/users error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la creation de l'utilisateur" },
      { status: 500 }
    )
  }
}
