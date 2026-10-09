import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { updateTask, deleteTask } from "@/lib/sheets";

// PATCH: update task status (or other fields)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    const updated = await updateTask(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error("Failed to update task:", err);
    return NextResponse.json({ error: `更新任务失败：${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}

// DELETE: remove a task
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const success = await deleteTask(id);
    if (!success) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete task:", err);
    return NextResponse.json({ error: `删除任务失败：${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
