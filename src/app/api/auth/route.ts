import { NextRequest, NextResponse } from "next/server";
import { createToken, hashPassword } from "@/lib/auth";
import { DEFAULT_USERS } from "@/lib/config";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const user = DEFAULT_USERS.find((u) => u.username === username);
  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 401 });
  }

  if (hashPassword(password) !== hashPassword(user.password)) {
    return NextResponse.json({ error: "密码错误" }, { status: 401 });
  }

  const token = await createToken({
    id: user.username,
    username: user.username,
    name: user.name,
    role: user.role,
    brand: user.brand,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.username,
      name: user.name,
      role: user.role,
      brand: user.brand,
    },
  });
}
