import { NextResponse } from "next/server";
import { employees } from "@/data/employees";

// GET /api/employees/:id — full employee detail with attendance history
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const emp = employees.find((e) => e.id === id);

  if (!emp) {
    return NextResponse.json(
      { error: "Employee not found" },
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }

  return NextResponse.json(emp, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
