import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { secretTokenPreHandler } from "../src/middleware/auth.js"
import type { FastifyRequest, FastifyReply } from "fastify"

function makeRequest(authorization?: string): FastifyRequest {
  return { headers: { authorization } } as unknown as FastifyRequest
}

function makeReply() {
  const reply = {
    _code: 0,
    _body: undefined as unknown,
    code(c: number) {
      this._code = c
      return this
    },
    send(b: unknown) {
      this._body = b
      return this
    },
  }
  return reply
}

describe("secretTokenPreHandler", () => {
  const SECRET = "my-secret"

  beforeEach(() => {
    vi.stubEnv("SECRET_TOKEN", SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("calls done when token is valid", () => {
    const request = makeRequest(`Bearer ${SECRET}`)
    const reply = makeReply()
    const done = vi.fn()

    secretTokenPreHandler(request, reply as unknown as FastifyReply, done)

    expect(done).toHaveBeenCalledOnce()
    expect(reply._code).toBe(0)
  })

  it("replies 401 when token is wrong", () => {
    const request = makeRequest("Bearer wrong-token")
    const reply = makeReply()
    const done = vi.fn()

    secretTokenPreHandler(request, reply as unknown as FastifyReply, done)

    expect(reply._code).toBe(401)
    expect(reply._body).toEqual({ error: "Unauthorized" })
  })

  it("replies 401 when Authorization header is absent", () => {
    const request = makeRequest(undefined)
    const reply = makeReply()
    const done = vi.fn()

    secretTokenPreHandler(request, reply as unknown as FastifyReply, done)

    expect(reply._code).toBe(401)
    expect(reply._body).toEqual({ error: "Unauthorized" })
  })

  it("replies 401 when header has Bearer prefix but empty token", () => {
    const request = makeRequest("Bearer ")
    const reply = makeReply()
    const done = vi.fn()

    secretTokenPreHandler(request, reply as unknown as FastifyReply, done)

    expect(reply._code).toBe(401)
    expect(reply._body).toEqual({ error: "Unauthorized" })
  })
})
