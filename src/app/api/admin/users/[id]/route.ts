/**
 * API Routes Admin - Utilisateur individuel
 * GET /api/admin/users/[id] - Details d'un utilisateur
 * PATCH /api/admin/users/[id] - Modifier un utilisateur
 * DELETE /api/admin/users/[id] - Supprimer un utilisateur
 */

import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdminApi, hashPassword } from "@/lib/auth-utils"

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/admin/users/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { error } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
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
            fertilisations: true,
            objetsJardin: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouve" },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("GET /api/admin/users/[id] error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la recuperation de l'utilisateur" },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/users/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params
    const body = await request.json()
    const { name, password, role, active } = body

    // Verifier que l'utilisateur existe
    const existing = await prisma.user.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Utilisateur non trouve" },
        { status: 404 }
      )
    }

    // Empecher de se desactiver soi-meme ou de se retirer admin
    if (session!.user.id === id) {
      if (active === false) {
        return NextResponse.json(
          { error: "Vous ne pouvez pas desactiver votre propre compte" },
          { status: 400 }
        )
      }
      if (role === "USER" && existing.role === "ADMIN") {
        return NextResponse.json(
          { error: "Vous ne pouvez pas retirer vos propres droits admin" },
          { status: 400 }
        )
      }
    }

    // Preparer les donnees de mise a jour
    const updateData: {
      name?: string | null
      password?: string
      role?: "ADMIN" | "USER"
      active?: boolean
    } = {}

    if (name !== undefined) updateData.name = name || null
    if (role !== undefined) updateData.role = role
    if (active !== undefined) updateData.active = active

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir au moins 6 caracteres" },
          { status: 400 }
        )
      }
      updateData.password = await hashPassword(password)
    }

    // Mise a jour
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error("PATCH /api/admin/users/[id] error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la modification de l'utilisateur" },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { error, session } = await requireAdminApi()
  if (error) return error

  try {
    const { id } = await params

    // Empecher de se supprimer soi-meme
    if (session!.user.id === id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas supprimer votre propre compte" },
        { status: 400 }
      )
    }

    // Verifier que l'utilisateur existe
    const existing = await prisma.user.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Utilisateur non trouve" },
        { status: 404 }
      )
    }

    // Suppression (cascade sur les donnees)
    await prisma.user.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/admin/users/[id] error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'utilisateur" },
      { status: 500 }
    )
  }
}
