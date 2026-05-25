// src/app/api/menu/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server'

const AWS_MENU_BASE = process.env.NEXT_PUBLIC_API_BASE
  ?? 'https://g1ou0w5x4m.execute-api.ap-south-1.amazonaws.com/dev'

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? 'tenant-burger-house-001'

function getJwtClaim(token: string, claim: string): string | null {
  try {
    const payload = token.split('.')[1]
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8')
    return JSON.parse(decoded)[claim] ?? null
  } catch { return null }
}

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const qs       = req.nextUrl.searchParams.toString()
  const upstream = `${AWS_MENU_BASE}/menus/${path.join('/')}${qs ? `?${qs}` : ''}`
  const ct       = req.headers.get('content-type') ?? ''
  const auth     = req.headers.get('authorization') ?? ''

  const tenantId = auth
    ? (getJwtClaim(auth, 'custom:tenant_id') ?? TENANT_ID)
    : TENANT_ID

  // Only set headers we control — let fetch handle Content-Type for multipart
  const forwardHeaders: HeadersInit = {
    'X-Tenant-Id': tenantId,
    ...(auth ? { 'Authorization': auth } : {}),
    // Forward Content-Type for JSON; for multipart let the Request carry its own
    ...(!ct.includes('multipart') ? { 'Content-Type': ct || 'application/json' } : {}),
  }

  let body: BodyInit | undefined
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    if (ct.includes('multipart/form-data')) {
      // Pass FormData through directly — preserves boundary and all fields
      body = await req.formData()
    } else {
      body = await req.text()
    }
  }

  console.log(`[menu-proxy] ${req.method} ${upstream} | tenant:${tenantId} | ct:${ct.slice(0,30)}`)

  try {
    const res  = await fetch(upstream, {
      method:  req.method,
      headers: forwardHeaders,
      body,
    })
    const text = await res.text()
    console.log(`[menu-proxy] → ${res.status}: ${text.slice(0, 100)}`)
    return new NextResponse(text, {
      status:  res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err: any) {
    console.error('[menu-proxy] error:', err?.message)
    return NextResponse.json({ error: 'Proxy error', message: err?.message }, { status: 502 })
  }
}

export const GET    = handler
export const POST   = handler
export const PUT    = handler
export const DELETE = handler
export const PATCH  = handler
export const OPTIONS = () => new NextResponse(null, { status: 204 })