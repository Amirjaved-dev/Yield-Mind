import { NextResponse } from "next/server";

export async function GET() {
  const integratorId = process.env.LIFI_INTEGRATOR_ID;

  if (!integratorId || integratorId === "your_lifi_integrator_id_here") {
    return NextResponse.json(
      { error: "LIFI_INTEGRATOR_ID not configured" },
      { status: 500 },
    );
  }

  try {
    const params = new URLSearchParams({
      integratorId,
    });

    const res = await fetch(
      `https://api.li.fi/v1/opportunities?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `LI.FI API error: ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 },
    );
  }
}
