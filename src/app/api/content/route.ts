import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { CONTENT_TYPES, BRANDS, ContentType, Brand } from "@/lib/config";
import { generateContentName, formatDate } from "@/lib/naming";
import { getRows, getAllRows, getNextSeqNo, appendRow, SheetRow } from "@/lib/sheets";
import { fileIdFromUrl, renameDriveFile } from "@/lib/drive";

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
    let data: (SheetRow & { brand: string })[];
    if (user.role === "master") {
      data = await getAllRows();
    } else if (user.brand) {
      const rows = await getRows(user.brand as Brand);
      data = rows.map((r) => ({ ...r, brand: user.brand! }));
    } else {
      data = [];
    }

    // Apply filters from query params
    const url = new URL(req.url);
    const brand = url.searchParams.get("brand");
    const creator = url.searchParams.get("creator");
    const type = url.searchParams.get("type");

    if (brand) data = data.filter((c) => c.brand === brand);
    if (creator) data = data.filter((c) => c.creator === creator);
    if (type) data = data.filter((c) => c.contentType === type);

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    console.error("Failed to fetch content:", err);
    return NextResponse.json({ error: `读取数据失败：${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
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
  const {
    brand,
    contentType,
    description,
    layer,
    angles,
    date,
    fileName,
    fileUrl,
  } = body;

  if (!brand || !contentType || !description) {
    return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
  }

  if (!BRANDS.includes(brand)) {
    return NextResponse.json({ error: "无效品牌" }, { status: 400 });
  }

  const typeCode = CONTENT_TYPES[contentType as ContentType];
  if (!typeCode) {
    return NextResponse.json({ error: "无效内容类型" }, { status: 400 });
  }

  try {
    const seqNo = await getNextSeqNo(brand as Brand);
    const contentDate = date ? new Date(date) : new Date();

    const name = generateContentName({
      creator: user.name,
      contentType: contentType as ContentType,
      seqNo,
      description,
      date: contentDate,
    });

    const contentId = `${typeCode}${String(seqNo).padStart(4, "0")}`;

    // Rename the uploaded Drive file to the generated content name.
    // It was uploaded under its camera filename because the name needs
    // the sequence number, which only exists now.
    let finalFileName: string = fileName || "";
    if (fileUrl) {
      const fileId = fileIdFromUrl(fileUrl);
      if (fileId) {
        try {
          const renamed = await renameDriveFile(fileId, name);
          if (renamed) finalFileName = renamed;
        } catch (err) {
          // A failed rename shouldn't lose the submission — the row still
          // records the file, just under its original name.
          console.error("Failed to rename Drive file:", err);
        }
      }
    }

    const row: SheetRow = {
      contentId,
      seqNo: String(seqNo),
      name,
      creator: user.name,
      contentType,
      typeCode,
      description,
      date: formatDate(contentDate),
      layer: layer || "",
      angles: Array.isArray(angles) ? angles.join(", ") : (angles || ""),
      ranking: "",
      isLive: "",
      fileName: finalFileName,
      fileUrl: fileUrl || "",
      createdAt: new Date().toISOString(),
      amountSpent: "",
      impressions: "",
      cpm: "",
      messagingStarted: "",
      purchases: "",
      purchaseRoas: "",
    };

    // Writes the brand tab and the Master tab in one Apps Script call
    await appendRow(brand as Brand, row);

    return NextResponse.json({ entry: { ...row, brand }, name });
  } catch (err) {
    console.error("Failed to create content:", err);
    return NextResponse.json({ error: `创建失败：${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
