import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { getTasks, getNextTaskId, appendTask } from "@/lib/sheets";
import type { TaskRow } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  try {
    let data = await getTasks();

    // Marketers only see tasks assigned to them or created by them
    if (user.role === "marketer") {
      data = data.filter(
        (t) => t.assignee === user.name || t.createdBy === user.name
      );
    }

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    console.error("Failed to fetch tasks:", err);
    return NextResponse.json({ error: `读取任务失败：${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const user = await verifyToken(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: "登录已过期" }, { status: 401 });
  }

  const body = await req.json();
  const { brand, contentType, description, dueDate, assignee } = body;

  if (!brand || !contentType || !description || !dueDate || !assignee) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }

  try {
    const nextId = await getNextTaskId();
    const taskId = `TASK${String(nextId).padStart(4, "0")}`;

    const row: TaskRow = {
      taskId,
      brand,
      contentType,
      description,
      dueDate,
      assignee,
      status: "To Do",
      createdBy: user.name,
      createdAt: new Date().toISOString(),
    };

    await appendTask(row);

    return NextResponse.json({ task: row });
  } catch (err) {
    console.error("Failed to create task:", err);
    return NextResponse.json({ error: `创建任务失败：${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
